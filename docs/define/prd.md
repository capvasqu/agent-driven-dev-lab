# PRD — Personal Task / Kanban Manager (REST API)

> Status: **Approved** (2026-06-10). Open questions resolved — see **Resolved decisions** below.
> Builds on the approved Discovery Brief (`docs/discovery/brief.md`).
> This PRD is the input to Stage 2 (app skeleton: specify → plan → implement).

## Context

This PRD defines the first concrete product surface for the personal, single-user,
local-first task / Kanban manager described in the approved brief. Per the brief's
**Decisions**, the interface is a local **HTTP REST API** (Node + TypeScript, SQLite
persistence) that lets the lab owner — and, later, agents and the MCP server — create
tasks and walk them through the Kanban flow `backlog → todo → in_progress → review → done`
under the project's `task-conventions` rules. It reuses every approved decision (fields,
strict one-step transitions, archive-not-delete, priority-only ordering) and does not
re-derive scope.

## Goals

- **G1** — Expose a REST API covering the full single-task lifecycle: create, read, list,
  update, move status, and archive.
- **G2** — Enforce `task-conventions` exactly: `TASK-NNN` IDs (immutable, sequential, never
  reused), legal one-step transitions only, `done` terminal, four priorities.
- **G3** — Persist every task as a row that is never hard-deleted; archived tasks are hidden
  from default listings but remain retrievable by id.
- **G4** — Reject illegal transitions, malformed IDs, and invalid input with clear,
  predictable error responses (no silent failures, no data corruption).
- **G5** — Keep the resource shape small and unambiguous so Stage 3's MCP server can consume
  the same API with no model changes.

## User stories

- **US-1** — As the lab owner, I want to create a task with a title (and optional priority
  and description) so that it enters the board in `backlog` with a well-formed `TASK-NNN` id.
- **US-2** — As the lab owner, I want to list my active tasks (optionally filtered by status)
  so that I can see the current state of my board without archived noise.
- **US-3** — As the lab owner, I want to fetch a single task by id so that I can inspect its
  full current state, including archived tasks.
- **US-4** — As the lab owner, I want to edit a task's title, description, and priority so
  that I can correct or refine it without changing its status.
- **US-5** — As the lab owner, I want to move a task one step forward or back through the
  Kanban flow so that its status reflects reality while illegal jumps are prevented.
- **US-6** — As the lab owner, I want to archive a task so that it disappears from my active
  board while its row and id are preserved.
- **US-7** — As an agent / MCP server, I want a small, predictable resource shape and
  consistent error behavior so that I can drive the board reliably without ambiguity.

## Functional requirements

### Task resource shape

- **FR-1** — A task is represented as a JSON object with exactly these fields:

  | Field | Type | Notes |
  |-------|------|-------|
  | `id` | string | `TASK-NNN` (3 digits, leading zeros); immutable, sequential, never reused. |
  | `title` | string | Required, non-empty (after trimming). |
  | `description` | string \| null | Optional free text; `null` when absent. |
  | `status` | enum | One of `backlog`, `todo`, `in_progress`, `review`, `done`. Defaults to `backlog`. |
  | `priority` | enum | One of `low`, `medium`, `high`, `urgent`. Defaults to `medium`. |
  | `archived` | boolean | `false` by default; `true` once archived. |
  | `createdAt` | string | UTC timestamp, ISO 8601 (e.g. `2026-06-10T12:00:00Z`). |
  | `updatedAt` | string | UTC timestamp, ISO 8601; set on creation and refreshed on every mutation. |

- **FR-2** — `id` generation is server-side, sequential, and monotonic. The next id is
  derived from the highest id ever issued (not from the current row count), so archived
  rows never cause id reuse. Clients cannot set or change `id`.

### Endpoints

All endpoints accept and return `application/json`. Base path is the API root (e.g. `/`).

- **FR-3 — Create a task.** `POST /tasks` — creates a task. Request body accepts `title`
  (required), `priority` (optional, default `medium`), and `description` (optional).
  `status` is always set to `backlog`; `id`, `createdAt`, `updatedAt`, `archived` are
  server-assigned. Responds `201 Created` with the full task resource.

- **FR-4 — List tasks.** `GET /tasks` — returns an array of tasks. By default it **excludes
  archived tasks**. Supports an optional `status` query parameter
  (`GET /tasks?status=todo`) to filter to a single valid state. An optional
  `archived=true` query parameter includes archived tasks (and `archived=false` is the
  default behavior). Results are ordered by priority (`urgent` → `high` → `medium` → `low`),
  then by `createdAt` ascending as a stable tiebreaker. No manual per-column ranking.

- **FR-5 — Get a task by id.** `GET /tasks/{id}` — returns the full task resource for the
  given `TASK-NNN` id, **including** archived tasks. Responds `404 Not Found` if no task has
  that id.

- **FR-6 — Update a task (content).** `PATCH /tasks/{id}` — updates any of `title`,
  `description`, and `priority`. This endpoint **must not** change `status` or `archived`
  (status changes go through FR-7). Refreshes `updatedAt`. Responds `200 OK` with the
  updated resource.

- **FR-7 — Move a task's status.** `POST /tasks/{id}/status` — changes the task's status,
  enforcing one-step transitions. Request body is `{ "direction": "forward" | "backward" }`;
  the server computes the adjacent state (explicit-`status` payloads are not accepted — see
  Resolved decisions). Legal moves: advance exactly one step along
  `backlog → todo → in_progress → review → done`, or go back exactly one step. `done` is
  terminal (no forward move; backward to `review` is allowed). Refreshes `updatedAt`.
  Responds `200 OK` with the updated resource.

- **FR-8 — Archive a task.** `POST /tasks/{id}/archive` — sets `archived = true`. The row
  and its id persist; there is **no hard delete**. Refreshes `updatedAt`. Responds `200 OK`
  with the updated resource. Archiving is idempotent (archiving an already-archived task
  succeeds and leaves it archived).

### Validation and error behavior

- **FR-9 — Malformed / unknown id.** A path id that does not match the `TASK-NNN` pattern is
  rejected with `400 Bad Request`. A well-formed id with no matching row is `404 Not Found`.

- **FR-10 — Invalid input on create/update.** Missing or empty `title` on create, an unknown
  `priority`, or an unknown `status` filter value is rejected with `400 Bad Request` and an
  error body. Request bodies that contain unknown/extra fields, or that try to set
  server-owned fields (`id`, `status` via `PATCH`, `createdAt`, `updatedAt`, `archived`), are
  **rejected with `400 Bad Request`** (strict; not silently ignored).

- **FR-11 — Illegal status transition.** A move that skips a state (e.g. `backlog → done`),
  moves more than one step, or advances out of `done` is rejected with `409 Conflict`
  (illegal transition) and leaves the task unchanged.

- **FR-12 — Error response shape.** All `4xx` responses return a JSON body with a stable
  shape, e.g. `{ "error": { "code": "...", "message": "..." } }`, so agents can branch on
  `code` programmatically.

## Acceptance criteria

- **AC-1 (US-1, FR-3)** — `POST /tasks` with `{ "title": "Write PRD" }` returns `201` and a
  body whose `id` matches `^TASK-\d{3}$`, `status` is `backlog`, `priority` is `medium`,
  `archived` is `false`, and `createdAt` equals `updatedAt` as valid UTC ISO 8601 strings.
- **AC-2 (FR-2)** — After creating, archiving, and creating again, the second new task's id
  is strictly greater than the archived one's id; no id is ever reused.
- **AC-3 (US-2, FR-4)** — `GET /tasks` does not include any task whose `archived` is `true`.
- **AC-4 (US-2, FR-4)** — `GET /tasks?status=todo` returns only tasks whose `status` is
  `todo`, and never archived tasks unless `archived=true` is also supplied.
- **AC-5 (US-2, FR-4)** — Listed tasks are ordered `urgent`, `high`, `medium`, `low`, with
  equal priorities ordered by `createdAt` ascending.
- **AC-6 (US-3, FR-5)** — `GET /tasks/{id}` returns a previously archived task by its id with
  `archived: true`.
- **AC-7 (US-4, FR-6)** — `PATCH /tasks/{id}` updating `title`/`description`/`priority`
  returns `200` with the new values, an unchanged `status`, and a refreshed `updatedAt`
  (later than the previous `updatedAt`).
- **AC-8 (US-5, FR-7)** — Moving a `backlog` task forward yields `todo`; moving it forward
  again yields `in_progress`; moving back yields `todo`.
- **AC-9 (US-5, FR-11 — illegal transition)** — Requesting `backlog → done` (or any
  multi-step jump) returns `409 Conflict`, and a subsequent `GET` shows the task still in its
  original status.
- **AC-10 (US-5, FR-11 — terminal `done`)** — A task in `done` rejects any forward move with
  `409`, while a single backward move to `review` succeeds with `200`.
- **AC-11 (US-6, FR-8)** — After `POST /tasks/{id}/archive`, the task is absent from
  `GET /tasks` but present (with `archived: true`) in `GET /tasks/{id}`; archiving it again
  still returns `200`.
- **AC-12 (FR-9 — malformed id)** — `GET /tasks/banana` (or `GET /tasks/TASK-1`) returns
  `400 Bad Request`; `GET /tasks/TASK-999` for a non-existent row returns `404 Not Found`.
- **AC-13 (FR-10 — invalid input)** — `POST /tasks` with an empty/missing `title` or an
  unknown `priority` returns `400 Bad Request` with an error body and creates no row.
- **AC-14 (FR-6 — no status via PATCH)** — `PATCH /tasks/{id}` carrying a `status` field is
  rejected with `400 Bad Request` per FR-10 and does not change the task's status.
- **AC-15 (US-7, FR-12)** — Every `4xx` response carries a JSON body with an `error.code`
  string that distinguishes the failure class (validation vs. not-found vs. illegal
  transition).

## Out of scope

Mirrors the brief's non-goals; explicitly excluded from this PRD and Stage 2:

- No authentication, accounts, roles, sharing, or multi-user support.
- No cloud sync, hosting, or remote backend — local-first only.
- No collaboration features: comments, notifications, real-time updates.
- No complex project management: epics, sprints, dependencies, Gantt, time tracking.
- No graphical or web UI; the deliverable is the REST API only.
- No `labels` and no `due date` fields (deferred per brief Decision 2).
- No manual per-column / per-task ordering (priority-only, per brief Decision 5).
- No hard delete of tasks (archive only, per brief Decision 4).
- MCP server design (Stage 3) and security/QA hardening (Stage 4) are out of scope here.

## Assumptions

- **A1** — The API serves a single local user with no concurrency concerns; no locking,
  pagination-for-scale, or rate limiting is required at this stage.
- **A2** — All timestamps are generated server-side in UTC ISO 8601; clients never supply
  them.
- **A3** — SQLite holds one `tasks` table whose columns map 1:1 to the FR-1 resource shape;
  archived rows stay in the same table with `archived = true` (no separate archive store).
- **A4** — The task volume is small (personal use), so returning the full list without
  pagination is acceptable for now.
- **A5** — `description` is stored and returned verbatim (no Markdown rendering or
  sanitization beyond basic type/length validation).

## Resolved decisions

Resolved by the lab owner at approval (2026-06-10):

- **Q1 — Status-move contract.** `POST /tasks/{id}/status` accepts **only**
  `{ "direction": "forward" | "backward" }`. Explicit-`status` payloads are not supported;
  the server derives the adjacent state, which makes illegal jumps impossible by
  construction (see FR-7).
- **Q2 — Unknown/extra fields.** Request bodies with unknown or server-owned fields are
  **rejected with `400`** (strict), not silently ignored (see FR-10).
- **Q3 — Pagination.** Deferred. `GET /tasks` returns the full list; `limit`/`offset` will
  be added only if the board grows (per assumption A4).
- **Q4 — Endpoint naming.** Confirmed: `POST /tasks/{id}/status` and
  `POST /tasks/{id}/archive` as explicit action sub-resources (clean to map to MCP tools in
  Stage 3).
