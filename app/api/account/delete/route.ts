import { createClient } from "@supabase/supabase-js";
import { getAuthedUser } from "@/lib/require-user";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  try {
    const authedUser = await getAuthedUser();
    if (!authedUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = authedUser.id;

    const { data: docs } = await supabase
      .from("documents")
      .select("file_path")
      .eq("user_id", userId);

    const filePaths = (docs || []).map((d: { file_path: string }) => d.file_path);
    if (filePaths.length > 0) {
      await supabase.storage.from("Documents").remove(filePaths);
    }

    // Deleting documents cascades to document_fields, document_chunks,
    // deadlines, and entity_documents (all ON DELETE CASCADE).
    await supabase.from("documents").delete().eq("user_id", userId);

    await Promise.all([
      supabase.from("entities").delete().eq("user_id", userId),
      supabase.from("custom_categories").delete().eq("user_id", userId),
      supabase.from("activity_log").delete().eq("user_id", userId),
      supabase.from("chat_messages").delete().eq("user_id", userId),
      supabase.from("tasks").delete().eq("user_id", userId),
    ]);

    await supabase.from("profiles").delete().eq("id", userId);

    await supabase.auth.admin.deleteUser(userId);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Account deletion failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
