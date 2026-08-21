ALTER TABLE squares ADD COLUMN purchase_city TEXT;
ALTER TABLE squares ADD COLUMN purchase_country TEXT;
ALTER TABLE squares ADD COLUMN purchase_latitude REAL;
ALTER TABLE squares ADD COLUMN purchase_longitude REAL;
CREATE INDEX IF NOT EXISTS idx_squares_purchase_country ON squares(purchase_country);
