"use client";

import { createClient } from "@/lib/supabase-browser";
import { daysLeft, daysLabel, badgeColorFor } from "@/lib/dates";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

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
    <div className="max-w-3xl animate-fade-in-up">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-serif font-semibold tracking-tight text-[#1A1412]">Reminders</h1>
          <p className="text-sm text-[#7C6E67] mt-1">
            Expiry and renewal dates NEXUS found in your documents.
          </p>
        </div>
        <button
          onClick={buildPlan}
          disabled={planLoading}
          className="text-sm px-4 py-2.5 bg-[#D95D39] text-white rounded-xl font-medium
            hover:bg-[#C24E2B] disabled:opacity-50 transition-colors shadow-sm shrink-0"
        >
          {planLoading ? "Reviewing your renewals..." : "Take care of my renewals"}
        </button>
      </div>

      {applyResult !== null && (
        <div className="mt-4 rounded-2xl border border-[#E1EAD8] bg-[#F3F6F1] px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-[#4A5D3D]">
            Created {applyResult} task{applyResult === 1 ? "" : "s"} from your renewal plan.
          </p>
          <button
            onClick={() => router.push("/dashboard/tasks")}
            className="text-xs font-semibold text-[#6E885B] hover:underline shrink-0"
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

      <div className="mt-4 bg-white rounded-2xl border border-[#E5DFD7] divide-y divide-[#E5DFD7]/50">
        {loading ? (
          <p className="px-4 py-8 text-sm text-[#7C6E67]/60 text-center">Loading reminders...</p>
        ) : visible.length === 0 ? (
          <p className="px-4 py-8 text-sm text-[#7C6E67]/60 text-center">
            {tab === "active"
              ? "No active reminders. NEXUS will surface expiry dates it finds in your documents here."
              : tab === "completed"
              ? "Nothing marked done yet."
              : "No reminders yet."}
          </p>
        ) : (
          visible.map((r) => {
            const days = daysLeft(r.expiry_date);
            const isDone = r.status === "completed";
            return (
              <div key={r.id} className="flex items-center justify-between px-4 py-3.5 hover:bg-[#FCFAF7] transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${isDone ? "bg-[#6E885B]" : "bg-[#E5DFD7]"}`} />
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold truncate ${isDone ? "text-[#7C6E67]/50 line-through" : "text-[#2E2724]"}`}>
                      {r.title}
                    </p>
                    <p className="text-xs text-[#7C6E67] truncate">
                      {r.documents?.file_name && <>{r.documents.file_name} · </>}
                      Expires on {new Date(r.expiry_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!isDone && (
                    <span className={`text-[11px] px-2 py-1 rounded-full font-medium ${badgeColorFor(days)}`}>
                      {daysLabel(days)}
                    </span>
                  )}
                  <button
                    onClick={() => router.push(`/dashboard/ask?q=${encodeURIComponent(`What do I need to know about my ${r.title}?`)}`)}
                    className="text-xs text-[#D95D39] hover:underline px-1 font-semibold"
                  >
                    Ask
                  </button>
                  {isDone ? (
                    <button
                      onClick={() => setStatus(r.id, "active")}
                      className="text-xs px-2.5 py-1 rounded-xl border border-[#E5DFD7] text-[#7C6E67] hover:border-[#D95D39] hover:text-[#D95D39] transition-colors bg-white"
                    >
                      Reopen
                    </button>
                  ) : (
                    <button
                      onClick={() => setStatus(r.id, "completed")}
                      className="text-xs px-2.5 py-1 rounded-xl bg-[#6E885B] text-white hover:bg-[#5C744B] transition-colors shadow-sm"
                    >
                      Mark done
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
            <h3 className="text-lg font-serif font-semibold text-[#1A1412]">
              Your renewal plan
            </h3>

            {planItems.length === 0 ? (
              <>
                <p className="text-sm text-[#7C6E67] mt-2">
                  You&apos;re all caught up — nothing urgent in the next 45 days.
                </p>
                <button
                  onClick={() => setPlanItems(null)}
                  className="mt-5 w-full py-2.5 border border-[#E5DFD7] rounded-xl text-sm font-semibold text-[#2E2724] hover:bg-[#FCFAF7] transition-colors"
                >
                  Close
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-[#7C6E67] mt-1">
                  NEXUS reviewed your upcoming obligations and drafted this plan. Uncheck anything
                  you don&apos;t want, then approve to turn the rest into tasks. Nothing is created until you approve.
                </p>

                <div className="mt-4 space-y-2 overflow-y-auto pr-1">
                  {planItems.map((p) => (
                    <label
                      key={p.deadline_id}
                      className="flex items-start gap-3 p-3 rounded-xl border border-[#E5DFD7] cursor-pointer hover:border-[#D95D39]/50 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(p.deadline_id)}
                        onChange={() => toggleSelected(p.deadline_id)}
                        className="mt-0.5 accent-[#D95D39]"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#2E2724]">{p.task_title}</p>
                        <p className="text-xs text-[#7C6E67] mt-1">{p.reasoning}</p>
                        <p className="text-[11px] text-[#7C6E67]/70 mt-1">
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
                    className="flex-1 py-2.5 bg-[#D95D39] text-white rounded-xl text-sm font-semibold
                      hover:bg-[#C24E2B] disabled:opacity-40 transition-colors shadow-sm"
                  >
                    {applying ? "Creating tasks..." : `Approve ${selected.size} task${selected.size === 1 ? "" : "s"}`}
                  </button>
                  <button
                    onClick={() => setPlanItems(null)}
                    className="px-4 py-2.5 text-[#7C6E67] text-sm font-medium hover:text-[#2E2724] transition-colors"
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
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3.5 py-1.5 rounded-full font-medium border transition-colors ${
        active
          ? "bg-[#D95D39] text-white border-[#D95D39] shadow-sm"
          : "bg-white text-[#7C6E67] border-[#E5DFD7] hover:border-[#D95D39] hover:text-[#2E2724]"
      }`}
    >
      {label}
    </button>
  );
}
