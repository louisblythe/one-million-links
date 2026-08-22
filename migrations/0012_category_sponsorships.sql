CREATE TABLE IF NOT EXISTS category_sponsorships (
  category TEXT NOT NULL,
  url TEXT NOT NULL,
  label TEXT NOT NULL,
  owner_email TEXT,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  active_until TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (category, url)
);

CREATE INDEX IF NOT EXISTS idx_category_sponsorships_rank
  ON category_sponsorships(category, active_until, amount_cents DESC);

CREATE TABLE IF NOT EXISTS category_sponsor_payments (
  checkout_session_id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  url TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  total_bid_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
