---
name: rest-api-conventions
description: REST API conventions for this project's task service — JSON shapes, status codes, the error envelope, strict input validation, and resource/action routing. Use whenever an HTTP endpoint, route, request/response, or API error is designed, implemented, or documented in this project.
---

# REST API conventions

Apply these rules to every HTTP endpoint in this project. They implement the PRD
(`docs/define/prd.md`); do not contradict it.

## Format

- Requests and responses are `application/json`.
- Timestamps are UTC ISO 8601 strings, generated server-side. Clients never send them.

## Status codes

- `201 Created` — resource created (`POST /tasks`).
- `200 OK` — successful read or mutation.
- `400 Bad Request` — malformed input: missing/empty required field, unknown enum value,
  malformed id, or a body carrying unknown / server-owned fields (strict — see below).
- `404 Not Found` — well-formed id with no matching row.
- `409 Conflict` — illegal state transition (a skip, a multi-step move, or a move out of a
  terminal state).

## Error envelope

Every `4xx` response body has a stable shape so clients can branch on the code:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "title is required" } }
```

Use stable, distinct `code` values per failure class — e.g. `VALIDATION_ERROR`,
`NOT_FOUND`, `ILLEGAL_TRANSITION`.

## Strict input

- Reject (`400`) request bodies that contain unknown fields, or that try to set
  server-owned fields (`id`, `createdAt`, `updatedAt`, `archived`, and `status` via `PATCH`).
- Validate enums (`status`, `priority`) against the allowed sets from the `task-conventions`
  skill.

## Routing

- Collection / resource: `POST /tasks`, `GET /tasks`, `GET /tasks/{id}`, `PATCH /tasks/{id}`.
- State changes and archiving are explicit **action sub-resources**, never generic updates:
  - `POST /tasks/{id}/status` — body `{ "direction": "forward" | "backward" }`.
  - `POST /tasks/{id}/archive`.
- `GET /tasks` excludes archived tasks by default; `?status=` filters by state;
  `?archived=true` includes archived tasks.
