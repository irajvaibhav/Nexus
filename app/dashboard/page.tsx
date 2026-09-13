"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { daysLeft, daysLabel } from "@/lib/dates";
import { docHealth, LOW_CONFIDENCE_THRESHOLD } from "@/lib/doc-status";
import { detectConflicts, type ConflictGroup } from "@/lib/conflicts";
import { geocodeCity, getDailyForecast, bestUpcomingDay, type DailyForecast } from "@/lib/weather";
import { DocumentsIcon, ChatIcon, ScanIcon, CheckSquareIcon, SparkleIcon, BellIcon, ArrowUpIcon, MicIcon } from "@/components/icons";
import { DocIcon } from "@/components/doc-icon";
import { WeekView, type WeekEvent } from "@/components/week-view";
import { CategoryIcon } from "@/components/category-icon";
import { mergeCategories, type CustomCategoryRow } from "@/lib/categories";
import { useCallback, useEffect, useState } from "react";

type Deadline = {
  id: string;
  title: string;
  expiry_date: string;
  document_id: string;
};

type DocRow = {
  id: string;
  file_name: string;
  doc_type: string | null;
  doc_category: string | null;
  status: string;
  uploaded_at: string;
};

type Attention = {
  key: string;
  icon: string;
  title: string;
  detail: string;
  action: string;
  tone: "blue" | "amber" | "rose";
  onAction: () => void;
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
  const [name, setName] = useState("");
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [needsReviewIds, setNeedsReviewIds] = useState<Set<string>>(new Set());
  const [openTasksCount, setOpenTasksCount] = useState(0);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [conflicts, setConflicts] = useState<ConflictGroup[]>([]);
  const [city, setCity] = useState("");
  const [agentPermission, setAgentPermission] = useState("recommend");
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [forecast, setForecast] = useState<DailyForecast[]>([]);
  const [weatherLabel, setWeatherLabel] = useState("");
  const [weatherState, setWeatherState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [weatherError, setWeatherError] = useState("");
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [addingToCalendar, setAddingToCalendar] = useState(false);
  const [addedLink, setAddedLink] = useState<string | null>(null);
  const [addedToCalendar, setAddedToCalendar] = useState(false);
  const [calendarError, setCalendarError] = useState("");
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [events, setEvents] = useState<WeekEvent[]>([]);
  const [customCategories, setCustomCategories] = useState<CustomCategoryRow[]>([]);
  const [loadingPage, setLoadingPage] = useState(true);
  const [askInput, setAskInput] = useState("");

  const docFileNames = new Map(docs.map((d) => [d.id, d.file_name]));

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setName(user.user_metadata?.full_name?.split(" ")[0] || "there");
      }

      const [{ data: docRows }, { count: openTasks }, { data: deadlineRows }, { data: fieldRows }, { data: profile }, { data: catRows }] =
        await Promise.all([
          supabase.from("documents").select("id, file_name, doc_type, doc_category, status, uploaded_at").order("uploaded_at", { ascending: false }),
          supabase.from("tasks").select("*", { count: "exact", head: true }).eq("done", false),
          supabase
            .from("deadlines")
            .select("id, title, expiry_date, document_id")
            .eq("status", "active")
            .order("expiry_date", { ascending: true }),
          supabase.from("document_fields").select("document_id, field_name, field_value, confidence"),
          user
            ? supabase.from("profiles").select("city, agent_permission").eq("id", user.id).single()
            : Promise.resolve({ data: null }),
          supabase.from("custom_categories").select("name, icon").order("created_at", { ascending: true }),
        ]);
      setCustomCategories(catRows || []);

      setDocs(docRows || []);
      setOpenTasksCount(openTasks || 0);
      setDeadlines(deadlineRows || []);
      setConflicts(detectConflicts(fieldRows || []));

      const review = new Set<string>();
      for (const f of fieldRows || []) {
        if ((f.confidence ?? 1) < LOW_CONFIDENCE_THRESHOLD) review.add(f.document_id);
      }
      setNeedsReviewIds(review);

      const p = profile as { city?: string; agent_permission?: string } | null;
      setCity(p?.city || "");
      setAgentPermission(p?.agent_permission || "recommend");
      setProfileLoaded(true);
      setLoadingPage(false);
    }
    load();
  }, [supabase]);

  const loadWeather = useCallback(async () => {
    if (!city) {
      setWeatherState("idle");
      return;
    }
    setWeatherState("loading");
    setWeatherError("");
    try {
      const geo = await geocodeCity(city);
      if (!geo) {
        setWeatherError(`Couldn't find "${city}". Check the spelling in Settings.`);
        setWeatherState("error");
        return;
      }
      const days = await getDailyForecast(geo.lat, geo.lon);
      setForecast(days);
      setWeatherLabel(geo.label);
      setWeatherState("ready");
    } catch (err) {
      setWeatherError(err instanceof Error ? err.message : "Couldn't load the forecast.");
      setWeatherState("error");
    }
  }, [city]);

  useEffect(() => {
    loadWeather();
  }, [loadWeather]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/calendar/upcoming");
        const data = await res.json();
        setCalendarConnected(!!data.connected);
        setEvents(data.events || []);
      } catch {
        setCalendarConnected(false);
      }
      setCalendarLoading(false);
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

  const docsNeedingReview = docs.filter((doc) => {
    const key = docHealth({
      status: doc.status,
      lowConfidenceCount: needsReviewIds.has(doc.id) ? 1 : 0,
      expiryDates: deadlinesByDoc.get(doc.id) || [],
    }).key;
    return key === "needs_review";
  });

  const forecastWithinWindow =
    nearestDays !== null && nearestDays >= 0
      ? forecast.filter((_, i) => i <= Math.min(nearestDays, forecast.length - 1))
      : forecast;
  // With a calendar connected, prefer a dry day that is also free; fall back to
  // the driest day if every candidate has something on it.
  const busyDays = new Set(events.map((e) => e.start.slice(0, 10)));
  const freeCandidates = calendarConnected ? forecastWithinWindow.filter((f) => !busyDays.has(f.date)) : forecastWithinWindow;
  const suggestedDay = bestUpcomingDay(freeCandidates.length > 0 ? freeCandidates : forecastWithinWindow);
  const canExecute = agentPermission === "execute";

  function goAsk(question: string) {
    router.push(`/dashboard/ask?q=${encodeURIComponent(question)}`);
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
      if (res.ok) {
        setAddedToCalendar(true);
        setAddedLink(data.htmlLink || null);
      } else {
        setCalendarError(data.error || "Couldn't add it to your calendar.");
      }
    } finally {
      setAddingToCalendar(false);
    }
  }

  // The two most pressing things, in priority order: a contradiction first,
  // then the soonest expiry, then a document waiting on the user.
  const attention: Attention[] = [];
  if (conflicts.length > 0) {
    const c = conflicts[0];
    attention.push({
      key: "conflict",
      icon: "⚠️",
      tone: "rose",
      title: `${c.label} doesn't match`,
      detail: c.entries.map((e) => docFileNames.get(e.document_id) || "Unknown").join(" vs "),
      action: "Resolve",
      onAction: () => goAsk(`What is my correct ${c.label.toLowerCase()}?`),
    });
  }
  for (const d of deadlines) {
    if (attention.length >= 2) break;
    const days = daysLeft(d.expiry_date);
    if (days > 30) break;
    attention.push({
      key: d.id,
      icon: days < 0 ? "⏰" : "📅",
      tone: days < 0 ? "rose" : "amber",
      title: `${d.title} ${days < 0 ? "expired" : "expiring"}`,
      detail: days < 0 ? `Ended ${daysLabel(days)}` : `Ends in ${daysLabel(days)}`,
      action: "Renew",
      onAction: () => router.push("/dashboard/reminders"),
    });
  }
  if (attention.length < 2 && docsNeedingReview.length > 0) {
    const doc = docsNeedingReview[0];
    attention.push({
      key: doc.id,
      icon: "🔍",
      tone: "blue",
      title: "Details to confirm",
      detail: doc.file_name,
      action: "Review",
      onAction: () => router.push(`/dashboard/documents/${doc.id}`),
    });
  }

  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const categories = mergeCategories(customCategories);
  const suggestion = suggestedDay && nearestDeadline && nearestDays !== null && nearestDays <= 45
    ? { day: suggestedDay, forTitle: nearestDeadline.title.toLowerCase() }
    : null;

  function submitAsk(e: React.FormEvent) {
    e.preventDefault();
    goAsk(askInput.trim() || "What needs my attention this week?");
  }

  if (loadingPage) return <HomeSkeleton />;

  return (
    <div className="animate-fade-in-up">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">{today}</p>
      <h1 className="text-4xl font-bold text-[#0F172A] mt-2">
        {greeting()}, {name || "there"}.
      </h1>

      {/* Ask NEXUS first: it's the core of the product, so it sits right under the greeting. */}
      <section className="mt-6 relative">
        <div className="absolute -inset-px rounded-[22px] bg-gradient-to-r from-[#2563EB]/40 via-[#4F46E5]/30 to-[#0EA5E9]/40 blur-sm opacity-70 pointer-events-none" />
        <form onSubmit={submitAsk} className="relative card p-2 pl-4 flex items-center gap-2 shadow-xl shadow-[#2563EB]/10">
          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#4F46E5] text-white flex items-center justify-center shrink-0 shadow-md shadow-[#2563EB]/30">
            <SparkleIcon className="w-5 h-5" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#2563EB] leading-none">Ask NEXUS</p>
            <input
              value={askInput}
              onChange={(e) => setAskInput(e.target.value)}
              placeholder="When does my insurance expire? What's my PAN? What do I need for a loan?"
              className="w-full py-1.5 bg-transparent text-[15px] text-[#0F172A] placeholder-[#94A3B8] focus:outline-none"
            />
          </div>
          <Link href="/dashboard/ask?voice=1" className="hidden sm:flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-[#E6E8EE] text-sm font-medium text-[#1E293B] hover:bg-[#F8FAFC] transition-colors">
            <MicIcon className="w-[18px] h-[18px]" /> Voice
          </Link>
          <button type="submit" className="w-11 h-11 rounded-xl bg-[#0F172A] text-white flex items-center justify-center hover:bg-[#1E293B] transition-colors" aria-label="Ask">
            <ArrowUpIcon className="w-5 h-5" />
          </button>
        </form>
      </section>

      {attention.length > 0 && (
        <>
          <p className="text-sm font-semibold text-[#0F172A] mt-7 mb-3">What needs your attention</p>
          <div className={`grid grid-cols-1 gap-3 stagger ${attention.length > 1 ? "md:grid-cols-2" : ""}`}>
            {attention.map((a, i) => (
              <AttentionCard key={a.key} item={a} primary={i === 0} />
            ))}
          </div>
        </>
      )}
      {attention.length === 0 && docs.length === 0 && (
        <div className="card mt-7 px-5 py-4 flex items-center gap-3">
          <span className="w-9 h-9 rounded-full bg-gradient-to-br from-[#DBEAFE] to-[#BFDBFE] text-[#1D4ED8] flex items-center justify-center font-bold">+</span>
          <p className="text-sm text-[#1E293B]">Add your first document and NEXUS starts keeping track.</p>
          <Link href="/dashboard/documents" className="ml-auto px-4 py-2 rounded-full bg-gradient-to-r from-[#2563EB] to-[#4F46E5] text-white text-sm font-semibold shadow-md shadow-[#2563EB]/30">
            Add document
          </Link>
        </div>
      )}

      <div className="mt-6">
        <WeekView
          cityLabel={weatherLabel.split(",")[0] || city}
          weatherState={weatherState}
          forecast={forecast}
          onRetryWeather={loadWeather}
          calendarConnected={calendarConnected}
          calendarLoading={calendarLoading}
          events={events}
          deadlines={deadlines}
          suggestion={suggestion}
          onAddToCalendar={addToCalendar}
          addState={addedToCalendar ? "added" : addingToCalendar ? "adding" : "idle"}
          addedLink={addedLink}
          canExecute={canExecute}
        />
        {calendarError && <p className="mt-2 text-xs text-[#DB2777]">{calendarError}</p>}
      </div>

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-[1.9fr_1fr] gap-4 items-start">
        <div className="space-y-4">
          <section className="card flex flex-col">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h2 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-[#FFF7ED] text-[#EA580C] flex items-center justify-center"><BellIcon className="w-4 h-4" /></span>
                Coming up
              </h2>
              <Link href="/dashboard/reminders" className="text-xs px-3 py-1.5 rounded-full border border-[#E6E8EE] text-[#1E293B] font-medium hover:bg-[#F8FAFC]">
                View all
              </Link>
            </div>
            {deadlines.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center px-6 pb-8 pt-2">
                <span className="w-12 h-12 rounded-2xl bg-[#FFF7ED] text-[#EA580C] flex items-center justify-center mb-3"><BellIcon className="w-6 h-6" /></span>
                <p className="text-sm font-semibold text-[#0F172A]">No dates on the horizon</p>
                <p className="text-xs text-[#64748B] mt-1 max-w-xs">Expiry and renewal dates from your documents appear here, soonest first.</p>
              </div>
            ) : (
              <ul className="divide-y divide-[#E6E8EE]/70">
                {deadlines.slice(0, 5).map((d) => {
                  const days = daysLeft(d.expiry_date);
                  const date = new Date(d.expiry_date);
                  return (
                    <li key={d.id} className="grid grid-cols-[56px_1fr_auto] items-center gap-4 px-5 py-3.5 hover:bg-[#F8FAFC] transition-colors">
                      <div className={`rounded-xl py-1.5 text-center ${days < 0 ? "bg-[#FDF2F8] text-[#DB2777]" : days <= 14 ? "bg-[#FFFBEB] text-[#D97706]" : "bg-[#F1F5F9] text-[#0F172A]"}`}>
                        <p className="text-base font-bold leading-tight">{date.getDate()}</p>
                        <p className="text-[10px] font-semibold uppercase opacity-80">{date.toLocaleDateString(undefined, { month: "short" })}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#0F172A] truncate">{d.title}</p>
                        <p className="text-xs text-[#64748B] truncate">{docFileNames.get(d.document_id) || "Your documents"}</p>
                      </div>
                      <span className={`text-xs font-medium ${days < 0 ? "text-[#DB2777]" : days <= 14 ? "text-[#D97706]" : "text-[#64748B]"}`}>
                        {daysLabel(days)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 stagger">
            <Tile href="/dashboard/documents" label="Scan" hint="Add a document" tone="from-[#2563EB] to-[#4F46E5]" icon={<DocumentsIcon className="w-5 h-5" />} />
            <Tile href="/dashboard/ask" label="Ask" hint="Get an answer" tone="from-[#0EA5E9] to-[#2563EB]" icon={<ChatIcon className="w-5 h-5" />} />
            <Tile href="/dashboard/tasks" label="Add" hint="New task" tone="from-[#16A34A] to-[#0D9488]" icon={<CheckSquareIcon className="w-5 h-5" />} />
            <Tile href="/dashboard/scan" label="Fill" hint="Complete a form" tone="from-[#F97316] to-[#DB2777]" icon={<ScanIcon className="w-5 h-5" />} />
          </div>
        </div>

        <div className="space-y-4">
          <section className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#0F172A]">Vault</h2>
              <Link href="/dashboard/documents" className="text-xs px-3 py-1.5 rounded-full border border-[#E6E8EE] text-[#1E293B] font-medium hover:bg-[#F8FAFC]">
                View all
              </Link>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {categories.slice(0, 4).map((cat) => (
                <Link key={cat.name} href={`/dashboard/documents?category=${encodeURIComponent(cat.name)}`} className="flex items-center gap-2.5 rounded-xl border border-[#E6E8EE] px-3 py-2.5 hover:border-[#2563EB]/40 hover:bg-[#F8FAFC] transition-colors">
                  <CategoryIcon name={cat.name} emoji={cat.icon} size="sm" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#0F172A] truncate">{cat.name}</p>
                    <p className="text-[11px] text-[#64748B]">{docs.filter((d) => d.doc_category === cat.name).length} docs</p>
                  </div>
                </Link>
              ))}
            </div>
            {docs.length > 0 && (
              <ul className="mt-3 pt-3 border-t border-[#E6E8EE]/70 space-y-2.5">
                {docs.slice(0, 3).map((doc) => (
                  <li key={doc.id}>
                    <Link href={`/dashboard/documents/${doc.id}`} className="flex items-center gap-3 group">
                      <DocIcon docType={doc.doc_type} fileName={doc.file_name} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#0F172A] truncate group-hover:text-[#2563EB]">{doc.file_name}</p>
                        <p className="text-xs text-[#64748B] truncate capitalize">{(doc.doc_type || doc.doc_category || "Document").replace(/_/g, " ")}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {openTasksCount > 0 && (
            <Link href="/dashboard/tasks" className="card card-hover flex items-center gap-3 px-5 py-4">
              <CheckSquareIcon className="w-5 h-5 text-[#2563EB]" />
              <p className="text-sm font-semibold text-[#1E293B]">
                {openTasksCount} open task{openTasksCount === 1 ? "" : "s"}
              </p>
              <span className="ml-auto text-xs text-[#64748B]">View</span>
            </Link>
          )}

          <section className="rounded-2xl border border-[#E6E8EE] bg-gradient-to-br from-[#F8FAFC] to-[#EEF2FF] p-5 flex gap-3">
            <span className="w-9 h-9 rounded-full bg-[#0F172A] text-white flex items-center justify-center text-sm shrink-0 shadow-md">🔒</span>
            <div>
              <p className="text-sm font-semibold text-[#0F172A]">Private by default</p>
              <p className="text-xs text-[#64748B] mt-0.5 leading-relaxed">
                Sensitive numbers stay masked until you tap them. NEXUS acts only after you approve.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading your home">
      <div className="skeleton h-3 w-40" />
      <div className="skeleton h-10 w-80 mt-3" />
      <div className="skeleton h-16 w-full mt-6 rounded-2xl" />
      <div className="skeleton h-56 w-full mt-6 rounded-2xl" />
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-[1.9fr_1fr] gap-4">
        <div className="space-y-4">
          <div className="skeleton h-48 rounded-2xl" />
          <div className="grid grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-32 rounded-2xl" />)}
          </div>
        </div>
        <div className="space-y-4">
          <div className="skeleton h-56 rounded-2xl" />
          <div className="skeleton h-24 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

function AttentionCard({ item, primary }: { item: Attention; primary: boolean }) {
  const { icon, title, detail, action, tone, onAction } = item;
  const tones = {
    blue: "bg-[#EAF2FF] text-[#2563EB]",
    amber: "bg-[#FFFBEB] text-[#D97706]",
    rose: "bg-[#FDF2F8] text-[#DB2777]",
  };
  return (
    <div className="card card-hover px-5 py-4 flex items-center gap-4">
      <span className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 ${tones[tone]}`}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#0F172A] truncate">{title}</p>
        <p className="text-xs text-[#64748B] truncate">{detail}</p>
      </div>
      <button
        onClick={onAction}
        className={`text-sm px-4 py-2 rounded-full font-semibold transition-colors shrink-0 ${
          primary ? "bg-gradient-to-r from-[#2563EB] to-[#4F46E5] text-white shadow-md shadow-[#2563EB]/30 hover:shadow-lg" : "border border-[#E6E8EE] text-[#1E293B] hover:bg-[#F8FAFC]"
        }`}
      >
        {action}
      </button>
    </div>
  );
}

function Tile({ href, label, hint, tone, icon }: { href: string; label: string; hint: string; tone: string; icon: React.ReactNode }) {
  return (
    <Link href={href} className="card card-hover py-5 flex flex-col items-center gap-2.5">
      <span className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${tone} text-white flex items-center justify-center shadow-lg shadow-[#0F172A]/10`}>{icon}</span>
      <span className="text-sm font-bold text-[#0F172A]">{label}</span>
      <span className="text-[11px] text-[#64748B] -mt-1.5">{hint}</span>
    </Link>
  );
}
