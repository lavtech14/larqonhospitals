BEGIN;

-- AlterTable
ALTER TABLE "LabTest" ADD COLUMN     "parameters" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "LabOrder" ADD COLUMN     "cancellationReason" VARCHAR(1000),
ADD COLUMN     "cancelledAt" TIMESTAMPTZ(3),
ADD COLUMN     "cancelledByStaffId" UUID;

-- AlterTable
ALTER TABLE "LabOrderItem" ADD COLUMN     "parameters" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "LabResultRevision" ADD COLUMN     "values" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "LabReleasedReport" ADD COLUMN     "values" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "LabOrderCancellation" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "actorStaffId" UUID NOT NULL,
    "idempotencyKey" UUID NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabOrderCancellation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LabOrderCancellation_orderId_key" ON "LabOrderCancellation"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "LabOrderCancellation_actorStaffId_idempotencyKey_key" ON "LabOrderCancellation"("actorStaffId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "LabOrder" ADD CONSTRAINT "LabOrder_cancelledByStaffId_fkey" FOREIGN KEY ("cancelledByStaffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabOrderCancellation" ADD CONSTRAINT "LabOrderCancellation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "LabOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabOrderCancellation" ADD CONSTRAINT "LabOrderCancellation_actorStaffId_fkey" FOREIGN KEY ("actorStaffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
