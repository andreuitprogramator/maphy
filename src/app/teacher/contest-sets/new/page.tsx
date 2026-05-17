import { ProblemStatus, Subject } from "@prisma/client";
import { ContestSetPublishForm } from "@/components/teacher/contest-set-publish-form";

export const dynamic = "force-dynamic";

export default function NewContestSetPage() {
  return (
    <ContestSetPublishForm
      initial={{
        id: null,
        title: "",
        subject: Subject.MATH,
        competitionName: "",
        year: new Date().getFullYear(),
        class: 9,
        stage: "LOCAL",
        source: "",
        summary: "",
        statementMode: "PDF_ONLY",
        statementDisplayMode: "PDF_FIRST",
        statementText: "<p></p>",
        statementPdfUrl: "",
        rubricPdfUrl: "",
        rubricText: "",
        status: ProblemStatus.DRAFT,
        problems: [
          { orderNumber: 1, title: "Problem 1", shortSummary: "", maxScore: 100 },
          { orderNumber: 2, title: "Problem 2", shortSummary: "", maxScore: 100 },
          { orderNumber: 3, title: "Problem 3", shortSummary: "", maxScore: 100 },
        ],
        attachments: [],
      }}
    />
  );
}
