// ===========================================================================
// record.js — a tiny win/loss/draw tally persisted in localStorage so a player
// sees their record across matches in the same browser. Storage is injectable
// (for tests) and every access is guarded: some documents throw merely on
// *touching* localStorage, so we never let that break the game.
// ===========================================================================

const KEY = "pixelclash.record";

// Reach localStorage safely (returns null if it isn't available or throws).
export function safeStorage() {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

function normalize(r) {
  return { w: (r && r.w) || 0, l: (r && r.l) || 0, d: (r && r.d) || 0 };
}

export function loadRecord(storage) {
  try {
    const raw = storage && storage.getItem(KEY);
    return normalize(raw ? JSON.parse(raw) : null);
  } catch {
    return { w: 0, l: 0, d: 0 };
  }
}

// Add one win ("w"), loss ("l"), or draw ("d") and persist. Returns the new
// record (always valid, even if persistence isn't available).
export function bumpRecord(storage, outcome) {
  const r = loadRecord(storage);
  if (outcome === "w" || outcome === "l" || outcome === "d") r[outcome]++;
  try {
    if (storage) storage.setItem(KEY, JSON.stringify(r));
  } catch {
    /* ignore — in-memory result is still returned */
  }
  return r;
}
