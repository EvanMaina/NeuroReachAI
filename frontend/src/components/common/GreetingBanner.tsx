/**
 * GreetingBanner — Premium personalized greeting for NeuroReach
 *
 * Displays a time-aware greeting with the logged-in user's first name
 * and the current date. Updates dynamically when time boundaries are crossed.
 *
 * Placement: Top of every page's main content area, above page titles.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

// =============================================================================
// Helpers
// =============================================================================

type GreetingPeriod = 'morning' | 'afternoon' | 'evening';

function getGreetingPeriod(hour: number): GreetingPeriod {
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    return 'evening';
}

function getGreetingText(period: GreetingPeriod): string {
    switch (period) {
        case 'morning':
            return 'Good morning';
        case 'afternoon':
            return 'Good afternoon';
        case 'evening':
            return 'Good evening';
    }
}

function getGreetingEmoji(period: GreetingPeriod): string {
    switch (period) {
        case 'morning':
            return '☀️';
        case 'afternoon':
            return '🌤';
        case 'evening':
            return '🌆';
    }
}

function formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

// =============================================================================
// Component
// =============================================================================

export const GreetingBanner: React.FC = () => {
    const { user } = useAuth();
    const [now, setNow] = useState(() => new Date());

    // Update every 60 seconds to catch time boundary changes
    useEffect(() => {
        const interval = setInterval(() => {
            setNow(new Date());
        }, 60_000);
        return () => clearInterval(interval);
    }, []);

    const period = useMemo(() => getGreetingPeriod(now.getHours()), [now]);
    const greetingText = useMemo(() => getGreetingText(period), [period]);
    const emoji = useMemo(() => getGreetingEmoji(period), [period]);
    const dateStr = useMemo(() => formatDate(now), [now]);

    // Use first name from auth context; fallback gracefully
    const firstName = user?.first_name || 'there';

    return (
        <div className="mb-4">
            <div className="flex items-baseline gap-2">
                <h2 className="text-lg font-semibold text-gray-800  tracking-tight">
                    {greetingText}, <span className="font-bold text-gray-900 ">{firstName}</span>
                </h2>
                <span className="text-base" role="img" aria-label={period}>
                    {emoji}
                </span>
            </div>
            <p className="text-xs text-gray-400  mt-0.5 font-medium tracking-wide">
                {dateStr}
            </p>
        </div>
    );
};

export default GreetingBanner;
