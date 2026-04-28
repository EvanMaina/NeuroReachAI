/**
 * Bulk actions bar.
 *
 * Slides in at the top of the leads table when at least one row is selected.
 * Supports three bulk operations: change priority, change status,
 * change contact outcome. Each calls the shared /api/leads/bulk-update
 * endpoint and then invalidates the leads cache so the table reflows.
 */

import React, { useState } from 'react';
import {
  Flame, Zap, CircleDot, ChevronDown, X, Check, Loader2,
  AlertCircle, Users as UsersIcon,
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  bulkUpdateLeads,
  type IBulkUpdateLeadsRequest,
  type IBulkUpdateLeadsResponse,
} from '../../services/leads';
import { LEADS_QUERY_KEYS } from '../../hooks/useLeads';

interface BulkActionsBarProps {
  selectedIds: string[];
  onClear: () => void;
  onSuccess?: (res: IBulkUpdateLeadsResponse) => void;
}

const PRIORITY_CHOICES: Array<{
  label: string;
  value: 'HOT' | 'MEDIUM' | 'LOW';
  icon: React.ReactNode;
  className: string;
}> = [
  { label: 'Hot', value: 'HOT', icon: <Flame size={14} />, className: 'text-red-600' },
  { label: 'Medium', value: 'MEDIUM', icon: <Zap size={14} />, className: 'text-amber-600' },
  { label: 'Low', value: 'LOW', icon: <CircleDot size={14} />, className: 'text-blue-600' },
];

const OUTCOME_CHOICES: Array<{ label: string; value: IBulkUpdateLeadsRequest['contact_outcome'] }> = [
  { label: 'New', value: 'NEW' },
  { label: 'Answered', value: 'ANSWERED' },
  { label: 'No Answer', value: 'NO_ANSWER' },
  { label: 'Unreachable', value: 'UNREACHABLE' },
  { label: 'Callback Requested', value: 'CALLBACK_REQUESTED' },
  { label: 'Not Interested', value: 'NOT_INTERESTED' },
  { label: 'Scheduled', value: 'SCHEDULED' },
];

// LeadStatus values — must match backend enum (src/models/lead.py::LeadStatus).
const STATUS_CHOICES: Array<{ label: string; value: string }> = [
  { label: 'New', value: 'NEW' },
  { label: 'Contacted', value: 'CONTACTED' },
  { label: 'Scheduled', value: 'SCHEDULED' },
  { label: 'Consultation Complete', value: 'CONSULTATION_COMPLETE' },
  { label: 'Treatment Started', value: 'TREATMENT_STARTED' },
  { label: 'Lost', value: 'LOST' },
  { label: 'Disqualified', value: 'DISQUALIFIED' },
];

export const BulkActionsBar: React.FC<BulkActionsBarProps> = ({ selectedIds, onClear, onSuccess }) => {
  const queryClient = useQueryClient();
  const [openMenu, setOpenMenu] = useState<'priority' | 'status' | 'outcome' | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: IBulkUpdateLeadsRequest) => bulkUpdateLeads(payload),
    onSuccess: (res) => {
      setStatus({ ok: true, msg: `Updated ${res.updated_count} lead${res.updated_count === 1 ? '' : 's'}.` });
      queryClient.invalidateQueries({ queryKey: LEADS_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: LEADS_QUERY_KEYS.queueSummary() });
      queryClient.invalidateQueries({ queryKey: LEADS_QUERY_KEYS.dashboardSummary() });
      onSuccess?.(res);
      onClear();
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setStatus({
        ok: false,
        msg: axiosErr?.response?.data?.detail || (err instanceof Error ? err.message : 'Bulk update failed.'),
      });
    },
  });

  const run = (patch: Partial<IBulkUpdateLeadsRequest>) => {
    setOpenMenu(null);
    setStatus(null);
    mutation.mutate({ lead_ids: selectedIds, ...patch });
  };

  if (selectedIds.length === 0) return null;

  return (
    <div className="sticky top-0 z-20 mx-4 mt-2 rounded-xl bg-blue-600 text-white shadow-lg flex items-center gap-3 px-4 py-3 flex-wrap">
      <div className="flex items-center gap-2">
        <UsersIcon size={16} />
        <span className="text-sm font-semibold">
          {selectedIds.length} lead{selectedIds.length === 1 ? '' : 's'} selected
        </span>
      </div>

      <div className="flex items-center gap-2 ml-auto flex-wrap">
        {/* Priority */}
        <MenuButton
          label="Change priority"
          open={openMenu === 'priority'}
          onToggle={() => setOpenMenu((o) => (o === 'priority' ? null : 'priority'))}
          disabled={mutation.isPending}
        >
          {PRIORITY_CHOICES.map((p) => (
            <MenuItem
              key={p.value}
              onClick={() => run({ priority: p.value })}
              className={p.className}
            >
              <span className="flex items-center gap-2">{p.icon}{p.label}</span>
            </MenuItem>
          ))}
        </MenuButton>

        {/* Status */}
        <MenuButton
          label="Change status"
          open={openMenu === 'status'}
          onToggle={() => setOpenMenu((o) => (o === 'status' ? null : 'status'))}
          disabled={mutation.isPending}
        >
          {STATUS_CHOICES.map((s) => (
            <MenuItem key={s.value} onClick={() => run({ status: s.value })}>
              {s.label}
            </MenuItem>
          ))}
        </MenuButton>

        {/* Outcome */}
        <MenuButton
          label="Contact outcome"
          open={openMenu === 'outcome'}
          onToggle={() => setOpenMenu((o) => (o === 'outcome' ? null : 'outcome'))}
          disabled={mutation.isPending}
        >
          {OUTCOME_CHOICES.map((o) => (
            <MenuItem key={o.value} onClick={() => run({ contact_outcome: o.value })}>
              {o.label}
            </MenuItem>
          ))}
        </MenuButton>

        {mutation.isPending && <Loader2 size={16} className="animate-spin" />}

        {status && (
          <span className={`inline-flex items-center gap-1 text-xs ${status.ok ? 'text-emerald-200' : 'text-amber-200'}`}>
            {status.ok ? <Check size={12} /> : <AlertCircle size={12} />}
            {status.msg}
          </span>
        )}

        <button
          onClick={onClear}
          title="Clear selection"
          className="p-1 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

interface MenuButtonProps {
  label: string;
  open: boolean;
  onToggle: () => void;
  disabled: boolean;
  children: React.ReactNode;
}

const MenuButton: React.FC<MenuButtonProps> = ({ label, open, onToggle, disabled, children }) => (
  <div className="relative">
    <button
      onClick={onToggle}
      disabled={disabled}
      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-50 transition-colors"
    >
      {label}
      <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && (
      <div className="absolute right-0 top-full mt-1 min-w-[200px] bg-white text-gray-800 rounded-lg shadow-xl py-1 z-30">
        {children}
      </div>
    )}
  </div>
);

const MenuItem: React.FC<{ onClick: () => void; children: React.ReactNode; className?: string }> = ({
  onClick, children, className = '',
}) => (
  <button
    onClick={onClick}
    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 transition-colors ${className}`}
  >
    {children}
  </button>
);

export default BulkActionsBar;
