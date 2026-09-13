"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import {
  HomeIcon, DocumentsIcon, ChatIcon, ScanIcon, BellIcon,
  CheckSquareIcon, ActivityIcon, GearIcon, LogoutIcon,
} from "@/components/icons";
import { useEffect, useState } from "react";

const navItems = [
  { href: "/dashboard", icon: HomeIcon, label: "Home" },
  { href: "/dashboard/documents", icon: DocumentsIcon, label: "Vault" },
  { href: "/dashboard/ask", icon: ChatIcon, label: "Ask NEXUS" },
  { href: "/dashboard/scan", icon: ScanIcon, label: "Scan & Fill" },
  { href: "/dashboard/reminders", icon: BellIcon, label: "Reminders" },
  { href: "/dashboard/tasks", icon: CheckSquareIcon, label: "Tasks" },
  { href: "/dashboard/activity", icon: ActivityIcon, label: "Activity" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [name, setName] = useState("");
  const [ask, setAsk] = useState("");

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setName(user.user_metadata?.full_name || "User");
    }
    getUser();
  }, [router, supabase]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function submitAsk() {
    const q = ask.trim();
    setAsk("");
    router.push(q ? `/dashboard/ask?q=${encodeURIComponent(q)}` : "/dashboard/ask");
  }

  const onAskPage = pathname === "/dashboard/ask";

  return (
    <div className="min-h-screen flex bg-[#F6F7F9]">
      <aside className="w-[76px] flex flex-col items-center fixed h-full bg-white border-r border-[#E6E8EE] z-20 py-5">
        <Link
          href="/dashboard"
          className="w-11 h-11 rounded-2xl bg-[#0F172A] text-white flex items-center justify-center
            font-bold tracking-tight text-lg"
          title="NEXUS"
        >
          N
        </Link>

        <nav className="flex-1 mt-8 flex flex-col items-center gap-1.5">
          {navItems.map((item) => {
            const isActive = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                aria-label={item.label}
                className={`group relative w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                  isActive
                    ? "bg-[#EAF2FF] text-[#2563EB]"
                    : "text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#1E293B]"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="pointer-events-none absolute left-full ml-3 px-2 py-1 rounded-lg bg-[#0F172A] text-white
                  text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-col items-center gap-2">
          <Link
            href="/dashboard/settings"
            title="Settings"
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
              pathname.startsWith("/dashboard/settings")
                ? "bg-[#EAF2FF] text-[#2563EB]"
                : "text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#1E293B]"
            }`}
          >
            <GearIcon className="w-5 h-5" />
          </Link>
          <button
            onClick={handleLogout}
            title={`Sign out ${name}`}
            className="w-9 h-9 rounded-full bg-[#2563EB] text-white text-sm font-semibold flex items-center
              justify-center hover:bg-[#1D4ED8] transition-colors group relative"
          >
            {name.charAt(0).toUpperCase() || "·"}
            <span className="absolute inset-0 rounded-full bg-[#0F172A] text-white flex items-center justify-center
              opacity-0 group-hover:opacity-100 transition-opacity">
              <LogoutIcon className="w-4 h-4" />
            </span>
          </button>
        </div>
      </aside>

      <main className="flex-1 min-h-screen ml-[76px]">
        <div className={`px-8 pt-8 max-w-6xl mx-auto ${onAskPage ? "pb-8" : "pb-32"}`}>
          {children}
        </div>

        {!onAskPage && (
          <div className="fixed bottom-6 left-[76px] right-0 flex justify-center px-6 pointer-events-none z-30">
            <form
              onSubmit={(e) => { e.preventDefault(); submitAsk(); }}
              className="pointer-events-auto w-full max-w-xl flex items-center gap-2 bg-white rounded-2xl
                border border-[#E6E8EE] shadow-lg shadow-[#0F172A]/8 pl-4 pr-2 py-2"
            >
              <span className="text-[#2563EB]">✦</span>
              <input
                value={ask}
                onChange={(e) => setAsk(e.target.value)}
                placeholder="Ask NEXUS anything, e.g. 'when does my insurance expire?'"
                className="flex-1 bg-transparent text-sm focus:outline-none text-[#1E293B] placeholder-[#94A3B8]"
              />
              <Link
                href="/dashboard/ask?voice=1"
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E6E8EE] text-xs
                  font-medium text-[#1E293B] hover:bg-[#F8FAFC]"
              >
                🎙 Voice
              </Link>
              <button
                type="submit"
                className="w-9 h-9 rounded-xl bg-[#2563EB] text-white flex items-center justify-center hover:bg-[#1D4ED8]"
                aria-label="Ask"
              >
                ↑
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
