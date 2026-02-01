-- Migration: Add last_updated_at field to track lead activity
-- Purpose: Track the most recent activity on a lead for better coordinator workflow
-- 
-- Coordinators need to see leads sorted by recent activity, not just submission date.
-- This field updates whenever ANY action is taken on a lead (status change, notes added,
-- callback scheduled, etc.)

-- Add the last_updated_at column
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMP WITH TIME ZONE;

-- Create index for performance (sorting and filtering)
CREATE INDEX IF NOT EXISTS idx_leads_last_updated_at ON leads(last_updated_at DESC NULLS FIRST);

-- Add comment explaining the field
COMMENT ON COLUMN leads.last_updated_at IS 'Timestamp of most recent activity on this lead (status change, notes, scheduling, etc.). NULL for new untouched leads.';

-- Backfill for existing leads with activity
-- Strategy:
-- 1. For leads with status != 'NEW', use the most recent activity timestamp
-- 2. Priority order: converted_at > contacted_at > last_contact_attempt > updated_at
-- 3. For leads with status = 'NEW', keep NULL (never touched)

UPDATE leads
SET last_updated_at = COALESCE(
    converted_at,           -- If converted, use that
    contacted_at,           -- If contacted, use that  
    last_contact_attempt,   -- If contact attempt made, use that
    updated_at              -- Fallback to general update timestamp
)
WHERE status != 'NEW'
AND last_updated_at IS NULL;

-- Note: Leads with status = 'NEW' intentionally keep NULL to indicate they've never been acted upon
