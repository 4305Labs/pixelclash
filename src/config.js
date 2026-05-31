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
  minionBlue: 0xa8e0ff, // lighter team tints so minions read as "lesser" units
  minionRed: 0xffa3b8,
  jungle: 0x1a3326, // mossy dark-green ground for the jungle (off-lane) routes
};

// Each lane is drawn as a stone "road" band centred on its row, this tall (px);
// the mossy jungle floor fills the gaps between the lanes. See `LANES` below for
// the row of each lane. Half-height ±62 around row → bands of 124px.
export const LANE_BAND_HALF = 62;

// Non-colliding decor props scattered on the mossy JUNGLE strips between the
// lanes (the gaps around y≈205 and y≈395) so the jungle doesn't feel empty.
// Purely visual — fixed positions (mirror-symmetric) so render tests stay
// deterministic. Kept off the stone lane bands.
export const DECOR_SPOTS = [
  // Upper jungle strip (between the top and mid lanes, y≈185–225).
  { kind: "bush", x: 70, y: 205 }, { kind: "rock", x: 730, y: 205 },
  { kind: "rock", x: 200, y: 195 }, { kind: "bush", x: 600, y: 195 },
  { kind: "bush", x: 330, y: 210 }, { kind: "rock", x: 470, y: 210 },
  { kind: "rock", x: 130, y: 215 }, { kind: "bush", x: 670, y: 215 },
  // Lower jungle strip (between the mid and bot lanes, y≈375–415) — mirror.
  { kind: "rock", x: 70, y: 395 }, { kind: "bush", x: 730, y: 395 },
  { kind: "bush", x: 200, y: 405 }, { kind: "rock", x: 600, y: 405 },
  { kind: "rock", x: 330, y: 390 }, { kind: "bush", x: 470, y: 390 },
  { kind: "bush", x: 130, y: 385 }, { kind: "rock", x: 670, y: 385 },
];

// --- Bushes (stealth zones) -------------------------------------------------
// Leafy patches you can stand IN to go hidden: while a hero is inside a bush it
// can't be seen or targeted by enemies (towers/minions/bots/camps/auto-aim and
// enemy heroes), UNLESS it just attacked (a brief reveal) or an enemy shares the
// bush. Great for ambushing at the jungle camps. Rectangles (top-left + w/h),
// rotationally symmetric. `BUSH.revealMs` is how long attacking reveals you.
export const BUSH = { revealMs: 1200 };
export const BUSH_ZONES = [
  { x: 150, y: 150, w: 110, h: 70 }, // top-left jungle (by camp_top)
  { x: 540, y: 150, w: 110, h: 70 }, // top-right jungle
  { x: 150, y: GAME_HEIGHT - 220, w: 110, h: 70 }, // bottom-left
  { x: 540, y: GAME_HEIGHT - 220, w: 110, h: 70 }, // bottom-right (by camp_bot)
];

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

// --- Hero classes -----------------------------------------------------------
// Three picks with different HP and attack profiles (movement speed is the same
// for all, so the prediction stays simple). Each class overrides maxHp and the
// `basic`/`ability` specs (dmg, cd, speed, ttl). "soldier" is the balanced
// default and is intentionally identical to the base COMBAT stats.
export const DEFAULT_CLASS = "soldier";
// Selection order (keys 1–6, or the lobby buttons). Six distinct heroes; speed
// is shared so client prediction stays simple — they differ in HP and attacks.
export const CLASS_ORDER = ["scout", "soldier", "tank", "ranger", "mage", "brawler"];
export const CLASSES = {
  scout: {
    name: "Scout",
    maxHp: 70, // fragile
    scale: 0.85, // drawn a touch smaller
    emblem: 0xfff1e8, // visor/emblem accent (drawn on the sprite)
    basic: { dmg: 6, cd: 250, speed: 480, ttl: 1200 }, // rapid, light
    ability: { dmg: 18, cd: 1800, speed: 640, ttl: 1200 },
  },
  soldier: {
    name: "Soldier",
    maxHp: COMBAT.maxHp, // balanced — same as the base stats
    scale: 1,
    emblem: 0xfff1e8,
    basic: COMBAT.basic,
    ability: COMBAT.ability,
  },
  tank: {
    name: "Tank",
    maxHp: 170, // beefy
    scale: 1.25, // drawn bigger
    emblem: 0xffec27,
    basic: { dmg: 13, cd: 650, speed: 360, ttl: 1500 }, // slow, heavy
    ability: { dmg: 45, cd: 3200, speed: 460, ttl: 1400 },
  },
  ranger: {
    name: "Ranger",
    maxHp: 85, // glassy
    scale: 0.9,
    emblem: 0x00e436, // green
    // Long range (high ttl), fast bolts, modest damage — pokes from afar.
    basic: { dmg: 7, cd: 380, speed: 560, ttl: 2000 },
    ability: { dmg: 26, cd: 2200, speed: 700, ttl: 2200 },
  },
  mage: {
    name: "Mage",
    maxHp: 90,
    scale: 0.95,
    emblem: 0xff77a8, // pink
    // Weak basic, but a huge slow-cooldown nuke — burst caster.
    basic: { dmg: 9, cd: 600, speed: 420, ttl: 1300 },
    ability: { dmg: 60, cd: 4200, speed: 480, ttl: 1500 },
  },
  brawler: {
    name: "Brawler",
    maxHp: 140, // durable bruiser
    scale: 1.1,
    emblem: 0xffa300, // orange
    // Short-range (low ttl) but rapid, hard-hitting — a dive bruiser.
    basic: { dmg: 12, cd: 320, speed: 360, ttl: 800 },
    ability: { dmg: 34, cd: 2400, speed: 420, ttl: 900 },
  },
};

// --- Lane minions -----------------------------------------------------------
// Periodic waves of weak AI fighters that march from each base toward the enemy
// base. They attack the nearest enemy minion/player in their way (melee), and
// chip the enemy base once they arrive. Minions give the lane a constant push
// so a match keeps progressing even when the heroes are sparring elsewhere.
export const MINION = {
  maxHp: 40,
  speed: 95, // px/sec — slower than a player (220) so heroes can outrun them
  dmg: 4, // damage per melee hit
  attackCd: 600, // ms between a minion's hits
  range: 40, // melee reach (center-to-center, px) to land a hit
  aggro: 150, // how close an enemy unit must be for a minion to chase it (px)
  half: 10, // half the on-screen size (smaller than a 16px player)
  waveEvery: 9000, // ms between waves
  perWave: 3, // minions spawned per team each wave
  laneGap: 40, // vertical spacing between minions in a wave
  firstWaveMs: 2000, // delay after "playing" begins before the first wave
  spawnAhead: 70, // how far in front of the base a wave appears (px)
};

// --- Dash (a quick burst move along your facing direction) ------------------
export const DASH = {
  distance: 130, // how far the dash carries you, in pixels
  cd: 2000, // cooldown in milliseconds
};

// --- Map pickups ------------------------------------------------------------
// Orbs that sit at fixed spots in the open arena. Walk over one to grab it: a
// HEAL orb restores HP instantly, a POWER orb boosts your attack damage for a
// few seconds. After it's taken, it reappears on a timer. All spots sit on the
// center column (x = middle) so neither team is closer — fair but contested.
export const PICKUP = {
  radius: 12, // on-screen size
  respawnMs: 12000, // time to reappear after being grabbed
  heal: 40, // HP restored by a heal orb
  powerMult: 1.6, // attack-damage multiplier while a power buff is active
  powerMs: 6000, // how long the power buff lasts
};

export const PICKUP_SPOTS = [
  { id: "heal_top", kind: "heal", x: GAME_WIDTH / 2, y: 60 },
  { id: "heal_bot", kind: "heal", x: GAME_WIDTH / 2, y: GAME_HEIGHT - 60 },
  { id: "power_mid", kind: "power", x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 },
];

// --- Jungle camps -----------------------------------------------------------
// Neutral monsters that sit in the jungle pockets (off-lane). They don't roam:
// they hold their spot, and only fight back (a short-range bite) when an enemy
// hero is in range. Last-hitting one pays the killer PROGRESS.reward.camp AND
// grants a brief attack-damage buff (a "blue buff" style reward), so clearing
// camps is a real reason to leave the lane. They respawn on a timer.
export const CAMP = {
  maxHp: 120, // tanky — takes a few hits to clear solo
  radius: 14, // body + hit radius
  dmg: 6, // bite damage
  attackCd: 700, // ms between bites
  range: 46, // bite reach (only attacks heroes this close)
  respawnMs: 25000, // time to respawn after being cleared
  buffMs: 8000, // attack buff granted to the killer, in ms
};

// Two camps, one in each jungle (mirror-symmetric). Kept clear of the spawn
// rows, divider walls, and lane.
// Rotationally symmetric (180° about center) so each team has one nearer camp.
export const CAMP_SPOTS = [
  { id: "camp_top", x: 200, y: 185 }, // top-left jungle (nearer blue)
  { id: "camp_bot", x: GAME_WIDTH - 200, y: GAME_HEIGHT - 185 }, // bottom-right (nearer red)
];

// --- Bases & match ----------------------------------------------------------
export const BASE = {
  maxHp: 250, // ~31 basic hits, or fewer with the ability — short matches
  radius: 24, // hit radius and half the on-screen size

  // Healing fountain: while a living hero stands near its OWN base, it regens
  // HP fast. This rewards retreating home when low (and gives the bots' "run
  // for base" behaviour a real payoff) without making you immortal — the radius
  // is small, so you can't heal and fight at the same time.
  healRadius: 70, // how close to your base you must be to regen (px)
  healPerSec: 35, // HP restored per second inside the fountain
};

// Each team's base sits behind its spawn, near its edge of the arena.
export const BASE_POS = {
  blue: { x: 44, y: GAME_HEIGHT / 2 },
  red: { x: GAME_WIDTH - 44, y: GAME_HEIGHT / 2 },
};

// --- Defensive towers -------------------------------------------------------
// One guard tower per team, standing in the lane between the base and the
// center. A tower auto-zaps the nearest enemy unit (minion or hero) in range,
// so pushing into enemy territory is dangerous until the tower is destroyed.
// Towers don't end the match (only the base does) — they're a defensive wall.
export const TOWER = {
  maxHp: 180, // sturdier than a minion, softer than a base
  range: 160, // targeting radius, and roughly how far its bolt reaches
  cd: 900, // ms between shots
  dmg: 12, // damage per zap
  speed: 480, // bolt px/sec
  ttl: 1200, // bolt lifetime (ms)
  radius: 22, // body + hit radius
  boltRadius: 6,
  boltColor: 0xffa300, // orange zap, distinct from hero/minion bolts
};

// Three horizontal lanes: top, mid, bottom. Each is a row (y) that minions
// march along and a tower guards. (Increment A wires the towers; the per-lane
// minion waves arrive in Increment B.) Rows verified clear of the walls so a
// tower/minion at (towerX, row) isn't stuck in a wall.
export const LANES = [
  { id: "top", row: 110 },
  { id: "mid", row: GAME_HEIGHT / 2 }, // 300
  { id: "bot", row: GAME_HEIGHT - 110 }, // 490
];

// Each team's towers sit at this x (mirrored), one per lane on the lane row.
export const TOWER_X = { blue: 250, red: GAME_WIDTH - 250 };

// Back-compat single-tower position (mid lane) for any old reference.
export const TOWER_POS = {
  blue: { x: TOWER_X.blue, y: GAME_HEIGHT / 2 },
  red: { x: TOWER_X.red, y: GAME_HEIGHT / 2 },
};

// --- Progression: XP / levels / gold ----------------------------------------
// Heroes earn XP and gold by last-hitting minions, towers, and enemy heroes
// (plus a slow passive trickle). XP auto-levels you up (more max HP and attack
// damage); gold buys permanent upgrades from a tiny shop (press B). A fresh,
// level-1 hero with no upgrades is exactly the base stats, so nothing changes
// until you actually earn something.
export const PROGRESS = {
  maxLevel: 6,
  xpPerLevel: 120, // cumulative XP per level step
  hpPerLevel: 20, // +max HP per level above 1
  dmgPerLevel: 0.12, // +12% attack damage per level above 1
  passiveXpPerSec: 4, // slow trickle so even a passive player grows
  passiveGoldPerSec: 2,
  // What last-hitting each thing pays the killer.
  reward: {
    minion: { xp: 18, gold: 14 },
    hero: { xp: 65, gold: 50 },
    tower: { xp: 80, gold: 60 },
    camp: { xp: 70, gold: 55 }, // neutral jungle monster
  },
  // The shop: buy any of these with gold (keys Z / X / C, or B for the next
  // one). Bonuses are permanent and stack up to `shopMaxStacks` total buys.
  // `dmg` adds to the damage multiplier, `hp` to max HP, `cdr` cuts attack
  // cooldowns (faster attacks).
  shop: [
    { id: "dmg", name: "Damage +15%", cost: 70, dmg: 0.15 },
    { id: "hp", name: "Max HP +25", cost: 80, hp: 25 },
    { id: "atk", name: "Atk Speed +12%", cost: 90, cdr: 0.12 },
  ],
  shopMaxStacks: 6,
};

// --- Kill feed --------------------------------------------------------------
// Recent knockouts shown as a fading list in the corner. `ms` is how long an
// entry lingers; `max` is how many lines show at once.
export const KILLFEED = { ms: 6000, max: 5 };

// --- Map / obstacles --------------------------------------------------------
// Solid walls that block movement, dash, and projectiles. Each is an axis-
// aligned rectangle (top-left corner + width/height, world px). The layout is
// mirror-symmetric so neither team is favoured, and carves the arena into
// THREE routes:
//   • the CENTER LANE — a clear horizontal corridor (y≈250–350) where the bases,
//     towers, and minion waves live. It MUST stay clear so minions can march.
//   • a TOP route and a BOTTOM route ("the jungle") — flanking paths separated
//     from the lane by divider walls, holding the heal pickups as objectives.
// The two long lane dividers each have THREE openings — a central gap (between
// the pillars) and a near-base gap at each end — so heroes can rotate between
// the lane and the jungle. Keep WALLS[0]/[1] as the central pillars (the wall
// tests and the minion center-corridor depend on them).
export const WALLS = [
  // Two central pillars flanking the mid lane's gap. Shortened so they sit
  // BETWEEN the lane rows (top=110, mid=300, bot=490) and don't block the side
  // lanes — they only choke the mid lane's edges.
  { x: 392, y: 145, w: 16, h: 90 }, // WALLS[0] — upper pillar (between top & mid)
  { x: 392, y: 365, w: 16, h: 90 }, // WALLS[1] — lower pillar (between mid & bot)
  // Top lane divider: left + right segments, leaving a central gap (x≈360–440)
  // and near-base gaps (x<150, x>650). Sits above the center corridor.
  { x: 150, y: 224, w: 210, h: 14 },
  { x: 440, y: 224, w: 210, h: 14 },
  // Bottom lane divider (mirror of the top).
  { x: 150, y: 364, w: 210, h: 14 },
  { x: 440, y: 364, w: 210, h: 14 },
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

  // Hard time limit for a match. If neither base falls in time, the team ahead
  // on kills wins (ties broken by base HP, then a draw). In milliseconds.
  maxDurationMs: 180000, // 3 minutes
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
