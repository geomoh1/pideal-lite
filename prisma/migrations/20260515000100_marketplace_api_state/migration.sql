-- Add frontend marketplace fields to persisted API state.
ALTER TABLE "Service" ADD COLUMN "sellerHandle" TEXT;
ALTER TABLE "Service" ADD COLUMN "rating" REAL;
ALTER TABLE "Service" ADD COLUMN "reviewCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Service" ADD COLUMN "accent" TEXT;
ALTER TABLE "Service" ADD COLUMN "icon" TEXT;
ALTER TABLE "Service" ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Service" ADD COLUMN "terms" TEXT;
ALTER TABLE "Service" ADD COLUMN "deliverablesJson" TEXT;

ALTER TABLE "Order" ADD COLUMN "buyerNote" TEXT;
ALTER TABLE "Order" ADD COLUMN "requestSourceText" TEXT;
ALTER TABLE "Order" ADD COLUMN "requestReferenceLink" TEXT;
ALTER TABLE "Order" ADD COLUMN "requestFileName" TEXT;
ALTER TABLE "Order" ADD COLUMN "requestFileSize" TEXT;
ALTER TABLE "Order" ADD COLUMN "deliveryFileName" TEXT;
ALTER TABLE "Order" ADD COLUMN "deliveryFileSize" TEXT;
