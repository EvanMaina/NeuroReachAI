-- NeuroReach AI - Multi-Condition Intake & Lead Scoring Enhancement
-- Migration 010: Add multi-condition support, severity assessments, and enhanced lead scoring
-- 
-- This migration adds:
-- 1. Multi-condition support (conditions array + normalized keys)
-- 2. TMS therapy interest tracking
-- 3. Preferred contact method
-- 4. PHQ-2 (Depression) severity assessment
-- 5. GAD-2 (Anxiety) severity assessment
-- 6. OCD severity assessment
-- 7. PTSD severity assessment
-- 8. Insurance details with "Other" support
-- 9. Score breakdown fields for transparency
-- 10. Updated lead scoring fields

-- =============================================================================
-- STEP 1: Create new ENUM types for severity levels
-- =============================================================================

-- Depression severity levels (PHQ-2 based: 0-6 score)
DO $$ BEGIN
    CREATE TYPE depression_severity_type AS ENUM (
        'minimal',     -- 0-1
        'mild',        -- 2-3
        'moderate',    -- 4-5
        'severe'       -- 6
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Anxiety severity levels (GAD-2 based: 0-6 score)
DO $$ BEGIN
    CREATE TYPE anxiety_severity_type AS ENUM (
        'minimal',     -- 0-1
        'mild',        -- 2-3
        'moderate',    -- 4-5
        'severe'       -- 6
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- OCD severity levels (time occupied based)
DO $$ BEGIN
    CREATE TYPE ocd_severity_type AS ENUM (
        'mild',            -- <1 hour/day
        'moderate',        -- 1-3 hours/day
        'moderate_severe', -- 3-8 hours/day
        'severe'           -- >8 hours/day
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- PTSD severity levels (intrusion frequency based)
DO $$ BEGIN
    CREATE TYPE ptsd_severity_type AS ENUM (
        'minimal',         -- 0 (not at all)
        'mild',            -- 1 (a little bit)
        'moderate',        -- 2 (moderately)
        'moderate_severe', -- 3 (quite a bit)
        'severe'           -- 4 (extremely)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- TMS therapy interest options
DO $$ BEGIN
    CREATE TYPE tms_therapy_interest_type AS ENUM (
        'daily_tms',
        'accelerated_tms',
        'saint_protocol',
        'not_sure'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Preferred contact method
DO $$ BEGIN
    CREATE TYPE preferred_contact_type AS ENUM (
        'phone_call',
        'text',
        'email',
        'any'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- STEP 2: Add new columns to leads table
-- =============================================================================

-- Multi-condition support: conditions array (normalized lowercase keys)
-- Valid values: depression, anxiety, ocd, ptsd, other
ALTER TABLE leads ADD COLUMN IF NOT EXISTS conditions TEXT[] DEFAULT '{}';

-- Other condition text (when 'other' is in conditions array)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS other_condition_text TEXT;

-- TMS therapy interest
ALTER TABLE leads ADD COLUMN IF NOT EXISTS tms_therapy_interest TEXT;

-- Preferred contact method
ALTER TABLE leads ADD COLUMN IF NOT EXISTS preferred_contact_method TEXT;

-- =============================================================================
-- Depression PHQ-2 Assessment Fields
-- =============================================================================
-- PHQ-2 questions (0-3 each):
-- 1. Little interest or pleasure in doing things
-- 2. Feeling down, depressed, or hopeless
ALTER TABLE leads ADD COLUMN IF NOT EXISTS phq2_interest INTEGER;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS phq2_mood INTEGER;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS depression_severity_score INTEGER;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS depression_severity_level TEXT;

-- =============================================================================
-- Anxiety GAD-2 Assessment Fields
-- =============================================================================
-- GAD-2 questions (0-3 each):
-- 1. Feeling nervous, anxious, or on edge
-- 2. Not being able to stop or control worrying
ALTER TABLE leads ADD COLUMN IF NOT EXISTS gad2_nervous INTEGER;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS gad2_worry INTEGER;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS anxiety_severity_score INTEGER;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS anxiety_severity_level TEXT;

-- =============================================================================
-- OCD Assessment Fields
-- =============================================================================
-- OCD question: How much time do OCD thoughts/behaviors take per day?
-- 1 = <1 hour, 2 = 1-3 hours, 3 = 3-8 hours, 4 = >8 hours
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ocd_time_occupied INTEGER;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ocd_severity_level TEXT;

-- =============================================================================
-- PTSD Assessment Fields
-- =============================================================================
-- PTSD intrusion question (0-4 scale):
-- How often do you have intrusive memories or flashbacks?
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ptsd_intrusion INTEGER;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ptsd_severity_level TEXT;

-- =============================================================================
-- Insurance Enhancement
-- =============================================================================
-- Other insurance provider text (when provider = 'Other')
ALTER TABLE leads ADD COLUMN IF NOT EXISTS other_insurance_provider TEXT;

-- =============================================================================
-- Score Breakdown Fields (for transparency and debugging)
-- =============================================================================
ALTER TABLE leads ADD COLUMN IF NOT EXISTS condition_score INTEGER DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS therapy_interest_score INTEGER DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS severity_score INTEGER DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS insurance_score INTEGER DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS duration_score INTEGER DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS treatment_score INTEGER DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS location_score INTEGER DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS urgency_score INTEGER DEFAULT 0;

-- Rename existing 'score' to 'lead_score' for clarity (or ensure alias works)
-- Keep 'score' for backward compatibility but also add 'lead_score' as alias
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT 0;

-- =============================================================================
-- STEP 3: Create indexes for new columns
-- =============================================================================

-- Index on conditions array for efficient filtering
CREATE INDEX IF NOT EXISTS idx_leads_conditions ON leads USING GIN (conditions);

-- Index on preferred contact method
CREATE INDEX IF NOT EXISTS idx_leads_preferred_contact ON leads (preferred_contact_method);

-- Index on TMS therapy interest
CREATE INDEX IF NOT EXISTS idx_leads_tms_interest ON leads (tms_therapy_interest);

-- =============================================================================
-- STEP 4: Update existing leads to have conditions array from condition field
-- =============================================================================

-- Migrate existing single condition to conditions array
UPDATE leads 
SET conditions = ARRAY[LOWER(condition::TEXT)]
WHERE conditions IS NULL OR array_length(conditions, 1) IS NULL OR array_length(conditions, 1) = 0;

-- Sync lead_score with score for existing records
UPDATE leads SET lead_score = score WHERE lead_score IS NULL OR lead_score = 0;

-- =============================================================================
-- STEP 5: Add constraints
-- =============================================================================

-- PHQ-2 values must be 0-3
ALTER TABLE leads DROP CONSTRAINT IF EXISTS check_phq2_interest_range;
ALTER TABLE leads ADD CONSTRAINT check_phq2_interest_range 
    CHECK (phq2_interest IS NULL OR (phq2_interest >= 0 AND phq2_interest <= 3));

ALTER TABLE leads DROP CONSTRAINT IF EXISTS check_phq2_mood_range;
ALTER TABLE leads ADD CONSTRAINT check_phq2_mood_range 
    CHECK (phq2_mood IS NULL OR (phq2_mood >= 0 AND phq2_mood <= 3));

-- GAD-2 values must be 0-3
ALTER TABLE leads DROP CONSTRAINT IF EXISTS check_gad2_nervous_range;
ALTER TABLE leads ADD CONSTRAINT check_gad2_nervous_range 
    CHECK (gad2_nervous IS NULL OR (gad2_nervous >= 0 AND gad2_nervous <= 3));

ALTER TABLE leads DROP CONSTRAINT IF EXISTS check_gad2_worry_range;
ALTER TABLE leads ADD CONSTRAINT check_gad2_worry_range 
    CHECK (gad2_worry IS NULL OR (gad2_worry >= 0 AND gad2_worry <= 3));

-- OCD time occupied must be 1-4
ALTER TABLE leads DROP CONSTRAINT IF EXISTS check_ocd_time_range;
ALTER TABLE leads ADD CONSTRAINT check_ocd_time_range 
    CHECK (ocd_time_occupied IS NULL OR (ocd_time_occupied >= 1 AND ocd_time_occupied <= 4));

-- PTSD intrusion must be 0-4
ALTER TABLE leads DROP CONSTRAINT IF EXISTS check_ptsd_intrusion_range;
ALTER TABLE leads ADD CONSTRAINT check_ptsd_intrusion_range 
    CHECK (ptsd_intrusion IS NULL OR (ptsd_intrusion >= 0 AND ptsd_intrusion <= 4));

-- Depression severity score must be 0-6
ALTER TABLE leads DROP CONSTRAINT IF EXISTS check_depression_score_range;
ALTER TABLE leads ADD CONSTRAINT check_depression_score_range 
    CHECK (depression_severity_score IS NULL OR (depression_severity_score >= 0 AND depression_severity_score <= 6));

-- Anxiety severity score must be 0-6
ALTER TABLE leads DROP CONSTRAINT IF EXISTS check_anxiety_score_range;
ALTER TABLE leads ADD CONSTRAINT check_anxiety_score_range 
    CHECK (anxiety_severity_score IS NULL OR (anxiety_severity_score >= 0 AND anxiety_severity_score <= 6));

-- =============================================================================
-- STEP 6: Add comments for documentation
-- =============================================================================

COMMENT ON COLUMN leads.conditions IS 'Array of condition keys (lowercase): depression, anxiety, ocd, ptsd, other';
COMMENT ON COLUMN leads.other_condition_text IS 'Free text description when "other" condition is selected';
COMMENT ON COLUMN leads.tms_therapy_interest IS 'TMS therapy type interest: daily_tms, accelerated_tms, saint_protocol, not_sure';
COMMENT ON COLUMN leads.preferred_contact_method IS 'Preferred contact method: phone_call, text, email, any';

COMMENT ON COLUMN leads.phq2_interest IS 'PHQ-2 Q1: Little interest/pleasure (0-3)';
COMMENT ON COLUMN leads.phq2_mood IS 'PHQ-2 Q2: Feeling down/depressed (0-3)';
COMMENT ON COLUMN leads.depression_severity_score IS 'PHQ-2 total score (0-6)';
COMMENT ON COLUMN leads.depression_severity_level IS 'Depression severity: minimal, mild, moderate, severe';

COMMENT ON COLUMN leads.gad2_nervous IS 'GAD-2 Q1: Feeling nervous/anxious (0-3)';
COMMENT ON COLUMN leads.gad2_worry IS 'GAD-2 Q2: Unable to stop worrying (0-3)';
COMMENT ON COLUMN leads.anxiety_severity_score IS 'GAD-2 total score (0-6)';
COMMENT ON COLUMN leads.anxiety_severity_level IS 'Anxiety severity: minimal, mild, moderate, severe';

COMMENT ON COLUMN leads.ocd_time_occupied IS 'OCD time occupied per day (1=<1h, 2=1-3h, 3=3-8h, 4=>8h)';
COMMENT ON COLUMN leads.ocd_severity_level IS 'OCD severity: mild, moderate, moderate_severe, severe';

COMMENT ON COLUMN leads.ptsd_intrusion IS 'PTSD intrusion frequency (0-4)';
COMMENT ON COLUMN leads.ptsd_severity_level IS 'PTSD severity: minimal, mild, moderate, moderate_severe, severe';

COMMENT ON COLUMN leads.other_insurance_provider IS 'Custom insurance provider name when "Other" selected';

COMMENT ON COLUMN leads.condition_score IS 'Points from conditions (max of selected conditions)';
COMMENT ON COLUMN leads.therapy_interest_score IS 'Points from TMS therapy interest';
COMMENT ON COLUMN leads.severity_score IS 'Points from severity assessments (max across conditions)';
COMMENT ON COLUMN leads.insurance_score IS 'Points from insurance status';
COMMENT ON COLUMN leads.duration_score IS 'Points from symptom duration';
COMMENT ON COLUMN leads.treatment_score IS 'Points from prior treatments';
COMMENT ON COLUMN leads.location_score IS 'Points from service area (ZIP code)';
COMMENT ON COLUMN leads.urgency_score IS 'Points from treatment urgency';
COMMENT ON COLUMN leads.lead_score IS 'Total lead score (sum of all score components)';

-- =============================================================================
-- Migration complete
-- =============================================================================
