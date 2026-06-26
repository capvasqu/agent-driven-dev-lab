import Fastify from 'fastify';
import type { FastifyError, FastifyInstance } from 'fastify';
import type { Config } from './config.js';
import { openDatabase } from './db/connection.js';
import { createSchema } from './db/schema.js';
import { ApiError, toEnvelope } from './errors.js';
import { registerTaskRoutes } from './routes/tasks.js';
import { TaskRepository } from './repository/taskRepository.js';

// Server assembly (TASK-010, TASK-012). `buildServer()` creates the Fastify
// instance, opens the DB, runs the schema, registers the error handler and the
// routes, and returns the app WITHOUT listening — so Stage 4 can build the app
// in-process for testing. `src/index.ts` owns the actual `listen`.

export function buildServer(config: Config): FastifyInstance {
  // Fastify's Ajv defaults to `removeAdditional: true`, which silently strips
  // unknown / server-owned fields instead of rejecting them. Disable it so the
  // schemas' `additionalProperties: false` yields a 400 as the spec requires
  // (FR-10, Q2 — strict input).
  const app = Fastify({
    // Quiet during tests (vitest sets NODE_ENV=test); request logging on otherwise.
    logger: process.env.NODE_ENV !== 'test',
    ajv: { customOptions: { removeAdditional: false } },
  });

  // DB + schema bootstrap on startup (idempotent).
  const db = openDatabase(config.dbPath);
  createSchema(db);
  const repository = new TaskRepository(db);

  // Custom error handler: re-shape both Fastify schema-validation failures and
  // thrown ApiErrors into the stable envelope, so clients never see Fastify's
  // default validation body (spec §5.3, FR-12, AC-15).
  app.setErrorHandler((error: FastifyError, _request, reply) => {
    // Thrown domain errors (404, 409, explicit 400).
    if (error instanceof ApiError) {
      reply.code(error.httpStatus).send(error.toEnvelope());
      return;
    }

    // Fastify schema-validation failures → 400 VALIDATION_ERROR.
    if (error.validation) {
      reply.code(400).send(toEnvelope('VALIDATION_ERROR', error.message));
      return;
    }

    // Malformed JSON body and other client errors Fastify flags as 4xx.
    if (typeof error.statusCode === 'number' && error.statusCode >= 400 && error.statusCode < 500) {
      reply.code(error.statusCode).send(toEnvelope('VALIDATION_ERROR', error.message));
      return;
    }

    // Anything else is a genuine server fault.
    app.log.error(error);
    reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'internal server error' } });
  });

  // Close the DB when the server stops (clean shutdown / Stage 4 teardown).
  app.addHook('onClose', (_instance, done) => {
    db.close();
    done();
  });

  registerTaskRoutes(app, { repository });

  return app;
}
