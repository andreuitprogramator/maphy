export type FeedbackBreakdownShape = {
  rubric_breakdown?: Array<{ label: string; points: number; maxPoints: number; notes?: string }>;
  detected_strengths?: string[];
  detected_mistakes?: string[];
};

export function parseFeedbackBreakdown(raw: unknown): FeedbackBreakdownShape | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    rubric_breakdown: Array.isArray(o.rubric_breakdown)
      ? (o.rubric_breakdown as FeedbackBreakdownShape["rubric_breakdown"])
      : [],
    detected_strengths: Array.isArray(o.detected_strengths)
      ? (o.detected_strengths as string[])
      : [],
    detected_mistakes: Array.isArray(o.detected_mistakes) ? (o.detected_mistakes as string[]) : [],
  };
}
