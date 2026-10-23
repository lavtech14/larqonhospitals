-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "consultationEndedAt" TIMESTAMPTZ(3),
ADD COLUMN     "consultationRoomClosedAt" TIMESTAMPTZ(3);
