// ===========================================================================
// sim.js — the SINGLE source of truth for movement math, shared by both the
// server (authoritative) and the client (prediction). Using the exact same
// function on both sides means the player's predicted position and the
// server's real position stay in close agreement, so corrections are tiny.
// ===========================================================================

import { PLAYER_SPEED, PLAYER_HALF, GAME_WIDTH, GAME_HEIGHT } from "./config.js";

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// Normalize an input vector so diagonals aren't faster than straight lines.
// (Only shrinks it if it's longer than 1; a half-pushed joystick stays slow.)
export function normalizeInput(dx, dy) {
  const len = Math.hypot(dx, dy);
  if (len > 1) return { dx: dx / len, dy: dy / len };
  return { dx, dy };
}

// Advance a position by an input vector over dt seconds, clamped to the arena.
export function stepPosition(x, y, dx, dy, dt) {
  const n = normalizeInput(dx, dy);
  return {
    x: clamp(x + n.dx * PLAYER_SPEED * dt, PLAYER_HALF, GAME_WIDTH - PLAYER_HALF),
    y: clamp(y + n.dy * PLAYER_SPEED * dt, PLAYER_HALF, GAME_HEIGHT - PLAYER_HALF),
  };
}
