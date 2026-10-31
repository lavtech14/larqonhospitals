-- CreateTable
CREATE TABLE "PublishedVisitSummary" (
    "id" UUID NOT NULL,
    "encounterId" UUID NOT NULL,
    "sourceNoteRevisionId" UUID NOT NULL,
    "publishedByStaffId" UUID NOT NULL,
    "patientName" VARCHAR(100) NOT NULL,
    "patientMrn" VARCHAR(30) NOT NULL,
    "doctorName" VARCHAR(100) NOT NULL,
    "doctorRegistrationNumber" VARCHAR(100),
    "doctorRegistrationAuthority" VARCHAR(100),
    "summary" VARCHAR(5000) NOT NULL,
    "carePlan" VARCHAR(5000) NOT NULL,
    "followUp" VARCHAR(2000) NOT NULL,
    "returnPrecautions" VARCHAR(2000) NOT NULL,
    "publishedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotencyKey" UUID NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,

    CONSTRAINT "PublishedVisitSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PublishedVisitSummary_encounterId_key" ON "PublishedVisitSummary"("encounterId");

-- CreateIndex
CREATE INDEX "PublishedVisitSummary_sourceNoteRevisionId_idx" ON "PublishedVisitSummary"("sourceNoteRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "PublishedVisitSummary_publishedByStaffId_idempotencyKey_key" ON "PublishedVisitSummary"("publishedByStaffId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "PublishedVisitSummary" ADD CONSTRAINT "PublishedVisitSummary_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedVisitSummary" ADD CONSTRAINT "PublishedVisitSummary_sourceNoteRevisionId_fkey" FOREIGN KEY ("sourceNoteRevisionId") REFERENCES "ClinicalNoteRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedVisitSummary" ADD CONSTRAINT "PublishedVisitSummary_publishedByStaffId_fkey" FOREIGN KEY ("publishedByStaffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
