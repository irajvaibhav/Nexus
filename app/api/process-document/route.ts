import { createClient } from "@supabase/supabase-js";
import { extractDocumentInfo, generateEmbedding } from "@/lib/gemini";
import { BUILT_IN_CATEGORIES } from "@/lib/categories";
import { getAuthedUser } from "@/lib/require-user";
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

    const { data: fileData } = await supabase.storage
      .from("Documents")
      .download(doc.file_path);

    if (!fileData) {
      return NextResponse.json({ error: "File not found in storage" }, { status: 404 });
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

    const extracted = await extractDocumentInfo(base64, doc.file_type, categoryOptions);

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
      }) => ({
        document_id: documentId,
        user_id: userId,
        field_name: f.field_name,
        field_value: f.field_value,
        page_number: f.page_number || 1,
        confidence: 0.95,
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

    const fieldsText = extracted.fields
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

    return NextResponse.json({
      success: true,
      doc_type: extracted.doc_type,
      doc_category: extracted.doc_category || null,
      fields_count: extracted.fields?.length || 0,
      deadlines_count: extracted.deadlines?.length || 0,
      entities_count: extracted.entities?.length || 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}