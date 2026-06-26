# Handoff — example

> The resume narrative for this memory: where we are, what's next, and how to pick up. A fresh
> session runs `/memory resume` and reads this to continue. **Sanitized example** (committed
> for reference); real memories are gitignored.

## Where we are

Stage 5 (Persistent memory) is in progress. The `/memory` command and the memory layout
(`session.json` + `memory.md` + `handoff.md`) are being built. Stages 0–4 are complete and on
`origin/main`. The app runs (`npm run dev`, `npm test`, `npm run mcp`).

## What's next

1. Run `/memory init` to seed a real working memory from the current state.
2. Verify the checkpoint: close this session, open a fresh one, run `/memory resume`, and
   confirm the context is restored.
3. Update `README.md` and `CLAUDE.md`, then commit Stage 5 (English message) and push.

## How to pick up

- Open a session inside `agent-driven-dev-lab`.
- Run `/memory resume` (this memory) to restore stage, open threads, decisions, and next steps.
- Cross-check against `session.json` for the structured snapshot (branch, last commit, timestamps).
