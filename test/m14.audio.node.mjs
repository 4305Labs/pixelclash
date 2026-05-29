// Phase D — audio guard: the audio module must load and behave with NO audio
// device (as in plain Node / headless CI). It should create no AudioContext,
// play sounds as harmless no-ops, and persist the mute flag to its storage.
import GameAudio from "../src/audio.js";
import { assert } from "./helpers.mjs";

try {
  // A tiny in-memory stand-in for localStorage.
  const store = new Map();
  const fakeStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  };

  const a = new GameAudio(fakeStorage);
  assert(a.muted === false, "starts unmuted");
  assert(a.ctx === null, "no AudioContext is created in Node (guarded)");

  // Playing any effect with no audio context is a safe no-op.
  for (const name of ["shoot", "hit", "death", "base", "win", "nope"]) a.play(name);
  assert(true, "playing every effect (and an unknown one) does not throw");

  // Mute toggles and persists.
  assert(a.toggleMute() === true, "toggleMute mutes");
  assert(store.get("pixelclash.muted") === "1", "mute is persisted to storage");
  assert(a.toggleMute() === false, "toggleMute unmutes again");
  assert(store.get("pixelclash.muted") === "0", "unmute is persisted too");

  // A fresh instance reads the persisted preference back.
  store.set("pixelclash.muted", "1");
  const b = new GameAudio(fakeStorage);
  assert(b.muted === true, "a new instance restores the saved mute preference");

  console.log("\nMILESTONE 14 AUDIO (NODE GUARD) TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
}
