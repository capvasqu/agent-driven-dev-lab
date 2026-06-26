# Feature Spec — Optional `priority` filter on `GET /tasks`

> Status: **Proposal — pending human approval.**
> Mode: `specify` (no code).
> Builds on the approved whole-app spec (`docs/specify/spec.md`, approved 2026-06-24) and the
> approved feature brief. It honors the `task-conventions`, `rest-api-conventions`, and
> `sqlite-repository` skills. It does **not** re-derive app scope; it adds one optional list
> filter that mirrors the existing `?status=` filter.

## 1. Summary

Add an optional `priority` query parameter to the task list endpoint:

```
GET /tasks?priority=<priority>
```

It behaves exactly like the existing `?status=` filter, but on the `priority` column. It is
combinable with the existing `?status=` and `?archived=` query parameters using **AND**
semantics (all supplied filters must match). The response shape, default ordering, and default
archived-hiding behavior are unchanged. Omitting `?priority=` yields the pre-feature behavior
with no regression.

This change touches three existing seams only:

- `src/validation/schemas.ts` — `listQuerySchema` (add a `priority` enum property).
- `src/routes/tasks.ts` — `ListQuery` interface + the `GET /tasks` handler (pass `priority`
  through).
- `src/repository/taskRepository.ts` — `ListOptions` + `list()` (add a parameterized
  `priority = ?` condition).

## 2. Query parameter & validation

The `GET /tasks` querystring gains one optional key, declared in `listQuerySchema`:

| Param | Required | Type | Allowed values | Default |
|-------|----------|------|----------------|---------|
| `priority` | no | string | `low` \| `medium` \| `high` \| `urgent` | none (no filter) |

Rules (mirroring `?status=`, per `rest-api-conventions` "Strict input" and spec §4.2 / §5.3):

- The allowed set is the canonical priority enum from `task-conventions`
  (`low`, `medium`, `high`, `urgent`). This is the existing `PRIORITY_VALUES` constant already
  used by the create/patch body schemas — it is reused, not redefined.
- The querystring schema keeps `additionalProperties: false`, so `priority` becomes a *declared*
  key and unknown query keys still 400 exactly as before.
- An **unknown** value (`?priority=bogus`) fails JSON-Schema enum validation → the existing
  Fastify error handler re-shapes it into the standard envelope:
  `400 { "error": { "code": "VALIDATION_ERROR", "message": "..." } }`.
- An **empty** value (`?priority=` with no value) is treated as "filter not supplied" — see
  Open question Q-1 for the exact handling and the chosen default.

Validation ordering is unchanged (spec §5.2): querystring schema validation happens before the
handler runs, so a bad `priority` value never reaches the repository.

## 3. Request / response shape

- **Request:** unchanged except for the new optional `priority` query key. No request body.
- **Response (success):** `200 OK` with a JSON array of the full 8-field task resource, exactly
  as today. The only observable difference is **which** rows are included; the per-row shape,
  field set, and serialization are identical.
- **Ordering:** unchanged — priority rank (`urgent > high > medium > low`) then `createdAt`
  ascending. The new filter narrows the result set but does not alter the `ORDER BY`. (When
  `?priority=` pins a single priority, all returned rows share that priority and the
  `createdAt` tiebreaker effectively governs order — this is a consequence of the existing
  sort, not a new rule.)
- **Empty result:** if no row matches, the response is `200 OK` with `[]` (consistent with the
  existing list semantics).

## 4. Composition with existing filters (AND semantics)

The three list filters are independent and combine with logical **AND**: a row appears only if
it satisfies every supplied filter.

| Query | Effect |
|-------|--------|
| `?priority=high` | priority = `high`, archived hidden (default) |
| `?priority=high&status=todo` | priority = `high` **AND** status = `todo`, archived hidden |
| `?priority=high&archived=true` | priority = `high`, archived included |
| `?priority=high&status=done&archived=true` | all three applied |
| *(none)* | pre-feature behavior: archived hidden, no status/priority filter |

This matches how the repository already composes conditions (`status = ?` plus the
`archived = 0` default) — `priority = ?` is simply appended to the same `AND`-joined condition
list.

## 5. Repository change

In `src/repository/taskRepository.ts`:

- Extend `ListOptions` with an optional `priority?: Priority` field (the `Priority` type is
  already imported).
- In `list()`, add a condition mirroring the existing `status` block, using a **parameterized**
  placeholder (per `sqlite-repository` "Safety" — never string-interpolate):

  ```
  if (options.priority !== undefined) {
    conditions.push('priority = ?');
    params.push(options.priority);
  }
  ```

- The condition joins into the existing `WHERE ${conditions.join(' AND ')}` clause; no change to
  the `ORDER BY`, the `archived = 0` default, or the row→domain mapping.
- No schema/DDL change: the `priority` column and its `CHECK` constraint already exist
  (spec §3). No new index is required for this feature (single-user, personal scale — see
  Assumption SA-2); the existing `idx_tasks_archived_status` index is left as-is.

In `src/routes/tasks.ts`:

- Add `priority?: Priority` to the `ListQuery` interface.
- In the `GET /tasks` handler, destructure `priority` from `request.query` and pass it into
  `repo.list({ ... })` alongside the existing `status` and `includeArchived` arguments.

## 6. Acceptance criteria

Stable IDs scoped to this feature (prefix `FAC-PRIO`). They refine the brief's draft criteria.

| ID | Given / When / Then |
|----|---------------------|
| **FAC-PRIO-1** | Given tasks of several priorities, when `GET /tasks?priority=high`, then the response contains **only** tasks whose `priority` is `high`, archived tasks remain hidden (default), and results stay in the standard priority-then-`createdAt` order. |
| **FAC-PRIO-2** | When `GET /tasks?priority=high&status=todo`, then only tasks with `priority = high` **AND** `status = todo` are returned (both filters applied, AND semantics). |
| **FAC-PRIO-3** | When `GET /tasks?priority=bogus` (any value outside `low\|medium\|high\|urgent`), then the response is `400` with the standard envelope `{ "error": { "code": "VALIDATION_ERROR", "message": ... } }` and no list is returned. |
| **FAC-PRIO-4** | When `GET /tasks` is called **without** `?priority=`, then the result is identical to the pre-feature behavior (no regression): archived hidden, no priority narrowing, same ordering. |
| **FAC-PRIO-5** | When `GET /tasks?priority=high&archived=true`, then archived tasks **are** included and the result is still narrowed to `priority = high` (composition with `?archived=` holds). |
| **FAC-PRIO-6** | When `GET /tasks?priority=high&bogus=x` (unknown query key), then the response is `400 VALIDATION_ERROR` — the strict-querystring guarantee is preserved and the new declared key does not loosen `additionalProperties: false`. |

> Out of scope (from the brief): multi-value priority (e.g. `?priority=high,urgent`),
> pagination, and any change to the sort order.

## 7. Assumptions

- **SA-1** — Inherits all whole-app spec assumptions (SA-1..SA-6) and PRD assumptions A1–A5
  (single local user, no concurrency, server-side UTC timestamps, one `tasks` table, no
  pagination).
- **SA-2** — At personal scale the existing indexing is adequate; filtering on `priority`
  without a dedicated index is acceptable. A `priority` index is **not** added by this feature.
- **SA-3** — The canonical priority enum is the existing `PRIORITY_VALUES`
  (`low|medium|high|urgent`) already in `src/validation/schemas.ts`; this feature reuses it and
  does not introduce a new list.
- **SA-4** — `?priority=` is a single-value, exact-match filter (no ranges, no "≥ high"
  semantics), consistent with how `?status=` works today.
- **SA-5** — Tests for FAC-PRIO-* are authored in the implement/qa phase, not in this spec
  (mirrors SA-5 of the whole-app spec).

## 8. Open questions

- **Q-1 (empty value handling).** How should `?priority=` (key present, empty string) be
  treated? Proposed default: treat empty as **not supplied** (no filter), matching a natural
  reading of the brief's "Without `?priority=`, the list behaves exactly as before." The
  current `?status=` enum schema would actually **reject** an empty string (`""` is not in the
  enum) → 400. To keep `priority` and `status` consistent, the recommendation is to mirror
  `?status=` exactly (empty value → 400 `VALIDATION_ERROR`). Decision needed: *mirror `status`
  (empty → 400)* vs *treat empty as omitted*. Recommended: **mirror `status`**.
- **Q-2 (priority index).** Should a supporting index (e.g. `idx_tasks_archived_priority` or a
  composite covering `archived, status, priority`) be added now, or deferred until performance
  warrants it? Recommended: **defer** (SA-2; consistent with the spec's "no premature
  migration" stance).
- **Q-3 (case sensitivity).** Should `?priority=HIGH` be accepted (case-insensitive) or only
  lowercase `high`? Recommended: **lowercase only**, mirroring the existing `?status=` enum,
  which is case-sensitive. No normalization is introduced.
