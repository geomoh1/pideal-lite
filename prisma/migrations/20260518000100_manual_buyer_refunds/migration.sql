-- Separate internal buyer refund accounting from real manual buyer wallet refunds.
CREATE TABLE IF NOT EXISTS "BuyerRefund" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "buyerId" TEXT NOT NULL,
  "amountPi" DOUBLE PRECISION NOT NULL,
  "refundStatus" TEXT NOT NULL DEFAULT 'manual_required',
  "refundTxid" TEXT,
  "paidAt" TIMESTAMP(3),
  "paidByAdmin" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BuyerRefund_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BuyerRefund_orderId_key" ON "BuyerRefund"("orderId");
CREATE INDEX IF NOT EXISTS "BuyerRefund_buyerId_idx" ON "BuyerRefund"("buyerId");
CREATE INDEX IF NOT EXISTS "BuyerRefund_refundStatus_idx" ON "BuyerRefund"("refundStatus");
CREATE INDEX IF NOT EXISTS "BuyerRefund_createdAt_idx" ON "BuyerRefund"("createdAt");

ALTER TABLE "BuyerRefund"
  ADD CONSTRAINT "BuyerRefund_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BuyerRefund"
  ADD CONSTRAINT "BuyerRefund_buyerId_fkey"
  FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "BuyerRefund" (
  "id",
  "orderId",
  "buyerId",
  "amountPi",
  "refundStatus",
  "refundTxid",
  "paidAt",
  "paidByAdmin",
  "createdAt",
  "updatedAt"
)
SELECT
  'refund_' || "id",
  "id",
  "buyerId",
  "refundedPi",
  CASE
    WHEN "refundTxid" IS NULL OR BTRIM("refundTxid") = '' THEN 'manual_required'
    ELSE 'paid'
  END,
  "refundTxid",
  CASE
    WHEN "refundTxid" IS NULL OR BTRIM("refundTxid") = '' THEN NULL
    ELSE "refundRecordedAt"
  END,
  NULL,
  COALESCE("refundRecordedAt", "updatedAt", CURRENT_TIMESTAMP),
  COALESCE("refundRecordedAt", "updatedAt", CURRENT_TIMESTAMP)
FROM "Order"
WHERE "escrowStatus" = 'refunded'
  AND "refundedPi" > 0
  AND "buyerId" IS NOT NULL
ON CONFLICT ("orderId") DO NOTHING;
