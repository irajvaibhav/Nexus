"use client";

import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { useState } from "react";

type Mode = "signin" | "signup";

export function AuthShell({ mode, children }: { mode: Mode; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FCFAF7] lg:grid lg:grid-cols-[1.1fr_1fr]">
      <BrandPanel />

      <div className="flex items-center justify-center px-4 py-10 lg:px-12">
        <div className="w-full max-w-sm animate-fade-in-up">
          <div className="lg:hidden text-center mb-6">
            <h1 className="text-3xl font-serif font-semibold tracking-tight text-[#1A1412]">
              N<span className="text-[#D95D39]">E</span>XUS
            </h1>
            <p className="text-sm text-[#7C6E67] mt-1">Your AI Life Admin</p>
          </div>

          {/* Both journeys are always visible, so a new user never lands on a
              sign-in form wondering how to get an account, and vice versa. */}
          <div className="grid grid-cols-2 p-1 bg-[#F4EFEA] rounded-2xl border border-[#E5DFD7] mb-5">
            <ModeTab href="/login" active={mode === "signin"} label="Sign in" hint="I have an account" />
            <ModeTab href="/signup" active={mode === "signup"} label="Create account" hint="I'm new here" />
          </div>

          {children}

          <p className="mt-8 text-center text-[11px] text-[#7C6E67]/70 leading-relaxed">
            Your documents are stored privately and only ever read for you. NEXUS never shares them.
          </p>
        </div>
      </div>
    </div>
  );
}

function BrandPanel() {
  return (
    <aside className="hidden lg:flex relative overflow-hidden flex-col justify-between p-12 text-[#1A1412]
      bg-[#F4EFEA] border-r border-[#E5DFD7]">
      {/* Soft sunset glow, echoing the dashboard header */}
      <div className="absolute -top-32 -right-32 w-[560px] h-[560px] rounded-full pointer-events-none
        bg-[radial-gradient(circle,_#FED7AA_0%,_#FFEDD5_40%,_transparent_70%)] opacity-70" />
      <div className="absolute -bottom-40 -left-24 w-[480px] h-[480px] rounded-full pointer-events-none
        bg-[radial-gradient(circle,_#F5DFD6_0%,_transparent_65%)] opacity-80" />

      <div className="relative">
        <h1 className="text-3xl font-serif font-semibold tracking-tight">
          N<span className="text-[#D95D39]">E</span>XUS
        </h1>
      </div>

      <div className="relative max-w-md">
        <h2 className="text-4xl font-serif font-semibold leading-[1.15] tracking-tight">
          Your paperwork,
          <br />
          <span className="italic text-[#D95D39]">handled.</span>
        </h2>
        <p className="mt-4 text-[15px] text-[#5C4F49] leading-relaxed">
          Upload your documents once. NEXUS reads them, remembers every number and
          date, warns you before anything expires, and fills forms for you.
        </p>

        {/* A miniature of the product, so the promise isn't abstract. */}
        <div className="mt-8 space-y-3">
          <Card delay="0ms" tone="orange" eyebrow="Expiring soon" title="Car insurance · 12 days left">
            Thursday looks clear in Mumbai — NEXUS can add the renewal to your calendar.
          </Card>
          <Card delay="120ms" tone="green" eyebrow="Ask NEXUS" title="“What’s my passport number?”">
            P1234567 · from passport.pdf, page 1 — expires 14 Jan 2027.
          </Card>
          <Card delay="240ms" tone="pink" eyebrow="Scan & Fill" title="Loan application form">
            14 of 16 fields filled from your documents. 2 need you.
          </Card>
        </div>
      </div>

      <p className="relative text-xs text-[#7C6E67]">
        Private by design · Every action logged · You approve before NEXUS acts
      </p>
    </aside>
  );
}

function Card({ delay, tone, eyebrow, title, children }: {
  delay: string;
  tone: "orange" | "green" | "pink";
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  const tones = {
    orange: "text-[#D95D39]",
    green: "text-[#6E885B]",
    pink: "text-[#C05C7B]",
  };
  return (
    <div
      className="bg-white/90 backdrop-blur rounded-2xl border border-[#E5DFD7] px-4 py-3.5 shadow-sm animate-fade-in-up opacity-0"
      style={{ animationDelay: delay }}
    >
      <p className={`text-[10px] font-semibold uppercase tracking-wider ${tones[tone]}`}>{eyebrow}</p>
      <p className="text-sm font-semibold text-[#1A1412] mt-0.5">{title}</p>
      <p className="text-xs text-[#7C6E67] mt-0.5">{children}</p>
    </div>
  );
}

function ModeTab({ href, active, label, hint }: { href: string; active: boolean; label: string; hint: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-xl px-3 py-2 text-center transition-all ${
        active ? "bg-white shadow-sm border border-[#E5DFD7]" : "hover:bg-white/60"
      }`}
    >
      <p className={`text-sm font-semibold ${active ? "text-[#1A1412]" : "text-[#7C6E67]"}`}>{label}</p>
      <p className="text-[11px] text-[#7C6E67]/80">{hint}</p>
    </Link>
  );
}

export function GoogleButton({ mode }: { mode: Mode }) {
  const [supabase] = useState(() => createClient());
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    setStarting(true);
    setError("");
    const redirectTo = `${window.location.origin}/auth/callback?intent=${mode}&next=/dashboard`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, queryParams: { prompt: "select_account" } },
    });
    if (error) {
      setError("Couldn't start Google sign-in. Please try again.");
      setStarting(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={start}
        disabled={starting}
        className="w-full py-3 bg-[#1A1412] hover:bg-[#2E2724] text-white
          rounded-xl font-semibold text-sm flex items-center justify-center gap-3 transition-all
          hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#1A1412]/15 disabled:opacity-60 cursor-pointer"
      >
        <span className="w-6 h-6 rounded-full bg-white flex items-center justify-center">
          <GoogleMark />
        </span>
        {starting ? "Opening Google…" : mode === "signup" ? "Sign up with Google" : "Continue with Google"}
      </button>
      {error && <p className="mt-2 text-xs text-red-600 font-medium">{error}</p>}
    </div>
  );
}

export function OrDivider() {
  return (
    <div className="flex items-center gap-3 my-5">
      <div className="flex-1 h-px bg-[#E5DFD7]" />
      <span className="text-[11px] uppercase tracking-wider text-[#7C6E67]/70 font-semibold">or with email</span>
      <div className="flex-1 h-px bg-[#E5DFD7]" />
    </div>
  );
}

export const inputClass =
  "w-full px-3.5 py-2.5 bg-[#FCFAF7] border border-[#E5DFD7] rounded-xl text-sm transition-colors " +
  "focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#D95D39] focus:border-transparent " +
  "text-[#2E2724] placeholder-[#7C6E67]/40";

function GoogleMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.2 5.5-4.7 7.2l7.6 5.9c4.4-4.1 6.9-10.1 6.9-17.6z" />
      <path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.4 0 20.1 0 24s1 7.6 2.6 10.7l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.3 0 11.7-2.1 15.6-5.7l-7.6-5.9c-2.1 1.4-4.8 2.3-8 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}
