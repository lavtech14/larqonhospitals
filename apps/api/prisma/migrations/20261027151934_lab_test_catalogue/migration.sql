-- CreateTable
CREATE TABLE "LabTest" (
    "id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "displayName" VARCHAR(200) NOT NULL,
    "sampleType" VARCHAR(100) NOT NULL,
    "preparationInstructions" VARCHAR(2000),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "LabTest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LabTest_code_key" ON "LabTest"("code");

-- CreateIndex
CREATE INDEX "LabTest_displayName_idx" ON "LabTest"("displayName");

-- CreateIndex
CREATE INDEX "LabTest_isActive_displayName_idx" ON "LabTest"("isActive", "displayName");
