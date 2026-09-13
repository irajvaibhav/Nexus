"use client";

import { createClient } from "@/lib/supabase-browser";
import { AuthShell, GoogleButton, OrDivider, inputClass } from "@/components/auth-shell";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import Link from "next/link";

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupInner />
    </Suspense>
  );
}

type Problem =
  | { kind: "none" }
  | { kind: "exists" }
  | { kind: "google" }
  | { kind: "other"; message: string };

function SignupInner() {
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [password, setPassword] = useState("");
  const [problem, setProblem] = useState<Problem>(
    searchParams.get("error") === "google" ? { kind: "google" } : { kind: "none" }
  );
  const [loading, setLoading] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setProblem({ kind: "none" });

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });

    if (signUpError) {
      if (/already registered|already exists/i.test(signUpError.message)) setProblem({ kind: "exists" });
      else setProblem({ kind: "other", message: signUpError.message });
      setLoading(false);
      return;
    }

    // With email confirmation on, Supabase answers a duplicate signup with a
    // placeholder user that has no identities rather than an error.
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      setProblem({ kind: "exists" });
      setLoading(false);
      return;
    }

    if (data.user) {
      await supabase.from("profiles").upsert({ id: data.user.id, full_name: name, email });
    }

    if (!data.session) {
      setAwaitingConfirmation(true);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  if (awaitingConfirmation) {
    return (
      <AuthShell mode="signup">
        <div className="text-center">
          <p className="text-3xl">📬</p>
          <h2 className="text-lg font-serif font-semibold text-[#1A1412] mt-2">Check your inbox</h2>
          <p className="text-sm text-[#7C6E67] mt-2">
            We sent a confirmation link to <span className="font-medium text-[#2E2724]">{email}</span>.
            Open it to activate your account, then sign in.
          </p>
          <Link
            href={`/login?email=${encodeURIComponent(email)}`}
            className="inline-block mt-5 text-sm px-4 py-2 bg-[#D95D39] text-white rounded-xl font-semibold hover:bg-[#C24E2B]"
          >
            Go to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell mode="signup">
      <h2 className="text-lg font-serif font-semibold text-[#1A1412]">Create your account</h2>
      <p className="text-xs text-[#7C6E67] mt-0.5 mb-5">Takes a minute. Your documents stay private to you.</p>

      <GoogleButton mode="signup" />
      <OrDivider />

      <form onSubmit={handleSignup} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-[#7C6E67] mb-1">Full name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
            className={inputClass}
            placeholder="Aman Mehra"
          />
        </div>

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
            minLength={6}
            autoComplete="new-password"
            className={inputClass}
            placeholder="Min 6 characters"
          />
        </div>

        {problem.kind === "exists" && (
          <div className="rounded-xl border border-[#F5DFD6] bg-[#FDF2EE] px-3.5 py-3 text-sm">
            <p className="font-semibold text-[#D95D39]">This email already has a NEXUS account.</p>
            <p className="text-[#7C6E67] text-xs mt-1">
              <Link
                href={`/login?email=${encodeURIComponent(email)}`}
                className="text-[#D95D39] font-semibold hover:underline"
              >
                Sign in instead →
              </Link>{" "}
              If you signed up with Google, use &ldquo;Continue with Google&rdquo; there.
            </p>
          </div>
        )}

        {problem.kind === "google" && (
          <p className="text-sm text-red-600 font-medium">
            Google sign-up didn&apos;t complete. Try again, or create an account with your email.
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
          {loading ? "Creating your account…" : "Create account"}
        </button>
      </form>

      <p className="text-center text-sm text-[#7C6E67] mt-6">
        Already have an account?{" "}
        <Link href="/login" className="text-[#D95D39] font-bold hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
