-- Add name column to projects table
-- This allows users to give custom names to their projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS name TEXT;

-- For existing projects, default name to location_name
UPDATE projects SET name = location_name WHERE name IS NULL;
