import { createClient } from "@supabase/supabase-js";
import { getAuthedUser } from "@/lib/require-user";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  const authedUser = await getAuthedUser();
  if (!authedUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await supabase.from("google_tokens").delete().eq("user_id", authedUser.id);

  await supabase.from("activity_log").insert({
    user_id: authedUser.id,
    action: "calendar",
    details: { message: "Disconnected Google Calendar" },
  });

  return NextResponse.json({ success: true });
}
