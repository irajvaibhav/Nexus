import type { SupabaseClient } from "@supabase/supabase-js";

// Removing only the documents row leaves its reminders and extracted fields
// behind, so a deleted document keeps surfacing as an active deadline. Clearing
// dependents first is safe whether or not the schema cascades. Tasks survive on
// purpose - "Renew PUC" is still worth doing once the old PUC is gone - so they
// only lose the link.
export async function deleteDocumentCascade(
  supabase: SupabaseClient,
  doc: { id: string; file_path: string }
) {
  await supabase.storage.from("Documents").remove([doc.file_path]);

  await Promise.all([
    supabase.from("deadlines").delete().eq("document_id", doc.id),
    supabase.from("document_fields").delete().eq("document_id", doc.id),
    supabase.from("document_chunks").delete().eq("document_id", doc.id),
    supabase.from("entity_documents").delete().eq("document_id", doc.id),
    supabase.from("tasks").update({ document_id: null }).eq("document_id", doc.id),
  ]);

  await supabase.from("documents").delete().eq("id", doc.id);
}
