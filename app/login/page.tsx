"use client";

import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FCFAF7]">
      <div className="w-full max-w-sm p-8 bg-white rounded-3xl shadow-sm border border-[#E5DFD7]">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-serif font-semibold tracking-tight text-[#1A1412]">
            N<span className="text-[#D95D39]">E</span>XUS
          </h1>
          <p className="text-sm text-[#7C6E67] mt-1">
            Your AI Life Admin
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#7C6E67] mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3.5 py-2 border border-[#E5DFD7] rounded-xl text-sm
                focus:outline-none focus:ring-2 focus:ring-[#D95D39] focus:border-transparent text-[#2E2724] placeholder-[#7C6E67]/40"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#7C6E67] mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3.5 py-2 border border-[#E5DFD7] rounded-xl text-sm
                focus:outline-none focus:ring-2 focus:ring-[#D95D39] focus:border-transparent text-[#2E2724] placeholder-[#7C6E67]/40"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 font-semibold">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#D95D39] hover:bg-[#C24E2B] text-white rounded-xl
              font-semibold text-sm disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="text-center text-sm text-[#7C6E67] mt-6">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-[#D95D39] font-bold hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}