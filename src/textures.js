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

// Draws a team base: a faceted gem crystal. We build it procedurally (the shape
// is symmetric, so a grid would be fiddly): an outlined diamond, split into a
// lit LEFT facet and a shadowed RIGHT facet for a cut-gemstone look, plus a
// bright core and a small white sparkle. Size is unchanged (radius*2) so hit
// detection and layout are identical to before.
function makeBaseTexture(scene, key, color) {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const r = BASE.radius;
  const size = r * 2;
  const lit = color;
  const dark = shade(color, 0.55);

  // Outline, then the two facets (left half lit, right half shadowed), then a
  // smaller bright core, drawn as nested diamonds.
  g.fillStyle(COLORS.outline, 1);
  g.fillPoints(diamond(r, r, r), true);

  // Left facet (lit): a triangle from top to bottom down the centre, to the
  // left point. Right facet (shadowed): the mirror.
  const top = { x: r, y: r - (r - 2) };
  const bot = { x: r, y: r + (r - 2) };
  const left = { x: r - (r - 2), y: r };
  const right = { x: r + (r - 2), y: r };
  g.fillStyle(lit, 1);
  g.fillPoints([top, bot, left], true);
  g.fillStyle(dark, 1);
  g.fillPoints([top, bot, right], true);

  // Bright core + a sparkle up-left.
  g.fillStyle(COLORS.white, 1);
  g.fillPoints(diamond(r, r, r * 0.34), true);
  g.fillRect(r - Math.round(r * 0.45), r - Math.round(r * 0.45), 2, 2);

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

// Draws a guard tower: a stone turret with battlements. An outlined stone base,
// a lit top edge and shadowed sides for height, crenellations along the top, a
// team-coloured cannon disc, and a bright muzzle. Size unchanged (radius*2).
function makeTowerTexture(scene, key, color) {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const s = TOWER.radius * 2;
  const c = TOWER.radius;
  const stone = COLORS.wall;

  // Stone body: black-outlined square with lit/shadowed edges.
  g.fillStyle(COLORS.outline, 1);
  g.fillRect(0, 0, s, s);
  g.fillStyle(stone, 1);
  g.fillRect(2, 2, s - 4, s - 4);
  g.fillStyle(shade(stone, 1.3), 1); // lit top
  g.fillRect(2, 2, s - 4, 3);
  g.fillStyle(shade(stone, 0.65), 1); // shadowed bottom + right
  g.fillRect(2, s - 5, s - 4, 3);
  g.fillRect(s - 5, 2, 3, s - 4);

  // Crenellations: three dark notches along the very top.
  g.fillStyle(COLORS.outline, 1);
  for (let i = 0; i < 3; i++) g.fillRect(4 + i * ((s - 8) / 3) + 2, 0, 4, 3);

  // Team cannon disc + bright muzzle.
  g.fillStyle(COLORS.outline, 1);
  g.fillCircle(c, c + 1, c - 5);
  g.fillStyle(color, 1);
  g.fillCircle(c, c + 1, c - 7);
  g.fillStyle(shade(color, 1.4), 1); // highlight glint
  g.fillCircle(c - 2, c - 1, 2);
  g.fillStyle(COLORS.white, 1);
  g.fillCircle(c, c + 1, (c - 7) * 0.35);

  g.generateTexture(key, s, s);
  g.destroy();
}

// Draws a pickup orb: an outlined gem-disc with shading (shadowed lower body, a
// bright upper-left highlight) and a white symbol — a plus for heal (green), a
// lightning bolt for power (orange). Size unchanged (radius*2).
function makePickupTexture(scene, key, kind) {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const r = PICKUP.radius;
  const s = r * 2;
  const body = kind === "heal" ? 0x00e436 : 0xffa300;
  g.fillStyle(COLORS.outline, 1);
  g.fillCircle(r, r, r);
  g.fillStyle(shade(body, 0.7), 1); // shadowed base
  g.fillCircle(r, r, r - 2);
  g.fillStyle(body, 1); // lit body, nudged up-left
  g.fillCircle(r - 1, r - 1, r - 4);
  g.fillStyle(shade(body, 1.5), 1); // glossy highlight
  g.fillCircle(r - 3, r - 3, Math.max(1, r * 0.18));
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

// A 40×40 floor tile: the dark-blue base with a faint seam at the top/left edge
// and a fixed scatter of slightly lighter/darker specks, so a tiled floor looks
// like textured stone instead of a flat fill. Deterministic (no randomness), so
// the render tests stay stable.
function makeFloorTexture(scene, key) {
  const S = 40;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(COLORS.bg, 1);
  g.fillRect(0, 0, S, S);
  // Seam lines along two edges read as tile grout.
  g.fillStyle(COLORS.grid, 1);
  g.fillRect(0, 0, S, 1);
  g.fillRect(0, 0, 1, S);
  // A fixed speckle pattern: light flecks and dark pits at set cells.
  const light = shade(COLORS.bg, 1.35);
  const dark = shade(COLORS.bg, 0.7);
  const flecks = [
    [6, 9, light], [13, 5, dark], [22, 14, light], [31, 8, dark],
    [9, 24, dark], [18, 30, light], [27, 26, dark], [35, 33, light],
    [4, 34, light], [33, 18, dark],
  ];
  for (const [x, y, c] of flecks) {
    g.fillStyle(c, 1);
    g.fillRect(x, y, 2, 2);
  }
  g.generateTexture(key, S, S);
  g.destroy();
}

// A 16×16 stone wall tile: a lit top, a shaded bottom, and a couple of darker
// "bricks" so a tiled wall has texture and a sense of height.
function makeWallTexture(scene, key) {
  const S = 16;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(COLORS.wall, 1);
  g.fillRect(0, 0, S, S);
  g.fillStyle(shade(COLORS.wall, 1.3), 1); // lit top edge
  g.fillRect(0, 0, S, 2);
  g.fillStyle(shade(COLORS.wall, 0.65), 1); // shaded bottom edge
  g.fillRect(0, S - 2, S, 2);
  g.fillStyle(shade(COLORS.wall, 0.8), 1); // brick seams
  g.fillRect(0, 7, S, 1);
  g.fillRect(7, 2, 1, 5);
  g.fillRect(11, 8, 1, 6);
  g.generateTexture(key, S, S);
  g.destroy();
}

// Called once when the arena starts. Creates every texture the game needs.
export function generateTextures(scene) {
  makeFloorTexture(scene, "floor");
  makeWallTexture(scene, "wall");
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
