/**
 * PostConsultationQueue — World-class missed-consultation tracker
 *
 * Features:
 * - Area trend chart with selectable range (7d / 14d / 30d / All)
 * - Donut reason distribution with recharts
 * - Resizable columns (same pattern as LeadsTable — drag handle on header borders)
 * - Pagination (10 / 25 / 50 rows per page)
 * - Email + SMS quick-action icons in every row
 * - Left border urgency accent: green <2d · amber 2-7d · rose >7d
 *
 * "No-Show Date" uses lastUpdatedAt — scheduled_callback_at is cleared by
 * clear_lead_transition_fields() before NO_SHOW is persisted.
 */

import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import {
  CalendarX2, CalendarPlus, Phone, Eye, Mail, MessageSquare,
  PhoneOff, RefreshCw, ThumbsDown, Shield, MapPin,
  UserMinus, HelpCircle, ChevronUp, ChevronDown,
  Loader2, AlertCircle, TrendingUp, FileText,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import type { LeadTableRow } from '../../types/lead';
import { Badge } from '../common/Badge';
import { formatRelativeTime } from '../../utils/dateFormatters';
import { PhoneDialModal } from './PhoneDialModal';
import { EmailComposeDialog } from './EmailComposeDialog';
import { SMSComposeDialog } from './SMSComposeDialog';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PostConsultationQueueProps {
  leads: LeadTableRow[];
  isLoading: boolean;
  onView: (id: string) => void;
  onReEngage: (lead: LeadTableRow) => void;
  onRefresh: () => void;
}

type SortField = 'patient' | 'noShowDate' | 'lastActivity';
type SortDirection = 'asc' | 'desc';
interface SortState { field: SortField; direction: SortDirection }
type TrendRange = 7 | 14 | 30 | 'all';

// ---------------------------------------------------------------------------
// Column resize — mirrors LeadsTable pattern exactly
// ---------------------------------------------------------------------------

const COL_KEY     = 'nr_table_settings::post_consultation';
const COL_VERSION = 1;

const DEFAULT_COL_WIDTHS: Record<string, number> = {
  leadId:       110,
  patient:      180,
  noShowReason: 200,
  noShowDate:   170,
  lastActivity: 130,
};

function loadColWidths(): Record<string, number> {
  try {
    const raw = localStorage.getItem(COL_KEY);
    if (raw) {
      const p = JSON.parse(raw) as { columnWidths?: Record<string, number>; version?: number };
      if (p?.version === COL_VERSION && p.columnWidths) {
        return { ...DEFAULT_COL_WIDTHS, ...p.columnWidths };
      }
    }
  } catch { /* non-fatal */ }
  return { ...DEFAULT_COL_WIDTHS };
}

// ---------------------------------------------------------------------------
// Reason config  (hex for recharts cells)
// ---------------------------------------------------------------------------

type KnownReason =
  | 'no_call_no_show' | 'cancelled_reschedule' | 'cancelled_not_interested'
  | 'insurance_issue' | 'transportation' | 'provider_unavailable' | 'other';

interface ReasonCfg {
  label: string;
  badge: string;
  fill: string;
  Icon: React.FC<{ className?: string }>;
}

const REASON_CFG: Record<KnownReason, ReasonCfg> = {
  no_call_no_show:          { label: 'No Call / No Show',    badge: 'bg-rose-50 text-rose-700 border-rose-200',      fill: '#f43f5e', Icon: ({ className }) => <PhoneOff  className={className} /> },
  cancelled_reschedule:     { label: 'Wants Reschedule',     badge: 'bg-amber-50 text-amber-700 border-amber-200',   fill: '#f59e0b', Icon: ({ className }) => <RefreshCw  className={className} /> },
  cancelled_not_interested: { label: 'Not Interested',       badge: 'bg-orange-50 text-orange-700 border-orange-200',fill: '#f97316', Icon: ({ className }) => <ThumbsDown className={className} /> },
  insurance_issue:          { label: 'Insurance Issue',      badge: 'bg-purple-50 text-purple-700 border-purple-200',fill: '#a855f7', Icon: ({ className }) => <Shield     className={className} /> },
  transportation:           { label: 'Transportation',       badge: 'bg-blue-50 text-blue-700 border-blue-200',      fill: '#3b82f6', Icon: ({ className }) => <MapPin      className={className} /> },
  provider_unavailable:     { label: 'Provider Unavailable', badge: 'bg-slate-50 text-slate-600 border-slate-200',   fill: '#94a3b8', Icon: ({ className }) => <UserMinus   className={className} /> },
  other:                    { label: 'Other',                badge: 'bg-gray-50 text-gray-600 border-gray-200',      fill: '#9ca3af', Icon: ({ className }) => <HelpCircle  className={className} /> },
};
const KNOWN = new Set<string>(Object.keys(REASON_CFG));

function getReason(r: string | null | undefined): (ReasonCfg & { isKnown: boolean }) | null {
  if (!r?.trim()) return null;
  if (KNOWN.has(r)) return { ...REASON_CFG[r as KnownReason], isKnown: true };
  return { label: r, badge: 'bg-gray-50 text-gray-600 border-gray-200', fill: '#d1d5db', Icon: ({ className }) => <HelpCircle className={className} />, isKnown: false };
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function daysSince(ds: string | null | undefined): number {
  if (!ds) return 0;
  return Math.floor((Date.now() - new Date(ds).getTime()) / 86_400_000);
}

function fmtNoShowDate(ds: string | null | undefined) {
  if (!ds) return { text: 'Not recorded', color: 'text-gray-400', sub: null };
  const d = daysSince(ds);
  const text = new Date(ds).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  if (d > 7)  return { text, color: 'text-rose-600',   sub: `${d}d ago` };
  if (d >= 2) return { text, color: 'text-amber-600',  sub: `${d}d ago` };
  return { text, color: 'text-emerald-600', sub: d === 0 ? 'Today' : 'Yesterday' };
}

function urgencyBorder(ds: string | null | undefined) {
  const d = daysSince(ds);
  if (d > 7)  return 'border-l-[3px] border-l-rose-400';
  if (d >= 2) return 'border-l-[3px] border-l-amber-400';
  return 'border-l-[3px] border-l-emerald-400';
}

// ---------------------------------------------------------------------------
// Data builders
// ---------------------------------------------------------------------------

// Use local-date arithmetic for bucket keys so they always match the
// date shown in the UI regardless of the backend's timezone suffix.
function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function buildTrend(leads: LeadTableRow[], range: TrendRange) {
  const buckets: Record<string, number> = {};

  if (range === 'all') {
    const stamps = leads
      .map(l => (l.lastUpdatedAt || l.submittedAt) ? new Date(l.lastUpdatedAt || l.submittedAt!).getTime() : null)
      .filter((t): t is number => t !== null);
    if (stamps.length === 0) return [];
    const minTs = Math.min(...stamps);
    const cur = new Date(minTs); cur.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    while (cur <= end) {
      buckets[localDateKey(cur)] = 0;
      cur.setDate(cur.getDate() + 1);
    }
  } else {
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
      buckets[localDateKey(d)] = 0;
    }
  }

  for (const lead of leads) {
    const ts = lead.lastUpdatedAt || lead.submittedAt;
    if (!ts) continue;
    const key = localDateKey(new Date(ts));
    if (key in buckets) buckets[key]++;
  }

  return Object.entries(buckets).map(([key, count]) => ({
    date: new Date(key + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    count,
  }));
}

function buildPie(leads: LeadTableRow[]) {
  const counts: Record<string, { cfg: ReasonCfg & { isKnown: boolean }; n: number }> = {};
  let unrecorded = 0;
  for (const lead of leads) {
    const cfg = getReason(lead.noShowReason);
    if (!cfg) { unrecorded++; continue; }
    if (!counts[cfg.label]) counts[cfg.label] = { cfg, n: 0 };
    counts[cfg.label].n++;
  }
  const slices = Object.values(counts).sort((a, b) => b.n - a.n)
    .map(({ cfg, n }) => ({ label: cfg.label, count: n, fill: cfg.fill, Icon: cfg.Icon }));
  if (unrecorded > 0)
    slices.push({ label: 'Not Recorded', count: unrecorded, fill: '#e2e8f0', Icon: ({ className }) => <AlertCircle className={className} /> });
  return slices;
}

// ---------------------------------------------------------------------------
// Sort
// ---------------------------------------------------------------------------

function sortLeads(leads: LeadTableRow[], s: SortState) {
  return [...leads].sort((a, b) => {
    let cmp = 0;
    if (s.field === 'patient') {
      cmp = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
    } else {
      cmp = (a.lastUpdatedAt ? +new Date(a.lastUpdatedAt) : 0)
          - (b.lastUpdatedAt ? +new Date(b.lastUpdatedAt) : 0);
    }
    return s.direction === 'asc' ? cmp : -cmp;
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const SortTh: React.FC<{
  label: string; field: SortField; sort: SortState; onSort: (f: SortField) => void;
  width: number; colKey: string; onResizeStart: (col: string, startX: number, startW: number) => void;
}> = ({ label, field, sort, onSort, width, colKey, onResizeStart }) => {
  const active = sort.field === field;
  return (
    <th className="relative px-4 py-3 text-left bg-gray-50 select-none" style={{ width, minWidth: 80 }}>
      <button type="button" onClick={() => onSort(field)}
        className={`inline-flex items-center gap-1 text-[11px] uppercase tracking-widest font-semibold transition-colors ${active ? 'text-violet-700' : 'text-gray-400 hover:text-gray-600'}`}>
        {label}
        {active
          ? (sort.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)
          : <ChevronDown className="w-3 h-3 opacity-25" />}
      </button>
      {/* Resize handle */}
      <div
        className="absolute right-0 top-0 h-full w-4 cursor-col-resize z-10 group/resize flex items-center justify-center"
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onResizeStart(colKey, e.clientX, width); }}
      >
        <div className="w-0.5 h-4 rounded-full bg-gray-300 opacity-30 group-hover/resize:opacity-100 group-hover/resize:bg-violet-400 transition-all" />
      </div>
    </th>
  );
};

const StaticTh: React.FC<{
  label: string; width: number; colKey: string; onResizeStart: (col: string, startX: number, startW: number) => void;
}> = ({ label, width, colKey, onResizeStart }) => (
  <th className="relative px-4 py-3 text-left bg-gray-50 select-none" style={{ width, minWidth: 80 }}>
    <span className="text-[11px] uppercase tracking-widest font-semibold text-gray-400">{label}</span>
    <div
      className="absolute right-0 top-0 h-full w-4 cursor-col-resize z-10 group/resize flex items-center justify-center"
      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onResizeStart(colKey, e.clientX, width); }}
    >
      <div className="w-0.5 h-4 rounded-full bg-gray-300 opacity-30 group-hover/resize:opacity-100 group-hover/resize:bg-violet-400 transition-all" />
    </div>
  </th>
);

const CustomAreaTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3 text-center">
      <p className="text-[11px] text-gray-400 font-medium mb-1">{label}</p>
      <p className="text-2xl font-bold text-violet-700 leading-none">{payload[0].value}</p>
      <p className="text-[10px] text-gray-400 mt-1">no-show{payload[0].value !== 1 ? 's' : ''}</p>
    </div>
  );
};

const CustomPieTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2">
      <p className="text-xs font-semibold text-gray-700">{payload[0].name}</p>
      <p className="text-sm font-bold text-gray-900">{payload[0].value} lead{payload[0].value !== 1 ? 's' : ''}</p>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50] as const;

export const PostConsultationQueue: React.FC<PostConsultationQueueProps> = ({
  leads, isLoading, onView, onReEngage,
}) => {
  const [sort, setSort]             = useState<SortState>({ field: 'noShowDate', direction: 'desc' });
  const [trendRange, setTrendRange] = useState<TrendRange>(14);
  const [currentPage, setCurrentPage]     = useState(1);
  const [rowsPerPage, setRowsPerPage]     = useState<typeof ROWS_PER_PAGE_OPTIONS[number]>(25);
  const [colWidths, setColWidths]   = useState<Record<string, number>>(loadColWidths);
  const [phoneDialOpen, setPhoneDialOpen]         = useState(false);

  const [emailDialogOpen, setEmailDialogOpen]     = useState(false);
  const [smsDialogOpen, setSmsDialogOpen]         = useState(false);
  const [selectedLeadForComm, setSelectedLeadForComm] = useState<LeadTableRow | null>(null);
  const resizeRef = useRef<{ col: string; startX: number; startW: number } | null>(null);

  // Persist column widths to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(COL_KEY, JSON.stringify({ version: COL_VERSION, columnWidths: colWidths }));
    } catch { /* non-fatal */ }
  }, [colWidths]);

  // Document-level resize handlers — same pattern as LeadsTable
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const drag = resizeRef.current;
      if (!drag) return;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      const newW = Math.max(60, Math.min(500, drag.startW + e.clientX - drag.startX));
      if (Number.isFinite(newW)) setColWidths(prev => ({ ...prev, [drag.col]: newW }));
    };
    const onUp = () => {
      resizeRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  }, []);

  const handleSort = useCallback((field: SortField) => {
    setSort(prev => prev.field === field
      ? { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      : { field, direction: 'desc' });
    setCurrentPage(1);
  }, []);

  const handleResizeStart = useCallback((col: string, startX: number, startW: number) => {
    resizeRef.current = { col, startX, startW };
  }, []);

  const handleCallVia3CX = useCallback((phone: string) => {
    window.location.href = `tel:${phone.replace(/\D/g, '') || phone}`;
  }, []);

  const handleOpenDial = useCallback((lead: LeadTableRow) => {
    if (lead.phone?.trim()) { handleCallVia3CX(lead.phone); }
    else { setPhoneDialOpen(true); }
  }, [handleCallVia3CX]);

  const handleEmail = useCallback((lead: LeadTableRow) => {
    setSelectedLeadForComm(lead);
    setEmailDialogOpen(true);
  }, []);

  const handleSms = useCallback((lead: LeadTableRow) => {
    setSelectedLeadForComm(lead);
    setSmsDialogOpen(true);
  }, []);

  // Data
  const trendData   = useMemo(() => buildTrend(leads, trendRange), [leads, trendRange]);
  const pieData     = useMemo(() => buildPie(leads), [leads]);
  const sortedLeads = useMemo(() => sortLeads(leads, sort), [leads, sort]);

  // Pagination
  const totalPages  = Math.max(1, Math.ceil(sortedLeads.length / rowsPerPage));
  const safePage    = Math.min(currentPage, totalPages);
  const pageLeads   = sortedLeads.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage);

  const overdue       = useMemo(() => leads.filter(l => daysSince(l.lastUpdatedAt) > 7).length, [leads]);
  const recordingRate = leads.length > 0 ? Math.round((leads.filter(l => l.noShowReason?.trim()).length / leads.length) * 100) : 0;

  // x-axis: show every other label when range >= 14
  const xFmt = useCallback((val: string, idx: number) => {
    if (trendRange === 7) return val;
    return idx % 2 === 0 ? val : '';
  }, [trendRange]);

  // ---------- Loading ----------
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2.5" />
        <span className="text-sm font-medium">Loading missed consultations…</span>
      </div>
    );
  }

  // ---------- Empty ----------
  if (leads.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 py-24 flex flex-col items-center gap-5 text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center">
          <CalendarX2 className="w-8 h-8 text-violet-300" />
        </div>
        <div>
          <p className="text-gray-800 font-semibold text-base">No missed consultations</p>
          <p className="text-gray-400 text-sm mt-1.5 max-w-xs leading-relaxed">
            All scheduled patients attended their appointments — excellent coordination!
          </p>
        </div>
      </div>
    );
  }

  // ── Range picker labels ──────────────────────────────────────────────────
  const RANGES: { value: TrendRange; label: string }[] = [
    { value: 7,     label: '7d'  },
    { value: 14,    label: '14d' },
    { value: 30,    label: '30d' },
    { value: 'all', label: 'All' },
  ];

  return (
    <>
      <div className="flex flex-col gap-4">

        {/* ── Analytics row ──────────────────────────────────────────── */}
        <div className="grid grid-cols-5 gap-4">

          {/* Area trend — 3 cols */}
          <div className="col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm px-6 pt-5 pb-4">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">No-Show Trend</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Consultations missed per day</p>
              </div>
              <div className="flex items-center gap-3">
                {/* Range selector */}
                <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5">
                  {RANGES.map(r => (
                    <button
                      key={String(r.value)}
                      type="button"
                      onClick={() => setTrendRange(r.value)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all duration-150 ${
                        trendRange === r.value
                          ? 'bg-white text-violet-700 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                {/* Inline KPIs */}
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Total</p>
                    <p className="text-xl font-bold text-gray-900 leading-none mt-0.5">{leads.length}</p>
                  </div>
                  {overdue > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-400">Overdue</p>
                      <p className="text-xl font-bold text-rose-600 leading-none mt-0.5">{overdue}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Captured</p>
                    <p className={`text-xl font-bold leading-none mt-0.5 ${recordingRate >= 80 ? 'text-emerald-600' : 'text-amber-600'}`}>{recordingRate}%</p>
                  </div>
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={155}>
              <AreaChart data={trendData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="violetGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#7c3aed" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={xFmt} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={22} />
                <RechartsTooltip content={<CustomAreaTooltip />} cursor={{ stroke: '#7c3aed', strokeWidth: 1, strokeDasharray: '4 2' }} />
                <Area type="monotone" dataKey="count" stroke="#7c3aed" strokeWidth={2}
                  fill="url(#violetGrad)"
                  dot={{ fill: '#7c3aed', strokeWidth: 0, r: 3.5 }}
                  activeDot={{ r: 5, fill: '#7c3aed', stroke: '#fff', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Donut — 2 cols */}
          <div className="col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm px-5 pt-5 pb-4 flex flex-col">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-gray-800">Reason Distribution</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">Breakdown by no-show category</p>
            </div>
            <div className="flex items-center gap-4 flex-1 min-h-0">
              {/* Donut */}
              <div className="relative shrink-0" style={{ width: 130, height: 130 }}>
                <PieChart width={130} height={130}>
                  <Pie data={pieData} cx={60} cy={60} innerRadius={40} outerRadius={60}
                    paddingAngle={pieData.length > 1 ? 3 : 0} dataKey="count" nameKey="label" startAngle={90} endAngle={-270}>
                    {pieData.map((s, i) => <Cell key={i} fill={s.fill} />)}
                  </Pie>
                  <RechartsTooltip content={<CustomPieTooltip />} />
                </PieChart>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900 leading-none">{leads.length}</p>
                    <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">total</p>
                  </div>
                </div>
              </div>
              {/* Legend */}
              <div className="flex flex-col gap-2 flex-1 min-w-0">
                {pieData.map(({ label, count, fill }) => (
                  <div key={label} className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: fill }} />
                    <span className="text-[11px] text-gray-600 truncate flex-1" title={label}>{label}</span>
                    <span className="text-[11px] font-bold text-gray-800 shrink-0">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Table ──────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Table header strip */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-violet-500" />
              <span className="text-sm font-semibold text-gray-700">
                {leads.length} missed consultation{leads.length !== 1 ? 's' : ''}
              </span>
              {overdue > 0 && (
                <span className="inline-flex items-center gap-1 bg-rose-50 border border-rose-100 text-rose-600 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                  <AlertCircle className="w-3 h-3" />{overdue} overdue
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-[11px] text-gray-400 font-medium">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" />Within 2 days</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" />2–7 days</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-400" />Overdue &gt;7d</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full" style={{ tableLayout: 'fixed', minWidth: 820 }}>
              <thead className="bg-gray-50/80 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left bg-gray-50 select-none" style={{ width: colWidths.leadId, minWidth: 80 }}>
                    <span className="text-[11px] uppercase tracking-widest font-semibold text-gray-400">Lead ID</span>
                    <div
                      className="absolute right-0 top-0 h-full w-4 cursor-col-resize z-10 group/resize flex items-center justify-center"
                      onMouseDown={(e) => { e.preventDefault(); handleResizeStart('leadId', e.clientX, colWidths.leadId); }}
                    >
                      <div className="w-0.5 h-4 rounded-full bg-gray-300 opacity-30 group-hover/resize:opacity-100 group-hover/resize:bg-violet-400 transition-all" />
                    </div>
                  </th>
                  <SortTh label="Patient"        field="patient"      sort={sort} onSort={handleSort} width={colWidths.patient}      colKey="patient"      onResizeStart={handleResizeStart} />
                  <StaticTh label="No-Show Reason"                                                    width={colWidths.noShowReason} colKey="noShowReason" onResizeStart={handleResizeStart} />
                  <SortTh label="No-Show Date"   field="noShowDate"   sort={sort} onSort={handleSort} width={colWidths.noShowDate}   colKey="noShowDate"   onResizeStart={handleResizeStart} />
                  <SortTh label="Last Activity"  field="lastActivity" sort={sort} onSort={handleSort} width={colWidths.lastActivity} colKey="lastActivity" onResizeStart={handleResizeStart} />
                  <th className="px-4 py-3 text-right bg-gray-50 select-none" style={{ minWidth: 220 }}>
                    <span className="text-[11px] uppercase tracking-widest font-semibold text-gray-400">Actions</span>
                  </th>
                </tr>
              </thead>

              <tbody>
                {pageLeads.map((lead) => {
                  const reasonCfg = getReason(lead.noShowReason);
                  const { text: dateText, color: dateColor, sub: dateSub } = fmtNoShowDate(lead.lastUpdatedAt);
                  const border = urgencyBorder(lead.lastUpdatedAt);

                  return (
                    <tr key={lead.id}
                      className={`group transition-colors duration-150 hover:bg-slate-50/70 border-b border-gray-50 last:border-0 ${border}`}>

                      {/* Lead ID */}
                      <td className="px-4 py-3.5 overflow-hidden" style={{ width: colWidths.leadId }}>
                        <span className="font-mono text-[11px] text-gray-400 tracking-tight truncate block">{lead.leadId}</span>
                      </td>

                      {/* Patient */}
                      <td className="px-4 py-3.5 overflow-hidden" style={{ width: colWidths.patient }}>
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-gray-800 text-sm leading-tight truncate">{lead.firstName} {lead.lastName}</span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="priority" value={lead.priority} size="sm" />
                            {lead.isReferral && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-600 border border-indigo-100">Referral</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* No-Show Reason */}
                      <td className="px-4 py-3.5 overflow-hidden" style={{ width: colWidths.noShowReason }}>
                        {reasonCfg ? (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${reasonCfg.badge}`}>
                            <reasonCfg.Icon className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate max-w-[150px]" title={reasonCfg.label}>{reasonCfg.label}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs text-gray-400 italic">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-gray-300" />Not recorded
                          </span>
                        )}
                      </td>

                      {/* No-Show Date */}
                      <td className="px-4 py-3.5 overflow-hidden" style={{ width: colWidths.noShowDate }}>
                        <div className="flex flex-col gap-0.5">
                          <span className={`text-xs font-medium ${dateColor} truncate`}>{dateText}</span>
                          {dateSub && <span className={`text-[10px] font-bold uppercase tracking-wide ${dateColor} opacity-70`}>{dateSub}</span>}
                        </div>
                      </td>

                      {/* Last Activity */}
                      <td className="px-4 py-3.5 overflow-hidden" style={{ width: colWidths.lastActivity }}>
                        <span className="text-xs text-gray-500">{formatRelativeTime(lead.lastUpdatedAt)}</span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Re-engage — primary CTA */}
                          <button type="button" onClick={() => onReEngage(lead)}
                            className="inline-flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 active:scale-[0.97] text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm shadow-violet-100 transition-all duration-150"
                            title="Re-book consultation">
                            <CalendarPlus className="w-3.5 h-3.5" />Re-engage
                          </button>
                          {/* Phone */}
                          <button type="button" onClick={() => handleOpenDial(lead)}
                            className={`p-1.5 rounded-lg transition-colors duration-150 ${lead.phone ? 'text-gray-400 hover:text-violet-600 hover:bg-violet-50' : 'text-gray-200 cursor-not-allowed'}`}
                            title={lead.phone ? `Call ${lead.firstName}` : 'No phone on file'}
                            disabled={!lead.phone}>
                            <Phone className="w-4 h-4" />
                          </button>
                          {/* Email */}
                          <button type="button" onClick={() => handleEmail(lead)}
                            className={`p-1.5 rounded-lg transition-colors duration-150 ${lead.email ? 'text-gray-400 hover:text-blue-600 hover:bg-blue-50' : 'text-gray-200 cursor-not-allowed'}`}
                            title={lead.email ? `Email ${lead.firstName}` : 'No email on file'}
                            disabled={!lead.email}>
                            <Mail className="w-4 h-4" />
                          </button>
                          {/* SMS */}
                          <button type="button" onClick={() => handleSms(lead)}
                            className={`p-1.5 rounded-lg transition-colors duration-150 ${lead.phone ? 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50' : 'text-gray-200 cursor-not-allowed'}`}
                            title={lead.phone ? `SMS ${lead.firstName}` : 'No phone on file'}
                            disabled={!lead.phone}>
                            <MessageSquare className="w-4 h-4" />
                          </button>
                          {/* View */}
                          <button type="button" onClick={() => onView(lead.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                            title="View full lead profile">
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Pagination footer ──────────────────────────────────── */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-50 bg-gray-50/40">
            <div className="flex items-center gap-2 text-[11px] text-gray-500">
              <FileText className="w-3.5 h-3.5 text-gray-400" />
              <span>
                Showing {leads.length === 0 ? 0 : (safePage - 1) * rowsPerPage + 1}–{Math.min(safePage * rowsPerPage, leads.length)} of {leads.length}
              </span>
              <span className="text-gray-300 mx-1">·</span>
              <span>Rows per page:</span>
              <select
                value={rowsPerPage}
                onChange={e => { setRowsPerPage(Number(e.target.value) as typeof ROWS_PER_PAGE_OPTIONS[number]); setCurrentPage(1); }}
                className="bg-white border border-gray-200 rounded-md text-[11px] text-gray-600 px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-violet-400"
              >
                {ROWS_PER_PAGE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                .reduce<(number | '…')[]>((acc, p, i, arr) => {
                  if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('…');
                  acc.push(p);
                  return acc;
                }, [])
                .map((item, i) => item === '…'
                  ? <span key={`ellipsis-${i}`} className="w-7 h-7 flex items-center justify-center text-xs text-gray-400">…</span>
                  : (
                    <button key={item} type="button"
                      onClick={() => setCurrentPage(item as number)}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold transition-colors ${
                        safePage === item ? 'bg-violet-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      {item}
                    </button>
                  )
                )}
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

      </div>

      <PhoneDialModal
        isOpen={phoneDialOpen}
        onClose={() => { setPhoneDialOpen(false); }}
        onCall={handleCallVia3CX}
      />

      <EmailComposeDialog
        isOpen={emailDialogOpen}
        onClose={() => { setEmailDialogOpen(false); setSelectedLeadForComm(null); }}
        lead={selectedLeadForComm}
        onSendSuccess={() => { setEmailDialogOpen(false); setSelectedLeadForComm(null); }}
      />

      <SMSComposeDialog
        isOpen={smsDialogOpen}
        onClose={() => { setSmsDialogOpen(false); setSelectedLeadForComm(null); }}
        lead={selectedLeadForComm}
        onSendSuccess={() => { setSmsDialogOpen(false); setSelectedLeadForComm(null); }}
      />
    </>
  );
};

export default PostConsultationQueue;
