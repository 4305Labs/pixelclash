// ===========================================================================
// anim.js — pure animation math (no Phaser), so it's unit-testable in Node.
// Entities feed in a phase + whether the unit is moving, and get back a small
// vertical "bob" offset and x/y scale multipliers (squash & stretch). Keeping
// this side-effect-free means the render loop just applies the returned numbers.
// ===========================================================================

export const IDLE_HZ = 1.6; // breathing bobs per second when standing still
export const WALK_HZ = 5.5; // hop bounces per second when moving
export const IDLE_BOB = 1.0; // idle bob amplitude, in px
export const WALK_BOB = 3.0; // walk hop amplitude, in px
export const POP_MS = 160; // attack "pop" duration, in ms

// Advance an animation phase (radians) by dt, faster while moving. Wraps at 2π
// so it never grows unbounded.
export function advancePhase(phase, dtMs, moving) {
  const hz = moving ? WALK_HZ : IDLE_HZ;
  const next = phase + (dtMs / 1000) * hz * Math.PI * 2;
  return next % (Math.PI * 2);
}

// The body pose for a given phase. Idle = a gentle up/down breathing bob (no
// squash). Walking = a hop (always upward) with squash at the ground and
// stretch at the apex. `bob` is a y offset in px (negative = up); `sx`/`sy` are
// scale multipliers around 1.
export function bodyPose(phase, moving) {
  if (!moving) {
    return { bob: Math.sin(phase) * IDLE_BOB, sx: 1, sy: 1 };
  }
  const lift = Math.abs(Math.sin(phase)); // 0 at ground, 1 at apex
  return {
    bob: -lift * WALK_BOB,
    sx: 1 + 0.1 * (1 - lift) - 0.05 * lift, // wider when grounded
    sy: 1 - 0.1 * (1 - lift) + 0.05 * lift, // taller at the apex
  };
}

// A quick scale "punch" when attacking: starts at +`amount`, eases back to 1
// over POP_MS. `elapsedMs` is time since the attack; returns a scale multiplier
// (1 once it's over or before it starts).
export function popScale(elapsedMs, amount = 0.25) {
  if (elapsedMs < 0 || elapsedMs >= POP_MS) return 1;
  const t = elapsedMs / POP_MS; // 0 -> 1
  return 1 + amount * (1 - t); // linear ease-out back to 1
}
