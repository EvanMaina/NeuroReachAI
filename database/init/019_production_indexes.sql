-- =============================================================================
-- Migration 019: Production Indexes for Scale
-- =============================================================================
-- Adds missing indexes identified during production optimization review.
-- Supplements existing indexes from migrations 001, 011, and 015.
--
-- EXISTING COVERAGE (already indexed):
--   001: status, priority, created_at, zip_code, lead_number, condition
--   011: status+outcome, priority+created, callback+scheduled, followup,
--        referral, contact_attempts, stats_composite, conversion_tracking
--   015: new_queue partial, hot_priority partial, status+last_updated,
--        priority+last_updated, assigned_coordinator, soft_delete
--
-- NEW INDEXES IN THIS MIGRATION:
--   1. source column (for Google Ads vs Widget vs JotForm filtering)
--   2. contact_outcome standalone (for queue filtering without status)
--   3. deleted_at + created_at composite (for deleted leads dashboard sort)
--   4. Covering index for dashboard list query pattern
-- =============================================================================

-- 1. Source column index for lead source analytics and filtering
-- Google Ads, JotForm, Widget leads need fast filtering by source
CREATE INDEX IF NOT EXISTS idx_leads_source
    ON leads (source)
    WHERE source IS NOT NULL;

-- 2. Contact outcome standalone index
-- Queue sidebar counts filter by contact_outcome without status
-- (supplements the composite idx_leads_status_outcome from 011)
CREATE INDEX IF NOT EXISTS idx_leads_contact_outcome
    ON leads (contact_outcome)
    WHERE deleted_at IS NULL;

-- 3. Deleted leads dashboard: sort by deleted_at DESC for recovery view
CREATE INDEX IF NOT EXISTS idx_leads_deleted_at_desc
    ON leads (deleted_at DESC)
    WHERE deleted_at IS NOT NULL;

-- 4. Covering index for main dashboard list query pattern:
--    ORDER BY last_updated_at DESC NULLS FIRST, created_at DESC
--    with soft-delete filter (deleted_at IS NULL)
-- This matches the exact query in list_leads endpoint
CREATE INDEX IF NOT EXISTS idx_leads_dashboard_list_order
    ON leads (last_updated_at DESC NULLS FIRST, created_at DESC)
    WHERE deleted_at IS NULL;

-- 5. UTM source analytics: fast GROUP BY on utm_source, utm_medium, utm_campaign
CREATE INDEX IF NOT EXISTS idx_leads_utm_source_medium
    ON leads (utm_source, utm_medium)
    WHERE utm_source IS NOT NULL;

-- =============================================================================
-- Analyze tables to update query planner statistics after index creation
-- =============================================================================
ANALYZE leads;
