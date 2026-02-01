/**
 * CallAnalyticsDashboard — Main page shell for CallRail Call Analytics
 *
 * Features:
 * - Header with date range selector and refresh button
 * - 5 metric cards with count-up animations
 * - 3 tabs: Activity, All Calls, Attribution Reports
 * - Sidebar navigation integration
 * - HIPAA compliance badge
 * - Skeleton loading states throughout
 *
 * @module pages/CallAnalyticsDashboard
 * @version 1.0.0
 */

import React, { useState, useCallback } from 'react';
import { Phone, RefreshCw, Calendar, Shield, ChevronDown } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Sidebar } from '../components/dashboard/Sidebar';
import { CallMetricsCards } from '../components/call-analytics/CallMetricsCards';
import { CallActivityTab } from '../components/call-analytics/CallActivityTab';
import { CallsTableTab } from '../components/call-analytics/CallsTableTab';
import { CallAttributionTab } from '../components/call-analytics/CallAttributionTab';
import { useSummary, useCalls, useTimeseries, useAttribution } from '../hooks/useCallRailData';
import type { DateRangeType } from '../services/callrail';

// =============================================================================
// Types
// =============================================================================

type TabType = 'activity' | 'calls' | 'attribution';

const DATE_RANGE_OPTIONS: { value: DateRangeType; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7days', label: 'Last 7 Days' },
  { value: '30days', label: 'Last 30 Days' },
  { value: '90days', label: 'Last 90 Days' },
];

const TAB_ITEMS: { key: TabType; label: string }[] = [
  { key: 'activity', label: 'Activity' },
  { key: 'calls', label: 'All Calls' },
  { key: 'attribution', label: 'Attribution Reports' },
];

// =============================================================================
// Component
// =============================================================================

const CallAnalyticsDashboard: React.FC = () => {
  const [currentPage] = useState('call-analytics');
  const [dateRange, setDateRange] = useState<DateRangeType>('30days');
  const [activeTab, setActiveTab] = useState<TabType>('activity');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();

  // Data hooks
  const summaryQuery = useSummary(dateRange);
  const callsQuery = useCalls({ dateRange, perPage: 25 });
  const timeseriesQuery = useTimeseries(dateRange);
  const attributionQuery = useAttribution(dateRange);

  // Navigation handler
  const handleNavigate = useCallback((page: string) => {
    window.location.hash = page;
  }, []);

  // Refresh all data
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['callrail'] });
    setTimeout(() => setIsRefreshing(false), 600);
  }, [queryClient]);

  // Date range label for display
  const dateRangeLabel = DATE_RANGE_OPTIONS.find(o => o.value === dateRange)?.label || 'Last 30 Days';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      <Sidebar currentPage={currentPage} onNavigate={handleNavigate} />

      <main className="ml-60 p-8">
        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Phone size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Call Analytics</h1>
              <p className="text-sm text-gray-500">
                Live call data from CallRail · {dateRangeLabel}
              </p>
            </div>
            {/* HIPAA badge */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full ml-2">
              <Shield size={13} className="text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-700">HIPAA Compliant</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Date Range Selector */}
            <div className="relative">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as DateRangeType)}
                className="appearance-none pl-10 pr-9 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 cursor-pointer hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              >
                {DATE_RANGE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* ── Metric Cards ── */}
        <CallMetricsCards data={summaryQuery.data} isLoading={summaryQuery.isLoading} />

        {/* ── Tabs ── */}
        <div className="mb-6">
          <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl w-fit">
            {TAB_ITEMS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.key
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab Content ── */}
        <div className="min-h-[400px]">
          {activeTab === 'activity' && (
            <CallActivityTab
              data={callsQuery.data}
              isLoading={callsQuery.isLoading}
            />
          )}

          {activeTab === 'calls' && (
            <CallsTableTab dateRange={dateRange} />
          )}

          {activeTab === 'attribution' && (
            <CallAttributionTab
              timeseriesData={timeseriesQuery.data}
              attributionData={attributionQuery.data}
              isLoading={timeseriesQuery.isLoading || attributionQuery.isLoading}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default CallAnalyticsDashboard;
