import { ProblemStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { jsonError, jsonOk } from "@/lib/api/response";
import { requireTeacher } from "@/lib/auth/require-teacher";
import { contestSetSaveSchema, validateContestSetPublish } from "@/lib/contest-sets/save";

export async function POST(req: Request) {
  const teacher = await requireTeacher();
  if (!teacher) return jsonError(403, "Teachers only");

  const body = await req.json().catch(() => null);
  const parsed = contestSetSaveSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Invalid input", { issues: parsed.error.flatten().fieldErrors });
  }

  const data = parsed.data;
  if (data.status === ProblemStatus.PUBLISHED) {
    const errs = validateContestSetPublish(data);
    if (errs.length) return jsonError(400, "Cannot publish yet", { errors: errs });
  }

  const created = await prisma.contestSet.create({
    data: {
      title: data.title,
      subject: data.subject,
      competitionName: data.competitionName,
      year: data.year,
      class: data.class,
      stage: data.stage,
      source: data.source?.trim() ? data.source.trim() : null,
      summary: data.summary?.trim() ? data.summary.trim() : null,
      statementMode: data.statementMode,
      statementDisplayMode: data.statementDisplayMode,
      statementText: data.statementText?.trim() ? data.statementText : null,
      statementPdfUrl: data.statementPdfUrl ?? null,
      rubricPdfUrl: data.rubricPdfUrl ?? null,
      rubricText: data.rubricText?.trim() ? data.rubricText : null,
      status: data.status,
      publishedAt: data.status === ProblemStatus.PUBLISHED ? new Date() : null,
      createdById: teacher.id,
      totalProblemCount: data.problems.length,
      problems: {
        create: data.problems.map((p) => ({
          orderNumber: p.orderNumber,
          title: p.title,
          shortSummary: p.shortSummary?.trim() ? p.shortSummary : null,
          maxScore: p.maxScore,
        })),
      },
    },
    select: { id: true, status: true },
  });

  return jsonOk({ contestSet: created }, { status: 201 });
}
