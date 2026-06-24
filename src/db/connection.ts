import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';

/**
 * Open a better-sqlite3 database at `dbPath` (TASK-002).
 *
 * Ensures the parent directory (e.g. `data/`) exists, then sets the
 * `journal_mode = WAL` and `foreign_keys = ON` PRAGMAs on the connection
 * (spec §3, Q-E). The synchronous API is fine for a single local user (SA-2).
 */
export function openDatabase(dbPath: string): DatabaseType {
  mkdirSync(dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}
