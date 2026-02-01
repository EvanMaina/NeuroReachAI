/**
 * Shared Enum Formatting Utilities
 * 
 * Converts backend enum values (UPPERCASE_SNAKE) to human-readable labels.
 * Single source of truth for all enum display formatting across the app.
 * 
 * @module utils/enumFormatters
 */

import {
  CONDITION_LABELS,
  DURATION_LABELS,
  TREATMENT_LABELS,
  URGENCY_LABELS,
  type ConditionType,
  type DurationType,
  type TreatmentType,
  type UrgencyType,
} from '../types/lead';

// =============================================================================
// Generic Enum Formatter
// =============================================================================

/**
 * Convert any UPPERCASE_SNAKE_CASE enum value to Title Case.
 * Falls back to this when no specific label map is provided.
 * 
 * Examples:
 *   "DEPRESSION" → "Depression"
 *   "LESS_THAN_6_MONTHS" → "Less Than 6 Months"
 *   "THERAPY_CBT" → "Therapy Cbt"
 *   "NOT_INTERESTED" → "Not Interested"
 */
export function formatEnumValue(value: string | null | undefined): string {
  if (!value) return '—';
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// =============================================================================
// Specific Formatters with Label Maps
// =============================================================================

/**
 * Format condition enum to display label.
 * Uses CONDITION_LABELS map for known values, falls back to generic formatter.
 */
export function formatCondition(value: string | null | undefined): string {
  if (!value) return '—';
  const label = CONDITION_LABELS[value as ConditionType];
  return label || formatEnumValue(value);
}

/**
 * Format an array of conditions to a comma-separated display string.
 */
export function formatConditions(conditions: string[] | null | undefined, otherText?: string): string {
  if (!conditions || conditions.length === 0) return '—';
  const labels = conditions.map((c) => formatCondition(c));
  // Append other text if "OTHER" is in the list
  if (otherText && conditions.some((c) => c.toUpperCase() === 'OTHER')) {
    const idx = labels.findIndex((_, i) => conditions[i].toUpperCase() === 'OTHER');
    if (idx >= 0) {
      labels[idx] = otherText;
    }
  }
  return labels.join(', ');
}

/**
 * Format duration enum to display label.
 */
export function formatDuration(value: string | null | undefined): string {
  if (!value) return '—';
  const label = DURATION_LABELS[value as DurationType];
  return label || formatEnumValue(value);
}

/**
 * Format treatment enum to display label.
 */
export function formatTreatment(value: string | null | undefined): string {
  if (!value) return '—';
  const label = TREATMENT_LABELS[value as TreatmentType];
  return label || formatEnumValue(value);
}

/**
 * Format an array of treatments to a comma-separated display string.
 */
export function formatTreatments(treatments: string[] | null | undefined): string {
  if (!treatments || treatments.length === 0) return 'None';
  return treatments.map((t) => formatTreatment(t)).join(', ');
}

/**
 * Format urgency enum to display label.
 */
export function formatUrgency(value: string | null | undefined): string {
  if (!value) return '—';
  const label = URGENCY_LABELS[value as UrgencyType];
  return label || formatEnumValue(value);
}

// =============================================================================
// Lead Score Color Coding
// =============================================================================

/**
 * Get color classes for a lead score value.
 * 
 * Rules:
 *   0-50:   Red (low qualification)
 *   51-150: Amber (medium qualification)
 *   151+:   Green (high qualification)
 */
export function getScoreColor(score: number | null | undefined): {
  text: string;
  bg: string;
  border: string;
  dot: string;
} {
  if (score == null) return { text: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-200', dot: 'bg-gray-400' };
  
  if (score <= 50) {
    return { text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', dot: 'bg-red-500' };
  }
  if (score <= 150) {
    return { text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500' };
  }
  return { text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500' };
}

/**
 * Get a human-readable score tier label.
 */
export function getScoreTier(score: number | null | undefined): string {
  if (score == null) return 'Unknown';
  if (score <= 50) return 'Low';
  if (score <= 150) return 'Medium';
  return 'High';
}
