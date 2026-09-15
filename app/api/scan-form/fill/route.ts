import { createClient } from "@supabase/supabase-js";
import { getAuthedUser } from "@/lib/require-user";
import { fillPdfForm, buildCompletedPdf, type FillableField } from "@/lib/pdf-form";
import { PDFDocument } from "pdf-lib";
import { NextRequest, NextResponse } from "next/server";

// Walking the model chain can take a while when Google is throttling.
export const maxDuration = 120;

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

    const { base64, formName, fields, mimeType } = await request.json();

    if (!base64 || !Array.isArray(fields)) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const bytes = Buffer.from(base64, "base64");
    const isPdf = (mimeType || "application/pdf") === "application/pdf";

    let pdfDoc: PDFDocument | null = null;
    if (isPdf) {
      try {
        pdfDoc = await PDFDocument.load(bytes);
      } catch {
        return NextResponse.json({ error: "This file isn't a readable PDF" }, { status: 400 });
      }
    }

    const hasFormFields = Boolean(pdfDoc && pdfDoc.getForm().getFields().length > 0);
    let filledBytes: Uint8Array;
    let filledFieldCount = 0;
    let mode: "fields" | "summary";

    if (pdfDoc && hasFormFields) {
      filledFieldCount = fillPdfForm(pdfDoc, fields as FillableField[]);
      filledBytes = await pdfDoc.save();
      mode = "fields";
    } else {
      // No digital fields to write into: ship the original plus an answers page.
      const summary = (fields as Array<FillableField & { label?: string }>).map((f) => ({
        label: f.label || f.pdf_field_name || "Field",
        value: f.value,
      }));
      filledFieldCount = summary.filter((f) => f.value).length;
      filledBytes = await buildCompletedPdf({ bytes, mimeType: mimeType || "application/pdf" }, formName || "Form", summary);
      mode = "summary";
    }

    await supabase.from("activity_log").insert({
      user_id: authedUser.id,
      action: "scan",
      details: {
        message: `You approved and exported ${formName || "a form"} with ${filledFieldCount} field${filledFieldCount === 1 ? "" : "s"} filled`,
      },
    });

    return NextResponse.json({
      filled_pdf_base64: Buffer.from(filledBytes).toString("base64"),
      filled_field_count: filledFieldCount,
      mode,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fill the form";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
