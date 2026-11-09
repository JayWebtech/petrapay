-- AlterEnum
ALTER TYPE "InvoiceSource" ADD VALUE 'POS';

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "posDeviceId" TEXT;

-- CreateTable
CREATE TABLE "PosDevice" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PosDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosPairingCode" (
    "codeHash" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PosPairingCode_pkey" PRIMARY KEY ("codeHash")
);

-- CreateIndex
CREATE UNIQUE INDEX "PosDevice_tokenHash_key" ON "PosDevice"("tokenHash");

-- CreateIndex
CREATE INDEX "PosDevice_creatorId_idx" ON "PosDevice"("creatorId");

-- CreateIndex
CREATE INDEX "PosPairingCode_creatorId_idx" ON "PosPairingCode"("creatorId");

-- CreateIndex
CREATE INDEX "Invoice_posDeviceId_createdAt_idx" ON "Invoice"("posDeviceId", "createdAt");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_posDeviceId_fkey" FOREIGN KEY ("posDeviceId") REFERENCES "PosDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosDevice" ADD CONSTRAINT "PosDevice_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosPairingCode" ADD CONSTRAINT "PosPairingCode_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
