import { PDFDocument, PDFTextField, PDFCheckBox, PDFRadioGroup, PDFDropdown, StandardFonts, rgb } from "pdf-lib";

export type FillableField = {
  value: string | null;
  found: boolean;
  pdf_field_name?: string | null;
};

export function fillPdfForm(pdfDoc: PDFDocument, fields: FillableField[]): number {
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


export type SummaryField = { label: string; value: string | null };

// Forms without digital fields (photos, flat PDFs) still deserve a file the
// user can send on: the original as page one, then a clean page of the
// answers in the form's order.
export async function buildCompletedPdf(
  source: { bytes: Uint8Array; mimeType: string },
  formName: string,
  fields: SummaryField[]
): Promise<Uint8Array> {
  let out: PDFDocument;

  if (source.mimeType === "application/pdf") {
    out = await PDFDocument.load(source.bytes);
  } else {
    out = await PDFDocument.create();
    const image = source.mimeType === "image/png" ? await out.embedPng(source.bytes) : await out.embedJpg(source.bytes);
    const page = out.addPage([595, 842]);
    const scale = Math.min(555 / image.width, 802 / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    page.drawImage(image, { x: (595 - w) / 2, y: (842 - h) / 2, width: w, height: h });
  }

  const font = await out.embedFont(StandardFonts.Helvetica);
  const bold = await out.embedFont(StandardFonts.HelveticaBold);
  const filled = fields.filter((f) => f.value && f.value.trim());
  const blank = fields.filter((f) => !f.value || !f.value.trim());

  let page = out.addPage([595, 842]);
  let y = 790;
  const left = 48;
  const line = (text: string, size: number, f = font, color = rgb(0.06, 0.09, 0.16)) => {
    if (y < 60) {
      page = out.addPage([595, 842]);
      y = 790;
    }
    page.drawText(text, { x: left, y, size, font: f, color });
    y -= size + 8;
  };

  line("Completed details", 20, bold);
  line(formName, 12, font, rgb(0.39, 0.45, 0.55));
  line(`Prepared with NEXUS on ${new Date().toLocaleDateString()}`, 9, font, rgb(0.58, 0.64, 0.72));
  y -= 10;

  for (const f of filled) {
    line(f.label, 9, bold, rgb(0.39, 0.45, 0.55));
    // wrap long values
    const words = (f.value || "").split(/\s+/);
    let row = "";
    for (const w of words) {
      const test = row ? `${row} ${w}` : w;
      if (font.widthOfTextAtSize(test, 12) > 499) {
        line(row, 12);
        row = w;
      } else row = test;
    }
    if (row) line(row, 12);
    y -= 4;
  }

  if (blank.length > 0) {
    y -= 8;
    line("Still to fill in by hand", 11, bold, rgb(0.72, 0.33, 0.05));
    for (const f of blank) line(`• ${f.label}`, 11, font, rgb(0.39, 0.45, 0.55));
  }

  return out.save();
}
