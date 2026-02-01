/**
 * Queue Sidebar Component
 * 
 * Lead Management Queue System for Coordinators.
 * 
 * LEAD LIFECYCLE:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  NEW → CONTACTED/NO_ANSWER/CALLBACK/UNREACHABLE → SCHEDULED → COMPLETE │
 * └─────────────────────────────────────────────────────────────────────────┘
 * 
 * QUEUE LOGIC (Updated):
 * - NEW: Leads that have NEVER been contacted (status='new' AND contactOutcome='NEW' or null)
 * - CONTACTED: ALL leads with ANY contact attempt (contactOutcome != 'NEW' AND != null)
 *   - This is an INCLUSIVE view showing anyone we've tried to reach
 * - FOLLOW-UP: Subset of contacted that need another attempt (NO_ANSWER, UNREACHABLE, CALLBACK_REQUESTED)
 *   - Overlaps with CONTACTED (same leads appear in both)
 * - CALLBACK: Subset of follow-up where lead requested specific callback time
 * - SCHEDULED: Consultation booked
 * - COMPLETED: Consultation complete or treatment started
 * 
 * QUEUES ARE OVERLAPPING:
 * - A lead with NO_ANSWER appears in both "Contacted" AND "Follow-up"
 * - A lead with ANSWERED appears only in "Contacted" (ready for scheduling)
 * 
 * @module components/dashboard/QueueSidebar
 * @version 2.0.0 - Updated queue logic for overlapping queues
 */

import React from 'react';
import {
  Flame,
  Zap,
  Clock,
  PhoneCall,
  Calendar,
  RefreshCw,
  Users,
  CheckCircle,
  UserCheck,
  PhoneOff,
  Inbox,
} from 'lucide-react';
import type { LeadTableRow } from '../../types/lead';

export type QueueType = 
  | 'all'
  | 'new'
  | 'contacted'
  | 'follow_up' 
  | 'callback' 
  | 'scheduled'
  | 'completed'
  | 'unreachable'
  | 'hot' 
  | 'medium' 
  | 'low';

interface QueueConfig {
  id: QueueType;
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
  category: 'overview' | 'priority' | 'contact_status' | 'outcome';
}

interface QueueSidebarProps {
  leads: LeadTableRow[];
  activeQueue: QueueType;
  onQueueChange: (queue: QueueType) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const QUEUE_CONFIG: QueueConfig[] = [
  // Overview
  {
    id: 'all',
    label: 'All Leads',
    icon: <Users size={18} />,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-200',
    description: 'View all leads in system',
    category: 'overview',
  },
  // Contact Status Queues (Primary Workflow - in logical order)
  {
    id: 'new',
    label: 'New Leads',
    icon: <Inbox size={18} />,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    description: 'Step 1: Never contacted - Make first call',
    category: 'contact_status',
  },
  {
    id: 'contacted',
    label: 'Contacted',
    icon: <UserCheck size={18} />,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    description: 'All leads with contact attempts (inclusive view)',
    category: 'contact_status',
  },
  {
    id: 'follow_up',
    label: 'Follow-up',
    icon: <RefreshCw size={18} />,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    description: 'Needs another attempt - subset of Contacted',
    category: 'contact_status',
  },
  {
    id: 'callback',
    label: 'Callback Requested',
    icon: <PhoneCall size={18} />,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
    description: 'Lead requested specific callback time',
    category: 'contact_status',
  },
  // Outcome Queues (Final stages)
  {
    id: 'scheduled',
    label: 'Scheduled',
    icon: <Calendar size={18} />,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    description: 'Step 3: Consultation booked - Awaiting',
    category: 'outcome',
  },
  {
    id: 'completed',
    label: 'Completed',
    icon: <CheckCircle size={18} />,
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-200',
    description: 'Step 4: Consultation complete - Success!',
    category: 'outcome',
  },
  {
    id: 'unreachable',
    label: 'Unreachable',
    icon: <PhoneOff size={18} />,
    color: 'text-slate-600',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200',
    description: 'Unable to contact - Needs review',
    category: 'outcome',
  },
  // Priority Queues (Cross-cutting view by urgency)
  {
    id: 'hot',
    label: 'Hot Priority',
    icon: <Flame size={18} />,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    description: 'Urgent - Contact within 1 hour',
    category: 'priority',
  },
  {
    id: 'medium',
    label: 'Medium Priority',
    icon: <Zap size={18} />,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    description: 'Standard - Contact within 24 hours',
    category: 'priority',
  },
  {
    id: 'low',
    label: 'Low Priority',
    icon: <Clock size={18} />,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    description: 'Regular follow-up schedule',
    category: 'priority',
  },
];

/**
 * CONTACT OUTCOMES that indicate a contact attempt was made.
 * Any lead with one of these outcomes is considered "contacted".
 * 
 * Outcomes indicating contact attempt:
 * - ANSWERED: Successfully spoke with lead
 * - NO_ANSWER: Called but no pickup
 * - UNREACHABLE: Wrong number, disconnected
 * - CALLBACK_REQUESTED: Lead asked to call back later
 * - NOT_INTERESTED: Lead declined
 * - SCHEDULED: Moved to scheduling
 * - COMPLETED: Consultation done
 * 
 * Only NEW (or null) means never contacted.
 */
const CONTACTED_OUTCOMES = ['ANSWERED', 'NO_ANSWER', 'UNREACHABLE', 'CALLBACK_REQUESTED', 'NOT_INTERESTED', 'SCHEDULED', 'COMPLETED'];

/**
 * FOLLOW-UP OUTCOMES that need another contact attempt.
 * These leads appear in both "Contacted" AND "Follow-up" queues.
 */
const FOLLOWUP_OUTCOMES = ['NO_ANSWER', 'UNREACHABLE', 'CALLBACK_REQUESTED'];

/**
 * FOLLOW-UP REASONS from consultation outcomes.
 * These are set by the backend when a scheduled lead gets a consultation outcome
 * like No Show, Cancelled, or Second Consult Required.
 * Leads with these follow_up_reason values also appear in the Follow-up queue.
 */
const FOLLOWUP_REASONS = ['No Answer', 'Not Interested', 'No Show', 'Cancelled Appointment'];

/**
 * Calculate queue counts from leads
 * 
 * UPDATED QUEUE LOGIC - Overlapping Queues:
 * 
 * QUEUES:
 * - NEW: contactOutcome = 'NEW' or null (never contacted)
 * - CONTACTED: ANY contact attempt made (contactOutcome in CONTACTED_OUTCOMES)
 *   - This is INCLUSIVE - all leads we've tried to contact
 * - FOLLOW-UP: Needs another attempt (contactOutcome in FOLLOWUP_OUTCOMES)
 *   - OVERLAPS with CONTACTED
 * - CALLBACK: Subset - contactOutcome = 'CALLBACK_REQUESTED'
 * - SCHEDULED: status = 'scheduled' (overrides outcome-based queues)
 * - COMPLETED: status = 'consultation complete' or 'treatment started'
 * - UNREACHABLE: contactOutcome = 'UNREACHABLE' (subset view)
 * 
 * PRIORITY QUEUES (cross-cutting views):
 * - Hot/Medium/Low: Filter by priority, excludes scheduled/completed leads
 */
const calculateQueueCounts = (leads: LeadTableRow[]): Record<QueueType, number> => {
  const counts: Record<QueueType, number> = {
    all: 0,
    new: 0,
    contacted: 0,
    follow_up: 0,
    callback: 0,
    scheduled: 0,
    completed: 0,
    unreachable: 0,
    hot: 0,
    medium: 0,
    low: 0,
  };

  // Filter out lost/disqualified leads for active queues
  const nonLostLeads = leads.filter(l => 
    !['lost', 'disqualified'].includes(l.status)
  );

  // Active leads (not completed/lost) - for most queues
  const activeLeads = nonLostLeads.filter(l => 
    !['consultation complete', 'treatment started'].includes(l.status)
  );

  counts.all = activeLeads.length;

  // Count completed leads separately
  counts.completed = nonLostLeads.filter(l => 
    ['consultation complete', 'treatment started'].includes(l.status)
  ).length;

  activeLeads.forEach(lead => {
    const outcome = lead.contactOutcome || 'NEW';
    
    // SCHEDULED: Takes priority - if scheduled, count in scheduled queue
    if (lead.status === 'scheduled') {
      counts.scheduled++;
      // Note: scheduled leads are NOT counted in contacted/follow-up queues
      // They've moved past that stage
      
      // But still count in priority queues
      if (lead.priority === 'hot') counts.hot++;
      else if (lead.priority === 'medium') counts.medium++;
      else if (lead.priority === 'low') counts.low++;
      return;
    }
    
    // NEW: TRULY never contacted (contactOutcome='NEW' or null)
    // Lead must have status='new' AND no contact attempt recorded
    if (lead.status === 'new' && (outcome === 'NEW' || !lead.contactOutcome)) {
      counts.new++;
    }
    
    // CONTACTED: ANY contact attempt was made (INCLUSIVE)
    // This now includes ALL leads with any outcome except 'NEW'
    // Leads with NO_ANSWER, UNREACHABLE, CALLBACK_REQUESTED, ANSWERED, NOT_INTERESTED all appear here
    // Also includes leads where backend set status='contacted' via email/SMS (contactOutcome may still be 'NEW')
    if (CONTACTED_OUTCOMES.includes(outcome) || lead.status === 'contacted') {
      counts.contacted++;
    }
    
    // FOLLOW-UP: Needs another contact attempt (OVERLAPPING with Contacted)
    // Includes: contactOutcome in [NO_ANSWER, UNREACHABLE, CALLBACK_REQUESTED]
    // OR follow_up_reason in [No Show, Cancelled Appointment, Second Consult Required, etc.]
    if (FOLLOWUP_OUTCOMES.includes(outcome) || (lead.followUpReason && FOLLOWUP_REASONS.includes(lead.followUpReason))) {
      counts.follow_up++;
    }
    
    // CALLBACK: Subset - Lead requested specific callback time
    // Also matches follow_up_reason = 'Callback Requested'
    if (outcome === 'CALLBACK_REQUESTED' || lead.followUpReason === 'Callback Requested') {
      counts.callback++;
    }
    
    // UNREACHABLE: Subset view - UNREACHABLE outcomes or follow_up_reason
    if (outcome === 'UNREACHABLE' || lead.followUpReason === 'Unreachable') {
      counts.unreachable++;
    }

    // Priority queues - cross-cutting views by urgency level
    // (excluding scheduled which was handled above with early return)
    if (lead.priority === 'hot') counts.hot++;
    else if (lead.priority === 'medium') counts.medium++;
    else if (lead.priority === 'low') counts.low++;
  });

  return counts;
};

/**
 * Get urgency indicator for hot leads
 */
const getUrgencyIndicator = (count: number): React.ReactNode => {
  if (count === 0) return null;
  
  return (
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
    </span>
  );
};

export const QueueSidebar: React.FC<QueueSidebarProps> = ({
  leads,
  activeQueue,
  onQueueChange,
  isCollapsed = false,
}) => {
  const counts = calculateQueueCounts(leads);

  // Group queues by category for better organization
  const overviewQueues = QUEUE_CONFIG.filter(q => q.category === 'overview');
  const contactStatusQueues = QUEUE_CONFIG.filter(q => q.category === 'contact_status');
  const outcomeQueues = QUEUE_CONFIG.filter(q => q.category === 'outcome');
  const priorityQueues = QUEUE_CONFIG.filter(q => q.category === 'priority');

  const renderQueueButton = (queue: QueueConfig) => {
    const count = counts[queue.id];
    const isActive = activeQueue === queue.id;
    const hasUrgent = queue.id === 'hot' && count > 0;
    const hasNew = queue.id === 'new' && count > 0;

    return (
      <button
        key={queue.id}
        onClick={() => onQueueChange(queue.id)}
        className={`
          w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
          transition-all duration-200 group
          ${isActive 
            ? `${queue.bgColor} ${queue.borderColor} border ${queue.color}` 
            : 'hover:bg-gray-50 text-gray-600 hover:text-gray-900'
          }
        `}
        title={queue.description}
      >
        {/* Icon */}
        <div className={`
          flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center
          ${isActive ? queue.bgColor : 'bg-gray-100 group-hover:bg-gray-200'}
          ${isActive ? queue.color : 'text-gray-500'}
        `}>
          {queue.icon}
        </div>

        {/* Label and count */}
        {!isCollapsed && (
          <>
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className={`font-medium text-sm ${isActive ? queue.color : ''}`}>
                  {queue.label}
                </span>
                {(hasUrgent || hasNew) && getUrgencyIndicator(count)}
              </div>
              <p className="text-xs text-gray-400 truncate">
                {queue.description}
              </p>
            </div>

            {/* Count Badge */}
            <div className={`
              flex-shrink-0 min-w-[28px] h-6 px-2 rounded-full
              flex items-center justify-center text-xs font-semibold
              ${isActive 
                ? `${queue.color} bg-white` 
                : count > 0 
                  ? 'bg-gray-100 text-gray-700' 
                  : 'bg-gray-50 text-gray-400'
              }
            `}>
              {count}
            </div>
          </>
        )}

        {/* Collapsed mode - just count */}
        {isCollapsed && count > 0 && (
          <span className={`
            absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1
            rounded-full text-[10px] font-bold flex items-center justify-center
            ${queue.id === 'hot' ? 'bg-red-500 text-white' : 'bg-gray-500 text-white'}
          `}>
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className={`
      bg-white border-r border-gray-200 h-full transition-all duration-300 flex flex-col
      ${isCollapsed ? 'w-16' : 'w-64'}
    `}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        {!isCollapsed && (
          <>
            <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wider">
              Lead Queues
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Manage leads by status & priority
            </p>
          </>
        )}
      </div>

      {/* Queue List - Scrollable */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {/* Overview */}
        {overviewQueues.map(renderQueueButton)}
        
        {/* Divider - Contact Status */}
        {!isCollapsed && (
          <div className="pt-3 pb-1">
            <p className="text-[10px] uppercase tracking-wider text-gray-400 px-3 font-semibold">
              Contact Status
            </p>
          </div>
        )}
        {contactStatusQueues.map(renderQueueButton)}
        
        {/* Divider - Outcomes */}
        {!isCollapsed && (
          <div className="pt-3 pb-1">
            <p className="text-[10px] uppercase tracking-wider text-gray-400 px-3 font-semibold">
              Outcomes
            </p>
          </div>
        )}
        {outcomeQueues.map(renderQueueButton)}
        
        {/* Divider - Priority View */}
        {!isCollapsed && (
          <div className="pt-3 pb-1">
            <p className="text-[10px] uppercase tracking-wider text-gray-400 px-3 font-semibold">
              By Priority
            </p>
          </div>
        )}
        {priorityQueues.map(renderQueueButton)}
      </nav>

      {/* Summary Stats */}
      {!isCollapsed && (
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-white rounded-lg p-2 border border-gray-100">
              <div className="text-lg font-bold text-gray-900">{counts.all}</div>
              <div className="text-[10px] text-gray-500 uppercase">Active</div>
            </div>
            <div className="bg-white rounded-lg p-2 border border-gray-100">
              <div className="text-lg font-bold text-emerald-600">{counts.new}</div>
              <div className="text-[10px] text-gray-500 uppercase">New</div>
            </div>
            <div className="bg-white rounded-lg p-2 border border-gray-100">
              <div className="text-lg font-bold text-green-600">{counts.scheduled}</div>
              <div className="text-[10px] text-gray-500 uppercase">Scheduled</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Filter leads by queue type
 * 
 * UPDATED FILTERING LOGIC - Overlapping Queues:
 * 
 * QUEUES:
 * - NEW: contactOutcome = 'NEW' or null (never contacted)
 * - CONTACTED: ANY contact attempt (INCLUSIVE - all outcomes except NEW)
 * - FOLLOW-UP: Needs retry (NO_ANSWER, UNREACHABLE, CALLBACK_REQUESTED) - OVERLAPS with Contacted
 * - CALLBACK: Lead requested callback time (subset of follow-up)
 * - SCHEDULED: status = 'scheduled'
 * - COMPLETED: status = 'consultation complete' or 'treatment started'
 * - UNREACHABLE: contactOutcome = 'UNREACHABLE' (subset)
 * 
 * PRIORITY QUEUES (cross-cutting):
 * - Hot/Medium/Low: Priority-based, excludes scheduled leads
 */
export const filterLeadsByQueue = (
  leads: LeadTableRow[], 
  queue: QueueType
): LeadTableRow[] => {
  // Filter out completed/lost leads first for most queues
  const activeLeads = leads.filter(l => 
    !['consultation complete', 'treatment started', 'lost', 'disqualified'].includes(l.status)
  );

  switch (queue) {
    case 'all':
      return activeLeads;
    
    case 'new':
      // Fresh leads - TRULY never contacted
      // Must have status = 'new' AND contactOutcome = 'NEW' or null
      return activeLeads.filter(l => 
        l.status === 'new' &&
        (l.contactOutcome === 'NEW' || !l.contactOutcome)
      );
    
    case 'contacted':
      // ALL leads with ANY contact attempt (INCLUSIVE VIEW)
      // Any outcome except 'NEW' means a contact attempt was made
      // Also includes leads where backend set status='contacted' via email/SMS send
      // (contactOutcome may still be 'NEW' in that case)
      // Excludes scheduled leads (they've moved past this stage)
      return activeLeads.filter(l => 
        l.status !== 'scheduled' &&
        (
          (l.contactOutcome && CONTACTED_OUTCOMES.includes(l.contactOutcome)) ||
          l.status === 'contacted'
        )
      );
    
    case 'follow_up':
      // Needs another contact attempt (OVERLAPS with Contacted)
      // Includes: contactOutcome in [NO_ANSWER, UNREACHABLE, CALLBACK_REQUESTED]
      // OR follow_up_reason in [No Show, Cancelled Appointment, Second Consult Required, etc.]
      return activeLeads.filter(l => 
        l.status !== 'scheduled' &&
        (
          (l.contactOutcome && FOLLOWUP_OUTCOMES.includes(l.contactOutcome)) ||
          (l.followUpReason && FOLLOWUP_REASONS.includes(l.followUpReason))
        )
      );
    
    case 'callback':
      // Lead requested specific callback time (subset of follow-up)
      // Also matches follow_up_reason = 'Callback Requested'
      return activeLeads.filter(l => 
        l.status !== 'scheduled' &&
        (l.contactOutcome === 'CALLBACK_REQUESTED' || l.followUpReason === 'Callback Requested')
      );
    
    case 'unreachable':
      // Subset view - UNREACHABLE outcomes or follow_up_reason (not scheduled)
      return activeLeads.filter(l => 
        l.status !== 'scheduled' &&
        (l.contactOutcome === 'UNREACHABLE' || l.followUpReason === 'Unreachable')
      );
    
    case 'scheduled':
      // Consultation scheduled (status = 'scheduled')
      return activeLeads.filter(l => l.status === 'scheduled');
    
    case 'completed':
      // Consultation complete - Success!
      return leads.filter(l => 
        ['consultation complete', 'treatment started'].includes(l.status)
      );
    
    case 'hot':
      // Hot priority - actionable (not scheduled)
      return activeLeads.filter(l => 
        l.priority === 'hot' && l.status !== 'scheduled'
      );
    
    case 'medium':
      // Medium priority - actionable (not scheduled)
      return activeLeads.filter(l => 
        l.priority === 'medium' && l.status !== 'scheduled'
      );
    
    case 'low':
      // Low priority - actionable (not scheduled)
      return activeLeads.filter(l => 
        l.priority === 'low' && l.status !== 'scheduled'
      );
    
    default:
      return activeLeads;
  }
};

export default QueueSidebar;
