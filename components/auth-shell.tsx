"use client";

import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { useState } from "react";
import { NexusMark } from "@/components/brand";

type Mode = "signin" | "signup";

const COPY: Record<Mode, { title: string; blurb: string; google: string; switchText: string; switchCta: string; switchHref: string }> = {
  signin: {
    title: "Welcome back to NEXUS",
    blurb: "Sign in to pick up where you left off. Your documents, reminders and answers are waiting.",
    google: "Sign in with Google",
    switchText: "New here?",
    switchCta: "Create an account",
    switchHref: "/signup",
  },
  signup: {
    title: "Your paperwork, handled",
    blurb: "Upload your documents once. NEXUS reads them, tracks what expires, answers questions and fills forms for you.",
    google: "Sign up with Google",
    switchText: "Already have an account?",
    switchCta: "Sign in",
    switchHref: "/login",
  },
};

const BENEFITS = [
  "Every number and date, one question away",
  "Warned before anything expires",
  "Forms filled from what you've already uploaded",
];

export function AuthShell({ mode, openEmail, children }: { mode: Mode; openEmail?: boolean; children: React.ReactNode }) {
  const [showEmail, setShowEmail] = useState(Boolean(openEmail));
  const copy = COPY[mode];

  return (
    <div className="relative min-h-screen canvas overflow-clip flex items-center justify-center px-4 py-10">
      <Backdrop />

      <div className="relative w-full max-w-[440px] bg-white rounded-3xl border border-[#E6E8EE] shadow-2xl shadow-[#0F172A]/10 px-8 py-9 animate-fade-in-up">
        <div className="flex flex-col items-center text-center">
          <NexusMark size={56} />
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-[#0F172A]">{copy.title}</h1>
          <p className="mt-2 text-sm text-[#64748B] leading-relaxed max-w-[340px]">{copy.blurb}</p>
        </div>

        <ul className="mt-6 rounded-2xl bg-[#F8FAFC] border border-[#E6E8EE] px-5 py-4 space-y-2.5">
          {BENEFITS.map((b) => (
            <li key={b} className="flex items-center gap-3 text-sm font-medium text-[#1E293B]">
              <span className="w-5 h-5 rounded-md bg-[#F0FDF4] text-[#15803D] flex items-center justify-center text-xs shrink-0">✓</span>
              {b}
            </li>
          ))}
        </ul>

        <div className="mt-6">
          <GoogleButton mode={mode} />
        </div>

        {showEmail ? (
          <div className="mt-5 pt-5 border-t border-[#E6E8EE]">{children}</div>
        ) : (
          <button
            type="button"
            onClick={() => setShowEmail(true)}
            className="mt-4 w-full text-center text-sm text-[#64748B] hover:text-[#0F172A] underline underline-offset-4 decoration-[#CBD5E1]"
          >
            {mode === "signup" ? "Use email instead" : "Sign in with email instead"}
          </button>
        )}

        <p className="mt-6 text-center text-sm text-[#64748B]">
          {copy.switchText}{" "}
          <Link href={copy.switchHref} className="text-[#2563EB] font-semibold hover:underline">
            {copy.switchCta}
          </Link>
        </p>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-[#94A3B8]">
          <span className="text-[#15803D]">🛡</span> Secure sign-in via Google and Supabase. Your documents stay private.
        </p>
      </div>
    </div>
  );
}

// A muted, blurred sketch of the product behind the card, so the screen has
// depth without competing with the form.
function Backdrop() {
  return (
    <div aria-hidden="true" className="absolute inset-0 pointer-events-none select-none opacity-60">
      <div className="absolute inset-0 bg-gradient-to-br from-[#EFF6FF] via-[#F6F7F9] to-[#F1F5F9]" />
      <div className="absolute left-0 top-0 bottom-0 w-[76px] bg-white border-r border-[#E6E8EE]" />
      <div className="absolute left-[120px] top-[80px] right-[120px]">
        <div className="h-3 w-40 rounded bg-[#CBD5E1]/60" />
        <div className="mt-4 h-10 w-[420px] rounded-lg bg-[#94A3B8]/50" />
        <div className="mt-8 grid grid-cols-2 gap-4">
          <div className="h-20 rounded-2xl bg-white border border-[#E6E8EE]" />
          <div className="h-20 rounded-2xl bg-white border border-[#E6E8EE]" />
        </div>
        <div className="mt-4 grid grid-cols-[1.9fr_1fr] gap-4">
          <div className="h-72 rounded-2xl bg-white border border-[#E6E8EE]" />
          <div className="space-y-4">
            <div className="h-40 rounded-2xl bg-white border border-[#E6E8EE]" />
            <div className="h-28 rounded-2xl bg-white border border-[#E6E8EE]" />
          </div>
        </div>
      </div>
      <div className="absolute -top-24 right-0 w-[520px] h-[520px] rounded-full bg-[radial-gradient(circle,_#DBEAFE_0%,_transparent_65%)]" />
    </div>
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
        className="w-full py-3.5 bg-white border-2 border-[#E6E8EE] hover:border-[#0F172A] text-[#0F172A]
          rounded-full font-semibold text-[15px] flex items-center justify-center gap-3 transition-all
          hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#0F172A]/10 disabled:opacity-60 cursor-pointer"
      >
        <GoogleMark />
        {starting ? "Opening Google…" : COPY[mode].google}
      </button>
      {error && <p className="mt-2 text-xs text-red-600 font-medium text-center">{error}</p>}
    </div>
  );
}

export const inputClass =
  "w-full px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E6E8EE] rounded-xl text-sm transition-colors " +
  "focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#2563EB] focus:border-transparent " +
  "text-[#1E293B] placeholder-[#94A3B8]";

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.2 5.5-4.7 7.2l7.6 5.9c4.4-4.1 6.9-10.1 6.9-17.6z" />
      <path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.4 0 20.1 0 24s1 7.6 2.6 10.7l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.3 0 11.7-2.1 15.6-5.7l-7.6-5.9c-2.1 1.4-4.8 2.3-8 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}
