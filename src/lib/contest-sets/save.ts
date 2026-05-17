import { ProblemStatus, Subject } from "@prisma/client";
import { z } from "zod";

const optionalUrlLikeSchema = z
  .string()
  .trim()
  .refine((v) => v.startsWith("/") || /^https?:\/\//i.test(v), "Must be a local path (/uploads/...) or absolute URL")
  .optional()
  .nullable();

export const ContestStageValues = [
  "LOCAL",
  "COUNTY",
  "NATIONAL",
  "SELECTION",
  "FINAL_ROUND",
  "INTERNATIONAL",
  "OTHER",
] as const;

const InternalProblemSchema = z.object({
  orderNumber: z.number().int().min(1).max(20),
  title: z.string().trim().min(1).max(300),
  shortSummary: z.string().trim().max(2000).optional().nullable(),
  maxScore: z.number().int().min(1).max(100).default(100),
});

const ContestSetAttachmentSchema = z.object({
  role: z.string(),
  fileType: z.string().optional().nullable(),
  problemOrderNumber: z.number().int().min(1).max(20).optional().nullable(),
});

export const contestSetSaveSchema = z.object({
  title: z.string().trim().min(1).max(300),
  subject: z.nativeEnum(Subject),
  competitionName: z.string().trim().min(1).max(200),
  year: z.number().int().min(1990).max(2100),
  class: z.number().int().min(5).max(12),
  stage: z.enum(ContestStageValues),
  source: z.string().trim().max(2000).optional().nullable(),
  summary: z.string().trim().max(4000).optional().nullable(),
  statementMode: z.enum(["PDF_ONLY", "TEXT_ONLY", "BOTH"]),
  statementDisplayMode: z.enum(["TEXT_FIRST", "PDF_FIRST", "PDF_ONLY", "TEXT_ONLY"]),
  statementText: z.string().optional().nullable(),
  statementPdfUrl: optionalUrlLikeSchema,
  rubricPdfUrl: optionalUrlLikeSchema,
  rubricText: z.string().optional().nullable(),
  status: z.nativeEnum(ProblemStatus),
  problems: z.array(InternalProblemSchema).min(1).max(20),
  attachments: z.array(ContestSetAttachmentSchema).optional().default([]),
});

export type ContestSetSaveInput = z.infer<typeof contestSetSaveSchema>;

export function validateContestSetPublish(input: ContestSetSaveInput): string[] {
  const errors: string[] = [];
  if (input.statementMode === "PDF_ONLY" && !input.statementPdfUrl) {
    errors.push("Statement PDF is required in PDF-only mode.");
  }
  if (input.statementMode === "TEXT_ONLY" && !(input.statementText ?? "").trim()) {
    errors.push("Statement text is required in text-only mode.");
  }
  if (input.statementMode === "BOTH") {
    if (!input.statementPdfUrl) errors.push("Statement PDF is required in both mode.");
    if (!(input.statementText ?? "").trim()) errors.push("Statement text is required in both mode.");
  }
  if (!input.rubricPdfUrl && !(input.rubricText ?? "").trim()) {
    errors.push("Provide at least one rubric source (PDF or rubric text).");
  }
  const usedOrders = new Set<number>();
  for (const row of input.problems) {
    if (usedOrders.has(row.orderNumber)) errors.push(`Problem number ${row.orderNumber} is duplicated.`);
    usedOrders.add(row.orderNumber);
    if (row.maxScore !== 100) errors.push(`Problem ${row.orderNumber}: max score must be 100.`);
  }
  if (input.status === ProblemStatus.PUBLISHED) {
    if (!input.statementPdfUrl) errors.push("Încarcă PDF-ul de subiect (pentru elevi).");
    if (!input.rubricPdfUrl && !(input.rubricText ?? "").trim()) {
      errors.push("Încarcă PDF-ul de barem sau completează textul de barem (pentru elevi).");
    }
    for (const row of input.problems) {
      const hasStatementAsset = input.attachments.some(
        (a) =>
          a.role === "PROBLEM_STATEMENT" &&
          a.problemOrderNumber === row.orderNumber &&
          (a.fileType == null || a.fileType === "IMAGE"),
      );
      const hasRubricAsset = input.attachments.some(
        (a) =>
          a.role === "PROBLEM_RUBRIC" &&
          a.problemOrderNumber === row.orderNumber &&
          (a.fileType == null || a.fileType === "IMAGE"),
      );

      if (!hasStatementAsset) {
        errors.push(
          `Problema ${row.orderNumber}: încarcă cel puțin o poză cu cerința (secțiunea mov „Poze cerință”).`,
        );
      }
      if (!hasRubricAsset) {
        errors.push(
          `Problema ${row.orderNumber}: încarcă cel puțin o poză cu baremul (secțiunea mov „Poze barem”).`,
        );
      }
    }
  }
  return errors;
}
