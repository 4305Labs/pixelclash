// Phase E — mobile & UX: at a portrait phone viewport, the movement joystick
// and all three action buttons exist and sit fully on-screen (within the world
// bounds, inset from the edges), and the tap-to-start gate can be dismissed.
// Also captures a portrait screenshot for the docs. Headless, no socket.
import { openGame, assert } from "./helpers.mjs";
import { GAME_WIDTH, GAME_HEIGHT } from "../src/config.js";

let browser;
try {
  // A typical portrait phone viewport.
  const game = await openGame({ width: 390, height: 844 });
  browser = game.browser;
  const { page, errors } = game;

  // The start gate is up at boot; confirm it exists, then dismiss it (as a real
  // tap would) so the controls are interactive and visible for the screenshot.
  const gateBefore = await page.evaluate(
    () => !!window.PIXELCLASH.game.scene.getScene("ArenaScene").startGate &&
      !window.PIXELCLASH.game.scene.getScene("ArenaScene").startGate.dismissed
  );
  assert(gateBefore, "the tap-to-start gate is shown at boot");

  await page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    s.dismissStartGate();
    // Drop in a quick play state so the screenshot shows the arena + a player.
    window.PIXELCLASH.net._receive({ t: "welcome", id: "p1", team: "blue" });
    window.PIXELCLASH.net._receive({
      t: "state", tick: 1, phase: "playing", winner: null, needed: 2, countdown: 0,
      players: [{ id: "p1", team: "blue", x: 200, y: 300, hp: 100, alive: true }],
      projectiles: [],
      bases: [
        { team: "blue", x: 44, y: 300, hp: 250, maxHp: 250, alive: true },
        { team: "red", x: 756, y: 300, hp: 250, maxHp: 250, alive: true },
      ],
    });
  });
  await page.waitForTimeout(120);

  const view = await page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    const b = s.buttons;
    const btn = (x) => ({ x: x.x, y: x.y, r: x.radius, visible: x.circle.visible });
    return {
      hasJoystick: !!s.joystick,
      gateDismissed: s.startGate.dismissed,
      buttons: { basic: btn(b.basic), ability: btn(b.ability), dash: btn(b.dash) },
      keys: Object.keys(b),
    };
  });
  console.log("mobile:", JSON.stringify(view));

  assert(view.hasJoystick, "the movement joystick exists");
  assert(view.gateDismissed, "the start gate dismisses on input");
  assert(view.keys.length === 3, "all three action buttons exist (A/B/C)");

  // Every button must sit fully within the world bounds (i.e. on-screen).
  for (const [name, b] of Object.entries(view.buttons)) {
    assert(b.visible, `${name} button is visible`);
    assert(
      b.x - b.r >= 0 && b.x + b.r <= GAME_WIDTH && b.y - b.r >= 0 && b.y + b.r <= GAME_HEIGHT,
      `${name} button is fully on-screen`
    );
  }

  await page.screenshot({ path: "docs/screenshot-mobile.png" });
  console.log("saved docs/screenshot-mobile.png");

  const realErrors = errors.filter((e) => !/websocket|ws:\/\//i.test(e));
  assert(realErrors.length === 0, "no unexpected errors: " + JSON.stringify(realErrors));

  console.log("\nMILESTONE 15 MOBILE TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
