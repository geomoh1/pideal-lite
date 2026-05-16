-- Add MVP trust fields for sellers and service review.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sellerStatus" TEXT NOT NULL DEFAULT 'unverified';

ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "portfolioUrl" TEXT;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "proofLink" TEXT;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "experience" TEXT;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "revisionPolicy" TEXT;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "requirementsFromBuyer" TEXT;
