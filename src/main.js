// ===========================================================================
// PixelClash — main entry point.
// Boots the Phaser game engine, configures physics, and loads the arena.
// ===========================================================================

import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from "./config.js";
import ArenaScene from "./scenes/ArenaScene.js";

const config = {
  type: Phaser.AUTO, // best renderer (WebGL, falls back to Canvas)
  parent: "game-root",
  backgroundColor: COLORS.bg,
  pixelArt: true, // keep pixels crisp when scaled
  scale: {
    mode: Phaser.Scale.FIT, // scale to fit the screen, keep proportions
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  physics: {
    default: "arcade", // simple, fast 2D physics — perfect for top-down
    arcade: { debug: false },
  },
  scene: [ArenaScene],
};

const game = new Phaser.Game(config);

// Expose the game on the window so our automated tests (and you, in the
// browser console) can inspect what's happening. Harmless in production.
window.PIXELCLASH = { game };
