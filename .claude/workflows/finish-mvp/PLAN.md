# PixelClash — Finish-MVP Plan

A phased workflow spec. Each phase is independently shippable: implement, test,
commit, push, then stop for review. Every phase MUST end green:
`npm test` (all groups) + `node test/live-browser.mjs`.

Status legend: `[ ]` todo · `[~]` in progress · `[x]` done

Already complete (milestones 1–10): toolchain, movable sprite, networking,
health/attack/ability, bases + win/lose, prediction, 3v3 spawns, dash,
cooldown indicators. This plan covers the remaining polish for a shippable MVP.

---

## Phase A — Combat feedback `[x]`
**Why:** hits currently have no juice; players can't tell when they connect.
- Flash a player white briefly when damaged (server already knows HP drops;
  client detects HP decrease per snapshot and tweens a tint).
- Floating damage numbers rising and fading at the victim's position.
- Brief base-hit flash when a base takes damage.
- A short knockout effect (fade/scale) on death; respawn pop-in.
**Acceptance:** a new headless test asserts a damaged player's sprite shows a
tint/feedback flag and a damage-number object is spawned. No console errors.

## Phase B — Lobby / match start `[x]`
**Why:** players are dropped straight into an empty arena; no sense of "match."
- A `LobbyScene` (or lobby state) showing "Waiting for players… N/NEEDED".
- Server tracks a match lifecycle: `waiting` → `playing` → `over` → reset.
  Match starts when each team has ≥1 (1v1) or is full enough per config.
- Countdown ("Starting in 3…") before `playing`.
**Acceptance:** server unit test for the lifecycle transitions; headless test
that the lobby text shows and the arena begins after enough players join.

## Phase C — A real map `[ ]`
**Why:** the open grid makes positioning and dash meaningless.
- Add a few walls/obstacles in `config.js` (rectangles), drawn in the arena.
- Server movement + dash collide with walls (shared in `sim.js`).
- Projectiles are blocked by walls.
**Acceptance:** sim test that movement/dash stop at a wall; server test that a
bolt is consumed by a wall. Live test still passes.

## Phase D — Audio `[ ]`
**Why:** silence reads as broken. Tiny, generated (WebAudio) blips — no asset
files, no licensing.
- Sound on: shoot, hit, death, base destroyed, win.
- A mute toggle (persisted in localStorage).
**Acceptance:** headless test that the audio module exists and mute toggles a
flag; guard so tests run headless without a real audio device.

## Phase E — Mobile & UX polish `[ ]`
**Why:** it's a mobile game; verify the touch layout and readability.
- Buttons sized/positioned for thumbs; safe-area insets.
- "Tap to start / unmute" gate (mobile browsers block audio until a tap).
- Scale check at phone aspect ratios.
**Acceptance:** headless test at a phone viewport that joystick + 3 buttons are
present and on-screen; screenshot at portrait phone size.

## Phase F — Deploy guide + final docs `[ ]`
**Why:** an MVP friends can't reach isn't shipped.
- Step-by-step free hosting (server on Render/Railway free tier — flag the
  account requirement; static page on GitHub Pages/Netlify), with the exact
  client URL switch in `WebSocketConnection.js` (`ws://`→`wss://`).
- Refresh README + HOW-TO-KEEP-BUILDING + screenshots to final state.
**Acceptance:** docs build/read cleanly; links valid; `npm test` green.

---

## Cross-cutting rules
- Server stays authoritative; clients only render + predict the local player.
- Keep beginner-readable comments; define jargon once.
- One feature = one commit, message ending with the session link.
- Tune values in `config.js`, not scattered literals.
- After each phase: update this file's checkboxes and the docs.
