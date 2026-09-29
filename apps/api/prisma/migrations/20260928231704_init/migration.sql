-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('OPEN', 'PROCESSING', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'ZEC');

-- CreateEnum
CREATE TYPE "SwapKind" AS ENUM ('INVOICE_PAYMENT', 'WITHDRAWAL');

-- CreateEnum
CREATE TYPE "SwapStatus" AS ENUM ('PENDING_DEPOSIT', 'KNOWN_DEPOSIT_TX', 'PROCESSING', 'SUCCESS', 'INCOMPLETE_DEPOSIT', 'REFUNDED', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "Creator" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "displayName" TEXT,
    "invoiceSeq" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Creator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthChallenge" (
    "nonce" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthChallenge_pkey" PRIMARY KEY ("nonce")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShieldedAddress" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "label" TEXT,
    "hasOrchard" BOOLEAN NOT NULL,
    "hasSapling" BOOLEAN NOT NULL,
    "hasTransparent" BOOLEAN NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "assignedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShieldedAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "creatorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "clientLabel" TEXT,
    "lineItems" JSONB NOT NULL,
    "currency" "Currency" NOT NULL,
    "amount" DECIMAL(30,8) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'OPEN',
    "addressId" TEXT NOT NULL,
    "addressReused" BOOLEAN NOT NULL DEFAULT false,
    "dueDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "receivedZats" BIGINT,
    "receivedUsd" DECIMAL(20,2),
    "payerMarkedPaidAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Swap" (
    "id" TEXT NOT NULL,
    "kind" "SwapKind" NOT NULL,
    "creatorId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "swapType" TEXT NOT NULL,
    "originAsset" TEXT NOT NULL,
    "destinationAsset" TEXT NOT NULL,
    "amountIn" TEXT NOT NULL,
    "amountInFormatted" TEXT NOT NULL,
    "amountInUsd" TEXT,
    "amountOut" TEXT NOT NULL,
    "amountOutFormatted" TEXT NOT NULL,
    "amountOutUsd" TEXT,
    "recipient" TEXT NOT NULL,
    "refundTo" TEXT NOT NULL,
    "depositAddress" TEXT NOT NULL,
    "depositMemo" TEXT,
    "deadline" TIMESTAMP(3) NOT NULL,
    "timeEstimate" INTEGER,
    "confidentiality" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "quoteResponse" JSONB NOT NULL,
    "status" "SwapStatus" NOT NULL DEFAULT 'PENDING_DEPOSIT',
    "depositTxHash" TEXT,
    "swapDetails" JSONB,
    "lastCheckedAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Swap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Creator_publicKey_key" ON "Creator"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_creatorId_idx" ON "Session"("creatorId");

-- CreateIndex
CREATE INDEX "ShieldedAddress_creatorId_assignedAt_idx" ON "ShieldedAddress"("creatorId", "assignedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShieldedAddress_creatorId_address_key" ON "ShieldedAddress"("creatorId", "address");

-- CreateIndex
CREATE INDEX "Invoice_creatorId_status_idx" ON "Invoice"("creatorId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_creatorId_number_key" ON "Invoice"("creatorId", "number");

-- CreateIndex
CREATE INDEX "Swap_status_lastCheckedAt_idx" ON "Swap"("status", "lastCheckedAt");

-- CreateIndex
CREATE INDEX "Swap_invoiceId_idx" ON "Swap"("invoiceId");

-- CreateIndex
CREATE INDEX "Swap_creatorId_kind_idx" ON "Swap"("creatorId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "Swap_depositAddress_depositMemo_key" ON "Swap"("depositAddress", "depositMemo");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShieldedAddress" ADD CONSTRAINT "ShieldedAddress_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "ShieldedAddress"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Swap" ADD CONSTRAINT "Swap_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Swap" ADD CONSTRAINT "Swap_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
