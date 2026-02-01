-- =============================================================================
-- Migration 020: Lead Notes Table + Follow-up Reason/Date Columns
-- =============================================================================
-- 
-- Changes:
-- 1. Add `follow_up_reason` column to leads table (VARCHAR)
-- 2. Add `follow_up_date` column to leads table (TIMESTAMPTZ)
-- 3. Create `lead_notes` table for coordinator-specialist handoff notes
-- 4. Add indexes for performance
--
-- Reversible: DROP TABLE lead_notes; ALTER TABLE leads DROP COLUMN follow_up_reason, DROP COLUMN follow_up_date;
-- =============================================================================

-- Add follow_up_reason to leads table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'leads' AND column_name = 'follow_up_reason'
    ) THEN
        ALTER TABLE leads ADD COLUMN follow_up_reason VARCHAR(100) DEFAULT NULL;
        RAISE NOTICE 'Added follow_up_reason column to leads table';
    ELSE
        RAISE NOTICE 'follow_up_reason column already exists';
    END IF;
END $$;

-- Add follow_up_date to leads table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'leads' AND column_name = 'follow_up_date'
    ) THEN
        ALTER TABLE leads ADD COLUMN follow_up_date TIMESTAMPTZ DEFAULT NULL;
        RAISE NOTICE 'Added follow_up_date column to leads table';
    ELSE
        RAISE NOTICE 'follow_up_date column already exists';
    END IF;
END $$;

-- Create lead_notes table
CREATE TABLE IF NOT EXISTS lead_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    note_text TEXT NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by_name VARCHAR(200) NOT NULL DEFAULT 'System',
    -- Context: what triggered this note (manual, outcome, schedule, etc.)
    note_type VARCHAR(50) NOT NULL DEFAULT 'manual',
    -- Optional: link to a specific outcome that triggered this note
    related_outcome VARCHAR(50) DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for lead_notes
CREATE INDEX IF NOT EXISTS idx_lead_notes_lead_id ON lead_notes(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_notes_created_at ON lead_notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_notes_created_by ON lead_notes(created_by);

-- Index for follow_up_reason (used in queue filtering)
CREATE INDEX IF NOT EXISTS idx_leads_follow_up_reason ON leads(follow_up_reason) WHERE follow_up_reason IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_follow_up_date ON leads(follow_up_date) WHERE follow_up_date IS NOT NULL;

-- Confirmation
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 020 complete: lead_notes table + follow_up columns added';
END $$;
