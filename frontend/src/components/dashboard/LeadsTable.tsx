/**
 * LeadsTable Component
 * 
 * Production-ready leads table with:
 * - Sortable columns (click header to sort)
 * - Quick filter buttons (Hot, Medium, Low, Scheduled, All)
 * - Scrollable container with sticky header
 * - Professional UI for stakeholder presentations
 * 
 * @module components/dashboard/LeadsTable
 * @version 2.0.0
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Eye, Edit2, ChevronUp, ChevronDown,
  Filter, Flame, Zap, CircleDot, Calendar, Users,
  Heart, Shield, Brain, Search, Mail, PhoneCall,
  UserCheck, AlertTriangle, RefreshCw, MessageSquare, Trash2
} from 'lucide-react';
import { Badge } from '../common/Badge';
import { LoadingSpinner } from '../common/LoadingSpinner';
import type { LeadTableRow, LeadPriority } from '../../types/lead';
import { EmailComposeDialog } from './EmailComposeDialog';
import { SMSComposeDialog } from './SMSComposeDialog';
import { formatRelativeTime } from '../../utils/dateFormatters';
import { Tag } from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

type SortField = 'leadId' | 'firstName' | 'condition' | 'priority' | 'status' | 'submittedAt' | 'lastContactAttempt' | 'lastUpdatedAt';
type SortDirection = 'asc' | 'desc';
type QuickFilter = 'all' | 'hot' | 'medium' | 'low' | 'scheduled' | 'referral';

interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

interface LeadsTableProps {
  leads: LeadTableRow[];
  totalCount: number;
  isLoading: boolean;
  error?: Error | null;
  onView: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string, name: string) => void;
  onRetry?: () => void;
  /** Optional key that resets the quick filter when changed (e.g., queue type) */
  resetFilterKey?: string;
  /** Called after a successful email/SMS send to refresh leads cache (queue movement) */
  onRefreshNeeded?: () => void;
}

// =============================================================================
// Quick Filter Configuration
// =============================================================================

const QUICK_FILTERS: Array<{
  id: QuickFilter;
  label: string;
  icon: React.ReactNode;
  color: string;
  activeColor: string;
}> = [
    {
      id: 'all',
      label: 'All',
      icon: <Users size={14} />,
      color: 'text-gray-600 hover:bg-gray-100',
      activeColor: 'bg-gray-900 text-white',
    },
    {
      id: 'hot',
      label: 'Hot',
      icon: <Flame size={14} />,
      color: 'text-red-600 hover:bg-red-50',
      activeColor: 'bg-red-600 text-white',
    },
    {
      id: 'medium',
      label: 'Medium',
      icon: <Zap size={14} />,
      color: 'text-amber-600 hover:bg-amber-50',
      activeColor: 'bg-amber-500 text-white',
    },
    {
      id: 'low',
      label: 'Low',
      icon: <CircleDot size={14} />,
      color: 'text-blue-600 hover:bg-blue-50',
      activeColor: 'bg-blue-600 text-white',
    },
    {
      id: 'scheduled',
      label: 'Scheduled',
      icon: <Calendar size={14} />,
      color: 'text-green-600 hover:bg-green-50',
      activeColor: 'bg-green-600 text-white',
    },
    {
      id: 'referral',
      label: 'Referral',
      icon: <UserCheck size={14} />,
      color: 'text-purple-600 hover:bg-purple-50',
      activeColor: 'bg-purple-600 text-white',
    },
  ];

// =============================================================================
// Priority Sort Order
// =============================================================================

const PRIORITY_ORDER: Record<LeadPriority, number> = {
  hot: 1,
  medium: 2,
  low: 3,
  disqualified: 4,
};

const STATUS_ORDER: Record<string, number> = {
  new: 1,
  contacted: 2,
  scheduled: 3,
  'consultation complete': 4,
  'treatment started': 5,
  lost: 6,
  disqualified: 7,
};

// =============================================================================
// Condition Formatting Utilities
// =============================================================================

/**
 * Format condition for professional display
 * - OCD and PTSD stay uppercase
 * - Other conditions use Title Case
 * - "other" shows as "Other"
 */
function formatConditionDisplay(condition: string): string {
  const upperCaseConditions = ['OCD', 'PTSD'];
  const normalized = condition.toLowerCase().trim();
  
  // Check for uppercase acronyms
  if (upperCaseConditions.includes(condition.toUpperCase())) {
    return condition.toUpperCase();
  }
  
  // Handle specific conditions
  switch (normalized) {
    case 'depression':
      return 'Depression';
    case 'anxiety':
      return 'Anxiety';
    case 'ocd':
      return 'OCD';
    case 'ptsd':
      return 'PTSD';
    case 'other':
      return 'Other';
    default:
      // Title case for unknown conditions
      return condition
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
  }
}

/**
 * Format conditions array for display
 * Returns formatted string with proper casing and "Other: <text>" handling
 */
function formatConditionsDisplay(
  conditions: string[] | undefined,
  otherConditionText: string | undefined
): string {
  if (!conditions || conditions.length === 0) {
    return 'Unknown';
  }
  
  const formatted = conditions.map(c => formatConditionDisplay(c));
  
  // If "Other" is in the list and we have other text, replace with "Other: <text>"
  const otherIndex = formatted.findIndex(c => c === 'Other');
  if (otherIndex !== -1 && otherConditionText) {
    formatted[otherIndex] = `Other: ${otherConditionText}`;
  }
  
  return formatted.join(', ');
}

/**
 * Format preferred contact method for display
 * Handles backend values: phone_call, text, email, any, sms
 */
function formatPreferredContact(method: string | undefined): string {
  if (!method) return '—';
  
  const normalized = method.toLowerCase().trim();
  
  const methodMap: Record<string, string> = {
    // Backend canonical values
    'phone_call': 'Phone Call',
    'phone': 'Phone Call',
    'call': 'Phone Call',
    'text': 'Text',
    'sms': 'Text',
    'email': 'Email',
    'any': 'Any',
    'no preference': 'Any',
    // Uppercase variants
    'PHONE': 'Phone Call',
    'EMAIL': 'Email',
    'SMS': 'Text',
    'TEXT': 'Text',
  };
  
  return methodMap[normalized] || methodMap[method] || 
    method.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

// =============================================================================
// Component
// =============================================================================

export const LeadsTable: React.FC<LeadsTableProps> = ({
  leads,
  totalCount,
  isLoading,
  error,
  onView,
  onEdit,
  onDelete,
  onRetry,
  resetFilterKey,
  onRefreshNeeded,
}) => {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: 'lastUpdatedAt',
    direction: 'desc', // Most recently modified at top by default (new untouched leads first)
  });
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // ---------------------------------------------------------------------------
  // Reset quick filter when queue/page changes
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // Reset quick filter to 'all' when the resetFilterKey changes
    // This prevents filter persistence when navigating between different queues
    setQuickFilter('all');
    setSearchQuery('');
  }, [resetFilterKey]);

  // Email and SMS dialog state
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [selectedLeadForComm, setSelectedLeadForComm] = useState<LeadTableRow | null>(null);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Format date for display
   */
  const formatDate = useCallback((dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  /**
   * Format scheduled date/time with relative indicator
   */
  const formatScheduledDateTime = useCallback((dateString: string): { text: string; urgency: 'past' | 'soon' | 'today' | 'upcoming' } => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    // Determine urgency level
    let urgency: 'past' | 'soon' | 'today' | 'upcoming' = 'upcoming';
    if (diffMs < 0) {
      urgency = 'past';
    } else if (diffHours <= 2) {
      urgency = 'soon'; // Within 2 hours - urgent!
    } else if (diffDays < 1 && date.getDate() === now.getDate()) {
      urgency = 'today';
    }

    // Format the date/time
    const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    // Build relative text
    let text = '';
    if (urgency === 'past') {
      text = `${dateStr} at ${timeStr} (Past)`;
    } else if (urgency === 'soon') {
      const minsLeft = Math.round(diffMs / (1000 * 60));
      if (minsLeft < 60) {
        text = `In ${minsLeft} min • ${timeStr}`;
      } else {
        const hoursLeft = Math.round(minsLeft / 60);
        text = `In ${hoursLeft}h • ${timeStr}`;
      }
    } else if (urgency === 'today') {
      text = `Today at ${timeStr}`;
    } else {
      // Check if tomorrow
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      if (date.getDate() === tomorrow.getDate() && date.getMonth() === tomorrow.getMonth()) {
        text = `Tomorrow at ${timeStr}`;
      } else {
        text = `${dateStr} at ${timeStr}`;
      }
    }

    return { text, urgency };
  }, []);

  /**
   * Handle column header click for sorting
   */
  const handleSort = useCallback((field: SortField) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  /**
   * Get sort icon for column header
   */
  const getSortIcon = useCallback((field: SortField) => {
    if (sortConfig.field !== field) {
      return <ChevronUp size={14} className="text-gray-300" />;
    }
    return sortConfig.direction === 'asc'
      ? <ChevronUp size={14} className="text-blue-600" />
      : <ChevronDown size={14} className="text-blue-600" />;
  }, [sortConfig]);

  /**
   * Format phone number for tel: link (3CX Chrome extension intercepts these)
   * - Strips all non-digit characters
   * - Adds +1 US country code if not already present
   * - Returns formatted tel: URI string
   */
  const formatPhoneForTel = useCallback((phone: string): string => {
    // Remove all non-digit characters except leading +
    const cleaned = phone.replace(/[^\d+]/g, '');
    // Remove any + signs that aren't at the start
    const digits = cleaned.replace(/^\+/, '').replace(/\+/g, '');
    
    // Add +1 country code if not already present (US numbers)
    if (digits.startsWith('1') && digits.length === 11) {
      return `tel:+${digits}`;
    } else if (digits.length === 10) {
      return `tel:+1${digits}`;
    } else if (cleaned.startsWith('+')) {
      // Already has international format
      return `tel:+${digits}`;
    }
    // Fallback: return as-is with tel: prefix
    return `tel:+1${digits}`;
  }, []);

  /**
   * Trigger a call via tel: link — 3CX Chrome extension intercepts and handles the call.
   * No dialog popup needed; 3CX provides its own call interface.
   */
  const handleCallVia3CX = useCallback((phone: string) => {
    const telUri = formatPhoneForTel(phone);
    window.location.href = telUri;
  }, [formatPhoneForTel]);

  // ---------------------------------------------------------------------------
  // Filtered & Sorted Data
  // ---------------------------------------------------------------------------

  const filteredAndSortedLeads = useMemo(() => {
    // Step 1: Apply search filter
    let filtered = leads;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = leads.filter(l =>
        l.phone?.toLowerCase().includes(query) ||
        l.email?.toLowerCase().includes(query) ||
        l.firstName?.toLowerCase().includes(query) ||
        l.lastName?.toLowerCase().includes(query) ||
        `${l.firstName} ${l.lastName}`.toLowerCase().includes(query)
      );
    }

    // Step 2: Apply quick filter
    if (quickFilter !== 'all') {
      if (quickFilter === 'scheduled') {
        filtered = filtered.filter(l => l.status === 'scheduled');
      } else if (quickFilter === 'referral') {
        filtered = filtered.filter(l => l.isReferral === true);
      } else {
        filtered = filtered.filter(l => l.priority === quickFilter);
      }
    }

    // Step 3: Sort - By default, most recently contacted at top (for queue management)
    const sorted = [...filtered].sort((a, b) => {
      const { field, direction } = sortConfig;
      let comparison = 0;

      switch (field) {
        case 'leadId':
          comparison = a.leadId.localeCompare(b.leadId);
          break;
        case 'firstName':
          comparison = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
          break;
        case 'condition':
          comparison = a.condition.localeCompare(b.condition);
          break;
        case 'priority':
          comparison = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
          break;
        case 'status':
          comparison = (STATUS_ORDER[a.status] || 99) - (STATUS_ORDER[b.status] || 99);
          break;
        case 'submittedAt':
          comparison = new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
          break;
        case 'lastContactAttempt':
          // Sort by last contact attempt - never contacted leads go to the bottom
          const aTime = a.lastContactAttempt ? new Date(a.lastContactAttempt).getTime() : 0;
          const bTime = b.lastContactAttempt ? new Date(b.lastContactAttempt).getTime() : 0;
          comparison = aTime - bTime;
          break;
        case 'lastUpdatedAt':
          // Sort by last activity - untouched leads (NULL) go first, then recently modified
          const aUpdated = a.lastUpdatedAt ? new Date(a.lastUpdatedAt).getTime() : 0;
          const bUpdated = b.lastUpdatedAt ? new Date(b.lastUpdatedAt).getTime() : 0;
          comparison = aUpdated - bUpdated;
          break;
        default:
          comparison = 0;
      }

      return direction === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [leads, quickFilter, sortConfig, searchQuery]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
      {/* Header — flex-shrink-0, always visible */}
      <div className="flex-shrink-0 px-4 py-2.5 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-base font-bold text-gray-900">Lead Pipeline</h2>
            <p className="text-xs text-gray-500">
              Manage and track your active leads
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Quick Action Buttons - General Call & SMS */}
            <div className="flex items-center gap-1.5 border-r border-gray-200 pr-3">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  const phone = prompt('Enter phone number to call via 3CX:');
                  if (phone && phone.trim()) {
                    handleCallVia3CX(phone.trim());
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg
                         bg-green-50 text-green-700 hover:bg-green-100 border border-green-200
                         transition-all duration-200"
                title="Quick Call via 3CX - dial any number"
              >
                <PhoneCall size={16} />
                Call
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelectedLeadForComm(null);
                  setSmsDialogOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg
                         bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200
                         transition-all duration-200"
                title="Quick SMS - message any number"
              >
                <MessageSquare size={16} />
                SMS
              </button>
            </div>
            <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              {filteredAndSortedLeads.length} of {totalCount} leads
            </span>
            {/* HIPAA Compliance Badge - Replaced Export for Data Privacy */}
            <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg">
              <div className="flex items-center gap-1.5">
                <Shield size={16} className="text-emerald-600" />
                <Heart size={14} className="text-rose-500" />
                <Brain size={14} className="text-purple-500" />
              </div>
              <span className="text-xs font-semibold text-emerald-700">
                HIPAA Protected
              </span>
            </div>
          </div>
        </div>

        {/* Search and Quick Filters Row */}
        <div className="flex items-center justify-between gap-4">
          {/* Quick Filters */}
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-400" />
            <span className="text-sm text-gray-500 mr-2">Quick filters:</span>
            <div className="flex items-center gap-1.5">
              {QUICK_FILTERS.map(filter => (
                <button
                  key={filter.id}
                  onClick={() => setQuickFilter(filter.id)}
                  className={`
                    inline-flex items-center gap-1.5 px-3 py-1.5 
                    text-sm font-medium rounded-full
                    transition-all duration-200
                    ${quickFilter === filter.id ? filter.activeColor : filter.color}
                  `}
                >
                  {filter.icon}
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by phone, email, or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="
                pl-9 pr-4 py-2 w-72 text-sm
                border border-gray-300 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                placeholder:text-gray-400
              "
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table Container with Scroll */}
      {error ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle size={32} className="text-red-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">Unable to load leads</h3>
            <p className="text-sm text-gray-500 mb-4 max-w-sm mx-auto">
              {error.message || 'There was an error connecting to the server. Please check if the backend is running.'}
            </p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <RefreshCw size={16} />
                Try Again
              </button>
            )}
          </div>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <LoadingSpinner size="lg" />
            <p className="text-sm text-gray-500 mt-3">Loading leads...</p>
          </div>
        </div>
      ) : filteredAndSortedLeads.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
            <Users size={32} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No leads found</h3>
          <p className="text-sm text-gray-500">
            {quickFilter !== 'all'
              ? `No ${quickFilter} leads in your pipeline yet.`
              : 'Your lead pipeline is empty. New leads will appear here.'}
          </p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {/* Lead ID - FROZEN column header (sticky left + top, z-4 for intersection) */}
                <th
                  className="px-6 py-3 text-left cursor-pointer hover:bg-gray-100 transition-colors sticky top-0 left-0 z-[4] bg-gray-50"
                  style={{ minWidth: '140px' }}
                  onClick={() => handleSort('leadId')}
                >
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Lead ID
                    {getSortIcon('leadId')}
                  </div>
                </th>
                {/* Patient - FROZEN column header (sticky left + top, z-4 for intersection) */}
                <th
                  className="px-6 py-3 text-left cursor-pointer hover:bg-gray-100 transition-colors sticky top-0 z-[4] bg-gray-50"
                  style={{ minWidth: '180px', left: '140px', boxShadow: '4px 0 8px rgba(0, 0, 0, 0.06)' }}
                  onClick={() => handleSort('firstName')}
                >
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Patient
                    {getSortIcon('firstName')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left cursor-pointer hover:bg-gray-100 transition-colors sticky top-0 z-[3] bg-gray-50"
                  onClick={() => handleSort('condition')}
                >
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Condition
                    {getSortIcon('condition')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left cursor-pointer hover:bg-gray-100 transition-colors sticky top-0 z-[3] bg-gray-50"
                  onClick={() => handleSort('priority')}
                >
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Priority
                    {getSortIcon('priority')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left cursor-pointer hover:bg-gray-100 transition-colors sticky top-0 z-[3] bg-gray-50"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Status
                    {getSortIcon('status')}
                  </div>
                </th>
                {/* Scheduled For column - shows consultation date/time */}
                <th className="px-6 py-3 text-left sticky top-0 z-[3] bg-gray-50">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <Calendar size={12} />
                    Scheduled For
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left cursor-pointer hover:bg-gray-100 transition-colors sticky top-0 z-[3] bg-gray-50"
                  onClick={() => handleSort('submittedAt')}
                >
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Submitted
                    {getSortIcon('submittedAt')}
                  </div>
                </th>
                {/* Last Activity column header */}
                <th
                  className="px-6 py-3 text-left cursor-pointer hover:bg-gray-100 transition-colors sticky top-0 z-[3] bg-gray-50"
                  onClick={() => handleSort('lastUpdatedAt')}
                >
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Last Activity
                    {getSortIcon('lastUpdatedAt')}
                  </div>
                </th>
                {/* Email column header */}
                <th className="px-4 py-3 text-left sticky top-0 z-[3] bg-gray-50">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Email
                  </div>
                </th>
                {/* Preferred Contact column header */}
                <th className="px-4 py-3 text-left sticky top-0 z-[3] bg-gray-50">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <PhoneCall size={12} />
                    Preferred
                  </div>
                </th>
                <th className="px-6 py-3 text-right sticky top-0 z-[3] bg-gray-50">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Actions
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredAndSortedLeads.map((lead, index) => {
                // Determine opaque row background for frozen cells (must be solid, not transparent)
                const rowBg = index % 2 === 0 ? 'bg-white' : 'bg-gray-50';
                return (
                <tr
                  key={lead.id}
                  className={`
                    group hover:bg-blue-50 transition-colors
                    ${rowBg}
                  `}
                >
                  {/* Lead ID - FROZEN column (sticky left, opaque bg, group-hover) */}
                  <td
                    className={`px-6 py-4 whitespace-nowrap sticky left-0 z-[2] ${rowBg} group-hover:!bg-blue-50 transition-colors`}
                    style={{ minWidth: '140px' }}
                  >
                    <span className="text-sm font-mono text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                      {lead.leadId}
                    </span>
                  </td>
                  {/* Patient - FROZEN column (sticky left, opaque bg, group-hover, shadow separator) */}
                  <td
                    className={`px-6 py-4 whitespace-nowrap sticky z-[2] ${rowBg} group-hover:!bg-blue-50 transition-colors`}
                    style={{ minWidth: '180px', maxWidth: '220px', left: '140px', boxShadow: '4px 0 8px rgba(0, 0, 0, 0.06)' }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-blue-700">
                          {/* Display initials - handle empty/unknown names gracefully */}
                          {(lead.firstName && lead.firstName !== 'Unknown' ? lead.firstName.charAt(0) : lead.email?.charAt(0) || '?')}
                          {lead.lastName?.charAt(0) || ''}
                        </span>
                      </div>
                      <div className="flex flex-col min-w-0">
                        {/* Display name with graceful fallbacks + ellipsis for long names */}
                        {(lead.firstName && lead.firstName !== 'Unknown') || lead.lastName ? (
                          <p className="text-sm font-medium text-gray-900 truncate" style={{ maxWidth: '150px' }}>
                            {lead.firstName || ''} {lead.lastName || ''}
                          </p>
                        ) : lead.email ? (
                          <p className="text-sm font-medium text-gray-700 truncate" style={{ maxWidth: '150px' }}>
                            {lead.email}
                          </p>
                        ) : (
                          <p className="text-sm font-medium text-gray-400 italic">
                            Name not provided
                          </p>
                        )}
                        {/* Referral Badge */}
                        {lead.isReferral && (
                          <span
                            className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded bg-purple-100 text-purple-700 border border-purple-200 w-fit"
                            title={lead.referringProviderName ? `Referred by ${lead.referringProviderName}` : 'Provider Referral'}
                          >
                            <UserCheck size={10} />
                            {lead.referringProviderName ? `Ref: ${lead.referringProviderName}` : 'Referral'}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span 
                      className="text-sm text-gray-700"
                      title={lead.conditions?.length ? lead.conditions.join(', ') : lead.condition}
                    >
                      {lead.conditions?.length 
                        ? formatConditionsDisplay(lead.conditions, lead.otherConditionText)
                        : formatConditionDisplay(lead.condition)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge variant="priority" value={lead.priority} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      <Badge variant="status" value={lead.status} />
                      {/* Follow-up reason tag — single source of truth for queue routing tags */}
                      {lead.followUpReason && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <Tag size={9} />
                          {lead.followUpReason}
                        </span>
                      )}
                    </div>
                  </td>
                  {/* Scheduled For cell - shows consultation date/time with urgency */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    {lead.scheduledCallbackAt ? (
                      (() => {
                        const { text, urgency } = formatScheduledDateTime(lead.scheduledCallbackAt);
                        const urgencyStyles = {
                          past: 'bg-gray-100 text-gray-600 border-gray-200',
                          soon: 'bg-red-50 text-red-700 border-red-200 animate-pulse',
                          today: 'bg-amber-50 text-amber-700 border-amber-200',
                          upcoming: 'bg-green-50 text-green-700 border-green-200',
                        };
                        return (
                          <span className={`
                            inline-flex items-center gap-1.5 px-2.5 py-1 
                            text-xs font-medium rounded-lg border
                            ${urgencyStyles[urgency]}
                          `}>
                            <Calendar size={12} />
                            {text}
                          </span>
                        );
                      })()
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-500">
                      {formatDate(lead.submittedAt)}
                    </span>
                  </td>
                  {/* Last Activity cell - shows when lead was last modified */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    {lead.lastUpdatedAt ? (
                      <span className="text-sm text-gray-700 font-medium">
                        {formatRelativeTime(lead.lastUpdatedAt)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                        New (untouched)
                      </span>
                    )}
                  </td>
                  {/* Email cell - plain text */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    {lead.email ? (
                      <span
                        className="text-sm text-gray-700 max-w-[180px] truncate block"
                        title={lead.email}
                      >
                        {lead.email}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  {/* Preferred Contact cell */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    {lead.preferredContactMethod ? (
                      (() => {
                        const method = lead.preferredContactMethod.toLowerCase();
                        const isPhone = method.includes('phone') || method === 'call';
                        const isEmail = method === 'email';
                        const isSms = method === 'sms' || method === 'text';
                        const isAny = method === 'any' || method === 'no preference';
                        
                        return (
                          <span className={`
                            inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full
                            ${isPhone ? 'bg-green-100 text-green-700' 
                              : isEmail ? 'bg-blue-100 text-blue-700'
                              : isSms ? 'bg-purple-100 text-purple-700'
                              : isAny ? 'bg-gray-100 text-gray-600'
                              : 'bg-amber-100 text-amber-700'}
                          `}>
                            {isPhone && <PhoneCall size={10} />}
                            {isEmail && <Mail size={10} />}
                            {isSms && <MessageSquare size={10} />}
                            {formatPreferredContact(lead.preferredContactMethod)}
                          </span>
                        );
                      })()
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      {/* CALL BUTTON - Triggers tel: link for 3CX Chrome extension */}
                      {lead.phone && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCallVia3CX(lead.phone);
                          }}
                          className="p-1.5 rounded-lg bg-green-100 text-green-600 hover:bg-green-200 transition-colors duration-200"
                          title={`Call ${lead.firstName} via 3CX`}
                        >
                          <PhoneCall size={16} />
                        </button>
                      )}

                      {/* EMAIL BUTTON */}
                      {lead.email && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLeadForComm(lead);
                            setEmailDialogOpen(true);
                          }}
                          className="p-1.5 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors duration-200"
                          title={`Email ${lead.firstName}`}
                        >
                          <Mail size={16} />
                        </button>
                      )}

                      {/* SMS BUTTON */}
                      {lead.phone && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLeadForComm(lead);
                            setSmsDialogOpen(true);
                          }}
                          className="p-1.5 rounded-lg bg-emerald-100 text-emerald-600 hover:bg-emerald-200 transition-colors duration-200"
                          title={`SMS ${lead.firstName}`}
                        >
                          <MessageSquare size={16} />
                        </button>
                      )}

                      {/* VIEW BUTTON */}
                      <button
                        onClick={() => onView(lead.id)}
                        className="
                          inline-flex items-center gap-1.5 px-2 py-1.5
                          text-sm font-medium text-blue-600 
                          hover:bg-blue-100 rounded-lg transition-all duration-200
                        "
                        title="View lead details"
                      >
                        <Eye size={15} />
                      </button>

                      {/* EDIT BUTTON */}
                      {onEdit && (
                        <button
                          onClick={() => onEdit(lead.id)}
                          className="
                            inline-flex items-center gap-1.5 px-2 py-1.5
                            text-sm font-medium text-gray-600
                            hover:bg-gray-100 rounded-lg transition-all duration-200
                          "
                          title="Edit lead"
                        >
                          <Edit2 size={15} />
                        </button>
                      )}

                      {/* DELETE BUTTON */}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(lead.id, `${lead.firstName} ${lead.lastName || ''}`.trim())}
                          className="
                            inline-flex items-center gap-1.5 px-2 py-1.5
                            text-sm font-medium text-red-600 
                            hover:bg-red-50 rounded-lg transition-all duration-200
                          "
                          title="Delete lead"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer — flex-shrink-0, always visible */}
      {!isLoading && filteredAndSortedLeads.length > 0 && (
        <div className="flex-shrink-0 px-6 py-3 border-t border-gray-200 bg-gray-50">
          <p className="text-xs text-gray-500">
            Showing {filteredAndSortedLeads.length} lead{filteredAndSortedLeads.length !== 1 ? 's' : ''}
            {quickFilter !== 'all' && ` • Filtered by: ${quickFilter}`}
            {' '}• Sorted by: {sortConfig.field} ({sortConfig.direction === 'asc' ? 'ascending' : 'descending'})
          </p>
        </div>
      )}

      {/* Email Compose Dialog */}
      <EmailComposeDialog
        isOpen={emailDialogOpen}
        onClose={() => {
          setEmailDialogOpen(false);
          setSelectedLeadForComm(null);
        }}
        lead={selectedLeadForComm ? {
          id: selectedLeadForComm.id,
          firstName: selectedLeadForComm.firstName,
          lastName: selectedLeadForComm.lastName,
          email: selectedLeadForComm.email || '',
          phone: selectedLeadForComm.phone,
          leadId: selectedLeadForComm.leadId,
          condition: selectedLeadForComm.condition,
        } : null}
        onSendSuccess={onRefreshNeeded}
      />

      {/* SMS Compose Dialog */}
      <SMSComposeDialog
        isOpen={smsDialogOpen}
        onClose={() => {
          setSmsDialogOpen(false);
          setSelectedLeadForComm(null);
        }}
        lead={selectedLeadForComm ? {
          id: selectedLeadForComm.id,
          firstName: selectedLeadForComm.firstName,
          lastName: selectedLeadForComm.lastName,
          email: selectedLeadForComm.email,
          phone: selectedLeadForComm.phone || '',
          leadId: selectedLeadForComm.leadId,
          condition: selectedLeadForComm.condition,
        } : null}
        generalMode={!selectedLeadForComm}
        onSendSuccess={onRefreshNeeded}
      />

    </div>
  );
};

export default LeadsTable;
