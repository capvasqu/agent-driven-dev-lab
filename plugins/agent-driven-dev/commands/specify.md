---
description: Build — turn the approved PRD into a technical spec at docs/specify/spec.md (proposed for approval)
---

Produce a **technical specification** from the approved PRD, following "Agents propose,
humans decide". This spec feeds `/plan`.

## Preconditions

1. Check that `docs/define/prd.md` exists. If not, stop and tell the user to run `/prd` first.
2. Confirm with the user that the PRD is **approved**. If not, stop.

## Steps

1. Delegate to the **implementer** subagent (via the Agent tool) in **specify** mode. Tell it to:
   - Read `CLAUDE.md` and honor the `task-conventions`, `rest-api-conventions`, and
     `sqlite-repository` skills.
   - Read and build on `docs/define/prd.md`; reuse its decisions, do not re-derive scope.
   - Write the spec to `docs/specify/spec.md` covering: the chosen stack and libraries, the
     project structure, the SQLite schema, each endpoint's request/response and validation,
     the error envelope and codes, id/timestamp generation, and how state transitions are
     enforced.
   - Include **Assumptions** and **Open questions**.
2. When the subagent returns, present a summary plus the key assumptions and the open
   questions that need a decision.
3. Ask the user to **review and approve** the spec, and make clear that `/plan` should only
   run once the spec is approved.

Do not write code in this command.
