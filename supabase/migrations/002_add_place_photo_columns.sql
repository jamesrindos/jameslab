-- Add Place Photo columns to clips table
-- These store the Google Places photo reference for curated images

ALTER TABLE clips ADD COLUMN IF NOT EXISTS place_id TEXT;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS photo_reference TEXT;
ALTER TABLE clips ADD COLUMN IF NOT EXISTS place_photo_url TEXT;
