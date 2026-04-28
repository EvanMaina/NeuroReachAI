-- =============================================================================
-- Migration 026: Coordinator-captured lead location
-- =============================================================================
--
-- WHY THIS EXISTS
--   Coordinators frequently learn the lead's city/area during the first call
--   ("I'm in Gilbert, AZ", "We're moving to Scottsdale next month"). This is
--   richer than the raw ZIP from the intake form because (a) ZIP is sometimes
--   missing/invalid and (b) people self-report a recognizable neighborhood.
--
--   Capturing it as free-text on the lead row lets the AI Insights service
--   surface real Expansion Opportunities ("3 leads from Mesa in 14 days —
--   consider opening a satellite") instead of relying on the boolean
--   `in_service_area` flag alone.
--
-- DESIGN NOTES
--   - VARCHAR(255), nullable: optional field, free-text, no enum constraint.
--   - Stored on the lead row (not interactions): latest known location is
--     what matters for marketing/expansion decisions; per-call history is
--     already captured in lead_notes if needed.
--   - GIN trigram index for fuzzy matching ("gilbert" ≈ "Gilbert AZ").
--   - This is NOT PHI: city/area is non-identifying at this granularity.
-- =============================================================================

ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS lead_location VARCHAR(255) DEFAULT NULL;

COMMENT ON COLUMN leads.lead_location IS
    'Free-text city/area captured by coordinator during outreach. Powers AI Insights expansion-opportunity analysis. Not PHI at this granularity.';

-- pg_trgm enables fast ILIKE / similarity matching for city normalization
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_leads_lead_location_trgm
    ON leads USING gin (lead_location gin_trgm_ops)
    WHERE lead_location IS NOT NULL;

-- B-tree index for exact-match GROUP BY queries (AI Insights expansion view)
CREATE INDEX IF NOT EXISTS idx_leads_lead_location
    ON leads (lead_location)
    WHERE lead_location IS NOT NULL AND deleted_at IS NULL;
