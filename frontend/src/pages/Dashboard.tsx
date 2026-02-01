/**
 * Dashboard Page (Analytics Only)
 * 
 * PERFORMANCE OPTIMIZED:
 * - Uses React Query for caching and background refetching
 * - Fetches from optimized analytics API endpoints
 * - Memoized components and calculations
 * - Proper loading states with skeleton loaders
 * 
 * @module pages/Dashboard
 * @version 5.0.0 - Performance Optimized
 */

import React, { useState, useCallback, memo, useMemo } from 'react';
import { Activity, RefreshCw, Zap, Clock, TrendingUp } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sidebar } from '../components/dashboard/Sidebar';
import { MainKPICards } from '../components/dashboard/MainKPICards';
import { LeadingConditionsCard } from '../components/dashboard/LeadingConditionsCard';
import { LeadsTrendChart } from '../components/dashboard/LeadsTrendChart';
import { CohortRetentionAnalysis } from '../components/dashboard/CohortRetentionAnalysis';
import { LeadsFilterModal } from '../components/dashboard/LeadsFilterModal';
import { WidgetTester } from '../components/dashboard/WidgetTester';
import { KPICardSkeleton } from '../components/common/SkeletonLoader';
import {
  getDashboardSummary,
  getConditionsDistribution,
  getCohortRetention,
} from '../services/analytics';
import type { LeadTableRow, ConditionType } from '../types/lead';
import type { StatsFilterType } from '../types/analytics';

// =============================================================================
// Types
// =============================================================================

interface ConditionData {
  condition: ConditionType;
  count: number;
  percentage: number;
  trend?: number;
}

interface CohortData {
  cohort: string;
  cohortSize: number;
  periods: number[];
}

// =============================================================================
// Query Keys (for cache management)
// =============================================================================

const QUERY_KEYS = {
  dashboardSummary: ['analytics', 'dashboard-summary'] as const,
  conditionsDistribution: ['analytics', 'conditions-distribution'] as const,
  cohortRetention: (months: number) => ['analytics', 'cohort-retention', months] as const,
};

// =============================================================================
// Memoized Sub-Components
// =============================================================================

interface PerformanceIndicatorProps {
  cacheHit: boolean;
  queryTimeMs: number;
}

const PerformanceIndicator = memo<PerformanceIndicatorProps>(({ cacheHit, queryTimeMs }) => (
  <div className="flex items-center gap-2 text-xs text-gray-500">
    {cacheHit ? (
      <span className="flex items-center gap-1 text-green-600">
        <Zap size={12} />
        Cached
      </span>
    ) : (
      <span className="flex items-center gap-1">
        <Clock size={12} />
        {queryTimeMs.toFixed(0)}ms
      </span>
    )}
  </div>
));
PerformanceIndicator.displayName = 'PerformanceIndicator';

// =============================================================================
// Main Component
// =============================================================================

export const Dashboard: React.FC = () => {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  
  const [currentPage, setCurrentPage] = useState('dashboard');
  const queryClient = useQueryClient();
  
  // Filter modal states
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<StatsFilterType | null>(null);
  const [filteredLeads, setFilteredLeads] = useState<LeadTableRow[]>([]);
  const [isLoadingFiltered, setIsLoadingFiltered] = useState(false);

  // ---------------------------------------------------------------------------
  // React Query Hooks - Optimized Data Fetching with Caching
  // ---------------------------------------------------------------------------

  // Dashboard summary (KPIs) - CRITICAL: placeholderData prevents data disappearing
  const {
    data: summaryData,
    isLoading: isLoadingSummary,
    isFetching: isFetchingSummary,
  } = useQuery({
    queryKey: QUERY_KEYS.dashboardSummary,
    queryFn: () => getDashboardSummary(365),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    placeholderData: (previousData) => previousData,
  });

  // Conditions distribution - CRITICAL: placeholderData prevents data disappearing
  const {
    data: conditionsData,
    isLoading: isLoadingConditions,
  } = useQuery({
    queryKey: QUERY_KEYS.conditionsDistribution,
    queryFn: () => getConditionsDistribution(),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    placeholderData: (previousData) => previousData,
  });

  // Cohort retention - CRITICAL: placeholderData prevents data disappearing
  const {
    data: cohortData,
    isLoading: isLoadingCohort,
  } = useQuery({
    queryKey: QUERY_KEYS.cohortRetention(6),
    queryFn: () => getCohortRetention(6),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    placeholderData: (previousData) => previousData,
  });

  // ---------------------------------------------------------------------------
  // Memoized Transformed Data
  // ---------------------------------------------------------------------------

  const kpiStats = useMemo(() => {
    if (!summaryData) {
      return {
        totalLeads: 0,
        convertedLeads: 0,
        conversionRate: 0,
        scheduledAppointments: 0,
        trends: {
          totalLeads: 0,
          convertedLeads: 0,
          conversionRate: 0,
          scheduledAppointments: 0,
        },
      };
    }

    return {
      totalLeads: summaryData.total_leads,
      convertedLeads: summaryData.converted_leads,
      conversionRate: summaryData.conversion_rate,
      scheduledAppointments: summaryData.scheduled_appointments,
      trends: {
        totalLeads: summaryData.trends.total_leads,
        convertedLeads: summaryData.trends.converted_leads,
        conversionRate: summaryData.trends.conversion_rate,
        scheduledAppointments: summaryData.trends.scheduled_appointments,
      },
    };
  }, [summaryData]);

  const transformedConditionData = useMemo((): ConditionData[] => {
    if (!conditionsData?.conditions) return [];
    
    return conditionsData.conditions.map(c => ({
      condition: c.condition as ConditionType,
      count: c.count,
      percentage: c.percentage,
      trend: c.trend,
    }));
  }, [conditionsData]);

  const transformedCohortData = useMemo((): CohortData[] => {
    if (!cohortData?.cohorts) return [];
    
    return cohortData.cohorts.map(c => ({
      cohort: c.cohort,
      cohortSize: c.cohort_size,
      periods: c.periods,
    }));
  }, [cohortData]);

  const cohortPeriodLabels = useMemo(() => {
    return cohortData?.period_labels || ['Initial', 'Contacted', 'Scheduled', 'Completed', 'Active', 'Retained'];
  }, [cohortData]);

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  const handleNavigate = useCallback((page: string): void => {
    setCurrentPage(page);
  }, []);

  // ---------------------------------------------------------------------------
  // Refresh Handler
  // ---------------------------------------------------------------------------

  const handleRefresh = useCallback(async () => {
    // Invalidate all analytics queries to force refetch
    await queryClient.invalidateQueries({ queryKey: ['analytics'] });
  }, [queryClient]);

  // ---------------------------------------------------------------------------
  // KPI Card Click Handlers
  // ---------------------------------------------------------------------------

  const handleKPICardClick = useCallback((type: 'total' | 'converted' | 'rate' | 'scheduled'): void => {
    let filterType: StatsFilterType;
    
    switch (type) {
      case 'total':
        filterType = 'all';
        break;
      case 'converted':
      case 'rate':
        filterType = 'converted';
        break;
      case 'scheduled':
        filterType = 'converted';
        break;
      default:
        filterType = 'all';
    }
    
    setActiveFilter(filterType);
    setFilterModalOpen(true);
    setIsLoadingFiltered(true);
    
    // Simulate loading - in production, fetch filtered leads from API
    setTimeout(() => {
      setFilteredLeads([]);
      setIsLoadingFiltered(false);
    }, 300);
  }, []);

  // ---------------------------------------------------------------------------
  // Modal Close Handlers
  // ---------------------------------------------------------------------------

  const handleCloseFilter = useCallback((): void => {
    setFilterModalOpen(false);
    setActiveFilter(null);
  }, []);

  const handleViewFromFilter = useCallback((id: string): void => {
    setFilterModalOpen(false);
    window.location.href = `/coordinator?lead=${id}`;
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Sidebar */}
      <Sidebar currentPage={currentPage} onNavigate={handleNavigate} />

      {/* Main Content */}
      <main className="ml-60 p-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-600/30">
              <Activity size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
              <p className="text-gray-500 text-sm">Lead analytics and performance metrics overview</p>
            </div>
          </div>
          
          {/* Refresh button with performance indicator */}
          <div className="flex items-center gap-3">
            {summaryData && (
              <PerformanceIndicator
                cacheHit={summaryData.cache_hit}
                queryTimeMs={summaryData.query_time_ms}
              />
            )}
            <button
              onClick={handleRefresh}
              disabled={isFetchingSummary}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={isFetchingSummary ? 'animate-spin' : ''} />
              <span className="text-sm font-medium">Refresh</span>
            </button>
          </div>
        </div>

        {/* Performance Banner (when all data is cached) */}
        {summaryData?.cache_hit && conditionsData?.cache_hit && cohortData?.cache_hit && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
            <div className="flex items-center gap-2 text-green-700 text-sm">
              <TrendingUp size={16} />
              <span className="font-medium">High Performance Mode</span>
              <span className="text-green-600">— All data served from cache for instant loading</span>
            </div>
          </div>
        )}

        {/* Main KPI Cards - Show cached data immediately, only skeleton on first load */}
        {isLoadingSummary && !summaryData ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <KPICardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <MainKPICards
            totalLeads={kpiStats.totalLeads}
            convertedLeads={kpiStats.convertedLeads}
            conversionRate={kpiStats.conversionRate}
            scheduledAppointments={kpiStats.scheduledAppointments}
            trends={kpiStats.trends}
            onCardClick={handleKPICardClick}
          />
        )}

        {/* Charts Row - Trend and Conditions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Leads Trend Chart - Self-contained with own data fetching */}
          <LeadsTrendChart
            title="Leads Trend"
            subtitle="Daily and monthly lead volume"
          />

          {/* Leading Conditions */}
          <LeadingConditionsCard
            conditions={transformedConditionData}
            totalLeads={conditionsData?.total_leads || 0}
            isLoading={isLoadingConditions}
          />
        </div>

        {/* Cohort Retention Analysis */}
        <div className="mb-8">
          <CohortRetentionAnalysis
            data={transformedCohortData}
            periodLabels={cohortPeriodLabels}
            title="Monthly Cohort Retention Analysis"
            subtitle="Track lead progression and retention on a monthly basis"
            isLoading={isLoadingCohort}
          />
        </div>

        {/* Analytics Summary Note */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Activity size={16} className="text-blue-600" />
            </div>
            <div>
              <h4 className="font-medium text-blue-900">Lead Management</h4>
              <p className="text-sm text-blue-700 mt-1">
                For detailed lead management and pipeline operations, visit the{' '}
                <a href="/coordinator" className="underline font-medium hover:text-blue-900">
                  Coordinator Dashboard
                </a>
                . The Coordinator Dashboard includes queue-based management, Kanban board, and lead detail panels.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Widget Tester Panel */}
      <WidgetTester />

      {/* Leads Filter Modal */}
      <LeadsFilterModal
        isOpen={filterModalOpen}
        onClose={handleCloseFilter}
        filterType={activeFilter || 'all'}
        leads={filteredLeads}
        isLoading={isLoadingFiltered}
        onViewLead={handleViewFromFilter}
      />
    </div>
  );
};

export default Dashboard;
