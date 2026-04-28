/**
 * Deleted Leads Recovery Dashboard
 *
 * Admin-only page that displays soft-deleted leads with options to:
 * - Restore a lead back to the active pipeline
 * - Permanently delete a lead (irreversible)
 *
 * PERMANENT FIX (v2): Uses React Query for data fetching instead of manual
 * useState/useEffect/fetch. This ensures:
 * - Data persists in cache across navigation (no fresh spinner every time)
 * - Stale-while-revalidate shows cached data instantly on return
 * - 5-second safety net prevents infinite spinner under any condition
 * - Optimistic cache updates for instant UI feedback on actions
 *
 * Only visible to Primary Admin and Administrator roles.
 *
 * @module pages/DeletedLeadsDashboard
 * @version 2.0.0
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  Search,
  RefreshCw,
  CheckCircle2,
  X,
  ShieldAlert,
  Inbox,
} from 'lucide-react';
import { RefreshButton } from '../components/common/RefreshButton';
import { GreetingBanner } from '../components/common/GreetingBanner';
import { Sidebar } from '../components/dashboard/Sidebar';
import {
  restoreLead,
  permanentDeleteLead,
  type IDeletedLeadItem,
} from '../services/leads';
import { useAuth } from '../hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { LEADS_QUERY_KEYS } from '../hooks/useLeads';
import { useDeletedLeads, useDeletedLeadsCache } from '../hooks/useDeletedLeads';

// =============================================================================
// Types
// =============================================================================

interface ToastState {
  message: string;
  type: 'success' | 'error';
}

// =============================================================================
// Helper: format date for display
// =============================================================================

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function safeStr(val: unknown): string {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (['null', 'undefined', 'none', 'None'].includes(s)) return '';
  return s;
}

// =============================================================================
// Component
// =============================================================================

const DeletedLeadsDashboard: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { removeLeadFromCache } = useDeletedLeadsCache();

  // Pagination
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // Action state
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  // Confirmation dialog for permanent delete
  const [confirmDelete, setConfirmDelete] = useState<IDeletedLeadItem | null>(null);

  // Admin check (hooks must be called unconditionally)
  const isAdmin = !!user && ['primary_admin', 'administrator'].includes(user.role);

  // =========================================================================
  // React Query — replaces manual useState/useEffect/fetch
  // =========================================================================
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useDeletedLeads(page, PAGE_SIZE, isAdmin);

  // Derive data from query result
  const leads = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.total_pages ?? 1;

  // =========================================================================
  // 5-Second Safety Net
  //
  // If the query is loading with NO cached data for more than 5 seconds,
  // show an error state with a Retry button instead of spinning forever.
  // This is a SAFETY NET — not the primary fix. The primary fix is React Query.
  // =========================================================================
  const isInitialLoading = isLoading && !data;
  const [loadingTooLong, setLoadingTooLong] = useState(false);
  const loadTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (isInitialLoading) {
      loadTimerRef.current = setTimeout(() => setLoadingTooLong(true), 5000);
    } else {
      setLoadingTooLong(false);
    }
    return () => {
      if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
    };
  }, [isInitialLoading]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Restore a lead
  const handleRestore = useCallback(async (lead: IDeletedLeadItem) => {
    setActionInProgress(lead.id);
    try {
      await restoreLead(lead.id);
      setToast({ message: `${lead.lead_number} restored successfully`, type: 'success' });
      // Optimistic cache update — remove from list immediately
      removeLeadFromCache(lead.id, page, PAGE_SIZE);
      // Invalidate active leads cache so restored lead appears
      queryClient.invalidateQueries({ queryKey: LEADS_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: LEADS_QUERY_KEYS.dashboardSummary() });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setToast({ message: axiosErr?.response?.data?.detail || 'Failed to restore lead', type: 'error' });
    } finally {
      setActionInProgress(null);
    }
  }, [queryClient, removeLeadFromCache, page]);

  // Permanently delete a lead
  const handlePermanentDelete = useCallback(async (lead: IDeletedLeadItem) => {
    setConfirmDelete(null);
    setActionInProgress(lead.id);
    try {
      await permanentDeleteLead(lead.id);
      setToast({ message: `${lead.lead_number} permanently deleted`, type: 'success' });
      // Optimistic cache update — remove from list immediately
      removeLeadFromCache(lead.id, page, PAGE_SIZE);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setToast({ message: axiosErr?.response?.data?.detail || 'Failed to permanently delete', type: 'error' });
    } finally {
      setActionInProgress(null);
    }
  }, [removeLeadFromCache, page]);

  // Filtered leads by search
  const filteredLeads = searchQuery.trim()
    ? leads.filter(l => {
      const q = searchQuery.toLowerCase();
      const name = `${safeStr(l.first_name)} ${safeStr(l.last_name)}`.toLowerCase();
      return (
        name.includes(q) ||
        (l.lead_number || '').toLowerCase().includes(q) ||
        (l.email || '').toLowerCase().includes(q) ||
        (l.condition || '').toLowerCase().includes(q)
      );
    })
    : leads;

  // Access check — early return AFTER all hooks
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar currentPage="deleted-leads" onNavigate={() => { }} />
        <main className="nr-sidebar-ml flex-1 flex items-center justify-center">
          <div className="text-center">
            <ShieldAlert size={48} className="mx-auto text-red-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-500">You do not have permission to view deleted leads.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50  ">
      <Sidebar currentPage="deleted-leads" onNavigate={() => { }} />

      <main className="nr-sidebar-ml flex-1 p-8">
        {/* Personalized Greeting */}
        <GreetingBanner />

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-red-100  flex items-center justify-center">
              <Trash2 size={22} className="text-red-600 " />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 ">Deleted Leads</h1>
              <p className="text-sm text-gray-500 ">
                {total} deleted lead{total !== 1 ? 's' : ''} — Restore or permanently remove
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 " />
              <input
                type="text"
                placeholder="Search deleted leads..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm bg-white  text-gray-900  border border-gray-200  rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400 "
              />
            </div>

            {/* Refresh */}
            <RefreshButton
              onRefresh={() => { refetch(); }}
              isRefreshing={isFetching}
              label="Refresh"
            />
          </div>
        </div>

        {/* Error banner (for query errors that have cached data to fall back on) */}
        {isError && data && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertTriangle size={18} className="text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700 flex-1">
              Failed to refresh deleted leads. Showing cached data.
            </p>
            <button onClick={() => refetch()} className="text-red-600 hover:text-red-800 text-sm font-medium">
              Retry
            </button>
          </div>
        )}

        {/* Table */}
        <div className="bg-white  rounded-xl border border-gray-200  shadow-sm overflow-hidden">
          {/* STATE 1: Initial loading (no cached data) — show spinner */}
          {isInitialLoading && !loadingTooLong ? (
            <div className="p-12 text-center">
              <RefreshCw size={32} className="mx-auto text-gray-300 animate-spin mb-4" />
              <p className="text-gray-500">Loading deleted leads...</p>
            </div>

            /* STATE 2: Error or loading timed out (no cached data) — show error + retry */
          ) : (isError && !data) || loadingTooLong ? (
            <div className="p-12 text-center">
              <AlertTriangle size={40} className="mx-auto text-amber-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-700 mb-1">
                {loadingTooLong ? 'Taking too long' : 'Failed to load'}
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                {loadingTooLong
                  ? 'The server is taking longer than expected to respond.'
                  : (error?.message || 'An error occurred while loading deleted leads.')}
              </p>
              <button
                onClick={() => {
                  setLoadingTooLong(false);
                  refetch();
                }}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <RefreshCw size={16} />
                Retry
              </button>
            </div>

            /* STATE 3: Data loaded but empty — show empty state */
          ) : filteredLeads.length === 0 ? (
            <div className="p-12 text-center">
              <Inbox size={40} className="mx-auto text-gray-300  mb-4" />
              <h3 className="text-lg font-medium text-gray-700  mb-1">
                {searchQuery ? 'No matches found' : 'No deleted leads'}
              </h3>
              <p className="text-sm text-gray-500 ">
                {searchQuery
                  ? 'Try adjusting your search query.'
                  : 'Deleted leads will appear here for recovery or permanent removal.'}
              </p>
            </div>

            /* STATE 4: Data loaded with results — show table */
          ) : (
            <>
              <div className="overflow-x-auto premium-scrollbar">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b-2 border-gray-200">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Lead #</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Patient</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Condition</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Priority</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Created</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Deleted</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredLeads.map((lead, index) => {
                      const name = [safeStr(lead.first_name), safeStr(lead.last_name)]
                        .filter(Boolean)
                        .join(' ') || 'Name not provided';
                      const condition = lead.conditions?.length
                        ? lead.conditions.join(', ')
                        : safeStr(lead.condition) || '—';
                      const priority = safeStr(lead.priority) || '—';
                      const status = safeStr(lead.status)?.replace(/_/g, ' ') || '—';
                      const isBusy = actionInProgress === lead.id;

                      const priorityColors: Record<string, string> = {
                        hot: 'bg-red-500 text-white',
                        medium: 'bg-amber-500 text-white',
                        low: 'bg-blue-500 text-white',
                      };

                      const statusColors: Record<string, string> = {
                        new: 'bg-emerald-500 text-white',
                        contacted: 'bg-blue-500 text-white',
                        qualified: 'bg-indigo-500 text-white',
                        converted: 'bg-green-600 text-white',
                        lost: 'bg-gray-500 text-white',
                        follow_up: 'bg-purple-500 text-white',
                        not_interested: 'bg-gray-400 text-white',
                      };

                      return (
                        <tr
                          key={lead.id}
                          className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-indigo-50/40 transition-colors duration-150 ${isBusy ? 'opacity-50 pointer-events-none' : ''}`}
                        >
                          <td className="px-4 py-3 font-mono text-xs text-gray-600">
                            {lead.lead_number}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">{name}</div>
                            {lead.email && (
                              <div className="text-xs text-gray-400 mt-0.5">{lead.email}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-700 capitalize">{condition}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-semibold capitalize ${priorityColors[priority.toLowerCase()] || 'bg-gray-400 text-white'
                                }`}
                            >
                              {priority}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-semibold capitalize ${statusColors[status.toLowerCase().replace(/ /g, '_')] || 'bg-gray-400 text-white'
                              }`}>
                              {status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(lead.created_at)}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(lead.deleted_at)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              {/* Restore */}
                              <button
                                onClick={() => handleRestore(lead)}
                                disabled={isBusy}
                                title="Restore lead"
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50"
                              >
                                <RotateCcw size={14} />
                                Restore
                              </button>
                              {/* Permanent Delete */}
                              <button
                                onClick={() => setConfirmDelete(lead)}
                                disabled={isBusy}
                                title="Permanently delete"
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                              >
                                <Trash2 size={14} />
                                Delete Forever
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                  <p className="text-sm text-gray-500">
                    Page {page} of {totalPages} · {total} total
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page <= 1 || isFetching}
                      className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages || isFetching}
                      className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* ─── Permanent Delete Confirmation Dialog ─── */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-slate-950/[0.08]  flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {/* Header */}
            <div className="bg-red-50 px-6 py-4 flex items-center gap-3 border-b border-red-100">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-red-900">Permanently Delete Lead</h3>
                <p className="text-xs text-red-600">This action cannot be undone</p>
              </div>
            </div>
            {/* Body */}
            <div className="px-6 py-5">
              <p className="text-sm text-gray-700">
                Are you sure you want to <strong>permanently delete</strong>{' '}
                <span className="font-mono text-red-700">{confirmDelete.lead_number}</span>?
              </p>
              <p className="text-sm text-gray-500 mt-2">
                All associated data including PHI will be permanently removed from the database.
                This action is <strong>irreversible</strong>.
              </p>
            </div>
            {/* Actions */}
            <div className="px-6 py-4 bg-gray-50 flex items-center justify-end gap-3 border-t border-gray-100">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handlePermanentDelete(confirmDelete)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Yes, Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Toast Notification ─── */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg border ${toast.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-red-50 border-red-200 text-red-800'
            }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0" />
          ) : (
            <AlertTriangle size={18} className="text-red-500 flex-shrink-0" />
          )}
          <span className="text-sm font-medium">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 opacity-60 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

export default DeletedLeadsDashboard;
