/**
 * Deleted Leads Recovery Dashboard
 *
 * Admin-only page that displays soft-deleted leads with options to:
 * - Restore a lead back to the active pipeline
 * - Permanently delete a lead (irreversible)
 *
 * Only visible to Primary Admin and Administrator roles.
 *
 * @module pages/DeletedLeadsDashboard
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect } from 'react';
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
import { Sidebar } from '../components/dashboard/Sidebar';
import {
  listDeletedLeads,
  restoreLead,
  permanentDeleteLead,
  type IDeletedLeadItem,
} from '../services/leads';
import type { IPaginatedResponse } from '../types/lead';
import { useAuth } from '../hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { LEADS_QUERY_KEYS } from '../hooks/useLeads';

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

  // Data state
  const [leads, setLeads] = useState<IDeletedLeadItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // Action state
  const [actionInProgress, setActionInProgress] = useState<string | null>(null); // lead id
  const [toast, setToast] = useState<ToastState | null>(null);

  // Confirmation dialog for permanent delete
  const [confirmDelete, setConfirmDelete] = useState<IDeletedLeadItem | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Fetch deleted leads
  const fetchLeads = useCallback(async (pageNum: number = 1) => {
    setIsLoading(true);
    setError(null);
    try {
      const res: IPaginatedResponse<IDeletedLeadItem> = await listDeletedLeads(pageNum, 50);
      setLeads(res.items);
      setTotal(res.total);
      setPage(res.page);
      setTotalPages(res.total_pages);
    } catch (err: any) {
      console.error('[DeletedLeads] fetch error:', err);
      setError(err?.response?.data?.detail || 'Failed to load deleted leads');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads(1);
  }, [fetchLeads]);

  // Restore a lead
  const handleRestore = useCallback(async (lead: IDeletedLeadItem) => {
    setActionInProgress(lead.id);
    try {
      await restoreLead(lead.id);
      setToast({ message: `${lead.lead_number} restored successfully`, type: 'success' });
      // Remove from local list immediately
      setLeads(prev => prev.filter(l => l.id !== lead.id));
      setTotal(prev => Math.max(0, prev - 1));
      // Invalidate active leads cache so restored lead appears
      queryClient.invalidateQueries({ queryKey: LEADS_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: LEADS_QUERY_KEYS.dashboardSummary() });
    } catch (err: any) {
      console.error('[DeletedLeads] restore error:', err);
      setToast({ message: err?.response?.data?.detail || 'Failed to restore lead', type: 'error' });
    } finally {
      setActionInProgress(null);
    }
  }, [queryClient]);

  // Permanently delete a lead
  const handlePermanentDelete = useCallback(async (lead: IDeletedLeadItem) => {
    setConfirmDelete(null);
    setActionInProgress(lead.id);
    try {
      await permanentDeleteLead(lead.id);
      setToast({ message: `${lead.lead_number} permanently deleted`, type: 'success' });
      setLeads(prev => prev.filter(l => l.id !== lead.id));
      setTotal(prev => Math.max(0, prev - 1));
    } catch (err: any) {
      console.error('[DeletedLeads] permanent delete error:', err);
      setToast({ message: err?.response?.data?.detail || 'Failed to permanently delete', type: 'error' });
    } finally {
      setActionInProgress(null);
    }
  }, []);

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

  // Access check
  const isAdmin = user && ['primary_admin', 'administrator'].includes(user.role);
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar currentPage="deleted-leads" onNavigate={() => {}} />
        <main className="ml-60 flex-1 flex items-center justify-center">
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
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      <Sidebar currentPage="deleted-leads" onNavigate={() => {}} />

      <main className="ml-60 flex-1 p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-red-100 flex items-center justify-center">
              <Trash2 size={22} className="text-red-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Deleted Leads</h1>
              <p className="text-sm text-gray-500">
                {total} deleted lead{total !== 1 ? 's' : ''} — Restore or permanently remove
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search deleted leads..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Refresh */}
            <button
              onClick={() => fetchLeads(page)}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertTriangle size={18} className="text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700 flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {isLoading && leads.length === 0 ? (
            <div className="p-12 text-center">
              <RefreshCw size={32} className="mx-auto text-gray-300 animate-spin mb-4" />
              <p className="text-gray-500">Loading deleted leads...</p>
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="p-12 text-center">
              <Inbox size={40} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-700 mb-1">
                {searchQuery ? 'No matches found' : 'No deleted leads'}
              </h3>
              <p className="text-sm text-gray-500">
                {searchQuery
                  ? 'Try adjusting your search query.'
                  : 'Deleted leads will appear here for recovery or permanent removal.'}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Lead #</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Patient</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Condition</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Priority</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Created</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Deleted</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredLeads.map(lead => {
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
                        hot: 'bg-red-100 text-red-700',
                        medium: 'bg-amber-100 text-amber-700',
                        low: 'bg-blue-100 text-blue-700',
                      };

                      return (
                        <tr
                          key={lead.id}
                          className={`hover:bg-gray-50 transition-colors ${isBusy ? 'opacity-50 pointer-events-none' : ''}`}
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
                              className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                                priorityColors[priority.toLowerCase()] || 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {priority}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 capitalize">{status}</td>
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
                      onClick={() => fetchLeads(page - 1)}
                      disabled={page <= 1 || isLoading}
                      className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => fetchLeads(page + 1)}
                      disabled={page >= totalPages || isLoading}
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
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
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg border ${
            toast.type === 'success'
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
