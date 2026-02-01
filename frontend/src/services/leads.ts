/**
 * Lead API service.
 * 
 * Provides functions for lead submission, retrieval, and metrics.
 */

import { apiClient } from './api';

// =============================================================================
// Queue Metrics Types
// =============================================================================

/**
 * Queue type filter options for metrics API
 */
export type QueueTypeFilter = 
  | 'all' 
  | 'new' 
  | 'contacted'  // All leads with contact attempts (inclusive view)
  | 'followup' 
  | 'callback' 
  | 'scheduled' 
  | 'completed'  // Consultation complete - Success!
  | 'unreachable'
  | 'hot' 
  | 'medium' 
  | 'low';

/**
 * Trend period options for monthly trends API
 */
export type TrendPeriod = '6m' | '12m' | 'ytd' | 'all';

/**
 * Daily trend period options
 */
export type DailyTrendPeriod = '7d' | '14d' | '30d' | '60d';

/**
 * Response from queue metrics endpoint
 */
export interface IQueueMetricsResponse {
  queue_type: string;
  total_count: number;
  added_today: number;
  added_this_week: number;
  conversion_rate: number;
  response_rate: number;
  avg_time_in_queue_hours: number | null;
  scheduled_count: number;
  contacted_count: number;
  unreachable_count: number;
}

/**
 * Single data point for monthly trend
 */
export interface IMonthlyTrendDataPoint {
  month: string;           // Format: "2026-01"
  label: string;           // Display label: "Jan"
  total_leads: number;
  hot_leads: number;
  medium_leads: number;
  low_leads: number;
  scheduled_count: number;
  conversion_rate: number;
}

/**
 * Response from monthly trends endpoint
 */
export interface IMonthlyTrendsResponse {
  period: string;
  data: IMonthlyTrendDataPoint[];
  summary: {
    total_leads: number;
    monthly_average: number;
    peak_month: string;
    peak_count: number;
    num_months: number;
  };
}

/**
 * Single data point for daily trend
 */
export interface IDailyTrendDataPoint {
  date: string;           // Format: "2026-01-25"
  label: string;          // Display label: "Jan 25"
  day_of_week: string;    // "Mon", "Tue", etc.
  total_leads: number;
  hot_leads: number;
  medium_leads: number;
  low_leads: number;
  scheduled_count: number;
  conversion_rate: number;
}

/**
 * Response from daily trends endpoint
 */
export interface IDailyTrendsResponse {
  period: string;
  data: IDailyTrendDataPoint[];
  summary: {
    total_leads: number;
    daily_average: number;
    peak_day: string;
    peak_count: number;
    num_days: number;
  };
}

/**
 * Response from dashboard summary endpoint
 * 
 * METRIC DEFINITIONS (from backend):
 * - total_leads: ALL non-deleted leads in system (for historical context)
 * - active_leads: Non-deleted leads excluding terminal statuses (MATCHES TABLE VIEW)
 *   Terminal statuses: consultation_complete, treatment_started, lost, disqualified
 * - hot_leads: Active HOT priority leads (in non-terminal statuses)
 * - new_leads: Leads that have NEVER been contacted (contact_outcome='NEW' or null)
 * - scheduled_today: Leads with consultation scheduled for today
 * - overall_response_rate: (Answered + Callback Requested) / Total Contacted × 100%
 * - overall_conversion_rate: (Scheduled + Complete) / Total Leads × 100%
 * - leads_this_week: Leads created since Monday
 * - leads_today: Leads created today
 */
export interface IDashboardSummaryResponse {
  total_leads: number;      // All non-deleted leads (historical context)
  active_leads: number;     // Non-deleted, non-terminal leads (MATCHES TABLE COUNT)
  hot_leads: number;
  new_leads: number;
  scheduled_today: number;
  overall_response_rate: number;
  overall_conversion_rate: number;
  leads_this_week: number;
  leads_today: number;
}

// =============================================================================
// Metrics API Functions
// =============================================================================

/**
 * Get queue-specific metrics.
 * 
 * @param queueType - The queue to get metrics for
 * @returns Promise with queue metrics
 */
export async function getQueueMetrics(
  queueType: QueueTypeFilter = 'all'
): Promise<IQueueMetricsResponse> {
  const response = await apiClient.get<IQueueMetricsResponse>(
    '/api/metrics/leads/metrics',
    { params: { queue_type: queueType } }
  );
  return response.data;
}

/**
 * Get monthly lead trends.
 * 
 * @param period - Time period to retrieve ('6m', '12m', 'ytd', 'all')
 * @returns Promise with monthly trend data
 */
export async function getMonthlyTrends(
  period: TrendPeriod = '12m'
): Promise<IMonthlyTrendsResponse> {
  const response = await apiClient.get<IMonthlyTrendsResponse>(
    '/api/metrics/analytics/trends/monthly',
    { params: { period } }
  );
  return response.data;
}

/**
 * Get daily lead trends.
 * 
 * @param period - Time period to retrieve ('7d', '14d', '30d', '60d')
 * @returns Promise with daily trend data
 */
export async function getDailyTrends(
  period: DailyTrendPeriod = '30d'
): Promise<IDailyTrendsResponse> {
  const response = await apiClient.get<IDailyTrendsResponse>(
    '/api/metrics/analytics/trends/daily',
    { params: { period } }
  );
  return response.data;
}

/**
 * Get dashboard summary metrics.
 * 
 * @returns Promise with dashboard summary
 */
export async function getDashboardSummary(): Promise<IDashboardSummaryResponse> {
  const response = await apiClient.get<IDashboardSummaryResponse>(
    '/api/metrics/analytics/dashboard-summary'
  );
  return response.data;
}

// =============================================================================
// Lead Types and Functions
// =============================================================================
import type {
  ILeadCreate,
  ILeadSubmitResponse,
  ILeadResponse,
  ILeadListItem,
  IPaginatedResponse,
  PriorityType,
  LeadStatus,
  ContactOutcome,
} from '../types/lead';

/**
 * Convert frontend LeadStatus (lowercase, spaces) -> backend LeadStatus (UPPERCASE, underscores)
 *
 * Frontend uses human-readable values in the UI, while FastAPI expects enum values.
 */
function toBackendLeadStatus(status: LeadStatus): string {
  switch (status) {
    case 'consultation complete':
      return 'CONSULTATION_COMPLETE';
    case 'treatment started':
      return 'TREATMENT_STARTED';
    default:
      return status.toUpperCase().replace(/\s+/g, '_');
  }
}

/**
 * Submit a new lead from the intake widget.
 * 
 * @param leadData - Lead form data
 * @returns Promise with submission response
 */
export async function submitLead(
  leadData: ILeadCreate
): Promise<ILeadSubmitResponse> {
  const response = await apiClient.post<ILeadSubmitResponse>(
    '/api/leads/submit',
    leadData
  );
  return response.data;
}

/**
 * Parameters for listing leads.
 */
export interface IListLeadsParams {
  page?: number;
  page_size?: number;
  priority?: PriorityType;
  /** Filter by status (frontend value). Will be sent as backend's `status_filter` */
  status?: LeadStatus;
  contact_outcome_filter?: ContactOutcome;
  in_service_area?: boolean;
}

/**
 * Map backend lead response (snake_case) to frontend format (camelCase)
 * Handles null/undefined values gracefully with proper fallbacks
 */
function mapLeadResponse(lead: Record<string, unknown>): ILeadListItem {
  // Safely extract string values with fallbacks
  const firstName = (lead.first_name as string) || '';
  const lastName = (lead.last_name as string) || '';
  const priority = (lead.priority as string) || 'medium';
  const status = (lead.status as string) || 'new';
  
  return {
    id: (lead.id as string) || '',
    leadId: (lead.lead_number as string) || '',
    firstName: firstName,
    lastName: lastName,
    email: (lead.email as string) || '',
    phone: (lead.phone as string) || '',
    condition: (lead.condition as string) || '',
    priority: priority.toLowerCase() as PriorityType,
    status: status.toLowerCase().replace(/_/g, ' ') as LeadStatus,
    submittedAt: (lead.created_at as string) || '',
    // Contact outcome tracking
    contactOutcome: lead.contact_outcome as ContactOutcome,
    contactAttempts: (lead.contact_attempts as number) || 0,
    lastContactAttempt: lead.last_contact_attempt as string | undefined,
    scheduledCallbackAt: lead.scheduled_callback_at as string | undefined,
    // Next follow-up / requested callback time (distinct from consultation time)
    nextFollowUpAt: lead.next_follow_up_at as string | undefined,
    // Last activity timestamp - CRITICAL FIX: Map from backend's last_updated_at
    lastUpdatedAt: lead.last_updated_at as string | undefined,
    // Referral tracking (snake_case from API -> camelCase for frontend)
    isReferral: (lead.is_referral as boolean) || false,
    referringProviderName: lead.referring_provider_name as string | undefined,
    referringProviderId: lead.referring_provider_id as string | undefined,
    // Follow-up reason tag from outcome workflow
    followUpReason: lead.follow_up_reason as string | undefined,
    // Multi-condition intake fields
    conditions: lead.conditions as string[] | undefined,
    otherConditionText: lead.other_condition_text as string | undefined,
    preferredContactMethod: lead.preferred_contact_method as string | undefined,
  };
}

/**
 * Get paginated list of leads for dashboard.
 * 
 * @param params - Pagination and filter parameters
 * @returns Promise with paginated lead list
 */
export async function listLeads(
  params: IListLeadsParams = {}
): Promise<IPaginatedResponse<ILeadListItem>> {
  // Backend expects `status_filter` not `status`, and expects enum values.
  const { status, ...rest } = params;
  const apiParams: Record<string, unknown> = { ...rest };
  if (status) {
    apiParams.status_filter = toBackendLeadStatus(status);
  }

  const response = await apiClient.get<{ items: Record<string, unknown>[]; total: number; page: number; page_size: number; total_pages: number; has_next: boolean; has_previous: boolean }>(
    '/api/leads',
    { params: apiParams }
  );
  
  // Map snake_case API response to camelCase frontend format
  return {
    items: response.data.items.map(mapLeadResponse),
    total: response.data.total,
    page: response.data.page,
    page_size: response.data.page_size,
    total_pages: response.data.total_pages,
    has_next: response.data.has_next,
    has_previous: response.data.has_previous,
  };
}

/**
 * Get detailed lead information by ID.
 * 
 * @param leadId - UUID of lead to retrieve
 * @returns Promise with lead details
 */
export async function getLeadById(leadId: string): Promise<ILeadResponse> {
  const response = await apiClient.get<ILeadResponse>(`/api/leads/${leadId}`);
  return response.data;
}

/**
 * Update lead status.
 * 
 * @param leadId - UUID of lead to update
 * @param newStatus - New status value
 * @returns Promise with updated lead details
 */
export async function updateLeadStatus(
  leadId: string,
  newStatus: LeadStatus
): Promise<ILeadResponse> {
  const response = await apiClient.patch<ILeadResponse>(
    `/api/leads/${leadId}/status`,
    null,
    { params: { new_status: toBackendLeadStatus(newStatus) } }
  );
  return response.data;
}

/**
 * Contact method options
 */
export type ContactMethod = 'PHONE' | 'EMAIL' | 'SMS' | 'VIDEO_CALL';

/**
 * Schedule type - callback vs consultation
 */
export type ScheduleType = 'callback' | 'consultation';

/**
 * Schedule callback request
 */
export interface IScheduleCallbackRequest {
  scheduled_callback_at: string; // ISO datetime
  scheduled_notes?: string;
  contact_method: ContactMethod;
  /** Type of schedule - 'callback' stays in follow-up queue, 'consultation' moves to scheduled */
  schedule_type?: ScheduleType;
}

/**
 * Schedule a callback for a lead.
 * 
 * @param leadId - UUID of lead to schedule
 * @param scheduleData - Scheduling information
 * @returns Promise with updated lead details
 */
export async function scheduleCallback(
  leadId: string,
  scheduleData: IScheduleCallbackRequest
): Promise<ILeadResponse> {
  const response = await apiClient.post<ILeadResponse>(
    `/api/leads/${leadId}/schedule`,
    scheduleData
  );
  return response.data;
}

/**
 * Log contact attempt request
 */
export interface ILogContactAttemptRequest {
  contact_method: ContactMethod;
  was_successful: boolean;
  notes?: string;
  next_follow_up_at?: string; // ISO datetime
}

/**
 * Log a contact attempt for a lead.
 * 
 * @param leadId - UUID of lead
 * @param attemptData - Contact attempt information
 * @returns Promise with updated lead details
 */
export async function logContactAttempt(
  leadId: string,
  attemptData: ILogContactAttemptRequest
): Promise<ILeadResponse> {
  const response = await apiClient.post<ILeadResponse>(
    `/api/leads/${leadId}/contact-attempt`,
    attemptData
  );
  return response.data;
}

/**
 * Scheduled lead for calendar view
 */
export interface IScheduledLead {
  id: string;
  lead_number?: string;
  first_name: string;
  last_name?: string;
  condition: string;
  priority: PriorityType;
  status: LeadStatus;
  scheduled_callback_at: string;
  scheduled_notes?: string;
  contact_method?: ContactMethod;
  contact_attempts?: number;
  phone?: string;
}

/**
 * Get scheduled leads for calendar view.
 * 
 * @param startDate - Optional start date filter
 * @param endDate - Optional end date filter
 * @returns Promise with list of scheduled leads
 */
export async function getScheduledLeads(
  startDate?: string,
  endDate?: string
): Promise<IScheduledLead[]> {
  const params: Record<string, string> = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  
  const response = await apiClient.get<IScheduledLead[]>(
    '/api/leads/scheduled/calendar',
    { params }
  );
  return response.data;
}

/**
 * Update contact outcome request
 */
export interface IUpdateContactOutcomeRequest {
  contact_outcome: ContactOutcome;
  notes?: string;
  next_follow_up_at?: string; // ISO datetime
}

/**
 * Update contact outcome for a lead.
 * 
 * Used by coordinators to track outreach results:
 * - NEW: Not contacted yet
 * - ANSWERED: Spoke with lead, can proceed to schedule
 * - NO_ANSWER: Called but no pickup, needs follow-up
 * - UNREACHABLE: Wrong number, disconnected, etc.
 * - CALLBACK_REQUESTED: Lead asked to call back at specific time
 * - NOT_INTERESTED: Lead declined, archive
 * 
 * @param leadId - UUID of lead to update
 * @param outcomeData - Contact outcome information
 * @returns Promise with updated lead details
 */
export async function updateContactOutcome(
  leadId: string,
  outcomeData: IUpdateContactOutcomeRequest
): Promise<ILeadResponse> {
  const response = await apiClient.patch<ILeadResponse>(
    `/api/leads/${leadId}/contact-outcome`,
    outcomeData
  );
  return response.data;
}

/**
 * Lead update request - all fields optional
 */
export interface ILeadUpdateRequest {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  condition?: string;
  condition_other?: string;
  symptom_duration?: string;
  prior_treatments?: string[];
  has_insurance?: boolean;
  insurance_provider?: string;
  zip_code?: string;
  urgency?: string;
  notes?: string;
  status?: string;
  priority?: string;
}

/**
 * Update a lead's information.
 * 
 * @param leadId - UUID of lead to update
 * @param updateData - Fields to update (all optional)
 * @returns Promise with updated lead details
 */
export async function updateLead(
  leadId: string,
  updateData: ILeadUpdateRequest
): Promise<ILeadResponse> {
  const response = await apiClient.patch<ILeadResponse>(
    `/api/leads/${leadId}`,
    updateData
  );
  return response.data;
}

/**
 * Delete response from backend
 */
export interface IDeleteLeadResponse {
  success: boolean;
  message: string;
  lead_number: string;
  lead_id: string;
}

/**
 * Soft delete a lead.
 * 
 * The lead is not permanently removed but marked as deleted.
 * Can be restored if needed.
 * 
 * @param leadId - UUID of lead to delete
 * @returns Promise with delete confirmation including lead number and message
 */
export async function deleteLead(leadId: string): Promise<IDeleteLeadResponse> {
  const response = await apiClient.delete<IDeleteLeadResponse>(`/api/leads/${leadId}`);
  return response.data;
}

// =============================================================================
// Deleted Leads (Admin Only) — Recovery View
// =============================================================================

/**
 * Deleted lead item for the recovery table
 */
export interface IDeletedLeadItem {
  id: string;
  lead_number: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  condition: string | null;
  conditions: string[];
  priority: string | null;
  status: string | null;
  created_at: string | null;
  deleted_at: string | null;
  is_referral: boolean;
  referring_provider_name: string | null;
}

/**
 * List soft-deleted leads (admin only).
 * 
 * @param page - Page number (1-indexed)
 * @param pageSize - Items per page
 * @returns Promise with paginated deleted leads
 */
export async function listDeletedLeads(
  page: number = 1,
  pageSize: number = 50
): Promise<IPaginatedResponse<IDeletedLeadItem>> {
  const response = await apiClient.get<{
    items: IDeletedLeadItem[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  }>('/api/leads/deleted', { params: { page, page_size: pageSize } });
  return response.data;
}

/**
 * Restore a soft-deleted lead (admin only).
 * 
 * @param leadId - UUID of the deleted lead to restore
 * @returns Promise with restored lead details
 */
export async function restoreLead(leadId: string): Promise<ILeadResponse> {
  const response = await apiClient.post<ILeadResponse>(`/api/leads/${leadId}/restore`);
  return response.data;
}

/**
 * Permanently delete a soft-deleted lead (admin only).
 * WARNING: This action cannot be undone.
 * 
 * @param leadId - UUID of the deleted lead to permanently remove
 * @returns Promise with confirmation
 */
export async function permanentDeleteLead(leadId: string): Promise<IDeleteLeadResponse> {
  const response = await apiClient.delete<IDeleteLeadResponse>(`/api/leads/${leadId}/permanent`);
  return response.data;
}

// =============================================================================
// Lead Notes API
// =============================================================================

/**
 * Note response from API
 */
export interface ILeadNote {
  id: string;
  lead_id: string;
  note_text: string;
  created_by: string | null;
  created_by_name: string;
  note_type: string;
  related_outcome: string | null;
  created_at: string;
}

/**
 * Create note request
 */
export interface ICreateNoteRequest {
  note_text: string;
  note_type?: string;
  related_outcome?: string;
}

/**
 * Get all notes for a lead (reverse chronological order).
 * 
 * @param leadId - UUID of the lead
 * @returns Promise with array of notes
 */
export async function getLeadNotes(leadId: string): Promise<ILeadNote[]> {
  const response = await apiClient.get<ILeadNote[]>(`/api/leads/${leadId}/notes`);
  return response.data;
}

/**
 * Create a new note for a lead.
 * 
 * @param leadId - UUID of the lead
 * @param noteData - Note content and metadata
 * @returns Promise with created note
 */
export async function createLeadNote(
  leadId: string,
  noteData: ICreateNoteRequest
): Promise<ILeadNote> {
  const response = await apiClient.post<ILeadNote>(
    `/api/leads/${leadId}/notes`,
    noteData
  );
  return response.data;
}

// =============================================================================
// Consultation Outcome API
// =============================================================================

/**
 * Consultation outcome types
 */
export type ConsultationOutcomeType = 
  | 'complete' 
  | 'reschedule' 
  | 'followup' 
  | 'no_show' 
  | 'cancelled';

/**
 * Update consultation outcome request
 */
export interface IUpdateConsultationOutcomeRequest {
  outcome: ConsultationOutcomeType;
  notes?: string;
  /** ISO datetime for reschedule/followup/callback date selection */
  scheduled_callback_at?: string;
  /** Contact method for callback */
  contact_method?: ContactMethod;
}

/**
 * Update consultation outcome for a scheduled lead.
 * Routes lead to proper queue based on outcome via backend workflow logic.
 * 
 * @param leadId - UUID of lead
 * @param outcomeData - Consultation outcome information
 * @returns Promise with updated lead details
 */
export async function updateConsultationOutcome(
  leadId: string,
  outcomeData: IUpdateConsultationOutcomeRequest
): Promise<ILeadResponse> {
  const response = await apiClient.patch<ILeadResponse>(
    `/api/leads/${leadId}/consultation-outcome`,
    outcomeData
  );
  return response.data;
}
