// ===========================================================================
// Tower — a team's defensive guard tower. The server owns its HP and does the
// zapping; this just shows the structure with a health bar, flashes on hit, and
// shows a "destroyed" look (faded rubble) at 0 HP.
// ===========================================================================

import Phaser from "phaser";
import { TOWER } from "../config.js";

const BAR_W = TOWER.radius * 2;
const BAR_Y = -(TOWER.radius + 10);

export default class Tower extends Phaser.GameObjects.Container {
  constructor(scene, x, y, team) {
    super(scene, x, y);
    this.team = team;

    this.body = scene.add.sprite(0, 0, team === "red" ? "tower_red" : "tower_blue");

    this.hpBg = scene.add.rectangle(0, BAR_Y, BAR_W + 2, 6, 0x000000, 0.6);
    this.hpFill = scene.add.rectangle(-BAR_W / 2, BAR_Y, BAR_W, 4, 0x00e436).setOrigin(0, 0.5);

    this.add([this.body, this.hpBg, this.hpFill]);
    scene.add.existing(this);
  }

  setHp(hp, maxHp) {
    const frac = Math.max(0, hp) / maxHp;
    this.hpFill.width = BAR_W * frac;
    this.hpFill.setFillStyle(frac > 0.5 ? 0x00e436 : frac > 0.25 ? 0xffec27 : 0xff004d);
  }

  flashHit() {
    this.hit = true;
    this.body.setTintFill(0xffffff);
    this.scene.time.delayedCall(100, () => {
      this.body.clearTint();
      this.hit = false;
    });
  }

  // A destroyed tower fades to faint rubble and hides its (empty) health bar.
  setAlive(alive) {
    this.body.setAlpha(alive ? 1 : 0.18);
    this.hpBg.setVisible(alive);
    this.hpFill.setVisible(alive);
  }
}
