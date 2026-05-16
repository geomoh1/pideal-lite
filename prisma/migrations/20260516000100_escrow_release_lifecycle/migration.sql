-- Add app-side escrow lifecycle fields and audit events.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "escrowStatus" TEXT NOT NULL DEFAULT 'not_funded';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "escrowHeldPi" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "escrowFeePi" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "sellerPayoutPi" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "refundedPi" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "escrowFundedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "disputeOpenedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "disputeResolvedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "disputeWindowEndsAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "releaseEligibleAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "releasedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "refundRecordedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "sellerPayoutTxid" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "refundTxid" TEXT;

CREATE TABLE IF NOT EXISTS "EscrowEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" TEXT NOT NULL,
    "amountPi" DOUBLE PRECISION,
    "status" TEXT,
    "note" TEXT,
    "txid" TEXT,
    "metadataJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EscrowEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "EscrowEvent_orderId_idx" ON "EscrowEvent"("orderId");
CREATE INDEX IF NOT EXISTS "EscrowEvent_type_idx" ON "EscrowEvent"("type");
CREATE INDEX IF NOT EXISTS "EscrowEvent_status_idx" ON "EscrowEvent"("status");
CREATE INDEX IF NOT EXISTS "Order_escrowStatus_idx" ON "Order"("escrowStatus");
CREATE INDEX IF NOT EXISTS "Order_releaseEligibleAt_idx" ON "Order"("releaseEligibleAt");

UPDATE "Order"
SET
  "escrowHeldPi" = CASE
    WHEN "status" IN ('Deposit Paid', 'Paid', 'In Progress', 'Delivered', 'Completed', 'Disputed', 'Refunded') OR "paidAt" IS NOT NULL
      THEN COALESCE("amountPi", 0)
    ELSE 0
  END,
  "escrowFeePi" = CASE
    WHEN "status" IN ('Deposit Paid', 'Paid', 'In Progress', 'Delivered', 'Completed', 'Disputed', 'Refunded') OR "paidAt" IS NOT NULL
      THEN COALESCE("platformFeePi", 0)
    ELSE 0
  END,
  "sellerPayoutPi" = CASE
    WHEN "status" = 'Completed' THEN GREATEST(COALESCE("amountPi", 0) - COALESCE("platformFeePi", 0), 0)
    ELSE COALESCE("sellerPayoutPi", 0)
  END,
  "escrowFundedAt" = CASE
    WHEN ("status" IN ('Deposit Paid', 'Paid', 'In Progress', 'Delivered', 'Completed', 'Disputed', 'Refunded') OR "paidAt" IS NOT NULL) AND COALESCE("amountPi", 0) > 0
      THEN COALESCE("escrowFundedAt", "paidAt", "createdAt")
    ELSE "escrowFundedAt"
  END,
  "disputeWindowEndsAt" = CASE
    WHEN "status" = 'Completed' THEN COALESCE("disputeWindowEndsAt", CURRENT_TIMESTAMP)
    ELSE "disputeWindowEndsAt"
  END,
  "releaseEligibleAt" = CASE
    WHEN "status" = 'Completed' THEN COALESCE("releaseEligibleAt", CURRENT_TIMESTAMP)
    ELSE "releaseEligibleAt"
  END,
  "escrowStatus" = CASE
    WHEN "status" = 'Refunded' THEN 'refunded'
    WHEN "status" = 'Disputed' THEN 'disputed'
    WHEN "status" = 'Completed' THEN 'release_pending'
    WHEN ("status" IN ('Deposit Paid', 'Paid', 'In Progress', 'Delivered') OR "paidAt" IS NOT NULL) AND COALESCE("amountPi", 0) > 0 THEN 'holding'
    ELSE 'not_funded'
  END
WHERE "escrowStatus" = 'not_funded';
