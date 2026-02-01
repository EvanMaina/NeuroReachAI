/**
 * Leading Conditions Card Component
 * 
 * Displays the top conditions/issues from leads with visual indicators
 * showing distribution and count for each condition.
 * 
 * @module components/dashboard/LeadingConditionsCard
 */

import React from 'react';
import {
  Brain,
  Activity,
  Heart,
  Shield,
  HelpCircle,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import type { ConditionType } from '../../types/lead';

interface ConditionData {
  condition: ConditionType;
  count: number;
  percentage: number;
  trend?: number; // Percentage change from previous period
}

interface LeadingConditionsCardProps {
  conditions: ConditionData[];
  totalLeads: number;
  isLoading?: boolean;
}

const CONDITION_CONFIG: Record<ConditionType, {
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  barColor: string;
}> = {
  DEPRESSION: {
    label: 'Depression',
    icon: <Brain size={18} />,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    barColor: 'bg-blue-500',
  },
  ANXIETY: {
    label: 'Anxiety',
    icon: <Activity size={18} />,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    barColor: 'bg-amber-500',
  },
  OCD: {
    label: 'OCD',
    icon: <Heart size={18} />,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    barColor: 'bg-purple-500',
  },
  PTSD: {
    label: 'PTSD',
    icon: <Shield size={18} />,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    barColor: 'bg-red-500',
  },
  OTHER: {
    label: 'Other',
    icon: <HelpCircle size={18} />,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    barColor: 'bg-gray-500',
  },
};

const ConditionRow: React.FC<{ data: ConditionData; maxCount: number }> = ({
  data,
  maxCount,
}) => {
  const config = CONDITION_CONFIG[data.condition];
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

export const LeadingConditionsCard: React.FC<LeadingConditionsCardProps> = ({
  conditions,
  totalLeads,
  isLoading = false,
}) => {
  const sortedConditions = [...conditions].sort((a, b) => b.count - a.count);
  const maxCount = sortedConditions.length > 0 ? sortedConditions[0].count : 0;

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-48 mb-6" />
          <div className="space-y-6">
            {[1, 2, 3, 4, 5].map((i) => (
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
            Leading Conditions
          </h3>
          <p className="text-sm text-gray-500">
            Distribution of {totalLeads.toLocaleString()} leads by primary condition
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium">
          <Brain size={16} />
          <span>TMS Eligible</span>
        </div>
      </div>

      {/* Conditions List */}
      <div className="space-y-5">
        {sortedConditions.length > 0 ? (
          sortedConditions.map((condition) => (
            <ConditionRow
              key={condition.condition}
              data={condition}
              maxCount={maxCount}
            />
          ))
        ) : (
          <div className="text-center py-8 text-gray-500">
            No condition data available
          </div>
        )}
      </div>

      {/* Summary Footer */}
      {sortedConditions.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              Top condition: <span className="font-medium text-gray-900">
                {CONDITION_CONFIG[sortedConditions[0].condition].label}
              </span>
            </span>
            <span className="text-gray-500">
              {sortedConditions[0].percentage.toFixed(1)}% of all leads
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadingConditionsCard;
