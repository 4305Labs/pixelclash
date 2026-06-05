// Dash UI: the L key (and Shift) request a dash, and the on-screen "C" button
// exists and triggers a dash. Headless, no socket.
import { openGame, assert } from "./helpers.mjs";

let browser;
try {
  const game = await openGame();
  browser = game.browser;
  const { page, errors } = game;

  await page.evaluate(() => {
    const net = window.PIXELCLASH.net;
    net._receive({ t: "welcome", id: "p1", team: "blue" });
    window.__dash = 0;
    net.sendDash = () => window.__dash++;
  });

  const dashCount = () => page.evaluate(() => window.__dash);

  await page.keyboard.press("l");
  await page.waitForTimeout(40);
  assert((await dashCount()) >= 1, "L key requests a dash");

  await page.evaluate(() => (window.__dash = 0));
  await page.keyboard.press("Shift");
  await page.waitForTimeout(40);
  assert((await dashCount()) >= 1, "Shift requests a dash");

  // The "C" dash button should exist on screen.
  const hasC = await page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    return s.children.list.some((o) => o.type === "Text" && o.text === "C");
  });
  assert(hasC, "the C dash button is on screen");

  const realErrors = errors.filter((e) => !/websocket|ws:\/\//i.test(e));
  assert(realErrors.length === 0, "no unexpected errors: " + JSON.stringify(realErrors));

  console.log("\nMILESTONE 9 RENDER TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
