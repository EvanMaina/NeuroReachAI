-- =============================================================================
-- Migration 022: TMS Therapy Interest Index for Analytics Performance
-- =============================================================================
-- The TMS Therapy Interest distribution endpoint groups by tms_therapy_interest
-- and filters WHERE tms_therapy_interest IS NOT NULL AND tms_therapy_interest != ''.
-- This index speeds up that aggregation query significantly.
-- =============================================================================

-- Index for TMS therapy interest distribution analytics
-- Covers the GROUP BY + WHERE IS NOT NULL filter pattern
CREATE INDEX IF NOT EXISTS idx_leads_tms_therapy_interest
    ON leads (tms_therapy_interest)
    WHERE tms_therapy_interest IS NOT NULL AND tms_therapy_interest != '';

-- =============================================================================
-- Analyze to update planner statistics
-- =============================================================================
ANALYZE leads;
