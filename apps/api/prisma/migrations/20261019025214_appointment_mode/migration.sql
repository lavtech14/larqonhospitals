-- CreateEnum
CREATE TYPE "AppointmentMode" AS ENUM ('IN_PERSON', 'ONLINE');

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "mode" "AppointmentMode" NOT NULL DEFAULT 'IN_PERSON';
