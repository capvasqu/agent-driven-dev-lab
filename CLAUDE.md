# agent-driven-dev-lab

A personal lab for practicing **Agent-Driven Development (ADD)** with Claude Code.

We build a **task / Kanban manager** (Node + TypeScript + SQLite) end-to-end,
and as we build it we create the agentic capabilities that drive it:
skills, commands, agents/subagents, tools, and our own MCP server.

## Philosophy

> **"Agents propose, humans decide."**
> Each stage produces an artifact (brief, PRD, spec, plan, tasks) that the human
> reviews and approves **before** moving on to the next one.

## Repository

Published on GitHub (public): https://github.com/capvasqu/agent-driven-dev-lab
`origin/main` is the upstream — commits are written in English; `git push` is enough.

## Stack

- Backend: Node + TypeScript (ESM/NodeNext), Fastify HTTP framework — app under `src/`
- Persistence: SQLite via `better-sqlite3` (repository pattern; db at `./data/tasks.db`, gitignored)
- MCP: `task-mcp` stdio server via `@modelcontextprotocol/sdk` (`src/mcp/server.ts`, declared in `.mcp.json`); reuses the same repository/SQLite as the API

## Project conventions

- Task IDs follow the `TASK-NNN` format (see the `task-conventions` skill).
- Product & build artifacts live in `docs/` (`docs/discovery/`, `docs/define/`, `docs/specify/`, `docs/plan/`).
- Application code lives in `src/`.
- Persistent memory (Stage 5): per-session working memory lives in `context/memories/<name>/` (`session.json` + `memory.md` + `handoff.md`), managed by the `/memory` command (`init|status|save|resume`). The tree is gitignored runtime state; only `context/memories/example/` is committed as a sanitized reference.
- Orchestration (Stage 6): `/feature <slug> "..."` drives `specify → plan → implement → qa` for a new feature in a git worktree (branch `feat/<slug>`), with a human gate per phase. Per-feature artifacts live under `docs/features/<slug>/`; the whole-app artifacts stay the baseline.
- Packaging (Stage 7): the reusable toolkit ships as a Claude Code plugin (`plugins/agent-driven-dev/`) served from `.claude-plugin/marketplace.json`. The plugin holds copies of the `.claude/` capabilities (excluding `/hello`); `npm run validate` enforces byte-parity plus native schema validation. From Stage 7 on, changes land via a GitHub PR (see `CONTRIBUTING.md`).
- Secrets: never commit real values. Share config shape via `.env.example`; keep tokens out of `.mcp.json` (use env vars). The `.gitignore` is hardened for secrets, databases, logs, and runtime state. A base `.env.example` and a pre-commit secret-detection hook are planned for Stage 4.

## Lab status

- [x] Stage 0 — Setup & "Hello, agentic"
- [x] Stage 1 — Product (Discovery → Define)
- [x] Stage 2 — App skeleton (specify → plan → implement)
- [x] Stage 3 — Tools & MCP
- [x] Stage 4 — QA & Security
- [x] Stage 5 — Persistent memory
- [x] Stage 6 — Orchestration & full chain
- [x] Stage 7 — Contribution & packaging
