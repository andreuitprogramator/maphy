import { Phase, ProblemStatus, Subject } from "@prisma/client";
import { z } from "zod";

export const teacherProblemSaveSchema = z.object({
  title: z.string().trim().min(1, "Titlul este obligatoriu").max(300),
  summary: z.string().trim().max(2000).optional().nullable(),
  subject: z.nativeEnum(Subject),
  year: z.number().int().min(1990).max(2100),
  class: z.number().int().min(5).max(12),
  phase: z.nativeEnum(Phase),
  difficulty: z.number().int().min(1).max(10),
  statementHtml: z.string().optional().default(""),
  officialSolutionHtml: z.string().optional().default(""),
  rubricItems: z.array(z.object({
    title: z.string().max(200),
    description: z.string().max(8000),
    points: z.number().int().min(0).max(100),
  })).optional().default([]),
  status: z.nativeEnum(ProblemStatus),
  maxScore: z.number().int().refine((n) => n === 100).optional().default(100),
});

export type TeacherProblemSaveInput = z.infer<typeof teacherProblemSaveSchema>;

export function normalizeRubricItems(
  items: TeacherProblemSaveInput["rubricItems"],
): { title: string; description: string; points: number }[] {
  return (items ?? [])
    .map((r) => ({
      title: r.title.trim(),
      description: r.description.trim(),
      points: r.points,
    }))
    .filter((r) => r.title.length > 0 || r.description.length > 0 || r.points > 0);
}

/** Server-side publish validation — barem images check is done separately in the route. */
export function validateTeacherPublish(input: TeacherProblemSaveInput): string[] {
  const errors: string[] = [];
  if (!input.title.trim()) errors.push("Titlul este obligatoriu.");
  return errors;
}
