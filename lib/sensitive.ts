const SENSITIVE_FIELD_PATTERN =
  /(aadhaar|aadhar|\bpan\b|passport|account\s*(no|number)?|card\s*(no|number)|\bcvv\b|\bifsc\b|licen[cs]e\s*(no|number)|voter\s*id|\buan\b|gstin|tax\s*id)/i;

// Value shapes worth hiding on sight: Aadhaar, PAN, Indian passport, and any
// long unbroken account-style digit run.
const SENSITIVE_VALUE_PATTERN =
  /\b(\d{4}\s\d{4}\s\d{4}|[A-Z]{5}\d{4}[A-Z]|[A-Z]\d{7}|\d{9,18})\b/g;

export function isSensitiveField(fieldName: string): boolean {
  return SENSITIVE_FIELD_PATTERN.test(fieldName);
}

export function maskValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 4) return "•".repeat(Math.max(trimmed.length, 1));
  return trimmed.slice(0, -4).replace(/\S/g, "•") + trimmed.slice(-4);
}

export type TextSegment = { text: string; sensitive: boolean };

export function splitSensitive(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(SENSITIVE_VALUE_PATTERN)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      segments.push({ text: text.slice(lastIndex, start), sensitive: false });
    }
    segments.push({ text: match[0], sensitive: true });
    lastIndex = start + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), sensitive: false });
  }

  return segments;
}
