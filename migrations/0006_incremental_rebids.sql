CREATE INDEX IF NOT EXISTS idx_squares_featured_amount ON squares(featured_amount_cents);
CREATE TABLE IF NOT EXISTS featured_payments (
  checkout_session_id TEXT PRIMARY KEY,
  square_id INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  total_bid_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_featured_payments_square ON featured_payments(square_id);
