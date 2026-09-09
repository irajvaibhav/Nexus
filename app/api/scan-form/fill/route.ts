import { createClient } from "@supabase/supabase-js";
import { getAuthedUser } from "@/lib/require-user";
import { fillPdfForm, type FillableField } from "@/lib/pdf-form";
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

    const { base64, formName, fields } = await request.json();

    if (!base64 || !Array.isArray(fields)) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    let pdfDoc: PDFDocument;
    try {
      pdfDoc = await PDFDocument.load(Buffer.from(base64, "base64"));
    } catch {
      return NextResponse.json({ error: "This file isn't a readable PDF" }, { status: 400 });
    }

    const filledFieldCount = fillPdfForm(pdfDoc, fields as FillableField[]);
    const filledBytes = await pdfDoc.save();

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
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fill the form";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
