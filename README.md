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
