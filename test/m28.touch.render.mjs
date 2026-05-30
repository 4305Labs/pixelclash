// Milestone 28 (mobile): the class picker and the shop are tappable, not just
// keyboard. Class buttons show in the lobby (and a tap selects); shop buttons
// show during play (and hide when maxed). Headless via injected snapshots.
import { openGame, assert } from "./helpers.mjs";
import { PROGRESS } from "../src/config.js";

const lobby = {
  t: "state", tick: 1, phase: "waiting", winner: null, needed: 2, countdown: 0,
  score: { blue: 0, red: 0 },
  players: [{ id: "p1", team: "blue", x: 120, y: 300, hp: 100, alive: true, cls: "soldier", maxHp: 100 }],
  projectiles: [], minions: [], pickups: [], towers: [], bases: [],
};
const playing = (me) => ({
  ...lobby, phase: "playing",
  players: [{ id: "p1", team: "blue", x: 120, y: 300, hp: 100, alive: true, cls: "soldier", maxHp: 100, level: 1, gold: 200, ...me }],
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

  // Lobby: class buttons visible, shop buttons hidden.
  await page.evaluate((s) => window.PIXELCLASH.net._receive(s), lobby);
  await page.waitForTimeout(100);
  let v = await page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    return {
      classVis: s.classButtons.map((b) => b.bg.visible),
      shopVis: s.shopButtons.map((b) => b.bg.visible),
      count: s.classButtons.length,
    };
  });
  assert(v.count === 3 && v.classVis.every(Boolean), "class buttons show in the lobby");
  assert(v.shopVis.every((x) => !x), "shop buttons are hidden in the lobby");

  // Tapping a class button selects it.
  await page.evaluate(() => window.PIXELCLASH.game.scene.getScene("ArenaScene").classButtons[2].tap());
  const cls = await page.evaluate(() => window.PIXELCLASH.net.cls);
  assert(cls === "tank", "tapping a class button picks that class");

  // Play: shop buttons visible + labelled; class buttons hidden.
  await page.evaluate((s) => window.PIXELCLASH.net._receive(s), playing({ buys: 0 }));
  await page.waitForTimeout(100);
  v = await page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    return {
      classVis: s.classButtons.map((b) => b.bg.visible),
      shopVis: s.shopButtons.map((b) => b.bg.visible),
      label0: s.shopButtons[0].txt.text,
    };
  });
  assert(v.shopVis.every(Boolean), "shop buttons show during play");
  assert(v.classVis.every((x) => !x), "class buttons hide during play");
  assert(v.label0.includes(PROGRESS.shop[0].name), "shop buttons are labelled with the item");

  // Tapping a shop button doesn't throw (the buy goes to the server).
  await page.evaluate(() => window.PIXELCLASH.game.scene.getScene("ArenaScene").shopButtons[0].tap());

  // Maxed out: shop buttons hide.
  await page.evaluate((s) => window.PIXELCLASH.net._receive(s), playing({ buys: PROGRESS.shopMaxStacks }));
  await page.waitForTimeout(80);
  const shopHidden = await page.evaluate(() =>
    window.PIXELCLASH.game.scene.getScene("ArenaScene").shopButtons.every((b) => !b.bg.visible)
  );
  assert(shopHidden, "shop buttons hide once fully upgraded");

  // On a landscape viewport the rotate hint stays hidden.
  const rotate = await page.evaluate(
    () => window.PIXELCLASH.game.scene.getScene("ArenaScene").rotateBg.visible
  );
  assert(!rotate, "the rotate hint is hidden in landscape");

  const realErrors = errors.filter((e) => !/websocket|ws:\/\//i.test(e));
  assert(realErrors.length === 0, "no unexpected errors: " + JSON.stringify(realErrors));

  console.log("\nMILESTONE 28 TOUCH TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
