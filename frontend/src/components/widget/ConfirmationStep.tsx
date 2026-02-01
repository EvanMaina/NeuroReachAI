/**
 * Confirmation Step — Widget-Polished.
 * Step 12: Shows submission success and next steps.
 * @version 3.0.0
 */

import React from 'react';
import type { ILeadSubmitResponse } from '../../types/lead';

interface ConfirmationStepProps {
  response: ILeadSubmitResponse | null;
  onReset: () => void;
  onClose?: () => void;
}

export const ConfirmationStep: React.FC<ConfirmationStepProps> = ({
  response,
  onReset,
  onClose,
}) => {
  if (!response) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Success */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-3">
          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-gray-900">Thank You!</h3>
        <p className="text-sm text-gray-600 mt-1">
          Your information has been submitted.
        </p>
      </div>

      {/* Reference Number */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-center">
        <p className="text-xs text-indigo-600 font-medium">Reference Number</p>
        <p className="text-xl font-mono font-bold text-indigo-900 mt-1">
          {response.leadId}
        </p>
      </div>

      {/* Next Steps */}
      <div className="space-y-2">
        <h4 className="font-semibold text-sm text-gray-900">What's next?</h4>
        <ol className="space-y-2">
          {[
            { num: '1', title: 'Review', desc: 'Our team reviews within 24 hours' },
            { num: '2', title: 'Contact', desc: 'A coordinator will reach out' },
            { num: '3', title: 'Consult', desc: 'Discuss your treatment options' },
          ].map((step) => (
            <li key={step.num} className="flex gap-2">
              <span className="flex-shrink-0 w-5 h-5 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-semibold">
                {step.num}
              </span>
              <div>
                <p className="text-sm font-medium text-gray-900">{step.title}</p>
                <p className="text-xs text-gray-500">{step.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button onClick={onReset} className="flex-1 btn-secondary px-3 py-2 text-sm">
          New Assessment
        </button>
        {onClose && (
          <button onClick={onClose} className="flex-1 btn-primary px-3 py-2 text-sm">
            Close
          </button>
        )}
      </div>
    </div>
  );
};
