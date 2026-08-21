"use client";

import { createClient } from "@/lib/supabase-browser";
import { useEffect, useState } from "react";

type Activity = {
  id: string;
  action: string;
  details: { message?: string; document_id?: string | null } | null;
  created_at: string;
};

const typeIcons: Record<string, string> = {
  upload: "📤",
  process: "✨",
  category: "🏷️",
  delete: "🗑️",
  chat: "💬",
  reminder: "✅",
  scan: "📷",
  agent: "🧭",
};

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

  const groups: { label: string; items: Activity[] }[] = [];
  for (const item of activity) {
    const label = dayLabel(item.created_at);
    const group = groups.find((g) => g.label === label);
    if (group) group.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return (
    <div className="max-w-2xl animate-fade-in-up">
      <h1 className="text-2xl font-serif font-semibold tracking-tight text-[#1A1412]">Activity</h1>
      <p className="text-sm text-[#7C6E67] mt-1">
        Everything NEXUS has done, and everything you've asked it — for full transparency.
      </p>

      <div className="mt-6 space-y-6">
        {loading ? (
          <p className="text-sm text-[#7C6E67]/60 text-center py-8">Loading activity...</p>
        ) : groups.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E5DFD7] p-8 text-center">
            <p className="text-sm text-[#7C6E67]/60">
              No activity yet. Upload a document or ask NEXUS a question to get started.
            </p>
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.label}>
              <h2 className="text-[10px] font-semibold text-[#7C6E67]/60 font-mono uppercase tracking-wider mb-2">
                {group.label}
              </h2>
              <div className="bg-white rounded-2xl border border-[#E5DFD7] divide-y divide-[#E5DFD7]/50">
                {group.items.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 px-4 py-3.5">
                    <span className="text-base leading-none mt-0.5">
                      {typeIcons[item.action] || "•"}
                    </span>
                    <p className="text-sm text-[#2E2724] flex-1">
                      {item.details?.message || item.action}
                    </p>
                    <span className="text-xs text-[#7C6E67]/70 shrink-0">
                      {timeLabel(item.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
