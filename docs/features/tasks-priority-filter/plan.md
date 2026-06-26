# Implementation Plan — Optional `priority` filter on `GET /tasks`

> Status: **Proposal — pending human approval.**
> Mode: `plan` (no code).
> Builds on the approved feature spec (`docs/features/tasks-priority-filter/spec.md`) and honors
> the `task-conventions`, `rest-api-conventions`, and `sqlite-repository` skills. It does not
> re-derive scope; it sequences the three seams the spec already identified plus a test file.

## 0. Resolved decisions (carried from the approved spec)

These were resolved at the spec approval gate and constrain this plan:

- **Q-1 (empty value).** `?priority=` (key present, empty string) → **400** `VALIDATION_ERROR`,
  mirroring `?status=`. No "empty means omitted" special-casing — the enum simply rejects `""`.
- **Q-2 (index).** **No** supporting index is added; deferred. No DDL/schema change.
- **Q-3 (case).** **Lowercase only** (`high`, not `HIGH`), matching the case-sensitive
  `?status=` enum. No normalization.

## 1. Files to touch (in order)

| # | File | Change | New or edit |
|---|------|--------|-------------|
| 1 | `src/validation/schemas.ts` | Add a `priority` enum property to `listQuerySchema`, reusing the existing `PRIORITY_VALUES`. Keep `additionalProperties: false`. | edit |
| 2 | `src/repository/taskRepository.ts` | Add `priority?: Priority` to `ListOptions`; add a parameterized `priority = ?` condition in `list()`. No `ORDER BY` / DDL change. | edit |
| 3 | `src/routes/tasks.ts` | Add `priority?: Priority` to `ListQuery`; destructure `priority` from `request.query` and pass it to `repo.list({...})`. | edit |
| 4 | `test/api.test.ts` | Add tests covering `FAC-PRIO-1..6`. | new (feature test file) |

Order rationale: schema (the contract) → repository (the data path) → route (the wiring that
joins them) → tests (verify end-to-end). Steps 1–3 are small and independent enough to land
together, but this is the logical bottom-up order.

## 2. Build / verify sequence

Run from the worktree root (`D:/IA/workspace/add-lab-feat-tasks-priority-filter`):

1. `npm install` — ensure dependencies are present in the worktree (idempotent).
2. Apply code changes (TASK-101 → TASK-103).
3. `npm run build` (`tsc -p tsconfig.json`) — type-check the new `ListOptions.priority`,
   `ListQuery.priority`, and schema changes compile cleanly under strict mode.
4. Add tests (TASK-104).
5. `npm test` (`vitest run`) — all existing tests plus the new `FAC-PRIO-*` tests pass.
6. Manual smoke (optional, dev only): `npm run dev`, then
   - `GET /tasks?priority=high` → only `high` tasks, archived hidden.
   - `GET /tasks?priority=bogus` → `400` with the standard envelope.
   - `GET /tasks?priority=` → `400` (Q-1).
   - `GET /tasks` (no param) → unchanged list (no regression).

A change is "done" only when `npm run build` and `npm test` both pass with no regression in the
existing suite.

## 3. Work items (`TASK-NNN`)

> IDs use a feature-scoped range `TASK-101..104` to avoid colliding with the whole-app build's
> `TASK-001..009`. Format per `task-conventions` (`TASK-NNN`, 3 digits). Sequential, immutable.

### TASK-101 — Add `priority` to the list querystring schema

- **File:** `src/validation/schemas.ts`.
- **Description:** Add a `priority` property to `listQuerySchema` as
  `{ type: 'string', enum: PRIORITY_VALUES }`, mirroring the existing `status` property. Reuse
  the existing `PRIORITY_VALUES` constant (do not redefine the enum). Leave
  `additionalProperties: false` intact so unknown query keys still 400 and an empty/invalid
  `priority` value is rejected by the enum (Q-1, Q-3).
- **Acceptance check:**
  - `FAC-PRIO-3` — `?priority=bogus` fails enum validation → `400 VALIDATION_ERROR`.
  - `FAC-PRIO-6` — `?priority=high&bogus=x` still `400` (strict querystring preserved).
  - Supports Q-1 (`?priority=` empty → 400) and Q-3 (lowercase-only enum).

### TASK-102 — Add a parameterized `priority` condition to the repository

- **File:** `src/repository/taskRepository.ts`.
- **Description:** Add `priority?: Priority` to the `ListOptions` interface. In `list()`, after
  the existing `status` block, append a condition mirroring it:
  `if (options.priority !== undefined) { conditions.push('priority = ?'); params.push(options.priority); }`.
  Do not change the `ORDER BY`, the `archived = 0` default, the row→domain mapping, or any DDL
  (Q-2: no index). The condition joins the existing `AND`-joined `WHERE` clause.
- **Acceptance check:**
  - `FAC-PRIO-1` — `list({ priority: 'high' })` returns only `high` rows, archived excluded,
    standard order preserved.
  - `FAC-PRIO-2` / `FAC-PRIO-5` — combining `priority` with `status` and/or `includeArchived`
    applies all conditions (AND).
  - `FAC-PRIO-4` — `list({})` / no `priority` behaves exactly as before (no regression).

### TASK-103 — Wire the query param through the `GET /tasks` route

- **File:** `src/routes/tasks.ts`.
- **Description:** Add `priority?: Priority` to the `ListQuery` interface (import/ensure
  `Priority` type is available, as `Status` already is). In the `GET /tasks` handler,
  destructure `priority` from `request.query` and pass it into `repo.list({ status, priority,
  includeArchived: archived === 'true' })`.
- **Acceptance check:**
  - `FAC-PRIO-1`, `FAC-PRIO-2`, `FAC-PRIO-5` — the HTTP endpoint applies the `priority` filter
    and composes it with `status` / `archived`.
  - `FAC-PRIO-4` — omitting `?priority=` passes `undefined`, yielding pre-feature behavior.
  - `npm run build` type-checks the new field cleanly.

### TASK-104 — Tests for the `priority` filter (`FAC-PRIO-*`)

- **File:** `test/api.test.ts` (new feature test file; builds the app via the exported
  `buildServer()` / `registerTaskRoutes`, consistent with the Stage 4 test approach, using an
  in-memory or temp SQLite db).
- **Description:** Add `vitest` cases covering every acceptance criterion. Seed tasks across
  priorities/statuses, then assert each behavior.
- **Acceptance check (one assertion group per criterion):**
  - `FAC-PRIO-1` — `GET /tasks?priority=high` → 200, only `high` tasks, archived hidden,
    standard order.
  - `FAC-PRIO-2` — `GET /tasks?priority=high&status=todo` → 200, both filters applied (AND).
  - `FAC-PRIO-3` — `GET /tasks?priority=bogus` → 400 with
    `{ error: { code: 'VALIDATION_ERROR', ... } }`.
  - `FAC-PRIO-4` — `GET /tasks` (no `priority`) → 200, result equals the pre-feature listing
    (no regression).
  - `FAC-PRIO-5` — `GET /tasks?priority=high&archived=true` → 200, archived included **and**
    narrowed to `high`.
  - `FAC-PRIO-6` — `GET /tasks?priority=high&bogus=x` → 400 `VALIDATION_ERROR`.
  - Plus Q-1 edge: `GET /tasks?priority=` → 400.

## 4. Traceability (TASK → FAC-PRIO)

| TASK | Covers |
|------|--------|
| TASK-101 | FAC-PRIO-3, FAC-PRIO-6 (+ Q-1, Q-3) |
| TASK-102 | FAC-PRIO-1, FAC-PRIO-2, FAC-PRIO-4, FAC-PRIO-5 |
| TASK-103 | FAC-PRIO-1, FAC-PRIO-2, FAC-PRIO-4, FAC-PRIO-5 |
| TASK-104 | FAC-PRIO-1..6 (+ Q-1 edge) |

Every `FAC-PRIO-*` criterion is verified by at least one work item, and TASK-104 verifies them
all end-to-end.

## 5. Assumptions

- **PA-1** — Inherits all spec assumptions (SA-1..SA-5) and the resolved Q-1/Q-2/Q-3 decisions.
- **PA-2** — The three production seams change as scoped; no other source files need edits
  (the MCP server reuses the same repository, so it inherits the new optional `ListOptions`
  field for free without code changes — and exposing `priority` over MCP is out of scope here).
- **PA-3** — `test/api.test.ts` is the right home for the new tests and the app is testable via
  the exported `buildServer()` against a throwaway SQLite db (consistent with Stage 4). If the
  existing Stage 4 suite lives at a different path, TASK-104 targets that file instead — the
  plan's intent (cover `FAC-PRIO-*`) is unchanged.
- **PA-4** — `npm run build` + `npm test` are the gate; no new tooling, dependency, or script is
  introduced by this feature.

## 6. Open questions

- **PQ-1 (MCP exposure).** Should the `task-mcp` list tool also expose the new `priority` filter?
  The repository change makes it trivially possible, but the brief scopes only the REST
  endpoint. Recommended: **out of scope** for this feature; revisit separately if desired.
- **PQ-2 (test file path).** Confirm the canonical test location/naming. The plan assumes
  `test/api.test.ts`; if the Stage 4 suite uses a different convention, the implementer should
  follow the existing one rather than create a parallel file. Recommended: **follow the existing
  Stage 4 test layout** when it is located at implement time.
