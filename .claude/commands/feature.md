---
description: Orchestrate — drive a feature through specify → plan → implement → qa in a git worktree, with a human gate at every phase
---

You are the **coordinator** for the full build chain. Given a feature idea, you orchestrate the
existing workers — the `implementer` subagent (modes `specify` / `plan` / `implement`) and the
`qa-engineer` subagent — to take the feature from idea to tested code, **in an isolated git
worktree**, pausing for human approval at every phase. This is the Stage 6 runnable checkpoint.

> **You run in the main thread on purpose.** Only the main thread can stop and wait for the
> human between phases, which is what keeps "agents propose, humans decide" intact. Do **not**
> spin up an autonomous coordinator subagent that runs the chain end-to-end.

## Input

`$ARGUMENTS` = `<slug> "<feature description>"`.
- `slug` must match `^[a-z0-9-]+$` (used for the branch, the worktree dir, and the docs dir).
- If the slug or description is missing, ask for it and stop.

## Preconditions

1. `src/` exists (the app is implemented). If not, stop — the chain builds on the existing app.
2. The working tree is **clean** and you are on `main` (`git status`, `git rev-parse --abbrev-ref HEAD`).
   If not, stop and ask the user to commit/stash or switch to `main` first.

## Reuse, do not duplicate

Each phase delegates to the **same subagents** the individual `/specify`, `/plan`, `/implement`,
and `/qa` commands use. Pass them **absolute paths inside the worktree** so every read, write,
and `npm` run happens in the worktree — never on `main`. Let `WT` = the worktree path
(`../add-lab-feat-<slug>` resolved to an absolute path).

## Phases (stop for approval after each)

### Phase 0 — Scope & setup
1. Restate the description as a short **feature brief**: what it does, which existing parts it
   touches (endpoints, schema, validation, repository), and a sketch of acceptance criteria.
2. **Gate 0:** ask the user to approve the scope. Stop until approved.
3. On approval, create the worktree and install deps:
   - `git worktree add ../add-lab-feat-<slug> -b feat/<slug>`
   - `npm install` **in the worktree** (native deps compile; this is a one-time cost).

### Phase 1 — Specify
1. Delegate to **implementer** (specify mode). Tell it to: read `WT/CLAUDE.md` and honor the
   `task-conventions`, `rest-api-conventions`, `sqlite-repository` skills; read the existing
   `WT/docs/specify/spec.md` and `WT/src/` for context; treat the **approved brief** as the
   requirement (do not re-derive the whole app); write a feature spec to
   `WT/docs/features/<slug>/spec.md` with **Assumptions** and **Open questions**. No code.
2. Present the summary, assumptions, and open questions. **Gate 1:** approve the spec.

### Phase 2 — Plan
1. Delegate to **implementer** (plan mode): build on `WT/docs/features/<slug>/spec.md`; write
   `WT/docs/features/<slug>/plan.md` — the files to touch, the build sequence, and the work as
   `TASK-NNN` items each with an acceptance check; include Assumptions + Open questions. No code.
2. Present the summary. **Gate 2:** approve the plan.

### Phase 3 — Implement
1. Delegate to **implementer** (implement mode): build on the feature plan; write code into
   `WT/src/` consistent with the skills; run `npm run build` in the worktree.
2. Present the diff (`git -C WT diff`) and the build result. **Gate 3:** approve the implementation.

### Phase 4 — QA
1. Delegate to **qa-engineer**: write tests in `WT/test/` mapped to the feature's acceptance
   criteria (in-memory SQLite, `app.inject`), and run `npm test` in the worktree until green —
   but if a test reveals a genuine bug, stop and report it instead of weakening the test.
2. Present the suites added, AC coverage, and the `npm test` result. **Gate 4:** approve the tests.

### Phase 5 — Land
1. Summarize the ready branch `feat/<slug>` and run the project's pre-push secret routine on the
   worktree's staged changes.
2. **Do not auto-merge or auto-push.** Print the commands for the human to finish:
   - commit inside the worktree, then merge: `git -C . merge feat/<slug>` (from `main`) or open a PR;
   - clean up: `git worktree remove ../add-lab-feat-<slug>`.
3. State clearly that the whole deliverable is a **proposal pending human review and merge**.

## Rules

- One feature per invocation. Stay in the requested phase; never skip a gate.
- All artifacts and code in **English**. Feature artifacts live under `docs/features/<slug>/`;
  the whole-app artifacts (`docs/specify/spec.md`, `docs/plan/plan.md`) are the baseline and are
  not overwritten.
- Never commit secrets; the worktree inherits the repo's `.gitignore` and pre-commit hook.
