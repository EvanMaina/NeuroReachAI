/**
 * Per-user hidden sidebar items.
 *
 * The list lives in localStorage under `nr_hidden_nav_<userId>` and is
 * enforced client-side only — hiding an item removes it from the sidebar
 * but does NOT change backend auth. Users with the required role can still
 * type the hash URL directly (same mental model as Slack's "hide channel"
 * or Notion's "hide sidebar item"). Security is still role-gated on the API.
 *
 * Certain items are locked (can never be hidden) because navigating back to
 * them would otherwise be impossible: Dashboard and Profile.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

const KEY_PREFIX = 'nr_hidden_nav_';

export const LOCKED_NAV_ITEMS: ReadonlySet<string> = new Set(['dashboard', 'profile']);

function storageKey(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

function readInitial(userId: string | undefined | null): string[] {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s) => typeof s === 'string');
  } catch {
    return [];
  }
}

export function useHiddenNav(userId: string | undefined | null) {
  const [hidden, setHidden] = useState<string[]>(() => readInitial(userId));

  // Re-hydrate when the user changes (e.g. logout/login)
  useEffect(() => {
    setHidden(readInitial(userId));
  }, [userId]);

  // Persist on every change
  useEffect(() => {
    if (!userId) return;
    try {
      localStorage.setItem(storageKey(userId), JSON.stringify(hidden));
    } catch {
      // Quota / privacy — non-fatal.
    }
    window.dispatchEvent(new CustomEvent('nr:hidden-nav-changed', { detail: { userId } }));
  }, [hidden, userId]);

  // Cross-tab + in-tab sync
  useEffect(() => {
    if (!userId) return;
    const key = storageKey(userId);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) setHidden(readInitial(userId));
    };
    const onLocal = (e: Event) => {
      const detail = (e as CustomEvent<{ userId: string }>).detail;
      if (detail?.userId === userId) setHidden(readInitial(userId));
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('nr:hidden-nav-changed', onLocal as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('nr:hidden-nav-changed', onLocal as EventListener);
    };
  }, [userId]);

  const hiddenSet = useMemo(() => new Set(hidden), [hidden]);

  const toggle = useCallback((href: string) => {
    if (LOCKED_NAV_ITEMS.has(href)) return;
    setHidden((prev) => (prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href]));
  }, []);

  const resetAll = useCallback(() => setHidden([]), []);

  const isHidden = useCallback((href: string) => hiddenSet.has(href), [hiddenSet]);

  return { hidden, hiddenSet, toggle, resetAll, isHidden };
}
