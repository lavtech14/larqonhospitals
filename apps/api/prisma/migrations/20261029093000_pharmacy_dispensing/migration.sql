BEGIN;
-- CreateTable
CREATE TABLE IF NOT EXISTS "PharmacyStockLot" (
    "id" UUID NOT NULL,
    "medicineId" UUID NOT NULL,
    "batchNumber" VARCHAR(100) NOT NULL,
    "expiryDate" DATE NOT NULL,
    "receivedQuantity" DECIMAL(12,2) NOT NULL,
    "quantityUnit" VARCHAR(50) NOT NULL,
    "supplierName" VARCHAR(200),
    "reference" VARCHAR(100),
    "medicineName" VARCHAR(200),
    "strength" VARCHAR(100),
    "dosageForm" VARCHAR(100),
    "receivedByStaffId" UUID NOT NULL,
    "idempotencyKey" UUID NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PharmacyStockLot_pkey" PRIMARY KEY ("id")
);


-- Earlier stock-only receipts lack immutable medicine metadata. Preserve them
-- without inventing historical values; the dispensing API blocks those lots.
ALTER TABLE "PharmacyStockLot" ADD COLUMN IF NOT EXISTS "medicineName" VARCHAR(200), ADD COLUMN IF NOT EXISTS "strength" VARCHAR(100), ADD COLUMN IF NOT EXISTS "dosageForm" VARCHAR(100);

-- CreateTable
CREATE TABLE "PharmacyDispense" (
    "id" UUID NOT NULL,
    "prescriptionId" UUID NOT NULL,
    "dispensedByStaffId" UUID NOT NULL,
    "idempotencyKey" UUID NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,
    "patientName" VARCHAR(100) NOT NULL,
    "patientMrn" VARCHAR(30) NOT NULL,
    "notes" VARCHAR(1000),
    "dispensedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PharmacyDispense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PharmacyDispenseItem" (
    "id" UUID NOT NULL,
    "dispenseId" UUID NOT NULL,
    "prescriptionItemId" UUID NOT NULL,
    "stockLotId" UUID NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "quantityUnit" VARCHAR(50) NOT NULL,
    "medicineName" VARCHAR(200) NOT NULL,
    "strength" VARCHAR(100) NOT NULL,
    "dosageForm" VARCHAR(100) NOT NULL,
    "batchNumber" VARCHAR(100) NOT NULL,
    "expiryDate" DATE NOT NULL,

    CONSTRAINT "PharmacyDispenseItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PharmacyStockLot_medicineId_expiryDate_idx" ON "PharmacyStockLot"("medicineId", "expiryDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PharmacyStockLot_receivedAt_id_idx" ON "PharmacyStockLot"("receivedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PharmacyStockLot_receivedByStaffId_idempotencyKey_key" ON "PharmacyStockLot"("receivedByStaffId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "PharmacyDispense_prescriptionId_dispensedAt_idx" ON "PharmacyDispense"("prescriptionId", "dispensedAt");

-- CreateIndex
CREATE INDEX "PharmacyDispense_dispensedAt_id_idx" ON "PharmacyDispense"("dispensedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "PharmacyDispense_dispensedByStaffId_idempotencyKey_key" ON "PharmacyDispense"("dispensedByStaffId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "PharmacyDispenseItem_prescriptionItemId_idx" ON "PharmacyDispenseItem"("prescriptionItemId");

-- CreateIndex
CREATE INDEX "PharmacyDispenseItem_stockLotId_idx" ON "PharmacyDispenseItem"("stockLotId");

-- CreateIndex
CREATE UNIQUE INDEX "PharmacyDispenseItem_dispenseId_prescriptionItemId_stockLot_key" ON "PharmacyDispenseItem"("dispenseId", "prescriptionItemId", "stockLotId");

-- AddForeignKey
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PharmacyStockLot_medicineId_fkey' AND conrelid = '"PharmacyStockLot"'::regclass) THEN ALTER TABLE "PharmacyStockLot" ADD CONSTRAINT "PharmacyStockLot_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "Medicine"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;

-- AddForeignKey
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PharmacyStockLot_receivedByStaffId_fkey' AND conrelid = '"PharmacyStockLot"'::regclass) THEN ALTER TABLE "PharmacyStockLot" ADD CONSTRAINT "PharmacyStockLot_receivedByStaffId_fkey" FOREIGN KEY ("receivedByStaffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;

-- AddForeignKey
ALTER TABLE "PharmacyDispense" ADD CONSTRAINT "PharmacyDispense_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyDispense" ADD CONSTRAINT "PharmacyDispense_dispensedByStaffId_fkey" FOREIGN KEY ("dispensedByStaffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyDispenseItem" ADD CONSTRAINT "PharmacyDispenseItem_dispenseId_fkey" FOREIGN KEY ("dispenseId") REFERENCES "PharmacyDispense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyDispenseItem" ADD CONSTRAINT "PharmacyDispenseItem_prescriptionItemId_fkey" FOREIGN KEY ("prescriptionItemId") REFERENCES "PrescriptionItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyDispenseItem" ADD CONSTRAINT "PharmacyDispenseItem_stockLotId_fkey" FOREIGN KEY ("stockLotId") REFERENCES "PharmacyStockLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PharmacyStockLot" ADD CONSTRAINT "PharmacyStockLot_positive_quantity" CHECK ("receivedQuantity" > 0);
ALTER TABLE "PharmacyDispenseItem" ADD CONSTRAINT "PharmacyDispenseItem_positive_quantity" CHECK (quantity > 0);
COMMIT;
