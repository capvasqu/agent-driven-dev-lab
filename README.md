# agent-driven-dev-lab

A personal lab for practicing **Agent-Driven Development** with Claude Code,
building a task / Kanban manager (Node + TypeScript) end-to-end.

## How to use this lab

Open Claude Code **inside this folder** (`agent-driven-dev-lab`). Claude Code will
automatically load:

- `CLAUDE.md` → project memory/state
- `.claude/commands/*.md` → slash commands (e.g. `/hello`)
- `.claude/skills/*/SKILL.md` → skills that activate on their own when relevant

## Stages

| # | Stage | What you learn |
|---|-------|----------------|
| 0 | Setup & "Hello, agentic" | Claude Code building blocks: skill, command, memory |
| 1 | Product (Discovery → Define) | "Agents propose, humans decide", context reuse |
| 2 | App skeleton | Spec-driven dev, plan mode, skills → implementation |
| 3 | Tools & MCP | Your own MCP server, tool vs skill, dogfooding |
| 4 | QA & Security | Parallel subagents, review passes |
| 5 | Persistent memory | State across sessions, handoff |
| 6 | Orchestration | Coordinator-worker, git worktrees, full chain |
| 7 | Contribution | Skill packaging, validation, PR |

## Verifying Stage 0

1. Open Claude Code in this folder.
2. Type `/hello` → it should show the lab status and the next stage.
3. Type: *"Create a sample task to test the format"* → the `task-conventions`
   skill should activate on its own and use the `TASK-NNN` format.

## Running the app (Stage 2)

The Stage 2 deliverable is an HTTP REST API over SQLite for the task / Kanban manager.

**Requirements:** Node.js ≥ 20.

```bash
npm install      # install dependencies (Fastify, better-sqlite3, …)
npm run dev      # start the API on http://127.0.0.1:3000 (tsx watch)
# or, production-style:
npm run build && npm start
```

The SQLite database is created on first run at `./data/tasks.db` (gitignored).
Configuration is read from the environment with safe defaults: `PORT` (3000),
`HOST` (127.0.0.1), `DB_PATH` (`./data/tasks.db`).

**Quick smoke test** with `curl`:

```bash
# Create a task → 201 with a TASK-NNN id, status "backlog"
curl -s -X POST http://127.0.0.1:3000/tasks \
  -H 'content-type: application/json' \
  -d '{"title":"Write the PRD","priority":"high"}'

# List active tasks (archived excluded by default)
curl -s http://127.0.0.1:3000/tasks

# Move a task one step forward through the Kanban flow
curl -s -X POST http://127.0.0.1:3000/tasks/TASK-001/status \
  -H 'content-type: application/json' -d '{"direction":"forward"}'

# Archive a task (soft — the row and id persist)
curl -s -X POST http://127.0.0.1:3000/tasks/TASK-001/archive
```

Endpoints: `POST /tasks`, `GET /tasks` (`?status=`, `?archived=true`),
`GET /tasks/{id}`, `PATCH /tasks/{id}`, `POST /tasks/{id}/status`,
`POST /tasks/{id}/archive`. See `docs/define/prd.md` and `docs/specify/spec.md`
for the full contract.

## MCP server (Stage 3)

`task-mcp` exposes the same task operations as **MCP tools**, so Claude can manage
the backlog directly (dogfooding). It reuses the very same `TaskRepository` +
SQLite as the REST API — HTTP and MCP are two thin adapters over one core, so a
change made through a tool is the same row the API sees.

The server is declared in [`.mcp.json`](.mcp.json) and runs over stdio:

```jsonc
// .mcp.json
{ "mcpServers": { "task-mcp": { "command": "npx", "args": ["tsx", "src/mcp/index.ts"] } } }
```

**Tools:** `create_task`, `list_tasks`, `get_task`, `update_status`, `archive_task`.

To use it, open Claude Code in this folder and approve the `task-mcp` server when
prompted (it loads from `.mcp.json` at startup). Then ask Claude to create, list,
move, or archive tasks — the changes land in `./data/tasks.db`. You can also run
the server standalone with `npm run mcp`.

## Testing & security (Stage 4)

```bash
npm test     # vitest: domain unit tests + HTTP integration (AC-1..AC-15) + MCP tools
```

Tests use an in-memory SQLite (`:memory:`) and Fastify's `app.inject()` (no port
binding), so they never touch `./data/tasks.db`. HTTP tests are mapped one-to-one to
the PRD acceptance criteria; the MCP tools are exercised over an in-memory transport.

**Secret-detection pre-commit hook.** A dependency-free hook scans staged changes for
secret-like patterns and blocks the commit if it finds one. Enable it once per clone:

```bash
git config core.hooksPath .githooks
```

Patterns live in `.githooks/secret-patterns.txt`; `.env.example` and the patterns file
are excluded from the scan. Bypass intentionally (rare) with `git commit --no-verify`.
Copy `.env.example` to `.env` (gitignored) to configure the app — never commit real secrets.
