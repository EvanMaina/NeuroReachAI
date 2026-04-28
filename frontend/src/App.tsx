/**
 * Root application component with performance optimizations.
 * 
 * PERFORMANCE FEATURES:
 * - Lazy loading for all page components (code splitting)
 * - Optimized React Query configuration
 * - Web Vitals monitoring
 * - Lightweight skeleton loading
 * 
 * @module App
 * @version 2.0.0 - Performance optimized
 */

import React, { useState, useEffect, lazy, Suspense, memo, useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { SidebarProvider } from './hooks/useSidebarCollapsed';
import { ThemeProvider } from './hooks/useTheme';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import RequestInvitationPage from './pages/RequestInvitationPage';
import { SessionExpiredModal } from './components/common/SessionExpiredModal';
import { ConnectionStatusBanner } from './components/common/ConnectionStatusBanner';
import ErrorBoundary from './components/common/ErrorBoundary';
import { ToastContainer } from './components/common/ToastContainer';
import NewLeadWatcher from './components/common/NewLeadWatcher';

// =============================================================================
// Lazy-Loaded Pages (Code Splitting)
// =============================================================================

const Dashboard = lazy(() => import(/* webpackChunkName: "dashboard" */ './pages/Dashboard'));
const CoordinatorDashboard = lazy(() => import(/* webpackChunkName: "coordinator" */ './pages/CoordinatorDashboard'));
const AnalyticsDashboard = lazy(() => import(/* webpackChunkName: "analytics" */ './pages/AnalyticsDashboard'));
const SettingsDashboard = lazy(() => import(/* webpackChunkName: "settings" */ './pages/SettingsDashboard'));
const ProvidersDashboard = lazy(() => import(/* webpackChunkName: "providers" */ './pages/ProvidersDashboard'));
const CallAnalyticsDashboard = lazy(() => import(/* webpackChunkName: "call-analytics" */ './pages/CallAnalyticsDashboard'));
const DeletedLeadsDashboard = lazy(() => import(/* webpackChunkName: "deleted-leads" */ './pages/DeletedLeadsDashboard'));
const ProfilePage = lazy(() => import(/* webpackChunkName: "profile" */ './pages/ProfilePage'));
const AIInsightsDashboard = lazy(() => import(/* webpackChunkName: "ai-insights" */ './pages/AIInsightsDashboard'));

// =============================================================================
// Lightweight Skeleton Page Loader (Better UX than spinner)
// =============================================================================

const PageLoader: React.FC = memo(() => (
  <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50  ">
    {/* Skeleton Sidebar */}
    <div className="nr-sidebar-w fixed left-0 top-0 h-screen bg-white  border-r border-gray-100  p-4">
      <div className="animate-pulse">
        {/* Logo skeleton */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-gray-200  rounded-xl"></div>
          <div className="h-5 bg-gray-200  rounded w-24"></div>
        </div>
        {/* Navigation skeletons */}
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex items-center gap-3 py-3 mb-1">
            <div className="w-5 h-5 bg-gray-200  rounded"></div>
            <div className="h-4 bg-gray-200  rounded w-20"></div>
          </div>
        ))}
      </div>
    </div>

    {/* Skeleton Main Content */}
    <div className="nr-sidebar-ml p-8">
      <div className="animate-pulse">
        {/* Header skeleton */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-200  rounded-2xl"></div>
            <div>
              <div className="h-8 bg-gray-200  rounded w-48 mb-2"></div>
              <div className="h-4 bg-gray-200  rounded w-64"></div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-32 h-10 bg-gray-200  rounded-xl"></div>
            <div className="w-24 h-10 bg-gray-200  rounded-xl"></div>
          </div>
        </div>

        {/* KPI Cards skeleton */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white  rounded-2xl border border-gray-100  p-6">
              <div className="w-10 h-10 bg-gray-200  rounded-xl mb-4"></div>
              <div className="h-8 bg-gray-200  rounded w-16 mb-2"></div>
              <div className="h-4 bg-gray-200  rounded w-24"></div>
            </div>
          ))}
        </div>

        {/* Main content skeleton */}
        <div className="grid grid-cols-2 gap-8">
          <div className="bg-white  rounded-2xl border border-gray-100  p-6 h-80">
            <div className="h-6 bg-gray-200  rounded w-40 mb-4"></div>
            <div className="h-full bg-gray-100  rounded-xl"></div>
          </div>
          <div className="bg-white  rounded-2xl border border-gray-100  p-6 h-80">
            <div className="h-6 bg-gray-200  rounded w-40 mb-4"></div>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-gray-100  rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
));

PageLoader.displayName = 'PageLoader';

// =============================================================================
// Types
// =============================================================================

type PageType = 'dashboard' | 'coordinator' | 'leads' | 'deleted-leads' | 'providers' | 'analytics' | 'call-analytics' | 'settings' | 'profile' | 'ai-insights';

// Valid coordinator queue types
const COORDINATOR_QUEUES = [
  'all', 'new', 'contacted', 'followup', 'callback',
  'scheduled', 'completed', 'unreachable', 'not-interested', 'hot', 'medium', 'low',
] as const;

interface RouteInfo {
  page: PageType;
  queueType?: string;
}

// =============================================================================
// Route Parsing (Memoized)
// =============================================================================

const parseHash = (): RouteInfo => {
  const hash = window.location.hash.slice(1) || 'dashboard';

  if (hash.startsWith('coordinator-')) {
    const queueType = hash.replace('coordinator-', '');
    if (COORDINATOR_QUEUES.includes(queueType as typeof COORDINATOR_QUEUES[number])) {
      return { page: 'coordinator', queueType };
    }
  }

  if (hash === 'coordinator') {
    return { page: 'coordinator', queueType: 'all' };
  }

  const validPages: PageType[] = ['dashboard', 'coordinator', 'leads', 'deleted-leads', 'providers', 'analytics', 'call-analytics', 'settings', 'profile', 'ai-insights'];
  if (validPages.includes(hash as PageType)) {
    return { page: hash as PageType };
  }

  return { page: 'dashboard' };
};

// =============================================================================
// React Query Configuration (Optimized Cache - Fresh Data + Persistence)
// =============================================================================

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache settings - Balanced for fresh data while preventing data loss
      staleTime: 60 * 1000,               // Data fresh for 60 seconds — prevents refetch storms during rapid navigation
      gcTime: 5 * 60 * 1000,              // Keep in cache for 5 minutes — data persists across page switches

      // Refetch settings — conservative to prevent hanging during rapid navigation
      refetchOnMount: true,                // Refetch only when data is stale (respects staleTime)
      refetchOnWindowFocus: false,         // Don't refetch on tab switch — prevents unexpected loading states
      refetchOnReconnect: true,            // Refetch after network reconnection
      refetchInterval: false,              // No automatic polling (manual refresh instead)

      // CRITICAL: Keep previous data while fetching new data
      // This prevents data from disappearing during navigation!
      placeholderData: (previousData: unknown) => previousData,

      // Retry settings with exponential backoff
      retry: 3,                            // 3 retries (was 2)
      retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 10000),

      // CRITICAL FIX: Use 'always' to match useLeads hook.
      // 'online' caused queries to pause during brief connectivity hiccups
      // after Docker container rebuild, leaving dashboard stuck on "Loading leads..."
      networkMode: 'always',
    },
    mutations: {
      retry: 2,
      networkMode: 'always',
      // Invalidate relevant queries after mutations
      onSuccess: () => {
        // Queries will be invalidated by specific mutation handlers
      },
    },
  },
});


// =============================================================================
// Page Renderer (Memoized)
// =============================================================================

interface PageRendererProps {
  routeInfo: RouteInfo;
}

const PageRenderer: React.FC<PageRendererProps> = memo(({ routeInfo }) => {
  const { user } = useAuth();
  const canAccessSettings = user?.role === 'primary_admin' || user?.role === 'administrator';

  useEffect(() => {
    if (routeInfo.page === 'settings' && !canAccessSettings) {
      window.location.hash = 'dashboard';
    }
  }, [routeInfo.page, canAccessSettings]);

  const content = useMemo(() => {
    switch (routeInfo.page) {
      case 'coordinator':
        return <CoordinatorDashboard queueType={routeInfo.queueType || 'new'} />;
      case 'leads':
        return <CoordinatorDashboard queueType="all" />;
      case 'deleted-leads':
        return <DeletedLeadsDashboard />;
      case 'providers':
        return <ProvidersDashboard />;
      case 'analytics':
        return <AnalyticsDashboard />;
      case 'call-analytics':
        return <CallAnalyticsDashboard />;
      case 'settings':
        return canAccessSettings ? <SettingsDashboard /> : <Dashboard />;
      case 'profile':
        return <ProfilePage />;
      case 'ai-insights':
        return <AIInsightsDashboard />;
      case 'dashboard':
      default:
        return <Dashboard />;
    }
  }, [routeInfo.page, routeInfo.queueType, canAccessSettings]);

  // KEY FIX: ErrorBoundary uses `key` derived from the current route.
  // When the user navigates to a different page/queue, React unmounts the old
  // ErrorBoundary and mounts a fresh one with hasError=false. This prevents
  // the "stuck on error page" bug where a transient error on one page
  // (e.g., coordinator-new) would block ALL subsequent navigation until
  // the user manually clicked "Reload Page".
  //
  // Without this key, the class component's state persists across route
  // changes because React reuses the same instance (same position in tree).
  const errorBoundaryKey = `${routeInfo.page}-${routeInfo.queueType || 'default'}`;

  return (
    <ErrorBoundary
      key={errorBoundaryKey}
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50   p-6">
          <div className="max-w-md w-full bg-white  rounded-2xl shadow-lg border border-gray-100  p-8 text-center">
            <div className="mx-auto w-14 h-14 bg-amber-100  rounded-full flex items-center justify-center mb-5">
              <svg className="w-7 h-7 text-amber-600 " fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900  mb-2">This page encountered an error</h2>
            <p className="text-gray-500  text-sm mb-6">The rest of the application is still working. You can navigate to another page or reload this one.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => { window.location.hash = 'dashboard'; window.location.reload(); }}
                className="px-4 py-2 bg-white  border border-gray-200  text-gray-700  rounded-xl hover:bg-gray-50  transition-colors text-sm font-medium">
                Go to Dashboard
              </button>
              <button onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-medium">
                Reload Page
              </button>
            </div>
          </div>
        </div>
      }
    >
      <Suspense fallback={<PageLoader />}>
        {content}
      </Suspense>
    </ErrorBoundary>
  );
});

PageRenderer.displayName = 'PageRenderer';

// =============================================================================
// Main Router Component
// =============================================================================

const AppRouter: React.FC = memo(() => {
  const [routeInfo, setRouteInfo] = useState<RouteInfo>(parseHash);

  useEffect(() => {
    const handleHashChange = () => {
      setRouteInfo(parseHash());
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Global navigation function
  useEffect(() => {
    const win = window as Window & { navigateTo?: (page: string) => void };
    win.navigateTo = (page: string) => {
      window.location.hash = page;
    };
    return () => {
      delete (window as Window & { navigateTo?: (page: string) => void }).navigateTo;
    };
  }, []);

  return <PageRenderer routeInfo={routeInfo} />;
});

AppRouter.displayName = 'AppRouter';

// =============================================================================
// Root App Component
// =============================================================================

// =============================================================================
// Connection Status Manager
// =============================================================================

const useConnectionStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setIsReconnecting(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const retry = async () => {
    setIsReconnecting(true);
    // Wait a bit then check connection
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsReconnecting(false);
  };

  return { isOnline, isReconnecting, retry };
};

// =============================================================================
// Auth Gate — renders LoginPage when unauthenticated
// =============================================================================

const AuthGate: React.FC = () => {
  const { isAuthenticated, isLoading, mustChangePassword, sessionExpired, dismissSessionExpired } = useAuth();
  const { isOnline, isReconnecting, retry } = useConnectionStatus();
  const [hash, setHash] = useState(window.location.hash);

  // Listen for hash changes to detect public routes
  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Public routes — accessible without authentication
  if (hash.startsWith('#forgot-password')) {
    return <ForgotPasswordPage />;
  }
  if (hash.startsWith('#reset-password')) {
    return <ResetPasswordPage />;
  }
  if (hash === '#request-invitation') {
    return <RequestInvitationPage />;
  }

  if (isLoading) {
    // Minimal centered spinner while hydrating
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Not logged in OR needs password change → LoginPage handles both states
  if (!isAuthenticated || mustChangePassword) {
    return <LoginPage />;
  }

  return (
    <>
      {/* Connection Status Banner */}
      <ConnectionStatusBanner
        isOnline={isOnline}
        isReconnecting={isReconnecting}
        onRetry={retry}
      />

      {/* Session Expired Modal */}
      <SessionExpiredModal
        isOpen={sessionExpired}
        onLoginClick={dismissSessionExpired}
      />

      {/* Background new-lead polling — invisible, fires toasts + cache invalidation */}
      <NewLeadWatcher />

      {/* Main App */}
      <AppRouter />
    </>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <SidebarProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <AuthGate />
            </AuthProvider>
          </QueryClientProvider>
          {/* Global Toast Notification System — renders outside React Query/Auth for reliability */}
          <ToastContainer />
        </SidebarProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
