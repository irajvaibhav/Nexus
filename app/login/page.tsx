"use client";

import { createClient } from "@/lib/supabase-browser";
import { AuthShell, GoogleButton, OrDivider, inputClass } from "@/components/auth-shell";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import Link from "next/link";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

type Problem =
  | { kind: "none" }
  | { kind: "bad_credentials" }
  | { kind: "unconfirmed" }
  | { kind: "google" }
  | { kind: "other"; message: string };

function LoginInner() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [password, setPassword] = useState("");
  const [problem, setProblem] = useState<Problem>(
    searchParams.get("error") === "google" ? { kind: "google" } : { kind: "none" }
  );
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setProblem({ kind: "none" });

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      // Supabase deliberately returns the same error for "no such account" and
      // "wrong password", so the message has to cover both without guessing.
      if (/invalid login credentials/i.test(error.message)) setProblem({ kind: "bad_credentials" });
      else if (/not confirmed/i.test(error.message)) setProblem({ kind: "unconfirmed" });
      else setProblem({ kind: "other", message: error.message });
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function resendConfirmation() {
    await supabase.auth.resend({ type: "signup", email });
    setResent(true);
  }

  return (
    <AuthShell mode="signin">
      <h2 className="text-lg font-serif font-semibold text-[#1A1412]">Welcome back</h2>
      <p className="text-xs text-[#7C6E67] mt-0.5 mb-5">Sign in to the account you already have.</p>

      <GoogleButton mode="signin" />
      <OrDivider />

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-[#7C6E67] mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className={inputClass}
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#7C6E67] mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className={inputClass}
            placeholder="••••••••"
          />
        </div>

        {problem.kind === "bad_credentials" && (
          <div className="rounded-xl border border-[#F5DFD6] bg-[#FDF2EE] px-3.5 py-3 text-sm">
            <p className="font-semibold text-[#D95D39]">That email and password don&apos;t match.</p>
            <p className="text-[#7C6E67] text-xs mt-1">
              Either the password is wrong, or there&apos;s no NEXUS account for{" "}
              <span className="font-medium text-[#2E2724]">{email}</span> yet.{" "}
              <Link
                href={`/signup?email=${encodeURIComponent(email)}`}
                className="text-[#D95D39] font-semibold hover:underline"
              >
                New here? Create an account →
              </Link>
            </p>
          </div>
        )}

        {problem.kind === "unconfirmed" && (
          <div className="rounded-xl border border-[#FBEAC9] bg-[#FEF9EC] px-3.5 py-3 text-sm">
            <p className="font-semibold text-[#B9832A]">Confirm your email first.</p>
            <p className="text-[#7C6E67] text-xs mt-1">
              We sent a confirmation link to {email}. Open it, then sign in.{" "}
              {resent ? (
                <span className="text-[#6E885B] font-medium">Sent again ✓</span>
              ) : (
                <button type="button" onClick={resendConfirmation} className="text-[#D95D39] font-semibold hover:underline">
                  Resend the email
                </button>
              )}
            </p>
          </div>
        )}

        {problem.kind === "google" && (
          <p className="text-sm text-red-600 font-medium">
            Google sign-in didn&apos;t complete. Try again, or use your email and password.
          </p>
        )}

        {problem.kind === "other" && (
          <p className="text-sm text-red-600 font-medium">{problem.message}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-[#D95D39] hover:bg-[#C24E2B] text-white rounded-xl
            font-semibold text-sm disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="text-center text-sm text-[#7C6E67] mt-6">
        New to NEXUS?{" "}
        <Link href="/signup" className="text-[#D95D39] font-bold hover:underline">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
