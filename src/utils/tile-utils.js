// ============================================================
// tile-utils.js — Tile manipulation and conversion utilities
// ============================================================

'use strict';

const MJSUtils = window.MJSUtils || {};

/**
 * Convert a hand array (tile codes) to a 34-element count array.
 * Index 0 = tile code 11 (1m), index 33 = tile code 47 (Chun).
 */
MJSUtils.handToCountArray = (tiles) => {
  const counts = new Array(38).fill(0); // indices 11-47
  for (const t of tiles) {
    const normalized = MJS.normalize(t);
    if (normalized >= 11 && normalized <= 47) {
      counts[normalized]++;
    }
  }
  return counts;
};

/**
 * Convert count array back to sorted tile list.
 */
MJSUtils.countArrayToHand = (counts) => {
  const hand = [];
  for (let i = 11; i <= 47; i++) {
    for (let j = 0; j < counts[i]; j++) {
      hand.push(i);
    }
  }
  return hand;
};

/**
 * Sort tiles: man → pin → sou → honors
 */
MJSUtils.sortTiles = (tiles) => {
  return [...tiles].sort((a, b) => MJS.normalize(a) - MJS.normalize(b));
};

/**
 * Clone a count array.
 */
MJSUtils.cloneCounts = (counts) => [...counts];

/**
 * Check if tile is a valid playable tile code.
 */
MJSUtils.isValidTile = (t) => {
  const n = MJS.normalize(t);
  return (n >= 11 && n <= 19) || (n >= 21 && n <= 29) ||
         (n >= 31 && n <= 39) || (n >= 41 && n <= 47);
};

/**
 * Describe a tile in human-readable form.
 */
MJSUtils.describeTile = (tile) => {
  return MJS.TILE_LABELS[tile] || MJS.TILE_LABELS[MJS.normalize(tile)] || `?${tile}`;
};

/**
 * Get adjacent tiles for a given tile (for sequence detection).
 */
MJSUtils.getAdjacentTiles = (tile) => {
  const n = MJS.normalize(tile);
  if (MJS.isHonor(n)) return [];
  const suit = MJS.getSuit(n);
  const num  = MJS.getNumber(n);
  const base = n - num;
  const adj  = [];
  if (num > 1) adj.push(base + num - 1);
  if (num < 9) adj.push(base + num + 1);
  return adj;
};

/**
 * Parse a string like "1m2m3p4p5s East" into tile codes.
 */
MJSUtils.parseHandString = (str) => {
  const tiles = [];
  const honorMap = {
    'East':41,'South':42,'West':43,'North':44,
    'Haku':45,'Hatsu':46,'Chun':47,
    '1z':41,'2z':42,'3z':43,'4z':44,'5z':45,'6z':46,'7z':47
  };
  // Check honor keywords first
  for (const [key, code] of Object.entries(honorMap)) {
    if (str.includes(key)) {
      tiles.push(code);
      str = str.replace(key, '');
    }
  }
  // Parse numbered tiles: digit(s) followed by m/p/s
  const regex = /(\d+)([mps])/g;
  let match;
  while ((match = regex.exec(str)) !== null) {
    const nums = match[1];
    const suit = match[2];
    const suitBase = suit === 'm' ? 10 : suit === 'p' ? 20 : 30;
    for (const ch of nums) {
      const n = parseInt(ch);
      if (n >= 1 && n <= 9) tiles.push(suitBase + n);
    }
  }
  return tiles;
};

window.MJSUtils = MJSUtils;
