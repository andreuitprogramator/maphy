import { Phase, ProblemStatus, Subject } from "@prisma/client";
import { z } from "zod";
import { hasMeaningfulRichText } from "@/lib/html/strip";
import { rubricPointsTotal } from "@/lib/problems/rubric-format";

export const teacherRubricItemSchema = z.object({
  title: z.string().max(200),
  description: z.string().max(8000),
  points: z.number().int().min(0).max(100),
});

export const teacherProblemSaveSchema = z.object({
  title: z.string().trim().min(1, "Title required").max(300),
  summary: z.string().trim().max(2000).optional().nullable(),
  subject: z.nativeEnum(Subject),
  year: z.number().int().min(1990).max(2100),
  class: z.number().int().min(5).max(12),
  phase: z.nativeEnum(Phase),
  difficulty: z.number().int().min(1).max(10),
  statementHtml: z.string(),
  officialSolutionHtml: z.string(),
  rubricItems: z.array(teacherRubricItemSchema),
  status: z.nativeEnum(ProblemStatus),
  maxScore: z.number().int().refine((n) => n === 100).optional().default(100),
});

export type TeacherProblemSaveInput = z.infer<typeof teacherProblemSaveSchema>;

/** Keep only rubric rows the teacher is actively using (drops blank placeholders). */
export function normalizeRubricItems(
  items: TeacherProblemSaveInput["rubricItems"],
): { title: string; description: string; points: number }[] {
  return items
    .map((r) => ({
      title: r.title.trim(),
      description: r.description.trim(),
      points: r.points,
    }))
    .filter((r) => r.title.length > 0 || r.description.length > 0 || r.points > 0);
}

export function validateTeacherPublish(input: TeacherProblemSaveInput): string[] {
  const errors: string[] = [];

  if (!hasMeaningfulRichText(input.statementHtml, 8)) {
    errors.push("Problem statement is required.");
  }
  if (!hasMeaningfulRichText(input.officialSolutionHtml, 8)) {
    errors.push("Official solution is required.");
  }

  const items = normalizeRubricItems(input.rubricItems);
  if (items.length < 1) {
    errors.push("Add at least one rubric section.");
  }

  const total = rubricPointsTotal(items);
  if (total !== 100) {
    errors.push(`Rubric sections must sum to exactly 100 points (currently ${total}).`);
  }

  for (let i = 0; i < items.length; i++) {
    const r = items[i]!;
    if (!r.title) {
      errors.push(`Rubric item ${i + 1}: add a title/label.`);
    }
    if (!r.description) {
      errors.push(`Rubric item ${i + 1}: describe expected evidence for the points.`);
    }
    if (r.points <= 0) {
      errors.push(`Rubric item ${i + 1}: points must be greater than zero.`);
    }
  }

  return errors;
}
