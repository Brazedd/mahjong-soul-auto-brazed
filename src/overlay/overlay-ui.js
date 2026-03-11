// ============================================================
// overlay-ui.js v6 — Larger HUD, strategy guidance, pon advice
// ============================================================
'use strict';

const MJSOverlay = window.MJSOverlay || {};
MJSOverlay._visible   = true;
MJSOverlay._minimized = false;
MJSOverlay._tab       = 'analysis';
MJSOverlay.VERSION    = 'v2.0';

MJSOverlay.NAMES = {
  11:'1 Man',12:'2 Man',13:'3 Man',14:'4 Man',15:'5 Man',16:'6 Man',17:'7 Man',18:'8 Man',19:'9 Man',
  21:'1 Pin',22:'2 Pin',23:'3 Pin',24:'4 Pin',25:'5 Pin',26:'6 Pin',27:'7 Pin',28:'8 Pin',29:'9 Pin',
  31:'1 Sou',32:'2 Sou',33:'3 Sou',34:'4 Sou',35:'5 Sou',36:'6 Sou',37:'7 Sou',38:'8 Sou',39:'9 Sou',
  41:'East Wind',42:'South Wind',43:'West Wind',44:'North Wind',
  45:'Haku (白) White Dragon',46:'Hatsu (發) Green Dragon',47:'Chun (中) Red Dragon',
  51:'5m★ Red',52:'5p★ Red',53:'5s★ Red'
};
MJSOverlay.HONOR_CHAR = { 41:'東',42:'南',43:'西',44:'北',45:'白',46:'發',47:'中' };

MJSOverlay._suit = (code) => {
  const n = MJS.normalize(code);
  if (n>=11&&n<=19) return 'man';
  if (n>=21&&n<=29) return 'pin';
  if (n>=31&&n<=39) return 'sou';
  return 'honor';
};
MJSOverlay._name = (code) => MJSOverlay.NAMES[MJS.normalize(code)] || '?';

MJSOverlay._tileHTML = (code, size='sm') => {
  const n    = MJS.normalize(code);
  const suit = MJSOverlay._suit(code);
  const num  = MJS.getNumber(n);
  const isRed = (code===51||code===52||code===53);
  let inner;
  if (suit==='honor') {
    inner = `<span class="mjs-tile-honor">${MJSOverlay.HONOR_CHAR[n]||'?'}</span>`;
  } else {
    inner = `<span class="mjs-tile-num">${num}${isRed?'<sup>★</sup>':''}</span><span class="mjs-tile-suit"></span>`;
  }
  return `<div class="mjs-tile ${suit} mjs-tile-${size}${isRed?' red':''}">${inner}</div>`;
};

// ── Init ──────────────────────────────────────────────────────
MJSOverlay.init = () => {
  if (document.getElementById('mjs-overlay')) return;
  const el = document.createElement('div');
  el.id = 'mjs-overlay';
  el.innerHTML = MJSOverlay._buildHTML();
  document.body.appendChild(el);
  MJSOverlay._el = el;
  MJSOverlay._bindEvents();
  MJSOverlay._makeDraggable();
  MJSOverlay._restorePos();
  MJSOverlay._applySettingsToUI();
  console.log('[Brazed] Mahjong Soul Auto v2.0.0 — overlay ready.');
};

MJSOverlay._buildHTML = () => `
  <div class="mjs-header" id="mjs-drag-handle">
    <div class="mjs-logo">
      <div class="mjs-logo-icon">🀄</div>
      <div class="mjs-logo-title">
        <span class="mjs-logo-text">BRAZED</span>
        <span class="mjs-logo-sub">Mahjong Soul Auto</span>
      </div>
      <span class="mjs-version">${MJSOverlay.VERSION}</span>
      <span class="mjs-ap-pill" id="mjs-ap-pill">AUTO</span>
    </div>
    <div class="mjs-header-controls">
      <button class="mjs-btn-icon" id="mjs-btn-min" title="Minimize">─</button>
      <button class="mjs-btn-icon" id="mjs-btn-close" title="Hide (Alt+M)">✕</button>
    </div>
  </div>
  <div class="mjs-tabs">
    <button class="mjs-tab active" id="mjs-tab-analysis" onclick="MJSOverlay._switchTab('analysis')">Analysis</button>
    <button class="mjs-tab" id="mjs-tab-log" onclick="MJSOverlay._switchTab('log')">Log</button>
    <button class="mjs-tab" id="mjs-tab-settings" onclick="MJSOverlay._switchTab('settings')">Settings</button>
  </div>
  <div class="mjs-body">
    <div id="mjs-panel-analysis">
      <div id="mjs-main-content">
        <div class="mjs-no-state">
          <div class="mjs-no-state-icon">⬛</div>
          Waiting for hand…<br>
          <small>Enter a match to begin.</small>
        </div>
      </div>
      <div class="mjs-autopilot-section">
        <div class="mjs-autopilot-row">
          <div class="mjs-autopilot-left">
            <div class="mjs-autopilot-title">AUTO-PILOT</div>
            <div class="mjs-autopilot-sub" id="mjs-ap-sub">Disabled — Alt+A to toggle</div>
          </div>
          <label class="mjs-toggle">
            <input type="checkbox" id="mjs-autopilot-toggle">
            <span class="mjs-toggle-slider"></span>
          </label>
        </div>
      </div>
    </div>
    <div id="mjs-panel-settings" style="display:none">
      ${MJSOverlay._buildSettingsHTML()}
    </div>
    <div class="mjs-status-bar">
      <div class="mjs-status-dot" id="mjs-status-dot"></div>
      <span class="mjs-status-text" id="mjs-status-text">Not connected</span>
      <span class="mjs-update-time" id="mjs-update-time"></span>
    </div>
  </div>`;

MJSOverlay._buildSettingsHTML = () => `
  <div class="mjs-settings">

    <div class="mjs-settings-section" style="background:rgba(255,40,40,0.06);border-left:3px solid #e03030;">
      <div class="mjs-settings-title" style="color:#e03030">⚠ BAN WARNING</div>
      <div class="mjs-setting-hint" style="color:#cc6666;line-height:1.6;">Autopilot <strong>violates Mahjong Soul's Terms of Service</strong>. Using it may result in a <strong>permanent account ban</strong>. You use this entirely at your own risk. Do not use on an account you care about.</div>
    </div>

    <div class="mjs-settings-section">
      <div class="mjs-settings-title">⏱ Play Speed</div>
      <div class="mjs-setting-hint">How long autopilot waits before acting. Lower = faster but more obvious.</div>
      <div class="mjs-setting-row">
        <label>Fastest</label>
        <div class="mjs-slider-wrap">
          <input type="range" id="cfg-min-delay" min="300" max="8000" step="100" value="800"
            oninput="MJSOverlay._onSlider('min-delay',this.value)">
          <span class="mjs-slider-val" id="cfg-min-delay-val">0.8s</span>
        </div>
      </div>
      <div class="mjs-setting-row">
        <label>Slowest</label>
        <div class="mjs-slider-wrap">
          <input type="range" id="cfg-max-delay" min="500" max="12000" step="100" value="1800"
            oninput="MJSOverlay._onSlider('max-delay',this.value)">
          <span class="mjs-slider-val" id="cfg-max-delay-val">1.8s</span>
        </div>
      </div>
    </div>

    <div class="mjs-settings-section">
      <div class="mjs-settings-title">🀄 Winning</div>
      <div class="mjs-setting-row">
        <div class="mjs-setting-label-group">
          <label>Declare win automatically</label>
          <span class="mjs-setting-sub">Call Ron/Tsumo when you can win</span>
        </div>
        <label class="mjs-toggle"><input type="checkbox" id="cfg-always-win" checked
          onchange="MJSAutoplayer.settings.alwaysWin=this.checked;MJSOverlay._saveCfg()">
          <span class="mjs-toggle-slider"></span></label>
      </div>
    </div>

    <div class="mjs-settings-section">
      <div class="mjs-settings-title">🀆 Calling Tiles (Pon / Chi)</div>
      <div class="mjs-setting-hint">Pon = steal any player's discard to make a set of 3. Chi = steal the left player's discard to make a run. Opening your hand removes the Riichi bonus.</div>
      <div class="mjs-setting-row">
        <div class="mjs-setting-label-group">
          <label>Call Pon</label>
          <span class="mjs-setting-sub">Steal to make a triplet (any player)</span>
        </div>
        <label class="mjs-toggle"><input type="checkbox" id="cfg-take-pon" checked
          onchange="MJSAutoplayer.settings.takePon=this.checked;MJSOverlay._saveCfg()">
          <span class="mjs-toggle-slider"></span></label>
      </div>
      <div class="mjs-setting-row">
        <div class="mjs-setting-label-group">
          <label>Call Chi</label>
          <span class="mjs-setting-sub">Steal to make a sequence (left player only)</span>
        </div>
        <label class="mjs-toggle"><input type="checkbox" id="cfg-take-chi" checked
          onchange="MJSAutoplayer.settings.takeChi=this.checked;MJSOverlay._saveCfg()">
          <span class="mjs-toggle-slider"></span></label>
      </div>
      <div class="mjs-setting-row">
        <div class="mjs-setting-label-group">
          <label>Chi aggression</label>
          <span class="mjs-setting-sub" id="cfg-chi-aggr-desc">Only Chi if it meaningfully helps</span>
        </div>
        <div class="mjs-slider-wrap">
          <input type="range" id="cfg-meld-delta" min="1" max="3" step="1" value="1"
            oninput="MJSOverlay._onSlider('meld-delta',this.value)">
          <span class="mjs-slider-val" id="cfg-meld-delta-val">Med</span>
        </div>
      </div>
      <div class="mjs-setting-row">
        <div class="mjs-setting-label-group">
          <label>Call Kan</label>
          <span class="mjs-setting-sub">Make a quad (draws extra tile, risky)</span>
        </div>
        <label class="mjs-toggle"><input type="checkbox" id="cfg-take-kan"
          onchange="MJSAutoplayer.settings.takeKan=this.checked;MJSOverlay._saveCfg()">
          <span class="mjs-toggle-slider"></span></label>
      </div>
    </div>

  </div>`;

// ── Tab ───────────────────────────────────────────────────────
MJSOverlay._switchTab = (tab) => {
  MJSOverlay._tab = tab;
  ['analysis','log','settings'].forEach(p => {
    const el = document.getElementById('mjs-panel-'+p);
    if (el) el.style.display = tab===p ? '' : 'none';
    const tb = document.getElementById('mjs-tab-'+p);
    if (tb) tb.className = 'mjs-tab'+(tab===p?' active':'');
  });
  if (tab==='settings') MJSOverlay._refreshCalibStatus();
  if (tab==='log') MJSOverlay.updateLog(MJSAutoplayer._log || []);
};
MJSOverlay._refreshCalibStatus = () => {
  const el = document.getElementById('mjs-calib-status'); if (!el) return;
  const c = MJSAutoplayer._cal;
  const f = p => p ? `${(p.xPct*100).toFixed(0)}%x ${(p.yPct*100).toFixed(0)}%y ✓` : 'default';
  el.textContent = `Action: ${f(c.action)} | Skip: ${f(c.skip)}`;
};

// ── Slider ────────────────────────────────────────────────────
MJSOverlay._onSlider = (key, val) => {
  const n = parseFloat(val);
  if (key==='min-delay')  { MJSAutoplayer._minDelay=n; document.getElementById('cfg-min-delay-val').textContent=(n/1000).toFixed(1)+'s'; }
  else if (key==='max-delay')  { MJSAutoplayer._maxDelay=n; document.getElementById('cfg-max-delay-val').textContent=(n/1000).toFixed(1)+'s'; }
  else if (key==='meld-delta') {
    MJSAutoplayer.settings.meldMinDelta = n;
    const labels = {1:'High', 2:'Med', 3:'Low'};
    const descs  = {1:'Chi even if it only helps a little', 2:'Only Chi if it meaningfully helps', 3:'Only Chi if it helps a lot'};
    document.getElementById('cfg-meld-delta-val').textContent = labels[n] || n;
    const descEl = document.getElementById('cfg-chi-aggr-desc');
    if (descEl) descEl.textContent = descs[n] || '';
  }
  MJSOverlay._saveCfg();
};

MJSOverlay._saveCfg = () => {
  try { localStorage.setItem('mjs-cfg', JSON.stringify({ minDelay:MJSAutoplayer._minDelay, maxDelay:MJSAutoplayer._maxDelay, settings:MJSAutoplayer.settings })); } catch(e) {}
};
MJSOverlay._loadCfg = () => {
  try { const c=JSON.parse(localStorage.getItem('mjs-cfg')||'{}'); if(c.minDelay) MJSAutoplayer._minDelay=c.minDelay; if(c.maxDelay) MJSAutoplayer._maxDelay=c.maxDelay; if(c.settings) Object.assign(MJSAutoplayer.settings,c.settings); } catch(e) {}
};
MJSOverlay._applySettingsToUI = () => {
  MJSOverlay._loadCfg();
  const s=MJSAutoplayer.settings, $=id=>document.getElementById(id), set=(id,fn)=>{const el=$(id);if(el)fn(el);};
  set('cfg-min-delay',      el=>el.value=MJSAutoplayer._minDelay);
  set('cfg-min-delay-val',  el=>el.textContent=(MJSAutoplayer._minDelay/1000).toFixed(1)+'s');
  set('cfg-max-delay',      el=>el.value=MJSAutoplayer._maxDelay);
  set('cfg-max-delay-val',  el=>el.textContent=(MJSAutoplayer._maxDelay/1000).toFixed(1)+'s');
  set('cfg-take-pon',       el=>el.checked=s.takePon);
  set('cfg-take-chi',       el=>el.checked=s.takeChi);
  set('cfg-take-kan',       el=>el.checked=s.takeKan);
  set('cfg-always-win',     el=>el.checked=s.alwaysWin);
  set('cfg-meld-delta',     el=>el.value=s.meldMinDelta);
  set('cfg-meld-delta-val', el=>{
    const labels={1:'High',2:'Med',3:'Low'};
    el.textContent=labels[s.meldMinDelta]||s.meldMinDelta;
  });
  const chiDesc=document.getElementById('cfg-chi-aggr-desc');
  if(chiDesc){const d={1:'Chi even if it only helps a little',2:'Only Chi if it meaningfully helps',3:'Only Chi if it helps a lot'};chiDesc.textContent=d[s.meldMinDelta]||'';}
};

// ── Events ────────────────────────────────────────────────────
MJSOverlay._bindEvents = () => {
  // Prevent ALL overlay clicks from reaching the game canvas
  MJSOverlay._el.addEventListener('mousedown',  e => e.stopPropagation());
  MJSOverlay._el.addEventListener('mouseup',    e => e.stopPropagation());
  MJSOverlay._el.addEventListener('click',      e => e.stopPropagation());
  MJSOverlay._el.addEventListener('pointerdown',e => e.stopPropagation());
  MJSOverlay._el.addEventListener('pointerup',  e => e.stopPropagation());
  document.getElementById('mjs-btn-close').addEventListener('click', ()=>MJSOverlay.hide());
  document.getElementById('mjs-btn-min').addEventListener('click',   ()=>MJSOverlay.toggleMinimize());
  document.getElementById('mjs-autopilot-toggle').addEventListener('change', (e)=>{
    const en = e.target.checked;
    if (en) {
      MJSAutoplayer._lastOpShowing  = false;
      MJSAutoplayer._lastCanDiscard = false;
      clearTimeout(MJSAutoplayer._pending);
      clearTimeout(MJSAutoplayer._opPending);
      MJSAutoplayer._pending   = null;
      MJSAutoplayer._opPending = null;
    }
    MJSAutoplayer.setEnabled(en);
    const pill=document.getElementById('mjs-ap-pill'), sub=document.getElementById('mjs-ap-sub');
    if(pill) pill.className='mjs-ap-pill'+(e.target.checked?' active':'');
    if(sub)  { sub.textContent=e.target.checked?'Active — playing automatically':'Disabled — Alt+A to toggle'; sub.className='mjs-autopilot-sub'+(e.target.checked?' on':''); }
  });
  document.addEventListener('keydown', (e)=>{
    if(e.altKey&&e.key==='m') MJSOverlay.toggle();
    if(e.altKey&&e.key==='a') { const cb=document.getElementById('mjs-autopilot-toggle'); if(cb){cb.checked=!cb.checked;cb.dispatchEvent(new Event('change'));} }
  });
};

// ── Drag ─────────────────────────────────────────────────────
MJSOverlay._makeDraggable = () => {
  const handle = document.getElementById('mjs-drag-handle');
  const el     = MJSOverlay._el;
  let drag = false, sx = 0, sy = 0, ol = 0, ot = 0;

  const stopDrag = () => {
    if (!drag) return;
    drag = false;
    handle.releasePointerCapture && handle.releasePointerCapture(MJSOverlay._dragPointerId);
    try { const r=el.getBoundingClientRect(); localStorage.setItem('mjs-pos',JSON.stringify({l:r.left,t:r.top})); } catch(e) {}
  };

  handle.addEventListener('pointerdown', (e) => {
    // Only drag on the header bar itself, not buttons
    if (e.target.closest('.mjs-btn-icon')) return;
    // Only left button
    if (e.button !== 0) return;
    drag = true;
    MJSOverlay._dragPointerId = e.pointerId;
    handle.setPointerCapture(e.pointerId);
    sx = e.clientX; sy = e.clientY;
    const r = el.getBoundingClientRect();
    ol = r.left; ot = r.top;
    e.preventDefault();
    e.stopPropagation();
  });

  handle.addEventListener('pointermove', (e) => {
    if (!drag) return;
    el.style.left  = `${ol + e.clientX - sx}px`;
    el.style.top   = `${ot + e.clientY - sy}px`;
    el.style.right = 'auto';
    e.stopPropagation();
  });

  handle.addEventListener('pointerup',     stopDrag);
  handle.addEventListener('pointercancel', stopDrag);
  // Safety net — if pointer somehow escapes capture
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') stopDrag(); });
};
MJSOverlay._restorePos = () => {
  try { const p=JSON.parse(localStorage.getItem('mjs-pos')||'null'); if(p){MJSOverlay._el.style.left=p.l+'px';MJSOverlay._el.style.top=p.t+'px';MJSOverlay._el.style.right='auto';} } catch(e){}
};

MJSOverlay.show   = ()=>{ MJSOverlay._el.classList.remove('mjs-hidden'); MJSOverlay._visible=true; };
MJSOverlay.hide   = ()=>{ MJSOverlay._el.classList.add('mjs-hidden');    MJSOverlay._visible=false; };
MJSOverlay.toggle = ()=>{ MJSOverlay._visible?MJSOverlay.hide():MJSOverlay.show(); };
MJSOverlay.toggleMinimize = ()=>{
  MJSOverlay._minimized=!MJSOverlay._minimized;
  MJSOverlay._el.classList.toggle('mjs-minimized',MJSOverlay._minimized);
  document.getElementById('mjs-btn-min').textContent=MJSOverlay._minimized?'□':'─';
};

// ── Strategy analysis ─────────────────────────────────────────
MJSOverlay._getStrategy = (analysis) => {
  const { shanten, isTenpai, handType, valueEstimate, numMelds=0 } = analysis;
  const isOpen = numMelds > 0;

  if (isTenpai) return { goal:'Win the hand', advice:'You are tenpai — wait for your winning tile.', color:'var(--accent2)' };

  const han = valueEstimate?.estimatedHan || 1;
  const flags = valueEstimate?.flags || [];

  if (shanten === 0) {
    if (!isOpen && flags.includes('Riichi possible'))
      return { goal:'Reach tenpai → Riichi', advice:'One tile from tenpai. Discard to reach tenpai then declare Riichi.', color:'var(--accent)' };
    return { goal:'Reach tenpai', advice:'One tile from tenpai. Discard carefully.', color:'var(--accent)' };
  }

  if (handType === 'Chiitoitsu')
    return { goal:'Build Chiitoitsu (7 pairs)', advice:'Collect pairs. Skip melds — Chiitoitsu must stay closed.', color:'var(--accent3)' };

  if (flags.includes('Tanyao') && isOpen)
    return { goal:'Tanyao (all simples)', advice:'Keep 2–8 tiles only. Open melds are fine for Tanyao.', color:'var(--accent2)' };

  if (flags.includes('Tanyao') && !isOpen && shanten <= 2)
    return { goal:'Tanyao or Riichi', advice:'Hand could go Tanyao (open) or Riichi (closed). Keep options open.', color:'var(--accent2)' };

  if (han >= 3 && !isOpen)
    return { goal:'High value closed hand', advice:`~${han} han potential. Stay closed for Riichi/Tsumo bonus.`, color:'var(--accent)' };

  if (shanten >= 3)
    return { goal:'Reduce shanten (${shanten} away)', advice:'Hand is far from tenpai. Prioritise tiles that connect well.', color:'var(--text-md)' };

  return { goal:'Build toward tenpai', advice:`${shanten + 1} tiles from tenpai. Keep connected tiles.`, color:'var(--text-md)' };
};

// ── Pon/Chi advice for current op popup ──────────────────────
MJSOverlay._lastOpAdvice = null;
MJSOverlay.setOpAdvice = (advice) => {
  MJSOverlay._lastOpAdvice = advice;
  const el = document.getElementById('mjs-op-advice');
  if (el) el.innerHTML = MJSOverlay._buildOpAdviceHTML(advice);
};

MJSOverlay._buildOpAdviceHTML = (advice) => {
  if (!advice) return '';
  const col = advice.take ? 'var(--accent2)' : 'var(--danger)';
  const icon = advice.take ? '✓' : '✗';
  return `<div class="mjs-op-advice" style="border-color:${col}">
    <div class="mjs-op-advice-header" style="color:${col}">${icon} ${advice.action}: ${advice.take ? 'TAKE' : 'SKIP'}</div>
    <div class="mjs-op-advice-reason">${advice.reason}</div>
  </div>`;
};

// ── Main update ───────────────────────────────────────────────
MJSOverlay.update = (analysis) => {
  const content = document.getElementById('mjs-main-content');
  if (!content) return;
  if (!analysis?.valid) {
    content.innerHTML = `<div class="mjs-no-state"><div class="mjs-no-state-icon">⬛</div>${analysis?.reason||'Waiting for hand…'}</div>`;
    MJSOverlay._setStatus('waiting','Waiting…');
    return;
  }
  content.innerHTML = MJSOverlay._buildAnalysis(analysis);
  MJSOverlay._setStatus('active','Live');
  const el=document.getElementById('mjs-update-time');
  if(el) {
    const seen = analysis.visibleTileCount || 0;
    el.textContent=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'}) + (seen>0?` · ${seen} seen`:'');
  }
};

MJSOverlay._buildAnalysis = (a) => {
  const strategy = MJSOverlay._getStrategy(a);
  let html = '';

  // ── Strategy banner ───────────────────────────────────────
  html += `<div class="mjs-strategy-bar" style="border-left-color:${strategy.color}">
    <div class="mjs-strategy-goal" style="color:${strategy.color}">${strategy.goal}</div>
    <div class="mjs-strategy-advice">${strategy.advice}</div>
  </div>`;

  // ── Defence banner ───────────────────────────────────────
  if (a.defenceInfo?.defend) {
    const urgColor = a.defenceInfo.urgency === 'high' ? '#ff4444' : '#ff6b35';
    html += `<div class="mjs-defence-bar" style="border-left-color:${urgColor};background:rgba(255,40,40,0.08)">
      <div class="mjs-defence-title" style="color:${urgColor}">🛡 DEFENCE MODE</div>
      <div class="mjs-defence-reason">${a.defenceInfo.reason || ''} — discarding safest tiles</div>
    </div>`;
  } else if (a.defenceInfo?.riichiCount > 0) {
    html += `<div class="mjs-defence-bar" style="border-left-color:#ff6b35;background:rgba(255,100,0,0.05)">
      <div class="mjs-defence-title" style="color:#ff6b35">⚠ ${a.defenceInfo.riichiCount} Riichi</div>
      <div class="mjs-defence-reason">${a.defenceInfo.reason || 'Attacking — watch danger tiles'}</div>
    </div>`;
  }
  if (a.furitenWarning) {
    html += `<div class="mjs-defence-bar" style="border-left-color:#f59e0b;background:rgba(245,158,11,0.08)">
      <div class="mjs-defence-title" style="color:#f59e0b">⚠ FURITEN</div>
      <div class="mjs-defence-reason">You discarded your winning tile — cannot win by Ron</div>
    </div>`;
  }

  // ── Op advice (pon/chi popup) ─────────────────────────────
  html += `<div id="mjs-op-advice">${MJSOverlay._buildOpAdviceHTML(MJSOverlay._lastOpAdvice)}</div>`;

  // ── Discard recommendation ────────────────────────────────
  if (a.discardRanking?.length > 0) {
    const best = a.discardRanking[0];
    const second = a.discardRanking[1];
    const tenpaiAfter = best.shanten === -1;
    const delta = second ? (best.ukeireCount - second.ukeireCount) : 0;
    const confidence = delta >= 4 ? 'Strong pick' : delta >= 1 ? 'Good pick' : 'Marginal';
    const confColor = delta >= 4 ? 'var(--accent2)' : delta >= 1 ? 'var(--accent)' : 'var(--text-md)';
    html += `<div class="mjs-rec-box">
      <div class="mjs-rec-label">▶ DISCARD THIS TILE</div>
      <div class="mjs-rec-row">
        <div class="mjs-rec-tile-wrap">${MJSOverlay._tileHTML(best.tileCode,'xl')}</div>
        <div class="mjs-rec-details">
          <div class="mjs-rec-name">${MJSOverlay._name(best.tileCode)}</div>
          ${best.safetyLabel ? `<div class="mjs-rec-safety" style="color:${MJSOverlay._safetyColor(best.safetyScore)}">${MJSOverlay._safetyIcon(best.safetyScore)} ${best.safetyLabel}</div>` : ''}
          <div class="mjs-rec-sub ${tenpaiAfter?'tenpai':''}">${tenpaiAfter?'🎯 Reaches Tenpai!':a.shanten===0?'Gets you to Tenpai next':'Shanten '+best.shanten+' after'}</div>
          <div class="mjs-rec-outs"><span class="mjs-outs-n">${best.ukeireCount}</span> tiles that can improve your hand</div>
          <div class="mjs-rec-confidence" style="color:${confColor}">${confidence}${second?' — 2nd best: '+MJSOverlay._name(second.tileCode)+' ('+second.ukeireCount+' outs)':''}</div>
        </div>
      </div>
    </div>`;
  }

  // ── Tenpai winning tiles ──────────────────────────────────
  if (a.isTenpai && a.tenpaiTiles?.length > 0) {
    const total = a.tenpaiTiles.reduce((s,t)=>s+t.remaining,0);
    html += `<div class="mjs-win-box">
      <div class="mjs-rec-label">Winning tiles — ${total} left in wall</div>
      <div class="mjs-win-tiles">
        ${a.tenpaiTiles.map(wt=>`<div class="mjs-win-tile-wrap">${MJSOverlay._tileHTML(wt.tile,'sm')}<span class="mjs-win-count">×${wt.remaining}</span></div>`).join('')}
      </div>
    </div>`;
  }

  // ── 13-tile draw targets ──────────────────────────────────
  if (!a.discardRanking?.length && !a.isTenpai && a.tenpaiTiles?.length > 0) {
    const total = a.tenpaiTiles.reduce((s,t)=>s+t.remaining,0);
    html += `<div class="mjs-win-box">
      <div class="mjs-rec-label">Best draws — ${total} good tiles in wall</div>
      <div class="mjs-win-tiles">
        ${a.tenpaiTiles.slice(0,14).map(wt=>`<div class="mjs-win-tile-wrap">${MJSOverlay._tileHTML(wt.tile,'sm')}<span class="mjs-win-count">×${wt.remaining}</span></div>`).join('')}
      </div>
    </div>`;
  }

  // ── Shanten + hand info ───────────────────────────────────
  const bc = a.isTenpai?'tenpai':a.shanten<=1?'close':'far';
  const bt = a.isTenpai?'✓ Tenpai':a.shanten===0?'1 from Tenpai':`${a.shanten+1} from Tenpai`;
  html += `<div class="mjs-shanten-row">
    <span class="mjs-shanten-badge ${bc}">${bt}</span>
    <span class="mjs-hand-badge">${a.handType}${a.numMelds>0?` · ${a.numMelds} meld`:''}</span>
    ${a.valueEstimate?.estimatedHan>1?`<span class="mjs-han-badge">~${a.valueEstimate.estimatedHan} han</span>`:''}
  </div>`;

  html += `<div class="mjs-scrollable">`;

  // ── All discard options ───────────────────────────────────
  if (a.discardRanking?.length > 0) {
    html += `<div class="mjs-section"><div class="mjs-section-title">All options</div><div class="mjs-discard-list">`;
    a.discardRanking.forEach((item,idx)=>{
      const tenpai = item.shanten === -1;
      const safe   = item.isSafe;
      html += `<div class="mjs-discard-item${idx===0?' best':''}${safe?' safe':''}">
        <span class="mjs-rank">${idx+1}</span>
        ${MJSOverlay._tileHTML(item.tileCode,'sm')}
        <div class="mjs-discard-info">
          <div class="mjs-discard-name">${MJSOverlay._name(item.tileCode)}${safe?' <span class="mjs-safe-tag">SAFE</span>':''}</div>
          <div class="mjs-discard-detail">${tenpai?'🎯 Tenpai':item.shanten===0?'1 tile from tenpai':'Shanten '+item.shanten}${item.safetyLabel ? ' · <span style="color:'+MJSOverlay._safetyColor(item.safetyScore)+'">'+item.safetyLabel+'</span>' : ''}</div>
        </div>
        <div class="mjs-discard-ukeire-wrap">
          <span class="mjs-discard-ukeire">${item.ukeireCount}</span>
          <span class="mjs-discard-outs-label">outs</span>
        </div>
      </div>`;
    });
    html += `</div></div>`;
  }

  // ── Value flags ───────────────────────────────────────────
  if (a.valueEstimate?.flags.length > 0) {
    html += `<div class="mjs-section"><div class="mjs-section-title">Value potential</div>
      <span class="mjs-han-big">~${a.valueEstimate.estimatedHan}</span><span class="mjs-han-label"> han</span>
      <div class="mjs-flags">${a.valueEstimate.flags.map(f=>`<span class="mjs-flag">${f}</span>`).join('')}</div>
    </div>`;
  }

  html += `</div>`;
  return html;
};

// ── Action log ────────────────────────────────────────────────
MJSOverlay.updateLog = (log) => {
  const el = document.getElementById('mjs-action-log');
  if (!el || !log.length) return;
  el.innerHTML = log.slice(0,8).map(e =>
    `<div class="mjs-log-row">
      <span class="mjs-log-time">${e.t}</span>
      <span class="mjs-log-icon">${e.emoji}</span>
      <span class="mjs-log-msg">${e.msg}</span>
      ${e.detail ? `<span class="mjs-log-detail">${e.detail}</span>` : ''}
    </div>`
  ).join('');
};

MJSOverlay._setStatus=(state,text)=>{
  const d=document.getElementById('mjs-status-dot'),l=document.getElementById('mjs-status-text');
  if(d) d.className=`mjs-status-dot ${state}`;
  if(l) l.textContent=text;
};

MJSOverlay._safetyColor = (score) => {
  if (score >= 90) return '#4ade80';
  if (score >= 70) return '#86efac';
  if (score >= 50) return '#fbbf24';
  if (score >= 30) return '#fb923c';
  return '#f87171';
};
MJSOverlay._safetyIcon = (score) => {
  if (score >= 90) return '✅';
  if (score >= 70) return '🟢';
  if (score >= 50) return '🟡';
  if (score >= 30) return '🟠';
  return '🔴';
};

window.MJSOverlay = MJSOverlay;
