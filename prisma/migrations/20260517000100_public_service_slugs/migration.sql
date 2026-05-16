-- Add stable public service slugs for shareable landing pages.
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "slug" TEXT;

UPDATE "Service"
SET "slug" =
  COALESCE(
    NULLIF(TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER("title"), '[^a-z0-9]+', '-', 'g')), ''),
    'service'
  ) || '-' || SUBSTRING(MD5("id"), 1, 6)
WHERE "slug" IS NULL OR "slug" = '';

ALTER TABLE "Service" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Service_slug_key" ON "Service"("slug");
CREATE INDEX IF NOT EXISTS "Service_slug_idx" ON "Service"("slug");
