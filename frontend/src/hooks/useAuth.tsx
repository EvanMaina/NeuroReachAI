/**
 * Authentication context and hook.
 *
 * Provides:
 *   - Current user profile + permission set
 *   - login / logout / changePassword actions
 *   - Axios interceptor that attaches the Bearer token on every request
 *
 * Usage:
 *   <AuthProvider>   ← wrap your app once
 *     useAuth()      ← call anywhere inside
 *   </AuthProvider>
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { apiClient, checkTokenValidity, setStoredRefreshToken } from '../services/api';
import { login as apiLogin, logout as apiLogout, getMe, changePassword as apiChangePassword } from '../services/auth';
import type { IUserProfile } from '../services/auth';

// =============================================================================
// Context shape
// =============================================================================

interface IAuthContext {
  user: IUserProfile | null;
  permissions: string[];
  isAuthenticated: boolean;
  isLoading: boolean;
  mustChangePassword: boolean;
  sessionExpired: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string | null, newPassword: string) => Promise<void>;
  hasPermission: (perm: string) => boolean;
  dismissSessionExpired: () => void;
}

const AuthContext = createContext<IAuthContext | undefined>(undefined);

// =============================================================================
// Token helpers (sessionStorage so tabs share session, cleared on browser close)
// =============================================================================

const TOKEN_KEY = 'nr_access_token';

function getStoredToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

function setStoredToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

function clearStoredToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

// =============================================================================
// Provider
// =============================================================================

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<IUserProfile | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  // ------------------------------------------------------------------
  // Axios interceptor: attach Bearer token
  // ------------------------------------------------------------------
  useEffect(() => {
    const interceptor = apiClient.interceptors.request.use((config) => {
      const token = getStoredToken();
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
      return config;
    });
    return () => apiClient.interceptors.request.eject(interceptor);
  }, []);

  // ------------------------------------------------------------------
  // Listen for session expiry events from API interceptor
  // ------------------------------------------------------------------
  useEffect(() => {
    const handleSessionExpired = (event: Event) => {
      const customEvent = event as CustomEvent;
      const reason = customEvent.detail?.reason || 'unknown';
      console.warn(`🔐 Session expired: ${reason}`);
      
      // Clear user state
      setUser(null);
      setPermissions([]);
      setMustChangePassword(false);
      
      // Show session expired modal
      setSessionExpired(true);
    };

    window.addEventListener('session:expired', handleSessionExpired);
    return () => window.removeEventListener('session:expired', handleSessionExpired);
  }, []);

  // ------------------------------------------------------------------
  // Hydrate on mount — if a token exists, fetch /api/auth/me
  // ------------------------------------------------------------------
  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    // Check token validity first before making API call
    if (!checkTokenValidity()) {
      console.warn('🔐 Token expired on load - clearing');
      clearStoredToken();
      setIsLoading(false);
      setSessionExpired(true);
      return;
    }

    getMe()
      .then((data) => {
        setUser(data.user);
        setPermissions(data.permissions);
        setMustChangePassword(data.user.must_change_password);
      })
      .catch((error) => {
        // Token expired or invalid — clear it
        console.error('Failed to fetch user profile:', error);
        clearStoredToken();
        setSessionExpired(true);
      })
      .finally(() => setIsLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------------------------
  // Periodic token validity check (every 5 minutes)
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      if (!checkTokenValidity()) {
        console.warn('🔐 Token expired during session - logging out');
        clearStoredToken();
        setUser(null);
        setPermissions([]);
        setSessionExpired(true);
      }
    }, 5 * 60 * 1000); // Check every 5 minutes

    return () => clearInterval(interval);
  }, [user]);

  // ------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------
  const login = useCallback(async (email: string, password: string) => {
    const data = await apiLogin(email, password);
    setStoredToken(data.access_token);
    
    // Store refresh token if provided
    if (data.refresh_token) {
      setStoredRefreshToken(data.refresh_token);
    }
    
    setUser(data.user);
    setMustChangePassword(data.must_change_password);
    setSessionExpired(false); // Clear session expired flag on new login
    
    // Fetch full permissions from /me
    const me = await getMe();
    setPermissions(me.permissions);
    
    // Check if there's a redirect URL stored
    const redirectPath = sessionStorage.getItem('nr_redirect_after_login');
    if (redirectPath) {
      sessionStorage.removeItem('nr_redirect_after_login');
      // Redirect back to where the user was
      setTimeout(() => {
        window.location.hash = redirectPath;
      }, 100);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      clearStoredToken();
      setUser(null);
      setPermissions([]);
      setMustChangePassword(false);
    }
  }, []);

  const changePassword = useCallback(async (currentPassword: string | null, newPassword: string) => {
    await apiChangePassword(currentPassword, newPassword);
    // After successful change, update local state
    setMustChangePassword(false);
    if (user) {
      setUser({ ...user, must_change_password: false, status: 'active' });
    }
  }, [user]);

  const hasPermission = useCallback((perm: string) => permissions.includes(perm), [permissions]);

  const dismissSessionExpired = useCallback(() => {
    setSessionExpired(false);
    // Redirect to login
    window.location.hash = '';
    window.location.reload();
  }, []);

  const value = useMemo(() => ({
    user,
    permissions,
    isAuthenticated: !!user,
    isLoading,
    mustChangePassword,
    sessionExpired,
    login,
    logout,
    changePassword,
    hasPermission,
    dismissSessionExpired,
  }), [user, permissions, isLoading, mustChangePassword, sessionExpired, login, logout, changePassword, hasPermission, dismissSessionExpired]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// =============================================================================
// Hook
// =============================================================================

export function useAuth(): IAuthContext {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}
