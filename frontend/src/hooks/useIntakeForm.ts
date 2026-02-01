/**
 * Custom hook for managing intake form state.
 * 
 * Handles multi-step form navigation and data collection.
 * 
 * UPDATED v4.0: Now matches Jotform intake with:
 * - Multi-condition selection
 * - Conditional severity assessments (PHQ-2, GAD-2, OCD, PTSD)
 * - TMS Therapy Interest (with SAINT Protocol for Depression only)
 * - Preferred contact method
 * - REFERRAL QUESTIONS (NEW) - matches Jotform exactly
 * 
 * @module hooks/useIntakeForm
 * @version 4.0.0
 */

import { useState, useCallback, useMemo } from 'react';
import type {
  ILeadCreate,
  ConditionType,
  DurationType,
  TreatmentType,
  UrgencyType,
  TMSInterestType,
} from '../types/lead';
import { getMarketingAttribution } from '../utils/utm';

/**
 * Preferred contact method options
 */
export type PreferredContactMethod = 'phone_call' | 'text' | 'email' | 'any';

/**
 * Total number of steps in the intake form.
 * 
 * Steps:
 * 1. Consent
 * 2. Condition (multi-select)
 * 3. Severity (conditional: PHQ-2, GAD-2, OCD, PTSD)
 * 4. TMS Interest (Daily TMS, Accelerated TMS, SAINT Protocol, Not sure)
 * 5. Duration
 * 6. Treatment
 * 7. Insurance
 * 8. Location
 * 9. Urgency
 * 10. Referral (NEW: Were you referred by a healthcare provider?)
 * 11. Contact (includes preferred contact method)
 * 12. Confirmation
 */
export const TOTAL_STEPS = 12;

/**
 * Total number of question steps (excludes confirmation step).
 */
export const TOTAL_QUESTIONS = TOTAL_STEPS - 1;

/**
 * Step names for display.
 */
export const STEP_NAMES = [
  'Consent',
  'Condition',
  'Severity Assessment',
  'TMS Interest',
  'Duration',
  'Treatment',
  'Insurance',
  'Location',
  'Urgency',
  'Referral',
  'Contact',
  'Confirmation',
] as const;

/**
 * Form data state interface.
 */
export interface IIntakeFormData {
  // Step 1: Consent
  hipaaConsent: boolean;
  
  // Step 2: Condition (MULTI-SELECT)
  conditions: ConditionType[];
  conditionOther: string;
  
  // Legacy single condition (for backward compatibility)
  condition: ConditionType | null;
  
  // Step 3: Severity Assessment (CONDITIONAL)
  // PHQ-2 for Depression
  phq2_interest: number | null; // 0-3 scale
  phq2_mood: number | null;     // 0-3 scale
  
  // GAD-2 for Anxiety
  gad2_nervous: number | null;  // 0-3 scale
  gad2_worry: number | null;    // 0-3 scale
  
  // OCD severity
  ocd_time_occupied: number | null; // 1-4 scale
  
  // PTSD severity
  ptsd_intrusion: number | null; // 0-4 scale
  
  // Step 4: TMS Therapy Interest (NEW)
  tmsTherapyInterest: TMSInterestType | null;
  
  // Step 5: Duration
  symptomDuration: DurationType | null;
  
  // Step 6: Treatment
  priorTreatments: TreatmentType[];
  
  // Step 7: Insurance
  hasInsurance: boolean | null;
  insuranceProvider: string;
  otherInsuranceProvider: string;
  
  // Step 8: Location
  zipCode: string;
  
  // Step 9: Urgency
  urgency: UrgencyType | null;
  
  // Step 10: Referral (NEW - matches Jotform)
  isReferral: boolean | null;
  referringProviderName: string;
  referringProviderSpecialty: string;
  referringClinic: string;
  referringProviderEmail: string;
  
  // Step 11: Contact
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  smsConsent: boolean;
  preferredContactMethod: PreferredContactMethod | null;
}

/**
 * Initial form data state.
 */
const initialFormData: IIntakeFormData = {
  hipaaConsent: false,
  conditions: [],
  conditionOther: '',
  condition: null,
  // PHQ-2
  phq2_interest: null,
  phq2_mood: null,
  // GAD-2
  gad2_nervous: null,
  gad2_worry: null,
  // OCD
  ocd_time_occupied: null,
  // PTSD
  ptsd_intrusion: null,
  // TMS Interest
  tmsTherapyInterest: null,
  // Other fields
  symptomDuration: null,
  priorTreatments: [],
  hasInsurance: null,
  insuranceProvider: '',
  otherInsuranceProvider: '',
  zipCode: '',
  urgency: null,
  // Referral (NEW - matches Jotform)
  isReferral: null,
  referringProviderName: '',
  referringProviderSpecialty: '',
  referringClinic: '',
  referringProviderEmail: '',
  // Contact
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  dateOfBirth: '',
  smsConsent: false,
  preferredContactMethod: null,
};

/**
 * Return type for useIntakeForm hook.
 */
export interface IUseIntakeFormReturn {
  currentStep: number;
  currentQuestion: number;
  totalQuestions: number;
  formData: IIntakeFormData;
  isFirstStep: boolean;
  isLastStep: boolean;
  canProceed: boolean;
  stepProgress: number;
  shouldShowSeverityStep: boolean;
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  goToStep: (step: number) => void;
  updateFormData: <K extends keyof IIntakeFormData>(
    field: K,
    value: IIntakeFormData[K]
  ) => void;
  resetForm: () => void;
  getSubmissionData: () => ILeadCreate;
}

/**
 * Custom hook for managing the intake form.
 * 
 * @returns Form state and navigation functions
 */
export function useIntakeForm(): IUseIntakeFormReturn {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<IIntakeFormData>(initialFormData);
  
  // Navigation helpers
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === TOTAL_STEPS;

  // For the progress bar, we want to show progress across the *question* steps only
  const currentQuestion = Math.min(currentStep, TOTAL_QUESTIONS);
  const stepProgress = (currentQuestion / TOTAL_QUESTIONS) * 100;
  
  /**
   * Determine if severity step should be shown based on selected conditions.
   * Show severity step if ANY of Depression, Anxiety, OCD, or PTSD is selected.
   * Skip if only OTHER is selected.
   */
  const shouldShowSeverityStep = useMemo(() => {
    const severityConditions: ConditionType[] = ['DEPRESSION', 'ANXIETY', 'OCD', 'PTSD'];
    return formData.conditions.some((c: ConditionType) => severityConditions.includes(c));
  }, [formData.conditions]);

  /**
   * Check if current step is valid to proceed.
   */
  const canProceed = useCallback((): boolean => {
    switch (currentStep) {
      case 1: // Consent
        return formData.hipaaConsent === true;
        
      case 2: // Condition (multi-select)
        // At least one condition must be selected
        if (formData.conditions.length === 0) return false;
        // If OTHER is selected, conditionOther must have text
        if (formData.conditions.includes('OTHER') && formData.conditionOther.trim().length === 0) {
          return false;
        }
        return true;
        
      case 3: // Severity Assessment (conditional)
        // If no severity conditions selected, this step is skipped
        if (!shouldShowSeverityStep) return true;
        
        // Validate severity responses based on selected conditions
        if (formData.conditions.includes('DEPRESSION')) {
          if (formData.phq2_interest === null || formData.phq2_mood === null) return false;
        }
        if (formData.conditions.includes('ANXIETY')) {
          if (formData.gad2_nervous === null || formData.gad2_worry === null) return false;
        }
        if (formData.conditions.includes('OCD')) {
          if (formData.ocd_time_occupied === null) return false;
        }
        if (formData.conditions.includes('PTSD')) {
          if (formData.ptsd_intrusion === null) return false;
        }
        return true;
        
      case 4: // TMS Therapy Interest (NEW)
        return formData.tmsTherapyInterest !== null;
        
      case 5: // Duration
        return formData.symptomDuration !== null;
        
      case 6: // Treatment
        return formData.priorTreatments.length > 0;
        
      case 7: // Insurance
        return formData.hasInsurance !== null;
        
      case 8: // Location
        return formData.zipCode.length >= 5;
        
      case 9: // Urgency
        return formData.urgency !== null;
        
      case 10: // Referral (NEW - matches Jotform)
        // Must answer Yes or No
        if (formData.isReferral === null) return false;
        // If Yes, all provider fields are OPTIONAL — user can continue without filling them
        return true;
        
      case 11: // Contact (includes preferred contact method)
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        const phoneDigits = formData.phone.replace(/\D/g, '');
        
        // International phone validation
        const isValidUSPhone = phoneDigits.length === 10 && 
          phoneDigits[0] !== '0' && phoneDigits[0] !== '1';
        const isValidKenyanPhone = (
          (phoneDigits.startsWith('254') && phoneDigits.length === 12) ||
          (phoneDigits.startsWith('0') && phoneDigits.length === 10) ||
          (phoneDigits.length === 9 && (phoneDigits[0] === '7' || phoneDigits[0] === '1'))
        );
        const isValidInternationalPhone = phoneDigits.length >= 7 && phoneDigits.length <= 15;
        const isValidPhone = isValidUSPhone || isValidKenyanPhone || isValidInternationalPhone;
        
        return (
          formData.firstName.trim().length > 0 &&
          formData.lastName.trim().length > 0 &&
          emailRegex.test(formData.email.trim()) &&
          isValidPhone &&
          formData.preferredContactMethod !== null // REQUIRED: Preferred contact method
        );
        
      case 12: // Confirmation (always valid)
        return true;
        
      default:
        return false;
    }
  }, [currentStep, formData, shouldShowSeverityStep]);
  
  /**
   * Navigate to next step.
   * Automatically skips severity step if no severity conditions selected.
   */
  const goToNextStep = useCallback(() => {
    if (currentStep < TOTAL_STEPS) {
      let nextStep = currentStep + 1;
      
      // Skip severity step (step 3) if no severity conditions selected
      if (nextStep === 3 && !shouldShowSeverityStep) {
        nextStep = 4; // Skip to TMS Interest
      }
      
      setCurrentStep(nextStep);
    }
  }, [currentStep, shouldShowSeverityStep]);
  
  /**
   * Navigate to previous step.
   * Automatically skips severity step if no severity conditions selected.
   */
  const goToPreviousStep = useCallback(() => {
    if (currentStep > 1) {
      let prevStep = currentStep - 1;
      
      // Skip severity step (step 3) when going back if no severity conditions
      if (prevStep === 3 && !shouldShowSeverityStep) {
        prevStep = 2; // Skip to Condition
      }
      
      setCurrentStep(prevStep);
    }
  }, [currentStep, shouldShowSeverityStep]);
  
  /**
   * Navigate to specific step.
   */
  const goToStep = useCallback((step: number) => {
    if (step >= 1 && step <= TOTAL_STEPS) {
      setCurrentStep(step);
    }
  }, []);
  
  /**
   * Update a specific form field.
   */
  const updateFormData = useCallback(<K extends keyof IIntakeFormData>(
    field: K,
    value: IIntakeFormData[K]
  ) => {
    setFormData((prev: IIntakeFormData) => ({
      ...prev,
      [field]: value,
      // Keep legacy condition field in sync (use first selected condition)
      ...(field === 'conditions' && Array.isArray(value) ? {
        condition: (value as ConditionType[]).length > 0 ? (value as ConditionType[])[0] : null
      } : {}),
    }));
  }, []);
  
  /**
   * Reset form to initial state.
   */
  const resetForm = useCallback(() => {
    setCurrentStep(1);
    setFormData(initialFormData);
  }, []);
  
  /**
   * Get form data in API submission format.
   * 
   * ALIGNED WITH JOTFORM: Includes all new fields for parity.
   */
  const getSubmissionData = useCallback((): ILeadCreate => {
    const attribution = getMarketingAttribution();
    
    // Use first condition as primary for legacy compatibility
    const primaryCondition = formData.conditions.length > 0 
      ? formData.conditions[0] 
      : formData.condition;
    
    return {
      first_name: formData.firstName.trim(),
      last_name: formData.lastName.trim() || undefined,
      email: formData.email.trim(),
      phone: formData.phone.replace(/\D/g, ''),
      date_of_birth: formData.dateOfBirth || undefined,
      
      // Primary condition (legacy field)
      condition: primaryCondition!,
      condition_other: formData.conditions.includes('OTHER') 
        ? formData.conditionOther.trim() 
        : undefined,
      
      // Multi-condition support (NEW)
      conditions: formData.conditions,
      other_condition_text: formData.conditions.includes('OTHER') 
        ? formData.conditionOther.trim() 
        : undefined,
      
      // Severity assessments (NEW - conditional)
      // PHQ-2 for Depression
      phq2_interest: formData.conditions.includes('DEPRESSION') ? formData.phq2_interest : undefined,
      phq2_mood: formData.conditions.includes('DEPRESSION') ? formData.phq2_mood : undefined,
      
      // GAD-2 for Anxiety
      gad2_nervous: formData.conditions.includes('ANXIETY') ? formData.gad2_nervous : undefined,
      gad2_worry: formData.conditions.includes('ANXIETY') ? formData.gad2_worry : undefined,
      
      // OCD severity
      ocd_time_occupied: formData.conditions.includes('OCD') ? formData.ocd_time_occupied : undefined,
      
      // PTSD severity
      ptsd_intrusion: formData.conditions.includes('PTSD') ? formData.ptsd_intrusion : undefined,
      
      // TMS Therapy Interest (NEW - matches Jotform)
      tms_therapy_interest: formData.tmsTherapyInterest || undefined,
      
      // Other intake fields
      symptom_duration: formData.symptomDuration!,
      prior_treatments: formData.priorTreatments,
      has_insurance: formData.hasInsurance!,
      insurance_provider: formData.hasInsurance ? formData.insuranceProvider.trim() || undefined : undefined,
      other_insurance_provider: formData.otherInsuranceProvider.trim() || undefined,
      zip_code: formData.zipCode.replace(/\D/g, '').substring(0, 5),
      urgency: formData.urgency!,
      hipaa_consent: formData.hipaaConsent,
      sms_consent: formData.smsConsent,
      
      // Preferred contact method (NEW - REQUIRED)
      preferred_contact_method: formData.preferredContactMethod || undefined,
      
      // Referral information (NEW - matches Jotform)
      is_referral: formData.isReferral === true,
      referring_provider_name: formData.isReferral ? formData.referringProviderName.trim() || undefined : undefined,
      referring_provider_specialty: formData.isReferral ? formData.referringProviderSpecialty.trim() || undefined : undefined,
      referring_clinic: formData.isReferral ? formData.referringClinic.trim() || undefined : undefined,
      referring_provider_email: formData.isReferral ? formData.referringProviderEmail.trim() || undefined : undefined,
      
      // UTM tracking
      utm_params: attribution.utm_params,
      referrer_url: attribution.referrer_url,
    };
  }, [formData]);
  
  return {
    currentStep,
    currentQuestion,
    totalQuestions: TOTAL_QUESTIONS,
    formData,
    isFirstStep,
    isLastStep,
    canProceed: canProceed(),
    stepProgress,
    shouldShowSeverityStep,
    goToNextStep,
    goToPreviousStep,
    goToStep,
    updateFormData,
    resetForm,
    getSubmissionData,
  };
}
