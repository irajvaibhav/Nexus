"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { mergeCategories, type CustomCategoryRow } from "@/lib/categories";
import { daysLeft, daysLabel, badgeColorFor } from "@/lib/dates";
import { detectConflicts, type ConflictGroup } from "@/lib/conflicts";
import { geocodeCity, getDailyForecast, bestUpcomingDay, type DailyForecast } from "@/lib/weather";
import { useEffect, useState } from "react";

type Deadline = {
  id: string;
  title: string;
  expiry_date: string;
  document_id: string;
};

export default function DashboardPage() {
  const [supabase] = useState(() => createClient());
  const router = useRouter();
  const [name, setName] = useState("User");
  const [docCount, setDocCount] = useState(0);
  const [fieldsCount, setFieldsCount] = useState(0);
  const [openTasksCount, setOpenTasksCount] = useState(0);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [customCategories, setCustomCategories] = useState<CustomCategoryRow[]>([]);
  const [conflicts, setConflicts] = useState<ConflictGroup[]>([]);
  const [docFileNames, setDocFileNames] = useState<Map<string, string>>(new Map());
  const [askInput, setAskInput] = useState("");
  const [city, setCity] = useState("");
  const [forecast, setForecast] = useState<DailyForecast[]>([]);
  const [weatherError, setWeatherError] = useState(false);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [addingToCalendar, setAddingToCalendar] = useState(false);
  const [addedToCalendar, setAddedToCalendar] = useState(false);

  const categories = mergeCategories(customCategories);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setName(user.user_metadata?.full_name || "User");
      }

      const [{ count: docs }, { count: fields }, { count: openTasks }, { data: deadlineRows }, { data: docRows }, { data: catRows }, { data: fieldRows }, { data: allDocs }, { data: profile }] =
        await Promise.all([
          supabase.from("documents").select("*", { count: "exact", head: true }),
          supabase.from("document_fields").select("*", { count: "exact", head: true }),
          supabase.from("tasks").select("*", { count: "exact", head: true }).eq("done", false),
          supabase
            .from("deadlines")
            .select("id, title, expiry_date, document_id")
            .eq("status", "active")
            .order("expiry_date", { ascending: true }),
          supabase.from("documents").select("doc_category"),
          supabase.from("custom_categories").select("name, icon").order("created_at", { ascending: true }),
          supabase.from("document_fields").select("document_id, field_name, field_value"),
          supabase.from("documents").select("id, file_name"),
          user
            ? supabase.from("profiles").select("city").eq("id", user.id).single()
            : Promise.resolve({ data: null }),
        ]);

      setDocCount(docs || 0);
      setFieldsCount(fields || 0);
      setOpenTasksCount(openTasks || 0);
      setDeadlines(deadlineRows || []);
      setCustomCategories(catRows || []);
      setConflicts(detectConflicts(fieldRows || []));
      setDocFileNames(new Map((allDocs || []).map((d: { id: string; file_name: string }) => [d.id, d.file_name])));
      setCity((profile as { city?: string } | null)?.city || "");

      const counts: Record<string, number> = {};
      for (const row of docRows || []) {
        const cat = (row as { doc_category: string | null }).doc_category;
        if (cat) counts[cat] = (counts[cat] || 0) + 1;
      }
      setCategoryCounts(counts);
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

  const expiringSoonCount = deadlines.filter((d) => daysLeft(d.expiry_date) <= 30).length;
  const nearestDeadline = deadlines.length > 0 ? deadlines[0] : null;
  const nearestDays = nearestDeadline ? daysLeft(nearestDeadline.expiry_date) : null;

  const forecastWithinWindow = nearestDays !== null
    ? forecast.filter((_, i) => i <= Math.min(nearestDays, forecast.length - 1))
    : [];
  const suggestedDay = bestUpcomingDay(forecastWithinWindow);

  function goAsk(question?: string) {
    const q = (question ?? askInput).trim();
    router.push(q ? `/dashboard/ask?q=${encodeURIComponent(q)}` : "/dashboard/ask");
  }

  async function addToCalendar() {
    if (!nearestDeadline || !suggestedDay) return;
    setAddingToCalendar(true);
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
      if (res.ok) setAddedToCalendar(true);
    } finally {
      setAddingToCalendar(false);
    }
  }

  return (
    <div className="max-w-6xl animate-fade-in-up">
      <h1 className="text-3xl font-serif font-semibold tracking-tight text-[#1A1412]">
        Good morning, {name} 👋
      </h1>
      <p className="text-[#7C6E67] mt-1 text-sm">
        NEXUS is here to take care of your important things.
      </p>

      {conflicts.length > 0 && (
        <div className="mt-4 rounded-2xl border border-[#E5DFD7] bg-[#FAF8F5] p-5">
          <p className="text-sm font-semibold text-[#D95D39] flex items-center gap-2">
            ⚠️ NEXUS found conflicting information
          </p>
          <div className="mt-2 space-y-2">
            {conflicts.map((c) => (
              <div key={c.label} className="text-sm text-[#7C6E67]">
                <span className="font-semibold text-[#2E2724]">{c.label}:</span>{" "}
                {c.entries.map((e, i) => (
                  <span key={i}>
                    {i > 0 && " vs "}
                    &ldquo;{e.value}&rdquo; ({docFileNames.get(e.document_id) || "Unknown"})
                  </span>
                ))}
                <button
                  onClick={() => goAsk(`What is my correct ${c.label.toLowerCase()}?`)}
                  className="ml-2 text-xs text-[#D95D39] underline hover:no-underline font-medium"
                >
                  Resolve with NEXUS
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<span className="w-8 h-8 rounded-full bg-[#FDF2EE] flex items-center justify-center text-[#D95D39] text-sm">⚠</span>}
          label="Expiring Soon"
          value={String(expiringSoonCount)}
          sub="Documents need attention"
          href="/dashboard/documents"
          accentColor="bg-[#D95D39]"
        />
        <StatCard
          icon={<span className="w-8 h-8 rounded-full bg-[#FEF9EC] flex items-center justify-center text-[#D48C2B] text-sm">📋</span>}
          label="Tasks Due"
          value={String(openTasksCount)}
          sub="Open tasks"
          href="/dashboard/tasks"
          accentColor="bg-[#D48C2B]"
        />
        <StatCard
          icon={<span className="w-8 h-8 rounded-full bg-[#F3F6F1] flex items-center justify-center text-[#6E885B] text-sm">✓</span>}
          label="All Documents"
          value={String(docCount)}
          sub="Across all categories"
          href="/dashboard/documents"
          accentColor="bg-[#6E885B]"
        />
        <StatCard
          icon={<span className="w-8 h-8 rounded-full bg-[#FDF1F5] flex items-center justify-center text-[#C05C7B] text-sm">✦</span>}
          label="Information Ready"
          value={String(fieldsCount)}
          sub="Details extracted and ready"
          href="/dashboard/documents"
          accentColor="bg-[#C05C7B]"
        />
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-6">

          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-serif font-semibold text-[#1A1412]">Upcoming Reminders</h2>
              <Link href="/dashboard/reminders" className="text-xs text-[#D95D39] hover:underline font-medium">
                View all →
              </Link>
            </div>
            <div className="bg-white rounded-2xl border border-[#E5DFD7] divide-y divide-[#E5DFD7]/50">
              {deadlines.length === 0 ? (
                <p className="px-4 py-6 text-sm text-[#7C6E67]/60 text-center">
                  No upcoming deadlines. NEXUS will surface expiry dates it finds in your documents here.
                </p>
              ) : (
                deadlines.slice(0, 5).map((d) => {
                  const days = daysLeft(d.expiry_date);
                  return (
                    <ReminderRow
                      key={d.id}
                      title={d.title}
                      detail={`Expires on ${new Date(d.expiry_date).toLocaleDateString()}`}
                      days={daysLabel(days)}
                      badgeColor={badgeColorFor(days)}
                    />
                  );
                })
              )}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-serif font-semibold text-[#1A1412]">Document Categories</h2>
              <Link href="/dashboard/documents" className="text-xs text-[#D95D39] hover:underline font-medium">
                View all
              </Link>
            </div>
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
                    {categoryCounts[cat.name] || 0} docs
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
                  ✨ NEXUS Suggestion
                </h3>
              </div>
              <div className="p-4">
                <p className="text-sm font-semibold text-[#2E2724]">
                  Your {nearestDeadline.title} {nearestDays < 0 ? "has expired" : `expires in ${daysLabel(nearestDays)}`}.
                </p>
                {suggestedDay ? (
                  <p className="text-xs text-[#7C6E67] mt-1">
                    {new Date(suggestedDay.date).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })} looks
                    like a good day in {city} — {suggestedDay.description.toLowerCase()}, {suggestedDay.tempMin}–{suggestedDay.tempMax}°C,{" "}
                    {suggestedDay.precipProbability}% chance of rain.
                  </p>
                ) : city && !weatherError ? (
                  <p className="text-xs text-[#7C6E67] mt-1">
                    Checking the forecast for {city}&hellip;
                  </p>
                ) : (
                  <p className="text-xs text-[#7C6E67] mt-1">
                    Ask NEXUS for the details you need to renew it.{" "}
                    <Link href="/dashboard/settings" className="text-[#D95D39] hover:underline font-medium">
                      Add your city
                    </Link>{" "}
                    for weather-aware timing.
                  </p>
                )}
                <div className="mt-4 space-y-2">
                  <button
                    onClick={() => goAsk(`What do I need to know to renew my ${nearestDeadline.title}?`)}
                    className="w-full py-2 bg-[#D95D39] text-white rounded-xl text-sm
                      font-medium hover:bg-[#C24E2B] transition-colors shadow-sm"
                  >
                    Ask NEXUS about it
                  </button>
                  {calendarConnected && suggestedDay && (
                    <button
                      onClick={addToCalendar}
                      disabled={addingToCalendar || addedToCalendar}
                      className="w-full py-2 border border-[#E5DFD7] text-[#2E2724] rounded-xl text-sm
                        font-medium hover:bg-[#FAF8F5] transition-colors bg-white disabled:opacity-60"
                    >
                      {addedToCalendar ? "Added to Calendar ✓" : addingToCalendar ? "Adding..." : "Add to Google Calendar"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-[#E5DFD7] overflow-hidden">
            <div className="p-4 border-b border-[#E5DFD7]/60 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#1A1412] flex items-center gap-2">
                💬 Ask Nexus
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
                  placeholder="Ask anything about your documents..."
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
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, href, accentColor }: {
  icon: React.ReactNode; label: string; value: string; sub: string; href: string; accentColor: string;
}) {
  return (
    <Link href={href} className="bg-white rounded-2xl border border-[#E5DFD7] overflow-hidden
      hover:-translate-y-1 hover:shadow-lg hover:shadow-[#D95D39]/5 transition-all duration-300 block">
      <div className={`h-1.5 w-full ${accentColor}`} />
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-[#7C6E67] uppercase tracking-wider">{label}</p>
          {icon}
        </div>
        <p className="text-3xl font-bold text-[#1A1412] tracking-tight">{value}</p>
        <p className="text-[11px] text-[#7C6E67]/70 mt-1.5 leading-relaxed">{sub}</p>
      </div>
    </Link>
  );
}

function ReminderRow({ title, detail, days, badgeColor }: {
  title: string; detail: string; days: string; badgeColor: string;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 hover:bg-[#FCFAF7]
      transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-[#E5DFD7]" />
        <div>
          <p className="text-sm font-medium text-[#2E2724]">{title}</p>
          <p className="text-xs text-[#7C6E67]">{detail}</p>
        </div>
      </div>
      <span className={`text-[11px] px-2 py-1 rounded-full font-medium ${badgeColor}`}>
        {days}
      </span>
    </div>
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