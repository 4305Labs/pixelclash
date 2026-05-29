// Milestone 3 verification (now networked): the on-screen controls are read
// each frame and sent to the server as an input vector. We stub the network
// send to capture what the keyboard produces, with no real socket involved.
import { openGame, assert } from "./helpers.mjs";

let browser;
try {
  const game = await openGame();
  browser = game.browser;
  const { page, errors } = game;

  // Pretend we've been welcomed (so update() actually sends input), and
  // capture every input vector the scene tries to send.
  await page.evaluate(() => {
    const net = window.PIXELCLASH.net;
    net._receive({ t: "welcome", id: "p1", team: "blue" });
    window.__last = null;
    net.sendInput = (dx, dy) => {
      window.__last = { dx, dy };
    };
  });

  const read = () => page.evaluate(() => window.__last);

  // Press D (right): dx should be +1.
  await page.keyboard.down("d");
  await page.waitForTimeout(120);
  let v = await read();
  console.log("after D:", JSON.stringify(v));
  assert(v && v.dx === 1 && v.dy === 0, "pressing D sends dx=+1");

  // Add W (up) while holding D: dx=+1, dy=-1 (diagonal).
  await page.keyboard.down("w");
  await page.waitForTimeout(120);
  v = await read();
  console.log("after D+W:", JSON.stringify(v));
  assert(v.dx === 1 && v.dy === -1, "D+W sends dx=+1, dy=-1");

  // Release everything: should send a stop (0,0).
  await page.keyboard.up("d");
  await page.keyboard.up("w");
  await page.waitForTimeout(120);
  v = await read();
  console.log("after release:", JSON.stringify(v));
  assert(v.dx === 0 && v.dy === 0, "releasing keys sends a stop");

  const realErrors = errors.filter((e) => !/websocket|ws:\/\//i.test(e));
  assert(realErrors.length === 0, "no unexpected errors: " + JSON.stringify(realErrors));

  console.log("\nMILESTONE 3 CONTROL TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
