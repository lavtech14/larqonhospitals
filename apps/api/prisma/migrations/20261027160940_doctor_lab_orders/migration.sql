-- CreateEnum
CREATE TYPE "LabOrderPriority" AS ENUM ('ROUTINE', 'URGENT');

-- CreateEnum
CREATE TYPE "LabOrderStatus" AS ENUM ('ORDERED', 'CANCELLED');

-- CreateTable
CREATE TABLE "LabOrder" (
    "id" UUID NOT NULL,
    "encounterId" UUID NOT NULL,
    "orderedByStaffId" UUID NOT NULL,
    "priority" "LabOrderPriority" NOT NULL DEFAULT 'ROUTINE',
    "status" "LabOrderStatus" NOT NULL DEFAULT 'ORDERED',
    "clinicalReason" VARCHAR(2000) NOT NULL,
    "patientName" VARCHAR(100) NOT NULL,
    "patientMrn" VARCHAR(30) NOT NULL,
    "doctorName" VARCHAR(100) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "orderedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotencyKey" UUID NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,

    CONSTRAINT "LabOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabOrderItem" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "labTestId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "testCode" VARCHAR(40) NOT NULL,
    "testName" VARCHAR(200) NOT NULL,
    "sampleType" VARCHAR(100) NOT NULL,
    "preparationInstructions" VARCHAR(2000),

    CONSTRAINT "LabOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LabOrder_encounterId_orderedAt_idx" ON "LabOrder"("encounterId", "orderedAt");

-- CreateIndex
CREATE INDEX "LabOrder_status_priority_orderedAt_idx" ON "LabOrder"("status", "priority", "orderedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LabOrder_orderedByStaffId_idempotencyKey_key" ON "LabOrder"("orderedByStaffId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "LabOrderItem_labTestId_idx" ON "LabOrderItem"("labTestId");

-- CreateIndex
CREATE UNIQUE INDEX "LabOrderItem_orderId_labTestId_key" ON "LabOrderItem"("orderId", "labTestId");

-- CreateIndex
CREATE UNIQUE INDEX "LabOrderItem_orderId_position_key" ON "LabOrderItem"("orderId", "position");

-- AddForeignKey
ALTER TABLE "LabOrder" ADD CONSTRAINT "LabOrder_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabOrder" ADD CONSTRAINT "LabOrder_orderedByStaffId_fkey" FOREIGN KEY ("orderedByStaffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabOrderItem" ADD CONSTRAINT "LabOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "LabOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabOrderItem" ADD CONSTRAINT "LabOrderItem_labTestId_fkey" FOREIGN KEY ("labTestId") REFERENCES "LabTest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
