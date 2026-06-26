import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import type { Config } from '../src/config.js';

// HTTP integration tests via `app.inject` (no port binding), one in-memory
// SQLite database per test so runs are isolated and never touch
// `./data/tasks.db`. Each `it` maps to an acceptance criterion (AC-1..AC-15).

const TEST_CONFIG: Config = { port: 0, host: '127.0.0.1', dbPath: ':memory:' };

let app: FastifyInstance;

beforeEach(async () => {
  app = buildServer({ ...TEST_CONFIG });
  await app.ready();
});

afterEach(async () => {
  // onClose hook closes the in-memory DB.
  await app.close();
});

const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const TASK_ID = /^TASK-\d{3,}$/;

/** Create a task and return the parsed body, asserting a 201. */
async function createTask(payload: Record<string, unknown>) {
  const res = await app.inject({ method: 'POST', url: '/tasks', payload });
  expect(res.statusCode).toBe(201);
  return res.json();
}

describe('POST /tasks — create (AC-1, AC-13)', () => {
  it('AC-1: returns 201 with a well-formed default-shaped task', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/tasks',
      payload: { title: 'Write PRD' },
    });
    expect(res.statusCode).toBe(201);
    const task = res.json();
    expect(task.id).toMatch(TASK_ID);
    expect(task.title).toBe('Write PRD');
    expect(task.description).toBeNull();
    expect(task.status).toBe('backlog');
    expect(task.priority).toBe('medium');
    expect(task.archived).toBe(false);
    expect(task.createdAt).toMatch(ISO_8601);
    expect(task.updatedAt).toMatch(ISO_8601);
    expect(task.createdAt).toBe(task.updatedAt);
    // Full resource is exactly the eight FR-1 fields.
    expect(Object.keys(task).sort()).toEqual(
      ['archived', 'createdAt', 'description', 'id', 'priority', 'status', 'title', 'updatedAt'],
    );
  });

  it('AC-13: empty title is rejected 400 and creates no row', async () => {
    const res = await app.inject({ method: 'POST', url: '/tasks', payload: { title: '' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');

    const list = await app.inject({ method: 'GET', url: '/tasks' });
    expect(list.json()).toHaveLength(0);
  });

  it('AC-13: missing title is rejected 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/tasks', payload: { priority: 'high' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('AC-13: unknown priority is rejected 400 and creates no row', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/tasks',
      payload: { title: 'x', priority: 'sometime' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');

    const list = await app.inject({ method: 'GET', url: '/tasks' });
    expect(list.json()).toHaveLength(0);
  });

  it('strict input: unknown field on create is rejected 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/tasks',
      payload: { title: 'x', color: 'red' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('strict input: server-owned field (status) on create is rejected 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/tasks',
      payload: { title: 'x', status: 'done' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('strict input: server-owned field (id) on create is rejected 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/tasks',
      payload: { title: 'x', id: 'TASK-001' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });
});

describe('id generation (AC-2)', () => {
  it('AC-2: ids are never reused after archiving', async () => {
    const first = await createTask({ title: 'first' });
    const archive = await app.inject({ method: 'POST', url: `/tasks/${first.id}/archive` });
    expect(archive.statusCode).toBe(200);

    const second = await createTask({ title: 'second' });

    const firstNum = Number.parseInt(first.id.slice(5), 10);
    const secondNum = Number.parseInt(second.id.slice(5), 10);
    expect(secondNum).toBeGreaterThan(firstNum);
    expect(second.id).not.toBe(first.id);
  });
});

describe('GET /tasks — list (AC-3, AC-4, AC-5)', () => {
  it('AC-3: excludes archived tasks by default', async () => {
    const a = await createTask({ title: 'visible' });
    const b = await createTask({ title: 'hidden' });
    await app.inject({ method: 'POST', url: `/tasks/${b.id}/archive` });

    const res = await app.inject({ method: 'GET', url: '/tasks' });
    expect(res.statusCode).toBe(200);
    const ids = res.json().map((t: { id: string }) => t.id);
    expect(ids).toContain(a.id);
    expect(ids).not.toContain(b.id);
  });

  it('AC-4: status filter returns only that status, still excluding archived', async () => {
    const todo = await createTask({ title: 'to-do' });
    await app.inject({ method: 'POST', url: `/tasks/${todo.id}/status`, payload: { direction: 'forward' } });
    const backlog = await createTask({ title: 'stays-backlog' });
    const archivedTodo = await createTask({ title: 'archived-todo' });
    await app.inject({ method: 'POST', url: `/tasks/${archivedTodo.id}/status`, payload: { direction: 'forward' } });
    await app.inject({ method: 'POST', url: `/tasks/${archivedTodo.id}/archive` });

    const res = await app.inject({ method: 'GET', url: '/tasks?status=todo' });
    expect(res.statusCode).toBe(200);
    const tasks = res.json();
    expect(tasks.every((t: { status: string }) => t.status === 'todo')).toBe(true);
    const ids = tasks.map((t: { id: string }) => t.id);
    expect(ids).toContain(todo.id);
    expect(ids).not.toContain(backlog.id);
    expect(ids).not.toContain(archivedTodo.id);
  });

  it('AC-4: archived=true includes archived tasks matching the status filter', async () => {
    const archivedTodo = await createTask({ title: 'archived-todo' });
    await app.inject({ method: 'POST', url: `/tasks/${archivedTodo.id}/status`, payload: { direction: 'forward' } });
    await app.inject({ method: 'POST', url: `/tasks/${archivedTodo.id}/archive` });

    const res = await app.inject({ method: 'GET', url: '/tasks?status=todo&archived=true' });
    expect(res.statusCode).toBe(200);
    const ids = res.json().map((t: { id: string }) => t.id);
    expect(ids).toContain(archivedTodo.id);
  });

  it('AC-5: orders by priority (urgent>high>medium>low), then createdAt ascending', async () => {
    // Create with mixed priorities; two mediums to check the createdAt tiebreaker.
    const low = await createTask({ title: 'low', priority: 'low' });
    const med1 = await createTask({ title: 'med1', priority: 'medium' });
    const urgent = await createTask({ title: 'urgent', priority: 'urgent' });
    const med2 = await createTask({ title: 'med2', priority: 'medium' });
    const high = await createTask({ title: 'high', priority: 'high' });

    const res = await app.inject({ method: 'GET', url: '/tasks' });
    const orderedIds = res.json().map((t: { id: string }) => t.id);
    expect(orderedIds).toEqual([urgent.id, high.id, med1.id, med2.id, low.id]);
  });

  it('AC-13/strict: an unknown status filter value is rejected 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/tasks?status=banana' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('strict: an unknown query key is rejected 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/tasks?bogus=1' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /tasks — priority filter (FAC-PRIO-1..6)', () => {
  it('FAC-PRIO-1: ?priority=high returns only high tasks, hides archived, keeps order', async () => {
    // Two high tasks (to check the createdAt tiebreaker within one priority),
    // plus other priorities that must be excluded.
    const high1 = await createTask({ title: 'high-1', priority: 'high' });
    await createTask({ title: 'urgent', priority: 'urgent' });
    const high2 = await createTask({ title: 'high-2', priority: 'high' });
    await createTask({ title: 'low', priority: 'low' });
    const highArchived = await createTask({ title: 'high-archived', priority: 'high' });
    await app.inject({ method: 'POST', url: `/tasks/${highArchived.id}/archive` });

    const res = await app.inject({ method: 'GET', url: '/tasks?priority=high' });
    expect(res.statusCode).toBe(200);
    const tasks = res.json();
    // Only high priority rows.
    expect(tasks.every((t: { priority: string }) => t.priority === 'high')).toBe(true);
    const ids = tasks.map((t: { id: string }) => t.id);
    // Archived high task is hidden by default.
    expect(ids).not.toContain(highArchived.id);
    // The two visible high tasks, in createdAt-ascending order (same priority rank).
    expect(ids).toEqual([high1.id, high2.id]);
  });

  it('FAC-PRIO-2: ?priority=high&status=todo applies both filters (AND)', async () => {
    // Target: high + todo.
    const match = await createTask({ title: 'high-todo', priority: 'high' });
    await app.inject({ method: 'POST', url: `/tasks/${match.id}/status`, payload: { direction: 'forward' } });

    // high but still backlog — fails the status filter.
    const highBacklog = await createTask({ title: 'high-backlog', priority: 'high' });

    // todo but medium priority — fails the priority filter.
    const mediumTodo = await createTask({ title: 'medium-todo', priority: 'medium' });
    await app.inject({ method: 'POST', url: `/tasks/${mediumTodo.id}/status`, payload: { direction: 'forward' } });

    const res = await app.inject({ method: 'GET', url: '/tasks?priority=high&status=todo' });
    expect(res.statusCode).toBe(200);
    const tasks = res.json();
    expect(
      tasks.every((t: { priority: string; status: string }) => t.priority === 'high' && t.status === 'todo'),
    ).toBe(true);
    const ids = tasks.map((t: { id: string }) => t.id);
    expect(ids).toContain(match.id);
    expect(ids).not.toContain(highBacklog.id);
    expect(ids).not.toContain(mediumTodo.id);
  });

  it('FAC-PRIO-3: an unknown priority value is rejected 400 with the standard envelope', async () => {
    const res = await app.inject({ method: 'GET', url: '/tasks?priority=bogus' });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(typeof body.error.message).toBe('string');
  });

  it('FAC-PRIO-3/Q-1: an empty priority value (?priority=) is rejected 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/tasks?priority=' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('FAC-PRIO-4: no priority filter is unchanged (no regression)', async () => {
    // Seed mixed priorities plus an archived row.
    const low = await createTask({ title: 'low', priority: 'low' });
    const urgent = await createTask({ title: 'urgent', priority: 'urgent' });
    const medium = await createTask({ title: 'medium', priority: 'medium' });
    const archived = await createTask({ title: 'archived', priority: 'high' });
    await app.inject({ method: 'POST', url: `/tasks/${archived.id}/archive` });

    const res = await app.inject({ method: 'GET', url: '/tasks' });
    expect(res.statusCode).toBe(200);
    const ids = res.json().map((t: { id: string }) => t.id);
    // Archived hidden, all priorities present, standard priority-then-createdAt order.
    expect(ids).toEqual([urgent.id, medium.id, low.id]);
    expect(ids).not.toContain(archived.id);
  });

  it('FAC-PRIO-5: ?priority=high&archived=true includes archived, still narrowed to high', async () => {
    const highVisible = await createTask({ title: 'high-visible', priority: 'high' });
    const highArchived = await createTask({ title: 'high-archived', priority: 'high' });
    await app.inject({ method: 'POST', url: `/tasks/${highArchived.id}/archive` });
    const lowArchived = await createTask({ title: 'low-archived', priority: 'low' });
    await app.inject({ method: 'POST', url: `/tasks/${lowArchived.id}/archive` });

    const res = await app.inject({ method: 'GET', url: '/tasks?priority=high&archived=true' });
    expect(res.statusCode).toBe(200);
    const tasks = res.json();
    expect(tasks.every((t: { priority: string }) => t.priority === 'high')).toBe(true);
    const ids = tasks.map((t: { id: string }) => t.id);
    expect(ids).toContain(highVisible.id);
    expect(ids).toContain(highArchived.id); // archived included
    expect(ids).not.toContain(lowArchived.id); // narrowed to high
  });

  it('FAC-PRIO-6: an unknown query key alongside priority is rejected 400 (strict)', async () => {
    const res = await app.inject({ method: 'GET', url: '/tasks?priority=high&bogus=x' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /tasks/:id — read one (AC-6, AC-12)', () => {
  it('AC-6: returns a previously archived task by id with archived:true', async () => {
    const task = await createTask({ title: 'to-archive' });
    await app.inject({ method: 'POST', url: `/tasks/${task.id}/archive` });

    const res = await app.inject({ method: 'GET', url: `/tasks/${task.id}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().archived).toBe(true);
  });

  it('AC-12: a malformed id (TASK-1) is rejected 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/tasks/TASK-1' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('AC-12: a non-TASK id (banana) is rejected 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/tasks/banana' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('AC-12: a well-formed id with no row is 404 NOT_FOUND', async () => {
    const res = await app.inject({ method: 'GET', url: '/tasks/TASK-999' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });
});

describe('PATCH /tasks/:id — update content (AC-7, AC-14)', () => {
  it('AC-7: updates content, refreshes updatedAt, leaves status unchanged', async () => {
    const task = await createTask({ title: 'orig', priority: 'low' });

    const res = await app.inject({
      method: 'PATCH',
      url: `/tasks/${task.id}`,
      payload: { title: 'new title', description: 'now described', priority: 'high' },
    });
    expect(res.statusCode).toBe(200);
    const updated = res.json();
    expect(updated.title).toBe('new title');
    expect(updated.description).toBe('now described');
    expect(updated.priority).toBe('high');
    expect(updated.status).toBe('backlog');
    expect(Date.parse(updated.updatedAt)).toBeGreaterThan(Date.parse(task.updatedAt));
    expect(updated.createdAt).toBe(task.createdAt);
  });

  it('AC-7: description can be cleared to null', async () => {
    const task = await createTask({ title: 'x', description: 'something' });
    const res = await app.inject({
      method: 'PATCH',
      url: `/tasks/${task.id}`,
      payload: { description: null },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().description).toBeNull();
  });

  it('AC-14: a status field in the PATCH body is rejected 400 and status is unchanged', async () => {
    const task = await createTask({ title: 'x' });
    const res = await app.inject({
      method: 'PATCH',
      url: `/tasks/${task.id}`,
      payload: { status: 'done' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');

    const after = await app.inject({ method: 'GET', url: `/tasks/${task.id}` });
    expect(after.json().status).toBe('backlog');
  });

  it('strict: an empty PATCH body is rejected 400', async () => {
    const task = await createTask({ title: 'x' });
    const res = await app.inject({ method: 'PATCH', url: `/tasks/${task.id}`, payload: {} });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('PATCH on a non-existent row is 404', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/tasks/TASK-777',
      payload: { title: 'x' },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });
});

describe('POST /tasks/:id/status — move (AC-8, AC-9, AC-10)', () => {
  it('AC-8: forward yields todo then in_progress; backward yields todo', async () => {
    const task = await createTask({ title: 'mover' });

    const f1 = await app.inject({ method: 'POST', url: `/tasks/${task.id}/status`, payload: { direction: 'forward' } });
    expect(f1.statusCode).toBe(200);
    expect(f1.json().status).toBe('todo');

    const f2 = await app.inject({ method: 'POST', url: `/tasks/${task.id}/status`, payload: { direction: 'forward' } });
    expect(f2.statusCode).toBe(200);
    expect(f2.json().status).toBe('in_progress');

    const b1 = await app.inject({ method: 'POST', url: `/tasks/${task.id}/status`, payload: { direction: 'backward' } });
    expect(b1.statusCode).toBe(200);
    expect(b1.json().status).toBe('todo');
  });

  it('AC-9: backward out of backlog is 409 and leaves status unchanged', async () => {
    const task = await createTask({ title: 'at-boundary' });
    const res = await app.inject({
      method: 'POST',
      url: `/tasks/${task.id}/status`,
      payload: { direction: 'backward' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('ILLEGAL_TRANSITION');

    const after = await app.inject({ method: 'GET', url: `/tasks/${task.id}` });
    expect(after.json().status).toBe('backlog');
  });

  it('AC-10: done rejects forward (409) but allows one backward to review (200)', async () => {
    const task = await createTask({ title: 'to-done' });
    // Walk to done: backlog→todo→in_progress→review→done.
    for (let i = 0; i < 4; i++) {
      await app.inject({ method: 'POST', url: `/tasks/${task.id}/status`, payload: { direction: 'forward' } });
    }
    const atDone = await app.inject({ method: 'GET', url: `/tasks/${task.id}` });
    expect(atDone.json().status).toBe('done');

    const fwd = await app.inject({ method: 'POST', url: `/tasks/${task.id}/status`, payload: { direction: 'forward' } });
    expect(fwd.statusCode).toBe(409);
    expect(fwd.json().error.code).toBe('ILLEGAL_TRANSITION');

    const back = await app.inject({ method: 'POST', url: `/tasks/${task.id}/status`, payload: { direction: 'backward' } });
    expect(back.statusCode).toBe(200);
    expect(back.json().status).toBe('review');
  });

  it('strict: an unknown direction value is rejected 400', async () => {
    const task = await createTask({ title: 'x' });
    const res = await app.inject({
      method: 'POST',
      url: `/tasks/${task.id}/status`,
      payload: { direction: 'sideways' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('status move on a non-existent row is 404 (before any 409 check)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/tasks/TASK-888/status',
      payload: { direction: 'forward' },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });
});

describe('POST /tasks/:id/archive — archive (AC-11)', () => {
  it('AC-11: archive hides from list, keeps it by id, and is idempotent', async () => {
    const task = await createTask({ title: 'archive-me' });

    const arch1 = await app.inject({ method: 'POST', url: `/tasks/${task.id}/archive` });
    expect(arch1.statusCode).toBe(200);
    expect(arch1.json().archived).toBe(true);

    const list = await app.inject({ method: 'GET', url: '/tasks' });
    expect(list.json().map((t: { id: string }) => t.id)).not.toContain(task.id);

    const byId = await app.inject({ method: 'GET', url: `/tasks/${task.id}` });
    expect(byId.statusCode).toBe(200);
    expect(byId.json().archived).toBe(true);

    // Idempotent: archiving again still 200, still archived.
    const arch2 = await app.inject({ method: 'POST', url: `/tasks/${task.id}/archive` });
    expect(arch2.statusCode).toBe(200);
    expect(arch2.json().archived).toBe(true);
  });

  it('archive on a non-existent row is 404', async () => {
    const res = await app.inject({ method: 'POST', url: '/tasks/TASK-654/archive' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });
});

describe('error envelope (AC-15)', () => {
  it('AC-15: each 4xx carries a distinct error.code per failure class', async () => {
    // VALIDATION_ERROR (400)
    const v = await app.inject({ method: 'GET', url: '/tasks/banana' });
    expect(v.statusCode).toBe(400);
    expect(v.json().error.code).toBe('VALIDATION_ERROR');
    expect(typeof v.json().error.message).toBe('string');

    // NOT_FOUND (404)
    const nf = await app.inject({ method: 'GET', url: '/tasks/TASK-999' });
    expect(nf.statusCode).toBe(404);
    expect(nf.json().error.code).toBe('NOT_FOUND');

    // ILLEGAL_TRANSITION (409)
    const task = await createTask({ title: 'x' });
    const it409 = await app.inject({
      method: 'POST',
      url: `/tasks/${task.id}/status`,
      payload: { direction: 'backward' },
    });
    expect(it409.statusCode).toBe(409);
    expect(it409.json().error.code).toBe('ILLEGAL_TRANSITION');
  });
});
