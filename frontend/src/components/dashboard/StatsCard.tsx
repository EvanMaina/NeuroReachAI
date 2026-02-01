/**
 * StatsCard Component
 * 
 * Clickable metric card that filters dashboard data.
 * IMPORTANT: Negative trends show RED, positive show GREEN.
 */

import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  trend?: {
    value: number;
    isPercentage?: boolean;
  };
  icon: React.ReactNode;
  iconBgColor?: string;
  onClick?: () => void;
  isActive?: boolean;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  trend,
  icon,
  iconBgColor = 'bg-blue-100',
  onClick,
  isActive = false,
}) => {
  // Determine if trend is positive for coloring
  // POSITIVE = GREEN, NEGATIVE = RED
  const isPositiveTrend = trend && trend.value >= 0;
  
  // Format trend display
  const formatTrend = (trend: { value: number; isPercentage?: boolean }): string => {
    const prefix = trend.value >= 0 ? '+' : '';
    const suffix = trend.isPercentage ? '%' : '';
    return `${prefix}${trend.value}${suffix}`;
  };

  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left bg-white rounded-xl border p-6 shadow-sm
        transition-all duration-200 group
        ${onClick ? 'cursor-pointer hover:shadow-md hover:border-blue-300' : 'cursor-default'}
        ${isActive ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-200'}
      `}
      disabled={!onClick}
      type="button"
    >
      <div className="flex items-start justify-between">
        {/* Icon */}
        <div className={`p-3 rounded-lg ${iconBgColor}`}>
          {icon}
        </div>
        
        {/* Trend Badge - CORRECT COLORS */}
        {trend && (
          <div
            className={`
              flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium
              ${isPositiveTrend 
                ? 'bg-green-100 text-green-700' 
                : 'bg-red-100 text-red-700'
              }
            `}
          >
            {isPositiveTrend 
              ? <TrendingUp size={14} /> 
              : <TrendingDown size={14} />
            }
            {formatTrend(trend)}
          </div>
        )}
      </div>
      
      {/* Value & Title */}
      <div className="mt-4">
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500 mt-1">{title}</p>
      </div>
      
      {/* Click hint on hover */}
      {onClick && (
        <p className="text-xs text-blue-600 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
          Click to view details →
        </p>
      )}
    </button>
  );
};
