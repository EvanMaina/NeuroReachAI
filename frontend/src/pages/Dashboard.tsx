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
import { Activity, Zap, Clock, TrendingUp } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sidebar } from '../components/dashboard/Sidebar';
import { MainKPICards } from '../components/dashboard/MainKPICards';
import { LeadingConditionsCard } from '../components/dashboard/LeadingConditionsCard';
import { TMSTherapyInterestCard } from '../components/dashboard/TMSTherapyInterestCard';
import { LeadsTrendChart } from '../components/dashboard/LeadsTrendChart';
import { CohortRetentionAnalysis } from '../components/dashboard/CohortRetentionAnalysis';
import { LeadsFilterModal } from '../components/dashboard/LeadsFilterModal';
import { KPICardSkeleton } from '../components/common/SkeletonLoader';
import { RefreshButton } from '../components/common/RefreshButton';
import {
  getDashboardSummary,
  getConditionsDistribution,
  getCohortRetention,
  getTMSInterestDistribution,
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
  tmsDistribution: ['analytics', 'tms-distribution'] as const,
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

  // TMS therapy interest distribution - CRITICAL: placeholderData prevents data disappearing
  const {
    data: tmsData,
    isLoading: isLoadingTMS,
  } = useQuery({
    queryKey: QUERY_KEYS.tmsDistribution,
    queryFn: () => getTMSInterestDistribution(),
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

    // PHASE 5B FIX: Filter out zero-size cohorts (empty ghost months Sep–Jan).
    // Backend returns 6 months of buckets even when only 1 has data.
    // Averaging 180 leads across 6 buckets shows "Avg Size: 30" — wrong.
    // Filtering to only months with actual leads shows "Avg Size: 180" — correct.
    return cohortData.cohorts
      .filter(c => c.cohort_size > 0)
      .map(c => ({
        cohort: c.cohort,
        cohortSize: c.cohort_size,
        periods: c.periods,
      }));
  }, [cohortData]);

  const cohortPeriodLabels = useMemo(() => {
    return cohortData?.period_labels || ['Initial', 'Contacted', 'Scheduled', 'Completed', 'Active', 'Retained'];
  }, [cohortData]);

  const transformedTMSData = useMemo(() => {
    if (!tmsData?.interests) return [];

    // -------------------------------------------------------------------------
    // Display-only mapping: merge any legacy/deprecated DB interest types into
    // `accelerated_tms` so they render correctly instead of showing "Unknown".
    // No database changes, no scoring changes — purely a label normalisation.
    // -------------------------------------------------------------------------
    // Valid current interest types — anything not in this set is legacy and
    // gets merged into accelerated_tms for display purposes only.
    const VALID_INTEREST_TYPES = new Set(['daily_tms', 'accelerated_tms', 'not_sure']);
    const totalWithInterest = tmsData.total_with_interest || 1;
    const mergedMap = new Map<string, { count: number; trend?: number }>();

    for (const i of tmsData.interests) {
      // Any type not in the current valid set is a legacy/deprecated DB value
      const isLegacy = !VALID_INTEREST_TYPES.has(i.interest_type);
      const displayType = isLegacy ? 'accelerated_tms' : i.interest_type;
      const existing = mergedMap.get(displayType);
      if (existing) {
        existing.count += i.count;
        // Keep the trend from the primary (non-legacy) entry if both exist
        if (!isLegacy) {
          existing.trend = i.trend;
        }
      } else {
        mergedMap.set(displayType, { count: i.count, trend: i.trend });
      }
    }

    return Array.from(mergedMap.entries()).map(([type, data]) => ({
      interestType: type,
      count: data.count,
      percentage: totalWithInterest > 0 ? (data.count / totalWithInterest) * 100 : 0,
      trend: data.trend,
    }));
  }, [tmsData]);

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
            <RefreshButton
              onRefresh={handleRefresh}
              isRefreshing={isFetchingSummary}
              label="Refresh"
            />
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

        {/* TMS Therapy Interest Distribution */}
        <div className="mb-8">
          <TMSTherapyInterestCard
            interests={transformedTMSData}
            totalWithInterest={tmsData?.total_with_interest || 0}
            totalLeads={tmsData?.total_leads || 0}
            isLoading={isLoadingTMS}
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

      </main>

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
