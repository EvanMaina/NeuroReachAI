/**
 * React Query hook for Deleted Leads data.
 *
 * PERMANENT FIX: Replaces manual useState/useEffect/fetch pattern
 * that caused infinite spinner on rapid navigation.
 *
 * React Query provides:
 * - Cache persistence across navigation (no fresh spinner every time)
 * - Stale-while-revalidate (shows old data while fetching new)
 * - Automatic request deduplication
 * - Proper abort on unmount
 * - Correct isLoading vs isFetching semantics
 *
 * v1.1.0 — navigation resilience improvements:
 * - gcTime increased from 5 → 15 minutes so cached list survives brief
 *   navigation away and back without triggering a full re-fetch
 * - refetchOnWindowFocus: false prevents a full reload when the user
 *   switches windows
 * - networkMode: 'always' keeps the cached list visible when offline
 *
 * @module hooks/useDeletedLeads
 * @version 1.1.0
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listDeletedLeads, type IDeletedLeadItem } from '../services/leads';
import type { IPaginatedResponse } from '../types/lead';

// =============================================================================
// Query Keys
// =============================================================================

export const DELETED_LEADS_KEYS = {
  all: ['deleted-leads'] as const,
  list: (page: number, pageSize: number) =>
    [...DELETED_LEADS_KEYS.all, 'list', page, pageSize] as const,
};

// =============================================================================
// Hook
// =============================================================================

/**
 * Fetch deleted leads with React Query caching.
 * 
 * Key behaviors:
 * - First mount: isLoading=true, fetches from API
 * - Subsequent mounts (within gcTime): shows cached data instantly, refetches in background
 * - placeholderData keeps old data visible during refetch
 * - 5-minute gcTime means data survives navigation for 5 minutes
 * 
 * @param page - Page number (1-indexed)
 * @param pageSize - Items per page
 * @param enabled - Whether to execute the query (pass false for non-admin users)
 */
export function useDeletedLeads(
  page: number = 1,
  pageSize: number = 50,
  enabled: boolean = true,
) {
  return useQuery<IPaginatedResponse<IDeletedLeadItem>, Error>({
    queryKey: DELETED_LEADS_KEYS.list(page, pageSize),
    queryFn: () => listDeletedLeads(page, pageSize),
    enabled,
    staleTime: 30 * 1000,          // 30 seconds — won't refetch if navigated back within 30s
    gcTime: 15 * 60 * 1000,        // 15 min (was 5 min — too short; list was evicted on tab switch)
    retry: 2,
    retryDelay: 1000,
    placeholderData: (previousData) => previousData,
    refetchOnWindowFocus: false,   // prevent blank flash when user alt-tabs
    networkMode: 'always',         // keep cached list visible when backend is down
  });
}

// =============================================================================
// Cache Helpers
// =============================================================================

/**
 * Hook to get cache manipulation functions for deleted leads.
 * 
 * Used by the component to:
 * - Optimistically remove a lead from the cached list after restore/delete
 * - Invalidate the cache to trigger a background refetch
 */
export function useDeletedLeadsCache() {
  const queryClient = useQueryClient();

  /**
   * Optimistically remove a lead from the cached query data.
   * Called immediately after a successful restore or permanent delete
   * so the UI updates without waiting for a full refetch.
   */
  const removeLeadFromCache = (leadId: string, page: number, pageSize: number) => {
    const queryKey = DELETED_LEADS_KEYS.list(page, pageSize);
    queryClient.setQueryData<IPaginatedResponse<IDeletedLeadItem>>(
      queryKey,
      (old) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.filter((l) => l.id !== leadId),
          total: Math.max(0, old.total - 1),
        };
      },
    );
  };

  /**
   * Invalidate all deleted leads queries to trigger background refetch.
   */
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: DELETED_LEADS_KEYS.all });
  };

  return { removeLeadFromCache, invalidate };
}
