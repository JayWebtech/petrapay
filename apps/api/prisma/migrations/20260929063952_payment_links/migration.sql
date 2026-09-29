-- CreateEnum
CREATE TYPE "LinkAmountType" AS ENUM ('FIXED', 'CUSTOM');

-- AlterTable
ALTER TABLE "Creator" ADD COLUMN     "boxPublicKey" TEXT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "linkId" TEXT,
ADD COLUMN     "responses" TEXT;

-- CreateTable
CREATE TABLE "PaymentLink" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "currency" "Currency" NOT NULL,
    "amountType" "LinkAmountType" NOT NULL,
    "amount" DECIMAL(30,8),
    "minAmount" DECIMAL(30,8),
    "maxAmount" DECIMAL(30,8),
    "presets" JSONB NOT NULL,
    "fields" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentLink_creatorId_idx" ON "PaymentLink"("creatorId");

-- CreateIndex
CREATE INDEX "Invoice_linkId_idx" ON "Invoice"("linkId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "PaymentLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentLink" ADD CONSTRAINT "PaymentLink_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
