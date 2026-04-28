/**
 * Shared Lead Mapper Utility
 * 
 * Single source of truth for converting snake_case API responses
 * to the camelCase Lead type used throughout the frontend.
 * 
 * This eliminates the bug factory of maintaining multiple manual
 * mapping blocks across different components.
 * 
 * @module utils/leadMapper
 * @version 1.0.0
 */

import type { Lead } from '../types/lead';

/**
 * Safely extract a string value from an unknown input.
 * Handles null, undefined, "null", "undefined", "none", "None" as empty strings.
 */
function safe(val: unknown): string {
  if (val == null) return '';
  const s = String(val).trim();
  if (['null', 'undefined', 'none', 'NULL', 'UNDEFINED', 'NONE'].includes(s)) return '';
  return s;
}

/**
 * Map a raw API response (snake_case) to a fully-typed Lead object (camelCase).
 * 
 * This is the SINGLE mapping function used everywhere a `getLeadById()` response
 * needs to be converted to a `Lead`. Adding a new field here automatically
 * propagates to every consumer (detail modals, edit modals, etc.).
 * 
 * @param response - Raw API response object (snake_case fields)
 * @param fallbackId - Optional fallback ID if response.id is missing
 * @returns Fully-typed Lead object
 */
export function mapApiResponseToLead(response: Record<string, unknown>, fallbackId?: string): Lead {
  // Normalize status: backend returns UPPER_CASE, frontend expects "lower case" with spaces
  const rawStatus = safe(response.status || response.Status);
  const normalizedStatus = rawStatus.toLowerCase().replace(/_/g, ' ') || 'new';

  // Normalize priority: backend returns UPPER_CASE, frontend expects lowercase
  const normalizedPriority = safe(response.priority).toLowerCase() || 'low';

  return {
    id: safe(response.id) || fallbackId || '',
    leadId: safe(response.lead_number) || safe(response.id) || fallbackId || '',

    // Personal info
    firstName: safe(response.first_name || response.firstName),
    lastName: safe(response.last_name || response.lastName),
    email: safe(response.email),
    phone: safe(response.phone),

    // Clinical
    condition: safe(response.condition),
    primaryCondition: (safe(response.condition) || 'OTHER') as Lead['primaryCondition'],
    symptomDuration: safe(response.symptom_duration || response.symptomDuration),
    priorTreatments: Array.isArray(response.prior_treatments)
      ? response.prior_treatments as string[]
      : Array.isArray(response.priorTreatments)
        ? response.priorTreatments as string[]
        : [],
    currentMedications: false,

    // Insurance
    hasInsurance: (response.has_insurance ?? response.hasInsurance ?? false) as boolean,
    insuranceProvider: safe(response.insurance_provider || response.insuranceProvider),

    // Location
    zipCode: safe(response.zip_code || response.zipCode),
    isInServiceArea: (response.in_service_area ?? response.isInServiceArea ?? false) as boolean,
    leadLocation: safe(response.lead_location || response.leadLocation) || undefined,

    // Preferences
    desiredStart: (safe(response.urgency).toLowerCase() || 'exploring') as Lead['desiredStart'],
    urgency: safe(response.urgency),
    preferredContactMethod: 'phone',

    // Scoring
    leadScore: (response.score as number) || (response.leadScore as number) || 0,
    priority: normalizedPriority as Lead['priority'],
    status: normalizedStatus as Lead['status'],

    // Notes
    notes: safe(response.notes),

    // TMS Therapy Interest
    tmsTherapyInterest: safe(response.tms_therapy_interest) || undefined,

    // Attribution
    utmSource: safe(response.utm_source || response.utmSource) || undefined,
    utmMedium: safe(response.utm_medium || response.utmMedium) || undefined,
    utmCampaign: safe(response.utm_campaign || response.utmCampaign) || undefined,
    referrerUrl: safe(response.referrer_url || response.referrerUrl) || undefined,
    leadSource: safe(response.source || response.leadSource) || undefined,

    // Timestamps
    createdAt: safe(response.created_at || response.createdAt) || new Date().toISOString(),
    updatedAt: safe(response.updated_at || response.updatedAt) || new Date().toISOString(),
  };
}

export default mapApiResponseToLead;
