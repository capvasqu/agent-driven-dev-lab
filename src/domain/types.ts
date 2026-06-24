// Domain types for the task / Kanban resource (FR-1).
// These mirror the `task-conventions` skill exactly: five states, four priorities.

/** Valid Kanban states, in flow order. */
export type Status = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';

/** Valid task priorities. */
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

/** Direction for a one-step status move (FR-7, Q1). */
export type Direction = 'forward' | 'backward';

/**
 * The full task resource (FR-1). `description` is `null` when absent.
 * Timestamps are UTC ISO 8601 strings, generated server-side.
 */
export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: Status;
  priority: Priority;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Input accepted by the repository on create (FR-3). */
export interface CreateTaskInput {
  title: string;
  priority?: Priority;
  description?: string;
}

/**
 * Input accepted by the repository on content update (FR-6, PATCH).
 * Only `title`, `description`, and `priority` may change; at least one must be
 * present. `description: null` clears the field. Status is never updated here.
 */
export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  priority?: Priority;
}
