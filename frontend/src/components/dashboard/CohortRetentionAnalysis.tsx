/**
 * Cohort Retention Analysis Component
 * 
 * Enhanced cohort analysis showing monthly lead progression with:
 * - Initial leads per cohort (month)
 * - Contact rate, Schedule rate, Completion rate
 * - Lost leads tracking per month
 * - Winback tracking (re-engaged leads)
 * - Toggle between absolute counts and percentages
 * 
 * @module components/dashboard/CohortRetentionAnalysis
 */

import React, { useState, useMemo } from 'react';
import {
  Users,
  Percent,
  Hash,
  Info,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Award,
} from 'lucide-react';

interface CohortData {
  cohort: string; // e.g., "Jan 2026"
  cohortSize: number;
  periods: number[]; // Retention values for each period
  lost?: number; // Number of lost leads
  winbacks?: number; // Number of re-engaged leads
}

interface CohortRetentionAnalysisProps {
  data: CohortData[];
  periodLabels?: string[];
  title?: string;
  subtitle?: string;
  isLoading?: boolean;
}

type DisplayMode = 'percentage' | 'absolute';

/**
 * Get color intensity based on retention percentage
 */
const getRetentionColor = (percentage: number): string => {
  if (percentage >= 80) return 'bg-emerald-500 text-white';
  if (percentage >= 60) return 'bg-emerald-400 text-white';
  if (percentage >= 40) return 'bg-emerald-300 text-emerald-900';
  if (percentage >= 20) return 'bg-emerald-200 text-emerald-800';
  if (percentage > 0) return 'bg-emerald-100 text-emerald-700';
  return 'bg-gray-50 text-gray-400';
};

/**
 * Get loss color based on percentage lost
 */
const getLossColor = (percentage: number): string => {
  if (percentage >= 50) return 'bg-red-500 text-white';
  if (percentage >= 30) return 'bg-red-400 text-white';
  if (percentage >= 15) return 'bg-red-200 text-red-800';
  if (percentage > 0) return 'bg-red-100 text-red-700';
  return 'bg-gray-50 text-gray-400';
};

export const CohortRetentionAnalysis: React.FC<CohortRetentionAnalysisProps> = ({
  data,
  periodLabels = ['Initial', 'Contacted', 'Scheduled', 'Completed', 'Active', 'Retained'],
  title = 'Monthly Cohort Retention Analysis',
  subtitle = 'Track lead progression and retention by monthly cohort',
  isLoading = false,
}) => {
  const [displayMode, setDisplayMode] = useState<DisplayMode>('percentage');
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);
  const [showLostColumn, setShowLostColumn] = useState(true);

  // Calculate percentages and lost metrics from absolute values
  const processedData = useMemo(() => {
    return data.map((cohort) => {
      const percentages = cohort.periods.map((value) =>
        cohort.cohortSize > 0 ? (value / cohort.cohortSize) * 100 : 0
      );
      
      // Calculate lost leads (Initial - last period that has data)
      const lastValue = cohort.periods[cohort.periods.length - 1] || 0;
      const lostCount = cohort.lost ?? Math.max(0, cohort.cohortSize - lastValue);
      const lostPercentage = cohort.cohortSize > 0 ? (lostCount / cohort.cohortSize) * 100 : 0;
      
      // Winbacks
      const winbackCount = cohort.winbacks ?? 0;
      const winbackPercentage = lostCount > 0 ? (winbackCount / lostCount) * 100 : 0;
      
      return {
        ...cohort,
        percentages,
        lostCount,
        lostPercentage,
        winbackCount,
        winbackPercentage,
      };
    });
  }, [data]);

  // Calculate average retention per period
  const averageRetention = useMemo(() => {
    if (processedData.length === 0) return [];
    
    const maxPeriods = Math.max(...processedData.map((d) => d.percentages.length));
    return Array.from({ length: maxPeriods }, (_, i) => {
      const validValues = processedData
        .filter((d) => d.percentages[i] !== undefined)
        .map((d) => d.percentages[i]);
      return validValues.length > 0
        ? validValues.reduce((a, b) => a + b, 0) / validValues.length
        : 0;
    });
  }, [processedData]);

  // Calculate average lost
  const averageLost = useMemo(() => {
    if (processedData.length === 0) return { count: 0, percentage: 0 };
    const totalLost = processedData.reduce((a, b) => a + b.lostCount, 0);
    const totalSize = processedData.reduce((a, b) => a + b.cohortSize, 0);
    return {
      count: Math.round(totalLost / processedData.length),
      percentage: totalSize > 0 ? (totalLost / totalSize) * 100 : 0,
    };
  }, [processedData]);

  // Summary stats
  const summaryStats = useMemo(() => {
    if (processedData.length === 0) {
      return { 
        totalCohorts: 0, 
        avgInitialSize: 0, 
        avgRetention30: 0, 
        totalLost: 0,
        lossRate: 0,
        totalWinbacks: 0,
      };
    }
    
    const totalCohorts = processedData.length;
    const avgInitialSize = Math.round(
      processedData.reduce((a, b) => a + b.cohortSize, 0) / totalCohorts
    );
    
    // Find the "Completed" index (or use index 3)
    const completedIndex = periodLabels.findIndex((l) => l.toLowerCase().includes('completed'));
    const retentionIndex = completedIndex >= 0 ? completedIndex : Math.min(3, averageRetention.length - 1);
    const avgRetention30 = averageRetention[retentionIndex] ?? 0;
    
    const totalLost = processedData.reduce((a, b) => a + b.lostCount, 0);
    const totalSize = processedData.reduce((a, b) => a + b.cohortSize, 0);
    const lossRate = totalSize > 0 ? (totalLost / totalSize) * 100 : 0;
    const totalWinbacks = processedData.reduce((a, b) => a + b.winbackCount, 0);

    return { totalCohorts, avgInitialSize, avgRetention30, totalLost, lossRate, totalWinbacks };
  }, [processedData, averageRetention, periodLabels]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="animate-pulse">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="h-6 bg-gray-200 rounded w-48 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-64" />
            </div>
            <div className="flex gap-2">
              <div className="h-10 bg-gray-200 rounded w-24" />
              <div className="h-10 bg-gray-200 rounded w-24" />
            </div>
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-gray-100 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-100 text-purple-600">
            <Users size={20} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500">{subtitle}</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {/* Lost column toggle */}
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showLostColumn}
              onChange={(e) => setShowLostColumn(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            Show Lost
          </label>
          
          {/* Display Mode Toggle */}
          <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
            <button
              onClick={() => setDisplayMode('percentage')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                displayMode === 'percentage'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Percent size={14} />
              <span className="hidden sm:inline">%</span>
            </button>
            <button
              onClick={() => setDisplayMode('absolute')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                displayMode === 'absolute'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Hash size={14} />
              <span className="hidden sm:inline">#</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className="text-xl font-bold text-gray-900">
            {summaryStats.totalCohorts}
          </div>
          <div className="text-xs text-gray-500">Cohorts</div>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className="text-xl font-bold text-gray-900">
            {summaryStats.avgInitialSize.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500">Avg Size</div>
        </div>
        <div className="text-center p-3 bg-emerald-50 rounded-lg">
          <div className="flex items-center justify-center gap-1">
            <div className="text-xl font-bold text-emerald-600">
              {summaryStats.avgRetention30.toFixed(1)}%
            </div>
            <TrendingUp size={14} className="text-emerald-500" />
          </div>
          <div className="text-xs text-gray-500">Completion Rate</div>
        </div>
        <div className="text-center p-3 bg-red-50 rounded-lg">
          <div className="flex items-center justify-center gap-1">
            <div className="text-xl font-bold text-red-600">
              {summaryStats.totalLost.toLocaleString()}
            </div>
            <TrendingDown size={14} className="text-red-500" />
          </div>
          <div className="text-xs text-gray-500">Total Lost</div>
        </div>
        <div className="text-center p-3 bg-amber-50 rounded-lg">
          <div className="flex items-center justify-center gap-1">
            <div className="text-xl font-bold text-amber-600">
              {summaryStats.lossRate.toFixed(1)}%
            </div>
            <AlertTriangle size={14} className="text-amber-500" />
          </div>
          <div className="text-xs text-gray-500">Loss Rate</div>
        </div>
        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-center gap-1">
            <div className="text-xl font-bold text-blue-600">
              {summaryStats.totalWinbacks}
            </div>
            <Award size={14} className="text-blue-500" />
          </div>
          <div className="text-xs text-gray-500">Winbacks</div>
        </div>
      </div>

      {/* Cohort Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-900 bg-gray-50 rounded-tl-lg sticky left-0 z-10">
                Month
              </th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-gray-900 bg-gray-50">
                Size
              </th>
              {periodLabels.map((label, i) => (
                <th
                  key={i}
                  className="px-3 py-3 text-center text-xs font-semibold text-gray-900 bg-gray-50"
                >
                  {label}
                </th>
              ))}
              {showLostColumn && (
                <>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-red-700 bg-red-50">
                    Lost
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-blue-700 bg-blue-50 rounded-tr-lg">
                    Winback
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {processedData.length > 0 ? (
              <>
                {processedData.map((cohort, rowIndex) => (
                  <tr key={cohort.cohort} className="border-t border-gray-100">
                    <td className="px-3 py-2.5 text-sm font-medium text-gray-900 bg-white sticky left-0 z-10">
                      {cohort.cohort}
                    </td>
                    <td className="px-3 py-2.5 text-center text-sm text-gray-600">
                      {cohort.cohortSize.toLocaleString()}
                    </td>
                    {cohort.periods.map((value, colIndex) => {
                      const percentage = cohort.percentages[colIndex];
                      const isHovered =
                        hoveredCell?.row === rowIndex && hoveredCell?.col === colIndex;

                      return (
                        <td
                          key={colIndex}
                          className="px-1 py-1"
                          onMouseEnter={() =>
                            setHoveredCell({ row: rowIndex, col: colIndex })
                          }
                          onMouseLeave={() => setHoveredCell(null)}
                        >
                          <div
                            className={`
                              relative px-2 py-1.5 rounded text-center text-sm font-medium
                              transition-all duration-200 cursor-default
                              ${getRetentionColor(percentage)}
                              ${isHovered ? 'ring-2 ring-offset-1 ring-gray-400 scale-105' : ''}
                            `}
                          >
                            {displayMode === 'percentage'
                              ? `${percentage.toFixed(0)}%`
                              : value.toLocaleString()}
                            
                            {/* Tooltip on hover */}
                            {isHovered && (
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap z-20 shadow-lg">
                                <div className="font-semibold">{cohort.cohort}</div>
                                <div>{periodLabels[colIndex]}</div>
                                <div className="mt-1 pt-1 border-t border-gray-700">
                                  <span className="text-gray-400">Count:</span> {value.toLocaleString()}
                                  <br />
                                  <span className="text-gray-400">Rate:</span> {percentage.toFixed(1)}%
                                </div>
                                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                                  <div className="border-4 border-transparent border-t-gray-900" />
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    {showLostColumn && (
                      <>
                        <td className="px-1 py-1">
                          <div
                            className={`px-2 py-1.5 rounded text-center text-sm font-medium ${getLossColor(cohort.lostPercentage)}`}
                          >
                            {displayMode === 'percentage'
                              ? `${cohort.lostPercentage.toFixed(0)}%`
                              : cohort.lostCount.toLocaleString()}
                          </div>
                        </td>
                        <td className="px-1 py-1">
                          <div
                            className={`px-2 py-1.5 rounded text-center text-sm font-medium ${
                              cohort.winbackCount > 0
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-50 text-gray-400'
                            }`}
                          >
                            {cohort.winbackCount.toLocaleString()}
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}

                {/* Average Row */}
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td className="px-3 py-2.5 text-sm font-semibold text-gray-900 sticky left-0 z-10 bg-gray-50">
                    Average
                  </td>
                  <td className="px-3 py-2.5 text-center text-sm font-medium text-gray-600">
                    {Math.round(
                      processedData.reduce((a, b) => a + b.cohortSize, 0) /
                        processedData.length
                    ).toLocaleString()}
                  </td>
                  {averageRetention.map((avg, i) => (
                    <td key={i} className="px-1 py-1">
                      <div
                        className={`px-2 py-1.5 rounded text-center text-sm font-semibold ${getRetentionColor(avg)}`}
                      >
                        {displayMode === 'percentage'
                          ? `${avg.toFixed(0)}%`
                          : Math.round(
                              (avg / 100) *
                                (processedData.reduce((a, b) => a + b.cohortSize, 0) /
                                  processedData.length)
                            ).toLocaleString()}
                      </div>
                    </td>
                  ))}
                  {showLostColumn && (
                    <>
                      <td className="px-1 py-1">
                        <div
                          className={`px-2 py-1.5 rounded text-center text-sm font-semibold ${getLossColor(averageLost.percentage)}`}
                        >
                          {displayMode === 'percentage'
                            ? `${averageLost.percentage.toFixed(0)}%`
                            : averageLost.count.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-1 py-1">
                        <div className="px-2 py-1.5 rounded text-center text-sm font-semibold bg-gray-100 text-gray-600">
                          -
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              </>
            ) : (
              <tr>
                <td
                  colSpan={periodLabels.length + (showLostColumn ? 4 : 2)}
                  className="px-4 py-12 text-center text-gray-500"
                >
                  No cohort data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-gray-100">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Info size={16} />
            <span>Hover over cells for detailed information</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Retention:</span>
              <div className="flex gap-1">
                <div className="w-6 h-4 rounded bg-emerald-100" title="0-20%" />
                <div className="w-6 h-4 rounded bg-emerald-200" title="20-40%" />
                <div className="w-6 h-4 rounded bg-emerald-300" title="40-60%" />
                <div className="w-6 h-4 rounded bg-emerald-400" title="60-80%" />
                <div className="w-6 h-4 rounded bg-emerald-500" title="80-100%" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Lost:</span>
              <div className="flex gap-1">
                <div className="w-6 h-4 rounded bg-red-100" title="0-15%" />
                <div className="w-6 h-4 rounded bg-red-200" title="15-30%" />
                <div className="w-6 h-4 rounded bg-red-400" title="30-50%" />
                <div className="w-6 h-4 rounded bg-red-500" title="50%+" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CohortRetentionAnalysis;
