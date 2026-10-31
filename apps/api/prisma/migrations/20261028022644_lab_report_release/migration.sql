-- CreateTable
CREATE TABLE "LabReleasedReport" (
    "id" UUID NOT NULL,
    "sampleId" UUID NOT NULL,
    "sourceRevisionId" UUID NOT NULL,
    "reviewedByStaffId" UUID NOT NULL,
    "patientName" VARCHAR(100) NOT NULL,
    "patientMrn" VARCHAR(30) NOT NULL,
    "doctorName" VARCHAR(100) NOT NULL,
    "testCode" VARCHAR(40) NOT NULL,
    "testName" VARCHAR(200) NOT NULL,
    "sampleType" VARCHAR(100) NOT NULL,
    "specimenReference" VARCHAR(50) NOT NULL,
    "collectedAt" TIMESTAMPTZ(3) NOT NULL,
    "method" VARCHAR(200) NOT NULL,
    "resultText" VARCHAR(10000) NOT NULL,
    "comments" VARCHAR(2000) NOT NULL,
    "reviewerName" VARCHAR(100) NOT NULL,
    "releasedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotencyKey" UUID NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,

    CONSTRAINT "LabReleasedReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LabReleasedReport_sampleId_key" ON "LabReleasedReport"("sampleId");

-- CreateIndex
CREATE INDEX "LabReleasedReport_sourceRevisionId_idx" ON "LabReleasedReport"("sourceRevisionId");

-- CreateIndex
CREATE INDEX "LabReleasedReport_releasedAt_idx" ON "LabReleasedReport"("releasedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LabReleasedReport_reviewedByStaffId_idempotencyKey_key" ON "LabReleasedReport"("reviewedByStaffId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "LabReleasedReport" ADD CONSTRAINT "LabReleasedReport_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "LabSample"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabReleasedReport" ADD CONSTRAINT "LabReleasedReport_sourceRevisionId_fkey" FOREIGN KEY ("sourceRevisionId") REFERENCES "LabResultRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabReleasedReport" ADD CONSTRAINT "LabReleasedReport_reviewedByStaffId_fkey" FOREIGN KEY ("reviewedByStaffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
