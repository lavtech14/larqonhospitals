-- CreateEnum
CREATE TYPE "AdministrativeSex" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'UNKNOWN');

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "administrativeSex" "AdministrativeSex" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "dateOfBirth" DATE;
