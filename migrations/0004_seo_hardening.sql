ALTER TABLE squares ADD COLUMN owner_host TEXT;

UPDATE squares
SET owner_host = lower(
  CASE
    WHEN instr(substr(url, instr(url, '://') + 3), '/') > 0
      THEN substr(
        substr(url, instr(url, '://') + 3),
        1,
        instr(substr(url, instr(url, '://') + 3), '/') - 1
      )
    ELSE substr(url, instr(url, '://') + 3)
  END
)
WHERE owner_host IS NULL;

UPDATE squares
SET owner_host = substr(owner_host, 5)
WHERE owner_host LIKE 'www.%';

CREATE INDEX IF NOT EXISTS idx_squares_owner_host ON squares(owner_host);

-- Preserve editorial seed rows for reference while removing synthetic claims
-- and click totals from public pages, feeds, statistics, and sitemaps.
UPDATE squares
SET status = 'demo',
    click_count = 0
WHERE checkout_session_id LIKE 'seed:seo:%';
