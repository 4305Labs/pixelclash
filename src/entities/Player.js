// ===========================================================================
// Player — a controllable character in the arena.
// It's a physics sprite, which means Phaser tracks its velocity and keeps it
// inside the arena walls for us.
// ===========================================================================

import Phaser from "phaser";
import { PLAYER_SPEED, SPRITE_SCALE } from "../config.js";

export default class Player extends Phaser.Physics.Arcade.Sprite {
  // scene = the arena, x/y = start position, team = "blue" or "red".
  constructor(scene, x, y, team = "blue") {
    super(scene, x, y, team === "red" ? "player_red" : "player_blue");
    this.team = team;

    // Register this sprite with the scene's display list and physics engine.
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setScale(SPRITE_SCALE);
    this.setCollideWorldBounds(true); // can't walk off the edge of the arena
  }

  // Move based on a direction vector (dx, dy), each between -1 and 1.
  // (0,0) means stop. We normalize so diagonal movement isn't faster.
  move(dx, dy) {
    const v = new Phaser.Math.Vector2(dx, dy);
    if (v.lengthSq() > 1) v.normalize(); // cap length at 1 for diagonals
    this.setVelocity(v.x * PLAYER_SPEED, v.y * PLAYER_SPEED);
  }
}
