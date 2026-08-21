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
  { href: "/dashboard/documents", icon: DocumentsIcon, label: "Documents" },
  { href: "/dashboard/ask", icon: ChatIcon, label: "Ask Nexus" },
  { href: "/dashboard/scan", icon: ScanIcon, label: "Scan & Fill" },
  { href: "/dashboard/reminders", icon: BellIcon, label: "Reminders" },
  { href: "/dashboard/tasks", icon: CheckSquareIcon, label: "Tasks" },
  { href: "/dashboard/activity", icon: ActivityIcon, label: "Activity" },
  { href: "/dashboard/settings", icon: GearIcon, label: "Settings" },
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

  return (
    <div className="min-h-screen flex bg-[#FCFAF7]">
      <aside className="w-64 flex flex-col fixed h-full bg-[#F4EFEA] border-r border-[#E5DFD7] z-20">

        <div className="px-6 py-6">
          <h1 className="text-2xl font-serif font-bold tracking-widest text-[#1A1412]">
            NE<span className="text-[#D95D39]">X</span>US
          </h1>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-[15px]
                  transition-all ${
                    isActive
                      ? "bg-[#D95D39] text-white font-medium shadow-sm shadow-[#D95D39]/20"
                      : "text-[#7C6E67] hover:bg-[#EAE2D9] hover:text-[#2E2724]"
                  }`}
              >
                <Icon className="w-[18px] h-[18px] shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 mx-4 mb-4 rounded-2xl bg-[#EAE2D9]/40 border border-[#E5DFD7]/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#D95D39] flex items-center
              justify-center text-sm font-bold text-white shrink-0">
              {name.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-sm font-semibold text-[#2E2724] truncate">{name}</p>
              <p className="text-xs text-[#7C6E67] truncate">{email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-[#7C6E67] hover:text-[#D95D39] transition-colors p-1"
              title="Logout"
            >
              <LogoutIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 bg-[#FCFAF7] min-h-screen relative overflow-hidden ml-64">
        {/* Soft Ambient Sunset Glow */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[radial-gradient(circle_at_top_right,_#FED7AA_0%,_#FFEDD5_45%,_transparent_75%)] opacity-55 pointer-events-none z-0" />

        <header className="sticky top-0 z-10 bg-[#FCFAF7]/80 backdrop-blur-md border-b border-[#E5DFD7] px-6 py-3
          flex items-center justify-end gap-4 relative">
          <div className="flex items-center gap-3">
            <button className="relative p-2 text-[#7C6E67] hover:text-[#2E2724]
              transition-colors">
              <BellIcon className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#D95D39] rounded-full" />
            </button>
          </div>
        </header>

        <div className="p-6 relative z-10">
          {children}
        </div>
      </main>
    </div>
  );
}