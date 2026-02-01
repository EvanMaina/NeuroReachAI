/**
 * CallRail Analytics Service
 * 
 * Fetches call analytics data from our backend proxy (never directly from CallRail).
 * All API keys remain server-side only.
 * 
 * @module services/callrail
 * @version 1.0.0
 */

import { apiClient } from './api';

// =============================================================================
// Types
// =============================================================================

export interface CallRailCall {
  id?: string;
  caller_name: string | null;
  caller_number: string | null;
  city: string | null;
  state: string | null;
  duration: number | null;
  answered: boolean;
  source_name: string | null;
  source: string | null;
  campaign: string | null;
  start_time: string;
  recording: string | null;
  first_call: boolean;
  voicemail: boolean;
  status: string | null;
  direction: string | null;
  tracking_phone_number: string | null;
}

export interface CallsResponse {
  calls: CallRailCall[];
  page: number;
  per_page: number;
  total_pages: number;
  total_records: number;
}

export interface SummaryMetrics {
  total_calls: number;
  answered: number;
  missed: number;
  first_time_callers: number;
  voicemail: number;
  avg_duration_seconds: number;
  answered_rate: number;
}

export interface SummaryResponse {
  current: SummaryMetrics;
  previous: SummaryMetrics;
  changes: {
    total_calls: number;
    answered_rate: number;
    avg_duration: number;
    first_time_callers: number;
    missed: number;
  };
  date_range: { start: string; end: string };
  previous_range: { start: string; end: string };
}

export interface TimeseriesPoint {
  date: string;
  total: number;
  answered: number;
  missed: number;
  first_time: number;
}

export interface TimeseriesResponse {
  data: TimeseriesPoint[];
  date_range: { start: string; end: string };
}

export interface SourceItem {
  name: string;
  count: number;
}

export interface SourcesResponse {
  sources: SourceItem[];
}

export interface AttributionBreakdown {
  name: string;
  value: number;
}

export interface CampaignBreakdown {
  name: string;
  total: number;
  answered: number;
}

export interface AttributionResponse {
  source_breakdown: AttributionBreakdown[];
  caller_type: AttributionBreakdown[];
  campaign_breakdown: CampaignBreakdown[];
  geo_breakdown: AttributionBreakdown[];
  total_calls: number;
  date_range: { start: string; end: string };
}

export type DateRangeType = 'today' | '7days' | '30days' | '90days' | 'custom';

// =============================================================================
// API Functions
// =============================================================================

export async function getCallRailSummary(
  dateRange: DateRangeType = '30days',
  startDate?: string,
  endDate?: string
): Promise<SummaryResponse> {
  const params: Record<string, string> = { date_range: dateRange };
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  
  const response = await apiClient.get<SummaryResponse>('/api/callrail/summary', { params });
  return response.data;
}

export async function getCallRailCalls(params: {
  dateRange?: DateRangeType;
  startDate?: string;
  endDate?: string;
  page?: number;
  perPage?: number;
  status?: string;
  source?: string;
  search?: string;
  sortBy?: string;
  sortDir?: string;
}): Promise<CallsResponse> {
  const queryParams: Record<string, string | number> = {
    date_range: params.dateRange || '30days',
    page: params.page || 1,
    per_page: params.perPage || 25,
  };
  if (params.startDate) queryParams.start_date = params.startDate;
  if (params.endDate) queryParams.end_date = params.endDate;
  if (params.status) queryParams.status = params.status;
  if (params.source) queryParams.source = params.source;
  if (params.search) queryParams.search = params.search;
  if (params.sortBy) queryParams.sort_by = params.sortBy;
  if (params.sortDir) queryParams.sort_dir = params.sortDir;

  const response = await apiClient.get<CallsResponse>('/api/callrail/calls', { params: queryParams });
  return response.data;
}

export async function getCallRailTimeseries(
  dateRange: DateRangeType = '30days',
  startDate?: string,
  endDate?: string
): Promise<TimeseriesResponse> {
  const params: Record<string, string> = { date_range: dateRange };
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;

  const response = await apiClient.get<TimeseriesResponse>('/api/callrail/timeseries', { params });
  return response.data;
}

export async function getCallRailSources(
  dateRange: DateRangeType = '90days'
): Promise<SourcesResponse> {
  const response = await apiClient.get<SourcesResponse>('/api/callrail/sources', {
    params: { date_range: dateRange }
  });
  return response.data;
}

export async function getCallRailAttribution(
  dateRange: DateRangeType = '30days',
  startDate?: string,
  endDate?: string
): Promise<AttributionResponse> {
  const params: Record<string, string> = { date_range: dateRange };
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;

  const response = await apiClient.get<AttributionResponse>('/api/callrail/attribution', { params });
  return response.data;
}

// =============================================================================
// Utility Functions
// =============================================================================

/** Format seconds to M:SS */
export function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/** Format a number with commas */
export function formatNumber(n: number): string {
  return n.toLocaleString();
}

/** Time ago from ISO string */
export function timeAgo(isoString: string): string {
  const now = new Date();
  const then = new Date(isoString);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Mask phone number for HIPAA (show last 4 digits) */
export function maskPhone(phone: string | null): string {
  if (!phone) return '•••• ••••';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length >= 4) {
    return `•••-•••-${cleaned.slice(-4)}`;
  }
  return '•••• ••••';
}

/** Format date for display */
export function formatCallDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }) + ' · ' + d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
