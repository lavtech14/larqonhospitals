-- CreateEnum
CREATE TYPE "PrescriptionStatus" AS ENUM ('DRAFT', 'ISSUED', 'CANCELLED', 'REPLACED');

-- CreateEnum
CREATE TYPE "AllergyReviewStatus" AS ENUM ('NOT_REVIEWED', 'NO_KNOWN_ALLERGIES', 'ALLERGIES_REPORTED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PrescriptionOperation" AS ENUM ('CREATE_DRAFT', 'SAVE_DRAFT', 'ISSUE', 'CANCEL');

-- CreateTable
CREATE TABLE "Medicine" (
    "id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "displayName" VARCHAR(200) NOT NULL,
    "genericName" VARCHAR(200),
    "strength" VARCHAR(100) NOT NULL,
    "dosageForm" VARCHAR(100) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Medicine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prescription" (
    "id" UUID NOT NULL,
    "encounterId" UUID NOT NULL,
    "authorStaffId" UUID NOT NULL,
    "status" "PrescriptionStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "allergyStatus" "AllergyReviewStatus" NOT NULL DEFAULT 'NOT_REVIEWED',
    "allergyDetails" VARCHAR(2000),
    "instructions" VARCHAR(2000),
    "patientName" VARCHAR(100),
    "patientMrn" VARCHAR(30),
    "prescriberName" VARCHAR(100),
    "prescriberRegistrationNumber" VARCHAR(100),
    "prescriberRegistrationAuthority" VARCHAR(100),
    "issuedAt" TIMESTAMPTZ(3),
    "cancelledAt" TIMESTAMPTZ(3),
    "cancellationReason" VARCHAR(1000),
    "replacesPrescriptionId" UUID,
    "replacementReason" VARCHAR(1000),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrescriptionItem" (
    "id" UUID NOT NULL,
    "prescriptionId" UUID NOT NULL,
    "medicineId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "medicineName" VARCHAR(200) NOT NULL,
    "genericName" VARCHAR(200),
    "strength" VARCHAR(100) NOT NULL,
    "dosageForm" VARCHAR(100) NOT NULL,
    "dose" VARCHAR(200) NOT NULL,
    "route" VARCHAR(100) NOT NULL,
    "frequency" VARCHAR(200) NOT NULL,
    "duration" VARCHAR(200) NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "quantityUnit" VARCHAR(50) NOT NULL,
    "instructions" VARCHAR(1000),

    CONSTRAINT "PrescriptionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrescriptionRequest" (
    "actorStaffId" UUID NOT NULL,
    "key" UUID NOT NULL,
    "operation" "PrescriptionOperation" NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,
    "prescriptionId" UUID NOT NULL,
    "resultVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrescriptionRequest_pkey" PRIMARY KEY ("actorStaffId","key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Medicine_code_key" ON "Medicine"("code");

-- CreateIndex
CREATE INDEX "Medicine_displayName_idx" ON "Medicine"("displayName");

-- CreateIndex
CREATE INDEX "Medicine_isActive_displayName_idx" ON "Medicine"("isActive", "displayName");

-- CreateIndex
CREATE UNIQUE INDEX "Prescription_replacesPrescriptionId_key" ON "Prescription"("replacesPrescriptionId");

-- CreateIndex
CREATE INDEX "Prescription_encounterId_createdAt_idx" ON "Prescription"("encounterId", "createdAt");

-- CreateIndex
CREATE INDEX "Prescription_authorStaffId_createdAt_idx" ON "Prescription"("authorStaffId", "createdAt");

-- CreateIndex
CREATE INDEX "Prescription_status_issuedAt_idx" ON "Prescription"("status", "issuedAt");

-- CreateIndex
CREATE INDEX "PrescriptionItem_medicineId_idx" ON "PrescriptionItem"("medicineId");

-- CreateIndex
CREATE UNIQUE INDEX "PrescriptionItem_prescriptionId_position_key" ON "PrescriptionItem"("prescriptionId", "position");

-- CreateIndex
CREATE INDEX "PrescriptionRequest_prescriptionId_idx" ON "PrescriptionRequest"("prescriptionId");

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_authorStaffId_fkey" FOREIGN KEY ("authorStaffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_replacesPrescriptionId_fkey" FOREIGN KEY ("replacesPrescriptionId") REFERENCES "Prescription"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "PrescriptionItem" ADD CONSTRAINT "PrescriptionItem_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionItem" ADD CONSTRAINT "PrescriptionItem_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "Medicine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionRequest" ADD CONSTRAINT "PrescriptionRequest_actorStaffId_fkey" FOREIGN KEY ("actorStaffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionRequest" ADD CONSTRAINT "PrescriptionRequest_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
