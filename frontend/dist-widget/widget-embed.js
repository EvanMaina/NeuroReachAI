(function(){"use strict";function m(){const e=document.querySelectorAll('script[src*="widget-embed"]'),i=e[e.length-1];let r="";if(i)try{const o=new URL(i.src);r=i.getAttribute("data-api-url")||`${o.protocol}//${o.host}`}catch(o){r=i.getAttribute("data-api-url")||""}return{apiUrl:r||window.location.origin}}function h(){if(document.querySelector("style[data-nr-cta-widget]"))return;const e=document.createElement("style");e.setAttribute("data-nr-cta-widget",""),e.textContent=`
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
  `,document.head.appendChild(e)}function x(){return`<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 2a4 4 0 0 0-4 4v1a3 3 0 0 0-3 3c0 1.1.6 2.1 1.5 2.6"/>
    <path d="M12 2a4 4 0 0 1 4 4v1a3 3 0 0 1 3 3c0 1.1-.6 2.1-1.5 2.6"/>
    <path d="M6.5 12.6C5.6 13.4 5 14.6 5 16a4 4 0 0 0 4 4h1.5"/>
    <path d="M17.5 12.6c.9.8 1.5 2 1.5 3.4a4 4 0 0 1-4 4h-1.5"/>
    <path d="M12 2v20"/>
    <circle cx="12" cy="9" r="1.5" fill="currentColor" stroke="none" opacity="0.6"/>
    <circle cx="12" cy="15" r="1" fill="currentColor" stroke="none" opacity="0.4"/>
  </svg>`}function g(){return window.location.href.toLowerCase().includes("/assessment")}function f(e){const i=e.apiUrl+"/assessment?utm_source=floating_widget&utm_medium=cta",r="ontouchstart"in window||navigator.maxTouchPoints>0,o=document.createElement("div");o.id="nr-cta-wrapper";const a=document.createElement("div");a.id="nr-cta-tooltip",a.innerHTML=`
    <div id="nr-cta-tooltip-title">Could TMS help me?</div>
    <div id="nr-cta-tooltip-sub">2-min confidential check</div>
  `,a.addEventListener("click",()=>{window.open(i,"_blank","noopener,noreferrer")});const t=document.createElement("a");if(t.id="nr-cta-widget",t.href=i,t.target="_blank",t.rel="noopener noreferrer",t.setAttribute("aria-label","Take a free 2-minute TMS assessment"),t.innerHTML=`
    <span id="nr-cta-icon">${x()}</span>
    <span id="nr-cta-text">
      <span id="nr-cta-title">Could TMS help me?</span>
      <span id="nr-cta-sub">2-min confidential check</span>
    </span>
  `,r){let s=!1,c=null;t.addEventListener("click",p=>{s||(p.preventDefault(),p.stopPropagation(),t.classList.add("nr-expanded"),s=!0,c&&clearTimeout(c),c=setTimeout(()=>{t.classList.remove("nr-expanded"),s=!1},4e3))}),document.addEventListener("touchstart",p=>{!o.contains(p.target)&&s&&(t.classList.remove("nr-expanded"),s=!1,c&&clearTimeout(c))},{passive:!0})}o.appendChild(a),o.appendChild(t),document.body.appendChild(o),window.matchMedia("(prefers-reduced-motion: reduce)").matches||setTimeout(()=>{t.classList.add("nr-attention"),a.classList.add("nr-tooltip-attention"),setTimeout(()=>{t.classList.remove("nr-attention"),a.classList.remove("nr-tooltip-attention"),t.classList.add("nr-expanded"),setTimeout(()=>{if(!t.matches(":hover"))t.classList.remove("nr-expanded");else{const s=()=>{t.classList.remove("nr-expanded"),t.removeEventListener("mouseleave",s)};t.addEventListener("mouseleave",s)}},3e3)},650)},8e3)}function l(){const e=document.getElementById("nr-cta-wrapper");e&&e.remove();const i=document.getElementById("nr-cta-widget");i&&!document.getElementById("nr-cta-wrapper")&&i.remove();const r=document.getElementById("nr-assessment-btn"),o=document.getElementById("nr-assessment-btn-pulse"),a=document.querySelector("style[data-nr-widget]");r&&r.remove(),o&&o.remove(),a&&a.remove()}function w(){try{return new URLSearchParams(window.location.search).get("nr-debug")==="1"}catch(e){return!1}}const b=w(),d="[NR Widget]";function n(...e){b&&console.log(d,...e)}function u(){if(n("initWidget() called, readyState:",document.readyState),document.getElementById("nr-cta-wrapper")){n("Widget already present, skipping init.");return}const e=g();if(n("Checking assessment page:",e),e){n("Assessment page detected, widget hidden."),l();return}l(),n("Legacy cleanup done.");const i=m();n("Config resolved, apiUrl:",i.apiUrl),h(),n("Styles injected."),f(i),n("Widget created and injected into DOM."),n("Tooltip created (permanently visible)."),n("Attention animation scheduled for 8s."),console.log(d,"v5.0.0 initialized →",i.apiUrl+"/assessment")}(function(){try{n("Script loaded on:",window.location.href),document.readyState==="loading"?(n("DOM loading — deferring to DOMContentLoaded."),document.addEventListener("DOMContentLoaded",function(){try{n("DOM ready (DOMContentLoaded fired)."),u()}catch(e){console.error(d,"Failed to initialize on DOMContentLoaded:",e)}})):(n("DOM already ready (readyState:",document.readyState+")."),u()),window.addEventListener("popstate",function(){setTimeout(function(){try{n("popstate detected, re-evaluating widget visibility."),g()?l():document.getElementById("nr-cta-wrapper")||u()}catch(e){console.error(d,"Failed on popstate handler:",e)}},100)}),n("Boot sequence complete — popstate listener attached.")}catch(e){console.error(d,"Failed to initialize:",e)}})()})();
