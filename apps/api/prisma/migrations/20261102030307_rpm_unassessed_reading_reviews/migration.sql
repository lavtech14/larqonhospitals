-- CreateTable
CREATE TABLE "RpmObservationReview" (
    "id" UUID NOT NULL,
    "observationId" UUID NOT NULL,
    "actorStaffId" UUID NOT NULL,
    "internalNote" VARCHAR(5000) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotencyKey" UUID NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,

    CONSTRAINT "RpmObservationReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RpmObservationReview_observationId_key" ON "RpmObservationReview"("observationId");

-- CreateIndex
CREATE INDEX "RpmObservationReview_actorStaffId_createdAt_idx" ON "RpmObservationReview"("actorStaffId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RpmObservationReview_actorStaffId_idempotencyKey_key" ON "RpmObservationReview"("actorStaffId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "RpmObservationReview" ADD CONSTRAINT "RpmObservationReview_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "RpmObservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RpmObservationReview" ADD CONSTRAINT "RpmObservationReview_actorStaffId_fkey" FOREIGN KEY ("actorStaffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
