-- NeuroReach AI - Referring Providers Schema
-- Adds support for tracking healthcare providers who refer patients
-- Version: 1.0.0

-- =============================================================================
-- ENUM Types for Providers
-- =============================================================================

-- Provider specialty types
CREATE TYPE provider_specialty AS ENUM (
    'PSYCHIATRIST',
    'PSYCHOLOGIST',
    'THERAPIST',
    'PRIMARY_CARE',
    'NEUROLOGIST',
    'SOCIAL_WORKER',
    'NURSE_PRACTITIONER',
    'OTHER'
);

-- Provider status for relationship management
CREATE TYPE provider_status AS ENUM (
    'ACTIVE',      -- Verified, actively referring
    'PENDING',     -- Auto-created, awaiting verification
    'INACTIVE',    -- No referrals in 12+ months
    'ARCHIVED'     -- Historical data only
);

-- Provider preferred contact method
CREATE TYPE provider_contact_method AS ENUM (
    'EMAIL',
    'PHONE',
    'FAX',
    'PORTAL'
);

-- =============================================================================
-- Referring Providers Table
-- =============================================================================

CREATE TABLE referring_providers (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Provider Identity
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),  -- Primary matching key when available
    phone VARCHAR(20),
    fax VARCHAR(20),
    npi_number VARCHAR(20),  -- National Provider Identifier (10 digits)
    
    -- Practice Information  
    practice_name VARCHAR(255),
    practice_address TEXT,
    practice_city VARCHAR(100),
    practice_state VARCHAR(2),
    practice_zip VARCHAR(10),
    
    -- Professional Details
    specialty provider_specialty NOT NULL DEFAULT 'OTHER',
    credentials VARCHAR(50),  -- e.g., "MD", "PhD", "LCSW"
    
    -- Status & Preferences
    status provider_status NOT NULL DEFAULT 'PENDING',
    preferred_contact provider_contact_method DEFAULT 'EMAIL',
    send_referral_updates BOOLEAN NOT NULL DEFAULT true,  -- Auto-notify on status changes
    
    -- Metrics (denormalized for dashboard performance)
    total_referrals INTEGER NOT NULL DEFAULT 0,
    converted_referrals INTEGER NOT NULL DEFAULT 0,  -- Reached SCHEDULED or beyond
    last_referral_at TIMESTAMP WITH TIME ZONE,
    
    -- Notes & Metadata
    notes TEXT,
    tags TEXT[],  -- Flexible tagging for grouping/filtering
    
    -- Audit timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP WITH TIME ZONE,  -- When status changed to ACTIVE
    archived_at TIMESTAMP WITH TIME ZONE,  -- When status changed to ARCHIVED
    
    -- Constraints
    CONSTRAINT valid_npi CHECK (npi_number IS NULL OR LENGTH(npi_number) = 10),
    CONSTRAINT valid_email_format CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Partial unique index on email (only for non-null emails)
CREATE UNIQUE INDEX idx_providers_unique_email ON referring_providers (LOWER(email)) WHERE email IS NOT NULL;

-- Partial unique index on NPI (only for non-null NPIs)
CREATE UNIQUE INDEX idx_providers_unique_npi ON referring_providers (npi_number) WHERE npi_number IS NOT NULL;

-- =============================================================================
-- Add Referral Fields to Leads Table
-- =============================================================================

-- Flag for quick filtering
ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_referral BOOLEAN NOT NULL DEFAULT false;

-- Foreign key to provider (nullable - some referrals may not have matched provider)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS referring_provider_id UUID REFERENCES referring_providers(id);

-- Raw referral data from Jotform (preserved even if provider matching fails)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS referring_provider_raw JSONB;

-- =============================================================================
-- Indexes for Performance
-- =============================================================================

-- Provider indexes
CREATE INDEX idx_providers_status ON referring_providers(status);
CREATE INDEX idx_providers_name_trgm ON referring_providers USING gin(name gin_trgm_ops);  -- Fuzzy search
CREATE INDEX idx_providers_practice_name_trgm ON referring_providers USING gin(practice_name gin_trgm_ops);
CREATE INDEX idx_providers_specialty ON referring_providers(specialty);
CREATE INDEX idx_providers_last_referral ON referring_providers(last_referral_at DESC);
CREATE INDEX idx_providers_total_referrals ON referring_providers(total_referrals DESC);
CREATE INDEX idx_providers_created_at ON referring_providers(created_at DESC);

-- Lead referral indexes
CREATE INDEX idx_leads_is_referral ON leads(is_referral) WHERE is_referral = true;
CREATE INDEX idx_leads_referring_provider_id ON leads(referring_provider_id) WHERE referring_provider_id IS NOT NULL;

-- Composite indexes for common queries
CREATE INDEX idx_providers_status_referrals ON referring_providers(status, total_referrals DESC);
CREATE INDEX idx_leads_referral_status ON leads(is_referral, status) WHERE is_referral = true;

-- =============================================================================
-- Functions
-- =============================================================================

-- Function to update provider metrics when a referral is added
CREATE OR REPLACE FUNCTION update_provider_referral_metrics()
RETURNS TRIGGER AS $$
BEGIN
    -- When a new referral lead is created
    IF TG_OP = 'INSERT' AND NEW.is_referral = true AND NEW.referring_provider_id IS NOT NULL THEN
        UPDATE referring_providers
        SET 
            total_referrals = total_referrals + 1,
            last_referral_at = NEW.created_at,
            updated_at = CURRENT_TIMESTAMP,
            -- Auto-reactivate inactive providers
            status = CASE 
                WHEN status = 'INACTIVE' THEN 'ACTIVE'
                ELSE status
            END
        WHERE id = NEW.referring_provider_id;
    END IF;
    
    -- When a lead status changes to a conversion status
    IF TG_OP = 'UPDATE' AND 
       NEW.is_referral = true AND 
       NEW.referring_provider_id IS NOT NULL AND
       NEW.status IN ('SCHEDULED', 'CONSULTATION_COMPLETE', 'TREATMENT_STARTED') AND
       OLD.status NOT IN ('SCHEDULED', 'CONSULTATION_COMPLETE', 'TREATMENT_STARTED') THEN
        UPDATE referring_providers
        SET 
            converted_referrals = converted_referrals + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.referring_provider_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-mark providers as inactive after 12 months
CREATE OR REPLACE FUNCTION mark_inactive_providers()
RETURNS void AS $$
BEGIN
    UPDATE referring_providers
    SET 
        status = 'INACTIVE',
        updated_at = CURRENT_TIMESTAMP
    WHERE 
        status = 'ACTIVE' AND
        last_referral_at < CURRENT_TIMESTAMP - INTERVAL '12 months';
END;
$$ LANGUAGE plpgsql;

-- Function to search providers with fuzzy matching
CREATE OR REPLACE FUNCTION search_providers(
    search_term TEXT,
    status_filter provider_status DEFAULT NULL,
    specialty_filter provider_specialty DEFAULT NULL,
    limit_count INTEGER DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    name VARCHAR(255),
    email VARCHAR(255),
    practice_name VARCHAR(255),
    specialty provider_specialty,
    status provider_status,
    total_referrals INTEGER,
    converted_referrals INTEGER,
    similarity_score REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.email,
        p.practice_name,
        p.specialty,
        p.status,
        p.total_referrals,
        p.converted_referrals,
        GREATEST(
            similarity(p.name, search_term),
            COALESCE(similarity(p.practice_name, search_term), 0)
        ) AS similarity_score
    FROM referring_providers p
    WHERE 
        (status_filter IS NULL OR p.status = status_filter) AND
        (specialty_filter IS NULL OR p.specialty = specialty_filter) AND
        (
            p.name ILIKE '%' || search_term || '%' OR
            p.practice_name ILIKE '%' || search_term || '%' OR
            p.email ILIKE '%' || search_term || '%' OR
            similarity(p.name, search_term) > 0.3 OR
            similarity(p.practice_name, search_term) > 0.3
        )
    ORDER BY similarity_score DESC, p.total_referrals DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function to find potential duplicate providers
CREATE OR REPLACE FUNCTION find_duplicate_providers(
    p_name VARCHAR(255),
    p_email VARCHAR(255) DEFAULT NULL,
    p_npi VARCHAR(20) DEFAULT NULL,
    p_practice_name VARCHAR(255) DEFAULT NULL
)
RETURNS TABLE (
    provider_id UUID,
    provider_name VARCHAR(255),
    provider_email VARCHAR(255),
    provider_practice VARCHAR(255),
    match_type TEXT,
    confidence REAL
) AS $$
BEGIN
    RETURN QUERY
    -- Exact email match (highest confidence)
    SELECT 
        p.id, p.name, p.email, p.practice_name,
        'email_match'::TEXT,
        1.0::REAL
    FROM referring_providers p
    WHERE p_email IS NOT NULL AND LOWER(p.email) = LOWER(p_email)
    
    UNION ALL
    
    -- Exact NPI match (highest confidence)
    SELECT 
        p.id, p.name, p.email, p.practice_name,
        'npi_match'::TEXT,
        1.0::REAL
    FROM referring_providers p
    WHERE p_npi IS NOT NULL AND p.npi_number = p_npi
    
    UNION ALL
    
    -- Fuzzy name + practice match
    SELECT 
        p.id, p.name, p.email, p.practice_name,
        'fuzzy_match'::TEXT,
        GREATEST(
            similarity(p.name, p_name),
            COALESCE(similarity(p.practice_name, p_practice_name), 0)
        )::REAL
    FROM referring_providers p
    WHERE 
        similarity(p.name, p_name) > 0.6 OR
        (p_practice_name IS NOT NULL AND similarity(p.practice_name, p_practice_name) > 0.6)
    
    ORDER BY confidence DESC
    LIMIT 5;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Triggers
-- =============================================================================

-- Auto-update provider metrics on lead changes
CREATE TRIGGER trigger_update_provider_metrics
    AFTER INSERT OR UPDATE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION update_provider_referral_metrics();

-- Auto-update updated_at on providers table
CREATE TRIGGER trigger_providers_updated_at
    BEFORE UPDATE ON referring_providers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================

ALTER TABLE referring_providers ENABLE ROW LEVEL SECURITY;

-- Default policy: Allow all for now (will be restricted with user authentication)
CREATE POLICY providers_all_access ON referring_providers FOR ALL USING (true);

-- =============================================================================
-- Initial Data / Seed (Optional)
-- =============================================================================

-- You can add sample providers here if needed for testing
-- INSERT INTO referring_providers (name, email, practice_name, specialty, status) VALUES
-- ('Dr. Sarah Johnson', 'sjohnson@mentalhealth.com', 'City Mental Health Clinic', 'PSYCHIATRIST', 'ACTIVE'),
-- ('Dr. Michael Chen', 'mchen@primarycare.com', 'Downtown Family Medicine', 'PRIMARY_CARE', 'ACTIVE');

-- =============================================================================
-- Comments for Documentation
-- =============================================================================

COMMENT ON TABLE referring_providers IS 'Healthcare providers who refer patients to NeuroReach for TMS therapy';
COMMENT ON COLUMN referring_providers.npi_number IS 'National Provider Identifier - 10 digit unique identifier';
COMMENT ON COLUMN referring_providers.total_referrals IS 'Denormalized count for dashboard performance - updated via trigger';
COMMENT ON COLUMN referring_providers.converted_referrals IS 'Count of referrals that reached SCHEDULED status or beyond';
COMMENT ON COLUMN leads.is_referral IS 'Quick filter flag - true if lead was referred by a healthcare provider';
COMMENT ON COLUMN leads.referring_provider_raw IS 'Original Jotform data preserved as JSON even if provider matching fails';
