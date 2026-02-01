/**
 * Progress bar component for intake widget.
 */
import React from 'react';

interface ProgressBarProps {
  progress: number;
  current?: number;
  total?: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  current,
  total,
}) => {
  return (
    <div className="bg-white">
      {(typeof current === 'number' && typeof total === 'number') && (
        <div className="px-6 pt-2 pb-1 flex items-center justify-between text-xs text-gray-500">
          <span className="font-medium text-gray-600">
            Progress
          </span>
          <span aria-label={`Question ${current} of ${total}`}>Question {current} of {total}</span>
        </div>
      )}

      <div className="h-1.5 bg-gray-200">
        <div
          className="h-full bg-secondary-500 transition-all duration-300 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
    </div>
  );
};
