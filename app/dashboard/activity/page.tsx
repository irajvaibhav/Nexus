"use client";

import { createClient } from "@/lib/supabase-browser";
import { useEffect, useState } from "react";

type Activity = {
  id: string;
  action: string;
  details: { message?: string; document_id?: string | null } | null;
  created_at: string;
};

type Filter = "all" | "documents" | "ai" | "calendar";

type ActionMeta = {
  icon: string;
  actor: "You" | "NEXUS";
  group: Exclude<Filter, "all">;
};

const ACTION_META: Record<string, ActionMeta> = {
  upload: { icon: "📤", actor: "You", group: "documents" },
  process: { icon: "✨", actor: "NEXUS", group: "ai" },
  category: { icon: "🏷️", actor: "You", group: "documents" },
  delete: { icon: "🗑️", actor: "You", group: "documents" },
  review: { icon: "✍️", actor: "You", group: "documents" },
  chat: { icon: "💬", actor: "You", group: "ai" },
  scan: { icon: "📷", actor: "You", group: "ai" },
  agent: { icon: "🧭", actor: "NEXUS", group: "ai" },
  reminder: { icon: "✅", actor: "You", group: "documents" },
  calendar: { icon: "📅", actor: "You", group: "calendar" },
};

const FALLBACK_META: ActionMeta = { icon: "•", actor: "NEXUS", group: "ai" };

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Everything" },
  { key: "documents", label: "Documents" },
  { key: "ai", label: "AI" },
  { key: "calendar", label: "Calendar" },
];

function dayLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function timeLabel(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function ActivityPage() {
  const [supabase] = useState(() => createClient());
  const [activity, setActivity] = useState<Activity[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("activity_log")
        .select("id, action, details, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (data) setActivity(data);
      setLoading(false);
    })();
  }, [supabase]);

  const visible = activity.filter(
    (item) => filter === "all" || (ACTION_META[item.action] || FALLBACK_META).group === filter
  );

  const groups: { label: string; items: Activity[] }[] = [];
  for (const item of visible) {
    const label = dayLabel(item.created_at);
    const group = groups.find((g) => g.label === label);
    if (group) group.items.push(item);
    else groups.push({ label, items: [item] });
  }

  return (
    <div className="max-w-2xl animate-fade-in-up">
      <h1 className="text-3xl font-semibold tracking-tight text-[#0F172A]">Activity</h1>
      <p className="text-sm text-[#64748B] mt-1">
        Everything NEXUS did and everything you approved.
      </p>

      <div className="mt-5 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`text-xs px-3.5 py-1.5 rounded-full font-medium border transition-colors ${
              filter === f.key
                ? "bg-[#1E293B] text-white border-[#1E293B] shadow-sm"
                : "bg-white text-[#64748B] border-[#E6E8EE] hover:border-[#1E293B] hover:text-[#1E293B]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-6">
        {loading ? (
          <p className="text-sm text-[#64748B]/60 text-center py-8">Loading activity...</p>
        ) : groups.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E6E8EE] p-8 text-center">
            <p className="text-sm text-[#64748B]/60">
              {filter === "all"
                ? "No activity yet. Upload a document or ask NEXUS a question to get started."
                : "Nothing here yet."}
            </p>
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.label}>
              <h2 className="text-[10px] font-semibold text-[#64748B]/60 font-mono uppercase tracking-wider mb-2">
                {group.label}
              </h2>
              <div className="bg-white rounded-2xl border border-[#E6E8EE] divide-y divide-[#E6E8EE]/50">
                {group.items.map((item) => {
                  const meta = ACTION_META[item.action] || FALLBACK_META;
                  return (
                    <div key={item.id} className="flex items-start gap-3 px-4 py-3.5">
                      <span className="text-base leading-none mt-0.5">{meta.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#1E293B]">
                          {item.details?.message || item.action}
                        </p>
                        <span className={`inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                          meta.actor === "NEXUS"
                            ? "bg-[#EAF2FF] text-[#2563EB] border border-[#CFE0FF]"
                            : "bg-[#F8FAFC] text-[#64748B] border border-[#E2E8F0]"
                        }`}>
                          {meta.actor}
                        </span>
                      </div>
                      <span className="text-xs text-[#64748B]/70 shrink-0">
                        {timeLabel(item.created_at)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
