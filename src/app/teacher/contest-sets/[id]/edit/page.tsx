import { notFound, redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth/require-teacher";
import { prisma } from "@/lib/db/prisma";
import { ContestSetPublishForm } from "@/components/teacher/contest-set-publish-form";

export const dynamic = "force-dynamic";

export default async function EditContestSetPage({ params }: { params: Promise<{ id: string }> }) {
  const teacher = await requireTeacher();
  if (!teacher) redirect("/");
  const { id } = await params;

  const set = await prisma.contestSet.findFirst({
    where: { id, createdById: teacher.id },
    include: {
      problems: { orderBy: { orderNumber: "asc" } },
      attachments: { orderBy: [{ sortOrder: "asc" }, { uploadedAt: "asc" }] },
    },
  });
  if (!set) notFound();

  return (
    <ContestSetPublishForm
      initial={{
        id: set.id,
        title: set.title,
        subject: set.subject,
        competitionName: set.competitionName,
        year: set.year,
        class: set.class,
        stage: set.stage,
        source: set.source ?? "",
        summary: set.summary ?? "",
        statementMode: set.statementMode as "PDF_ONLY" | "TEXT_ONLY" | "BOTH",
        statementDisplayMode: set.statementDisplayMode as "TEXT_FIRST" | "PDF_FIRST" | "PDF_ONLY" | "TEXT_ONLY",
        statementText: set.statementText ?? "<p></p>",
        statementPdfUrl: set.statementPdfUrl ?? "",
        rubricPdfUrl: set.rubricPdfUrl ?? "",
        rubricText: set.rubricText ?? "",
        status: set.status,
        problems: set.problems.map((p) => ({ orderNumber: p.orderNumber, title: p.title, shortSummary: p.shortSummary ?? "", maxScore: p.maxScore })),
        attachments: set.attachments.map((a) => ({
          id: a.id,
          role: a.role as "STATEMENT" | "RUBRIC" | "SUPPORTING" | "PROBLEM_STATEMENT" | "PROBLEM_RUBRIC",
          fileUrl: a.fileUrl,
          fileType: a.fileType,
          mimeType: a.mimeType,
          originalName: a.originalName,
          problemOrderNumber: a.problemOrderNumber ?? null,
          problemAssetType: a.problemAssetType ?? null,
        })),
      }}
    />
  );
}
