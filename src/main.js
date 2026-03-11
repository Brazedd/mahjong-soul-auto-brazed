// ============================================================
// main.js v6 — Separate autopilot poll loop, open meld support
// ============================================================
'use strict';

(function () {
  'use strict';

  let _lastHandStr    = '';
  let _lastAnalysis   = null;
  let _apPollTimer    = null;

  // ── Wait for game ─────────────────────────────────────────
  const waitForGame = () => {
    console.log('%c[MJS Assistant] Loaded — waiting for game...', 'color:#e94560;');
    const check = setInterval(() => {
      try {
        const ok = window.GameMgr?.Inst?._scene_mj?.desktop;
        if (ok) { clearInterval(check); init(); }
      } catch(e) {}
    }, 1500);
  };

  // ── Init ──────────────────────────────────────────────────
  const init = () => {
    console.log('%c[MJS Assistant] Game detected!', 'color:#2ed573;font-weight:bold;');
    console.log('%c⚠ FOR EDUCATIONAL USE ONLY', 'color:#ffa502;');

    MJSOverlay.init();
    MJSDetector.startPolling(600);
    MJSDetector.onStateChange(handleGameStateUpdate);
    startAutopilotLoop();
    exposeConsoleAPI();

    console.log('%cMJS: MJS.autopilot(true) | MJS.toggle() | MJS.calibrate() | MJS.debugOp() | Alt+M | Alt+A', 'color:#aaa;font-style:italic;');
  };

  // ── Analysis: called when hand tiles change ───────────────
  const handleGameStateUpdate = (gameState) => {
    const handStr = JSON.stringify(gameState.hand) + '|' + (gameState.meldCount || 0) + '|' + JSON.stringify(gameState.openMelds);
    if (handStr === _lastHandStr) return;
    _lastHandStr = handStr;

    // Accept any hand with tiles — post-pon hand is 13 tiles with 1 meld
    if (!gameState.hand || gameState.hand.length < 1) {
      MJSOverlay.update({ valid: false, reason: 'Waiting for hand...' });
      _lastAnalysis = null;
      return;
    }

    const analysis = MJSAnalyzer.analyze(gameState);
    _lastAnalysis = analysis;
    window._MJSLastAnalysis = analysis; // expose for autopilot
    MJSOverlay.update(analysis);

    if (analysis.valid) {
      const best = analysis.bestDiscard;
      console.log(`[MJS] Shanten:${analysis.shanten} | Best:${best?best.label:'N/A'} | Ukeire:${best?best.ukeireCount:0} | Melds:${gameState.meldCount||0}`);
    }
  };

  // ── Autopilot loop: independent 400ms poll ────────────────
  // Runs regardless of hand changes so it catches:
  //   - can_discard becoming true
  //   - operation_showing popup appearing
  const startAutopilotLoop = () => {
    if (_apPollTimer) clearInterval(_apPollTimer);
    _apPollTimer = setInterval(() => {
      try {
        MJSAutoplayer.tick(_lastAnalysis);
      } catch(e) {}
    }, 400);
  };

  // ── Console API ───────────────────────────────────────────
  const exposeConsoleAPI = () => {
    window.MJS = {
      testHand:   (str)  => MJSDetector.setTestHand(str),
      toggle:     ()     => MJSOverlay.toggle(),
      analyze:    ()     => {
        const state    = MJSDetector.getState();
        const analysis = MJSAnalyzer.analyze(state);
        _lastAnalysis  = analysis;
        MJSOverlay.update(analysis);
        return analysis;
      },
      autopilot:  (en)   => {
        // Always reset stale state before enabling
        if (en) {
          MJSAutoplayer._lastOpShowing  = false;
          MJSAutoplayer._lastCanDiscard = false;
          clearTimeout(MJSAutoplayer._pending);
          clearTimeout(MJSAutoplayer._opPending);
          MJSAutoplayer._pending   = null;
          MJSAutoplayer._opPending = null;
        }
        MJSAutoplayer.setEnabled(en);
        const cb = document.getElementById('mjs-autopilot-toggle');
        if (cb) { cb.checked = en; cb.dispatchEvent(new Event('change')); }
        console.log(`[MJS] Autopilot ${en ? 'ENABLED ⚠' : 'disabled'}`);
      },
      setDelays:  (mn,mx) => MJSAutoplayer.setDelays(mn, mx),
      calibrate:  ()     => MJSAutoplayer.startCalibration(),
      clearCalib: ()     => MJSAutoplayer.clearCalibration(),
      debugOp:    ()     => MJSAutoplayer.debugOplist(),
      debugState: ()     => {
        try {
          const s = window.GameMgr.Inst._scene_mj.desktop._childs[2]._scripts[0];
          const r = s.mainrole;
          console.log('=== MJS Debug State ===');
          console.log('operation_showing:', s.operation_showing);
          console.log('can_discard:', r.can_discard);
          console.log('hand.length:', r.hand?.length);
          console.log('meldCount:', s.players?.[0]?.container_ming?.mings?.filter(m=>m).length ?? '?');
          console.log('oplist:', JSON.stringify(s.oplist?.map(o=>({type:o.type,combo:o.combination}))));
          console.log('lastqipai:', JSON.stringify(s.lastqipai?.val));
          console.log('autopilot enabled:', MJSAutoplayer._enabled);
          console.log('lastAnalysis valid:', _lastAnalysis?.valid);
          console.log('bestDiscard:', _lastAnalysis?.bestDiscard?.label);
        } catch(e) { console.error(e); }
      },
      normalize:  (code) => (code===51?15:code===52?25:code===53?35:code),
      getNumber:  (code) => {
        const n = MJS.normalize(code);
        if (n>=11&&n<=19) return n-10; if (n>=21&&n<=29) return n-20;
        if (n>=31&&n<=39) return n-30; if (n>=41&&n<=47) return n-40; return 0;
      },
      getSuit: (code) => {
        const n = MJS.normalize(code);
        if (n>=11&&n<=19) return 'man'; if (n>=21&&n<=29) return 'pin';
        if (n>=31&&n<=39) return 'sou'; return 'honor';
      },
      TILE_LABELS: (() => {
        const m = {};
        'man,pin,sou'.split(',').forEach((s,si) => { for(let i=1;i<=9;i++) m[10*(si+1)+i]=i+(s[0]); });
        m[41]='East';m[42]='South';m[43]='West';m[44]='North';
        m[45]='Haku';m[46]='Hatsu';m[47]='Chun';
        m[51]='5m★';m[52]='5p★';m[53]='5s★';
        return m;
      })(),
      ALL_TILES: [...Array.from({length:9},(_,i)=>11+i),
                 ...Array.from({length:9},(_,i)=>21+i),
                 ...Array.from({length:9},(_,i)=>31+i),
                 41,42,43,44,45,46,47],
      modules: { MJSShanten, MJSUkeire, MJSAnalyzer, MJSDetector, MJSOverlay, MJSAutoplayer }
    };
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForGame);
  } else {
    waitForGame();
  }
})();
