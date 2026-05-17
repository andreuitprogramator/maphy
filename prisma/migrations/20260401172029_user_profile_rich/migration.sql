-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'TEACHER', 'OTHER');

-- AlterTable: preserve existing profile photos
ALTER TABLE "User" RENAME COLUMN "imageUrl" TO "avatarUrl";

ALTER TABLE "User" ADD COLUMN     "city" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "country" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "firstName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "lastName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "preferredLanguage" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "roleLabel" "UserRole" NOT NULL DEFAULT 'STUDENT',
ADD COLUMN     "school" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");
