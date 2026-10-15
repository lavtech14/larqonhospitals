-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('ADMIN', 'RECEPTIONIST', 'DOCTOR', 'NURSE', 'LAB_TECHNICIAN', 'LAB_REVIEWER', 'PHARMACIST', 'BILLING');

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "addressLine1" VARCHAR(200),
ADD COLUMN     "addressLine2" VARCHAR(200),
ADD COLUMN     "city" VARCHAR(100),
ADD COLUMN     "countryCode" CHAR(2),
ADD COLUMN     "district" VARCHAR(100),
ADD COLUMN     "postalCode" VARCHAR(20),
ADD COLUMN     "state" VARCHAR(100);

-- CreateTable
CREATE TABLE "StaffUser" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "fullName" VARCHAR(100) NOT NULL,
    "addressLine1" VARCHAR(200),
    "addressLine2" VARCHAR(200),
    "city" VARCHAR(100),
    "district" VARCHAR(100),
    "state" VARCHAR(100),
    "postalCode" VARCHAR(20),
    "countryCode" CHAR(2),
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "passwordChangedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "StaffUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffUserRole" (
    "staffUserId" UUID NOT NULL,
    "role" "StaffRole" NOT NULL,
    "assignedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffUserRole_pkey" PRIMARY KEY ("staffUserId","role")
);

-- CreateTable
CREATE TABLE "StaffSession" (
    "id" UUID NOT NULL,
    "staffUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),

    CONSTRAINT "StaffSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffRefreshToken" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "usedAt" TIMESTAMPTZ(3),

    CONSTRAINT "StaffRefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffUser_email_key" ON "StaffUser"("email");

-- CreateIndex
CREATE INDEX "StaffSession_staffUserId_idx" ON "StaffSession"("staffUserId");

-- CreateIndex
CREATE INDEX "StaffSession_expiresAt_idx" ON "StaffSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "StaffRefreshToken_tokenHash_key" ON "StaffRefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "StaffRefreshToken_sessionId_idx" ON "StaffRefreshToken"("sessionId");

-- CreateIndex
CREATE INDEX "StaffRefreshToken_expiresAt_idx" ON "StaffRefreshToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "StaffUserRole" ADD CONSTRAINT "StaffUserRole_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffSession" ADD CONSTRAINT "StaffSession_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffRefreshToken" ADD CONSTRAINT "StaffRefreshToken_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StaffSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
