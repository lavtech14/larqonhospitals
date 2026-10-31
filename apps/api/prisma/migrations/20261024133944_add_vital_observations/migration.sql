-- CreateTable
CREATE TABLE "VitalObservation" (
    "id" UUID NOT NULL,
    "encounterId" UUID NOT NULL,
    "temperatureC" DECIMAL(5,2),
    "pulseBpm" INTEGER,
    "respiratoryRate" INTEGER,
    "systolicBp" INTEGER,
    "diastolicBp" INTEGER,
    "oxygenSaturation" DECIMAL(5,2),
    "weightKg" DECIMAL(6,2),
    "heightCm" DECIMAL(6,2),
    "measuredAt" TIMESTAMPTZ(3) NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedByStaffId" UUID NOT NULL,
    "notes" VARCHAR(1000),
    "idempotencyKey" UUID NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,

    CONSTRAINT "VitalObservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VitalObservation_encounterId_measuredAt_id_idx" ON "VitalObservation"("encounterId", "measuredAt", "id");

-- CreateIndex
CREATE INDEX "VitalObservation_recordedByStaffId_recordedAt_idx" ON "VitalObservation"("recordedByStaffId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "VitalObservation_recordedByStaffId_idempotencyKey_key" ON "VitalObservation"("recordedByStaffId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "VitalObservation" ADD CONSTRAINT "VitalObservation_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VitalObservation" ADD CONSTRAINT "VitalObservation_recordedByStaffId_fkey" FOREIGN KEY ("recordedByStaffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
