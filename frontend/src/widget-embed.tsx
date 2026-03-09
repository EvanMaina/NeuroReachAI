/**
 * Premium Floating Card Widget — TMS Institute of Arizona
 * v18.1.0 — 6-tier responsive, flush-right, nav-safe z-index
 * 
 * Tier 1: Large Desktop ≥1440px  → 210px, right:0
 * Tier 2: Desktop 1280-1439px    → 200px, right:0
 * Tier 3: Small Laptop 1025-1279 → 185px, right:0
 * Tier 4: Tablet 769-1024px      → 170px, right:0
 * Tier 5: Mobile 376-768px       → 145px, bottom-right
 * Tier 6: Small Mobile ≤375px    → 125px, bottom-right
 * 
 * z-index: 99 — sits BELOW site navigation (Avada nav uses 500+)
 * overflow: hidden — prevents ghost/empty box rendering
 * Flush right edge to avoid overlapping page content.
 * 
 * @module widget-embed
 */

function getScriptConfig(): { apiUrl: string } {
  const scripts = document.querySelectorAll('script[src*="widget-embed"]');
  const s = scripts[scripts.length - 1] as HTMLScriptElement | null;
  let apiUrl = '';
  if (s) {
    try {
      const u = new URL(s.src);
      apiUrl = s.getAttribute('data-api-url') || `${u.protocol}//${u.host}`;
    } catch {
      apiUrl = s.getAttribute('data-api-url') || '';
    }
  }
  return { apiUrl: apiUrl || window.location.origin };
}

const C = {
  dk: '#1B3A4B',
  tl: '#1a6b5a',
  tl2: '#2d8a7a',
  wh: '#FFFFFF',
  tx: '#1B3A4B',
  mu: '#888',
  hv: '#15584a',
};

function injectStyles(): void {
  if (document.querySelector('style[data-nr-card-widget]')) return;
  if (!document.querySelector('link[href*="Montserrat"]')) {
    const f = document.createElement('link');
    f.rel = 'stylesheet';
    f.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap';
    document.head.appendChild(f);
  }
  const style = document.createElement('style');
  style.setAttribute('data-nr-card-widget', '');
  style.textContent = `
    /* ============================================================
       BASE — Tier 2: Desktop/Laptop (1280-1439px) as default
       z-index: 99 — BELOW site navigation dropdowns
       overflow: hidden — no ghost boxes
       ============================================================ */
    #nr-card-widget {
      position: fixed;
      top: 50%;
      right: 0;
      z-index: 99;
      width: 200px;
      border-radius: 12px 0 0 12px;
      overflow: hidden;
      border: 1px solid rgba(26,107,90,0.1);
      border-right: none;
      background: rgba(255,255,255,0.97);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      font-family: 'Montserrat', Arial, Helvetica, sans-serif;
      opacity: 0;
      transform: translateX(60px);
      pointer-events: none;
      box-shadow: -2px 2px 8px rgba(0,0,0,0.06), -4px 8px 20px rgba(0,0,0,0.08);
    }

    /* --- Entrance --- */
    #nr-card-widget.nr-card-visible {
      opacity: 1;
      transform: translateX(0);
      pointer-events: auto;
      animation: nr-entrance 0.8s cubic-bezier(0.16,1,0.3,1) both;
    }

    @keyframes nr-entrance {
      0% { opacity: 0; transform: translateX(60px); }
      100% { opacity: 1; transform: translateX(0); }
    }

    .nr-card-inner { overflow: hidden; }

    /* --- Brand Bar Color Wave --- */
    .nr-card-bar-top, .nr-card-bar-bottom {
      height: 3px;
      background: linear-gradient(90deg, ${C.dk}, ${C.tl}, ${C.tl2}, ${C.tl}, ${C.dk});
      background-size: 300% 100%;
      animation: nr-wave 6s ease-in-out infinite;
    }
    @keyframes nr-wave {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }

    /* --- Card Body --- */
    .nr-card-body {
      padding: 20px 16px 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
    }

    /* --- Headline --- */
    .nr-card-headline {
      font-family: 'Montserrat', Arial, Helvetica, sans-serif;
      font-size: 15px;
      font-weight: 300;
      color: ${C.tx};
      text-align: center;
      line-height: 1.3;
      letter-spacing: -0.01em;
      margin: 0;
    }

    /* --- CTA Button --- */
    .nr-card-cta {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      width: 100%;
      min-height: 40px;
      padding: 10px 12px;
      font-size: 12px;
      font-weight: 600;
      font-family: 'Montserrat', Arial, Helvetica, sans-serif;
      color: ${C.wh};
      background: linear-gradient(135deg, ${C.dk} 0%, ${C.tl} 100%);
      border: none;
      border-radius: 7px;
      cursor: pointer;
      text-decoration: none;
      white-space: normal;
      text-align: center;
      letter-spacing: 0.02em;
      position: relative;
      overflow: hidden;
      transition: all 0.3s cubic-bezier(0.16,1,0.3,1);
      box-shadow: 0 0 8px rgba(26,107,90,0.2);
    }

    /* --- CTA Shimmer --- */
    .nr-card-cta::before {
      content: '';
      position: absolute;
      top: 0; left: -100%;
      width: 100%; height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
      transition: left 0.5s ease;
    }
    .nr-card-cta:hover::before { left: 100%; }

    /* --- CTA Hover (desktop) --- */
    .nr-card-cta:hover {
      background: linear-gradient(135deg, ${C.tl} 0%, ${C.dk} 100%);
      box-shadow: 0 4px 14px rgba(26,107,90,0.35);
      transform: translateY(-1px);
    }
    .nr-card-cta:focus-visible { outline: 3px solid ${C.tl}; outline-offset: 3px; }
    .nr-card-cta:active { transform: translateY(0); box-shadow: 0 2px 6px rgba(26,107,90,0.2); }

    /* --- Arrow Nudge --- */
    .nr-card-cta-arrow {
      font-size: 12px;
      animation: nr-nudge 4s ease-in-out infinite;
    }
    @keyframes nr-nudge {
      0%, 80%, 100% { transform: translateX(0); }
      90% { transform: translateX(3px); }
    }

    /* --- Trust Line --- */
    .nr-card-trust {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      flex-wrap: wrap;
      font-size: 8px;
      color: ${C.mu};
      letter-spacing: 0.02em;
      font-weight: 400;
      line-height: 1.4;
    }
    .nr-card-trust-sep { color: #ccc; }

    /* --- Desktop hover glow --- */
    @media (hover: hover) and (pointer: fine) {
      #nr-card-widget:hover {
        box-shadow: -3px 4px 12px rgba(0,0,0,0.10), -6px 12px 28px rgba(0,0,0,0.12);
      }
    }

    /* ============================================================
       Tier 1: Large Desktop (≥1440px)
       ============================================================ */
    @media (min-width: 1440px) {
      #nr-card-widget { width: 210px; right: 0; top: 50%; }
      .nr-card-body { padding: 24px 18px 18px; gap: 16px; }
      .nr-card-headline { font-size: 16px; }
      .nr-card-cta { font-size: 13px; padding: 11px 14px; }
      .nr-card-cta-arrow { font-size: 13px; }
      .nr-card-trust { font-size: 9px; }
    }

    /* ============================================================
       Tier 3: Small Laptop (1025px - 1279px)
       ============================================================ */
    @media (min-width: 1025px) and (max-width: 1279px) {
      #nr-card-widget { width: 185px; right: 0; top: 50%; }
      .nr-card-body { padding: 18px 14px 14px; gap: 12px; }
      .nr-card-headline { font-size: 14px; }
      .nr-card-cta { font-size: 11px; padding: 9px 10px; }
      .nr-card-trust { font-size: 8px; }
    }

    /* ============================================================
       Tier 4: Tablet (769px - 1024px)
       ============================================================ */
    @media (min-width: 769px) and (max-width: 1024px) {
      #nr-card-widget { width: 170px; right: 0; top: 50%; border-radius: 10px 0 0 10px; }
      .nr-card-bar-top, .nr-card-bar-bottom { height: 2px; }
      .nr-card-body { padding: 16px 12px 12px; gap: 10px; }
      .nr-card-headline { font-size: 13px; }
      .nr-card-cta { font-size: 11px; padding: 8px 10px; border-radius: 6px; min-height: 38px; }
      .nr-card-cta-arrow { font-size: 11px; }
      .nr-card-trust { font-size: 7px; gap: 3px; }
    }

    /* ============================================================
       Tier 5: Mobile (376px - 768px)
       Bottom-right floating badge
       ============================================================ */
    @media (max-width: 768px) {
      #nr-card-widget {
        position: fixed;
        top: auto;
        bottom: 16px;
        left: auto;
        right: 0;
        width: 145px;
        border-radius: 10px 0 0 10px;
        transform: translateX(30px);
        transform-origin: top right;
        z-index: 99;
      }
      #nr-card-widget.nr-card-visible {
        transform: translateX(0);
        animation: nr-entrance-m 0.8s cubic-bezier(0.16,1,0.3,1) both;
      }
      @keyframes nr-entrance-m {
        0% { opacity: 0; transform: translateX(30px); }
        100% { opacity: 1; transform: translateX(0); }
      }
      .nr-card-bar-top, .nr-card-bar-bottom { height: 2px; }
      .nr-card-body { padding: 14px 10px 10px; gap: 10px; }
      .nr-card-headline { font-size: 12px; line-height: 1.35; }
      .nr-card-cta {
        font-size: 10px; padding: 8px 8px; border-radius: 6px; min-height: 38px; gap: 4px;
      }
      .nr-card-cta-arrow { font-size: 10px; }
      .nr-card-trust { font-size: 7px; gap: 3px; }
      #nr-card-widget {
        box-shadow: -2px 2px 6px rgba(0,0,0,0.06), -3px 6px 14px rgba(0,0,0,0.08);
      }
    }

    /* ============================================================
       Tier 6: Small Mobile (≤375px)
       Ultra compact bottom-right
       ============================================================ */
    @media (max-width: 375px) {
      #nr-card-widget {
        position: fixed;
        top: auto;
        bottom: 12px;
        left: auto;
        right: 0;
        width: 125px;
        border-radius: 8px 0 0 8px;
        z-index: 99;
      }
      .nr-card-bar-top, .nr-card-bar-bottom { height: 1px; }
      .nr-card-body { padding: 12px 8px 8px; gap: 8px; }
      .nr-card-headline { font-size: 11px; }
      .nr-card-cta { font-size: 9px; padding: 7px 6px; border-radius: 5px; min-height: 36px; }
      .nr-card-cta-arrow { font-size: 9px; }
      .nr-card-trust { font-size: 6px; gap: 2px; }
    }

    /* ============================================================
       Reduced Motion — respect accessibility
       ============================================================ */
    @media (prefers-reduced-motion: reduce) {
      #nr-card-widget,
      #nr-card-widget *,
      #nr-card-widget::before,
      #nr-card-widget *::before {
        animation: none !important;
        transition: none !important;
      }
      #nr-card-widget.nr-card-visible {
        opacity: 1;
        transform: none !important;
        pointer-events: auto;
      }
    }
  `;
  document.head.appendChild(style);
}

function isAssessmentPage(): boolean {
  return window.location.href.toLowerCase().includes('/assessment');
}

function isMobile(): boolean {
  return window.innerWidth <= 768;
}

function isSmallMobile(): boolean {
  return window.innerWidth <= 375;
}

function createWidget(config: { apiUrl: string }): void {
  const url = config.apiUrl + '/assessment?utm_source=floating_widget&utm_medium=cta';

  const card = document.createElement('div');
  card.id = 'nr-card-widget';
  card.setAttribute('role', 'complementary');
  card.setAttribute('aria-label', 'TMS Assessment — free 2-minute confidential check');

  const inner = document.createElement('div');
  inner.className = 'nr-card-inner';

  const barTop = document.createElement('div');
  barTop.className = 'nr-card-bar-top';

  const body = document.createElement('div');
  body.className = 'nr-card-body';

  const headline = document.createElement('h2');
  headline.className = 'nr-card-headline';
  headline.textContent = 'Could TMS help me?';

  const cta = document.createElement('a');
  cta.className = 'nr-card-cta';
  cta.href = url;
  cta.target = '_blank';
  cta.rel = 'noopener noreferrer';
  cta.setAttribute('aria-label', 'Take a free 2-minute TMS assessment (opens in new tab)');
  cta.innerHTML = `<span>Take Free Assessment</span><span class="nr-card-cta-arrow">&rarr;</span>`;

  const trust = document.createElement('div');
  trust.className = 'nr-card-trust';

  // Always show all trust badges on all screen sizes
  trust.innerHTML = `<span>🔒 Confidential</span><span class="nr-card-trust-sep">&middot;</span><span>🟢 HIPAA</span><span class="nr-card-trust-sep">&middot;</span><span>🔐 256-bit</span>`;

  body.appendChild(headline);
  body.appendChild(cta);
  body.appendChild(trust);

  const barBottom = document.createElement('div');
  barBottom.className = 'nr-card-bar-bottom';

  inner.appendChild(barTop);
  inner.appendChild(body);
  inner.appendChild(barBottom);
  card.appendChild(inner);
  document.body.appendChild(card);

  // Trigger entrance after 1.5s delay
  setTimeout(() => {
    card.classList.add('nr-card-visible');
  }, 1500);
}

function cleanupWidget(): void {
  const e = document.getElementById('nr-card-widget');
  if (e) e.remove();
  // Clean up any legacy widget elements
  ['nr-banner-widget', 'nr-cta-wrapper', 'nr-cta-widget', 'nr-assessment-btn',
   'nr-assessment-btn-pulse', 'nr-cta-tooltip', 'nr-cta-icon', 'nr-cta-text'
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });
  ['style[data-nr-banner-widget]', 'style[data-nr-cta-widget]', 'style[data-nr-widget]'
  ].forEach(s => {
    document.querySelectorAll(s).forEach(el => el.remove());
  });
  document.querySelectorAll('[id^="nr-cta"],[id^="nr-assessment"]').forEach(el => el.remove());
}

function scheduleCleanup(): void {
  [500, 1000, 2000, 3000, 5000, 8000].forEach(d => {
    setTimeout(() => {
      try {
        document.querySelectorAll('[id^="nr-cta"],[id^="nr-assessment"]').forEach(el => el.remove());
        document.querySelectorAll('style[data-nr-cta-widget],style[data-nr-widget]').forEach(el => el.remove());
      } catch {}
    }, d);
  });
}

const NR_DEBUG = (() => {
  try { return new URLSearchParams(window.location.search).get('nr-debug') === '1'; }
  catch { return false; }
})();
const P = '[NR Widget]';

function initWidget(): void {
  if (document.getElementById('nr-card-widget')) return;
  if (isAssessmentPage()) { cleanupWidget(); return; }
  cleanupWidget();
  const c = getScriptConfig();
  injectStyles();
  createWidget(c);
  scheduleCleanup();
  if (NR_DEBUG) console.log(P, 'v18.1.0 →', c.apiUrl + '/assessment', `screen: ${window.innerWidth}px`);
}

(function () {
  try {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        try { initWidget(); } catch (e) { console.error(P, e); }
      });
    } else {
      initWidget();
    }
    window.addEventListener('popstate', () => {
      setTimeout(() => {
        try {
          if (isAssessmentPage()) cleanupWidget();
          else if (!document.getElementById('nr-card-widget')) initWidget();
        } catch (e) { console.error(P, e); }
      }, 100);
    });
  } catch (e) { console.error(P, e); }
})();
