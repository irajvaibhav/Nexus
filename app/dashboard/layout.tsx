"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import {
  HomeIcon, DocumentsIcon, ChatIcon, ScanIcon, BellIcon,
  CheckSquareIcon, ActivityIcon, SlidersIcon, LogoutIcon, MicIcon, ArrowUpIcon, SparkleIcon,
} from "@/components/icons";
import { useEffect, useRef, useState } from "react";
import { NexusMark } from "@/components/brand";

const navItems = [
  { href: "/dashboard", icon: HomeIcon, label: "Home", short: "Home" },
  { href: "/dashboard/documents", icon: DocumentsIcon, label: "Vault", short: "Vault" },
  { href: "/dashboard/ask", icon: ChatIcon, label: "Ask NEXUS", short: "Ask" },
  { href: "/dashboard/scan", icon: ScanIcon, label: "Scan & Fill", short: "Fill" },
  { href: "/dashboard/reminders", icon: BellIcon, label: "Reminders", short: "Dates" },
  { href: "/dashboard/tasks", icon: CheckSquareIcon, label: "Tasks", short: "Tasks" },
  { href: "/dashboard/activity", icon: ActivityIcon, label: "Activity", short: "Log" },
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
  const [email, setEmail] = useState("");
  const [ask, setAsk] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // The app is a fixed frame: the rail and the Ask footer never move, only
  // the content column scrolls. Lock the window so a stray offset from an
  // earlier page can never shift the frame, and start each page at the top.
  useEffect(() => {
    const html = document.documentElement;
    const prev = { html: html.style.overflow, body: document.body.style.overflow };
    html.style.overflow = "clip";
    document.body.style.overflow = "clip";
    window.scrollTo(0, 0);
    return () => {
      html.style.overflow = prev.html;
      document.body.style.overflow = prev.body;
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setName(user.user_metadata?.full_name || "User");
      setEmail(user.email || "");
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

  // Home and the chat page carry their own Ask box.
  const onAskPage = pathname === "/dashboard/ask" || pathname === "/dashboard";

  return (
    <div className="h-[100dvh] overflow-clip flex canvas">
      <aside className="hidden lg:flex w-[96px] flex-col items-center fixed inset-y-0 left-0 rail z-20 py-4">
        <Link href="/dashboard" title="NEXUS" className="hover:scale-105 transition-transform">
          <NexusMark size={48} />
        </Link>

        {/* min-h-0 + overflow lets the list scroll on short screens instead of
            pushing Settings and the profile below the fold. */}
        <nav className="flex-1 min-h-0 overflow-y-auto mt-4 flex flex-col items-center gap-0.5 w-full px-3 [scrollbar-width:none]">
          {navItems.map((item) => {
            const isActive = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
                className={`group w-full rounded-2xl flex flex-col items-center gap-1 py-2 shrink-0 transition-all
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

        <div className="flex flex-col items-center gap-1 w-full px-3 pt-2 border-t border-[#E6E8EE] shrink-0 relative">
          <Link
            href="/dashboard/settings"
            aria-label="Settings"
            className={`w-full rounded-2xl flex flex-col items-center gap-1 py-2 transition-colors ${
              pathname.startsWith("/dashboard/settings")
                ? "bg-[#EAF2FF] text-[#2563EB]"
                : "text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
            }`}
          >
            <SlidersIcon className="w-6 h-6" />
            <span className={`text-[10px] font-semibold tracking-wide ${pathname.startsWith("/dashboard/settings") ? "text-[#2563EB]" : "text-[#94A3B8]"}`}>Settings</span>
          </Link>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title={name}
            className="mt-1 mb-1 w-11 h-11 rounded-full bg-gradient-to-br from-[#2563EB] to-[#4F46E5] text-white text-sm font-bold flex items-center
              justify-center shadow-md shadow-[#2563EB]/25 hover:scale-105 transition-transform ring-2 ring-white"
          >
            {name.charAt(0).toUpperCase() || "·"}
          </button>

          {menuOpen && (
            <>
              <div className="hidden lg:block fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
              <div role="menu" className="hidden lg:block absolute left-[88px] bottom-2 z-40 w-64 card p-2 shadow-2xl animate-fade-in-up">
                <Link href="/dashboard/profile" onClick={() => setMenuOpen(false)} className="px-3 py-2.5 flex items-center gap-3 rounded-xl hover:bg-[#F1F5F9]">
                  <span className="w-9 h-9 rounded-full bg-gradient-to-br from-[#2563EB] to-[#4F46E5] text-white text-sm font-bold flex items-center justify-center">
                    {name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#0F172A] truncate">{name}</p>
                    <p className="text-xs text-[#64748B] truncate">{email}</p>
                  </div>
                </Link>
                <div className="h-px bg-[#E6E8EE] my-1" />
                <Link href="/dashboard/profile" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-[#1E293B] hover:bg-[#F1F5F9]">
                  <span className="w-4 h-4 rounded-full bg-[#2563EB] text-white text-[9px] font-bold flex items-center justify-center">{name.charAt(0).toUpperCase()}</span> Profile
                </Link>
                <Link href="/dashboard/settings" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-[#1E293B] hover:bg-[#F1F5F9]">
                  <SlidersIcon className="w-4 h-4 text-[#64748B]" /> Settings
                </Link>
                <Link href="/dashboard/activity" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-[#1E293B] hover:bg-[#F1F5F9]">
                  <ActivityIcon className="w-4 h-4 text-[#64748B]" /> Activity log
                </Link>
                <button onClick={handleLogout} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-[#DB2777] hover:bg-[#FDF2F8]">
                  <LogoutIcon className="w-4 h-4" /> Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </aside>

      {/* The content column scrolls on its own; the Ask bar is a footer outside
          it, so it stays reachable without ever covering the page. */}
      <main className="flex-1 ml-0 lg:ml-[96px] h-[100dvh] flex flex-col relative overflow-clip">
        {/* Phone top bar */}
        <div className="lg:hidden relative shrink-0 flex items-center justify-between px-4 h-14 rail">
          <Link href="/dashboard" className="flex items-center gap-2">
            <NexusMark size={32} />
            <span className="text-sm font-bold text-[#0F172A]">NEXUS</span>
          </Link>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="w-9 h-9 rounded-full bg-gradient-to-br from-[#2563EB] to-[#4F46E5] text-white text-sm font-bold flex items-center justify-center"
            aria-label="Account"
          >
            {name.charAt(0).toUpperCase() || "·"}
          </button>
        </div>
        <div aria-hidden className="blob blob-a blob-faint" />
        <div aria-hidden className="blob blob-b blob-faint" />
        <div aria-hidden className="blob blob-c blob-faint" />
        <div ref={scrollRef} className={`relative flex-1 min-h-0 ${pathname === "/dashboard/ask" ? "overflow-clip" : "overflow-y-auto"}`}>
          <div className={`px-4 pt-5 sm:px-8 sm:pt-8 max-w-6xl mx-auto ${pathname === "/dashboard/ask" ? "h-full pb-2" : "pb-8"}`}>
            {children}
          </div>
        </div>

        {!onAskPage && (
          <div className="relative shrink-0 px-3 sm:px-8 pb-2 sm:pb-5 pt-2 pointer-events-none">
            <form
              onSubmit={(e) => { e.preventDefault(); submitAsk(); }}
              className="pointer-events-auto max-w-3xl mx-auto flex items-center gap-2 card !rounded-full pl-4 sm:pl-5 pr-1.5 sm:pr-2 py-1 sm:py-1.5 shadow-xl shadow-[#0F172A]/10 focus-within:border-[#2563EB]/40 transition-colors"
            >
              <SparkleIcon className="w-5 h-5 text-[#2563EB] shrink-0" />
              <input
                value={ask}
                onChange={(e) => setAsk(e.target.value)}
                placeholder="Ask NEXUS anything…"
                className="flex-1 py-1.5 bg-transparent text-[15px] focus:outline-none text-[#1E293B] placeholder-[#94A3B8]"
              />
              <Link
                href="/dashboard/ask?voice=1"
                className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-full border border-[#E6E8EE] text-sm
                  font-medium text-[#1E293B] hover:bg-[#F8FAFC] transition-colors"
              >
                <MicIcon className="w-[18px] h-[18px]" /> Voice
              </Link>
              <button
                type="submit"
                className="w-10 h-10 rounded-full bg-gradient-to-br from-[#2563EB] to-[#4F46E5] text-white flex items-center justify-center shadow-md shadow-[#2563EB]/30 hover:shadow-lg transition-shadow"
                aria-label="Ask"
              >
                <ArrowUpIcon className="w-5 h-5" />
              </button>
            </form>
          </div>
        )}
        {/* Phone bottom tabs */}
        <nav className="lg:hidden relative shrink-0 rail border-t border-[#E6E8EE] grid grid-cols-5 px-1 pb-[env(safe-area-inset-bottom)]">
          {[
            navItems[0], navItems[1], navItems[2], navItems[4],
            { href: "#more", icon: SlidersIcon, label: "More", short: "More" },
          ].map((item) => {
            const isMore = item.href === "#more";
            const isActive = !isMore && (item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href));
            const Icon = item.icon;
            const cls = `flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${isActive ? "text-[#2563EB]" : "text-[#64748B]"}`;
            return isMore ? (
              <button key="more" onClick={() => setMenuOpen((v) => !v)} className={cls}>
                <Icon className="w-6 h-6" />
                {item.short}
              </button>
            ) : (
              <Link key={item.href} href={item.href} className={cls}>
                <Icon className="w-6 h-6" />
                {item.short}
              </Link>
            );
          })}
        </nav>

        {menuOpen && (
          <div className="lg:hidden fixed inset-0 z-40" onClick={() => setMenuOpen(false)}>
            <div className="absolute inset-0 bg-[#0F172A]/30" />
            <div className="absolute inset-x-3 bottom-3 card p-2 animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
              <Link href="/dashboard/profile" onClick={() => setMenuOpen(false)} className="px-3 py-2.5 flex items-center gap-3 rounded-xl hover:bg-[#F1F5F9]">
                <span className="w-9 h-9 rounded-full bg-gradient-to-br from-[#2563EB] to-[#4F46E5] text-white text-sm font-bold flex items-center justify-center">{name.charAt(0).toUpperCase()}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#0F172A] truncate">{name}</p>
                  <p className="text-xs text-[#64748B] truncate">{email}</p>
                </div>
              </Link>
              <div className="h-px bg-[#E6E8EE] my-1" />
              <div className="grid grid-cols-2 gap-1">
                {[
                  { href: "/dashboard/scan", label: "Scan & Fill", icon: ScanIcon },
                  { href: "/dashboard/tasks", label: "Tasks", icon: CheckSquareIcon },
                  { href: "/dashboard/activity", label: "Activity", icon: ActivityIcon },
                  { href: "/dashboard/settings", label: "Settings", icon: SlidersIcon },
                ].map((m) => (
                  <Link key={m.href} href={m.href} onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-[#1E293B] hover:bg-[#F1F5F9]">
                    <m.icon className="w-4 h-4 text-[#64748B]" /> {m.label}
                  </Link>
                ))}
              </div>
              <button onClick={handleLogout} className="w-full mt-1 flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-[#DB2777] hover:bg-[#FDF2F8]">
                <LogoutIcon className="w-4 h-4" /> Sign out
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
