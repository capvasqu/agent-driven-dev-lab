// task-mcp — MCP server factory exposing the Kanban task operations as tools (Stage 3).
//
// Architecture: this server reuses the SAME core as the HTTP API — the
// `TaskRepository` + `domain` layer over the same SQLite database. HTTP (Stage 2)
// and MCP (Stage 3) are two thin adapters over one source of business logic, so
// changes made by Claude through these tools are the same rows the REST API sees
// (dogfooding).
//
// This module is side-effect free: `buildMcpServer()` registers the tools and
// returns the server, but does NOT open a transport — so tests can build it with
// an in-memory repository and drive it over an in-memory transport. The stdio
// entrypoint lives in `index.ts`.
//
// Note: an stdio MCP server must keep stdout clean for the protocol — never
// write logs to stdout in the entrypoint.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { TaskRepository } from '../repository/taskRepository.js';
import { targetState } from '../domain/transitions.js';

const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
const STATUSES = ['backlog', 'todo', 'in_progress', 'review', 'done'] as const;
const ID_REGEX = /^TASK-\d{3,}$/;

/** Wrap a successful result as MCP tool text content (JSON). */
function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

/** Wrap a domain failure (not found / illegal move) as an MCP tool error. */
function fail(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true };
}

/**
 * Build the `task-mcp` server, registering the five task tools against the given
 * repository. Pure factory — no transport is opened here.
 */
export function buildMcpServer(repository: TaskRepository): McpServer {
  const server = new McpServer({ name: 'task-mcp', version: '0.1.0' });

  server.registerTool(
    'create_task',
    {
      title: 'Create task',
      description:
        'Create a Kanban task. It enters the board in "backlog" with a server-assigned TASK-NNN id and UTC timestamps.',
      inputSchema: {
        title: z.string().min(1).describe('Task title (required, non-empty).'),
        priority: z.enum(PRIORITIES).optional().describe('Priority; defaults to "medium".'),
        description: z.string().optional().describe('Optional free-text description.'),
      },
    },
    async ({ title, priority, description }) => ok(repository.create({ title, priority, description })),
  );

  server.registerTool(
    'list_tasks',
    {
      title: 'List tasks',
      description:
        'List tasks ordered by priority (urgent→low) then creation time. Excludes archived tasks unless includeArchived is true. Optional status filter.',
      inputSchema: {
        status: z.enum(STATUSES).optional().describe('Filter by a single Kanban state.'),
        includeArchived: z.boolean().optional().describe('Include archived tasks (default false).'),
      },
    },
    async ({ status, includeArchived }) => ok(repository.list({ status, includeArchived })),
  );

  server.registerTool(
    'get_task',
    {
      title: 'Get task',
      description: 'Fetch a single task by its TASK-NNN id, including archived tasks.',
      inputSchema: {
        id: z.string().regex(ID_REGEX).describe('Task id, e.g. TASK-001.'),
      },
    },
    async ({ id }) => {
      const task = repository.getById(id);
      return task ? ok(task) : fail(`Task ${id} not found.`);
    },
  );

  server.registerTool(
    'update_status',
    {
      title: 'Move task status',
      description:
        'Move a task exactly one step forward or backward through backlog → todo → in_progress → review → done. Illegal moves (forward out of "done", backward out of "backlog") are rejected.',
      inputSchema: {
        id: z.string().regex(ID_REGEX).describe('Task id, e.g. TASK-001.'),
        direction: z.enum(['forward', 'backward']).describe('One-step move direction.'),
      },
    },
    async ({ id, direction }) => {
      const task = repository.getById(id);
      if (!task) {
        return fail(`Task ${id} not found.`);
      }
      const target = targetState(task.status, direction);
      if (!target) {
        return fail(`Illegal transition: cannot move ${direction} from '${task.status}'.`);
      }
      const updated = repository.setStatus(id, target);
      return updated ? ok(updated) : fail(`Task ${id} not found.`);
    },
  );

  server.registerTool(
    'archive_task',
    {
      title: 'Archive task',
      description:
        'Archive a task (soft). The row and id persist; archived tasks are hidden from the default list. Idempotent.',
      inputSchema: {
        id: z.string().regex(ID_REGEX).describe('Task id, e.g. TASK-001.'),
      },
    },
    async ({ id }) => {
      const task = repository.archive(id);
      return task ? ok(task) : fail(`Task ${id} not found.`);
    },
  );

  return server;
}
