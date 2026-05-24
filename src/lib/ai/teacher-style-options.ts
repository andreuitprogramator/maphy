/**
 * Client-safe list (no @prisma/client). Values must match enum `AiTeacherStyle` in schema.
 */
export const AI_TEACHER_STYLE_OPTIONS = [
  {
    value: "STRICT_OLYMPIAD_JUDGE",
    label: "Judecător olimpic strict",
    shortDescription: "Laudă minimă, barem pe primul loc, corecturi concise.",
  },
  {
    value: "SUPPORTIVE_TEACHER",
    label: "Profesor susținător",
    shortDescription: "Ton încurajator și explicații blânde.",
  },
  {
    value: "DETAILED_TUTOR",
    label: "Meditator detaliat",
    shortDescription: "Raționament pas cu pas și clarificări suplimentare.",
  },
  {
    value: "FUNNY_LIGHTHEARTED",
    label: "Amuzant / Relaxat",
    shortDescription: "Ton jucăuș și plin de umor, dar corect din punct de vedere matematic.",
  },
  {
    value: "EDUCATIONAL_MENTOR",
    label: "Mentor educațional",
    shortDescription: "Concepte, intuiție și de ce funcționează ideile.",
  },
  {
    value: "COMPETITION_COACH",
    label: "Antrenor de concurs",
    shortDescription: "Strategie, mentalitate olimpică și abordări alternative.",
  },
] as const;

export type AiTeacherStyleValue = (typeof AI_TEACHER_STYLE_OPTIONS)[number]["value"];

export function isAiTeacherStyleValue(v: string): v is AiTeacherStyleValue {
  return AI_TEACHER_STYLE_OPTIONS.some((o) => o.value === v);
}
