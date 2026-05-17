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
