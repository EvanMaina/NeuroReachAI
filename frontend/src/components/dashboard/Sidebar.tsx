/**
 * Sidebar Component
 *
 * Fixed navigation sidebar with expandable sub-menu for Coordinator queues.
 * Filters menu items based on the authenticated user's role via useAuth().
 *
 * SaaS extras:
 *   - Collapse toggle (chevron on the logo). Collapsed state lives in
 *     SidebarContext so globals.css can shrink `--nr-sidebar-width`.
 *   - Per-user avatar (localStorage base64) + Profile link.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  Users,
  BarChart3,
  Settings,
  User,
  LogOut,
  Headphones,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Flame,
  Zap,
  Clock,
  RefreshCw,
  PhoneCall,
  Calendar,
  CalendarX2,
  UserCheck,
  Inbox,
  PhoneOff,
  CheckCircle,
  Building2,
  Phone,
  Trash2,
  Camera,
  Trash2 as TrashIcon,
  Moon,
  Sun,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useSidebarCollapsed } from '../../hooks/useSidebarCollapsed';
import { useTheme } from '../../hooks/useTheme';
import { useAvatar, initialsFor, readFileAsAvatar, writeAvatar, clearAvatar } from '../../hooks/useAvatar';
import { useHiddenNav } from '../../hooks/useHiddenNav';

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
      { name: 'New Leads', href: 'coordinator-new', icon: <Inbox size={16} /> },
      { name: 'Contacted', href: 'coordinator-contacted', icon: <UserCheck size={16} /> },
      { name: 'Follow-up', href: 'coordinator-followup', icon: <RefreshCw size={16} /> },
      { name: 'Callback', href: 'coordinator-callback', icon: <PhoneCall size={16} /> },
      { name: 'Scheduled', href: 'coordinator-scheduled', icon: <Calendar size={16} /> },
      { name: 'Post-Consultation', href: 'coordinator-post-consultation', icon: <CalendarX2 size={16} /> },
      { name: 'Completed', href: 'coordinator-completed', icon: <CheckCircle size={16} /> },
      { name: 'Unreachable', href: 'coordinator-unreachable', icon: <PhoneOff size={16} /> },
      { name: 'Not Interested', href: 'coordinator-not-interested', icon: <PhoneOff size={16} /> },
      { name: 'Hot Priority', href: 'coordinator-hot', icon: <Flame size={16} /> },
      { name: 'Medium Priority', href: 'coordinator-medium', icon: <Zap size={16} /> },
      { name: 'Low Priority', href: 'coordinator-low', icon: <Clock size={16} /> },
    ]
  },
  { name: 'All Leads', href: 'leads', icon: <Users size={20} /> },
  { name: 'Deleted Leads', href: 'deleted-leads', icon: <Trash2 size={20} /> },
  { name: 'Providers', href: 'providers', icon: <Building2 size={20} /> },
  { name: 'AI Insights', href: 'ai-insights', icon: <Zap size={20} /> },
  { name: 'Analytics', href: 'analytics', icon: <BarChart3 size={20} /> },
  { name: 'Call Analytics', href: 'call-analytics', icon: <Phone size={20} /> },
  { name: 'Settings', href: 'settings', icon: <Settings size={20} />, allowedRoles: ['primary_admin', 'administrator'] },
];

// Queue colour map (unchanged)
const queueColors: Record<string, { text: string; bg: string; indicator: string }> = {
  'coordinator-new': { text: 'text-emerald-600 ', bg: 'bg-emerald-50 ', indicator: 'bg-emerald-500' },
  'coordinator-contacted': { text: 'text-blue-600 ', bg: 'bg-blue-50 ', indicator: 'bg-blue-500' },
  'coordinator-followup': { text: 'text-purple-600 ', bg: 'bg-purple-50 ', indicator: 'bg-purple-500' },
  'coordinator-callback': { text: 'text-indigo-600 ', bg: 'bg-indigo-50 ', indicator: 'bg-indigo-500' },
  'coordinator-scheduled': { text: 'text-green-600 ', bg: 'bg-green-50 ', indicator: 'bg-green-500' },
  'coordinator-post-consultation': { text: 'text-violet-700 ', bg: 'bg-violet-50 ', indicator: 'bg-violet-500' },
  'coordinator-completed': { text: 'text-teal-600 ', bg: 'bg-teal-50 ', indicator: 'bg-teal-500' },
  'coordinator-unreachable': { text: 'text-slate-600 ', bg: 'bg-slate-50 ', indicator: 'bg-slate-500' },
  'coordinator-not-interested': { text: 'text-orange-600 ', bg: 'bg-orange-50 ', indicator: 'bg-orange-500' },
  'coordinator-hot': { text: 'text-red-600 ', bg: 'bg-red-50 ', indicator: 'bg-red-500' },
  'coordinator-medium': { text: 'text-amber-600 ', bg: 'bg-amber-50 ', indicator: 'bg-amber-500' },
  'coordinator-low': { text: 'text-blue-600 ', bg: 'bg-blue-50 ', indicator: 'bg-blue-500' },
};

// Role badge colours for the user profile section
const roleBadgeStyle: Record<string, string> = {
  primary_admin: 'bg-red-100 text-red-700  ',
  administrator: 'bg-purple-100 text-purple-700  ',
  coordinator: 'bg-blue-100 text-blue-700  ',
  specialist: 'bg-emerald-100 text-emerald-700  ',
};

// Human-readable role labels (no underscores, proper capitalization)
const roleDisplayLabels: Record<string, string> = {
  primary_admin: 'Primary Admin',
  administrator: 'Administrator',
  coordinator: 'Coordinator',
  specialist: 'Specialist',
};

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
  const { collapsed, toggle: toggleCollapsed } = useSidebarCollapsed();
  const avatarSrc = useAvatar(user?.id);
  const { isHidden } = useHiddenNav(user?.id);
  const activePage = window.location.hash.slice(1) || currentPage || 'dashboard';
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Close the profile menu on outside click + Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

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

  // When collapsed, always close sub-menus so we don't render tall icon-less panels.
  useEffect(() => {
    if (collapsed) setExpandedMenus([]);
  }, [collapsed]);

  // Filter top-level nav by (a) role gating and (b) per-user hide preferences.
  // Hidden items still receive server-side auth — this is cosmetic only.
  const filteredNav = navigation.filter((item) => {
    if (item.allowedRoles && !(user && item.allowedRoles.includes(user.role))) return false;
    if (isHidden(item.href)) return false;
    return true;
  });

  const handleNavigation = (page: string): void => {
    const win = window as Window & { navigateTo?: (page: string) => void };
    if (win.navigateTo) {
      win.navigateTo(page);
    } else {
      onNavigate(page);
    }
  };

  const handleAvatarFile = async (file: File | undefined): Promise<void> => {
    if (!user || !file) return;
    setAvatarError(null);
    try {
      const dataUrl = await readFileAsAvatar(file);
      writeAvatar(user.id, dataUrl);
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Could not upload that image.');
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
            title={collapsed ? item.name : undefined}
            onClick={() => {
              if (collapsed) {
                // When collapsed, clicking a group jumps to its first child directly.
                if (item.href === 'coordinator') handleNavigation('coordinator-new');
                return;
              }
              toggleMenu(item.href.split('-')[0]);
              if (item.href === 'coordinator' && !isExpanded) {
                handleNavigation('coordinator-new');
              }
            }}
            className={`
              w-full flex items-center gap-3 ${collapsed ? 'justify-center px-2' : 'px-3'} py-2.5 rounded-lg text-sm font-medium
              transition-colors duration-150 text-left
              ${isActive
                ? 'bg-blue-50 text-blue-900  '
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900   '
              }
            `}
          >
            <span className={isActive ? 'text-blue-600 ' : 'text-gray-400 '}>{item.icon}</span>
            {!collapsed && <span className="flex-1">{item.name}</span>}
            {!collapsed && (
              <span className={`transition-transform duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'}`}>
                <ChevronDown size={16} className="text-gray-400 " />
              </span>
            )}
          </button>

          {isExpanded && !collapsed && (
            <div className="ml-4 pl-3 mt-1 space-y-0 border-l-2 border-gray-100 ">
              {item.children?.map(child => renderNavItem(child, true))}
            </div>
          )}
        </div>
      );
    }

    // Child (queue sub-item) — never rendered when collapsed (parent is closed).
    if (isChild) {
      return (
        <button
          key={item.name}
          onClick={() => handleNavigation(item.href)}
          className={`
            w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm
            transition-colors duration-150 text-left
            ${isChildActive
              ? `${colors?.bg || 'bg-blue-50 '} ${colors?.text || 'text-blue-900 '} font-medium`
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700   '
            }
          `}
        >
          <span className={isChildActive ? colors?.text : 'text-gray-400 '}>{item.icon}</span>
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
        title={collapsed ? item.name : undefined}
        onClick={() => handleNavigation(item.href)}
        className={`
          w-full flex items-center gap-3 ${collapsed ? 'justify-center px-2' : 'px-3'} py-2.5 rounded-lg text-sm font-medium
          transition-colors duration-150 text-left
          ${isActive
            ? 'bg-blue-50 text-blue-900  '
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900   '
          }
        `}
      >
        <span className={isActive ? 'text-blue-600 ' : 'text-gray-400 '}>{item.icon}</span>
        {!collapsed && <span>{item.name}</span>}
        {!collapsed && isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600 " />}
      </button>
    );
  };

  const profileButtonActive = activePage === 'profile';

  return (
    <aside className="nr-sidebar-w fixed inset-y-0 left-0 bg-white border-r border-gray-200   flex flex-col z-30">
      {/* Logo + collapse toggle */}
      <div className={`h-16 flex items-center ${collapsed ? 'px-3 justify-center' : 'px-4'} border-b border-gray-200  flex-shrink-0`}>
        {collapsed ? (
          <button
            onClick={toggleCollapsed}
            title="Expand sidebar"
            className="w-9 h-9 bg-blue-900 rounded-lg flex items-center justify-center flex-shrink-0 hover:bg-blue-800 transition-colors"
          >
            <span className="text-white font-bold text-sm">NR</span>
          </button>
        ) : (
          <>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-9 h-9 bg-blue-900  rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">NR</span>
              </div>
              <div className="min-w-0">
                <span className="font-semibold text-gray-900  block leading-tight truncate">NeuroReach</span>
                <span className="text-xs text-gray-500  truncate">AI Platform</span>
              </div>
            </div>
            <button
              onClick={toggleCollapsed}
              title="Collapse sidebar"
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700    transition-colors"
            >
              <ChevronLeft size={18} className="transition-transform duration-200" />
            </button>
          </>
        )}
      </div>

      {/* Navigation */}
      <nav
        className="flex-1 min-h-0 px-3 py-4 space-y-1 overflow-y-auto"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#d1d5db transparent' }}
      >
        {filteredNav.map((item) => renderNavItem(item))}
      </nav>

      {/* Theme toggle */}
      <ThemeToggleButton collapsed={collapsed} />

      {/* Footer: single profile row with a popup menu (Slack/Linear/Notion pattern). */}
      <div ref={menuRef} className="relative border-t border-gray-200  p-2 flex-shrink-0">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          title={collapsed ? (user ? `${user.first_name} ${user.last_name}` : 'Account') : undefined}
          className={`w-full flex items-center gap-3 p-2 rounded-xl transition-colors ${menuOpen || profileButtonActive
            ? 'bg-gray-100 '
            : 'hover:bg-gray-50 '
            }`}
        >
          {/*
            Avatar + online indicator. The dot is wrapped with the avatar in a
            `relative` container so it pins to the bottom-right regardless of
            whether the avatar is an image or initials. Authenticated == online
            for now (we don't have presence/heartbeat infra). The double ring —
            outer matches surface so the dot reads as a separated badge — is the
            same pattern Linear/Slack use.
          */}
          <span className="relative flex-shrink-0">
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt="Your avatar"
                className="w-9 h-9 rounded-full object-cover ring-2 ring-white "
              />
            ) : (
              <span className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center ring-2 ring-white ">
                {user ? (
                  <span className="text-sm font-semibold text-white">
                    {initialsFor(user.first_name, user.last_name)}
                  </span>
                ) : (
                  <User size={18} className="text-white" />
                )}
              </span>
            )}
            {user && (
              <span
                aria-label="Online"
                className="absolute bottom-0 right-0 block w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white  shadow-sm"
              />
            )}
          </span>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-semibold text-gray-900  truncate leading-tight">
                  {user ? `${user.first_name} ${user.last_name}` : '…'}
                </p>
              </div>
              <ChevronUp
                size={14}
                className={`text-gray-400  flex-shrink-0 transition-transform duration-150 ${menuOpen ? 'rotate-0' : 'rotate-180'
                  }`}
              />
            </>
          )}
        </button>

        {/* Popup menu — positioned above the profile row. */}
        {menuOpen && (
          <div
            className={`
              absolute z-40 bottom-[calc(100%+4px)]
              ${collapsed ? 'left-full ml-2 w-64' : 'left-2 right-2'}
              bg-white 
              border border-gray-200 
              rounded-xl shadow-xl overflow-hidden
            `}
          >
            <div className="px-4 py-4 border-b border-gray-100  bg-gray-50 ">
              <div className="flex items-center gap-3">
                {/*
                  Dropdown avatar — upload button + camera-overlay on hover.
                  Online dot sits OUTSIDE the rounded image (which uses
                  overflow-hidden to clip the photo), so we render it as a
                  sibling pinned to the bottom-right of the wrapper.
                */}
                <span className="relative flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="relative w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-indigo-600 ring-2 ring-white  shadow-sm group block"
                    title="Upload profile photo"
                  >
                    {avatarSrc ? (
                      <img src={avatarSrc} alt="" className="w-full h-full object-cover" />
                    ) : user ? (
                      <span className="w-full h-full flex items-center justify-center text-sm font-semibold text-white">
                        {initialsFor(user.first_name, user.last_name)}
                      </span>
                    ) : null}
                    <span className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Camera size={16} className="text-white" />
                    </span>
                  </button>
                  {user && (
                    <span
                      aria-label="Online"
                      className="absolute bottom-0 right-0 block w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white  shadow"
                    />
                  )}
                </span>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    void handleAvatarFile(e.target.files?.[0]);
                    e.currentTarget.value = '';
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900  truncate">
                    {user ? `${user.first_name} ${user.last_name}` : '…'}
                  </p>
                  {user && (
                    <span className={`mt-1 inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wide ${roleBadgeStyle[user.role] || ''}`}>
                      {formatRoleLabel(user.role)}
                    </span>
                  )}
                </div>
                {avatarSrc && user && (
                  <button
                    type="button"
                    onClick={() => { clearAvatar(user.id); setAvatarError(null); }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50  transition-colors"
                    title="Remove profile photo"
                  >
                    <TrashIcon size={14} />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="mt-3 w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-100     transition-colors"
              >
                <Camera size={14} />
                Upload photo
              </button>
              {avatarError && <p className="mt-2 text-[11px] text-red-600 ">{avatarError}</p>}
            </div>

            {/* Destructive action */}
            <div className="py-1 border-t border-gray-100 ">
              <MenuItemButton
                icon={<LogOut size={15} />}
                label="Sign out"
                danger
                onClick={() => { setMenuOpen(false); void handleLogout(); }}
              />
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

// =============================================================================
// ThemeToggleButton — Dark/Light mode switch in sidebar
// =============================================================================

const ThemeToggleButton: React.FC<{ collapsed: boolean }> = ({ collapsed }) => {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="px-3 pb-2 flex-shrink-0">
      <button
        onClick={toggle}
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        className={`
          w-full flex items-center gap-3 ${collapsed ? 'justify-center px-2' : 'px-3'} py-2.5 rounded-lg text-sm font-medium
          transition-all duration-200 text-left
          text-gray-600 hover:bg-gray-50 hover:text-gray-900
        `}
      >
        <span className="relative flex-shrink-0 w-5 h-5">
          <Sun
            size={20}
            className={`absolute inset-0 transition-all duration-300 ${isDark ? 'opacity-0 rotate-90 scale-0' : 'opacity-100 rotate-0 scale-100 text-amber-500'
              }`}
          />
          <Moon
            size={20}
            className={`absolute inset-0 transition-all duration-300 ${isDark ? 'opacity-100 rotate-0 scale-100 text-blue-400' : 'opacity-0 -rotate-90 scale-0'
              }`}
          />
        </span>
        {!collapsed && (
          <span className="flex-1 flex items-center justify-between">
            <span>{isDark ? 'Dark Mode' : 'Light Mode'}</span>
            <span className={`
              relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 flex-shrink-0
              ${isDark ? 'bg-blue-600' : 'bg-gray-300'}
            `}>
              <span className={`
                inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200
                ${isDark ? 'translate-x-[18px]' : 'translate-x-[3px]'}
              `} />
            </span>
          </span>
        )}
      </button>
    </div>
  );
};

// =============================================================================
// MenuItemButton — shared styling for dropdown entries
// =============================================================================

interface MenuItemButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  trailing?: React.ReactNode;
  danger?: boolean;
}

const MenuItemButton: React.FC<MenuItemButtonProps> = ({ icon, label, onClick, trailing, danger }) => (
  <button
    onClick={onClick}
    className={`
      w-full flex items-center justify-between gap-3 px-3 py-2 text-sm font-medium
      transition-colors
      ${danger
        ? 'text-red-600 hover:bg-red-50  '
        : 'text-gray-700 hover:bg-gray-100  '}
    `}
  >
    <span className="flex items-center gap-3">
      <span className={danger ? 'text-red-500 ' : 'text-gray-500 '}>
        {icon}
      </span>
      {label}
    </span>
    {trailing}
  </button>
);
