import { createClient } from "@supabase/supabase-js";
import { extractDocumentInfo, generateEmbedding } from "@/lib/gemini";
import { BUILT_IN_CATEGORIES } from "@/lib/categories";
import { getAuthedUser } from "@/lib/require-user";
import { NextRequest, NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// A missing score means the model didn't tell us how sure it was, so fall to the
// review side of the threshold rather than assuming the value is trustworthy.
function normalizeConfidence(value: unknown): number {
  const score = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(score)) return 0.5;
  return Math.min(1, Math.max(0, score));
}

type Stage = "scanning" | "extracting" | "analysing" | "indexing" | "ready" | "failed";

// Processing takes long enough that a single silent request reads as "stuck",
// so the route streams one JSON line per stage and the client renders them.
export async function POST(request: NextRequest) {
  const authedUser = await getAuthedUser();
  if (!authedUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = authedUser.id;

  const { documentId } = await request.json();
  if (!documentId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const { data: doc } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .eq("user_id", userId)
    .single();

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: { stage: Stage } & Record<string, unknown>) => {
        controller.enqueue(encoder.encode(JSON.stringify(payload) + "\n"));
      };

      try {
        send({ stage: "scanning" });

        // Re-running (after a failure, or a retry) must not double up what a
        // previous attempt already wrote.
        await Promise.all([
          supabase.from("document_fields").delete().eq("document_id", documentId),
          supabase.from("deadlines").delete().eq("document_id", documentId),
          supabase.from("document_chunks").delete().eq("document_id", documentId),
          supabase.from("entity_documents").delete().eq("document_id", documentId),
          supabase.from("documents").update({ status: "processing" }).eq("id", documentId),
        ]);

        const { data: fileData } = await supabase.storage
          .from("Documents")
          .download(doc.file_path);

        if (!fileData) {
          throw new Error("The uploaded file couldn't be found in storage. Try uploading it again.");
        }

        const buffer = Buffer.from(await fileData.arrayBuffer());
        const base64 = buffer.toString("base64");

        const { data: customCategories } = await supabase
          .from("custom_categories")
          .select("name")
          .eq("user_id", userId);

        const categoryOptions = [
          ...BUILT_IN_CATEGORIES.map((c) => c.name),
          ...(customCategories || []).map((c) => c.name),
        ];

        send({ stage: "extracting" });
        const extracted = await extractDocumentInfo(base64, doc.file_type, categoryOptions);

        send({ stage: "analysing" });
        await supabase
          .from("documents")
          .update({
            doc_type: extracted.doc_type,
            doc_category: extracted.doc_category || null,
            status: "processed",
          })
          .eq("id", documentId);

        if (extracted.fields && extracted.fields.length > 0) {
          const fieldRows = extracted.fields.map((f: {
            field_name: string;
            field_value: string;
            page_number?: number;
            confidence?: number;
          }) => ({
            document_id: documentId,
            user_id: userId,
            field_name: f.field_name,
            field_value: f.field_value,
            page_number: f.page_number || 1,
            confidence: normalizeConfidence(f.confidence),
          }));

          await supabase.from("document_fields").insert(fieldRows);
        }

        if (extracted.deadlines && extracted.deadlines.length > 0) {
          const deadlineRows = extracted.deadlines.map((d: {
            title: string;
            expiry_date: string;
          }) => ({
            user_id: userId,
            document_id: documentId,
            title: d.title,
            expiry_date: d.expiry_date,
            status: "active",
          }));

          await supabase.from("deadlines").insert(deadlineRows);
        }

        if (extracted.entities && extracted.entities.length > 0) {
          for (const e of extracted.entities as { name: string; entity_type: string }[]) {
            const { data: existing } = await supabase
              .from("entities")
              .select("id")
              .eq("user_id", userId)
              .eq("name", e.name)
              .eq("entity_type", e.entity_type)
              .maybeSingle();

            let entityId = existing?.id;

            if (!entityId) {
              const { data: newEntity } = await supabase
                .from("entities")
                .insert({
                  user_id: userId,
                  name: e.name,
                  entity_type: e.entity_type,
                })
                .select("id")
                .single();
              entityId = newEntity?.id;
            }

            if (entityId) {
              await supabase.from("entity_documents").insert({
                entity_id: entityId,
                document_id: documentId,
                user_id: userId,
              }).select();
            }
          }
        }

        send({ stage: "indexing" });
        const fieldsText = (extracted.fields || [])
          .map((f: { field_name: string; field_value: string }) =>
            `${f.field_name}: ${f.field_value}`
          )
          .join("\n");

        const fullText = extracted.full_text
          ? `${extracted.doc_type}\n${extracted.summary}\n${fieldsText}\n\n${extracted.full_text}`
          : `${extracted.doc_type}\n${extracted.summary}\n${fieldsText}`;

        const embedding = await generateEmbedding(fullText);

        await supabase.from("document_chunks").insert({
          document_id: documentId,
          user_id: userId,
          chunk_text: fullText,
          embedding: JSON.stringify(embedding),
          page_number: 1,
          doc_category: extracted.doc_category || null,
        });

        await supabase.from("activity_log").insert({
          user_id: userId,
          action: "process",
          details: {
            message: `NEXUS extracted information from ${doc.file_name}`,
            document_id: documentId,
          },
        });

        let duplicateOf: { id: string; file_name: string; uploaded_at: string } | null = null;
        if (extracted.doc_type && extracted.doc_type !== "other") {
          const { data: existing } = await supabase
            .from("documents")
            .select("id, file_name, uploaded_at")
            .eq("user_id", userId)
            .eq("doc_type", extracted.doc_type)
            .neq("id", documentId)
            .order("uploaded_at", { ascending: false })
            .limit(1);
          duplicateOf = existing?.[0] || null;
        }

        send({
          stage: "ready",
          doc_type: extracted.doc_type,
          doc_category: extracted.doc_category || null,
          fields_count: extracted.fields?.length || 0,
          deadlines_count: extracted.deadlines?.length || 0,
          entities_count: extracted.entities?.length || 0,
          duplicate_of: duplicateOf,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Processing failed";
        // Leaving the row as "processing" would show "Reading…" forever.
        await supabase.from("documents").update({ status: "failed" }).eq("id", documentId);
        send({ stage: "failed", error: message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
