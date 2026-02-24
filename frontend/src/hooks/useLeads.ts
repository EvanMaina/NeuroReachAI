/**
 * Production-Grade Global Leads Hook
 *
 * This hook provides centralized lead state management using React Query.
 * Designed for 1M+ concurrent users with:
 * - Global caching (data persists across navigation)
 * - Request deduplication (no duplicate API calls)
 * - Optimistic updates
 * - Automatic retry with exponential backoff
 * - Stale-while-revalidate pattern
 *
 * BUG FIX v1.1.0 — Navigation data-loss:
 * The previous version had a broken AbortController pattern:
 *   1. `new AbortController()` was created INSIDE queryFn but never passed to
 *      listLeads() — it cancelled nothing and was effectively a no-op.
 *   2. The cleanup useEffect aborted this unused ref on unmount — also a no-op.
 *   3. `return []` on signal.aborted was the CRITICAL bug: when React Query
 *      cancelled an in-flight query during navigation it set the cache to [],
 *      WIPING ALL LEAD DATA visible across every dashboard tab.
 *
 * Fix: removed the broken ref/useEffect entirely. In the catch block we now
 * always re-throw so React Query keeps the previous cached data intact
 * (React Query discards results/errors from cancelled queries automatically).
 *
 * @module hooks/useLeads
 * @version 1.1.0 - Navigation data-loss fix
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import {
  listLeads,
  getQueueMetrics,
  getDashboardSummary,
  updateLeadStatus,
  updateContactOutcome,
  type IListLeadsParams,
  type QueueTypeFilter,
  type IDashboardSummaryResponse,
  type IQueueMetricsResponse,
} from '../services/leads';
import type { LeadTableRow, LeadStatus, ContactOutcome } from '../types/lead';

// =============================================================================
// Query Keys - Centralized for consistency
// =============================================================================

export const LEADS_QUERY_KEYS = {
  all: ['leads'] as const,
  list: (params?: IListLeadsParams) => ['leads', 'list', params] as const,
  detail: (id: string) => ['leads', 'detail', id] as const,
  metrics: (queueType: QueueTypeFilter) => ['leads', 'metrics', queueType] as const,
  dashboardSummary: () => ['leads', 'dashboard-summary'] as const,
} as const;

// =============================================================================
// API Response Types (snake_case from backend)
// =============================================================================

/**
 * Already-transformed lead item (camelCase fields from listLeads service)
 * The leads.ts service already maps snake_case to camelCase via mapLeadResponse
 */
interface TransformedLeadItem {
  id?: string;
  leadId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  condition?: string;
  priority?: string;
  status?: string;
  submittedAt?: string;
  contactOutcome?: string;
  contactAttempts?: number;
  lastContactAttempt?: string;
  scheduledCallbackAt?: string;
  // Next follow-up / requested callback time (distinct from consultation time)
  nextFollowUpAt?: string;
  // Last activity timestamp - when lead was last modified
  lastUpdatedAt?: string;
  // Follow-up reason tag
  followUpReason?: string;
  // Referral fields
  isReferral?: boolean;
  referringProviderName?: string;
  referringProviderId?: string;
  // Multi-condition intake fields
  conditions?: string[];
  otherConditionText?: string;
  preferredContactMethod?: string;
}

// =============================================================================
// Transform Functions
// =============================================================================

/**
 * Transform already-mapped lead item to table row format
 * NOTE: listLeads() in leads.ts already transforms snake_case to camelCase,
 * so this function receives camelCase fields.
 */
export function transformLeadToTableRow(item: TransformedLeadItem, index: number): LeadTableRow {
  return {
    id: item.id || `temp-${index}`,
    leadId: item.leadId || `TMS-2026-${String(index + 1).padStart(3, '0')}`,
    firstName: item.firstName || '',
    lastName: item.lastName || '',
    email: item.email || '',
    phone: item.phone || '',
    condition: item.condition || 'Unknown',
    priority: ((item.priority?.toLowerCase() || 'low') as LeadTableRow['priority']),
    status: ((item.status?.toLowerCase()?.replace('_', ' ') || 'new') as LeadTableRow['status']),
    submittedAt: item.submittedAt || new Date().toISOString(),
    contactOutcome: (item.contactOutcome || 'NEW') as ContactOutcome,
    contactAttempts: item.contactAttempts || 0,
    lastContactAttempt: item.lastContactAttempt || undefined,
    scheduledCallbackAt: item.scheduledCallbackAt || undefined,
    // Next follow-up / requested callback time
    nextFollowUpAt: item.nextFollowUpAt || undefined,
    // Last activity timestamp - when lead was last modified
    lastUpdatedAt: item.lastUpdatedAt || undefined,
    // Referral fields
    isReferral: item.isReferral || false,
    referringProviderName: item.referringProviderName || undefined,
    referringProviderId: item.referringProviderId || undefined,
    // Follow-up reason tag from outcome workflow
    followUpReason: item.followUpReason || undefined,
    // Multi-condition intake fields
    conditions: item.conditions || undefined,
    otherConditionText: item.otherConditionText || undefined,
    preferredContactMethod: item.preferredContactMethod || undefined,
  };
}

// =============================================================================
// Global Leads Hook
// =============================================================================

interface UseLeadsOptions {
  /** Auto-refresh interval in milliseconds (default: 30000 = 30s) */
  refetchInterval?: number | false;
  /** Enable/disable auto-refresh (default: true) */
  autoRefresh?: boolean;
  /** Page size for pagination (default: 100) */
  pageSize?: number;
}

interface UseLeadsReturn {
  /** All leads data (transformed to table rows) */
  leads: LeadTableRow[];
  /** Loading state for initial fetch */
  isLoading: boolean;
  /** Fetching state (includes background refetching) */
  isFetching: boolean;
  /** Error state */
  error: Error | null;
  /** Boolean error flag for easier checks */
  isError: boolean;
  /** Last successful fetch timestamp */
  dataUpdatedAt: number;
  /** Manual refresh function */
  refresh: () => Promise<void>;
  /** Optimistic status update */
  updateStatus: (leadId: string, newStatus: LeadStatus) => void;
  /** Optimistic outcome update */
  updateOutcome: (leadId: string, newOutcome: ContactOutcome) => void;
}

/**
 * Global leads hook with production-grade caching and state management.
 *
 * This hook maintains a global cache of leads that persists across navigation.
 * Uses React Query's stale-while-revalidate pattern for optimal UX.
 *
 * @example
 * ```tsx
 * const { leads, isLoading, refresh } = useLeads();
 * ```
 */
export function useLeads(options: UseLeadsOptions = {}): UseLeadsReturn {
  const {
    refetchInterval = 30000,
    autoRefresh = true,
    // Increased from 100 → 500 to fetch ALL leads in one request.
    // Previously the backend cap was 100 which meant only 100/188 leads were visible
    // to the coordinator, causing queue counts (Scheduled: 13, Completed: 3) to diverge
    // from analytics (Scheduled: 23, Completed: 7) which queries the full DB.
    // Backend page_size cap was also raised to 1000 in leads.py.
    pageSize = 500,
  } = options;

  const queryClient = useQueryClient();

  // Main leads query - globally cached
  const {
    data,
    isLoading,
    isFetching,
    error,
    isError,
    dataUpdatedAt,
    refetch,
  } = useQuery({
    queryKey: LEADS_QUERY_KEYS.list({ page: 1, page_size: pageSize }),
    queryFn: async ({ signal: _signal }) => {
      // NOTE: _signal is React Query's cancellation signal.
      // We intentionally do NOT use it to suppress errors (the old `return []`
      // on abort was the data-loss bug — it overwrote the cache with empty data).
      // React Query automatically discards the result of a cancelled query, so
      // we just let any error propagate and RQ handles it correctly.
      const response = await listLeads({ page: 1, page_size: pageSize });

      if (!response?.items) {
        return [];
      }

      // Transform to table row format
      return response.items.map((item: any, index: number) =>
        transformLeadToTableRow(item, index)
      );
    },
    // CRITICAL: Keep previous data while fetching new data.
    // This prevents data from disappearing during background refetch.
    placeholderData: (previousData) => previousData,

    // Stale time: 15 seconds — fresh enough for quick post-mutation updates
    // but long enough to prevent refetch storms during rapid navigation.
    staleTime: 15 * 1000,

    // Cache time: 30 minutes — data survives navigation and brief idle periods.
    // Previously 10 min; extended so rapid navigators always see cached data.
    gcTime: 30 * 60 * 1000,

    // Refetch settings
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchInterval: autoRefresh ? refetchInterval : false,

    // Smart retry: skip retrying on auth/validation errors
    retry: (failureCount, err: any) => {
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        return false;
      }
      if (err?.response?.status === 422) {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 5000),

    // 'always' ensures stale data is kept even if a refetch fails (no blank page).
    networkMode: 'always',
  });

  // Status update mutation with optimistic update
  const statusMutation = useMutation<
    any,
    Error,
    { leadId: string; newStatus: LeadStatus },
    { previousLeads?: LeadTableRow[] }
  >({
    mutationFn: async ({ leadId, newStatus }) => {
      return updateLeadStatus(leadId, newStatus);
    },
    onMutate: async ({ leadId, newStatus }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: LEADS_QUERY_KEYS.all });

      // Snapshot previous value for rollback
      const previousLeads = queryClient.getQueryData<LeadTableRow[]>(
        LEADS_QUERY_KEYS.list({ page: 1, page_size: pageSize })
      );

      // Optimistically update
      if (previousLeads) {
        queryClient.setQueryData(
          LEADS_QUERY_KEYS.list({ page: 1, page_size: pageSize }),
          previousLeads.map((lead) =>
            lead.id === leadId ? { ...lead, status: newStatus } : lead
          )
        );
      }

      return { previousLeads };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousLeads) {
        queryClient.setQueryData(
          LEADS_QUERY_KEYS.list({ page: 1, page_size: pageSize }),
          context.previousLeads
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: LEADS_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: LEADS_QUERY_KEYS.dashboardSummary() });
      queryClient.refetchQueries({ queryKey: LEADS_QUERY_KEYS.list({ page: 1, page_size: pageSize }) });
    },
  });

  // Outcome update mutation with optimistic update
  const outcomeMutation = useMutation<
    any,
    Error,
    { leadId: string; newOutcome: ContactOutcome },
    { previousLeads?: LeadTableRow[] }
  >({
    mutationFn: async ({ leadId, newOutcome }) => {
      return updateContactOutcome(leadId, { contact_outcome: newOutcome });
    },
    onMutate: async ({ leadId, newOutcome }) => {
      await queryClient.cancelQueries({ queryKey: LEADS_QUERY_KEYS.all });

      const previousLeads = queryClient.getQueryData<LeadTableRow[]>(
        LEADS_QUERY_KEYS.list({ page: 1, page_size: pageSize })
      );

      if (previousLeads) {
        queryClient.setQueryData(
          LEADS_QUERY_KEYS.list({ page: 1, page_size: pageSize }),
          previousLeads.map((lead) =>
            lead.id === leadId
              ? {
                  ...lead,
                  contactOutcome: newOutcome,
                  contactAttempts: (lead.contactAttempts || 0) + 1,
                  lastContactAttempt: new Date().toISOString(),
                }
              : lead
          )
        );
      }

      return { previousLeads };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousLeads) {
        queryClient.setQueryData(
          LEADS_QUERY_KEYS.list({ page: 1, page_size: pageSize }),
          context.previousLeads
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: LEADS_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: LEADS_QUERY_KEYS.dashboardSummary() });
      queryClient.refetchQueries({ queryKey: LEADS_QUERY_KEYS.list({ page: 1, page_size: pageSize }) });
    },
  });

  // Manual refresh function
  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // Update status function
  const updateStatus = useCallback(
    (leadId: string, newStatus: LeadStatus) => {
      statusMutation.mutate({ leadId, newStatus });
    },
    [statusMutation]
  );

  // Update outcome function
  const updateOutcome = useCallback(
    (leadId: string, newOutcome: ContactOutcome) => {
      outcomeMutation.mutate({ leadId, newOutcome });
    },
    [outcomeMutation]
  );

  return {
    leads: data || [],
    isLoading,
    isFetching,
    error: error as Error | null,
    isError,
    dataUpdatedAt,
    refresh,
    updateStatus,
    updateOutcome,
  };
}

// =============================================================================
// Dashboard Summary Hook
// =============================================================================

interface UseDashboardSummaryReturn {
  summary: IDashboardSummaryResponse | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Hook for dashboard summary metrics.
 * Globally cached and persists across navigation.
 */
export function useDashboardSummary(): UseDashboardSummaryReturn {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: LEADS_QUERY_KEYS.dashboardSummary(),
    queryFn: async () => {
      return getDashboardSummary();
    },
    placeholderData: (previousData) => previousData,
    staleTime: 30 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    retry: 3,
    networkMode: 'always',
  });

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    summary: data || null,
    isLoading,
    error: error as Error | null,
    refresh,
  };
}

// =============================================================================
// Queue Metrics Hook
// =============================================================================

interface UseQueueMetricsReturn {
  metrics: IQueueMetricsResponse | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Hook for queue-specific metrics.
 * Each queue type has its own cache entry.
 */
export function useQueueMetrics(queueType: QueueTypeFilter = 'all'): UseQueueMetricsReturn {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: LEADS_QUERY_KEYS.metrics(queueType),
    queryFn: async () => {
      return getQueueMetrics(queueType);
    },
    placeholderData: (previousData) => previousData,
    staleTime: 30 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    retry: 3,
    networkMode: 'always',
  });

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    metrics: data || null,
    isLoading,
    error: error as Error | null,
    refresh,
  };
}

// =============================================================================
// Prefetch Utilities
// =============================================================================

/**
 * Prefetch leads data for instant navigation.
 * Call this when user hovers over navigation items.
 */
export function usePrefetchLeads() {
  const queryClient = useQueryClient();

  const prefetch = useCallback(async () => {
    await queryClient.prefetchQuery({
      queryKey: LEADS_QUERY_KEYS.list({ page: 1, page_size: 100 }),
      queryFn: async () => {
        const response = await listLeads({ page: 1, page_size: 100 });
        if (!response?.items) return [];
        return response.items.map((item: any, index: number) =>
          transformLeadToTableRow(item, index)
        );
      },
      staleTime: 30 * 1000,
    });
  }, [queryClient]);

  return prefetch;
}

export default useLeads;
