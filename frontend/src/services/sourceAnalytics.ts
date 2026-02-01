/**
 * Source Analytics Service
 * 
 * API client for source/platform analytics endpoints.
 * Tracks leads from Widget, Google Ads, Jotform, Referral (4 platforms)
 * 
 * @module services/sourceAnalytics
 * @version 2.0.0 - Added Referral platform support
 */

import { apiClient } from './api';

// =============================================================================
// Types
// =============================================================================

export interface PlatformMetrics {
  platform: string;
  total_leads: number;
  hot_leads: number;
  medium_leads: number;
  low_leads: number;
  converted_leads: number;
  conversion_rate: number;
  scheduled_leads: number;
  percentage_of_total: number;
  avg_score: number;
  color: string;
  icon: string;
  trend: number;
  cost_per_lead?: number;
  has_data: boolean; // Whether platform has actual data
}

export interface SourceAnalyticsResponse {
  platforms: PlatformMetrics[];
  totals: {
    total_leads: number;
    total_hot: number;
    total_medium: number;
    total_low: number;
    total_converted: number;
    overall_conversion_rate: number;
    total_scheduled: number;
    platform_count: number;
  };
  top_performing: string;
  trending_up: string[];
  cache_hit: boolean;
  query_time_ms: number;
  timestamp: string;
  request_id: string;
}

export interface PlatformTrendDataPoint {
  date: string;
  label: string;
  widget: number;
  google_ads: number;
  jotform: number;
  referral: number;
}

export interface PlatformTrendResponse {
  period_days: number;
  data: PlatformTrendDataPoint[];
  cache_hit: boolean;
  query_time_ms: number;
  timestamp: string;
}

export interface HotLeadPlatform {
  platform: string;
  count: number;
  converted: number;
  scheduled: number;
  new_untouched: number;
  conversion_rate: number;
  avg_score: number;
  top_condition: string;
  color: string;
  icon: string;
  has_data: boolean;
}

export interface HotLeadsByPlatformResponse {
  platforms: HotLeadPlatform[];
  total_hot_leads: number;
  cache_hit: boolean;
  query_time_ms: number;
  timestamp: string;
}

export interface CampaignPerformance {
  campaign: string;
  source: string;
  platform: string;
  total_leads: number;
  hot_leads: number;
  converted_leads: number;
  conversion_rate: number;
  avg_score: number;
}

export interface CampaignPerformanceResponse {
  campaigns: CampaignPerformance[];
  total_campaigns: number;
  query_time_ms: number;
  timestamp: string;
}

// =============================================================================
// Retry Logic Helper
// =============================================================================

/**
 * Fetch with automatic retry on failure.
 * Implements exponential backoff: 1s, 2s, 4s
 */
async function fetchWithRetry<T>(
  fetchFn: () => Promise<T>,
  retries: number = 3,
  operation: string = 'fetch'
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fetchFn();
    } catch (error: any) {
      lastError = error;
      console.warn(`[${operation}] Attempt ${attempt + 1}/${retries} failed:`, error.message);
      
      if (attempt < retries - 1) {
        // Exponential backoff: 1000ms, 2000ms, 4000ms
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Get source analytics overview with metrics by platform.
 * Returns all 4 platforms (Widget, Google Ads, Jotform, Referral).
 */
export async function getSourceAnalytics(
  daysBack: number = 30
): Promise<SourceAnalyticsResponse> {
  return fetchWithRetry(async () => {
    const response = await apiClient.get<SourceAnalyticsResponse>(
      '/api/analytics/sources/overview',
      { params: { days_back: daysBack } }
    );
    return response.data;
  }, 3, 'getSourceAnalytics');
}

/**
 * Get platform trend over time.
 */
export async function getPlatformTrend(
  period: number = 30
): Promise<PlatformTrendResponse> {
  return fetchWithRetry(async () => {
    const response = await apiClient.get<PlatformTrendResponse>(
      '/api/analytics/sources/trend',
      { params: { period } }
    );
    return response.data;
  }, 3, 'getPlatformTrend');
}

/**
 * Get hot leads breakdown by platform.
 * Returns all 4 platforms (Widget, Google Ads, Jotform, Referral).
 */
export async function getHotLeadsByPlatform(
  daysBack: number = 30
): Promise<HotLeadsByPlatformResponse> {
  return fetchWithRetry(async () => {
    const response = await apiClient.get<HotLeadsByPlatformResponse>(
      '/api/analytics/sources/hot-leads',
      { params: { days_back: daysBack } }
    );
    return response.data;
  }, 3, 'getHotLeadsByPlatform');
}

/**
 * Get campaign performance metrics.
 */
export async function getCampaignPerformance(
  daysBack: number = 30
): Promise<CampaignPerformanceResponse> {
  return fetchWithRetry(async () => {
    const response = await apiClient.get<CampaignPerformanceResponse>(
      '/api/analytics/sources/campaign-performance',
      { params: { days_back: daysBack } }
    );
    return response.data;
  }, 3, 'getCampaignPerformance');
}

// =============================================================================
// Platform Utilities - ALL 4 PLATFORMS
// =============================================================================

// All supported platforms (4 platforms)
export const ALLOWED_PLATFORMS = ['Widget', 'Google Ads', 'Jotform', 'Referral'] as const;
export type AllowedPlatform = typeof ALLOWED_PLATFORMS[number];

export const PLATFORM_DISPLAY_NAMES: Record<string, string> = {
  widget: 'Widget',
  google_ads: 'Google Ads',
  jotform: 'Jotform',
  referral: 'Referral',
};

export const PLATFORM_COLORS: Record<string, string> = {
  Widget: '#3B82F6',       // Blue
  'Google Ads': '#EA4335', // Google Red
  Jotform: '#FF8A00',      // Orange
  Referral: '#10B981',     // Emerald Green
};

/**
 * Get gradient class for platform.
 */
export function getPlatformGradient(platform: string): string {
  const gradients: Record<string, string> = {
    Widget: 'from-blue-500 to-blue-600',
    'Google Ads': 'from-red-500 to-orange-500',
    Jotform: 'from-orange-400 to-amber-500',
    Referral: 'from-emerald-500 to-green-500',
  };
  return gradients[platform] || 'from-gray-400 to-gray-500';
}

/**
 * Get light background class for platform.
 */
export function getPlatformBgLight(platform: string): string {
  const bgs: Record<string, string> = {
    Widget: 'bg-blue-50',
    'Google Ads': 'bg-red-50',
    Jotform: 'bg-orange-50',
    Referral: 'bg-emerald-50',
  };
  return bgs[platform] || 'bg-gray-50';
}

/**
 * Get text color class for platform.
 */
export function getPlatformTextColor(platform: string): string {
  const colors: Record<string, string> = {
    Widget: 'text-blue-600',
    'Google Ads': 'text-red-600',
    Jotform: 'text-orange-600',
    Referral: 'text-emerald-600',
  };
  return colors[platform] || 'text-gray-600';
}

/**
 * Check if a platform is one of the allowed platforms.
 */
export function isAllowedPlatform(platform: string): boolean {
  return ALLOWED_PLATFORMS.includes(platform as AllowedPlatform);
}

/**
 * Get description text for platforms with no data.
 */
export function getNoDataMessage(platform: string): string {
  const messages: Record<string, string> = {
    Widget: 'Widget tracking is active - leads will appear here',
    'Google Ads': 'Connect Google Ads to track paid campaigns',
    Jotform: 'Set up Jotform webhook to receive form submissions',
    Referral: 'Create referral links to track word-of-mouth leads',
  };
  return messages[platform] || 'No data available for this platform';
}
