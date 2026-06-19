---
description: Define — turn the approved brief into docs/define/prd.md (proposed for approval)
---

Produce a **PRD** from the approved discovery brief, following "Agents propose, humans
decide". This is the artifact that feeds Stage 2 (the app skeleton), so it must be
precise.

## Preconditions

1. Check that `docs/discovery/brief.md` exists. If it does not, stop and tell the user
   to run `/brief` first.
2. Confirm with the user that the brief is **approved**. If they have not approved it,
   stop — do not build the PRD on an unapproved brief.

## Steps

1. Delegate the analysis to the **product-analyst** subagent (via the Agent tool). Tell
   it to:
   - Read `CLAUDE.md` and honor the `task-conventions` skill (IDs, states, priorities).
   - Read and **build on `docs/discovery/brief.md`** — reuse its decisions; do not
     re-derive scope.
   - Draft a PRD and **write it to `docs/define/prd.md`** with this structure:
     - **Context** — one paragraph linking back to the brief.
     - **Goals** — measurable outcomes.
     - **User stories** — `As a … I want … so that …`, each with a stable label.
     - **Functional requirements** — numbered, testable.
     - **Acceptance criteria** — per story or requirement, verifiable.
     - **Out of scope** — explicit exclusions.
     - **Assumptions** and **Open questions** (required).
   - Keep requirements consistent with the task model (`TASK-NNN`, the Kanban states,
     the priorities). The PRD must be implementable without inventing new conventions.
2. When the subagent returns, present to the user:
   - a brief summary of the proposed `docs/define/prd.md`,
   - the key assumptions and the open questions that need a decision.
3. End by asking the user to **review and approve** the PRD, and make clear that Stage 2
   (`/specify`, `/plan`, `/implement`) should only begin once the PRD is approved.

Do not write code or scaffold the app in this command.
