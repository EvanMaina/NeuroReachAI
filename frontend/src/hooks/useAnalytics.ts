/**
 * React Query hooks for analytics data.
 * 
 * Provides optimized data fetching with:
 * - Automatic caching and deduplication
 * - Background refetching (stale-while-revalidate)
 * - Optimistic updates
 * - Error handling
 * 
 * @module hooks/useAnalytics
 */

import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import {
  getDashboardSummary,
  getLeadsTrend,
  getConditionsDistribution,
  getCohortRetention,
  getLeadsCursor,
  type IDashboardSummary,
  type ILeadsTrendResponse,
  type IConditionsDistributionResponse,
  type ICohortRetentionResponse,
  type ICursorPaginatedResponse,
} from '../services/analytics';

// =============================================================================
// Query Keys
// =============================================================================

export const analyticsKeys = {
  all: ['analytics'] as const,
  dashboard: () => [...analyticsKeys.all, 'dashboard'] as const,
  dashboardSummary: (daysBack: number) => [...analyticsKeys.dashboard(), 'summary', daysBack] as const,
  trends: () => [...analyticsKeys.all, 'trends'] as const,
  leadsTrend: (period: number) => [...analyticsKeys.trends(), period] as const,
  conditions: () => [...analyticsKeys.all, 'conditions'] as const,
  conditionsDistribution: () => [...analyticsKeys.conditions(), 'distribution'] as const,
  cohort: () => [...analyticsKeys.all, 'cohort'] as const,
  cohortRetention: (months: number) => [...analyticsKeys.cohort(), 'retention', months] as const,
  leads: () => [...analyticsKeys.all, 'leads'] as const,
  leadsCursor: (priority?: string, status?: string) => 
    [...analyticsKeys.leads(), 'cursor', { priority, status }] as const,
};

// =============================================================================
// Dashboard Summary Hook
// =============================================================================

interface UseDashboardSummaryOptions {
  daysBack?: number;
  enabled?: boolean;
  refetchInterval?: number | false;
}

/**
 * Hook for fetching dashboard summary statistics.
 * 
 * Uses aggressive caching with background refetch every 30 seconds.
 * CRITICAL: Uses placeholderData to prevent data disappearing during navigation.
 * 
 * @param options - Query options
 * @returns Query result with dashboard summary data
 */
export function useDashboardSummary(options: UseDashboardSummaryOptions = {}) {
  const { daysBack = 365, enabled = true, refetchInterval = 30000 } = options;
  
  return useQuery<IDashboardSummary, Error>({
    queryKey: analyticsKeys.dashboardSummary(daysBack),
    queryFn: async () => {
      if (import.meta.env.DEV) {
        console.log(`🔍 Fetching dashboard summary (${daysBack} days)...`);
      }
      const data = await getDashboardSummary(daysBack);
      if (import.meta.env.DEV) {
        console.log('✅ Dashboard summary loaded:', data);
      }
      return data;
    },
    enabled,
    staleTime: 2 * 60 * 1000, // Consider stale after 2 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchInterval, // Refetch every 30 seconds
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: 'always',
    retry: 2,
    retryDelay: 1000,
    // CRITICAL: Keep previous data while fetching new data
    placeholderData: (previousData) => previousData,
  });
}

// =============================================================================
// Leads Trend Hook
// =============================================================================

interface UseLeadsTrendOptions {
  period?: number;
  enabled?: boolean;
}

/**
 * Hook for fetching leads trend data.
 * 
 * Caches for 60 seconds, matching backend cache TTL.
 * 
 * @param options - Query options
 * @returns Query result with trend data
 */
export function useLeadsTrend(options: UseLeadsTrendOptions = {}) {
  const { period = 30, enabled = true } = options;
  
  return useQuery<ILeadsTrendResponse, Error>({
    queryKey: analyticsKeys.leadsTrend(period),
    queryFn: async () => {
      if (import.meta.env.DEV) {
        console.log(`🔍 Fetching leads trend (${period} days)...`);
      }
      const data = await getLeadsTrend(period);
      if (import.meta.env.DEV) {
        console.log('✅ Leads trend loaded:', data);
      }
      return data;
    },
    enabled,
    staleTime: 2 * 60 * 1000, // Consider stale after 2 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchInterval: 60000, // Refetch every 60 seconds
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    // CRITICAL: Keep previous data while fetching new data
    placeholderData: (previousData) => previousData,
  });
}

// =============================================================================
// Conditions Distribution Hook
// =============================================================================

interface UseConditionsDistributionOptions {
  enabled?: boolean;
}

/**
 * Hook for fetching conditions distribution.
 * 
 * Caches for 120 seconds, matching backend cache TTL.
 * CRITICAL: Uses placeholderData to prevent data disappearing during navigation.
 * 
 * @param options - Query options
 * @returns Query result with conditions distribution data
 */
export function useConditionsDistribution(options: UseConditionsDistributionOptions = {}) {
  const { enabled = true } = options;
  
  return useQuery<IConditionsDistributionResponse, Error>({
    queryKey: analyticsKeys.conditionsDistribution(),
    queryFn: async () => {
      if (import.meta.env.DEV) {
        console.log('🔍 Fetching conditions distribution...');
      }
      const data = await getConditionsDistribution();
      if (import.meta.env.DEV) {
        console.log('✅ Conditions distribution loaded:', data);
      }
      return data;
    },
    enabled,
    staleTime: 2 * 60 * 1000, // Consider stale after 2 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchInterval: 120000, // Refetch every 120 seconds
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    // CRITICAL: Keep previous data while fetching new data
    placeholderData: (previousData) => previousData,
  });
}

// =============================================================================
// Cohort Retention Hook
// =============================================================================

interface UseCohortRetentionOptions {
  months?: number;
  enabled?: boolean;
}

/**
 * Hook for fetching cohort retention analysis.
 * 
 * Caches for 60 seconds, matching backend cache TTL.
 * CRITICAL: Uses placeholderData to prevent data disappearing during navigation.
 * 
 * @param options - Query options
 * @returns Query result with cohort retention data
 */
export function useCohortRetention(options: UseCohortRetentionOptions = {}) {
  const { months = 6, enabled = true } = options;
  
  return useQuery<ICohortRetentionResponse, Error>({
    queryKey: analyticsKeys.cohortRetention(months),
    queryFn: async () => {
      if (import.meta.env.DEV) {
        console.log(`🔍 Fetching cohort retention (${months} months)...`);
      }
      const data = await getCohortRetention(months);
      if (import.meta.env.DEV) {
        console.log('✅ Cohort retention loaded:', data);
      }
      return data;
    },
    enabled,
    staleTime: 2 * 60 * 1000, // Consider stale after 2 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchInterval: 60000, // Refetch every 60 seconds
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    // CRITICAL: Keep previous data while fetching new data
    placeholderData: (previousData) => previousData,
  });
}

// =============================================================================
// Cursor-Based Leads Hook (Infinite Query)
// =============================================================================

interface UseLeadsCursorOptions {
  limit?: number;
  priority?: string;
  status?: string;
  enabled?: boolean;
}

/**
 * Hook for fetching leads with cursor-based pagination.
 * 
 * Uses infinite query for efficient large dataset handling.
 * 
 * @param options - Query options
 * @returns Infinite query result with paginated leads
 */
export function useLeadsCursor(options: UseLeadsCursorOptions = {}) {
  const { limit = 50, priority, status, enabled = true } = options;
  
  return useInfiniteQuery<ICursorPaginatedResponse, Error>({
    queryKey: analyticsKeys.leadsCursor(priority, status),
    queryFn: ({ pageParam }) => 
      getLeadsCursor(pageParam as string | null, limit, priority, status),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    enabled,
    staleTime: 30000, // Consider stale after 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });
}

// =============================================================================
// Prefetch Functions
// =============================================================================

/**
 * Hook to prefetch analytics data.
 * 
 * Call this on dashboard mount to preload data.
 * 
 * @returns Prefetch functions
 */
export function usePrefetchAnalytics() {
  const queryClient = useQueryClient();
  
  const prefetchDashboard = async (daysBack: number = 365) => {
    await queryClient.prefetchQuery({
      queryKey: analyticsKeys.dashboardSummary(daysBack),
      queryFn: () => getDashboardSummary(daysBack),
      staleTime: 20000,
    });
  };
  
  const prefetchTrends = async (period: number = 30) => {
    await queryClient.prefetchQuery({
      queryKey: analyticsKeys.leadsTrend(period),
      queryFn: () => getLeadsTrend(period),
      staleTime: 50000,
    });
  };
  
  const prefetchConditions = async () => {
    await queryClient.prefetchQuery({
      queryKey: analyticsKeys.conditionsDistribution(),
      queryFn: getConditionsDistribution,
      staleTime: 100000,
    });
  };
  
  const prefetchCohort = async (months: number = 6) => {
    await queryClient.prefetchQuery({
      queryKey: analyticsKeys.cohortRetention(months),
      queryFn: () => getCohortRetention(months),
      staleTime: 50000,
    });
  };
  
  const prefetchAll = async () => {
    await Promise.all([
      prefetchDashboard(),
      prefetchTrends(),
      prefetchConditions(),
      prefetchCohort(),
    ]);
  };
  
  return {
    prefetchDashboard,
    prefetchTrends,
    prefetchConditions,
    prefetchCohort,
    prefetchAll,
  };
}

// =============================================================================
// Invalidation Functions
// =============================================================================

/**
 * Hook to invalidate analytics cache.
 * 
 * Call this after lead updates to refresh dashboard data.
 * 
 * @returns Invalidation functions
 */
export function useInvalidateAnalytics() {
  const queryClient = useQueryClient();
  
  const invalidateDashboard = () => {
    queryClient.invalidateQueries({ queryKey: analyticsKeys.dashboard() });
  };
  
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: analyticsKeys.all });
  };
  
  const invalidateLeads = () => {
    queryClient.invalidateQueries({ queryKey: analyticsKeys.leads() });
  };
  
  return {
    invalidateDashboard,
    invalidateAll,
    invalidateLeads,
  };
}
