-- CreateTable
CREATE TABLE "DoctorAvailability" (
    "doctorId" UUID NOT NULL,
    "timeZone" VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "DoctorAvailability_pkey" PRIMARY KEY ("doctorId")
);

-- CreateTable
CREATE TABLE "DoctorAvailabilityWindow" (
    "id" UUID NOT NULL,
    "doctorId" UUID NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "slotMinutes" INTEGER NOT NULL,

    CONSTRAINT "DoctorAvailabilityWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorAvailabilityBreak" (
    "id" UUID NOT NULL,
    "windowId" UUID NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,

    CONSTRAINT "DoctorAvailabilityBreak_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DoctorAvailabilityWindow_doctorId_dayOfWeek_startMinute_idx" ON "DoctorAvailabilityWindow"("doctorId", "dayOfWeek", "startMinute");

-- CreateIndex
CREATE INDEX "DoctorAvailabilityBreak_windowId_idx" ON "DoctorAvailabilityBreak"("windowId");

-- AddForeignKey
ALTER TABLE "DoctorAvailability" ADD CONSTRAINT "DoctorAvailability_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "DoctorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorAvailabilityWindow" ADD CONSTRAINT "DoctorAvailabilityWindow_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "DoctorAvailability"("doctorId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorAvailabilityBreak" ADD CONSTRAINT "DoctorAvailabilityBreak_windowId_fkey" FOREIGN KEY ("windowId") REFERENCES "DoctorAvailabilityWindow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
