-- NeuroReach AI - Add SCHEDULED and COMPLETED to Contact Outcome Enum
-- Fixes scheduling functionality by adding missing enum values

-- =============================================================================
-- Add Missing Values to contact_outcome_type Enum
-- =============================================================================

-- PostgreSQL doesn't support adding values to enums in a transaction safely
-- These commands must be run outside a transaction block

-- Add 'SCHEDULED' value to the enum (for consultations that have been scheduled)
ALTER TYPE contact_outcome_type ADD VALUE IF NOT EXISTS 'SCHEDULED';

-- Add 'COMPLETED' value to the enum (for consultations that have been completed)
ALTER TYPE contact_outcome_type ADD VALUE IF NOT EXISTS 'COMPLETED';

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON TYPE contact_outcome_type IS 'Result of coordinator outreach: NEW, ANSWERED, NO_ANSWER, UNREACHABLE, CALLBACK_REQUESTED, SCHEDULED, COMPLETED, NOT_INTERESTED';
