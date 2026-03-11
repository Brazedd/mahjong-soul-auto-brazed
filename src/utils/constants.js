// ============================================================
// constants.js — Tile definitions and game constants
// ============================================================

'use strict';

const MJS = window.MJS || {};

// -----------------------------------------------------------
// Tile encoding:
//   Man (Characters) : 1m-9m  → codes 11-19
//   Pin (Circles)    : 1p-9p  → codes 21-29
//   Sou (Bamboo)     : 1s-9s  → codes 31-39
//   Honors (Winds)   : East/South/West/North → 41-44
//   Honors (Dragons) : Haku/Hatsu/Chun       → 45-47
//   Akadora (Red 5s) : 5mr/5pr/5sr           → 51/52/53
// -----------------------------------------------------------

MJS.TILES = {
  // Man
  '1m': 11, '2m': 12, '3m': 13, '4m': 14, '5m': 15, '6m': 16,
  '7m': 17, '8m': 18, '9m': 19,
  // Pin
  '1p': 21, '2p': 22, '3p': 23, '4p': 24, '5p': 25, '6p': 26,
  '7p': 27, '8p': 28, '9p': 29,
  // Sou
  '1s': 31, '2s': 32, '3s': 33, '4s': 34, '5s': 35, '6s': 36,
  '7s': 37, '8s': 38, '9s': 39,
  // Honors
  'East': 41, 'South': 42, 'West': 43, 'North': 44,
  'Haku': 45, 'Hatsu': 46, 'Chun': 47,
  // Red fives (treat same as regular for shanten, mark separately)
  '5mr': 51, '5pr': 52, '5sr': 53
};

MJS.TILE_NAMES = Object.fromEntries(
  Object.entries(MJS.TILES).map(([k, v]) => [v, k])
);

MJS.SUIT_MAN  = 'man';
MJS.SUIT_PIN  = 'pin';
MJS.SUIT_SOU  = 'sou';
MJS.SUIT_HONOR = 'honor';

// All 34 unique tile types (ignoring akadora)
MJS.ALL_TILES = [
  11,12,13,14,15,16,17,18,19,
  21,22,23,24,25,26,27,28,29,
  31,32,33,34,35,36,37,38,39,
  41,42,43,44,45,46,47
];

// Human-readable tile labels for UI
MJS.TILE_LABELS = {
  11:'1m',12:'2m',13:'3m',14:'4m',15:'5m',16:'6m',17:'7m',18:'8m',19:'9m',
  21:'1p',22:'2p',23:'3p',24:'4p',25:'5p',26:'6p',27:'7p',28:'8p',29:'9p',
  31:'1s',32:'2s',33:'3s',34:'4s',35:'5s',36:'6s',37:'7s',38:'8s',39:'9s',
  41:'East',42:'South',43:'West',44:'North',
  45:'Haku',46:'Hatsu',47:'Chun',
  51:'5m★',52:'5p★',53:'5s★'
};

// Emoji/Unicode tile symbols for display
MJS.TILE_EMOJI = {
  11:'🀇',12:'🀈',13:'🀉',14:'🀊',15:'🀋',16:'🀌',17:'🀍',18:'🀎',19:'🀏',
  21:'🀙',22:'🀚',23:'🀛',24:'🀜',25:'🀝',26:'🀞',27:'🀟',28:'🀠',29:'🀡',
  31:'🀀',32:'🀁',33:'🀂',34:'🀃',35:'🀄',36:'🀅',37:'🀆',38:'🀇',39:'🀈',
  41:'🀀',42:'🀁',43:'🀂',44:'🀃',
  45:'🀄',46:'🀅',47:'🀆'
};

// Suit helpers
MJS.getSuit = (tile) => {
  const t = tile > 50 ? tile - 40 : tile; // normalize akadora
  if (t >= 11 && t <= 19) return MJS.SUIT_MAN;
  if (t >= 21 && t <= 29) return MJS.SUIT_PIN;
  if (t >= 31 && t <= 39) return MJS.SUIT_SOU;
  return MJS.SUIT_HONOR;
};

MJS.getNumber = (tile) => {
  const t = tile > 50 ? tile - 40 : tile;
  if (t >= 11 && t <= 19) return t - 10;
  if (t >= 21 && t <= 29) return t - 20;
  if (t >= 31 && t <= 39) return t - 30;
  return 0; // honors have no number
};

MJS.isHonor   = (tile) => MJS.getSuit(tile) === MJS.SUIT_HONOR;
MJS.isTerminal = (tile) => {
  const n = MJS.getNumber(tile);
  return !MJS.isHonor(tile) && (n === 1 || n === 9);
};
MJS.isAkadora = (tile) => tile > 50;

// Normalize akadora to base tile
MJS.normalize = (tile) => {
  if (tile === 51) return 15;
  if (tile === 52) return 25;
  if (tile === 53) return 35;
  return tile;
};

window.MJS = MJS;
