import { getAuthedUser } from "@/lib/require-user";
import { getGoogleAuthUrl, GOOGLE_STATE_COOKIE } from "@/lib/google-calendar";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function GET(request: NextRequest) {
  const authedUser = await getAuthedUser();
  if (!authedUser) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const state = crypto.randomBytes(16).toString("hex");
  const response = NextResponse.redirect(getGoogleAuthUrl(state));
  // The callback checks this against the state Google echoes back, so a
  // forged callback can't attach someone else's Google account to this user.
  response.cookies.set(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/google",
    maxAge: 600,
  });
  return response;
}
