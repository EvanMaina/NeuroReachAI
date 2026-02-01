/**
 * Duration Step — Widget-Polished.
 * Step 5: Symptom duration selection.
 * @version 3.0.0
 */

import React from 'react';
import { type DurationType, DURATION_LABELS } from '../../types/lead';

interface DurationStepProps {
  duration: DurationType | null;
  onChange: (value: DurationType) => void;
}

const DURATIONS: DurationType[] = [
  'LESS_THAN_6_MONTHS',
  'SIX_TO_TWELVE_MONTHS',
  'MORE_THAN_12_MONTHS',
];

export const DurationStep: React.FC<DurationStepProps> = ({
  duration,
  onChange,
}) => {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-gray-900">
          How long have you had symptoms?
        </h3>
        <p className="text-sm text-gray-600">
          Helps us understand your condition timeline.
        </p>
      </div>

      <div className="space-y-2">
        {DURATIONS.map((type) => (
          <label
            key={type}
            className={`nr-option-card flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer
                        transition-all duration-200 hover:border-indigo-300
                        ${duration === type
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 bg-white'}`}
          >
            <input
              type="radio"
              name="duration"
              value={type}
              checked={duration === type}
              onChange={() => onChange(type)}
              className="nr-card-radio"
            />
            <span className={`font-medium text-sm ${
              duration === type ? 'text-indigo-900' : 'text-gray-700'
            }`}>
              {DURATION_LABELS[type]}
            </span>
          </label>
        ))}
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
        <p className="text-xs text-gray-600">
          TMS is most effective for patients with extended symptom duration.
        </p>
      </div>
    </div>
  );
};
