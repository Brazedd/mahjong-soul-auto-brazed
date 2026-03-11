// ============================================================
// autoplayer.js — Mahjong Soul Auto Brazed
// Action sequencing, humanisation, defence-aware discard
//
// Game API patterns (inputOperation, inputChiPengGang,
// NetAgent.sendReq2MJ, oplist-based turn detection)
// researched with reference to:
//   AlphaJong by Jimboom7
//   https://github.com/Jimboom7/AlphaJong
// ============================================================
'use strict';

const MJSAutoplayer = window.MJSAutoplayer || {};
MJSAutoplayer._enabled        = false;
MJSAutoplayer._lastPlayed     = 0;
MJSAutoplayer._minDelay       = 800;
MJSAutoplayer._maxDelay       = 1800;
MJSAutoplayer._pending        = null;   // discard timer
MJSAutoplayer._opPending      = null;   // op popup timer
MJSAutoplayer._lastOpShowing  = false;
MJSAutoplayer._lastCanDiscard = false;
MJSAutoplayer._lastHandLen    = 0;
MJSAutoplayer._afkInterval    = null;
MJSAutoplayer._afkTimer       = null;
MJSAutoplayer._fireTimers     = [];

// ── Action log ────────────────────────────────────────────────
MJSAutoplayer._log = [];
MJSAutoplayer._addLog = (emoji, msg, detail='') => {
  const t = new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  MJSAutoplayer._log.unshift({ t, emoji, msg, detail });
  if (MJSAutoplayer._log.length > 12) MJSAutoplayer._log.pop();
  try { MJSOverlay.updateLog(MJSAutoplayer._log); } catch(e) {}
};

// ── Settings ──────────────────────────────────────────────────
MJSAutoplayer.settings = {
  takePon:      true,
  takeChi:      true,
  takeKan:      false,
  meldMinDelta: 1,
  alwaysWin:    true,
};

// ── Game script ───────────────────────────────────────────────
MJSAutoplayer._script = () => {
  try { return window.GameMgr.Inst._scene_mj.desktop._childs[2]._scripts[0]; }
  catch(e) { return null; }
};

// ── Enable / Disable ──────────────────────────────────────────
MJSAutoplayer.setEnabled = (en) => {
  MJSAutoplayer._enabled = en;
  if (!en) {
    clearTimeout(MJSAutoplayer._pending);
    clearTimeout(MJSAutoplayer._opPending);
    MJSAutoplayer._fireTimers.forEach(t => clearTimeout(t));
    MJSAutoplayer._fireTimers     = [];
    MJSAutoplayer._pending        = null;
    MJSAutoplayer._opPending      = null;
    MJSAutoplayer._lastOpShowing  = false;
    MJSAutoplayer._lastCanDiscard = false;
MJSAutoplayer._lastHandLen    = 0;
MJSAutoplayer._afkInterval    = null;
    clearInterval(MJSAutoplayer._afkTimer);
    MJSAutoplayer._afkTimer = null;
    // Send a neutral mouseup to unstick canvas if needed
    try {
      const canvas = document.querySelector('canvas');
      if (canvas) {
        const r = canvas.getBoundingClientRect();
        canvas.dispatchEvent(new MouseEvent('mouseup', {
          bubbles:true, clientX: r.left + r.width*0.5, clientY: r.top + r.height*0.5,
          button:0, buttons:0, view:window
        }));
      }
    } catch(e) {}
  } else {
    // AFK prevention: call OperationTimeOut reset method if available
    // Otherwise just keep a heartbeat that doesn't touch mouse events
    MJSAutoplayer._afkTimer = setInterval(() => {
      if (!MJSAutoplayer._enabled) return;
      try {
        const s = MJSAutoplayer._script();
        // Call OperationTimeOut with a large number to reset it
        if (s && typeof s.OperationTimeOut === 'function') {
          // Don't actually call — just reading it keeps connection alive
        }
        // Send a no-op keyboard event instead of mouse — less intrusive
        document.dispatchEvent(new Event('visibilitychange'));
      } catch(e) {}
    }, 20000);
  }
  console.log(`[MJS Autopilot] ${en ? '⚠ ENABLED' : 'Disabled'}`);
};
MJSAutoplayer.isEnabled = () => MJSAutoplayer._enabled;
MJSAutoplayer.setDelays = (min, max) => {
  MJSAutoplayer._minDelay = Math.max(300, min);
  MJSAutoplayer._maxDelay = Math.max(MJSAutoplayer._minDelay + 300, max);
};

// ══════════════════════════════════════════════════════════════
// HUMANIZATION — Realistic timing and behavior
// ══════════════════════════════════════════════════════════════

MJSAutoplayer._humanState = {
  fatigue:      0,     // 0-1, increases over time, slows play
  lastMoveTime: 0,
  moveCount:    0,
  sessionStart: Date.now(),
};

// Human-like delay: gaussian-ish distribution with occasional long pauses
MJSAutoplayer._humanDelay = (min, max) => {
  const state = MJSAutoplayer._humanState;

  // Base delay with bell-curve distribution (sum of randoms ≈ normal)
  const r = () => Math.random();
  const base = min + (r()+r()+r()) / 3 * (max - min);

  // Fatigue factor: play slightly slower over time
  const elapsed = (Date.now() - state.sessionStart) / 1000 / 60; // minutes
  state.fatigue = Math.min(0.4, elapsed / 60); // max 40% slower after 1hr
  const fatigueMult = 1 + state.fatigue;

  // Occasional "thinking" pause (5% chance of longer pause)
  const thinkPause = Math.random() < 0.05 ? (1000 + Math.random() * 3000) : 0;

  // Very occasional "distracted" pause (1% chance, 3-8 seconds)
  const distracted = Math.random() < 0.01 ? (3000 + Math.random() * 5000) : 0;

  const delay = base * fatigueMult + thinkPause + distracted;
  if (thinkPause > 0) console.log(`[MJS] Thinking pause: ${thinkPause.toFixed(0)}ms`);
  if (distracted > 0) console.log(`[MJS] Distracted pause: ${distracted.toFixed(0)}ms`);

  state.moveCount++;
  state.lastMoveTime = Date.now();
  return Math.round(delay);
};

// Simulate mouse movement toward a tile before discarding
MJSAutoplayer._simulateMouseMove = (idx, total) => {
  try {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    const tileW = (r.width * 0.58) / total;
    const x = r.left + r.width * 0.30 + (idx + 0.5) * tileW + (Math.random()-0.5)*8;
    const y = r.top + r.height * 0.885 + (Math.random()-0.5)*6;
    canvas.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true, clientX: x, clientY: y,
      movementX: (Math.random()-0.5)*20, movementY: (Math.random()-0.5)*10,
      view: window
    }));
  } catch(e) {}
};

// ══════════════════════════════════════════════════════════════
// OPERATION EXECUTION — WhenDoOperation only
// Confirmed working: clears oplist, submits to server
// ══════════════════════════════════════════════════════════════
MJSAutoplayer._doOperation = (s, opEntry, label) => {
  console.log(`[MJS] ${label} → type=${opEntry?.type}`);
  const emoji = label.startsWith('Skip') ? '⏩' :
    label==='RON'||label==='TSUMO' ? '🏆' :
    label==='PON' ? '🀆' : label==='CHI' ? '🀅' : '▶';
  MJSAutoplayer._addLog(emoji, label, `op:${opEntry?.type}`);

  const opType = opEntry?.type;
  const ops    = mjcore?.E_PlayOperation || {};

  try {
    // Skip / pass — just clear the operation
    if (opType === (ops.none ?? 0) || opType === 1) {
      // AlphaJong: cancel_operation for skip
      app.NetAgent.sendReq2MJ('FastTest', 'inputChiPengGang', { cancel_operation: true, timeuse: 2 });
      s.WhenDoOperation();
      return true;
    }

    // Chi / Pon / Kan — use inputChiPengGang like AlphaJong
    const callTypes = [ops.eat??2, ops.peng??3, ops.ming_gang??5, ops.an_gang??4, ops.add_gang??6];
    if (callTypes.includes(opType)) {
      const combo  = opEntry.combination || [];
      const option = opEntry._selectedOption ?? 0;
      app.NetAgent.sendReq2MJ('FastTest', 'inputChiPengGang', {
        type: opType,
        index: option,
        timeuse: Math.random() * 2 + 1
      });
      s.WhenDoOperation();
      return true;
    }

    // Ron / Tsumo — inputOperation
    if (opType === (ops.rong??9) || opType === (ops.zimo??8)) {
      app.NetAgent.sendReq2MJ('FastTest', 'inputOperation', {
        type: opType,
        timeuse: Math.random() * 2 + 1
      });
      s.WhenDoOperation();
      return true;
    }

    // Fallback: original WhenDoOperation
    if (typeof s.WhenDoOperation === 'function') {
      s.WhenDoOperation(opEntry);
      return true;
    }
  } catch(e) { console.warn('[MJS] operation error:', e.message); }

  // Fallback for skip only
  try {
    if (opEntry.type === 1 && typeof s.ClearOperationShow === 'function') {
      s.ClearOperationShow();
      return true;
    }
  } catch(e) {}

  console.warn('[MJS] Operation failed — no method worked');
  return false;
};

// ── Helpers ───────────────────────────────────────────────────
MJSAutoplayer._getSkipEntry = (oplist) => {
  if (!Array.isArray(oplist)) return { type:1, combination:[] };
  return oplist.find(o => o.type === 1) || { type:1, combination:[] };
};
MJSAutoplayer._getOpEntry = (oplist, type) => {
  if (!Array.isArray(oplist)) return null;
  return oplist.find(o => o.type === type) || null;
};

// ── Meld evaluation ───────────────────────────────────────────
MJSAutoplayer._decodeCombTile = (entry) => {
  if (!entry) return 0;
  if (typeof entry === 'object' && entry.type !== undefined)
    return MJSDetector._tileValToCode(entry);
  if (typeof entry === 'string') {
    const m = entry.match(/^(\d+)([mpsz])$/);
    if (!m) return 0;
    const [,n,suit] = m;
    if (suit==='m') return 10+parseInt(n);
    if (suit==='p') return 20+parseInt(n);
    if (suit==='s') return 30+parseInt(n);
    if (suit==='z') return ({1:41,2:42,3:43,4:44,5:45,6:46,7:47})[n]||0;
  }
  return 0;
};

MJSAutoplayer._evaluateMeld = (s, opType, combo) => {
  try {
    const hand = s.mainrole.hand
      .map(t => t?.val ? MJSDetector._tileValToCode(t.val) : 0)
      .filter(c => c > 0);
    if (hand.length < 3) return { take:false, reason:'hand too small' };

    const curShanten = MJSShanten.calculateAll(hand).best;
    if (curShanten <= 0) return { take:false, reason:'already tenpai' };

    const comboTiles = Array.isArray(combo)
      ? combo.map(MJSAutoplayer._decodeCombTile).filter(c=>c>0) : [];

    if (comboTiles.length === 0)
      return { take: opType===3, reason: opType===3 ? 'pon (no combo data)' : 'chi skip (no combo)' };

    const rem = [...hand];
    for (const tile of comboTiles) {
      const idx = rem.indexOf(tile);
      if (idx === -1) return { take:false, reason:`tile ${tile} not in hand` };
      rem.splice(idx, 1);
    }

    const afterShanten = MJSShanten.calculateAll(rem).best;
    const delta = curShanten - afterShanten;

      // Don't call melds if an opponent is in riichi — too dangerous to open
    try {
      const opponents = MJSDefense.getOpponentRiichiStatus();
      const riichiCount = opponents.filter(o => o.inRiichi).length;
      if (riichiCount > 0) return { take:false, reason:`riichi active — skipping meld` };
    } catch(e) {}

    if (opType===3 && MJSAutoplayer.settings.takePon && delta>=0)
      return { take:true, reason:`pon improves by ${delta}` };
    if (opType===2 && MJSAutoplayer.settings.takeChi && delta>=MJSAutoplayer.settings.meldMinDelta)
      return { take:true, reason:`chi improves by ${delta}` };
    return { take:false, reason:`delta ${delta} below threshold` };
  } catch(e) {
    return { take:false, reason:'eval error' };
  }
};

// ── Main tick ─────────────────────────────────────────────────
MJSAutoplayer.tick = (analysis) => {
  const s = MJSAutoplayer._script();
  if (!s) return;

  // Detect when hand changes (new tile drawn) — reset cooldown
  const currentHandLen = s.mainrole?.hand?.filter(t=>t?.val).length || 0;
  if (currentHandLen !== MJSAutoplayer._lastHandLen) {
    MJSAutoplayer._lastHandLen = currentHandLen;
    if (currentHandLen === 14) MJSAutoplayer._lastPlayed = 0; // new tile drawn, ready to act
  }

  const oplist    = Array.isArray(s.oplist) ? s.oplist : [];
  const opTypes   = oplist.map(o => o.type);
  const ops       = mjcore?.E_PlayOperation || {};

  // dapai=1 in oplist means it's OUR discard turn (not a call popup)
  const isDiscardTurn = opTypes.includes(ops.dapai ?? 1);
  // A real call popup has chi/pon/skip but NOT dapai
  const opShowing = s.operation_showing === true && !isDiscardTurn;

  // Queue action for CALL popups only (chi/pon/skip) — not discard turns
  if (opShowing && MJSAutoplayer._enabled && !MJSAutoplayer._opPending) {
    const delay = MJSAutoplayer._lastOpShowing ? 150 : (500 + Math.random() * 600);
    console.log(`[MJS] Call popup types=[${opTypes}] queuing in ${delay.toFixed(0)}ms`);

    MJSAutoplayer._opPending = setTimeout(() => {
      MJSAutoplayer._opPending = null;
      if (!MJSAutoplayer._enabled) return;
      const s2 = MJSAutoplayer._script();
      if (!s2?.operation_showing) return;
      MJSAutoplayer._handleOp(s2);
    }, delay);
  }

  if (!opShowing && MJSAutoplayer._opPending) {
    clearTimeout(MJSAutoplayer._opPending);
    MJSAutoplayer._opPending = null;
  }
  MJSAutoplayer._lastOpShowing = opShowing;

  // Discard — only skip if it's a real call popup
  if (!MJSAutoplayer._enabled || opShowing) return;

  const hand        = s.mainrole?.hand || [];
  const handLen     = hand.filter(t=>t?.val).length;
  const validCount  = hand.filter(t=>t?.valid).length;
  // Post-call discard: 13 tiles, all valid, oplist empty, not a call popup
  const postCallDiscard = !opShowing && handLen === 13 && validCount > 0 && opTypes.length === 0;
  const canDiscard  = isDiscardTurn || s.mainrole?.can_discard === true || postCallDiscard;
  const inRiichi    = opTypes.includes(ops.liqi ?? 7);

  const riichiCooldown = MJSAutoplayer._lastPlayed > 0 && (Date.now() - MJSAutoplayer._lastPlayed) < (MJSAutoplayer._maxDelay + 1000);
  // General discard cooldown: don't re-trigger within 3s of last discard
  // If hand hasn't changed and we've sent >3 attempts, back off for 8s (server likely rejected)
  const timeSinceLast = Date.now() - MJSAutoplayer._lastPlayed;
  MJSAutoplayer._sameHandAttempts = MJSAutoplayer._sameHandAttempts || 0;
  if (MJSAutoplayer._lastHandStr === (s.mainrole?.hand||[]).filter(t=>t?.val).map(t=>MJSDetector._tileValToCode(t.val)).join(',')) {
    // hand hasn't changed since last tick — check if we're stuck
  } else {
    MJSAutoplayer._sameHandAttempts = 0;
    MJSAutoplayer._lastHandStr = (s.mainrole?.hand||[]).filter(t=>t?.val).map(t=>MJSDetector._tileValToCode(t.val)).join(',');
  }
  const backoffTime = MJSAutoplayer._sameHandAttempts > 3 ? 8000 : 3000;
  const discardCooldown = MJSAutoplayer._lastPlayed > 0 && timeSinceLast < backoffTime;
  if (discardCooldown && MJSAutoplayer._sameHandAttempts > 3 && timeSinceLast > 4000) {
    // Looks like server rejected — reset attempts counter after backoff
    MJSAutoplayer._sameHandAttempts = 0;
  }
  if (inRiichi && !MJSAutoplayer._pending && !riichiCooldown) {
    console.log('[MJS] Riichi state detected — declaring riichi');
    // Riichi takes longer — player is deciding
    const delay = MJSAutoplayer._humanDelay(
      MJSAutoplayer._minDelay * 1.5,
      MJSAutoplayer._maxDelay * 1.5
    );
    MJSAutoplayer._pending = setTimeout(() => {
      MJSAutoplayer._pending = null;
      if (!MJSAutoplayer._enabled) return;
      const s2 = MJSAutoplayer._script();
      if (!s2) return;
      // Check if still in riichi state
      if (s2.mainrole?.liqiOperation !== 7) return;
      MJSAutoplayer._lastPlayed = Date.now(); // prevent re-trigger while acting
      const hand = s2.mainrole?.hand;
      if (!hand) return;

      // Find best tile to discard for riichi using analysis engine
      // The best riichi discard = tile that leaves us tenpai with most outs
      let idx = hand.length - 1; // default: last drawn tile
      try {
        const handCodes = hand.map(t => t?.val ? MJSDetector._tileValToCode(t.val) : 0).filter(c=>c>0);
        const state     = MJSDetector.getState();
        const analysis  = MJSAnalyzer.analyze({ ...state, hand: handCodes });
        if (analysis?.valid && analysis.discardRanking?.length > 0) {
          // Find the hand index of the best discard tile
          const bestCode = analysis.discardRanking[0].tileCode;
          const normBest = MJS.normalize(bestCode);
          const typeMap  = { man:1, pin:0, sou:2, honor:3 };
          const tType    = typeMap[MJS.getSuit(normBest)];
          const tNum     = MJS.getNumber(normBest);
          for (let i = 0; i < hand.length; i++) {
            if (hand[i]?.val?.type === tType && hand[i]?.val?.index === tNum) {
              idx = i; break;
            }
          }
          console.log(`[MJS] Riichi best discard: ${analysis.discardRanking[0].tileCode} → hand[${idx}]`);
        }
      } catch(e) { console.warn('[MJS] Riichi analysis failed, using last tile:', e.message); }

      // AlphaJong confirmed riichi method: app.NetAgent.sendReq2MJ
      MJSAutoplayer._addLog('🎯', 'Riichi!', `tile[${idx}]`);
      const riichiTile = hand[idx];
      const isMoqie   = idx === hand.length - 1;
      // Tile name format used by the game e.g. "1m", "9p", "3z"
      const tileVal   = riichiTile?.val;
      const suitMap   = {0:'p', 1:'m', 2:'s', 3:'z'};
      const tileName  = tileVal ? `${tileVal.index}${suitMap[tileVal.type] ?? 'z'}` : null;
      console.log(`[MJS] Riichi sendReq2MJ tile=${tileName} moqie=${isMoqie}`);
      try {
        app.NetAgent.sendReq2MJ('FastTest', 'inputOperation', {
          type: mjcore.E_PlayOperation.liqi,
          tile: tileName,
          moqie: isMoqie,
          timeuse: Math.random() * 2 + 1
        });
        // Also call WhenDoOperation to clear the UI state
        s2.WhenDoOperation({ type: 7 });
      } catch(e) {
        console.warn('[MJS] sendReq2MJ riichi failed:', e.message);
        // Fallback: _choose_pai + DoDiscardTile
        try {
          const r2 = s2.mainrole;
          r2._choose_pai = riichiTile;
          r2.DoDiscardTile();
        } catch(e2) {
          MJSAutoplayer._clickTileByIndex(idx, hand.length);
        }
      }
    }, delay);
    return;
  }

  if (canDiscard && !MJSAutoplayer._pending && !discardCooldown) {
    const elapsed = Date.now() - MJSAutoplayer._lastPlayed;
    if (MJSAutoplayer._lastPlayed > 0 && elapsed < MJSAutoplayer._minDelay) return;

    // Use the same analysis the overlay shows — from _lastAnalysis via MJS.analyze()
    let discard = null;
    try {
      // Always do fresh analysis from live hand with correct meld count
      const liveHand = (s.mainrole?.hand || [])
        .map(t => t?.val ? MJSDetector._tileValToCode(t.val) : 0)
        .filter(c => c > 0);
      const meldCount = (s.mainrole?.container_ming?.mings || [])
        .filter(m => m && Array.isArray(m.pais) && m.pais.length > 0).length;
      const state = MJSDetector.getState();
      const fresh = MJSAnalyzer.analyze({ ...state, hand: liveHand, meldCount });
      // Update overlay with fresh analysis so it stays in sync
      if (fresh?.valid) {
        window._MJSLastAnalysis = fresh;
        try { MJSOverlay.update(fresh); } catch(e) {}
      }
      // Log defence status
      if (fresh?.defenceInfo?.defend) {
        console.log(`[MJS] ⚠ DEFENCE MODE — ${fresh.defenceInfo.reason}`);
        MJSAutoplayer._addLog('🛡', 'Defence mode', fresh.defenceInfo.reason);
      }
      if (fresh?.furitenWarning) {
        console.warn('[MJS] ⚠ FURITEN — tenpai tile in own discards');
        MJSAutoplayer._addLog('⚠', 'Furiten!', 'Win tile already discarded');
      }
      discard = fresh?.bestDiscard || fresh?.discardRanking?.[0] || null;
      if (discard) {
        const mode = fresh?.defenceInfo?.defend ? '🛡DEF' : '⚔ATK';
        console.log(`[MJS] ${mode} shanten=${fresh.shanten} discard=${discard?.tileCode ?? discard} safety=${discard?.safetyLabel ?? '?'} melds=${meldCount}`);
      }
    } catch(e) { console.warn('[MJS] Analysis error:', e.message); }
    // Fallback: pick first valid tile if analysis failed
    if (!discard) {
      const fallbackHand = s.mainrole?.hand || [];
      const fallbackTile = fallbackHand.find(t => t?.valid && t?.val);
      if (fallbackTile) {
        discard = MJSDetector._tileValToCode(fallbackTile.val);
        console.log('[MJS] Analysis failed, falling back to first valid tile:', discard);
      } else {
        return;
      }
    }

    const delay = MJSAutoplayer._humanDelay(MJSAutoplayer._minDelay, MJSAutoplayer._maxDelay);

    MJSAutoplayer._sameHandAttempts = (MJSAutoplayer._sameHandAttempts || 0) + 1;
    MJSAutoplayer._pending = setTimeout(() => {
      MJSAutoplayer._pending = null;
      if (!MJSAutoplayer._enabled) return;
      const s2 = MJSAutoplayer._script();
      // operation_showing is true during discard turns too, so only block real call popups
      const s2oplist  = Array.isArray(s2.oplist) ? s2.oplist : [];
      const s2types   = s2oplist.map(o => o.type);
      const s2isDapai = s2types.includes(mjcore?.E_PlayOperation?.dapai ?? 1);
      const s2isCallPopup = s2.operation_showing && !s2isDapai;
      if (s2isCallPopup) return;
      if (!s2?.mainrole?.can_discard && !s2isDapai) return;
      MJSAutoplayer._discardTile(discard);
      MJSAutoplayer._lastPlayed = Date.now();
    }, delay);
  }

  if (!canDiscard && MJSAutoplayer._pending) {
    clearTimeout(MJSAutoplayer._pending);
    MJSAutoplayer._pending = null;
  }
  MJSAutoplayer._lastCanDiscard = canDiscard;
};

// ── Handle operation popup ────────────────────────────────────
MJSAutoplayer._handleOp = (s) => {
  const oplist    = Array.isArray(s.oplist) ? s.oplist : [];
  const types     = oplist.map(o => o.type);
  const skipEntry = MJSAutoplayer._getSkipEntry(oplist);

  // Win
  if (types.includes(10)) {
    const e = MJSAutoplayer._getOpEntry(oplist, 10);
    MJSAutoplayer._doOperation(s, MJSAutoplayer.settings.alwaysWin ? e : skipEntry,
      MJSAutoplayer.settings.alwaysWin ? 'RON' : 'Skip-Ron');
    return;
  }
  if (types.includes(9)) {
    const e = MJSAutoplayer._getOpEntry(oplist, 9);
    MJSAutoplayer._doOperation(s, MJSAutoplayer.settings.alwaysWin ? e : skipEntry,
      MJSAutoplayer.settings.alwaysWin ? 'TSUMO' : 'Skip-Tsumo');
    return;
  }

  // Pon
  if (types.includes(3)) {
    const e  = MJSAutoplayer._getOpEntry(oplist, 3);
    const ev = MJSAutoplayer._evaluateMeld(s, 3, e?.combination?.[0]);
    try { MJSOverlay.setOpAdvice({ action:'Pon', take:ev.take, reason:ev.reason }); } catch(_) {}
    MJSAutoplayer._doOperation(s, ev.take ? e : skipEntry, ev.take ? 'PON' : 'Skip-Pon');
    return;
  }

  // Chi
  if (types.includes(2)) {
    const e  = MJSAutoplayer._getOpEntry(oplist, 2);
    const ev = MJSAutoplayer._evaluateMeld(s, 2, e?.combination?.[0]);
    try { MJSOverlay.setOpAdvice({ action:'Chi', take:ev.take, reason:ev.reason }); } catch(_) {}
    MJSAutoplayer._doOperation(s, ev.take ? e : skipEntry, ev.take ? 'CHI' : 'Skip-Chi');
    return;
  }

  // Kan
  for (const kt of [4,5,6]) {
    if (types.includes(kt)) {
      const e = MJSAutoplayer._getOpEntry(oplist, kt);
      MJSAutoplayer._doOperation(s, MJSAutoplayer.settings.takeKan ? e : skipEntry,
        MJSAutoplayer.settings.takeKan ? 'KAN' : 'Skip-Kan');
      return;
    }
  }

  // Skip-only popup
  MJSAutoplayer._doOperation(s, skipEntry, 'Skip');
};

// ── Discard tile by clicking it ───────────────────────────────
MJSAutoplayer._discardTile = (discardInfo) => {
  try {
    const s    = MJSAutoplayer._script();
    const hand = s?.mainrole?.hand;
    if (!Array.isArray(hand)) return;

    // discardInfo can be an object {tileCode, label} or a raw tile code number
    const tileCode = (typeof discardInfo === 'object') ? discardInfo.tileCode : discardInfo;
    const label    = (typeof discardInfo === 'object') ? (discardInfo.label || tileCode) : tileCode;

    const typeMap = { man:1, pin:0, sou:2, honor:3 };
    const norm    = MJS.normalize(tileCode);
    const tType   = typeMap[MJS.getSuit(norm)];
    const tNum    = MJS.getNumber(norm);

    let idx = -1;
    // First try: exact type+index match among valid tiles
    for (let i = 0; i < hand.length; i++) {
      if (hand[i]?.val?.type === tType && hand[i]?.val?.index === tNum && hand[i]?.valid) {
        idx = i; break;
      }
    }
    // Second try: exact type+index match ignoring valid flag (honors may have valid=false)
    if (idx === -1) {
      for (let i = 0; i < hand.length; i++) {
        if (hand[i]?.val?.type === tType && hand[i]?.val?.index === tNum) {
          idx = i; break;
        }
      }
    }
    // Last resort: first valid tile
    if (idx === -1) idx = hand.findIndex(t => t?.valid);
    if (idx === -1) idx = hand.length - 1;

    MJSAutoplayer._addLog('🗑', `Discard ${label}`, `tile[${idx}]`);
    console.log(`[MJS] Discarding: code=${tileCode} label=${label} idx=${idx}`);
    // Simulate mouse hover before discard
    MJSAutoplayer._simulateMouseMove(idx, hand.length);
    setTimeout(() => MJSAutoplayer._doDiscardByIndex(idx, hand.length, tileCode), 80 + Math.random()*120);
  } catch(e) { console.error('[MJS] Discard error:', e); }
};

MJSAutoplayer._doDiscardByIndex = (idx, total, tileCode) => {
  try {
    const s = MJSAutoplayer._script();
    const r = s?.mainrole;
    if (!r) { MJSAutoplayer._clickTileByIndex(idx, total); return; }
    const tile = r.hand?.[idx];
    if (!tile?.val) { MJSAutoplayer._clickTileByIndex(idx, total); return; }

    const suitMap  = {0:'p', 1:'m', 2:'s', 3:'z'};
    const tileName = `${tile.val.index}${suitMap[tile.val.type] ?? 'z'}`;
    const isMoqie  = idx === (r.hand.length - 1);

    // Verify the tile at this index matches what we think we're discarding
    // (guards against index drift between analysis and actual discard)
    const actualCode = MJSDetector._tileValToCode(tile.val);
    const normActual = MJS.normalize(actualCode);
    const normTarget = MJS.normalize(tileCode);  // tileCode captured in closure above
    if (normActual !== normTarget) {
      console.warn(`[MJS] Tile mismatch at idx=${idx}: expected ${normTarget} got ${normActual} — aborting discard`);
      return;
    }

    // Use direct NetAgent call — confirmed working in all states
    app.NetAgent.sendReq2MJ('FastTest', 'inputOperation', {
      type: mjcore.E_PlayOperation.dapai,
      tile: tileName,
      moqie: isMoqie,
      timeuse: Math.random() * 2 + 1
    });
    console.log(`[MJS] NetAgent discard: ${tileName} moqie=${isMoqie}`);
    MJSAutoplayer._lastPlayed = Date.now(); // cooldown — prevent spam
    MJSAutoplayer._lastSentTile = tileName; // track for rejection detection
  } catch(e) {
    console.warn('[MJS] NetAgent discard error:', e.message);
    // Fallback: _choose_pai + DoDiscardTile
    try {
      const r2 = MJSAutoplayer._script()?.mainrole;
      if (r2) { r2._choose_pai = r2.hand?.[idx]; r2.DoDiscardTile(); }
    } catch(e2) {
      MJSAutoplayer._clickTileByIndex(idx, total);
    }
  }
};

MJSAutoplayer._clickTileByIndex = (idx, total) => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return;
  const r     = canvas.getBoundingClientRect();
  const tileW = (r.width * 0.58) / Math.max(total, 1);
  const x     = r.left + r.width * 0.30 + (idx + 0.5) * tileW;
  const y     = r.top  + r.height * 0.885;
  console.log(`[MJS] Click tile[${idx}/${total}] at (${Math.round(x)},${Math.round(y)})`);
  MJSAutoplayer._fire(canvas, x, y);
  // Second click after short delay (tile select + confirm)
  const t2 = setTimeout(() => {
    MJSAutoplayer._fireTimers = MJSAutoplayer._fireTimers.filter(t=>t!==t2);
    if (!MJSAutoplayer._enabled) return;
    MJSAutoplayer._fire(canvas, x, y);
  }, 250 + Math.random()*100);
  MJSAutoplayer._fireTimers.push(t2);
};

MJSAutoplayer._fire = (target, x, y) => {
  const o = { bubbles:true, cancelable:true, clientX:x, clientY:y,
    screenX:x, screenY:y, button:0, buttons:1, view:window };
  target.dispatchEvent(new MouseEvent('mousemove', o));
  target.dispatchEvent(new MouseEvent('mousedown', o));
  const t = setTimeout(() => {
    MJSAutoplayer._fireTimers = MJSAutoplayer._fireTimers.filter(x=>x!==t);
    target.dispatchEvent(new MouseEvent('mouseup',  {...o, buttons:0}));
    target.dispatchEvent(new MouseEvent('click',    {...o, buttons:0}));
  }, 40 + Math.random()*20);
  MJSAutoplayer._fireTimers.push(t);
};

// ── Calibration ───────────────────────────────────────────────
MJSAutoplayer._cal = {};
MJSAutoplayer._loadSaved = () => {
  try {
    const d = JSON.parse(localStorage.getItem('mjs-btn-pos') || '{}');
    if (d.action) MJSAutoplayer._cal.action = d.action;
    if (d.skip)   MJSAutoplayer._cal.skip   = d.skip;
  } catch(e) {}
};
MJSAutoplayer._loadSaved();
MJSAutoplayer.startCalibration  = () => console.log('[MJS] Calibration not needed — using WhenDoOperation');
MJSAutoplayer.clearCalibration  = () => { MJSAutoplayer._cal = {}; };

// ── Debug ─────────────────────────────────────────────────────
MJSAutoplayer.debugOplist = () => {
  try {
    const s = MJSAutoplayer._script();
    console.log('operation_showing:', s.operation_showing);
    console.log('can_discard:', s.mainrole?.can_discard);
    console.log('hand.length:', s.mainrole?.hand?.length);
    console.log('oplist:', JSON.stringify(s.oplist));
    console.log('WhenDoOperation:', typeof s.WhenDoOperation);
    console.log('autopilot on:', MJSAutoplayer._enabled);
    console.log('opPending:', !!MJSAutoplayer._opPending);
  } catch(e) { console.error(e); }
};

window.MJSAutoplayer = MJSAutoplayer;
