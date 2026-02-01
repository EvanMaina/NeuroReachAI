/**
 * Platform Analytics API Service
 * 
 * High-performance service for fetching platform performance analytics.
 * Includes caching headers support for optimal performance.
 */

import { apiClient } from './api';
import {
  PlatformAnalyticsSummary,
  PlatformListResponse,
  PlatformData,
  PlatformTrendsResponse,
  PlatformComparisonResponse,
  PlatformActivityFeedResponse,
  StatusFunnelResponse,
  QualityDistributionResponse,
  PlatformAnalyticsHealth,
  RefreshResponse,
  AnalyticsPeriod,
  PlatformSource,
} from '../types/platformAnalytics';

const BASE_URL = '/platform-analytics';

/**
 * Get comprehensive platform analytics summary
 * 
 * Returns aggregated metrics for all platforms including:
 * - Total leads per platform
 * - Conversion rates
 * - Quality distribution
 * - Growth metrics
 * - Daily trends
 * - AI-generated insights
 * 
 * @param period - Time period (7d, 30d, 90d, all)
 */
export async function getPlatformSummary(
  period: AnalyticsPeriod = '30d'
): Promise<PlatformAnalyticsSummary> {
  const response = await apiClient.get<PlatformAnalyticsSummary>(
    `${BASE_URL}/summary`,
    { params: { period } }
  );
  return response.data;
}

/**
 * List all configured platforms
 * 
 * Returns platform configurations including status.
 */
export async function listPlatforms(): Promise<PlatformListResponse> {
  const response = await apiClient.get<PlatformListResponse>(`${BASE_URL}/platforms`);
  return response.data;
}

/**
 * Get detailed analytics for a specific platform
 * 
 * @param platformId - Platform identifier
 * @param period - Time period
 */
export async function getPlatformDetails(
  platformId: PlatformSource,
  period: AnalyticsPeriod = '30d'
): Promise<{ platform: PlatformData; period: any; refreshedAt: string }> {
  const response = await apiClient.get(
    `${BASE_URL}/platforms/${platformId}`,
    { params: { period } }
  );
  return response.data;
}

/**
 * Get platform trend data for charting
 * 
 * @param period - Time period
 * @param platform - Optional filter by platform
 * @param groupBy - Group by day or week
 */
export async function getPlatformTrends(
  period: AnalyticsPeriod = '30d',
  platform?: PlatformSource,
  groupBy: 'day' | 'week' = 'day'
): Promise<PlatformTrendsResponse> {
  const response = await apiClient.get<PlatformTrendsResponse>(
    `${BASE_URL}/trends`,
    { params: { period, platform, group_by: groupBy } }
  );
  return response.data;
}

/**
 * Get platform comparison data
 * 
 * @param period - Time period
 * @param metric - Metric to compare
 */
export async function getPlatformComparison(
  period: AnalyticsPeriod = '30d',
  metric: string = 'totalLeads'
): Promise<PlatformComparisonResponse> {
  const response = await apiClient.get<PlatformComparisonResponse>(
    `${BASE_URL}/comparison`,
    { params: { period, metric } }
  );
  return response.data;
}

/**
 * Get platform activity feed with pagination
 * 
 * @param limit - Number of items
 * @param cursor - Pagination cursor
 * @param platform - Optional filter by platform
 */
export async function getPlatformActivity(
  limit: number = 20,
  cursor?: string,
  platform?: PlatformSource
): Promise<PlatformActivityFeedResponse> {
  const response = await apiClient.get<PlatformActivityFeedResponse>(
    `${BASE_URL}/activity`,
    { params: { limit, cursor, platform } }
  );
  return response.data;
}

/**
 * Get platform insights
 * 
 * @param period - Time period
 */
export async function getPlatformInsights(
  period: AnalyticsPeriod = '30d'
): Promise<{ insights: any[]; period: any; refreshedAt: string }> {
  const response = await apiClient.get(
    `${BASE_URL}/insights`,
    { params: { period } }
  );
  return response.data;
}

/**
 * Get lead status funnel distribution
 * 
 * @param platform - Optional filter by platform
 */
export async function getStatusFunnel(
  platform?: PlatformSource
): Promise<StatusFunnelResponse> {
  const response = await apiClient.get<StatusFunnelResponse>(
    `${BASE_URL}/status-funnel`,
    { params: { platform } }
  );
  return response.data;
}

/**
 * Get lead quality distribution
 * 
 * @param platform - Optional filter by platform
 */
export async function getQualityDistribution(
  platform?: PlatformSource
): Promise<QualityDistributionResponse> {
  const response = await apiClient.get<QualityDistributionResponse>(
    `${BASE_URL}/quality-distribution`,
    { params: { platform } }
  );
  return response.data;
}

/**
 * Manually refresh analytics views
 * 
 * Note: This is automatically done every 5 minutes via Celery.
 */
export async function refreshAnalytics(): Promise<RefreshResponse> {
  const response = await apiClient.post<RefreshResponse>(`${BASE_URL}/refresh`);
  return response.data;
}

/**
 * Check analytics health
 */
export async function checkAnalyticsHealth(): Promise<PlatformAnalyticsHealth> {
  const response = await apiClient.get<PlatformAnalyticsHealth>(`${BASE_URL}/health`);
  return response.data;
}

// Export all functions as a service object
export const platformAnalyticsService = {
  getPlatformSummary,
  listPlatforms,
  getPlatformDetails,
  getPlatformTrends,
  getPlatformComparison,
  getPlatformActivity,
  getPlatformInsights,
  getStatusFunnel,
  getQualityDistribution,
  refreshAnalytics,
  checkAnalyticsHealth,
};

export default platformAnalyticsService;
