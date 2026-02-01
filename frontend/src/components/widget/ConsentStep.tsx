/**
 * Consent Step Component.
 * 
 * Step 1: HIPAA consent acknowledgment.
 */

import React from 'react';

interface ConsentStepProps {
  hipaaConsent: boolean;
  onChange: (value: boolean) => void;
}

/**
 * HIPAA consent step for intake form.
 */
export const ConsentStep: React.FC<ConsentStepProps> = ({
  hipaaConsent,
  onChange,
}) => {
  return (
    <div className="p-4 space-y-4">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-gray-900">
          Welcome to TMS Therapy
        </h3>
        <p className="text-sm text-gray-600">
          This quick assessment takes about 2 minutes.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <h4 className="font-medium text-blue-900 text-sm mb-1">
          Privacy & HIPAA Notice
        </h4>
        <p className="text-xs text-blue-800">
          Your information is protected under HIPAA and will only be used to 
          assess your eligibility and contact you about treatment.
        </p>
      </div>

      <label className="nr-option-card flex items-start gap-3 cursor-pointer group p-3 border-2 border-gray-200 rounded-lg hover:border-secondary-300 transition-colors">
        <input
          type="checkbox"
          checked={hipaaConsent}
          onChange={(e) => onChange(e.target.checked)}
          className="nr-card-checkbox"
          style={{ marginTop: '2px' }}
        />
        <span className="text-sm text-gray-700 group-hover:text-gray-900">
          I acknowledge the privacy notice above and consent to the collection 
          and use of my health information.
        </span>
      </label>

      <p className="text-xs text-gray-500">
        By continuing, you agree to our{' '}
        <a href="#" className="text-secondary-700 hover:underline">Terms</a>
        {' '}and{' '}
        <a href="#" className="text-secondary-700 hover:underline">Privacy Policy</a>.
      </p>
    </div>
  );
};
