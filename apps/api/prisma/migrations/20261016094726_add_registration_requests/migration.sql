-- CreateTable
CREATE TABLE "PatientRegistrationRequest" (
    "actorStaffId" UUID NOT NULL,
    "key" UUID NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,
    "patientId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientRegistrationRequest_pkey" PRIMARY KEY ("actorStaffId","key")
);

-- CreateIndex
CREATE INDEX "PatientRegistrationRequest_patientId_idx" ON "PatientRegistrationRequest"("patientId");

-- AddForeignKey
ALTER TABLE "PatientRegistrationRequest" ADD CONSTRAINT "PatientRegistrationRequest_actorStaffId_fkey" FOREIGN KEY ("actorStaffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientRegistrationRequest" ADD CONSTRAINT "PatientRegistrationRequest_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
