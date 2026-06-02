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
import { RPG_HEROES, validateRpgGrids } from "./rpgsprites.js";

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

// Palette for a detailed "Tiny RPG" hero. Neutral materials (steel, skin, gold,
// wood, blade, green, white) are shared; only the team GARMENT (c/C/p) is tinted
// per team, so blue vs red read apart. Garment colours are picked to look like
// dyed cloth (not the neon HUD team colours).
const TEAM_GARMENT = {
  blue: { c: 0x3a78c0, C: 0x244e84, p: 0x6aa0e8 },
  red: { c: 0xc23a3a, C: 0x822020, p: 0xe06a6a },
};
function rpgPalette(team) {
  const g = TEAM_GARMENT[team] || TEAM_GARMENT.blue;
  return {
    ".": null,
    o: 0x0d0d16, // outline
    L: 0xc8d0e0, M: 0x8a92a8, D: 0x565c70, // steel light / mid / dark
    s: 0xf0c090, k: 0xc08858, // skin / shadow
    e: 0x0d0d16, // eye
    c: g.c, C: g.C, p: g.p, // team garment mid / dark / light
    b: 0xdfe6f2, // blade
    h: 0xe0ac28, g: 0x9c6c14, // gold / dark gold (hilts, gems)
    w: 0xffffff, W: 0x5c3a18, // white shine / dark wood
    r: 0xff5030, // fire / gem
    n: 0x3aa05a, G: 0x6a8a3a, // ranger greens (cloak light / dark)
    f: 0xe8e8f0, // beard / fur white
  };
}

// Bakes the single front-facing hero texture "hero_<cls>_<team>" (24x24) for one
// class × team. Heroes always face the camera; left-facing is the same sprite
// mirrored at draw time (see Player).
function makeRpgHero(scene, cls, team) {
  paintGrid(scene, `hero_${cls}_${team}`, { rows: RPG_HEROES[cls], palette: rpgPalette(team), pixel: 1 });
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
  // Grass uses a larger tile so the pattern repeats half as often (less obvious
  // tiling); the (now unused) stone style stays 40.
  const S = style === "moss" ? 80 : 40;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(baseColor, 1);
  g.fillRect(0, 0, S, S);
  const light = shade(baseColor, 1.35);
  const dark = shade(baseColor, 0.7);

  if (style === "moss") {
    // Lush grassland: a bright base scattered over an 80×80 tile with darker +
    // lighter grass tufts and the odd wildflower, placed irregularly so the
    // field reads like a meadow rather than a grid.
    const patch = shade(baseColor, 0.8);
    const tuft = shade(baseColor, 1.22);
    const tips = shade(baseColor, 1.5);
    // Irregular darker patches break up the flat green.
    for (const [x, y, w, h] of [[14, 22, 7, 4], [52, 12, 6, 3], [30, 58, 8, 4], [64, 48, 6, 4], [6, 66, 5, 3], [44, 38, 5, 3]]) {
      g.fillStyle(patch, 1);
      g.fillRect(x, y, w, h);
    }
    // Grass tufts (3×2 clumps, brighter top edge), scattered across the tile.
    const tufts = [
      [5, 9], [21, 4], [38, 11], [57, 6], [70, 14], [11, 28], [33, 24], [48, 31],
      [62, 27], [76, 35], [4, 44], [25, 47], [41, 52], [55, 44], [72, 56], [16, 63],
      [35, 70], [50, 66], [68, 72], [9, 53], [29, 14], [60, 60],
    ];
    for (const [x, y] of tufts) {
      g.fillStyle(tuft, 1);
      g.fillRect(x, y, 3, 2);
      g.fillStyle(tips, 1);
      g.fillRect(x, y, 3, 1);
    }
    // Sparse wildflowers: a coloured petal block with a white centre dot.
    const flowers = [
      [12, 16, 0xffe34d], [46, 20, 0xff7bbf], [66, 8, 0xffffff],
      [24, 40, 0xc77bff], [58, 50, 0xffe34d], [36, 64, 0x6fc0ff], [8, 72, 0xff7bbf],
    ];
    for (const [x, y, c] of flowers) {
      g.fillStyle(c, 1);
      g.fillRect(x, y, 2, 2);
      g.fillStyle(0xffffff, 1);
      g.fillRect(x, y, 1, 1);
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
  // Patches of moss creeping over the stone, so structures look overgrown in
  // the glade rather than freshly cut.
  g.fillStyle(0x4f8a32, 1);
  g.fillRect(1, 12, 3, 2);
  g.fillRect(12, 13, 3, 2);
  g.fillRect(9, 1, 2, 2);
  g.fillStyle(0x6fae45, 1); // brighter moss tips
  g.fillRect(1, 12, 3, 1);
  g.fillRect(12, 13, 2, 1);
  g.generateTexture(key, S, S);
  g.destroy();
}

// Non-colliding jungle decor as pixel grids (pixel=2). A leafy bush or a mossy
// rock, both on a transparent background, palettes derived from the jungle
// colour so they sit naturally on the green floor.
const DECOR_ROWS = {
  bush: [
    "...oooo...",
    "..oLLLLo..",
    ".oLLgglLoo",
    "oLLggggLLo",
    "oLLgggggLo",
    "oLgggggggo",
    ".oLggggLo.",
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
  // A round leafy tree: layered canopy (highlight L / body l / shadow g) over a
  // short wooden trunk. 13 wide so it reads as a proper glade tree.
  tree: [
    "....ooooo....",
    "..ooLLLLLoo..",
    ".oLLLLLLLLLo.",
    "oLLLLLLLLLLgo",
    "oLLLLLLLLLggo",
    "oLLLLLLLLgggo",
    "oLLLLLLLggggo",
    ".oLLLLLggggo.",
    "..ooLLgggoo..",
    "....owwwo....",
    "....owwwo....",
    "....oWWWo....",
    "...ooooooo...",
  ],
  // A mossy tree stump with a couple of growth rings.
  stump: [
    "..ooooo..",
    ".owwwwwo.",
    ".oWwgwWo.",
    ".owwwwwo.",
    "..ooooo..",
  ],
};

function makeDecorTexture(scene, key, kind) {
  const stone = COLORS.wall;
  const palette = {
    ".": null,
    o: COLORS.outline,
    // Foliage greens are fixed (independent of the bright grass base) so bushes
    // and trees read as darker, leafier clumps against the field.
    l: kind === "rock" ? stone : 0x4f9e34, // rock body / leaf mid
    g: kind === "rock" ? shade(stone, 0.6) : 0x2f6b22, // rock crack / leaf shadow
    L: 0x82c44e, // leaf highlight
    h: shade(stone, 0.7), // rock shadow
    w: 0x8a5a2a, // trunk wood
    W: 0x5c3a18, // trunk shadow
  };
  paintGrid(scene, key, { rows: DECOR_ROWS[kind], palette, pixel: 2 });
}

// Called once when the arena starts. Creates every texture the game needs.
export function generateTextures(scene) {
  // Lanes are now drawn as solid flowing road ribbons (see ArenaScene.drawGrid),
  // so only the jungle floor needs a texture.
  makeFloorTexture(scene, "floor_jungle", COLORS.jungle, "moss");
  makeWallTexture(scene, "wall");
  // Detailed front-facing "Tiny RPG" heroes: one texture "hero_<cls>_<team>" per
  // class × team, plus the "player_<team>" alias (= soldier) for anything not
  // class-aware. validateRpgGrids() throws loudly if a hand-authored grid isn't
  // 24x24, before paintGrid can crash obscurely.
  validateRpgGrids();
  for (const team of ["blue", "red"]) {
    for (const cls of CLASS_ORDER) makeRpgHero(scene, cls, team);
    paintGrid(scene, `player_${team}`, { rows: RPG_HEROES.soldier, palette: rpgPalette(team), pixel: 1 });
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
  makeDecorTexture(scene, "decor_tree", "tree");
  makeDecorTexture(scene, "decor_stump", "stump");
  makeCampTexture(scene, "camp");
}
