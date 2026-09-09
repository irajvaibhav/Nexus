"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { mergeCategories, type CustomCategoryRow } from "@/lib/categories";
import { daysLeft, daysLabel, badgeColorFor } from "@/lib/dates";
import { docHealth, LOW_CONFIDENCE_THRESHOLD } from "@/lib/doc-status";
import { detectConflicts, type ConflictGroup } from "@/lib/conflicts";
import { geocodeCity, getDailyForecast, bestUpcomingDay, type DailyForecast } from "@/lib/weather";
import { useEffect, useState } from "react";

type Deadline = {
  id: string;
  title: string;
  expiry_date: string;
  document_id: string;
};

type DocRow = {
  id: string;
  file_name: string;
  doc_category: string | null;
  status: string;
};

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const [supabase] = useState(() => createClient());
  const router = useRouter();
  const [name, setName] = useState("User");
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [fieldsCount, setFieldsCount] = useState(0);
  const [needsReviewIds, setNeedsReviewIds] = useState<Set<string>>(new Set());
  const [openTasksCount, setOpenTasksCount] = useState(0);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [customCategories, setCustomCategories] = useState<CustomCategoryRow[]>([]);
  const [conflicts, setConflicts] = useState<ConflictGroup[]>([]);
  const [askInput, setAskInput] = useState("");
  const [city, setCity] = useState("");
  const [agentPermission, setAgentPermission] = useState("recommend");
  const [forecast, setForecast] = useState<DailyForecast[]>([]);
  const [weatherError, setWeatherError] = useState(false);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [addingToCalendar, setAddingToCalendar] = useState(false);
  const [addedToCalendar, setAddedToCalendar] = useState(false);
  const [calendarError, setCalendarError] = useState("");

  const categories = mergeCategories(customCategories);
  const docFileNames = new Map(docs.map((d) => [d.id, d.file_name]));

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setName(user.user_metadata?.full_name?.split(" ")[0] || "there");
      }

      const [{ data: docRows }, { count: fields }, { count: openTasks }, { data: deadlineRows }, { data: catRows }, { data: fieldRows }, { data: profile }] =
        await Promise.all([
          supabase.from("documents").select("id, file_name, doc_category, status"),
          supabase.from("document_fields").select("*", { count: "exact", head: true }),
          supabase.from("tasks").select("*", { count: "exact", head: true }).eq("done", false),
          supabase
            .from("deadlines")
            .select("id, title, expiry_date, document_id")
            .eq("status", "active")
            .order("expiry_date", { ascending: true }),
          supabase.from("custom_categories").select("name, icon").order("created_at", { ascending: true }),
          supabase.from("document_fields").select("document_id, field_name, field_value, confidence"),
          user
            ? supabase.from("profiles").select("city, agent_permission").eq("id", user.id).single()
            : Promise.resolve({ data: null }),
        ]);

      setDocs(docRows || []);
      setFieldsCount(fields || 0);
      setOpenTasksCount(openTasks || 0);
      setDeadlines(deadlineRows || []);
      setCustomCategories(catRows || []);
      setConflicts(detectConflicts(fieldRows || []));

      const review = new Set<string>();
      for (const f of fieldRows || []) {
        if ((f.confidence ?? 1) < LOW_CONFIDENCE_THRESHOLD) review.add(f.document_id);
      }
      setNeedsReviewIds(review);

      const p = profile as { city?: string; agent_permission?: string } | null;
      setCity(p?.city || "");
      setAgentPermission(p?.agent_permission || "recommend");
    }
    load();
  }, [supabase]);

  useEffect(() => {
    if (!city) return;
    (async () => {
      try {
        const geo = await geocodeCity(city);
        if (!geo) {
          setWeatherError(true);
          return;
        }
        const days = await getDailyForecast(geo.lat, geo.lon);
        setForecast(days);
      } catch {
        setWeatherError(true);
      }
    })();
  }, [city]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/calendar/status");
        const data = await res.json();
        setCalendarConnected(!!data.connected);
      } catch {
        setCalendarConnected(false);
      }
    })();
  }, []);

  const nearestDeadline = deadlines.length > 0 ? deadlines[0] : null;
  const nearestDays = nearestDeadline ? daysLeft(nearestDeadline.expiry_date) : null;
  const deadlinesByDoc = new Map<string, string[]>();
  for (const d of deadlines) {
    const list = deadlinesByDoc.get(d.document_id) || [];
    list.push(d.expiry_date);
    deadlinesByDoc.set(d.document_id, list);
  }

  const docsNeedingAttention = docs.filter((doc) => {
    const key = docHealth({
      status: doc.status,
      lowConfidenceCount: needsReviewIds.has(doc.id) ? 1 : 0,
      expiryDates: deadlinesByDoc.get(doc.id) || [],
    }).key;
    return key === "expired" || key === "expiring" || key === "needs_review";
  });

  const verifiedCount = docs.length - docsNeedingAttention.length;
  const attentionCount = docsNeedingAttention.length + conflicts.length;

  const forecastWithinWindow = nearestDays !== null
    ? forecast.filter((_, i) => i <= Math.min(nearestDays, forecast.length - 1))
    : [];
  const suggestedDay = bestUpcomingDay(forecastWithinWindow);
  const canExecute = agentPermission === "execute";

  function goAsk(question?: string) {
    const q = (question ?? askInput).trim();
    router.push(q ? `/dashboard/ask?q=${encodeURIComponent(q)}` : "/dashboard/ask");
  }

  async function addToCalendar() {
    if (!nearestDeadline || !suggestedDay) return;
    setAddingToCalendar(true);
    setCalendarError("");
    try {
      const res = await fetch("/api/calendar/create-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Renew ${nearestDeadline.title}`,
          description: `NEXUS reminder: ${nearestDeadline.title} expires on ${new Date(nearestDeadline.expiry_date).toLocaleDateString()}.`,
          dateISO: suggestedDay.date,
        }),
      });
      const data = await res.json();
      if (res.ok) setAddedToCalendar(true);
      else setCalendarError(data.error || "Couldn't add it to your calendar.");
    } finally {
      setAddingToCalendar(false);
    }
  }

  const summary =
    docs.length === 0
      ? "Upload your first document and NEXUS will start keeping track for you."
      : attentionCount === 0
      ? "Aaj kuch pending nahi hai. Everything's in order."
      : attentionCount === 1
      ? "1 thing needs your attention."
      : `${attentionCount} things need your attention.`;

  return (
    <div className="max-w-6xl animate-fade-in-up">
      <h1 className="text-3xl font-serif font-semibold tracking-tight text-[#1A1412]">
        {greeting()}, {name} 👋
      </h1>
      <p className="text-[#7C6E67] mt-1 text-sm">{summary}</p>

      {/* The single most important thing, chosen over everything else on the page. */}
      {conflicts.length > 0 ? (
        <AttentionCard
          tone="urgent"
          eyebrow="Conflicting information"
          title={`Two documents disagree on your ${conflicts[0].label.toLowerCase()}`}
          detail={conflicts[0].entries
            .map((e) => `"${e.value}" (${docFileNames.get(e.document_id) || "Unknown"})`)
            .join(" vs ")}
          actionLabel="Resolve with NEXUS"
          onAction={() => goAsk(`What is my correct ${conflicts[0].label.toLowerCase()}?`)}
        />
      ) : nearestDeadline && nearestDays !== null && nearestDays <= 30 ? (
        <AttentionCard
          tone={nearestDays < 0 ? "urgent" : "warning"}
          eyebrow={nearestDays < 0 ? "Action needed" : "Expiring soon"}
          title={`Your ${nearestDeadline.title} ${nearestDays < 0 ? "has expired" : `expires in ${daysLabel(nearestDays)}`}`}
          detail={`From ${docFileNames.get(nearestDeadline.document_id) || "your documents"} · ${new Date(nearestDeadline.expiry_date).toLocaleDateString()}`}
          actionLabel="Plan this renewal"
          onAction={() => router.push("/dashboard/reminders")}
        />
      ) : docsNeedingAttention.length > 0 ? (
        <AttentionCard
          tone="warning"
          eyebrow="Needs review"
          title={`NEXUS wasn't sure about ${docsNeedingAttention[0].file_name}`}
          detail="Check the details it pulled out and confirm or correct them."
          actionLabel="Review it"
          onAction={() => router.push(`/dashboard/documents/${docsNeedingAttention[0].id}`)}
        />
      ) : null}

      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickAction label="Scan a document" icon="📄" href="/dashboard/documents" />
        <QuickAction label="Ask NEXUS" icon="💬" href="/dashboard/ask" />
        <QuickAction label="Fill a form" icon="🖊️" href="/dashboard/scan" />
        <QuickAction label="Add a task" icon="✓" href="/dashboard/tasks" />
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-serif font-semibold text-[#1A1412]">Coming up</h2>
              <Link href="/dashboard/reminders" className="text-xs text-[#D95D39] hover:underline font-medium">
                View all →
              </Link>
            </div>
            <div className="bg-white rounded-2xl border border-[#E5DFD7] divide-y divide-[#E5DFD7]/50">
              {deadlines.length === 0 ? (
                <p className="px-4 py-6 text-sm text-[#7C6E67]/60 text-center">
                  Nothing on the horizon. NEXUS will surface expiry dates it finds in your documents here.
                </p>
              ) : (
                deadlines.slice(0, 5).map((d) => {
                  const days = daysLeft(d.expiry_date);
                  return (
                    <div key={d.id} className="flex items-center justify-between px-4 py-3
                      hover:bg-[#FCFAF7] transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-2 h-2 rounded-full bg-[#E5DFD7] shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#2E2724] truncate">{d.title}</p>
                          <p className="text-xs text-[#7C6E67]">
                            Expires on {new Date(d.expiry_date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <span className={`text-[11px] px-2 py-1 rounded-full font-medium shrink-0 ${badgeColorFor(days)}`}>
                        {daysLabel(days)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-serif font-semibold text-[#1A1412]">Your documents</h2>
              <Link href="/dashboard/documents" className="text-xs text-[#D95D39] hover:underline font-medium">
                View all
              </Link>
            </div>

            {docs.length > 0 && (
              <p className="text-xs text-[#7C6E67] mb-3">
                {docs.length} document{docs.length === 1 ? "" : "s"} → {verifiedCount} verified
                {docsNeedingAttention.length > 0 && `, ${docsNeedingAttention.length} need${docsNeedingAttention.length === 1 ? "s" : ""} attention`}
                {fieldsCount > 0 && ` · NEXUS knows ${fieldsCount} detail${fieldsCount === 1 ? "" : "s"} from them`}
              </p>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {categories.map((cat) => (
                <Link
                  key={cat.name}
                  href={`/dashboard/documents?category=${encodeURIComponent(cat.name)}`}
                  className="bg-white rounded-2xl border border-[#E5DFD7] p-4 text-center
                    hover:border-[#D95D39] hover:-translate-y-1 hover:shadow-lg hover:shadow-[#D95D39]/5 transition-all duration-300 cursor-pointer"
                >
                  <div className={`w-10 h-10 rounded-xl ${cat.color} flex items-center
                    justify-center text-lg mx-auto`}>
                    {cat.icon}
                  </div>
                  <p className="text-xs font-semibold text-[#2E2724] mt-2.5">{cat.name}</p>
                  <p className="text-[11px] text-[#7C6E67] mt-0.5">
                    {docs.filter((d) => d.doc_category === cat.name).length} docs
                  </p>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {nearestDeadline && nearestDays !== null && nearestDays <= 14 && (
            <div className="rounded-2xl border border-[#E5DFD7] overflow-hidden bg-[#FAF8F5]">
              <div className="p-4 border-b border-[#E5DFD7]/60">
                <h3 className="text-sm font-semibold text-[#D95D39] flex items-center gap-2">
                  ✨ NEXUS suggests
                </h3>
              </div>
              <div className="p-4">
                {suggestedDay ? (
                  <p className="text-sm text-[#2E2724]">
                    {new Date(suggestedDay.date).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })} looks
                    like the easiest day to sort this out in {city} — {suggestedDay.description.toLowerCase()},{" "}
                    {suggestedDay.tempMin}–{suggestedDay.tempMax}°C, {suggestedDay.precipProbability}% chance of rain.
                  </p>
                ) : city && !weatherError ? (
                  <p className="text-sm text-[#7C6E67]">Checking the forecast for {city}&hellip;</p>
                ) : (
                  <p className="text-sm text-[#7C6E67]">
                    <Link href="/dashboard/settings" className="text-[#D95D39] hover:underline font-medium">
                      City add karo
                    </Link>{" "}
                    — NEXUS timing suggestions better karega.
                  </p>
                )}

                <div className="mt-4 space-y-2">
                  <button
                    onClick={() => goAsk(`What do I need to renew my ${nearestDeadline.title}?`)}
                    className="w-full py-2 bg-[#D95D39] text-white rounded-xl text-sm
                      font-medium hover:bg-[#C24E2B] transition-colors shadow-sm"
                  >
                    Ask NEXUS about it
                  </button>

                  {calendarConnected && suggestedDay && (
                    canExecute ? (
                      <button
                        onClick={addToCalendar}
                        disabled={addingToCalendar || addedToCalendar}
                        className="w-full py-2 border border-[#E5DFD7] text-[#2E2724] rounded-xl text-sm
                          font-medium hover:bg-[#FAF8F5] transition-colors bg-white disabled:opacity-60"
                      >
                        {addedToCalendar ? "Added to Calendar ✓" : addingToCalendar ? "Adding..." : "Add to Google Calendar"}
                      </button>
                    ) : (
                      <p className="text-[11px] text-[#7C6E67] leading-relaxed">
                        NEXUS can add this to your calendar once you allow it to act.{" "}
                        <Link href="/dashboard/settings" className="text-[#D95D39] hover:underline font-medium">
                          Change in Settings
                        </Link>
                      </p>
                    )
                  )}

                  {calendarError && (
                    <p className="text-[11px] text-red-600">{calendarError}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-[#E5DFD7] overflow-hidden">
            <div className="p-4 border-b border-[#E5DFD7]/60">
              <h3 className="text-sm font-semibold text-[#1A1412] flex items-center gap-2">
                💬 Ask NEXUS
              </h3>
            </div>
            <div className="p-3 space-y-1.5">
              <QuickQ text="What's my passport number?" onClick={goAsk} />
              <QuickQ text="When does my insurance expire?" onClick={goAsk} />
              <QuickQ text="Show my bank account details" onClick={goAsk} />
              <QuickQ text="Documents expiring this month?" onClick={goAsk} />
            </div>
            <div className="p-3 border-t border-[#E5DFD7]/60">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={askInput}
                  onChange={(e) => setAskInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && goAsk()}
                  placeholder="Bol do / type karo..."
                  className="flex-1 px-3 py-2 bg-[#FCFAF7] border border-[#E5DFD7]
                    rounded-xl text-sm focus:outline-none focus:ring-2
                    focus:ring-[#D95D39] focus:border-transparent text-[#2E2724] placeholder-[#7C6E67]/50"
                />
                <button
                  onClick={() => goAsk()}
                  className="px-3 py-2 bg-[#D95D39] text-white rounded-xl hover:bg-[#C24E2B] transition-colors"
                >
                  <span className="text-sm">➤</span>
                </button>
              </div>
            </div>
          </div>

          {openTasksCount > 0 && (
            <Link
              href="/dashboard/tasks"
              className="block bg-white rounded-2xl border border-[#E5DFD7] p-4
                hover:border-[#D95D39] transition-colors"
            >
              <p className="text-sm font-semibold text-[#2E2724]">
                {openTasksCount} open task{openTasksCount === 1 ? "" : "s"}
              </p>
              <p className="text-xs text-[#7C6E67] mt-0.5">Things you decided to handle yourself →</p>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function AttentionCard({ tone, eyebrow, title, detail, actionLabel, onAction }: {
  tone: "urgent" | "warning";
  eyebrow: string;
  title: string;
  detail: string;
  actionLabel: string;
  onAction: () => void;
}) {
  const styles = tone === "urgent"
    ? { wrap: "border-[#F5DFD6] bg-[#FDF2EE]", eyebrow: "text-[#D95D39]" }
    : { wrap: "border-[#FBEAC9] bg-[#FEF9EC]", eyebrow: "text-[#B9832A]" };

  return (
    <div className={`mt-5 rounded-2xl border p-5 ${styles.wrap}`}>
      <p className={`text-[11px] font-semibold uppercase tracking-wider ${styles.eyebrow}`}>
        {eyebrow}
      </p>
      <p className="text-base font-semibold text-[#1A1412] mt-1.5">{title}</p>
      <p className="text-sm text-[#7C6E67] mt-1">{detail}</p>
      <button
        onClick={onAction}
        className="mt-4 px-4 py-2 bg-[#D95D39] text-white rounded-xl text-sm font-semibold
          hover:bg-[#C24E2B] transition-colors shadow-sm"
      >
        {actionLabel}
      </button>
    </div>
  );
}

function QuickAction({ label, icon, href }: { label: string; icon: string; href: string }) {
  return (
    <Link
      href={href}
      className="bg-white rounded-2xl border border-[#E5DFD7] px-4 py-3.5 flex items-center gap-2.5
        hover:border-[#D95D39] hover:-translate-y-0.5 transition-all duration-200"
    >
      <span className="text-lg">{icon}</span>
      <span className="text-sm font-semibold text-[#2E2724]">{label}</span>
    </Link>
  );
}

function QuickQ({ text, onClick }: { text: string; onClick: (question: string) => void }) {
  return (
    <button
      onClick={() => onClick(text)}
      className="w-full text-left px-3 py-2 rounded-xl text-sm text-[#7C6E67]
      hover:bg-[#F4EFEA] hover:text-[#D95D39] transition-all"
    >
      {text}
    </button>
  );
}
