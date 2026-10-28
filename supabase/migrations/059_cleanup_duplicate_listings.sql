-- Deduplicate listings by source_url and enforce uniqueness
BEGIN;

WITH ranked_listings AS (
  SELECT
    id,
    source_url,
    ROW_NUMBER() OVER (
      PARTITION BY source_url
      ORDER BY
        COALESCE(updated_at, created_at) DESC,
        id DESC
    ) AS rn
  FROM listings
  WHERE source_url IS NOT NULL AND source_url <> ''
)
DELETE FROM listings
WHERE id IN (
  SELECT id
  FROM ranked_listings
  WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS listings_source_url_key
  ON listings(source_url)
  WHERE source_url IS NOT NULL AND source_url <> '';

COMMIT;

