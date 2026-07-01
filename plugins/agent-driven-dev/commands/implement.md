---
description: Build — implement the approved plan into a runnable REST API + SQLite app (proposed for approval)
---

Implement the app from the approved plan, following "Agents propose, humans decide". This
is the Stage 2 runnable checkpoint.

## Preconditions

1. Check that `docs/plan/plan.md` exists. If not, stop and tell the user to run `/plan` first.
2. Confirm with the user that the plan is **approved**. If not, stop.

## Steps

1. Delegate to the **implementer** subagent (via the Agent tool) in **implement** mode. Tell it to:
   - Read `CLAUDE.md` and honor the `task-conventions`, `rest-api-conventions`, and
     `sqlite-repository` skills.
   - Read and build on `docs/plan/plan.md` and `docs/specify/spec.md`.
   - Create the project scaffold and source under `src/`: an HTTP REST API over SQLite that
     implements every endpoint and validation rule, plus `npm` scripts to run it.
   - Not invent scope beyond the plan; keep code consistent with the skills.
2. When the subagent returns, present what was created and how to run it.
3. Verify the checkpoint with the user: `npm install`, `npm run dev`, then `curl` to create
   and list tasks — confirming persistence in SQLite and the PRD acceptance criteria
   (AC-1..AC-15).

Do not move on to Stage 3 until the user confirms the app runs.
