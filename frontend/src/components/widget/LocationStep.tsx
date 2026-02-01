/**
 * Location Step — Widget-Polished.
 * Step 8: ZIP code input.
 * @version 3.0.0
 */

import React from 'react';

interface LocationStepProps {
  zipCode: string;
  onChange: (value: string) => void;
}

export const LocationStep: React.FC<LocationStepProps> = ({
  zipCode,
  onChange,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 5);
    onChange(value);
  };

  const isValidFormat = zipCode.length === 5;
  const isArizonaZip = zipCode.startsWith('85') || zipCode.startsWith('86');

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-gray-900">
          What's your ZIP code?
        </h3>
        <p className="text-sm text-gray-600">
          Helps us find your nearest clinic location.
        </p>
      </div>

      <div>
        <label htmlFor="zipCode" className="block text-sm font-medium text-gray-700 mb-1">
          ZIP Code
        </label>
        <input
          id="zipCode"
          type="text"
          inputMode="numeric"
          value={zipCode}
          onChange={handleChange}
          placeholder="ZIP code"
          maxLength={5}
          className="w-full px-4 py-2.5 text-base tracking-wider border border-gray-300
                     rounded-lg text-center font-mono"
        />
      </div>

      {isValidFormat && (
        <div className={`animate-fade-in rounded-lg p-3 ${
          isArizonaZip
            ? 'bg-green-50 border border-green-200'
            : 'bg-amber-50 border border-amber-200'
        }`}>
          {isArizonaZip ? (
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-xs text-green-800">
                <strong>Great!</strong> You're in our service area.
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-xs text-amber-800">
                You may be outside our primary service area. Continue to discuss telehealth options.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
        <p className="text-xs text-gray-600">
          <strong>Locations:</strong> Phoenix, Scottsdale, Mesa, Tucson & Tempe.
        </p>
      </div>
    </div>
  );
};
