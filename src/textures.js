// ===========================================================================
// We have no image files — we DRAW our pixel-art sprites in code at startup and
// bake them into reusable textures, so the repo stays free of binary assets.
//
// Sprites are authored as PIXEL GRIDS: an array of equal-length strings where
// each character maps to a palette colour (a "." is transparent). paintGrid()
// paints them cell-by-cell. This lets us hand-draw real pixel art (outlines,
// shading, a face) right here in code, and team colours are injected so one
// grid serves both teams. Later you can still swap in .png art without changing
// any game logic — just replace these makers.
// ===========================================================================

import { COLORS, PLAYER_SIZE, BASE, MINION, TOWER, PICKUP } from "./config.js";

// Multiply a 0xRRGGBB colour's brightness by `f` (｢<1｣ darker, ｢>1｣ lighter),
// clamped to 0–255. Used to derive shadow/highlight shades from a team colour.
function shade(hex, f) {
  const r = Math.min(255, Math.round(((hex >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((hex >> 8) & 255) * f));
  const b = Math.min(255, Math.round((hex & 255) * f));
  return (r << 16) | (g << 8) | b;
}

// Paint a pixel grid into a named texture. `rows` are equal-length strings;
// each char is looked up in `palette` (a char→colour map; missing/null means a
// transparent pixel). `pixel` enlarges every cell to a pixel×pixel block, so a
// small grid can fill a bigger texture with chunky, crisp pixels.
function paintGrid(scene, key, { rows, palette, pixel = 1 }) {
  const h = rows.length;
  const w = rows[0].length;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    if (row.length !== w) {
      throw new Error(`texture "${key}": row ${y} is ${row.length} wide, expected ${w}`);
    }
    for (let x = 0; x < w; x++) {
      const color = palette[row[x]];
      if (color == null) continue; // transparent
      g.fillStyle(color, 1);
      g.fillRect(x * pixel, y * pixel, pixel, pixel);
    }
  }
  g.generateTexture(key, w * pixel, h * pixel);
  g.destroy();
}

// A 16×16 helmeted fighter, front-facing: outlined helmet with a white visor,
// a team-coloured body with a bright chest emblem and side shading, and little
// boots. `b` is the team colour; `d`/`l` are auto-derived shadow/highlight.
const HERO_ROWS = [
  ".....oooooo.....",
  "....obbbbbbo....",
  "...obbbbbbbbo...",
  "...obbvvvvbbo...",
  "...obbbbbbbbo...",
  "...obdbbbbdbo...",
  "..obbbbbbbbbbo..",
  "..obbbllllbbbo..",
  "..obbbbbbbbbbo..",
  "..oddddddddddo..",
  "...obbbbbbbbo...",
  "...obbo..obbo...",
  "...obbo..obbo...",
  "...offo..offo...",
  "...oooo..oooo...",
  "................",
];

// Draws one 16×16 character sprite into `key`, tinted with `bodyColor`.
function makeCharacterTexture(scene, key, bodyColor) {
  const palette = {
    ".": null,
    o: COLORS.outline,
    b: bodyColor,
    d: shade(bodyColor, 0.6), // shadow
    l: shade(bodyColor, 1.4), // highlight / emblem
    v: COLORS.white, // visor
    f: 0x3a3a4a, // boots
  };
  paintGrid(scene, key, { rows: HERO_ROWS, palette, pixel: 1 });
}

// A 10×10 one-eyed lane minion (painted at pixel=2 → 20×20), in a lighter team
// tint so it reads as a "lesser" creature next to the heroes.
const MINION_ROWS = [
  "..oooooo..",
  ".obbbbbbo.",
  "obbbbbbbbo",
  "obbbbwwbbo",
  "obbbbbbbbo",
  "obdbbbbdbo",
  ".obbbbbbo.",
  ".obo..obo.",
  ".oo....oo.",
  "..........",
];

// Draws a minion sprite into `key`, tinted with `color`.
function makeMinionTexture(scene, key, color) {
  const palette = {
    ".": null,
    o: COLORS.outline,
    b: color,
    d: shade(color, 0.7),
    w: COLORS.white, // eye
  };
  paintGrid(scene, key, { rows: MINION_ROWS, palette, pixel: 2 });
}

// Draws a team base: a chunky "crystal" — an outlined diamond with a bright
// core, in the team color. `key` names the texture; `color` is the team color.
function makeBaseTexture(scene, key, color) {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const r = BASE.radius;
  const size = r * 2;
  const cx = r;
  const cy = r;

  // Black diamond outline.
  g.fillStyle(COLORS.outline, 1);
  g.fillPoints(diamond(cx, cy, r), true);
  // Colored body, slightly smaller.
  g.fillStyle(color, 1);
  g.fillPoints(diamond(cx, cy, r - 2), true);
  // Bright white core so it reads as a power crystal.
  g.fillStyle(COLORS.white, 1);
  g.fillPoints(diamond(cx, cy, r * 0.4), true);

  g.generateTexture(key, size, size);
  g.destroy();
}

// Four points of a diamond centered at (cx, cy).
function diamond(cx, cy, r) {
  return [
    { x: cx, y: cy - r },
    { x: cx + r, y: cy },
    { x: cx, y: cy + r },
    { x: cx - r, y: cy },
  ];
}

// Draws a guard tower: a chunky stone fort (square) with a team-colored turret
// disc on top and a bright aperture, so it reads as a defensive structure —
// clearly different from the diamond base.
function makeTowerTexture(scene, key, color) {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const s = TOWER.radius * 2;
  const c = TOWER.radius;
  // Stone fort: black-outlined square.
  g.fillStyle(COLORS.outline, 1);
  g.fillRect(0, 0, s, s);
  g.fillStyle(COLORS.wall, 1);
  g.fillRect(2, 2, s - 4, s - 4);
  // Team-colored turret disc.
  g.fillStyle(COLORS.outline, 1);
  g.fillCircle(c, c, c - 4);
  g.fillStyle(color, 1);
  g.fillCircle(c, c, c - 6);
  // Bright aperture in the middle.
  g.fillStyle(COLORS.white, 1);
  g.fillCircle(c, c, (c - 6) * 0.4);
  g.generateTexture(key, s, s);
  g.destroy();
}

// Draws a pickup orb: a round, outlined disc with a symbol. A green disc with a
// white cross = heal; an orange disc with a white "bolt" wedge = power.
function makePickupTexture(scene, key, kind) {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const r = PICKUP.radius;
  const s = r * 2;
  g.fillStyle(COLORS.outline, 1);
  g.fillCircle(r, r, r);
  g.fillStyle(kind === "heal" ? 0x00e436 : 0xffa300, 1);
  g.fillCircle(r, r, r - 2);
  g.fillStyle(COLORS.white, 1);
  if (kind === "heal") {
    // A plus sign.
    g.fillRect(r - 1.5, r - 6, 3, 12);
    g.fillRect(r - 6, r - 1.5, 12, 3);
  } else {
    // A little lightning bolt (two stacked triangles offset sideways).
    g.fillTriangle(r + 2, r - 7, r - 4, r + 1, r + 1, r + 1);
    g.fillTriangle(r - 2, r + 7, r + 4, r - 1, r - 1, r - 1);
  }
  g.generateTexture(key, s, s);
  g.destroy();
}

// Called once when the arena starts. Creates every texture the game needs.
export function generateTextures(scene) {
  makeCharacterTexture(scene, "player_blue", COLORS.blueTeam);
  makeCharacterTexture(scene, "player_red", COLORS.redTeam);
  makeBaseTexture(scene, "base_blue", COLORS.blueTeam);
  makeBaseTexture(scene, "base_red", COLORS.redTeam);
  makeMinionTexture(scene, "minion_blue", COLORS.minionBlue);
  makeMinionTexture(scene, "minion_red", COLORS.minionRed);
  makeTowerTexture(scene, "tower_blue", COLORS.blueTeam);
  makeTowerTexture(scene, "tower_red", COLORS.redTeam);
  makePickupTexture(scene, "pickup_heal", "heal");
  makePickupTexture(scene, "pickup_power", "power");
}
