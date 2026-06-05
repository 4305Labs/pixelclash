// Phase D (in the real game): the audio module is wired into the running game,
// the mute toggle flips a flag and persists to localStorage, and playing every
// effect inside the live page never throws. Headless, no socket.
import { openGame, assert } from "./helpers.mjs";

let browser;
try {
  const game = await openGame();
  browser = game.browser;
  const { page, errors } = game;

  const r = await page.evaluate(() => {
    const a = window.PIXELCLASH.audio;
    const exists = !!a;
    // This test document blocks real localStorage, so inject a fake store to
    // verify the persistence path. (The Node guard test covers it too.)
    const store = {};
    a.storage = {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => {
        store[k] = String(v);
      },
    };
    const before = a.muted;
    const after = a.toggleMute(); // -> true
    const stored = store["pixelclash.muted"];
    a.toggleMute(); // restore to unmuted so we can hear effects play

    let threw = false;
    try {
      ["shoot", "hit", "death", "base", "win", "pickup"].forEach((n) => a.play(n));
    } catch (e) {
      threw = String(e);
    }
    return { exists, before, after, stored, muted: a.muted, threw };
  });
  console.log("audio:", JSON.stringify(r));

  assert(r.exists, "the audio module is attached to the game");
  assert(r.before === false, "starts unmuted");
  assert(r.after === true, "toggleMute flips the muted flag");
  assert(r.stored === "1", "mute is persisted to localStorage");
  assert(r.muted === false, "toggling again restores unmuted");
  assert(r.threw === false, "playing every effect does not throw: " + r.threw);

  // The mute label in the corner reflects state and updates when toggled.
  const labelOn = await page.evaluate(
    () => window.PIXELCLASH.game.scene.getScene("ArenaScene").muteText.text
  );
  assert(/on/i.test(labelOn), "mute label shows sound is on");
  await page.keyboard.press("m");
  await page.waitForTimeout(40);
  const labelOff = await page.evaluate(
    () => window.PIXELCLASH.game.scene.getScene("ArenaScene").muteText.text
  );
  assert(/off/i.test(labelOff), "pressing M flips the label to off");
  await page.keyboard.press("m"); // leave it on

  const realErrors = errors.filter((e) => !/websocket|ws:\/\//i.test(e));
  assert(realErrors.length === 0, "no unexpected errors: " + JSON.stringify(realErrors));

  console.log("\nMILESTONE 14 AUDIO TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
