-- CreateTable
CREATE TABLE "DoctorProfile" (
    "id" UUID NOT NULL,
    "displayName" VARCHAR(100) NOT NULL,
    "specialty" VARCHAR(100) NOT NULL,
    "qualification" VARCHAR(200),
    "registrationNumber" VARCHAR(100),
    "registrationAuthority" VARCHAR(100),
    "departmentId" UUID NOT NULL,
    "staffUserId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "DoctorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DoctorProfile_staffUserId_key" ON "DoctorProfile"("staffUserId");

-- CreateIndex
CREATE INDEX "DoctorProfile_departmentId_isActive_idx" ON "DoctorProfile"("departmentId", "isActive");

-- AddForeignKey
ALTER TABLE "DoctorProfile" ADD CONSTRAINT "DoctorProfile_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorProfile" ADD CONSTRAINT "DoctorProfile_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
