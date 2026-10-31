-- AlterEnum
ALTER TYPE "LabOrderStatus" ADD VALUE 'COLLECTED';

-- CreateTable
CREATE TABLE "LabSample" (
    "id" UUID NOT NULL,
    "orderItemId" UUID NOT NULL,
    "specimenReference" VARCHAR(50) NOT NULL,
    "collectedAt" TIMESTAMPTZ(3) NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "collectedByStaffId" UUID NOT NULL,
    "idempotencyKey" UUID NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,

    CONSTRAINT "LabSample_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LabSample_orderItemId_key" ON "LabSample"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "LabSample_specimenReference_key" ON "LabSample"("specimenReference");

-- CreateIndex
CREATE INDEX "LabSample_collectedByStaffId_collectedAt_idx" ON "LabSample"("collectedByStaffId", "collectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LabSample_collectedByStaffId_idempotencyKey_key" ON "LabSample"("collectedByStaffId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "LabSample" ADD CONSTRAINT "LabSample_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "LabOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabSample" ADD CONSTRAINT "LabSample_collectedByStaffId_fkey" FOREIGN KEY ("collectedByStaffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
