---
description: Persistent memory — init | status | save | resume a per-session working memory under context/memories/
---

Manage the lab's **persistent memory** so a session can be closed and a fresh one can pick up
the context. This is the Stage 5 runnable capability — a local, personal replica of a
`session.json` handoff pattern.

`$ARGUMENTS` selects the mode: `init [name]`, `status [name]`, `save [name]`, `resume [name]`.
If no mode is given, default to `status`. If no `name` is given, use the active memory recorded
in `context/memories/active` (fall back to `default`).

## Memory layout

Each memory is a directory `context/memories/<name>/` with three files:

- **`session.json`** — structured state. Schema:
  ```json
  {
    "name": "<name>",
    "project": "agent-driven-dev-lab",
    "createdAt": "<ISO-8601 UTC>",
    "updatedAt": "<ISO-8601 UTC>",
    "stage": { "current": 0, "title": "", "status": "in_progress" },
    "git": { "branch": "", "lastCommit": "" },
    "openThreads": [],
    "nextSteps": [],
    "decisions": [],
    "pointers": { "memory": "memory.md", "handoff": "handoff.md" }
  }
  ```
- **`memory.md`** — durable human-readable notes: decisions and learnings that persist.
- **`handoff.md`** — the resume narrative: *Where we are / What's next / How to pick up.*

`context/memories/active` is a one-line text file holding the active memory name. The
`context/memories/` tree is gitignored runtime state (only `context/memories/example/` is
committed, as a reference).

## Modes

### `init [name]`
1. Resolve `name` (arg, else `default`). If `context/memories/<name>/` already exists, **stop**
   and tell the user to use `save` instead — do not clobber.
2. Gather current state: read `CLAUDE.md` for the current stage + title and its status; run
   `git rev-parse --abbrev-ref HEAD` (branch) and `git log -1 --oneline` (last commit).
3. Create the directory and write `session.json` (both timestamps = now, UTC), a starter
   `memory.md`, and a starter `handoff.md` seeded from that state.
4. Write the resolved `name` into `context/memories/active`.
5. Report the path created and a one-line summary.

### `status [name]`
Read-only. Resolve the memory (arg, else active, else `default`). If it doesn't exist, say so
and suggest `init`. Otherwise print a compact summary from `session.json`: name, stage,
`updatedAt`, open threads, and next steps. If several memories exist under `context/memories/`,
list them and mark the active one.

### `save [name]`
1. Resolve the memory (arg, else active). If it doesn't exist, suggest `init` and stop.
2. Refresh `session.json`: bump `updatedAt` to now (keep `createdAt`), refresh the `git` block,
   and update `openThreads` / `nextSteps` / `decisions` from the current conversation.
3. Update `handoff.md` (where we are / what's next / how to pick up) and append any durable
   decisions or learnings to `memory.md`.
4. Show a short summary of what changed (the human stays in the loop — "agents propose").

### `resume [name]`
Read `session.json`, `handoff.md`, and `memory.md` for the resolved memory and **reconstruct
the working context** into the conversation: restate the current stage, the open threads, the
recorded decisions, and the concrete next steps. Then ask the user how they'd like to proceed.
This is the checkpoint: a brand-new session runs `/memory resume` and continues where the last
one left off.

## Notes

- Keep all written content in **English** (repo convention); timestamps in ISO-8601 UTC.
- Never write secrets into a memory file. `context/memories/` is gitignored; verify before any
  commit (see the project's pre-push secret routine).
