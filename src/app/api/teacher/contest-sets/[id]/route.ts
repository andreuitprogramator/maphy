import { ProblemStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { jsonError, jsonOk } from "@/lib/api/response";
import { requireTeacher } from "@/lib/auth/require-teacher";
import { contestSetSaveSchema, validateContestSetPublish } from "@/lib/contest-sets/save";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const teacher = await requireTeacher();
  if (!teacher) return jsonError(403, "Teachers only");
  const { id } = await ctx.params;

  const existing = await prisma.contestSet.findFirst({
    where: { id, createdById: teacher.id },
    select: { id: true, status: true, publishedAt: true },
  });
  if (!existing) return jsonError(404, "Contest set not found");

  const body = await req.json().catch(() => null);
  const parsed = contestSetSaveSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Invalid input", { issues: parsed.error.flatten().fieldErrors });
  }

  const data = parsed.data;
  const nextStatus = existing.status === ProblemStatus.PUBLISHED ? ProblemStatus.PUBLISHED : data.status;
  if (nextStatus === ProblemStatus.PUBLISHED) {
    const errs = validateContestSetPublish({ ...data, status: ProblemStatus.PUBLISHED });
    if (errs.length) return jsonError(400, "Cannot publish yet", { errors: errs });
  }

  await prisma.$transaction([
    prisma.contestSetProblem.deleteMany({ where: { contestSetId: id } }),
    prisma.contestSet.update({
      where: { id },
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
        status: nextStatus,
        publishedAt: nextStatus === ProblemStatus.PUBLISHED ? existing.publishedAt ?? new Date() : null,
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
    }),
  ]);

  return jsonOk({ ok: true });
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const teacher = await requireTeacher();
  if (!teacher) return jsonError(403, "Teachers only");
  const { id } = await ctx.params;

  const existing = await prisma.contestSet.findFirst({
    where: { id, createdById: teacher.id },
    select: { id: true, status: true },
  });
  if (!existing) return jsonError(404, "Contest set not found");
  if (existing.status !== ProblemStatus.DRAFT) return jsonError(400, "Only drafts can be deleted");

  await prisma.contestSet.delete({ where: { id } });
  return jsonOk({ ok: true });
}
