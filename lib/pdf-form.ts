import { PDFDocument, PDFTextField, PDFCheckBox, PDFRadioGroup, PDFDropdown } from "pdf-lib";

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
