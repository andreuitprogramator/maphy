/**
 * Client-safe list (no @prisma/client). Values must match enum `AiTeacherStyle` in schema.
 */
export const AI_TEACHER_STYLE_OPTIONS = [
  {
    value: "STRICT_OLYMPIAD_JUDGE",
    label: "Strict Olympiad Judge",
    shortDescription: "Minimal praise, rubric-first, concise corrections.",
  },
  {
    value: "SUPPORTIVE_TEACHER",
    label: "Supportive Teacher",
    shortDescription: "Encouraging tone and gentle explanations.",
  },
  {
    value: "DETAILED_TUTOR",
    label: "Detailed Tutor",
    shortDescription: "Thorough, step-by-step reasoning and extra clarification.",
  },
  {
    value: "FUNNY_LIGHTHEARTED",
    label: "Funny / Lighthearted",
    shortDescription: "Playful, humorous tone while staying mathematically correct.",
  },
  {
    value: "EDUCATIONAL_MENTOR",
    label: "Educational Mentor",
    shortDescription: "Concepts, intuition, and why the ideas work.",
  },
  {
    value: "COMPETITION_COACH",
    label: "Competition Coach",
    shortDescription: "Strategy, olympiad mindset, and alternative approaches.",
  },
] as const;

export type AiTeacherStyleValue = (typeof AI_TEACHER_STYLE_OPTIONS)[number]["value"];

export function isAiTeacherStyleValue(v: string): v is AiTeacherStyleValue {
  return AI_TEACHER_STYLE_OPTIONS.some((o) => o.value === v);
}
