-- NeuroReach AI - Scale for Millions of Leads
-- Critical indexes and optimizations for production scale
-- Created: 2/6/2026

-- =============================================================================
-- LEAD ASSIGNMENT FEATURE - MUST RUN FIRST
-- Add assigned_coordinator_id column to leads table before creating indexes on it
-- =============================================================================

-- Add column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'leads' AND column_name = 'assigned_coordinator_id'
    ) THEN
        ALTER TABLE leads 
        ADD COLUMN assigned_coordinator_id UUID REFERENCES users(id) ON DELETE SET NULL;
        
        COMMENT ON COLUMN leads.assigned_coordinator_id IS 
        'Coordinator assigned to this lead - enables workload distribution';
    END IF;
END $$;

-- =============================================================================
-- CRITICAL MISSING INDEXES
-- =============================================================================

-- Index for last_updated_at (DEFAULT SORT for coordinator dashboard)
-- This is the MOST IMPORTANT index - every dashboard page load uses this
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_last_updated_desc 
ON leads(last_updated_at DESC NULLS FIRST, created_at DESC) 
WHERE deleted_at IS NULL;

-- Compound index for status filter + last_updated_at sort
-- Covers the most common query: "Show me leads with status X, sorted by recent activity"
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_status_last_updated 
ON leads(status, last_updated_at DESC NULLS FIRST) 
WHERE deleted_at IS NULL;

-- Index for priority filter + last_updated_at sort
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_priority_last_updated 
ON leads(priority, last_updated_at DESC NULLS FIRST) 
WHERE deleted_at IS NULL;

-- Index for assigned coordinator filtering (NEW - for lead assignment feature)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_assigned_coordinator 
ON leads(assigned_coordinator_id, status, last_updated_at DESC NULLS FIRST) 
WHERE deleted_at IS NULL AND assigned_coordinator_id IS NOT NULL;

-- =============================================================================
-- AUDIT LOG ENHANCEMENTS FOR HIPAA COMPLIANCE
-- =============================================================================

-- Index for audit log table_name + record_id lookup (show me all actions on this record)
-- This supports queries like "show me all actions on lead XYZ"
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_table_record 
ON audit_logs(table_name, record_id, created_at DESC);

-- Index for user_id tracking (show me all actions by user XYZ)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_user_actions 
ON audit_logs(user_id, created_at DESC) 
WHERE user_id IS NOT NULL;

-- Index for IP hash tracking (security audits - track actions from specific IPs)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_ip_hash 
ON audit_logs(user_ip_hash, created_at DESC) 
WHERE user_ip_hash IS NOT NULL;

-- =============================================================================
-- PROVIDER INDEXES FOR SCALE
-- =============================================================================

-- Index for provider status + total_referrals (leaderboard queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_providers_active_referrals 
ON referring_providers(status, total_referrals DESC NULLS LAST, converted_referrals DESC NULLS LAST);

-- =============================================================================
-- USER INDEXES FOR MULTI-USER OPERATIONS
-- =============================================================================

-- Index for user role + status (find active coordinators for assignment)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role_status 
ON users(role, status) 
WHERE status = 'active';

-- Index for user email lookup (login performance)
-- Note: Already has unique constraint, but explicit index helps with case-insensitive lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_lower 
ON users(LOWER(email));

-- =============================================================================
-- ANALYTICS PERFORMANCE INDEXES
-- Note: Date-based analytics indexes removed due to DATE() function not being IMMUTABLE
-- Application will filter by timestamp ranges instead (e.g., WHERE created_at >= '2024-01-01')
-- =============================================================================

-- =============================================================================
-- PARTIAL INDEXES FOR HOT PATHS
-- =============================================================================

-- Partial index for NEW leads only (heavily queried queue)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_new_queue 
ON leads(last_updated_at DESC NULLS FIRST, priority, created_at DESC) 
WHERE status = 'NEW' AND deleted_at IS NULL;

-- Partial index for HOT priority leads (high-value segment)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_hot_priority 
ON leads(status, last_updated_at DESC NULLS FIRST, created_at DESC) 
WHERE priority = 'HOT' AND deleted_at IS NULL;

-- Partial index for leads with follow-up dates (app filters by date range)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_followup_scheduled 
ON leads(next_follow_up_at, priority, assigned_coordinator_id) 
WHERE next_follow_up_at IS NOT NULL AND deleted_at IS NULL;

-- =============================================================================
-- STATISTICS UPDATE
-- Ensure query planner has fresh statistics after index creation
-- =============================================================================

ANALYZE leads;
ANALYZE referring_providers;
ANALYZE audit_logs;
ANALYZE users;

-- =============================================================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON INDEX idx_leads_last_updated_desc IS 
'PRIMARY dashboard sort: shows recently updated leads first (any status change marks activity)';

COMMENT ON INDEX idx_leads_status_last_updated IS 
'Compound index: filter by status + sort by recent activity - covers 80% of dashboard queries';

COMMENT ON INDEX idx_leads_assigned_coordinator IS 
'Lead assignment: filter "my leads" efficiently for coordinators with 1000+ assigned leads';

COMMENT ON INDEX idx_audit_table_record IS 
'HIPAA audit requirement: show all actions taken on a specific record (by table + record_id)';

COMMENT ON INDEX idx_audit_user_actions IS 
'HIPAA audit requirement: show all actions taken by a specific user';

COMMENT ON INDEX idx_audit_ip_hash IS 
'Security audit: track all actions from a specific IP address (hashed for privacy)';

COMMENT ON INDEX idx_leads_new_queue IS 
'Hot path optimization: NEW leads queue with priority sorting';

COMMENT ON INDEX idx_leads_hot_priority IS 
'Hot path optimization: HOT priority leads across all statuses';

COMMENT ON INDEX idx_leads_followup_scheduled IS 
'Hot path optimization: leads with scheduled follow-ups (app filters by date range)';
