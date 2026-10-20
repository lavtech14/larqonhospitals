-- CreateEnum
CREATE TYPE "PatientPhoneOwner" AS ENUM ('PATIENT', 'GUARDIAN', 'OTHER', 'UNKNOWN');

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "contactEmail" VARCHAR(254),
ADD COLUMN     "emergencyContactName" VARCHAR(100),
ADD COLUMN     "emergencyContactPhone" VARCHAR(20),
ADD COLUMN     "emergencyContactRelationship" VARCHAR(50),
ADD COLUMN     "guardianName" VARCHAR(100),
ADD COLUMN     "guardianPhone" VARCHAR(20),
ADD COLUMN     "guardianRelationship" VARCHAR(50),
ADD COLUMN     "phoneContactName" VARCHAR(100),
ADD COLUMN     "phoneOwner" "PatientPhoneOwner" NOT NULL DEFAULT 'UNKNOWN';
