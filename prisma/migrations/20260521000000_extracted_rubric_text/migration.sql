-- AlterTable: Problem — add extracted rubric text cache
ALTER TABLE "Problem" ADD COLUMN "extractedRubricText" TEXT;
ALTER TABLE "Problem" ADD COLUMN "extractedRubricTextUpdatedAt" TIMESTAMP(3);

-- AlterTable: ContestSetProblem — add extracted rubric text cache
ALTER TABLE "ContestSetProblem" ADD COLUMN "extractedRubricText" TEXT;
ALTER TABLE "ContestSetProblem" ADD COLUMN "extractedRubricTextUpdatedAt" TIMESTAMP(3);
