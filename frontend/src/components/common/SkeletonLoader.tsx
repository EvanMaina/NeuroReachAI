/**
 * Skeleton Loader Components
 * 
 * Provides loading placeholders for better perceived performance.
 * Uses CSS animations for smooth loading experience.
 * 
 * @module components/common/SkeletonLoader
 */

import React from 'react';
import clsx from 'clsx';

// =============================================================================
// Base Skeleton
// =============================================================================

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full';
}

/**
 * Base skeleton component with shimmer animation.
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  width,
  height,
  rounded = 'md',
}) => {
  const roundedClasses = {
    none: '',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full',
  };
  
  return (
    <div
      className={clsx(
        'animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200',
        'bg-[length:200%_100%]',
        roundedClasses[rounded],
        className
      )}
      style={{ width, height }}
    />
  );
};

// =============================================================================
// KPI Card Skeleton
// =============================================================================

/**
 * Skeleton for KPI/Stats cards.
 */
export const KPICardSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={clsx('bg-white rounded-xl p-6 shadow-sm border border-gray-100', className)}>
    <div className="flex items-center justify-between mb-4">
      <Skeleton className="w-10 h-10" rounded="lg" />
      <Skeleton className="w-16 h-6" rounded="full" />
    </div>
    <Skeleton className="w-24 h-8 mb-2" />
    <Skeleton className="w-32 h-4" />
  </div>
);

/**
 * Grid of KPI card skeletons.
 */
export const KPICardsGridSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
    {Array.from({ length: count }).map((_, i) => (
      <KPICardSkeleton key={i} />
    ))}
  </div>
);

// =============================================================================
// Chart Skeleton
// =============================================================================

/**
 * Skeleton for chart components.
 */
export const ChartSkeleton: React.FC<{ 
  className?: string;
  height?: number;
}> = ({ 
  className,
  height = 300,
}) => (
  <div className={clsx('bg-white rounded-xl p-6 shadow-sm border border-gray-100', className)}>
    <div className="flex items-center justify-between mb-6">
      <div>
        <Skeleton className="w-40 h-6 mb-2" />
        <Skeleton className="w-24 h-4" />
      </div>
      <Skeleton className="w-24 h-8" rounded="lg" />
    </div>
    <div style={{ height }} className="flex items-end justify-between gap-2 px-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <Skeleton
          key={i}
          className="flex-1"
          height={`${Math.random() * 60 + 20}%`}
          rounded="sm"
        />
      ))}
    </div>
  </div>
);

// =============================================================================
// Conditions Card Skeleton
// =============================================================================

/**
 * Skeleton for conditions distribution card.
 */
export const ConditionsCardSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={clsx('bg-white rounded-xl p-6 shadow-sm border border-gray-100', className)}>
    <div className="flex items-center justify-between mb-6">
      <div>
        <Skeleton className="w-40 h-6 mb-2" />
        <Skeleton className="w-24 h-4" />
      </div>
    </div>
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="w-3 h-3" rounded="full" />
          <div className="flex-1">
            <div className="flex justify-between mb-1">
              <Skeleton className="w-24 h-4" />
              <Skeleton className="w-16 h-4" />
            </div>
            <Skeleton className="w-full h-2" rounded="full" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

// =============================================================================
// Cohort Table Skeleton
// =============================================================================

/**
 * Skeleton for cohort retention table.
 */
export const CohortTableSkeleton: React.FC<{ 
  className?: string;
  rows?: number;
  cols?: number;
}> = ({ 
  className,
  rows = 6,
  cols = 7,
}) => (
  <div className={clsx('bg-white rounded-xl p-6 shadow-sm border border-gray-100', className)}>
    <div className="flex items-center justify-between mb-6">
      <div>
        <Skeleton className="w-48 h-6 mb-2" />
        <Skeleton className="w-64 h-4" />
      </div>
      <Skeleton className="w-32 h-8" rounded="lg" />
    </div>
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="px-3 py-2">
                <Skeleton className="w-16 h-4 mx-auto" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <tr key={rowIdx}>
              {Array.from({ length: cols }).map((_, colIdx) => (
                <td key={colIdx} className="px-3 py-2">
                  <Skeleton className="w-12 h-6 mx-auto" rounded="sm" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// =============================================================================
// Lead Row Skeleton
// =============================================================================

/**
 * Skeleton for a single lead row in a table.
 */
export const LeadRowSkeleton: React.FC = () => (
  <tr className="border-b border-gray-100">
    <td className="px-4 py-3">
      <Skeleton className="w-24 h-4" />
    </td>
    <td className="px-4 py-3">
      <Skeleton className="w-32 h-4" />
    </td>
    <td className="px-4 py-3">
      <Skeleton className="w-20 h-6" rounded="full" />
    </td>
    <td className="px-4 py-3">
      <Skeleton className="w-16 h-6" rounded="full" />
    </td>
    <td className="px-4 py-3">
      <Skeleton className="w-24 h-6" rounded="full" />
    </td>
    <td className="px-4 py-3">
      <Skeleton className="w-28 h-4" />
    </td>
    <td className="px-4 py-3">
      <div className="flex gap-2">
        <Skeleton className="w-8 h-8" rounded="lg" />
        <Skeleton className="w-8 h-8" rounded="lg" />
      </div>
    </td>
  </tr>
);

/**
 * Skeleton for leads table.
 */
export const LeadsTableSkeleton: React.FC<{ rows?: number }> = ({ rows = 10 }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
    <div className="p-4 border-b border-gray-100">
      <div className="flex items-center justify-between">
        <Skeleton className="w-40 h-6" />
        <div className="flex gap-2">
          <Skeleton className="w-24 h-9" rounded="lg" />
          <Skeleton className="w-24 h-9" rounded="lg" />
        </div>
      </div>
    </div>
    <table className="w-full">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-4 py-3 text-left"><Skeleton className="w-16 h-4" /></th>
          <th className="px-4 py-3 text-left"><Skeleton className="w-20 h-4" /></th>
          <th className="px-4 py-3 text-left"><Skeleton className="w-20 h-4" /></th>
          <th className="px-4 py-3 text-left"><Skeleton className="w-16 h-4" /></th>
          <th className="px-4 py-3 text-left"><Skeleton className="w-16 h-4" /></th>
          <th className="px-4 py-3 text-left"><Skeleton className="w-20 h-4" /></th>
          <th className="px-4 py-3 text-left"><Skeleton className="w-16 h-4" /></th>
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, i) => (
          <LeadRowSkeleton key={i} />
        ))}
      </tbody>
    </table>
  </div>
);

// =============================================================================
// Full Dashboard Skeleton
// =============================================================================

/**
 * Complete dashboard skeleton for initial load.
 */
export const DashboardSkeleton: React.FC = () => (
  <div className="space-y-8">
    {/* KPI Cards */}
    <KPICardsGridSkeleton count={4} />
    
    {/* Charts Row */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <ChartSkeleton />
      <ConditionsCardSkeleton />
    </div>
    
    {/* Cohort Table */}
    <CohortTableSkeleton />
  </div>
);

export default {
  Skeleton,
  KPICardSkeleton,
  KPICardsGridSkeleton,
  ChartSkeleton,
  ConditionsCardSkeleton,
  CohortTableSkeleton,
  LeadRowSkeleton,
  LeadsTableSkeleton,
  DashboardSkeleton,
};
