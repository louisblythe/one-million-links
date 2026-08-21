ALTER TABLE squares ADD COLUMN location_source TEXT;

UPDATE squares
SET purchase_city = 'Sydney', purchase_country = 'AU', purchase_latitude = -33.87, purchase_longitude = 151.21, location_source = 'estimated_headquarters'
WHERE square_id = 0 AND status = 'paid' AND purchase_latitude IS NULL;

UPDATE squares
SET purchase_city = 'Boston', purchase_country = 'US', purchase_latitude = 42.35, purchase_longitude = -71.08, location_source = 'estimated_headquarters'
WHERE square_id = 1 AND status = 'paid' AND purchase_latitude IS NULL;

UPDATE squares
SET purchase_city = 'Singapore', purchase_country = 'SG', purchase_latitude = 1.28, purchase_longitude = 103.85, location_source = 'estimated_headquarters'
WHERE square_id = 9 AND status = 'paid' AND purchase_latitude IS NULL;

UPDATE squares
SET purchase_city = 'Northern Beaches, Sydney', purchase_country = 'AU', purchase_latitude = -33.64, purchase_longitude = 151.33, location_source = 'estimated_headquarters'
WHERE square_id = 5018 AND status = 'paid' AND purchase_latitude IS NULL;

UPDATE squares
SET purchase_city = 'Crows Nest, Sydney', purchase_country = 'AU', purchase_latitude = -33.83, purchase_longitude = 151.20, location_source = 'estimated_headquarters'
WHERE square_id = 16002 AND status = 'paid' AND purchase_latitude IS NULL;
