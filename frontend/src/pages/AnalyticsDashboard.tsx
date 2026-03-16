/**
 * Analytics Dashboard - Lead Source Analytics
 * 
 * World-class dashboard showing leads from Widget, Google Ads, JotForms, etc.
 * with beautiful visualizations and hot leads per platform.
 * 
 * PERMANENT FIX (v2): Uses React Query hooks instead of manual useState/useEffect/fetch.
 * This ensures:
 * - Data persists in cache across navigation (no empty skeletons every time)
 * - Each section loads independently (one slow endpoint doesn't block others)
 * - Stale-while-revalidate shows cached data instantly on return
 * - 5-second safety net prevents infinite loading under any condition
 * 
 * @module pages/AnalyticsDashboard
 * @version 2.0.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  BarChart3, Flame,
  Layout, Search, FileText, Globe, Award, Share2,
  ArrowUpRight, ArrowDownRight, Zap, Target, PieChart,
  AlertTriangle, RefreshCw,
} from 'lucide-react';
import { Sidebar } from '../components/dashboard/Sidebar';
import { RefreshButton } from '../components/common/RefreshButton';
import {
  getPlatformGradient,
  getPlatformBgLight,
  type PlatformMetrics,
  type HotLeadPlatform,
} from '../services/sourceAnalytics';
import {
  useSourceOverview,
  useHotLeadsByPlatformQuery,
  useInvalidateSourceAnalytics,
} from '../hooks/useSourceAnalytics';

// Platform icons mapping - All 4 platforms: Widget, Google Ads, Jotform, Referral
const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  Widget: <Layout size={20} />,
  'Google Ads': <Search size={20} />,
  Jotform: <FileText size={20} />,
  Referral: <Share2 size={20} />,
};

// Loading skeleton component
const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-200 rounded-xl ${className}`} />
);

// Platform Card Component
const PlatformCard: React.FC<{
  platform: PlatformMetrics;
  isTopPerforming: boolean;
  onClick?: () => void;
}> = ({ platform, isTopPerforming, onClick }) => {
  const gradient = getPlatformGradient(platform.platform);
  const bgLight = getPlatformBgLight(platform.platform);
  const icon = PLATFORM_ICONS[platform.platform] || <Globe size={20} />;
  const trendUp = platform.trend >= 0;

  return (
    <div
      onClick={onClick}
      className={`
        relative bg-white rounded-2xl border border-gray-100 p-6 
        hover:shadow-lg hover:border-gray-200 transition-all duration-300 cursor-pointer
        ${isTopPerforming ? 'ring-2 ring-amber-400 ring-offset-2' : ''}
      `}
    >
      {/* Top Performing Badge */}
      {isTopPerforming && (
        <div className="absolute -top-3 -right-3 bg-gradient-to-r from-amber-400 to-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-lg">
          <Award size={12} />
          Top Performer
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-lg`}>
            {icon}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{platform.platform}</h3>
            <p className="text-xs text-gray-500">{platform.percentage_of_total.toFixed(1)}% of total</p>
          </div>
        </div>
        <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${trendUp ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
          {trendUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {Math.abs(platform.trend).toFixed(1)}%
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className={`${bgLight} rounded-xl p-3`}>
          <p className="text-2xl font-bold text-gray-900">{platform.total_leads}</p>
          <p className="text-xs text-gray-500">Total Leads</p>
        </div>
        <div className="bg-red-50 rounded-xl p-3">
          <p className="text-2xl font-bold text-red-600">{platform.hot_leads}</p>
          <p className="text-xs text-gray-500">Hot Leads</p>
        </div>
      </div>

      {/* Conversion Stats */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <div className="text-center">
          <p className="text-lg font-semibold text-emerald-600">{platform.conversion_rate}%</p>
          <p className="text-xs text-gray-400">Conversion</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-blue-600">{platform.scheduled_leads}</p>
          <p className="text-xs text-gray-400">Scheduled</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-900">{platform.avg_score}</p>
          <p className="text-xs text-gray-400">Avg Score</p>
        </div>
      </div>
    </div>
  );
};

// Hot Leads by Platform Card
const HotLeadsPlatformCard: React.FC<{ platform: HotLeadPlatform }> = ({ platform }) => {
  const gradient = getPlatformGradient(platform.platform);
  const icon = PLATFORM_ICONS[platform.platform] || <Globe size={16} />;

  return (
    <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-100 hover:shadow-md transition-shadow">
      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center text-white`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-gray-900">{platform.platform}</h4>
          <span className="text-lg font-bold text-red-600">{platform.count}</span>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs text-gray-500">
            <span className="text-emerald-600 font-medium">{platform.converted}</span> converted
          </span>
          <span className="text-xs text-gray-500">
            <span className="text-blue-600 font-medium">{platform.scheduled}</span> scheduled
          </span>
          <span className="text-xs text-gray-500">
            <span className="text-amber-600 font-medium">{platform.new_untouched}</span> new
          </span>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold text-emerald-600">{platform.conversion_rate}%</p>
        <p className="text-xs text-gray-400">conv rate</p>
      </div>
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const AnalyticsDashboard: React.FC = () => {
  const [currentPage, setCurrentPage] = useState('analytics');
  const [daysBack, setDaysBack] = useState(30);

  // =========================================================================
  // React Query hooks — replace manual useState/useEffect/Promise.all
  //
  // Each query fetches independently:
  // - If one endpoint is slow, the others still show data
  // - Cache persists across navigation (no empty skeletons)
  // - placeholderData keeps old data visible during refetch
  // =========================================================================
  const sourceQuery = useSourceOverview(daysBack);
  const hotLeadsQuery = useHotLeadsByPlatformQuery(daysBack);
  const invalidateAll = useInvalidateSourceAnalytics();

  // Derive data from queries
  const sourceData = sourceQuery.data ?? null;
  const hotLeadsData = hotLeadsQuery.data ?? null;

  // Combined loading/refreshing states
  const isAnyFetching = sourceQuery.isFetching || hotLeadsQuery.isFetching;
  const isSourceLoading = sourceQuery.isLoading && !sourceQuery.data;
  const isHotLeadsLoading = hotLeadsQuery.isLoading && !hotLeadsQuery.data;

  // =========================================================================
  // 5-Second Safety Net
  //
  // If the primary query (source overview) is loading with NO cached data
  // for more than 5 seconds, show error state with Retry.
  // =========================================================================
  const [loadingTooLong, setLoadingTooLong] = useState(false);
  const loadTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (isSourceLoading) {
      loadTimerRef.current = setTimeout(() => setLoadingTooLong(true), 5000);
    } else {
      setLoadingTooLong(false);
    }
    return () => {
      if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
    };
  }, [isSourceLoading]);

  // Derive last refresh time from query data
  const lastRefresh = useMemo(() => {
    const timestamps = [
      sourceQuery.dataUpdatedAt,
      hotLeadsQuery.dataUpdatedAt,
    ].filter(t => t > 0);
    return timestamps.length > 0 ? new Date(Math.max(...timestamps)) : new Date();
  }, [sourceQuery.dataUpdatedAt, hotLeadsQuery.dataUpdatedAt]);

  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    return `${Math.floor(diffMins / 60)}h ago`;
  };

  // Handle refresh
  const handleRefresh = () => {
    invalidateAll();
  };

  // Calculate total metrics
  const totals = sourceData?.totals || {
    total_leads: 0, total_hot: 0, total_converted: 0,
    overall_conversion_rate: 0, total_scheduled: 0, platform_count: 0
  };

  // Is the KPI section ready? (has data OR is in error/timeout state)
  const showKpiValues = !!sourceData || loadingTooLong || sourceQuery.isError;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      <Sidebar currentPage={currentPage} onNavigate={(page) => setCurrentPage(page)} />

      <main className="ml-60 p-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-xl shadow-indigo-600/30">
              <BarChart3 size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                Source Analytics
              </h1>
              <p className="text-gray-500">Track lead performance across all platforms</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Period Selector */}
            <select
              value={daysBack}
              onChange={(e) => setDaysBack(Number(e.target.value))}
              className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
              <option value={60}>Last 60 days</option>
              <option value={90}>Last 90 days</option>
            </select>

            <span className="text-xs text-gray-400">Updated: {formatTimeAgo(lastRefresh)}</span>

            <RefreshButton
              onRefresh={() => { handleRefresh(); }}
              isRefreshing={isAnyFetching}
              label="Refresh"
            />
          </div>
        </div>

        {/* Error banner for source overview (primary data) — only when there IS cached data to fall back on */}
        {sourceQuery.isError && sourceData && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertTriangle size={18} className="text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700 flex-1">
              Failed to refresh analytics. Showing cached data.
            </p>
            <button onClick={handleRefresh} className="text-red-600 hover:text-red-800 text-sm font-medium">
              Retry
            </button>
          </div>
        )}

        {/* SAFETY NET: If source overview loading timed out or errored with no cache */}
        {(loadingTooLong || (sourceQuery.isError && !sourceData)) && (
          <div className="mb-8 p-8 bg-white rounded-2xl border border-gray-200 text-center">
            <AlertTriangle size={40} className="mx-auto text-amber-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-700 mb-1">
              {loadingTooLong ? 'Taking too long' : 'Failed to load analytics'}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {loadingTooLong
                ? 'The server is taking longer than expected to respond.'
                : (sourceQuery.error?.message || 'An error occurred while loading analytics data.')}
            </p>
            <button
              onClick={() => {
                setLoadingTooLong(false);
                handleRefresh();
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <RefreshCw size={16} />
              Retry
            </button>
          </div>
        )}

        {/* Only render dashboard sections if NOT in error/timeout state with no data */}
        {!(loadingTooLong && !sourceData) && !(sourceQuery.isError && !sourceData) && (
          <>
            {/* Summary KPI Cards */}
            <div className="grid grid-cols-5 gap-4 mb-8">
              {[
                { label: 'Total Leads', value: totals.total_leads, icon: <Target size={20} />, color: 'from-blue-500 to-blue-600', bg: 'bg-blue-50' },
                { label: 'Hot Leads', value: totals.total_hot, icon: <Flame size={20} />, color: 'from-red-500 to-orange-500', bg: 'bg-red-50' },
                { label: 'Converted', value: totals.total_converted, icon: <Zap size={20} />, color: 'from-emerald-500 to-green-500', bg: 'bg-emerald-50' },
                { label: 'Conversion Rate', value: `${totals.overall_conversion_rate}%`, icon: <PieChart size={20} />, color: 'from-purple-500 to-indigo-500', bg: 'bg-purple-50' },
                { label: 'Platforms', value: totals.platform_count, icon: <Globe size={20} />, color: 'from-amber-500 to-orange-500', bg: 'bg-amber-50' },
              ].map((kpi, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${kpi.color} flex items-center justify-center text-white shadow-lg`}>
                      {kpi.icon}
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-gray-900">
                    {showKpiValues ? kpi.value : '—'}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">{kpi.label}</p>
                </div>
              ))}
            </div>

            {/* Platform Cards */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Leads by Platform</h2>
                {sourceData?.top_performing && (
                  <span className="text-sm text-gray-500">
                    Best performing: <span className="font-semibold text-amber-600">{sourceData.top_performing}</span>
                  </span>
                )}
              </div>

              {isSourceLoading && !loadingTooLong ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                  {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} className="h-64" />)}
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                  {sourceData?.platforms.map((platform) => (
                    <PlatformCard
                      key={platform.platform}
                      platform={platform}
                      isTopPerforming={platform.platform === sourceData?.top_performing}
                    />
                  ))}
                  {/* Show empty state if no platforms */}
                  {(!sourceData?.platforms || sourceData.platforms.length === 0) && (
                    <div className="col-span-4 text-center py-12 text-gray-400">
                      No platform data available for the selected period
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-2 gap-8">
              {/* Hot Leads by Platform */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white shadow-lg">
                      <Flame size={20} />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">Hot Leads by Platform</h2>
                      <p className="text-xs text-gray-500">{hotLeadsData?.total_hot_leads || 0} total hot leads</p>
                    </div>
                  </div>
                </div>

                {isHotLeadsLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} className="h-16" />)}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {hotLeadsData?.platforms.map((platform) => (
                      <HotLeadsPlatformCard key={platform.platform} platform={platform} />
                    ))}
                    {hotLeadsData?.platforms.length === 0 && (
                      <p className="text-center text-gray-400 py-8">No hot leads yet</p>
                    )}
                    {!hotLeadsData && hotLeadsQuery.isError && (
                      <div className="text-center py-8">
                        <p className="text-gray-400 mb-2">Failed to load hot leads data</p>
                        <button
                          onClick={() => { hotLeadsQuery.refetch(); }}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Retry
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Source Performance */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-lg">
                      <Target size={20} />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">Source Performance</h2>
                      <p className="text-xs text-gray-500">
                        {sourceData?.top_performing
                          ? `Top channel: ${sourceData.top_performing}`
                          : 'Lead intake by channel'}
                      </p>
                    </div>
                  </div>
                </div>

                {isSourceLoading && !loadingTooLong ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} className="h-[68px]" />)}
                  </div>
                ) : sourceData?.platforms && sourceData.platforms.length > 0 ? (
                  <div className="space-y-2">
                    {sourceData.platforms.map((platform) => {
                      const gradient = getPlatformGradient(platform.platform);
                      const icon = PLATFORM_ICONS[platform.platform] || <Globe size={16} />;
                      const isTop = platform.platform === sourceData?.top_performing;
                      return (
                        <div
                          key={platform.platform}
                          className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${isTop
                            ? 'border-amber-200 bg-amber-50/40'
                            : 'border-gray-100 bg-gray-50/40 hover:bg-gray-50'
                            }`}
                        >
                          <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center text-white flex-shrink-0`}>
                            {icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-semibold text-gray-900">{platform.platform}</span>
                                {isTop && <Award size={12} className="text-amber-500" />}
                              </div>
                              <span className="text-base font-bold text-gray-900">{platform.total_leads} leads</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-gray-500">
                                <span className="text-red-600 font-semibold">{platform.hot_leads}</span> hot
                              </span>
                              <span className="text-xs text-gray-500">
                                <span className="text-emerald-600 font-semibold">{platform.conversion_rate}%</span> conv
                              </span>
                              <span className="text-xs text-gray-500">
                                <span className="text-blue-600 font-semibold">{platform.avg_score}</span> avg score
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center text-gray-400 py-8">No source data available</p>
                )}
              </div>
            </div>

            {/* Performance Insights — dynamic */}
            <div className="mt-8 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm flex-shrink-0">
                  <BarChart3 size={20} className="text-indigo-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-indigo-900">Analytics Insights</h4>
                  <p className="text-sm text-indigo-700 mt-1">
                    {sourceData?.top_performing && totals.total_leads > 0 ? (
                      <>
                        <strong>{sourceData.top_performing}</strong> is your top-performing channel
                        {(() => {
                          const top = sourceData.platforms.find(p => p.platform === sourceData.top_performing);
                          return top
                            ? ` with a ${top.conversion_rate}% conversion rate and ${top.hot_leads} hot lead${top.hot_leads !== 1 ? 's' : ''}.`
                            : '.';
                        })()}
                        {totals.total_hot > 0
                          ? ` You currently have ${totals.total_hot} hot lead${totals.total_hot !== 1 ? 's' : ''} across all platforms requiring immediate attention.`
                          : ' Keep building your pipeline — hot leads will appear as new intake comes in.'}
                      </>
                    ) : (
                      'Track lead sources to optimize your marketing spend. Focus on platforms with high conversion rates and hot lead generation. The Widget captures direct website traffic, Google Ads drives paid search, Jotform handles form submissions, and Referral tracks partner/word-of-mouth leads.'
                    )}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default AnalyticsDashboard;
