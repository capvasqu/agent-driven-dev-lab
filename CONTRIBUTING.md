# Contributing

This is a personal learning lab for **Agent-Driven Development (ADD)** with Claude Code. It
builds a task/Kanban app and, alongside it, the agentic capabilities that drive it. These notes
capture how the repo is built so a change stays consistent with it.

## Philosophy

> **"Agents propose, humans decide."**

Every capability is produced through a chain of artifacts (brief → PRD → spec → plan → code →
tests), and a human reviews and approves each one **before** the next begins. Automated agents
draft; they never decide scope or self-merge.

## Conventions

- **Language:** everything in the repo (docs, code, commands, skills, agents, commit messages)
  is written in **English**.
- **Task IDs:** `TASK-NNN` (see the `task-conventions` skill).
- **Where things live:** app code in `src/`; product/build artifacts in `docs/` (per-feature
  artifacts in `docs/features/<slug>/`); capabilities in `.claude/` (`commands/`, `agents/`,
  `skills/`); the distributable plugin in `plugins/agent-driven-dev/`.
- **Secrets:** never commit real values. Share config shape via `.env.example`; keep tokens out
  of `.mcp.json` (use env vars). Enable the pre-commit secret hook once per clone:
  `git config core.hooksPath .githooks`.

## Adding a capability

Pick the right building block:

- **Skill** (`.claude/skills/<name>/SKILL.md`) — knowledge/conventions Claude auto-activates by
  context. Use for "how this project does X".
- **Command** (`.claude/commands/<name>.md`) — a `/name` action the human invokes. Use for a
  repeatable step in the workflow.
- **Agent** (`.claude/agents/<name>.md`) — a subagent that works in isolated context and
  proposes an artifact. Use for a focused role (analyst, implementer, QA).

If the capability is reusable outside this repo, also ship it in the plugin (see Packaging) —
the copy under `plugins/agent-driven-dev/` must byte-match the `.claude/` source; `npm run
validate` enforces this. Lab-only commands (e.g. `/hello`) stay out of the plugin and are listed
in the `EXCLUDED` set in `scripts/validate.mjs`.

## Packaging (the plugin)

The reusable toolkit is distributed as a Claude Code plugin served from a marketplace in this
repo:

- `.claude-plugin/marketplace.json` — the marketplace catalog.
- `plugins/agent-driven-dev/` — the plugin: `.claude-plugin/plugin.json` plus `commands/`,
  `agents/`, `skills/`.

Install it in another project:

```
/plugin marketplace add capvasqu/agent-driven-dev-lab
/plugin install agent-driven-dev@agent-driven-dev-lab
```

## Local gate (run before every PR)

```bash
npm run validate   # plugin schema (claude plugin validate --strict) + parity + marketplace
npm test           # vitest: domain + HTTP (AC-1..AC-15) + MCP tools + feature tests
```

Both must pass. `npm run validate` needs the `claude` CLI on PATH; if it is absent, the native
check is skipped and the parity/marketplace checks still run.

## Pull request flow

1. Branch from `main`: `git checkout -b feat/<slug>`.
2. Make the change; keep commits focused, messages in English.
3. Run the local gate (`npm run validate` && `npm test`) and the pre-push secret routine
   (review staged content; confirm no secrets, DBs, or runtime state are staged).
4. Push and open a PR: `gh pr create` (or via GitHub). Describe what and why.
5. A human reviews and merges — **do not self-merge**. Delete the branch after merge.

Note: earlier stages committed directly to `main` while bootstrapping; from Stage 7 on, changes
go through a PR.
