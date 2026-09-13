"use client";

import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { reverseGeocode } from "@/lib/weather";
import { LEVEL_LABEL, type AgentLevel, isAgentLevel } from "@/lib/permissions";
import { DocumentsIcon, BellIcon, CheckSquareIcon, SlidersIcon, CalendarIcon } from "@/components/icons";
import { useEffect, useState } from "react";

type Stats = { docs: number; dates: number; tasks: number; asks: number };

export default function ProfilePage() {
  const [supabase] = useState(() => createClient());
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [city, setCity] = useState("");
  const [joined, setJoined] = useState("");
  const [provider, setProvider] = useState("");
  const [level, setLevel] = useState<AgentLevel>("recommend");
  const [stats, setStats] = useState<Stats | null>(null);
  const [calendar, setCalendar] = useState<"loading" | "connected" | "off">("loading");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locateMessage, setLocateMessage] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email || "");
      setJoined(user.created_at);
      setProvider(user.app_metadata?.provider || "email");

      const [{ data: profile }, d, r, t, a] = await Promise.all([
        supabase.from("profiles").select("full_name, city, agent_permission").eq("id", user.id).single(),
        supabase.from("documents").select("*", { count: "exact", head: true }),
        supabase.from("deadlines").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("tasks").select("*", { count: "exact", head: true }).eq("done", false),
        supabase.from("chat_messages").select("*", { count: "exact", head: true }).eq("role", "user"),
      ]);
      setFullName(profile?.full_name || user.user_metadata?.full_name || "");
      setCity(profile?.city || "");
      if (isAgentLevel(profile?.agent_permission)) setLevel(profile.agent_permission);
      setStats({ docs: d.count || 0, dates: r.count || 0, tasks: t.count || 0, asks: a.count || 0 });
    })();
    fetch("/api/calendar/status").then((r) => r.json()).then((x) => setCalendar(x.connected ? "connected" : "off")).catch(() => setCalendar("off"));
  }, [supabase]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await Promise.all([
      supabase.from("profiles").update({ full_name: fullName, city }).eq("id", user.id),
      supabase.auth.updateUser({ data: { full_name: fullName } }),
    ]);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      setLocateMessage("This browser can't share your location.");
      return;
    }
    setLocating(true);
    setLocateMessage("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const place = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
          if (place) {
            setCity(place.city);
            setLocateMessage(`Set to ${place.label}. Save to keep it.`);
          } else setLocateMessage("Couldn't find a city for your position.");
        } catch {
          setLocateMessage("Couldn't read your location.");
        }
        setLocating(false);
      },
      () => {
        setLocateMessage("Location access was blocked.");
        setLocating(false);
      },
      { timeout: 10000 }
    );
  }

  const initial = (fullName || email || "?").charAt(0).toUpperCase();
  const inputClass = "w-full px-3 py-2 bg-[#F8FAFC] border border-[#E6E8EE] rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#2563EB] focus:border-transparent text-[#1E293B] placeholder-[#94A3B8]";

  return (
    <div className="animate-fade-in-up">
      <h1 className="text-3xl font-semibold tracking-tight text-[#0F172A]">Profile</h1>
      <p className="text-sm text-[#64748B] mt-1">Who NEXUS is working for.</p>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
        <div className="space-y-4">
          <section className="card p-6 flex items-center gap-5">
            <span className="w-20 h-20 rounded-full bg-gradient-to-br from-[#2563EB] to-[#4F46E5] text-white text-3xl font-bold flex items-center justify-center shadow-lg shadow-[#2563EB]/30 ring-4 ring-white">
              {initial}
            </span>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-[#0F172A] truncate">{fullName || "Your name"}</p>
              <p className="text-sm text-[#64748B] truncate">{email}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {joined && (
                  <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#F1F5F9] text-[#334155] font-medium">
                    Member since {new Date(joined).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
                  </span>
                )}
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#F1F5F9] text-[#334155] font-medium capitalize">
                  {provider === "google" ? "Signed in with Google" : "Email account"}
                </span>
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#EAF2FF] text-[#2563EB] font-semibold">
                  NEXUS may: {LEVEL_LABEL[level]}
                </span>
              </div>
            </div>
          </section>

          <section className="card p-6">
            <h2 className="text-base font-bold text-[#0F172A]">Details</h2>
            <form onSubmit={save} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1">Full name</label>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1">Email</label>
                <input value={email} disabled className={`${inputClass} opacity-60`} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1">City</label>
                <div className="flex gap-2">
                  <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Mumbai" className={inputClass} />
                  <button type="button" onClick={useMyLocation} disabled={locating} className="text-xs px-3 py-2 border border-[#E6E8EE] rounded-xl font-semibold text-[#1E293B] hover:border-[#2563EB] bg-white whitespace-nowrap disabled:opacity-50">
                    {locating ? "Locating…" : "Use my location"}
                  </button>
                </div>
                <p className="text-[11px] text-[#64748B] mt-1">{locateMessage || "Used for the local forecast and for picking good days."}</p>
              </div>
              <button type="submit" disabled={saving} className="text-sm px-5 py-2.5 rounded-full bg-gradient-to-r from-[#2563EB] to-[#4F46E5] text-white font-semibold shadow-md shadow-[#2563EB]/30 disabled:opacity-50">
                {saving ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
              </button>
            </form>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="card p-5">
            <h2 className="text-sm font-bold text-[#0F172A]">Your NEXUS</h2>
            {stats === null ? (
              <div className="skeleton h-24 mt-3" />
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[
                  { v: stats.docs, l: "Documents", href: "/dashboard/documents", icon: <DocumentsIcon className="w-4 h-4" /> },
                  { v: stats.dates, l: "Dates tracked", href: "/dashboard/reminders", icon: <BellIcon className="w-4 h-4" /> },
                  { v: stats.tasks, l: "Open tasks", href: "/dashboard/tasks", icon: <CheckSquareIcon className="w-4 h-4" /> },
                  { v: stats.asks, l: "Questions asked", href: "/dashboard/ask", icon: <span className="text-xs font-bold">?</span> },
                ].map((s) => (
                  <Link key={s.l} href={s.href} className="rounded-xl bg-[#F8FAFC] border border-[#E6E8EE] px-3 py-2.5 hover:border-[#2563EB]/40 transition-colors">
                    <span className="text-[#2563EB]">{s.icon}</span>
                    <p className="text-xl font-bold text-[#0F172A] leading-none mt-1">{s.v}</p>
                    <p className="text-[11px] text-[#64748B] mt-1">{s.l}</p>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="card p-5">
            <h2 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#0EA5E9] to-[#2563EB] text-white flex items-center justify-center"><CalendarIcon className="w-4 h-4" /></span>
              Google Calendar
            </h2>
            <p className="mt-2 text-xs text-[#64748B]">
              {calendar === "loading" ? "Checking…" : calendar === "connected" ? "Connected. Dates you add get reminders." : "Not connected."}
            </p>
            <Link href="/dashboard/settings" className="inline-block mt-3 text-xs px-3.5 py-2 rounded-full border border-[#E6E8EE] text-[#0F172A] font-semibold hover:bg-[#F8FAFC]">
              {calendar === "connected" ? "Manage" : "Connect"}
            </Link>
          </section>

          <Link href="/dashboard/settings" className="card card-hover p-4 flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-[#F1F5F9] text-[#0F172A] flex items-center justify-center"><SlidersIcon className="w-4 h-4" /></span>
            <div>
              <p className="text-sm font-semibold text-[#0F172A]">Settings</p>
              <p className="text-xs text-[#64748B]">Password, permissions, data export</p>
            </div>
          </Link>
        </aside>
      </div>
    </div>
  );
}
