-- NeuroReach AI - Platform Analytics Schema
-- High-performance platform/source tracking for millions of leads
-- Supports: widget, jotform, google_ads, and future integrations

-- =============================================================================
-- ENABLE REQUIRED EXTENSIONS
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- =============================================================================
-- ADD SOURCE COLUMN TO LEADS TABLE
-- =============================================================================

-- Create source enum type for platform tracking
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_source') THEN
        CREATE TYPE lead_source AS ENUM (
            'widget',
            'jotform', 
            'google_ads',
            'referral',
            'manual',
            'api',
            'import'
        );
    END IF;
END $$;

-- Add source column to leads table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'leads' AND column_name = 'source') THEN
        ALTER TABLE leads ADD COLUMN source lead_source NOT NULL DEFAULT 'widget';
    END IF;
END $$;

-- Update existing leads to have 'widget' as source (since widget is currently active)
UPDATE leads SET source = 'widget' WHERE source IS NULL;

-- =============================================================================
-- PLATFORM CONFIGURATION TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS platforms (
    id VARCHAR(50) PRIMARY KEY,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50) DEFAULT 'link',
    color VARCHAR(20) DEFAULT '#6366F1',
    status VARCHAR(20) DEFAULT 'pending_integration',
    setup_url VARCHAR(255),
    api_key_required BOOLEAN DEFAULT false,
    webhook_url VARCHAR(255),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default platforms
INSERT INTO platforms (id, display_name, description, icon, color, status) VALUES
    ('widget', 'Website Widget', 'Embedded intake form on website', 'widget', '#6366F1', 'active'),
    ('jotform', 'JotForm', 'JotForm integration for external forms', 'clipboard-list', '#F59E0B', 'pending_integration'),
    ('google_ads', 'Google Ads', 'Google Ads lead form extensions', 'megaphone', '#EF4444', 'pending_integration'),
    ('referral', 'Referral', 'Provider referral leads', 'users', '#22C55E', 'active'),
    ('manual', 'Manual Entry', 'Manually entered leads', 'pencil', '#10B981', 'active'),
    ('api', 'API Integration', 'Third-party API submissions', 'code', '#8B5CF6', 'active'),
    ('import', 'CSV Import', 'Bulk imported leads', 'upload', '#06B6D4', 'active')
ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    color = EXCLUDED.color,
    updated_at = NOW();

-- =============================================================================
-- OPTIMIZED INDEXES FOR PLATFORM ANALYTICS
-- =============================================================================

-- Composite indexes for platform-specific analytics queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_source_created 
    ON leads (source, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_source_status 
    ON leads (source, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_source_priority 
    ON leads (source, priority);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_source_status_created 
    ON leads (source, status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_source_priority_created 
    ON leads (source, priority, created_at DESC);

-- Partial indexes for hot queries (specific high-value filters)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_hot_by_source 
    ON leads (source, created_at DESC) 
    WHERE priority = 'HOT';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_converted_by_source 
    ON leads (source, converted_at DESC) 
    WHERE status IN ('CONSULTATION_COMPLETE', 'TREATMENT_STARTED');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_new_by_source 
    ON leads (source, created_at DESC) 
    WHERE status = 'NEW';

-- BRIN index for time-series data (very efficient for large tables with sorted data)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_created_brin 
    ON leads USING BRIN (created_at) WITH (pages_per_range = 32);

-- =============================================================================
-- MATERIALIZED VIEWS FOR PLATFORM ANALYTICS
-- =============================================================================

-- Main platform summary (refreshed every 5 minutes)
DROP MATERIALIZED VIEW IF EXISTS mv_platform_analytics CASCADE;
CREATE MATERIALIZED VIEW mv_platform_analytics AS
SELECT 
    source::TEXT as source,
    COUNT(*) as total_leads,
    COUNT(*) FILTER (WHERE status IN ('CONSULTATION_COMPLETE', 'TREATMENT_STARTED')) as converted_leads,
    COUNT(*) FILTER (WHERE priority = 'HOT') as hot_leads,
    COUNT(*) FILTER (WHERE priority = 'MEDIUM') as medium_leads,
    COUNT(*) FILTER (WHERE priority = 'LOW') as low_leads,
    COUNT(*) FILTER (WHERE status != 'NEW') as contacted_leads,
    COUNT(*) FILTER (WHERE status = 'SCHEDULED') as scheduled_leads,
    COUNT(*) FILTER (WHERE status = 'LOST') as lost_leads,
    COUNT(*) FILTER (WHERE status = 'DISQUALIFIED') as disqualified_leads,
    ROUND(
        COUNT(*) FILTER (WHERE status IN ('CONSULTATION_COMPLETE', 'TREATMENT_STARTED')) * 100.0 / NULLIF(COUNT(*), 0), 
        2
    ) as conversion_rate,
    ROUND(
        COUNT(*) FILTER (WHERE status != 'NEW') * 100.0 / NULLIF(COUNT(*), 0), 
        2
    ) as contact_rate,
    ROUND(
        (
            COUNT(*) FILTER (WHERE priority = 'HOT') * 3 +
            COUNT(*) FILTER (WHERE priority = 'MEDIUM') * 2 +
            COUNT(*) FILTER (WHERE priority = 'LOW') * 1
        )::DECIMAL / NULLIF(COUNT(*), 0),
        2
    ) as avg_quality_score,
    ROUND(
        AVG(
            EXTRACT(EPOCH FROM (converted_at - created_at)) / 86400
        ) FILTER (WHERE status IN ('CONSULTATION_COMPLETE', 'TREATMENT_STARTED') AND converted_at IS NOT NULL),
        2
    ) as avg_days_to_convert,
    ROUND(
        AVG(
            EXTRACT(EPOCH FROM (contacted_at - created_at)) / 3600
        ) FILTER (WHERE contacted_at IS NOT NULL),
        2
    ) as avg_hours_to_contact,
    MAX(created_at) as last_lead_at,
    MIN(created_at) as first_lead_at,
    NOW() as refreshed_at
FROM leads
GROUP BY source
WITH DATA;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_platform_analytics_source 
    ON mv_platform_analytics (source);

-- Daily stats by platform (for trend charts)
DROP MATERIALIZED VIEW IF EXISTS mv_platform_daily_stats CASCADE;
CREATE MATERIALIZED VIEW mv_platform_daily_stats AS
SELECT 
    source::TEXT as source,
    DATE(created_at) as lead_date,
    COUNT(*) as total_leads,
    COUNT(*) FILTER (WHERE status IN ('CONSULTATION_COMPLETE', 'TREATMENT_STARTED')) as converted_leads,
    COUNT(*) FILTER (WHERE priority = 'HOT') as hot_leads,
    COUNT(*) FILTER (WHERE priority = 'MEDIUM') as medium_leads,
    COUNT(*) FILTER (WHERE priority = 'LOW') as low_leads,
    COUNT(*) FILTER (WHERE status != 'NEW') as contacted_leads,
    COUNT(*) FILTER (WHERE status = 'SCHEDULED') as scheduled_leads
FROM leads
WHERE created_at >= NOW() - INTERVAL '90 days'
GROUP BY source, DATE(created_at)
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_platform_daily_source_date 
    ON mv_platform_daily_stats (source, lead_date);

-- Weekly stats for growth metrics
DROP MATERIALIZED VIEW IF EXISTS mv_platform_weekly_stats CASCADE;
CREATE MATERIALIZED VIEW mv_platform_weekly_stats AS
SELECT 
    source::TEXT as source,
    DATE_TRUNC('week', created_at)::DATE as week_start,
    COUNT(*) as total_leads,
    COUNT(*) FILTER (WHERE status IN ('CONSULTATION_COMPLETE', 'TREATMENT_STARTED')) as converted_leads,
    COUNT(*) FILTER (WHERE priority = 'HOT') as hot_leads,
    ROUND(
        COUNT(*) FILTER (WHERE status IN ('CONSULTATION_COMPLETE', 'TREATMENT_STARTED')) * 100.0 / NULLIF(COUNT(*), 0),
        2
    ) as conversion_rate
FROM leads
WHERE created_at >= NOW() - INTERVAL '1 year'
GROUP BY source, DATE_TRUNC('week', created_at)
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_platform_weekly_source_week 
    ON mv_platform_weekly_stats (source, week_start);

-- Monthly stats for long-term analysis
DROP MATERIALIZED VIEW IF EXISTS mv_platform_monthly_stats CASCADE;
CREATE MATERIALIZED VIEW mv_platform_monthly_stats AS
SELECT 
    source::TEXT as source,
    DATE_TRUNC('month', created_at)::DATE as month_start,
    COUNT(*) as total_leads,
    COUNT(*) FILTER (WHERE status IN ('CONSULTATION_COMPLETE', 'TREATMENT_STARTED')) as converted_leads,
    COUNT(*) FILTER (WHERE priority = 'HOT') as hot_leads,
    ROUND(
        COUNT(*) FILTER (WHERE status IN ('CONSULTATION_COMPLETE', 'TREATMENT_STARTED')) * 100.0 / NULLIF(COUNT(*), 0),
        2
    ) as conversion_rate
FROM leads
WHERE created_at >= NOW() - INTERVAL '2 years'
GROUP BY source, DATE_TRUNC('month', created_at)
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_platform_monthly_source_month 
    ON mv_platform_monthly_stats (source, month_start);

-- Status distribution by platform
DROP MATERIALIZED VIEW IF EXISTS mv_platform_status_distribution CASCADE;
CREATE MATERIALIZED VIEW mv_platform_status_distribution AS
SELECT 
    source::TEXT as source,
    status::TEXT as status,
    COUNT(*) as count,
    ROUND(
        COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY source),
        2
    ) as percentage
FROM leads
GROUP BY source, status
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_platform_status_source_status 
    ON mv_platform_status_distribution (source, status);

-- Priority distribution by platform  
DROP MATERIALIZED VIEW IF EXISTS mv_platform_priority_distribution CASCADE;
CREATE MATERIALIZED VIEW mv_platform_priority_distribution AS
SELECT 
    source::TEXT as source,
    priority::TEXT as priority,
    COUNT(*) as count,
    ROUND(
        COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY source),
        2
    ) as percentage
FROM leads
GROUP BY source, priority
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_platform_priority_source_priority 
    ON mv_platform_priority_distribution (source, priority);

-- Condition distribution by platform
DROP MATERIALIZED VIEW IF EXISTS mv_platform_condition_distribution CASCADE;
CREATE MATERIALIZED VIEW mv_platform_condition_distribution AS
SELECT 
    source::TEXT as source,
    condition::TEXT as condition,
    COUNT(*) as count,
    ROUND(
        COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY source),
        2
    ) as percentage
FROM leads
GROUP BY source, condition
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_platform_condition_source_condition 
    ON mv_platform_condition_distribution (source, condition);

-- Hourly distribution by platform (for peak time analysis)
DROP MATERIALIZED VIEW IF EXISTS mv_platform_hourly_distribution CASCADE;
CREATE MATERIALIZED VIEW mv_platform_hourly_distribution AS
SELECT 
    source::TEXT as source,
    EXTRACT(HOUR FROM created_at)::INTEGER as hour_of_day,
    EXTRACT(DOW FROM created_at)::INTEGER as day_of_week,
    COUNT(*) as lead_count
FROM leads
WHERE created_at >= NOW() - INTERVAL '90 days'
GROUP BY source, EXTRACT(HOUR FROM created_at), EXTRACT(DOW FROM created_at)
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_platform_hourly_source_hour_day 
    ON mv_platform_hourly_distribution (source, hour_of_day, day_of_week);

-- =============================================================================
-- ANALYTICS REFRESH TRACKING TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS analytics_refresh_log (
    id SERIAL PRIMARY KEY,
    view_name VARCHAR(100) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    rows_affected INTEGER,
    status VARCHAR(20) DEFAULT 'running',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_refresh_log_view 
    ON analytics_refresh_log (view_name, created_at DESC);

-- =============================================================================
-- FUNCTIONS FOR MATERIALIZED VIEW REFRESH
-- =============================================================================

-- Function to refresh all platform analytics materialized views
CREATE OR REPLACE FUNCTION refresh_platform_analytics_views()
RETURNS TABLE (
    view_name TEXT,
    duration_ms INTEGER,
    status TEXT
) AS $$
DECLARE
    start_time TIMESTAMP;
    view_duration INTEGER;
    v_name TEXT;
    refresh_id INTEGER;
BEGIN
    -- Refresh each view and track performance
    FOR v_name IN 
        SELECT unnest(ARRAY[
            'mv_platform_analytics',
            'mv_platform_daily_stats',
            'mv_platform_weekly_stats',
            'mv_platform_monthly_stats',
            'mv_platform_status_distribution',
            'mv_platform_priority_distribution',
            'mv_platform_condition_distribution',
            'mv_platform_hourly_distribution'
        ])
    LOOP
        start_time := clock_timestamp();
        
        -- Log start
        INSERT INTO analytics_refresh_log (view_name, status)
        VALUES (v_name, 'running')
        RETURNING id INTO refresh_id;
        
        BEGIN
            -- Refresh the view concurrently
            EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY %I', v_name);
            
            view_duration := EXTRACT(MILLISECONDS FROM clock_timestamp() - start_time)::INTEGER;
            
            -- Log success
            UPDATE analytics_refresh_log 
            SET completed_at = NOW(),
                duration_ms = view_duration,
                status = 'success'
            WHERE id = refresh_id;
            
            view_name := v_name;
            duration_ms := view_duration;
            status := 'success';
            RETURN NEXT;
            
        EXCEPTION WHEN OTHERS THEN
            view_duration := EXTRACT(MILLISECONDS FROM clock_timestamp() - start_time)::INTEGER;
            
            -- Log failure
            UPDATE analytics_refresh_log 
            SET completed_at = NOW(),
                duration_ms = view_duration,
                status = 'failed',
                error_message = SQLERRM
            WHERE id = refresh_id;
            
            view_name := v_name;
            duration_ms := view_duration;
            status := 'failed: ' || SQLERRM;
            RETURN NEXT;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to get platform analytics summary (uses materialized view)
CREATE OR REPLACE FUNCTION get_platform_analytics_summary()
RETURNS TABLE (
    source TEXT,
    total_leads BIGINT,
    converted_leads BIGINT,
    conversion_rate DECIMAL,
    hot_leads BIGINT,
    medium_leads BIGINT,
    low_leads BIGINT,
    contacted_leads BIGINT,
    contact_rate DECIMAL,
    avg_quality_score DECIMAL,
    avg_days_to_convert DECIMAL,
    last_lead_at TIMESTAMP WITH TIME ZONE,
    refreshed_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pa.source,
        pa.total_leads::BIGINT,
        pa.converted_leads::BIGINT,
        pa.conversion_rate,
        pa.hot_leads::BIGINT,
        pa.medium_leads::BIGINT,
        pa.low_leads::BIGINT,
        pa.contacted_leads::BIGINT,
        pa.contact_rate,
        pa.avg_quality_score,
        pa.avg_days_to_convert,
        pa.last_lead_at,
        pa.refreshed_at
    FROM mv_platform_analytics pa
    ORDER BY pa.total_leads DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get platform daily trends
CREATE OR REPLACE FUNCTION get_platform_daily_trends(
    p_source TEXT DEFAULT NULL,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    source TEXT,
    lead_date DATE,
    total_leads BIGINT,
    converted_leads BIGINT,
    hot_leads BIGINT,
    contacted_leads BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pds.source,
        pds.lead_date,
        pds.total_leads::BIGINT,
        pds.converted_leads::BIGINT,
        pds.hot_leads::BIGINT,
        pds.contacted_leads::BIGINT
    FROM mv_platform_daily_stats pds
    WHERE pds.lead_date >= CURRENT_DATE - p_days
      AND (p_source IS NULL OR pds.source = p_source)
    ORDER BY pds.lead_date ASC, pds.source;
END;
$$ LANGUAGE plpgsql;

-- Function to get platform week-over-week growth
CREATE OR REPLACE FUNCTION get_platform_growth_metrics(
    p_weeks INTEGER DEFAULT 8
)
RETURNS TABLE (
    source TEXT,
    week_start DATE,
    total_leads BIGINT,
    prev_week_leads BIGINT,
    wow_growth DECIMAL,
    conversion_rate DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    WITH weekly_with_lag AS (
        SELECT 
            pws.source,
            pws.week_start,
            pws.total_leads,
            pws.conversion_rate,
            LAG(pws.total_leads) OVER (PARTITION BY pws.source ORDER BY pws.week_start) as prev_week
        FROM mv_platform_weekly_stats pws
        WHERE pws.week_start >= CURRENT_DATE - (p_weeks * 7)
    )
    SELECT 
        wwl.source,
        wwl.week_start,
        wwl.total_leads::BIGINT,
        COALESCE(wwl.prev_week, 0)::BIGINT as prev_week_leads,
        ROUND(
            (wwl.total_leads - COALESCE(wwl.prev_week, 0))::DECIMAL / 
            NULLIF(COALESCE(wwl.prev_week, 0), 0) * 100,
            2
        ) as wow_growth,
        wwl.conversion_rate
    FROM weekly_with_lag wwl
    ORDER BY wwl.week_start DESC, wwl.source;
END;
$$ LANGUAGE plpgsql;

-- Function to get platform status funnel
CREATE OR REPLACE FUNCTION get_platform_status_funnel(
    p_source TEXT DEFAULT NULL
)
RETURNS TABLE (
    source TEXT,
    status TEXT,
    count BIGINT,
    percentage DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        psd.source,
        psd.status,
        psd.count::BIGINT,
        psd.percentage
    FROM mv_platform_status_distribution psd
    WHERE (p_source IS NULL OR psd.source = p_source)
    ORDER BY 
        psd.source,
        CASE psd.status
            WHEN 'NEW' THEN 1
            WHEN 'CONTACTED' THEN 2
            WHEN 'SCHEDULED' THEN 3
            WHEN 'CONSULTATION_COMPLETE' THEN 4
            WHEN 'TREATMENT_STARTED' THEN 5
            WHEN 'LOST' THEN 6
            WHEN 'DISQUALIFIED' THEN 7
            ELSE 8
        END;
END;
$$ LANGUAGE plpgsql;

-- Function to get platform quality distribution
CREATE OR REPLACE FUNCTION get_platform_quality_distribution(
    p_source TEXT DEFAULT NULL
)
RETURNS TABLE (
    source TEXT,
    priority TEXT,
    count BIGINT,
    percentage DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ppd.source,
        ppd.priority,
        ppd.count::BIGINT,
        ppd.percentage
    FROM mv_platform_priority_distribution ppd
    WHERE (p_source IS NULL OR ppd.source = p_source)
    ORDER BY 
        ppd.source,
        CASE ppd.priority
            WHEN 'HOT' THEN 1
            WHEN 'MEDIUM' THEN 2
            WHEN 'LOW' THEN 3
            WHEN 'DISQUALIFIED' THEN 4
            ELSE 5
        END;
END;
$$ LANGUAGE plpgsql;

-- Function to get platform peak times
CREATE OR REPLACE FUNCTION get_platform_peak_times(
    p_source TEXT DEFAULT NULL
)
RETURNS TABLE (
    source TEXT,
    hour_of_day INTEGER,
    day_of_week INTEGER,
    lead_count BIGINT,
    is_peak BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    WITH source_max AS (
        SELECT 
            phd.source as s,
            MAX(phd.lead_count) as max_count
        FROM mv_platform_hourly_distribution phd
        GROUP BY phd.source
    )
    SELECT 
        phd.source,
        phd.hour_of_day,
        phd.day_of_week,
        phd.lead_count::BIGINT,
        (phd.lead_count >= sm.max_count * 0.8) as is_peak
    FROM mv_platform_hourly_distribution phd
    JOIN source_max sm ON phd.source = sm.s
    WHERE (p_source IS NULL OR phd.source = p_source)
    ORDER BY phd.source, phd.day_of_week, phd.hour_of_day;
END;
$$ LANGUAGE plpgsql;

-- Function to generate platform insights
CREATE OR REPLACE FUNCTION get_platform_insights()
RETURNS TABLE (
    insight_type TEXT,
    source TEXT,
    title TEXT,
    description TEXT,
    metric_value DECIMAL,
    trend TEXT,
    priority TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH platform_stats AS (
        SELECT * FROM mv_platform_analytics
    ),
    weekly_growth AS (
        SELECT 
            source,
            ROUND(
                (SUM(total_leads) FILTER (WHERE week_start >= CURRENT_DATE - 7) -
                 SUM(total_leads) FILTER (WHERE week_start >= CURRENT_DATE - 14 AND week_start < CURRENT_DATE - 7))::DECIMAL /
                NULLIF(SUM(total_leads) FILTER (WHERE week_start >= CURRENT_DATE - 14 AND week_start < CURRENT_DATE - 7), 0) * 100,
                2
            ) as growth_rate
        FROM mv_platform_weekly_stats
        WHERE week_start >= CURRENT_DATE - 14
        GROUP BY source
    )
    -- Best performing platform by conversion
    SELECT 
        'best_converter'::TEXT,
        ps.source,
        'Top Converter'::TEXT,
        format('%s has the highest conversion rate at %s%%', ps.source, ps.conversion_rate),
        ps.conversion_rate,
        'positive'::TEXT,
        'high'::TEXT
    FROM platform_stats ps
    WHERE ps.total_leads >= 10
    ORDER BY ps.conversion_rate DESC
    LIMIT 1
    
    UNION ALL
    
    -- Fastest growing platform
    SELECT 
        'fastest_growing'::TEXT,
        wg.source,
        'Fastest Growth'::TEXT,
        format('%s grew %s%% this week', wg.source, COALESCE(wg.growth_rate, 0)),
        COALESCE(wg.growth_rate, 0),
        CASE WHEN COALESCE(wg.growth_rate, 0) > 0 THEN 'positive' ELSE 'negative' END,
        'high'::TEXT
    FROM weekly_growth wg
    WHERE wg.growth_rate IS NOT NULL
    ORDER BY wg.growth_rate DESC
    LIMIT 1
    
    UNION ALL
    
    -- Highest quality leads
    SELECT 
        'highest_quality'::TEXT,
        ps.source,
        'Best Quality Leads'::TEXT,
        format('%s delivers the highest quality score (%s)', ps.source, ps.avg_quality_score),
        ps.avg_quality_score,
        'positive'::TEXT,
        'medium'::TEXT
    FROM platform_stats ps
    WHERE ps.total_leads >= 10
    ORDER BY ps.avg_quality_score DESC
    LIMIT 1
    
    UNION ALL
    
    -- Platform needing attention (low conversion)
    SELECT 
        'needs_attention'::TEXT,
        ps.source,
        'Needs Attention'::TEXT,
        format('%s has low conversion rate (%s%%) - consider optimizing', ps.source, ps.conversion_rate),
        ps.conversion_rate,
        'negative'::TEXT,
        'high'::TEXT
    FROM platform_stats ps
    WHERE ps.total_leads >= 10 AND ps.conversion_rate < 10
    ORDER BY ps.conversion_rate ASC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- UPDATE DAILY SUMMARY TO INCLUDE SOURCE
-- =============================================================================

-- Add source column to daily summary if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'analytics_daily_summary' AND column_name = 'source') THEN
        ALTER TABLE analytics_daily_summary 
        ADD COLUMN source VARCHAR(50) DEFAULT 'all';
        
        -- Drop old unique constraint and add new one
        ALTER TABLE analytics_daily_summary DROP CONSTRAINT IF EXISTS analytics_daily_summary_date_key;
        ALTER TABLE analytics_daily_summary ADD CONSTRAINT analytics_daily_summary_date_source_key UNIQUE (date, source);
    END IF;
END $$;

-- =============================================================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE platforms IS 'Configuration and metadata for lead source platforms';
COMMENT ON MATERIALIZED VIEW mv_platform_analytics IS 'Pre-aggregated platform summary - refresh every 5 minutes';
COMMENT ON MATERIALIZED VIEW mv_platform_daily_stats IS 'Daily lead counts by platform - 90 day retention';
COMMENT ON MATERIALIZED VIEW mv_platform_weekly_stats IS 'Weekly aggregations for growth analysis';
COMMENT ON MATERIALIZED VIEW mv_platform_status_distribution IS 'Lead status funnel by platform';
COMMENT ON MATERIALIZED VIEW mv_platform_priority_distribution IS 'Lead quality distribution by platform';
COMMENT ON FUNCTION refresh_platform_analytics_views() IS 'Refreshes all platform materialized views concurrently';
COMMENT ON FUNCTION get_platform_analytics_summary() IS 'Returns platform analytics from materialized view';
COMMENT ON FUNCTION get_platform_daily_trends(TEXT, INTEGER) IS 'Returns daily trends for charts';
COMMENT ON FUNCTION get_platform_growth_metrics(INTEGER) IS 'Returns week-over-week growth metrics';
COMMENT ON FUNCTION get_platform_insights() IS 'Generates AI-like insights from platform data';
