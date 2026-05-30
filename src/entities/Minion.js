// ===========================================================================
// Minion — the on-screen representation of one lane minion. Like Player, the
// SERVER owns its position and HP; this object just glides toward the latest
// reported spot and shows a tiny health bar. It's a small, lighter-tinted
// square so it reads as a "lesser" unit next to the heroes.
// ===========================================================================

import Phaser from "phaser";
import { MINION } from "../config.js";
import { advancePhase, bodyPose } from "../anim.js";

const BODY = MINION.half * 2; // on-screen size in pixels (drawn at scale 1)
const BAR_Y = -MINION.half - 6; // health bar sits just above the head

export default class Minion extends Phaser.GameObjects.Container {
  constructor(scene, x, y, team) {
    super(scene, x, y);
    this.team = team;
    this.targetX = x;
    this.targetY = y;

    const texture = team === "red" ? "minion_red" : "minion_blue";
    this.bodySprite = scene.add.sprite(0, 0, texture);

    this.animPhase = Math.random() * Math.PI * 2; // desync the wave's hops
    this.prevX = x;
    this.prevY = y;

    this.hpBg = scene.add.rectangle(0, BAR_Y, BODY + 2, 4, 0x000000, 0.6);
    this.hpFill = scene.add.rectangle(-BODY / 2, BAR_Y, BODY, 2, 0x00e436).setOrigin(0, 0.5);

    this.add([this.bodySprite, this.hpBg, this.hpFill]);
    scene.add.existing(this);
  }

  setTarget(x, y) {
    this.targetX = x;
    this.targetY = y;
  }

  smoothFollow() {
    this.x += (this.targetX - this.x) * 0.3;
    this.y += (this.targetY - this.y) * 0.3;
  }

  setHp(hp) {
    const frac = Math.max(0, hp) / MINION.maxHp;
    this.hpFill.width = BODY * frac;
    this.hpFill.setFillStyle(frac > 0.5 ? 0x00e436 : frac > 0.25 ? 0xffec27 : 0xff004d);
  }

  // Brief white flash when it takes a hit.
  flashHit() {
    this.bodySprite.setTintFill(0xffffff);
    this.scene.time.delayedCall(90, () => this.bodySprite.clearTint());
  }

  // A little walk hop with squash & stretch while the minion is marching.
  animate(dt) {
    const moved = Math.hypot(this.x - this.prevX, this.y - this.prevY);
    this.prevX = this.x;
    this.prevY = this.y;
    const moving = moved > 0.3;
    this.animPhase = advancePhase(this.animPhase, dt * 1000, moving);
    const pose = bodyPose(this.animPhase, moving);
    this.bodySprite.y = pose.bob * 0.6; // a touch subtler than heroes
    this.bodySprite.setScale(pose.sx, pose.sy);
  }
}
