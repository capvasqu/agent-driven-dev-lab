---
description: Discovery — turn a raw product idea into docs/discovery/brief.md (proposed for approval)
---

Produce a **discovery brief** from a raw idea, following "Agents propose, humans decide".

The raw idea is: **$ARGUMENTS**

If `$ARGUMENTS` is empty, ask the user for the raw idea in one line and stop until they
answer. Do not assume the idea.

## Steps

1. Delegate the analysis to the **product-analyst** subagent (via the Agent tool). Give
   it the raw idea and these instructions:
   - Read `CLAUDE.md` for product context and conventions.
   - Draft a discovery brief and **write it to `docs/discovery/brief.md`** with this
     structure:
     - **Problem** — what pain we are solving, and why now.
     - **Target users** — who they are and what they need.
     - **Goals** — the outcomes a good solution delivers.
     - **Non-goals** — what we deliberately leave out.
     - **Scope** — in scope vs. out of scope.
     - **Success signals** — how we would know it works.
     - **Assumptions** and **Open questions** (required).
2. When the subagent returns, **do not silently accept it**. Present to the user:
   - a brief summary of the proposed `docs/discovery/brief.md`,
   - the key assumptions and the open questions that need a decision.
3. End by asking the user to **review and approve** the brief, and make clear that
   `/prd` should only run once the brief is approved.

Do not write code or move on to the PRD in this command.
