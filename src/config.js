// ===========================================================================
// Shared game constants. Keeping these in one place means we tweak balance
// and sizing here instead of hunting through the code.
// ===========================================================================

// The logical size of the game world, in pixels. Phaser scales this to fit
// whatever screen it runs on (phone or desktop).
export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;

// A small, cohesive pixel-art palette (PICO-8 inspired). Numbers are hex
// colors; the 0x prefix is how Phaser wants colors in code.
export const COLORS = {
  bg: 0x1d2b53, // dark blue background
  grid: 0x29366f, // slightly lighter grid lines
  blueTeam: 0x29adff, // player team 1
  redTeam: 0xff004d, // player team 2
  outline: 0x000000,
  white: 0xfff1e8,
};

// How fast a player moves, in pixels per second.
export const PLAYER_SPEED = 220;

// The size (width & height in pixels) of a player sprite before scaling.
export const PLAYER_SIZE = 16;

// How much we scale the tiny pixel sprites up so they're visible.
export const SPRITE_SCALE = 2;

// Half the on-screen size of a player (used to keep them inside the walls).
export const PLAYER_HALF = (PLAYER_SIZE * SPRITE_SCALE) / 2;

// --- Networking -------------------------------------------------------------
export const NET = {
  port: 2567, // the port the game server listens on
  tickHz: 30, // how many times per second the server updates & broadcasts
};

// Max players per team. The game already supports this many on each side;
// set to 1 for strict 1v1, or 3 for 3v3.
export const TEAM_SIZE = 3;

// Spawn points per team — one per possible teammate so they don't stack.
// Blue spawns down the left edge, Red down the right edge.
const cy = GAME_HEIGHT / 2;
export const SPAWNS = {
  blue: [
    { x: 120, y: cy - 150 },
    { x: 120, y: cy },
    { x: 120, y: cy + 150 },
  ],
  red: [
    { x: GAME_WIDTH - 120, y: cy - 150 },
    { x: GAME_WIDTH - 120, y: cy },
    { x: GAME_WIDTH - 120, y: cy + 150 },
  ],
};

// --- Combat -----------------------------------------------------------------
export const COMBAT = {
  maxHp: 100,
  respawnMs: 2000, // time knocked out before respawning at your spawn

  // Two attack types. cd = cooldown in ms, speed = px/sec, ttl = lifetime (ms).
  basic: { dmg: 8, cd: 400, speed: 420, ttl: 1400, radius: 5, color: 0xffec27 },
  ability: { dmg: 30, cd: 2500, speed: 560, ttl: 1400, radius: 9, color: 0xff77a8 },

  hitPad: 14, // extra hit radius so bolts connect with a player's body
};

// --- Dash (a quick burst move along your facing direction) ------------------
export const DASH = {
  distance: 130, // how far the dash carries you, in pixels
  cd: 2000, // cooldown in milliseconds
};

// --- Bases & match ----------------------------------------------------------
export const BASE = {
  maxHp: 250, // ~31 basic hits, or fewer with the ability — short matches
  radius: 24, // hit radius and half the on-screen size
};

// Each team's base sits behind its spawn, near its edge of the arena.
export const BASE_POS = {
  blue: { x: 44, y: GAME_HEIGHT / 2 },
  red: { x: GAME_WIDTH - 44, y: GAME_HEIGHT / 2 },
};

export const MATCH = {
  resetMs: 5000, // pause on the win banner, then start a fresh match
};
