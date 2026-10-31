-- CreateEnum
CREATE TYPE "EncounterStatus" AS ENUM ('CHECKED_IN', 'READY_FOR_DOCTOR', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Encounter" (
    "id" UUID NOT NULL,
    "appointmentId" UUID NOT NULL,
    "status" "EncounterStatus" NOT NULL DEFAULT 'CHECKED_IN',
    "checkedInAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedInByStaffId" UUID NOT NULL,
    "readyForDoctorAt" TIMESTAMPTZ(3),
    "startedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "cancelledAt" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Encounter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Encounter_appointmentId_key" ON "Encounter"("appointmentId");

-- CreateIndex
CREATE INDEX "Encounter_status_checkedInAt_idx" ON "Encounter"("status", "checkedInAt");

-- CreateIndex
CREATE INDEX "Encounter_checkedInByStaffId_idx" ON "Encounter"("checkedInByStaffId");

-- AddForeignKey
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_checkedInByStaffId_fkey" FOREIGN KEY ("checkedInByStaffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
