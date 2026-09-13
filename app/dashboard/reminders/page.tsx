"use client";

import { createClient } from "@/lib/supabase-browser";
import { daysLeft, daysLabel, badgeColorFor } from "@/lib/dates";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { TwoCol, RemindersAside } from "@/components/page-asides";

type Reminder = {
  id: string;
  title: string;
  expiry_date: string;
  document_id: string;
  status: string;
  documents: { file_name: string } | null;
};

type Tab = "active" | "completed" | "all";

type PlanItem = {
  deadline_id: string;
  document_id: string | null;
  deadline_title: string;
  expiry_date: string;
  priority: number;
  task_title: string;
  reasoning: string;
  suggested_date: string | null;
};

export default function RemindersPage() {
  const [supabase] = useState(() => createClient());
  const router = useRouter();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [tab, setTab] = useState<Tab>("active");
  const [loading, setLoading] = useState(true);

  const [planItems, setPlanItems] = useState<PlanItem[] | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<number | null>(null);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calState, setCalState] = useState<Record<string, { phase: "adding" | "added" | "failed"; link?: string | null; message?: string }>>({});

  useEffect(() => {
    fetch("/api/calendar/status")
      .then((r) => r.json())
      .then((d) => setCalendarConnected(!!d.connected))
      .catch(() => setCalendarConnected(false));
  }, []);

  // Puts the date itself on the calendar; the event carries a popup a day
  // before and an email a week before, so the reminder reaches the user
  // without opening NEXUS.
  async function addReminderToCalendar(r: Reminder) {
    setCalState((prev) => ({ ...prev, [r.id]: { phase: "adding" } }));
    try {
      const res = await fetch("/api/calendar/create-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${r.title} (NEXUS)`,
          description: `${r.title} from ${r.documents?.file_name || "your documents"}. Added by NEXUS.`,
          dateISO: r.expiry_date.slice(0, 10),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCalState((prev) => ({ ...prev, [r.id]: { phase: "failed", message: data.error || "Couldn't add it." } }));
        return;
      }
      setCalState((prev) => ({ ...prev, [r.id]: { phase: "added", link: data.htmlLink } }));
    } catch {
      setCalState((prev) => ({ ...prev, [r.id]: { phase: "failed", message: "Couldn't reach NEXUS." } }));
    }
  }

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("deadlines")
      .select("id, title, expiry_date, document_id, status, documents(file_name)")
      .order("expiry_date", { ascending: true });
    if (data) setReminders(data as unknown as Reminder[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function buildPlan() {
    setPlanLoading(true);
    setPlanError("");
    setApplyResult(null);

    try {
      const res = await fetch("/api/agent/plan", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setPlanError(data.error || "Failed to build a plan");
      } else {
        setPlanItems(data.plan);
        setSelected(new Set(data.plan.map((p: PlanItem) => p.deadline_id)));
      }
    } catch {
      setPlanError("Failed to build a plan. Please try again.");
    }

    setPlanLoading(false);
  }

  function toggleSelected(deadlineId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(deadlineId)) next.delete(deadlineId);
      else next.add(deadlineId);
      return next;
    });
  }

  async function approvePlan() {
    if (!planItems) return;
    setApplying(true);
    setPlanError("");

    const items = planItems
      .filter((p) => selected.has(p.deadline_id))
      .map((p) => ({ document_id: p.document_id, task_title: p.task_title }));

    try {
      const res = await fetch("/api/agent/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();

      if (!res.ok) {
        setPlanError(data.error || "Failed to create tasks");
      } else {
        setApplyResult(data.created);
        setPlanItems(null);
      }
    } catch {
      setPlanError("Failed to create tasks. Please try again.");
    }

    setApplying(false);
  }

  async function setStatus(id: string, status: string) {
    const reminder = reminders.find((r) => r.id === id);
    setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    await supabase.from("deadlines").update({ status }).eq("id", id);

    if (reminder) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("activity_log").insert({
          user_id: user.id,
          action: "reminder",
          details: {
            document_id: reminder.document_id,
            message: status === "completed"
              ? `Marked "${reminder.title}" as done`
              : `Reopened "${reminder.title}"`,
          },
        });
      }
    }
  }

  const visible = reminders.filter((r) => {
    if (tab === "active") return r.status === "active";
    if (tab === "completed") return r.status === "completed";
    return true;
  });

  const activeCount = reminders.filter((r) => r.status === "active").length;
  const completedCount = reminders.filter((r) => r.status === "completed").length;

  return (
    <TwoCol aside={<RemindersAside />}>
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#0F172A]">Reminders</h1>
          <p className="text-sm text-[#64748B] mt-1">
            Expiry and renewal dates NEXUS found in your documents.
          </p>
        </div>
        <button
          onClick={buildPlan}
          disabled={planLoading}
          className="text-sm px-5 py-2.5 bg-gradient-to-r from-[#2563EB] to-[#4F46E5] text-white rounded-full font-semibold
            shadow-md shadow-[#2563EB]/30 hover:shadow-lg disabled:opacity-50 transition-shadow shrink-0"
        >
          {planLoading ? "Reviewing your renewals..." : "Take care of my renewals"}
        </button>
      </div>

      {applyResult !== null && (
        <div className="mt-4 rounded-2xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-[#166534]">
            Created {applyResult} task{applyResult === 1 ? "" : "s"} from your renewal plan.
          </p>
          <button
            onClick={() => router.push("/dashboard/tasks")}
            className="text-xs font-semibold text-[#15803D] hover:underline shrink-0"
          >
            View tasks →
          </button>
        </div>
      )}

      {planError && (
        <p className="mt-3 text-sm text-red-600">{planError}</p>
      )}

      <div className="mt-6 flex gap-1.5">
        <TabButton label={`Active (${activeCount})`} active={tab === "active"} onClick={() => setTab("active")} />
        <TabButton label={`Completed (${completedCount})`} active={tab === "completed"} onClick={() => setTab("completed")} />
        <TabButton label="All" active={tab === "all"} onClick={() => setTab("all")} />
      </div>

      <div className="mt-4 space-y-3">
        {loading ? (
          [0, 1].map((i) => <div key={i} className="skeleton h-24 rounded-2xl" />)
        ) : visible.length === 0 ? (
          <div className="card px-6 py-12 text-center">
            <span className="mx-auto w-12 h-12 rounded-2xl bg-[#FFF7ED] text-[#EA580C] flex items-center justify-center text-xl">🔔</span>
            <p className="mt-3 text-sm font-semibold text-[#0F172A]">
              {tab === "active" ? "No active reminders" : tab === "completed" ? "Nothing marked done yet" : "No reminders yet"}
            </p>
            <p className="mt-1 text-xs text-[#64748B]">Expiry dates NEXUS finds in your documents appear here.</p>
          </div>
        ) : (
          visible.map((r) => {
            const days = daysLeft(r.expiry_date);
            const isDone = r.status === "completed";
            const date = new Date(r.expiry_date);
            const tile = isDone
              ? "bg-[#F1F5F9] text-[#94A3B8]"
              : days < 0
              ? "bg-[#FDF2F8] text-[#DB2777]"
              : days <= 14
              ? "bg-[#FFFBEB] text-[#D97706]"
              : "bg-[#EAF2FF] text-[#2563EB]";
            const cal = calState[r.id];
            return (
              <div key={r.id} className={`card card-hover px-5 py-4 flex items-center gap-4 ${isDone ? "opacity-70" : ""}`}>
                <div className={`w-14 rounded-xl py-2 text-center shrink-0 ${tile}`}>
                  <p className="text-xl font-bold leading-none">{date.getDate()}</p>
                  <p className="text-[10px] font-semibold uppercase mt-0.5">{date.toLocaleDateString(undefined, { month: "short" })}</p>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-[15px] font-semibold truncate ${isDone ? "text-[#64748B] line-through" : "text-[#0F172A]"}`}>{r.title}</p>
                    {!isDone && (
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${badgeColorFor(days)}`}>{daysLabel(days)}</span>
                    )}
                    {cal?.phase === "added" && (
                      cal.link
                        ? <a href={cal.link} target="_blank" rel="noreferrer" className="text-[11px] px-2 py-0.5 rounded-full bg-[#F0FDF4] text-[#15803D] font-semibold">On calendar ✓</a>
                        : <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#F0FDF4] text-[#15803D] font-semibold">On calendar ✓</span>
                    )}
                  </div>
                  <p className="text-xs text-[#64748B] truncate mt-0.5">
                    {r.documents?.file_name || "Your documents"} · {date.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                  {cal?.phase === "failed" && <p className="text-[11px] text-[#DB2777] mt-1">{cal.message}</p>}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => router.push(`/dashboard/ask?q=${encodeURIComponent(`What do I need to know about my ${r.title}?`)}`)}
                    title="Ask NEXUS about this"
                    className="h-9 px-3 rounded-full text-xs font-semibold text-[#2563EB] hover:bg-[#EAF2FF] transition-colors"
                  >
                    Ask
                  </button>
                  {!isDone && calendarConnected && cal?.phase !== "added" && (
                    <button
                      onClick={() => addReminderToCalendar(r)}
                      disabled={cal?.phase === "adding"}
                      title="Add to Google Calendar with reminders"
                      className="h-9 px-3 rounded-full text-xs font-semibold border border-[#E6E8EE] bg-white text-[#1E293B] hover:border-[#2563EB] hover:text-[#2563EB] transition-colors disabled:opacity-50"
                    >
                      {cal?.phase === "adding" ? "Adding…" : cal?.phase === "failed" ? "Retry" : "Remind me"}
                    </button>
                  )}
                  {isDone ? (
                    <button
                      onClick={() => setStatus(r.id, "active")}
                      className="h-9 px-3 rounded-full text-xs font-semibold border border-[#E6E8EE] bg-white text-[#1E293B] hover:border-[#2563EB] transition-colors"
                    >
                      Reopen
                    </button>
                  ) : (
                    <button
                      onClick={() => setStatus(r.id, "completed")}
                      title="Mark done"
                      className="h-9 w-9 rounded-full border border-[#E6E8EE] bg-white text-[#15803D] hover:bg-[#F0FDF4] hover:border-[#BBF7D0] transition-colors flex items-center justify-center font-bold"
                    >
                      ✓
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {planItems !== null && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl max-h-[85vh] flex flex-col">
            <h3 className="text-lg font-semibold text-[#0F172A]">
              Your renewal plan
            </h3>

            {planItems.length === 0 ? (
              <>
                <p className="text-sm text-[#64748B] mt-2">
                  All caught up. Nothing urgent in the next 45 days.
                </p>
                <button
                  onClick={() => setPlanItems(null)}
                  className="mt-5 w-full py-2.5 border border-[#E6E8EE] rounded-xl text-sm font-semibold text-[#1E293B] hover:bg-[#F6F7F9] transition-colors"
                >
                  Close
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-[#64748B] mt-1">
                  NEXUS reviewed your upcoming obligations and drafted this plan. Uncheck anything
                  you don&apos;t want, then approve to turn the rest into tasks. Nothing is created until you approve.
                </p>

                <div className="mt-4 space-y-2 overflow-y-auto pr-1">
                  {planItems.map((p) => (
                    <label
                      key={p.deadline_id}
                      className="flex items-start gap-3 p-3 rounded-xl border border-[#E6E8EE] cursor-pointer hover:border-[#2563EB]/50 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(p.deadline_id)}
                        onChange={() => toggleSelected(p.deadline_id)}
                        className="mt-0.5 accent-[#2563EB]"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#1E293B]">{p.task_title}</p>
                        <p className="text-xs text-[#64748B] mt-1">{p.reasoning}</p>
                        <p className="text-[11px] text-[#64748B]/70 mt-1">
                          For: {p.deadline_title}
                          {p.suggested_date && <> · Suggested: {new Date(p.suggested_date).toLocaleDateString()}</>}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="mt-5 flex gap-2">
                  <button
                    onClick={approvePlan}
                    disabled={applying || selected.size === 0}
                    className="flex-1 py-2.5 bg-[#2563EB] text-white rounded-xl text-sm font-semibold
                      hover:bg-[#1D4ED8] disabled:opacity-40 transition-colors shadow-sm"
                  >
                    {applying ? "Creating tasks..." : `Approve ${selected.size} task${selected.size === 1 ? "" : "s"}`}
                  </button>
                  <button
                    onClick={() => setPlanItems(null)}
                    className="px-4 py-2.5 text-[#64748B] text-sm font-medium hover:text-[#1E293B] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
    </TwoCol>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3.5 py-1.5 rounded-full font-medium border transition-colors ${
        active
          ? "bg-[#2563EB] text-white border-[#2563EB] shadow-sm"
          : "bg-white text-[#64748B] border-[#E6E8EE] hover:border-[#2563EB] hover:text-[#1E293B]"
      }`}
    >
      {label}
    </button>
  );
}
