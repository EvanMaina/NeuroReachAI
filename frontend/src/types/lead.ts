/**
 * Lead type definitions for NeuroReach AI
 * 
 * Shared across all lead-related components.
 */

/**
 * Lead priority levels for TMS patient qualification
 */
export type LeadPriority = 'hot' | 'medium' | 'low' | 'disqualified';

/**
 * Lead status in the pipeline
 * Must match backend LeadStatus enum exactly
 */
export type LeadStatus = 
  | 'new' 
  | 'contacted' 
  | 'scheduled' 
  | 'consultation complete'  // Backend uses CONSULTATION_COMPLETE
  | 'treatment started'       // Backend uses TREATMENT_STARTED
  | 'lost' 
  | 'disqualified';

/**
 * Contact outcome for coordinator outreach tracking
 * Tracks the result of each contact attempt
 */
export type ContactOutcome = 
  | 'NEW'                 // Not contacted yet
  | 'ANSWERED'            // Spoke with lead, can proceed to schedule
  | 'NO_ANSWER'           // Called but no pickup, needs follow-up
  | 'UNREACHABLE'         // Wrong number, disconnected, etc.
  | 'CALLBACK_REQUESTED'  // Lead asked to call back at specific time
  | 'SCHEDULED'           // Consultation has been scheduled
  | 'COMPLETED'           // Consultation completed successfully
  | 'NOT_INTERESTED';     // Lead declined, archive

/**
 * Contact outcome configuration for UI display
 * Uses Lucide icon names for production-ready SVG icons
 */
export const CONTACT_OUTCOME_CONFIG: Record<ContactOutcome, {
  label: string;
  iconName: 'Sparkles' | 'CheckCircle2' | 'PhoneMissed' | 'PhoneOff' | 'Clock' | 'Ban' | 'Calendar' | 'CheckCircle';
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
  iconColor: string;
  ringColor: string;
}> = {
  NEW: {
    label: 'New',
    iconName: 'Sparkles',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    description: 'Not contacted yet',
    iconColor: 'text-blue-500',
    ringColor: 'ring-blue-400',
  },
  ANSWERED: {
    label: 'Answered',
    iconName: 'CheckCircle2',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    description: 'Spoke with lead, ready to schedule',
    iconColor: 'text-emerald-500',
    ringColor: 'ring-emerald-400',
  },
  NO_ANSWER: {
    label: 'No Answer',
    iconName: 'PhoneMissed',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    description: 'Called but no pickup',
    iconColor: 'text-amber-500',
    ringColor: 'ring-amber-400',
  },
  UNREACHABLE: {
    label: 'Unreachable',
    iconName: 'PhoneOff',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    description: 'Wrong number or disconnected',
    iconColor: 'text-red-500',
    ringColor: 'ring-red-400',
  },
  CALLBACK_REQUESTED: {
    label: 'Callback',
    iconName: 'Clock',
    color: 'text-violet-700',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-200',
    description: 'Lead requested callback',
    iconColor: 'text-violet-500',
    ringColor: 'ring-violet-400',
  },
  NOT_INTERESTED: {
    label: 'Not Interested',
    iconName: 'Ban',
    color: 'text-slate-700',
    bgColor: 'bg-slate-100',
    borderColor: 'border-slate-300',
    description: 'Lead declined',
    iconColor: 'text-slate-500',
    ringColor: 'ring-slate-400',
  },
  SCHEDULED: {
    label: 'Scheduled',
    iconName: 'Calendar',
    color: 'text-teal-700',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-200',
    description: 'Consultation scheduled',
    iconColor: 'text-teal-500',
    ringColor: 'ring-teal-400',
  },
  COMPLETED: {
    label: 'Completed',
    iconName: 'CheckCircle',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    description: 'Consultation completed',
    iconColor: 'text-green-500',
    ringColor: 'ring-green-400',
  },
};

/**
 * Primary condition the patient is seeking treatment for
 * Must match backend ConditionType enum exactly
 */
export type ConditionType = 
  | 'DEPRESSION' 
  | 'ANXIETY' 
  | 'OCD' 
  | 'PTSD' 
  | 'OTHER';

/**
 * Complete lead record from database
 */
export interface Lead {
  id: string;
  leadId: string; // Human-readable ID like NR-2026-001
  
  // Personal Info
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth?: string;
  
  // Clinical
  primaryCondition: ConditionType;
  otherConditionText?: string;
  symptomDuration: string;
  priorTreatments: string[];
  currentMedications: boolean;
  
  // Insurance
  hasInsurance: boolean;
  insuranceProvider?: string;
  
  // Location
  zipCode: string;
  isInServiceArea: boolean;
  
  // Preferences
  desiredStart: 'asap' | 'within_30_days' | 'exploring';
  preferredContactMethod: 'phone' | 'email' | 'sms';
  
  // Scoring
  leadScore: number;
  priority: LeadPriority;
  status: LeadStatus;
  
  // Edit modal compatibility fields (populated from raw API response)
  condition?: string;
  urgency?: string;
  notes?: string;
  
  // Attribution
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  lastContactedAt?: string;
}

/**
 * Lead for table display (subset of full Lead)
 */
export interface LeadTableRow {
  id: string;
  leadId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  condition: string;
  // Multi-condition support
  conditions?: string[];
  otherConditionText?: string;
  // Preferred contact method
  preferredContactMethod?: string;
  priority: LeadPriority;
  status: LeadStatus;
  submittedAt: string;
  // Contact outcome tracking
  contactOutcome?: ContactOutcome;
  contactAttempts?: number;
  lastContactAttempt?: string;
  scheduledCallbackAt?: string;
  // Next follow-up / requested callback time (distinct from consultation time)
  nextFollowUpAt?: string;
  // Last activity timestamp - tracks when lead was last modified (NULL for untouched leads)
  lastUpdatedAt?: string;
  // Follow-up reason tag (e.g., "No Answer", "Callback Requested", "No Show")
  followUpReason?: string;
  // Referral tracking
  isReferral?: boolean;
  referringProviderName?: string;
  referringProviderId?: string;
}

/**
 * Filters for lead queries
 */
export interface LeadFilters {
  priority?: LeadPriority[];
  status?: LeadStatus[];
  dateFrom?: string;
  dateTo?: string;
  searchQuery?: string;
}

/**
 * Preferred contact method options
 */
export type PreferredContactMethod = 'phone_call' | 'text' | 'email' | 'any';

/**
 * Lead submission data from intake widget
 * Field names must match backend API schema (snake_case)
 * 
 * UPDATED: Now includes all fields for Jotform parity:
 * - Multi-condition support
 * - Severity assessments (PHQ-2, GAD-2, OCD, PTSD)
 * - Preferred contact method
 */
export interface LeadSubmitData {
  first_name: string;
  last_name?: string;
  email: string;
  phone: string;
  date_of_birth?: string;  // Date of Birth in YYYY-MM-DD format
  
  // Primary condition (legacy field for backward compatibility)
  condition: ConditionType;
  condition_other?: string;
  
  // Multi-condition support (NEW - array of conditions)
  conditions?: ConditionType[];
  other_condition_text?: string;
  
  // Severity Assessments (NEW - conditional based on conditions)
  // PHQ-2 for Depression (0-3 scale each)
  phq2_interest?: number | null;
  phq2_mood?: number | null;
  
  // GAD-2 for Anxiety (0-3 scale each)
  gad2_nervous?: number | null;
  gad2_worry?: number | null;
  
  // OCD severity (1-4 scale)
  ocd_time_occupied?: number | null;
  
  // PTSD severity (0-4 scale)
  ptsd_intrusion?: number | null;
  
  // Other intake fields
  symptom_duration: DurationType;
  prior_treatments: TreatmentType[];
  has_insurance: boolean;
  insurance_provider?: string;
  other_insurance_provider?: string;
  zip_code: string;
  urgency: UrgencyType;
  hipaa_consent: boolean;
  sms_consent: boolean;
  
  // Preferred contact method (NEW - REQUIRED)
  preferred_contact_method?: PreferredContactMethod;
  
  // TMS Therapy Interest (NEW - matches Jotform)
  tms_therapy_interest?: TMSInterestType;
  
  // Referral information (NEW - matches Jotform)
  is_referral?: boolean;
  referring_provider_name?: string;
  referring_provider_specialty?: string;
  referring_clinic?: string;
  referring_provider_email?: string;
  
  // UTM tracking
  utm_params?: IUTMParams;
  referrer_url?: string;
}

/**
 * Response from lead submission endpoint
 */
export interface LeadSubmitResponse {
  success: boolean;
  leadId: string;
  priority: LeadPriority;
  message: string;
}

// Backward compatibility aliases for existing components
export type ILeadSubmitResponse = LeadSubmitResponse;
export type PriorityType = LeadPriority;

/**
 * Lead creation data (alias for backward compatibility)
 */
export interface ILeadCreate extends LeadSubmitData {}

/**
 * Lead response from API
 */
export interface ILeadResponse extends Lead {}

/**
 * Lead list item for tables
 */
export interface ILeadListItem extends LeadTableRow {}

/**
 * Paginated response
 */
export interface IPaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  /** Backend uses `page_size` */
  page_size: number;
  /** Backend uses `total_pages` */
  total_pages: number;
  /** Backend uses `has_next` */
  has_next: boolean;
  /** Backend uses `has_previous` */
  has_previous: boolean;
}

/**
 * UTM tracking parameters
 * Field names must match backend API schema (snake_case)
 */
export interface IUTMParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
}

/**
 * Duration options for symptom duration
 * Must match backend DurationType enum exactly
 */
export type DurationType = 
  | 'LESS_THAN_6_MONTHS' 
  | 'SIX_TO_TWELVE_MONTHS' 
  | 'MORE_THAN_12_MONTHS';

/**
 * Treatment options for prior treatments
 * Must match backend TreatmentType enum exactly
 */
export type TreatmentType = 
  | 'ANTIDEPRESSANTS' 
  | 'THERAPY_CBT' 
  | 'BOTH' 
  | 'NONE' 
  | 'OTHER';

/**
 * Urgency options for treatment start
 * Must match backend UrgencyType enum exactly
 */
export type UrgencyType = 
  | 'ASAP' 
  | 'WITHIN_30_DAYS' 
  | 'EXPLORING';

/**
 * TMS Therapy Interest options
 * SAINT Protocol only available for Depression
 */
export type TMSInterestType = 
  | 'daily_tms' 
  | 'accelerated_tms' 
  | 'saint_protocol'  // Depression only
  | 'not_sure';

/**
 * Condition labels for display
 */
export const CONDITION_LABELS: Record<ConditionType, string> = {
  DEPRESSION: 'Depression',
  ANXIETY: 'Anxiety',
  OCD: 'OCD',
  PTSD: 'PTSD',
  OTHER: 'Other',
};

/**
 * Duration labels for display
 */
export const DURATION_LABELS: Record<DurationType, string> = {
  LESS_THAN_6_MONTHS: 'Less than 6 months',
  SIX_TO_TWELVE_MONTHS: '6-12 months',
  MORE_THAN_12_MONTHS: 'More than 12 months',
};

/**
 * Treatment labels for display
 */
export const TREATMENT_LABELS: Record<TreatmentType, string> = {
  ANTIDEPRESSANTS: 'Antidepressants',
  THERAPY_CBT: 'Therapy/CBT',
  BOTH: 'Both medication and therapy',
  NONE: 'None',
  OTHER: 'Other treatments',
};

/**
 * Urgency labels for display
 */
export const URGENCY_LABELS: Record<UrgencyType, string> = {
  ASAP: 'As soon as possible',
  WITHIN_30_DAYS: 'Within 30 days',
  EXPLORING: 'Just exploring options',
};
