/**
 * Referring Providers API Service
 * 
 * Handles all API calls for provider management.
 */

import { apiClient } from './api';
import {
  Provider,
  ProviderCreateRequest,
  ProviderUpdateRequest,
  ProviderListResponse,
  ProviderDashboardStats,
  ProviderReferralLead,
  ProviderFilters,
  ProviderStatus,
} from '../types/provider';

// =============================================================================
// Response Conversion (Backend -> Frontend)
// =============================================================================

/**
 * Convert status to UPPERCASE for backend API
 */
function statusToBackend(status: ProviderStatus | undefined): string | undefined {
  if (!status) return undefined;
  return status.toUpperCase();
}

/**
 * Convert backend response to frontend format
 * 
 * NOTE: Specialty is now FREE TEXT - stored and returned as-is, no transformation.
 * Status is still an enum and needs lowercase conversion.
 */
function providerFromBackend(data: Record<string, unknown>): Provider {
  return {
    ...data,
    status: ((data.status as string) || 'pending').toLowerCase() as ProviderStatus,
    // IMPORTANT: Keep specialty as-is (free text) - no transformation!
    specialty: (data.specialty as string) || '',
  } as Provider;
}

/**
 * Convert list of providers from backend format
 */
function providersFromBackend(data: ProviderListResponse): ProviderListResponse {
  return {
    ...data,
    items: data.items.map(item => providerFromBackend(item as unknown as Record<string, unknown>)),
  };
}

// =============================================================================
// Provider CRUD Operations
// =============================================================================

/**
 * Get paginated list of providers with optional filters
 */
export async function getProviders(
  page: number = 1,
  pageSize: number = 20,
  filters?: ProviderFilters
): Promise<ProviderListResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    page_size: pageSize.toString(),
  });

  // Convert filter enums/strings for backend
  if (filters?.status) {
    params.append('status', statusToBackend(filters.status) || '');
  }
  if (filters?.specialty) {
    // Specialty is free text - send as-is (no conversion needed)
    params.append('specialty', filters.specialty);
  }
  if (filters?.search) {
    params.append('search', filters.search);
  }

  const response = await apiClient.get<ProviderListResponse>(`/api/providers?${params.toString()}`);
  return providersFromBackend(response.data);
}

/**
 * Get a single provider by ID
 */
export async function getProvider(providerId: string): Promise<Provider> {
  const response = await apiClient.get<Record<string, unknown>>(`/api/providers/${providerId}`);
  return providerFromBackend(response.data);
}

/**
 * Create a new provider
 */
export async function createProvider(data: ProviderCreateRequest): Promise<Provider> {
  // Prepare data for backend - handle empty strings
  // Backend expects null/undefined for optional fields, not empty strings
  const backendData: Record<string, unknown> = {
    name: data.name,
    specialty: data.specialty || undefined,  // Free text - send as-is
  };
  
  // Only include optional fields if they have actual values (not empty strings)
  if (data.email && data.email.trim()) {
    backendData.email = data.email.trim();
  }
  if (data.phone && data.phone.trim()) {
    backendData.phone = data.phone.trim();
  }
  if (data.practice_name && data.practice_name.trim()) {
    backendData.practice_name = data.practice_name.trim();
  }
  if (data.status) {
    backendData.status = statusToBackend(data.status);
  }
  if (data.notes && data.notes.trim()) {
    backendData.notes = data.notes.trim();
  }
  
  try {
    const response = await apiClient.post<Record<string, unknown>>('/api/providers', backendData);
    return providerFromBackend(response.data);
  } catch (error: unknown) {
    // Handle specific error codes with user-friendly messages
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { 
        response?: { 
          status: number; 
          data?: { 
            detail?: string | Array<{ loc?: string[]; msg?: string; type?: string }> 
          } 
        } 
      };
      const status = axiosError.response?.status;
      const detail = axiosError.response?.data?.detail;
      
      if (status === 409) {
        // Duplicate email or NPI
        const errorMsg = typeof detail === 'string' ? detail : 'A provider with this email already exists. Please use a different email.';
        throw new Error(errorMsg);
      }
      if (status === 422) {
        // Validation error - parse the detail array from FastAPI
        if (detail) {
          // FastAPI returns detail as an array of validation errors
          if (Array.isArray(detail)) {
            const messages = detail.map((err) => {
              // Extract field name from loc array (e.g., ["body", "email"] -> "email")
              const field = err.loc && err.loc.length > 1 ? err.loc[err.loc.length - 1] : 'field';
              const msg = err.msg || 'Invalid value';
              // Format field name nicely (e.g., "practice_name" -> "Practice Name")
              const fieldLabel = field.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
              return `${fieldLabel}: ${msg}`;
            });
            throw new Error(messages.join('. '));
          }
          // If detail is a string, use it directly
          if (typeof detail === 'string') {
            throw new Error(detail);
          }
        }
        throw new Error('Please check all required fields are filled correctly.');
      }
    }
    // Re-throw other errors
    throw error;
  }
}

/**
 * Update an existing provider
 */
export async function updateProvider(
  providerId: string,
  data: ProviderUpdateRequest
): Promise<Provider> {
  // Convert enums for backend
  const backendData: Record<string, unknown> = { ...data };
  if (data.status !== undefined) {
    backendData.status = statusToBackend(data.status);
  }
  // Specialty is free text - no conversion needed, send as-is
  // (already in backendData from spread)
  const response = await apiClient.patch<Record<string, unknown>>(`/api/providers/${providerId}`, backendData);
  return providerFromBackend(response.data);
}

/**
 * Archive (soft delete) a provider
 */
export async function archiveProvider(providerId: string): Promise<{ message: string }> {
  const response = await apiClient.delete<{ message: string }>(`/api/providers/${providerId}`);
  return response.data;
}

// =============================================================================
// Provider Dashboard & Stats
// =============================================================================

/**
 * Get provider dashboard statistics
 */
export async function getProviderStats(): Promise<ProviderDashboardStats> {
  const response = await apiClient.get<ProviderDashboardStats>('/api/providers/stats');
  return response.data;
}

/**
 * Get referrals for a specific provider
 */
export async function getProviderReferrals(
  providerId: string,
  page: number = 1,
  pageSize: number = 20
): Promise<{
  items: ProviderReferralLead[];
  total: number;
  page: number;
  page_size: number;
}> {
  const params = new URLSearchParams({
    page: page.toString(),
    page_size: pageSize.toString(),
  });

  const response = await apiClient.get(`/api/providers/${providerId}/referrals?${params.toString()}`);
  return response.data;
}

// =============================================================================
// Provider Status Management
// =============================================================================

/**
 * Activate a pending provider (verify them)
 */
export async function activateProvider(providerId: string): Promise<Provider> {
  return updateProvider(providerId, { status: 'active' as ProviderStatus });
}

/**
 * Deactivate a provider
 */
export async function deactivateProvider(providerId: string): Promise<Provider> {
  return updateProvider(providerId, { status: 'inactive' as ProviderStatus });
}

// =============================================================================
// Provider Search & Matching
// =============================================================================

/**
 * Search for providers by name/email for matching
 */
export async function searchProviders(
  query: string,
  limit: number = 10
): Promise<Provider[]> {
  const response = await getProviders(1, limit, { search: query });
  return response.items;
}

// =============================================================================
// React Query Keys
// =============================================================================

export const providerKeys = {
  all: ['providers'] as const,
  lists: () => [...providerKeys.all, 'list'] as const,
  list: (filters: ProviderFilters, page: number) => 
    [...providerKeys.lists(), filters, page] as const,
  details: () => [...providerKeys.all, 'detail'] as const,
  detail: (id: string) => [...providerKeys.details(), id] as const,
  stats: () => [...providerKeys.all, 'stats'] as const,
  referrals: (id: string) => [...providerKeys.all, 'referrals', id] as const,
  notes: (id: string) => [...providerKeys.all, 'notes', id] as const,
};

// =============================================================================
// Provider Notes History
// =============================================================================

/**
 * Provider note entry in history
 */
export interface ProviderNote {
  id: string;
  provider_id: string;
  note_text: string;
  note_type: string;
  created_by: string | null;
  created_at: string;
}

/**
 * Notes history response from API
 */
export interface ProviderNotesHistoryResponse {
  provider_id: string;
  provider_name: string;
  current_notes: string | null;
  notes_history: ProviderNote[];
  total_notes: number;
}

/**
 * Get the notes history for a provider
 */
export async function getProviderNotesHistory(providerId: string): Promise<ProviderNotesHistoryResponse> {
  const response = await apiClient.get<ProviderNotesHistoryResponse>(`/api/providers/${providerId}/notes`);
  return response.data;
}

/**
 * Add a new note to a provider
 */
export async function addProviderNote(
  providerId: string, 
  noteText: string, 
  noteType: string = 'general',
  createdBy?: string
): Promise<{ success: boolean; note: ProviderNote; message: string }> {
  const response = await apiClient.post(`/api/providers/${providerId}/notes`, {
    note_text: noteText,
    note_type: noteType,
    created_by: createdBy,
  });
  return response.data;
}
