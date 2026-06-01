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

import { COLORS, PLAYER_SIZE, BASE, MINION, TOWER, PICKUP, CLASSES, CLASS_ORDER } from "./config.js";
import { GB_DIRS, GB_FRAMES, gbHeroRows, validateGbGrids } from "./gbsprites.js";

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

// Game Boy palette for a top-down hero: steel helmet, skin, team-coloured tunic,
// brown boots, an emblem accent (goggles/hat/headband), all over a cool-black
// outline. `teamColor` tints the tunic; `emblem` is the class accent colour.
function gbPalette(teamColor, emblem) {
  return {
    ".": null,
    o: 0x10131c, // outline (cool near-black)
    h: 0xcfd8e8, H: 0x8a93ad, // helmet steel light / shadow
    s: 0xf2c79a, S: 0xc78f60, // skin light / shadow
    e: 0x10131c, // eye
    k: 0x39394d, // dark hair / hood
    b: teamColor, B: shade(teamColor, 0.62), // tunic light / shadow
    f: 0x6d4a2c, // boots
    v: emblem, V: shade(emblem, 0.6), // emblem accent / shadow
    w: 0xfff1e8, // shine
  };
}

// Bakes every directional + walk-frame texture for one class × team:
//   hero_<cls>_<team>_<dir>_<frame>  (dir: down|up|side, frame: idle|walkA|walkB)
// plus a back-compat key  hero_<cls>_<team>  (= the down/idle pose) used by the
// lobby picker, screenshots, and anything not yet facing-aware. LEFT is the SIDE
// sprite flipped horizontally at draw time, so it isn't baked here.
function makeGbHero(scene, cls, team, teamColor, emblem) {
  const palette = gbPalette(teamColor, emblem);
  for (const dir of GB_DIRS) {
    for (const frame of GB_FRAMES) {
      const rows = gbHeroRows(cls, dir, frame);
      paintGrid(scene, `hero_${cls}_${team}_${dir}_${frame}`, { rows, palette, pixel: 1 });
    }
  }
  paintGrid(scene, `hero_${cls}_${team}`, { rows: gbHeroRows(cls, "down", "idle"), palette, pixel: 1 });
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

  // Outlined diamond silhouette.
  g.fillStyle(COLORS.outline, 1);
  g.fillPoints(diamond(r, r, r), true);

  // Four cut facets around the centre, lit from the top-left: the upper-left
  // face is brightest and the lower-right darkest, so the gem reads as faceted
  // crystal rather than a flat lozenge.
  const e = r - 2;
  const top = { x: r, y: r - e };
  const bot = { x: r, y: r + e };
  const left = { x: r - e, y: r };
  const right = { x: r + e, y: r };
  const ctr = { x: r, y: r };
  g.fillStyle(shade(color, 1.45), 1); // upper-left: brightest
  g.fillPoints([top, left, ctr], true);
  g.fillStyle(shade(color, 1.1), 1); // upper-right
  g.fillPoints([top, right, ctr], true);
  g.fillStyle(shade(color, 0.8), 1); // lower-left
  g.fillPoints([bot, left, ctr], true);
  g.fillStyle(shade(color, 0.5), 1); // lower-right: darkest
  g.fillPoints([bot, right, ctr], true);

  // Thin facet seam lines from centre to each tip sharpen the cut.
  g.lineStyle(1, COLORS.outline, 0.5);
  for (const p of [top, bot, left, right]) g.lineBetween(r, r, p.x, p.y);

  // Bright core + a sparkle up-left.
  g.fillStyle(COLORS.white, 1);
  g.fillPoints(diamond(r, r, r * 0.3), true);
  g.fillStyle(shade(color, 1.8), 1);
  g.fillPoints(diamond(r, r, r * 0.16), true);
  g.fillStyle(COLORS.white, 1);
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

  // Battlements: raised merlon blocks (lit top, shadowed under-edge) standing
  // proud of the parapet, with transparent gaps between — reads as 3D crenels.
  const merlons = 3;
  const span = (s - 6) / merlons;
  for (let i = 0; i < merlons; i++) {
    const mx = 3 + i * span + span * 0.18;
    const mw = span * 0.64;
    g.fillStyle(COLORS.outline, 1);
    g.fillRect(mx - 1, 0, mw + 2, 5);
    g.fillStyle(stone, 1);
    g.fillRect(mx, 1, mw, 4);
    g.fillStyle(shade(stone, 1.4), 1); // lit cap
    g.fillRect(mx, 1, mw, 1);
  }

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

// A neutral jungle-camp monster: a spiky, two-eyed brute in a sickly green, so
// it reads as a hostile creature (not a team unit). 14×14 grid at pixel=2 to
// fill the 28×28 (CAMP.radius*2) texture.
const CAMP_ROWS = [
  "..o..oo..o....",
  ".obo.oo.obo...",
  ".obboooobbo...",
  "obbggggggbbo..",
  "obgggwwggggo..",
  "obggwwwwgggo..",
  "obgggwwggggo..",
  "obbgggggggbo..",
  ".obggrrgggbo..",
  ".obbgggggbbo..",
  "..obbgggbbo...",
  "...obbbbbo....",
  "....o..o.o....",
  "..............",
];

function makeCampTexture(scene, key) {
  const moss = COLORS.jungle;
  const palette = {
    ".": null,
    o: COLORS.outline,
    b: shade(moss, 1.6), // dark body / spikes
    g: shade(moss, 2.8), // body
    w: COLORS.white, // eyes
    r: 0xff004d, // angry mouth
  };
  paintGrid(scene, key, { rows: CAMP_ROWS, palette, pixel: 2 });
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

// A 40×40 floor tile in `baseColor`: the base fill with a faint seam at the
// top/left edge (tile grout) and a fixed scatter of slightly lighter/darker
// specks, so a tiled floor looks like textured ground instead of a flat fill.
// Deterministic (no randomness), so the render tests stay stable.
function makeFloorTexture(scene, key, baseColor = COLORS.bg, style = "stone") {
  const S = 40;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(baseColor, 1);
  g.fillRect(0, 0, S, S);
  const light = shade(baseColor, 1.35);
  const dark = shade(baseColor, 0.7);

  if (style === "moss") {
    // Jungle ground: scattered moss tufts (lighter green clumps) and a few
    // darker soil pits, so the off-lane floor reads as living undergrowth.
    const tuft = shade(baseColor, 1.5);
    const tips = shade(baseColor, 1.9);
    const soil = shade(baseColor, 0.6);
    // Each tuft: a 3×2 clump with a brighter top edge (light hits from above).
    const tufts = [
      [5, 7], [17, 4], [30, 9], [9, 19], [24, 22], [34, 28], [13, 31], [3, 27],
      [27, 34], [20, 14],
    ];
    for (const [x, y] of tufts) {
      g.fillStyle(tuft, 1);
      g.fillRect(x, y, 3, 2);
      g.fillStyle(tips, 1);
      g.fillRect(x, y, 3, 1);
    }
    // Bare soil pits between the tufts.
    for (const [x, y] of [[12, 12], [33, 16], [7, 35], [23, 6]]) {
      g.fillStyle(soil, 1);
      g.fillRect(x, y, 2, 2);
    }
    g.generateTexture(key, S, S);
    g.destroy();
    return;
  }

  // Stone road: a cobble grid (four big blocks) with dark grout seams, a lit
  // top edge per block for relief, plus a hairline crack and a few pits.
  const seam = shade(baseColor, 0.55);
  g.fillStyle(seam, 1);
  g.fillRect(0, 19, S, 2); // horizontal grout
  g.fillRect(19, 0, 2, S); // vertical grout
  g.fillStyle(shade(baseColor, 1.2), 1); // lit top edge of each cobble row
  g.fillRect(0, 0, S, 1);
  g.fillRect(0, 21, S, 1);
  // A hairline crack across the lower-left cobble.
  g.fillStyle(dark, 1);
  for (const [x, y] of [[4, 26], [5, 27], [6, 28], [7, 28], [8, 29], [9, 30]]) {
    g.fillRect(x, y, 1, 1);
  }
  // Sparse pits and flecks give the stone grain.
  const flecks = [
    [6, 9, light], [13, 5, dark], [27, 8, dark], [33, 12, light],
    [26, 27, dark], [34, 31, light], [12, 33, light], [30, 35, dark],
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

// Non-colliding jungle decor as pixel grids (pixel=2). A leafy bush or a mossy
// rock, both on a transparent background, palettes derived from the jungle
// colour so they sit naturally on the green floor.
const DECOR_ROWS = {
  bush: [
    "...oooo...",
    "..ollllo..",
    ".ollgglloo",
    "ollggggllo",
    "ollggggglo",
    "olgggggglo",
    ".ologgolo.",
    "..oo..oo..",
  ],
  rock: [
    "..........",
    "...oooo...",
    "..olllho..",
    ".ollllhho.",
    "ollllhhho.",
    "olllhhhho.",
    ".oohhhhoo.",
    "..oooooo..",
  ],
};

function makeDecorTexture(scene, key, kind) {
  const moss = COLORS.jungle;
  const stone = COLORS.wall;
  const palette = {
    ".": null,
    o: COLORS.outline,
    l: kind === "rock" ? stone : shade(moss, 2.6), // leaf body / rock body
    g: shade(moss, 2.0), // darker leaf
    h: shade(stone, 0.7), // rock shadow
  };
  paintGrid(scene, key, { rows: DECOR_ROWS[kind], palette, pixel: 2 });
}

// Called once when the arena starts. Creates every texture the game needs.
export function generateTextures(scene) {
  makeFloorTexture(scene, "floor", COLORS.bg, "stone");
  makeFloorTexture(scene, "floor_jungle", COLORS.jungle, "moss");
  makeWallTexture(scene, "wall");
  // Game Boy top-down heroes: one set of directional + walk-frame textures per
  // class × team (keys "hero_<cls>_<team>_<dir>_<frame>", plus a back-compat
  // "hero_<cls>_<team>" = down/idle). The legacy "player_<team>" key (= soldier)
  // stays for anything not class-aware. validateGbGrids() throws loudly if a
  // hand-authored grid row isn't 16 wide, before paintGrid can crash obscurely.
  validateGbGrids();
  for (const team of ["blue", "red"]) {
    const color = team === "red" ? COLORS.redTeam : COLORS.blueTeam;
    for (const cls of CLASS_ORDER) {
      makeGbHero(scene, cls, team, color, CLASSES[cls].emblem);
    }
    // "player_<team>" alias = the soldier's down/idle pose.
    paintGrid(scene, `player_${team}`, {
      rows: gbHeroRows("soldier", "down", "idle"),
      palette: gbPalette(color, CLASSES.soldier.emblem),
      pixel: 1,
    });
  }
  makeBaseTexture(scene, "base_blue", COLORS.blueTeam);
  makeBaseTexture(scene, "base_red", COLORS.redTeam);
  makeMinionTexture(scene, "minion_blue", COLORS.minionBlue);
  makeMinionTexture(scene, "minion_red", COLORS.minionRed);
  makeTowerTexture(scene, "tower_blue", COLORS.blueTeam);
  makeTowerTexture(scene, "tower_red", COLORS.redTeam);
  makePickupTexture(scene, "pickup_heal", "heal");
  makePickupTexture(scene, "pickup_power", "power");
  makeDecorTexture(scene, "decor_bush", "bush");
  makeDecorTexture(scene, "decor_rock", "rock");
  makeCampTexture(scene, "camp");
}
