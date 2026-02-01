/**
 * CallAttributionTab — Attribution Reports with recharts visualizations
 *
 * Charts:
 * 1. Line chart — Call volume over time (total, answered, missed, first-time)
 * 2. Donut chart — Calls by source
 * 3. Donut chart — Caller type (first-time vs returning)
 * 4. Horizontal bar chart — By campaign
 * 5. Horizontal bar chart — By geography
 */
import React from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';
import { TrendingUp, Globe, Megaphone } from 'lucide-react';
import type { TimeseriesResponse, AttributionResponse } from '../../services/callrail';

// =============================================================================
// Constants
// =============================================================================

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#F43F5E', '#06B6D4', '#6366F1', '#EC4899'];
const LINE_COLORS = { total: '#3B82F6', answered: '#10B981', missed: '#F43F5E', first_time: '#F59E0B' };

// =============================================================================
// Props
// =============================================================================

interface Props {
  timeseriesData: TimeseriesResponse | undefined;
  attributionData: AttributionResponse | undefined;
  isLoading: boolean;
}

// =============================================================================
// Skeleton
// =============================================================================

const ChartSkeleton: React.FC<{ height?: string }> = ({ height = 'h-72' }) => (
  <div className={`animate-pulse bg-gray-100 rounded-xl ${height}`} />
);

const SectionSkeleton: React.FC = () => (
  <div className="bg-white rounded-2xl border border-gray-100 p-6">
    <div className="animate-pulse">
      <div className="h-5 bg-gray-200 rounded w-40 mb-6" />
      <ChartSkeleton />
    </div>
  </div>
);

// =============================================================================
// Custom Tooltip for Line Chart
// =============================================================================

const LineTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl p-3 shadow-xl">
      <p className="text-xs font-semibold text-gray-700 mb-2">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2 text-xs py-0.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-gray-500 capitalize">{entry.name.replace('_', ' ')}:</span>
          <span className="font-semibold text-gray-900">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

// =============================================================================
// Custom Tooltip for Donut
// =============================================================================

const DonutTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl p-3 shadow-xl">
      <p className="text-xs font-semibold text-gray-700">{d.name}</p>
      <p className="text-sm font-bold text-gray-900">{d.value} calls</p>
    </div>
  );
};

// =============================================================================
// Donut Center Label
// =============================================================================

// DonutCenter - available for future use with recharts custom labels
const _DonutCenter = ({ total, label }: { total: number; label: string }) => (
  <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central">
    <tspan x="50%" dy="-8" className="text-2xl font-bold fill-gray-900">{total}</tspan>
    <tspan x="50%" dy="22" className="text-xs fill-gray-400">{label}</tspan>
  </text>
);
void _DonutCenter;

// =============================================================================
// Component
// =============================================================================

export const CallAttributionTab: React.FC<Props> = ({ timeseriesData, attributionData, isLoading }) => {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <SectionSkeleton />
        <div className="grid grid-cols-2 gap-6"><SectionSkeleton /><SectionSkeleton /></div>
        <div className="grid grid-cols-2 gap-6"><SectionSkeleton /><SectionSkeleton /></div>
      </div>
    );
  }

  const ts = timeseriesData?.data || [];
  const att = attributionData;
  const sourceData = att?.source_breakdown || [];
  const callerTypeData = att?.caller_type || [];
  const campaignData = att?.campaign_breakdown || [];
  const geoData = att?.geo_breakdown || [];
  const totalCalls = att?.total_calls || 0;

  // Format dates for X axis
  const formattedTs = ts.map(d => ({
    ...d,
    label: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));

  return (
    <div className="space-y-6">
      {/* ── 1. Call Volume Over Time (Line Chart) ── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
            <TrendingUp size={18} className="text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Call Volume Over Time</h3>
            <p className="text-xs text-gray-400">Daily breakdown of call types</p>
          </div>
        </div>
        {formattedTs.length === 0 ? (
          <div className="h-72 flex items-center justify-center text-gray-400 text-sm">No data for this period</div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={formattedTs} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <Tooltip content={<LineTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
              <Line type="monotone" dataKey="total" name="Total" stroke={LINE_COLORS.total} strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 2 }} />
              <Line type="monotone" dataKey="answered" name="Answered" stroke={LINE_COLORS.answered} strokeWidth={2} dot={false} strokeDasharray="" />
              <Line type="monotone" dataKey="missed" name="Missed" stroke={LINE_COLORS.missed} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="first_time" name="First Time" stroke={LINE_COLORS.first_time} strokeWidth={2} dot={false} strokeDasharray="5 5" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── 2 & 3. Donut Charts Row ── */}
      <div className="grid grid-cols-2 gap-6">
        {/* Calls by Source */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-1">Calls by Source</h3>
          <p className="text-xs text-gray-400 mb-4">Where your calls originate</p>
          {sourceData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-400 text-sm">No source data</div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="w-52 h-52 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={sourceData} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                      dataKey="value" nameKey="name" paddingAngle={3} strokeWidth={0}>
                      {sourceData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<DonutTooltip />} />
                    <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central">
                      <tspan x="50%" dy="-8" fontSize="20" fontWeight="bold" fill="#1e293b">{totalCalls}</tspan>
                      <tspan x="50%" dy="20" fontSize="11" fill="#94a3b8">Total</tspan>
                    </text>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2 max-h-52 overflow-y-auto">
                {sourceData.map((s, i) => (
                  <div key={s.name} className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-sm text-gray-700 truncate flex-1">{s.name}</span>
                    <span className="text-sm font-semibold text-gray-900">{s.value}</span>
                    <span className="text-xs text-gray-400 w-10 text-right">
                      {totalCalls > 0 ? `${Math.round((s.value / totalCalls) * 100)}%` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Caller Type */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-1">Caller Type</h3>
          <p className="text-xs text-gray-400 mb-4">First-time vs returning callers</p>
          {callerTypeData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-400 text-sm">No data</div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="w-52 h-52 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={callerTypeData} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                      dataKey="value" nameKey="name" paddingAngle={4} strokeWidth={0}>
                      <Cell fill="#F59E0B" />
                      <Cell fill="#3B82F6" />
                      {callerTypeData.slice(2).map((_, i) => <Cell key={i+2} fill={COLORS[(i+2) % COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<DonutTooltip />} />
                    <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central">
                      <tspan x="50%" dy="-8" fontSize="20" fontWeight="bold" fill="#1e293b">{totalCalls}</tspan>
                      <tspan x="50%" dy="20" fontSize="11" fill="#94a3b8">Total</tspan>
                    </text>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-3">
                {callerTypeData.map((ct, i) => {
                  const color = i === 0 ? '#F59E0B' : '#3B82F6';
                  const pct = totalCalls > 0 ? Math.round((ct.value / totalCalls) * 100) : 0;
                  return (
                    <div key={ct.name}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                          <span className="text-sm text-gray-700">{ct.name}</span>
                        </div>
                        <span className="text-sm font-semibold text-gray-900">{ct.value}</span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 4 & 5. Bar Charts Row ── */}
      <div className="grid grid-cols-2 gap-6">
        {/* By Campaign */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center">
              <Megaphone size={18} className="text-violet-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">By Campaign</h3>
              <p className="text-xs text-gray-400">Call volume per marketing campaign</p>
            </div>
          </div>
          {campaignData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-400 text-sm">No campaign data</div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, campaignData.length * 48)}>
              <BarChart data={campaignData.slice(0, 10)} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                  formatter={(value: any, name: any) => [value, name === 'answered' ? 'Answered' : 'Total']}
                />
                <Bar dataKey="total" name="Total" fill="#8B5CF6" radius={[0, 6, 6, 0]} barSize={18} />
                <Bar dataKey="answered" name="Answered" fill="#10B981" radius={[0, 6, 6, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* By Geography */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-xl bg-cyan-50 flex items-center justify-center">
              <Globe size={18} className="text-cyan-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">By Geography</h3>
              <p className="text-xs text-gray-400">Call distribution by location</p>
            </div>
          </div>
          {geoData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-400 text-sm">No geographic data</div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, geoData.length * 48)}>
              <BarChart data={geoData.slice(0, 10)} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                  formatter={(value: any) => [value, 'Calls']}
                />
                <Bar dataKey="value" name="Calls" fill="#06B6D4" radius={[0, 6, 6, 0]} barSize={18}>
                  {geoData.slice(0, 10).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
};
