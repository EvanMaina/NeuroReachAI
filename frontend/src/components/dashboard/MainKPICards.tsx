/**
 * Main KPI Cards Component
 * 
 * Displays key performance indicators:
 * - Total Leads
 * - Converted Leads
 * - Conversion Rate
 * - Scheduled Appointments
 * 
 * @module components/dashboard/MainKPICards
 */

import React from 'react';
import {
  Users,
  UserCheck,
  TrendingUp,
  CalendarCheck,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  gradient: string;
  onClick?: () => void;
}

const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  gradient,
  onClick,
}) => (
  <div
    className={`
      relative overflow-hidden rounded-2xl shadow-lg cursor-pointer
      ${gradient}
      p-6 min-h-[160px]
      transform transition-all duration-300
      hover:scale-[1.02] hover:shadow-xl
    `}
    onClick={onClick}
  >
    {/* Background decorative elements */}
    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
    <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/5 rounded-full translate-y-1/2 -translate-x-1/2" />
    
    <div className="relative z-10">
      {/* Header with icon */}
      <div className="flex items-start justify-between mb-4">
        <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm">
          {icon}
        </div>
        {trend && (
          <div className={`
            flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold
            backdrop-blur-sm border
            ${trend.isPositive 
              ? 'bg-emerald-100/80 text-emerald-700 border-emerald-200' 
              : 'bg-red-100/80 text-red-700 border-red-200'
            }
          `}>
            {trend.isPositive ? (
              <ArrowUpRight size={14} />
            ) : (
              <ArrowDownRight size={14} />
            )}
            <span>{Math.abs(trend.value)}%</span>
          </div>
        )}
      </div>
      
      {/* Value */}
      <div className="text-4xl font-bold text-white tracking-tight mb-1">
        {value}
      </div>
      
      {/* Title */}
      <div className="text-white/90 font-medium">
        {title}
      </div>
      
      {/* Subtitle */}
      {subtitle && (
        <div className="text-white/70 text-sm mt-1">
          {subtitle}
        </div>
      )}
    </div>
  </div>
);

export interface MainKPICardsProps {
  totalLeads: number;
  convertedLeads: number;
  conversionRate: number;
  scheduledAppointments: number;
  trends?: {
    totalLeads?: number;
    convertedLeads?: number;
    conversionRate?: number;
    scheduledAppointments?: number;
  };
  onCardClick?: (type: 'total' | 'converted' | 'rate' | 'scheduled') => void;
}

export const MainKPICards: React.FC<MainKPICardsProps> = ({
  totalLeads,
  convertedLeads,
  conversionRate,
  scheduledAppointments,
  trends = {},
  onCardClick,
}) => {
  const cards = [
    {
      id: 'total' as const,
      title: 'Total Leads',
      value: totalLeads.toLocaleString(),
      subtitle: 'All time leads captured',
      icon: <Users size={24} className="text-white" />,
      trend: trends.totalLeads ? { value: trends.totalLeads, isPositive: trends.totalLeads > 0 } : undefined,
      gradient: 'bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600',
    },
    {
      id: 'converted' as const,
      title: 'Converted Leads',
      value: convertedLeads.toLocaleString(),
      subtitle: 'Completed consultations',
      icon: <UserCheck size={24} className="text-white" />,
      trend: trends.convertedLeads ? { value: trends.convertedLeads, isPositive: trends.convertedLeads > 0 } : undefined,
      gradient: 'bg-gradient-to-br from-emerald-500 via-green-500 to-teal-500',
    },
    {
      id: 'rate' as const,
      title: 'Conversion Rate',
      value: `${conversionRate.toFixed(1)}%`,
      subtitle: 'Lead to consultation rate',
      icon: <TrendingUp size={24} className="text-white" />,
      trend: trends.conversionRate ? { value: trends.conversionRate, isPositive: trends.conversionRate > 0 } : undefined,
      gradient: 'bg-gradient-to-br from-purple-500 via-violet-500 to-indigo-500',
    },
    {
      id: 'scheduled' as const,
      title: 'Scheduled Appointments',
      value: scheduledAppointments.toLocaleString(),
      subtitle: 'Upcoming consultations',
      icon: <CalendarCheck size={24} className="text-white" />,
      trend: trends.scheduledAppointments ? { value: trends.scheduledAppointments, isPositive: trends.scheduledAppointments > 0 } : undefined,
      gradient: 'bg-gradient-to-br from-amber-500 via-orange-500 to-red-500',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {cards.map((card) => (
        <KPICard
          key={card.id}
          title={card.title}
          value={card.value}
          subtitle={card.subtitle}
          icon={card.icon}
          trend={card.trend}
          gradient={card.gradient}
          onClick={() => onCardClick?.(card.id)}
        />
      ))}
    </div>
  );
};

export default MainKPICards;
