import type { Database as DatabaseType } from 'better-sqlite3';

/**
 * Idempotent schema bootstrap (TASK-003, spec §3). Runs on every boot.
 *
 * One `tasks` table mapping 1:1 to the FR-1 resource. `archived` is stored as
 * an integer 0/1; timestamps are ISO 8601 UTC text. CHECK constraints are a
 * defense-in-depth backstop — primary validation is at the HTTP layer.
 */
export function createSchema(db: DatabaseType): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id          TEXT    PRIMARY KEY,
      title       TEXT    NOT NULL,
      description TEXT,
      status      TEXT    NOT NULL DEFAULT 'backlog'
                  CHECK (status IN ('backlog','todo','in_progress','review','done')),
      priority    TEXT    NOT NULL DEFAULT 'medium'
                  CHECK (priority IN ('low','medium','high','urgent')),
      archived    INTEGER NOT NULL DEFAULT 0
                  CHECK (archived IN (0,1)),
      createdAt   TEXT    NOT NULL,
      updatedAt   TEXT    NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_archived_status ON tasks (archived, status);
  `);
}
