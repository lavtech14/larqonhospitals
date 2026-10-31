BEGIN;
/*
  Warnings:

  - A unique constraint covering the columns `[currentSampleId]` on the table `LabOrderItem` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "LabSample_orderItemId_key";

-- AlterTable
ALTER TABLE "LabOrderItem" ADD COLUMN     "currentSampleId" UUID;

-- CreateTable
CREATE TABLE "LabSampleRejection" (
    "id" UUID NOT NULL,
    "sampleId" UUID NOT NULL,
    "rejectedByStaffId" UUID NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "rejectedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotencyKey" UUID NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,

    CONSTRAINT "LabSampleRejection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LabSampleRejection_sampleId_key" ON "LabSampleRejection"("sampleId");

-- CreateIndex
CREATE INDEX "LabSampleRejection_rejectedByStaffId_rejectedAt_idx" ON "LabSampleRejection"("rejectedByStaffId", "rejectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LabSampleRejection_rejectedByStaffId_idempotencyKey_key" ON "LabSampleRejection"("rejectedByStaffId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "LabOrderItem_currentSampleId_key" ON "LabOrderItem"("currentSampleId");

-- CreateIndex
CREATE INDEX "LabSample_orderItemId_recordedAt_idx" ON "LabSample"("orderItemId", "recordedAt");

-- AddForeignKey
ALTER TABLE "LabOrderItem" ADD CONSTRAINT "LabOrderItem_currentSampleId_fkey" FOREIGN KEY ("currentSampleId") REFERENCES "LabSample"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabSampleRejection" ADD CONSTRAINT "LabSampleRejection_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "LabSample"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabSampleRejection" ADD CONSTRAINT "LabSampleRejection_rejectedByStaffId_fkey" FOREIGN KEY ("rejectedByStaffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve the current specimen for every previously collected test.
UPDATE "LabOrderItem" AS item
SET "currentSampleId" = sample."id"
FROM "LabSample" AS sample
WHERE sample."orderItemId" = item."id"
  AND item."currentSampleId" IS NULL;

-- Fail rather than leave an existing specimen disconnected.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "LabSample" AS sample
    JOIN "LabOrderItem" AS item
      ON item."id" = sample."orderItemId"
    WHERE item."currentSampleId" IS DISTINCT FROM sample."id"
  ) THEN
    RAISE EXCEPTION 'Existing specimen backfill failed';
  END IF;
END $$;

COMMIT;