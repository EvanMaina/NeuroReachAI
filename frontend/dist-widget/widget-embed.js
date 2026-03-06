(function(){"use strict";function f(){const e=document.querySelectorAll('script[src*="widget-embed"]'),t=e[e.length-1];let r="";if(t)try{const n=new URL(t.src);r=t.getAttribute("data-api-url")||`${n.protocol}//${n.host}`}catch(n){r=t.getAttribute("data-api-url")||""}return{apiUrl:r||window.location.origin}}const a={dk:"#1B3A4B",tl:"#1a6b5a",tl2:"#2d8a7a",wh:"#FFFFFF",tx:"#1B3A4B",mu:"#888"};function u(){if(document.querySelector("style[data-nr-card-widget]"))return;if(!document.querySelector('link[href*="Montserrat"]')){const t=document.createElement("link");t.rel="stylesheet",t.href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap",document.head.appendChild(t)}const e=document.createElement("style");e.setAttribute("data-nr-card-widget",""),e.textContent=`
    /* ============================================================
       BASE — Tier 2: Desktop/Laptop (1280-1439px) as default
       ============================================================ */
    #nr-card-widget {
      position: fixed;
      top: 160px;
      right: 120px;
      z-index: 99999;
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
      background: linear-gradient(90deg, ${a.dk}, ${a.tl}, ${a.tl2}, ${a.tl}, ${a.dk});
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
      color: ${a.tx};
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
      background: linear-gradient(135deg, ${a.tl} 0%, ${a.dk} 100%);
      box-shadow: 0 6px 20px rgba(26,107,90,0.35);
      transform: translateY(-2px);
      animation: none;
    }
    .nr-card-cta:focus-visible { outline: 3px solid ${a.tl}; outline-offset: 3px; }
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
      color: ${a.mu};
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
      #nr-card-widget { width: 280px; right: 140px; top: 160px; }
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
      #nr-card-widget { width: 240px; right: 80px; top: 155px; }
      .nr-card-body { padding: 36px 22px 32px; gap: 32px; }
      .nr-card-headline { font-size: 19px; }
      .nr-card-cta { font-size: 14px; padding: 12px 16px; }
      .nr-card-trust { font-size: 10px; }
    }

    /* ============================================================
       Tier 4: Tablet (769px - 1024px)
       ============================================================ */
    @media (min-width: 769px) and (max-width: 1024px) {
      #nr-card-widget { width: 200px; right: 40px; top: 150px; border-radius: 10px; }
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
        width: 150px;
        right: 8px;
        top: 160px;
        left: auto;
        border-radius: 10px;
        transform: translateX(30px) scale(0.95);
        transform-origin: top right;
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
        width: 130px;
        right: 6px;
        top: 150px;
        border-radius: 8px;
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
  `,document.head.appendChild(e)}function x(){return window.location.href.toLowerCase().includes("/assessment")}function b(){return window.innerWidth<=768}function h(){return window.innerWidth<=375}function w(e){const t=e.apiUrl+"/assessment?utm_source=floating_widget&utm_medium=cta",r=document.createElement("div");r.id="nr-card-widget",r.setAttribute("role","complementary"),r.setAttribute("aria-label","TMS Assessment — free 2-minute confidential check");const n=document.createElement("div");n.className="nr-card-inner";const m=document.createElement("div");m.className="nr-card-bar-top";const o=document.createElement("div");o.className="nr-card-body";const l=document.createElement("h2");l.className="nr-card-headline",l.textContent="Could TMS help me?";const i=document.createElement("a");i.className="nr-card-cta",i.href=t,i.target="_blank",i.rel="noopener noreferrer",i.setAttribute("aria-label","Take a free 2-minute TMS assessment (opens in new tab)"),i.innerHTML='<span>Take Free Assessment</span><span class="nr-card-cta-arrow">&rarr;</span>';const d=document.createElement("div");d.className="nr-card-trust",h()?d.innerHTML="<span>🔒 HIPAA</span>":b()?d.innerHTML='<span>🔒 HIPAA</span><span class="nr-card-trust-sep">&middot;</span><span>256-bit</span>':d.innerHTML='<span>🔒 Confidential</span><span class="nr-card-trust-sep">&middot;</span><span>🛡️ HIPAA</span><span class="nr-card-trust-sep">&middot;</span><span>256-bit</span>',o.appendChild(l),o.appendChild(i),o.appendChild(d);const g=document.createElement("div");g.className="nr-card-bar-bottom",n.appendChild(m),n.appendChild(o),n.appendChild(g),r.appendChild(n),document.body.appendChild(r),setTimeout(()=>{r.classList.add("nr-card-visible")},1500)}function p(){const e=document.getElementById("nr-card-widget");e&&e.remove(),["nr-banner-widget","nr-cta-wrapper","nr-cta-widget","nr-assessment-btn","nr-assessment-btn-pulse","nr-cta-tooltip","nr-cta-icon","nr-cta-text"].forEach(t=>{const r=document.getElementById(t);r&&r.remove()}),["style[data-nr-banner-widget]","style[data-nr-cta-widget]","style[data-nr-widget]"].forEach(t=>{document.querySelectorAll(t).forEach(r=>r.remove())}),document.querySelectorAll('[id^="nr-cta"],[id^="nr-assessment"]').forEach(t=>t.remove())}function y(){[500,1e3,2e3,3e3,5e3,8e3].forEach(e=>{setTimeout(()=>{try{document.querySelectorAll('[id^="nr-cta"],[id^="nr-assessment"]').forEach(t=>t.remove()),document.querySelectorAll("style[data-nr-cta-widget],style[data-nr-widget]").forEach(t=>t.remove())}catch(t){}},e)})}const v=(()=>{try{return new URLSearchParams(window.location.search).get("nr-debug")==="1"}catch(e){return!1}})(),s="[NR Widget]";function c(){if(document.getElementById("nr-card-widget"))return;if(x()){p();return}p();const e=f();u(),w(e),y(),v&&console.log(s,"v17.0.0 →",e.apiUrl+"/assessment",`screen: ${window.innerWidth}px`)}(function(){try{document.readyState==="loading"?document.addEventListener("DOMContentLoaded",()=>{try{c()}catch(e){console.error(s,e)}}):c(),window.addEventListener("popstate",()=>{setTimeout(()=>{try{x()?p():document.getElementById("nr-card-widget")||c()}catch(e){console.error(s,e)}},100)})}catch(e){console.error(s,e)}})()})();