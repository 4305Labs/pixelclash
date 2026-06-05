// Milestone 19 (render): a base shows its protective shield ring while it's
// shielded (tower up), and drops the ring once exposed (tower down).
import { openGame, assert } from "./helpers.mjs";

const state = (redShielded) => ({
  t: "state",
  tick: 1,
  phase: "playing",
  winner: null,
  players: [{ id: "p1", team: "blue", x: 120, y: 300, hp: 100, alive: true }],
  projectiles: [],
  minions: [],
  towers: [{ team: "red", x: 550, y: 300, hp: redShielded ? 180 : 0, maxHp: 180, alive: redShielded }],
  bases: [
    { team: "blue", x: 44, y: 300, hp: 250, maxHp: 250, alive: true, shielded: true },
    { team: "red", x: 756, y: 300, hp: 250, maxHp: 250, alive: true, shielded: redShielded },
  ],
});

let browser;
try {
  const game = await openGame();
  browser = game.browser;
  const { page, errors } = game;

  const inject = (redShielded) =>
    page.evaluate((s) => {
      window.PIXELCLASH.game.scene.getScene("ArenaScene").dismissStartGate();
      window.PIXELCLASH.net._receive(s);
    }, state(redShielded));

  await page.evaluate(() =>
    window.PIXELCLASH.net._receive({ t: "welcome", id: "p1", team: "blue" })
  );
  await inject(true);
  await page.waitForTimeout(120);

  const shielded = await page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    return {
      red: s.baseSprites.get("red").shield.visible,
      blue: s.baseSprites.get("blue").shield.visible,
    };
  });
  assert(shielded.red && shielded.blue, "a base shows its shield ring while its tower stands");

  await inject(false); // red tower destroyed -> red base exposed
  await page.waitForTimeout(120);
  const exposed = await page.evaluate(
    () => window.PIXELCLASH.game.scene.getScene("ArenaScene").baseSprites.get("red").shield.visible
  );
  assert(!exposed, "the shield ring drops once the tower is gone");

  const realErrors = errors.filter((e) => !/websocket|ws:\/\//i.test(e));
  assert(realErrors.length === 0, "no unexpected errors: " + JSON.stringify(realErrors));

  console.log("\nMILESTONE 19 TOWER-GATE RENDER TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
