import { createClient } from "@supabase/supabase-js";
import { analyzeForm } from "@/lib/gemini";
import { getAuthedUser } from "@/lib/require-user";
import { PDFDocument } from "pdf-lib";
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

    const { base64, mimeType } = await request.json();

    if (!base64 || !mimeType) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const [{ data: fields }, { data: docs }] = await Promise.all([
      supabase
        .from("document_fields")
        .select("document_id, field_name, field_value")
        .eq("user_id", userId),
      supabase.from("documents").select("id, file_name").eq("user_id", userId),
    ]);

    const docMap = new Map(
      (docs || []).map((d: { id: string; file_name: string }) => [d.id, d.file_name])
    );

    const knownInfo = (fields || [])
      .map((f: { document_id: string; field_name: string; field_value: string }) =>
        `- ${f.field_name}: ${f.field_value} (source: ${docMap.get(f.document_id) || "Unknown"})`
      )
      .join("\n");

    let pdfDoc: PDFDocument | null = null;
    let pdfFieldNames: string[] = [];

    if (mimeType === "application/pdf") {
      try {
        pdfDoc = await PDFDocument.load(Buffer.from(base64, "base64"));
        pdfFieldNames = pdfDoc.getForm().getFields().map((f) => f.getName());
      } catch {
        pdfDoc = null;
      }
    }

    const result = await analyzeForm(
      base64,
      mimeType,
      knownInfo,
      pdfFieldNames.length > 0 ? pdfFieldNames : undefined
    );

    const hasFillableFields = Boolean(pdfDoc && pdfFieldNames.length > 0);
    const foundCount = (result.fields || []).filter((f: { found: boolean }) => f.found).length;

    await supabase.from("activity_log").insert({
      user_id: userId,
      action: "scan",
      details: {
        message: `NEXUS read ${result.form_name || "a form"} and found ${foundCount} of ${(result.fields || []).length} answers in your documents`,
      },
    });

    return NextResponse.json({
      ...result,
      has_fillable_fields: hasFillableFields,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scan failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
