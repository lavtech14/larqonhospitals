-- CreateTable
CREATE TABLE "DoctorDateClosure" (
    "id" UUID NOT NULL,
    "doctorId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "DoctorDateClosure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalDateClosure" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "HospitalDateClosure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DoctorDateClosure_doctorId_date_key" ON "DoctorDateClosure"("doctorId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "HospitalDateClosure_date_key" ON "HospitalDateClosure"("date");

-- AddForeignKey
ALTER TABLE "DoctorDateClosure" ADD CONSTRAINT "DoctorDateClosure_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "DoctorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
