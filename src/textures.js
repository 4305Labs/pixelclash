// ===========================================================================
// We have no image files yet, so we DRAW our pixel-art sprites in code at
// startup and bake them into reusable textures. This keeps the repo free of
// binary art assets and means there's nothing for you to download or manage.
// Later you can replace these with real .png art without changing game logic.
// ===========================================================================

import { COLORS, PLAYER_SIZE, BASE } from "./config.js";

// Draws one little 16x16 character sprite into a named texture.
// `key` is the name we'll refer to it by; `bodyColor` is its team color.
function makeCharacterTexture(scene, key, bodyColor) {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const s = PLAYER_SIZE;

  // Black outline (a filled square one pixel bigger all around the body).
  g.fillStyle(COLORS.outline, 1);
  g.fillRect(0, 0, s, s);

  // Colored body (inset by 1px so the outline shows).
  g.fillStyle(bodyColor, 1);
  g.fillRect(1, 1, s - 2, s - 2);

  // Two white "eyes" near the top so we can tell which way is up/front.
  g.fillStyle(COLORS.white, 1);
  g.fillRect(4, 3, 2, 2);
  g.fillRect(s - 6, 3, 2, 2);

  // Bake the drawing into a texture and discard the temporary graphics object.
  g.generateTexture(key, s, s);
  g.destroy();
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

// Called once when the arena starts. Creates every texture the game needs.
export function generateTextures(scene) {
  makeCharacterTexture(scene, "player_blue", COLORS.blueTeam);
  makeCharacterTexture(scene, "player_red", COLORS.redTeam);
  makeBaseTexture(scene, "base_blue", COLORS.blueTeam);
  makeBaseTexture(scene, "base_red", COLORS.redTeam);
}
