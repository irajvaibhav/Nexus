import { createClient } from "@supabase/supabase-js";
import { getAuthedUser } from "@/lib/require-user";
import { NextRequest, NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type PlanItem = {
  document_id: string | null;
  task_title: string;
};

export async function POST(request: NextRequest) {
  try {
    const authedUser = await getAuthedUser();
    if (!authedUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = authedUser.id;

    const { items } = await request.json();

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "No items to apply" }, { status: 400 });
    }

    const rows = (items as PlanItem[]).map((item) => ({
      user_id: userId,
      title: item.task_title,
      document_id: item.document_id || null,
      done: false,
    }));

    const { data: created, error } = await supabase.from("tasks").insert(rows).select();
    if (error) throw error;

    await supabase.from("activity_log").insert({
      user_id: userId,
      action: "agent",
      details: { message: `NEXUS created ${rows.length} task${rows.length === 1 ? "" : "s"} from your renewal plan` },
    });

    return NextResponse.json({ success: true, created: created?.length || 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create tasks";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
