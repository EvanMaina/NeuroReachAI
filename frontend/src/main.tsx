/**
 * Application entry point.
 * 
 * Initializes React application and renders root component.
 * 
 * ROUTING:
 * - /widget  → Standalone IntakeWidget (public, no auth, for iframe embedding)
 * - /*       → Full dashboard app (requires authentication)
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';

// Check if this is the standalone widget route (for iframe embedding)
const isWidgetRoute = window.location.pathname === '/widget' || window.location.pathname === '/widget/';

if (isWidgetRoute) {
  // Lazy-load the lightweight widget page (no auth, no dashboard)
  import('./pages/WidgetPage').then(({ default: WidgetPage }) => {
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <WidgetPage />
      </React.StrictMode>
    );
  });
} else {
  // Full dashboard application with authentication
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
