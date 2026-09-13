import { createClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

// Supabase OAuth (PKCE) lands here with a one-time code. Exchanging it sets the
// session cookies; the profile row is created here because the signup page's
// upsert never runs for Google users.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("next") || "/dashboard";
  const intent = request.nextUrl.searchParams.get("intent") || "signin";
  const failure = new URL(intent === "signup" ? "/signup" : "/login", request.url);
  failure.searchParams.set("error", "google");

  if (!code) return NextResponse.redirect(failure);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(failure);

  const user = data.user;
  const fullName =
    user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "";

  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!existing) {
    await supabase.from("profiles").upsert({ id: user.id, full_name: fullName, email: user.email });
    await supabase.from("activity_log").insert({
      user_id: user.id,
      action: "account",
      details: { message: "Created your NEXUS account with Google" },
    });
  }

  return NextResponse.redirect(new URL(next, request.url));
}
