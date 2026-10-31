BEGIN;
-- CreateEnum
CREATE TYPE "BillingKind" AS ENUM ('CONSULTATION', 'LAB', 'MEDICINE');

-- CreateEnum
CREATE TYPE "BillingInvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BillingPaymentMethod" AS ENUM ('CASH', 'UPI', 'CARD');

-- CreateTable
CREATE TABLE "BillingPrice" (
    "id" UUID NOT NULL,
    "catalogueKey" VARCHAR(150) NOT NULL,
    "kind" "BillingKind" NOT NULL,
    "doctorId" UUID,
    "labTestId" UUID,
    "medicineId" UUID,
    "displayName" VARCHAR(500) NOT NULL,
    "quantityUnit" VARCHAR(50) NOT NULL,
    "unitPriceMinor" BIGINT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "editedByStaffId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "BillingPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingInvoice" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "patientName" VARCHAR(100) NOT NULL,
    "patientMrn" VARCHAR(30) NOT NULL,
    "invoiceNumber" VARCHAR(40),
    "status" "BillingInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "totalMinor" BIGINT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "notes" VARCHAR(1000),
    "cancellationReason" VARCHAR(1000),
    "createdByStaffId" UUID NOT NULL,
    "issuedByStaffId" UUID,
    "cancelledByStaffId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedAt" TIMESTAMPTZ(3),
    "cancelledAt" TIMESTAMPTZ(3),

    CONSTRAINT "BillingInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingInvoiceLine" (
    "id" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" "BillingKind" NOT NULL,
    "sourceKey" VARCHAR(100) NOT NULL,
    "reservedKey" VARCHAR(100),
    "appointmentId" UUID,
    "labOrderItemId" UUID,
    "dispenseItemId" UUID,
    "description" VARCHAR(500) NOT NULL,
    "quantity" VARCHAR(40) NOT NULL,
    "quantityUnit" VARCHAR(50) NOT NULL,
    "unitPriceMinor" BIGINT NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "priceId" UUID NOT NULL,
    "priceVersion" INTEGER NOT NULL,

    CONSTRAINT "BillingInvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingPayment" (
    "id" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "receiptNumber" VARCHAR(40) NOT NULL,
    "method" "BillingPaymentMethod" NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "externalReference" VARCHAR(100),
    "referenceKey" VARCHAR(110),
    "notes" VARCHAR(1000),
    "recordedByStaffId" UUID NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingCounter" (
    "key" VARCHAR(40) NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "BillingCounter_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "BillingRequest" (
    "id" UUID NOT NULL,
    "actorStaffId" UUID NOT NULL,
    "key" UUID NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingPrice_catalogueKey_key" ON "BillingPrice"("catalogueKey");

-- CreateIndex
CREATE INDEX "BillingPrice_kind_isActive_displayName_idx" ON "BillingPrice"("kind", "isActive", "displayName");

-- CreateIndex
CREATE UNIQUE INDEX "BillingInvoice_invoiceNumber_key" ON "BillingInvoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "BillingInvoice_patientId_createdAt_idx" ON "BillingInvoice"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "BillingInvoice_status_createdAt_idx" ON "BillingInvoice"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingInvoiceLine_reservedKey_key" ON "BillingInvoiceLine"("reservedKey");

-- CreateIndex
CREATE INDEX "BillingInvoiceLine_appointmentId_idx" ON "BillingInvoiceLine"("appointmentId");

-- CreateIndex
CREATE INDEX "BillingInvoiceLine_labOrderItemId_idx" ON "BillingInvoiceLine"("labOrderItemId");

-- CreateIndex
CREATE INDEX "BillingInvoiceLine_dispenseItemId_idx" ON "BillingInvoiceLine"("dispenseItemId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingInvoiceLine_invoiceId_position_key" ON "BillingInvoiceLine"("invoiceId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "BillingPayment_receiptNumber_key" ON "BillingPayment"("receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "BillingPayment_referenceKey_key" ON "BillingPayment"("referenceKey");

-- CreateIndex
CREATE INDEX "BillingPayment_invoiceId_recordedAt_idx" ON "BillingPayment"("invoiceId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingRequest_actorStaffId_key_key" ON "BillingRequest"("actorStaffId", "key");

-- AddForeignKey
ALTER TABLE "BillingPrice" ADD CONSTRAINT "BillingPrice_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "DoctorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPrice" ADD CONSTRAINT "BillingPrice_labTestId_fkey" FOREIGN KEY ("labTestId") REFERENCES "LabTest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPrice" ADD CONSTRAINT "BillingPrice_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "Medicine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPrice" ADD CONSTRAINT "BillingPrice_editedByStaffId_fkey" FOREIGN KEY ("editedByStaffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingInvoice" ADD CONSTRAINT "BillingInvoice_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingInvoice" ADD CONSTRAINT "BillingInvoice_createdByStaffId_fkey" FOREIGN KEY ("createdByStaffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingInvoice" ADD CONSTRAINT "BillingInvoice_issuedByStaffId_fkey" FOREIGN KEY ("issuedByStaffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingInvoice" ADD CONSTRAINT "BillingInvoice_cancelledByStaffId_fkey" FOREIGN KEY ("cancelledByStaffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingInvoiceLine" ADD CONSTRAINT "BillingInvoiceLine_priceId_fkey" FOREIGN KEY ("priceId") REFERENCES "BillingPrice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingInvoiceLine" ADD CONSTRAINT "BillingInvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "BillingInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingInvoiceLine" ADD CONSTRAINT "BillingInvoiceLine_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingInvoiceLine" ADD CONSTRAINT "BillingInvoiceLine_labOrderItemId_fkey" FOREIGN KEY ("labOrderItemId") REFERENCES "LabOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingInvoiceLine" ADD CONSTRAINT "BillingInvoiceLine_dispenseItemId_fkey" FOREIGN KEY ("dispenseItemId") REFERENCES "PharmacyDispenseItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPayment" ADD CONSTRAINT "BillingPayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "BillingInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPayment" ADD CONSTRAINT "BillingPayment_recordedByStaffId_fkey" FOREIGN KEY ("recordedByStaffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingRequest" ADD CONSTRAINT "BillingRequest_actorStaffId_fkey" FOREIGN KEY ("actorStaffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BillingPrice" ADD CONSTRAINT "BillingPrice_money" CHECK ("unitPriceMinor" BETWEEN 0 AND 999999999999);
ALTER TABLE "BillingPrice" ADD CONSTRAINT "BillingPrice_source" CHECK ((kind='CONSULTATION' AND "doctorId" IS NOT NULL AND "labTestId" IS NULL AND "medicineId" IS NULL) OR (kind='LAB' AND "labTestId" IS NOT NULL AND "doctorId" IS NULL AND "medicineId" IS NULL) OR (kind='MEDICINE' AND "medicineId" IS NOT NULL AND "doctorId" IS NULL AND "labTestId" IS NULL));
ALTER TABLE "BillingInvoice" ADD CONSTRAINT "BillingInvoice_money" CHECK (currency='INR' AND "totalMinor" BETWEEN 0 AND 999999999999 AND version > 0);
ALTER TABLE "BillingInvoice" ADD CONSTRAINT "BillingInvoice_issued_identity" CHECK (status <> 'ISSUED' OR ("invoiceNumber" IS NOT NULL AND "issuedAt" IS NOT NULL AND "issuedByStaffId" IS NOT NULL));
ALTER TABLE "BillingInvoiceLine" ADD CONSTRAINT "BillingInvoiceLine_money" CHECK ("unitPriceMinor" BETWEEN 0 AND 999999999999 AND "amountMinor" BETWEEN 0 AND 999999999999);
ALTER TABLE "BillingInvoiceLine" ADD CONSTRAINT "BillingInvoiceLine_source" CHECK ((kind='CONSULTATION' AND "appointmentId" IS NOT NULL AND "labOrderItemId" IS NULL AND "dispenseItemId" IS NULL) OR (kind='LAB' AND "labOrderItemId" IS NOT NULL AND "appointmentId" IS NULL AND "dispenseItemId" IS NULL) OR (kind='MEDICINE' AND "dispenseItemId" IS NOT NULL AND "appointmentId" IS NULL AND "labOrderItemId" IS NULL));
ALTER TABLE "BillingInvoiceLine" ADD CONSTRAINT "BillingInvoiceLine_reservation" CHECK ("reservedKey" IS NULL OR "reservedKey"="sourceKey");
ALTER TABLE "BillingPayment" ADD CONSTRAINT "BillingPayment_money" CHECK ("amountMinor" BETWEEN 1 AND 999999999999);
ALTER TABLE "BillingPayment" ADD CONSTRAINT "BillingPayment_reference" CHECK ((method='CASH' AND "externalReference" IS NULL AND "referenceKey" IS NULL) OR (method IN ('UPI','CARD') AND "externalReference" IS NOT NULL AND length(btrim("externalReference"))>0 AND "referenceKey"=method::text||':'||"externalReference"));
ALTER TABLE "BillingCounter" ADD CONSTRAINT "BillingCounter_positive" CHECK (value > 0);
COMMIT;
