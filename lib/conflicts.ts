export type FieldRow = { document_id: string; field_name: string; field_value: string };
export type ConflictEntry = { value: string; document_id: string };
export type ConflictGroup = { label: string; entries: ConflictEntry[] };

const CONFLICT_FIELD_PATTERNS: { label: string; include: RegExp; exclude?: RegExp }[] = [
  {
    label: "Name",
    include: /name/i,
    exclude: /(father|mother|company|bank|insurer|employer|organi[sz]ation|nominee|witness|reporting)/i,
  },
  { label: "Date of Birth", include: /(date of birth|\bdob\b|\bborn\b)/i },
];

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function tokens(value: string): Set<string> {
  return new Set(value.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2));
}

function sharesToken(a: string, b: string): boolean {
  const tokensA = tokens(a);
  for (const t of tokens(b)) {
    if (tokensA.has(t)) return true;
  }
  return false;
}

// Groups distinct values into clusters where every value shares at least one
// token with some other value in the cluster - e.g. "Aman Mehra" and "Aman K
// Mehra" cluster together, but "Aman Mehra" and "Raj Vaibhav" (a different
// person's document entirely) do not, and are never reported as conflicting.
function clusterByToken(distinctValues: string[]): string[][] {
  const parent = new Map(distinctValues.map((v) => [v, v]));
  function find(v: string): string {
    while (parent.get(v) !== v) v = parent.get(v)!;
    return v;
  }
  function union(a: string, b: string) {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }

  for (let i = 0; i < distinctValues.length; i++) {
    for (let j = i + 1; j < distinctValues.length; j++) {
      if (sharesToken(distinctValues[i], distinctValues[j])) {
        union(distinctValues[i], distinctValues[j]);
      }
    }
  }

  const clusters = new Map<string, string[]>();
  for (const v of distinctValues) {
    const root = find(v);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root)!.push(v);
  }
  return [...clusters.values()];
}

export function detectConflicts(fields: FieldRow[]): ConflictGroup[] {
  const groups: ConflictGroup[] = [];

  for (const pattern of CONFLICT_FIELD_PATTERNS) {
    const matching = fields.filter(
      (f) => pattern.include.test(f.field_name) && !pattern.exclude?.test(f.field_name)
    );

    const byNormalizedValue = new Map<string, FieldRow[]>();
    for (const f of matching) {
      const key = normalize(f.field_value);
      if (!key) continue;
      if (!byNormalizedValue.has(key)) byNormalizedValue.set(key, []);
      byNormalizedValue.get(key)!.push(f);
    }

    const clusters = clusterByToken([...byNormalizedValue.keys()]);

    for (const cluster of clusters) {
      if (cluster.length <= 1) continue;
      const entries = cluster.map((key) => {
        const row = byNormalizedValue.get(key)![0];
        return { value: row.field_value, document_id: row.document_id };
      });
      groups.push({ label: pattern.label, entries });
    }
  }

  return groups;
}

export function questionTargetsConflictLabel(question: string): string | null {
  const lower = question.toLowerCase();
  if (/(date of birth|\bdob\b|\bborn\b)/.test(lower)) return "Date of Birth";
  if (/\bname\b/.test(lower)) return "Name";
  return null;
}
