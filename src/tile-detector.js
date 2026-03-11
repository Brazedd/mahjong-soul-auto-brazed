// ============================================================
// tile-detector.js v5 — Correct man/pin mapping + robust meld detection
// CONFIRMED game encoding: type 0=pin, type 1=man, type 2=sou, type 3=honor
// ============================================================
'use strict';

const MJSDetector = window.MJSDetector || {};

MJSDetector._gameState = {
  hand: [], discards: [], openMelds: [],
  opponentDiscards: [], opponentMeldTiles: [], dora: [],
  seatWind: null, roundWind: null,
  lastUpdate: 0, isMyTurn: false, gamePhase: 'unknown',
  meldCount: 0
};

MJSDetector._listeners   = [];
MJSDetector._wsHooked    = false;
MJSDetector._pollTimer   = null;
MJSDetector._lastHandStr = '';

// CONFIRMED: type 0=pin, type 1=man, type 2=sou, type 3=honor
MJSDetector._tileValToCode = (val) => {
  if (!val || val.type === undefined || val.index === undefined) return 0;
  const { type, index, dora } = val;
  if (type === 1) { if (index === 5 && dora) return 51; return 10 + index; } // man
  if (type === 0) { if (index === 5 && dora) return 52; return 20 + index; } // pin
  if (type === 2) { if (index === 5 && dora) return 53; return 30 + index; } // sou
  if (type === 3) { return ({1:41,2:42,3:43,4:44,5:45,6:46,7:47})[index] || 0; }
  return 0;
};

MJSDetector._getGameScript = () => {
  try { return window.GameMgr.Inst._scene_mj.desktop._childs[2]._scripts[0]; }
  catch(e) { return null; }
};

// ── Count melds robustly ──────────────────────────────────────
MJSDetector._countMelds = (role) => {
  try {
    const mings = role.container_ming?.mings;
    if (!Array.isArray(mings)) return 0;
    // Count any ming with pais array of length > 0 — val may be undefined
    return mings.filter(m => m && Array.isArray(m.pais) && m.pais.length > 0).length;
  } catch(e) { return 0; }
};

// ── Poll ──────────────────────────────────────────────────────
MJSDetector._pollGameObjects = () => {
  try {
    const script = MJSDetector._getGameScript();
    if (!script?.mainrole) return;
    const hand = script.mainrole.hand;
    if (!Array.isArray(hand)) return;

    const meldCount = MJSDetector._countMelds(script.mainrole);
    // Valid hand sizes: 13-3N (waiting) or 14-3N (just drew), for N=0..4 melds
    const minValid = 13 - meldCount * 3;
    const maxValid = 14 - meldCount * 3;

    // Accept any hand that's within range, or at least 1 tile
    const handLen = hand.filter(t => t?.val).length;
    if (handLen >= 1) {
      MJSDetector._extractFromGameManager(script, meldCount);
    }
  } catch(e) {}
};

// ── Extract ───────────────────────────────────────────────────
MJSDetector._extractFromGameManager = (script, meldCount) => {
  try {
    const role = script.mainrole;
    if (!role || !Array.isArray(role.hand)) return;

    // ── Open melds ──
    const openMelds = [];
    try {
      const mings = role.container_ming?.mings;
      if (Array.isArray(mings)) {
        for (const m of mings) {
          if (!m) continue;
          const tiles = [];
          if (Array.isArray(m.pais)) {
            for (const p of m.pais) {
              if (p?.val) {
                const code = MJSDetector._tileValToCode(p.val);
                if (code > 0) tiles.push(code);
              }
            }
          }
          if (tiles.length > 0) openMelds.push({ type: m.type || 'meld', tiles });
        }
      }
    } catch(e) {}

    const detectedMelds = openMelds.length;

    // ── Hand ──
    const hand = role.hand
      .map(t => t?.val ? MJSDetector._tileValToCode(t.val) : 0)
      .filter(t => t > 0);

    // Accept any hand with tiles — size check done at discard time
    if (hand.length < 1) return;

    // ── Own discards ──
    const discards = [];
    try {
      const pais = role.container_qipai?.pais;
      if (Array.isArray(pais)) {
        for (const p of pais) {
          if (p?.val) {
            const code = MJSDetector._tileValToCode(p.val);
            if (code > 0) discards.push(code);
          }
        }
      }
    } catch(e) {}

    // ── Opponent discards + open melds ──
    const opponentDiscards = [];
    const opponentMeldTiles = [];
    try {
      const players = script.players;
      if (Array.isArray(players)) {
        for (const p of players) {
          if (!p || p === role) continue;
          // Discards
          const pais = p.container_qipai?.pais;
          if (Array.isArray(pais)) {
            for (const tile of pais) {
              if (tile?.val) {
                const code = MJSDetector._tileValToCode(tile.val);
                if (code > 0) opponentDiscards.push(code);
              }
            }
          }
          // Open melds (pon/chi) — these tiles are also gone from the wall
          const mings = p.container_ming?.mings;
          if (Array.isArray(mings)) {
            for (const m of mings) {
              if (!m || !Array.isArray(m.pais)) continue;
              for (const tile of m.pais) {
                if (tile?.val) {
                  const code = MJSDetector._tileValToCode(tile.val);
                  if (code > 0) opponentMeldTiles.push(code);
                }
              }
            }
          }
        }
      }
    } catch(e) {}

    // ── Dora ──
    const dora = [];
    try {
      if (Array.isArray(script.dora)) {
        for (const d of script.dora) {
          if (d?.val) {
            const c = MJSDetector._tileValToCode(d.val);
            if (c > 0) dora.push(c);
          }
        }
      }
    } catch(e) {}

    // ── Winds ──
    let seatWind  = null;
    let roundWind = null;
    try { seatWind  = ({0:41,1:42,2:43,3:44})[role.seat] || null; } catch(e) {}
    try {
      const gc = script.game_config;
      if (gc?.round !== undefined)
        roundWind = ({0:41,1:42,2:43,3:44})[Math.floor(gc.round / 4)] || 41;
    } catch(e) {}

    // ── Dedup ──
    const handStr = hand.join(',') + '|m' + detectedMelds;
    if (handStr === MJSDetector._lastHandStr) return;
    MJSDetector._lastHandStr = handStr;

    const minV = 13 - detectedMelds * 3;
    MJSDetector._updateGameState({
      hand, discards, openMelds, opponentDiscards, opponentMeldTiles, dora,
      seatWind, roundWind, meldCount: detectedMelds,
      isMyTurn: hand.length === (14 - detectedMelds * 3),
      canDiscard: hand.length >= (13 - detectedMelds * 3),
      gamePhase: 'playing'
    });

  } catch(e) { console.warn('[MJS Detector] Extract error:', e); }
};

// ── WebSocket hook ────────────────────────────────────────────
MJSDetector.hookWebSocket = () => {
  if (MJSDetector._wsHooked) return;
  const OrigWS = window.WebSocket;
  window.WebSocket = function(...args) {
    const ws = new OrigWS(...args);
    ws.addEventListener('message', () => {
      clearTimeout(MJSDetector._wsDebounce);
      MJSDetector._wsDebounce = setTimeout(() => MJSDetector._pollGameObjects(), 150);
    });
    return ws;
  };
  window.WebSocket.prototype = OrigWS.prototype;
  MJSDetector._wsHooked = true;
};

MJSDetector._updateGameState = (partial) => {
  Object.assign(MJSDetector._gameState, partial, { lastUpdate: Date.now() });
  MJSDetector._notifyListeners();
};
MJSDetector._notifyListeners = () => {
  for (const fn of MJSDetector._listeners) { try { fn(MJSDetector._gameState); } catch(e) {} }
};
MJSDetector.onStateChange = (cb) => MJSDetector._listeners.push(cb);
MJSDetector.getState      = ()   => ({ ...MJSDetector._gameState });
MJSDetector.setTestHand   = (str) => {
  const tiles = MJSUtils.parseHandString(str);
  if (tiles.length >= 13) {
    MJSDetector._updateGameState({ hand: tiles });
    console.log('[MJS] Test hand set:', tiles.map(MJSUtils.describeTile).join(' '));
  }
};
MJSDetector.startPolling = (ms = 500) => {
  MJSDetector.hookWebSocket();
  MJSDetector._pollTimer = setInterval(() => MJSDetector._pollGameObjects(), ms);
  console.log('[MJS Assistant] Polling started.');
};
MJSDetector.stopPolling = () => { clearInterval(MJSDetector._pollTimer); MJSDetector._pollTimer = null; };

window.MJSDetector = MJSDetector;
