// Matches "doc"/"docs" (common shorthand), "document"/"documents", and "papers"
// (common in Indian English, e.g. "car papers").
const DOC_WORD = "(?:docs?|documents?|papers?)";

const CHECKLIST_PATTERNS = [
  new RegExp(`what ${DOC_WORD}.*(need|require)`, "i"),
  new RegExp(`${DOC_WORD}.*(needed|required) for`, "i"),
  /am i missing/i,
  /do i have everything/i,
  new RegExp(`what (all )?${DOC_WORD}.*for (my|a|an)`, "i"),
  new RegExp(`${DOC_WORD}\\s?checklist`, "i"),
];

export function isDocumentChecklistQuestion(question: string): boolean {
  return CHECKLIST_PATTERNS.some((p) => p.test(question));
}
