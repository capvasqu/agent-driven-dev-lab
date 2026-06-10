---
name: task-conventions
description: Kanban task conventions — ID format, valid states, and priorities. Use whenever a task (task, ticket, card, backlog item) is created, listed, modeled, or documented in this project.
---

# Task conventions (Kanban)

Apply these rules every time you create or model a task in this project.

## ID

- Format: `TASK-NNN` with 3 digits and a leading zero. Examples: `TASK-001`, `TASK-042`.
- IDs are **immutable** and **sequential**; they are never reused.

## Valid states (in Kanban flow order)

`backlog` → `todo` → `in_progress` → `review` → `done`

- You may only advance to the next state or move back by one. You cannot jump from `backlog` to `done`.
- `done` is terminal.

## Priorities

`low` · `medium` · `high` · `urgent` (default: `medium`).

## Minimum task fields

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | `TASK-NNN` |
| `title` | string | required, non-empty |
| `status` | enum | one of the valid states; defaults to `backlog` |
| `priority` | enum | defaults to `medium` |
| `createdAt` | ISO 8601 | UTC timestamp |

## Example

```json
{
  "id": "TASK-001",
  "title": "Create POST /tasks endpoint",
  "status": "todo",
  "priority": "high",
  "createdAt": "2026-06-10T12:00:00Z"
}
```
