-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'BLURRY_REJECTED', 'GRADED', 'FAILED');

-- DropIndex
DROP INDEX "Submission_problemId_score_idx";

-- AlterTable
ALTER TABLE "Problem" ADD COLUMN     "expectedConcepts" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "gradingRubric" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "maxScore" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "officialSolution" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "aiBreakdown" JSONB,
ADD COLUMN     "aiFeedback" TEXT,
ADD COLUMN     "aiScore" INTEGER,
ADD COLUMN     "imageQualityReason" TEXT,
ADD COLUMN     "ocrExtractedText" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "visibilityUnlocked" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "score" SET DEFAULT 0;

-- CreateIndex
CREATE INDEX "Submission_problemId_aiScore_idx" ON "Submission"("problemId", "aiScore");

-- CreateIndex
CREATE INDEX "Submission_problemId_status_idx" ON "Submission"("problemId", "status");
