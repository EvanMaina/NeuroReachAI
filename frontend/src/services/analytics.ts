/**
 * Analytics API service.
 * 
 * Provides optimized endpoints for dashboard analytics with caching support.
 * Uses the new backend analytics API endpoints for pre-aggregated data.
 */

import { apiClient } from './api';

// =============================================================================
// Types
// =============================================================================

export interface IDashboardSummary {
  total_leads: number;
  converted_leads: number;
  conversion_rate: number;
  scheduled_appointments: number;
  hot_leads: number;
  medium_leads: number;
  low_leads: number;
  new_today: number;
  contacted_today: number;
  trends: {
    total_leads: number;
    converted_leads: number;
    conversion_rate: number;
    scheduled_appointments: number;
  };
  cache_hit: boolean;
  query_time_ms: number;
}

export interface ITrendDataPoint {
  date: string;
  label: string;
  new_leads: number;
  converted_leads: number;
  cumulative_total: number;
}

export interface ILeadsTrendResponse {
  period_days: number;
  data: ITrendDataPoint[];
  total_in_period: number;
  cache_hit: boolean;
  query_time_ms: number;
}

export interface IConditionDistribution {
  condition: string;
  count: number;
  percentage: number;
  trend: number;
}

export interface IConditionsDistributionResponse {
  conditions: IConditionDistribution[];
  total_leads: number;
  cache_hit: boolean;
  query_time_ms: number;
}

export interface ICohortRetention {
  cohort: string;
  cohort_size: number;
  periods: number[];
  percentages: number[];
}

export interface ICohortRetentionResponse {
  period_labels: string[];
  cohorts: ICohortRetention[];
  cache_hit: boolean;
  query_time_ms: number;
}

export interface ICursorPaginatedLead {
  id: string;
  lead_number: string;
  condition: string;
  priority: string;
  status: string;
  score: number;
  in_service_area: boolean;
  created_at: string;
  contact_outcome?: string;
}

export interface ICursorPaginatedResponse {
  items: ICursorPaginatedLead[];
  next_cursor: string | null;
  has_more: boolean;
  total_estimate: number;
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Get dashboard summary statistics.
 * 
 * Returns aggregated KPIs with 30-second cache TTL on backend.
 * 
 * @param daysBack - Number of days to include in stats (default 365)
 * @returns Dashboard summary data
 */
export async function getDashboardSummary(
  daysBack: number = 365
): Promise<IDashboardSummary> {
  const response = await apiClient.get<IDashboardSummary>(
    '/api/analytics/dashboard-summary',
    { params: { days_back: daysBack } }
  );
  return response.data;
}

/**
 * Get leads trend data for chart.
 * 
 * Returns time-series data with 60-second cache TTL on backend.
 * 
 * @param period - Number of days (7-90, default 30)
 * @returns Leads trend data
 */
export async function getLeadsTrend(
  period: number = 30
): Promise<ILeadsTrendResponse> {
  const response = await apiClient.get<ILeadsTrendResponse>(
    '/api/analytics/leads-trend',
    { params: { period } }
  );
  return response.data;
}

/**
 * Get conditions distribution.
 * 
 * Returns condition breakdown with 120-second cache TTL on backend.
 * 
 * @returns Conditions distribution data
 */
export async function getConditionsDistribution(): Promise<IConditionsDistributionResponse> {
  const response = await apiClient.get<IConditionsDistributionResponse>(
    '/api/analytics/conditions-distribution'
  );
  return response.data;
}

/**
 * Get cohort retention analysis.
 * 
 * Returns monthly cohort retention data with 60-second cache TTL.
 * 
 * @param months - Number of months (1-12, default 6)
 * @returns Cohort retention data
 */
export async function getCohortRetention(
  months: number = 6
): Promise<ICohortRetentionResponse> {
  const response = await apiClient.get<ICohortRetentionResponse>(
    '/api/analytics/cohort-retention',
    { params: { months } }
  );
  return response.data;
}

/**
 * Get leads with cursor-based pagination.
 * 
 * More efficient than offset pagination for large datasets.
 * 
 * @param cursor - Pagination cursor (null for first page)
 * @param limit - Items per page (1-100, default 50)
 * @param priority - Optional priority filter
 * @param status - Optional status filter
 * @returns Paginated leads with cursor
 */
export async function getLeadsCursor(
  cursor: string | null = null,
  limit: number = 50,
  priority?: string,
  status?: string
): Promise<ICursorPaginatedResponse> {
  const params: Record<string, unknown> = { limit };
  if (cursor) params.cursor = cursor;
  if (priority) params.priority = priority;
  if (status) params.status = status;
  
  const response = await apiClient.get<ICursorPaginatedResponse>(
    '/api/analytics/leads-cursor',
    { params }
  );
  return response.data;
}
