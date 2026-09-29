-- Client details are now plain optional fields instead of browser-encrypted blobs.
ALTER TABLE "Invoice" DROP COLUMN "billTo",
DROP COLUMN "billToKey",
ADD COLUMN     "clientEmail" TEXT,
ADD COLUMN     "clientName" TEXT;
