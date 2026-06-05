// Phase POLISH — audio enrichment: new synthesized cues must (1) exist and be
// well-formed members of the SOUNDS map, and (2) stay safe no-ops with NO audio
// device (plain Node / headless CI), exactly like every other effect. We never
// add asset files — each cue is just a few oscillator blips.
//
// This mirrors m14.audio.node.mjs's harness (an in-memory localStorage), and
// adds a tiny fake AudioContext so we can prove the new cues actually schedule
// oscillators when an audio device IS present, without needing a real browser.
import GameAudio from "../src/audio.js";
import { assert } from "./helpers.mjs";

try {
  // A tiny in-memory stand-in for localStorage.
  const store = new Map();
  const fakeStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  };

  // The new/enriched cues this feature adds. "pickup" is enriched (more notes);
  // "kill" and "levelup" are brand-new impactful moments.
  const NEW_SOUNDS = ["kill", "levelup", "pickup"];

  // 1) Headless guard: with no AudioContext, playing the new cues is a no-op.
  const silent = new GameAudio(fakeStorage);
  assert(silent.ctx === null, "no AudioContext is created in Node (guarded)");
  for (const name of NEW_SOUNDS) silent.play(name);
  assert(true, "playing every new cue with no audio device does not throw");

  // 2) Well-formed: drive a fake AudioContext and confirm each new cue actually
  // schedules at least one oscillator (i.e. the SOUNDS entry exists and runs).
  // We build a minimal stub that records start() calls — enough for blip().
  let started = 0;
  function makeParam() {
    return {
      setValueAtTime() {},
      exponentialRampToValueAtTime() {},
    };
  }
  const fakeCtx = {
    currentTime: 0,
    destination: {},
    createOscillator: () => ({
      type: "square",
      frequency: makeParam(),
      connect() {},
      start() {
        started++;
      },
      stop() {},
    }),
    createGain: () => ({ gain: makeParam(), connect() {} }),
  };

  const audible = new GameAudio(fakeStorage);
  audible.ctx = fakeCtx; // inject our stub (Node has no real AudioContext)
  for (const name of NEW_SOUNDS) {
    started = 0;
    audible.play(name);
    assert(started >= 1, `cue "${name}" schedules at least one oscillator`);
  }

  // An unknown cue is still a silent no-op even with a context present.
  started = 0;
  audible.play("definitely-not-a-real-cue");
  assert(started === 0, "an unknown cue plays nothing");

  console.log("\nMILESTONE 51 AUDIO ENRICHMENT (NODE) TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
}
