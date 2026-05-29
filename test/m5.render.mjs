// Milestone 5 (UI): keyboard attacks send the right request, the opponent's
// health bar shrinks with HP, and projectiles are drawn. Headless, no socket.
import { openGame, assert } from "./helpers.mjs";
import { PLAYER_SIZE, SPRITE_SCALE } from "../src/config.js";

const BAR_W = PLAYER_SIZE * SPRITE_SCALE;

let browser;
try {
  const game = await openGame();
  browser = game.browser;
  const { page, errors } = game;

  // Welcome us and record every attack the scene tries to send.
  await page.evaluate(() => {
    const net = window.PIXELCLASH.net;
    net._receive({ t: "welcome", id: "p1", team: "blue" });
    window.__atk = [];
    net.sendAttack = (kind) => window.__atk.push(kind);
  });

  const pressAndRead = async (key) => {
    await page.evaluate(() => (window.__atk = []));
    await page.keyboard.press(key);
    await page.waitForTimeout(30);
    return page.evaluate(() => window.__atk);
  };

  let sent = await pressAndRead("j");
  console.log("J ->", JSON.stringify(sent));
  assert(sent.includes("basic") && !sent.includes("ability"), "J fires a basic attack");

  sent = await pressAndRead("k");
  console.log("K ->", JSON.stringify(sent));
  assert(sent.includes("ability") && !sent.includes("basic"), "K fires the ability");

  sent = await pressAndRead("Space");
  console.log("Space ->", JSON.stringify(sent));
  assert(sent.includes("basic") && !sent.includes("ability"), "Space fires a basic attack");

  // Feed a state: opponent at 40 HP, and one bolt in flight.
  await page.evaluate(() => {
    window.PIXELCLASH.net._receive({
      t: "state",
      tick: 1,
      players: [
        { id: "p1", team: "blue", x: 120, y: 300, hp: 100, alive: true },
        { id: "p2", team: "red", x: 400, y: 300, hp: 40, alive: true },
      ],
      projectiles: [{ id: "b1", team: "blue", kind: "basic", x: 250, y: 300 }],
    });
  });
  await page.waitForTimeout(150);

  const view = await page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    const red = [...s.sprites.values()].find((sp) => sp.team === "red");
    return { redHpWidth: red.hpFill.width, fullWidth: red.hpFill.width, bolts: s.bolts.size };
  });
  console.log("view:", JSON.stringify(view));
  // 40 HP of 100 => bar should be 40% of full width.
  assert(Math.abs(view.redHpWidth - BAR_W * 0.4) < 0.5, "health bar reflects 40% HP");
  assert(view.bolts === 1, "projectile is drawn");

  const realErrors = errors.filter((e) => !/websocket|ws:\/\//i.test(e));
  assert(realErrors.length === 0, "no unexpected errors: " + JSON.stringify(realErrors));

  console.log("\nMILESTONE 5 RENDER TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
