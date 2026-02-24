/**
 * TMS Therapy Interest Step Component.
 * 
 * Step 4 (after Severity): Asks about TMS therapy interest.
 * 
 * Options:
 * - Daily TMS
 * - Accelerated TMS  
 * - Not sure
 * 
 * @module components/widget/TMSInterestStep
 * @version 2.0.0
 */

import React from 'react';
import { Zap, Clock, HelpCircle } from 'lucide-react';

export type TMSInterestType = 
  | 'daily_tms' 
  | 'accelerated_tms' 
  | 'not_sure';

interface TMSInterestStepProps {
  tmsInterest: TMSInterestType | null;
  onTmsInterestChange: (value: TMSInterestType) => void;
}

const TMS_OPTIONS: Array<{
  value: TMSInterestType;
  label: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    value: 'daily_tms',
    label: 'Daily TMS',
    description: 'Standard protocol with daily sessions over several weeks',
    icon: <Clock size={20} className="text-blue-500" />,
  },
  {
    value: 'accelerated_tms',
    label: 'Accelerated TMS',
    description: 'Compressed schedule with multiple sessions per day for faster results',
    icon: <Zap size={20} className="text-amber-500" />,
  },
  {
    value: 'not_sure',
    label: 'Not sure',
    description: "I'd like to learn more about my options",
    icon: <HelpCircle size={20} className="text-gray-400" />,
  },
];

/**
 * TMS Therapy Interest selection step.
 */
export const TMSInterestStep: React.FC<TMSInterestStepProps> = ({
  tmsInterest,
  onTmsInterestChange,
}) => {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-gray-900">
          What type of TMS therapy are you interested in?
        </h3>
        <p className="text-sm text-gray-600">
          Select the option that best fits your needs, or choose "Not sure" if you'd like guidance.
        </p>
      </div>

      <div className="space-y-2">
        {TMS_OPTIONS.map((option) => {
          const isSelected = tmsInterest === option.value;
          
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onTmsInterestChange(option.value)}
              className={`
                w-full flex items-start gap-3 p-3 rounded-lg border-2 text-left
                transition-all duration-200
                ${isSelected 
                  ? 'border-indigo-500 bg-indigo-50' 
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                }
              `}
            >
              {/* Icon */}
              <div className={`
                w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
                ${isSelected ? 'bg-indigo-100' : 'bg-gray-100'}
              `}>
                {option.icon}
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className={`
                  text-sm font-medium
                  ${isSelected ? 'text-indigo-900' : 'text-gray-900'}
                `}>
                  {option.label}
                </p>
                <p className={`
                  text-xs mt-0.5
                  ${isSelected ? 'text-indigo-700' : 'text-gray-500'}
                `}>
                  {option.description}
                </p>
              </div>
              
              {/* Selection indicator */}
              <div className={`
                w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0
                ${isSelected 
                  ? 'border-indigo-600 bg-indigo-600' 
                  : 'border-gray-300'
                }
              `}>
                {isSelected && (
                  <div className="w-2 h-2 rounded-full bg-white" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
