import { createClient } from "@supabase/supabase-js";
import { getAuthedUser } from "@/lib/require-user";
import {
  getValidAccessToken,
  getGoogleAccountEmail,
  probeCalendarAccess,
  CalendarDisconnectedError,
} from "@/lib/google-calendar";
import { NextRequest, NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// "Connected" used to mean "a token row exists", which stayed true long after
// Google had revoked the grant. With ?verify=1 the route round-trips to Google
// so Settings can show the real state and the account it's tied to.
export async function GET(request: NextRequest) {
  const authedUser = await getAuthedUser();
  if (!authedUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const verify = request.nextUrl.searchParams.get("verify") === "1";

  const { data: row } = await supabase
    .from("google_tokens")
    .select("user_id, scope, updated_at")
    .eq("user_id", authedUser.id)
    .maybeSingle();

  if (!row) return NextResponse.json({ connected: false });

  if (!verify) return NextResponse.json({ connected: true });

  try {
    const accessToken = await getValidAccessToken(supabase, authedUser.id);
    if (!accessToken) return NextResponse.json({ connected: false });

    const [email] = await Promise.all([
      getGoogleAccountEmail(accessToken),
      probeCalendarAccess(accessToken),
    ]);

    const scope = String(row.scope || "");
    return NextResponse.json({
      connected: true,
      healthy: true,
      email,
      canWriteEvents: scope.includes("calendar.events"),
      connectedAt: row.updated_at,
    });
  } catch (err) {
    if (err instanceof CalendarDisconnectedError) {
      return NextResponse.json({ connected: false, problem: err.message });
    }
    const message = err instanceof Error ? err.message : "Couldn't reach Google Calendar";
    return NextResponse.json({ connected: true, healthy: false, problem: message });
  }
}
