/**
 * Premium Floating Assessment CTA Widget
 * 
 * High-converting, HIPAA-compliant floating button that navigates to the
 * TMS assessment page. Designed to be impossible to ignore yet elegant.
 * 
 * FEATURES:
 * - 64px circle (desktop) / 56px (mobile), fixed bottom-right
 * - Teal gradient with subtle pulse glow every 4 seconds
 * - Floating speech-bubble tooltip ALWAYS visible to the LEFT: "Could TMS help me?" + "2-min confidential check"
 * - Tooltip is PERMANENT — never fades, never hides, visible on every page load
 * - At 8s: one-time attention animation on both circle and tooltip
 * - Hover: pill expansion with text inside circle button
 * - Mobile: tap to expand, second tap navigates
 * - Full accessibility: aria-label, focus ring, prefers-reduced-motion
 * - HIPAA: zero data collection, no cookies, no third-party scripts, no PII
 * - UTM tracking: ?utm_source=floating_widget&utm_medium=cta
 * - Hides on assessment page (URL contains /assessment)
 * - WordPress robust: duplicate prevention, WP Rocket compatible, full-page reload safe
 * - Robust error handling: full try-catch, never crashes host page
 * - Debug mode: add ?nr-debug=1 to any URL for verbose console logging
 * 
 * @module widget-embed
 * @version 5.0.0 — Always-visible tooltip + Robust error handling + Debug mode
 */

// ========== Configuration ==========
function getScriptConfig(): { apiUrl: string } {
  const scripts = document.querySelectorAll('script[src*="widget-embed"]');
  const currentScript = scripts[scripts.length - 1] as HTMLScriptElement | null;

  let apiUrl = '';
  if (currentScript) {
    try {
      const scriptUrl = new URL(currentScript.src);
      apiUrl =
        currentScript.getAttribute('data-api-url') ||
        `${scriptUrl.protocol}//${scriptUrl.host}`;
    } catch {
      apiUrl = currentScript.getAttribute('data-api-url') || '';
    }
  }

  return {
    apiUrl: apiUrl || window.location.origin,
  };
}

// ========== Styles ==========
function injectStyles(): void {
  if (document.querySelector('style[data-nr-cta-widget]')) return;

  const style = document.createElement('style');
  style.setAttribute('data-nr-cta-widget', '');
  style.textContent = `
    /* ========================================
       Floating CTA Widget — Premium Styles
       Brand teal: #0D9488 / rgb(13,148,136)
       v4.0.0
       ======================================== */

    /* ---- Wrapper (contains tooltip + circle) ---- */
    #nr-cta-wrapper {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      display: flex;
      align-items: center;
      gap: 12px;
      pointer-events: none;
    }

    /* ---- Floating Tooltip (speech bubble to LEFT of circle) ---- */
    #nr-cta-tooltip {
      pointer-events: auto;
      position: relative;
      background: #FFFFFF;
      border-radius: 12px;
      padding: 12px 16px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.12);
      cursor: pointer;
      opacity: 1;
      transform: translateX(0);
      transition: opacity 0.4s ease, transform 0.4s ease;
      white-space: nowrap;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }

    /* Right-pointing arrow on tooltip */
    #nr-cta-tooltip::after {
      content: '';
      position: absolute;
      top: 50%;
      right: -7px;
      transform: translateY(-50%);
      width: 0;
      height: 0;
      border-top: 7px solid transparent;
      border-bottom: 7px solid transparent;
      border-left: 7px solid #FFFFFF;
      filter: drop-shadow(2px 0 1px rgba(0,0,0,0.06));
    }

    #nr-cta-tooltip-title {
      font-size: 14px;
      font-weight: 700;
      line-height: 1.3;
      color: #1a1a1a;
      margin: 0;
    }

    #nr-cta-tooltip-sub {
      font-size: 11.5px;
      font-weight: 400;
      line-height: 1.3;
      color: #666666;
      margin: 2px 0 0 0;
    }

    /* Tooltip attention flash at 8s */
    @keyframes nr-tooltip-flash {
      0%, 100% { box-shadow: 0 2px 12px rgba(0,0,0,0.12); }
      50% { box-shadow: 0 2px 20px rgba(13,148,136,0.30); }
    }

    #nr-cta-tooltip.nr-tooltip-attention {
      animation: nr-tooltip-flash 0.6s ease-in-out 2;
    }

    /* ---- Circle Button ---- */
    #nr-cta-widget {
      pointer-events: auto;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 64px;
      height: 64px;
      border-radius: 50%;
      border: none;
      padding: 0;
      flex-shrink: 0;
      background: linear-gradient(135deg, #0D9488 0%, #0F766E 50%, #0D9488 100%);
      color: #FFFFFF;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      cursor: pointer;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
      box-shadow: 0 4px 24px rgba(0,0,0,0.18);
      transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                  height 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                  border-radius 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                  background 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                  box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                  transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      will-change: transform, box-shadow, width, border-radius;
      overflow: hidden;
      text-decoration: none;
      outline: none;
      animation: nr-pulse-glow 4s ease-in-out infinite;
    }

    /* Focus ring for keyboard nav */
    #nr-cta-widget:focus-visible {
      outline: 3px solid #5EEAD4;
      outline-offset: 3px;
    }

    /* ---- Pulse Glow Animation (every 4s) ---- */
    @keyframes nr-pulse-glow {
      0%, 100% { box-shadow: 0 4px 24px rgba(0,0,0,0.18); }
      50% { box-shadow: 0 4px 32px rgba(13,148,136,0.45); }
    }

    /* ---- Attention Scale (one-time at 8s) ---- */
    @keyframes nr-attention-scale {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.12); }
    }

    #nr-cta-widget.nr-attention {
      animation: nr-attention-scale 0.6s ease-in-out 1;
    }

    /* ---- Icon container ---- */
    #nr-cta-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      width: 28px;
      height: 28px;
      transition: opacity 0.2s ease;
    }

    /* ---- Text container inside circle (hidden by default) ---- */
    #nr-cta-text {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 1px;
      opacity: 0;
      max-width: 0;
      overflow: hidden;
      white-space: nowrap;
      transition: opacity 0.25s ease 0.05s, max-width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    #nr-cta-title {
      font-size: 14.5px;
      font-weight: 700;
      line-height: 1.2;
      letter-spacing: -0.01em;
      color: #FFFFFF;
    }

    #nr-cta-sub {
      font-size: 11.5px;
      font-weight: 500;
      line-height: 1.2;
      color: rgba(255,255,255,0.78);
    }

    /* ---- Expanded (pill) state ---- */
    #nr-cta-widget.nr-expanded {
      width: auto;
      height: auto;
      min-height: 56px;
      border-radius: 28px;
      padding: 10px 22px 10px 18px;
      gap: 12px;
      background: linear-gradient(135deg, #0F9D93 0%, #0D9488 100%);
      box-shadow: 0 6px 32px rgba(13,148,136,0.35);
      animation: none;
    }

    #nr-cta-widget.nr-expanded #nr-cta-text {
      opacity: 1;
      max-width: 220px;
    }

    /* ---- Hover expansion (non-touch devices only) ---- */
    @media (hover: hover) and (pointer: fine) {
      #nr-cta-widget:hover {
        width: auto;
        height: auto;
        min-height: 56px;
        border-radius: 28px;
        padding: 10px 22px 10px 18px;
        gap: 12px;
        background: linear-gradient(135deg, #0F9D93 0%, #0D9488 100%);
        box-shadow: 0 6px 32px rgba(13,148,136,0.35);
        animation: none;
      }

      #nr-cta-widget:hover #nr-cta-text {
        opacity: 1;
        max-width: 220px;
      }
    }

    /* ---- Mobile ---- */
    @media (max-width: 640px) {
      #nr-cta-wrapper {
        bottom: 20px;
        right: 20px;
        gap: 8px;
      }

      #nr-cta-widget {
        width: 56px;
        height: 56px;
      }

      #nr-cta-icon {
        width: 24px;
        height: 24px;
      }

      #nr-cta-icon svg {
        width: 24px;
        height: 24px;
      }

      #nr-cta-widget.nr-expanded {
        min-height: 50px;
        padding: 8px 18px 8px 14px;
        gap: 10px;
      }

      #nr-cta-title {
        font-size: 13.5px;
      }

      #nr-cta-sub {
        font-size: 11px;
      }

      #nr-cta-tooltip {
        padding: 10px 14px;
      }

      #nr-cta-tooltip-title {
        font-size: 13px;
      }

      #nr-cta-tooltip-sub {
        font-size: 10.5px;
      }
    }

    /* ---- Reduced motion preference ---- */
    @media (prefers-reduced-motion: reduce) {
      #nr-cta-widget {
        animation: none !important;
        transition: background 0.1s ease, box-shadow 0.1s ease !important;
      }

      #nr-cta-widget.nr-attention {
        animation: none !important;
      }

      #nr-cta-text {
        transition: opacity 0.1s ease !important;
      }

      #nr-cta-tooltip {
        transition: opacity 0.1s ease !important;
      }

      #nr-cta-tooltip.nr-tooltip-attention {
        animation: none !important;
      }
    }
  `;
  document.head.appendChild(style);
}

// ========== Brain/Pulse SVG Icon (inline, no dependencies) ==========
function getBrainIcon(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 2a4 4 0 0 0-4 4v1a3 3 0 0 0-3 3c0 1.1.6 2.1 1.5 2.6"/>
    <path d="M12 2a4 4 0 0 1 4 4v1a3 3 0 0 1 3 3c0 1.1-.6 2.1-1.5 2.6"/>
    <path d="M6.5 12.6C5.6 13.4 5 14.6 5 16a4 4 0 0 0 4 4h1.5"/>
    <path d="M17.5 12.6c.9.8 1.5 2 1.5 3.4a4 4 0 0 1-4 4h-1.5"/>
    <path d="M12 2v20"/>
    <circle cx="12" cy="9" r="1.5" fill="currentColor" stroke="none" opacity="0.6"/>
    <circle cx="12" cy="15" r="1" fill="currentColor" stroke="none" opacity="0.4"/>
  </svg>`;
}

// ========== Assessment Page Detection ==========
function isAssessmentPage(): boolean {
  const url = window.location.href.toLowerCase();
  return url.includes('/assessment');
}

// ========== Widget Creation ==========
function createWidget(config: { apiUrl: string }): void {
  const assessmentUrl = config.apiUrl + '/assessment?utm_source=floating_widget&utm_medium=cta';

  // Detect touch device
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  // ---- Create wrapper ----
  const wrapper = document.createElement('div');
  wrapper.id = 'nr-cta-wrapper';

  // ---- Create tooltip (speech bubble to LEFT of circle) ----
  const tooltip = document.createElement('div');
  tooltip.id = 'nr-cta-tooltip';
  tooltip.innerHTML = `
    <div id="nr-cta-tooltip-title">Could TMS help me?</div>
    <div id="nr-cta-tooltip-sub">2-min confidential check</div>
  `;
  // Clicking tooltip also navigates
  tooltip.addEventListener('click', () => {
    window.open(assessmentUrl, '_blank', 'noopener,noreferrer');
  });

  // ---- Create circle button ----
  const btn = document.createElement('a');
  btn.id = 'nr-cta-widget';
  btn.href = assessmentUrl;
  btn.target = '_blank';
  btn.rel = 'noopener noreferrer';
  btn.setAttribute('aria-label', 'Take a free 2-minute TMS assessment');

  // Inner HTML: icon + text (for pill expansion)
  btn.innerHTML = `
    <span id="nr-cta-icon">${getBrainIcon()}</span>
    <span id="nr-cta-text">
      <span id="nr-cta-title">Could TMS help me?</span>
      <span id="nr-cta-sub">2-min confidential check</span>
    </span>
  `;

  // ---- Mobile tap behavior: first tap expands, second tap navigates ----
  if (isTouchDevice) {
    let isExpanded = false;
    let collapseTimer: ReturnType<typeof setTimeout> | null = null;

    btn.addEventListener('click', (e: Event) => {
      if (!isExpanded) {
        e.preventDefault();
        e.stopPropagation();
        btn.classList.add('nr-expanded');
        isExpanded = true;

        // Tooltip stays visible always — no hide/show on mobile tap

        // Auto-collapse after 4 seconds if not tapped again
        if (collapseTimer) clearTimeout(collapseTimer);
        collapseTimer = setTimeout(() => {
          btn.classList.remove('nr-expanded');
          isExpanded = false;
        }, 4000);
      }
      // If already expanded, let the default <a> navigation happen
    });

    // Collapse if user taps elsewhere
    document.addEventListener('touchstart', (e: TouchEvent) => {
      if (!wrapper.contains(e.target as Node) && isExpanded) {
        btn.classList.remove('nr-expanded');
        isExpanded = false;
        if (collapseTimer) clearTimeout(collapseTimer);
      }
    }, { passive: true });
  }

  // Assemble: tooltip (left) + circle (right)
  wrapper.appendChild(tooltip);
  wrapper.appendChild(btn);
  document.body.appendChild(wrapper);

  // Tooltip is ALWAYS visible — no hide timer, no fade-out, ever.

  // ---- One-time attention grab after 8 seconds ----
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!prefersReduced) {
    setTimeout(() => {
      // Step 1: Circle scale-up animation (0.6s)
      btn.classList.add('nr-attention');

      // Step 2: Tooltip attention flash (simultaneously)
      tooltip.classList.add('nr-tooltip-attention');

      // Step 3: After scale animation, auto-expand circle to pill
      setTimeout(() => {
        btn.classList.remove('nr-attention');
        tooltip.classList.remove('nr-tooltip-attention');
        btn.classList.add('nr-expanded');

        // Step 4: Hold expanded for 3 seconds, then collapse
        setTimeout(() => {
          // Only collapse if not being hovered (desktop)
          if (!btn.matches(':hover')) {
            btn.classList.remove('nr-expanded');
          } else {
            // If hovering, collapse when mouse leaves
            const onLeave = () => {
              btn.classList.remove('nr-expanded');
              btn.removeEventListener('mouseleave', onLeave);
            };
            btn.addEventListener('mouseleave', onLeave);
          }
        }, 3000);
      }, 650);
    }, 8000);
  }
}

// ========== Cleanup (for re-initialization) ==========
function cleanupWidget(): void {
  const existingWrapper = document.getElementById('nr-cta-wrapper');
  if (existingWrapper) {
    existingWrapper.remove();
  }

  // Also clean up legacy widget elements from v3 or earlier
  const oldWidget = document.getElementById('nr-cta-widget');
  if (oldWidget && !document.getElementById('nr-cta-wrapper')) {
    oldWidget.remove();
  }
  const oldBtn = document.getElementById('nr-assessment-btn');
  const oldPulse = document.getElementById('nr-assessment-btn-pulse');
  const oldStyle = document.querySelector('style[data-nr-widget]');
  if (oldBtn) oldBtn.remove();
  if (oldPulse) oldPulse.remove();
  if (oldStyle) oldStyle.remove();
}

// ========== Debug Mode ==========
// Add ?nr-debug=1 to any page URL to enable verbose console logging
function isDebugMode(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('nr-debug') === '1';
  } catch {
    return false;
  }
}

const NR_DEBUG = isDebugMode();
const LOG_PREFIX = '[NR Widget]';

function debugLog(...args: unknown[]): void {
  if (NR_DEBUG) {
    console.log(LOG_PREFIX, ...args);
  }
}

// ========== Initialize ==========
function initWidget(): void {
  debugLog('initWidget() called, readyState:', document.readyState);

  // Prevent double-initialization
  if (document.getElementById('nr-cta-wrapper')) {
    debugLog('Widget already present, skipping init.');
    return;
  }

  // Hide on assessment page
  const onAssessment = isAssessmentPage();
  debugLog('Checking assessment page:', onAssessment);
  if (onAssessment) {
    debugLog('Assessment page detected, widget hidden.');
    // Clean up in case widget was injected before navigation
    cleanupWidget();
    return;
  }

  // Clean up any legacy elements
  cleanupWidget();
  debugLog('Legacy cleanup done.');

  const config = getScriptConfig();
  debugLog('Config resolved, apiUrl:', config.apiUrl);

  injectStyles();
  debugLog('Styles injected.');

  createWidget(config);
  debugLog('Widget created and injected into DOM.');
  debugLog('Tooltip created (permanently visible).');
  debugLog('Attention animation scheduled for 8s.');

  console.log(LOG_PREFIX, 'v5.0.0 initialized →', config.apiUrl + '/assessment');
}

// ========== Boot ==========
// Entire boot sequence wrapped in try-catch — widget must NEVER crash the host page
(function () {
  try {
    debugLog('Script loaded on:', window.location.href);

    // Robust boot: handles DOMContentLoaded, already-loaded, and WP Rocket deferred scripts
    if (document.readyState === 'loading') {
      debugLog('DOM loading — deferring to DOMContentLoaded.');
      document.addEventListener('DOMContentLoaded', function () {
        try {
          debugLog('DOM ready (DOMContentLoaded fired).');
          initWidget();
        } catch (error) {
          console.error(LOG_PREFIX, 'Failed to initialize on DOMContentLoaded:', error);
        }
      });
    } else {
      // DOM already ready (deferred script, WP Rocket, etc.)
      debugLog('DOM already ready (readyState:', document.readyState + ').');
      initWidget();
    }

    // Handle SPA-like navigation or WordPress AJAX page transitions
    // Re-check on popstate (back/forward navigation)
    window.addEventListener('popstate', function () {
      setTimeout(function () {
        try {
          debugLog('popstate detected, re-evaluating widget visibility.');
          if (isAssessmentPage()) {
            cleanupWidget();
          } else if (!document.getElementById('nr-cta-wrapper')) {
            initWidget();
          }
        } catch (error) {
          console.error(LOG_PREFIX, 'Failed on popstate handler:', error);
        }
      }, 100);
    });

    debugLog('Boot sequence complete — popstate listener attached.');
  } catch (error) {
    console.error(LOG_PREFIX, 'Failed to initialize:', error);
  }
})();
