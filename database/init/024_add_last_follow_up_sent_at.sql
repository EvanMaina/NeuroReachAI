-- =============================================================================
-- Migration 024: Add last_follow_up_sent_at Column for Automated Follow-Ups
-- =============================================================================
--
-- Tracks the last time an automated follow-up (SMS + email) was sent to a lead.
-- Used by the 6-hour follow-up cron job to prevent duplicate sends within
-- the same window and to determine eligibility for the next follow-up.
--
-- Leads with status = 'SCHEDULED' are excluded from follow-ups entirely.
--
-- Reversible: ALTER TABLE leads DROP COLUMN IF EXISTS last_follow_up_sent_at;
-- =============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'leads' AND column_name = 'last_follow_up_sent_at'
    ) THEN
        ALTER TABLE leads ADD COLUMN last_follow_up_sent_at TIMESTAMPTZ DEFAULT NULL;
        RAISE NOTICE 'Added last_follow_up_sent_at column to leads table';
    ELSE
        RAISE NOTICE 'last_follow_up_sent_at column already exists';
    END IF;
END $$;

-- Index for efficient querying of follow-up eligible leads
CREATE INDEX IF NOT EXISTS idx_leads_last_follow_up_sent_at
    ON leads(last_follow_up_sent_at)
    WHERE deleted_at IS NULL AND status != 'SCHEDULED';

-- Confirmation
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 024 complete: last_follow_up_sent_at column added';
END $$;
