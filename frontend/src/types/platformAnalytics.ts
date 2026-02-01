/**
 * Platform Analytics Types
 * 
 * Type definitions for platform performance analytics dashboard.
 * Supports tracking leads from multiple sources: widget, jotform, google_ads, etc.
 */

// Platform source types
export type PlatformSource = 'widget' | 'jotform' | 'google_ads' | 'manual' | 'api' | 'import';
export type PlatformStatus = 'active' | 'pending_integration' | 'disabled';

// Period options
export type AnalyticsPeriod = '7d' | '30d' | '90d' | 'all';

// Platform configuration
export interface Platform {
  id: PlatformSource;
  displayName: string;
  icon: string;
  color: string;
  status: PlatformStatus;
}

// Platform metrics
export interface PlatformMetrics {
  totalLeads: number;
  convertedLeads: number;
  conversionRate: number;
  hotLeads: number;
  mediumLeads: number;
  lowLeads: number;
  contactedLeads: number;
  contactRate: number;
  qualityScore: number | null;
  avgDaysToConvert: number | null;
  avgHoursToContact: number | null;
  lastLeadAt: string | null;
  firstLeadAt: string | null;
}

// Status distribution item
export interface StatusDistributionItem {
  status: string;
  count: number;
  percentage: number;
}

// Priority distribution item
export interface PriorityDistributionItem {
  priority: string;
  count: number;
  percentage: number;
}

// Daily trend data point
export interface DailyTrendPoint {
  date: string;
  total_leads: number;
  converted_leads: number;
  hot_leads: number;
  contacted_leads: number;
}

// Weekly growth data point
export interface WeeklyGrowthPoint {
  week_start: string;
  total_leads: number;
  prev_week_leads: number;
  wow_growth: number;
  conversion_rate: number;
}

// Complete platform data
export interface PlatformData {
  id: PlatformSource;
  displayName: string;
  icon: string;
  color: string;
  status: PlatformStatus;
  metrics: PlatformMetrics;
  statusDistribution: StatusDistributionItem[];
  priorityDistribution: PriorityDistributionItem[];
  dailyTrend: DailyTrendPoint[];
  growthMetrics: WeeklyGrowthPoint[];
}

// Platform totals
export interface PlatformTotals {
  totalLeads: number;
  convertedLeads: number;
  conversionRate: number;
  hotLeads: number;
  mediumLeads: number;
  lowLeads: number;
  contactedLeads: number;
  contactRate: number;
}

// Period info
export interface PeriodInfo {
  value: AnalyticsPeriod;
  days: number;
  label: string;
}

// Platform insight
export interface PlatformInsight {
  type: 'best_converter' | 'fastest_growing' | 'highest_quality' | 'needs_attention';
  platform: PlatformSource;
  title: string;
  description: string;
  metricValue: number;
  trend: 'positive' | 'negative' | 'neutral';
  priority: 'high' | 'medium' | 'low';
}

// Platform analytics summary response
export interface PlatformAnalyticsSummary {
  platforms: PlatformData[];
  totals: PlatformTotals;
  insights: PlatformInsight[];
  period: PeriodInfo;
  refreshedAt: string;
}

// Platform list response
export interface PlatformListResponse {
  platforms: Platform[];
  total: number;
  activeCount: number;
}

// Platform trends response
export interface PlatformTrendsResponse {
  trends: Record<string, DailyTrendPoint[] | WeeklyGrowthPoint[]>;
  period: PeriodInfo;
  groupBy: 'day' | 'week';
  refreshedAt: string;
}

// Platform comparison item
export interface PlatformComparisonItem {
  platform: PlatformSource;
  displayName: string;
  color: string;
  value: number;
  percentage: number;
}

// Platform comparison response
export interface PlatformComparisonResponse {
  comparison: PlatformComparisonItem[];
  metric: string;
  total: number;
  period: PeriodInfo;
  refreshedAt: string;
}

// Activity item
export interface PlatformActivityItem {
  id: string;
  leadNumber: string;
  platform: PlatformSource;
  status: string;
  priority: string;
  condition: string;
  createdAt: string;
  updatedAt: string;
  contactOutcome: string;
}

// Activity feed response
export interface PlatformActivityFeedResponse {
  activities: PlatformActivityItem[];
  hasMore: boolean;
  nextCursor: string | null;
  platform: string;
}

// Status funnel response
export interface StatusFunnelResponse {
  funnel: Record<string, {
    displayName: string;
    color: string;
    distribution: StatusDistributionItem[];
  }>;
  refreshedAt: string;
}

// Quality distribution response
export interface QualityDistributionResponse {
  quality: Record<string, {
    displayName: string;
    color: string;
    distribution: PriorityDistributionItem[];
    qualityScore: number;
  }>;
  refreshedAt: string;
}

// Analytics health response
export interface PlatformAnalyticsHealth {
  status: 'healthy' | 'unhealthy';
  dataFreshness: string;
  cache: {
    status: string;
    connected: boolean;
    latency_ms?: number;
    used_memory?: string;
  };
  platformCount: number;
  totalLeads: number;
}

// Refresh response
export interface RefreshResponse {
  success: boolean;
  refreshed_at: string;
  views?: {
    view_name: string;
    duration_ms: number;
    status: string;
  }[];
  error?: string;
}

// Chart data types for visualization
export interface ChartDataPoint {
  name: string;
  value: number;
  color?: string;
}

export interface LineChartDataPoint {
  date: string;
  [key: string]: string | number;
}

// Export type for CSV/PDF
export interface ExportOptions {
  format: 'csv' | 'pdf';
  period: AnalyticsPeriod;
  platforms?: PlatformSource[];
  includeCharts?: boolean;
}
