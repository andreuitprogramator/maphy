export type RubricLineInput = {
  title: string;
  description: string;
  points: number;
  orderIndex: number;
};

/** Flattens structured rubric into the legacy `gradingRubric` text field for the AI grader. */
export function rubricItemsToGradingRubricText(items: RubricLineInput[]): string {
  const sorted = [...items].sort((a, b) => a.orderIndex - b.orderIndex);
  if (sorted.length === 0) return "";
  const lines = sorted.map((item, i) => {
    const n = i + 1;
    return [
      `Section ${n}: ${item.title.trim()} — max ${item.points} points`,
      `Expected evidence / criteria:`,
      item.description.trim(),
    ].join("\n");
  });
  return [`Rubric (max 100 total) — apply all sections:`, "", ...lines].join("\n\n");
}

export function rubricPointsTotal(items: Pick<RubricLineInput, "points">[]): number {
  return items.reduce((s, r) => s + r.points, 0);
}

export type RubricSectionSpec = {
  label: string;
  maxPoints: number;
};

/**
 * Extrage secțiunile fixe ale baremului din textul furnizat de profesor.
 * Returnează null dacă textul nu are o structură recunoscută (e.g. placeholder imagini).
 *
 * Formate suportate:
 *   1. Structurat: "Section N: {label} — max {X} points"  (din rubricItemsToGradingRubricText)
 *   2. Sub-puncte: linii care încep cu "a)", "b)", "a.", "B)", etc.
 */
export function parseRubricSections(rubricText: string): RubricSectionSpec[] | null {
  if (!rubricText?.trim() || rubricText.length < 10) return null;

  // Nu parseazăm placeholder-uri pentru bareme din imagini
  if (
    rubricText.includes("imaginile atașate") ||
    rubricText.includes("PROBLEM_RUBRIC") ||
    rubricText.includes("input_image")
  ) {
    return null;
  }

  const sections: RubricSectionSpec[] = [];

  // Format 1: "Section N: {label} — max {X} points"
  const re1 = /^Section\s+\d+:\s+(.+?)\s+[—\-–]+\s+max\s+([\d.,]+)\s+points/gim;
  let m: RegExpExecArray | null;
  while ((m = re1.exec(rubricText)) !== null) {
    const pts = parseFloat(m[2]!.replace(",", "."));
    if (Number.isFinite(pts) && pts >= 0) {
      sections.push({ label: m[1]!.trim(), maxPoints: pts });
    }
  }
  if (sections.length >= 1) return sections;

  // Format 2: linii care încep cu o literă de sub-punct (a), b), a., b., A), B), etc.)
  for (const line of rubricText.split("\n")) {
    const m2 = line.match(/^\s*([a-eA-E][\)\.:])\s*(.*)/);
    if (!m2) continue;
    const label = m2[1]!.trim();
    const context = m2[2]! + " " + line;
    const ptsMatch = context.match(/(\d+(?:[.,]\d+)?)\s*(?:p(?:uncte)?\.?|pts?\.?|points?)/i);
    const pts = ptsMatch ? parseFloat(ptsMatch[1]!.replace(",", ".")) : 0;
    sections.push({ label, maxPoints: pts });
  }
  if (sections.length >= 1) return sections;

  return null;
}
