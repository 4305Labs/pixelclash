// ===========================================================================
// polish-moba.mjs — a DYNAMIC WORKFLOW that keeps polishing PixelClash.
// ===========================================================================
//
// WHAT THIS IS
// ------------
// A "harness": a small JavaScript program that spawns and coordinates focused
// sub-agents (each with its own clean context window) to repeatedly find and
// land *polish* improvements to the game — juice, art, audio, balance, HUD
// readability, small UX — WITHOUT touching the architecture or breaking tests.
//
// It exists because polishing is a long, many-small-steps task, exactly the
// shape that drifts in a single context window (the failure modes Thariq's
// "A harness for every task" post names: agentic laziness, self-preferential
// bias, goal drift). Splitting it into fan-out + adversarial-verify keeps every
// step honest and the original guardrails intact.
//
// HOW TO RUN IT
// -------------
//   • Native: with Workflows enabled, say  "ultracode: run workflows/polish-moba.mjs"
//     (or load it from the /workflows menu). The runtime injects the `wf` API below.
//   • By hand / any agent: this file doubles as the canonical PLAN. An
//     orchestrating Claude can execute the same loop using the Agent tool —
//     the phases, prompts, and rubric below map 1:1 onto Agent() spawns.
//
// THE LOOP (one iteration)
// ------------------------
//   1. GENERATE   — a scout proposes N concrete, self-contained polish ideas.
//   2. FILTER     — a judge ranks them by a rubric, keeps the top K safe/high-impact.
//   3. FAN-OUT    — one implementer per idea, each in its OWN git worktree, makes
//                   the change + ships/extends a test, runs `npm test`.
//   4. VERIFY     — an adversarial reviewer checks each diff against the project
//                   invariants and the idea's own acceptance check. Pass or reject.
//   5. INTEGRATE  — passing diffs land SEQUENTIALLY on the branch (the repo's
//                   "parallel edits to one file reorder" gotcha → never merge two
//                   at once); after each, the full ritual runs; commit one-per-idea.
//   Repeat until the iteration budget is spent or the judge finds nothing worth doing.
//
// The deterministic loop here holds the guardrails; the sub-agents only ever see
// a single, scoped task — so "keep tests green" and "stay server-authoritative"
// can't be summarized away.
//
// ---------------------------------------------------------------------------
// RUNTIME ADAPTER
// ---------------------------------------------------------------------------
// The dynamic-workflows runtime injects a coordination API. We read it from the
// global the runtime provides and fall back to names so this file is portable;
// if your runtime spells these differently, fix them here in ONE place.
const wf = globalThis.workflow ?? globalThis.wf ?? {};
const spawn = wf.spawnAgent ?? wf.agent ?? wf.spawn; // async ({prompt, model, worktree, tools?}) -> {text, files?}
const ask = wf.askUser ?? wf.AskUserQuestion;        // optional: pause for human steering
const log = wf.log ?? console.log;

// ---------------------------------------------------------------------------
// PROJECT KNOBS — everything specific to PixelClash lives here.
// ---------------------------------------------------------------------------
const REPO = "/home/user/pixelclash";
const BRANCH = "claude/pixel-moba-game-WobPa";
const SESSION_LINK = "https://claude.ai/code/session_01MAXKRUpJFcKFAvV2b8xTXo";

// The non-negotiable verification ritual (CLAUDE.md / HANDOVER.md).
const RITUAL = [
  "npm test",                      // all headless groups; builds the bundle once
  "node test/live-browser.mjs",    // real ws server + two headless Chromium tabs
  "npm run build",                 // production build to dist/
];

// The invariants every change is judged against (the reviewer's rubric).
const INVARIANTS = `
- Server stays AUTHORITATIVE: clients only render + predict the LOCAL player.
  New real state lives in GameServer and flows through snapshot() -> NetClient
  -> a sync*/update* method (m30.snapshot enforces every field is read).
- Tune numbers in src/config.js, never scatter literals.
- All heroes share PLAYER_SPEED (client prediction depends on it).
- Texture sizes are load-bearing (hit radii read from them) — reskin same-size
  or update the matching config radius.
- Headless tests have NO audio/localStorage — guard new browser APIs.
- One feature = one commit; message ends with the session link; NO backticks in
  the message (use: git commit -F - with a heredoc). Never put a model id in any
  committed artifact.
- Develop only on ${BRANCH}. Do not open a PR.
- A change is DONE only when all of: ${RITUAL.join(" && ")} are green, and it
  ships/extends a test under test/mNN.<name>.mjs wired into test/run-all.mjs.
`;

// What "polish" means here — steers the scout away from big features.
const POLISH_CHARTER = `
PixelClash is a finished, tested pixel-art MOBA (Phaser 3 client + Node/ws
server-authoritative). Your job is POLISH, not new systems:
  • Juice/feedback: hit flashes, damage numbers, screen shake, death poofs,
    spawn/level-up sparkle, projectile trails, low-HP vignette.
  • Art coherence: palette/shading touch-ups, decor density, lane/jungle read,
    structure detail — all drawn in code (src/textures.js, src/rpgsprites.js).
  • Audio: missing or flat cues, gentle ambience (guarded for headless).
  • Game feel / balance: small config.js tuning validated via bots (m29).
  • HUD/UX readability: clarity of scoreboard, clock, kill feed, shop, respawn.
Each idea must be SELF-CONTAINED (one commit), low-risk, and not change the
architecture, the snapshot contract shape, or PLAYER_SPEED.
`;

const MODELS = { scout: "sonnet", judge: "sonnet", implementer: "opus", reviewer: "sonnet" };

// ---------------------------------------------------------------------------
// PHASES
// ---------------------------------------------------------------------------

// 1. GENERATE — propose concrete, scoped polish ideas as structured JSON.
async function generate(count, alreadyDone) {
  const res = await spawn({
    model: MODELS.scout,
    prompt: `You are scouting POLISH work for a game in ${REPO} (branch ${BRANCH}).
Read HANDOVER.md, src/config.js, src/scenes/ArenaScene.js, src/textures.js to
ground yourself. ${POLISH_CHARTER}

Already shipped this session (do NOT repeat): ${JSON.stringify(alreadyDone)}

Propose ${count} DISTINCT polish ideas. Return ONLY JSON:
[{ "id": "kebab-id", "title": "...", "area": "juice|art|audio|balance|hud",
   "why": "the player-facing improvement", "files": ["src/..."],
   "test": "the mNN.<name> test you'd add and what it asserts",
   "risk": "low|med", "effort": "S|M" }]`,
  });
  return parseJson(res.text);
}

// 2. FILTER — rank by rubric, keep the safest high-impact K.
async function filter(ideas, keep) {
  const res = await spawn({
    model: MODELS.judge,
    prompt: `Rank these PixelClash polish ideas and pick the best ${keep}.
Rubric (score each 1-5, prefer high total): player-facing IMPACT; SAFETY (won't
break invariants below); SELF-CONTAINED (one clean commit); TESTABLE.
Reject anything that needs an architecture change, alters the snapshot shape, or
touches PLAYER_SPEED.
INVARIANTS:${INVARIANTS}
IDEAS: ${JSON.stringify(ideas)}
Return ONLY JSON: [{ "id": "...", "score": N, "reason": "..." }] for the kept ${keep}, best first.`,
  });
  const ranked = parseJson(res.text);
  return ranked.map((r) => ({ ...ideas.find((i) => i.id === r.id), ...r }));
}

// 3. IMPLEMENT — one isolated worktree per idea: change + test + `npm test`.
async function implement(idea) {
  return spawn({
    model: MODELS.implementer,
    worktree: true, // isolation: its own copy of the repo, auto-cleaned if unused
    prompt: `Implement ONE polish change in PixelClash, in your worktree off ${BRANCH}.
IDEA: ${JSON.stringify(idea)}
RULES:${INVARIANTS}
Steps: (a) make the smallest change that delivers it, tuning via src/config.js
where numbers are involved; (b) add/extend a test test/mNN.<name>.mjs (+ a
.render.mjs if it's visual) and wire it into test/run-all.mjs; (c) run \`npm test\`
until green. Do NOT commit. Report: the unified diff, the new test's name, and
the exact \`npm test\` tail proving green.`,
  });
}

// 4. VERIFY — adversarial review against invariants + the idea's own check.
async function verify(idea, impl) {
  const res = await spawn({
    model: MODELS.reviewer,
    prompt: `Adversarially review this PixelClash polish diff. Assume it is wrong
until proven right. Check: does it actually deliver "${idea.why}"? Does the test
truly assert that (not a tautology)? Does it honor EVERY invariant?
INVARIANTS:${INVARIANTS}
DIFF + TEST EVIDENCE: ${impl.text}
Return ONLY JSON: { "verdict": "pass|reject", "blocking": ["..."], "notes": "..." }`,
  });
  return parseJson(res.text);
}

// 5. INTEGRATE — land passing diffs ONE AT A TIME, full ritual + commit each.
//    Sequential by design: the repo has bitten us when two edits to one file
//    were applied in parallel and reordered. The orchestrator (this loop) is the
//    only writer to the real branch.
async function integrate(idea, impl) {
  return spawn({
    model: MODELS.implementer,
    prompt: `Apply this approved polish change onto ${BRANCH} in ${REPO} (the REAL
working tree, not a worktree), then verify and commit it.
CHANGE: ${impl.text}
Do, in order: apply the change; run ${RITUAL.join(" && ")} and confirm all green;
update HANDOVER.md (Last updated + Status, and §7 if it closes an item); commit
EVERYTHING as ONE commit with:
  git commit -F - <<'MSG'
  <imperative subject for "${idea.title}">

  <one line on the player-facing effect>

  ${SESSION_LINK}
  MSG
Then: git push -u origin ${BRANCH} (retry up to 4x with 2/4/8/16s backoff on
network error only). Report the commit subject and the ritual's green tails.`,
  });
}

// ---------------------------------------------------------------------------
// ORCHESTRATION — loop-until-done over iterations.
// ---------------------------------------------------------------------------
export default async function polishMoba({ iterations = 3, perIteration = 2 } = {}) {
  const done = [];
  for (let i = 1; i <= iterations; i++) {
    log(`\n=== Polish iteration ${i}/${iterations} ===`);

    const ideas = await generate(Math.max(4, perIteration * 3), done);
    if (!ideas.length) { log("Scout found nothing worth doing — stopping."); break; }

    const chosen = await filter(ideas, perIteration);
    log(`Chosen: ${chosen.map((c) => c.id).join(", ")}`);

    // Fan out the IMPLEMENT step in parallel (isolated worktrees), then verify.
    const built = await Promise.all(
      chosen.map(async (idea) => ({ idea, impl: await implement(idea) }))
    );
    const reviews = await Promise.all(
      built.map(async (b) => ({ ...b, review: await verify(b.idea, b.impl) }))
    );

    // Integrate the survivors SEQUENTIALLY on the real branch.
    for (const b of reviews) {
      if (b.review.verdict !== "pass") {
        log(`✗ ${b.idea.id} rejected: ${(b.review.blocking || []).join("; ")}`);
        continue;
      }
      const out = await integrate(b.idea, b.impl);
      log(`✓ landed ${b.idea.id}: ${out.text?.split("\n")[0] ?? ""}`);
      done.push(b.idea.id);
    }

    // Optional human steering between iterations.
    if (ask && i < iterations) {
      const cont = await ask({
        question: `Landed ${done.length} polish commits so far. Keep going?`,
        options: [{ label: "Continue" }, { label: "Stop here" }],
      });
      if (cont?.label === "Stop here") break;
    }
  }
  log(`\nPolish run complete. Shipped: ${done.join(", ") || "(nothing)"}`);
  return { shipped: done };
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function parseJson(text) {
  // Sub-agents sometimes wrap JSON in prose or a ```json fence — extract it.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.search(/[[{]/);
  if (start === -1) return [];
  try { return JSON.parse(body.slice(start)); } catch { return []; }
}

// Allow `node workflows/polish-moba.mjs` to print the plan without a runtime.
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("polish-moba is a dynamic workflow. Run it via the Workflows runtime");
  console.log("(\"ultracode: run workflows/polish-moba.mjs\"), or follow the phases");
  console.log("in this file using the Agent tool. See workflows/README.md.");
}
