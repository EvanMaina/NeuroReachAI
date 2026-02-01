-- NeuroReach AI - Initial Database Schema
-- HIPAA-compliant schema for patient intake and lead management

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =============================================================================
-- ENUM Types
-- =============================================================================

-- Lead condition types (TMS-treatable conditions)
CREATE TYPE condition_type AS ENUM (
    'DEPRESSION',
    'ANXIETY',
    'OCD',
    'PTSD',
    'OTHER'
);

-- Symptom duration ranges
CREATE TYPE duration_type AS ENUM (
    'LESS_THAN_6_MONTHS',
    'SIX_TO_TWELVE_MONTHS',
    'MORE_THAN_12_MONTHS'
);

-- Prior treatment options
CREATE TYPE treatment_type AS ENUM (
    'ANTIDEPRESSANTS',
    'THERAPY_CBT',
    'BOTH',
    'NONE',
    'OTHER'
);

-- Urgency levels
CREATE TYPE urgency_type AS ENUM (
    'ASAP',
    'WITHIN_30_DAYS',
    'EXPLORING'
);

-- Lead priority calculated from scoring
CREATE TYPE priority_type AS ENUM (
    'HOT',
    'MEDIUM',
    'LOW',
    'DISQUALIFIED'
);

-- Lead status for tracking
CREATE TYPE lead_status AS ENUM (
    'NEW',
    'CONTACTED',
    'SCHEDULED',
    'CONSULTATION_COMPLETE',
    'TREATMENT_STARTED',
    'LOST',
    'DISQUALIFIED'
);

-- Audit action types
CREATE TYPE audit_action AS ENUM (
    'CREATE',
    'READ',
    'UPDATE',
    'DELETE',
    'EXPORT',
    'LOGIN',
    'LOGOUT'
);

-- =============================================================================
-- Tables
-- =============================================================================

-- Leads table - stores patient intake information
-- PHI fields are encrypted using pgcrypto
CREATE TABLE leads (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Lead Number (auto-generated: NR-YYYY-XXX format)
    lead_number VARCHAR(20) NOT NULL UNIQUE,
    
    -- Contact Information (PHI - encrypted)
    first_name_encrypted BYTEA NOT NULL,
    last_name_encrypted BYTEA,
    email_encrypted BYTEA NOT NULL,
    phone_encrypted BYTEA NOT NULL,
    
    -- Date of Birth (for age verification - must be 18+)
    date_of_birth DATE,
    
    -- Clinical Information
    condition condition_type NOT NULL,
    condition_other TEXT, -- Only if condition = 'OTHER'
    symptom_duration duration_type NOT NULL,
    prior_treatments treatment_type[] NOT NULL DEFAULT '{}',
    
    -- Insurance Information
    has_insurance BOOLEAN NOT NULL,
    insurance_provider TEXT, -- Encrypted if contains PHI
    
    -- Location
    zip_code VARCHAR(10) NOT NULL,
    in_service_area BOOLEAN NOT NULL DEFAULT false,
    
    -- Urgency & Consent
    urgency urgency_type NOT NULL,
    hipaa_consent BOOLEAN NOT NULL DEFAULT false,
    hipaa_consent_timestamp TIMESTAMP WITH TIME ZONE, -- When HIPAA consent was given
    privacy_consent_timestamp TIMESTAMP WITH TIME ZONE, -- When privacy consent was given
    sms_consent BOOLEAN NOT NULL DEFAULT false,
    sms_consent_timestamp TIMESTAMP WITH TIME ZONE, -- When SMS consent was given (if applicable)
    
    -- Scoring & Priority
    score INTEGER NOT NULL DEFAULT 0,
    priority priority_type NOT NULL DEFAULT 'LOW',
    
    -- Lead Management
    status lead_status NOT NULL DEFAULT 'NEW',
    assigned_to UUID, -- Foreign key to users table (future)
    notes TEXT,
    
    -- UTM Tracking
    utm_source VARCHAR(255),
    utm_medium VARCHAR(255),
    utm_campaign VARCHAR(255),
    utm_term VARCHAR(255),
    utm_content VARCHAR(255),
    
    -- Metadata
    ip_address_hash VARCHAR(64), -- Hashed for privacy
    user_agent TEXT,
    referrer_url TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    contacted_at TIMESTAMP WITH TIME ZONE,
    converted_at TIMESTAMP WITH TIME ZONE
);

-- Audit logs table - tracks all PHI access for HIPAA compliance
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- What was accessed
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    action audit_action NOT NULL,
    
    -- Who accessed it
    user_id UUID, -- Foreign key to users table (future), NULL for system actions
    user_email VARCHAR(255),
    user_ip_hash VARCHAR(64),
    
    -- Context
    endpoint VARCHAR(255),
    request_method VARCHAR(10),
    user_agent TEXT,
    
    -- What changed (for UPDATE actions)
    old_values JSONB,
    new_values JSONB,
    
    -- Result
    success BOOLEAN NOT NULL DEFAULT true,
    error_message TEXT,
    
    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- Indexes
-- =============================================================================

-- Leads indexes
CREATE INDEX idx_leads_lead_number ON leads(lead_number);
CREATE INDEX idx_leads_priority ON leads(priority);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX idx_leads_zip_code ON leads(zip_code);
CREATE INDEX idx_leads_in_service_area ON leads(in_service_area);
CREATE INDEX idx_leads_condition ON leads(condition);
CREATE INDEX idx_leads_score ON leads(score DESC);

-- Composite indexes for common queries
CREATE INDEX idx_leads_priority_status ON leads(priority, status);
CREATE INDEX idx_leads_service_area_priority ON leads(in_service_area, priority);

-- Audit logs indexes
CREATE INDEX idx_audit_logs_table_record ON audit_logs(table_name, record_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);

-- =============================================================================
-- Functions
-- =============================================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to create audit log entry
CREATE OR REPLACE FUNCTION create_audit_log(
    p_table_name VARCHAR(100),
    p_record_id UUID,
    p_action audit_action,
    p_user_id UUID DEFAULT NULL,
    p_user_email VARCHAR(255) DEFAULT NULL,
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_audit_id UUID;
BEGIN
    INSERT INTO audit_logs (
        table_name,
        record_id,
        action,
        user_id,
        user_email,
        old_values,
        new_values
    ) VALUES (
        p_table_name,
        p_record_id,
        p_action,
        p_user_id,
        p_user_email,
        p_old_values,
        p_new_values
    )
    RETURNING id INTO v_audit_id;
    
    RETURN v_audit_id;
END;
$$ language 'plpgsql';

-- =============================================================================
-- Triggers
-- =============================================================================

-- Auto-update updated_at on leads table
CREATE TRIGGER trigger_leads_updated_at
    BEFORE UPDATE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Row Level Security (RLS) - Prepared for future user authentication
-- =============================================================================

-- Enable RLS on sensitive tables
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Default policy: Allow all for now (will be restricted with user authentication)
-- These policies should be updated when user management is implemented
CREATE POLICY leads_all_access ON leads FOR ALL USING (true);
CREATE POLICY audit_logs_all_access ON audit_logs FOR ALL USING (true);

-- =============================================================================
-- Comments for documentation
-- =============================================================================

COMMENT ON TABLE leads IS 'Patient intake leads with PHI encrypted at rest';
COMMENT ON TABLE audit_logs IS 'HIPAA-compliant audit trail for all PHI access';

COMMENT ON COLUMN leads.first_name_encrypted IS 'AES-256 encrypted first name (PHI)';
COMMENT ON COLUMN leads.last_name_encrypted IS 'AES-256 encrypted last name (PHI)';
COMMENT ON COLUMN leads.email_encrypted IS 'AES-256 encrypted email address (PHI)';
COMMENT ON COLUMN leads.phone_encrypted IS 'AES-256 encrypted phone number (PHI)';
COMMENT ON COLUMN leads.ip_address_hash IS 'SHA-256 hashed IP address for privacy';

COMMENT ON COLUMN audit_logs.old_values IS 'Previous field values for UPDATE actions (PHI excluded)';
COMMENT ON COLUMN audit_logs.new_values IS 'New field values for UPDATE actions (PHI excluded)';
