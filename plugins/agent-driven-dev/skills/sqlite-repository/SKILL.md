---
name: sqlite-repository
description: SQLite persistence conventions for this project — the tasks table shape, the repository pattern, parameterized queries, server-side id and timestamp generation, and soft archiving. Use whenever database access, schema, SQL, or a repository / data-access layer is designed or implemented in this project.
---

# SQLite repository conventions

Apply these to all persistence in this project.

## Repository pattern

- All SQL lives behind a repository module (e.g. `src/repository/taskRepository.ts`). Route
  handlers call repository functions; they never embed SQL.
- The repository returns plain domain objects that match the PRD task shape, not raw rows.

## Schema

- One `tasks` table whose columns map 1:1 to the task resource:
  `id`, `title`, `description`, `status`, `priority`, `archived`, `createdAt`, `updatedAt`.
- `archived` is a boolean stored as `0` / `1`. Archived rows stay in the same table.

## Safety

- Always use parameterized queries (`?` placeholders / bound parameters). Never build SQL by
  string concatenation or interpolation — this prevents SQL injection.

## IDs and timestamps

- `id` is `TASK-NNN`, generated server-side from the **highest id ever issued** (not the row
  count), so archived rows never cause id reuse. See the `task-conventions` skill.
- `createdAt` / `updatedAt` are set server-side in UTC ISO 8601; `updatedAt` is refreshed on
  every mutation.

## Archiving

- No hard delete. Archiving sets `archived = 1`; the row and its id persist forever.
