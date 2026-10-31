-- CreateTable
CREATE TABLE "ClinicalNoteRevision" (
    "id" UUID NOT NULL,
    "encounterId" UUID NOT NULL,
    "authorStaffId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "complaint" VARCHAR(5000) NOT NULL,
    "history" VARCHAR(5000) NOT NULL,
    "examination" VARCHAR(5000) NOT NULL,
    "assessment" VARCHAR(5000) NOT NULL,
    "plan" VARCHAR(5000) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotencyKey" UUID NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,

    CONSTRAINT "ClinicalNoteRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalNoteRevision_encounterId_revision_key" ON "ClinicalNoteRevision"("encounterId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalNoteRevision_authorStaffId_idempotencyKey_key" ON "ClinicalNoteRevision"("authorStaffId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "ClinicalNoteRevision" ADD CONSTRAINT "ClinicalNoteRevision_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNoteRevision" ADD CONSTRAINT "ClinicalNoteRevision_authorStaffId_fkey" FOREIGN KEY ("authorStaffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
