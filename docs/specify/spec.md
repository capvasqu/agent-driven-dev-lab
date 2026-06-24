# Technical Specification — Personal Task / Kanban Manager (REST API)

> Status: **Approved** (2026-06-24). Open questions resolved — see §9 Resolved decisions.
> This spec is the input to `/plan`.
> Builds on the approved PRD (`docs/define/prd.md`, approved 2026-06-10) and honors the
> `task-conventions`, `rest-api-conventions`, and `sqlite-repository` skills. It reuses the
> PRD's FR-1..FR-12, AC-1..AC-15, and Resolved decisions verbatim — it does not re-derive or
> expand scope.
> This spec covers Stage 2 (app skeleton). Tests are written in Stage 4; the MCP server is
> Stage 3. Both are out of scope here.

## 1. Stack & libraries

Concrete, recommended baseline. Items marked **(needs confirmation)** are the genuine
decisions for the human at the approval gate.

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Runtime | **Node.js ≥ 20 LTS** | Stable, native `fetch`/`crypto`, broad ecosystem. CLAUDE.md mandates Node + TypeScript. |
| Language | **TypeScript ≥ 5.x** (strict mode on) | Mandated by CLAUDE.md; strict typing matches the small, unambiguous resource shape (G5). |
| HTTP framework | **Fastify ≥ 4.x** (confirmed 2026-06-24) | First-class TypeScript support and built-in JSON-Schema validation that maps cleanly onto the PRD's strict-input rule (FR-10, Q2). Express + a separate validator was considered and declined. Fastify keeps validation declarative and co-located with each route. |
| SQLite driver | **`better-sqlite3` ≥ 11.x** | Synchronous, simple API; ideal for a single local user (A1). Endorsed by the `sqlite-repository` skill's parameterized-query model. Alternative: `node:sqlite` (still experimental on Node 20/22) — deferred. |
| Dev runner | **`tsx`** | Run TypeScript directly without a separate build step during development. |
| Build | **`tsc`** | Emit `dist/` for a production-style `node dist/index.js` run. |
| Tests | **`vitest`** | Configured now; **test files are written in Stage 4**, not here. |
| Lint/format | **(open)** ESLint + Prettier | Optional; not required for Stage 2. Flagged as open. |

Notes:
- No ORM. Per the `sqlite-repository` skill, raw parameterized SQL lives behind a repository
  module; an ORM would add indirection the small schema does not need.
- No auth/session/cors middleware — out of scope (PRD "Out of scope", A1).

## 2. Project structure

Application code lives under `src/` (CLAUDE.md). Proposed layout:

```
agent-driven-dev-lab/
├── src/
│   ├── index.ts                  # Entry point: load config, build server, listen.
│   ├── server.ts                 # buildServer(): create Fastify instance, register
│   │                             #   plugins, routes, and the error handler. Exported so
│   │                             #   Stage 4 tests can build the app without listening.
│   ├── config.ts                 # Reads PORT, HOST, DB_PATH from env with safe defaults.
│   ├── db/
│   │   ├── connection.ts         # Opens the better-sqlite3 database (singleton).
│   │   └── schema.ts             # createSchema(db): idempotent DDL run on startup.
│   ├── domain/
│   │   ├── types.ts              # Task interface, Status/Priority unions, DTOs.
│   │   └── transitions.ts        # Kanban order array + nextState()/prevState() helpers.
│   ├── repository/
│   │   └── taskRepository.ts     # All SQL: create, getById, list, update, setStatus,
│   │                             #   archive, plus next-id derivation. Returns domain
│   │                             #   objects (maps rows ↔ Task).
│   ├── routes/
│   │   └── tasks.ts              # Fastify route registrations for /tasks and sub-resources,
│   │                             #   with JSON-Schema bodies/params/querystrings.
│   ├── errors.ts                 # ApiError class + error codes + error-envelope serializer.
│   └── validation/
│       └── schemas.ts            # JSON Schemas (create/patch bodies, id param, list query).
├── data/                         # SQLite file lives here (gitignored).
│   └── tasks.db                  # Created at runtime; never committed.
├── dist/                         # tsc output (gitignored).
├── package.json
├── tsconfig.json
└── vitest.config.ts              # Present for Stage 4; no tests yet.
```

**Where the SQLite file lives.** Default `DB_PATH = ./data/tasks.db`. The `data/` directory
and `*.db` files are already covered by the hardened `.gitignore` (CLAUDE.md). The DB file is
created on first run if absent.

**Scripts (package.json).**
- `dev` → `tsx watch src/index.ts`
- `build` → `tsc -p tsconfig.json`
- `start` → `node dist/index.js`
- `test` → `vitest run` (no-op until Stage 4)

## 3. SQLite schema

One `tasks` table whose columns map 1:1 to the FR-1 resource (per `sqlite-repository`).
`archived` is stored as integer `0`/`1`; everything else is text. Timestamps are ISO 8601
UTC strings (not SQLite datetime), generated server-side.

```sql
CREATE TABLE IF NOT EXISTS tasks (
  id          TEXT    PRIMARY KEY,                      -- 'TASK-NNN'
  title       TEXT    NOT NULL,
  description TEXT,                                       -- nullable; NULL when absent
  status      TEXT    NOT NULL DEFAULT 'backlog'
              CHECK (status IN ('backlog','todo','in_progress','review','done')),
  priority    TEXT    NOT NULL DEFAULT 'medium'
              CHECK (priority IN ('low','medium','high','urgent')),
  archived    INTEGER NOT NULL DEFAULT 0
              CHECK (archived IN (0,1)),
  createdAt   TEXT    NOT NULL,                           -- ISO 8601 UTC
  updatedAt   TEXT    NOT NULL                            -- ISO 8601 UTC
);

-- Supports the default list ordering (priority rank, then createdAt).
CREATE INDEX IF NOT EXISTS idx_tasks_archived_status ON tasks (archived, status);
```

**Creation / migration on startup.** `createSchema(db)` runs the `CREATE TABLE IF NOT EXISTS`
and `CREATE INDEX IF NOT EXISTS` statements every time the server boots. This is idempotent
and sufficient for Stage 2 (single table, single user, A1/A3). PRAGMAs set on connection:
`journal_mode = WAL` and `foreign_keys = ON` (the latter is harmless here; WAL is a sensible
local default). No versioned migration framework is introduced at this stage — flagged as an
open question for when the schema first changes.

**Row ↔ domain mapping.** The repository converts the integer `archived` to a JSON boolean and
leaves `description` as `null` when the column is `NULL`. The CHECK constraints are a
defense-in-depth backstop; primary validation happens at the HTTP layer (Section 6).

## 4. Endpoints

All endpoints consume and produce `application/json`. Base path is the API root. Behavior
below is taken directly from FR-3..FR-8 and the matching acceptance criteria.

### 4.1 `POST /tasks` — create (FR-3, AC-1, AC-13)

- **Request body** (strict, `additionalProperties: false`):
  - `title` — string, **required**, non-empty after trim.
  - `priority` — string enum `low|medium|high|urgent`, optional (default `medium`).
  - `description` — string, optional (stored as given; absent → stored `null`).
- **Server-assigned, rejected if present in body:** `id`, `status`, `archived`, `createdAt`,
  `updatedAt` (any of these → 400, see Section 6). `status` is always `backlog` on create.
- **Success:** `201 Created` with the full task resource (8 fields). `createdAt === updatedAt`.
- **Errors:** missing/empty `title` → `400 VALIDATION_ERROR`; unknown `priority` → `400
  VALIDATION_ERROR`; unknown/server-owned field present → `400 VALIDATION_ERROR`. No row is
  created on any 400.

### 4.2 `GET /tasks` — list (FR-4, AC-3, AC-4, AC-5)

- **Query params** (strict):
  - `status` — optional; one of the five valid states. Unknown value → `400 VALIDATION_ERROR`.
  - `archived` — optional; `true` | `false` (string). Default `false`.
  - Any other query key → `400 VALIDATION_ERROR`.
- **Behavior:** returns a JSON array of tasks. Excludes archived rows unless `archived=true`.
  When `status` is given, filters to that state. Ordered by priority rank
  `urgent > high > medium > low`, then `createdAt` ascending as a stable tiebreaker
  (implemented with a `CASE` expression on `priority`; no manual per-row ranking).
- **Success:** `200 OK` with the array (possibly empty).

### 4.3 `GET /tasks/{id}` — read one (FR-5, AC-6, AC-12)

- **Path param:** `id` must match `^TASK-\d{3}$`. Malformed → `400 VALIDATION_ERROR`.
- **Behavior:** returns the task by id, **including** archived tasks.
- **Success:** `200 OK` with the full resource.
- **Errors:** well-formed id, no row → `404 NOT_FOUND`.

### 4.4 `PATCH /tasks/{id}` — update content (FR-6, AC-7, AC-14)

- **Path param:** `id` matches `^TASK-\d{3}$`; else `400 VALIDATION_ERROR`.
- **Request body** (strict, `additionalProperties: false`, at least one field present):
  - `title` — string, non-empty after trim (when present).
  - `description` — string **or** `null` (when present; `null` clears it).
  - `priority` — enum `low|medium|high|urgent` (when present).
- **Forbidden in body (→ 400):** `status`, `archived`, `id`, `createdAt`, `updatedAt` and any
  unknown field. This is the FR-6 / AC-14 guarantee that PATCH never changes status.
- **Behavior:** updates only the provided fields, refreshes `updatedAt` to now.
- **Success:** `200 OK` with the updated resource; `status` unchanged, `updatedAt` strictly
  later than before.
- **Errors:** no row → `404 NOT_FOUND`; validation failures → `400 VALIDATION_ERROR`. An empty
  body `{}` → `400 VALIDATION_ERROR` (nothing to update).

### 4.5 `POST /tasks/{id}/status` — move status (FR-7, Q1, AC-8, AC-9, AC-10)

- **Path param:** `id` matches `^TASK-\d{3}$`; else `400 VALIDATION_ERROR`.
- **Request body** (strict): `{ "direction": "forward" | "backward" }`. `direction` required;
  any other value or extra field → `400 VALIDATION_ERROR`. Explicit-`status` payloads are not
  accepted (Q1).
- **Behavior:** server computes the adjacent state from current status + direction
  (Section 7). Refreshes `updatedAt`.
- **Success:** `200 OK` with the updated resource.
- **Errors:** no row → `404 NOT_FOUND`; illegal move (forward out of `done`, backward out of
  `backlog`) → `409 ILLEGAL_TRANSITION`, task unchanged.

### 4.6 `POST /tasks/{id}/archive` — archive (FR-8, AC-11)

- **Path param:** `id` matches `^TASK-\d{3}$`; else `400 VALIDATION_ERROR`.
- **Request body:** none expected. A non-empty body with unknown fields → `400
  VALIDATION_ERROR`; an empty/absent body is accepted.
- **Behavior:** sets `archived = 1`, refreshes `updatedAt`. **Idempotent** — archiving an
  already-archived task succeeds and leaves it archived.
- **Success:** `200 OK` with the updated resource (`archived: true`).
- **Errors:** no row → `404 NOT_FOUND`.

### 4.7 Endpoint summary

| Method | Path | Success | Primary errors |
|--------|------|---------|----------------|
| POST | `/tasks` | 201 | 400 |
| GET | `/tasks` | 200 | 400 (bad query) |
| GET | `/tasks/{id}` | 200 | 400 (bad id), 404 |
| PATCH | `/tasks/{id}` | 200 | 400, 404 |
| POST | `/tasks/{id}/status` | 200 | 400, 404, 409 |
| POST | `/tasks/{id}/archive` | 200 | 400, 404 |

## 5. Validation & errors

### 5.1 Error envelope (FR-12, AC-15)

Every `4xx` response body has the stable shape from `rest-api-conventions`:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "title is required" } }
```

`message` is a short human-readable string; clients branch on `code` only.

### 5.2 Error codes

| `code` | HTTP | Failure class |
|--------|------|---------------|
| `VALIDATION_ERROR` | 400 | Missing/empty required field; unknown enum value (`priority`, `status` filter, `direction`); malformed `id`; body with unknown or server-owned field; empty PATCH body; bad query key. |
| `NOT_FOUND` | 404 | Well-formed `TASK-NNN` id with no matching row. |
| `ILLEGAL_TRANSITION` | 409 | Status move that skips, jumps multiple steps, or leaves a terminal/boundary state illegally. |

A single `VALIDATION_ERROR` code covers all malformed-input classes (FR-9/FR-10) per the
skill's "stable, distinct code per failure class"; `message` carries the specifics. Ordering of
checks per request: **id format → body/query schema (strict) → existence (404) → transition
legality (409)**, so a malformed id never reaches a 404, and a non-existent id never reaches a
409.

### 5.3 Strict unknown / server-owned-field rejection (FR-10, Q2)

- All request-body and querystring schemas set `additionalProperties: false` (bodies) /
  reject unknown keys (query), so any unknown field is a `400` — never silently dropped.
- Server-owned fields (`id`, `createdAt`, `updatedAt`, `archived`, and `status` on `PATCH`)
  are **not declared** in the writable schemas; sending them triggers the
  `additionalProperties: false` rejection → `400 VALIDATION_ERROR`.
- Fastify's schema-validation failures are caught by a custom error handler that re-shapes
  them into the error envelope (so clients never see Fastify's default validation body).

## 6. ID & timestamp generation (FR-2, AC-2)

### 6.1 IDs

- Format `TASK-NNN` (3 digits, leading zeros) — `task-conventions`.
- Generated **server-side** in the repository from the **highest id ever issued**, not the row
  count, so archived rows never cause reuse (FR-2, AC-2). Implementation:
  `SELECT MAX(CAST(SUBSTR(id, 6) AS INTEGER)) AS maxNum FROM tasks;` → next number =
  `(maxNum ?? 0) + 1`, formatted as `TASK-` + zero-padded 3-digit string.
- Because rows are never hard-deleted (archive only), `MAX` over the live table is equal to the
  highest id ever issued. Clients cannot set or change `id`.
- **Width note:** `NNN` is 3 digits per the convention. Beyond `TASK-999` the number simply
  grows to 4+ digits (`TASK-1000`); the `^TASK-\d{3}$` route validator is therefore relaxed to
  `^TASK-\d{3,}$` for path matching while creation always zero-pads to at least 3 digits. Flagged
  as an open question (Section 8, Q-B) — for personal-scale use (A4) this boundary is unlikely
  to be hit, but the validator should not silently 400 a legitimately issued id.

### 6.2 Timestamps

- `createdAt` and `updatedAt` are UTC ISO 8601 strings (e.g. `2026-06-10T12:00:00.000Z`),
  generated with `new Date().toISOString()` server-side (A2).
- On create, `createdAt === updatedAt` (AC-1).
- Every mutation (`PATCH`, `status`, `archive`) refreshes `updatedAt` to the current instant
  (AC-7). To guarantee `updatedAt` is strictly greater than the previous value even within the
  same millisecond, the repository reads the new timestamp and, if it is not strictly greater
  than the stored `updatedAt`, bumps it by 1 ms before writing. Flagged as a minor open
  question (Section 8, Q-C).

## 7. State-transition enforcement (FR-7, FR-11)

### 7.1 Order and helpers

`domain/transitions.ts` defines the canonical order:

```
const ORDER = ['backlog', 'todo', 'in_progress', 'review', 'done'] as const;
```

- `forward`: target = element at `index + 1`. If current is `done` (last) → no target → illegal.
- `backward`: target = element at `index - 1`. If current is `backlog` (first) → no target → illegal.

### 7.2 Legal-move table

| From | `forward` → | `backward` → |
|------|-------------|--------------|
| `backlog` | `todo` | — (409) |
| `todo` | `in_progress` | `backlog` |
| `in_progress` | `review` | `todo` |
| `review` | `done` | `in_progress` |
| `done` | — (409) | `review` |

This makes multi-step jumps (e.g. `backlog → done`) impossible by construction (Q1): the only
inputs are `forward`/`backward`, each advancing exactly one step. The only illegal moves are
the two boundary cases above.

### 7.3 409 behavior

When the requested direction has no adjacent state, the handler returns
`409 ILLEGAL_TRANSITION` and performs **no write** — the task's status and `updatedAt` are left
unchanged (AC-9, AC-10). The repository's status-update is only called after the target state
is computed successfully.

## 8. Assumptions

- **SA-1** — Inherits all PRD assumptions A1–A5 (single local user, no concurrency, server-side
  UTC timestamps, one `tasks` table mapping 1:1 to FR-1, no pagination, verbatim `description`).
- **SA-2** — `better-sqlite3`'s synchronous API is acceptable given A1 (single user, no
  concurrency); no async pooling is needed.
- **SA-3** — Startup `CREATE TABLE IF NOT EXISTS` is sufficient "migration" for Stage 2; a real
  migration tool is deferred until the schema first changes.
- **SA-4** — `data/tasks.db` and `dist/` are already gitignored by the hardened `.gitignore`
  (CLAUDE.md); no new ignore rules are required, but this should be verified at implement time.
- **SA-5** — Tests (`vitest`) and lint config are scaffolded but **not written** in Stage 2;
  test authoring is Stage 4.
- **SA-6** — Configuration (`PORT`, `HOST`, `DB_PATH`) is read from environment variables with
  safe local defaults; the `.env.example` base file is a Stage 4 item (CLAUDE.md).

## 9. Resolved decisions

Resolved by the lab owner at approval (2026-06-24):

- **Q-A (framework).** **Fastify** confirmed as the HTTP framework. Express + Zod/Ajv declined.
- **Q-B (id width).** Confirmed: relaxed path validator `^TASK-\d{3,}$` (accept ≥3 digits);
  new ids always zero-pad to at least 3 digits.
- **Q-C (monotonic `updatedAt`).** Confirmed: the repository guarantees `updatedAt` is
  *strictly* greater than the previous value on each mutation, so AC-7 holds deterministically.
- **Q-D (test runner).** **`vitest`** confirmed (no tests authored until Stage 4).
- **Q-E (PRAGMA / WAL).** Confirmed: enable `journal_mode = WAL` on connection.

---

> This specification is **approved**. Proceed to `/plan`, which builds the implementation plan
> on top of it.
