/**
 * Date formatting utilities for NeuroReach AI
 * 
 * Professional date/time formatters for lead activity tracking
 */

/**
 * Format a timestamp as relative time (e.g., "2 hours ago", "just now")
 * Returns null for NULL timestamps (untouched leads)
 * 
 * @param dateString - ISO timestamp string or null/undefined
 * @returns Formatted relative time string or "Never" for null values
 */
export function formatRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) {
    return 'Never';
  }

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  // Just now (< 1 minute)
  if (diffSeconds < 60) {
    return 'Just now';
  }

  // Minutes ago (< 1 hour)
  if (diffMinutes < 60) {
    return `${diffMinutes} min${diffMinutes !== 1 ? 's' : ''} ago`;
  }

  // Hours ago (< 24 hours)
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  }

  // Days ago (< 7 days)
  if (diffDays < 7) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  }

  // Weeks ago (< 4 weeks)
  if (diffWeeks < 4) {
    return `${diffWeeks} week${diffWeeks !== 1 ? 's' : ''} ago`;
  }

  // Months ago
  if (diffMonths < 12) {
    return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`;
  }

  // Over a year ago - show actual date
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format a timestamp for display with date and time
 * 
 * @param dateString - ISO timestamp string
 * @returns Formatted date/time string (e.g., "Jan 15, 2:30 PM")
 */
export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format a date for display (no time)
 * 
 * @param dateString - ISO date string
 * @returns Formatted date string (e.g., "Jan 15, 2026")
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
