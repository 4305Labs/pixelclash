// Phase A — combat feedback: when a player's HP drops between snapshots, the
// sprite flashes (hit flag set) and a floating damage number is spawned; when a
// base's HP drops, the base flashes. Headless, no socket.
import { openGame, assert } from "./helpers.mjs";

const baseState = (overrides) => ({
  t: "state",
  tick: 1,
  phase: "playing",
  winner: null,
  players: [
    { id: "p1", team: "blue", x: 120, y: 300, hp: 100, alive: true },
    { id: "p2", team: "red", x: 400, y: 300, hp: 100, alive: true },
  ],
  projectiles: [],
  bases: [
    { team: "blue", x: 44, y: 300, hp: 250, maxHp: 250, alive: true },
    { team: "red", x: 756, y: 300, hp: 250, maxHp: 250, alive: true },
  ],
  ...overrides,
});

let browser;
try {
  const game = await openGame();
  browser = game.browser;
  const { page, errors } = game;

  // Welcome + initial snapshot (full HP for everyone).
  await page.evaluate((s) => {
    const net = window.PIXELCLASH.net;
    net._receive({ t: "welcome", id: "p1", team: "blue" });
    net._receive(s);
  }, baseState({}));
  await page.waitForTimeout(120);

  // No damage yet → no damage numbers.
  const before = await page.evaluate(
    () => window.PIXELCLASH.game.scene.getScene("ArenaScene").damageNumbers.length
  );
  assert(before === 0, "no damage numbers before any damage");

  // Next snapshot: the opponent (p2) lost 30 HP and the red base lost 8.
  await page.evaluate((s) => window.PIXELCLASH.net._receive(s), baseState({
    tick: 2,
    players: [
      { id: "p1", team: "blue", x: 120, y: 300, hp: 100, alive: true },
      { id: "p2", team: "red", x: 400, y: 300, hp: 70, alive: true },
    ],
    bases: [
      { team: "blue", x: 44, y: 300, hp: 250, maxHp: 250, alive: true },
      { team: "red", x: 756, y: 300, hp: 242, maxHp: 250, alive: true },
    ],
  }));
  await page.waitForTimeout(60);

  const view = await page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    const p2 = [...s.sprites.values()].find((sp) => sp.team === "red");
    const redBase = s.baseSprites.get("red");
    return {
      damageNumbers: s.damageNumbers.length,
      lastDamageText: s.damageNumbers.map((t) => t.text),
      playerHit: p2.hit === true,
      baseHit: redBase.hit === true,
    };
  });
  console.log("feedback:", JSON.stringify(view));
  assert(view.playerHit, "damaged player flashes (hit flag set)");
  assert(view.damageNumbers >= 1, "a floating damage number was spawned");
  assert(view.lastDamageText.includes("30"), "damage number shows the amount (30)");
  assert(view.baseHit, "damaged base flashes");

  // The damage number cleans itself up after its tween.
  await page.waitForTimeout(800);
  const after = await page.evaluate(
    () => window.PIXELCLASH.game.scene.getScene("ArenaScene").damageNumbers.length
  );
  assert(after === 0, "damage numbers are cleaned up after fading");

  const realErrors = errors.filter((e) => !/websocket|ws:\/\//i.test(e));
  assert(realErrors.length === 0, "no unexpected errors: " + JSON.stringify(realErrors));

  console.log("\nMILESTONE 11 FEEDBACK TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
