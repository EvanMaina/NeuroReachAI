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
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import RequestInvitationPage from './pages/RequestInvitationPage';
import { SessionExpiredModal } from './components/common/SessionExpiredModal';
import { ConnectionStatusBanner } from './components/common/ConnectionStatusBanner';
import ErrorBoundary from './components/common/ErrorBoundary';

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

// =============================================================================
// Lightweight Skeleton Page Loader (Better UX than spinner)
// =============================================================================

const PageLoader: React.FC = memo(() => (
  <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
    {/* Skeleton Sidebar */}
    <div className="fixed left-0 top-0 w-60 h-screen bg-white border-r border-gray-100 p-4">
      <div className="animate-pulse">
        {/* Logo skeleton */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-gray-200 rounded-xl"></div>
          <div className="h-5 bg-gray-200 rounded w-24"></div>
        </div>
        {/* Navigation skeletons */}
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex items-center gap-3 py-3 mb-1">
            <div className="w-5 h-5 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-20"></div>
          </div>
        ))}
      </div>
    </div>
    
    {/* Skeleton Main Content */}
    <div className="ml-60 p-8">
      <div className="animate-pulse">
        {/* Header skeleton */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-200 rounded-2xl"></div>
            <div>
              <div className="h-8 bg-gray-200 rounded w-48 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-64"></div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-32 h-10 bg-gray-200 rounded-xl"></div>
            <div className="w-24 h-10 bg-gray-200 rounded-xl"></div>
          </div>
        </div>
        
        {/* KPI Cards skeleton */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="w-10 h-10 bg-gray-200 rounded-xl mb-4"></div>
              <div className="h-8 bg-gray-200 rounded w-16 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-24"></div>
            </div>
          ))}
        </div>
        
        {/* Main content skeleton */}
        <div className="grid grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 h-80">
            <div className="h-6 bg-gray-200 rounded w-40 mb-4"></div>
            <div className="h-full bg-gray-100 rounded-xl"></div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-6 h-80">
            <div className="h-6 bg-gray-200 rounded w-40 mb-4"></div>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-lg"></div>
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

type PageType = 'dashboard' | 'coordinator' | 'leads' | 'deleted-leads' | 'providers' | 'analytics' | 'call-analytics' | 'settings';

// Valid coordinator queue types
const COORDINATOR_QUEUES = [
  'all', 'new', 'contacted', 'followup', 'callback',
  'scheduled', 'completed', 'unreachable', 'hot', 'medium', 'low',
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
  
  const validPages: PageType[] = ['dashboard', 'coordinator', 'leads', 'deleted-leads', 'providers', 'analytics', 'call-analytics', 'settings'];
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
      staleTime: 30 * 1000,               // Data fresh for 30 seconds (was 2 mins - too long)
      gcTime: 5 * 60 * 1000,              // Keep in cache for 5 minutes
      
      // Refetch settings - Ensure fresh data
      refetchOnMount: 'always',            // Always refetch fresh data on mount
      refetchOnWindowFocus: true,          // Refetch when user returns to tab
      refetchOnReconnect: true,            // Refetch after network reconnection
      refetchInterval: false,              // No automatic polling (manual refresh instead)
      
      // CRITICAL: Keep previous data while fetching new data
      // This prevents data from disappearing during navigation!
      placeholderData: (previousData: unknown) => previousData,
      
      // Retry settings with exponential backoff
      retry: 3,                            // 3 retries (was 2)
      retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 10000),
      
      // Network mode
      networkMode: 'online',
    },
    mutations: {
      retry: 2,
      networkMode: 'online',
      // Invalidate relevant queries after mutations
      onSuccess: () => {
        // Queries will be invalidated by specific mutation handlers
      },
    },
  },
});

// Log when QueryClient is created (debugging)
if (import.meta.env.DEV) {
  console.log('🔧 QueryClient initialized with persistent cache settings');
}

// =============================================================================
// Performance Monitoring
// =============================================================================

const initPerformanceMonitoring = () => {
  if (typeof window === 'undefined' || !('performance' in window)) return;

  // Only run in development
  if (import.meta.env.DEV) {
    window.addEventListener('load', () => {
      requestAnimationFrame(() => {
        const timing = performance.timing;
        const metrics = {
          TTFB: timing.responseStart - timing.navigationStart,
          DOMContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
          PageLoad: timing.loadEventEnd - timing.navigationStart,
        };
        console.log('📊 Performance:', metrics);
      });
    });
  }
};

// Initialize once
initPerformanceMonitoring();

// =============================================================================
// Page Renderer (Memoized)
// =============================================================================

interface PageRendererProps {
  routeInfo: RouteInfo;
}

const PageRenderer: React.FC<PageRendererProps> = memo(({ routeInfo }) => {
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
        return <SettingsDashboard />;
      case 'dashboard':
      default:
        return <Dashboard />;
    }
  }, [routeInfo.page, routeInfo.queueType]);

  return (
    <Suspense fallback={<PageLoader />}>
      {content}
    </Suspense>
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
    (window as any).navigateTo = (page: string) => {
      window.location.hash = page;
    };
    return () => {
      delete (window as any).navigateTo;
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
      
      {/* Main App */}
      <AppRouter />
    </>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AuthGate />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
