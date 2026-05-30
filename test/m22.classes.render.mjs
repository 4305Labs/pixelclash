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
    return {
      visible: s.classText.visible,
      text: s.classText.text,
      labels: s.classButtons.map((b) => b.txt.text).join(" | "),
      count: s.classButtons.length,
    };
  });
  assert(v.visible, "the class picker shows in the lobby");
  assert(v.count === 6, "there are six hero buttons");
  assert(
    /Scout/.test(v.labels) && /Soldier/.test(v.labels) && /Tank/.test(v.labels) &&
      /Ranger/.test(v.labels) && /Mage/.test(v.labels) && /Brawler/.test(v.labels),
    "the buttons list all six heroes"
  );

  // Pick mage -> the picker text confirms it.
  await page.evaluate(() => window.PIXELCLASH.net.sendClass("mage"));
  await page.waitForTimeout(60);
  v = await page.evaluate(() => window.PIXELCLASH.game.scene.getScene("ArenaScene").classText.text);
  assert(/Selected: Mage/.test(v), "the picker confirms the chosen hero");

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
