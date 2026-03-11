// ==UserScript==
// @name         Mahjong Souls Assistant
// @namespace    https://github.com/mjs-assistant
// @version      1.0.0
// @description  Real-time Riichi Mahjong hand analysis overlay. EDUCATIONAL USE ONLY.
// @author       MJS Assistant
// @match        https://mahjongsoul.game.yo-star.com/*
// @match        https://*.mahjongsoul.com/*
// @match        https://game.mahjongsoul.com/*
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==

// ============================================================
// USERSCRIPT VERSION — All code bundled in a single file
// For Tampermonkey / Greasemonkey / Violentmonkey
//
// ⚠ WARNING: Using bots in Mahjong Souls may violate their ToS.
// This script is for EDUCATIONAL PURPOSES ONLY.
// Autopilot is DISABLED by default.
// ============================================================

(function () {
  'use strict';

  // ── Inline CSS ────────────────────────────────────────────
  const CSS = `
#mjs-assistant-overlay {
  position: fixed; top: 12px; right: 12px; width: 280px;
  z-index: 999999; font-family: 'Segoe UI', system-ui, sans-serif;
  font-size: 12px; user-select: none; pointer-events: auto; transition: opacity 0.2s ease;
}
#mjs-assistant-overlay.mjs-hidden { opacity: 0; pointer-events: none; }
#mjs-assistant-overlay.mjs-minimized .mjs-body { display: none; }
.mjs-header {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: #e0e0e0; padding: 8px 12px; border-radius: 8px 8px 0 0;
  display: flex; align-items: center; justify-content: space-between;
  cursor: move; border: 1px solid #0f3460; border-bottom: none;
}
.mjs-title { font-weight: 700; font-size: 13px; color: #e94560; letter-spacing: 0.5px; }
.mjs-header-controls { display: flex; gap: 6px; }
.mjs-btn-icon {
  background: none; border: 1px solid #444; color: #aaa; width: 20px; height: 20px;
  border-radius: 4px; cursor: pointer; font-size: 11px; display: flex;
  align-items: center; justify-content: center; transition: all 0.15s; padding: 0;
}
.mjs-btn-icon:hover { border-color: #e94560; color: #e94560; }
.mjs-body {
  background: rgba(10, 10, 20, 0.92); border: 1px solid #0f3460; border-top: none;
  border-radius: 0 0 8px 8px; backdrop-filter: blur(8px); overflow: hidden;
}
.mjs-shanten-section { padding: 10px 12px 6px; border-bottom: 1px solid #1a2a4a; }
.mjs-shanten-badge {
  display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px;
  border-radius: 20px; font-weight: 700; font-size: 13px; letter-spacing: 0.3px;
}
.mjs-shanten-badge.tenpai { background: rgba(46,213,115,0.2); border: 1px solid #2ed573; color: #2ed573; }
.mjs-shanten-badge.close  { background: rgba(255,165,0,0.2); border: 1px solid #ffa502; color: #ffa502; }
.mjs-shanten-badge.far    { background: rgba(100,100,150,0.2); border: 1px solid #666; color: #aaa; }
.mjs-hand-type { font-size: 10px; color: #8888aa; margin-top: 4px; }
.mjs-section { padding: 8px 12px; border-bottom: 1px solid #1a2a4a; }
.mjs-section:last-child { border-bottom: none; }
.mjs-section-title { font-size: 10px; font-weight: 600; color: #8888aa; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px; }
.mjs-discard-list { display: flex; flex-direction: column; gap: 4px; }
.mjs-discard-item { display: flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 6px; background: rgba(255,255,255,0.03); }
.mjs-discard-item.best { background: rgba(233,69,96,0.12); border: 1px solid rgba(233,69,96,0.3); }
.mjs-rank { font-size: 10px; color: #666; width: 12px; flex-shrink: 0; }
.mjs-tile-chip { display: inline-flex; align-items: center; justify-content: center; min-width: 32px; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 12px; flex-shrink: 0; }
.mjs-tile-chip.man   { background: rgba(220,80,80,0.25); color: #ff8080; border: 1px solid rgba(220,80,80,0.4); }
.mjs-tile-chip.pin   { background: rgba(80,140,220,0.25); color: #80b0ff; border: 1px solid rgba(80,140,220,0.4); }
.mjs-tile-chip.sou   { background: rgba(80,180,80,0.25); color: #80e080; border: 1px solid rgba(80,180,80,0.4); }
.mjs-tile-chip.honor { background: rgba(200,160,60,0.25); color: #f0c060; border: 1px solid rgba(200,160,60,0.4); }
.mjs-discard-stats { font-size: 10px; color: #8888aa; margin-left: auto; text-align: right; }
.mjs-discard-stats .ukeire { color: #aaccff; font-weight: 600; }
.mjs-shanten-indicator { font-size: 10px; padding: 1px 5px; border-radius: 3px; background: rgba(46,213,115,0.15); color: #2ed573; flex-shrink: 0; }
.mjs-ukeire-tiles { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.mjs-ukeire-tile { display: inline-flex; flex-direction: column; align-items: center; padding: 3px 5px; border-radius: 5px; font-size: 10px; font-weight: 600; }
.mjs-ukeire-tile .tile-name { font-size: 11px; }
.mjs-ukeire-tile .tile-remaining { font-size: 9px; color: #888; }
.mjs-value-flags { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 4px; }
.mjs-value-flag { font-size: 10px; padding: 2px 6px; border-radius: 3px; background: rgba(200,160,60,0.15); color: #daa520; border: 1px solid rgba(200,160,60,0.3); }
.mjs-han-estimate { font-size: 12px; color: #ffd700; font-weight: 700; }
.mjs-safety-tip { font-size: 10px; padding: 3px 6px; border-radius: 4px; margin-top: 3px; }
.mjs-safety-tip.safe    { background: rgba(46,213,115,0.1); color: #2ed573; }
.mjs-safety-tip.warning { background: rgba(255,165,0,0.1); color: #ffa502; }
.mjs-autopilot-section { padding: 8px 12px; background: rgba(233,69,96,0.05); border-top: 1px solid rgba(233,69,96,0.2); }
.mjs-autopilot-row { display: flex; align-items: center; justify-content: space-between; }
.mjs-autopilot-label { font-size: 11px; color: #cc4444; font-weight: 600; }
.mjs-toggle { position: relative; display: inline-block; width: 36px; height: 18px; }
.mjs-toggle input { opacity: 0; width: 0; height: 0; }
.mjs-toggle-slider { position: absolute; cursor: pointer; inset: 0; background: #333; border-radius: 18px; transition: 0.2s; }
.mjs-toggle-slider:before { content: ''; position: absolute; width: 12px; height: 12px; left: 3px; top: 3px; background: #888; border-radius: 50%; transition: 0.2s; }
.mjs-toggle input:checked + .mjs-toggle-slider { background: rgba(233,69,96,0.4); }
.mjs-toggle input:checked + .mjs-toggle-slider:before { background: #e94560; transform: translateX(18px); }
.mjs-warning-text { font-size: 9px; color: #cc4444; margin-top: 4px; opacity: 0.8; }
.mjs-status-bar { padding: 4px 12px; background: rgba(0,0,0,0.3); border-top: 1px solid #1a2a4a; display: flex; align-items: center; justify-content: space-between; }
.mjs-status-dot { width: 6px; height: 6px; border-radius: 50%; background: #666; }
.mjs-status-dot.active { background: #2ed573; }
.mjs-status-dot.waiting { background: #ffa502; animation: mjs-pulse 1.5s infinite; }
.mjs-status-text { font-size: 9px; color: #666; }
@keyframes mjs-pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
.mjs-no-state { padding: 16px 12px; text-align: center; color: #555; font-size: 11px; line-height: 1.5; }
.mjs-no-state-icon { font-size: 24px; margin-bottom: 6px; }
.mjs-scrollable { max-height: 420px; overflow-y: auto; overflow-x: hidden; scrollbar-width: thin; scrollbar-color: #333 transparent; }
.mjs-scrollable::-webkit-scrollbar { width: 4px; }
.mjs-scrollable::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
  `;

  // ── Inject CSS ────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  // ── Load all modules inline ────────────────────────────────
  // (In userscript form all modules are concatenated here.
  //  In the extension version they are separate files.)

  // Re-use the same module code — include all files here in order:
  // 1. constants.js
  // 2. tile-utils.js
  // 3. shanten.js
  // 4. ukeire.js
  // 5. hand-analyzer.js
  // 6. tile-detector.js
  // 7. overlay-ui.js
  // 8. autoplayer.js
  // 9. main.js
  //
  // In a userscript bundler (e.g., webpack), these would be @require'd
  // or inlined automatically. For manual use, paste all file contents here.

  console.log('[MJS Assistant] Userscript loaded. Paste module contents above this line.');
  console.log('[MJS Assistant] Or use the Chrome extension version for best results.');

})();
