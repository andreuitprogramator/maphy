-- CreateEnum
CREATE TYPE "ContestStage" AS ENUM ('LOCAL', 'COUNTY', 'NATIONAL', 'SELECTION', 'FINAL_ROUND', 'INTERNATIONAL', 'OTHER');

-- CreateTable
CREATE TABLE "ContestSet" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subject" "Subject" NOT NULL,
    "competitionName" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "class" INTEGER NOT NULL,
    "stage" "ContestStage" NOT NULL,
    "source" TEXT,
    "summary" TEXT,
    "statementMode" TEXT NOT NULL DEFAULT 'PDF_ONLY',
    "statementDisplayMode" TEXT NOT NULL DEFAULT 'PDF_FIRST',
    "statementText" TEXT,
    "statementPdfUrl" TEXT,
    "rubricPdfUrl" TEXT,
    "rubricText" TEXT,
    "status" "ProblemStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "totalProblemCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ContestSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContestSetProblem" (
    "id" TEXT NOT NULL,
    "contestSetId" TEXT NOT NULL,
    "orderNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "shortSummary" TEXT,
    "maxScore" INTEGER NOT NULL DEFAULT 100,
    "statementTextOverride" TEXT,
    "solutionText" TEXT,
    "isListedIndividually" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ContestSetProblem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContestSetAttachment" (
    "id" TEXT NOT NULL,
    "contestSetId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'SUPPORTING',
    "caption" TEXT DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContestSetAttachment_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Submission" ALTER COLUMN "problemId" DROP NOT NULL;
ALTER TABLE "Submission" ADD COLUMN "contestSetProblemId" TEXT;

-- CreateIndex
CREATE INDEX "ContestSet_subject_year_class_stage_idx" ON "ContestSet"("subject", "year", "class", "stage");
CREATE INDEX "ContestSet_status_idx" ON "ContestSet"("status");
CREATE INDEX "ContestSet_createdById_idx" ON "ContestSet"("createdById");
CREATE UNIQUE INDEX "ContestSetProblem_contestSetId_orderNumber_key" ON "ContestSetProblem"("contestSetId", "orderNumber");
CREATE INDEX "ContestSetProblem_contestSetId_orderNumber_idx" ON "ContestSetProblem"("contestSetId", "orderNumber");
CREATE INDEX "ContestSetAttachment_contestSetId_sortOrder_idx" ON "ContestSetAttachment"("contestSetId", "sortOrder");
CREATE INDEX "Submission_contestSetProblemId_aiScore_idx" ON "Submission"("contestSetProblemId", "aiScore");
CREATE INDEX "Submission_contestSetProblemId_status_idx" ON "Submission"("contestSetProblemId", "status");

-- AddForeignKey
ALTER TABLE "ContestSet" ADD CONSTRAINT "ContestSet_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContestSetProblem" ADD CONSTRAINT "ContestSetProblem_contestSetId_fkey" FOREIGN KEY ("contestSetId") REFERENCES "ContestSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContestSetAttachment" ADD CONSTRAINT "ContestSetAttachment_contestSetId_fkey" FOREIGN KEY ("contestSetId") REFERENCES "ContestSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_contestSetProblemId_fkey" FOREIGN KEY ("contestSetProblemId") REFERENCES "ContestSetProblem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
