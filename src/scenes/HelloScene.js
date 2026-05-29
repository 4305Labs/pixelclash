// ===========================================================================
// HelloScene — Milestone 2 "hello world" screen.
// Its only job: prove the toolchain works by drawing some text we can see.
// We replace this with the real arena in a later milestone.
// ===========================================================================

import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../main.js";

export default class HelloScene extends Phaser.Scene {
  constructor() {
    // Every scene has a unique name ("key") so we can switch between them later.
    super("HelloScene");
  }

  // create() runs once when the scene starts. We draw everything here.
  create() {
    const centerX = GAME_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;

    // Big title text, centered.
    this.add
      .text(centerX, centerY - 40, "PIXELCLASH", {
        fontFamily: "monospace",
        fontSize: "64px",
        color: "#ffec27", // bright yellow
      })
      .setOrigin(0.5); // 0.5 = anchor by the middle, so it's truly centered

    // Smaller confirmation line.
    this.add
      .text(centerX, centerY + 30, "It works! Toolchain is alive.", {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    // A little pulsing dot so you can see the game loop is actually running
    // (not just a frozen image). It gently fades in and out forever.
    const dot = this.add
      .text(centerX, centerY + 90, "●", {
        fontFamily: "monospace",
        fontSize: "28px",
        color: "#00e436", // green
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: dot,
      alpha: 0.15, // fade to nearly invisible
      duration: 800,
      yoyo: true, // then back to full
      repeat: -1, // forever
    });
  }
}
