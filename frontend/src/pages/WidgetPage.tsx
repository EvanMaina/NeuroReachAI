/**
 * Standalone Widget Page
 * 
 * A minimal page that renders ONLY the IntakeWidget component.
 * Designed for iframe embedding on external sites (WordPress, etc.)
 * 
 * This page:
 * - Has NO authentication requirement (public-facing)
 * - Has NO dashboard navigation or sidebar
 * - Has a clean, transparent-friendly background
 * - Supports postMessage communication with the parent window
 * - Reads UTM parameters from the URL or parent page
 * 
 * URL: /widget
 * Usage: <iframe src="https://your-frontend-domain.com/widget" />
 * 
 * @module pages/WidgetPage
 * @version 1.0.0
 */

import React, { useEffect } from 'react';
import { IntakeWidget } from '../components/widget/IntakeWidget';

const WidgetPage: React.FC = () => {
  useEffect(() => {
    // Notify parent window that widget is ready (for iframe communication)
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'NEUROREACH_WIDGET_READY' }, '*');
    }

    // Listen for messages from parent window (e.g., theme, UTM overrides)
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NEUROREACH_SET_UTM') {
        // Allow parent page to inject UTM params
        const params = new URLSearchParams(window.location.search);
        if (event.data.utm_source) params.set('utm_source', event.data.utm_source);
        if (event.data.utm_medium) params.set('utm_medium', event.data.utm_medium);
        if (event.data.utm_campaign) params.set('utm_campaign', event.data.utm_campaign);
        // Update URL without reload
        const newUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.replaceState({}, '', newUrl);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: 'transparent',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}
    >
      <IntakeWidget />
    </div>
  );
};

export default WidgetPage;
