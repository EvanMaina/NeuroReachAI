-- Migration 029: Post-Consultation tracking
-- Adds NO_SHOW to the contact_outcome enum and a no_show_reason column
-- so coordinators can capture WHY a scheduled consultation was missed.
--
-- no_show_reason values (enforced by the application, not a DB enum):
--   no_call_no_show | cancelled_reschedule | cancelled_not_interested
--   insurance_issue | transportation | provider_unavailable | other

-- Add NO_SHOW to contact_outcome_type enum (idempotent)
DO $$ BEGIN
    ALTER TYPE contact_outcome_type ADD VALUE IF NOT EXISTS 'NO_SHOW';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Store the coordinator-selected reason for missing a consultation
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS no_show_reason VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_leads_no_show_reason
    ON leads(no_show_reason)
    WHERE no_show_reason IS NOT NULL;

COMMENT ON COLUMN leads.no_show_reason IS
    'Reason a scheduled consultation was not completed (no_call_no_show, cancelled_reschedule, cancelled_not_interested, insurance_issue, transportation, provider_unavailable, other).';
