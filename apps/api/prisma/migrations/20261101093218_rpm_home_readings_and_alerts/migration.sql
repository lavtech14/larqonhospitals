-- CreateEnum
CREATE TYPE "RpmAssessment" AS ENUM ('WITHIN_CONFIGURED_RANGE', 'LOW', 'HIGH', 'URGENT', 'NOT_ASSESSED');

-- CreateEnum
CREATE TYPE "RpmAlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "RpmReviewAction" AS ENUM ('NOTE', 'ACKNOWLEDGE', 'RESOLVE');

-- CreateEnum
CREATE TYPE "RpmResolutionOutcome" AS ENUM ('CLINICAL_ACTION_RECORDED', 'INVALID_READING', 'NO_FURTHER_ACTION');

-- CreateTable
CREATE TABLE "RpmSubmission" (
    "id" UUID NOT NULL,
    "enrollmentId" UUID NOT NULL,
    "planVersionId" UUID NOT NULL,
    "patientAccountId" UUID NOT NULL,
    "measuredAt" TIMESTAMPTZ(3) NOT NULL,
    "submittedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "symptoms" VARCHAR(2000),
    "notes" VARCHAR(2000),
    "planSnapshot" JSONB NOT NULL,
    "idempotencyKey" UUID NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,
    "replacesSubmissionId" UUID,
    "correctionReason" VARCHAR(1000),

    CONSTRAINT "RpmSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RpmObservation" (
    "id" UUID NOT NULL,
    "submissionId" UUID NOT NULL,
    "planParameterId" UUID NOT NULL,
    "metric" "RpmMetric" NOT NULL,
    "context" "RpmReadingContext" NOT NULL,
    "unit" "RpmUnit" NOT NULL,
    "value" DECIMAL(10,3) NOT NULL,
    "measurementMethod" VARCHAR(100),
    "deviceDescription" VARCHAR(200),
    "supplementalOxygen" BOOLEAN,
    "resting" BOOLEAN,
    "minutesAfterMeal" INTEGER,
    "assessment" "RpmAssessment" NOT NULL DEFAULT 'NOT_ASSESSED',
    "evaluatedRulesSnapshot" JSONB NOT NULL,

    CONSTRAINT "RpmObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RpmAlert" (
    "id" UUID NOT NULL,
    "observationId" UUID NOT NULL,
    "thresholdRuleId" UUID NOT NULL,
    "severity" "RpmAlertSeverity" NOT NULL,
    "direction" "RpmRuleDirection" NOT NULL,
    "boundary" DECIMAL(10,3) NOT NULL,
    "inclusive" BOOLEAN NOT NULL,
    "patientMessage" VARCHAR(2000) NOT NULL,
    "status" "RpmAlertStatus" NOT NULL DEFAULT 'OPEN',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMPTZ(3),
    "resolvedAt" TIMESTAMPTZ(3),

    CONSTRAINT "RpmAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RpmReview" (
    "id" UUID NOT NULL,
    "alertId" UUID NOT NULL,
    "actorStaffId" UUID NOT NULL,
    "action" "RpmReviewAction" NOT NULL,
    "resolutionOutcome" "RpmResolutionOutcome",
    "internalNote" VARCHAR(5000) NOT NULL,
    "patientFeedback" VARCHAR(2000),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotencyKey" UUID NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,

    CONSTRAINT "RpmReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RpmSubmission_replacesSubmissionId_key" ON "RpmSubmission"("replacesSubmissionId");

-- CreateIndex
CREATE INDEX "RpmSubmission_enrollmentId_measuredAt_id_idx" ON "RpmSubmission"("enrollmentId", "measuredAt", "id");

-- CreateIndex
CREATE INDEX "RpmSubmission_patientAccountId_submittedAt_idx" ON "RpmSubmission"("patientAccountId", "submittedAt");

-- CreateIndex
CREATE INDEX "RpmSubmission_planVersionId_idx" ON "RpmSubmission"("planVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "RpmSubmission_patientAccountId_idempotencyKey_key" ON "RpmSubmission"("patientAccountId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "RpmObservation_planParameterId_idx" ON "RpmObservation"("planParameterId");

-- CreateIndex
CREATE UNIQUE INDEX "RpmObservation_submissionId_metric_context_key" ON "RpmObservation"("submissionId", "metric", "context");

-- CreateIndex
CREATE INDEX "RpmAlert_status_severity_createdAt_idx" ON "RpmAlert"("status", "severity", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RpmAlert_observationId_thresholdRuleId_key" ON "RpmAlert"("observationId", "thresholdRuleId");

-- CreateIndex
CREATE INDEX "RpmReview_alertId_createdAt_idx" ON "RpmReview"("alertId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RpmReview_actorStaffId_idempotencyKey_key" ON "RpmReview"("actorStaffId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "RpmSubmission" ADD CONSTRAINT "RpmSubmission_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "RpmEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpmSubmission" ADD CONSTRAINT "RpmSubmission_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "RpmPlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpmSubmission" ADD CONSTRAINT "RpmSubmission_patientAccountId_fkey" FOREIGN KEY ("patientAccountId") REFERENCES "PatientAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpmSubmission" ADD CONSTRAINT "RpmSubmission_replacesSubmissionId_fkey" FOREIGN KEY ("replacesSubmissionId") REFERENCES "RpmSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpmObservation" ADD CONSTRAINT "RpmObservation_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "RpmSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpmObservation" ADD CONSTRAINT "RpmObservation_planParameterId_fkey" FOREIGN KEY ("planParameterId") REFERENCES "RpmPlanParameter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpmAlert" ADD CONSTRAINT "RpmAlert_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "RpmObservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpmAlert" ADD CONSTRAINT "RpmAlert_thresholdRuleId_fkey" FOREIGN KEY ("thresholdRuleId") REFERENCES "RpmThresholdRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpmReview" ADD CONSTRAINT "RpmReview_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "RpmAlert"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpmReview" ADD CONSTRAINT "RpmReview_actorStaffId_fkey" FOREIGN KEY ("actorStaffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
