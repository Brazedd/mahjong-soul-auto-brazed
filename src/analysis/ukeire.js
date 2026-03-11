// ============================================================
// ukeire.js — Ukeire (effective tile count) calculation
// ============================================================
// Ukeire = the number of distinct tiles that improve the hand
// (reduce shanten number) if drawn.
// Also calculates the total number of remaining tiles that help.
// ============================================================

'use strict';

const MJSUkeire = window.MJSUkeire || {};

/**
 * Calculate ukeire for a 13-tile hand.
 * @param {number[]} hand13 — 13 tile codes
 * @param {number[]} visibleTiles — tiles already seen (discards, open melds, etc.)
 * @returns {{ tiles: number[], count: number, details: Object[] }}
 */
MJSUkeire.calculate = (hand13, visibleTiles = []) => {
  const _sh0 = MJSShanten.calculateAll(hand13); const currentShanten = _sh0.best;

  // Build a map of how many of each tile remain unseen
  const seenCounts = new Array(55).fill(0);
  for (const t of [...hand13, ...visibleTiles]) {
    seenCounts[MJS.normalize(t)]++;
  }

  const improvingTiles = [];
  let totalCount = 0;

  for (const candidate of MJS.ALL_TILES) {
    // Max 4 copies of each tile exist
    const alreadySeen = seenCounts[candidate] || 0;
    const remaining = 4 - alreadySeen;
    if (remaining <= 0) continue;

    // Would drawing this tile improve shanten?
    const testHand = [...hand13, candidate];
    const _shn = MJSShanten.calculateAll(testHand); const newShanten = _shn.best;

    if (newShanten < currentShanten) {
      improvingTiles.push({
        tile: candidate,
        label: MJS.TILE_LABELS[candidate],
        remaining,
        shantenImprovement: currentShanten - newShanten
      });
      totalCount += remaining;
    }
  }

  // Sort by remaining count descending
  improvingTiles.sort((a, b) => b.remaining - a.remaining);

  return {
    tiles: improvingTiles.map(x => x.tile),
    count: totalCount,
    details: improvingTiles,
    currentShanten
  };
};

/**
 * For each possible discard from a 14-tile hand, calculate ukeire.
 * Returns a ranked list of discards with their resulting ukeire.
 * @param {number[]} hand14 — 14 tile codes
 * @param {number[]} visibleTiles — tiles already seen
 * @returns {Object[]} sorted discard options
 */
MJSUkeire.rankDiscards = (hand14, visibleTiles = []) => {
  const results = [];
  const uniqueTiles = [...new Set(hand14.map(MJS.normalize))];

  for (const tileCode of uniqueTiles) {
    // Find the first occurrence of this tile in the hand
    const idx = hand14.findIndex(t => MJS.normalize(t) === tileCode);
    if (idx === -1) continue;

    const hand13 = [...hand14];
    hand13.splice(idx, 1);

    const shanten = MJSShanten.calculateAll(hand13);
    const ukeire  = MJSUkeire.calculate(hand13, visibleTiles);

    results.push({
      tile:        hand14[idx],
      tileCode,
      label:       MJS.TILE_LABELS[hand14[idx]] || MJS.TILE_LABELS[tileCode],
      shanten:     shanten.best,
      shantenAll:  shanten,
      ukeireCount: ukeire.count,
      ukeireTiles: ukeire.details,
      score:       MJSUkeire._score(shanten.best, ukeire.count, hand13)
    });
  }

  // Sort: lower shanten first, then higher ukeire
  results.sort((a, b) => {
    if (a.shanten !== b.shanten) return a.shanten - b.shanten;
    return b.ukeireCount - a.ukeireCount;
  });

  return results;
};

/**
 * Heuristic score for ranking discards (higher = better).
 */
MJSUkeire._score = (shanten, ukeireCount, hand13) => {
  if (shanten === -1) return 10000 + ukeireCount; // Tenpai always best
  return ukeireCount * 10 - shanten * 100;
};

/**
 * Get the single best discard recommendation.
 */
MJSUkeire.bestDiscard = (hand14, visibleTiles = []) => {
  const ranked = MJSUkeire.rankDiscards(hand14, visibleTiles);
  return ranked.length > 0 ? ranked[0] : null;
};

/**
 * Check if hand is tenpai and return winning tiles.
 */
MJSUkeire.getTenpaiTiles = (hand13, visibleTiles = []) => {
  const shanten = MJSShanten.calculateAll(hand13);
  if (shanten.best !== -1) return [];

  const winTiles = [];
  const seenCounts = new Array(55).fill(0);
  for (const t of [...hand13, ...visibleTiles]) {
    seenCounts[MJS.normalize(t)]++;
  }

  for (const candidate of MJS.ALL_TILES) {
    const remaining = 4 - (seenCounts[candidate] || 0);
    if (remaining <= 0) continue;

    const testHand = [...hand13, candidate];
    const _shn = MJSShanten.calculateAll(testHand); const newShanten = _shn.best;
    if (newShanten === -2 || newShanten < -1) {
      winTiles.push({ tile: candidate, remaining });
    }
  }

  return winTiles;
};

window.MJSUkeire = MJSUkeire;
