-- Migration 028: Add manual_lead_source column
-- Enables coordinators to attribute manually-entered leads to a marketing channel
-- so they appear in the correct Source Analytics platform card.
--
-- Values: google_ads | google_search | social_media | friend | provider_referral | other
-- NULL   = unattributed (excluded from analytics, same as today's behaviour)

ALTER TABLE leads
ADD COLUMN IF NOT EXISTS manual_lead_source VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_leads_manual_lead_source
    ON leads(manual_lead_source)
    WHERE manual_lead_source IS NOT NULL;

COMMENT ON COLUMN leads.manual_lead_source IS
    'Attribution channel for coordinator-entered leads: google_ads, google_search, social_media, friend, provider_referral, other. NULL = unattributed.';
