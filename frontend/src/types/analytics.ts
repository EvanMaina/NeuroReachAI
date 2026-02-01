/**
 * Dashboard analytics type definitions
 */

/**
 * Single metric with trend data
 */
export interface MetricData {
  value: number | string;
  previousValue?: number;
  trend?: {
    value: number;
    isPercentage: boolean;
    isPositive: boolean;
  };
}

/**
 * Dashboard overview metrics
 */
export interface DashboardMetrics {
  totalLeads: MetricData;
  highPriorityLeads: MetricData;
  conversionRate: MetricData;
  avgResponseTime: MetricData;
}

/**
 * Filter type for stats card clicks
 */
export type StatsFilterType = 
  | 'all' 
  | 'high_priority' 
  | 'converted' 
  | 'response_time';
