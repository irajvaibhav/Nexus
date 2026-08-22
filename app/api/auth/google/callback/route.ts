import { createClient } from "@supabase/supabase-js";
import { getAuthedUser } from "@/lib/require-user";
import { exchangeCodeForTokens } from "@/lib/google-calendar";
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

  if (error || !code) {
    settingsUrl.searchParams.set("calendar_error", "1");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const expiryDate = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    await supabase.from("google_tokens").upsert({
      user_id: authedUser.id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: expiryDate,
      scope: tokens.scope,
      updated_at: new Date().toISOString(),
    });

    await supabase.from("activity_log").insert({
      user_id: authedUser.id,
      action: "calendar",
      details: { message: "Connected Google Calendar" },
    });

    settingsUrl.searchParams.set("calendar_connected", "1");
    return NextResponse.redirect(settingsUrl);
  } catch {
    settingsUrl.searchParams.set("calendar_error", "1");
    return NextResponse.redirect(settingsUrl);
  }
}
