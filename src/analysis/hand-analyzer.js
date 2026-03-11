// ============================================================
// hand-analyzer.js v2 — Open meld aware
// With N open melds, closed hand has 13 - 3*N tiles (waiting)
//                                 or 14 - 3*N tiles (just drew)
// ============================================================
'use strict';

const MJSAnalyzer = window.MJSAnalyzer || {};

MJSAnalyzer.analyze = (gameState) => {
  const {
    hand, discards = [], openMelds = [],
    opponentDiscards = [], opponentMeldTiles = [],
    seatWind, roundWind, meldCount
  } = gameState;

  const numMelds = meldCount || openMelds.length || 0;
  const minValid = 13 - numMelds * 3;

  if (!hand || hand.length < 1) {
    return { valid: false, reason: 'No tiles' };
  }

  const openTiles    = openMelds.flatMap(m => m.tiles || []);
  const visibleTiles = [...discards, ...openTiles, ...opponentDiscards, ...opponentMeldTiles];
  const closedHand   = hand;

  const shanten  = MJSShanten.calculateAll(closedHand);
  const isTenpai = shanten.best === -1;
  const handType = MJSAnalyzer._detectHandType(shanten);
  const valueEstimate = MJSAnalyzer._estimateValue(closedHand, openMelds, shanten, seatWind, roundWind);
  const estHan   = valueEstimate?.estimatedHan || 1;

  // ── Opponent danger assessment ────────────────────────────
  let opponents = [];
  let defenceInfo = { defend: false, urgency: 'none', riichiCount: 0 };
  let furitenWarning = false;
  try {
    opponents   = MJSDefense.getOpponentRiichiStatus();
    defenceInfo = MJSDefense.shouldDefend(opponents, shanten.best);
  } catch(e) {}

  let discardRanking = [];
  let tenpaiTiles    = [];
  let bestDiscard    = null;

  if (closedHand.length > minValid) {
    // ── Base efficiency ranking ──
    let ranking = MJSUkeire.rankDiscards(closedHand, visibleTiles);

    // ── Value-weighted ranking ────────────────────────────────
    // Score = ukeire × value_multiplier + shanten_bonus
    // This avoids sacrificing a 4-han path for 2 extra outs toward a 1-han hand
    ranking = ranking.map(d => {
      // Simulate discarding this tile and check what paths remain
      const rem = [...closedHand];
      const idx = rem.indexOf(d.tileCode);
      if (idx !== -1) rem.splice(idx, 1);
      const remShanten  = MJSShanten.calculateAll(rem);
      const remValue    = MJSAnalyzer._estimateValue(rem, openMelds, remShanten, seatWind, roundWind);
      const remHan      = remValue?.estimatedHan || 1;
      // Weighted score: outs × han potential (so high-value paths rank higher even with fewer outs)
      const valueWeight = 0.6 + 0.4 * (remHan / Math.max(estHan, 1));
      const weightedScore = d.ukeireCount * valueWeight;
      return { ...d, remHan, weightedScore };
    });

    // ── Defence override ──────────────────────────────────────
    if (defenceInfo.defend && opponents.length > 0) {
      // Sort by safety score first, then weighted efficiency second
      const safetyRanked = MJSDefense.rankBySafety(
        ranking.map(d => d.tileCode),
        opponents
      );
      const safetyMap = {};
      safetyRanked.forEach((s, i) => { safetyMap[MJS.normalize(s.tileCode)] = { ...s, safetyRank: i }; });

      ranking = ranking.map(d => {
        const sf = safetyMap[MJS.normalize(d.tileCode)] || { score: 30, label: 'Unknown' };
        // In defence mode: safety dominates, weighted score is secondary tiebreak
        const defScore = sf.score * 10 + d.weightedScore;
        return { ...d, safetyScore: sf.score, safetyLabel: sf.label, safetyReasons: sf.reasons, defScore };
      }).sort((a, b) => b.defScore - a.defScore);
    } else {
      // Attack mode: sort by weighted score
      ranking = ranking.sort((a, b) => b.weightedScore - a.weightedScore);
      // Annotate safety even in attack mode for display
      try {
        const safetyRanked = MJSDefense.rankBySafety(ranking.map(d => d.tileCode), opponents);
        const safetyMap = {};
        safetyRanked.forEach(s => { safetyMap[MJS.normalize(s.tileCode)] = s; });
        ranking = ranking.map(d => {
          const sf = safetyMap[MJS.normalize(d.tileCode)] || { score: 50, label: '?' };
          return { ...d, safetyScore: sf.score, safetyLabel: sf.label };
        });
      } catch(e) {}
    }

    discardRanking = ranking;
    bestDiscard    = discardRanking[0] || null;

  } else if (closedHand.length === minValid && isTenpai) {
    tenpaiTiles = MJSUkeire.getTenpaiTiles(closedHand, visibleTiles);
    // ── Furiten check ──
    try { furitenWarning = MJSDefense.checkFuriten(tenpaiTiles, discards); } catch(e) {}
  } else if (closedHand.length <= minValid) {
    const ukeire = MJSUkeire.calculate(closedHand, visibleTiles);
    tenpaiTiles  = ukeire.details;
  }

  const safetyInfo = MJSAnalyzer._assessSafety(hand, opponentDiscards);

  return {
    valid: true,
    shanten:        shanten.best,
    shantenAll:     shanten,
    isTenpai,
    handType,
    discardRanking: discardRanking.slice(0, 8),
    bestDiscard,
    tenpaiTiles,
    valueEstimate,
    safetyInfo,
    numMelds,
    defenceInfo,
    furitenWarning,
    opponents,
    visibleTileCount: visibleTiles.length,
    timestamp: Date.now()
  };
};

MJSAnalyzer._detectHandType = (shantenAll) => {
  const { regular, chiitoitsu, kokushi } = shantenAll;
  const min = Math.min(regular, chiitoitsu, kokushi);
  if (min === kokushi)                           return 'Kokushi';
  if (min === chiitoitsu && chiitoitsu <= regular) return 'Chiitoitsu';
  return 'Regular';
};

MJSAnalyzer._estimateValue = (hand, openMelds, shanten, seatWind, roundWind) => {
  if (!hand || hand.length === 0) return { estimatedHan: 1, flags: [] };
  const counts  = MJSUtils.handToCountArray(hand);
  const isOpen  = openMelds && openMelds.length > 0;
  let potential = 1;
  let flags     = [];

  // Tanyao — all simples (2-8 only)
  const hasTanyao = hand.every(t => {
    const n = MJS.normalize(t);
    return !MJS.isHonor(n) && MJS.getNumber(n) >= 2 && MJS.getNumber(n) <= 8;
  });
  if (hasTanyao) { potential += 1; flags.push('Tanyao'); }

  // Pinfu — no pairs of value tiles, all sequences, two-sided wait
  if (!isOpen && shanten.regular <= 1) flags.push('Pinfu possible');

  // Honitsu — one suit + honors
  const suits = new Set(hand.map(t => MJS.getSuit(MJS.normalize(t))).filter(s => s !== 'honor'));
  if (suits.size === 1 && !isOpen) { potential += 2; flags.push('Honitsu possible'); }
  else if (suits.size === 1 && isOpen) { potential += 1; flags.push('Honitsu (open)'); }

  // Chinitsu — one suit, no honors
  const hasHonors = hand.some(t => MJS.isHonor(MJS.normalize(t)));
  if (suits.size === 1 && !hasHonors && !isOpen) { potential += 4; flags.push('Chinitsu possible'); }

  // Dragons
  for (let i = 45; i <= 47; i++) {
    if (counts[i] >= 2) { potential += 1; flags.push(`Dragon (${MJS.TILE_LABELS[i]})`); }
  }
  // Wind tiles
  if (seatWind && counts[seatWind] >= 2) { potential += 1; flags.push('Seat Wind'); }
  if (roundWind && counts[roundWind] >= 2) { potential += 1; flags.push('Round Wind'); }

  // Chiitoitsu
  if (shanten.chiitoitsu <= 1) { potential += 1; flags.push('Chiitoitsu possible'); }

  // Closed hand bonuses
  if (!isOpen && shanten.regular <= 0) { flags.push('Menzen Tsumo possible'); potential += 1; }
  if (!isOpen && shanten.best <= 1)    { flags.push('Riichi possible'); potential += 1; }

  // Ippeiko — two identical sequences (rough check: pairs of consecutive numbers)
  if (!isOpen) {
    const numCounts = {};
    hand.forEach(t => { const n = MJS.normalize(t); numCounts[n] = (numCounts[n]||0)+1; });
    if (Object.values(numCounts).some(c => c >= 2)) {
      // rough heuristic only
    }
  }

  return { estimatedHan: Math.min(potential, 13), flags };
};

MJSAnalyzer._assessSafety = (hand, opponentDiscards) => {
  if (!opponentDiscards || opponentDiscards.length === 0) return [];
  const tips = [];
  const safeTiles = hand
    .map(t => MJS.normalize(t))
    .filter(n => opponentDiscards.includes(n));
  if (safeTiles.length > 0)
    tips.push({ type:'safe', message:`Safe tiles (seen in discards): ${safeTiles.map(t=>MJS.TILE_LABELS[t]).join(', ')}` });
  return tips;
};

window.MJSAnalyzer = MJSAnalyzer;
