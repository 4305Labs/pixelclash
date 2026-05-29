// ===========================================================================
// PixelClash — main entry point
// This file boots the Phaser game engine and loads our first scene.
// (A "scene" is one screen of the game — like a menu, or the arena.)
// ===========================================================================

import Phaser from "phaser";
import HelloScene from "./scenes/HelloScene.js";

// The size of our game world, in pixels. We use a fixed logical size and
// let Phaser scale it to fit any screen (phone or desktop) for us.
export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;

const config = {
  type: Phaser.AUTO, // Let Phaser pick the best renderer (WebGL, falls back to Canvas)
  parent: "game-root", // Put the game inside the <div id="game-root"> in index.html
  backgroundColor: "#1d2b53", // A dark blue background (classic pixel-art palette)
  pixelArt: true, // Keep pixels crisp instead of blurry when scaled
  scale: {
    mode: Phaser.Scale.FIT, // Scale the game to fit the screen, keeping proportions
    autoCenter: Phaser.Scale.CENTER_BOTH, // Center it horizontally and vertically
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  scene: [HelloScene], // The list of scenes; the first one starts automatically
};

// Create the game. This single line starts everything.
new Phaser.Game(config);
