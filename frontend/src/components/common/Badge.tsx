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
  hot: 'bg-red-500 text-white',
  medium: 'bg-amber-500 text-white',
  low: 'bg-gray-400 text-white',
  disqualified: 'bg-gray-300 text-gray-600',
};

const statusStyles: Record<LeadStatus, string> = {
  new: 'bg-emerald-500 text-white',
  contacted: 'bg-blue-500 text-white',
  scheduled: 'bg-purple-500 text-white',
  'consultation complete': 'bg-teal-500 text-white',
  'treatment started': 'bg-indigo-500 text-white',
  lost: 'bg-orange-500 text-white',
  disqualified: 'bg-gray-400 text-white',
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
    ? 'px-2.5 py-0.5 text-xs' 
    : 'px-3 py-1 text-sm';

  return (
    <span
      className={`
        inline-flex items-center font-semibold rounded-md border-0
        ${styles} ${sizeStyles}
      `}
    >
      {formatLabel(safeValue || 'unknown')}
    </span>
  );
};
