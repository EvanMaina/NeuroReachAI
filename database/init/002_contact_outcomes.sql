-- NeuroReach AI - Contact Outcomes Migration
-- Adds contact_outcome field for tracking coordinator outreach results

-- =============================================================================
-- ENUM Type for Contact Outcomes
-- =============================================================================

-- Create contact outcome enum
CREATE TYPE contact_outcome_type AS ENUM (
    'NEW',              -- Not contacted yet
    'ANSWERED',         -- Spoke with lead, can proceed to schedule
    'NO_ANSWER',        -- Called but no pickup, needs follow-up
    'UNREACHABLE',      -- Wrong number, disconnected, etc.
    'CALLBACK_REQUESTED', -- Lead asked to call back at specific time
    'NOT_INTERESTED'    -- Lead declined, archive
);

-- =============================================================================
-- Add Column to Leads Table
-- =============================================================================

-- Add contact_outcome column with default 'NEW'
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS contact_outcome contact_outcome_type 
DEFAULT 'NEW' NOT NULL;

-- =============================================================================
-- Indexes for Contact Outcome
-- =============================================================================

-- Index for filtering by contact outcome
CREATE INDEX IF NOT EXISTS idx_leads_contact_outcome ON leads(contact_outcome);

-- Composite index for coordinator queue: priority + outcome
CREATE INDEX IF NOT EXISTS idx_leads_priority_outcome ON leads(priority, contact_outcome);

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON COLUMN leads.contact_outcome IS 'Result of coordinator outreach attempt (NEW, ANSWERED, NO_ANSWER, UNREACHABLE, CALLBACK_REQUESTED, NOT_INTERESTED)';
