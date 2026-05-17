import { Phase, ProblemStatus, Subject } from "@prisma/client";
import { ProblemPublishForm } from "@/components/teacher/problem-publish-form";

export const dynamic = "force-dynamic";

export default function NewTeacherProblemPage() {
  return (
    <ProblemPublishForm
      initial={{
        id: null,
        title: "",
        summary: "",
        subject: Subject.MATH,
        year: new Date().getFullYear(),
        class: 9,
        phase: Phase.LOCAL,
        difficulty: 5,
        statementHtml: "<p></p>",
        officialSolutionHtml: "<p></p>",
        status: ProblemStatus.DRAFT,
        rubricItems: [],
        attachments: [],
      }}
    />
  );
}
