// ===========================================================================
// ActionButton — a round on-screen button for touch (and clickable by mouse).
// Used for the attacks and the dash. Calls onPress when tapped, and shows a
// cooldown sweep (a dark wedge that empties clockwise) so the player can see
// when the action is ready again.
// ===========================================================================

import Phaser from "phaser";

const RADIUS = 38;

export default class ActionButton {
  constructor(scene, x, y, label, color, onPress) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.baseColor = color;
    this.cooldownUntil = 0; // timestamp (ms) when the action is ready again
    this.cooldownMs = 0; // how long the current cooldown lasts

    this.circle = scene.add.circle(x, y, RADIUS, color, 0.85).setScrollFactor(0).setDepth(1000);
    this.label = scene.add
      .text(x, y, label, { fontFamily: "monospace", fontSize: "22px", color: "#000000" })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1002);

    // The dark "cooldown" wedge drawn on top of the circle.
    this.overlay = scene.add.graphics().setScrollFactor(0).setDepth(1001);

    this.circle.setInteractive({ useHandCursor: true });
    this.circle.on("pointerdown", (pointer, lx, ly, event) => {
      // Stop this tap from also being read by the movement joystick.
      if (event) event.stopPropagation();
      this.flash();
      onPress();
    });
  }

  // A quick visual "press" feedback.
  flash() {
    this.circle.setScale(0.88);
    this.scene.tweens.add({
      targets: this.circle,
      scale: 1,
      duration: 120,
      ease: "Quad.out",
    });
  }

  // Begin a cooldown of `durationMs`. The button dims and shows a sweep.
  startCooldown(durationMs) {
    this.cooldownMs = durationMs;
    this.cooldownUntil = this.scene.time.now + durationMs;
  }

  isReady() {
    return this.scene.time.now >= this.cooldownUntil;
  }

  // Called each frame by the scene to redraw the cooldown sweep.
  update() {
    const now = this.scene.time.now;
    this.overlay.clear();
    if (now >= this.cooldownUntil || this.cooldownMs <= 0) {
      this.circle.setAlpha(0.85); // fully ready
      return;
    }
    this.circle.setAlpha(0.5); // dimmed while cooling down

    const remaining = (this.cooldownUntil - now) / this.cooldownMs; // 1 -> 0
    // Draw a dark wedge covering the remaining fraction, starting at the top
    // and sweeping clockwise.
    const start = -Math.PI / 2;
    const end = start + remaining * Math.PI * 2;
    this.overlay.fillStyle(0x000000, 0.55);
    this.overlay.beginPath();
    this.overlay.moveTo(this.x, this.y);
    this.overlay.arc(this.x, this.y, RADIUS, start, end, false);
    this.overlay.closePath();
    this.overlay.fillPath();
  }
}
