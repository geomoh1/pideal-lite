-- Store only the seller's public Pi payout wallet address. Never store passphrases.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "piWalletAddress" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "piWalletVerifiedAt" TIMESTAMP(3);
