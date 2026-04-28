/**
 * Sidebar collapsed state.
 *
 * The collapsed flag is persisted in localStorage (`nr_sidebar_collapsed`)
 * and also reflected on <html data-sidebar-collapsed="true"> so global CSS
 * can swap the `--nr-sidebar-width` custom property in one place. Pages
 * then use `.nr-sidebar-ml` and `.nr-sidebar-w` utilities instead of the
 * hard-coded `ml-60` / `w-60` classes.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'nr_sidebar_collapsed';

interface ISidebarContext {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (value: boolean) => void;
}

const SidebarContext = createContext<ISidebarContext | undefined>(undefined);

function readInitial(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function applyAttribute(collapsed: boolean): void {
  document.documentElement.setAttribute('data-sidebar-collapsed', collapsed ? 'true' : 'false');
}

export const SidebarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [collapsed, setCollapsedState] = useState<boolean>(readInitial);

  useEffect(() => {
    applyAttribute(collapsed);
    try {
      localStorage.setItem(STORAGE_KEY, String(collapsed));
    } catch {
      // Ignore.
    }
  }, [collapsed]);

  const toggle = useCallback(() => setCollapsedState((c) => !c), []);
  const setCollapsed = useCallback((v: boolean) => setCollapsedState(v), []);

  const value = useMemo(() => ({ collapsed, toggle, setCollapsed }), [collapsed, toggle, setCollapsed]);

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
};

export function useSidebarCollapsed(): ISidebarContext {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    throw new Error('useSidebarCollapsed must be used inside <SidebarProvider>');
  }
  return ctx;
}
