import { getAuthedUser } from "@/lib/require-user";
import { getGoogleAuthUrl } from "@/lib/google-calendar";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function GET(request: NextRequest) {
  const authedUser = await getAuthedUser();
  if (!authedUser) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const state = crypto.randomBytes(16).toString("hex");
  const url = getGoogleAuthUrl(state);
  return NextResponse.redirect(url);
}
