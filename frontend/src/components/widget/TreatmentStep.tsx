/**
 * Treatment Step — Widget-Polished.
 * Step 6: Prior treatments multi-select.
 * @version 3.0.0
 */

import React from 'react';
import { type TreatmentType, TREATMENT_LABELS } from '../../types/lead';

interface TreatmentStepProps {
  treatments: TreatmentType[];
  onChange: (value: TreatmentType[]) => void;
}

const TREATMENTS: TreatmentType[] = [
  'ANTIDEPRESSANTS',
  'THERAPY_CBT',
  'BOTH',
  'OTHER',
  'NONE',
];

export const TreatmentStep: React.FC<TreatmentStepProps> = ({
  treatments,
  onChange,
}) => {
  const handleToggle = (treatment: TreatmentType): void => {
    if (treatment === 'NONE') {
      onChange(['NONE']);
    } else {
      const withoutNone = treatments.filter((t) => t !== 'NONE');
      if (treatments.includes(treatment)) {
        onChange(withoutNone.filter((t) => t !== treatment));
      } else {
        onChange([...withoutNone, treatment]);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-gray-900">
          What treatments have you tried?
        </h3>
        <p className="text-sm text-gray-600">
          Select all that apply.
        </p>
      </div>

      <div className="space-y-2">
        {TREATMENTS.map((type) => (
          <label
            key={type}
            className={`nr-option-card flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer
                        transition-all duration-200 hover:border-indigo-300
                        ${treatments.includes(type)
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 bg-white'}`}
          >
            <input
              type="checkbox"
              checked={treatments.includes(type)}
              onChange={() => handleToggle(type)}
              className="nr-card-checkbox"
            />
            <span className={`font-medium text-sm ${
              treatments.includes(type) ? 'text-indigo-900' : 'text-gray-700'
            }`}>
              {TREATMENT_LABELS[type]}
            </span>
          </label>
        ))}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
        <p className="text-xs text-amber-800">
          <strong>Note:</strong> Treatment history may affect insurance coverage eligibility.
        </p>
      </div>
    </div>
  );
};
