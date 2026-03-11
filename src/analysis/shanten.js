// ============================================================
// shanten.js v2 — Correct shanten calculation
// ============================================================
'use strict';

const MJSShanten = window.MJSShanten || {};

// ── Build counts array from tile code array ───────────────────
MJSShanten._buildCounts = (tiles) => {
  const c = new Array(55).fill(0);
  for (const t of tiles) {
    // Normalize red fives to normal fives
    const code = (t === 51) ? 15 : (t === 52) ? 25 : (t === 53) ? 35 : t;
    if (code >= 11 && code <= 47) c[code]++;
  }
  return c;
};

// ── Kokushi ───────────────────────────────────────────────────
MJSShanten.kokushiShanten = (counts) => {
  const terminals = [11,19,21,29,31,39,41,42,43,44,45,46,47];
  let unique = 0, hasPair = false;
  for (const t of terminals) {
    if (counts[t] > 0) { unique++; if (counts[t] >= 2) hasPair = true; }
  }
  return 13 - unique - (hasPair ? 1 : 0);
};

// ── Chiitoitsu ────────────────────────────────────────────────
MJSShanten.chiitoitsuShanten = (counts) => {
  let pairs = 0, kinds = 0;
  for (let i = 11; i <= 47; i++) {
    if (counts[i] >= 1) kinds++;
    if (counts[i] >= 2) pairs++;
  }
  return 6 - Math.min(pairs, 7);
};

// ── Regular hand — per-suit recursive solver ──────────────────
// Returns minimum shanten contribution from one suit's tiles.
// Uses proper backtracking with full restore.
MJSShanten._solve = (c, i, end, m, t, j) => {
  while (i <= end && c[i] === 0) i++;
  if (i > end) {
    // Effective taatsu capped so m+t <= 4 (and if pair used, m+t <= 4-1... handled at combine)
    return { m, t, j };
  }

  let best = null;
  const update = (res) => {
    if (!best) { best = res; return; }
    // Prefer more mentsu, then more taatsu+jantai
    const scoreA = 2*res.m + Math.min(res.t, 4-res.m) + res.j;
    const scoreB = 2*best.m + Math.min(best.t, 4-best.m) + best.j;
    if (scoreA > scoreB) best = res;
  };

  // Koutsu (triplet)
  if (c[i] >= 3) {
    c[i] -= 3;
    update(MJSShanten._solve(c, i, end, m+1, t, j));
    c[i] += 3;
  }

  // Shuntsu (sequence)
  if (i+2 <= end && c[i+1] > 0 && c[i+2] > 0) {
    c[i]--; c[i+1]--; c[i+2]--;
    update(MJSShanten._solve(c, i, end, m+1, t, j));
    c[i]++; c[i+1]++; c[i+2]++;
  }

  // Jantai (pair) - only if no pair yet
  if (c[i] >= 2 && j === 0) {
    c[i] -= 2;
    update(MJSShanten._solve(c, i, end, m, t, 1));
    c[i] += 2;
  }

  // Pair taatsu
  if (c[i] >= 2) {
    c[i] -= 2;
    update(MJSShanten._solve(c, i, end, m, t+1, j));
    c[i] += 2;
  }

  // Kanchan taatsu (gap)
  if (i+2 <= end && c[i+2] > 0) {
    c[i]--; c[i+2]--;
    update(MJSShanten._solve(c, i, end, m, t+1, j));
    c[i]++; c[i+2]++;
  }

  // Sequential taatsu
  if (i+1 <= end && c[i+1] > 0) {
    c[i]--; c[i+1]--;
    update(MJSShanten._solve(c, i, end, m, t+1, j));
    c[i]++; c[i+1]++;
  }

  // Skip (isolated tile) — do NOT modify c[i], just recurse past
  const orig = c[i]; c[i] = 0;
  update(MJSShanten._solve(c, i, end, m, t, j));
  c[i] = orig;

  return best || { m, t, j };
};

// ── Regular shanten ───────────────────────────────────────────
MJSShanten.regularShanten = (counts) => {
  const c = counts.slice(); // work on copy

  // Solve honors first (no sequences)
  let hm = 0, ht = 0, hj = 0;
  for (let i = 41; i <= 47; i++) {
    if (c[i] >= 3) { hm++; c[i] -= 3; }
    else if (c[i] === 2) { if (hj === 0) { hj = 1; } else { ht++; } c[i] = 0; }
    // singles are discarded
    else { c[i] = 0; }
  }

  // Solve each suit
  const suits = [
    { lo: 11, hi: 19 },
    { lo: 21, hi: 29 },
    { lo: 31, hi: 39 },
  ];

  // We need to combine suit results optimally.
  // Since suits are independent, we enumerate (brute force) over j allocation.
  // j can only come from ONE suit or honors.
  // Strategy: try assigning pair to each suit + honors, take best shanten.

  let bestShanten = 8;

  for (let jSrc = -1; jSrc < 3; jSrc++) {
    // jSrc = -1 → pair comes from honors; 0,1,2 → pair from suit 0,1,2
    let totalM = 0, totalT = 0, totalJ = 0;

    // Honor contribution
    let hm2 = hm, ht2 = ht, hj2 = hj;
    // If pair comes from honors but honors already gave a pair, that's already hj=1; keep it
    // If pair comes from suit, then honor pair becomes just a taatsu
    if (jSrc >= 0 && hj2 === 1) { hj2 = 0; ht2++; }
    totalM += hm2; totalT += ht2; totalJ += hj2;

    for (let si = 0; si < 3; si++) {
      const { lo, hi } = suits[si];
      const sc = c.slice(lo, hi + 1);
      // Re-index to 0-based
      const sc0 = new Array(10).fill(0);
      for (let x = lo; x <= hi; x++) sc0[x - lo] = c[x];

      // Force jantai from this suit if jSrc === si
      const forceJ = (jSrc === si) ? 1 : 0;
      const res = MJSShanten._solveSuit(sc0, forceJ);
      totalM += res.m; totalT += res.t;
      if (jSrc === si) totalJ = 1;
      else totalJ += res.j;
    }

    const effT = Math.min(totalT, 4 - totalM);
    const sh = 8 - 2*totalM - effT - Math.min(totalJ, 1);
    if (sh < bestShanten) bestShanten = sh;
  }

  return bestShanten;
};

// Solve one suit (0-indexed counts array of length 10)
MJSShanten._solveSuit = (c0, forceJ) => {
  if (forceJ) {
    // Find best result that includes a pair
    let best = null;
    for (let i = 0; i < c0.length; i++) {
      if (c0[i] >= 2) {
        c0[i] -= 2;
        const res = MJSShanten._solveSuit0(c0, 0, 9, 0, 0, 0);
        if (!best || (2*res.m + Math.min(res.t,4) + 1) > (2*best.m + Math.min(best.t,4) + 1)) {
          best = { m: res.m, t: res.t, j: 1 };
        }
        c0[i] += 2;
      }
    }
    return best || MJSShanten._solveSuit0(c0, 0, 9, 0, 0, 0);
  }
  return MJSShanten._solveSuit0(c0, 0, 9, 0, 0, 0);
};

MJSShanten._solveSuit0 = (c, i, end, m, t, j) => {
  while (i <= end && c[i] === 0) i++;
  if (i > end) return { m, t, j };

  let best = { m, t, j };
  const upd = (res) => {
    const sa = 2*res.m + Math.min(res.t, 4-res.m) + res.j;
    const sb = 2*best.m + Math.min(best.t, 4-best.m) + best.j;
    if (sa > sb) best = res;
  };

  // Koutsu
  if (c[i] >= 3) { c[i]-=3; upd(MJSShanten._solveSuit0(c,i,end,m+1,t,j)); c[i]+=3; }
  // Shuntsu
  if (i+2<=end && c[i+1]>0 && c[i+2]>0) { c[i]--;c[i+1]--;c[i+2]--; upd(MJSShanten._solveSuit0(c,i,end,m+1,t,j)); c[i]++;c[i+1]++;c[i+2]++; }
  // Jantai
  if (c[i]>=2 && j===0) { c[i]-=2; upd(MJSShanten._solveSuit0(c,i,end,m,t,1)); c[i]+=2; }
  // Pair taatsu
  if (c[i]>=2) { c[i]-=2; upd(MJSShanten._solveSuit0(c,i,end,m,t+1,j)); c[i]+=2; }
  // Kanchan
  if (i+2<=end && c[i+2]>0) { c[i]--;c[i+2]--; upd(MJSShanten._solveSuit0(c,i,end,m,t+1,j)); c[i]++;c[i+2]++; }
  // Sequential taatsu
  if (i+1<=end && c[i+1]>0) { c[i]--;c[i+1]--; upd(MJSShanten._solveSuit0(c,i,end,m,t+1,j)); c[i]++;c[i+1]++; }
  // Skip
  const orig=c[i]; c[i]=0; upd(MJSShanten._solveSuit0(c,i,end,m,t,j)); c[i]=orig;

  return best;
};

// ── Combined ──────────────────────────────────────────────────
MJSShanten.calculateAll = (tiles) => {
  const counts = MJSShanten._buildCounts(tiles);
  const regular = MJSShanten.regularShanten(counts);
  const chiito   = tiles.length >= 13 ? MJSShanten.chiitoitsuShanten(counts) : 99;
  const kokushi  = tiles.length >= 13 ? MJSShanten.kokushiShanten(counts)    : 99;
  const best = Math.min(regular, chiito, kokushi);
  return { best, regular, chiito, kokushi };
};

window.MJSShanten = MJSShanten;
