import { ProblemStatus, Subject } from "@prisma/client";
import { ContestSetPublishForm } from "@/components/teacher/contest-set-publish-form";

export const dynamic = "force-dynamic";

export default function NewContestSetPage() {
  const year = new Date().getFullYear();
  return (
    <ContestSetPublishForm
      initial={{
        id: null,
        title: `Olimpiada de Matematică - Etapa Județeană ${year}`,
        subject: Subject.MATH,
        competitionName: "",
        year,
        class: 0,
        stage: "COUNTY",
        source: "",
        summary: "",
        statementMode: "PDF_ONLY",
        statementDisplayMode: "PDF_FIRST",
        statementText: "",
        statementPdfUrl: "",
        rubricPdfUrl: "",
        rubricText: "",
        leaderboardPdfUrl: "",
        status: ProblemStatus.DRAFT,
        problems: [
          { orderNumber: 1, title: "Problema 1", shortSummary: "", maxScore: 100 },
          { orderNumber: 2, title: "Problema 2", shortSummary: "", maxScore: 100 },
          { orderNumber: 3, title: "Problema 3", shortSummary: "", maxScore: 100 },
        ],
        attachments: [],
      }}
    />
  );
}
