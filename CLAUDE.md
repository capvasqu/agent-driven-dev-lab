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

- Backend: Node + TypeScript (defined in Stage 2)
- Persistence: SQLite
- MCP: `@modelcontextprotocol/sdk` (Stage 3)

## Project conventions

- Task IDs follow the `TASK-NNN` format (see the `task-conventions` skill).
- Product artifacts live in `docs/` (`docs/discovery/`, `docs/define/`).
- Application code lives in `src/`.

## Lab status

- [x] Stage 0 — Setup & "Hello, agentic"
- [ ] Stage 1 — Product (Discovery → Define)
- [ ] Stage 2 — App skeleton (specify → plan → implement)
- [ ] Stage 3 — Tools & MCP
- [ ] Stage 4 — QA & Security
- [ ] Stage 5 — Persistent memory
- [ ] Stage 6 — Orchestration & full chain
- [ ] Stage 7 — Contribution & packaging
