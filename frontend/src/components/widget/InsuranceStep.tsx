/**
 * Insurance Step — Widget-Polished.
 * Step 7: Insurance information.
 * @version 3.0.0
 */

import React from 'react';

interface InsuranceStepProps {
  hasInsurance: boolean | null;
  insuranceProvider: string;
  onInsuranceChange: (value: boolean) => void;
  onProviderChange: (value: string) => void;
}

export const InsuranceStep: React.FC<InsuranceStepProps> = ({
  hasInsurance,
  insuranceProvider,
  onInsuranceChange,
  onProviderChange,
}) => {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-gray-900">
          Do you have health insurance?
        </h3>
        <p className="text-sm text-gray-600">
          Many insurance plans cover TMS therapy.
        </p>
      </div>

      <div className="space-y-2">
        <label
          className={`nr-option-card flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer
                      transition-all duration-200 hover:border-indigo-300
                      ${hasInsurance === true
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 bg-white'}`}
        >
          <input
            type="radio"
            name="hasInsurance"
            checked={hasInsurance === true}
            onChange={() => onInsuranceChange(true)}
            className="nr-card-radio"
          />
          <div>
            <span className={`font-medium text-sm ${
              hasInsurance === true ? 'text-indigo-900' : 'text-gray-700'
            }`}>
              Yes, I have insurance
            </span>
            <p className="text-xs text-gray-500 mt-0.5">We'll help verify your coverage</p>
          </div>
        </label>

        <label
          className={`nr-option-card flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer
                      transition-all duration-200 hover:border-indigo-300
                      ${hasInsurance === false
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 bg-white'}`}
        >
          <input
            type="radio"
            name="hasInsurance"
            checked={hasInsurance === false}
            onChange={() => onInsuranceChange(false)}
            className="nr-card-radio"
          />
          <div>
            <span className={`font-medium text-sm ${
              hasInsurance === false ? 'text-indigo-900' : 'text-gray-700'
            }`}>
              No insurance
            </span>
            <p className="text-xs text-gray-500 mt-0.5">Self-pay options available</p>
          </div>
        </label>
      </div>

      {hasInsurance === true && (
        <div className="space-y-2 animate-fade-in">
          <label htmlFor="insuranceProvider" className="block text-sm font-medium text-gray-700">
            Insurance provider <span className="text-gray-400 text-xs">(optional)</span>
          </label>
          <input
            id="insuranceProvider"
            type="text"
            value={insuranceProvider}
            onChange={(e) => onProviderChange(e.target.value)}
            placeholder="Insurance provider"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
      )}

      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
        <p className="text-xs text-green-800">
          <strong>Good news:</strong> TMS is covered by most major insurance plans including Medicare.
        </p>
      </div>
    </div>
  );
};
