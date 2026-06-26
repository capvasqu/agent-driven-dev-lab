import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { ApiError } from '../errors.js';
import { targetState } from '../domain/transitions.js';
import type {
  CreateTaskInput,
  Direction,
  Priority,
  Status,
  UpdateTaskInput,
} from '../domain/types.js';
import type { TaskRepository } from '../repository/taskRepository.js';
import {
  archiveBodySchema,
  createTaskBodySchema,
  idParamSchema,
  listQuerySchema,
  statusBodySchema,
  updateTaskBodySchema,
} from '../validation/schemas.js';

// Route registrations for `/tasks` and the action sub-resources (TASK-009).
//
// Check order per request (spec §5.2): id format → body/query schema → existence
// (404) → transition legality (409). Fastify validates params/body/query against
// the JSON Schemas *before* the handler runs, so id-format and schema checks come
// first automatically; handlers then do existence and transition checks.

interface RepositoryOptions extends FastifyPluginOptions {
  repository: TaskRepository;
}

interface IdParams {
  id: string;
}

interface ListQuery {
  status?: Status;
  priority?: Priority;
  archived?: 'true' | 'false';
}

export function registerTaskRoutes(
  app: FastifyInstance,
  options: RepositoryOptions,
): void {
  const repo = options.repository;

  // POST /tasks — create (FR-3, AC-1, AC-13).
  app.post<{ Body: CreateTaskInput }>(
    '/tasks',
    { schema: { body: createTaskBodySchema } },
    (request, reply) => {
      const task = repo.create(request.body);
      reply.code(201).send(task);
    },
  );

  // GET /tasks — list with optional filters (FR-4, AC-3, AC-4, AC-5).
  app.get<{ Querystring: ListQuery }>(
    '/tasks',
    { schema: { querystring: listQuerySchema } },
    (request, reply) => {
      const { status, priority, archived } = request.query;
      const tasks = repo.list({
        status,
        priority,
        includeArchived: archived === 'true',
      });
      reply.code(200).send(tasks);
    },
  );

  // GET /tasks/:id — read one, including archived (FR-5, AC-6, AC-12).
  app.get<{ Params: IdParams }>(
    '/tasks/:id',
    { schema: { params: idParamSchema } },
    (request, reply) => {
      const task = repo.getById(request.params.id);
      if (!task) {
        throw ApiError.notFound();
      }
      reply.code(200).send(task);
    },
  );

  // PATCH /tasks/:id — update content only; never status (FR-6, AC-7, AC-14).
  app.patch<{ Params: IdParams; Body: UpdateTaskInput }>(
    '/tasks/:id',
    { schema: { params: idParamSchema, body: updateTaskBodySchema } },
    (request, reply) => {
      const task = repo.update(request.params.id, request.body);
      if (!task) {
        throw ApiError.notFound();
      }
      reply.code(200).send(task);
    },
  );

  // POST /tasks/:id/status — one-step move (FR-7, AC-8, AC-9, AC-10).
  app.post<{ Params: IdParams; Body: { direction: Direction } }>(
    '/tasks/:id/status',
    { schema: { params: idParamSchema, body: statusBodySchema } },
    (request, reply) => {
      const existing = repo.getById(request.params.id);
      if (!existing) {
        throw ApiError.notFound();
      }
      const target = targetState(existing.status, request.body.direction);
      if (target === null) {
        throw ApiError.illegalTransition(
          `cannot move ${request.body.direction} from '${existing.status}'`,
        );
      }
      const task = repo.setStatus(request.params.id, target);
      reply.code(200).send(task);
    },
  );

  // POST /tasks/:id/archive — idempotent archive (FR-8, AC-11).
  app.post<{ Params: IdParams }>(
    '/tasks/:id/archive',
    { schema: { params: idParamSchema, body: archiveBodySchema } },
    (request, reply) => {
      const task = repo.archive(request.params.id);
      if (!task) {
        throw ApiError.notFound();
      }
      reply.code(200).send(task);
    },
  );
}
