-- NeuroReach AI - Performance Optimization Indexes
-- Phase 1: Database indexes for production scale (millions of leads, thousands of concurrent users)
-- Created: 2/5/2026

-- =============================================================================
-- CRITICAL: Performance Indexes for Lead Queries
-- These indexes support the most frequent dashboard queries
-- =============================================================================

-- Index for queue filtering (New Leads, Follow-up, Callback, etc.)
-- Covers: status filtering with contact_outcome for sub-queue filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_status_outcome 
ON leads(status, contact_outcome) 
WHERE deleted_at IS NULL;

-- Index for priority-based sorting within queues
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_priority_created 
ON leads(priority, created_at DESC) 
WHERE deleted_at IS NULL;

-- Index for callback queue (leads with scheduled callbacks)
-- CRITICAL: Supports "Requested Callback Time" column sorting
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_callback_scheduled 
ON leads(scheduled_callback_at DESC NULLS LAST, priority) 
WHERE scheduled_callback_at IS NOT NULL AND deleted_at IS NULL;

-- Index for follow-up queue (leads with next_follow_up_at)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_followup 
ON leads(next_follow_up_at DESC NULLS LAST, contact_outcome) 
WHERE next_follow_up_at IS NOT NULL AND deleted_at IS NULL;

-- Index for referral tracking (provider dashboard)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_referral_provider 
ON leads(referring_provider_id, created_at DESC) 
WHERE is_referral = true AND deleted_at IS NULL;

-- Index for contact attempt tracking (coordinator workflow)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_contact_attempts 
ON leads(contact_attempts, last_contact_attempt DESC) 
WHERE deleted_at IS NULL;

-- =============================================================================
-- CRITICAL: Composite Indexes for Dashboard Aggregations
-- These support fast COUNT(*) and GROUP BY queries
-- =============================================================================

-- Dashboard stats: count by status and priority (daily reporting)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_stats_composite 
ON leads(status, priority, in_service_area, created_at::date) 
WHERE deleted_at IS NULL;

-- Conversion tracking: leads converted within time periods
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_conversion_tracking 
ON leads(status, converted_at) 
WHERE converted_at IS NOT NULL AND deleted_at IS NULL;

-- =============================================================================
-- PROVIDER DASHBOARD INDEXES
-- =============================================================================

-- Provider lookup by email (for webhook matching)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_providers_email_lower 
ON referring_providers(LOWER(email)) 
WHERE email IS NOT NULL;

-- Provider lookup by name (case-insensitive)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_providers_name_lower 
ON referring_providers(LOWER(name));

-- Provider specialty filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_providers_specialty_status 
ON referring_providers(specialty, status);

-- Provider referral stats (for Top Referring Providers dashboard)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_providers_referral_stats 
ON referring_providers(total_referrals DESC, converted_referrals DESC) 
WHERE status = 'ACTIVE';

-- =============================================================================
-- AUDIT LOG INDEXES (HIPAA Compliance - Fast Access Logs)
-- =============================================================================

-- Audit log queries by date range (required for compliance reporting)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_date_action 
ON audit_logs(created_at DESC, action);

-- Audit log queries by user (track PHI access by user)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_user_action 
ON audit_logs(user_id, action, created_at DESC) 
WHERE user_id IS NOT NULL;

-- =============================================================================
-- FULL-TEXT SEARCH INDEX (Lead Search)
-- Supports searching lead_number efficiently
-- =============================================================================

-- GIN index for lead_number pattern matching (prefix search)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_number_trgm 
ON leads USING gin (lead_number gin_trgm_ops);

-- =============================================================================
-- STATISTICS UPDATE
-- Ensure query planner has accurate statistics
-- =============================================================================

ANALYZE leads;
ANALYZE referring_providers;
ANALYZE audit_logs;

-- =============================================================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON INDEX idx_leads_status_outcome IS 'Queue filtering: status + contact_outcome for sub-queue views';
COMMENT ON INDEX idx_leads_callback_scheduled IS 'Callback queue: sorted by scheduled time for "Requested Callback Time" column';
COMMENT ON INDEX idx_leads_followup IS 'Follow-up queue: leads needing follow-up, sorted by next_follow_up_at';
COMMENT ON INDEX idx_leads_referral_provider IS 'Provider dashboard: referral leads by provider with date';
COMMENT ON INDEX idx_leads_stats_composite IS 'Dashboard aggregations: fast COUNT/GROUP BY for metrics';
COMMENT ON INDEX idx_providers_email_lower IS 'Webhook matching: find provider by email (case-insensitive)';
COMMENT ON INDEX idx_leads_number_trgm IS 'Lead search: trigram index for partial lead_number matches';
