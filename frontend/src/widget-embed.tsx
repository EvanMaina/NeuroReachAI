/**
 * Premium Floating Card Widget — TMS Institute of Arizona
 * v18.0.0 — 6-tier responsive, far-right edge positioning, WCAG accessible
 * 
 * Tier 1: Large Desktop ≥1440px  → 280px, right:8px
 * Tier 2: Desktop 1280-1439px    → 260px, right:8px
 * Tier 3: Small Laptop 1025-1279 → 240px, right:8px
 * Tier 4: Tablet 769-1024px      → 200px, right:8px
 * Tier 5: Mobile 376-768px       → 150px, bottom-right
 * Tier 6: Small Mobile ≤375px    → 130px, bottom-right
 * 
 * Positioned at far-right edge to avoid overlapping page content.
 * Montserrat font, glassmorphism, premium 3D float, breathing glow,
 * color wave brand bars, shadow depth pulse, arrow nudge
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
       ============================================================ */
    #nr-card-widget {
      position: fixed;
      top: 50%;
      right: 8px;
      z-index: 999;
      width: 260px;
      border-radius: 12px;
      overflow: visible;
      border: 1px solid rgba(26,107,90,0.1);
      background: rgba(255,255,255,0.97);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      font-family: 'Montserrat', Arial, Helvetica, sans-serif;
      /* entrance: hidden offscreen */
      opacity: 0;
      transform: translateX(60px) scale(0.9);
      pointer-events: none;
      /* shadow depth pulse applied after entrance */
      box-shadow: 0 4px 8px rgba(0,0,0,0.06), 0 12px 24px rgba(0,0,0,0.08), 0 24px 48px rgba(0,0,0,0.12);
    }

    /* --- Premium Entrance --- */
    #nr-card-widget.nr-card-visible {
      opacity: 1;
      transform: translateX(0) scale(1);
      pointer-events: auto;
      animation:
        nr-entrance 1s cubic-bezier(0.16,1,0.3,1) both,
        nr-float 5s ease-in-out 1.8s infinite,
        nr-shadow 4s ease-in-out 1.8s infinite;
    }

    @keyframes nr-entrance {
      0% { opacity: 0; transform: translateX(60px) scale(0.9); }
      100% { opacity: 1; transform: translateX(0) scale(1); }
    }

    /* --- Premium 3D Float --- */
    @keyframes nr-float {
      0%, 100% { transform: translateY(0px) rotate(0deg); }
      25% { transform: translateY(-5px) rotate(0.3deg); }
      50% { transform: translateY(-8px) rotate(0deg); }
      75% { transform: translateY(-5px) rotate(-0.3deg); }
    }

    /* --- Shadow Depth Pulse --- */
    @keyframes nr-shadow {
      0%, 100% { box-shadow: 0 4px 8px rgba(0,0,0,0.06), 0 12px 24px rgba(0,0,0,0.08), 0 24px 48px rgba(0,0,0,0.12); }
      50% { box-shadow: 0 6px 12px rgba(0,0,0,0.08), 0 16px 32px rgba(0,0,0,0.10), 0 32px 56px rgba(0,0,0,0.14); }
    }

    .nr-card-inner { border-radius: 12px; overflow: hidden; }

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
      padding: 40px 26px 36px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 36px;
    }

    /* --- Headline --- */
    .nr-card-headline {
      font-family: 'Montserrat', Arial, Helvetica, sans-serif;
      font-size: 20px;
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
      gap: 6px;
      width: 100%;
      min-height: 44px;
      padding: 12px 18px;
      font-size: 14px;
      font-weight: 600;
      font-family: 'Montserrat', Arial, Helvetica, sans-serif;
      color: ${C.wh};
      background: linear-gradient(135deg, ${C.dk} 0%, ${C.tl} 100%);
      border: none;
      border-radius: 8px;
      cursor: pointer;
      text-decoration: none;
      white-space: normal;
      text-align: center;
      letter-spacing: 0.02em;
      position: relative;
      overflow: hidden;
      transition: all 0.3s cubic-bezier(0.16,1,0.3,1);
      animation: nr-breathe 3s ease-in-out infinite;
    }

    /* --- CTA Breathing Glow --- */
    @keyframes nr-breathe {
      0%, 100% { box-shadow: 0 0 8px rgba(26,107,90,0.2); }
      50% { box-shadow: 0 0 20px rgba(26,107,90,0.4), 0 0 40px rgba(26,107,90,0.1); }
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
      box-shadow: 0 6px 20px rgba(26,107,90,0.35);
      transform: translateY(-2px);
      animation: none;
    }
    .nr-card-cta:focus-visible { outline: 3px solid ${C.tl}; outline-offset: 3px; }
    .nr-card-cta:active { transform: translateY(0); box-shadow: 0 2px 8px rgba(26,107,90,0.2); }

    /* --- Arrow Nudge --- */
    .nr-card-cta-arrow {
      font-size: 14px;
      animation: nr-nudge 4s ease-in-out infinite;
    }
    @keyframes nr-nudge {
      0%, 80%, 100% { transform: translateX(0); }
      90% { transform: translateX(4px); }
    }

    /* --- Trust Line --- */
    .nr-card-trust {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      flex-wrap: wrap;
      font-size: 10px;
      color: ${C.mu};
      letter-spacing: 0.02em;
      font-weight: 400;
      line-height: 1.4;
    }
    .nr-card-trust-sep { color: #ccc; }

    /* --- Desktop hover glow --- */
    @media (hover: hover) and (pointer: fine) {
      #nr-card-widget:hover {
        box-shadow: 0 8px 16px rgba(0,0,0,0.10), 0 20px 40px rgba(0,0,0,0.12), 0 36px 60px rgba(0,0,0,0.16);
      }
    }

    /* ============================================================
       Tier 1: Large Desktop (≥1440px)
       ============================================================ */
    @media (min-width: 1440px) {
      #nr-card-widget { width: 280px; right: 8px; top: 50%; }
      .nr-card-body { padding: 44px 28px 40px; gap: 40px; }
      .nr-card-headline { font-size: 22px; }
      .nr-card-cta { font-size: 15px; padding: 14px 20px; }
      .nr-card-cta-arrow { font-size: 15px; }
      .nr-card-trust { font-size: 11px; }
    }

    /* ============================================================
       Tier 3: Small Laptop (1025px - 1279px)
       ============================================================ */
    @media (min-width: 1025px) and (max-width: 1279px) {
      #nr-card-widget { width: 240px; right: 8px; top: 50%; }
      .nr-card-body { padding: 36px 22px 32px; gap: 32px; }
      .nr-card-headline { font-size: 19px; }
      .nr-card-cta { font-size: 14px; padding: 12px 16px; }
      .nr-card-trust { font-size: 10px; }
    }

    /* ============================================================
       Tier 4: Tablet (769px - 1024px)
       ============================================================ */
    @media (min-width: 769px) and (max-width: 1024px) {
      #nr-card-widget { width: 200px; right: 8px; top: 50%; border-radius: 10px; }
      .nr-card-inner { border-radius: 10px; }
      .nr-card-bar-top, .nr-card-bar-bottom { height: 2px; }
      .nr-card-body { padding: 28px 18px 24px; gap: 24px; }
      .nr-card-headline { font-size: 16px; }
      .nr-card-cta { font-size: 13px; padding: 10px 14px; border-radius: 7px; }
      .nr-card-cta-arrow { font-size: 13px; }
      .nr-card-trust { font-size: 9px; gap: 4px; }
      #nr-card-widget.nr-card-visible {
        animation:
          nr-entrance 1s cubic-bezier(0.16,1,0.3,1) both,
          nr-float 5s ease-in-out 1.8s infinite,
          nr-shadow 4s ease-in-out 1.8s infinite;
      }
    }

    /* ============================================================
       Tier 5: Mobile (376px - 768px)
       Small floating badge — non-intrusive
       ============================================================ */
    @media (max-width: 768px) {
      #nr-card-widget {
        position: fixed;
        top: auto;
        bottom: 16px;
        left: auto;
        right: 8px;
        width: 150px;
        border-radius: 10px;
        transform: translateX(30px) scale(0.95);
        transform-origin: top right;
        z-index: 999;
      }
      #nr-card-widget.nr-card-visible {
        transform: translateX(0) scale(1);
        animation:
          nr-entrance-m 1s cubic-bezier(0.16,1,0.3,1) both,
          nr-float-m 6s ease-in-out 1.8s infinite;
      }
      @keyframes nr-entrance-m {
        0% { opacity: 0; transform: translateX(30px) scale(0.95); }
        100% { opacity: 1; transform: translateX(0) scale(1); }
      }
      @keyframes nr-float-m {
        0%, 100% { transform: translateY(0px) rotate(0deg); }
        25% { transform: translateY(-3px) rotate(0.2deg); }
        50% { transform: translateY(-4px) rotate(0deg); }
        75% { transform: translateY(-3px) rotate(-0.2deg); }
      }
      .nr-card-inner { border-radius: 10px; }
      .nr-card-bar-top, .nr-card-bar-bottom { height: 2px; }
      .nr-card-body { padding: 16px 12px 14px; gap: 14px; }
      .nr-card-headline { font-size: 13px; line-height: 1.35; }
      .nr-card-cta {
        font-size: 11px; padding: 8px 10px; border-radius: 6px; min-height: 44px; gap: 4px;
        animation: nr-breathe-m 3s ease-in-out infinite;
      }
      @keyframes nr-breathe-m {
        0%, 100% { box-shadow: 0 0 4px rgba(26,107,90,0.15); }
        50% { box-shadow: 0 0 10px rgba(26,107,90,0.25), 0 0 20px rgba(26,107,90,0.05); }
      }
      .nr-card-cta-arrow { font-size: 11px; animation: nr-nudge 5s ease-in-out infinite; }
      .nr-card-trust { font-size: 8px; gap: 3px; }
      /* Mobile shadow: lighter */
      #nr-card-widget {
        box-shadow: 0 2px 4px rgba(0,0,0,0.04), 0 6px 12px rgba(0,0,0,0.06), 0 12px 24px rgba(0,0,0,0.08);
      }
    }

    /* ============================================================
       Tier 6: Small Mobile (≤375px)
       Ultra compact
       ============================================================ */
    @media (max-width: 375px) {
      #nr-card-widget {
        position: fixed;
        top: auto;
        bottom: 12px;
        left: auto;
        right: 6px;
        width: 130px;
        border-radius: 8px;
        z-index: 999;
      }
      .nr-card-inner { border-radius: 8px; }
      .nr-card-bar-top, .nr-card-bar-bottom { height: 1px; }
      .nr-card-body { padding: 14px 10px 12px; gap: 12px; }
      .nr-card-headline { font-size: 12px; }
      .nr-card-cta { font-size: 10px; padding: 7px 8px; border-radius: 5px; min-height: 44px; }
      .nr-card-cta-arrow { font-size: 10px; }
      .nr-card-trust { font-size: 7px; gap: 2px; }
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

  // Adaptive trust text based on screen size
  if (isSmallMobile()) {
    trust.innerHTML = `<span>🔒 HIPAA</span>`;
  } else if (isMobile()) {
    trust.innerHTML = `<span>🔒 HIPAA</span><span class="nr-card-trust-sep">&middot;</span><span>256-bit</span>`;
  } else {
    trust.innerHTML = `<span>🔒 Confidential</span><span class="nr-card-trust-sep">&middot;</span><span>🛡️ HIPAA</span><span class="nr-card-trust-sep">&middot;</span><span>256-bit</span>`;
  }

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
  if (NR_DEBUG) console.log(P, 'v18.0.0 →', c.apiUrl + '/assessment', `screen: ${window.innerWidth}px`);
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
