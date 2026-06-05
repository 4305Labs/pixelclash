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
  bg: 0x2c3a22, // dark earthy green (shows only behind the vignette at the edges)
  grid: 0x3a7a2e, // darker grass (legacy "grid" key)
  blueTeam: 0x29adff, // player team 1
  redTeam: 0xff004d, // player team 2
  outline: 0x000000,
  white: 0xfff1e8,
  wall: 0x8f8a78, // warm grey stone obstacles (fences/ruins on the grass)
  wallEdge: 0x595446, // darker stone outline
  minionBlue: 0xa8e0ff, // lighter team tints so minions read as "lesser" units
  minionRed: 0xffa3b8,
  jungle: 0x4c9b3a, // lush grassland ground (covers the whole field)
};

// Each lane is drawn as a stone "road" band centred on its row, this tall (px);
// the mossy jungle floor fills the gaps between the lanes. See `LANES` below for
// the row of each lane. Half-height ±62 around row → bands of 124px.
export const LANE_BAND_HALF = 38;

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
  // Glade trees + stumps in the grassy gaps and along the top/bottom edges
  // (kept off the lane bands). Big round canopies sell the "glades" look.
  { kind: "tree", x: 110, y: 200 }, { kind: "tree", x: 690, y: 200 },
  { kind: "tree", x: 110, y: 400 }, { kind: "tree", x: 690, y: 400 },
  { kind: "tree", x: 400, y: 28 }, { kind: "tree", x: 400, y: 576 },
  { kind: "tree", x: 250, y: 26 }, { kind: "tree", x: 560, y: 578 },
  { kind: "stump", x: 300, y: 205 }, { kind: "stump", x: 510, y: 398 },
  // Wildflower clusters dotted through the grassy gaps.
  { kind: "flowers", x: 240, y: 195 }, { kind: "flowers", x: 560, y: 205 },
  { kind: "flowers", x: 240, y: 405 }, { kind: "flowers", x: 560, y: 395 },
  { kind: "flowers", x: 440, y: 200 }, { kind: "flowers", x: 360, y: 400 },
];

// --- Bushes (stealth zones) -------------------------------------------------
// Leafy patches you can stand IN to go hidden: while a hero is inside a bush it
// can't be seen or targeted by enemies (towers/minions/bots/camps/auto-aim and
// enemy heroes), UNLESS it just attacked (a brief reveal) or an enemy shares the
// bush. Great for ambushing at the jungle camps. Rectangles (top-left + w/h),
// rotationally symmetric. `BUSH.revealMs` is how long attacking reveals you.
export const BUSH = { revealMs: 1200 };
export const BUSH_ZONES = [
  // Sat over the jungle mouth of each tower's gank gap, so a hidden jungler can
  // spring an ambush down into the lane. Rotationally symmetric; the two near
  // the camps double as ambush cover when contesting them.
  { x: 200, y: 175, w: 100, h: 60 }, // upper jungle, blue-side tower gap (+ camp_top)
  { x: 500, y: 175, w: 100, h: 60 }, // upper jungle, red-side tower gap
  { x: 200, y: GAME_HEIGHT - 235, w: 100, h: 60 }, // lower jungle, blue side
  { x: 500, y: GAME_HEIGHT - 235, w: 100, h: 60 }, // lower jungle, red side (+ camp_bot)
];

// How fast a player moves, in pixels per second.
export const PLAYER_SPEED = 220;

// The size (width & height in pixels) of a player sprite before scaling.
export const PLAYER_SIZE = 16;

// How much we scale the tiny pixel sprites up so they're visible.
export const SPRITE_SCALE = 2;

// Heroes are drawn from a 24x24 art grid; this renders them at roughly the 32px
// hitbox footprint (class `.scale` multiplies on top). Separate from SPRITE_SCALE
// (which still sizes the 16px minion/decor art).
export const HERO_SCALE = 1.4;

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
  // Time knocked out before respawning at your spawn. Pacing tuning (m57): was
  // 2000 (2s), which is a clear outlier — a hero is back almost before the fight
  // it died in has ended, so WINNING a teamfight never buys any time to push an
  // objective (take a tower / the base). That removed the core MOBA arc and left
  // matches grinding to the timer. 4500ms gives a real "you won — now push"
  // window WITHOUT a single death snowballing the game (well short of the
  // long-respawn failure where one death ends it). Still well under the match
  // clock and the fountain/heal timings, so nothing else needs retuning.
  respawnMs: 4500, // time knocked out before respawning at your spawn

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
    // Scatter: a three-pellet spread shot — spray-and-pray for an assassin.
    ability: { type: "spread", dmg: 13, cd: 1900, speed: 560, ttl: 1000, pellets: 3, spreadDeg: 24 },
  },
  soldier: {
    name: "Soldier",
    maxHp: COMBAT.maxHp, // balanced — same as the base stats
    scale: 1,
    emblem: 0xfff1e8,
    basic: COMBAT.basic,
    // Pierce: one heavy bolt that passes through every enemy in its line.
    ability: { type: "pierce", dmg: COMBAT.ability.dmg, cd: COMBAT.ability.cd, speed: COMBAT.ability.speed, ttl: COMBAT.ability.ttl },
  },
  tank: {
    name: "Tank",
    maxHp: 170, // beefy — the highest HP in the roster (the durability pick)
    scale: 1.25, // drawn bigger
    emblem: 0xffec27,
    // Slow, heavy, SHORT range. dmg 12 / cd 700 => 17.1 DPS (the lowest sustained
    // DPS after the burst-caster mage), and ttl 1300 (reach ~468px) so the tank
    // must close distance. This is the deliberate trade for its huge HP: it soaks
    // hits but can't out-trade the damage classes. Was 13/650 (20 DPS) + ttl 1500,
    // which made the tank nearly strictly better than the soldier (more HP AND
    // equal DPS) — now the soldier clearly out-DPSes and out-ranges it.
    basic: { dmg: 12, cd: 700, speed: 360, ttl: 1300 }, // slow, heavy, short range
    // Bulwark: raise a shield that halves incoming damage for a few seconds.
    ability: { type: "shield", cd: 3200, durationMs: 3000, reduce: 0.5 },
  },
  ranger: {
    name: "Ranger",
    maxHp: 85, // glassy
    scale: 0.9,
    emblem: 0x00e436, // green
    // Long range (high ttl), fast bolts, modest damage — pokes from afar.
    basic: { dmg: 7, cd: 380, speed: 560, ttl: 2000 },
    // Seeker: a homing arrow that curves to chase the nearest enemy hero.
    ability: { type: "homing", dmg: 28, cd: 2300, speed: 470, ttl: 2400, turn: 5 },
  },
  mage: {
    name: "Mage",
    maxHp: 90,
    scale: 0.95,
    emblem: 0xff77a8, // pink
    // Weak basic, but a huge slow-cooldown nuke — burst caster.
    basic: { dmg: 9, cd: 600, speed: 420, ttl: 1300 },
    // Nova: a fireball that detonates on contact, hitting everything nearby.
    ability: { type: "blast", dmg: 40, cd: 4200, speed: 470, ttl: 1500, blastRadius: 74 },
  },
  brawler: {
    name: "Brawler",
    maxHp: 120, // durable bruiser (was 140 — trimmed so it isn't both tanky AND top-DPS)
    scale: 1.1,
    emblem: 0xffa300, // orange
    // Short-range (low ttl) but rapid — a dive bruiser. dmg 7 / cd 320 => 21.9 DPS:
    // high, but below the scout's 24.0 so the glass cannon stays the clear top DPS.
    // Was 12/320 (37.5 DPS) which, paired with 140 HP, made the brawler a strict
    // dominator (durable AND far the most DPS). Shortest reach is its trade.
    basic: { dmg: 7, cd: 320, speed: 360, ttl: 800 },
    // Leap Slam: lunge forward and smash, hurting everything around the landing.
    // dmg 26 / cd 2400 => ~10.8 ability-DPS — sits BELOW the squishy single-target
    // nukers (soldier pierce 30 / 12.0 DPS, ranger homing 28 / 12.2 DPS), as it
    // should: the brawler already gets mobility (the lunge) and AoE on its slam.
    // Was 34 (~14.2 ability-DPS) — the HIGHEST damage-per-cooldown ability in the
    // roster, on a class that is ALSO a durable 120-HP bruiser with high basic DPS
    // (21.9): a strict outlier that crowded the mage's burst niche. Trimmed so the
    // leap stays a strong AoE engage without out-bursting the dedicated damage
    // picks; the mage's Nova (40) remains the clear premier single-hit nuke.
    ability: { type: "leap", dmg: 26, cd: 2400, distance: 170, slamRadius: 62 },
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
  aggro: 80, // how close an enemy unit must be for a minion to chase it (px).
  // Kept deliberately SHORT: a longer leash made opposing waves chase each other
  // into a permanent dead-centre lock (every bot match drew 0-0). With a short
  // leash a minion holds its lane but keeps marching toward the tower, so once a
  // side wins a clash its surplus actually reaches the structure and a lane opens.
  half: 10, // half the on-screen size (smaller than a 16px player)
  waveEvery: 9000, // ms between waves
  perWave: 3, // minions spawned per team each wave
  laneGap: 40, // vertical spacing between minions in a wave
  firstWaveMs: 2000, // delay after "playing" begins before the first wave
  spawnAhead: 70, // how far in front of the base a wave appears (px)
};

// --- AI bots ----------------------------------------------------------------
// Tunables for the bot brain (only active when the server runs with
// `{ bots: true }`). A bot OWNS a lane and ADVANCES down it toward the enemy
// structures, clearing whatever its auto-attack can hit on the way. It only
// HOLDS at a standoff to kite an enemy HERO (a duel); against minions/towers it
// keeps pushing so its presence tips the lane and its own wave breaks through.
export const BOTS = {
  heroStandoff: 200, // px gap to an enemy HERO past which a bot dashes in to close
  lowHpFrac: 0.3, // retreat home below this fraction of max HP
  chaseHpFrac: 0.45, // only DIVERT to chase an enemy hero this hurt (a finishable kill)
  chaseEdge: 15, // ...and only if we have at least this much more HP than it (a real edge)
  abilityRange: 300, // fire the ability when an enemy hero is within this (px)
  dashEngageMult: 1.6, // dash to close when the gap exceeds heroStandoff * this
  towerPad: 26, // widen an enemy tower's danger radius by this when deciding to dive
  minionSupport: 170, // a friendly minion this close lets a bot dive a tower (px)
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

// One camp in EACH of the four jungle pockets, so every jungle quadrant is worth
// pathing through. Kept clear of the spawn rows, divider walls, and lanes, and
// rotationally symmetric (180° about centre) so the two teams are even.
export const CAMP_SPOTS = [
  { id: "camp_ul", x: 200, y: 185 }, // upper-left jungle (blue side)
  { id: "camp_lr", x: GAME_WIDTH - 200, y: GAME_HEIGHT - 185 }, // lower-right (red side)
  { id: "camp_ur", x: GAME_WIDTH - 200, y: 185 }, // upper-right jungle (red side)
  { id: "camp_ll", x: 200, y: GAME_HEIGHT - 185 }, // lower-left (blue side)
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
// march along and a tower guards. Rows verified clear of the walls so a
// tower/minion at (towerX, row) isn't stuck in a wall.
export const LANES = [
  { id: "top", row: 110 },
  { id: "mid", row: GAME_HEIGHT / 2 }, // 300
  { id: "bot", row: GAME_HEIGHT - 110 }, // 490
];

// Minions spawn at the nexus (base row, y=300) and first walk OUT to their
// lane's entry — a point just inside the map on that lane's row — before
// marching across it. This is what makes the lanes fan out from each base.
// `LANE_ENTRY_X` is how far in from each team's edge the entry sits.
export const LANE_ENTRY_X = 120;

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

// --- Low-HP danger vignette -------------------------------------------------
// Client-only "juice": when the LOCAL hero is alive and badly hurt, a soft red
// glow pulses at the screen edges, getting stronger the closer to death they
// are. Purely visual (read from the snapshot HP) — it never touches gameplay.
// `threshold` is the HP fraction below which it shows; `maxAlpha` is the overlay
// opacity at ~0 HP (it scales down to 0 at the threshold); `pulse*` drive the
// gentle breathing; `color` is the tint.
export const VIGNETTE = {
  threshold: 0.3, // show only below 30% HP
  maxAlpha: 0.55, // strongest opacity (at ~0 HP)
  pulseAmount: 0.18, // how much the pulse adds/removes from the alpha
  pulseSpeed: 5.0, // radians/sec of the breathing pulse
  color: 0xff0033, // danger red
};

// --- Floating damage numbers ------------------------------------------------
// Client-only "juice": whenever a unit's HP drops between two snapshots, a small
// pixel number (e.g. "-12") pops at its position and floats up while fading out,
// then destroys itself. Purely visual — the amount is derived from snapshot HP
// deltas, so it never touches the server or the snapshot shape.
// `rise` is how far (px) the number drifts up; `lifeMs` is how long it lives
// before vanishing; `fontSize`/`localFontSize` are the text sizes (the LOCAL
// hero's own hits read a touch bigger and red so your own damage stands out);
// `color`/`localColor` are the fills; `stroke`/`strokeThickness` give the dark
// pixel outline so numbers stay readable over any background.
export const DMGTEXT = {
  rise: 32, // how far the number floats upward (px)
  lifeMs: 700, // time to rise + fade out before it's destroyed (ms)
  fontSize: 16, // normal damage-number size (px)
  localFontSize: 20, // a touch bigger when it's the LOCAL hero taking damage
  color: "#ffec27", // readable yellow for most hits
  localColor: "#ff5151", // red for damage to your own hero
  stroke: "#000000", // dark outline
  strokeThickness: 4,
};

// --- Death poof -------------------------------------------------------------
// Client-only "juice": when a unit dies, a brief pixel "poof" bursts at its last
// position — a small cluster of dusty puff dots that expand outward and fade,
// plus a quick expanding ring. Triggered purely from snapshot transitions on the
// client (a hero going alive -> dead, or a lane minion disappearing from the
// snapshot), so it never touches the server or the snapshot shape.
// `count` puffs spread up to `spread` px from the centre, each `size` px, all
// fading + growing over `lifeMs`; `ring*` size the expanding shockwave ring;
// `color` is the dusty puff tint (a neutral pale grey reads on any background).
export const POOF = {
  count: 6, // number of little puff dots in the burst
  size: 5, // radius of each puff dot (px)
  spread: 22, // how far the puffs drift out from the centre (px)
  grow: 2.0, // how much each puff scales up as it fades
  ring: 10, // starting radius of the expanding ring (px)
  ringGrow: 2.6, // how much the ring scales up before it vanishes
  lifeMs: 360, // how long the whole poof lives before it cleans itself up (ms)
  color: 0xe8e0d0, // dusty pale puff colour (neutral, reads on grass + stone)
};

// --- Camera shake -----------------------------------------------------------
// Client-only "juice": a short, punchy camera shake on big moments, so they feel
// weighty. Triggered purely from snapshot transitions on the client (a hero
// going alive -> dead, or a base/nexus losing HP), so it never touches the
// server or the snapshot shape. Each entry is `{ ms, intensity }` passed
// straight to Phaser's `cameras.main.shake(ms, intensity)` — `ms` is the
// duration and `intensity` is the magnitude as a fraction of the viewport (so
// ~0.006 is a small nudge). Kept brief + small so it adds impact without
// nausea. A hero knockout is a noticeable shake; a base hit is stronger.
export const SHAKE = {
  kill: { ms: 180, intensity: 0.006 }, // a hero is knocked out — noticeable, brief
  base: { ms: 320, intensity: 0.011 }, // a base/nexus takes damage or falls — stronger
};

// --- Projectile trails ------------------------------------------------------
// Client-only "juice": every flying bolt leaves a brief, fading motion trail so
// shots read as fast and energetic. As a projectile sprite moves between
// snapshots (interpolated each frame), we periodically drop a small "ghost" dot
// at its current position, coloured to match the bolt; each dot shrinks + fades
// out and then destroys itself. Purely visual — it reads the existing
// `projectiles[]` from the snapshot and never touches the server or its shape.
// A dot is only dropped once the bolt has moved at least `minStepPx` AND
// `intervalMs` has passed since the last one (so a still/slow bolt can't spam
// them); `dotScale` sizes a dot relative to its bolt's radius; `lifeMs` is how
// long each dot fades + shrinks before it's destroyed; `startAlpha` is a dot's
// initial opacity; `max` is a hard cap on how many trail dots can exist at once
// (a safety net so the effect can never leak objects, however many bolts fly).
export const TRAIL = {
  minStepPx: 7, // min distance a bolt moves before dropping the next dot (px)
  intervalMs: 40, // min ms between trail dots for a single projectile
  dotScale: 0.7, // a dot's radius = its bolt's radius * this
  lifeMs: 240, // how long each dot fades + shrinks before it's destroyed (ms)
  startAlpha: 0.5, // starting opacity of a fresh trail dot
  max: 80, // hard cap on simultaneously-live trail dots (perf safety net)
};

// --- Kill feed --------------------------------------------------------------
// Recent knockouts shown as a fading list in the corner. `ms` is how long an
// entry lingers; `max` is how many lines show at once.
// --- Respawn countdown indicator --------------------------------------------
// Client-only "juice": while a hero is DEAD, show a small marker at its position
// so players can read when they / allies / enemies come back. Derived purely
// from the snapshot's existing `alive`/`respawnIn` fields — it never touches the
// server or the snapshot shape.
// The marker is a faint full-circle backdrop (`bgAlpha`) with a brighter
// team-coloured ARC on top (`arcAlpha`) that DEPLETES from a full sweep to
// nothing as `respawnIn` runs down — derived from `respawnMs` (the full respawn
// time, matching COMBAT.respawnMs) so the arc visibly empties.
// `radius` is the ring radius (px); `thickness` is its line width;
// `fontSize`/`localFontSize` are the seconds text sizes (the LOCAL dead hero's
// own number reads a touch bigger so it stands out); `color`/`stroke`/
// `strokeThickness` style the seconds text; `depth` keeps the marker above units
// but below the HUD; `yOffset` nudges the number off-centre.
export const RESPAWN = {
  radius: 18, // ring radius around the dead hero (px)
  thickness: 3, // ring line width (px)
  bgAlpha: 0.3, // opacity of the faint full-circle backdrop
  arcAlpha: 0.95, // opacity of the depleting team-coloured arc
  fontSize: 16, // seconds-remaining text size (px)
  localFontSize: 22, // a touch bigger for the LOCAL dead hero's own timer
  color: "#fff1e8", // seconds text fill (pale, reads on any background)
  stroke: "#000000", // dark outline so the number stays legible
  strokeThickness: 4,
  respawnMs: COMBAT.respawnMs, // full respawn time, for the arc's depletion
  depth: 80, // above units, below the HUD (500)
  yOffset: 1, // tiny vertical nudge so the number sits centred in the ring
};

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
// The two long lane dividers each have openings near the bases and at the towers
// so heroes rotate between lane and jungle. Keep WALLS[0]/[1] as the central
// pillars (the wall tests and the minion center-corridor depend on them).
// NOTE: lanes are intentionally OPEN — towers are landmarks you route around
// (and that shoot you), not walled chokepoints. Don't add walls beside towers.
export const WALLS = [
  // Two central pillars flanking the mid lane's gap. Shortened so they sit
  // BETWEEN the lane rows (top=110, mid=300, bot=490) and don't block the side
  // lanes — they only choke the mid lane's edges.
  { x: 392, y: 145, w: 16, h: 90 }, // WALLS[0] — upper pillar (between top & mid)
  { x: 392, y: 365, w: 16, h: 90 }, // WALLS[1] — lower pillar (between mid & bot)
  // Top lane divider: three segments leaving a gap near each base (x<150,
  // x>650) AND a gap at each tower (x≈225–275 / 525–575). Junglers drop through
  // the tower gap straight into the lane fight; the centre is solid cover.
  { x: 150, y: 224, w: 75, h: 14 },
  { x: 275, y: 224, w: 250, h: 14 },
  { x: 575, y: 224, w: 75, h: 14 },
  // Bottom lane divider (mirror of the top).
  { x: 150, y: 364, w: 75, h: 14 },
  { x: 275, y: 364, w: 250, h: 14 },
  { x: 575, y: 364, w: 75, h: 14 },
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
