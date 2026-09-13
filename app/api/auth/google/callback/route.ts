import { createClient } from "@supabase/supabase-js";
import { getAuthedUser } from "@/lib/require-user";
import { exchangeCodeForTokens, getGoogleAccountEmail, GOOGLE_STATE_COOKIE } from "@/lib/google-calendar";
import { NextRequest, NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const settingsUrl = new URL("/dashboard/settings", request.url);

  const authedUser = await getAuthedUser();
  if (!authedUser) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(GOOGLE_STATE_COOKIE)?.value;

  const fail = (reason: string) => {
    settingsUrl.searchParams.set("calendar_error", reason);
    const res = NextResponse.redirect(settingsUrl);
    res.cookies.delete(GOOGLE_STATE_COOKIE);
    return res;
  };

  if (error === "access_denied") return fail("denied");
  if (error || !code) return fail("failed");
  if (!state || !expectedState || state !== expectedState) return fail("state");

  try {
    const tokens = await exchangeCodeForTokens(code);
    const expiryDate = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Google only issues a refresh token on the first consent for this client,
    // so keep any we already have rather than overwriting it with null.
    const { data: previous } = await supabase
      .from("google_tokens")
      .select("refresh_token")
      .eq("user_id", authedUser.id)
      .maybeSingle();

    await supabase.from("google_tokens").upsert({
      user_id: authedUser.id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || previous?.refresh_token || null,
      expiry_date: expiryDate,
      scope: tokens.scope,
      updated_at: new Date().toISOString(),
    });

    const email = await getGoogleAccountEmail(tokens.access_token);

    await supabase.from("activity_log").insert({
      user_id: authedUser.id,
      action: "calendar",
      details: { message: email ? `Connected Google Calendar (${email})` : "Connected Google Calendar" },
    });

    settingsUrl.searchParams.set("calendar_connected", "1");
    const res = NextResponse.redirect(settingsUrl);
    res.cookies.delete(GOOGLE_STATE_COOKIE);
    return res;
  } catch {
    return fail("failed");
  }
}
