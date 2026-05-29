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
  wall: 0x4a5680, // stone-blue obstacles
  wallEdge: 0x29366f, // darker wall outline
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

// --- Map / obstacles --------------------------------------------------------
// A few solid walls that block movement, dash, and projectiles. Each is an
// axis-aligned rectangle given as its top-left corner plus width/height, in
// world pixels. The layout is mirror-symmetric about the center so neither
// team gets an advantage, and it deliberately leaves the center row (y≈300,
// where the bases line up) and a vertical gap through the middle open so
// players can still path across.
export const WALLS = [
  // Two central pillars on the mid-line, with a gap between them.
  { x: 392, y: 80, w: 16, h: 150 },
  { x: 392, y: 370, w: 16, h: 150 },
  // Cover blocks flanking the center, clear of the spawn rows (y=150/300/450).
  { x: 230, y: 225, w: 80, h: 16 },
  { x: 490, y: 225, w: 80, h: 16 },
  { x: 230, y: 359, w: 80, h: 16 },
  { x: 490, y: 359, w: 80, h: 16 },
];

export const MATCH = {
  resetMs: 5000, // pause on the win banner, then start a fresh match

  // --- Lobby / match start ---
  // Each side needs at least this many players before a match can begin.
  // Set to 1 for "as soon as one player per team shows up" (1v1+).
  minPerTeam: 1,
  // A short "get ready" countdown after enough players are present, before
  // the action starts. In milliseconds.
  countdownMs: 3000,
};

// --- Touch UI layout --------------------------------------------------------
// Sizing and placement for the on-screen controls, tuned for thumbs on a
// phone. `margin` keeps controls clear of the very edges (a rough safe area so
// they aren't clipped by rounded corners or gesture bars). The action buttons
// are anchored to the bottom-right; positions are derived from the world size
// so tweaking the numbers here moves everything together.
export const UI = {
  margin: 26, // min gap from a screen edge, in world px
  buttonRadius: 44, // action-button radius (bigger = easier to tap)
  joystickRadius: 70, // how far the movement thumb-stick can travel
};

// Bottom-right action cluster. A = basic, B = ability (up-left), C = dash
// (left of A). Kept inside UI.margin so all three are comfortably on-screen.
export const BUTTONS = {
  basic: { x: GAME_WIDTH - UI.margin - UI.buttonRadius, y: GAME_HEIGHT - UI.margin - UI.buttonRadius },
  ability: { x: GAME_WIDTH - UI.margin - UI.buttonRadius - 92, y: GAME_HEIGHT - UI.margin - UI.buttonRadius - 84 },
  dash: { x: GAME_WIDTH - UI.margin - UI.buttonRadius - 150, y: GAME_HEIGHT - UI.margin - UI.buttonRadius },
};
