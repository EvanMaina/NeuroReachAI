/**
 * Widget Tester Panel Component.
 * 
 * Floating panel in bottom-right corner to test the intake widget.
 * Can be toggled open/closed.
 */

import React, { useState } from 'react';
import { IntakeWidget } from '../widget/IntakeWidget';

/**
 * Widget tester panel - toggleable floating widget preview.
 */
export const WidgetTester: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 
          rounded-full shadow-lg transition-all duration-300
          ${isOpen 
            ? 'bg-gray-700 text-white hover:bg-gray-800' 
            : 'bg-secondary-600 text-white hover:bg-secondary-700'
          }
        `}
        aria-label={isOpen ? 'Close widget tester' : 'Open widget tester'}
      >
        {isOpen ? (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span className="font-medium">Close</span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="font-medium">NeuroRaeach AI</span>
          </>
        )}
      </button>

      {/* Widget Panel */}
      <div
        className={`
          fixed bottom-24 right-6 z-40 w-[400px] max-w-[calc(100vw-48px)]
          bg-white rounded-2xl shadow-2xl border border-gray-200
          transform transition-all duration-300 origin-bottom-right
          ${isOpen 
            ? 'scale-100 opacity-100 pointer-events-auto translate-y-0' 
            : 'scale-95 opacity-0 pointer-events-none translate-y-2'
          }
        `}
      >
        {/* Bubble tail */}
        <div className="absolute -bottom-1 right-12 w-3 h-3 bg-white rotate-45 border-r border-b border-gray-200" />

        {/* Panel Header */}
        <div className="bg-gray-50 px-4 py-2 rounded-t-2xl border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <span className="text-xs text-gray-500 ml-2">NeuroRaeach AI Widget</span>
            </div>
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-medium">
              Live Preview
            </span>
          </div>
        </div>

        {/* Widget Content */}
        <div className="h-[580px] overflow-auto">
          {isOpen && <IntakeWidget onClose={() => setIsOpen(false)} />}
        </div>
      </div>

      {/* Backdrop for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-30 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
};
