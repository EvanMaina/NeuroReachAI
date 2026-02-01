-- Migration: Add source and referral columns to leads table
-- This migration adds:
-- 1. source column - tracks lead source/platform (widget, jotform, google_ads, referral, etc.)
-- 2. is_referral - flag for quick filtering of referral leads
-- 3. referring_provider_id - foreign key to referring provider
-- 4. referring_provider_raw - raw referral data from forms

-- Create lead_source enum type if it doesn't exist
DO $$ BEGIN
    CREATE TYPE lead_source AS ENUM (
        'widget',
        'jotform',
        'google_ads',
        'referral',
        'manual',
        'api',
        'import'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add source column to leads table
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS source lead_source NOT NULL DEFAULT 'widget';

-- Add referral tracking columns
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS is_referral BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS referring_provider_id UUID;

ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS referring_provider_raw JSONB;

-- Create indexes for filtering and performance
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_is_referral ON leads(is_referral);
CREATE INDEX IF NOT EXISTS idx_leads_referring_provider_id ON leads(referring_provider_id);

-- Add comments
COMMENT ON COLUMN leads.source IS 'Lead source/platform for tracking (widget, jotform, google_ads, referral, etc.)';
COMMENT ON COLUMN leads.is_referral IS 'Flag for quick filtering of referral leads';
COMMENT ON COLUMN leads.referring_provider_id IS 'Foreign key to referring provider (nullable - some referrals may not have matched provider)';
COMMENT ON COLUMN leads.referring_provider_raw IS 'Raw referral data from Jotform (preserved even if provider matching fails)';
