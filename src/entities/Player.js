// ===========================================================================
// Player — the on-screen representation of one player in the arena.
// In our networked model the SERVER decides positions; this object just shows
// a player and smoothly glides toward the latest position the server reported
// (so movement looks fluid even though updates arrive 30 times a second).
//
// It's a Container (a group you can move as one) so we can attach a health bar
// to it in the next milestone.
// ===========================================================================

import Phaser from "phaser";
import { SPRITE_SCALE } from "../config.js";

export default class Player extends Phaser.GameObjects.Container {
  constructor(scene, x, y, team) {
    super(scene, x, y);
    this.team = team;
    this.targetX = x;
    this.targetY = y;

    const texture = team === "red" ? "player_red" : "player_blue";
    this.bodySprite = scene.add.sprite(0, 0, texture).setScale(SPRITE_SCALE);
    this.add(this.bodySprite);

    scene.add.existing(this);
  }

  // Tell the player where the server says it should be.
  setTarget(x, y) {
    this.targetX = x;
    this.targetY = y;
  }

  // Glide a fraction of the way toward the target each frame (interpolation).
  smoothFollow() {
    this.x += (this.targetX - this.x) * 0.3;
    this.y += (this.targetY - this.y) * 0.3;
  }
}
