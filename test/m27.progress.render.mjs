// Milestone 27 (render): the bottom-left HUD shows the local hero's level and
// gold, plus the next shop upgrade to buy — which disappears once maxed out.
import { openGame, assert } from "./helpers.mjs";
import { PROGRESS } from "../src/config.js";

const state = (me) => ({
  t: "state",
  tick: 1,
  phase: "playing",
  winner: null,
  score: { blue: 0, red: 0 },
  players: [
    { id: "p1", team: "blue", x: 120, y: 300, hp: 100, alive: true, ...me },
    { id: "p2", team: "red", x: 680, y: 300, hp: 100, alive: true, level: 1, maxHp: 100 },
  ],
  projectiles: [],
  minions: [],
  pickups: [],
  towers: [],
  bases: [],
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

  await page.evaluate((s) => window.PIXELCLASH.net._receive(s), state({ level: 3, gold: 120, buys: 0 }));
  await page.waitForTimeout(100);
  let text = await page.evaluate(
    () => window.PIXELCLASH.game.scene.getScene("ArenaScene").shopText.text
  );
  assert(/Lv 3/.test(text), "HUD shows the hero level");
  assert(/120g/.test(text), "HUD shows the gold");
  assert(text.includes(PROGRESS.shop[0].name), "HUD shows the next upgrade to buy");

  // In-world level badges: shown for a leveled hero (p1 = Lv 3), hidden at
  // level 1 (p2).
  const badges = await page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    return {
      leveled: { vis: s.sprites.get("p1").levelLabel.visible, text: s.sprites.get("p1").levelLabel.text },
      one: s.sprites.get("p2").levelLabel.visible,
    };
  });
  assert(badges.leveled.vis && /L3/.test(badges.leveled.text), "a leveled hero shows an L<n> badge");
  assert(!badges.one, "a level-1 hero shows no badge");

  // Fully upgraded -> no buy prompt.
  await page.evaluate((s) => window.PIXELCLASH.net._receive(s), state({ level: 6, gold: 999, buys: PROGRESS.shopMaxStacks }));
  await page.waitForTimeout(80);
  text = await page.evaluate(
    () => window.PIXELCLASH.game.scene.getScene("ArenaScene").shopText.text
  );
  assert(/Lv 6/.test(text) && !/\[B\]/.test(text), "no buy prompt once fully upgraded");

  const realErrors = errors.filter((e) => !/websocket|ws:\/\//i.test(e));
  assert(realErrors.length === 0, "no unexpected errors: " + JSON.stringify(realErrors));

  console.log("\nMILESTONE 27 PROGRESSION RENDER TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
