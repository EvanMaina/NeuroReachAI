/**
 * useCallRailData — Custom hook for CallRail data fetching
 * Uses React Query for caching and background refetching.
 * @module hooks/useCallRailData
 */
import { useQuery } from '@tanstack/react-query';
import {
  getCallRailSummary, getCallRailCalls, getCallRailTimeseries,
  getCallRailSources, getCallRailAttribution,
  type DateRangeType, type SummaryResponse, type CallsResponse,
  type TimeseriesResponse, type SourcesResponse, type AttributionResponse,
} from '../services/callrail';

export function useSummary(dateRange: DateRangeType, startDate?: string, endDate?: string) {
  return useQuery<SummaryResponse>({
    queryKey: ['callrail', 'summary', dateRange, startDate, endDate],
    queryFn: () => getCallRailSummary(dateRange, startDate, endDate),
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useCalls(params: {
  dateRange?: DateRangeType; startDate?: string; endDate?: string;
  page?: number; perPage?: number; status?: string; source?: string;
  search?: string; sortBy?: string; sortDir?: string;
}) {
  return useQuery<CallsResponse>({
    queryKey: ['callrail', 'calls', params],
    queryFn: () => getCallRailCalls(params),
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useTimeseries(dateRange: DateRangeType, startDate?: string, endDate?: string) {
  return useQuery<TimeseriesResponse>({
    queryKey: ['callrail', 'timeseries', dateRange, startDate, endDate],
    queryFn: () => getCallRailTimeseries(dateRange, startDate, endDate),
    staleTime: 3 * 60 * 1000,
  });
}

export function useSources(dateRange: DateRangeType = '90days') {
  return useQuery<SourcesResponse>({
    queryKey: ['callrail', 'sources', dateRange],
    queryFn: () => getCallRailSources(dateRange),
    staleTime: 10 * 60 * 1000,
  });
}

export function useAttribution(dateRange: DateRangeType, startDate?: string, endDate?: string) {
  return useQuery<AttributionResponse>({
    queryKey: ['callrail', 'attribution', dateRange, startDate, endDate],
    queryFn: () => getCallRailAttribution(dateRange, startDate, endDate),
    staleTime: 3 * 60 * 1000,
  });
}
