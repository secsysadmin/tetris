-- CreateTable
CREATE TABLE "GoogleConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "googleUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GoogleConnection_userId_key" ON "GoogleConnection"("userId");

-- AddForeignKey
ALTER TABLE "GoogleConnection"
    ADD CONSTRAINT "GoogleConnection_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add columns to Draft
ALTER TABLE "Draft"
    ADD COLUMN "googleSheetUrl" TEXT,
    ADD COLUMN "googleSpreadsheetId" TEXT,
    ADD COLUMN "googleWorksheetName" TEXT,
    ADD COLUMN "googleConnectionId" TEXT;

-- AddForeignKey
ALTER TABLE "Draft"
    ADD CONSTRAINT "Draft_googleConnectionId_fkey"
    FOREIGN KEY ("googleConnectionId") REFERENCES "GoogleConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
