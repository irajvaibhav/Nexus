import { createClient } from "@supabase/supabase-js";
import { getAuthedUser } from "@/lib/require-user";
import { getValidAccessToken, createCalendarEvent } from "@/lib/google-calendar";
import { NextRequest, NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const authedUser = await getAuthedUser();
    if (!authedUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { title, description, dateISO } = await request.json();
    if (!title || !dateISO) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const accessToken = await getValidAccessToken(supabase, authedUser.id);
    if (!accessToken) {
      return NextResponse.json({ error: "Google Calendar not connected" }, { status: 400 });
    }

    const eventId = await createCalendarEvent(accessToken, { title, description, dateISO });

    await supabase.from("activity_log").insert({
      user_id: authedUser.id,
      action: "calendar",
      details: { message: `Added "${title}" to Google Calendar on ${dateISO}` },
    });

    return NextResponse.json({ success: true, eventId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create calendar event";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
