---
description: Build — turn the approved spec into an implementation plan at docs/plan/plan.md (proposed for approval)
---

Produce an **implementation plan** from the approved spec, following "Agents propose,
humans decide". This plan feeds `/implement`.

## Preconditions

1. Check that `docs/specify/spec.md` exists. If not, stop and tell the user to run
   `/specify` first.
2. Confirm with the user that the spec is **approved**. If not, stop.

## Steps

1. Delegate to the **implementer** subagent (via the Agent tool) in **plan** mode. Tell it to:
   - Read `CLAUDE.md` and honor the project skills.
   - Read and build on `docs/specify/spec.md`.
   - Write the plan to `docs/plan/plan.md`: the ordered list of files to create, the build
     sequence (scaffold → schema/repository → routes → wiring → run), and the work broken
     into `TASK-NNN` items, each with a short description and an acceptance check.
   - Include **Assumptions** and **Open questions**.
2. When the subagent returns, present a summary plus the key assumptions and open questions.
3. Ask the user to **review and approve** the plan, and make clear that `/implement` should
   only run once the plan is approved.

Do not write code in this command.
