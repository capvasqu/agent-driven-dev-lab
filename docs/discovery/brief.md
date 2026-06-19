# Discovery Brief — Personal Task / Kanban Manager

> Status: **Approved** (2026-06-10). Open questions resolved — see **Decisions** below.
> This brief is the input to the Define (PRD) stage.

## Problem

Building software with Claude Code works best when there is a real, end-to-end product
to drive the workflow. This lab needs a product that is small enough to build fully, yet
rich enough to exercise every agentic capability (skills, commands, subagents, tools, MCP).

A personal task / Kanban manager fits: managing one's own work is a familiar problem with
clear states and rules, so effort stays on the **Agent-Driven Development practice** rather
than on inventing a complex domain. Why now: the lab is at Stage 1 and needs a concrete
product brief before any PRD, spec, or code can follow.

## Target users

- **Primary — the lab owner (single, local-first user).** A developer practicing ADD who
  needs to track their own tasks through a Kanban flow while building the tool itself.
  Needs: fast capture, clear status of each task, and rules consistent enough that agents
  can operate on the data reliably.
- **Secondary — the agents themselves.** Skills, subagents, and the future MCP server read
  and manipulate tasks. They need a small, predictable, well-specified data model.

## Goals

- Manage tasks following the `TASK-NNN` convention end-to-end.
- Move tasks through the Kanban flow `backlog → todo → in_progress → review → done`,
  enforcing legal transitions.
- Support the four priorities `low / medium / high / urgent` (default `medium`).
- Keep the data model small and unambiguous so agents and an MCP server can drive it.
- Be the working product that each lab stage extends.

## Non-goals

- No multi-user accounts, authentication, roles, or sharing.
- No cloud sync, hosting, or remote backend (local-first only).
- No team collaboration, comments, notifications, or real-time updates.
- No complex project management (epics, sprints, dependencies, Gantt, time tracking).
- No polished/visual UI commitment at this stage (interface decided later).

## Scope

**In scope**

- A single-user, local-first application (Node + TypeScript, SQLite persistence).
- Core task lifecycle: create, read, update, list, and move a task between states.
- Enforcement of task conventions: `TASK-NNN` IDs (immutable, sequential, never reused),
  valid state transitions (forward one step or back one step; `done` is terminal),
  and the priority set.
- Minimum task fields: `id`, `title`, `status`, `priority`, `createdAt` (UTC ISO 8601).

**Out of scope (for the brief)**

- Concrete API/CLI/UI surface, endpoints, and command names (decided in PRD/spec).
- Storage schema details and indexing strategy.
- Tooling and MCP server design (Stage 3) and security/QA work (Stage 4).

## Success signals

- The lab owner can capture a task and walk it through all five states without breaking
  the convention rules.
- Illegal moves (e.g. `backlog → done`, or editing a `done` task's state) are rejected.
- IDs are always well-formed `TASK-NNN`, sequential, and never reused.
- Agents/skills can act on a task with no ambiguity about its shape or allowed transitions.
- Each subsequent lab stage can build on the product without reworking the core model.

## Assumptions

- The product's purpose is primarily to be the **vehicle for the ADD lab**, so simplicity
  and clarity beat feature breadth.
- "Local-first / single-user" means no network, accounts, or concurrency concerns for now.
- The data model is authoritative as defined in the `task-conventions` skill; this brief
  does not change those rules.
- The data model uses the five minimum fields plus `description` and `updatedAt` (see
  Decisions); further fields (labels, due dates) are deferred.

## Decisions

Resolved by the lab owner at approval (2026-06-10):

1. **Primary interface** — a local **HTTP REST API** (Node + TypeScript, SQLite). This is
   the surface Stage 2 builds and Stage 3's MCP server will consume.
2. **Task fields** — the five minimum fields plus `description` (free text, optional) and
   `updatedAt` (UTC ISO 8601). `labels` and `due date` are deferred.
3. **Transition strictness** — keep the `task-conventions` rule exactly: advance or go
   back one step only; no skipping; `done` is terminal.
4. **Delete / archive** — tasks may be **archived** (hidden) but rows persist and IDs are
   never reused. No hard delete.
5. **Backlog ordering** — priority is sufficient for now; no manual per-column ranking.
