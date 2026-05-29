// ===========================================================================
// VirtualJoystick — an on-screen thumb-stick for touch devices (your phone).
// It's "floating": when you press the left side of the screen, the stick
// appears under your thumb. Drag to steer. Release to stop.
// On desktop it also works with the mouse, so we can test without a phone.
// ===========================================================================

import Phaser from "phaser";

const RADIUS = 60; // how far the thumb can travel from the center, in pixels

export default class VirtualJoystick {
  constructor(scene) {
    this.scene = scene;
    this.pointerId = null; // which finger/pointer is currently driving the stick
    this.vector = new Phaser.Math.Vector2(0, 0); // current direction (-1..1)

    // The ring (base) and the thumb. Drawn on top of everything (high depth)
    // and fixed to the camera so they don't scroll with the world.
    this.base = scene.add.circle(0, 0, RADIUS, 0xffffff, 0.15).setDepth(1000);
    this.thumb = scene.add.circle(0, 0, RADIUS * 0.45, 0xffffff, 0.4).setDepth(1001);
    this.base.setScrollFactor(0);
    this.thumb.setScrollFactor(0);
    this.setVisible(false);

    // Listen for touch/mouse on the whole scene.
    scene.input.on("pointerdown", this.onDown, this);
    scene.input.on("pointermove", this.onMove, this);
    scene.input.on("pointerup", this.onUp, this);
    scene.input.on("pointerupoutside", this.onUp, this);
  }

  setVisible(v) {
    this.base.setVisible(v);
    this.thumb.setVisible(v);
  }

  // Only react to presses on the LEFT half of the screen, so the right half
  // stays free for the action buttons we add later.
  isInZone(pointer) {
    return pointer.x < this.scene.scale.width / 2;
  }

  onDown(pointer) {
    if (this.pointerId !== null || !this.isInZone(pointer)) return;
    this.pointerId = pointer.id;
    this.base.setPosition(pointer.x, pointer.y);
    this.thumb.setPosition(pointer.x, pointer.y);
    this.setVisible(true);
  }

  onMove(pointer) {
    if (pointer.id !== this.pointerId) return;
    const dx = pointer.x - this.base.x;
    const dy = pointer.y - this.base.y;
    const dist = Math.min(RADIUS, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx);

    // Keep the thumb visually inside the ring.
    this.thumb.setPosition(
      this.base.x + Math.cos(angle) * dist,
      this.base.y + Math.sin(angle) * dist
    );

    // Output direction is the thumb offset divided by the radius (-1..1).
    this.vector.set((Math.cos(angle) * dist) / RADIUS, (Math.sin(angle) * dist) / RADIUS);
  }

  onUp(pointer) {
    if (pointer.id !== this.pointerId) return;
    this.pointerId = null;
    this.vector.set(0, 0);
    this.setVisible(false);
  }

  // The arena calls this each frame to ask "which way is the stick pointing?"
  getVector() {
    return this.vector;
  }
}
