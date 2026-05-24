import { ProblemStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { jsonError, jsonOk } from "@/lib/api/response";
import { requireTeacher } from "@/lib/auth/require-teacher";
import {
  normalizeRubricItems,
  teacherProblemSaveSchema,
  validateTeacherPublish,
} from "@/lib/teacher/problem-save";
import { rubricItemsToGradingRubricText } from "@/lib/problems/rubric-format";
import { notifyUsersNewProblemPublished } from "@/lib/notifications/service";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const teacher = await requireTeacher();
  if (!teacher) return jsonError(403, "Teachers only");

  const { id } = await ctx.params;
  if (!id) return jsonError(400, "Missing id");

  const existing = await prisma.problem.findFirst({
    where: { id, createdById: teacher.id },
    select: { id: true, status: true, publishedAt: true },
  });
  if (!existing) return jsonError(404, "Problema nu a fost găsită");

  const body = await req.json().catch(() => null);
  const parsed = teacherProblemSaveSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Date invalide", { issues: parsed.error.flatten().fieldErrors });
  }

  const data = parsed.data;
  const nextStatus =
    existing.status === ProblemStatus.PUBLISHED ? ProblemStatus.PUBLISHED : data.status;

  if (nextStatus === ProblemStatus.PUBLISHED) {
    const pubErrs = validateTeacherPublish({ ...data, status: ProblemStatus.PUBLISHED });
    if (pubErrs.length) return jsonError(400, "Cannot publish yet", { errors: pubErrs });

    const baremCount = await prisma.problemAttachment.count({
      where: { problemId: id, role: "RUBRIC" },
    });
    if (baremCount === 0) {
      return jsonError(400, "Cannot publish yet", { errors: ["Adaugă cel puțin o poză cu baremul."] });
    }
  }

  const normalized = normalizeRubricItems(data.rubricItems);
  const gradingRubric =
    normalized.length > 0
      ? rubricItemsToGradingRubricText(normalized.map((r, i) => ({ ...r, orderIndex: i })))
      : "";

  const publishedAt =
    nextStatus === ProblemStatus.PUBLISHED
      ? existing.publishedAt ?? new Date()
      : null;

  await prisma.$transaction([
    prisma.problemRubricItem.deleteMany({ where: { problemId: id } }),
    prisma.problem.update({
      where: { id },
      data: {
        title: data.title,
        summary: data.summary?.trim() ? data.summary.trim() : null,
        statement: data.statementHtml,
        officialSolution: data.officialSolutionHtml,
        subject: data.subject,
        year: data.year,
        class: data.class,
        phase: data.phase,
        difficulty: data.difficulty,
        maxScore: 100,
        gradingRubric,
        status: nextStatus,
        publishedAt,
        rubricItems: {
          create: normalized.map((r, i) => ({
            title: r.title,
            description: r.description,
            points: r.points,
            orderIndex: i,
          })),
        },
      },
    }),
  ]);

  if (existing.status !== ProblemStatus.PUBLISHED && nextStatus === ProblemStatus.PUBLISHED) {
    await notifyUsersNewProblemPublished({
      problemId: id,
      problemTitle: data.title,
      publisherUserId: teacher.id,
      publisherUsername: teacher.username,
    });
  }

  return jsonOk({ ok: true });
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const teacher = await requireTeacher();
  if (!teacher) return jsonError(403, "Teachers only");

  const { id } = await ctx.params;
  if (!id) return jsonError(400, "Missing id");

  const existing = await prisma.problem.findFirst({
    where: { id, createdById: teacher.id },
    select: { id: true, status: true },
  });
  if (!existing) return jsonError(404, "Problema nu a fost găsită");
  if (existing.status !== ProblemStatus.DRAFT) {
    return jsonError(400, "Only drafts can be deleted");
  }

  await prisma.problem.delete({ where: { id } });
  return jsonOk({ ok: true });
}
