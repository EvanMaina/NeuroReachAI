/**
 * Assessment Page Entry Point
 * 
 * Standalone entry that mounts the full-page AssessmentPage component.
 * Built separately from the main app and widget.
 * 
 * @module assessment-entry
 * @version 1.0.0
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { AssessmentPage } from './pages/AssessmentPage';

// Import the assessment-specific CSS
import './styles/assessment.css';

const rootEl = document.getElementById('assessment-root');

if (rootEl) {
  // ALWAYS use window.location.origin for the API base URL.
  // The assessment page is served by the same backend that handles /api/* routes,
  // so the browser's origin (which always has the correct protocol — http or https)
  // is the correct base URL. This avoids mixed-content issues when behind a
  // reverse proxy (ngrok, nginx, AWS ALB, Cloudflare) that terminates TLS,
  // because request.base_url on the backend may report http:// even when the
  // user's browser loaded the page over https://.
  const apiUrl = window.location.origin;
  const root = ReactDOM.createRoot(rootEl);
  root.render(
    <React.StrictMode>
      <AssessmentPage apiUrl={apiUrl} />
    </React.StrictMode>
  );
} else {
  console.error('[Assessment] #assessment-root element not found');
}
