// Milestone 22 (render): the lobby shows a class picker that marks your pick,
// and a hero is drawn at its class size (tank bigger, scout smaller).
import { openGame, assert } from "./helpers.mjs";
import { SPRITE_SCALE, CLASSES } from "../src/config.js";

const lobby = (players) => ({
  t: "state",
  tick: 1,
  phase: "waiting",
  winner: null,
  needed: 2,
  countdown: 0,
  score: { blue: 0, red: 0 },
  players,
  projectiles: [],
  minions: [],
  pickups: [],
  towers: [],
  bases: [],
});

const playing = (players) => ({ ...lobby(players), phase: "playing" });

let browser;
try {
  const game = await openGame();
  browser = game.browser;
  const { page, errors } = game;

  await page.evaluate(() => {
    window.PIXELCLASH.game.scene.getScene("ArenaScene").dismissStartGate();
    window.PIXELCLASH.net._receive({ t: "welcome", id: "p1", team: "blue" });
  });

  // Lobby: the class picker is visible and lists all three classes.
  await page.evaluate((s) => window.PIXELCLASH.net._receive(s), lobby([
    { id: "p1", team: "blue", x: 120, y: 300, hp: 100, alive: true, cls: "soldier", maxHp: 100 },
  ]));
  await page.waitForTimeout(100);
  let v = await page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    return { visible: s.classText.visible, text: s.classText.text };
  });
  assert(v.visible, "the class picker shows in the lobby");
  assert(/Scout/.test(v.text) && /Soldier/.test(v.text) && /Tank/.test(v.text), "it lists all classes");

  // Pick tank -> the picker marks it as selected.
  await page.evaluate(() => window.PIXELCLASH.net.sendClass("tank"));
  await page.waitForTimeout(60);
  v = await page.evaluate(() => window.PIXELCLASH.game.scene.getScene("ArenaScene").classText.text);
  assert(/‹\[3\] Tank›/.test(v), "the picker marks the chosen class");

  // In play, a tank is drawn bigger and the picker hides.
  await page.evaluate((s) => window.PIXELCLASH.net._receive(s), playing([
    { id: "p1", team: "blue", x: 120, y: 300, hp: 170, alive: true, cls: "tank", maxHp: 170 },
  ]));
  await page.waitForTimeout(100);
  const r = await page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    return { scale: s.sprites.get("p1").bodySprite.scaleX, picker: s.classText.visible };
  });
  assert(Math.abs(r.scale - SPRITE_SCALE * CLASSES.tank.scale) < 0.001, "a tank hero is drawn at tank size");
  assert(!r.picker, "the class picker hides during play");

  const realErrors = errors.filter((e) => !/websocket|ws:\/\//i.test(e));
  assert(realErrors.length === 0, "no unexpected errors: " + JSON.stringify(realErrors));

  console.log("\nMILESTONE 22 CLASS RENDER TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
