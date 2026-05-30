// Milestone 26 (win/loss record): the persistent record loads, increments per
// outcome, and round-trips through storage — and degrades safely when storage
// is missing or throws. Pure Node with a fake storage.
import assert from "node:assert";
import { loadRecord, bumpRecord } from "../src/record.js";

// A minimal in-memory localStorage stand-in.
function fakeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
  };
}

try {
  const s = fakeStorage();
  assert.deepStrictEqual(loadRecord(s), { w: 0, l: 0, d: 0 }, "a fresh record is empty");

  bumpRecord(s, "w");
  bumpRecord(s, "w");
  bumpRecord(s, "l");
  bumpRecord(s, "d");
  const r = loadRecord(s);
  assert.deepStrictEqual(r, { w: 2, l: 1, d: 1 }, "wins/losses/draws are tallied and persisted");
  console.log("  ok record:", JSON.stringify(r));

  // An unknown outcome changes nothing.
  bumpRecord(s, "x");
  assert.deepStrictEqual(loadRecord(s), { w: 2, l: 1, d: 1 }, "an unknown outcome is ignored");

  // No storage (or one that throws) must never crash — returns a valid record.
  assert.deepStrictEqual(loadRecord(null), { w: 0, l: 0, d: 0 }, "missing storage loads an empty record");
  assert.deepStrictEqual(bumpRecord(null, "w"), { w: 1, l: 0, d: 0 }, "bump without storage still returns a result");
  const throwy = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  };
  assert.deepStrictEqual(loadRecord(throwy), { w: 0, l: 0, d: 0 }, "a throwing storage is handled");
  assert.deepStrictEqual(bumpRecord(throwy, "w"), { w: 1, l: 0, d: 0 }, "a throwing storage doesn't break a bump");

  console.log("\nMILESTONE 26 RECORD TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
}
