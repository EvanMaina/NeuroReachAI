/**
 * Condition Step Component.
 * 
 * Step 2: Multi-condition selection (checkboxes).
 * 
 * UPDATED: Uses single native checkbox styled by widget-embed.css.
 * No duplicate custom div checkbox — only the CSS-styled native input.
 * 
 * @module components/widget/ConditionStep
 * @version 3.0.0
 */

import React from 'react';
import { type ConditionType, CONDITION_LABELS } from '../../types/lead';

interface ConditionStepProps {
  conditions: ConditionType[];
  conditionOther: string;
  onConditionsChange: (value: ConditionType[]) => void;
  onOtherChange: (value: string) => void;
}

// Condition options array - must match backend ConditionType enum
const CONDITIONS: ConditionType[] = ['DEPRESSION', 'ANXIETY', 'OCD', 'PTSD', 'OTHER'];

// Condition descriptions for better UX
const CONDITION_DESCRIPTIONS: Record<ConditionType, string> = {
  DEPRESSION: 'Persistent sadness, loss of interest',
  ANXIETY: 'Excessive worry, nervousness',
  OCD: 'Obsessive thoughts, compulsive behaviors',
  PTSD: 'Trauma-related distress, flashbacks',
  OTHER: 'Another condition not listed',
};

/**
 * Multi-condition selection step for intake form.
 * Uses single CSS-styled checkbox per card — no duplication.
 */
export const ConditionStep: React.FC<ConditionStepProps> = ({
  conditions,
  conditionOther,
  onConditionsChange,
  onOtherChange,
}) => {
  const toggleCondition = (condition: ConditionType) => {
    if (conditions.includes(condition)) {
      onConditionsChange(conditions.filter(c => c !== condition));
    } else {
      onConditionsChange([...conditions, condition]);
    }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-gray-900">
          What condition(s) are you seeking treatment for?
        </h3>
        <p className="text-sm text-gray-600">
          Select all that apply. TMS therapy has been FDA-cleared for several conditions.
        </p>
      </div>

      {/* Condition Checkboxes — single native input per card, styled by CSS */}
      <div className="space-y-2">
        {CONDITIONS.map((type) => {
          const isSelected = conditions.includes(type);
          
          return (
            <label
              key={type}
              className={`
                nr-option-card flex items-center gap-3 p-3 rounded-xl cursor-pointer
                border-2 transition-all duration-200
                ${isSelected 
                  ? 'border-indigo-500 bg-indigo-50/50 shadow-sm' 
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50'
                }
              `}
            >
              {/* Single checkbox — styled by widget-embed.css */}
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleCondition(type)}
                className="nr-card-checkbox"
                aria-label={CONDITION_LABELS[type]}
              />
              
              <div className="flex-1 min-w-0">
                <span className={`
                  font-medium block
                  ${isSelected ? 'text-indigo-900' : 'text-gray-700'}
                `}>
                  {CONDITION_LABELS[type]}
                </span>
                <span className="text-xs text-gray-500 block mt-0.5">
                  {CONDITION_DESCRIPTIONS[type]}
                </span>
              </div>
            </label>
          );
        })}
      </div>

      {/* Other Condition Text Input */}
      {conditions.includes('OTHER') && (
        <div className="space-y-2 animate-fade-in pt-2">
          <label 
            htmlFor="conditionOther" 
            className="block text-sm font-medium text-gray-700"
          >
            Please describe your condition <span className="text-red-500">*</span>
          </label>
          <input
            id="conditionOther"
            type="text"
            value={conditionOther}
            onChange={(e) => onOtherChange(e.target.value)}
            placeholder="Describe your condition"
            className={`
              w-full px-4 py-2.5 text-sm
              border rounded-xl
              focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
              transition-colors
              ${conditionOther.trim() ? 'border-indigo-300' : 'border-gray-300'}
            `}
          />
        </div>
      )}

      {/* Validation Hint */}
      {conditions.length === 0 && (
        <div className="flex items-center gap-2 text-amber-600 text-sm bg-amber-50 p-3 rounded-lg">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>Please select at least one condition to continue</span>
        </div>
      )}

      {/* Selection Summary */}
      {conditions.length > 0 && (
        <div className="text-xs text-gray-500 pt-1">
          <span className="font-medium">{conditions.length}</span> condition{conditions.length !== 1 ? 's' : ''} selected
          {conditions.length > 1 && (
            <span className="ml-1 text-indigo-600">
              — severity questions will be shown for each
            </span>
          )}
        </div>
      )}

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
};
