-- NeuroReach AI - Scheduling Enhancement Migration
-- Adds scheduling fields for coordinator callback management

-- =============================================================================
-- Add Scheduling Fields to Leads Table
-- =============================================================================

-- Add contact method enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contact_method') THEN
        CREATE TYPE contact_method AS ENUM (
            'PHONE',
            'EMAIL',
            'SMS',
            'VIDEO_CALL'
        );
    END IF;
END $$;

-- Add scheduling columns if they don't exist
ALTER TABLE leads 
    ADD COLUMN IF NOT EXISTS scheduled_callback_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS scheduled_notes TEXT,
    ADD COLUMN IF NOT EXISTS contact_method contact_method DEFAULT 'PHONE',
    ADD COLUMN IF NOT EXISTS last_contact_attempt TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS contact_attempts INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS next_follow_up_at TIMESTAMP WITH TIME ZONE;

-- Create index for scheduled callbacks (for calendar view)
CREATE INDEX IF NOT EXISTS idx_leads_scheduled_callback 
    ON leads(scheduled_callback_at) 
    WHERE scheduled_callback_at IS NOT NULL;

-- Create index for follow-ups
CREATE INDEX IF NOT EXISTS idx_leads_next_follow_up 
    ON leads(next_follow_up_at) 
    WHERE next_follow_up_at IS NOT NULL;

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON COLUMN leads.scheduled_callback_at IS 'Scheduled time for coordinator to call the lead';
COMMENT ON COLUMN leads.scheduled_notes IS 'Notes for the scheduled callback';
COMMENT ON COLUMN leads.contact_method IS 'Preferred method of contact';
COMMENT ON COLUMN leads.last_contact_attempt IS 'Timestamp of last contact attempt';
COMMENT ON COLUMN leads.contact_attempts IS 'Number of times coordinator attempted to contact';
COMMENT ON COLUMN leads.next_follow_up_at IS 'Scheduled follow-up time if lead was not reached';
