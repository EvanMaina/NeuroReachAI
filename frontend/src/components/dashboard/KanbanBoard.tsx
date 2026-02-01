/**
 * KanbanBoard Component
 * 
 * Drag-and-drop Kanban board for lead management.
 * Columns: Hot Leads | Medium Leads | Scheduled | Completed
 * 
 * Design Philosophy:
 * - Priority columns (Hot/Medium) show leads by priority, with status as a badge
 * - Scheduled column shows all leads with callbacks booked, including scheduled date/time
 * - Completed column shows all leads that have been marked as completed
 * - Leads stay in priority columns until scheduled or completed
 * - Responsive layout: 1 col (mobile), 2 cols (tablet), 4 cols (desktop)
 */

import React, { useState, useCallback } from 'react';
import { 
  Flame, 
  Zap, 
  Calendar, 
  GripVertical, 
  User, 
  Clock, 
  CheckCircle2, 
  CalendarClock,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  AlertTriangle,
  PhoneMissed,
  CircleDot,
  Phone,
  PhoneCall,
  PhoneOff,
  Ban,
  Sparkles
} from 'lucide-react';
import { Badge } from '../common/Badge';
import { updateLeadStatus } from '../../services/leads';
import type { LeadTableRow, LeadStatus, LeadPriority, ContactOutcome } from '../../types/lead';

// Filter and Sort Types
type OutcomeFilter = 'all' | 'NEW' | 'ANSWERED' | 'UNREACHABLE' | 'NO_ANSWER';
type DateFilter = 'all' | 'today' | 'week' | 'month';
type SortOption = 'newest' | 'oldest' | 'priority';

interface ColumnFilters {
  outcome: OutcomeFilter;
  date: DateFilter;
  sort: SortOption;
}

interface KanbanColumn {
  id: string;
  title: string;
  filterType: 'priority' | 'status';
  filterValue: LeadPriority | LeadStatus;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  headerBg: string;
}

interface KanbanBoardProps {
  leads: LeadTableRow[];
  onLeadClick: (id: string) => void;
  onStatusChange: (leadId: string, newStatus: LeadStatus) => void;
  onOutcomeChange?: (leadId: string, newOutcome: ContactOutcome) => void;
  onQuickAction?: (lead: LeadTableRow) => void;
  isLoading?: boolean;
}

// Outcome pill configuration for compact display
const OUTCOME_PILL_CONFIG: Record<ContactOutcome, {
  label: string;
  icon: React.ReactNode;
  bgColor: string;
  textColor: string;
  borderColor: string;
}> = {
  NEW: {
    label: 'New',
    icon: <Sparkles size={12} />,
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
  },
  ANSWERED: {
    label: 'Answered',
    icon: <CheckCircle2 size={12} />,
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-200',
  },
  NO_ANSWER: {
    label: 'No Answer',
    icon: <PhoneMissed size={12} />,
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200',
  },
  UNREACHABLE: {
    label: 'Unreachable',
    icon: <PhoneOff size={12} />,
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
    borderColor: 'border-red-200',
  },
  CALLBACK_REQUESTED: {
    label: 'Callback',
    icon: <Clock size={12} />,
    bgColor: 'bg-violet-50',
    textColor: 'text-violet-700',
    borderColor: 'border-violet-200',
  },
  NOT_INTERESTED: {
    label: 'Not Interested',
    icon: <Ban size={12} />,
    bgColor: 'bg-slate-100',
    textColor: 'text-slate-700',
    borderColor: 'border-slate-300',
  },
  SCHEDULED: {
    label: 'Scheduled',
    icon: <Clock size={12} />,
    bgColor: 'bg-teal-50',
    textColor: 'text-teal-700',
    borderColor: 'border-teal-200',
  },
  COMPLETED: {
    label: 'Completed',
    icon: <CheckCircle2 size={12} />,
    bgColor: 'bg-green-50',
    textColor: 'text-green-700',
    borderColor: 'border-green-200',
  },
};

const COLUMNS: KanbanColumn[] = [
  {
    id: 'hot',
    title: 'Hot Leads',
    filterType: 'priority',
    filterValue: 'hot',
    icon: <Flame size={18} className="animate-pulse" />,
    color: 'text-red-600',
    bgColor: 'bg-red-50/50 border-red-200',
    headerBg: 'bg-gradient-to-r from-red-100 to-red-50',
  },
  {
    id: 'medium',
    title: 'Medium Leads',
    filterType: 'priority',
    filterValue: 'medium',
    icon: <Zap size={18} className="text-amber-500" />,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50/50 border-amber-200',
    headerBg: 'bg-gradient-to-r from-amber-100 to-amber-50',
  },
  {
    id: 'scheduled',
    title: 'Scheduled',
    filterType: 'status',
    filterValue: 'scheduled',
    icon: <CalendarClock size={18} />,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50/50 border-blue-200',
    headerBg: 'bg-gradient-to-r from-blue-100 to-blue-50',
  },
  {
    id: 'completed',
    title: 'Completed',
    filterType: 'status',
    filterValue: 'consultation complete',
    icon: <CheckCircle2 size={18} />,
    color: 'text-green-600',
    bgColor: 'bg-green-50/50 border-green-200',
    headerBg: 'bg-gradient-to-r from-green-100 to-green-50',
  },
];

// NOTE: STATUS_CONFIG removed (unused). Status display handled by <Badge />.

// Default filter state
const DEFAULT_FILTERS: ColumnFilters = {
  outcome: 'all',
  date: 'all',
  sort: 'newest'
};

// Filter dropdown options - Production-ready polished icons
const OUTCOME_OPTIONS: { value: OutcomeFilter; label: string; icon: React.ReactNode }[] = [
  { value: 'all', label: 'All Outcomes', icon: <Filter size={14} className="text-gray-400" /> },
  { value: 'NEW', label: 'New', icon: <CircleDot size={14} className="text-blue-500 animate-pulse" /> },
  { value: 'ANSWERED', label: 'Answered', icon: <CheckCircle2 size={14} className="text-green-500" /> },
  { value: 'UNREACHABLE', label: 'Unreachable', icon: <AlertTriangle size={14} className="text-orange-500" /> },
  { value: 'NO_ANSWER', label: 'No Answer', icon: <PhoneMissed size={14} className="text-gray-500" /> },
];

const DATE_OPTIONS: { value: DateFilter; label: string; icon: React.ReactNode }[] = [
  { value: 'all', label: 'All Time', icon: <CalendarRange size={14} /> },
  { value: 'today', label: 'Today', icon: <CalendarDays size={14} className="text-emerald-500" /> },
  { value: 'week', label: 'This Week', icon: <CalendarDays size={14} className="text-blue-500" /> },
  { value: 'month', label: 'This Month', icon: <CalendarRange size={14} className="text-purple-500" /> },
];

// Schedule-specific date filter options (for future iteration)
type ScheduleDateFilter = 'all' | 'overdue' | 'today' | 'tomorrow' | 'thisWeek' | 'nextWeek';
const SCHEDULE_DATE_OPTIONS: { value: ScheduleDateFilter; label: string; icon: React.ReactNode }[] = [
  { value: 'all', label: 'All Scheduled', icon: <CalendarRange size={14} /> },
  { value: 'overdue', label: '🔴 Overdue', icon: <AlertTriangle size={14} className="text-red-500" /> },
  { value: 'today', label: '🟢 Today', icon: <CalendarDays size={14} className="text-emerald-500" /> },
  { value: 'tomorrow', label: '🟡 Tomorrow', icon: <CalendarDays size={14} className="text-amber-500" /> },
  { value: 'thisWeek', label: '📅 This Week', icon: <CalendarDays size={14} className="text-blue-500" /> },
  { value: 'nextWeek', label: '📆 Next Week', icon: <CalendarRange size={14} className="text-indigo-500" /> },
];
// NOTE: SCHEDULE_DATE_OPTIONS reserved for future schedule-specific filtering
void SCHEDULE_DATE_OPTIONS;

const SORT_OPTIONS: { value: SortOption; label: string; icon: React.ReactNode }[] = [
  { value: 'newest', label: 'Newest First', icon: <ArrowDown size={14} /> },
  { value: 'oldest', label: 'Oldest First', icon: <ArrowUp size={14} /> },
  { value: 'priority', label: 'Priority', icon: <Flame size={14} className="text-red-500" /> },
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  leads,
  onLeadClick,
  onStatusChange,
  onOutcomeChange,
  isLoading = false,
}) => {
  // Note: onOutcomeChange is passed to parent which handles it via QuickActionPanel
  void onOutcomeChange;

  const [draggedLead, setDraggedLead] = useState<LeadTableRow | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [updatingLeads, setUpdatingLeads] = useState<Set<string>>(new Set());
  
  // Filter state for each column
  const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilters>>({
    hot: { ...DEFAULT_FILTERS },
    medium: { ...DEFAULT_FILTERS },
    scheduled: { ...DEFAULT_FILTERS },
    completed: { ...DEFAULT_FILTERS },
  });
  
  // Active dropdown state
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // Update filter for a column
  const updateColumnFilter = useCallback((columnId: string, filterType: keyof ColumnFilters, value: any) => {
    setColumnFilters(prev => ({
      ...prev,
      [columnId]: {
        ...prev[columnId],
        [filterType]: value
      }
    }));
    setActiveDropdown(null);
  }, []);

  // Check if date is within filter range
  const isDateInRange = useCallback((dateString: string, filter: DateFilter): boolean => {
    if (filter === 'all') return true;
    
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (filter) {
      case 'today':
        const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
        return date >= today && date < tomorrow;
      case 'week':
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        return date >= weekAgo;
      case 'month':
        const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        return date >= monthAgo;
      default:
        return true;
    }
  }, []);

  // Get leads for a specific column with filters applied
  const getColumnLeads = useCallback((column: KanbanColumn): LeadTableRow[] => {
    const filters = columnFilters[column.id] || DEFAULT_FILTERS;
    
    return leads
      .filter(lead => {
        // Base column filter
        if (column.filterType === 'status') {
          // Status-based column (Scheduled, Completed)
          if (lead.status !== column.filterValue) return false;
        } else {
          // Priority-based column (Hot/Medium)
          // Show leads with matching priority that are NOT scheduled or completed
          if (lead.priority !== column.filterValue || 
              lead.status === 'scheduled' || 
              lead.status === 'consultation complete') {
            return false;
          }
        }
        
        // Apply outcome filter
        if (filters.outcome !== 'all') {
          if (lead.contactOutcome !== filters.outcome) return false;
        }
        
        // Apply date filter
        // For scheduled column, filter by scheduled date instead of submission date
        if (filters.date !== 'all') {
          if (column.id === 'scheduled' && lead.scheduledCallbackAt) {
            // Filter by scheduled callback date for the Scheduled column
            if (!isDateInRange(lead.scheduledCallbackAt, filters.date)) return false;
          } else {
            // Filter by submission date for other columns
            if (!isDateInRange(lead.submittedAt, filters.date)) return false;
          }
        }
        
        return true;
      })
      .sort((a, b) => {
        // Apply sort option
        switch (filters.sort) {
          case 'oldest':
            return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
          case 'priority':
            // Priority order: hot > medium > low
            const priorityOrder = { hot: 0, medium: 1, low: 2 };
            const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 2;
            const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 2;
            if (aPriority !== bPriority) return aPriority - bPriority;
            // If same priority, sort by newest
            return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
          case 'newest':
          default:
            // For scheduled column, sort by scheduled callback date (earliest first)
            if (column.id === 'scheduled' && a.scheduledCallbackAt && b.scheduledCallbackAt) {
              return new Date(a.scheduledCallbackAt).getTime() - new Date(b.scheduledCallbackAt).getTime();
            }
            return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
        }
      });
  }, [leads, columnFilters, isDateInRange]);

  // Handle drag start
  const handleDragStart = useCallback((e: React.DragEvent, lead: LeadTableRow) => {
    setDraggedLead(lead);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', lead.id);
    
    // Add drag styling
    const target = e.target as HTMLElement;
    setTimeout(() => {
      target.style.opacity = '0.5';
    }, 0);
  }, []);

  // Handle drag end
  const handleDragEnd = useCallback((e: React.DragEvent) => {
    const target = e.target as HTMLElement;
    target.style.opacity = '1';
    setDraggedLead(null);
    setDragOverColumn(null);
  }, []);

  // Handle drag over column
  const handleDragOver = useCallback((e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnId);
  }, []);

  // Handle drag leave
  const handleDragLeave = useCallback(() => {
    setDragOverColumn(null);
  }, []);

  // Handle drop
  const handleDrop = useCallback(async (e: React.DragEvent, column: KanbanColumn) => {
    e.preventDefault();
    setDragOverColumn(null);

    if (!draggedLead) return;

    // Determine the new status based on column
    let newStatus: LeadStatus;
    
    if (column.filterType === 'status') {
      // Dropping on a status column (Scheduled)
      newStatus = column.filterValue as LeadStatus;
    } else {
      // Dropping on a priority column - set to 'contacted' if not already
      // This allows marking a lead as contacted within the same priority column
      if (draggedLead.status === 'new') {
        newStatus = 'contacted';
      } else {
        // Lead is already contacted, no status change needed
        setDraggedLead(null);
        return;
      }
    }

    // Don't update if status is the same
    if (draggedLead.status === newStatus) {
      setDraggedLead(null);
      return;
    }

    // Mark as updating
    setUpdatingLeads(prev => new Set(prev).add(draggedLead.id));

    try {
      // Call API to update status
      await updateLeadStatus(draggedLead.id, newStatus);
      
      // Notify parent of successful status change
      onStatusChange(draggedLead.id, newStatus);
      
      console.log(`Lead ${draggedLead.id} status changed to ${newStatus}`);
    } catch (error) {
      console.error('Failed to update lead status:', error);
    } finally {
      setUpdatingLeads(prev => {
        const next = new Set(prev);
        next.delete(draggedLead.id);
        return next;
      });
      setDraggedLead(null);
    }
  }, [draggedLead, onStatusChange]);

  // Format relative time
  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  // Format scheduled callback date/time
  const formatScheduledDateTime = (dateString: string): { 
    date: string; 
    time: string; 
    fullDateTime: string;
    isToday: boolean; 
    isTomorrow: boolean; 
    isPast: boolean 
  } => {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const scheduledDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    const isToday = scheduledDate.getTime() === today.getTime();
    const isTomorrow = scheduledDate.getTime() === tomorrow.getTime();
    const isPast = date.getTime() < now.getTime();

    // Format time (e.g., "2:30 PM")
    const time = date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });

    // Format date for display
    let formattedDate: string;
    if (isToday) {
      formattedDate = 'Today';
    } else if (isTomorrow) {
      formattedDate = 'Tomorrow';
    } else {
      formattedDate = date.toLocaleDateString('en-US', { 
        weekday: 'short',
        month: 'short', 
        day: 'numeric' 
      });
    }

    // Full formatted date/time for display: "📅 Jan 23, 2026 • 2:30 PM"
    const fullDateTime = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }) + ' • ' + time;

    return { date: formattedDate, time, fullDateTime, isToday, isTomorrow, isPast };
  };

  // NOTE: Status badges are currently rendered via <Badge /> elsewhere.
  // If you want to show them on cards, re-introduce a `getStatusBadge` helper.

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 auto-cols-fr gap-5 h-[calc(100vh-280px)] min-h-[500px]">
      {COLUMNS.map(column => {
        const columnLeads = getColumnLeads(column);
        const isOver = dragOverColumn === column.id;

        return (
          <div
            key={column.id}
            className={`
              w-full flex flex-col rounded-xl border-2 transition-all duration-200 overflow-hidden
              ${column.bgColor}
              ${isOver ? 'ring-2 ring-blue-400 ring-offset-2 scale-[1.01]' : ''}
            `}
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column)}
          >
            {/* Column Header */}
            <div className={`px-4 py-3 border-b border-gray-200/50 ${column.headerBg} sticky top-0 z-10`}>
              <div className="flex items-center justify-between mb-2">
                <div className={`flex items-center gap-2 ${column.color}`}>
                  {column.icon}
                  <h3 className="font-semibold text-sm">{column.title}</h3>
                </div>
                <span className={`
                  px-2.5 py-1 rounded-full text-xs font-bold
                  ${column.color} bg-white shadow-sm
                `}>
                  {columnLeads.length}
                </span>
              </div>
              
              {/* Filter Controls */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Sort Dropdown */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveDropdown(activeDropdown === `${column.id}-sort` ? null : `${column.id}-sort`);
                    }}
                    className={`
                      flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium
                      transition-colors border bg-white/80 hover:bg-white
                      ${columnFilters[column.id]?.sort !== 'newest' 
                        ? 'border-blue-300 text-blue-700' 
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'}
                    `}
                  >
                    <ArrowUpDown size={12} />
                    <span className="hidden sm:inline">
                      {SORT_OPTIONS.find(o => o.value === columnFilters[column.id]?.sort)?.label || 'Sort'}
                    </span>
                    <ChevronDown size={10} />
                  </button>
                  {activeDropdown === `${column.id}-sort` && (
                    <div className="absolute top-full left-0 mt-1 z-20 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[130px]">
                      {SORT_OPTIONS.map(option => (
                        <button
                          key={option.value}
                          onClick={(e) => {
                            e.stopPropagation();
                            updateColumnFilter(column.id, 'sort', option.value);
                          }}
                          className={`
                            w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left
                            hover:bg-gray-50 transition-colors
                            ${columnFilters[column.id]?.sort === option.value ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}
                          `}
                        >
                          {option.icon}
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Date Filter Dropdown */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveDropdown(activeDropdown === `${column.id}-date` ? null : `${column.id}-date`);
                    }}
                    className={`
                      flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium
                      transition-colors border bg-white/80 hover:bg-white
                      ${columnFilters[column.id]?.date !== 'all' 
                        ? 'border-emerald-300 text-emerald-700' 
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'}
                    `}
                  >
                    <CalendarDays size={12} />
                    <span className="hidden sm:inline">
                      {DATE_OPTIONS.find(o => o.value === columnFilters[column.id]?.date)?.label || 'Date'}
                    </span>
                    <ChevronDown size={10} />
                  </button>
                  {activeDropdown === `${column.id}-date` && (
                    <div className="absolute top-full left-0 mt-1 z-20 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[120px]">
                      {DATE_OPTIONS.map(option => (
                        <button
                          key={option.value}
                          onClick={(e) => {
                            e.stopPropagation();
                            updateColumnFilter(column.id, 'date', option.value);
                          }}
                          className={`
                            w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left
                            hover:bg-gray-50 transition-colors
                            ${columnFilters[column.id]?.date === option.value ? 'bg-emerald-50 text-emerald-700' : 'text-gray-700'}
                          `}
                        >
                          {option.icon}
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Outcome Filter - Only for priority columns */}
                {column.filterType === 'priority' && (
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveDropdown(activeDropdown === `${column.id}-outcome` ? null : `${column.id}-outcome`);
                      }}
                      className={`
                        flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium
                        transition-colors border bg-white/80 hover:bg-white
                        ${columnFilters[column.id]?.outcome !== 'all' 
                          ? 'border-purple-300 text-purple-700' 
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'}
                      `}
                    >
                      <Filter size={12} />
                      <span className="hidden sm:inline">
                        {OUTCOME_OPTIONS.find(o => o.value === columnFilters[column.id]?.outcome)?.label || 'Status'}
                      </span>
                      <ChevronDown size={10} />
                    </button>
                    {activeDropdown === `${column.id}-outcome` && (
                      <div className="absolute top-full right-0 mt-1 z-20 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[140px]">
                        {OUTCOME_OPTIONS.map(option => (
                          <button
                            key={option.value}
                            onClick={(e) => {
                              e.stopPropagation();
                              updateColumnFilter(column.id, 'outcome', option.value);
                            }}
                            className={`
                              w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left
                              hover:bg-gray-50 transition-colors
                              ${columnFilters[column.id]?.outcome === option.value ? 'bg-purple-50 text-purple-700' : 'text-gray-700'}
                            `}
                          >
                            {option.icon}
                            {option.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Column Content - Independently Scrollable */}
            <div className="flex-1 p-3 space-y-3 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400">
              {columnLeads.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                    {column.id === 'scheduled' ? (
                      <Calendar size={24} className="text-gray-300" />
                    ) : column.id === 'completed' ? (
                      <CheckCircle2 size={24} className="text-gray-300" />
                    ) : column.id === 'hot' ? (
                      <Flame size={24} className="text-gray-300" />
                    ) : (
                      <Zap size={24} className="text-gray-300" />
                    )}
                  </div>
                  <p className="text-sm font-medium">
                    {column.id === 'scheduled' 
                      ? 'No scheduled callbacks'
                      : column.id === 'completed'
                        ? 'No completed consultations'
                        : `No ${column.filterValue} priority leads`}
                  </p>
                  <p className="text-xs mt-1 text-gray-300">
                    {column.id === 'scheduled'
                      ? 'Schedule a callback to see leads here'
                      : column.id === 'completed'
                        ? 'Completed leads will appear here'
                        : 'Leads will appear here based on score'}
                  </p>
                </div>
              ) : (
                columnLeads.map(lead => {
                  const isUpdating = updatingLeads.has(lead.id);
                  const isScheduledColumn = column.filterType === 'status' && column.filterValue === 'scheduled';
                  const scheduledInfo = isScheduledColumn && lead.scheduledCallbackAt 
                    ? formatScheduledDateTime(lead.scheduledCallbackAt)
                    : null;
                  
                  return (
                    <div
                      key={lead.id}
                      draggable={!isUpdating}
                      onDragStart={(e) => handleDragStart(e, lead)}
                      onDragEnd={handleDragEnd}
                      onClick={() => !isUpdating && onLeadClick(lead.id)}
                      className={`
                        group relative bg-white rounded-xl border shadow-sm
                        cursor-grab active:cursor-grabbing
                        hover:shadow-lg hover:border-gray-300 hover:-translate-y-0.5
                        transition-all duration-200 ease-out
                        ${isUpdating ? 'opacity-50 cursor-wait' : ''}
                        ${draggedLead?.id === lead.id ? 'opacity-50 rotate-1 scale-105' : ''}
                        ${scheduledInfo?.isPast ? 'border-red-200 bg-red-50/30' : 'border-gray-200'}
                      `}
                    >
                      {/* Top accent bar for visual hierarchy */}
                      <div className={`h-1 rounded-t-xl ${
                        column.id === 'hot' ? 'bg-gradient-to-r from-red-400 to-orange-400' :
                        column.id === 'medium' ? 'bg-gradient-to-r from-amber-400 to-yellow-400' :
                        column.id === 'scheduled' ? 'bg-gradient-to-r from-blue-400 to-indigo-400' :
                        'bg-gradient-to-r from-green-400 to-emerald-400'
                      }`} />
                      
                      <div className="p-3.5">
                        {/* Card Header - Lead ID + Priority Badge */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <GripVertical size={14} className="text-gray-300 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <span className="text-xs font-mono text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
                              {lead.leadId}
                            </span>
                          </div>
                          <Badge variant="priority" value={lead.priority} size="sm" />
                        </div>

                        {/* Patient Info Section */}
                        <div className="flex items-center gap-3 mb-3 pb-3 border-b border-gray-100">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center flex-shrink-0 ring-2 ring-white shadow-sm">
                            <User size={18} className="text-gray-500" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-gray-900 text-sm truncate leading-tight">
                              {lead.firstName} {lead.lastName}
                            </p>
                            <p className="text-xs text-gray-500 truncate mt-0.5">{lead.condition}</p>
                          </div>
                        </div>

                        {/* Compact Outcome Pill - Click to open QuickActionPanel */}
                        {column.filterType === 'priority' && (
                          <div className="mb-3">
                            {(() => {
                              const outcome = lead.contactOutcome || 'NEW';
                              const config = OUTCOME_PILL_CONFIG[outcome];
                              return (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onLeadClick(lead.id);
                                  }}
                                  disabled={isUpdating}
                                  className={`
                                    w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border
                                    transition-all duration-200 group/pill
                                    ${config.bgColor} ${config.borderColor}
                                    hover:shadow-md hover:scale-[1.02] active:scale-[0.98]
                                    ${isUpdating ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
                                  `}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className={config.textColor}>{config.icon}</span>
                                    <span className={`text-xs font-semibold ${config.textColor}`}>
                                      {config.label}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    {(lead.contactAttempts || 0) > 0 && (
                                      <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-white/70 text-gray-600 text-[10px] font-bold">
                                        <Phone size={10} />
                                        {lead.contactAttempts}
                                      </span>
                                    )}
                                    <PhoneCall 
                                      size={14} 
                                      className="text-gray-400 group-hover/pill:text-blue-500 transition-colors" 
                                    />
                                  </div>
                                </button>
                              );
                            })()}
                          </div>
                        )}

                        {/* Scheduled Callback Date/Time - Only for Scheduled column */}
                        {isScheduledColumn && scheduledInfo && (
                          <div className={`
                            flex items-start gap-2.5 p-2.5 rounded-lg mb-3
                            ${scheduledInfo.isPast 
                              ? 'bg-red-100 border border-red-200' 
                              : scheduledInfo.isToday 
                                ? 'bg-emerald-100 border border-emerald-200' 
                                : scheduledInfo.isTomorrow
                                  ? 'bg-amber-50 border border-amber-200'
                                  : 'bg-blue-50 border border-blue-100'}
                          `}>
                            <CalendarClock 
                              size={18} 
                              className={`flex-shrink-0 mt-0.5 ${
                                scheduledInfo.isPast 
                                  ? 'text-red-600' 
                                  : scheduledInfo.isToday 
                                    ? 'text-emerald-600' 
                                    : scheduledInfo.isTomorrow
                                      ? 'text-amber-600'
                                      : 'text-blue-600'
                              }`}
                            />
                            <div className="flex-1 min-w-0">
                              {scheduledInfo.isPast && (
                                <p className="text-xs font-bold text-red-700 mb-0.5">
                                  ⚠️ Overdue
                                </p>
                              )}
                              {scheduledInfo.isToday && !scheduledInfo.isPast && (
                                <p className="text-xs font-bold text-emerald-700 mb-0.5">
                                  🔔 Today
                                </p>
                              )}
                              {scheduledInfo.isTomorrow && (
                                <p className="text-xs font-bold text-amber-700 mb-0.5">
                                  📅 Tomorrow
                                </p>
                              )}
                              <p className={`text-xs font-medium ${
                                scheduledInfo.isPast 
                                  ? 'text-red-600' 
                                  : scheduledInfo.isToday 
                                    ? 'text-emerald-600' 
                                    : scheduledInfo.isTomorrow
                                      ? 'text-amber-600'
                                      : 'text-blue-600'
                              }`}>
                                {scheduledInfo.fullDateTime}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* No scheduled time fallback */}
                        {isScheduledColumn && !lead.scheduledCallbackAt && (
                          <div className="flex items-center gap-2 p-2 rounded-lg mb-3 bg-gray-100 border border-gray-200">
                            <CalendarClock size={16} className="text-gray-400" />
                            <p className="text-xs text-gray-500 italic">No time set</p>
                          </div>
                        )}

                        {/* Submission Time */}
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          <Clock size={12} />
                          <span>Submitted {formatRelativeTime(lead.submittedAt)}</span>
                        </div>
                      </div>

                      {/* Loading Overlay */}
                      {isUpdating && (
                        <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-lg">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default KanbanBoard;
