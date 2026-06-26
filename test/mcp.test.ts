import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Database as DatabaseType } from 'better-sqlite3';
import { openDatabase } from '../src/db/connection.js';
import { createSchema } from '../src/db/schema.js';
import { TaskRepository } from '../src/repository/taskRepository.js';
import { buildMcpServer } from '../src/mcp/server.js';

// Smoke test for the five MCP tools, driven over an in-memory transport pair
// against an in-memory SQLite repository (isolated, never touches data/tasks.db).
// The MCP adapter reuses the same TaskRepository + domain layer as the HTTP API.

let db: DatabaseType;
let client: Client;

/** Parse the JSON text payload a tool returns via its first text content block. */
function parseResult(result: { content: Array<{ type: string; text?: string }> }) {
  const block = result.content[0];
  expect(block?.type).toBe('text');
  return JSON.parse(block?.text ?? '');
}

beforeEach(async () => {
  db = openDatabase(':memory:');
  createSchema(db);
  const repository = new TaskRepository(db);
  const server = buildMcpServer(repository);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  client = new Client({ name: 'test-client', version: '0.0.0' });
  await client.connect(clientTransport);
});

afterEach(async () => {
  await client.close();
  db.close();
});

describe('MCP tool registration', () => {
  it('exposes the five task tools', async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(
      ['archive_task', 'create_task', 'get_task', 'list_tasks', 'update_status'],
    );
  });
});

describe('create_task', () => {
  it('creates a task in backlog with a TASK-NNN id', async () => {
    const result = await client.callTool({
      name: 'create_task',
      arguments: { title: 'via mcp', priority: 'high' },
    });
    const task = parseResult(result as never);
    expect(task.id).toMatch(/^TASK-\d{3,}$/);
    expect(task.title).toBe('via mcp');
    expect(task.status).toBe('backlog');
    expect(task.priority).toBe('high');
    expect(task.archived).toBe(false);
  });
});

describe('list_tasks', () => {
  it('lists active tasks and excludes archived by default', async () => {
    const a = parseResult(
      (await client.callTool({ name: 'create_task', arguments: { title: 'keep' } })) as never,
    );
    const b = parseResult(
      (await client.callTool({ name: 'create_task', arguments: { title: 'gone' } })) as never,
    );
    await client.callTool({ name: 'archive_task', arguments: { id: b.id } });

    const list = parseResult(
      (await client.callTool({ name: 'list_tasks', arguments: {} })) as never,
    );
    const ids = list.map((t: { id: string }) => t.id);
    expect(ids).toContain(a.id);
    expect(ids).not.toContain(b.id);

    const withArchived = parseResult(
      (await client.callTool({
        name: 'list_tasks',
        arguments: { includeArchived: true },
      })) as never,
    );
    expect(withArchived.map((t: { id: string }) => t.id)).toContain(b.id);
  });
});

describe('get_task', () => {
  it('fetches an existing task by id', async () => {
    const created = parseResult(
      (await client.callTool({ name: 'create_task', arguments: { title: 'fetch me' } })) as never,
    );
    const got = parseResult(
      (await client.callTool({ name: 'get_task', arguments: { id: created.id } })) as never,
    );
    expect(got.id).toBe(created.id);
    expect(got.title).toBe('fetch me');
  });

  it('returns an MCP error for an unknown id', async () => {
    const result = (await client.callTool({
      name: 'get_task',
      arguments: { id: 'TASK-999' },
    })) as { isError?: boolean };
    expect(result.isError).toBe(true);
  });
});

describe('update_status', () => {
  it('moves a task forward one step', async () => {
    const created = parseResult(
      (await client.callTool({ name: 'create_task', arguments: { title: 'mover' } })) as never,
    );
    const moved = parseResult(
      (await client.callTool({
        name: 'update_status',
        arguments: { id: created.id, direction: 'forward' },
      })) as never,
    );
    expect(moved.status).toBe('todo');
  });

  it('rejects an illegal move (backward out of backlog) as an MCP error', async () => {
    const created = parseResult(
      (await client.callTool({ name: 'create_task', arguments: { title: 'boundary' } })) as never,
    );
    const result = (await client.callTool({
      name: 'update_status',
      arguments: { id: created.id, direction: 'backward' },
    })) as { isError?: boolean };
    expect(result.isError).toBe(true);
  });
});

describe('archive_task', () => {
  it('archives a task (idempotent)', async () => {
    const created = parseResult(
      (await client.callTool({ name: 'create_task', arguments: { title: 'archive me' } })) as never,
    );
    const first = parseResult(
      (await client.callTool({ name: 'archive_task', arguments: { id: created.id } })) as never,
    );
    expect(first.archived).toBe(true);

    const second = parseResult(
      (await client.callTool({ name: 'archive_task', arguments: { id: created.id } })) as never,
    );
    expect(second.archived).toBe(true);
  });

  it('returns an MCP error when archiving an unknown id', async () => {
    const result = (await client.callTool({
      name: 'archive_task',
      arguments: { id: 'TASK-777' },
    })) as { isError?: boolean };
    expect(result.isError).toBe(true);
  });
});
