/**
 * Badge Component
 * 
 * Consistent badge styling for priority and status display.
 */

import React from 'react';
import type { LeadPriority, LeadStatus } from '../../types/lead';

interface BadgeProps {
  variant: 'priority' | 'status';
  value: LeadPriority | LeadStatus;
  size?: 'sm' | 'md';
}

const priorityStyles: Record<LeadPriority, string> = {
  hot: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low: 'bg-gray-100 text-gray-600 border-gray-200',
  disqualified: 'bg-gray-200 text-gray-500 border-gray-300',
};

const statusStyles: Record<LeadStatus, string> = {
  new: 'bg-blue-100 text-blue-700 border-blue-200',
  contacted: 'bg-purple-100 text-purple-700 border-purple-200',
  scheduled: 'bg-green-100 text-green-700 border-green-200',
  'consultation complete': 'bg-teal-100 text-teal-700 border-teal-200',
  'treatment started': 'bg-indigo-100 text-indigo-700 border-indigo-200',
  lost: 'bg-orange-100 text-orange-700 border-orange-200',
  disqualified: 'bg-gray-100 text-gray-600 border-gray-200',
};

const formatLabel = (value: string): string => {
  // Supports values like "consultation complete" and "CONSULTATION_COMPLETE"
  return value
    .replace(/_/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

export const Badge: React.FC<BadgeProps> = ({ variant, value, size = 'sm' }) => {
  // Normalize value: handle null/undefined, convert underscores to spaces for status lookup
  const safeValue = (value ?? '').toString().toLowerCase().replace(/_/g, ' ');
  
  const fallbackStyle = 'bg-gray-100 text-gray-600 border-gray-200';
  
  const styles = variant === 'priority' 
    ? (priorityStyles[safeValue as LeadPriority] || fallbackStyle)
    : (statusStyles[safeValue as LeadStatus] || fallbackStyle);
  
  const sizeStyles = size === 'sm' 
    ? 'px-2 py-0.5 text-xs' 
    : 'px-3 py-1 text-sm';

  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-full border
        ${styles} ${sizeStyles}
      `}
    >
      {formatLabel(safeValue || 'unknown')}
    </span>
  );
};
