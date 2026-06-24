import type { Database as DatabaseType } from 'better-sqlite3';
import type {
  CreateTaskInput,
  Priority,
  Status,
  Task,
  UpdateTaskInput,
} from '../domain/types.js';

// Task repository (TASK-008, spec §3/§6, sqlite-repository skill).
// All SQL lives here, behind parameterized queries. Handlers never embed SQL.
// Returns plain domain `Task` objects, not raw rows.

/** Raw row shape as stored in SQLite (`archived` is 0/1, `description` may be NULL). */
interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: Status;
  priority: Priority;
  archived: number;
  createdAt: string;
  updatedAt: string;
}

/** Options for the default list query (FR-4). */
export interface ListOptions {
  status?: Status;
  includeArchived?: boolean;
}

/** Map a raw row to a domain Task (`archived` int→bool, `description` NULL→null). */
function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    status: row.status,
    priority: row.priority,
    archived: row.archived === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Zero-pad a positive integer to at least 3 digits (`TASK-NNN`, Q-B). */
function formatId(num: number): string {
  return `TASK-${String(num).padStart(3, '0')}`;
}

export class TaskRepository {
  constructor(private readonly db: DatabaseType) {}

  /**
   * Next id from the highest id ever issued — `MAX` over the numeric suffix,
   * not the row count, so archived rows never cause reuse (FR-2, AC-2).
   */
  private nextId(): string {
    const row = this.db
      .prepare('SELECT MAX(CAST(SUBSTR(id, 6) AS INTEGER)) AS maxNum FROM tasks')
      .get() as { maxNum: number | null };
    const next = (row.maxNum ?? 0) + 1;
    return formatId(next);
  }

  /**
   * Compute a strictly-monotonic `updatedAt`: now, bumped to `previous + 1ms`
   * if `now` is not strictly greater than the stored value (Q-C). On create,
   * `previous` is omitted and the current instant is used.
   */
  private freshTimestamp(previous?: string): string {
    const now = Date.now();
    if (previous === undefined) {
      return new Date(now).toISOString();
    }
    const prev = Date.parse(previous);
    const next = now > prev ? now : prev + 1;
    return new Date(next).toISOString();
  }

  /** Create a task (FR-3). `status` is always `backlog`; `createdAt === updatedAt`. */
  create(input: CreateTaskInput): Task {
    const id = this.nextId();
    const priority: Priority = input.priority ?? 'medium';
    const description = input.description ?? null;
    const timestamp = this.freshTimestamp();

    this.db
      .prepare(
        `INSERT INTO tasks (id, title, description, status, priority, archived, createdAt, updatedAt)
         VALUES (?, ?, ?, 'backlog', ?, 0, ?, ?)`,
      )
      .run(id, input.title, description, priority, timestamp, timestamp);

    return this.getByIdOrThrow(id);
  }

  /** Fetch one task by id, including archived (FR-5). Returns `null` if absent. */
  getById(id: string): Task | null {
    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as
      | TaskRow
      | undefined;
    return row ? rowToTask(row) : null;
  }

  /** Internal helper: fetch by id, asserting presence (used after writes). */
  private getByIdOrThrow(id: string): Task {
    const task = this.getById(id);
    if (!task) {
      throw new Error(`task ${id} not found immediately after write`);
    }
    return task;
  }

  /**
   * List tasks (FR-4). Excludes archived unless `includeArchived`. Optional
   * `status` filter. Ordered by priority rank (urgent>high>medium>low) via a
   * CASE expression, then `createdAt` ascending as a stable tiebreaker.
   */
  list(options: ListOptions = {}): Task[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (!options.includeArchived) {
      conditions.push('archived = 0');
    }
    if (options.status !== undefined) {
      conditions.push('status = ?');
      params.push(options.status);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
      SELECT * FROM tasks
      ${where}
      ORDER BY
        CASE priority
          WHEN 'urgent' THEN 0
          WHEN 'high'   THEN 1
          WHEN 'medium' THEN 2
          WHEN 'low'    THEN 3
          ELSE 4
        END ASC,
        createdAt ASC
    `;

    const rows = this.db.prepare(sql).all(...params) as TaskRow[];
    return rows.map(rowToTask);
  }

  /**
   * Update content fields only (FR-6, PATCH). Refreshes `updatedAt` strictly
   * monotonically. Never touches `status` or `archived`. Returns the updated
   * task, or `null` if no row exists.
   */
  update(id: string, input: UpdateTaskInput): Task | null {
    const existing = this.getById(id);
    if (!existing) {
      return null;
    }

    const sets: string[] = [];
    const params: unknown[] = [];

    if (input.title !== undefined) {
      sets.push('title = ?');
      params.push(input.title);
    }
    if (input.description !== undefined) {
      sets.push('description = ?');
      params.push(input.description);
    }
    if (input.priority !== undefined) {
      sets.push('priority = ?');
      params.push(input.priority);
    }

    const updatedAt = this.freshTimestamp(existing.updatedAt);
    sets.push('updatedAt = ?');
    params.push(updatedAt);
    params.push(id);

    this.db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    return this.getByIdOrThrow(id);
  }

  /**
   * Set a new status (FR-7). The caller computes the legal target via the
   * transition helpers; this method only persists it and bumps `updatedAt`.
   * Returns the updated task, or `null` if no row exists.
   */
  setStatus(id: string, status: Status): Task | null {
    const existing = this.getById(id);
    if (!existing) {
      return null;
    }
    const updatedAt = this.freshTimestamp(existing.updatedAt);
    this.db
      .prepare('UPDATE tasks SET status = ?, updatedAt = ? WHERE id = ?')
      .run(status, updatedAt, id);
    return this.getByIdOrThrow(id);
  }

  /**
   * Archive a task (FR-8). Sets `archived = 1` and refreshes `updatedAt`.
   * Idempotent — archiving an already-archived task still succeeds. Returns
   * the updated task, or `null` if no row exists.
   */
  archive(id: string): Task | null {
    const existing = this.getById(id);
    if (!existing) {
      return null;
    }
    const updatedAt = this.freshTimestamp(existing.updatedAt);
    this.db
      .prepare('UPDATE tasks SET archived = 1, updatedAt = ? WHERE id = ?')
      .run(updatedAt, id);
    return this.getByIdOrThrow(id);
  }
}
