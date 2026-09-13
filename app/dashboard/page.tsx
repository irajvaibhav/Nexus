"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { daysLeft, daysLabel } from "@/lib/dates";
import { docHealth, LOW_CONFIDENCE_THRESHOLD } from "@/lib/doc-status";
import { detectConflicts, type ConflictGroup } from "@/lib/conflicts";
import { geocodeCity, getDailyForecast, bestUpcomingDay, weatherEmoji, type DailyForecast } from "@/lib/weather";
import { DocumentsIcon, ChatIcon, ScanIcon, CheckSquareIcon } from "@/components/icons";
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

  const docFileNames = new Map(docs.map((d) => [d.id, d.file_name]));

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setName(user.user_metadata?.full_name?.split(" ")[0] || "there");
      }

      const [{ data: docRows }, { count: openTasks }, { data: deadlineRows }, { data: fieldRows }, { data: profile }] =
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
        ]);

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
  const suggestedDay = bestUpcomingDay(forecastWithinWindow);
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

  return (
    <div className="animate-fade-in-up">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">{today}</p>
      <h1 className="text-4xl font-semibold tracking-tight text-[#0F172A] mt-2">
        {greeting()}, {name || "there"}.
      </h1>

      <p className="text-sm text-[#64748B] mt-6 mb-3">What needs your attention</p>
      {attention.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E6E8EE] px-5 py-4 flex items-center gap-3">
          <span className="w-9 h-9 rounded-full bg-[#F0FDF4] text-[#15803D] flex items-center justify-center">✓</span>
          <p className="text-sm text-[#1E293B]">
            {docs.length === 0 ? "Nothing yet. Add your first document to get started." : "Nothing pending. Everything is in order."}
          </p>
          {docs.length === 0 && (
            <Link href="/dashboard/documents" className="ml-auto px-4 py-2 rounded-full bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#1D4ED8]">
              Add document
            </Link>
          )}
        </div>
      ) : (
        <div className={`grid grid-cols-1 gap-3 ${attention.length > 1 ? "md:grid-cols-2" : ""}`}>
          {attention.map((a, i) => (
            <AttentionCard key={a.key} item={a} primary={i === 0} />
          ))}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1.9fr_1fr] gap-4 items-start">
        <div className="space-y-4">
          <section className="bg-white rounded-2xl border border-[#E6E8EE]">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h2 className="text-base font-semibold text-[#0F172A]">Coming up</h2>
              <Link href="/dashboard/reminders" className="text-xs px-3 py-1.5 rounded-full border border-[#E6E8EE] text-[#1E293B] font-medium hover:bg-[#F8FAFC]">
                View all
              </Link>
            </div>

            {deadlines.length === 0 ? (
              <p className="px-5 pb-6 text-sm text-[#64748B]">
                No dates on the horizon. Expiry dates from your documents show up here.
              </p>
            ) : (
              <ul className="divide-y divide-[#E6E8EE]/70">
                {deadlines.slice(0, 4).map((d) => {
                  const days = daysLeft(d.expiry_date);
                  const date = new Date(d.expiry_date);
                  return (
                    <li key={d.id} className="grid grid-cols-[64px_1fr_auto] items-center gap-4 px-5 py-3.5">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-[#0F172A] leading-tight">{date.getDate()}</p>
                        <p className="text-[11px] text-[#64748B] uppercase">{date.toLocaleDateString(undefined, { month: "short" })}</p>
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

            {nearestDeadline && nearestDays !== null && nearestDays <= 30 && (
              <div className="mx-5 mb-5 mt-2 rounded-xl bg-[#F8FAFC] border border-[#E6E8EE] px-4 py-3 flex items-center gap-3 flex-wrap">
                <span className="w-7 h-7 rounded-full bg-[#EAF2FF] text-[#2563EB] flex items-center justify-center text-sm shrink-0">✦</span>
                <p className="text-sm text-[#1E293B] flex-1 min-w-[200px]">
                  {suggestedDay
                    ? <>NEXUS suggests <span className="font-semibold">{new Date(`${suggestedDay.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "long" })}</span> for the {nearestDeadline.title.toLowerCase()} renewal. {suggestedDay.description}, {suggestedDay.precipProbability}% rain.</>
                    : weatherState === "loading"
                    ? <>Checking the forecast for a good day…</>
                    : weatherState === "error"
                    ? <>Forecast unavailable, so no day suggested yet. <button onClick={loadWeather} className="text-[#2563EB] font-medium">Retry</button></>
                    : <><Link href="/dashboard/settings" className="text-[#2563EB] font-medium">Add your city</Link> and NEXUS will pick a good day for this.</>}
                </p>
                {suggestedDay && (
                  calendarConnected && canExecute ? (
                    addedToCalendar ? (
                      addedLink
                        ? <a href={addedLink} target="_blank" rel="noreferrer" className="text-xs px-3 py-1.5 rounded-full bg-[#F0FDF4] text-[#15803D] font-semibold">Added ✓ Open</a>
                        : <span className="text-xs px-3 py-1.5 rounded-full bg-[#F0FDF4] text-[#15803D] font-semibold">Added ✓</span>
                    ) : (
                      <button onClick={addToCalendar} disabled={addingToCalendar} className="text-xs px-3 py-1.5 rounded-full border border-[#E6E8EE] bg-white text-[#1E293B] font-semibold hover:bg-[#F8FAFC] disabled:opacity-50">
                        {addingToCalendar ? "Adding…" : "Add to calendar"}
                      </button>
                    )
                  ) : (
                    <button onClick={() => goAsk(`What do I need to renew my ${nearestDeadline.title}?`)} className="text-xs px-3 py-1.5 rounded-full border border-[#E6E8EE] bg-white text-[#1E293B] font-semibold hover:bg-[#F8FAFC]">
                      Ask NEXUS
                    </button>
                  )
                )}
                {calendarError && <p className="w-full text-xs text-[#DB2777]">{calendarError}</p>}
              </div>
            )}
          </section>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Tile href="/dashboard/documents" label="Scan" icon={<DocumentsIcon className="w-5 h-5" />} />
            <Tile href="/dashboard/ask" label="Ask" icon={<ChatIcon className="w-5 h-5" />} />
            <Tile href="/dashboard/tasks" label="Add" icon={<span className="text-lg leading-none">+</span>} />
            <Tile href="/dashboard/scan" label="Fill" icon={<ScanIcon className="w-5 h-5" />} />
          </div>

          {openTasksCount > 0 && (
            <Link href="/dashboard/tasks" className="flex items-center gap-3 bg-white rounded-2xl border border-[#E6E8EE] px-5 py-4 hover:border-[#2563EB]/40 transition-colors">
              <CheckSquareIcon className="w-5 h-5 text-[#2563EB]" />
              <p className="text-sm font-semibold text-[#1E293B]">
                {openTasksCount} open task{openTasksCount === 1 ? "" : "s"}
              </p>
              <span className="ml-auto text-xs text-[#64748B]">View</span>
            </Link>
          )}
        </div>

        <div className="space-y-4">
          <WeatherCard
            city={city}
            label={weatherLabel}
            state={profileLoaded ? weatherState : "loading"}
            error={weatherError}
            forecast={forecast}
            onRetry={loadWeather}
          />

          <section className="bg-white rounded-2xl border border-[#E6E8EE] p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#0F172A]">Documents</h2>
              <Link href="/dashboard/documents" className="text-xs px-3 py-1.5 rounded-full border border-[#E6E8EE] text-[#1E293B] font-medium hover:bg-[#F8FAFC]">
                View all
              </Link>
            </div>
            {docs.length === 0 ? (
              <p className="mt-3 text-sm text-[#64748B]">Nothing uploaded yet.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {docs.slice(0, 3).map((doc) => (
                  <li key={doc.id}>
                    <Link href={`/dashboard/documents/${doc.id}`} className="flex items-center gap-3 group">
                      <span className="w-9 h-9 rounded-lg bg-[#EAF2FF] text-[#2563EB] flex items-center justify-center text-sm shrink-0">
                        {doc.file_name.toLowerCase().endsWith(".pdf") ? "📄" : "🖼️"}
                      </span>
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

          <section className="bg-[#F8FAFC] rounded-2xl border border-[#E6E8EE] p-5 flex gap-3">
            <span className="w-9 h-9 rounded-full bg-[#0F172A] text-white flex items-center justify-center text-sm shrink-0">🔒</span>
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

function AttentionCard({ item, primary }: { item: Attention; primary: boolean }) {
  const { icon, title, detail, action, tone, onAction } = item;
  const tones = {
    blue: "bg-[#EAF2FF] text-[#2563EB]",
    amber: "bg-[#FFFBEB] text-[#D97706]",
    rose: "bg-[#FDF2F8] text-[#DB2777]",
  };
  return (
    <div className="bg-white rounded-2xl border border-[#E6E8EE] px-5 py-4 flex items-center gap-4">
      <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${tones[tone]}`}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#0F172A] truncate">{title}</p>
        <p className="text-xs text-[#64748B] truncate">{detail}</p>
      </div>
      <button
        onClick={onAction}
        className={`text-sm px-4 py-2 rounded-full font-semibold transition-colors shrink-0 ${
          primary ? "bg-[#2563EB] text-white hover:bg-[#1D4ED8]" : "border border-[#E6E8EE] text-[#1E293B] hover:bg-[#F8FAFC]"
        }`}
      >
        {action}
      </button>
    </div>
  );
}

function Tile({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="bg-white rounded-2xl border border-[#E6E8EE] py-5 flex flex-col items-center gap-3
        hover:border-[#2563EB]/40 hover:-translate-y-0.5 transition-all"
    >
      <span className="w-11 h-11 rounded-full bg-[#EAF2FF] text-[#2563EB] flex items-center justify-center">{icon}</span>
      <span className="text-sm font-medium text-[#0F172A]">{label}</span>
    </Link>
  );
}

function WeatherCard({ city, label, state, error, forecast, onRetry }: {
  city: string;
  label: string;
  state: "idle" | "loading" | "ready" | "error";
  error: string;
  forecast: DailyForecast[];
  onRetry: () => void;
}) {
  const today = forecast[0];
  const best = bestUpcomingDay(forecast.slice(1));

  return (
    <section className="bg-white rounded-2xl border border-[#E6E8EE] p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#0F172A]">
          {state === "ready" && label ? label.split(",")[0] : "Weather"}
        </h2>
        {state === "ready" && (
          <button onClick={onRetry} className="text-xs text-[#64748B] hover:text-[#2563EB]" title="Refresh">↻</button>
        )}
      </div>

      {state === "idle" && (
        <p className="mt-3 text-sm text-[#64748B]">
          <Link href="/dashboard/settings" className="text-[#2563EB] font-medium">Add your city</Link> for the local forecast.
        </p>
      )}

      {state === "loading" && (
        <div className="mt-3 animate-pulse space-y-2.5" aria-label="Loading forecast">
          <div className="h-7 w-2/3 rounded-lg bg-[#F1F5F9]" />
          <div className="h-3.5 w-1/2 rounded bg-[#F1F5F9]" />
          <div className="flex gap-2 mt-3">
            {[0, 1, 2, 3, 4].map((i) => <div key={i} className="flex-1 h-12 rounded-xl bg-[#F1F5F9]" />)}
          </div>
          <p className="text-[11px] text-[#64748B]/70">Checking {city}…</p>
        </div>
      )}

      {state === "error" && (
        <div className="mt-3">
          <p className="text-sm text-[#0F172A] font-medium">Forecast unavailable</p>
          <p className="text-xs text-[#64748B] mt-1">{error}</p>
          <div className="mt-3 flex gap-2">
            <button onClick={onRetry} className="text-xs px-3 py-1.5 bg-[#2563EB] text-white rounded-full font-semibold hover:bg-[#1D4ED8]">Try again</button>
            <Link href="/dashboard/settings" className="text-xs px-3 py-1.5 border border-[#E6E8EE] rounded-full font-semibold text-[#1E293B] hover:bg-[#F8FAFC]">Change city</Link>
          </div>
        </div>
      )}

      {state === "ready" && today && (
        <div className="mt-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl leading-none">{weatherEmoji(today.code)}</span>
            <div>
              <p className="text-2xl font-semibold text-[#0F172A] leading-tight">{today.tempMax}°</p>
              <p className="text-xs text-[#64748B]">{today.description} · {today.precipProbability}% rain</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-5 gap-1.5">
            {forecast.slice(1, 6).map((day) => (
              <div
                key={day.date}
                className={`rounded-xl px-1 py-2 text-center ${best?.date === day.date ? "bg-[#EAF2FF]" : "bg-[#F8FAFC]"}`}
                title={`${day.description}, ${day.precipProbability}% rain`}
              >
                <p className="text-[10px] font-semibold text-[#64748B]">
                  {new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" })}
                </p>
                <p className="text-base leading-tight">{weatherEmoji(day.code)}</p>
                <p className="text-[10px] text-[#1E293B]">{day.tempMax}°</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
