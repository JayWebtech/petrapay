-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "billTo" TEXT,
ADD COLUMN     "billToKey" TEXT,
ADD COLUMN     "editedAt" TIMESTAMP(3);
