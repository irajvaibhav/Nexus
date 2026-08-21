import { createClient } from "@supabase/supabase-js";
import { analyzeForm } from "@/lib/gemini";
import { getAuthedUser } from "@/lib/require-user";
import { PDFDocument, PDFTextField, PDFCheckBox, PDFRadioGroup, PDFDropdown } from "pdf-lib";
import { NextRequest, NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ScannedField = {
  field_label: string;
  value: string | null;
  source: string | null;
  found: boolean;
  pdf_field_name?: string | null;
};

function fillPdfForm(pdfDoc: PDFDocument, fields: ScannedField[]): number {
  const form = pdfDoc.getForm();
  let filledCount = 0;

  for (const item of fields) {
    if (!item.found || !item.value || !item.pdf_field_name) continue;

    try {
      const field = form.getField(item.pdf_field_name);

      if (field instanceof PDFTextField) {
        field.setText(item.value);
        filledCount++;
      } else if (field instanceof PDFCheckBox) {
        const truthy = /^(yes|true|checked|y)$/i.test(item.value.trim());
        if (truthy) field.check();
        filledCount++;
      } else if (field instanceof PDFRadioGroup || field instanceof PDFDropdown) {
        field.select(item.value);
        filledCount++;
      }
    } catch {
      // Field couldn't be filled (name mismatch, invalid option, etc.) - skip it,
      // it'll still show in the review list for the user to fill manually.
    }
  }

  return filledCount;
}

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

    let filledPdfBase64: string | null = null;
    let hasFillableFields = false;
    let filledFieldCount = 0;

    if (pdfDoc && pdfFieldNames.length > 0) {
      hasFillableFields = true;
      filledFieldCount = fillPdfForm(pdfDoc, result.fields || []);
      const filledBytes = await pdfDoc.save();
      filledPdfBase64 = Buffer.from(filledBytes).toString("base64");
    }

    await supabase.from("activity_log").insert({
      user_id: userId,
      action: "scan",
      details: {
        message: hasFillableFields
          ? `NEXUS scanned and auto-filled ${filledFieldCount} field${filledFieldCount === 1 ? "" : "s"} on ${result.form_name || "a form"}`
          : `NEXUS scanned a form (${result.form_name || "form"})`,
      },
    });

    return NextResponse.json({
      ...result,
      has_fillable_fields: hasFillableFields,
      filled_field_count: filledFieldCount,
      filled_pdf_base64: filledPdfBase64,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scan failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
