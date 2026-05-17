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

export async function POST(req: Request) {
  const teacher = await requireTeacher();
  if (!teacher) return jsonError(403, "Teachers only");

  const body = await req.json().catch(() => null);
  const parsed = teacherProblemSaveSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Invalid input", { issues: parsed.error.flatten().fieldErrors });
  }

  const data = parsed.data;
  if (data.status === ProblemStatus.PUBLISHED) {
    const pubErrs = validateTeacherPublish(data);
    if (pubErrs.length) return jsonError(400, "Cannot publish yet", { errors: pubErrs });
  }

  const normalized = normalizeRubricItems(data.rubricItems);
  const gradingRubric =
    normalized.length > 0
      ? rubricItemsToGradingRubricText(normalized.map((r, i) => ({ ...r, orderIndex: i })))
      : "";

  const problem = await prisma.problem.create({
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
      status: data.status,
      publishedAt: data.status === ProblemStatus.PUBLISHED ? new Date() : null,
      createdById: teacher.id,
      rubricItems: {
        create: normalized.map((r, i) => ({
          title: r.title,
          description: r.description,
          points: r.points,
          orderIndex: i,
        })),
      },
    },
    select: { id: true, status: true, title: true },
  });

  if (problem.status === ProblemStatus.PUBLISHED) {
    await notifyUsersNewProblemPublished({
      problemId: problem.id,
      problemTitle: problem.title,
      publisherUserId: teacher.id,
      publisherUsername: teacher.username,
    });
  }

  return jsonOk({ problem }, { status: 201 });
}
