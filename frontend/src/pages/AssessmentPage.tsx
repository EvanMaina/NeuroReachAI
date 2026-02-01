/**
 * Full-Page Assessment Page — Premium Healthcare Experience
 * 
 * Apple Health / One Medical / Calm-inspired design.
 * ZERO SCROLL per step. ZERO STRAIN reading.
 * Uses the real TMS Institute logo from /static/images/logo.png.
 * 
 * @module pages/AssessmentPage
 * @version 2.0.0 — Production UX Overhaul
 */

import React, { useState, useEffect } from 'react';
import { useIntakeForm, STEP_NAMES } from '../hooks/useIntakeForm';
import type { ILeadCreate, ILeadSubmitResponse } from '../types/lead';

// Reuse ALL existing step components
import { ConsentStep } from '../components/widget/ConsentStep';
import { ConditionStep } from '../components/widget/ConditionStep';
import { SeverityStep } from '../components/widget/SeverityStep';
import { TMSInterestStep } from '../components/widget/TMSInterestStep';
import { DurationStep } from '../components/widget/DurationStep';
import { TreatmentStep } from '../components/widget/TreatmentStep';
import { InsuranceStep } from '../components/widget/InsuranceStep';
import { LocationStep } from '../components/widget/LocationStep';
import { UrgencyStep } from '../components/widget/UrgencyStep';
import { ReferralStep } from '../components/widget/ReferralStep';
import { ContactStep } from '../components/widget/ContactStep';

interface AssessmentPageProps {
  apiUrl: string;
}

/**
 * Submit lead data to backend — single attempt, no retries.
 *
 * The request must work on the first try. If it doesn't, we surface the
 * real error so it can be diagnosed and fixed permanently.
 */
async function submitLeadToAPI(
  apiUrl: string,
  leadData: ILeadCreate
): Promise<ILeadSubmitResponse> {
  const url = `${apiUrl}/api/leads/submit`;

  console.log(`[Assessment] Submitting to ${url}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    },
    body: JSON.stringify(leadData),
  });

  // Parse the response — always try JSON first
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const errorMessage =
      errorData?.detail || errorData?.message || `Server error (${response.status})`;
    console.error('[Assessment] Server error:', response.status, errorData);
    throw new Error(errorMessage);
  }

  const result = await response.json();
  console.log('[Assessment] Submission successful:', result);
  return result;
}

const TOTAL_INPUT_STEPS = 11;

export const AssessmentPage: React.FC<AssessmentPageProps> = ({ apiUrl }) => {
  const form = useIntakeForm();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitResponse, setSubmitResponse] = useState<ILeadSubmitResponse | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  // Logo URL — real TMS Institute logo served from backend /static/images/logo.png
  const logoUrl = `${apiUrl}/static/images/logo.png`;

  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 200);
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
      setIsCompleted(true);
    } catch (error) {
      // ALWAYS log the full error for debugging
      console.error('[Assessment] Submission failed:', error);

      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        // ACTUAL network error — browser couldn't reach the server at all
        setSubmitError('Unable to connect to the server. Please check your internet connection and try again.');
      } else if (error instanceof Error) {
        // Backend returned an error — show the REAL message from the server
        setSubmitError(error.message);
      } else {
        setSubmitError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

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
        return <ConsentStep hipaaConsent={form.formData.hipaaConsent} onChange={(value: boolean) => form.updateFormData('hipaaConsent', value)} />;
      case 2:
        return <ConditionStep conditions={form.formData.conditions} conditionOther={form.formData.conditionOther} onConditionsChange={(value) => form.updateFormData('conditions', value)} onOtherChange={(value) => form.updateFormData('conditionOther', value)} />;
      case 3:
        return <SeverityStep conditions={form.formData.conditions} phq2_interest={form.formData.phq2_interest} phq2_mood={form.formData.phq2_mood} gad2_nervous={form.formData.gad2_nervous} gad2_worry={form.formData.gad2_worry} ocd_time_occupied={form.formData.ocd_time_occupied} ptsd_intrusion={form.formData.ptsd_intrusion} onPhq2InterestChange={(v) => form.updateFormData('phq2_interest', v)} onPhq2MoodChange={(v) => form.updateFormData('phq2_mood', v)} onGad2NervousChange={(v) => form.updateFormData('gad2_nervous', v)} onGad2WorryChange={(v) => form.updateFormData('gad2_worry', v)} onOcdTimeChange={(v) => form.updateFormData('ocd_time_occupied', v)} onPtsdIntrusionChange={(v) => form.updateFormData('ptsd_intrusion', v)} />;
      case 4:
        return <TMSInterestStep conditions={form.formData.conditions} tmsInterest={form.formData.tmsTherapyInterest} onTmsInterestChange={(v) => form.updateFormData('tmsTherapyInterest', v)} />;
      case 5:
        return <DurationStep duration={form.formData.symptomDuration} onChange={(v) => form.updateFormData('symptomDuration', v)} />;
      case 6:
        return <TreatmentStep treatments={form.formData.priorTreatments} onChange={(v) => form.updateFormData('priorTreatments', v)} />;
      case 7:
        return <InsuranceStep hasInsurance={form.formData.hasInsurance} insuranceProvider={form.formData.insuranceProvider} onInsuranceChange={(v) => form.updateFormData('hasInsurance', v)} onProviderChange={(v) => form.updateFormData('insuranceProvider', v)} />;
      case 8:
        return <LocationStep zipCode={form.formData.zipCode} onChange={(v) => form.updateFormData('zipCode', v)} />;
      case 9:
        return <UrgencyStep urgency={form.formData.urgency} onChange={(v) => form.updateFormData('urgency', v)} />;
      case 10:
        return <ReferralStep isReferral={form.formData.isReferral} referringProviderName={form.formData.referringProviderName} referringProviderSpecialty={form.formData.referringProviderSpecialty} referringClinic={form.formData.referringClinic} referringProviderEmail={form.formData.referringProviderEmail} onIsReferralChange={(v) => form.updateFormData('isReferral', v)} onProviderNameChange={(v) => form.updateFormData('referringProviderName', v)} onProviderSpecialtyChange={(v) => form.updateFormData('referringProviderSpecialty', v)} onClinicChange={(v) => form.updateFormData('referringClinic', v)} onProviderEmailChange={(v) => form.updateFormData('referringProviderEmail', v)} />;
      case 11:
        return <ContactStep firstName={form.formData.firstName} lastName={form.formData.lastName} email={form.formData.email} phone={form.formData.phone} dateOfBirth={form.formData.dateOfBirth} smsConsent={form.formData.smsConsent} preferredContactMethod={form.formData.preferredContactMethod} onFirstNameChange={(v) => form.updateFormData('firstName', v)} onLastNameChange={(v) => form.updateFormData('lastName', v)} onEmailChange={(v) => form.updateFormData('email', v)} onPhoneChange={(v) => form.updateFormData('phone', v)} onDateOfBirthChange={(v) => form.updateFormData('dateOfBirth', v)} onSmsConsentChange={(v) => form.updateFormData('smsConsent', v)} onPreferredContactChange={(v) => form.updateFormData('preferredContactMethod', v)} />;
      default:
        return null;
    }
  };

  // ── Thank You page after submission ──
  if (isCompleted) {
    return (
      <div className="nr-widget-root assess-page">
        <div className="assess-container">
          <header className="assess-header">
            <Logo logoUrl={logoUrl} />
          </header>
          <main className="assess-card" style={{ textAlign: 'center', padding: '40px 28px' }}>
            {/* Success icon */}
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#C6F6D5', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#38A169" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: '#1B2A4A', marginBottom: 8 }}>Thank You!</h2>
            <p style={{ fontSize: 16, color: '#4A5568', maxWidth: 440, margin: '0 auto 20px', lineHeight: 1.6 }}>
              Our team will review your information and contact you within 24 hours.
            </p>
            {submitResponse && (
              <div style={{ background: '#EBF4FF', border: '1px solid #BEE3F8', borderRadius: 12, padding: '12px 20px', display: 'inline-block', marginBottom: 20 }}>
                <p style={{ fontSize: 11, color: '#2C5282', fontWeight: 600, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reference Number</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: '#1B2A4A', fontFamily: 'monospace' }}>{submitResponse.leadId}</p>
              </div>
            )}
            <div style={{ maxWidth: 320, margin: '0 auto', textAlign: 'left' }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, color: '#1B2A4A', marginBottom: 10 }}>What happens next?</h4>
              {[
                { n: '1', t: 'Review', d: 'Our team reviews within 24 hours' },
                { n: '2', t: 'Contact', d: 'A care coordinator will reach out' },
                { n: '3', t: 'Consult', d: 'Discuss your treatment options' },
              ].map(s => (
                <div key={s.n} style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#EBF4FF', color: '#1B2A4A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{s.n}</span>
                  <div><p style={{ fontSize: 14, fontWeight: 600, color: '#1B2A4A', margin: 0 }}>{s.t}</p><p style={{ fontSize: 12, color: '#718096', margin: 0 }}>{s.d}</p></div>
                </div>
              ))}
            </div>
          </main>
          <Footer />
        </div>
      </div>
    );
  }

  // ── Main Assessment Form ──
  return (
    <div className="nr-widget-root assess-page">
      <div className="assess-container">
        {/* Header */}
        <header className="assess-header">
          <Logo logoUrl={logoUrl} />
          <div className="assess-header-right">
            <span className="assess-header-title">Free Assessment</span>
            <span className="assess-header-sub">~2 min • Confidential</span>
          </div>
        </header>

        {/* Main Card */}
        <main className="assess-card">
          {/* Progress Bar */}
          <ProgressBar current={form.currentStep} total={TOTAL_INPUT_STEPS} stepName={STEP_NAMES[form.currentStep - 1]} />

          {/* Step Content */}
          <div className="assess-step-content" style={{
            opacity: isAnimating ? 0 : 1,
            transform: isAnimating ? 'translateX(8px)' : 'translateX(0)',
            transition: 'opacity 0.2s ease, transform 0.2s ease',
          }}>
            {renderStep()}
          </div>

          {/* Error */}
          {submitError && (
            <div className="assess-error">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C53030" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              <span>{submitError}</span>
            </div>
          )}

          {/* Navigation */}
          <div className="assess-nav">
            {!form.isFirstStep ? (
              <button className="assess-btn-back" onClick={form.goToPreviousStep} disabled={isSubmitting}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                Back
              </button>
            ) : <div />}
            <button
              className="assess-btn-next"
              onClick={handleNext}
              disabled={!form.canProceed || isSubmitting}
            >
              {isSubmitting ? (
                <><span className="assess-spinner" /> Submitting...</>
              ) : form.currentStep === TOTAL_INPUT_STEPS ? (
                <>Submit Assessment</>
              ) : (
                <>Continue <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg></>
              )}
            </button>
          </div>
        </main>

        {/* Trust Footer */}
        {form.currentStep === 1 ? (
          <div className="assess-hipaa-notice">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1B2A4A" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <div>
              <strong>Privacy & HIPAA Notice</strong>
              <p>Your information is protected under HIPAA and will only be used to assess your eligibility and contact you about treatment.</p>
            </div>
          </div>
        ) : (
          <div className="assess-trust-footer">
            🔒 256-bit encryption · HIPAA compliant
          </div>
        )}

        <Footer />
      </div>
    </div>
  );
};

/** TMS Institute Logo — uses real logo from /static/images/logo.png with inline SVG fallback */
const Logo: React.FC<{ logoUrl: string }> = ({ logoUrl }) => {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <div className="assess-logo">
      {!imgError && (
        <img
          src={logoUrl}
          alt="TMS Institute of Arizona"
          onError={() => setImgError(true)}
          onLoad={() => setImgLoaded(true)}
          style={{ height: 42, width: 'auto', display: imgLoaded ? 'block' : 'none' }}
        />
      )}
      {(!imgLoaded || imgError) && (
        /* Professional inline SVG logo — works everywhere */
        <svg viewBox="0 0 44 44" width="42" height="42" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="44" height="44" rx="10" fill="#1B2A4A"/>
          <path d="M10 15h24" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
          <path d="M22 15v16" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
          <path d="M15 15v5" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
          <path d="M29 15v5" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
          <circle cx="22" cy="26" r="3.5" fill="#60a5fa"/>
          <circle cx="22" cy="26" r="1.5" fill="#fff"/>
        </svg>
      )}
      <div className="assess-logo-text">
        <span className="assess-logo-name">TMS Institute</span>
        <span className="assess-logo-sub">of Arizona</span>
      </div>
    </div>
  );
};

/** Progress Bar — 4px thin, navy fill, step counter */
const ProgressBar: React.FC<{ current: number; total: number; stepName: string }> = ({ current, total, stepName }) => {
  const pct = Math.round((current / total) * 100);
  return (
    <div className="assess-progress">
      <div className="assess-progress-top">
        <span className="assess-progress-label">{stepName}</span>
        <span className="assess-progress-count">{current} of {total}</span>
      </div>
      <div className="assess-progress-bar">
        <div className="assess-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

/** Footer — Encryption notice + copyright */
const Footer: React.FC = () => (
  <footer className="assess-footer">
    © {new Date().getFullYear()} TMS Institute of Arizona · All rights reserved
  </footer>
);
