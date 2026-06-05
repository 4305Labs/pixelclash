// ===========================================================================
// sim.js — the SINGLE source of truth for movement math, shared by both the
// server (authoritative) and the client (prediction). Using the exact same
// function on both sides means the player's predicted position and the
// server's real position stay in close agreement, so corrections are tiny.
// ===========================================================================

import { PLAYER_SPEED, PLAYER_HALF, GAME_WIDTH, GAME_HEIGHT, WALLS } from "./config.js";

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// --- Wall collision ---------------------------------------------------------
// We treat a player as a square of side 2*PLAYER_HALF and resolve walls one
// axis at a time (X first, then Y). Resolving per-axis lets the player slide
// along a wall instead of sticking to it, and only blocking a move that would
// ENTER a wall (we were outside its near face before) avoids getting trapped.

// Push a horizontal move out of any wall it would enter. `y` is the player's
// current vertical position, used to see which walls are actually in the way.
function collideX(oldX, newX, y, walls) {
  for (const w of walls) {
    const top = w.y;
    const bottom = w.y + w.h;
    // Skip walls the player isn't level with vertically.
    if (y + PLAYER_HALF <= top || y - PLAYER_HALF >= bottom) continue;
    const left = w.x;
    const right = w.x + w.w;
    if (newX > oldX && oldX + PLAYER_HALF <= left && newX + PLAYER_HALF > left) {
      newX = left - PLAYER_HALF; // moving right: stop at the wall's left face
    } else if (newX < oldX && oldX - PLAYER_HALF >= right && newX - PLAYER_HALF < right) {
      newX = right + PLAYER_HALF; // moving left: stop at the right face
    }
  }
  return newX;
}

// The vertical twin of collideX. `x` is the (already X-resolved) position.
function collideY(oldY, newY, x, walls) {
  for (const w of walls) {
    const left = w.x;
    const right = w.x + w.w;
    if (x + PLAYER_HALF <= left || x - PLAYER_HALF >= right) continue;
    const top = w.y;
    const bottom = w.y + w.h;
    if (newY > oldY && oldY + PLAYER_HALF <= top && newY + PLAYER_HALF > top) {
      newY = top - PLAYER_HALF;
    } else if (newY < oldY && oldY - PLAYER_HALF >= bottom && newY - PLAYER_HALF < bottom) {
      newY = bottom + PLAYER_HALF;
    }
  }
  return newY;
}

// Move from (oldX,oldY) toward a target point, clamped to the arena and
// blocked by walls. Shared by normal movement and the dash so both obey the
// same map. Identical on server and client, so prediction stays in sync.
// `extra` is an optional list of dynamic obstacle rects (e.g. live towers) that
// block this mover too — pass the SAME list on server and client.
export function resolveMove(oldX, oldY, targetX, targetY, extra) {
  const walls = extra && extra.length ? WALLS.concat(extra) : WALLS;
  let nx = clamp(targetX, PLAYER_HALF, GAME_WIDTH - PLAYER_HALF);
  let ny = clamp(targetY, PLAYER_HALF, GAME_HEIGHT - PLAYER_HALF);
  nx = collideX(oldX, nx, oldY, walls);
  ny = collideY(oldY, ny, nx, walls);
  return { x: nx, y: ny };
}

// Is the point (x,y) inside any wall? Used to absorb projectiles.
export function pointInWall(x, y) {
  for (const w of WALLS) {
    if (x >= w.x && x <= w.x + w.w && y >= w.y && y <= w.y + w.h) return true;
  }
  return false;
}

// Build collision rects for the LIVE towers so heroes path around them (a bit
// smaller than the 44px sprite so you can hug the turret). Dead towers drop out,
// so a destroyed tower stops blocking. Same list is used on server + client.
export const TOWER_BLOCK_HALF = 16;
export function towerObstacles(towers) {
  const r = TOWER_BLOCK_HALF;
  const obs = [];
  for (const t of towers) {
    if (t.alive) obs.push({ x: t.x - r, y: t.y - r, w: 2 * r, h: 2 * r });
  }
  return obs;
}

// Normalize an input vector so diagonals aren't faster than straight lines.
// (Only shrinks it if it's longer than 1; a half-pushed joystick stays slow.)
export function normalizeInput(dx, dy) {
  const len = Math.hypot(dx, dy);
  if (len > 1) return { dx: dx / len, dy: dy / len };
  return { dx, dy };
}

// Advance a position by an input vector over dt seconds, clamped to the arena
// and blocked by walls.
export function stepPosition(x, y, dx, dy, dt, extra) {
  const n = normalizeInput(dx, dy);
  return resolveMove(x, y, x + n.dx * PLAYER_SPEED * dt, y + n.dy * PLAYER_SPEED * dt, extra);
}
