ALTER TABLE squares ADD COLUMN category TEXT NOT NULL DEFAULT 'Other';
ALTER TABLE squares ADD COLUMN click_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE squares ADD COLUMN verified_company INTEGER NOT NULL DEFAULT 0;
ALTER TABLE squares ADD COLUMN territory_key TEXT;
ALTER TABLE squares ADD COLUMN territory_size INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_squares_territory ON squares(territory_key);
