# Finish-MVP Workflow

A phased plan to take PixelClash from "core loop complete" to "shippable MVP."

## How to use this

**On desktop Claude Code (with dynamic workflows enabled):**
Open this repo and say:

> Run a workflow to finish the PixelClash MVP using the phases in
> `.claude/workflows/finish-mvp/PLAN.md`. Do one phase at a time; after each,
> run `npm test` and the live check, and stop for my review.

Claude will read `PLAN.md`, generate an orchestration script, and fan the work
out across sub-agents (audits, per-feature implementation, doc updates).

**Anywhere (including web sessions):**
The same `PLAN.md` is a plain checklist. Ask Claude to "do the next unchecked
phase from the finish-mvp plan," and it will implement, test, and commit that
phase sequentially — no special runtime required.

## Why both modes

Dynamic-workflow orchestration (parallel sub-agents) only runs in environments
where the workflow runtime is available. The plan is written so it works as a
literal agent spec there, AND as a human/AI-readable punch-list everywhere else.
The source of truth for *what* to build is `PLAN.md`; this file only explains
*how* to run it.

## Definition of done (the whole MVP)

- A new player can open the page, land in a lobby, get matched, play a full
  match (move, attack, ability, dash), see clear combat feedback, win or lose
  via base destruction, and rematch — on desktop and on a phone via Wi-Fi.
- `npm test` passes (all groups) and the live two-browser test passes.
- README + HOW-TO-KEEP-BUILDING reflect the final state.

See `PLAN.md` for the phased breakdown and acceptance checks.
