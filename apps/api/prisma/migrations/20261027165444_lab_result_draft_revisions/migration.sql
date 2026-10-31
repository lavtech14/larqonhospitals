-- AlterTable
ALTER TABLE "LabSample" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "LabResultRevision" (
    "id" UUID NOT NULL,
    "sampleId" UUID NOT NULL,
    "authorStaffId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "method" VARCHAR(200) NOT NULL,
    "resultText" VARCHAR(10000) NOT NULL,
    "comments" VARCHAR(2000) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotencyKey" UUID NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,

    CONSTRAINT "LabResultRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LabResultRevision_sampleId_createdAt_idx" ON "LabResultRevision"("sampleId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LabResultRevision_sampleId_revision_key" ON "LabResultRevision"("sampleId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "LabResultRevision_authorStaffId_idempotencyKey_key" ON "LabResultRevision"("authorStaffId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "LabResultRevision" ADD CONSTRAINT "LabResultRevision_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "LabSample"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabResultRevision" ADD CONSTRAINT "LabResultRevision_authorStaffId_fkey" FOREIGN KEY ("authorStaffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
