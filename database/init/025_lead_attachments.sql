-- =============================================================================
-- 025: Lead Attachments Table
-- =============================================================================
-- Stores metadata for files attached to leads (PDF, Word, Excel, images).
-- Actual file content is stored on the local filesystem; this table stores
-- the path, metadata, and association to a lead.
-- =============================================================================

CREATE TABLE IF NOT EXISTS lead_attachments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id         UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    filename        VARCHAR(500) NOT NULL,          -- Original filename from uploader
    stored_filename VARCHAR(500) NOT NULL,          -- UUID-based filename on disk
    file_type       VARCHAR(100) NOT NULL,          -- MIME type (e.g., application/pdf)
    file_size       BIGINT NOT NULL DEFAULT 0,      -- Size in bytes
    uploaded_by     VARCHAR(255),                    -- Name of uploader (coordinator)
    uploaded_by_id  UUID,                            -- FK to users table (nullable)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookup by lead_id (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_lead_attachments_lead_id ON lead_attachments(lead_id);

-- Index for listing recent attachments across all leads
CREATE INDEX IF NOT EXISTS idx_lead_attachments_created_at ON lead_attachments(created_at DESC);
