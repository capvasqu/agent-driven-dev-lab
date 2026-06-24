# Implementation Plan — Personal Task / Kanban Manager (REST API)

> Status: **Approved** (2026-06-24). Open questions resolved — see §6 Resolved decisions.
> This plan is the input to `/implement`.
> Builds on the **approved** spec (`docs/specify/spec.md`, approved 2026-06-24) and the
> approved PRD (`docs/define/prd.md`, approved 2026-06-10). Honors the `task-conventions`,
> `rest-api-conventions`, and `sqlite-repository` skills. It reuses the spec's resolved
> decisions verbatim (Fastify; better-sqlite3; tsx/tsc; vitest scaffolded with no tests until
> Stage 4; relaxed id validator `^TASK-\d{3,}$`; strictly-monotonic `updatedAt`; WAL enabled)
> and does **not** re-derive or expand scope.
> This plan covers Stage 2 (app skeleton). Tests (Stage 4) and the MCP server (Stage 3) are
> out of scope. This is the input to `/implement`.

## 1. Build sequence (dependency order)

The phases below are strictly ordered: each depends on the artifacts produced before it.
`/implement` should execute them top-to-bottom.

1. **Scaffold** — `package.json` (deps + scripts), `tsconfig.json` (strict), `vitest.config.ts`
   (present, no tests), and the `src/` directory tree. Nothing else can run until the toolchain
   and TS config exist. (No application logic.)
2. **DB** — `src/db/connection.ts` (open better-sqlite3 singleton, set `journal_mode = WAL` and
   `foreign_keys = ON`) and `src/db/schema.ts` (`createSchema(db)`: idempotent `CREATE TABLE` /
   `CREATE INDEX IF NOT EXISTS`). Depends on scaffold (driver installed).
3. **Domain** — `src/domain/types.ts` (Task interface, `Status`/`Priority` unions, DTOs) and
   `src/domain/transitions.ts` (`ORDER` array + `nextState()`/`prevState()` helpers). Pure,
   no I/O; depends only on the language toolchain. Drives both repository and routes.
4. **Repository** — `src/repository/taskRepository.ts` (all SQL: `create`, `getById`, `list`,
   `update`, `setStatus`, `archive`, next-id derivation, row↔domain mapping, monotonic
   `updatedAt`). Depends on DB (connection + schema) and Domain (types + transitions order).
5. **Validation schemas + errors** — `src/errors.ts` (`ApiError` class, error codes,
   envelope serializer) and `src/validation/schemas.ts` (JSON Schemas for create/patch bodies,
   id param, list query, status/archive bodies; all `additionalProperties: false`). Depends on
   Domain (enum sets). Errors module has no deps and could land in parallel with Domain, but is
   grouped here because routes consume both.
6. **Routes** — `src/routes/tasks.ts` (Fastify route registrations for `/tasks` and the
   `status`/`archive` action sub-resources, wiring JSON Schemas → repository calls → responses).
   Depends on Repository, Validation, Errors, Domain.
7. **Server wiring** — `src/config.ts` (read `PORT`/`HOST`/`DB_PATH` from env with defaults),
   `src/server.ts` (`buildServer()`: create Fastify, open DB, run `createSchema`, register the
   custom validation/error handler, register routes; exported without listening so Stage 4 can
   build the app), and `src/index.ts` (load config, build server, `listen`). Depends on Routes
   and DB.
8. **Run / verify** — `npm install`, `npm run dev`, then `curl` create + list (and the rest of
   the AC walkthrough in §4). Depends on everything above.

Dependency summary: `scaffold → db → domain → repository → (validation + errors) → routes →
server wiring → run/verify`. Domain and (validation + errors) only need the toolchain and the
enum sets, so they may be authored as soon as the scaffold exists, but repository and routes
gate on them.

## 2. Files to create

From the spec's §2 project structure. One line of purpose each.

| File | Purpose |
|------|---------|
| `package.json` | Project manifest: dependencies (`fastify`, `better-sqlite3`), devDeps (`typescript`, `tsx`, `vitest`, `@types/node`, `@types/better-sqlite3`), and the `dev`/`build`/`start`/`test` scripts. |
| `tsconfig.json` | TypeScript config in strict mode; `outDir: dist`, `rootDir: src`, NodeNext modules, target ES2022. |
| `vitest.config.ts` | Vitest config present for Stage 4; no test files added now. |
| `src/index.ts` | Entry point: load config, call `buildServer()`, `listen` on host/port. |
| `src/server.ts` | `buildServer()`: create Fastify instance, open DB + run schema, register error handler and routes; exported without listening. |
| `src/config.ts` | Reads `PORT`, `HOST`, `DB_PATH` from env with safe local defaults (`3000`, `127.0.0.1`, `./data/tasks.db`). |
| `src/db/connection.ts` | Opens the better-sqlite3 database (singleton); sets `journal_mode = WAL` and `foreign_keys = ON`. |
| `src/db/schema.ts` | `createSchema(db)`: idempotent DDL (`CREATE TABLE IF NOT EXISTS tasks`, `CREATE INDEX IF NOT EXISTS`) run on startup. |
| `src/domain/types.ts` | `Task` interface, `Status`/`Priority` string-literal unions, create/patch DTO types. |
| `src/domain/transitions.ts` | Canonical `ORDER` array + `nextState()` / `prevState()` helpers; returns `null` at boundaries (drives 409). |
| `src/repository/taskRepository.ts` | All parameterized SQL: `create`, `getById`, `list`, `update`, `setStatus`, `archive`, next-id derivation, row↔domain mapping, strictly-monotonic `updatedAt`. |
| `src/routes/tasks.ts` | Fastify route registrations for `/tasks`, `/tasks/:id`, `/tasks/:id/status`, `/tasks/:id/archive`, with JSON-Schema bodies/params/querystrings. |
| `src/errors.ts` | `ApiError` class + error codes (`VALIDATION_ERROR`, `NOT_FOUND`, `ILLEGAL_TRANSITION`) + error-envelope serializer for the Fastify error handler. |
| `src/validation/schemas.ts` | JSON Schemas: create body, patch body, id param, list query, status body, archive body — all strict (`additionalProperties: false`). |
| `data/` (dir) | Holds the runtime SQLite file (`tasks.db`); gitignored, created on first run if absent. |

Notes:
- `data/tasks.db` and `dist/` are created at runtime / build time; they are **not** authored
  files and are already covered by the hardened `.gitignore` (SA-4 — verify at implement time).
- No source file is created outside `src/` except the three root config files above.

## 3. Work breakdown — `TASK-NNN` items

Per `task-conventions`: ids are `TASK-NNN` (3 digits, sequential, never reused); each item
defaults to **status `backlog`** and carries a **priority**. This is the same task model the
app implements (dogfooding). Items are ordered to match the build sequence in §1; `/implement`
executes them in id order.

> Convention for this list: **status** = `backlog` (not started), **priority** per
> `task-conventions` (`low`/`medium`/`high`/`urgent`).

### TASK-001 — Scaffold project manifest & toolchain config
- **Status / priority:** backlog / urgent
- **Files:** `package.json`, `tsconfig.json`, `vitest.config.ts`
- **Description:** Create the manifest with Fastify + better-sqlite3 (and dev deps tsx, tsc,
  vitest, type packages), the four npm scripts (`dev`/`build`/`start`/`test`), strict
  `tsconfig.json`, and a placeholder `vitest.config.ts` (no tests).
- **Acceptance check:** `npm install` succeeds; `npm run build` compiles an empty/stub `src`
  with no TS errors; `npm test` is a no-op pass (vitest finds 0 tests). Enables the runnable
  checkpoint for all later AC.

### TASK-002 — Database connection (WAL singleton)
- **Status / priority:** backlog / high
- **Files:** `src/db/connection.ts`
- **Description:** Open a better-sqlite3 database at `DB_PATH` as a singleton; set
  `journal_mode = WAL` and `foreign_keys = ON` PRAGMAs; ensure the `data/` dir exists.
- **Acceptance check:** Importing the module opens/creates `data/tasks.db`; a quick
  `PRAGMA journal_mode` returns `wal`. (Supports persistence behind all AC.)

### TASK-003 — Schema bootstrap (`createSchema`)
- **Status / priority:** backlog / high
- **Files:** `src/db/schema.ts`
- **Description:** Implement idempotent `createSchema(db)` running the `CREATE TABLE IF NOT
  EXISTS tasks` (with `CHECK` constraints on `status`/`priority`/`archived`) and the
  `CREATE INDEX IF NOT EXISTS idx_tasks_archived_status` from spec §3.
- **Acceptance check:** Calling `createSchema` twice on a fresh DB does not error; `tasks`
  table and index exist afterward (`sqlite_master` query). Backstops AC-1..AC-15 storage.

### TASK-004 — Domain types
- **Status / priority:** backlog / high
- **Files:** `src/domain/types.ts`
- **Description:** Define the `Task` interface (8 fields per FR-1), `Status` and `Priority`
  unions, and the `CreateTaskInput` / `UpdateTaskInput` DTOs used by the repository and routes.
- **Acceptance check:** Types compile under strict mode; `Status`/`Priority` unions exactly
  match the five states and four priorities from `task-conventions` (FR-1).

### TASK-005 — Transition helpers
- **Status / priority:** backlog / high
- **Files:** `src/domain/transitions.ts`
- **Description:** Define `ORDER = ['backlog','todo','in_progress','review','done']` and
  `nextState(s)` / `prevState(s)` returning the adjacent state or `null` at a boundary
  (forward-of-`done`, backward-of-`backlog`).
- **Acceptance check:** `nextState('backlog')==='todo'`, `nextState('done')===null`,
  `prevState('backlog')===null`, `prevState('done')==='review'` (FR-7, FR-11; backs AC-8..AC-10).

### TASK-006 — Error model & envelope
- **Status / priority:** backlog / high
- **Files:** `src/errors.ts`
- **Description:** `ApiError` class carrying `httpStatus` + envelope `code`
  (`VALIDATION_ERROR` 400, `NOT_FOUND` 404, `ILLEGAL_TRANSITION` 409) + a serializer producing
  `{ "error": { "code", "message" } }`.
- **Acceptance check:** Constructing each error yields the right HTTP status and the stable
  envelope shape from `rest-api-conventions` (FR-12 / AC-15).

### TASK-007 — Validation schemas (strict)
- **Status / priority:** backlog / high
- **Files:** `src/validation/schemas.ts`
- **Description:** JSON Schemas for: create body (`title` required, optional `priority` enum +
  `description`), patch body (≥1 of `title`/`description`/`priority`; `description` nullable),
  id param (`^TASK-\d{3,}$`), list query (`status` enum + `archived` `true|false`), status body
  (`direction` enum), archive body (empty allowed). All bodies `additionalProperties: false`;
  query rejects unknown keys.
- **Acceptance check:** Schemas reject unknown/server-owned fields and bad enums, accept valid
  payloads (FR-9, FR-10, Q2; backs AC-12, AC-13, AC-14). Verified once wired in TASK-009.

### TASK-008 — Task repository (SQL + mapping + ids/timestamps)
- **Status / priority:** backlog / urgent
- **Files:** `src/repository/taskRepository.ts`
- **Description:** Parameterized SQL for `create`, `getById`, `list` (priority `CASE` rank then
  `createdAt` asc; archived filter; optional `status`), `update`, `setStatus`, `archive`.
  Next-id from `SELECT MAX(CAST(SUBSTR(id,6) AS INTEGER))` zero-padded to ≥3 digits; UTC ISO
  timestamps server-side with `createdAt === updatedAt` on create and strictly-monotonic
  `updatedAt` (bump +1 ms if not greater) on each mutation; row↔domain mapping (`archived`
  int→bool, `description` NULL→`null`).
- **Acceptance check:** Unit-level via the running app in §4: create yields `TASK-001` with
  equal timestamps (AC-1); id derivation never reuses an archived id (AC-2); list ordering and
  archived exclusion correct (AC-3..AC-5); `updatedAt` strictly increases on mutation (AC-7).

### TASK-009 — Routes (`/tasks` + action sub-resources)
- **Status / priority:** backlog / urgent
- **Files:** `src/routes/tasks.ts`
- **Description:** Register `POST /tasks` (201), `GET /tasks` (list w/ query filters),
  `GET /tasks/:id` (incl. archived; 404), `PATCH /tasks/:id` (content only; 400 on `status`),
  `POST /tasks/:id/status` (direction → `nextState`/`prevState`; 409 on boundary),
  `POST /tasks/:id/archive` (idempotent). Attach the schemas from TASK-007; enforce check order
  id format → schema → existence (404) → transition (409).
- **Acceptance check:** Each route returns the spec §4 status codes; `curl` walkthrough in §4
  passes AC-1, AC-3..AC-14 against these routes.

### TASK-010 — Error handler & strict-mode wiring
- **Status / priority:** backlog / high
- **Files:** `src/server.ts` (error handler portion), `src/errors.ts` (consumed)
- **Description:** Register a Fastify `setErrorHandler` that re-shapes Fastify schema-validation
  failures and thrown `ApiError`s into the error envelope, so clients never see Fastify's
  default validation body; ensure `4xx` always carries `{ error: { code, message } }`.
- **Acceptance check:** A bad request (e.g. unknown `priority`, malformed id, `status` in PATCH)
  returns the envelope with the correct `code`, not Fastify's default (FR-12 / AC-15, AC-12,
  AC-13, AC-14).

### TASK-011 — Config loader
- **Status / priority:** backlog / medium
- **Files:** `src/config.ts`
- **Description:** Read `PORT` (default `3000`), `HOST` (default `127.0.0.1`), `DB_PATH`
  (default `./data/tasks.db`) from env with safe defaults; export a typed config object.
- **Acceptance check:** With no env set, defaults are used; overriding `PORT`/`DB_PATH` via env
  is honored at boot (SA-6).

### TASK-012 — Server build & entry point
- **Status / priority:** backlog / urgent
- **Files:** `src/server.ts`, `src/index.ts`
- **Description:** `buildServer()` creates Fastify, opens the DB, runs `createSchema`, registers
  the error handler (TASK-010) and the routes (TASK-009), and is exported **without** listening;
  `index.ts` loads config, builds the server, and listens. (No tests authored — Stage 4.)
- **Acceptance check:** `npm run dev` boots and logs the listen address; the DB file and schema
  are created on first boot; `buildServer()` can be imported without binding a port (Stage 4
  readiness).

### TASK-013 — Run & verification walkthrough
- **Status / priority:** backlog / high
- **Files:** `README.md` (add a "Run" section — approved, OQ-3); rest operational
- **Description:** Execute the runnable checkpoint and the AC walkthrough in §4: `npm install`,
  `npm run dev`, then the full `curl` sequence covering create/list/get/patch/status/archive and
  the error cases.
- **Acceptance check:** All of AC-1..AC-15 observed as described in §4. This task closes the
  Stage 2 "runnable app" goal.

**Span:** `TASK-001` … `TASK-013` (13 items, all default status `backlog`).

## 4. Verification plan

Runnable checkpoint, then each PRD acceptance criterion mapped to the task that delivers it and
the observable check. Run after TASK-012; TASK-013 owns execution.

**Checkpoint (smoke):**
1. `npm install` — deps resolve (**TASK-001**).
2. `npm run dev` — server boots, `data/tasks.db` created with WAL (**TASK-002/003/012**).
3. `curl -s -X POST localhost:3000/tasks -H 'content-type: application/json' -d '{"title":"Write PRD"}'`
   → `201` with `TASK-001` (**create path**).
4. `curl -s localhost:3000/tasks` → `200` JSON array containing `TASK-001` (**list path**).

**Acceptance-criteria → task map:**

| AC | What it checks | Task(s) | How verified |
|----|----------------|---------|--------------|
| AC-1 | Create returns 201; `TASK-001`; `backlog`/`medium`/`archived:false`; `createdAt==updatedAt` | TASK-008, TASK-009 | `curl POST /tasks {"title":"Write PRD"}` → inspect body |
| AC-2 | Ids never reused after archive | TASK-008 | create → archive → create; second id strictly greater |
| AC-3 | `GET /tasks` excludes archived | TASK-008, TASK-009 | archive one, list, confirm absent |
| AC-4 | `?status=todo` filters; archived still excluded | TASK-008, TASK-009 | move one to `todo`, `GET /tasks?status=todo` |
| AC-5 | Order: urgent→high→medium→low, then `createdAt` asc | TASK-008 | create mixed priorities, inspect list order |
| AC-6 | `GET /tasks/{id}` returns archived task w/ `archived:true` | TASK-008, TASK-009 | archive, then GET by id |
| AC-7 | PATCH updates content, status unchanged, `updatedAt` later | TASK-008, TASK-009 | PATCH title/priority, compare timestamps |
| AC-8 | forward `backlog→todo→in_progress`, backward `→todo` | TASK-005, TASK-008, TASK-009 | sequence of `POST /tasks/{id}/status` |
| AC-9 | multi-step jump → 409, status unchanged | TASK-005, TASK-009 | (no skip endpoint exists; verify forward-from-`done` / construction prevents jumps) + re-GET unchanged |
| AC-10 | `done` rejects forward (409), backward to `review` ok | TASK-005, TASK-009 | walk to `done`, forward→409, backward→200 |
| AC-11 | archive hides from list, present by id, idempotent | TASK-009 | archive, list (absent), GET by id (present), archive again→200 |
| AC-12 | malformed id→400; well-formed missing→404 | TASK-007, TASK-009, TASK-010 | `GET /tasks/banana`→400, `GET /tasks/TASK-999`→404 |
| AC-13 | empty/missing title or bad priority→400, no row | TASK-007, TASK-009, TASK-010 | bad `POST /tasks`, then list shows no new row |
| AC-14 | `status` in PATCH body→400, status unchanged | TASK-007, TASK-009, TASK-010 | `PATCH` with `status`, re-GET unchanged |
| AC-15 | every 4xx carries `error.code` distinguishing class | TASK-006, TASK-010 | inspect bodies of the 400/404/409 cases above |

> Note on AC-9: by construction (Q1) only `forward`/`backward` are accepted, so a literal
> `backlog → done` payload is impossible; the 409 path is exercised via the boundary moves
> (forward-out-of-`done`, backward-out-of-`backlog`) and the "unchanged on 409" guarantee is
> confirmed by a follow-up GET.

## 5. Assumptions

- **PA-1** — Inherits all spec assumptions SA-1..SA-6 and PRD assumptions A1..A5 (single local
  user, no concurrency, server-side UTC timestamps, one `tasks` table 1:1 with FR-1, no
  pagination, verbatim `description`, vitest scaffolded but no tests until Stage 4).
- **PA-2** — `npm install` has network access to fetch `better-sqlite3` (which builds/downloads
  a native binary). If offline, TASK-001 stalls — flagged for the implement run.
- **PA-3** — The hardened `.gitignore` already covers `data/`, `*.db`, and `dist/` (SA-4);
  TASK-002/TASK-013 only **verify** this, they do not add ignore rules unless the check fails.
- **PA-4** — Verification in §4 is manual `curl`/inspection at this stage; automated tests are
  explicitly deferred to Stage 4 (SA-5), so no test files are created by this plan.
- **PA-5** — The repository is the single writer (A1), so the read-then-bump strictly-monotonic
  `updatedAt` (Q-C) needs no locking.

## 6. Resolved decisions

Resolved by the lab owner at approval (2026-06-24):

- **OQ-1 (versions).** Pin the **latest compatible majors** at implement time (Fastify 5,
  better-sqlite3 12, TypeScript 5, on Node ≥20). No specific older major required.
- **OQ-2 (module setting).** **ESM / `NodeNext`** with `"type": "module"`. CommonJS declined.
- **OQ-3 (README).** **Yes** — TASK-013 adds a brief "Run" section to `README.md`
  (`npm install` / `npm run dev` / example `curl`s).

---

> This implementation plan is **approved**. `/implement` may proceed, executing TASK-001…
> TASK-013 in id order and stopping at the runnable checkpoint for human verification.
