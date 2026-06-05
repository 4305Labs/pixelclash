# Workflows — automated polish for PixelClash

A **dynamic workflow** is a small JavaScript "harness" that spawns and
coordinates focused sub-agents (each with its own clean context window) to do a
long, many-small-steps task that would otherwise drift in a single chat. See
Anthropic's *"A harness for every task: dynamic workflows in Claude Code."*

## `polish-moba.mjs`

Keeps polishing the game — juice, art, audio, balance, HUD readability — without
touching the architecture or breaking tests. One iteration:

| Phase | Pattern (from the article) | What happens |
|---|---|---|
| **Generate** | generate-and-filter | a scout proposes N concrete, self-contained polish ideas as JSON |
| **Filter** | generate-and-filter | a judge ranks them by a rubric, keeps the safest high-impact K |
| **Fan-out** | fan-out-and-synthesize | one implementer per idea, each in its **own git worktree**, makes the change + a test, runs `npm test` |
| **Verify** | adversarial verification | a reviewer checks each diff against the project invariants and the idea's own acceptance check |
| **Integrate** | synthesize (barrier) | passing diffs land **sequentially** on the branch; full ritual runs; one commit per idea |

It then **loops** (`loop-until-done`) until the iteration budget is spent or the
judge finds nothing worth doing.

### Why a workflow and not just one chat

Polishing is the exact shape that breaks a single context window — the article's
*agentic laziness* (stopping at 3 of 10 tweaks), *self-preferential bias*
(grading its own change as fine), and *goal drift* (forgetting "stay
server-authoritative" after a compaction). The deterministic loop holds the
guardrails; each sub-agent only ever sees one scoped task, so the invariants
can't be summarized away. Integration is **sequential on purpose** — the repo
has been bitten by two parallel edits to one file landing out of order.

### Running it

- **Native (Workflows enabled):** `ultracode: run workflows/polish-moba.mjs`, or
  pick it from the `/workflows` menu. Tune the budget by editing the
  `polishMoba({ iterations, perIteration })` defaults.
- **By hand / any agent:** the file doubles as the canonical plan — an
  orchestrating Claude runs the same phases with the `Agent` tool (the prompts
  and rubric map 1:1 onto `Agent()` spawns). This is how the first iteration in
  this repo's history was run.
- **Just inspect the plan:** `node workflows/polish-moba.mjs` prints how to run it.

### The guardrails it enforces (per `CLAUDE.md` / `HANDOVER.md`)

- Server stays authoritative; new state flows through `snapshot()` → `NetClient`
  → a `sync*` method (`m30.snapshot` enforces it).
- Tune in `src/config.js`; all heroes share `PLAYER_SPEED`.
- Every change ships a test wired into `test/run-all.mjs`.
- Done = `npm test` **&&** `node test/live-browser.mjs` **&&** `npm run build`
  all green.
- One feature = one commit, message ends with the session link, **no backticks**
  (heredoc commit). Develop only on `claude/pixel-moba-game-WobPa`; no PRs.
