import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireTeacher } from "@/lib/auth/require-teacher";
import { ProblemPublishForm } from "@/components/teacher/problem-publish-form";

export const dynamic = "force-dynamic";

export default async function EditTeacherProblemPage({ params }: { params: Promise<{ id: string }> }) {
  const teacher = await requireTeacher();
  if (!teacher) redirect("/");

  const { id } = await params;
  const problem = await prisma.problem.findFirst({
    where: { id, createdById: teacher.id },
    include: {
      rubricItems: { orderBy: { orderIndex: "asc" } },
      attachments: { orderBy: [{ sortOrder: "asc" }, { uploadedAt: "asc" }] },
    },
  });
  if (!problem) notFound();

  const initial = {
    id: problem.id,
    title: problem.title,
    summary: problem.summary ?? "",
    subject: problem.subject,
    year: problem.year,
    class: problem.class,
    phase: problem.phase,
    difficulty: problem.difficulty,
    statementHtml: problem.statement || "<p></p>",
    officialSolutionHtml: problem.officialSolution || "<p></p>",
    status: problem.status,
    rubricItems: problem.rubricItems.map((r) => ({
      title: r.title,
      description: r.description,
      points: r.points,
    })),
    attachments: problem.attachments.map((a) => ({
      id: a.id,
      fileUrl: a.fileUrl,
      fileType: a.fileType,
      mimeType: a.mimeType,
      originalName: a.originalName,
      caption: a.caption ?? "",
      uploadedAt: a.uploadedAt.toISOString(),
    })),
  };

  return <ProblemPublishForm key={`${problem.id}-${problem.status}`} initial={initial} />;
}
