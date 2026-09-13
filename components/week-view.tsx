"use client";

import Link from "next/link";
import { weatherEmoji, type DailyForecast } from "@/lib/weather";
import { CalendarIcon, SparkleIcon } from "@/components/icons";

export type WeekEvent = { id: string; title: string; start: string; end: string; allDay: boolean; htmlLink: string | null };
export type WeekDeadline = { id: string; title: string; expiry_date: string };

type Props = {
  cityLabel: string;
  weatherState: "idle" | "loading" | "ready" | "error";
  forecast: DailyForecast[];
  onRetryWeather: () => void;
  calendarConnected: boolean;
  calendarLoading: boolean;
  events: WeekEvent[];
  deadlines: WeekDeadline[];
  suggestion: { day: DailyForecast; forTitle: string } | null;
  onAddToCalendar?: () => void;
  addState?: "idle" | "adding" | "added";
  addedLink?: string | null;
  canExecute: boolean;
};

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Weather, calendar and expiry dates on one 7-day strip, with the sentence
// NEXUS draws from them. This is the product's promise in one card.
export function WeekView(p: Props) {
  const days: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    days.push(d);
  }

  const forecastByDay = new Map(p.forecast.map((f) => [f.date, f]));
  const eventsByDay = new Map<string, WeekEvent[]>();
  for (const e of p.events) {
    const k = e.start.slice(0, 10);
    eventsByDay.set(k, [...(eventsByDay.get(k) || []), e]);
  }
  const deadlinesByDay = new Map<string, WeekDeadline[]>();
  for (const d of p.deadlines) {
    const k = d.expiry_date.slice(0, 10);
    deadlinesByDay.set(k, [...(deadlinesByDay.get(k) || []), d]);
  }

  const wet = p.forecast.filter((f) => f.precipProbability >= 60).map((f) => f.date);
  const wetLabel = wet.length === 0
    ? null
    : wet.length >= 5
    ? "most of the week"
    : wet.map((d) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" })).join(", ");

  return (
    <section className="card overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0EA5E9] to-[#2563EB] text-white flex items-center justify-center"><CalendarIcon className="w-4 h-4" /></span>
          Your week
          {p.cityLabel && <span className="text-sm font-medium text-[#64748B]">· {p.cityLabel}</span>}
        </h2>
        <div className="flex items-center gap-2">
          {!p.calendarConnected && !p.calendarLoading && (
            <Link href="/dashboard/settings" className="text-xs px-3 py-1.5 rounded-full bg-[#0F172A] text-white font-semibold hover:bg-[#1E293B]">
              Connect Google Calendar
            </Link>
          )}
          {p.calendarConnected && (
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#F0FDF4] text-[#15803D] font-semibold">Calendar synced</span>
          )}
        </div>
      </div>

      <div className="px-3 sm:px-5 pb-4 grid grid-cols-7 gap-1 sm:gap-1.5">
        {days.map((d, i) => {
          const k = dayKey(d);
          const f = forecastByDay.get(k);
          const evs = eventsByDay.get(k) || [];
          const dls = deadlinesByDay.get(k) || [];
          const isToday = i === 0;
          const busy = evs.length > 0;
          return (
            <div
              key={k}
              className={`rounded-xl sm:rounded-2xl border px-0.5 sm:px-1.5 py-2 sm:py-2.5 text-center transition-colors ${
                isToday ? "border-[#93C5FD] bg-[#EAF2FF]/60" : dls.length ? "border-[#FDE68A] bg-[#FFFBEB]/60" : "border-[#E6E8EE] bg-white"
              }`}
              title={[
                f ? `${f.description}, ${f.precipProbability}% rain` : "",
                ...evs.map((e) => `• ${e.title}`),
                ...dls.map((x) => `⏰ ${x.title}`),
              ].filter(Boolean).join("\n")}
            >
              <p className={`text-[10px] font-semibold uppercase tracking-wide ${isToday ? "text-[#2563EB]" : "text-[#64748B]"}`}>
                {isToday ? "Today" : d.toLocaleDateString(undefined, { weekday: "short" })}
              </p>
              <p className="text-sm font-bold text-[#0F172A] leading-tight">{d.getDate()}</p>
              <div className="mt-1.5 h-9 flex flex-col items-center justify-center">
                {p.weatherState === "loading" ? (
                  <span className="skeleton w-6 h-6 rounded-full" />
                ) : f ? (
                  <>
                    <span className="text-lg leading-none">{weatherEmoji(f.code)}</span>
                    <span className="text-[10px] text-[#1E293B] mt-0.5">{f.tempMax}°</span>
                  </>
                ) : (
                  <span className="text-[10px] text-[#CBD5E1]">·</span>
                )}
              </div>
              <div className="mt-1.5 flex items-center justify-center gap-1 h-4">
                {p.calendarLoading ? (
                  <span className="skeleton w-8 h-2 rounded" />
                ) : (
                  <>
                    {busy && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#F1F5F9] text-[#334155] font-semibold">{evs.length} evt</span>}
                    {dls.map((x) => <span key={x.id} className="w-1.5 h-1.5 rounded-full bg-[#D97706]" />)}
                    {!busy && dls.length === 0 && p.calendarConnected && <span className="text-[9px] text-[#94A3B8]">free</span>}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mx-5 mb-5 rounded-xl bg-gradient-to-r from-[#EAF2FF] to-[#EEF2FF] border border-[#CFE0FF] px-4 py-3 flex items-start gap-3">
        <span className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2563EB] to-[#4F46E5] text-white flex items-center justify-center shrink-0 shadow-md shadow-[#2563EB]/30 mt-0.5">
          <SparkleIcon className="w-4 h-4" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[#1E293B] leading-relaxed">
            {p.weatherState === "idle" ? (
              <><Link href="/dashboard/settings" className="text-[#2563EB] font-semibold">Add your city</Link> and NEXUS will read the forecast against your calendar to pick good days.</>
            ) : p.weatherState === "error" ? (
              <>Forecast unavailable right now. <button onClick={p.onRetryWeather} className="text-[#2563EB] font-semibold">Retry</button></>
            ) : p.weatherState === "loading" ? (
              <>Reading the forecast…</>
            ) : (
              <>
                {wetLabel ? <>Rain likely {wetLabel}. </> : <>Dry week ahead. </>}
                {p.suggestion ? (
                  <>Best day for <span className="font-semibold">{p.suggestion.forTitle}</span>:{" "}
                    <span className="font-semibold">{new Date(`${p.suggestion.day.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "long" })}</span>
                    {" "}({p.suggestion.day.description.toLowerCase()}, {p.suggestion.day.precipProbability}% rain{p.calendarConnected ? ", nothing on your calendar" : ""}).</>
                ) : (
                  <>Nothing due this month, so no errand to plan yet.</>
                )}
              </>
            )}
          </p>
          {p.suggestion && p.weatherState === "ready" && (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              {p.addState === "added" ? (
                p.addedLink
                  ? <a href={p.addedLink} target="_blank" rel="noreferrer" className="text-xs px-3 py-1.5 rounded-full bg-[#F0FDF4] text-[#15803D] font-semibold">Added to Google Calendar ✓ Open</a>
                  : <span className="text-xs px-3 py-1.5 rounded-full bg-[#F0FDF4] text-[#15803D] font-semibold">Added to Google Calendar ✓</span>
              ) : p.calendarConnected && p.canExecute ? (
                <button onClick={p.onAddToCalendar} disabled={p.addState === "adding"} className="text-xs px-3 py-1.5 rounded-full bg-[#0F172A] text-white font-semibold hover:bg-[#1E293B] disabled:opacity-50">
                  {p.addState === "adding" ? "Adding…" : "Add to Google Calendar with reminders"}
                </button>
              ) : p.calendarConnected ? (
                <Link href="/dashboard/settings" className="text-xs text-[#2563EB] font-semibold">Allow NEXUS to add events →</Link>
              ) : (
                <Link href="/dashboard/settings" className="text-xs text-[#2563EB] font-semibold">Connect Google Calendar to add it →</Link>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
