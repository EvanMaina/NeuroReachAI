/**
 * Referral Step Component — Widget-Polished.
 * 
 * Step 10: Referral info from healthcare providers.
 * Minimal placeholders, clean layout.
 * 
 * @module components/widget/ReferralStep
 * @version 3.0.0
 */

import React from 'react';
import { Check, X } from 'lucide-react';

interface ReferralStepProps {
  isReferral: boolean | null;
  referringProviderName: string;
  referringClinic: string;
  referringProviderEmail: string;
  referringProviderSpecialty: string;
  onIsReferralChange: (value: boolean) => void;
  onProviderNameChange: (value: string) => void;
  onClinicChange: (value: string) => void;
  onProviderEmailChange: (value: string) => void;
  onProviderSpecialtyChange: (value: string) => void;
}

export const ReferralStep: React.FC<ReferralStepProps> = ({
  isReferral,
  referringProviderName,
  referringClinic,
  referringProviderEmail,
  referringProviderSpecialty,
  onIsReferralChange,
  onProviderNameChange,
  onClinicChange,
  onProviderEmailChange,
  onProviderSpecialtyChange,
}) => {
  const isValidEmail = (email: string): boolean => {
    if (!email.trim()) return false;
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim());
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-gray-900">
          Were you referred by a provider?
        </h3>
        <p className="text-sm text-gray-600">
          Let us know if a doctor recommended TMS for you.
        </p>
      </div>

      {/* Yes/No Selection */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onIsReferralChange(true)}
          className={`
            flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all duration-200
            ${isReferral === true
              ? 'border-green-500 bg-green-50 text-green-700'
              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }
          `}
        >
          <div className={`w-5 h-5 rounded-full flex items-center justify-center
            ${isReferral === true ? 'bg-green-500' : 'bg-gray-200'}
          `}>
            <Check size={12} className={isReferral === true ? 'text-white' : 'text-gray-400'} />
          </div>
          <span className="font-medium text-sm">Yes</span>
        </button>

        <button
          type="button"
          onClick={() => onIsReferralChange(false)}
          className={`
            flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all duration-200
            ${isReferral === false
              ? 'border-blue-500 bg-blue-50 text-blue-700'
              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }
          `}
        >
          <div className={`w-5 h-5 rounded-full flex items-center justify-center
            ${isReferral === false ? 'bg-blue-500' : 'bg-gray-200'}
          `}>
            <X size={12} className={isReferral === false ? 'text-white' : 'text-gray-400'} />
          </div>
          <span className="font-medium text-sm">No</span>
        </button>
      </div>

      {/* Provider Fields — all optional */}
      {isReferral === true && (
        <div className="space-y-3 pt-2 border-t border-gray-100 animate-fade-in">
          {/* Provider Name */}
          <div>
            <label htmlFor="providerName" className="block text-sm font-medium text-gray-700 mb-1">
              Provider name <span className="text-gray-400 text-xs">(optional)</span>
            </label>
            <input
              id="providerName"
              type="text"
              value={referringProviderName}
              onChange={(e) => onProviderNameChange(e.target.value)}
              placeholder="Provider name"
              className={`w-full px-3 py-2 text-sm border rounded-lg transition-colors
                ${referringProviderName.trim() ? 'border-green-300' : 'border-gray-300'}
              `}
            />
          </div>

          {/* Specialty */}
          <div>
            <label htmlFor="providerSpecialty" className="block text-sm font-medium text-gray-700 mb-1">
              Specialty <span className="text-gray-400 text-xs">(optional)</span>
            </label>
            <input
              id="providerSpecialty"
              type="text"
              value={referringProviderSpecialty}
              onChange={(e) => onProviderSpecialtyChange(e.target.value)}
              placeholder="Specialty"
              className={`w-full px-3 py-2 text-sm border rounded-lg transition-colors
                ${referringProviderSpecialty.trim() ? 'border-green-300' : 'border-gray-300'}
              `}
            />
          </div>

          {/* Clinic Name */}
          <div>
            <label htmlFor="clinicName" className="block text-sm font-medium text-gray-700 mb-1">
              Clinic name <span className="text-gray-400 text-xs">(optional)</span>
            </label>
            <input
              id="clinicName"
              type="text"
              value={referringClinic}
              onChange={(e) => onClinicChange(e.target.value)}
              placeholder="Clinic name"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg transition-colors"
            />
          </div>

          {/* Provider Email */}
          <div>
            <label htmlFor="providerEmail" className="block text-sm font-medium text-gray-700 mb-1">
              Provider email <span className="text-gray-400 text-xs">(optional)</span>
            </label>
            <input
              id="providerEmail"
              type="email"
              value={referringProviderEmail}
              onChange={(e) => onProviderEmailChange(e.target.value)}
              placeholder="Email address"
              className={`w-full px-3 py-2 text-sm border rounded-lg transition-colors
                ${referringProviderEmail.trim() && isValidEmail(referringProviderEmail)
                  ? 'border-green-300'
                  : referringProviderEmail.trim() && !isValidEmail(referringProviderEmail)
                  ? 'border-red-300'
                  : 'border-gray-300'}
              `}
            />
            {referringProviderEmail.trim() && !isValidEmail(referringProviderEmail) && (
              <p className="text-xs text-red-500 mt-1">Please enter a valid email</p>
            )}
          </div>
        </div>
      )}

      {/* Non-Referral Message */}
      {isReferral === false && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg animate-fade-in">
          <p className="text-sm text-blue-800">
            <strong>No problem!</strong> Our care team will guide you through the process.
          </p>
        </div>
      )}
    </div>
  );
};

export default ReferralStep;
