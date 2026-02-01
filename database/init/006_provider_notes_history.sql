-- NeuroReach AI - Provider Notes History Schema
-- Adds support for tracking provider notes/interactions over time
-- Version: 1.0.0

-- =============================================================================
-- Provider Notes History Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS provider_notes_history (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Foreign key to provider
    provider_id UUID NOT NULL REFERENCES referring_providers(id) ON DELETE CASCADE,
    
    -- Note content
    note_text TEXT NOT NULL,
    note_type VARCHAR(50) NOT NULL DEFAULT 'general', -- general, call, meeting, email, followup
    
    -- Metadata
    created_by VARCHAR(255), -- Coordinator name/email
    
    -- Audit timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- Indexes
-- =============================================================================

-- Index for fetching notes by provider
CREATE INDEX idx_provider_notes_provider_id ON provider_notes_history(provider_id);

-- Index for chronological ordering
CREATE INDEX idx_provider_notes_created_at ON provider_notes_history(provider_id, created_at DESC);

-- Index for filtering by note type
CREATE INDEX idx_provider_notes_type ON provider_notes_history(note_type);

-- =============================================================================
-- Trigger to auto-create history entry when notes field is updated
-- =============================================================================

CREATE OR REPLACE FUNCTION log_provider_notes_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Log to notes history when the notes field changes
    IF (TG_OP = 'UPDATE' AND OLD.notes IS DISTINCT FROM NEW.notes AND NEW.notes IS NOT NULL AND NEW.notes != '') THEN
        INSERT INTO provider_notes_history (
            provider_id,
            note_text,
            note_type,
            created_by
        ) VALUES (
            NEW.id,
            NEW.notes,
            'general',
            'System (Auto-logged)'
        );
    END IF;
    
    -- Log initial notes on insert
    IF (TG_OP = 'INSERT' AND NEW.notes IS NOT NULL AND NEW.notes != '') THEN
        INSERT INTO provider_notes_history (
            provider_id,
            note_text,
            note_type,
            created_by
        ) VALUES (
            NEW.id,
            NEW.notes,
            'general',
            'System (Initial)'
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-logging notes changes
DROP TRIGGER IF EXISTS trigger_log_provider_notes ON referring_providers;
CREATE TRIGGER trigger_log_provider_notes
    AFTER INSERT OR UPDATE ON referring_providers
    FOR EACH ROW
    EXECUTE FUNCTION log_provider_notes_change();

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================

ALTER TABLE provider_notes_history ENABLE ROW LEVEL SECURITY;

-- Default policy: Allow all for now (will be restricted with user authentication)
CREATE POLICY provider_notes_all_access ON provider_notes_history FOR ALL USING (true);

-- =============================================================================
-- Comments for Documentation
-- =============================================================================

COMMENT ON TABLE provider_notes_history IS 'Historical log of all notes and interactions with referring providers';
COMMENT ON COLUMN provider_notes_history.note_type IS 'Type of note: general, call, meeting, email, followup';
COMMENT ON COLUMN provider_notes_history.created_by IS 'Name or email of the coordinator who created the note';
