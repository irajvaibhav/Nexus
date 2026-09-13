"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { daysLeft, daysLabel } from "@/lib/dates";
import { CalendarIcon, SparkleIcon, DocumentsIcon, CheckSquareIcon, ScanIcon } from "@/components/icons";

// Wide screens left these pages as a narrow column with two-thirds of the
// canvas empty. Each page keeps its content on the left and gets a panel
// on the right with the context that helps on that page.
export function TwoCol({ aside, children }: { aside: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start animate-fade-in-up">
      <div className="min-w-0">{children}</div>
      <aside className="space-y-4 lg:sticky lg:top-0">{aside}</aside>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
        {icon}
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="rounded-xl bg-[#F8FAFC] border border-[#E6E8EE] px-3 py-2.5">
      <p className="text-xl font-bold text-[#0F172A] leading-none">{value}</p>
      <p className="text-[11px] text-[#64748B] mt-1">{label}</p>
    </div>
  );
}

function useCalendarConnected() {
  const [state, setState] = useState<"loading" | "connected" | "off">("loading");
  useEffect(() => {
    fetch("/api/calendar/status")
      .then((r) => r.json())
      .then((d) => setState(d.connected ? "connected" : "off"))
      .catch(() => setState("off"));
  }, []);
  return state;
}

export function CalendarPanel() {
  const state = useCalendarConnected();
  return (
    <Panel title="Google Calendar" icon={<span className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#0EA5E9] to-[#2563EB] text-white flex items-center justify-center"><CalendarIcon className="w-4 h-4" /></span>}>
      {state === "loading" ? (
        <div className="skeleton h-10" />
      ) : state === "connected" ? (
        <>
          <span className="inline-flex text-[11px] px-2.5 py-1 rounded-full bg-[#F0FDF4] text-[#15803D] font-semibold">Synced</span>
          <p className="mt-2 text-xs text-[#64748B] leading-relaxed">Dates you add get a popup the day before and an email a week out.</p>
        </>
      ) : (
        <>
          <p className="text-xs text-[#64748B] leading-relaxed">Connect it and NEXUS can put dates on your calendar with reminders, and pick days you are free.</p>
          <Link href="/dashboard/settings" className="inline-block mt-3 text-xs px-3.5 py-2 rounded-full bg-[#0F172A] text-white font-semibold hover:bg-[#1E293B]">Connect</Link>
        </>
      )}
    </Panel>
  );
}

type DeadlineRow = { id: string; title: string; expiry_date: string; status: string };

export function RemindersAside() {
  const [supabase] = useState(() => createClient());
  const [rows, setRows] = useState<DeadlineRow[] | null>(null);
  useEffect(() => {
    supabase.from("deadlines").select("id, title, expiry_date, status").order("expiry_date", { ascending: true })
      .then(({ data }) => setRows(data || []));
  }, [supabase]);

  const active = (rows || []).filter((r) => r.status === "active");
  const next = active.find((r) => daysLeft(r.expiry_date) >= 0) || active[0];
  const within30 = active.filter((r) => { const d = daysLeft(r.expiry_date); return d >= 0 && d <= 30; }).length;

  return (
    <>
      <Panel title="Next up" icon={<span className="w-7 h-7 rounded-lg bg-[#FFF7ED] text-[#EA580C] flex items-center justify-center"><SparkleIcon className="w-4 h-4" /></span>}>
        {rows === null ? (
          <div className="skeleton h-16" />
        ) : next ? (
          <div className="flex items-center gap-3">
            <div className={`rounded-xl px-3 py-2 text-center ${daysLeft(next.expiry_date) <= 14 ? "bg-[#FFFBEB] text-[#D97706]" : "bg-[#F1F5F9] text-[#0F172A]"}`}>
              <p className="text-2xl font-bold leading-none">{new Date(next.expiry_date).getDate()}</p>
              <p className="text-[10px] font-semibold uppercase mt-0.5">{new Date(next.expiry_date).toLocaleDateString(undefined, { month: "short" })}</p>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#0F172A] truncate">{next.title}</p>
              <p className="text-xs text-[#64748B]">{daysLabel(daysLeft(next.expiry_date))}</p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-[#64748B]">No upcoming dates. Upload a document with an expiry and it shows up here.</p>
        )}
        {rows !== null && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Stat value={active.length} label="Active" />
            <Stat value={within30} label="Within 30d" />
            <Stat value={(rows || []).length - active.length} label="Done" />
          </div>
        )}
      </Panel>
      <CalendarPanel />
    </>
  );
}

export function TasksAside() {
  const [supabase] = useState(() => createClient());
  const [deadlines, setDeadlines] = useState<DeadlineRow[] | null>(null);
  const [taskTitles, setTaskTitles] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([
      supabase.from("deadlines").select("id, title, expiry_date, status").eq("status", "active").order("expiry_date", { ascending: true }).limit(5),
      supabase.from("tasks").select("title"),
    ]).then(([d, t]) => {
      setDeadlines(d.data || []);
      setTaskTitles(new Set((t.data || []).map((x: { title: string }) => x.title.toLowerCase())));
    });
  }, [supabase]);

  async function addTask(d: DeadlineRow) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("tasks").insert({ user_id: user.id, title: `Renew ${d.title}`, done: false });
    setAdded((prev) => new Set(prev).add(d.id));
    window.dispatchEvent(new Event("nexus:tasks-changed"));
  }

  const suggestions = (deadlines || []).filter((d) => !taskTitles.has(`renew ${d.title}`.toLowerCase()) && !added.has(d.id));

  return (
    <>
      <Panel title="From your dates" icon={<span className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#16A34A] to-[#0D9488] text-white flex items-center justify-center"><CheckSquareIcon className="w-4 h-4" /></span>}>
        {deadlines === null ? (
          <div className="skeleton h-16" />
        ) : suggestions.length === 0 ? (
          <p className="text-xs text-[#64748B]">Nothing to suggest. Expiry dates from your documents appear here as one-tap tasks.</p>
        ) : (
          <ul className="space-y-2">
            {suggestions.map((d) => (
              <li key={d.id} className="flex items-center gap-2 rounded-xl border border-[#E6E8EE] px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-[#0F172A] truncate">Renew {d.title}</p>
                  <p className="text-[11px] text-[#64748B]">{daysLabel(daysLeft(d.expiry_date))}</p>
                </div>
                <button onClick={() => addTask(d)} className="text-[11px] px-2.5 py-1 rounded-full bg-[#0F172A] text-white font-semibold hover:bg-[#1E293B]">Add</button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <CalendarPanel />
    </>
  );
}

export function ScanAside() {
  const [supabase] = useState(() => createClient());
  const [counts, setCounts] = useState<{ docs: number; fields: number } | null>(null);
  useEffect(() => {
    Promise.all([
      supabase.from("documents").select("*", { count: "exact", head: true }),
      supabase.from("document_fields").select("*", { count: "exact", head: true }),
    ]).then(([d, f]) => setCounts({ docs: d.count || 0, fields: f.count || 0 }));
  }, [supabase]);

  return (
    <>
      <Panel title="What NEXUS can fill from" icon={<span className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#2563EB] to-[#4F46E5] text-white flex items-center justify-center"><DocumentsIcon className="w-4 h-4" /></span>}>
        {counts === null ? (
          <div className="skeleton h-14" />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Stat value={counts.docs} label="Documents" />
            <Stat value={counts.fields} label="Known details" />
          </div>
        )}
        <p className="mt-3 text-xs text-[#64748B] leading-relaxed">
          More documents in the vault means more fields filled.{" "}
          <Link href="/dashboard/documents?upload=1" className="text-[#2563EB] font-semibold">Add one</Link>
        </p>
      </Panel>
      <Panel title="How it works" icon={<span className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#F97316] to-[#DB2777] text-white flex items-center justify-center"><ScanIcon className="w-4 h-4" /></span>}>
        <ol className="space-y-2.5">
          {[
            ["Scan", "Upload or photograph the blank form."],
            ["Review", "Every field is editable. Low-confidence matches are flagged."],
            ["Preview", "See exactly what will be written."],
            ["Download", "A filled PDF, or the form plus an answers page."],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="w-5 h-5 rounded-full bg-[#F1F5F9] text-[#0F172A] text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
              <div>
                <p className="text-xs font-semibold text-[#0F172A]">{t}</p>
                <p className="text-[11px] text-[#64748B] leading-relaxed">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </Panel>
    </>
  );
}

export function ActivityAside() {
  const [supabase] = useState(() => createClient());
  const [stats, setStats] = useState<{ total: number; nexus: number; week: number } | null>(null);
  useEffect(() => {
    supabase.from("activity_log").select("action, details, created_at").order("created_at", { ascending: false }).limit(500)
      .then(({ data }) => {
        const rows = (data || []) as { action: string; details: { message?: string } | null; created_at: string }[];
        const weekAgo = Date.now() - 7 * 86400000;
        const nexus = rows.filter((r) => /^(process|agent|scan|calendar)$/.test(r.action) && !(r.details?.message || "").startsWith("You ")).length;
        setStats({ total: rows.length, nexus, week: rows.filter((r) => new Date(r.created_at).getTime() > weekAgo).length });
      });
  }, [supabase]);

  return (
    <>
      <Panel title="At a glance" icon={<span className="w-7 h-7 rounded-lg bg-[#0F172A] text-white flex items-center justify-center"><SparkleIcon className="w-4 h-4" /></span>}>
        {stats === null ? (
          <div className="skeleton h-14" />
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <Stat value={stats.week} label="This week" />
            <Stat value={stats.nexus} label="By NEXUS" />
            <Stat value={stats.total - stats.nexus} label="By you" />
          </div>
        )}
        <p className="mt-3 text-xs text-[#64748B] leading-relaxed">Everything NEXUS does is written here, so nothing happens invisibly.</p>
      </Panel>
      <Panel title="Your data">
        <p className="text-xs text-[#64748B] leading-relaxed">Download everything NEXUS holds about you as one file, any time.</p>
        <Link href="/dashboard/settings" className="inline-block mt-3 text-xs px-3.5 py-2 rounded-full border border-[#E6E8EE] text-[#0F172A] font-semibold hover:bg-[#F8FAFC]">Export from Settings</Link>
      </Panel>
    </>
  );
}
