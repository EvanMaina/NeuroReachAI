/**
 * Stats Cards Component - Production Ready
 * 
 * Dashboard stat cards showing key metrics with gradient backgrounds,
 * trend indicators, and polished visual design.
 */

import React from 'react';
import { 
  Flame, 
  Sparkles, 
  TrendingUp, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight,
  Minus
} from 'lucide-react';

interface StatCardConfig {
  id: string;
  name: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: React.ReactNode;
  gradient: string;
  iconBg: string;
  iconColor: string;
}

interface StatsCardsProps {
  hotLeadsCount?: number;
  newLeadsCount?: number;
  responseRate?: number;
  scheduledCount?: number;
  hotLeadsChange?: string;
  newLeadsChange?: string;
  responseRateChange?: string;
  scheduledChange?: string;
}

/**
 * Get trend arrow icon based on change type
 */
const getTrendIcon = (changeType: 'positive' | 'negative' | 'neutral' = 'neutral') => {
  switch (changeType) {
    case 'positive':
      return <ArrowUpRight size={14} className="text-emerald-600" />;
    case 'negative':
      return <ArrowDownRight size={14} className="text-red-600" />;
    default:
      return <Minus size={14} className="text-gray-400" />;
  }
};

/**
 * Get change badge styling based on type
 */
const getChangeBadge = (changeType: 'positive' | 'negative' | 'neutral' = 'neutral') => {
  switch (changeType) {
    case 'positive':
      return 'text-emerald-700 bg-emerald-100/80 border-emerald-200';
    case 'negative':
      return 'text-red-700 bg-red-100/80 border-red-200';
    default:
      return 'text-gray-600 bg-gray-100/80 border-gray-200';
  }
};

/**
 * Parse change string to determine type
 */
const parseChangeType = (change?: string): 'positive' | 'negative' | 'neutral' => {
  if (!change) return 'neutral';
  if (change.startsWith('+') || change.startsWith('↑')) return 'positive';
  if (change.startsWith('-') || change.startsWith('↓')) return 'negative';
  return 'neutral';
};

/**
 * Dashboard statistics cards with gradient backgrounds
 */
export const StatsCards: React.FC<StatsCardsProps> = ({
  hotLeadsCount = 23,
  newLeadsCount = 147,
  responseRate = 34.2,
  scheduledCount = 12,
  hotLeadsChange = '+5',
  newLeadsChange = '+12%',
  responseRateChange = '+2.1%',
  scheduledChange = '+3',
}) => {
  const stats: StatCardConfig[] = [
    {
      id: 'hot-leads',
      name: 'Hot Leads',
      value: hotLeadsCount,
      change: hotLeadsChange,
      changeType: parseChangeType(hotLeadsChange),
      icon: <Flame size={24} className="text-white" />,
      gradient: 'bg-gradient-to-br from-red-500 via-orange-500 to-amber-500',
      iconBg: 'bg-white/20',
      iconColor: 'text-white',
    },
    {
      id: 'new-leads',
      name: 'New Leads',
      value: newLeadsCount,
      change: newLeadsChange,
      changeType: parseChangeType(newLeadsChange),
      icon: <Sparkles size={24} className="text-white" />,
      gradient: 'bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600',
      iconBg: 'bg-white/20',
      iconColor: 'text-white',
    },
    {
      id: 'response-rate',
      name: 'Response Rate',
      value: `${responseRate}%`,
      change: responseRateChange,
      changeType: parseChangeType(responseRateChange),
      icon: <TrendingUp size={24} className="text-white" />,
      gradient: 'bg-gradient-to-br from-emerald-500 via-green-500 to-teal-500',
      iconBg: 'bg-white/20',
      iconColor: 'text-white',
    },
    {
      id: 'scheduled',
      name: 'Scheduled',
      value: scheduledCount,
      change: scheduledChange,
      changeType: parseChangeType(scheduledChange),
      icon: <Calendar size={24} className="text-white" />,
      gradient: 'bg-gradient-to-br from-purple-500 via-violet-500 to-indigo-500',
      iconBg: 'bg-white/20',
      iconColor: 'text-white',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
      {stats.map((stat) => (
        <div
          key={stat.id}
          className={`
            relative overflow-hidden rounded-2xl shadow-lg
            ${stat.gradient}
            p-5 min-h-[140px]
            transform transition-all duration-300
            hover:scale-[1.02] hover:shadow-xl
          `}
        >
          {/* Background decorative elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/5 rounded-full translate-y-1/2 -translate-x-1/2" />
          
          {/* Content */}
          <div className="relative z-10">
            {/* Header row with icon and change badge */}
            <div className="flex items-start justify-between mb-4">
              <div className={`p-3 rounded-xl ${stat.iconBg} backdrop-blur-sm`}>
                {stat.icon}
              </div>
              {stat.change && (
                <div className={`
                  flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold
                  border backdrop-blur-sm
                  ${getChangeBadge(stat.changeType)}
                `}>
                  {getTrendIcon(stat.changeType)}
                  <span>{stat.change}</span>
                </div>
              )}
            </div>
            
            {/* Value and label */}
            <div>
              <p className="text-3xl font-bold text-white tracking-tight">
                {stat.value}
              </p>
              <p className="text-sm text-white/80 mt-1 font-medium">
                {stat.name}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatsCards;
