/**
 * Theme (dark / light mode) context.
 *
 * Persists the user's preference in localStorage (`nr_theme`).
 * Applies the `dark` class on `<html>` and a `data-theme` attribute so
 * both Tailwind `dark:` utilities and plain-CSS variable overrides work.
 *
 * Falls back to the OS preference via `prefers-color-scheme` on first visit.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'nr_theme';

export type Theme = 'light' | 'dark';

interface IThemeContext {
    theme: Theme;
    toggle: () => void;
    setTheme: (theme: Theme) => void;
    isDark: boolean;
}

const ThemeContext = createContext<IThemeContext | undefined>(undefined);

function readInitialTheme(): Theme {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === 'dark' || stored === 'light') return stored;
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    } catch {
        // Ignore — default to light.
    }
    return 'light';
}

function applyTheme(theme: Theme): void {
    const root = document.documentElement;
    if (theme === 'dark') {
        root.classList.add('dark');
        root.setAttribute('data-theme', 'dark');
    } else {
        root.classList.remove('dark');
        root.setAttribute('data-theme', 'light');
    }
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setThemeState] = useState<Theme>(readInitialTheme);

    // Apply theme to DOM + persist on every change.
    useEffect(() => {
        applyTheme(theme);
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch {
            // Quota / private-browsing — ignore.
        }
    }, [theme]);

    const toggle = useCallback(() => setThemeState((t) => (t === 'light' ? 'dark' : 'light')), []);
    const setTheme = useCallback((t: Theme) => setThemeState(t), []);

    const value = useMemo(
        () => ({ theme, toggle, setTheme, isDark: theme === 'dark' }),
        [theme, toggle, setTheme],
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): IThemeContext {
    const ctx = useContext(ThemeContext);
    if (!ctx) {
        throw new Error('useTheme must be used inside <ThemeProvider>');
    }
    return ctx;
}
