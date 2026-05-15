-- Add MVP trust fields for sellers and service review.
ALTER TABLE "User" ADD COLUMN "sellerStatus" TEXT NOT NULL DEFAULT 'unverified';

ALTER TABLE "Service" ADD COLUMN "portfolioUrl" TEXT;
ALTER TABLE "Service" ADD COLUMN "proofLink" TEXT;
ALTER TABLE "Service" ADD COLUMN "experience" TEXT;
ALTER TABLE "Service" ADD COLUMN "revisionPolicy" TEXT;
ALTER TABLE "Service" ADD COLUMN "requirementsFromBuyer" TEXT;
