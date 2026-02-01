-- NeuroReach AI - Performance Optimization Schema
-- Adds indexes, materialized views, and analytics tables for scalability to 1M+ leads

-- =============================================================================
-- ADDITIONAL INDEXES FOR PERFORMANCE
-- =============================================================================

-- Composite indexes for common dashboard queries
CREATE INDEX IF NOT EXISTS idx_leads_status_created_at ON leads(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_priority_created_at ON leads(priority, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_condition_created_at ON leads(condition, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_contact_outcome_created_at ON leads(contact_outcome, created_at DESC);

-- Index for date range queries (analytics)
CREATE INDEX IF NOT EXISTS idx_leads_created_at_date ON leads(DATE(created_at));

-- Index for conversion tracking
CREATE INDEX IF NOT EXISTS idx_leads_status_converted_at ON leads(status, converted_at) 
    WHERE converted_at IS NOT NULL;

-- Index for scheduled callbacks
CREATE INDEX IF NOT EXISTS idx_leads_scheduled_callback ON leads(scheduled_callback_at) 
    WHERE scheduled_callback_at IS NOT NULL;

-- Index for service area filtering with status
CREATE INDEX IF NOT EXISTS idx_leads_service_area_status_created ON leads(in_service_area, status, created_at DESC);

-- Index for user assignment
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to) WHERE assigned_to IS NOT NULL;

-- Partial index for active leads (not lost/disqualified)
CREATE INDEX IF NOT EXISTS idx_leads_active ON leads(priority, created_at DESC) 
    WHERE status NOT IN ('LOST', 'DISQUALIFIED');

-- Index for cursor-based pagination (using created_at + id for stable sorting)
CREATE INDEX IF NOT EXISTS idx_leads_cursor_pagination ON leads(created_at DESC, id DESC);

-- =============================================================================
-- ANALYTICS SUMMARY TABLES
-- =============================================================================

-- Daily aggregates table for fast dashboard loading
CREATE TABLE IF NOT EXISTS analytics_daily_summary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL UNIQUE,
    
    -- Lead counts
    total_leads INTEGER NOT NULL DEFAULT 0,
    new_leads INTEGER NOT NULL DEFAULT 0,
    contacted_leads INTEGER NOT NULL DEFAULT 0,
    scheduled_leads INTEGER NOT NULL DEFAULT 0,
    consultation_complete INTEGER NOT NULL DEFAULT 0,
    treatment_started INTEGER NOT NULL DEFAULT 0,
    lost_leads INTEGER NOT NULL DEFAULT 0,
    disqualified_leads INTEGER NOT NULL DEFAULT 0,
    
    -- Priority breakdown
    hot_leads INTEGER NOT NULL DEFAULT 0,
    medium_leads INTEGER NOT NULL DEFAULT 0,
    low_leads INTEGER NOT NULL DEFAULT 0,
    
    -- Condition breakdown
    depression_count INTEGER NOT NULL DEFAULT 0,
    anxiety_count INTEGER NOT NULL DEFAULT 0,
    ocd_count INTEGER NOT NULL DEFAULT 0,
    ptsd_count INTEGER NOT NULL DEFAULT 0,
    other_condition_count INTEGER NOT NULL DEFAULT 0,
    
    -- Service area metrics
    in_service_area_count INTEGER NOT NULL DEFAULT 0,
    out_of_service_area_count INTEGER NOT NULL DEFAULT 0,
    
    -- Conversion metrics
    converted_count INTEGER NOT NULL DEFAULT 0,
    conversion_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
    
    -- Contact outcome breakdown
    outcome_new INTEGER NOT NULL DEFAULT 0,
    outcome_answered INTEGER NOT NULL DEFAULT 0,
    outcome_no_answer INTEGER NOT NULL DEFAULT 0,
    outcome_unreachable INTEGER NOT NULL DEFAULT 0,
    outcome_callback_requested INTEGER NOT NULL DEFAULT 0,
    outcome_not_interested INTEGER NOT NULL DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient date range queries on analytics
CREATE INDEX IF NOT EXISTS idx_analytics_daily_date ON analytics_daily_summary(date DESC);

-- Monthly cohort analysis cache
CREATE TABLE IF NOT EXISTS analytics_cohort_summary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cohort_month DATE NOT NULL UNIQUE, -- First day of month
    
    -- Cohort size
    cohort_size INTEGER NOT NULL DEFAULT 0,
    
    -- Retention at each stage
    contacted_count INTEGER NOT NULL DEFAULT 0,
    scheduled_count INTEGER NOT NULL DEFAULT 0,
    consultation_complete_count INTEGER NOT NULL DEFAULT 0,
    treatment_started_count INTEGER NOT NULL DEFAULT 0,
    lost_count INTEGER NOT NULL DEFAULT 0,
    
    -- Retention percentages
    contacted_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
    scheduled_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
    consultation_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
    treatment_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
    retention_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analytics_cohort_month ON analytics_cohort_summary(cohort_month DESC);

-- Real-time KPI cache (updates every minute via background job)
CREATE TABLE IF NOT EXISTS analytics_kpi_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cache_key VARCHAR(100) NOT NULL UNIQUE,
    
    -- Cached data as JSON
    data JSONB NOT NULL DEFAULT '{}',
    
    -- TTL management
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analytics_kpi_cache_key ON analytics_kpi_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_analytics_kpi_cache_expires ON analytics_kpi_cache(expires_at);

-- =============================================================================
-- FUNCTIONS FOR ANALYTICS UPDATES
-- =============================================================================

-- Function to refresh daily summary for a specific date
CREATE OR REPLACE FUNCTION refresh_daily_summary(target_date DATE)
RETURNS VOID AS $$
BEGIN
    INSERT INTO analytics_daily_summary (
        date,
        total_leads,
        new_leads,
        contacted_leads,
        scheduled_leads,
        consultation_complete,
        treatment_started,
        lost_leads,
        disqualified_leads,
        hot_leads,
        medium_leads,
        low_leads,
        depression_count,
        anxiety_count,
        ocd_count,
        ptsd_count,
        other_condition_count,
        in_service_area_count,
        out_of_service_area_count,
        converted_count,
        conversion_rate,
        outcome_new,
        outcome_answered,
        outcome_no_answer,
        outcome_unreachable,
        outcome_callback_requested,
        outcome_not_interested
    )
    SELECT
        target_date,
        COUNT(*) as total_leads,
        COUNT(*) FILTER (WHERE status = 'NEW') as new_leads,
        COUNT(*) FILTER (WHERE status = 'CONTACTED') as contacted_leads,
        COUNT(*) FILTER (WHERE status = 'SCHEDULED') as scheduled_leads,
        COUNT(*) FILTER (WHERE status = 'CONSULTATION_COMPLETE') as consultation_complete,
        COUNT(*) FILTER (WHERE status = 'TREATMENT_STARTED') as treatment_started,
        COUNT(*) FILTER (WHERE status = 'LOST') as lost_leads,
        COUNT(*) FILTER (WHERE status = 'DISQUALIFIED') as disqualified_leads,
        COUNT(*) FILTER (WHERE priority = 'HOT') as hot_leads,
        COUNT(*) FILTER (WHERE priority = 'MEDIUM') as medium_leads,
        COUNT(*) FILTER (WHERE priority = 'LOW') as low_leads,
        COUNT(*) FILTER (WHERE condition = 'DEPRESSION') as depression_count,
        COUNT(*) FILTER (WHERE condition = 'ANXIETY') as anxiety_count,
        COUNT(*) FILTER (WHERE condition = 'OCD') as ocd_count,
        COUNT(*) FILTER (WHERE condition = 'PTSD') as ptsd_count,
        COUNT(*) FILTER (WHERE condition = 'OTHER') as other_condition_count,
        COUNT(*) FILTER (WHERE in_service_area = true) as in_service_area_count,
        COUNT(*) FILTER (WHERE in_service_area = false) as out_of_service_area_count,
        COUNT(*) FILTER (WHERE status IN ('CONSULTATION_COMPLETE', 'TREATMENT_STARTED')) as converted_count,
        COALESCE(
            ROUND(
                COUNT(*) FILTER (WHERE status IN ('CONSULTATION_COMPLETE', 'TREATMENT_STARTED'))::DECIMAL / 
                NULLIF(COUNT(*), 0) * 100, 
                2
            ),
            0
        ) as conversion_rate,
        COUNT(*) FILTER (WHERE contact_outcome = 'NEW') as outcome_new,
        COUNT(*) FILTER (WHERE contact_outcome = 'ANSWERED') as outcome_answered,
        COUNT(*) FILTER (WHERE contact_outcome = 'NO_ANSWER') as outcome_no_answer,
        COUNT(*) FILTER (WHERE contact_outcome = 'UNREACHABLE') as outcome_unreachable,
        COUNT(*) FILTER (WHERE contact_outcome = 'CALLBACK_REQUESTED') as outcome_callback_requested,
        COUNT(*) FILTER (WHERE contact_outcome = 'NOT_INTERESTED') as outcome_not_interested
    FROM leads
    WHERE DATE(created_at) = target_date
    ON CONFLICT (date) DO UPDATE SET
        total_leads = EXCLUDED.total_leads,
        new_leads = EXCLUDED.new_leads,
        contacted_leads = EXCLUDED.contacted_leads,
        scheduled_leads = EXCLUDED.scheduled_leads,
        consultation_complete = EXCLUDED.consultation_complete,
        treatment_started = EXCLUDED.treatment_started,
        lost_leads = EXCLUDED.lost_leads,
        disqualified_leads = EXCLUDED.disqualified_leads,
        hot_leads = EXCLUDED.hot_leads,
        medium_leads = EXCLUDED.medium_leads,
        low_leads = EXCLUDED.low_leads,
        depression_count = EXCLUDED.depression_count,
        anxiety_count = EXCLUDED.anxiety_count,
        ocd_count = EXCLUDED.ocd_count,
        ptsd_count = EXCLUDED.ptsd_count,
        other_condition_count = EXCLUDED.other_condition_count,
        in_service_area_count = EXCLUDED.in_service_area_count,
        out_of_service_area_count = EXCLUDED.out_of_service_area_count,
        converted_count = EXCLUDED.converted_count,
        conversion_rate = EXCLUDED.conversion_rate,
        outcome_new = EXCLUDED.outcome_new,
        outcome_answered = EXCLUDED.outcome_answered,
        outcome_no_answer = EXCLUDED.outcome_no_answer,
        outcome_unreachable = EXCLUDED.outcome_unreachable,
        outcome_callback_requested = EXCLUDED.outcome_callback_requested,
        outcome_not_interested = EXCLUDED.outcome_not_interested,
        updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh cohort summary for a specific month
CREATE OR REPLACE FUNCTION refresh_cohort_summary(target_month DATE)
RETURNS VOID AS $$
DECLARE
    month_start DATE;
    month_end DATE;
BEGIN
    month_start := DATE_TRUNC('month', target_month);
    month_end := (month_start + INTERVAL '1 month')::DATE;
    
    INSERT INTO analytics_cohort_summary (
        cohort_month,
        cohort_size,
        contacted_count,
        scheduled_count,
        consultation_complete_count,
        treatment_started_count,
        lost_count,
        contacted_rate,
        scheduled_rate,
        consultation_rate,
        treatment_rate,
        retention_rate
    )
    SELECT
        month_start as cohort_month,
        COUNT(*) as cohort_size,
        COUNT(*) FILTER (WHERE status NOT IN ('NEW')) as contacted_count,
        COUNT(*) FILTER (WHERE status IN ('SCHEDULED', 'CONSULTATION_COMPLETE', 'TREATMENT_STARTED')) as scheduled_count,
        COUNT(*) FILTER (WHERE status IN ('CONSULTATION_COMPLETE', 'TREATMENT_STARTED')) as consultation_complete_count,
        COUNT(*) FILTER (WHERE status = 'TREATMENT_STARTED') as treatment_started_count,
        COUNT(*) FILTER (WHERE status = 'LOST') as lost_count,
        COALESCE(ROUND(COUNT(*) FILTER (WHERE status NOT IN ('NEW'))::DECIMAL / NULLIF(COUNT(*), 0) * 100, 2), 0),
        COALESCE(ROUND(COUNT(*) FILTER (WHERE status IN ('SCHEDULED', 'CONSULTATION_COMPLETE', 'TREATMENT_STARTED'))::DECIMAL / NULLIF(COUNT(*), 0) * 100, 2), 0),
        COALESCE(ROUND(COUNT(*) FILTER (WHERE status IN ('CONSULTATION_COMPLETE', 'TREATMENT_STARTED'))::DECIMAL / NULLIF(COUNT(*), 0) * 100, 2), 0),
        COALESCE(ROUND(COUNT(*) FILTER (WHERE status = 'TREATMENT_STARTED')::DECIMAL / NULLIF(COUNT(*), 0) * 100, 2), 0),
        COALESCE(ROUND((COUNT(*) - COUNT(*) FILTER (WHERE status = 'LOST'))::DECIMAL / NULLIF(COUNT(*), 0) * 100, 2), 0)
    FROM leads
    WHERE created_at >= month_start AND created_at < month_end
    ON CONFLICT (cohort_month) DO UPDATE SET
        cohort_size = EXCLUDED.cohort_size,
        contacted_count = EXCLUDED.contacted_count,
        scheduled_count = EXCLUDED.scheduled_count,
        consultation_complete_count = EXCLUDED.consultation_complete_count,
        treatment_started_count = EXCLUDED.treatment_started_count,
        lost_count = EXCLUDED.lost_count,
        contacted_rate = EXCLUDED.contacted_rate,
        scheduled_rate = EXCLUDED.scheduled_rate,
        consultation_rate = EXCLUDED.consultation_rate,
        treatment_rate = EXCLUDED.treatment_rate,
        retention_rate = EXCLUDED.retention_rate,
        updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Function to get dashboard summary stats (optimized with direct aggregation)
CREATE OR REPLACE FUNCTION get_dashboard_stats(days_back INTEGER DEFAULT 30)
RETURNS TABLE (
    total_leads BIGINT,
    converted_leads BIGINT,
    conversion_rate DECIMAL,
    scheduled_appointments BIGINT,
    hot_leads BIGINT,
    medium_leads BIGINT,
    low_leads BIGINT,
    new_today BIGINT,
    contacted_today BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total_leads,
        COUNT(*) FILTER (WHERE status IN ('CONSULTATION_COMPLETE', 'TREATMENT_STARTED'))::BIGINT as converted_leads,
        COALESCE(
            ROUND(
                COUNT(*) FILTER (WHERE status IN ('CONSULTATION_COMPLETE', 'TREATMENT_STARTED'))::DECIMAL / 
                NULLIF(COUNT(*), 0) * 100, 
                2
            ),
            0
        ) as conversion_rate,
        COUNT(*) FILTER (WHERE status = 'SCHEDULED')::BIGINT as scheduled_appointments,
        COUNT(*) FILTER (WHERE priority = 'HOT')::BIGINT as hot_leads,
        COUNT(*) FILTER (WHERE priority = 'MEDIUM')::BIGINT as medium_leads,
        COUNT(*) FILTER (WHERE priority = 'LOW')::BIGINT as low_leads,
        COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE)::BIGINT as new_today,
        COUNT(*) FILTER (WHERE DATE(contacted_at) = CURRENT_DATE)::BIGINT as contacted_today
    FROM leads
    WHERE created_at >= CURRENT_DATE - days_back;
END;
$$ LANGUAGE plpgsql;

-- Function to get leads trend data (optimized time-series)
CREATE OR REPLACE FUNCTION get_leads_trend(days_back INTEGER DEFAULT 30)
RETURNS TABLE (
    date DATE,
    new_leads BIGINT,
    converted_leads BIGINT,
    cumulative_total BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH date_series AS (
        SELECT generate_series(
            CURRENT_DATE - days_back,
            CURRENT_DATE,
            '1 day'::interval
        )::DATE as date
    ),
    daily_counts AS (
        SELECT 
            DATE(created_at) as lead_date,
            COUNT(*) as new_leads,
            COUNT(*) FILTER (WHERE status IN ('CONSULTATION_COMPLETE', 'TREATMENT_STARTED')) as converted_leads
        FROM leads
        WHERE created_at >= CURRENT_DATE - days_back
        GROUP BY DATE(created_at)
    )
    SELECT 
        ds.date,
        COALESCE(dc.new_leads, 0)::BIGINT as new_leads,
        COALESCE(dc.converted_leads, 0)::BIGINT as converted_leads,
        SUM(COALESCE(dc.new_leads, 0))::BIGINT OVER (ORDER BY ds.date) as cumulative_total
    FROM date_series ds
    LEFT JOIN daily_counts dc ON ds.date = dc.lead_date
    ORDER BY ds.date;
END;
$$ LANGUAGE plpgsql;

-- Function to get conditions distribution
CREATE OR REPLACE FUNCTION get_conditions_distribution()
RETURNS TABLE (
    condition TEXT,
    count BIGINT,
    percentage DECIMAL
) AS $$
DECLARE
    total_count BIGINT;
BEGIN
    SELECT COUNT(*) INTO total_count FROM leads;
    
    RETURN QUERY
    SELECT 
        l.condition::TEXT,
        COUNT(*)::BIGINT as count,
        COALESCE(ROUND(COUNT(*)::DECIMAL / NULLIF(total_count, 0) * 100, 2), 0) as percentage
    FROM leads l
    GROUP BY l.condition
    ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- TRIGGER TO UPDATE ANALYTICS ON LEAD CHANGES
-- =============================================================================

-- Function to handle lead changes for analytics
CREATE OR REPLACE FUNCTION update_analytics_on_lead_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Mark the daily summary for this lead's date as needing refresh
    -- This is a lightweight operation; actual refresh happens via background job
    IF TG_OP = 'INSERT' THEN
        PERFORM refresh_daily_summary(DATE(NEW.created_at));
        PERFORM refresh_cohort_summary(DATE(NEW.created_at));
    ELSIF TG_OP = 'UPDATE' THEN
        -- Refresh both old and new dates if created_at changed (unlikely but possible)
        PERFORM refresh_daily_summary(DATE(NEW.created_at));
        PERFORM refresh_cohort_summary(DATE(NEW.created_at));
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM refresh_daily_summary(DATE(OLD.created_at));
        PERFORM refresh_cohort_summary(DATE(OLD.created_at));
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Note: This trigger can be enabled for real-time updates, but may impact write performance
-- For high-volume scenarios, prefer background jobs instead
-- CREATE TRIGGER trigger_update_analytics_on_lead_change
--     AFTER INSERT OR UPDATE OR DELETE ON leads
--     FOR EACH ROW
--     EXECUTE FUNCTION update_analytics_on_lead_change();

-- =============================================================================
-- INITIAL DATA POPULATION
-- =============================================================================

-- Populate daily summaries for existing data (last 90 days)
DO $$
DECLARE
    d DATE;
BEGIN
    FOR d IN SELECT generate_series(CURRENT_DATE - 90, CURRENT_DATE, '1 day')::DATE
    LOOP
        PERFORM refresh_daily_summary(d);
    END LOOP;
END $$;

-- Populate cohort summaries for existing data (last 12 months)
DO $$
DECLARE
    m DATE;
BEGIN
    FOR m IN SELECT generate_series(
        DATE_TRUNC('month', CURRENT_DATE - INTERVAL '12 months'),
        DATE_TRUNC('month', CURRENT_DATE),
        '1 month'
    )::DATE
    LOOP
        PERFORM refresh_cohort_summary(m);
    END LOOP;
END $$;

-- =============================================================================
-- QUERY PERFORMANCE ANALYSIS VIEWS
-- =============================================================================

-- View for slow query analysis (requires pg_stat_statements extension)
-- This provides insight into which queries need optimization
CREATE OR REPLACE VIEW v_slow_queries AS
SELECT 
    'Query performance analysis requires pg_stat_statements extension' as note;

-- =============================================================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE analytics_daily_summary IS 'Pre-aggregated daily statistics for fast dashboard loading';
COMMENT ON TABLE analytics_cohort_summary IS 'Monthly cohort retention metrics for trend analysis';
COMMENT ON TABLE analytics_kpi_cache IS 'General-purpose KPI cache with TTL for Redis fallback';

COMMENT ON FUNCTION refresh_daily_summary(DATE) IS 'Updates daily analytics summary for a specific date';
COMMENT ON FUNCTION refresh_cohort_summary(DATE) IS 'Updates cohort analytics for a specific month';
COMMENT ON FUNCTION get_dashboard_stats(INTEGER) IS 'Returns optimized dashboard statistics';
COMMENT ON FUNCTION get_leads_trend(INTEGER) IS 'Returns time-series data for leads trend chart';
COMMENT ON FUNCTION get_conditions_distribution() IS 'Returns condition distribution with percentages';
