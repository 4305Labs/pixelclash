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

// A 10×10 little goblin lane minion (painted at pixel=2 → 20×20, size UNCHANGED):
// pointy ears, a hunched body with a top-lit highlight and a shaded belly, two
// white eyes with dark pupils, a snaggle-tooth grin, stubby legs, and a little
// grey club shouldered on one side so it reads as an armed-but-lesser creature
// next to the heroes. Still painted in a lighter team tint so it stays "lesser".
//   o = black outline   b = team body   h = lit highlight   d = shaded belly
//   w = eye white       e = pupils + mouth (black)
//   g = club shaft (grey)   G = club head (darker grey)
const MINION_ROWS = [
  ".o.gG..o..",
  "obohG.obo.",
  "obbhgbbbo.",
  "obwbbwbbo.",
  "obeobeobo.",
  "obbbbbbbo.",
  "obdeeedbo.",
  ".obbbbbo..",
  ".oo.o.oo..",
  "..o...o...",
];

// Draws a minion sprite into `key`, tinted with `color`. The team `color` (a
// lighter tint from COLORS.minionBlue/minionRed) carries the body; the grey club
// is neutral so the weapon reads the same on both teams.
function makeMinionTexture(scene, key, color) {
  const palette = {
    ".": null,
    o: COLORS.outline,
    b: color,
    h: shade(color, 1.25), // top-lit highlight on the body
    d: shade(color, 0.7), // shaded belly
    w: COLORS.white, // eye white
    e: COLORS.outline, // pupils + mouth line
    g: 0x9a8f7e, // club shaft (neutral grey-brown, matches the stone palette)
    G: 0x6f665a, // club head (darker)
  };
  paintGrid(scene, key, { rows: MINION_ROWS, palette, pixel: 2 });
}

// Draws a team BASE: a grand stone keep crowned with a big floating team crystal
// — the nexus you destroy to win. Built procedurally to match the mossy-stone
// tower (see makeTowerTexture): a wide stepped plinth of crisp grey stone with a
// lit left edge / shadowed right edge, two flanking pillars topped with little
// team banners, creeping moss to tie it to the glades, and a large glowing,
// faceted team CRYSTAL hovering above its socket as the obvious objective. A soft
// grounding shadow seats it on the grass. Reads clearly bigger / more important
// than a tower. Size is UNCHANGED (radius*2 = 48) so hit detection, shield ring,
// and layout are identical to before; team colour rides the crystal + banners.
function makeBaseTexture(scene, key, color) {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const r = BASE.radius;
  const size = r * 2; // 48 — load-bearing, must stay identical
  const stone = COLORS.wall;
  const edge = COLORS.wallEdge; // darker stone outline (mossy-stone palette)

  // Soft cast shadow on the ground at the foot of the keep (a wide oval pad), so
  // the structure reads as a solid building standing on the grass.
  g.fillStyle(COLORS.outline, 0.22);
  g.fillEllipse(r, size - 4, size - 8, 8);

  // --- Stepped stone plinth: a broad two-tier base, lit from the top-left -----
  // Each tier is an outlined block (dark edge) with the stone fill inset, a lit
  // left strip and a shadowed right strip, so the keep reads as carved masonry.
  const tier = (x, w, y, h) => {
    g.fillStyle(edge, 1);
    g.fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle(stone, 1);
    g.fillRect(x, y, w, h);
    g.fillStyle(shade(stone, 1.28), 1); // lit left edge
    g.fillRect(x, y, 3, h);
    g.fillStyle(shade(stone, 0.62), 1); // shadowed right edge
    g.fillRect(x + w - 3, y, 3, h);
  };
  tier(6, size - 12, size - 12, 8); // wide bottom step
  tier(11, size - 22, size - 19, 8); // narrower upper step
  // Faint brick seams across the upper step for stonework grain.
  g.fillStyle(shade(stone, 0.78), 1);
  g.fillRect(13, size - 15, size - 26, 1);
  for (const bx of [r - 8, r, r + 8]) g.fillRect(bx, size - 19, 1, 7);

  // --- Two flanking pillars with team banners ---------------------------------
  // Short stone columns at the back corners, each capped with a small cloth
  // banner in the team colour so blue vs red read apart even from a distance.
  const pillar = (px) => {
    g.fillStyle(edge, 1);
    g.fillRect(px - 1, 9, 7, 22);
    g.fillStyle(stone, 1);
    g.fillRect(px, 10, 5, 20);
    g.fillStyle(shade(stone, 1.28), 1); // lit left edge
    g.fillRect(px, 10, 1, 20);
    g.fillStyle(shade(stone, 0.62), 1); // shadowed right edge
    g.fillRect(px + 4, 10, 1, 20);
    // Banner: a pole tip plus a hanging team-coloured flag with a darker fold.
    g.fillStyle(edge, 1);
    g.fillRect(px + 2, 4, 1, 6); // pole
    g.fillStyle(shade(color, 1.2), 1);
    g.fillRect(px - 2, 5, 9, 6); // flag body
    g.fillStyle(shade(color, 0.7), 1);
    g.fillRect(px - 2, 9, 9, 2); // shaded lower fold
  };
  pillar(5); // left pillar
  pillar(size - 10); // right pillar

  // Creeping moss patches near the foot, matching the overgrown glade walls.
  g.fillStyle(0x4f8a32, 1);
  g.fillRect(8, size - 7, 5, 3);
  g.fillRect(size - 14, size - 6, 5, 3);
  g.fillStyle(0x6fae45, 1); // brighter moss tips
  g.fillRect(8, size - 7, 5, 1);
  g.fillRect(size - 14, size - 6, 4, 1);

  // --- The big glowing team crystal: the nexus core hovering over its socket --
  const gx = r;
  const gy = r - 2; // sits high so it crowns the keep
  const gr = r - 7; // large gem — clearly bigger than a tower's crystal
  // A dark stone socket the crystal rises from, set into the upper step.
  g.fillStyle(edge, 1);
  g.fillRect(r - 7, size - 22, 14, 6);
  g.fillStyle(COLORS.outline, 1);
  g.fillRect(r - 5, size - 21, 10, 4);
  // Soft halo so the core looks lit (two faint diamonds under the gem).
  g.fillStyle(color, 0.16);
  g.fillPoints(diamond(gx, gy, gr + 5), true);
  g.fillStyle(color, 0.24);
  g.fillPoints(diamond(gx, gy, gr + 2), true);
  // Outlined faceted diamond, lit from the top-left like the tower crystal.
  g.fillStyle(COLORS.outline, 1);
  g.fillPoints(diamond(gx, gy, gr + 1), true);
  const e = gr;
  const top = { x: gx, y: gy - e };
  const bot = { x: gx, y: gy + e };
  const left = { x: gx - e, y: gy };
  const right = { x: gx + e, y: gy };
  const ctr = { x: gx, y: gy };
  g.fillStyle(shade(color, 1.45), 1); // upper-left facet: brightest
  g.fillPoints([top, left, ctr], true);
  g.fillStyle(shade(color, 1.1), 1); // upper-right
  g.fillPoints([top, right, ctr], true);
  g.fillStyle(shade(color, 0.8), 1); // lower-left
  g.fillPoints([bot, left, ctr], true);
  g.fillStyle(shade(color, 0.5), 1); // lower-right: darkest
  g.fillPoints([bot, right, ctr], true);
  // Thin facet seam lines from centre to each tip sharpen the cut.
  g.lineStyle(1, COLORS.outline, 0.5);
  for (const p of [top, bot, left, right]) g.lineBetween(gx, gy, p.x, p.y);
  // Bright energised core + a hard white spark up-left = a charged nexus.
  g.fillStyle(shade(color, 1.8), 1);
  g.fillPoints(diamond(gx, gy, gr * 0.42), true);
  g.fillStyle(COLORS.white, 1);
  g.fillPoints(diamond(gx, gy, gr * 0.2), true);
  g.fillRect(gx - Math.round(gr * 0.42), gy - Math.round(gr * 0.42), 2, 2);

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

// Draws a guard tower: a crisp mossy-stone defensive turret. Reading top-to-
// bottom: crenellated battlements (raised merlon blocks with gaps), a tapered
// stone shaft with a lit left edge / shadowed right edge and a couple of brick
// seams, a few creeping moss patches to match the glade walls, and a glowing
// team-coloured CRYSTAL set in a dark socket where the tower zaps from (a layered
// glow -> outline -> faceted gem -> white spark). A soft dark base/shadow grounds
// it. Painted with graphics primitives within the SAME canvas (radius*2) so the
// baked texture size — load-bearing for tower hit detection/placement — is
// UNCHANGED. Team colour rides the crystal so blue vs red read apart.
function makeTowerTexture(scene, key, color) {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const s = TOWER.radius * 2; // 44 — must stay identical to before
  const c = TOWER.radius;
  const stone = COLORS.wall;
  const edge = COLORS.wallEdge; // darker stone outline (mossy-stone palette)

  // Soft cast shadow on the ground at the foot of the turret (an oval pad), so
  // the tower reads as a solid object standing on the grass rather than a decal.
  g.fillStyle(COLORS.outline, 0.22);
  g.fillEllipse(c, s - 3, s - 8, 7);

  // --- Stone shaft: a slightly tapered turret (wider at the base) -------------
  // Outlined trapezoid silhouette, then the stone fill inset by the outline.
  const topY = 6; // battlements sit above this
  const baseY = s - 4;
  const topInset = 7; // narrower at the top
  const botInset = 4; // wider at the foot
  const shaft = (inset, yTop, yBot) => [
    { x: inset, y: yTop },
    { x: s - inset, y: yTop },
    { x: s - botInset, y: yBot },
    { x: botInset, y: yBot },
  ];
  g.fillStyle(edge, 1); // dark stone outline
  g.fillPoints(shaft(topInset - 1, topY - 1, baseY + 1), true);
  g.fillStyle(stone, 1); // body
  g.fillPoints(shaft(topInset, topY, baseY), true);
  // Lit left face and shadowed right face for a rounded, top-left-lit column.
  g.fillStyle(shade(stone, 1.28), 1);
  g.fillRect(topInset, topY, 4, baseY - topY);
  g.fillStyle(shade(stone, 0.62), 1);
  g.fillRect(s - botInset - 5, topY, 4, baseY - topY);
  // Brick courses (faint darker seams across the shaft) for stonework grain.
  g.fillStyle(shade(stone, 0.78), 1);
  for (const sy of [16, 26, 36]) g.fillRect(topInset + 1, sy, s - 2 * topInset - 2, 1);

  // Creeping moss patches near the foot, matching the overgrown wall tiles.
  g.fillStyle(0x4f8a32, 1);
  g.fillRect(7, baseY - 7, 4, 3);
  g.fillRect(s - 12, baseY - 5, 4, 3);
  g.fillStyle(0x6fae45, 1); // brighter moss tips
  g.fillRect(7, baseY - 7, 4, 1);
  g.fillRect(s - 12, baseY - 5, 3, 1);

  // --- Battlements: crenellations along the top parapet -----------------------
  // A solid parapet band, then raised merlon blocks with transparent gaps so the
  // top edge reads as a crisp 3D crown of crenels.
  g.fillStyle(edge, 1);
  g.fillRect(topInset - 1, 4, s - 2 * (topInset - 1), 4);
  g.fillStyle(stone, 1);
  g.fillRect(topInset, 5, s - 2 * topInset, 2);
  g.fillStyle(shade(stone, 1.3), 1); // lit cap of the parapet
  g.fillRect(topInset, 5, s - 2 * topInset, 1);
  const merlons = 3;
  const span = (s - 2 * topInset) / merlons;
  for (let i = 0; i < merlons; i++) {
    const mx = topInset + i * span + span * 0.16;
    const mw = span * 0.68;
    g.fillStyle(edge, 1);
    g.fillRect(mx - 1, 0, mw + 2, 5);
    g.fillStyle(stone, 1);
    g.fillRect(mx, 1, mw, 4);
    g.fillStyle(shade(stone, 1.4), 1); // lit cap
    g.fillRect(mx, 1, mw, 1);
  }

  // --- Glowing team crystal in a dark socket (the muzzle it zaps from) ---------
  const gx = c;
  const gy = c + 3; // centred on the shaft, a touch low so the parapet frames it
  const gr = c - 9; // gem radius
  // Soft halo so the crystal looks lit (drawn under the socket rim).
  g.fillStyle(color, 0.22);
  g.fillCircle(gx, gy, gr + 4);
  // Dark stone socket the gem is mounted in.
  g.fillStyle(edge, 1);
  g.fillCircle(gx, gy, gr + 2);
  g.fillStyle(COLORS.outline, 1);
  g.fillCircle(gx, gy, gr + 1);
  // Faceted gem: an outlined diamond split into a lit and a shadowed half.
  const top = { x: gx, y: gy - gr };
  const bot = { x: gx, y: gy + gr };
  const left = { x: gx - gr, y: gy };
  const right = { x: gx + gr, y: gy };
  const ctr = { x: gx, y: gy };
  g.fillStyle(shade(color, 1.45), 1); // upper-left facet (brightest)
  g.fillPoints([top, left, ctr], true);
  g.fillStyle(shade(color, 1.1), 1);
  g.fillPoints([top, right, ctr], true);
  g.fillStyle(shade(color, 0.85), 1);
  g.fillPoints([bot, left, ctr], true);
  g.fillStyle(shade(color, 0.55), 1); // lower-right facet (darkest)
  g.fillPoints([bot, right, ctr], true);
  // Bright energised core + a hard white spark up-left = a charged lens.
  g.fillStyle(shade(color, 1.7), 1);
  g.fillCircle(gx, gy, Math.max(1.5, gr * 0.4));
  g.fillStyle(COLORS.white, 1);
  g.fillCircle(gx - 1, gy - 1, Math.max(1, gr * 0.22));

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
  // Fixed forest-ogre greens (independent of the bright grass base) so the brute
  // reads as a darker monster against the field, not a washed-out blob.
  const palette = {
    ".": null,
    o: COLORS.outline,
    b: 0x2c4a1c, // dark body / spikes
    g: 0x5e9e3a, // body
    w: COLORS.white, // eyes
    r: 0xff004d, // angry mouth
  };
  paintGrid(scene, key, { rows: CAMP_ROWS, palette, pixel: 2 });
}

// Draws a pickup orb: a glossy round gem that reads clearly from across the
// arena. Layered from the outside in: a soft outer GLOW ring (two faint halos so
// the orb looks lit), a black outline, a shadowed lower body, a brighter lit
// body nudged up-left, a crisp rim light along the top edge, a white SPECULAR
// dot, and a white symbol — a plus for heal (green), a lightning bolt for power
// (orange). Two explicit hex bases keep the teams readable (green vs orange) and
// avoid clipping from shade() of an already-bright colour. Size is UNCHANGED
// (radius*2) — it's load-bearing for pickup hit detection.
function makePickupTexture(scene, key, kind) {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const r = PICKUP.radius;
  const s = r * 2;
  // Explicit colours per kind: a base, a brighter "lit" tone, a darker shadow,
  // and a glow tint. Heal stays green-ish, power keeps its orange.
  const c = kind === "heal"
    ? { base: 0x18c64a, lit: 0x52f07a, dark: 0x0c7a2c, glow: 0x6effa0 }
    : { base: 0xffa300, lit: 0xffd24a, dark: 0xb56b00, glow: 0xffd070 };

  // Soft outer glow: two faint, translucent halos out to the texture edge so the
  // orb looks like it's emitting light (drawn first, the solid orb sits on top).
  g.fillStyle(c.glow, 0.18);
  g.fillCircle(r, r, r);          // outer halo, full texture radius
  g.fillStyle(c.glow, 0.3);
  g.fillCircle(r, r, r - 1);      // inner halo, a touch tighter & brighter

  // Outlined round silhouette (a clean disc just inside the glow).
  g.fillStyle(COLORS.outline, 1);
  g.fillCircle(r, r, r - 2);
  // Shadowed base, then the brighter lit body nudged up-left for volume.
  g.fillStyle(c.dark, 1);
  g.fillCircle(r, r, r - 3);
  g.fillStyle(c.base, 1);
  g.fillCircle(r - 1, r - 1, r - 5);
  // A crisp rim light arcing along the top — a thin bright crescent carved back
  // to the body below so it reads as a curved, glossy surface.
  g.fillStyle(c.lit, 1);
  g.fillCircle(r - 1, r - 2, r - 6);
  g.fillStyle(c.base, 1);
  g.fillCircle(r - 1, r, r - 6);

  // Bright white specular dot up-left (a soft halo + a hard core = "shine").
  g.fillStyle(COLORS.white, 0.9);
  g.fillCircle(r - 3, r - 3, Math.max(1.5, r * 0.22));
  g.fillStyle(COLORS.white, 1);
  g.fillCircle(r - 3, r - 3, Math.max(1, r * 0.12));

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
    // A handful of extra tufts thicken the meadow without raising contrast: they
    // reuse the same low-contrast tuft/tips tones, so the field reads lusher but
    // stays calm and readable under the units.
    const tufts = [
      [5, 9], [21, 4], [38, 11], [57, 6], [70, 14], [11, 28], [33, 24], [48, 31],
      [62, 27], [76, 35], [4, 44], [25, 47], [41, 52], [55, 44], [72, 56], [16, 63],
      [35, 70], [50, 66], [68, 72], [9, 53], [29, 14], [60, 60],
      [18, 38], [44, 7], [73, 44], [2, 20], [52, 73], [27, 33], [64, 18], [40, 46],
    ];
    for (const [x, y] of tufts) {
      g.fillStyle(tuft, 1);
      g.fillRect(x, y, 3, 2);
      g.fillStyle(tips, 1);
      g.fillRect(x, y, 3, 1);
    }
    // A few single bright blades poking up between the tufts — a 1px tip dot —
    // for fine grass detail that catches the eye without being a shape.
    g.fillStyle(tips, 1);
    for (const [x, y] of [[15, 11], [53, 35], [31, 49], [67, 63], [7, 31], [46, 60]]) {
      g.fillRect(x, y, 1, 1);
    }
    // A scatter of tiny pebbles (a 2×1 stone speck capped by a lighter top dot)
    // in neutral stone tones, so they read as ground grain. Low-contrast and
    // small enough never to be mistaken for a pickup. Explicit hex (stone family),
    // never shade(jungle) — the bright grass base clips when lightened.
    const pebble = 0x7a7264;     // muted grey-brown stone
    const pebbleLit = 0x968c7c;  // its lit top edge
    for (const [x, y] of [[34, 17], [9, 41], [71, 30], [47, 58], [22, 68], [61, 9]]) {
      g.fillStyle(pebble, 1);
      g.fillRect(x, y, 2, 1);
      g.fillStyle(pebbleLit, 1);
      g.fillRect(x, y, 1, 1);
    }
    // Sparse wildflowers: a coloured petal block with a white centre dot. A couple
    // of extra tiny blooms (kept to the same muted petal palette) sprinkle a bit
    // more colour variation across the meadow without crowding it.
    const flowers = [
      [12, 16, 0xffe34d], [46, 20, 0xff7bbf], [66, 8, 0xffffff],
      [24, 40, 0xc77bff], [58, 50, 0xffe34d], [36, 64, 0x6fc0ff], [8, 72, 0xff7bbf],
      [70, 64, 0xffe34d], [3, 55, 0x6fc0ff],
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
  // short wooden trunk. 13 wide so it reads as a proper glade tree. The mid-tone
  // body (l) dapples the interior so the canopy looks rounded and leafy rather
  // than a flat green sheet. Size UNCHANGED (13×13 grid → 26×26 at pixel=2).
  tree: [
    "....ooooo....",
    "..ooLLLLLoo..",
    ".oLLlLLLlLLo.",
    "oLLLLlLLlLLgo",
    "oLLlLLLLlLggo",
    "oLLLLLlLLgggo",
    "oLLlLLLlggggo",
    ".oLLLllggggo.",
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
  // A little cluster of wildflowers on stems — a yellow, a blue, and a pink.
  flowers: [
    "..o.....o..",
    ".oyo...obo.",
    "..g.....g..",
    "....o......",
    "...opo.....",
    "...gggg....",
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
    g: kind === "rock" ? shade(stone, 0.6) : 0x2f6b22, // rock crack / leaf shadow / stem
    L: 0x82c44e, // leaf highlight
    h: shade(stone, 0.7), // rock shadow
    w: 0x8a5a2a, // trunk wood
    W: 0x5c3a18, // trunk shadow
    y: 0xffe34d, // yellow bloom
    b: 0x6fc0ff, // blue bloom
    p: 0xff7bbf, // pink bloom
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
  makeDecorTexture(scene, "decor_flowers", "flowers");
  makeCampTexture(scene, "camp");
}
