-- ============================================================================
-- Migration: Add soft delete support for leads
-- Version: 008
-- Description: Adds deleted_at column for soft deletes instead of permanent deletion
-- ============================================================================

-- Add deleted_at column to leads table
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Create index for efficient filtering of active leads
CREATE INDEX IF NOT EXISTS idx_leads_deleted_at 
ON leads (deleted_at) 
WHERE deleted_at IS NULL;

-- Create partial index for active leads by status (common query pattern)
CREATE INDEX IF NOT EXISTS idx_leads_active_status 
ON leads (status, created_at DESC) 
WHERE deleted_at IS NULL;

-- Create partial index for active leads by priority (common query pattern)
CREATE INDEX IF NOT EXISTS idx_leads_active_priority 
ON leads (priority, created_at DESC) 
WHERE deleted_at IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN leads.deleted_at IS 'Timestamp when lead was soft-deleted. NULL means active/not deleted.';

-- ============================================================================
-- Log migration completion
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 008: Soft delete support added successfully';
END $$;
