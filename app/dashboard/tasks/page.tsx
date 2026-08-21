"use client";

import { createClient } from "@/lib/supabase-browser";
import { useCallback, useEffect, useState } from "react";

type Task = {
  id: string;
  title: string;
  done: boolean;
  created_at: string;
};

export default function TasksPage() {
  const [supabase] = useState(() => createClient());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [showDone, setShowDone] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("tasks")
      .select("id, title, done, created_at")
      .order("created_at", { ascending: false });
    if (data) setTasks(data);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setNewTitle("");
    const { data } = await supabase
      .from("tasks")
      .insert({ user_id: user.id, title })
      .select()
      .single();

    if (data) setTasks((prev) => [data, ...prev]);
  }

  async function toggleDone(task: Task) {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)));
    await supabase.from("tasks").update({ done: !task.done }).eq("id", task.id);
  }

  async function deleteTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await supabase.from("tasks").delete().eq("id", id);
  }

  const openTasks = tasks.filter((t) => !t.done);
  const doneTasks = tasks.filter((t) => t.done);
  const visible = showDone ? tasks : openTasks;

  return (
    <div className="max-w-2xl animate-fade-in-up">
      <h1 className="text-2xl font-serif font-semibold tracking-tight text-[#1A1412]">Tasks</h1>
      <p className="text-sm text-[#7C6E67] mt-1">
        Admin to-dos you want to keep track of — renewals, follow-ups, anything on your plate.
      </p>

      <form onSubmit={addTask} className="mt-6 flex gap-2">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add a task..."
          className="flex-1 px-4 py-2.5 bg-white border border-[#E5DFD7] rounded-xl
            text-sm focus:outline-none focus:ring-2 focus:ring-[#D95D39] focus:border-transparent text-[#2E2724] placeholder-[#7C6E67]/50"
        />
        <button
          type="submit"
          disabled={!newTitle.trim()}
          className="px-4 py-2.5 bg-[#D95D39] hover:bg-[#C24E2B] text-white rounded-xl text-sm font-medium
            transition-colors shadow-sm cursor-pointer"
        >
          Add
        </button>
      </form>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-[#7C6E67]">
          {openTasks.length} open{doneTasks.length > 0 && ` · ${doneTasks.length} done`}
        </p>
        {doneTasks.length > 0 && (
          <button
            onClick={() => setShowDone((v) => !v)}
            className="text-xs text-[#D95D39] hover:underline font-semibold"
          >
            {showDone ? "Hide completed" : "Show completed"}
          </button>
        )}
      </div>

      <div className="mt-2 bg-white rounded-2xl border border-[#E5DFD7] divide-y divide-[#E5DFD7]/50">
        {loading ? (
          <p className="px-4 py-8 text-sm text-[#7C6E67]/60 text-center">Loading tasks...</p>
        ) : visible.length === 0 ? (
          <p className="px-4 py-8 text-sm text-[#7C6E67]/60 text-center">
            No tasks yet. Add one above.
          </p>
        ) : (
          visible.map((task) => (
            <div key={task.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-[#FCFAF7] transition-colors">
              <button
                onClick={() => toggleDone(task)}
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                  task.done
                    ? "bg-[#6E885B] border-[#6E885B] text-white"
                    : "border-[#E5DFD7] hover:border-[#D95D39] bg-white"
                }`}
              >
                {task.done && "✓"}
              </button>
              <p className={`text-sm flex-1 ${task.done ? "text-[#7C6E67]/50 line-through" : "text-[#2E2724]"}`}>
                {task.title}
              </p>
              <button
                onClick={() => deleteTask(task.id)}
                className="text-[#7C6E67]/40 hover:text-red-500 transition-colors"
                title="Delete"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
