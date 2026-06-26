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
- Secrets: never commit real values. Share config shape via `.env.example`; keep tokens out of `.mcp.json` (use env vars). The `.gitignore` is hardened for secrets, databases, logs, and runtime state. A base `.env.example` and a pre-commit secret-detection hook are planned for Stage 4.

## Lab status

- [x] Stage 0 — Setup & "Hello, agentic"
- [x] Stage 1 — Product (Discovery → Define)
- [x] Stage 2 — App skeleton (specify → plan → implement)
- [x] Stage 3 — Tools & MCP
- [ ] Stage 4 — QA & Security
- [ ] Stage 5 — Persistent memory
- [ ] Stage 6 — Orchestration & full chain
- [ ] Stage 7 — Contribution & packaging
