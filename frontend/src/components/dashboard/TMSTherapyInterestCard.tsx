/**
 * TMS Therapy Interest Card Component
 * 
 * Displays TMS therapy interest distribution across leads with visual indicators
 * showing count, percentage, and trend for each therapy type.
 * Matches LeadingConditionsCard visual style.
 * 
 * @module components/dashboard/TMSTherapyInterestCard
 */

import React from 'react';
import {
  Zap,
  Clock,
  Rocket,
  HelpCircle,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

interface TMSInterestData {
  interestType: string;
  count: number;
  percentage: number;
  trend?: number;
}

interface TMSTherapyInterestCardProps {
  interests: TMSInterestData[];
  totalWithInterest: number;
  totalLeads: number;
  isLoading?: boolean;
}

// =============================================================================
// Config
// =============================================================================

const TMS_INTEREST_CONFIG: Record<string, {
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  barColor: string;
}> = {
  daily_tms: {
    label: 'Daily TMS',
    icon: <Clock size={18} />,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    barColor: 'bg-blue-500',
  },
  accelerated_tms: {
    label: 'Accelerated TMS',
    icon: <Rocket size={18} />,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100',
    barColor: 'bg-emerald-500',
  },
  not_sure: {
    label: 'Not Sure',
    icon: <HelpCircle size={18} />,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    barColor: 'bg-gray-400',
  },
};

const DEFAULT_CONFIG = {
  label: 'Unknown',
  icon: <HelpCircle size={18} />,
  color: 'text-gray-600',
  bgColor: 'bg-gray-100',
  barColor: 'bg-gray-400',
};

// =============================================================================
// Sub-Components
// =============================================================================

const TMSInterestRow: React.FC<{ data: TMSInterestData; maxCount: number }> = ({
  data,
  maxCount,
}) => {
  const config = TMS_INTEREST_CONFIG[data.interestType] || DEFAULT_CONFIG;
  const barWidth = maxCount > 0 ? (data.count / maxCount) * 100 : 0;

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${config.bgColor} ${config.color}`}>
            {config.icon}
          </div>
          <div>
            <span className="font-medium text-gray-900">{config.label}</span>
            <span className="text-gray-500 ml-2 text-sm">({data.count})</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-gray-900">
            {data.percentage.toFixed(1)}%
          </span>
          {data.trend !== undefined && (
            <div className={`flex items-center gap-0.5 text-xs ${
              data.trend > 0 ? 'text-emerald-600' : data.trend < 0 ? 'text-red-600' : 'text-gray-400'
            }`}>
              {data.trend > 0 ? (
                <TrendingUp size={14} />
              ) : data.trend < 0 ? (
                <TrendingDown size={14} />
              ) : null}
              {data.trend !== 0 && <span>{Math.abs(data.trend)}%</span>}
            </div>
          )}
        </div>
      </div>
      {/* Progress bar */}
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${config.barColor} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const TMSTherapyInterestCard: React.FC<TMSTherapyInterestCardProps> = ({
  interests,
  totalWithInterest,
  totalLeads,
  isLoading = false,
}) => {
  const sortedInterests = [...interests].sort((a, b) => b.count - a.count);
  const maxCount = sortedInterests.length > 0 ? sortedInterests[0].count : 0;

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-48 mb-6" />
          <div className="space-y-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-lg" />
                    <div className="h-4 bg-gray-200 rounded w-24" />
                  </div>
                  <div className="h-4 bg-gray-200 rounded w-16" />
                </div>
                <div className="h-2 bg-gray-200 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            TMS Therapy Interest
          </h3>
          <p className="text-sm text-gray-500">
            {totalWithInterest.toLocaleString()} of {totalLeads.toLocaleString()} leads expressed TMS interest
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium">
          <Zap size={16} />
          <span>TMS Types</span>
        </div>
      </div>

      {/* Interest List */}
      <div className="space-y-5">
        {sortedInterests.length > 0 ? (
          sortedInterests.map((interest) => (
            <TMSInterestRow
              key={interest.interestType}
              data={interest}
              maxCount={maxCount}
            />
          ))
        ) : (
          <div className="text-center py-8 text-gray-500">
            No TMS interest data available yet
          </div>
        )}
      </div>

      {/* Summary Footer */}
      {sortedInterests.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              Top interest: <span className="font-medium text-gray-900">
                {(TMS_INTEREST_CONFIG[sortedInterests[0].interestType] || DEFAULT_CONFIG).label}
              </span>
            </span>
            <span className="text-gray-500">
              {sortedInterests[0].percentage.toFixed(1)}% of interested leads
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default TMSTherapyInterestCard;
