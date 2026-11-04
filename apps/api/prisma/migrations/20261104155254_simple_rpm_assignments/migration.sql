-- CreateTable
CREATE TABLE "RpmAssignment" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "doctorId" UUID NOT NULL,
    "nurseStaffId" UUID NOT NULL,
    "assignedByStaffId" UUID NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "reason" VARCHAR(2000) NOT NULL,
    "notes" VARCHAR(2000),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMPTZ(3),
    "cancellationReason" VARCHAR(1000),
    "idempotencyKey" UUID NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,

    CONSTRAINT "RpmAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RpmReading" (
    "id" UUID NOT NULL,
    "assignmentId" UUID NOT NULL,
    "patientAccountId" UUID NOT NULL,
    "measuredAt" TIMESTAMPTZ(3) NOT NULL,
    "submittedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "weightKg" DECIMAL(7,3),
    "temperatureC" DECIMAL(6,3),
    "systolicBp" INTEGER,
    "diastolicBp" INTEGER,
    "spo2Percent" DECIMAL(6,3),
    "pulseBpm" INTEGER,
    "bloodGlucoseMgDl" DECIMAL(8,3),
    "glucoseContext" "RpmReadingContext",
    "notes" VARCHAR(2000),
    "idempotencyKey" UUID NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,

    CONSTRAINT "RpmReading_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RpmAssignment_patientId_startDate_endDate_idx" ON "RpmAssignment"("patientId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "RpmAssignment_doctorId_startDate_idx" ON "RpmAssignment"("doctorId", "startDate");

-- CreateIndex
CREATE INDEX "RpmAssignment_nurseStaffId_startDate_idx" ON "RpmAssignment"("nurseStaffId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "RpmAssignment_assignedByStaffId_idempotencyKey_key" ON "RpmAssignment"("assignedByStaffId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "RpmReading_assignmentId_measuredAt_id_idx" ON "RpmReading"("assignmentId", "measuredAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "RpmReading_patientAccountId_idempotencyKey_key" ON "RpmReading"("patientAccountId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "RpmAssignment" ADD CONSTRAINT "RpmAssignment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpmAssignment" ADD CONSTRAINT "RpmAssignment_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "DoctorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpmAssignment" ADD CONSTRAINT "RpmAssignment_nurseStaffId_fkey" FOREIGN KEY ("nurseStaffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpmAssignment" ADD CONSTRAINT "RpmAssignment_assignedByStaffId_fkey" FOREIGN KEY ("assignedByStaffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpmReading" ADD CONSTRAINT "RpmReading_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "RpmAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpmReading" ADD CONSTRAINT "RpmReading_patientAccountId_fkey" FOREIGN KEY ("patientAccountId") REFERENCES "PatientAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
