import { createClient } from "@supabase/supabase-js";
import { getAuthedUser } from "@/lib/require-user";
import { getValidAccessToken, listUpcomingEvents, CalendarDisconnectedError } from "@/lib/google-calendar";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// The next seven days of the user's primary calendar, for the week view.
export async function GET() {
  const authedUser = await getAuthedUser();
  if (!authedUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const accessToken = await getValidAccessToken(supabase, authedUser.id);
    if (!accessToken) return NextResponse.json({ connected: false, events: [] });

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const events = await listUpcomingEvents(accessToken, start.toISOString(), end.toISOString());
    return NextResponse.json({ connected: true, events });
  } catch (err) {
    if (err instanceof CalendarDisconnectedError) {
      return NextResponse.json({ connected: false, events: [], problem: err.message });
    }
    const message = err instanceof Error ? err.message : "Couldn't read your calendar";
    return NextResponse.json({ connected: true, events: [], problem: message });
  }
}
