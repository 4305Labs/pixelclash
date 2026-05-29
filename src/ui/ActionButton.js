// ===========================================================================
// ActionButton — a round on-screen button for touch (and clickable by mouse).
// Used for the basic attack and the ability. Calls onPress when tapped.
// ===========================================================================

import Phaser from "phaser";

export default class ActionButton {
  constructor(scene, x, y, label, color, onPress) {
    this.circle = scene.add.circle(x, y, 38, color, 0.85).setScrollFactor(0).setDepth(1000);
    this.label = scene.add
      .text(x, y, label, { fontFamily: "monospace", fontSize: "22px", color: "#000000" })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1001);

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
    this.circle.scene.tweens.add({
      targets: this.circle,
      scale: 1,
      duration: 120,
      ease: "Quad.out",
    });
  }
}
