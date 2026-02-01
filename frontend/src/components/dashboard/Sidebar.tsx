/**
 * Sidebar Component
 *
 * Fixed navigation sidebar with expandable sub-menu for Coordinator queues.
 * Filters menu items based on the authenticated user's role via useAuth().
 * Shows actual user profile and a functional logout button.
 */

import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  BarChart3,
  Settings,
  User,
  LogOut,
  Headphones,
  ChevronDown,
  Flame,
  Zap,
  Clock,
  RefreshCw,
  PhoneCall,
  Calendar,
  UserCheck,
  Inbox,
  PhoneOff,
  CheckCircle,
  Building2,
  Phone,
  Trash2
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

// =============================================================================
// Types & Navigation Definition
// =============================================================================

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  /** If set, only these roles can see this item */
  allowedRoles?: string[];
  children?: NavItem[];
}

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: 'dashboard', icon: <LayoutDashboard size={20} /> },
  {
    name: 'Coordinator',
    href: 'coordinator',
    icon: <Headphones size={20} />,
    children: [
      { name: 'New Leads',    href: 'coordinator-new',         icon: <Inbox size={16} /> },
      { name: 'Contacted',    href: 'coordinator-contacted',   icon: <UserCheck size={16} /> },
      { name: 'Follow-up',    href: 'coordinator-followup',    icon: <RefreshCw size={16} /> },
      { name: 'Callback',     href: 'coordinator-callback',    icon: <PhoneCall size={16} /> },
      { name: 'Scheduled',    href: 'coordinator-scheduled',   icon: <Calendar size={16} /> },
      { name: 'Completed',    href: 'coordinator-completed',   icon: <CheckCircle size={16} /> },
      { name: 'Unreachable',  href: 'coordinator-unreachable', icon: <PhoneOff size={16} /> },
      { name: 'Hot Priority', href: 'coordinator-hot',         icon: <Flame size={16} /> },
      { name: 'Medium Priority', href: 'coordinator-medium',   icon: <Zap size={16} /> },
      { name: 'Low Priority', href: 'coordinator-low',         icon: <Clock size={16} /> },
    ]
  },
  { name: 'All Leads',  href: 'leads',      icon: <Users size={20} /> },
  { name: 'Deleted Leads', href: 'deleted-leads', icon: <Trash2 size={20} />, allowedRoles: ['primary_admin', 'administrator'] },
  { name: 'Providers',  href: 'providers',   icon: <Building2 size={20} /> },
  { name: 'Analytics',  href: 'analytics',   icon: <BarChart3 size={20} />, allowedRoles: ['primary_admin', 'administrator', 'coordinator'] },
  { name: 'Call Analytics', href: 'call-analytics', icon: <Phone size={20} />, allowedRoles: ['primary_admin', 'administrator', 'coordinator'] },
  { name: 'Settings',   href: 'settings',    icon: <Settings size={20} />,  allowedRoles: ['primary_admin', 'administrator'] },
];

// Queue colour map (unchanged)
const queueColors: Record<string, { text: string; bg: string; indicator: string }> = {
  'coordinator-new':         { text: 'text-emerald-600', bg: 'bg-emerald-50', indicator: 'bg-emerald-500' },
  'coordinator-contacted':   { text: 'text-blue-600',    bg: 'bg-blue-50',    indicator: 'bg-blue-500' },
  'coordinator-followup':    { text: 'text-purple-600',  bg: 'bg-purple-50',  indicator: 'bg-purple-500' },
  'coordinator-callback':    { text: 'text-indigo-600',  bg: 'bg-indigo-50',  indicator: 'bg-indigo-500' },
  'coordinator-scheduled':   { text: 'text-green-600',   bg: 'bg-green-50',   indicator: 'bg-green-500' },
  'coordinator-completed':   { text: 'text-teal-600',    bg: 'bg-teal-50',    indicator: 'bg-teal-500' },
  'coordinator-unreachable': { text: 'text-slate-600',   bg: 'bg-slate-50',   indicator: 'bg-slate-500' },
  'coordinator-hot':         { text: 'text-red-600',     bg: 'bg-red-50',     indicator: 'bg-red-500' },
  'coordinator-medium':      { text: 'text-amber-600',   bg: 'bg-amber-50',   indicator: 'bg-amber-500' },
  'coordinator-low':         { text: 'text-blue-600',    bg: 'bg-blue-50',    indicator: 'bg-blue-500' },
};

// Role badge colours for the user profile section
const roleBadgeStyle: Record<string, string> = {
  primary_admin: 'bg-red-100 text-red-700',
  administrator: 'bg-purple-100 text-purple-700',
  coordinator:   'bg-blue-100 text-blue-700',
  specialist:    'bg-emerald-100 text-emerald-700',
};

// Human-readable role labels (no underscores, proper capitalization)
const roleDisplayLabels: Record<string, string> = {
  primary_admin: 'Primary Admin',
  administrator: 'Administrator',
  coordinator:   'Coordinator',
  specialist:    'Specialist',
};

/**
 * Format a role string for display.
 * Uses the lookup map first, falls back to replacing underscores and title-casing.
 */
function formatRoleLabel(role: string): string {
  if (roleDisplayLabels[role]) return roleDisplayLabels[role];
  return role
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// =============================================================================
// Component
// =============================================================================

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate }) => {
  const { user, logout } = useAuth();
  const activePage = window.location.hash.slice(1) || currentPage || 'dashboard';

  const [expandedMenus, setExpandedMenus] = useState<string[]>(() => {
    const initialPage = window.location.hash.slice(1) || currentPage || 'dashboard';
    return initialPage.startsWith('coordinator') ? ['coordinator'] : [];
  });

  useEffect(() => {
    if (activePage.startsWith('coordinator')) {
      setExpandedMenus(prev => prev.includes('coordinator') ? prev : [...prev, 'coordinator']);
    } else {
      setExpandedMenus(prev => prev.filter(m => m !== 'coordinator'));
    }
  }, [activePage]);

  // Filter top-level nav based on current user's role
  const filteredNav = navigation.filter(item =>
    !item.allowedRoles || (user && item.allowedRoles.includes(user.role))
  );

  const handleNavigation = (page: string): void => {
    if ((window as any).navigateTo) {
      (window as any).navigateTo(page);
    } else {
      onNavigate(page);
    }
  };

  const toggleMenu = (menuName: string): void => {
    setExpandedMenus(prev =>
      prev.includes(menuName)
        ? prev.filter(m => m !== menuName)
        : [...prev, menuName]
    );
  };

  const handleLogout = async (): Promise<void> => {
    await logout();
  };

  // ------------------------------------------------------------------
  // Render helpers
  // ------------------------------------------------------------------
  const renderNavItem = (item: NavItem, isChild = false): React.ReactNode => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedMenus.includes(item.href.split('-')[0]);
    const isActive = activePage === item.href ||
                     (hasChildren && item.children?.some(c => activePage === c.href));
    const isChildActive = activePage === item.href;
    const colors = queueColors[item.href];

    if (hasChildren) {
      return (
        <div key={item.name}>
          <button
            onClick={() => {
              toggleMenu(item.href.split('-')[0]);
              if (item.href === 'coordinator' && !isExpanded) {
                handleNavigation('coordinator-new');
              }
            }}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
              transition-colors duration-150 text-left
              ${isActive
                ? 'bg-blue-50 text-blue-900'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }
            `}
          >
            <span className={isActive ? 'text-blue-600' : 'text-gray-400'}>{item.icon}</span>
            <span className="flex-1">{item.name}</span>
            <span className={`transition-transform duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'}`}>
              <ChevronDown size={16} className="text-gray-400" />
            </span>
          </button>

          <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="ml-4 pl-3 mt-1 space-y-0.5 border-l-2 border-gray-100">
              {item.children?.map(child => renderNavItem(child, true))}
            </div>
          </div>
        </div>
      );
    }

    // Child (queue sub-item)
    if (isChild) {
      return (
        <button
          key={item.name}
          onClick={() => handleNavigation(item.href)}
          className={`
            w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm
            transition-colors duration-150 text-left
            ${isChildActive
              ? `${colors?.bg || 'bg-blue-50'} ${colors?.text || 'text-blue-900'} font-medium`
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
            }
          `}
        >
          <span className={isChildActive ? colors?.text : 'text-gray-400'}>{item.icon}</span>
          <span>{item.name}</span>
          {isChildActive && colors && (
            <div className={`ml-auto w-2 h-2 rounded-full ${colors.indicator}`} />
          )}
        </button>
      );
    }

    // Top-level item
    return (
      <button
        key={item.name}
        onClick={() => handleNavigation(item.href)}
        className={`
          w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
          transition-colors duration-150 text-left
          ${isActive
            ? 'bg-blue-50 text-blue-900'
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }
        `}
      >
        <span className={isActive ? 'text-blue-600' : 'text-gray-400'}>{item.icon}</span>
        <span>{item.name}</span>
        {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600" />}
      </button>
    );
  };

  return (
    <aside className="fixed inset-y-0 left-0 w-60 bg-white border-r border-gray-200 flex flex-col z-30">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-900 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">NR</span>
          </div>
          <div>
            <span className="font-semibold text-gray-900 block leading-tight">NeuroReach</span>
            <span className="text-xs text-gray-500">AI Platform</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {filteredNav.map((item) => renderNavItem(item))}
      </nav>

      {/* User profile + logout */}
      <div className="border-t border-gray-200 p-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
            <User size={20} className="text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user ? `${user.first_name} ${user.last_name}` : '…'}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {user && (
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${roleBadgeStyle[user.role] || ''}`}>
                  {formatRoleLabel(user.role)}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
            title="Log out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
};
