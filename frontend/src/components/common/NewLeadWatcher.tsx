/**
 * NewLeadWatcher — Lightweight background polling component.
 *
 * Polls `GET /api/leads/latest-check` every 15 seconds using plain `fetch()`
 * (NOT React Query) to detect new lead arrivals without adding query-cache
 * churn.  When the total count increases it:
 *   1. Dispatches a toast notification via the global CustomEvent bus.
 *   2. Plays the professional two-tone chime (via the toast system).
 *   3. Invalidates the React Query leads cache so every mounted dashboard
 *      picks up the new data on its next render cycle.
 *
 * MANUAL LEAD SUPPRESSION (v2.0.0 — Source-Based):
 *   The polling endpoint (`/api/leads/latest-check`) returns a `recent_sources`
 *   array containing the `source` column value for every lead created in the
 *   last 30 seconds.  When a count increase (delta) is detected, we count how
 *   many of those recent sources are `'manual'` and subtract them from the
 *   delta.  Only the remaining "organic" delta (widget / jotform / API) fires
 *   a toast + chime.
 *
 *   This is purely data-driven:
 *   • No module-level counters or mutable state shared across components.
 *   • Works correctly across page refreshes, multiple browser tabs, and
 *     multiple coordinators — the server is the single source of truth.
 *   • Zero coupling between ManualLeadModal and this component.
 *
 * Design constraints:
 *   • Zero UI — renders `null`.
 *   • No React Query dependency for the poll itself (avoids cache bloat).
 *   • Uses `useRef` for mutable state so the interval callback never
 *     triggers re-renders.
 *   • Cleans up interval + abort controller on unmount.
 *   • Graceful: swallows all errors silently (network blips, 401 during
 *     token refresh, etc.).
 *
 * @module components/common/NewLeadWatcher
 * @version 2.0.0
 */

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getStoredToken } from '../../services/api';
import { showToast } from './ToastContainer';

// Polling interval (ms) — 15 seconds balances freshness vs. load.
const POLL_INTERVAL_MS = 15_000;

// API base — mirrors api.ts logic (empty string → Vite proxy).
const API_BASE = import.meta.env.VITE_API_URL ?? '';

interface LatestCheckResponse {
  total: number;
  latest_at: string | null;
  /** Source values for leads created in the last 30 seconds. */
  recent_sources: string[];
}

/**
 * Invisible component that watches for new leads via lightweight polling.
 * Mount once inside the authenticated shell (AuthGate).
 */
const NewLeadWatcher: React.FC = () => {
  const queryClient = useQueryClient();

  // Mutable refs — never cause re-renders.
  const prevTotalRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    /**
     * Single poll cycle.  Fetches the lightweight endpoint, compares count,
     * and fires notifications + cache invalidation when new leads arrive.
     */
    const poll = async () => {
      // Skip if no auth token (user logged out between ticks).
      const token = getStoredToken();
      if (!token) return;

      // Abort any in-flight request from a previous tick that somehow
      // hasn't resolved yet (shouldn't happen with 15s interval, but safe).
      if (abortRef.current) {
        abortRef.current.abort();
      }
      abortRef.current = new AbortController();

      try {
        const res = await fetch(`${API_BASE}/api/leads/latest-check`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          signal: abortRef.current.signal,
        });

        if (!res.ok) return; // 401 / 5xx — silently skip this tick.

        const data: LatestCheckResponse = await res.json();
        const newTotal = data.total ?? 0;

        // First poll — just seed the ref, don't notify.
        if (prevTotalRef.current === null) {
          prevTotalRef.current = newTotal;
          return;
        }

        // Detect new arrivals.
        const rawDelta = newTotal - prevTotalRef.current;

        if (rawDelta > 0) {
          // ---------------------------------------------------------------
          // Source-based suppression: count how many of the recently-created
          // leads are manual (coordinator-created) and subtract them from
          // the raw delta.  Only "organic" arrivals fire a notification.
          // ---------------------------------------------------------------
          const manualCount = (data.recent_sources || []).filter(
            (s) => s === 'manual'
          ).length;

          const organicDelta = Math.max(0, rawDelta - manualCount);

          if (organicDelta > 0) {
            // 1. Toast notification — only for organic leads
            if (organicDelta === 1) {
              showToast('new-lead', '🔥 New Lead', 'A new lead just arrived!');
            } else {
              showToast('new-lead', '🔥 New Leads', `${organicDelta} new leads just arrived!`);
            }

            // 2. Sound is played by ToastContainer when it receives a
            //    'new-lead' type toast, so no need for a duplicate call here.
          }

          // 3. ALWAYS invalidate React Query leads cache when count changes,
          //    even for manual leads — the table should show the new row.
          //    Only actively mounted queries will refetch immediately.
          queryClient.invalidateQueries({
            queryKey: ['leads'],
            refetchType: 'active',
          });

          // Also invalidate analytics/dashboard counts so KPI cards update.
          queryClient.invalidateQueries({
            queryKey: ['analytics'],
            refetchType: 'active',
          });
        }

        // Update stored total (also handles deletions gracefully).
        prevTotalRef.current = newTotal;
      } catch (_err) {
        // Swallow AbortError, network failures, JSON parse errors, etc.
        // The next tick will try again.
      }
    };

    // Run first poll immediately so prevTotalRef is seeded.
    poll();

    // Start interval.
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    // Cleanup on unmount.
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
    };
  }, [queryClient]);

  // Zero UI — this component is invisible.
  return null;
};

export default NewLeadWatcher;
