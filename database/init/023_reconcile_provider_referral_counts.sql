-- ============================================================================
-- Migration 023: Reconcile Provider Referral Counts
-- ============================================================================
-- One-time data fix to correct total_referrals on referring_providers.
--
-- Root cause: Two transaction bugs (now fixed) could cause the denormalized
-- total_referrals counter to drift from the actual lead count:
--   1. Widget submit_lead had a premature db.commit() on existing provider
--      referral count update BEFORE the lead was created. If lead creation
--      failed, the provider count was already committed and off by 1.
--      FIX: Changed db.commit() → db.flush() in leads.py
--   2. Jotform webhook incremented provider count in a separate transaction
--      AFTER the lead was committed. A crash between commits would lose the
--      increment.
--      FIX: Moved increment before db.commit() in webhooks.py
--
-- This migration reconciles ALL providers' total_referrals with the actual
-- count of non-deleted leads referencing them.
-- ============================================================================

-- Step 1: Show providers where count is wrong (for audit logging)
-- SELECT rp.id, rp.name, rp.total_referrals AS stored_count,
--   (SELECT COUNT(*) FROM leads WHERE referring_provider_id = rp.id AND deleted_at IS NULL) AS actual_count
-- FROM referring_providers rp
-- WHERE rp.total_referrals != (
--   SELECT COUNT(*) FROM leads WHERE referring_provider_id = rp.id AND deleted_at IS NULL
-- );

-- Step 2: Reconcile total_referrals for ALL providers
UPDATE referring_providers 
SET total_referrals = (
  SELECT COUNT(*) FROM leads 
  WHERE referring_provider_id = referring_providers.id 
  AND deleted_at IS NULL
);

-- Step 3: Also reconcile converted_referrals while we're at it
UPDATE referring_providers 
SET converted_referrals = (
  SELECT COUNT(*) FROM leads 
  WHERE referring_provider_id = referring_providers.id 
  AND deleted_at IS NULL
  AND status IN ('SCHEDULED', 'CONSULTATION_COMPLETE', 'TREATMENT_STARTED')
);
