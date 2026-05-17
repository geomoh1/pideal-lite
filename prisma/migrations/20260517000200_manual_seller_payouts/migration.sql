-- Separate escrow settlement from real seller wallet payouts.
CREATE TABLE IF NOT EXISTS "SellerPayout" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "grossPi" DOUBLE PRECISION NOT NULL,
  "platformFeePi" DOUBLE PRECISION NOT NULL,
  "netPi" DOUBLE PRECISION NOT NULL,
  "payoutStatus" TEXT NOT NULL DEFAULT 'manual_required',
  "payoutTxid" TEXT,
  "paidAt" TIMESTAMP(3),
  "paidByAdmin" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SellerPayout_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SellerPayout_orderId_key" ON "SellerPayout"("orderId");
CREATE INDEX IF NOT EXISTS "SellerPayout_sellerId_idx" ON "SellerPayout"("sellerId");
CREATE INDEX IF NOT EXISTS "SellerPayout_payoutStatus_idx" ON "SellerPayout"("payoutStatus");
CREATE INDEX IF NOT EXISTS "SellerPayout_createdAt_idx" ON "SellerPayout"("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SellerPayout_orderId_fkey'
  ) THEN
    ALTER TABLE "SellerPayout"
      ADD CONSTRAINT "SellerPayout_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SellerPayout_sellerId_fkey'
  ) THEN
    ALTER TABLE "SellerPayout"
      ADD CONSTRAINT "SellerPayout_sellerId_fkey"
      FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "SellerPayout" (
  "id",
  "orderId",
  "sellerId",
  "grossPi",
  "platformFeePi",
  "netPi",
  "payoutStatus",
  "payoutTxid",
  "paidAt",
  "createdAt",
  "updatedAt"
)
SELECT
  'payout_' || "id",
  "id",
  "sellerId",
  COALESCE("amountPi", "sellerPayoutPi" + COALESCE("platformFeePi", "escrowFeePi", 0), 0),
  COALESCE("platformFeePi", "escrowFeePi", 0),
  COALESCE("sellerPayoutPi", 0),
  CASE
    WHEN COALESCE("sellerPayoutTxid", '') <> '' THEN 'paid'
    ELSE 'manual_required'
  END,
  "sellerPayoutTxid",
  CASE
    WHEN COALESCE("sellerPayoutTxid", '') <> '' THEN COALESCE("releasedAt", CURRENT_TIMESTAMP)
    ELSE NULL
  END,
  COALESCE("releasedAt", CURRENT_TIMESTAMP),
  CURRENT_TIMESTAMP
FROM "Order"
WHERE "sellerId" IS NOT NULL
  AND "escrowStatus" = 'released'
  AND COALESCE("sellerPayoutPi", 0) > 0
ON CONFLICT ("orderId") DO NOTHING;
