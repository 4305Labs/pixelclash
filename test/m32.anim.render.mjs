// Milestone 32 (render): procedural animation runs in the real scene — a moving
// hero's body bobs/squashes off its base scale, an attack triggers a pop, and a
// minion animates, all without NaN or errors.
import { openGame, assert } from "./helpers.mjs";

const snap = (x) => ({
  t: "state", tick: 1, phase: "playing", winner: null, score: { blue: 0, red: 0 },
  players: [{ id: "p1", team: "blue", x, y: 300, hp: 100, maxHp: 100, alive: true, cls: "soldier" }],
  projectiles: [], minions: [{ id: "m1", team: "blue", x: x + 20, y: 320, hp: 40, alive: true }],
  pickups: [], towers: [],
  bases: [
    { team: "blue", x: 44, y: 300, hp: 250, maxHp: 250, alive: true, shielded: false },
    { team: "red", x: 756, y: 300, hp: 250, maxHp: 250, alive: true, shielded: false },
  ],
});

let browser;
try {
  const game = await openGame();
  browser = game.browser;
  const { page, errors } = game;

  await page.evaluate(() => {
    window.PIXELCLASH.game.scene.getScene("ArenaScene").dismissStartGate();
    window.PIXELCLASH.net._receive({ t: "welcome", id: "p1", team: "blue" });
  });

  // Feed several snapshots that move the hero, letting the scene's update loop
  // run between them so animate() advances and detects movement.
  for (const x of [120, 160, 210, 260, 320]) {
    await page.evaluate((s) => window.PIXELCLASH.net._receive(s), snap(x));
    await page.waitForTimeout(50);
  }

  const v = await page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    const me = s.sprites.get("p1");
    const mob = s.minionSprites.get("m1");
    return {
      base: me.baseScale,
      sx: me.bodySprite.scaleX,
      sy: me.bodySprite.scaleY,
      bodyY: me.bodySprite.y,
      finite: Number.isFinite(me.bodySprite.scaleX) && Number.isFinite(me.bodySprite.y),
      mobFinite: !!mob && Number.isFinite(mob.bodySprite.scaleX),
    };
  });
  assert(v.finite && v.mobFinite, "animated sprite scales/offsets stay finite");
  assert(v.sx > 0 && v.sy > 0, "body scale stays positive");
  // While moving, the body is squashed or stretched off the base scale (sx≠sy
  // except at the exact apex/ground), and/or lifted — i.e. animation is active.
  assert(v.sx !== v.sy || v.bodyY !== 0, "a moving hero is animating (squash/stretch or bob)");

  // An attack triggers a pop without breaking anything.
  await page.evaluate(() => window.PIXELCLASH.game.scene.getScene("ArenaScene").doAction("basic"));
  await page.waitForTimeout(40);
  const afterPop = await page.evaluate(
    () => window.PIXELCLASH.game.scene.getScene("ArenaScene").sprites.get("p1").bodySprite.scaleX
  );
  assert(Number.isFinite(afterPop) && afterPop > 0, "attack pop keeps the scale sane");

  // --- Death tumble: a knockout flips the dead flag and spins the body -------
  await page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    window.PIXELCLASH.net._receive({
      t: "state", tick: 9, phase: "playing", winner: null, score: { blue: 0, red: 0 },
      players: [{ id: "p1", team: "blue", x: 320, y: 300, hp: 0, maxHp: 100, alive: false, cls: "soldier", respawnIn: 2 }],
      projectiles: [], minions: [], pickups: [], towers: [],
      bases: [
        { team: "blue", x: 44, y: 300, hp: 250, maxHp: 250, alive: true, shielded: false },
        { team: "red", x: 756, y: 300, hp: 250, maxHp: 250, alive: true, shielded: false },
      ],
    });
  });
  // The tumble spins the body via a ~420ms tween (angle 0 -> 540). A single
  // instant sample is flaky: Phaser WRAPS the angle (it passes through 360 ≡ 0
  // mid-spin) and headless rAF can be throttled, so the one reading occasionally
  // lands on a near-zero angle. Instead POLL across the whole tumble window and
  // assert the dead flag latched and the body was clearly rotated at some point,
  // staying finite throughout (the same "ever-over-a-window" pattern as m25).
  let latchedDead = false;
  let maxAngle = 0;
  let everFinite = true;
  for (let i = 0; i < 24; i++) {
    const d = await page.evaluate(() => {
      const me = window.PIXELCLASH.game.scene.getScene("ArenaScene").sprites.get("p1");
      return {
        dead: me.dead,
        angle: me.bodySprite.angle,
        finite: Number.isFinite(me.bodySprite.scaleX) && Number.isFinite(me.bodySprite.angle),
      };
    });
    if (d.dead) latchedDead = true;
    if (!d.finite) everFinite = false;
    if (Math.abs(d.angle) > maxAngle) maxAngle = Math.abs(d.angle);
    await page.waitForTimeout(30);
  }
  assert(latchedDead, "a knocked-out hero enters the dead/tumble state");
  assert(maxAngle > 1 && everFinite, "the death tumble spins the body (and stays finite)");

  // --- Respawn: clean upright reset ------------------------------------------
  await page.evaluate(() => {
    window.PIXELCLASH.net._receive({
      t: "state", tick: 10, phase: "playing", winner: null, score: { blue: 0, red: 0 },
      players: [{ id: "p1", team: "blue", x: 120, y: 300, hp: 100, maxHp: 100, alive: true, cls: "soldier" }],
      projectiles: [], minions: [], pickups: [], towers: [],
      bases: [
        { team: "blue", x: 44, y: 300, hp: 250, maxHp: 250, alive: true, shielded: false },
        { team: "red", x: 756, y: 300, hp: 250, maxHp: 250, alive: true, shielded: false },
      ],
    });
  });
  await page.waitForTimeout(80);
  const revived = await page.evaluate(() => {
    const me = window.PIXELCLASH.game.scene.getScene("ArenaScene").sprites.get("p1");
    return { dead: me.dead, alpha: me.bodySprite.alpha };
  });
  assert(!revived.dead && revived.alpha === 1, "respawn resets to a clean, opaque, upright sprite");

  const realErrors = errors.filter((e) => !/websocket|ws:\/\//i.test(e));
  assert(realErrors.length === 0, "no unexpected errors: " + JSON.stringify(realErrors));

  console.log("\nMILESTONE 32 ANIMATION RENDER TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
