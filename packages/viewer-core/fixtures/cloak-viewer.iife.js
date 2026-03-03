"use strict";var CloakViewer=(()=>{var f=Object.defineProperty;var T=Object.getOwnPropertyDescriptor;var R=Object.getOwnPropertyNames;var L=Object.prototype.hasOwnProperty;var O=(a,e)=>{for(var t in e)f(a,t,{get:e[t],enumerable:!0})},z=(a,e,t,r)=>{if(e&&typeof e=="object"||typeof e=="function")for(let i of R(e))!L.call(a,i)&&i!==t&&f(a,i,{get:()=>e[i],enumerable:!(r=T(e,i))||r.enumerable});return a};var A=a=>z(f({},"__esModule",{value:!0}),a);var Q={};O(Q,{CloakViewerElement:()=>g});var w=`
:host {
  display: block;
  position: relative;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  color: #fafafa;
  box-sizing: border-box;
  overflow: hidden;
  background: #09090b;
  border-radius: 8px;
  border: 1px solid #1a1a1d;
}

:host *,
:host *::before,
:host *::after {
  box-sizing: border-box;
}

/* \u2500\u2500 Screens \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

.screen {
  display: none;
  width: 100%;
  height: 100%;
  position: absolute;
  inset: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.screen.active {
  display: flex;
}

/* \u2500\u2500 Loading \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

.screen-loading {
  gap: 12px;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #27272a;
  border-top-color: #00ff88;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-size: 13px;
  color: #71717a;
}

/* \u2500\u2500 Error \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

.screen-error {
  gap: 8px;
  padding: 24px;
  text-align: center;
}

.error-icon {
  font-size: 32px;
  margin-bottom: 4px;
}

.error-title {
  font-size: 15px;
  font-weight: 600;
  color: #fafafa;
}

.error-message {
  font-size: 13px;
  color: #71717a;
  max-width: 320px;
}

/* \u2500\u2500 Email / Password Gate \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

.screen-gate {
  gap: 16px;
  padding: 32px;
}

.gate-card {
  background: #111113;
  border: 1px solid #27272a;
  border-radius: 12px;
  padding: 32px;
  max-width: 380px;
  width: 100%;
  text-align: center;
}

.gate-icon {
  width: 48px;
  height: 48px;
  margin: 0 auto 16px;
  background: #1a1a1d;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.gate-icon svg {
  width: 24px;
  height: 24px;
  color: #00ff88;
}

.gate-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 4px;
}

.gate-subtitle {
  font-size: 13px;
  color: #71717a;
  margin-bottom: 20px;
}

.gate-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.gate-input {
  width: 100%;
  padding: 10px 14px;
  background: #09090b;
  border: 1px solid #27272a;
  border-radius: 8px;
  color: #fafafa;
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s;
}

.gate-input:focus {
  border-color: #00ff88;
}

.gate-input::placeholder {
  color: #52525b;
}

.gate-submit {
  width: 100%;
  padding: 10px 14px;
  background: #00ff88;
  color: #09090b;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.gate-submit:hover {
  opacity: 0.9;
}

.gate-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.gate-error {
  font-size: 13px;
  color: #ef4444;
  display: none;
}

.gate-error.visible {
  display: block;
}

/* \u2500\u2500 Viewer \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

.screen-viewer {
  flex-direction: column;
  align-items: stretch;
}

.viewer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 44px;
  padding: 0 12px;
  background: #111113;
  border-bottom: 1px solid #1a1a1d;
  flex-shrink: 0;
  z-index: 10;
}

.viewer-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nav-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: 1px solid #27272a;
  border-radius: 6px;
  color: #a1a1aa;
  cursor: pointer;
  transition: all 0.15s;
  padding: 0;
}

.nav-btn:hover:not(:disabled) {
  background: #1a1a1d;
  color: #fafafa;
  border-color: #3f3f46;
}

.nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.nav-btn svg {
  width: 16px;
  height: 16px;
}

.page-indicator {
  font-size: 13px;
  color: #71717a;
  font-variant-numeric: tabular-nums;
  min-width: 60px;
  text-align: center;
}

.viewer-title {
  font-size: 13px;
  color: #a1a1aa;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}

.viewer-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 24px;
  position: relative;
}

.canvas-container {
  position: relative;
  display: flex;
  justify-content: center;
  will-change: transform;
  touch-action: pan-y;
}

.viewer-canvas {
  display: block;
  max-width: 100%;
  user-select: none;
  -webkit-user-select: none;
}

/* \u2500\u2500 Watermark Overlay \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

.watermark-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 5;
}

/* \u2500\u2500 Branding Badge \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

.branding-badge {
  position: absolute;
  bottom: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: rgba(9, 9, 11, 0.85);
  backdrop-filter: blur(8px);
  border: 1px solid #27272a;
  border-radius: 6px;
  font-size: 11px;
  color: #71717a;
  z-index: 20;
  text-decoration: none;
  transition: color 0.15s;
}

.branding-badge:hover {
  color: #a1a1aa;
}

.branding-badge svg {
  width: 12px;
  height: 12px;
  color: #00ff88;
}

/* \u2500\u2500 Print Protection \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

@media print {
  :host {
    display: none !important;
  }
}

/* \u2500\u2500 Mobile Responsive \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

@media (max-width: 640px) {
  .viewer-header {
    height: 40px;
    padding: 0 8px;
  }

  .viewer-title {
    display: none;
  }

  .viewer-body {
    padding: 12px;
  }

  .gate-card {
    padding: 24px 20px;
  }

  .nav-btn {
    width: 28px;
    height: 28px;
  }
}

/* \u2500\u2500 Light Theme \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

:host([theme="light"]) {
  background: #ffffff;
  color: #09090b;
  border-color: #e4e4e7;
}

:host([theme="light"]) .spinner {
  border-color: #e4e4e7;
  border-top-color: #059669;
}

:host([theme="light"]) .loading-text {
  color: #71717a;
}

:host([theme="light"]) .error-title {
  color: #09090b;
}

:host([theme="light"]) .error-message {
  color: #71717a;
}

:host([theme="light"]) .gate-card {
  background: #fafafa;
  border-color: #e4e4e7;
}

:host([theme="light"]) .gate-icon {
  background: #f4f4f5;
}

:host([theme="light"]) .gate-icon svg {
  color: #059669;
}

:host([theme="light"]) .gate-title {
  color: #09090b;
}

:host([theme="light"]) .gate-subtitle {
  color: #71717a;
}

:host([theme="light"]) .gate-input {
  background: #ffffff;
  border-color: #d4d4d8;
  color: #09090b;
}

:host([theme="light"]) .gate-input:focus {
  border-color: #059669;
}

:host([theme="light"]) .gate-input::placeholder {
  color: #a1a1aa;
}

:host([theme="light"]) .gate-submit {
  background: #059669;
  color: #ffffff;
}

:host([theme="light"]) .gate-error {
  color: #dc2626;
}

:host([theme="light"]) .viewer-header {
  background: #fafafa;
  border-bottom-color: #e4e4e7;
}

:host([theme="light"]) .nav-btn {
  border-color: #d4d4d8;
  color: #71717a;
}

:host([theme="light"]) .nav-btn:hover:not(:disabled) {
  background: #f4f4f5;
  color: #09090b;
  border-color: #a1a1aa;
}

:host([theme="light"]) .page-indicator {
  color: #71717a;
}

:host([theme="light"]) .viewer-title {
  color: #71717a;
}

:host([theme="light"]) .viewer-body {
  background: #f4f4f5;
}

:host([theme="light"]) .branding-badge {
  background: rgba(255, 255, 255, 0.9);
  border-color: #e4e4e7;
  color: #71717a;
}

:host([theme="light"]) .branding-badge:hover {
  color: #52525b;
}

:host([theme="light"]) .branding-badge svg {
  color: #059669;
}

/* \u2500\u2500 Reduced Motion \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation-duration: 4s;
  }

  *, *::before, *::after {
    transition-duration: 0.01ms !important;
  }
}
`;function D(a){let e=a.toLowerCase().split("?")[0].split("#")[0];return e.endsWith(".pdf")?"pdf":/\.(png|jpe?g|webp|gif|bmp|svg)$/.test(e)?"image":"unsupported"}function b(a){let e=a.toLowerCase().split("?")[0].split("#")[0];return/\.(docx?|pptx?|xlsx?|odt|odp|rtf|mp4|mov|webm)$/.test(e)}async function I(a){let e=await M(a);return{format:"image",pages:[{pageNum:1,width:e.naturalWidth,height:e.naturalHeight,render:(t,r,i)=>{let s=e.naturalWidth*r,o=e.naturalHeight*r;t.drawImage(e,0,0,s,o)}}]}}function M(a){return new Promise((e,t)=>{let r=new Image;r.crossOrigin="anonymous",r.onload=()=>e(r),r.onerror=()=>t(new Error(`Failed to load image: ${a}`)),r.src=a})}async function j(a,e){let t=await B(e);if(!t)throw Object.assign(new Error("PDF.js could not be loaded"),{code:"RENDER_ERROR"});let i=await t.getDocument(a).promise,s=i.numPages,o=[];for(let n=1;n<=s;n++){let l=await i.getPage(n),d=l.getViewport({scale:1});o.push({pageNum:n,width:d.width,height:d.height,render:(h,c,m)=>{let u=l.getViewport({scale:c*m});return l.render({canvasContext:h,viewport:u}).promise}})}return{format:"pdf",pages:o}}var p=null;async function B(a){if(p)return p;let e=window;if(e.pdfjsLib)return p=e.pdfjsLib,p;if(a)throw Object.assign(new Error('renderer="external" requires PDF.js to be loaded globally (window.pdfjsLib)'),{code:"RENDER_ERROR"});try{let r=await new Function("s","return import(s)")("pdfjs-dist");return r.GlobalWorkerOptions.workerSrc=`https://cdn.jsdelivr.net/npm/pdfjs-dist@${r.version}/build/pdf.worker.min.mjs`,p=r,p}catch{return _()}}function _(){return new Promise((a,e)=>{if(window.pdfjsLib){p=window.pdfjsLib,a(p);return}let t=document.createElement("script");t.src="https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs",t.type="module",t.onload=()=>{let r=window.pdfjsLib;r?(r.GlobalWorkerOptions.workerSrc="https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs",p=r,a(r)):e(new Error("PDF.js loaded but pdfjsLib not found on window"))},t.onerror=()=>e(new Error("Failed to load PDF.js from CDN")),document.head.appendChild(t)})}async function x(a,e){switch(D(a)){case"pdf":return j(a,e);case"image":return I(a);case"unsupported":throw Object.assign(new Error("Unsupported format. Use apiKey for Office docs and video."),{code:"UNSUPPORTED_FORMAT"})}}var H="14px monospace",N="rgba(128, 128, 128, 0.12)",Y=-30*Math.PI/180,q=350,X=120;function y(a,e,t){let r=new Date,i=`${r.getFullYear()}-${String(r.getMonth()+1).padStart(2,"0")}-${String(r.getDate()).padStart(2,"0")}`;return a.replace(/\{\{email\}\}/g,e||"anonymous").replace(/\{\{date\}\}/g,i).replace(/\{\{session_id\}\}/g,t||"local")}function W(a,e,t,r){if(!r)return;a.save(),a.font=H,a.fillStyle=N,a.textAlign="center",a.textBaseline="middle",a.translate(e/2,t/2),a.rotate(Y),a.translate(-e/2,-t/2);let i=t,s=e;for(let o=-s;o<t+s;o+=X)for(let n=-i;n<e+i;n+=q)a.fillText(r,n,o);a.restore()}function E(){let a=document.createElement("canvas");return a.className="watermark-overlay",a.setAttribute("aria-hidden","true"),a}function k(a,e,t){let r=window.devicePixelRatio||1,i=e.getBoundingClientRect();a.style.width=`${i.width}px`,a.style.height=`${i.height}px`,a.width=i.width*r,a.height=i.height*r;let s=a.getContext("2d");s&&(s.scale(r,r),s.clearRect(0,0,i.width,i.height),W(s,i.width,i.height,t))}var F='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',V='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',U='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',G='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',Z=["src","watermark","email-gate","password","email","theme","allow-download","expires","api-key","api-url","renderer","branding","width","height"];function K(){return`s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`}function J(){let a=navigator.userAgent;return/Tablet|iPad/i.test(a)?"tablet":/Mobile|iPhone|Android/i.test(a)?"mobile":"desktop"}var $="cloakshare:email";function P(){try{return localStorage.getItem($)}catch{return null}}function v(a){try{localStorage.setItem($,a)}catch{}}var g=class extends HTMLElement{static get observedAttributes(){return[...Z]}shadow;pages=[];currentPage=1;totalPages=0;sessionId=K();viewerEmail=null;pageStartTime=0;pageTimes={};totalDuration=0;format="";initialized=!1;$loading;$error;$gate;$viewer;$canvas;$watermarkCanvas;$pageIndicator;$prevBtn;$nextBtn;$gateEmail;$gatePassword;$gateError;$gateSubmit;$brandingBadge;$canvasContainer;$viewerBody;constructor(){super(),this.shadow=this.attachShadow({mode:"open"}),this.buildDOM()}connectedCallback(){this.initialized||(this.applySize(),this.setupProtections(),this.setupKeyboardNav(),this.setupSwipe(),this.setupResizeObserver(),this.initialized=!0),this.load()}disconnectedCallback(){this.trackPageTime()}attributeChangedCallback(e,t,r){t!==r&&((e==="width"||e==="height")&&this.applySize(),e==="src"&&this.initialized&&this.load(),e==="watermark"&&this.initialized&&this.renderWatermark(),e==="branding"&&this.updateBranding())}buildDOM(){let e=document.createElement("style");e.textContent=w;let t=document.createElement("div");t.setAttribute("role","document"),t.setAttribute("aria-label","Document viewer"),t.style.cssText="width:100%;height:100%;position:relative;",t.innerHTML=`
      <!-- Loading -->
      <div class="screen screen-loading active" role="status">
        <div class="spinner" aria-hidden="true"></div>
        <div class="loading-text">Loading document...</div>
      </div>

      <!-- Error -->
      <div class="screen screen-error" role="alert">
        <div class="error-icon" aria-hidden="true">!</div>
        <div class="error-title">Unable to load document</div>
        <div class="error-message"></div>
      </div>

      <!-- Gate -->
      <div class="screen screen-gate">
        <div class="gate-card">
          <div class="gate-icon">${F}</div>
          <div class="gate-title">Enter your details to view</div>
          <div class="gate-subtitle">This document requires verification.</div>
          <form class="gate-form" autocomplete="off">
            <input class="gate-input gate-email" type="email" placeholder="your@email.com" aria-label="Email address" autocomplete="email" />
            <input class="gate-input gate-password" type="password" placeholder="Password" aria-label="Password" style="display:none" />
            <div class="gate-error" role="alert"></div>
            <button type="submit" class="gate-submit">Continue</button>
          </form>
        </div>
      </div>

      <!-- Viewer -->
      <div class="screen screen-viewer">
        <div class="viewer-header">
          <nav class="viewer-nav" aria-label="Page navigation">
            <button class="nav-btn prev-btn" aria-label="Previous page" disabled>${V}</button>
            <span class="page-indicator" aria-live="polite">1 / 1</span>
            <button class="nav-btn next-btn" aria-label="Next page" disabled>${U}</button>
          </nav>
          <span class="viewer-title"></span>
        </div>
        <div class="viewer-body" tabindex="0">
          <div class="canvas-container">
            <canvas class="viewer-canvas"></canvas>
          </div>
        </div>
        <a class="branding-badge" href="https://cloakshare.dev" target="_blank" rel="noopener" aria-label="Secured by CloakShare">
          ${G}
          <span>Secured by CloakShare</span>
        </a>
      </div>
    `,this.shadow.appendChild(e),this.shadow.appendChild(t),this.$loading=this.shadow.querySelector(".screen-loading"),this.$error=this.shadow.querySelector(".screen-error"),this.$gate=this.shadow.querySelector(".screen-gate"),this.$viewer=this.shadow.querySelector(".screen-viewer"),this.$canvas=this.shadow.querySelector(".viewer-canvas"),this.$canvasContainer=this.shadow.querySelector(".canvas-container"),this.$viewerBody=this.shadow.querySelector(".viewer-body"),this.$pageIndicator=this.shadow.querySelector(".page-indicator"),this.$prevBtn=this.shadow.querySelector(".prev-btn"),this.$nextBtn=this.shadow.querySelector(".next-btn"),this.$gateEmail=this.shadow.querySelector(".gate-email"),this.$gatePassword=this.shadow.querySelector(".gate-password"),this.$gateError=this.shadow.querySelector(".gate-error"),this.$gateSubmit=this.shadow.querySelector(".gate-submit"),this.$brandingBadge=this.shadow.querySelector(".branding-badge"),this.$watermarkCanvas=E(),this.$canvasContainer.appendChild(this.$watermarkCanvas),this.$prevBtn.addEventListener("click",()=>this.goToPage(this.currentPage-1)),this.$nextBtn.addEventListener("click",()=>this.goToPage(this.currentPage+1)),this.shadow.querySelector(".gate-form").addEventListener("submit",i=>{i.preventDefault(),this.handleGateSubmit()})}showScreen(e){for(let t of this.shadow.querySelectorAll(".screen"))t.classList.remove("active");e.classList.add("active")}showError(e,t,r){let i=this.$error.querySelector(".error-title"),s=this.$error.querySelector(".error-message");i.textContent=t,s.textContent=r||"",this.showScreen(this.$error),this.dispatchEvent(new CustomEvent("cloak:error",{detail:{code:e,message:t,details:r},bubbles:!0,composed:!0}))}applySize(){let e=this.getAttribute("width")||"100%",t=this.getAttribute("height")||"600px";this.style.width=e,this.style.height=t}updateBranding(){let e=this.getAttribute("branding")!=="false";this.$brandingBadge.style.display=e?"flex":"none"}async load(){let e=this.getAttribute("src");if(!e)return;this.showScreen(this.$loading),this.updateBranding();let t=this.getAttribute("expires");if(t){let n=new Date(t).getTime();if(await this.getServerTime()>n){this.showError("EXPIRED","This document has expired");return}}if(b(e)&&!this.getAttribute("api-key")){this.showError("UNSUPPORTED_FORMAT","This format requires an API key","Office documents and video require server-side processing. Add an api-key attribute to enable.");return}let r=this.getAttribute("api-key");if(r){await this.loadFromApi(e,r);return}let i=this.getAttribute("email-gate")!==null,s=!!this.getAttribute("password"),o=this.getAttribute("email");if(o)this.viewerEmail=o,v(o);else if(i){let n=P();n&&(this.viewerEmail=n)}if(i&&!this.viewerEmail||s){this.setupGate(i&&!this.viewerEmail,s);return}await this.renderDocument(e)}async getServerTime(){try{let e=this.getAttribute("api-url")||"https://api.cloakshare.dev",t=await fetch(`${e}/v1/time`,{signal:AbortSignal.timeout(3e3)});if(t.ok){let r=await t.json();return new Date(r.timestamp||r.data?.timestamp).getTime()}}catch{}return Date.now()}apiSessionToken=null;async loadFromApi(e,t){let r=this.getAttribute("api-url")||"https://api.cloakshare.dev";try{let i=await fetch(`${r}/v1/viewer/${encodeURIComponent(e)}`,{headers:{Authorization:`Bearer ${t}`}});if(!i.ok){let d=await i.json().catch(()=>({})),h=i.status===401?"API_UNAUTHORIZED":"API_ERROR";this.showError(h,d?.error?.message||`API error (${i.status})`);return}let s=(await i.json()).data;if(s.status==="processing"){this.showError("API_ERROR","Document is still processing. Please try again in a moment.");return}let o=s.require_email,n=s.has_password,l=this.getAttribute("email");if(l)this.viewerEmail=l;else if(o){let d=P();d&&(this.viewerEmail=d)}if(o&&!this.viewerEmail||n){this.setupApiGate(e,t,r,o&&!this.viewerEmail,n);return}await this.verifyAndRender(e,t,r,this.viewerEmail,null)}catch(i){this.showError("API_ERROR","Failed to connect to CloakShare API",i.message)}}setupApiGate(e,t,r,i,s){this.setupGate(i,s);let o=this.$gateSubmit.onclick;this.$gateSubmit.onclick=null;let n=async l=>{l.preventDefault();let d=i?this.$gateEmail.value.trim():this.viewerEmail,h=s?this.$gatePassword.value:null;if(i&&(!d||!d.includes("@"))){this.$gateError.textContent="Please enter a valid email address.",this.$gateError.classList.add("visible");return}this.$gateSubmit.disabled=!0,this.$gateSubmit.textContent="Verifying...",d&&(this.viewerEmail=d,v(d),this.dispatchEvent(new CustomEvent("cloak:email-submitted",{detail:{email:d},bubbles:!0,composed:!0}))),await this.verifyAndRender(e,t,r,d||null,h)};this.$gateSubmit.addEventListener("click",n),this.$gatePassword.addEventListener("keydown",l=>{l.key==="Enter"&&n(l)}),this.$gateEmail.addEventListener("keydown",l=>{l.key==="Enter"&&n(l)})}async verifyAndRender(e,t,r,i,s){try{let o=await fetch(`${r}/v1/viewer/${encodeURIComponent(e)}/verify`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${t}`},body:JSON.stringify({email:i,password:s})});if(!o.ok){let c=(await o.json().catch(()=>({})))?.error?.message||`Verification failed (${o.status})`;if(o.status===401||o.status===403){this.$gateError.textContent=c,this.$gateError.classList.add("visible"),this.$gateSubmit.disabled=!1,this.$gateSubmit.textContent="Continue";return}this.showError("API_ERROR",c);return}let n=(await o.json()).data;this.apiSessionToken=n.session_token,this.viewerEmail=n.viewer_email||i;let l=[];for(let h of n.pages||[]){let c=await this.loadApiImage(h.url);l.push({pageNum:h.page,width:c.naturalWidth,height:c.naturalHeight,render:(m,u)=>{let S=c.naturalWidth*u,C=c.naturalHeight*u;m.drawImage(c,0,0,S,C)}})}this.pages=l,this.totalPages=l.length,this.format="api",this.currentPage=1,this.pageStartTime=Date.now(),this.pageTimes={},this.totalDuration=0,this.updateNavigation(),this.showScreen(this.$viewer),this.renderCurrentPage(),this.getAttribute("watermark")&&this.renderWatermark(),this.dispatchEvent(new CustomEvent("cloak:ready",{detail:{pageCount:this.totalPages,format:"api"},bubbles:!0,composed:!0})),this.emitViewEvent()}catch(o){this.showError("API_ERROR","Failed to load document from API",o.message)}}loadApiImage(e){return new Promise((t,r)=>{let i=new Image;i.crossOrigin="anonymous",i.onload=()=>t(i),i.onerror=()=>r(new Error("Failed to load page image")),i.src=e})}setupGate(e,t){this.$gateEmail.style.display=e?"block":"none",this.$gatePassword.style.display=t?"block":"none",this.$gateError.classList.remove("visible"),e&&(this.$gateEmail.value=""),t&&(this.$gatePassword.value=""),this.showScreen(this.$gate),requestAnimationFrame(()=>{e?this.$gateEmail.focus():t&&this.$gatePassword.focus()})}async handleGateSubmit(){let e=this.$gateEmail.style.display!=="none",t=this.$gatePassword.style.display!=="none";if(e){let i=this.$gateEmail.value.trim();if(!i||!i.includes("@")){this.$gateError.textContent="Please enter a valid email address.",this.$gateError.classList.add("visible");return}this.viewerEmail=i,v(i),this.dispatchEvent(new CustomEvent("cloak:email-submitted",{detail:{email:i},bubbles:!0,composed:!0}))}if(t){let i=this.$gatePassword.value,s=this.getAttribute("password");if(i!==s){this.$gateError.textContent="Incorrect password.",this.$gateError.classList.add("visible");return}}this.$gateSubmit.disabled=!0,this.$gateSubmit.textContent="Loading...";let r=this.getAttribute("src");r&&await this.renderDocument(r)}async renderDocument(e){this.showScreen(this.$loading);try{let t=this.getAttribute("renderer")==="external",r=await x(e,t);this.pages=r.pages,this.totalPages=r.pages.length,this.format=r.format,this.currentPage=1,this.pageStartTime=Date.now(),this.pageTimes={},this.totalDuration=0,this.updateNavigation(),this.showScreen(this.$viewer),this.renderCurrentPage(),this.renderWatermark(),this.dispatchEvent(new CustomEvent("cloak:ready",{detail:{pageCount:this.totalPages,format:this.format},bubbles:!0,composed:!0})),this.emitViewEvent()}catch(t){let r=t,i=r.code||"LOAD_FAILED";this.showError(i,r.message||"Failed to load document")}}renderCurrentPage(){let e=this.pages[this.currentPage-1];if(!e)return;let t=this.$canvas,r=t.getContext("2d");if(!r)return;let i=window.devicePixelRatio||1,s=this.$viewerBody.clientWidth-48,o=Math.min(1,s/e.width),n=e.width*o,l=e.height*o;t.style.width=`${n}px`,t.style.height=`${l}px`,t.width=n*i,t.height=l*i,r.clearRect(0,0,t.width,t.height);let d=e.render(r,o,i);d instanceof Promise?d.then(()=>this.renderWatermark()):this.renderWatermark()}renderWatermark(){let e=this.getAttribute("watermark");if(!e){this.$watermarkCanvas.style.display="none";return}this.$watermarkCanvas.style.display="block";let t=y(e,this.viewerEmail,this.sessionId);k(this.$watermarkCanvas,this.$canvasContainer,t)}goToPage(e){e<1||e>this.totalPages||(this.trackPageTime(),this.currentPage=e,this.pageStartTime=Date.now(),this.resetZoom(),this.updateNavigation(),this.renderCurrentPage(),this.$viewerBody.scrollTop=0,this.emitViewEvent())}updateNavigation(){this.$pageIndicator.textContent=`${this.currentPage} / ${this.totalPages}`,this.$prevBtn.disabled=this.currentPage<=1,this.$nextBtn.disabled=this.currentPage>=this.totalPages,this.$prevBtn.setAttribute("aria-label",`Previous page (${this.currentPage-1} of ${this.totalPages})`),this.$nextBtn.setAttribute("aria-label",`Next page (${this.currentPage+1} of ${this.totalPages})`)}setupKeyboardNav(){this.shadow.addEventListener("keydown",e=>{let t=e;if(this.$viewer.classList.contains("active"))switch(t.key){case"ArrowLeft":case"ArrowUp":t.preventDefault(),this.goToPage(this.currentPage-1);break;case"ArrowRight":case"ArrowDown":t.preventDefault(),this.goToPage(this.currentPage+1);break;case"Home":t.preventDefault(),this.goToPage(1);break;case"End":t.preventDefault(),this.goToPage(this.totalPages);break}})}setupProtections(){this.$canvas.addEventListener("contextmenu",e=>e.preventDefault()),this.$canvas.addEventListener("dragstart",e=>e.preventDefault()),this.$canvas.style.userSelect="none",this.$canvas.style.webkitUserSelect="none"}zoomScale=1;zoomOffsetX=0;zoomOffsetY=0;pinchStartDist=0;pinchStartScale=1;panStartX=0;panStartY=0;panOffsetX=0;panOffsetY=0;isPinching=!1;isPanning=!1;lastTapTime=0;setupSwipe(){let e=0,t=0,r=0;this.$viewerBody.addEventListener("touchstart",i=>{r=i.touches.length,r===1&&this.zoomScale>1?(this.isPanning=!0,this.panStartX=i.touches[0].clientX-this.zoomOffsetX,this.panStartY=i.touches[0].clientY-this.zoomOffsetY):r===1&&(e=i.touches[0].clientX,t=i.touches[0].clientY),r===2&&(this.isPinching=!0,this.isPanning=!1,this.pinchStartDist=this.getTouchDistance(i.touches),this.pinchStartScale=this.zoomScale,i.preventDefault())},{passive:!1}),this.$viewerBody.addEventListener("touchmove",i=>{if(this.isPinching&&i.touches.length===2){let s=this.getTouchDistance(i.touches),o=this.pinchStartScale*(s/this.pinchStartDist);this.setZoom(Math.max(1,Math.min(5,o))),i.preventDefault()}else this.isPanning&&i.touches.length===1&&this.zoomScale>1&&(this.zoomOffsetX=i.touches[0].clientX-this.panStartX,this.zoomOffsetY=i.touches[0].clientY-this.panStartY,this.clampPanOffset(),this.applyZoomTransform(),i.preventDefault())},{passive:!1}),this.$viewerBody.addEventListener("touchend",i=>{if(this.isPinching){this.isPinching=!1,this.zoomScale<1.1&&this.resetZoom();return}if(this.isPanning){this.isPanning=!1;return}if(i.changedTouches.length===1&&r===1&&this.zoomScale<=1){let s=Date.now();if(s-this.lastTapTime<300){this.setZoom(2.5);let o=this.$canvasContainer.getBoundingClientRect(),n=i.changedTouches[0].clientX-o.left,l=i.changedTouches[0].clientY-o.top;this.zoomOffsetX=-(n*(this.zoomScale-1)),this.zoomOffsetY=-(l*(this.zoomScale-1)),this.clampPanOffset(),this.applyZoomTransform(),this.lastTapTime=0;return}this.lastTapTime=s}else if(r===1&&this.zoomScale>1){let s=Date.now();if(s-this.lastTapTime<300){this.resetZoom(),this.lastTapTime=0;return}this.lastTapTime=s}if(r===1&&this.zoomScale<=1){let s=i.changedTouches[0].clientX-e,o=i.changedTouches[0].clientY-t;Math.abs(s)>50&&Math.abs(s)>Math.abs(o)*1.5&&(s<0?this.goToPage(this.currentPage+1):this.goToPage(this.currentPage-1))}r=0},{passive:!0})}getTouchDistance(e){let t=e[0].clientX-e[1].clientX,r=e[0].clientY-e[1].clientY;return Math.sqrt(t*t+r*r)}setZoom(e){this.zoomScale=e,this.clampPanOffset(),this.applyZoomTransform()}resetZoom(){this.zoomScale=1,this.zoomOffsetX=0,this.zoomOffsetY=0,this.applyZoomTransform()}clampPanOffset(){if(this.zoomScale<=1){this.zoomOffsetX=0,this.zoomOffsetY=0;return}let e=this.$canvasContainer.getBoundingClientRect(),t=e.width*(this.zoomScale-1)/2,r=e.height*(this.zoomScale-1)/2;this.zoomOffsetX=Math.max(-t,Math.min(t,this.zoomOffsetX)),this.zoomOffsetY=Math.max(-r,Math.min(r,this.zoomOffsetY))}applyZoomTransform(){this.$canvasContainer.style.transform=this.zoomScale<=1?"":`translate(${this.zoomOffsetX}px, ${this.zoomOffsetY}px) scale(${this.zoomScale})`,this.$canvasContainer.style.transformOrigin="center center"}trackPageTime(){let e=(Date.now()-this.pageStartTime)/1e3;this.pageTimes[this.currentPage]||(this.pageTimes[this.currentPage]=0),this.pageTimes[this.currentPage]+=e,this.totalDuration+=e}emitViewEvent(){let e={page:this.currentPage,email:this.viewerEmail,timestamp:new Date().toISOString(),sessionId:this.sessionId,duration:Math.round(this.totalDuration*10)/10,scrollDepth:this.totalPages>0?Math.round(this.currentPage/this.totalPages*100):0,referrer:document.referrer,device:J()};if(this.dispatchEvent(new CustomEvent("cloak:view",{detail:e,bubbles:!0,composed:!0})),this.apiSessionToken){let t=this.getAttribute("src"),r=this.getAttribute("api-url")||"https://api.cloakshare.dev";t&&fetch(`${r}/v1/viewer/${encodeURIComponent(t)}/track`,{method:"POST",headers:{"Content-Type":"application/json","X-Session-Token":this.apiSessionToken},body:JSON.stringify({current_page:this.currentPage,total_duration:this.totalDuration,page_times:this.pageTimes})}).catch(()=>{})}}_resizeObserver;setupResizeObserver(){this._resizeObserver=new ResizeObserver(()=>{this.$viewer.classList.contains("active")&&this.pages.length>0&&this.renderCurrentPage()}),this._resizeObserver.observe(this)}};typeof window<"u"&&!customElements.get("cloak-viewer")&&customElements.define("cloak-viewer",g);return A(Q);})();
//# sourceMappingURL=index.global.js.map