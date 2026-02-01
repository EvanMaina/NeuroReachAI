/**
 * Step 11: Contact Information Step — Widget-Polished.
 * 
 * Collects patient contact details. Clean, minimal placeholders.
 * 
 * @module components/widget/ContactStep
 * @version 3.0.0
 */

import React, { useState, useEffect } from 'react';
import { type PreferredContactMethod } from '../../types/lead';
import { Phone, Mail, MessageSquare, Check } from 'lucide-react';

interface ContactStepProps {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  smsConsent: boolean;
  preferredContactMethod: PreferredContactMethod | null;
  onFirstNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onDateOfBirthChange: (value: string) => void;
  onSmsConsentChange: (value: boolean) => void;
  onPreferredContactChange: (value: PreferredContactMethod) => void;
}

// Country code patterns
const COUNTRY_PATTERNS = {
  US: { code: '1', pattern: /^1?([2-9]\d{2})(\d{3})(\d{4})$/, minDigits: 10, maxDigits: 11 },
  KE: { code: '254', pattern: /^(?:254|0)?([17]\d{8})$/, minDigits: 9, maxDigits: 12 },
  UK: { code: '44', pattern: /^44?(\d{10})$/, minDigits: 10, maxDigits: 12 },
  INTL: { code: '', pattern: /^\+?\d{7,15}$/, minDigits: 7, maxDigits: 15 },
};

const detectCountry = (digits: string): keyof typeof COUNTRY_PATTERNS => {
  if (digits.startsWith('1') && digits.length >= 10) return 'US';
  if (digits.startsWith('254') || (digits.startsWith('0') && digits.length === 10)) return 'KE';
  if (digits.startsWith('44')) return 'UK';
  if (digits.length >= 7) return 'INTL';
  return 'US';
};

const formatPhoneNumber = (value: string): string => {
  const hasPlus = value.startsWith('+');
  const cleaned = value.replace(/\D/g, '');
  const limited = cleaned.slice(0, 15);
  if (limited.length === 0) return '';
  const country = detectCountry(limited);

  if (country === 'KE') {
    if (limited.startsWith('254')) {
      const rest = limited.slice(3);
      if (rest.length <= 3) return `+254 ${rest}`;
      if (rest.length <= 6) return `+254 ${rest.slice(0, 3)} ${rest.slice(3)}`;
      return `+254 ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6, 9)}`;
    } else if (limited.startsWith('0')) {
      if (limited.length <= 4) return limited;
      if (limited.length <= 7) return `${limited.slice(0, 4)} ${limited.slice(4)}`;
      return `${limited.slice(0, 4)} ${limited.slice(4, 7)} ${limited.slice(7, 10)}`;
    } else {
      if (limited.length <= 3) return limited;
      if (limited.length <= 6) return `${limited.slice(0, 3)} ${limited.slice(3)}`;
      return `${limited.slice(0, 3)} ${limited.slice(3, 6)} ${limited.slice(6, 9)}`;
    }
  }

  if (country === 'US') {
    const digits = limited.startsWith('1') ? limited.slice(1) : limited;
    const usDigits = digits.slice(0, 10);
    if (usDigits.length <= 3) return hasPlus ? `+1 ${usDigits}` : usDigits;
    if (usDigits.length <= 6) return hasPlus ? `+1 (${usDigits.slice(0, 3)}) ${usDigits.slice(3)}` : `(${usDigits.slice(0, 3)}) ${usDigits.slice(3)}`;
    return hasPlus
      ? `+1 (${usDigits.slice(0, 3)}) ${usDigits.slice(3, 6)}-${usDigits.slice(6)}`
      : `(${usDigits.slice(0, 3)}) ${usDigits.slice(3, 6)}-${usDigits.slice(6)}`;
  }

  if (country === 'UK') {
    const ukDigits = limited.startsWith('44') ? limited : `44${limited}`;
    return `+${ukDigits.slice(0, 2)} ${ukDigits.slice(2, 6)} ${ukDigits.slice(6)}`;
  }

  if (hasPlus || limited.length > 10) return `+${limited}`;
  if (limited.length <= 3) return limited;
  if (limited.length <= 6) return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
  return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6, 10)}`;
};

const validatePhoneNumber = (value: string): string => {
  const cleaned = value.replace(/\D/g, '');
  if (!cleaned) return 'Required';
  const country = detectCountry(cleaned);

  if (country === 'KE') {
    let n = cleaned;
    if (cleaned.startsWith('254')) n = cleaned.slice(3);
    else if (cleaned.startsWith('0')) n = cleaned.slice(1);
    if (n.length !== 9) return 'Enter 9-digit Kenyan number';
    if (!n.startsWith('7') && !n.startsWith('1')) return 'Invalid format';
    return '';
  }
  if (country === 'US') {
    const usDigits = cleaned.startsWith('1') ? cleaned.slice(1) : cleaned;
    if (usDigits.length < 10) return 'Must be 10 digits';
    if (usDigits[0] === '0' || usDigits[0] === '1') return 'Invalid area code';
    return '';
  }
  if (cleaned.length < 7) return 'Too short';
  if (cleaned.length > 15) return 'Too long';
  return '';
};

const CONTACT_METHOD_OPTIONS: Array<{
  value: PreferredContactMethod;
  label: string;
  icon: React.ReactNode;
}> = [
  { value: 'phone_call', label: 'Phone', icon: <Phone size={14} /> },
  { value: 'text', label: 'Text', icon: <MessageSquare size={14} /> },
  { value: 'email', label: 'Email', icon: <Mail size={14} /> },
  { value: 'any', label: 'Any', icon: <Check size={14} /> },
];

export const ContactStep: React.FC<ContactStepProps> = ({
  firstName, lastName, email, phone, dateOfBirth, smsConsent, preferredContactMethod,
  onFirstNameChange, onLastNameChange, onEmailChange, onPhoneChange,
  onDateOfBirthChange, onSmsConsentChange, onPreferredContactChange,
}) => {
  const [touched, setTouched] = useState({ firstName: false, lastName: false, email: false, phone: false });
  const [errors, setErrors] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  useEffect(() => {
    const e = { firstName: '', lastName: '', email: '', phone: '' };
    if (touched.firstName && !firstName.trim()) e.firstName = 'Required';
    if (touched.lastName && !lastName.trim()) e.lastName = 'Required';
    if (touched.email) {
      if (!email.trim()) e.email = 'Required';
      else if (!emailRegex.test(email.trim())) e.email = 'Invalid email';
    }
    if (touched.phone) e.phone = validatePhoneNumber(phone);
    setErrors(e);
  }, [firstName, lastName, email, phone, touched]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onPhoneChange(formatPhoneNumber(e.target.value));
  };
  const handleBlur = (field: keyof typeof touched) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const today = new Date();
  const maxDate = new Date(today.getFullYear() - 10, today.getMonth(), today.getDate()).toISOString().split('T')[0];
  const minDate = new Date(today.getFullYear() - 100, today.getMonth(), today.getDate()).toISOString().split('T')[0];

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-gray-900">
          How can we reach you?
        </h3>
        <p className="text-sm text-gray-600">
          We'll contact you within 24 hours.
        </p>
      </div>

      <div className="space-y-3">
        {/* Name Fields */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
              First Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="firstName"
              value={firstName}
              onChange={(e) => onFirstNameChange(e.target.value)}
              onBlur={() => handleBlur('firstName')}
              placeholder="First name"
              className={`w-full px-3 py-2 border rounded-lg text-sm transition-colors ${
                errors.firstName ? 'border-red-400' : 'border-gray-300'
              }`}
              autoComplete="given-name"
            />
            {errors.firstName && (
              <p className="mt-1 text-xs text-red-500">{errors.firstName}</p>
            )}
          </div>
          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
              Last Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="lastName"
              value={lastName}
              onChange={(e) => onLastNameChange(e.target.value)}
              onBlur={() => handleBlur('lastName')}
              placeholder="Last name"
              className={`w-full px-3 py-2 border rounded-lg text-sm transition-colors ${
                errors.lastName ? 'border-red-400' : 'border-gray-300'
              }`}
              autoComplete="family-name"
            />
            {errors.lastName && (
              <p className="mt-1 text-xs text-red-500">{errors.lastName}</p>
            )}
          </div>
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            onBlur={() => handleBlur('email')}
            placeholder="Email address"
            className={`w-full px-3 py-2 border rounded-lg text-sm transition-colors ${
              errors.email ? 'border-red-400' : 'border-gray-300'
            }`}
            autoComplete="email"
          />
          {errors.email && (
            <p className="mt-1 text-xs text-red-500">{errors.email}</p>
          )}
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
            Phone <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            id="phone"
            value={phone}
            onChange={handlePhoneChange}
            onBlur={() => handleBlur('phone')}
            placeholder="Phone number"
            className={`w-full px-3 py-2 border rounded-lg text-sm transition-colors ${
              errors.phone ? 'border-red-400' : 'border-gray-300'
            }`}
            autoComplete="tel"
          />
          {errors.phone && (
            <p className="mt-1 text-xs text-red-500">{errors.phone}</p>
          )}
        </div>

        {/* Date of Birth */}
        <div>
          <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700 mb-1">
            Date of Birth <span className="text-gray-400 text-xs">(optional)</span>
          </label>
          <input
            type="date"
            id="dateOfBirth"
            value={dateOfBirth}
            onChange={(e) => onDateOfBirthChange(e.target.value)}
            min={minDate}
            max={maxDate}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm transition-colors"
            autoComplete="bday"
          />
        </div>

        {/* Preferred Contact Method — 2x2 spacious grid */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>
            Preferred contact <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {CONTACT_METHOD_OPTIONS.map((option) => {
              const isActive = preferredContactMethod === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onPreferredContactChange(option.value)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '14px 8px',
                    minHeight: '56px',
                    borderRadius: '12px',
                    border: isActive ? '2px solid #7c3aed' : '1.5px solid #e5e7eb',
                    background: isActive ? 'linear-gradient(135deg, #f5f3ff, #ede9fe)' : '#fff',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    outline: 'none',
                    color: isActive ? '#6d28d9' : '#6b7280',
                  }}
                >
                  <span style={{ fontSize: '18px', display: 'flex' }}>{option.icon}</span>
                  <span style={{ fontSize: '12px', fontWeight: isActive ? 600 : 500 }}>{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* SMS Consent — Prominent card design */}
        <div className="nr-sms-consent-card">
          <label className="nr-sms-consent-label">
            <input
              type="checkbox"
              checked={smsConsent}
              onChange={(e) => onSmsConsentChange(e.target.checked)}
              className="nr-sms-checkbox"
            />
            <span className="nr-sms-consent-text">
              I agree to receive text messages. Msg & data rates may apply.
            </span>
          </label>
        </div>
      </div>
    </div>
  );
};
