/**
 * React Query hooks for Source Analytics data.
 *
 * PERMANENT FIX: Replaces manual useState/useEffect/fetch pattern
 * in AnalyticsDashboard that caused empty skeleton cards on navigation.
 *
 * React Query provides:
 * - Cache persistence across navigation (no empty skeletons every time)
 * - Stale-while-revalidate (shows old data while fetching new)
 * - Independent loading states per section (partial data shows immediately)
 * - Automatic request deduplication
 * - Proper abort on unmount
 *
 * v1.1.0 — navigation resilience improvements:
 * - gcTime increased from 10 → 30 minutes so cached data survives longer
 *   idle periods between navigations (default was evicting too quickly)
 * - refetchOnWindowFocus: false prevents surprise blank re-fetches when user
 *   alt-tabs back to the browser
 * - networkMode: 'always' matches useLeads so stale data is kept on error
 *
 * @module hooks/useSourceAnalytics
 * @version 1.1.0
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getSourceAnalytics,
  getHotLeadsByPlatform,
  getCampaignPerformance,
  type SourceAnalyticsResponse,
  type HotLeadsByPlatformResponse,
  type CampaignPerformanceResponse,
} from '../services/sourceAnalytics';

// =============================================================================
// Query Keys
// =============================================================================

export const SOURCE_ANALYTICS_KEYS = {
  all: ['source-analytics'] as const,
  overview: (daysBack: number) =>
    [...SOURCE_ANALYTICS_KEYS.all, 'overview', daysBack] as const,
  hotLeads: (daysBack: number) =>
    [...SOURCE_ANALYTICS_KEYS.all, 'hot-leads', daysBack] as const,
  campaigns: (daysBack: number) =>
    [...SOURCE_ANALYTICS_KEYS.all, 'campaigns', daysBack] as const,
};

// =============================================================================
// Hooks
// =============================================================================

/**
 * Fetch source analytics overview (KPI totals + platform breakdown).
 * 
 * This is the primary data source — powers the KPI cards and platform cards.
 * 
 * @param daysBack - Number of days to analyze
 */
export function useSourceOverview(daysBack: number = 30) {
  return useQuery<SourceAnalyticsResponse, Error>({
    queryKey: SOURCE_ANALYTICS_KEYS.overview(daysBack),
    queryFn: () => getSourceAnalytics(daysBack),
    staleTime: 2 * 60 * 1000,     // 2 minutes — slightly longer than backend 60s TTL
    gcTime: 30 * 60 * 1000,       // 30 min in cache (was 10 min — too short for idle tabs)
    retry: 2,
    retryDelay: 1000,
    placeholderData: (previousData) => previousData,
    refetchOnWindowFocus: false,   // prevent blank flash on alt-tab
    networkMode: 'always',         // keep stale data visible on network errors
  });
}

/**
 * Fetch hot leads breakdown by platform.
 *
 * @param daysBack - Number of days to analyze
 */
export function useHotLeadsByPlatformQuery(daysBack: number = 30) {
  return useQuery<HotLeadsByPlatformResponse, Error>({
    queryKey: SOURCE_ANALYTICS_KEYS.hotLeads(daysBack),
    queryFn: () => getHotLeadsByPlatform(daysBack),
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 2,
    retryDelay: 1000,
    placeholderData: (previousData) => previousData,
    refetchOnWindowFocus: false,
    networkMode: 'always',
  });
}

/**
 * Fetch campaign performance data.
 *
 * @param daysBack - Number of days to analyze
 */
export function useCampaignPerformanceQuery(daysBack: number = 30) {
  return useQuery<CampaignPerformanceResponse, Error>({
    queryKey: SOURCE_ANALYTICS_KEYS.campaigns(daysBack),
    queryFn: () => getCampaignPerformance(daysBack),
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 2,
    retryDelay: 1000,
    placeholderData: (previousData) => previousData,
    refetchOnWindowFocus: false,
    networkMode: 'always',
  });
}

// =============================================================================
// Cache Helpers
// =============================================================================

/**
 * Hook to invalidate all source analytics queries.
 * Triggers background refetch of all cached data.
 */
export function useInvalidateSourceAnalytics() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: SOURCE_ANALYTICS_KEYS.all });
  };
}
