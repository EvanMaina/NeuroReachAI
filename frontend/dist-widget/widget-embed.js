(function(){"use strict";function f(){const e=document.querySelectorAll('script[src*="widget-embed"]'),t=e[e.length-1];let n="";if(t)try{const a=new URL(t.src);n=t.getAttribute("data-api-url")||`${a.protocol}//${a.host}`}catch(a){n=t.getAttribute("data-api-url")||""}return{apiUrl:n||window.location.origin}}const r={dk:"#1B3A4B",tl:"#1a6b5a",tl2:"#2d8a7a",wh:"#FFFFFF",mu:"#888"};function u(){if(document.querySelector("style[data-nr-card-widget]"))return;if(!document.querySelector('link[href*="Montserrat"]')){const t=document.createElement("link");t.rel="stylesheet",t.href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap",document.head.appendChild(t)}const e=document.createElement("style");e.setAttribute("data-nr-card-widget",""),e.textContent=`
    /* ============================================================
       BASE — Tier 2: Desktop/Laptop (1280-1439px) as default
       z-index: 99 — BELOW site navigation dropdowns
       overflow: hidden — no ghost boxes
       Premium floating + gradient headline + vertical proportion
       ============================================================ */
    #nr-card-widget {
      position: fixed;
      top: 50%;
      right: 0;
      transform: translateY(-50%) translateX(60px);
      z-index: 99;
      width: 170px;
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
      background: linear-gradient(90deg, ${r.dk}, ${r.tl}, ${r.tl2}, ${r.tl}, ${r.dk});
      background-size: 300% 100%;
      animation: nr-wave 6s ease-in-out infinite;
    }
    @keyframes nr-wave {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }

    /* --- Card Body (taller, vertical stretch) --- */
    .nr-card-body {
      padding: 28px 16px 22px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
    }

    /* --- Premium Gradient Bold Headline --- */
    .nr-card-headline {
      font-family: 'Montserrat', Arial, Helvetica, sans-serif;
      font-size: 16px;
      font-weight: 700;
      background: linear-gradient(135deg, ${r.dk} 0%, ${r.tl} 50%, ${r.tl2} 100%);
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
      gap: 5px;
      width: 100%;
      min-height: 42px;
      padding: 11px 14px;
      font-size: 12px;
      font-weight: 600;
      font-family: 'Montserrat', Arial, Helvetica, sans-serif;
      color: ${r.wh};
      background: linear-gradient(135deg, ${r.dk} 0%, ${r.tl} 100%);
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
      background: linear-gradient(135deg, ${r.tl} 0%, ${r.dk} 100%);
      box-shadow: 0 4px 16px rgba(26,107,90,0.4);
      transform: translateY(-2px);
      animation: none;
    }
    .nr-card-cta:hover::before { animation: none; left: 100%; }
    .nr-card-cta:focus-visible { outline: 3px solid ${r.tl}; outline-offset: 3px; }
    .nr-card-cta:active { transform: translateY(0); box-shadow: 0 2px 6px rgba(26,107,90,0.2); }

    /* --- Arrow Nudge --- */
    .nr-card-cta-arrow {
      font-size: 13px;
      display: inline-block;
      animation: nr-nudge 3s ease-in-out infinite;
    }
    @keyframes nr-nudge {
      0%, 70%, 100% { transform: translateX(0); }
      80% { transform: translateX(4px); }
      90% { transform: translateX(2px); }
    }

    /* --- Trust Line --- */
    .nr-card-trust {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      flex-wrap: wrap;
      font-size: 8px;
      color: ${r.mu};
      letter-spacing: 0.02em;
      font-weight: 400;
      line-height: 1.4;
    }
    .nr-card-trust-sep { color: #ccc; }

    /* --- Desktop hover glow --- */
    @media (hover: hover) and (pointer: fine) {
      #nr-card-widget:hover {
        box-shadow: -4px 6px 16px rgba(0,0,0,0.12), -8px 16px 36px rgba(0,0,0,0.14);
      }
    }

    /* ============================================================
       Tier 1: Large Desktop (≥1440px)
       ============================================================ */
    @media (min-width: 1440px) {
      #nr-card-widget { width: 180px; right: 0; }
      .nr-card-body { padding: 32px 18px 26px; gap: 22px; }
      .nr-card-headline { font-size: 17px; }
      .nr-card-cta { font-size: 13px; padding: 12px 16px; min-height: 44px; }
      .nr-card-cta-arrow { font-size: 14px; }
      .nr-card-trust { font-size: 9px; }
    }

    /* ============================================================
       Tier 3: Small Laptop (1025px - 1279px)
       ============================================================ */
    @media (min-width: 1025px) and (max-width: 1279px) {
      #nr-card-widget { width: 160px; right: 0; }
      .nr-card-body { padding: 24px 14px 20px; gap: 18px; }
      .nr-card-headline { font-size: 15px; }
      .nr-card-cta { font-size: 11px; padding: 10px 12px; }
      .nr-card-trust { font-size: 8px; }
    }

    /* ============================================================
       Tier 4: Tablet (769px - 1024px)
       ============================================================ */
    @media (min-width: 769px) and (max-width: 1024px) {
      #nr-card-widget { width: 150px; right: 0; border-radius: 12px 0 0 12px; }
      .nr-card-bar-top, .nr-card-bar-bottom { height: 2px; }
      .nr-card-body { padding: 22px 12px 18px; gap: 16px; }
      .nr-card-headline { font-size: 14px; }
      .nr-card-cta { font-size: 11px; padding: 9px 10px; border-radius: 7px; min-height: 40px; }
      .nr-card-cta-arrow { font-size: 12px; }
      .nr-card-trust { font-size: 7px; gap: 3px; }
    }

    /* ============================================================
       Tier 5: Mobile (376px - 768px)
       Bottom-right floating badge — impossible to ignore
       ============================================================ */
    @media (max-width: 768px) {
      #nr-card-widget {
        position: fixed;
        top: auto;
        bottom: 20px;
        left: auto;
        right: 0;
        width: 140px;
        border-radius: 12px 0 0 12px;
        z-index: 99;
        transform: translateX(30px);
        transform-origin: bottom right;
      }
      #nr-card-widget.nr-card-visible {
        animation:
          nr-entrance-m 0.9s cubic-bezier(0.16,1,0.3,1) both,
          nr-float-m 5s ease-in-out 1.2s infinite;
      }
      @keyframes nr-entrance-m {
        0% { opacity: 0; transform: translateX(30px); }
        100% { opacity: 1; transform: translateX(0); }
      }
      @keyframes nr-float-m {
        0%, 100% { transform: translateX(0) translateY(0); }
        25% { transform: translateX(0) translateY(-3px); }
        50% { transform: translateX(0) translateY(-5px); }
        75% { transform: translateX(0) translateY(-3px); }
      }
      .nr-card-bar-top, .nr-card-bar-bottom { height: 2px; }
      .nr-card-body { padding: 20px 10px 16px; gap: 14px; }
      .nr-card-headline { font-size: 13px; line-height: 1.35; }
      .nr-card-cta {
        font-size: 11px; padding: 9px 10px; border-radius: 7px; min-height: 40px; gap: 4px;
      }
      .nr-card-cta-arrow { font-size: 11px; }
      .nr-card-trust { font-size: 7px; gap: 3px; }
      #nr-card-widget {
        box-shadow: -2px 3px 10px rgba(0,0,0,0.08), -4px 8px 20px rgba(0,0,0,0.10);
      }
    }

    /* ============================================================
       Tier 6: Small Mobile (≤375px)
       Ultra compact bottom-right — still floating, still bold
       ============================================================ */
    @media (max-width: 375px) {
      #nr-card-widget {
        position: fixed;
        top: auto;
        bottom: 14px;
        left: auto;
        right: 0;
        width: 120px;
        border-radius: 10px 0 0 10px;
        z-index: 99;
      }
      .nr-card-bar-top, .nr-card-bar-bottom { height: 2px; }
      .nr-card-body { padding: 16px 8px 12px; gap: 12px; }
      .nr-card-headline { font-size: 12px; }
      .nr-card-cta { font-size: 10px; padding: 8px 8px; border-radius: 6px; min-height: 38px; }
      .nr-card-cta-arrow { font-size: 10px; }
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
        transform: translateY(-50%) translateX(0) !important;
        pointer-events: auto;
      }
    }
  `,document.head.appendChild(e)}function m(){return window.location.href.toLowerCase().includes("/assessment")}function h(e){const t=e.apiUrl+"/assessment?utm_source=floating_widget&utm_medium=cta",n=document.createElement("div");n.id="nr-card-widget",n.setAttribute("role","complementary"),n.setAttribute("aria-label","TMS Assessment — free 2-minute confidential check");const a=document.createElement("div");a.className="nr-card-inner";const x=document.createElement("div");x.className="nr-card-bar-top";const o=document.createElement("div");o.className="nr-card-body";const p=document.createElement("h2");p.className="nr-card-headline",p.textContent="Could TMS help me?";const i=document.createElement("a");i.className="nr-card-cta",i.href=t,i.target="_blank",i.rel="noopener noreferrer",i.setAttribute("aria-label","Take a free 2-minute TMS assessment (opens in new tab)"),i.innerHTML='<span>Take Free Assessment</span><span class="nr-card-cta-arrow">&rarr;</span>';const l=document.createElement("div");l.className="nr-card-trust",l.innerHTML='<span>🔒 Confidential</span><span class="nr-card-trust-sep">&middot;</span><span>🟢 HIPAA</span><span class="nr-card-trust-sep">&middot;</span><span>🔐 256-bit</span>',o.appendChild(p),o.appendChild(i),o.appendChild(l);const g=document.createElement("div");g.className="nr-card-bar-bottom",a.appendChild(x),a.appendChild(o),a.appendChild(g),n.appendChild(a),document.body.appendChild(n),setTimeout(()=>{n.classList.add("nr-card-visible")},1500)}function s(){const e=document.getElementById("nr-card-widget");e&&e.remove(),["nr-banner-widget","nr-cta-wrapper","nr-cta-widget","nr-assessment-btn","nr-assessment-btn-pulse","nr-cta-tooltip","nr-cta-icon","nr-cta-text"].forEach(t=>{const n=document.getElementById(t);n&&n.remove()}),["style[data-nr-banner-widget]","style[data-nr-cta-widget]","style[data-nr-widget]"].forEach(t=>{document.querySelectorAll(t).forEach(n=>n.remove())}),document.querySelectorAll('[id^="nr-cta"],[id^="nr-assessment"]').forEach(t=>t.remove())}function b(){[500,1e3,2e3,3e3,5e3,8e3].forEach(e=>{setTimeout(()=>{try{document.querySelectorAll('[id^="nr-cta"],[id^="nr-assessment"]').forEach(t=>t.remove()),document.querySelectorAll("style[data-nr-cta-widget],style[data-nr-widget]").forEach(t=>t.remove())}catch(t){}},e)})}const w=(()=>{try{return new URLSearchParams(window.location.search).get("nr-debug")==="1"}catch(e){return!1}})(),d="[NR Widget]";function c(){if(document.getElementById("nr-card-widget"))return;if(m()){s();return}s();const e=f();u(),h(e),b(),w&&console.log(d,"v19.0.0 →",e.apiUrl+"/assessment",`screen: ${window.innerWidth}px`)}(function(){try{document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{try{c()}catch(e){console.error(d,e)}}):c(),window.addEventListener("popstate",()=>{setTimeout(()=>{try{m()?s():document.getElementById("nr-card-widget")||c()}catch(e){console.error(d,e)}},100)})}catch(e){console.error(d,e)}})()})();
