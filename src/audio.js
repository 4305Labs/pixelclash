// ===========================================================================
// audio.js — tiny sound effects, generated on the fly with the Web Audio API.
// There are NO audio files: each effect is a short synthesized "blip" built
// from an oscillator (a tone) shaped by a gain envelope (a quick fade-out).
// This keeps the repo free of binary/licensed assets.
//
// Everything is defensively guarded so the game (and the headless tests) run
// fine even with no audio device: if there's no AudioContext, sound is a no-op.
// Browsers also block audio until the user interacts, so call resume() from a
// real tap/keypress to wake the sound up.
// ===========================================================================

// Each effect is a function that takes the GameAudio instance and schedules
// one or more blips. Frequencies are in Hz; durations in seconds.
const SOUNDS = {
  shoot: (a) => a.blip({ type: "square", freq: 660, freqEnd: 430, dur: 0.08, gain: 0.1 }),
  hit: (a) => a.blip({ type: "square", freq: 200, freqEnd: 120, dur: 0.09, gain: 0.14 }),
  death: (a) => a.blip({ type: "sawtooth", freq: 300, freqEnd: 70, dur: 0.35, gain: 0.16 }),
  base: (a) => a.blip({ type: "square", freq: 140, freqEnd: 50, dur: 0.5, gain: 0.2 }),
  // A bright two-note rising chime when you grab a pickup.
  pickup: (a) =>
    [523, 784].forEach((f, i) =>
      a.blip({ type: "sine", freq: f, dur: 0.1, gain: 0.12, delay: i * 0.07 })
    ),
  // A little 3-note victory arpeggio (C–E–G), each note delayed after the last.
  win: (a) =>
    [523, 659, 784].forEach((f, i) =>
      a.blip({ type: "sine", freq: f, dur: 0.16, gain: 0.14, delay: i * 0.13 })
    ),
  // A magical rising "whoosh" when a hero uses its ability.
  cast: (a) => a.blip({ type: "triangle", freq: 300, freqEnd: 760, dur: 0.16, gain: 0.13 }),
  // A low boom for an AoE shockwave (Nova / Leap Slam).
  blast: (a) => a.blip({ type: "sawtooth", freq: 170, freqEnd: 42, dur: 0.32, gain: 0.2 }),
};

const STORAGE_KEY = "pixelclash.muted";

// Reach localStorage safely. Some documents (e.g. pages loaded via setContent,
// or with cookies disabled) throw a SecurityError just for *touching* the
// localStorage property, so we guard the access itself, not only its use.
function safeStorage() {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

export default class GameAudio {
  // `storage` is injectable for tests; defaults to the browser's localStorage.
  constructor(storage) {
    this.storage = storage || safeStorage();
    this.muted = this._loadMuted();
    this.ctx = null;
    this._tryCreateContext();
  }

  _loadMuted() {
    try {
      return !!(this.storage && this.storage.getItem(STORAGE_KEY) === "1");
    } catch {
      return false;
    }
  }

  // Create an AudioContext if this environment has one. Wrapped so a missing
  // (Node) or blocked audio system simply leaves us silent instead of crashing.
  _tryCreateContext() {
    try {
      const AC =
        typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
      if (AC) this.ctx = new AC();
    } catch {
      this.ctx = null;
    }
  }

  // Browsers suspend audio until a user gesture; call this from a tap/keypress.
  resume() {
    try {
      if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
    } catch {
      /* ignore */
    }
  }

  setMuted(muted) {
    this.muted = !!muted;
    try {
      if (this.storage) this.storage.setItem(STORAGE_KEY, this.muted ? "1" : "0");
    } catch {
      /* ignore */
    }
    return this.muted;
  }

  toggleMute() {
    return this.setMuted(!this.muted);
  }

  // Play a named effect. Silent if muted or if there's no audio context.
  play(name) {
    if (this.muted || !this.ctx) return;
    const make = SOUNDS[name];
    if (!make) return;
    try {
      make(this);
    } catch {
      /* a failed blip should never break gameplay */
    }
  }

  // The building block: one oscillator tone that fades out. `freqEnd` slides
  // the pitch; `delay` schedules it in the future (for multi-note effects).
  blip({ type = "square", freq, freqEnd, dur = 0.1, gain = 0.15, delay = 0 }) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
    env.gain.setValueAtTime(gain, t0);
    env.gain.exponentialRampToValueAtTime(0.0008, t0 + dur); // smooth fade to ~0
    osc.connect(env);
    env.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }
}
