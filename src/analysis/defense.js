// ============================================================
// defense.js — Danger reading, genbutsu, suji, furiten
// ============================================================
'use strict';

const MJSDefense = window.MJSDefense || {};

// ── Suji table ────────────────────────────────────────────────
// If a player discarded tile X, these are the "suji" tiles (relatively safe)
// E.g. discarded 4 → 1 and 7 are suji (across the 4-7 and 1-4 suji)
MJSDefense.SUJI = {
  1:[4], 2:[5], 3:[6], 4:[1,7], 5:[2,8], 6:[3,9], 7:[4], 8:[5], 9:[6]
};

// ── Kanchan danger ────────────────────────────────────────────
// If opponent discarded 2 AND 4, tile 3 is NOT kanchan-safe
// We can't fully compute this, but single-sided suji is enough

// ── Get per-player riichi status ──────────────────────────────
MJSDefense.getOpponentRiichiStatus = () => {
  try {
    const s = window.GameMgr.Inst._scene_mj.desktop._childs[2]._scripts[0];
    const role = s?.mainrole;
    const players = s?.players;
    if (!Array.isArray(players)) return [];

    return players
      .filter(p => p && p !== role)
      .map((p, i) => ({
        seat: p.seat ?? i,
        inRiichi: !!p.during_liqi,
        discards: MJSDefense._getPlayerDiscards(p),
        meldTiles: MJSDefense._getPlayerMeldTiles(p),
      }));
  } catch(e) { return []; }
};

MJSDefense._getPlayerDiscards = (p) => {
  try {
    const pais = p.container_qipai?.pais;
    if (!Array.isArray(pais)) return [];
    return pais
      .filter(t => t?.val)
      .map(t => MJSDetector._tileValToCode(t.val))
      .filter(c => c > 0)
      .map(c => MJS.normalize(c));
  } catch(e) { return []; }
};

MJSDefense._getPlayerMeldTiles = (p) => {
  try {
    const mings = p.container_ming?.mings;
    if (!Array.isArray(mings)) return [];
    const tiles = [];
    for (const m of mings) {
      if (!m || !Array.isArray(m.pais)) continue;
      for (const t of m.pais) {
        if (t?.val) {
          const c = MJSDetector._tileValToCode(t.val);
          if (c > 0) tiles.push(MJS.normalize(c));
        }
      }
    }
    return tiles;
  } catch(e) { return []; }
};

// ── Safety score for a single tile ───────────────────────────
// Returns { score: 0-100, label: string, reasons: [] }
// Higher score = SAFER
MJSDefense.tileSafetyScore = (tileCode, opponents) => {
  const norm = MJS.normalize(tileCode);
  const suit = MJS.getSuit(norm);
  const num  = MJS.getNumber(norm);
  const isHonor = suit === 'honor';

  let score   = 30; // baseline — unknown danger
  const reasons = [];
  const riichiOpps = opponents.filter(o => o.inRiichi);

  if (riichiOpps.length === 0) {
    return { score: 50, label: 'No riichi', reasons: ['No opponents in riichi'] };
  }

  // Check genbutsu (100% safe against specific player)
  const genbutsuCount = riichiOpps.filter(o =>
    o.discards.includes(norm)
  ).length;

  if (genbutsuCount === riichiOpps.length) {
    return { score: 100, label: 'Genbutsu', reasons: ['Safe — already discarded by all riichi players'] };
  }
  if (genbutsuCount > 0) {
    score += 35;
    reasons.push(`Genbutsu vs ${genbutsuCount} player(s)`);
  }

  // Check suji safety (moderately safe)
  if (!isHonor) {
    let sujiSafe = 0;
    for (const opp of riichiOpps) {
      const oppDiscardNums = opp.discards
        .filter(d => MJS.getSuit(d) === suit)
        .map(d => MJS.getNumber(d));
      const sujiSources = MJSDefense.SUJI[num] || [];
      if (sujiSources.some(src => oppDiscardNums.includes(src))) {
        sujiSafe++;
      }
    }
    if (sujiSafe === riichiOpps.length) {
      score += 25;
      reasons.push('Suji safe vs all riichi');
    } else if (sujiSafe > 0) {
      score += 12;
      reasons.push(`Suji safe vs ${sujiSafe} player(s)`);
    }
  }

  // Terminals and honors — more dangerous mid-game (common waits), but safer late
  // Honor tiles that nobody has discarded are somewhat dangerous (yakuhai waits)
  if (isHonor) {
    // If this honor appears in ANY opponent's discards, it's safer
    const seenByAny = opponents.some(o => o.discards.includes(norm));
    if (seenByAny) { score += 15; reasons.push('Honor seen in discards'); }
    else { score -= 5; reasons.push('Honor — unknown danger'); }
  }

  // Tiles seen multiple times overall = fewer copies left to be waited on
  const allDiscards = opponents.flatMap(o => o.discards);
  const seenCount = allDiscards.filter(d => d === norm).length;
  if (seenCount >= 3) { score += 20; reasons.push('Seen 3+ times — few copies left'); }
  else if (seenCount >= 2) { score += 10; reasons.push('Seen 2 times'); }

  // Middle tiles (4,5,6) are more dangerous in general
  if (!isHonor && num >= 4 && num <= 6 && genbutsuCount === 0) {
    score -= 8;
    reasons.push('Middle tile — higher risk');
  }

  score = Math.max(0, Math.min(99, score));
  const label = score >= 80 ? 'Safe' : score >= 55 ? 'Moderate' : score >= 35 ? 'Risky' : 'Danger';
  return { score, label, reasons };
};

// ── Rank hand tiles by safety (highest score = discard first) ─
MJSDefense.rankBySafety = (hand, opponents) => {
  return hand
    .map(code => ({
      tileCode: code,
      ...MJSDefense.tileSafetyScore(code, opponents)
    }))
    .sort((a, b) => b.score - a.score);
};

// ── Furiten check ─────────────────────────────────────────────
// If any of our tenpai winning tiles are in our own discard pile → furiten
MJSDefense.checkFuriten = (tenpaiWinTiles, ownDiscards) => {
  if (!tenpaiWinTiles?.length || !ownDiscards?.length) return false;
  const ownNorm = new Set(ownDiscards.map(c => MJS.normalize(c)));
  return tenpaiWinTiles.some(wt => ownNorm.has(MJS.normalize(wt.tile ?? wt)));
};

// ── Defence mode decision ─────────────────────────────────────
// Returns { defend: bool, urgency: 'low'|'medium'|'high', riichiCount }
MJSDefense.shouldDefend = (opponents, handShanten) => {
  const riichiCount = opponents.filter(o => o.inRiichi).length;
  if (riichiCount === 0) return { defend: false, urgency: 'none', riichiCount };

  // If we're already tenpai with a strong hand, attack back
  if (handShanten <= -1 && riichiCount === 1) {
    return { defend: false, urgency: 'low', riichiCount, reason: 'Both tenpai — push' };
  }

  // Multiple riichi = very dangerous, always defend
  if (riichiCount >= 2) {
    return { defend: true, urgency: 'high', riichiCount, reason: 'Multiple riichi — full defence' };
  }

  // 1 riichi opponent: defend if we're far from tenpai
  if (handShanten >= 2) {
    return { defend: true, urgency: 'medium', riichiCount, reason: `${riichiCount} riichi, ${handShanten} shanten — defend` };
  }

  // 1 riichi, 1 from tenpai — keep attacking carefully
  return { defend: false, urgency: 'low', riichiCount, reason: '1 shanten vs 1 riichi — push carefully' };
};

window.MJSDefense = MJSDefense;
