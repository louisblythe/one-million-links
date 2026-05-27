CREATE TABLE IF NOT EXISTS squares (
  square_id INTEGER PRIMARY KEY,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  owner_email TEXT,
  checkout_session_id TEXT UNIQUE,
  payment_intent_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  paid_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_squares_status ON squares(status);
