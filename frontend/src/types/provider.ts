/**
 * Referring Providers TypeScript Types
 * 
 * Types for managing healthcare providers who refer patients to the clinic.
 */

// =============================================================================
// Enums
// =============================================================================

/**
 * Provider Specialty Types
 * 
 * IMPORTANT: Specialty is now FREE TEXT - any string value is allowed.
 * The backend stores exactly what the user types (no mapping, no transformation).
 * 
 * Common values: Psychiatrist, Psychologist, Neurologist, Family Medicine, etc.
 * But ANY text is valid: "Underwater Basket Weaving Medicine", "xyz123", etc.
 * 
 * RULE: User types X → Database stores X → Dashboard shows X
 */
export type ProviderSpecialty = string;  // Free text - any value allowed

export type ProviderStatus =
  | 'active'
  | 'pending'
  | 'inactive'
  | 'archived';

export type ProviderContactMethod =
  | 'email'
  | 'phone'
  | 'fax'
  | 'portal';

// =============================================================================
// Provider Types
// =============================================================================

export interface Provider {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  fax: string | null;
  practice_name: string | null;
  specialty: ProviderSpecialty;
  status: ProviderStatus;
  preferred_contact: ProviderContactMethod;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  npi_number: string | null;
  notes: string | null;
  total_referrals: number;
  converted_referrals: number;
  conversion_rate: number;
  last_referral_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProviderSummary {
  id: string;
  name: string;
  practice_name: string | null;
  specialty: ProviderSpecialty;
  status: ProviderStatus;
  total_referrals: number;
  conversion_rate: number;
}

// =============================================================================
// API Request Types
// =============================================================================

export interface ProviderCreateRequest {
  name: string;
  email?: string | null;
  phone?: string | null;
  fax?: string | null;
  practice_name?: string | null;
  specialty: ProviderSpecialty;
  status?: ProviderStatus;
  preferred_contact?: ProviderContactMethod;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  npi_number?: string | null;
  notes?: string | null;
}

export interface ProviderUpdateRequest {
  name?: string;
  email?: string | null;
  phone?: string | null;
  fax?: string | null;
  practice_name?: string | null;
  specialty?: ProviderSpecialty;
  status?: ProviderStatus;
  preferred_contact?: ProviderContactMethod;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  npi_number?: string | null;
  notes?: string | null;
}

// =============================================================================
// API Response Types
// =============================================================================

export interface ProviderListResponse {
  items: Provider[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export interface ProviderDashboardStats {
  total_providers: number;
  active_providers: number;
  pending_providers: number;
  total_referrals: number;
  converted_referrals: number;
  overall_conversion_rate: number;
  referrals_this_month: number;
  top_providers: ProviderSummary[];
}

export interface ProviderReferralLead {
  id: string;
  lead_number: string;
  first_name: string;
  last_name: string;
  condition: string;
  priority: string;
  status: string;
  is_converted: boolean;
  created_at: string;
}

// =============================================================================
// Filter Types
// =============================================================================

export interface ProviderFilters {
  status?: ProviderStatus;
  specialty?: ProviderSpecialty;
  search?: string;
}

// =============================================================================
// Display Helpers
// =============================================================================

/**
 * Known specialty labels for common values.
 * For free-text specialties not in this map, the raw value is displayed.
 */
export const KNOWN_SPECIALTY_LABELS: Record<string, string> = {
  psychiatrist: 'Psychiatrist',
  psychologist: 'Psychologist',
  therapist: 'Therapist',
  primary_care: 'Primary Care',
  neurologist: 'Neurologist',
  social_worker: 'Social Worker',
  nurse_practitioner: 'Nurse Practitioner',
  other: 'Other',
  // Also handle UPPERCASE from legacy data
  PSYCHIATRIST: 'Psychiatrist',
  PSYCHOLOGIST: 'Psychologist',
  THERAPIST: 'Therapist',
  PRIMARY_CARE: 'Primary Care',
  NEUROLOGIST: 'Neurologist',
  SOCIAL_WORKER: 'Social Worker',
  NURSE_PRACTITIONER: 'Nurse Practitioner',
  OTHER: 'Other',
};

/**
 * Get display label for a specialty.
 * Returns the known label if exists, otherwise returns the raw value (free text).
 * 
 * RULE: User types X → Database stores X → Dashboard shows X
 */
export function getSpecialtyLabel(specialty: string | null | undefined): string {
  if (!specialty) return '—';
  // Check if it's a known specialty, otherwise return raw value
  return KNOWN_SPECIALTY_LABELS[specialty] || specialty;
}

// Legacy export for backward compatibility (deprecated)
export const SPECIALTY_LABELS = KNOWN_SPECIALTY_LABELS;

export const STATUS_LABELS: Record<ProviderStatus, string> = {
  active: 'Active',
  pending: 'Pending Verification',
  inactive: 'Inactive',
  archived: 'Archived',
};

export const STATUS_COLORS: Record<ProviderStatus, string> = {
  active: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  inactive: 'bg-gray-100 text-gray-800',
  archived: 'bg-red-100 text-red-800',
};

export const CONTACT_METHOD_LABELS: Record<ProviderContactMethod, string> = {
  email: 'Email',
  phone: 'Phone',
  fax: 'Fax',
  portal: 'Provider Portal',
};
