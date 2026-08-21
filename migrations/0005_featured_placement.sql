ALTER TABLE squares ADD COLUMN featured_from TEXT;
ALTER TABLE squares ADD COLUMN featured_until TEXT;
ALTER TABLE squares ADD COLUMN featured_amount_cents INTEGER;

CREATE INDEX IF NOT EXISTS idx_squares_featured_until ON squares(featured_until);
