import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const flashModel = genAI.getGenerativeModel({
  model: "gemini-3.5-flash",
});

export async function extractDocumentInfo(
  base64Data: string,
  mimeType: string,
  categoryOptions: string[] = ["Essential Docs", "Bank Docs", "Vehicle", "Non Essential Docs"]
) {
  const prompt = `You are a document analysis AI. Analyze this document and return a JSON response.

Respond ONLY with valid JSON, no markdown, no backticks, no explanation.

{
  "doc_type": "one of: passport, pan_card, driving_licence, vehicle_rc, vehicle_insurance, puc_certificate, bank_statement, aadhaar, voter_id, birth_certificate, education_certificate, other",
  "doc_category": "one of: ${categoryOptions.join(", ")}",
  "fields": [
    {
      "field_name": "Name on document",
      "field_value": "extracted value",
      "page_number": 1,
      "confidence": 0.95
    }
  ],
  "deadlines": [
    {
      "title": "what is expiring",
      "expiry_date": "YYYY-MM-DD"
    }
  ],
  "entities": [
    {
      "name": "entity name (e.g., person name, vehicle model)",
      "entity_type": "one of: Person, Vehicle, Property, Organization, Other"
    }
  ],
  "full_text": "Extract ALL readable text from the document as-is",
  "summary": "One line summary of the document"
}

Rules:
- Extract ALL important fields (name, number, date, address, expiry, etc.)
- For dates, use YYYY-MM-DD format
- If a field is not readable, skip it
- confidence: how certain you are that this value is both correctly read and correctly labelled, from 0 to 1. Use 0.9+ only when the text is crisp and the label is unambiguous. Use 0.5-0.8 when the scan is imperfect, the handwriting is unclear, or you inferred which label the value belongs to. Use below 0.5 when you are genuinely unsure. Report your real certainty - a wrong value reported confidently is far worse than an uncertain one flagged honestly.
- deadlines array should only contain actual expiry/renewal dates printed on the document. If the document shows no expiry or renewal date, return an empty deadlines array - never estimate or infer one.
- entities: identify people, vehicles, organizations mentioned in the document
- full_text: extract complete readable text from the document for search
- Be accurate, never guess values

doc_category MUST be exactly one of these values: ${categoryOptions.join(", ")}

Guidance for the default categories, where present in that list:
- "Essential Docs": passport, aadhaar, voter id, driving licence, birth certificate, and other core identity documents
- "Bank Docs": PAN card, bank statements, and other finance/tax-related documents
- "Vehicle": vehicle RC, vehicle insurance, PUC certificate, and other vehicle-related documents
- "Non Essential Docs": education certificates and anything that doesn't clearly fit any other category

Any other values in the list are custom categories the user created themselves. If the document clearly matches one of those better than the defaults above, use it instead. Never invent a category name that isn't in the list.`;

  const result = await flashModel.generateContent([
    { text: prompt },
    {
      inlineData: {
        mimeType,
        data: base64Data,
      },
    },
  ]);

  const text = result.response.text();
  const cleaned = text.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

export async function analyzeForm(
  base64Data: string,
  mimeType: string,
  knownInfo: string,
  pdfFieldNames?: string[]
) {
  const pdfFieldSection = pdfFieldNames && pdfFieldNames.length > 0
    ? `\n\nThis PDF also has real fillable form fields with these exact internal names:\n${pdfFieldNames.map((n) => `- ${n}`).join("\n")}\n\nFor each field you detect visually, if it corresponds to one of these internal names, set "pdf_field_name" to that EXACT name (copy it exactly, case-sensitive). If a detected field doesn't correspond to any internal name (or you're unsure), set "pdf_field_name" to null. Not every internal name will have a visible label, and not every visible field will have a matching internal name - that's expected.`
    : "";

  const prompt = `You are a form-filling assistant. Look at the attached form (image or PDF) and identify every fillable field or question in it.

For each field, try to answer it using ONLY the information listed below, which was extracted from the user's own documents.

KNOWN INFORMATION FROM USER'S DOCUMENTS:
${knownInfo || "(none available)"}

Rules:
- A field counts as answered only if the KNOWN INFORMATION clearly contains that value, even if worded differently (e.g. a form field "PAN Card No." matches known info "PAN Number").
- If a field's value is not clearly present in KNOWN INFORMATION, set "found" to false and "value" to null. NEVER guess, infer, or make up a value.
- For a field you couldn't find, also set "likely_source_type" to the kind of document that would typically contain that information (e.g. "PAN Card", "Aadhaar Card", "Bank Statement", "Passport", "Address Proof"), based on general knowledge - not on the user's actual documents. If you genuinely have no idea what kind of document would hold it, set it to null.
- Do not skip fields just because they're unanswered - list every field you see on the form.
- Keep field_label exactly as it appears on the form (or a close paraphrase if handwriting/OCR is unclear).
- confidence: how certain you are that this known value is the correct answer for this form field, from 0 to 1. Use 0.9+ when the form's label and the known information clearly refer to the same thing. Use 0.5-0.8 when you matched on meaning rather than wording, or when more than one known value could plausibly fit. Set it to 0 whenever "found" is false. The user reviews low-confidence fields before exporting, so report your real certainty.${pdfFieldSection}

Respond ONLY with valid JSON, no markdown, no backticks, no explanation:

{
  "form_name": "short description of what this form is",
  "fields": [
    {
      "field_label": "label as written on the form",
      "value": "the answer, or null if not found",
      "source": "file name it came from, or null if not found",
      "found": true,
      "confidence": 0.95,
      "pdf_field_name": "exact internal PDF field name if applicable, else null",
      "likely_source_type": "document type that would typically have this, only when found is false, else null"
    }
  ]
}`;

  const result = await flashModel.generateContent([
    { text: prompt },
    {
      inlineData: {
        mimeType,
        data: base64Data,
      },
    },
  ]);

  const text = result.response.text();
  const cleaned = text.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

export async function generateAgentPlan(obligationsText: string, todayLabel: string) {
  const prompt = `You are NEXUS, an AI life-administration agent. The user asked you to take care of their upcoming renewals/obligations.

Below is the full list of their active obligations, with any known context (linked document fields, weather forecast for the relevant period). Today's date is ${todayLabel}.

OBLIGATIONS:
${obligationsText || "(none)"}

Build a prioritized action plan. For each obligation:
- Write a short, concrete task title (what the user should actually do, e.g. "Renew PUC certificate at nearest testing centre", not just "PUC expiring")
- Give one or two sentences of reasoning grounded ONLY in the facts given above (urgency, weather, known document details). Never invent facts, weather, or details not present in the input.
- If a suggested date is given in the input (e.g. from a weather forecast), use it in "suggested_date" (YYYY-MM-DD). Otherwise set it to null.
- Assign a priority: obligations expiring sooner get higher priority (1 = most urgent).

Respond ONLY with valid JSON, no markdown, no backticks, no explanation:

{
  "plan": [
    {
      "deadline_id": "id from the input",
      "priority": 1,
      "task_title": "concrete action to take",
      "reasoning": "why, grounded only in the given facts",
      "suggested_date": "YYYY-MM-DD or null"
    }
  ]
}`;

  const result = await flashModel.generateContent(prompt);
  const text = result.response.text();
  const cleaned = text.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

export async function generateDocumentChecklist(question: string, existingDocsText: string) {
  const prompt = `You are NEXUS, an AI document assistant. The user is asking what documents they need for a specific task or purpose.

USER QUESTION: ${question}

THE USER'S EXISTING DOCUMENTS (their real uploaded documents):
${existingDocsText || "(none uploaded yet)"}

Instructions:
1. First, identify what task or purpose the user is asking about. If the question does not describe a recognizable task (e.g. it's unrelated to document requirements), say so plainly and do not invent a checklist.
2. If it is a recognizable task, list the documents TYPICALLY required for it, based on general knowledge (assume India unless the question implies otherwise). Make clear this is general/typical guidance and exact requirements can vary by the specific bank, authority, or provider.
3. Compare that typical list against the user's existing documents listed above. For each typically-required item, mark it as already available (naming the actual file) or missing. Only mark something as available if it is genuinely present in the list above — never assume the user has a document they haven't uploaded.
4. Keep it concise and scannable.

Respond ONLY with valid JSON, no markdown, no backticks, no explanation:

{
  "answer": "the full plain-text answer for the user: a short intro sentence, then a checklist with a checkmark (✓) for documents the user has and a cross (✗) for ones that appear missing. No markdown formatting like ** or # inside this text.",
  "matched_files": ["exact file name from the list above, only for files you actually cited as satisfying a requirement"]
}`;

  const result = await flashModel.generateContent(prompt);
  const text = result.response.text();
  const cleaned = text.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: { parts: [{ text }] },
        outputDimensionality: 768,
      }),
    }
  );

  const data = await res.json();

  if (data.error) {
    throw new Error(data.error.message);
  }

  return data.embedding.values;
}