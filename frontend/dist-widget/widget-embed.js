(function(){"use strict";function f(){const e=document.querySelectorAll('script[src*="widget-embed"]'),t=e[e.length-1];let n="";if(t)try{const i=new URL(t.src);n=t.getAttribute("data-api-url")||`${i.protocol}//${i.host}`}catch(i){n=t.getAttribute("data-api-url")||""}return{apiUrl:n||window.location.origin}}const a={dk:"#1B3A4B",tl:"#1a6b5a",tl2:"#2d8a7a",wh:"#FFFFFF",mu:"#888"};function u(){if(document.querySelector("style[data-nr-card-widget]"))return;if(!document.querySelector('link[href*="Montserrat"]')){const t=document.createElement("link");t.rel="stylesheet",t.href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap",document.head.appendChild(t)}const e=document.createElement("style");e.setAttribute("data-nr-card-widget",""),e.textContent=`
    /* ============================================================
       BASE — Tier 2: Desktop/Laptop (1280-1439px) as default
       z-index: 99 — BELOW site navigation dropdowns
       overflow: hidden — no ghost boxes
       Tall & narrow vertical banner — stacks heading, CTA, badges
       ============================================================ */
    #nr-card-widget {
      position: fixed;
      top: 50%;
      right: 0;
      transform: translateY(-50%) translateX(60px);
      z-index: 99;
      width: 230px;
      border-radius: 14px 0 0 14px;
      overflow: hidden;
      border: 1px solid rgba(26,107,90,0.12);
      border-right: none;
      background: rgba(255,255,255,0.98);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      font-family: 'Montserrat', Arial, Helvetica, sans-serif;
      opacity: 0;
      pointer-events: none;
      box-shadow: -3px 4px 12px rgba(0,0,0,0.08), -6px 12px 28px rgba(0,0,0,0.10);
    }

    /* --- Entrance → then float --- */
    #nr-card-widget.nr-card-visible {
      opacity: 1;
      pointer-events: auto;
      animation:
        nr-entrance 0.9s cubic-bezier(0.16,1,0.3,1) both,
        nr-float 5s ease-in-out 1.2s infinite;
    }

    @keyframes nr-entrance {
      0%   { opacity: 0; transform: translateY(-50%) translateX(60px); }
      100% { opacity: 1; transform: translateY(-50%) translateX(0); }
    }

    /* --- Premium Gentle Float (like Intercom/Drift) --- */
    @keyframes nr-float {
      0%, 100% { transform: translateY(-50%) translateX(0); }
      25%  { transform: translateY(calc(-50% - 4px)) translateX(0); }
      50%  { transform: translateY(calc(-50% - 7px)) translateX(0); }
      75%  { transform: translateY(calc(-50% - 4px)) translateX(0); }
    }

    .nr-card-inner { overflow: hidden; }

    /* --- Brand Bar Color Wave --- */
    .nr-card-bar-top, .nr-card-bar-bottom {
      height: 3px;
      background: linear-gradient(90deg, ${a.dk}, ${a.tl}, ${a.tl2}, ${a.tl}, ${a.dk});
      background-size: 300% 100%;
      animation: nr-wave 6s ease-in-out infinite;
    }
    @keyframes nr-wave {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }

    /* --- Card Body (tall & narrow vertical stack) --- */
    .nr-card-body {
      padding: 28px 20px 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
    }

    /* --- Premium Gradient Bold Headline --- */
    .nr-card-headline {
      font-family: 'Montserrat', Arial, Helvetica, sans-serif;
      font-size: 20px;
      font-weight: 700;
      background: linear-gradient(135deg, ${a.dk} 0%, ${a.tl} 50%, ${a.tl2} 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      text-align: center;
      line-height: 1.35;
      letter-spacing: -0.02em;
      margin: 0;
    }

    /* --- CTA Button with breathing glow --- */
    .nr-card-cta {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      min-height: 50px;
      padding: 14px 16px;
      font-size: 15px;
      font-weight: 600;
      font-family: 'Montserrat', Arial, Helvetica, sans-serif;
      color: ${a.wh};
      background: linear-gradient(135deg, ${a.dk} 0%, ${a.tl} 100%);
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
      50% { box-shadow: 0 0 18px rgba(26,107,90,0.4), 0 0 36px rgba(26,107,90,0.08); }
    }

    /* --- CTA Shimmer --- */
    .nr-card-cta::before {
      content: '';
      position: absolute;
      top: 0; left: -100%;
      width: 100%; height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent);
      animation: nr-shimmer 4s ease-in-out infinite;
    }
    @keyframes nr-shimmer {
      0%   { left: -100%; }
      50%  { left: 100%; }
      100% { left: 100%; }
    }

    /* --- CTA Hover (desktop) --- */
    .nr-card-cta:hover {
      background: linear-gradient(135deg, ${a.tl} 0%, ${a.dk} 100%);
      box-shadow: 0 4px 16px rgba(26,107,90,0.4);
      transform: translateY(-2px);
      animation: none;
    }
    .nr-card-cta:hover::before { animation: none; left: 100%; }
    .nr-card-cta:focus-visible { outline: 3px solid ${a.tl}; outline-offset: 3px; }
    .nr-card-cta:active { transform: translateY(0); box-shadow: 0 2px 6px rgba(26,107,90,0.2); }

    /* --- Arrow Nudge --- */
    .nr-card-cta-arrow {
      font-size: 17px;
      display: inline-block;
      animation: nr-nudge 3s ease-in-out infinite;
    }
    @keyframes nr-nudge {
      0%, 70%, 100% { transform: translateX(0); }
      80% { transform: translateX(4px); }
      90% { transform: translateX(2px); }
    }

    /* --- Trust Line (vertical stack on narrow card) --- */
    .nr-card-trust {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      font-size: 10px;
      color: ${a.mu};
      letter-spacing: 0.02em;
      font-weight: 400;
      line-height: 1.4;
    }
    .nr-card-trust-sep { display: none; }

    /* --- Desktop hover glow --- */
    @media (hover: hover) and (pointer: fine) {
      #nr-card-widget:hover {
        box-shadow: -4px 6px 16px rgba(0,0,0,0.12), -8px 16px 36px rgba(0,0,0,0.14);
      }
    }

    /* ============================================================
       Tier 1: Large Desktop (≥1440px) — slightly wider
       ============================================================ */
    @media (min-width: 1440px) {
      #nr-card-widget { width: 240px; right: 0; }
      .nr-card-body { padding: 32px 22px 28px; gap: 22px; }
      .nr-card-headline { font-size: 22px; }
      .nr-card-cta { font-size: 16px; padding: 15px 18px; min-height: 52px; gap: 8px; }
      .nr-card-cta-arrow { font-size: 18px; }
      .nr-card-trust { font-size: 11px; gap: 5px; }
    }

    /* ============================================================
       Tier 3: Small Laptop (1025px - 1279px) — narrower
       ============================================================ */
    @media (min-width: 1025px) and (max-width: 1279px) {
      #nr-card-widget { width: 210px; right: 0; }
      .nr-card-body { padding: 24px 18px 22px; gap: 18px; }
      .nr-card-headline { font-size: 18px; }
      .nr-card-cta { font-size: 14px; padding: 13px 14px; min-height: 46px; gap: 6px; }
      .nr-card-cta-arrow { font-size: 16px; }
      .nr-card-trust { font-size: 9px; gap: 3px; }
    }

    /* ============================================================
       Tier 4: Tablet (769px - 1023px)
       Bottom-LEFT flush — same side as mobile for consistency
       ============================================================ */
    @media (min-width: 769px) and (max-width: 1023px) {
      #nr-card-widget {
        position: fixed;
        top: auto;
        bottom: 28px;
        right: auto;
        left: 0;
        width: 175px;
        border-radius: 0 12px 12px 0;
        border-left: none;
        border-right: 1px solid rgba(26,107,90,0.12);
        z-index: 99;
        transform: translateX(-30px);
        transform-origin: bottom left;
      }
      #nr-card-widget.nr-card-visible {
        animation:
          nr-entrance-m 0.9s cubic-bezier(0.16,1,0.3,1) both,
          nr-float-m 5s ease-in-out 1.2s infinite;
      }
      .nr-card-bar-top, .nr-card-bar-bottom { height: 2px; }
      .nr-card-body { padding: 26px 14px 22px; gap: 18px; }
      .nr-card-headline { font-size: 16.5px; line-height: 1.3; font-weight: 700; }
      .nr-card-cta { font-size: 13px; padding: 12px 14px; border-radius: 8px; min-height: 46px; font-weight: 700; gap: 5px; }
      .nr-card-cta-arrow { font-size: 15px; font-weight: 700; }
      .nr-card-trust { font-size: 8px; gap: 4px; }
      #nr-card-widget {
        box-shadow: 2px 3px 10px rgba(0,0,0,0.08), 4px 8px 20px rgba(0,0,0,0.10);
      }
    }

    /* ============================================================
       Tier 5: Mobile (376px - 768px)
       Bottom-LEFT floating badge — flush to left edge
       Larger than before, bolder headline, prominent CTA
       ============================================================ */
    @media (max-width: 768px) {
      #nr-card-widget {
        position: fixed;
        top: auto;
        bottom: 20px;
        right: auto;
        left: 0;
        width: 160px;
        border-radius: 0 12px 12px 0;
        border-left: none;
        border-right: 1px solid rgba(26,107,90,0.12);
        z-index: 99;
        transform: translateX(-30px);
        transform-origin: bottom left;
      }
      #nr-card-widget.nr-card-visible {
        animation:
          nr-entrance-m 0.9s cubic-bezier(0.16,1,0.3,1) both,
          nr-float-m 5s ease-in-out 1.2s infinite;
      }
      @keyframes nr-entrance-m {
        0% { opacity: 0; transform: translateX(-30px); }
        100% { opacity: 1; transform: translateX(0); }
      }
      @keyframes nr-float-m {
        0%, 100% { transform: translateX(0) translateY(0); }
        25% { transform: translateX(0) translateY(-3px); }
        50% { transform: translateX(0) translateY(-5px); }
        75% { transform: translateX(0) translateY(-3px); }
      }
      .nr-card-bar-top, .nr-card-bar-bottom { height: 2px; }
      .nr-card-body { padding: 22px 12px 18px; gap: 16px; }
      .nr-card-headline { font-size: 15px; line-height: 1.3; font-weight: 700; }
      .nr-card-cta {
        font-size: 12.5px; padding: 11px 12px; border-radius: 8px; min-height: 44px; gap: 5px;
        font-weight: 700;
      }
      .nr-card-cta-arrow { font-size: 14px; font-weight: 700; }
      .nr-card-trust { font-size: 7.5px; gap: 3px; }
      #nr-card-widget {
        box-shadow: 2px 3px 10px rgba(0,0,0,0.08), 4px 8px 20px rgba(0,0,0,0.10);
      }
    }

    /* ============================================================
       Tier 5b: Mid-Mobile (481px - 768px) — tablet-ish phones
       Slightly larger still for bigger phone screens
       ============================================================ */
    @media (min-width: 481px) and (max-width: 768px) {
      #nr-card-widget { width: 170px; bottom: 24px; }
      .nr-card-body { padding: 24px 14px 20px; gap: 18px; }
      .nr-card-headline { font-size: 16px; }
      .nr-card-cta { font-size: 13px; min-height: 46px; padding: 12px 14px; }
      .nr-card-cta-arrow { font-size: 15px; }
      .nr-card-trust { font-size: 8px; }
    }

    /* ============================================================
       Tier 6: Small Mobile (≤375px)
       Compact bottom-LEFT — still floating, still bold
       ============================================================ */
    @media (max-width: 375px) {
      #nr-card-widget {
        position: fixed;
        top: auto;
        bottom: 14px;
        right: auto;
        left: 0;
        width: 140px;
        border-radius: 0 10px 10px 0;
        border-left: none;
        border-right: 1px solid rgba(26,107,90,0.12);
        z-index: 99;
      }
      .nr-card-bar-top, .nr-card-bar-bottom { height: 2px; }
      .nr-card-body { padding: 18px 10px 14px; gap: 14px; }
      .nr-card-headline { font-size: 13.5px; font-weight: 700; }
      .nr-card-cta { font-size: 11.5px; padding: 10px 10px; border-radius: 7px; min-height: 42px; font-weight: 700; }
      .nr-card-cta-arrow { font-size: 13px; font-weight: 700; }
      .nr-card-trust { font-size: 7px; gap: 2px; }
    }

    /* ============================================================
       Reduced Motion — respect accessibility
       Desktop (≥1024px): widget is vertically centred with
         translateY(-50%), so we keep it.
       Mobile/Tablet (<1024px): widget is BOTTOM-ANCHORED (top:auto,
         bottom:Npx), so translateY(-50%) would push it off-screen.
         Mobile reduced-motion must only use translateX(0).
       ============================================================ */

    /* Desktop (≥1024px) — vertically centred, keep translateY(-50%) */
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
        transform: translateY(-50%) translateX(0) !important;
        pointer-events: auto;
      }
    }

    /* Tablet (769px–1023px) reduced-motion override — bottom-anchored,
       NO translateY. Must come AFTER the generic reduced-motion rule
       so it wins the specificity race. */
    @media (min-width: 769px) and (max-width: 1023px) and (prefers-reduced-motion: reduce) {
      #nr-card-widget.nr-card-visible {
        transform: translateX(0) !important;
      }
    }

    /* Mobile (≤768px) reduced-motion override — bottom-anchored,
       NO translateY.  translateX(0) is sufficient. */
    @media (max-width: 768px) and (prefers-reduced-motion: reduce) {
      #nr-card-widget.nr-card-visible {
        transform: translateX(0) !important;
      }
    }

  `,document.head.appendChild(e)}function x(){return window.location.href.toLowerCase().includes("/assessment")}function h(e){try{const t=new URLSearchParams(window.location.search),n=t.get("utm_source"),i=t.get("utm_medium"),d=t.get("utm_campaign"),o=t.get("utm_term"),s=t.get("gclid"),r=new URLSearchParams;return n?(r.set("utm_source",n),i&&r.set("utm_medium",i),d&&r.set("utm_campaign",d),o&&r.set("utm_term",o),r.set("utm_content","floating_widget")):s?(r.set("utm_source","google"),r.set("utm_medium","cpc"),r.set("utm_content","floating_widget")):(r.set("utm_source","floating_widget"),r.set("utm_medium","cta")),`${e}/assessment?${r.toString()}`}catch(t){return`${e}/assessment?utm_source=floating_widget&utm_medium=cta`}}function b(e){const t=h(e.apiUrl),n=document.createElement("div");n.id="nr-card-widget",n.setAttribute("role","complementary"),n.setAttribute("aria-label","TMS Assessment — free 2-minute confidential check");const i=document.createElement("div");i.className="nr-card-inner";const d=document.createElement("div");d.className="nr-card-bar-top";const o=document.createElement("div");o.className="nr-card-body";const s=document.createElement("h2");s.className="nr-card-headline",s.textContent="Could TMS help me?";const r=document.createElement("a");r.className="nr-card-cta",r.href=t,r.target="_blank",r.rel="noopener noreferrer",r.setAttribute("aria-label","Take a free 2-minute TMS assessment (opens in new tab)"),r.innerHTML='<span>Take Free Assessment</span><span class="nr-card-cta-arrow">&rarr;</span>';const m=document.createElement("div");m.className="nr-card-trust",m.innerHTML='<span>🔒 Confidential</span><span class="nr-card-trust-sep">&middot;</span><span>🟢 HIPAA</span><span class="nr-card-trust-sep">&middot;</span><span>🔐 256-bit</span>',o.appendChild(s),o.appendChild(r),o.appendChild(m);const g=document.createElement("div");g.className="nr-card-bar-bottom",i.appendChild(d),i.appendChild(o),i.appendChild(g),n.appendChild(i),document.body.appendChild(n),setTimeout(()=>{n.classList.add("nr-card-visible")},1500)}function p(){const e=document.getElementById("nr-card-widget");e&&e.remove(),["nr-banner-widget","nr-cta-wrapper","nr-cta-widget","nr-assessment-btn","nr-assessment-btn-pulse","nr-cta-tooltip","nr-cta-icon","nr-cta-text"].forEach(t=>{const n=document.getElementById(t);n&&n.remove()}),["style[data-nr-banner-widget]","style[data-nr-cta-widget]","style[data-nr-widget]"].forEach(t=>{document.querySelectorAll(t).forEach(n=>n.remove())}),document.querySelectorAll('[id^="nr-cta"],[id^="nr-assessment"]').forEach(t=>t.remove())}function w(){[500,1e3,2e3,3e3,5e3,8e3].forEach(e=>{setTimeout(()=>{try{document.querySelectorAll('[id^="nr-cta"],[id^="nr-assessment"]').forEach(t=>t.remove()),document.querySelectorAll("style[data-nr-cta-widget],style[data-nr-widget]").forEach(t=>t.remove())}catch(t){}},e)})}const y=(()=>{try{return new URLSearchParams(window.location.search).get("nr-debug")==="1"}catch(e){return!1}})(),c="[NR Widget]";function l(){if(document.getElementById("nr-card-widget"))return;if(x()){p();return}p();const e=f();u(),b(e),w(),y&&console.log(c,"v20.0.0 →",e.apiUrl+"/assessment",`screen: ${window.innerWidth}px`)}(function(){try{document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{try{l()}catch(e){console.error(c,e)}}):l(),window.addEventListener("popstate",()=>{setTimeout(()=>{try{x()?p():document.getElementById("nr-card-widget")||l()}catch(e){console.error(c,e)}},100)})}catch(e){console.error(c,e)}})()})();
