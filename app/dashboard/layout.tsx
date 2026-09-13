"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import {
  HomeIcon, DocumentsIcon, ChatIcon, ScanIcon, BellIcon,
  CheckSquareIcon, ActivityIcon, GearIcon, LogoutIcon, MicIcon, ArrowUpIcon, SparkleIcon,
} from "@/components/icons";
import { useEffect, useState } from "react";

const navItems = [
  { href: "/dashboard", icon: HomeIcon, label: "Home", short: "Home" },
  { href: "/dashboard/documents", icon: DocumentsIcon, label: "Vault", short: "Vault" },
  { href: "/dashboard/ask", icon: ChatIcon, label: "Ask NEXUS", short: "Ask" },
  { href: "/dashboard/scan", icon: ScanIcon, label: "Scan & Fill", short: "Fill" },
  { href: "/dashboard/reminders", icon: BellIcon, label: "Reminders", short: "Dates" },
  { href: "/dashboard/tasks", icon: CheckSquareIcon, label: "Tasks", short: "Tasks" },
  { href: "/dashboard/activity", icon: ActivityIcon, label: "Activity", short: "Log" },
];

function Logo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 19V5l12 14V5" />
    </svg>
  );
}

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
      <aside className="w-[96px] flex flex-col items-center fixed h-full bg-white border-r border-[#E6E8EE] z-20 py-5">
        <Link
          href="/dashboard"
          className="w-12 h-12 rounded-2xl bg-[#0F172A] text-white flex items-center justify-center shadow-md shadow-[#0F172A]/15
            hover:scale-105 transition-transform"
          title="NEXUS"
        >
          <Logo className="w-6 h-6" />
        </Link>

        <nav className="flex-1 mt-6 flex flex-col items-center gap-1 w-full px-3">
          {navItems.map((item) => {
            const isActive = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
                className={`group w-full rounded-2xl flex flex-col items-center gap-1 py-2.5 transition-all
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] ${
                  isActive
                    ? "bg-[#EAF2FF] text-[#2563EB]"
                    : "text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
                }`}
              >
                <Icon className={`w-6 h-6 transition-transform ${isActive ? "" : "group-hover:-translate-y-0.5"}`} />
                <span className={`text-[10px] font-semibold tracking-wide ${isActive ? "text-[#2563EB]" : "text-[#94A3B8] group-hover:text-[#0F172A]"}`}>
                  {item.short}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-col items-center gap-2 w-full px-3">
          <Link
            href="/dashboard/settings"
            aria-label="Settings"
            className={`w-full rounded-2xl flex flex-col items-center gap-1 py-2.5 transition-colors ${
              pathname.startsWith("/dashboard/settings")
                ? "bg-[#EAF2FF] text-[#2563EB]"
                : "text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
            }`}
          >
            <GearIcon className="w-6 h-6" />
            <span className="text-[10px] font-semibold tracking-wide text-[#94A3B8]">Settings</span>
          </Link>
          <button
            onClick={handleLogout}
            title={`Sign out ${name}`}
            className="mt-1 w-11 h-11 rounded-full bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] text-white text-sm font-bold flex items-center
              justify-center shadow-md shadow-[#2563EB]/25 group relative hover:scale-105 transition-transform"
          >
            {name.charAt(0).toUpperCase() || "·"}
            <span className="absolute inset-0 rounded-full bg-[#0F172A] text-white flex items-center justify-center
              opacity-0 group-hover:opacity-100 transition-opacity">
              <LogoutIcon className="w-4 h-4" />
            </span>
          </button>
        </div>
      </aside>

      <main className="flex-1 min-h-screen ml-[96px]">
        <div className={`px-8 pt-8 max-w-6xl mx-auto ${onAskPage ? "pb-8" : "pb-32"}`}>
          {children}
        </div>

        {!onAskPage && (
          <div className="fixed bottom-6 left-[96px] right-0 flex justify-center px-6 pointer-events-none z-30">
            <form
              onSubmit={(e) => { e.preventDefault(); submitAsk(); }}
              className="pointer-events-auto w-full max-w-xl flex items-center gap-2 bg-white/95 backdrop-blur rounded-2xl
                border border-[#E6E8EE] shadow-xl shadow-[#0F172A]/10 pl-4 pr-2 py-2 transition-shadow focus-within:shadow-2xl
                focus-within:border-[#2563EB]/40"
            >
              <SparkleIcon className="w-5 h-5 text-[#2563EB] shrink-0" />
              <input
                value={ask}
                onChange={(e) => setAsk(e.target.value)}
                placeholder="Ask NEXUS anything, e.g. 'when does my insurance expire?'"
                className="flex-1 py-1.5 bg-transparent text-[15px] focus:outline-none text-[#1E293B] placeholder-[#94A3B8]"
              />
              <Link
                href="/dashboard/ask?voice=1"
                className="hidden sm:flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-[#E6E8EE] text-sm
                  font-medium text-[#1E293B] hover:bg-[#F8FAFC] transition-colors"
              >
                <MicIcon className="w-[18px] h-[18px]" /> Voice
              </Link>
              <button
                type="submit"
                className="w-11 h-11 rounded-xl bg-[#2563EB] text-white flex items-center justify-center hover:bg-[#1D4ED8] transition-colors"
                aria-label="Ask"
              >
                <ArrowUpIcon className="w-5 h-5" />
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
