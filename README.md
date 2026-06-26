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
| 5 | Persistent memory | State across sessions, `/memory` handoff |
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

## Persistent memory (Stage 5)

A local, runnable replica of a `session.json` handoff pattern so a session can be closed
and a fresh one can pick up the context. Driven by a single command:

```
/memory init [name]     # seed a new memory from the current stage + git state
/memory status [name]    # show stage, last update, open threads, next steps
/memory save [name]      # refresh the memory before closing the session
/memory resume [name]    # reconstruct the working context in a new session
```

Each memory is a directory `context/memories/<name>/` with three files:

- `session.json` — structured state (stage, git branch/last commit, open threads, next steps,
  decisions, timestamps).
- `memory.md` — durable human-readable notes: decisions and learnings that persist.
- `handoff.md` — the resume narrative: where we are / what's next / how to pick up.

`context/memories/active` records the active memory name (used when no name is given). The
`context/memories/` tree is **gitignored** runtime state; only `context/memories/example/`
is committed as a sanitized reference showing the shape.

**Checkpoint.** Run `/memory init`, do some work, `/memory save`, then close and reopen the
session and run `/memory resume` — it restores the stage, open threads, and next steps.

## Orchestration (Stage 6)

`/feature` chains the whole build pipeline for a new feature — `specify → plan → implement → qa`
— in an isolated git worktree, **stopping for human approval at every phase**. The main thread
acts as the coordinator and reuses the existing workers (`implementer`, `qa-engineer`); only the
main thread can pause for a human, which keeps "agents propose, humans decide" intact inside the
chain.

```
/feature <slug> "<feature description>"
```

What it does, phase by phase (each ends in a gate you must approve):

1. **Scope & setup** — restate the idea as a brief; on approval, `git worktree add ../add-lab-feat-<slug> -b feat/<slug>` and `npm install` there.
2. **Specify** — `implementer` writes `docs/features/<slug>/spec.md` in the worktree.
3. **Plan** — `implementer` writes `docs/features/<slug>/plan.md` (`TASK-NNN` items).
4. **Implement** — `implementer` writes code into the worktree's `src/`; `npm run build`.
5. **QA** — `qa-engineer` writes tests into the worktree's `test/`; `npm test` until green.
6. **Land** — it prints the merge/cleanup commands; it never auto-merges or auto-pushes.

Per-feature artifacts live under `docs/features/<slug>/`, separate from the whole-app baseline
(`docs/specify/spec.md`, `docs/plan/plan.md`). The feature is built on a `feat/<slug>` branch in
a worktree, so `main` stays untouched until you merge.

**Checkpoint.** `/feature tasks-priority-filter "Add an optional ?priority= filter to GET /tasks"`
takes the idea to tested code: `npm test` green in the worktree, then
`curl "http://localhost:3000/tasks?priority=high"` returns only high-priority tasks.
