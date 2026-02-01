/**
 * Urgency Step — Widget-Polished.
 * Step 9: How soon to start treatment.
 * @version 3.0.0
 */

import React from 'react';
import { type UrgencyType, URGENCY_LABELS } from '../../types/lead';

interface UrgencyStepProps {
  urgency: UrgencyType | null;
  onChange: (value: UrgencyType) => void;
}

const URGENCY_OPTIONS: { value: UrgencyType; label: string; description: string }[] = [
  { value: 'ASAP', label: URGENCY_LABELS['ASAP'], description: 'Start treatment right away' },
  { value: 'WITHIN_30_DAYS', label: URGENCY_LABELS['WITHIN_30_DAYS'], description: 'Flexible but want to start soon' },
  { value: 'EXPLORING', label: URGENCY_LABELS['EXPLORING'], description: 'Still researching options' },
];

export const UrgencyStep: React.FC<UrgencyStepProps> = ({ urgency, onChange }) => {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-gray-900">
          How soon would you like to start?
        </h3>
        <p className="text-sm text-gray-600">
          Helps us prioritize your consultation.
        </p>
      </div>

      <div className="space-y-2">
        {URGENCY_OPTIONS.map((option) => (
          <label
            key={option.value}
            className={`
              nr-option-card block p-3 border-2 rounded-xl cursor-pointer transition-all duration-200
              ${urgency === option.value
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-200 hover:border-gray-300 bg-white'
              }
            `}
          >
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="urgency"
                value={option.value}
                checked={urgency === option.value}
                onChange={(e) => onChange(e.target.value as UrgencyType)}
                className="nr-card-radio"
                style={{ marginTop: '2px' }}
              />
              <div>
                <span className={`block font-medium text-sm ${
                  urgency === option.value ? 'text-indigo-900' : 'text-gray-900'
                }`}>
                  {option.label}
                </span>
                <span className="block text-xs text-gray-500 mt-0.5">
                  {option.description}
                </span>
              </div>
            </div>
          </label>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-xs text-blue-800">
          Most patients begin TMS within 1–2 weeks of their consultation.
        </p>
      </div>
    </div>
  );
};
