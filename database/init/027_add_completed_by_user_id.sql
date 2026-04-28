-- =============================================================================
-- Migration 027: Track which coordinator actually closed a lead
-- =============================================================================
--
-- WHY THIS EXISTS
--   "Coordinator performance" was being computed off `assigned_to_id`, which
--   conflates *assignment* with *closing* — the lead might have been assigned
--   to one coordinator, picked up by another during a coverage shift, and
--   moved to CONSULTATION_COMPLETE / TREATMENT_STARTED by a third. Crediting
--   conversion to the assignee is wrong and silently misranks the team.
--
--   This column captures the JWT user-id of the coordinator who *moved the
--   lead into a converted status*, populated server-side at the moment the
--   transition happens. AI Insights coordinator-performance ranks on this
--   column going forward.
--
-- DESIGN NOTES
--   - Nullable: pre-existing rows have no recorded closer; backfilling from
--     audit logs would be guesswork, so we leave them NULL and only surface
--     coordinators with at least one new completion.
--   - Indexed: AI Insights aggregation is GROUP BY this column.
--   - completed_at: paired timestamp so we can compute "completions in the
--     last 30 days", not just lifetime totals.
-- =============================================================================

ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS completed_by_user_id UUID
        REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN leads.completed_by_user_id IS
    'User who moved this lead into a converted status (CONSULTATION_COMPLETE, TREATMENT_STARTED). Captured from JWT at status-change time. NULL for pre-existing rows or leads not yet closed. Powers AI Insights coordinator-performance ranking.';

COMMENT ON COLUMN leads.completed_at IS
    'Timestamp the lead was moved into a converted status. Pairs with completed_by_user_id.';

CREATE INDEX IF NOT EXISTS idx_leads_completed_by_user_id
    ON leads (completed_by_user_id, completed_at DESC)
    WHERE completed_by_user_id IS NOT NULL AND deleted_at IS NULL;
