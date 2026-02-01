/**
 * Platform Analytics React Query Hooks
 * 
 * High-performance hooks for platform analytics with:
 * - Automatic caching and deduplication
 * - Background refetching (stale-while-revalidate)
 * - Optimistic updates
 * - Error handling
 * - Infinite query for activity feed
 * 
 * @module hooks/usePlatformAnalytics
 */

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
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
} from '../services/platformAnalytics';
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

// =============================================================================
// Query Keys - Centralized key management for cache invalidation
// =============================================================================

export const platformAnalyticsKeys = {
  all: ['platformAnalytics'] as const,
  summary: (period: AnalyticsPeriod) => [...platformAnalyticsKeys.all, 'summary', period] as const,
  platforms: () => [...platformAnalyticsKeys.all, 'platforms'] as const,
  platformDetail: (id: PlatformSource, period: AnalyticsPeriod) => 
    [...platformAnalyticsKeys.all, 'detail', id, period] as const,
  trends: (period: AnalyticsPeriod, platform?: PlatformSource, groupBy?: string) => 
    [...platformAnalyticsKeys.all, 'trends', { period, platform, groupBy }] as const,
  comparison: (period: AnalyticsPeriod, metric: string) => 
    [...platformAnalyticsKeys.all, 'comparison', { period, metric }] as const,
  activity: (platform?: PlatformSource) => 
    [...platformAnalyticsKeys.all, 'activity', platform] as const,
  insights: (period: AnalyticsPeriod) => 
    [...platformAnalyticsKeys.all, 'insights', period] as const,
  statusFunnel: (platform?: PlatformSource) => 
    [...platformAnalyticsKeys.all, 'statusFunnel', platform] as const,
  qualityDistribution: (platform?: PlatformSource) => 
    [...platformAnalyticsKeys.all, 'qualityDistribution', platform] as const,
  health: () => [...platformAnalyticsKeys.all, 'health'] as const,
};

// =============================================================================
// Platform Summary Hook
// =============================================================================

interface UsePlatformSummaryOptions {
  period?: AnalyticsPeriod;
  enabled?: boolean;
  refetchInterval?: number | false;
}

/**
 * Hook for fetching comprehensive platform analytics summary.
 * 
 * Uses aggressive caching with 5-minute refresh matching backend cache.
 * 
 * @param options - Query options
 * @returns Query result with platform summary data
 */
export function usePlatformSummary(options: UsePlatformSummaryOptions = {}) {
  const { period = '30d', enabled = true, refetchInterval = 300000 } = options; // 5 min refresh
  
  return useQuery<PlatformAnalyticsSummary, Error>({
    queryKey: platformAnalyticsKeys.summary(period),
    queryFn: () => getPlatformSummary(period),
    enabled,
    staleTime: 240000, // Consider stale after 4 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchInterval,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 2,
    retryDelay: 1000,
  });
}

// =============================================================================
// Platforms List Hook
// =============================================================================

interface UsePlatformsListOptions {
  enabled?: boolean;
}

/**
 * Hook for fetching all configured platforms.
 * 
 * @param options - Query options
 * @returns Query result with platforms list
 */
export function usePlatformsList(options: UsePlatformsListOptions = {}) {
  const { enabled = true } = options;
  
  return useQuery<PlatformListResponse, Error>({
    queryKey: platformAnalyticsKeys.platforms(),
    queryFn: listPlatforms,
    enabled,
    staleTime: 5 * 60 * 1000, // Consider stale after 5 minutes (rarely changes)
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    refetchOnWindowFocus: false, // Don't refetch on focus (rarely changes)
  });
}

// =============================================================================
// Platform Detail Hook
// =============================================================================

interface UsePlatformDetailOptions {
  platformId: PlatformSource;
  period?: AnalyticsPeriod;
  enabled?: boolean;
}

/**
 * Hook for fetching detailed analytics for a specific platform.
 * 
 * @param options - Query options
 * @returns Query result with platform detail data
 */
export function usePlatformDetail(options: UsePlatformDetailOptions) {
  const { platformId, period = '30d', enabled = true } = options;
  
  return useQuery<{ platform: PlatformData; period: any; refreshedAt: string }, Error>({
    queryKey: platformAnalyticsKeys.platformDetail(platformId, period),
    queryFn: () => getPlatformDetails(platformId, period),
    enabled: enabled && !!platformId,
    staleTime: 240000, // Consider stale after 4 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchInterval: 300000, // 5 min refresh
    refetchOnWindowFocus: true,
  });
}

// =============================================================================
// Platform Trends Hook
// =============================================================================

interface UsePlatformTrendsOptions {
  period?: AnalyticsPeriod;
  platform?: PlatformSource;
  groupBy?: 'day' | 'week';
  enabled?: boolean;
}

/**
 * Hook for fetching platform trend data for charts.
 * 
 * @param options - Query options
 * @returns Query result with trend data
 */
export function usePlatformTrends(options: UsePlatformTrendsOptions = {}) {
  const { period = '30d', platform, groupBy = 'day', enabled = true } = options;
  
  return useQuery<PlatformTrendsResponse, Error>({
    queryKey: platformAnalyticsKeys.trends(period, platform, groupBy),
    queryFn: () => getPlatformTrends(period, platform, groupBy),
    enabled,
    staleTime: 240000, // Consider stale after 4 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchInterval: 300000, // 5 min refresh
    refetchOnWindowFocus: true,
  });
}

// =============================================================================
// Platform Comparison Hook
// =============================================================================

interface UsePlatformComparisonOptions {
  period?: AnalyticsPeriod;
  metric?: string;
  enabled?: boolean;
}

/**
 * Hook for fetching platform comparison data.
 * 
 * @param options - Query options
 * @returns Query result with comparison data
 */
export function usePlatformComparison(options: UsePlatformComparisonOptions = {}) {
  const { period = '30d', metric = 'totalLeads', enabled = true } = options;
  
  return useQuery<PlatformComparisonResponse, Error>({
    queryKey: platformAnalyticsKeys.comparison(period, metric),
    queryFn: () => getPlatformComparison(period, metric),
    enabled,
    staleTime: 240000, // Consider stale after 4 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchInterval: 300000, // 5 min refresh
    refetchOnWindowFocus: true,
  });
}

// =============================================================================
// Platform Activity Feed Hook (Infinite Query)
// =============================================================================

interface UsePlatformActivityOptions {
  limit?: number;
  platform?: PlatformSource;
  enabled?: boolean;
}

/**
 * Hook for fetching platform activity feed with cursor-based pagination.
 * 
 * Uses infinite query for efficient loading of large activity feeds.
 * 
 * @param options - Query options
 * @returns Infinite query result with paginated activity data
 */
export function usePlatformActivity(options: UsePlatformActivityOptions = {}) {
  const { limit = 20, platform, enabled = true } = options;
  
  return useInfiniteQuery<PlatformActivityFeedResponse, Error>({
    queryKey: platformAnalyticsKeys.activity(platform),
    queryFn: ({ pageParam }) => 
      getPlatformActivity(limit, pageParam as string | undefined, platform),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    enabled,
    staleTime: 60000, // Consider stale after 1 minute (activity updates frequently)
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: true,
  });
}

// =============================================================================
// Platform Insights Hook
// =============================================================================

interface UsePlatformInsightsOptions {
  period?: AnalyticsPeriod;
  enabled?: boolean;
}

/**
 * Hook for fetching AI-generated platform insights.
 * 
 * @param options - Query options
 * @returns Query result with insights
 */
export function usePlatformInsights(options: UsePlatformInsightsOptions = {}) {
  const { period = '30d', enabled = true } = options;
  
  return useQuery<{ insights: any[]; period: any; refreshedAt: string }, Error>({
    queryKey: platformAnalyticsKeys.insights(period),
    queryFn: () => getPlatformInsights(period),
    enabled,
    staleTime: 240000, // Consider stale after 4 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchInterval: 300000, // 5 min refresh
    refetchOnWindowFocus: true,
  });
}

// =============================================================================
// Status Funnel Hook
// =============================================================================

interface UseStatusFunnelOptions {
  platform?: PlatformSource;
  enabled?: boolean;
}

/**
 * Hook for fetching lead status funnel distribution.
 * 
 * @param options - Query options
 * @returns Query result with funnel data
 */
export function useStatusFunnel(options: UseStatusFunnelOptions = {}) {
  const { platform, enabled = true } = options;
  
  return useQuery<StatusFunnelResponse, Error>({
    queryKey: platformAnalyticsKeys.statusFunnel(platform),
    queryFn: () => getStatusFunnel(platform),
    enabled,
    staleTime: 240000, // Consider stale after 4 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchInterval: 300000, // 5 min refresh
    refetchOnWindowFocus: true,
  });
}

// =============================================================================
// Quality Distribution Hook
// =============================================================================

interface UseQualityDistributionOptions {
  platform?: PlatformSource;
  enabled?: boolean;
}

/**
 * Hook for fetching lead quality distribution.
 * 
 * @param options - Query options
 * @returns Query result with quality distribution data
 */
export function useQualityDistribution(options: UseQualityDistributionOptions = {}) {
  const { platform, enabled = true } = options;
  
  return useQuery<QualityDistributionResponse, Error>({
    queryKey: platformAnalyticsKeys.qualityDistribution(platform),
    queryFn: () => getQualityDistribution(platform),
    enabled,
    staleTime: 240000, // Consider stale after 4 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchInterval: 300000, // 5 min refresh
    refetchOnWindowFocus: true,
  });
}

// =============================================================================
// Analytics Health Hook
// =============================================================================

interface UseAnalyticsHealthOptions {
  enabled?: boolean;
}

/**
 * Hook for checking analytics system health.
 * 
 * @param options - Query options
 * @returns Query result with health status
 */
export function useAnalyticsHealth(options: UseAnalyticsHealthOptions = {}) {
  const { enabled = true } = options;
  
  return useQuery<PlatformAnalyticsHealth, Error>({
    queryKey: platformAnalyticsKeys.health(),
    queryFn: checkAnalyticsHealth,
    enabled,
    staleTime: 30000, // Consider stale after 30 seconds
    gcTime: 60000, // Keep in cache for 1 minute
    refetchInterval: 60000, // Refresh every minute
    refetchOnWindowFocus: true,
  });
}

// =============================================================================
// Refresh Analytics Mutation
// =============================================================================

/**
 * Hook for manually refreshing analytics materialized views.
 * 
 * Invalidates all platform analytics queries after refresh.
 * 
 * @returns Mutation result for refresh operation
 */
export function useRefreshAnalytics() {
  const queryClient = useQueryClient();
  
  return useMutation<RefreshResponse, Error>({
    mutationFn: refreshAnalytics,
    onSuccess: () => {
      // Invalidate all platform analytics queries to refetch fresh data
      queryClient.invalidateQueries({ queryKey: platformAnalyticsKeys.all });
    },
  });
}

// =============================================================================
// Prefetch Functions
// =============================================================================

/**
 * Hook to prefetch platform analytics data.
 * 
 * Call this on dashboard mount to preload data.
 * 
 * @returns Prefetch functions
 */
export function usePrefetchPlatformAnalytics() {
  const queryClient = useQueryClient();
  
  const prefetchSummary = async (period: AnalyticsPeriod = '30d') => {
    await queryClient.prefetchQuery({
      queryKey: platformAnalyticsKeys.summary(period),
      queryFn: () => getPlatformSummary(period),
      staleTime: 240000,
    });
  };
  
  const prefetchTrends = async (period: AnalyticsPeriod = '30d') => {
    await queryClient.prefetchQuery({
      queryKey: platformAnalyticsKeys.trends(period, undefined, 'day'),
      queryFn: () => getPlatformTrends(period, undefined, 'day'),
      staleTime: 240000,
    });
  };
  
  const prefetchStatusFunnel = async () => {
    await queryClient.prefetchQuery({
      queryKey: platformAnalyticsKeys.statusFunnel(undefined),
      queryFn: () => getStatusFunnel(undefined),
      staleTime: 240000,
    });
  };
  
  const prefetchQualityDistribution = async () => {
    await queryClient.prefetchQuery({
      queryKey: platformAnalyticsKeys.qualityDistribution(undefined),
      queryFn: () => getQualityDistribution(undefined),
      staleTime: 240000,
    });
  };
  
  const prefetchAll = async (period: AnalyticsPeriod = '30d') => {
    await Promise.all([
      prefetchSummary(period),
      prefetchTrends(period),
      prefetchStatusFunnel(),
      prefetchQualityDistribution(),
    ]);
  };
  
  return {
    prefetchSummary,
    prefetchTrends,
    prefetchStatusFunnel,
    prefetchQualityDistribution,
    prefetchAll,
  };
}

// =============================================================================
// Invalidation Functions
// =============================================================================

/**
 * Hook to invalidate platform analytics cache.
 * 
 * Call this after lead updates or platform configuration changes.
 * 
 * @returns Invalidation functions
 */
export function useInvalidatePlatformAnalytics() {
  const queryClient = useQueryClient();
  
  const invalidateSummary = () => {
    queryClient.invalidateQueries({ queryKey: [...platformAnalyticsKeys.all, 'summary'] });
  };
  
  const invalidateTrends = () => {
    queryClient.invalidateQueries({ queryKey: [...platformAnalyticsKeys.all, 'trends'] });
  };
  
  const invalidateActivity = () => {
    queryClient.invalidateQueries({ queryKey: [...platformAnalyticsKeys.all, 'activity'] });
  };
  
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: platformAnalyticsKeys.all });
  };
  
  return {
    invalidateSummary,
    invalidateTrends,
    invalidateActivity,
    invalidateAll,
  };
}

// =============================================================================
// Combined Dashboard Hook
// =============================================================================

interface UsePlatformDashboardOptions {
  period?: AnalyticsPeriod;
  enabled?: boolean;
}

/**
 * Combined hook for fetching all dashboard data at once.
 * 
 * Optimizes data fetching by parallelizing requests.
 * 
 * @param options - Query options
 * @returns Combined query results for dashboard
 */
export function usePlatformDashboard(options: UsePlatformDashboardOptions = {}) {
  const { period = '30d', enabled = true } = options;
  
  const summary = usePlatformSummary({ period, enabled });
  const trends = usePlatformTrends({ period, enabled });
  const statusFunnel = useStatusFunnel({ enabled });
  const qualityDistribution = useQualityDistribution({ enabled });
  const health = useAnalyticsHealth({ enabled });
  
  const isLoading = 
    summary.isLoading || 
    trends.isLoading || 
    statusFunnel.isLoading || 
    qualityDistribution.isLoading;
  
  const isError = 
    summary.isError || 
    trends.isError || 
    statusFunnel.isError || 
    qualityDistribution.isError;
  
  const refetchAll = () => {
    summary.refetch();
    trends.refetch();
    statusFunnel.refetch();
    qualityDistribution.refetch();
  };
  
  return {
    summary,
    trends,
    statusFunnel,
    qualityDistribution,
    health,
    isLoading,
    isError,
    refetchAll,
  };
}
