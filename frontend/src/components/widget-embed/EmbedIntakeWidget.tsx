/**
 * EmbedIntakeWidget - Self-contained intake widget for external embedding.
 * 
 * Reuses ALL existing step components and the useIntakeForm hook.
 * Uses a standalone API client (no auth) that points to the configurable backend URL.
 * 
 * @module components/widget-embed/EmbedIntakeWidget
 * @version 1.0.0
 */

import React, { useState, useEffect } from 'react';
import { useIntakeForm, STEP_NAMES } from '../../hooks/useIntakeForm';
import type { ILeadCreate, ILeadSubmitResponse } from '../../types/lead';

// Reuse ALL existing step components
import { ConsentStep } from '../widget/ConsentStep';
import { ConditionStep } from '../widget/ConditionStep';
import { SeverityStep } from '../widget/SeverityStep';
import { TMSInterestStep } from '../widget/TMSInterestStep';
import { DurationStep } from '../widget/DurationStep';
import { TreatmentStep } from '../widget/TreatmentStep';
import { InsuranceStep } from '../widget/InsuranceStep';
import { LocationStep } from '../widget/LocationStep';
import { UrgencyStep } from '../widget/UrgencyStep';
import { ReferralStep } from '../widget/ReferralStep';
import { ContactStep } from '../widget/ContactStep';
import { ConfirmationStep } from '../widget/ConfirmationStep';

interface EmbedIntakeWidgetProps {
  apiUrl: string;
  onClose?: () => void;
}

/**
 * Standalone API submission - no auth required, posts directly to backend.
 */
async function submitLeadToAPI(
  apiUrl: string,
  leadData: ILeadCreate
): Promise<ILeadSubmitResponse> {
  const url = `${apiUrl}/api/leads/submit`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(leadData),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const message = errorData?.message || errorData?.detail || `Server error (${response.status})`;
    throw new Error(message);
  }

  return response.json();
}

/**
 * SVG Icons used in the widget (replacing lucide-react dependency for smaller bundle,
 * but lucide-react is fine since it's already imported by the step components).
 */
const BrainIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 2A5.5 5.5 0 0 0 4 7.5V8a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h.5" />
    <path d="M14.5 2A5.5 5.5 0 0 1 20 7.5V8a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-.5" />
    <path d="M4.5 14.5A5.5 5.5 0 0 0 10 20v2" />
    <path d="M19.5 14.5A5.5 5.5 0 0 1 14 20v2" />
    <path d="M12 2v4" />
    <path d="M12 18v4" />
    <path d="M8 8h8" />
    <path d="M8 12h8" />
  </svg>
);

const XIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const ChevronLeftIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const LoaderIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nr-spin">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

export const EmbedIntakeWidget: React.FC<EmbedIntakeWidgetProps> = ({
  apiUrl,
  onClose,
}) => {
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

  const handleSubmit = async (): Promise<void> => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const data = form.getSubmissionData();
      const response = await submitLeadToAPI(apiUrl, data);
      setSubmitResponse(response);
      form.goToNextStep();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'An unexpected error occurred';
      if (errorMsg.includes('500') || errorMsg.includes('Internal Server Error')) {
        setSubmitError('We encountered a technical issue. Please try again in a moment or contact us directly.');
      } else if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
        setSubmitError('Connection issue detected. Please check your internet and try again.');
      } else {
        setSubmitError(errorMsg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const TOTAL_INPUT_STEPS = 11;

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
    <div className="nr-embed-widget" style={{ width: '100%', maxWidth: '400px', margin: '0 auto' }}>
      {/* Main Container */}
      <div style={{
        background: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(20px)',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        border: '1px solid rgba(255,255,255,0.2)',
      }}>
        {/* Header */}
        <div style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{
            background: 'linear-gradient(135deg, #4f46e5, #7c3aed, #ec4899)',
            padding: '16px 20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.2)',
                  backdropFilter: 'blur(8px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                  color: 'white',
                }}>
                  <BrainIcon />
                </div>
                <div>
                  <h2 style={{
                    fontSize: '16px',
                    fontWeight: '700',
                    color: 'white',
                    lineHeight: '1.2',
                    margin: 0,
                  }}>
                    {isCompleted ? '🎉 Thank You!' : 'TMS Institute of Arizona'}
                  </h2>
                  {!isCompleted && (
                    <p style={{
                      fontSize: '12px',
                      color: 'rgba(255,255,255,0.8)',
                      marginTop: '2px',
                      margin: 0,
                    }}>
                      Quick Assessment • ~2 min
                    </p>
                  )}
                </div>
              </div>

              {onClose && (
                <button
                  onClick={onClose}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.1)',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'rgba(255,255,255,0.8)',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.2)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.1)';
                  }}
                  aria-label="Close widget"
                >
                  <XIcon size={16} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Progress Indicator */}
        {!isCompleted && (
          <div style={{
            padding: '12px 20px',
            background: 'linear-gradient(90deg, #f8fafc, #f1f5f9)',
            borderBottom: '1px solid #e2e8f0',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {/* Step Pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {Array.from({ length: TOTAL_INPUT_STEPS }, (_, i) => (
                  <div
                    key={i}
                    style={{
                      height: '6px',
                      borderRadius: '999px',
                      transition: 'all 0.3s',
                      width: i < form.currentStep
                        ? '12px'
                        : i === form.currentStep - 1
                          ? '20px'
                          : '6px',
                      background: i < form.currentStep
                        ? 'linear-gradient(90deg, #6366f1, #8b5cf6)'
                        : '#e2e8f0',
                    }}
                  />
                ))}
              </div>

              {/* Step Counter Badge */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                background: 'white',
                borderRadius: '999px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                border: '1px solid #f1f5f9',
              }}>
                <span style={{ fontSize: '10px', fontWeight: '600', color: '#4f46e5' }}>
                  {form.currentStep}
                </span>
                <span style={{ fontSize: '10px', color: '#9ca3af' }}>/</span>
                <span style={{ fontSize: '10px', color: '#9ca3af' }}>{TOTAL_INPUT_STEPS}</span>
              </div>
            </div>

            {/* Current Step Name */}
            <div style={{ marginTop: '8px' }}>
              <span style={{
                fontSize: '10px',
                fontWeight: '500',
                color: '#6b7280',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                {STEP_NAMES[form.currentStep - 1]}
              </span>
            </div>
          </div>
        )}

        {/* Step Content */}
        <div
          style={{
            padding: '16px 20px',
            minHeight: '200px',
            maxHeight: '340px',
            overflowY: 'auto',
            transition: 'opacity 0.25s ease, transform 0.25s ease',
            opacity: isAnimating ? 0 : 1,
            transform: isAnimating ? 'translateX(10px)' : 'translateX(0)',
          }}
        >
          {renderStep()}
        </div>

        {/* Error Message */}
        {submitError && (
          <div style={{
            margin: '0 20px 12px',
            padding: '8px 12px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
          }}>
            <p style={{
              fontSize: '12px',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              margin: 0,
            }}>
              <span style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                background: '#fee2e2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: '#dc2626',
              }}>
                <XIcon size={10} />
              </span>
              {submitError}
            </p>
          </div>
        )}

        {/* Footer Navigation */}
        {!isCompleted && (
          <div style={{
            padding: '16px 20px',
            background: 'linear-gradient(90deg, #f9fafb, #f8fafc)',
            borderTop: '1px solid #f1f5f9',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}>
              {/* Back Button */}
              {!form.isFirstStep ? (
                <button
                  onClick={form.goToPreviousStep}
                  disabled={isSubmitting}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '8px 12px',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#4b5563',
                    background: 'white',
                    border: '1px solid #d1d5db',
                    borderRadius: '12px',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    opacity: isSubmitting ? 0.5 : 1,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSubmitting) {
                      (e.currentTarget as HTMLButtonElement).style.background = '#f9fafb';
                      (e.currentTarget as HTMLButtonElement).style.borderColor = '#9ca3af';
                    }
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'white';
                    (e.currentTarget as HTMLButtonElement).style.borderColor = '#d1d5db';
                  }}
                >
                  <ChevronLeftIcon />
                  <span>Back</span>
                </button>
              ) : (
                <div />
              )}

              {/* Continue/Submit Button */}
              <button
                onClick={handleNext}
                disabled={!form.canProceed || isSubmitting}
                style={{
                  flex: '1 1 auto',
                  maxWidth: '200px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: 'white',
                  background: (!form.canProceed || isSubmitting)
                    ? '#9ca3af'
                    : 'linear-gradient(90deg, #4f46e5, #7c3aed)',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: (!form.canProceed || isSubmitting) ? 'not-allowed' : 'pointer',
                  boxShadow: (!form.canProceed || isSubmitting)
                    ? 'none'
                    : '0 4px 14px rgba(79, 70, 229, 0.3)',
                  transition: 'all 0.2s',
                  opacity: (!form.canProceed || isSubmitting) ? 0.6 : 1,
                }}
                onMouseEnter={(e) => {
                  if (form.canProceed && !isSubmitting) {
                    (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 20px rgba(79, 70, 229, 0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = form.canProceed && !isSubmitting
                    ? '0 4px 14px rgba(79, 70, 229, 0.3)'
                    : 'none';
                }}
              >
                {isSubmitting ? (
                  <>
                    <LoaderIcon />
                    <span>Submitting...</span>
                  </>
                ) : form.currentStep === TOTAL_INPUT_STEPS ? (
                  <>
                    <CheckCircleIcon />
                    <span>Get Consultation</span>
                  </>
                ) : (
                  <>
                    <span>Continue</span>
                    <ChevronRightIcon />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Trust Badge Footer */}
        {!isCompleted && (
          <div style={{
            padding: '8px 20px',
            background: '#1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}>
            <ShieldIcon />
            <span style={{ fontSize: '10px', color: '#94a3b8' }}>
              256-bit encryption • HIPAA compliant
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
