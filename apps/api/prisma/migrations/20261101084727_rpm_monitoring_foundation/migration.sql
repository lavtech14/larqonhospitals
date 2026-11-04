-- CreateEnum
CREATE TYPE "RpmEnrollmentStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RpmMetric" AS ENUM ('WEIGHT', 'TEMPERATURE', 'SYSTOLIC_BP', 'DIASTOLIC_BP', 'SPO2', 'BLOOD_GLUCOSE', 'PULSE');

-- CreateEnum
CREATE TYPE "RpmReadingContext" AS ENUM ('GENERAL', 'FASTING', 'BEFORE_MEAL', 'AFTER_MEAL', 'RANDOM');

-- CreateEnum
CREATE TYPE "RpmUnit" AS ENUM ('KG', 'CELSIUS', 'MMHG', 'PERCENT', 'MG_DL', 'BPM');

-- CreateEnum
CREATE TYPE "RpmRuleDirection" AS ENUM ('LOW', 'HIGH');

-- CreateEnum
CREATE TYPE "RpmAlertSeverity" AS ENUM ('WARNING', 'URGENT');

-- CreateTable
CREATE TABLE "RpmEnrollment" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "doctorId" UUID NOT NULL,
    "createdByStaffId" UUID NOT NULL,
    "status" "RpmEnrollmentStatus" NOT NULL DEFAULT 'DRAFT',
    "reason" VARCHAR(2000) NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3),
    "patientAgreedAt" TIMESTAMPTZ(3),
    "statusReason" VARCHAR(1000),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RpmEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RpmCareTeamMember" (
    "id" UUID NOT NULL,
    "enrollmentId" UUID NOT NULL,
    "staffUserId" UUID NOT NULL,
    "assignedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMPTZ(3),

    CONSTRAINT "RpmCareTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RpmPlanVersion" (
    "id" UUID NOT NULL,
    "enrollmentId" UUID NOT NULL,
    "approvedByStaffId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMPTZ(3) NOT NULL,
    "reviewDueAt" TIMESTAMPTZ(3) NOT NULL,
    "timeZone" VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
    "patientInstructions" VARCHAR(5000) NOT NULL,
    "monitoringHours" VARCHAR(1000) NOT NULL,
    "contactInstructions" VARCHAR(2000) NOT NULL,
    "emergencyInstructions" VARCHAR(2000) NOT NULL,
    "approvedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotencyKey" UUID NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,

    CONSTRAINT "RpmPlanVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RpmPlanParameter" (
    "id" UUID NOT NULL,
    "planVersionId" UUID NOT NULL,
    "metric" "RpmMetric" NOT NULL,
    "context" "RpmReadingContext" NOT NULL DEFAULT 'GENERAL',
    "unit" "RpmUnit" NOT NULL,
    "intervalDays" INTEGER NOT NULL,
    "readingsPerInterval" INTEGER NOT NULL,
    "instructions" VARCHAR(2000),

    CONSTRAINT "RpmPlanParameter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RpmThresholdRule" (
    "id" UUID NOT NULL,
    "parameterId" UUID NOT NULL,
    "direction" "RpmRuleDirection" NOT NULL,
    "severity" "RpmAlertSeverity" NOT NULL,
    "boundary" DECIMAL(10,3) NOT NULL,
    "inclusive" BOOLEAN NOT NULL DEFAULT false,
    "patientMessage" VARCHAR(2000) NOT NULL,

    CONSTRAINT "RpmThresholdRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RpmEnrollment_patientId_status_idx" ON "RpmEnrollment"("patientId", "status");

-- CreateIndex
CREATE INDEX "RpmEnrollment_doctorId_status_idx" ON "RpmEnrollment"("doctorId", "status");

-- CreateIndex
CREATE INDEX "RpmCareTeamMember_enrollmentId_removedAt_idx" ON "RpmCareTeamMember"("enrollmentId", "removedAt");

-- CreateIndex
CREATE INDEX "RpmCareTeamMember_staffUserId_removedAt_idx" ON "RpmCareTeamMember"("staffUserId", "removedAt");

-- CreateIndex
CREATE INDEX "RpmPlanVersion_enrollmentId_effectiveFrom_idx" ON "RpmPlanVersion"("enrollmentId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "RpmPlanVersion_enrollmentId_revision_key" ON "RpmPlanVersion"("enrollmentId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "RpmPlanVersion_approvedByStaffId_idempotencyKey_key" ON "RpmPlanVersion"("approvedByStaffId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "RpmPlanParameter_planVersionId_metric_context_key" ON "RpmPlanParameter"("planVersionId", "metric", "context");

-- CreateIndex
CREATE UNIQUE INDEX "RpmThresholdRule_parameterId_direction_severity_key" ON "RpmThresholdRule"("parameterId", "direction", "severity");

-- AddForeignKey
ALTER TABLE "RpmEnrollment" ADD CONSTRAINT "RpmEnrollment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpmEnrollment" ADD CONSTRAINT "RpmEnrollment_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "DoctorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpmEnrollment" ADD CONSTRAINT "RpmEnrollment_createdByStaffId_fkey" FOREIGN KEY ("createdByStaffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpmCareTeamMember" ADD CONSTRAINT "RpmCareTeamMember_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "RpmEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpmCareTeamMember" ADD CONSTRAINT "RpmCareTeamMember_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpmPlanVersion" ADD CONSTRAINT "RpmPlanVersion_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "RpmEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpmPlanVersion" ADD CONSTRAINT "RpmPlanVersion_approvedByStaffId_fkey" FOREIGN KEY ("approvedByStaffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpmPlanParameter" ADD CONSTRAINT "RpmPlanParameter_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "RpmPlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpmThresholdRule" ADD CONSTRAINT "RpmThresholdRule_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "RpmPlanParameter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
