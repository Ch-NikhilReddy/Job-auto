-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "confirmationRef" TEXT,
ADD COLUMN     "submissionMethod" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN     "verificationMethod" TEXT,
ADD COLUMN     "verificationNote" TEXT,
ADD COLUMN     "verifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "applications_verifiedAt_idx" ON "applications"("verifiedAt");
