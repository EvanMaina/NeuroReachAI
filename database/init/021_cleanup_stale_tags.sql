-- ============================================================================
-- Migration 021: Cleanup Stale Tags on Queue Transitions
-- ============================================================================
-- 
-- PURPOSE:
-- Fix stale follow_up_reason tags that were left behind due to a frontend
-- double-update bug (Fix 1 + Fix 5). The ConsultationPanel was calling
-- onStatusChange() AFTER updateConsultationOutcome(), which triggered a
-- second PATCH /status call that wiped all tags via clear_lead_transition_fields().
-- This left leads in incorrect states with orphaned tags.
--
-- WHAT THIS FIXES:
-- 1. Leads in CONTACTED status should NOT have consultation-related tags
--    (e.g., "Cancelled Appointment", "Second Consult Required", "No Show")
-- 2. Leads in NEW status should NOT have any follow_up_reason at all
-- 3. Leads in CONSULTATION_COMPLETE status should NOT have pending tags
--
-- SAFE TO RUN: All updates are idempotent. Can be re-run without side effects.
-- ============================================================================

-- Step 1: Clear consultation-related tags from CONTACTED leads
-- These leads were double-updated: consultation outcome was set, then status
-- was changed back to CONTACTED which cleared the intended status but left
-- the follow_up_reason orphaned.
UPDATE leads
SET follow_up_reason = NULL,
    last_updated_at = NOW()
WHERE status = 'CONTACTED'
  AND follow_up_reason IN (
    'Cancelled Appointment',
    'Second Consult Required', 
    'No Show',
    'Rescheduled'
  )
  AND deleted_at IS NULL;

-- Step 2: Clear all tags from NEW leads (never contacted, should be pristine)
UPDATE leads
SET follow_up_reason = NULL,
    last_updated_at = NOW()
WHERE status = 'NEW'
  AND follow_up_reason IS NOT NULL
  AND deleted_at IS NULL;

-- Step 3: Clear pending/follow-up tags from CONSULTATION_COMPLETE leads
-- These leads have already completed — no pending tags should remain.
UPDATE leads
SET follow_up_reason = NULL,
    last_updated_at = NOW()
WHERE status = 'CONSULTATION_COMPLETE'
  AND follow_up_reason IN (
    'Cancelled Appointment',
    'No Show',
    'No Answer',
    'Callback Requested',
    'Unreachable'
  )
  AND deleted_at IS NULL;

-- Step 4: Clear scheduled_callback_at for leads that are NOT in SCHEDULED or CALLBACK status
-- Orphaned scheduled dates from the double-update bug
UPDATE leads
SET scheduled_callback_at = NULL,
    last_updated_at = NOW()
WHERE status NOT IN ('SCHEDULED', 'CONTACTED')
  AND contact_outcome NOT IN ('CALLBACK_REQUESTED', 'SCHEDULED')
  AND scheduled_callback_at IS NOT NULL
  AND deleted_at IS NULL;

-- Verification query (run manually to check results):
-- SELECT status, follow_up_reason, COUNT(*) 
-- FROM leads 
-- WHERE deleted_at IS NULL 
-- GROUP BY status, follow_up_reason 
-- ORDER BY status, follow_up_reason;
