// ===========================================================================
// We have no image files yet, so we DRAW our pixel-art sprites in code at
// startup and bake them into reusable textures. This keeps the repo free of
// binary art assets and means there's nothing for you to download or manage.
// Later you can replace these with real .png art without changing game logic.
// ===========================================================================

import { COLORS, PLAYER_SIZE } from "./config.js";

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

// Called once when the arena starts. Creates every texture the game needs.
export function generateTextures(scene) {
  makeCharacterTexture(scene, "player_blue", COLORS.blueTeam);
  makeCharacterTexture(scene, "player_red", COLORS.redTeam);
}
