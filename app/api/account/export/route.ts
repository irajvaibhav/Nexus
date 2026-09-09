import { createClient } from "@supabase/supabase-js";
import { getAuthedUser } from "@/lib/require-user";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const USER_TABLES = [
  "documents",
  "document_fields",
  "deadlines",
  "tasks",
  "chat_messages",
  "activity_log",
  "custom_categories",
  "entities",
] as const;

export async function POST() {
  try {
    const authedUser = await getAuthedUser();
    if (!authedUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = authedUser.id;

    const [{ data: profile }, ...tableResults] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      ...USER_TABLES.map((table) => supabase.from(table).select("*").eq("user_id", userId)),
    ]);

    const tables: Record<string, unknown[]> = {};
    USER_TABLES.forEach((table, i) => {
      tables[table] = tableResults[i].data || [];
    });

    return NextResponse.json({
      exported_at: new Date().toISOString(),
      account: { id: userId, email: authedUser.email },
      profile: profile || null,
      ...tables,
      note: "Document files themselves are not included — download those individually from the Documents page. Search embeddings are omitted because they are derived data.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
