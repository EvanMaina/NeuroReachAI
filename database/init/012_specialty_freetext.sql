-- Migration: Convert specialty column from ENUM to VARCHAR (free text)
-- Date: 2026-02-05
-- Description: Allows any text value for specialty instead of restricted enum values
-- Rule: "User types X → Database stores X → Dashboard shows X" (no mapping, no transformation)

-- Step 1: Add temporary column
ALTER TABLE referring_providers 
ADD COLUMN IF NOT EXISTS specialty_text VARCHAR(255);

-- Step 2: Copy existing enum values to text column
UPDATE referring_providers 
SET specialty_text = specialty::text 
WHERE specialty IS NOT NULL;

-- Step 3: Drop the old enum column
ALTER TABLE referring_providers 
DROP COLUMN IF EXISTS specialty;

-- Step 4: Rename temporary column to specialty
ALTER TABLE referring_providers 
RENAME COLUMN specialty_text TO specialty;

-- Note: The provider_specialty ENUM type still exists in PostgreSQL but is no longer used
-- Existing enum values will be preserved as text strings (e.g., 'NEUROLOGIST' becomes 'NEUROLOGIST')
-- New values can be any text (e.g., 'Neurology', 'Family Medicine', 'xyz123')

-- Verification query:
-- SELECT id, name, specialty FROM referring_providers LIMIT 10;
