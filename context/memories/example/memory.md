# Memory — example

> Durable, human-readable notes for this memory. Decisions and learnings that should survive
> across sessions. This file is a **sanitized example** committed to show the shape; real
> memories live next to it under `context/memories/<name>/` and are gitignored.

## Decisions

- **One command, four modes.** `/memory` dispatches on `$ARGUMENTS`: `init | status | save |
  resume`. Cleaner than three separate command files and matches the `/memory init|...` notation.
- **Three files per memory.** `session.json` (structured state), `memory.md` (durable notes),
  `handoff.md` (resume narrative) — split by audience/format.
- **Versioning.** `context/memories/` is gitignored runtime state. Only this `example/` dir is
  committed (via a `.gitignore` negation) so the public repo demonstrates the capability.

## Learnings

- The hand-written `HANDOFF.md` already proved the value of a written handoff; Stage 5 turns
  that ad-hoc habit into a reusable, runnable capability.
- Keep memory content free of secrets — the tree is gitignored, but verify before any commit.
