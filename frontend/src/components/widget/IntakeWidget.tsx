/**
 * IntakeWidget Component - REDESIGNED v3.0
 * 
 * Premium, compact intake widget inspired by modern SaaS design.
 * Features glass morphism, elegant animations, and reduced footprint.
 * 
 * Key Features:
 * - Compact size (max-width: 380px)
 * - Glass morphism design
 * - Smooth step transitions
 * - Floating pill progress
 * - Premium typography and spacing
 * - Keyboard navigation support
 * 
 * UPDATED v3.0: Now includes TMS Therapy Interest step (matches Jotform)
 * - 11 total steps (10 input + 1 confirmation)
 * - SAINT Protocol only shows for Depression
 * 
 * @module components/widget/IntakeWidget
 * @version 3.0.0
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Shield,
  Loader2,
  CheckCircle2,
  Brain
} from 'lucide-react';
import { useIntakeForm, STEP_NAMES } from '../../hooks/useIntakeForm';
import { submitLead } from '../../services/leads';
import { getErrorMessage } from '../../services/api';
import type { ILeadSubmitResponse } from '../../types/lead';
import { ConsentStep } from './ConsentStep';
import { ConditionStep } from './ConditionStep';
import { SeverityStep } from './SeverityStep';
import { TMSInterestStep } from './TMSInterestStep';
import { DurationStep } from './DurationStep';
import { TreatmentStep } from './TreatmentStep';
import { InsuranceStep } from './InsuranceStep';
import { LocationStep } from './LocationStep';
import { UrgencyStep } from './UrgencyStep';
import { ReferralStep } from './ReferralStep';
import { ContactStep } from './ContactStep';
import { ConfirmationStep } from './ConfirmationStep';

interface IntakeWidgetProps {
  onClose?: () => void;
}

export const IntakeWidget: React.FC<IntakeWidgetProps> = ({ onClose }) => {
  const form = useIntakeForm();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitResponse, setSubmitResponse] = useState<ILeadSubmitResponse | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  // Handle step transitions with animation
  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 300);
    return () => clearTimeout(timer);
  }, [form.currentStep]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = async (): Promise<void> => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const data = form.getSubmissionData();
      const response = await submitLead(data);
      setSubmitResponse(response);

      if (typeof (window as any).refreshLeads === 'function') {
        (window as any).refreshLeads();
      }

      form.goToNextStep();
    } catch (error) {
      const errorMsg = getErrorMessage(error);
      // Provide user-friendly error message
      if (errorMsg.includes('500') || errorMsg.includes('Internal Server Error')) {
        setSubmitError('We encountered a technical issue. Please try again in a moment or contact us directly.');
      } else if (errorMsg.includes('Network Error') || errorMsg.includes('timeout')) {
        setSubmitError('Connection issue detected. Please check your internet and try again.');
      } else {
        setSubmitError(errorMsg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Total steps is now 12 (with TMS Interest step + Referral step), confirmation is step 12
  const TOTAL_INPUT_STEPS = 11; // Steps 1-11 are input steps, step 12 is confirmation

  const handleNext = (): void => {
    if (form.currentStep === TOTAL_INPUT_STEPS) {
      handleSubmit();
    } else {
      form.goToNextStep();
    }
  };

  const renderStep = (): React.ReactNode => {
    switch (form.currentStep) {
      case 1:
        return (
          <ConsentStep
            hipaaConsent={form.formData.hipaaConsent}
            onChange={(value: boolean) => form.updateFormData('hipaaConsent', value)}
          />
        );
      case 2:
        return (
          <ConditionStep
            conditions={form.formData.conditions}
            conditionOther={form.formData.conditionOther}
            onConditionsChange={(value) => form.updateFormData('conditions', value)}
            onOtherChange={(value) => form.updateFormData('conditionOther', value)}
          />
        );
      case 3:
        // Severity Step - conditionally shown based on selected conditions
        return (
          <SeverityStep
            conditions={form.formData.conditions}
            phq2_interest={form.formData.phq2_interest}
            phq2_mood={form.formData.phq2_mood}
            gad2_nervous={form.formData.gad2_nervous}
            gad2_worry={form.formData.gad2_worry}
            ocd_time_occupied={form.formData.ocd_time_occupied}
            ptsd_intrusion={form.formData.ptsd_intrusion}
            onPhq2InterestChange={(value) => form.updateFormData('phq2_interest', value)}
            onPhq2MoodChange={(value) => form.updateFormData('phq2_mood', value)}
            onGad2NervousChange={(value) => form.updateFormData('gad2_nervous', value)}
            onGad2WorryChange={(value) => form.updateFormData('gad2_worry', value)}
            onOcdTimeChange={(value) => form.updateFormData('ocd_time_occupied', value)}
            onPtsdIntrusionChange={(value) => form.updateFormData('ptsd_intrusion', value)}
          />
        );
      case 4:
        // TMS Therapy Interest Step (NEW - matches Jotform)
        return (
          <TMSInterestStep
            conditions={form.formData.conditions}
            tmsInterest={form.formData.tmsTherapyInterest}
            onTmsInterestChange={(value) => form.updateFormData('tmsTherapyInterest', value)}
          />
        );
      case 5:
        return (
          <DurationStep
            duration={form.formData.symptomDuration}
            onChange={(value) => form.updateFormData('symptomDuration', value)}
          />
        );
      case 6:
        return (
          <TreatmentStep
            treatments={form.formData.priorTreatments}
            onChange={(value) => form.updateFormData('priorTreatments', value)}
          />
        );
      case 7:
        return (
          <InsuranceStep
            hasInsurance={form.formData.hasInsurance}
            insuranceProvider={form.formData.insuranceProvider}
            onInsuranceChange={(value) => form.updateFormData('hasInsurance', value)}
            onProviderChange={(value) => form.updateFormData('insuranceProvider', value)}
          />
        );
      case 8:
        return (
          <LocationStep
            zipCode={form.formData.zipCode}
            onChange={(value) => form.updateFormData('zipCode', value)}
          />
        );
      case 9:
        return (
          <UrgencyStep
            urgency={form.formData.urgency}
            onChange={(value) => form.updateFormData('urgency', value)}
          />
        );
      case 10:
        // Referral Step - matches Jotform referral questions
        return (
          <ReferralStep
            isReferral={form.formData.isReferral}
            referringProviderName={form.formData.referringProviderName}
            referringProviderSpecialty={form.formData.referringProviderSpecialty}
            referringClinic={form.formData.referringClinic}
            referringProviderEmail={form.formData.referringProviderEmail}
            onIsReferralChange={(v) => form.updateFormData('isReferral', v)}
            onProviderNameChange={(v) => form.updateFormData('referringProviderName', v)}
            onProviderSpecialtyChange={(v) => form.updateFormData('referringProviderSpecialty', v)}
            onClinicChange={(v) => form.updateFormData('referringClinic', v)}
            onProviderEmailChange={(v) => form.updateFormData('referringProviderEmail', v)}
          />
        );
      case 11:
        return (
          <ContactStep
            firstName={form.formData.firstName}
            lastName={form.formData.lastName}
            email={form.formData.email}
            phone={form.formData.phone}
            dateOfBirth={form.formData.dateOfBirth}
            smsConsent={form.formData.smsConsent}
            preferredContactMethod={form.formData.preferredContactMethod}
            onFirstNameChange={(v) => form.updateFormData('firstName', v)}
            onLastNameChange={(v) => form.updateFormData('lastName', v)}
            onEmailChange={(v) => form.updateFormData('email', v)}
            onPhoneChange={(v) => form.updateFormData('phone', v)}
            onDateOfBirthChange={(v) => form.updateFormData('dateOfBirth', v)}
            onSmsConsentChange={(v) => form.updateFormData('smsConsent', v)}
            onPreferredContactChange={(v) => form.updateFormData('preferredContactMethod', v)}
          />
        );
      case 12:
        return (
          <ConfirmationStep
            response={submitResponse}
            onReset={form.resetForm}
            onClose={onClose}
          />
        );
      default:
        return null;
    }
  };

  const isCompleted = form.currentStep === 12;

  return (
    <div className="w-full max-w-[380px] mx-auto">
      {/* Main Container with Glass Effect */}
      <div className="
        bg-white/95 backdrop-blur-xl 
        rounded-2xl shadow-2xl shadow-slate-900/20
        border border-white/20
        overflow-hidden
        transform transition-all duration-300
      ">
        {/* Header - Compact & Elegant */}
        <div className="relative overflow-hidden">
          {/* Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500" />

          {/* Animated Shine Effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />

          {/* Header Content */}
          <div className="relative px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Logo/Icon */}
                <div className="
                  w-10 h-10 rounded-xl 
                  bg-white/20 backdrop-blur-sm
                  flex items-center justify-center
                  shadow-lg shadow-black/10
                ">
                  <Brain size={20} className="text-white" />
                </div>

                <div>
                  <h2 className="text-base font-bold text-white leading-tight">
                    {isCompleted ? '🎉 Thank You!' : 'TMS Institute of Arizona'}
                  </h2>
                  {!isCompleted && (
                    <p className="text-xs text-white/80 mt-0.5">
                      Quick Assessment • ~2 min
                    </p>
                  )}
                </div>
              </div>

              {/* Close Button */}
              {onClose && (
                <button
                  onClick={onClose}
                  className="
                    w-8 h-8 rounded-lg
                    bg-white/10 hover:bg-white/20
                    flex items-center justify-center
                    transition-all duration-200
                    group
                  "
                  aria-label="Close widget"
                >
                  <X size={16} className="text-white/80 group-hover:text-white" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Progress Indicator - Floating Pills */}
        {!isCompleted && (
          <div className="px-5 py-3 bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-100">
            <div className="flex items-center justify-between">
              {/* Step Pills - 10 input steps total */}
              <div className="flex items-center gap-1">
                {Array.from({ length: TOTAL_INPUT_STEPS }, (_, i) => (
                  <div
                    key={i}
                    className={`
                      h-1.5 rounded-full transition-all duration-300
                      ${i < form.currentStep
                        ? 'w-3 bg-gradient-to-r from-indigo-500 to-purple-500'
                        : i === form.currentStep - 1
                          ? 'w-5 bg-gradient-to-r from-indigo-500 to-purple-500'
                          : 'w-1.5 bg-gray-200'
                      }
                    `}
                  />
                ))}
              </div>

              {/* Step Counter Badge */}
              <div className="
                flex items-center gap-1.5 
                px-2.5 py-1 
                bg-white rounded-full
                shadow-sm border border-gray-100
              ">
                <span className="text-[10px] font-semibold text-indigo-600">
                  {form.currentStep}
                </span>
                <span className="text-[10px] text-gray-400">/</span>
                <span className="text-[10px] text-gray-400">{TOTAL_INPUT_STEPS}</span>
              </div>
            </div>

            {/* Current Step Name */}
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                {STEP_NAMES[form.currentStep - 1]}
              </span>
            </div>
          </div>
        )}

        {/* Step Content - Animated */}
        <div
          className={`
            px-5 py-4
            min-h-[200px] max-h-[320px]
            overflow-y-auto
            transition-all duration-300
            ${isAnimating ? 'opacity-0 translate-x-2' : 'opacity-100 translate-x-0'}
          `}
        >
          {renderStep()}
        </div>

        {/* Error Message */}
        {submitError && (
          <div className="mx-5 mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-xs text-red-600 flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <X size={10} className="text-red-600" />
              </span>
              {submitError}
            </p>
          </div>
        )}

        {/* Footer Navigation - Compact */}
        {!isCompleted && (
          <div className="px-5 py-4 bg-gradient-to-r from-gray-50 to-slate-50 border-t border-gray-100">
            <div className="flex items-center justify-between gap-3">
              {/* Back Button */}
              {!form.isFirstStep ? (
                <button
                  onClick={form.goToPreviousStep}
                  disabled={isSubmitting}
                  className="
                    flex items-center gap-1
                    px-3 py-2
                    text-sm font-medium text-gray-600
                    bg-white hover:bg-gray-50
                    border border-gray-200 hover:border-gray-300
                    rounded-xl
                    transition-all duration-200
                    disabled:opacity-50
                  "
                >
                  <ChevronLeft size={16} />
                  <span className="hidden sm:inline">Back</span>
                </button>
              ) : (
                <div />
              )}

              {/* Continue/Submit Button */}
              <button
                onClick={handleNext}
                disabled={!form.canProceed || isSubmitting}
                className="
                  flex-1 max-w-[200px]
                  flex items-center justify-center gap-2
                  px-4 py-2.5
                  text-sm font-semibold text-white
                  bg-gradient-to-r from-indigo-600 to-purple-600
                  hover:from-indigo-700 hover:to-purple-700
                  rounded-xl
                  shadow-lg shadow-indigo-600/30
                  hover:shadow-xl hover:shadow-indigo-600/40
                  transform hover:-translate-y-0.5
                  transition-all duration-200
                  disabled:opacity-50 disabled:cursor-not-allowed
                  disabled:hover:translate-y-0 disabled:hover:shadow-lg
                "
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : form.currentStep === TOTAL_INPUT_STEPS ? (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Get Consultation</span>
                  </>
                ) : (
                  <>
                    <span>Continue</span>
                    <ChevronRight size={16} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Trust Badge Footer */}
        {!isCompleted && (
          <div className="px-5 py-2 bg-slate-800 flex items-center justify-center gap-2">
            <Shield size={12} className="text-emerald-400" />
            <span className="text-[10px] text-slate-400">
              256-bit encryption • HIPAA compliant
            </span>
          </div>
        )}
      </div>

      {/* Custom Animation Styles */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 3s infinite;
        }
      `}</style>
    </div>
  );
};

export default IntakeWidget;
