// JSON Schemas for Fastify route validation (TASK-007, spec §4/§5.3).
//
// All request bodies use `additionalProperties: false`, so unknown or
// server-owned fields (`id`, `status` on PATCH, `archived`, `createdAt`,
// `updatedAt`) are rejected with 400 — never silently dropped (FR-10, Q2).
// Server-owned fields are simply not declared in any writable schema.

const STATUS_VALUES = ['backlog', 'todo', 'in_progress', 'review', 'done'] as const;
const PRIORITY_VALUES = ['low', 'medium', 'high', 'urgent'] as const;

/** Path id must be `TASK-` followed by >=3 digits (Q-B relaxed validator). */
export const ID_PATTERN = '^TASK-\\d{3,}$';

/** `POST /tasks` body: `title` required; optional `priority` / `description`. */
export const createTaskBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title'],
  properties: {
    title: { type: 'string', minLength: 1 },
    priority: { type: 'string', enum: PRIORITY_VALUES },
    description: { type: 'string' },
  },
} as const;

/**
 * `PATCH /tasks/{id}` body: at least one of `title`/`description`/`priority`.
 * `description` may be `null` to clear it. `status` and other server-owned
 * fields are absent here, so sending them → 400 (AC-14).
 */
export const updateTaskBodySchema = {
  type: 'object',
  additionalProperties: false,
  minProperties: 1,
  properties: {
    title: { type: 'string', minLength: 1 },
    description: { type: ['string', 'null'] },
    priority: { type: 'string', enum: PRIORITY_VALUES },
  },
} as const;

/** `:id` path param schema, shared by all single-resource routes. */
export const idParamSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: {
    id: { type: 'string', pattern: ID_PATTERN },
  },
} as const;

/**
 * `GET /tasks` querystring: optional `status` / `priority` filters and `archived`
 * flag. `priority` mirrors `status` — a lowercase enum value, so an empty
 * (`?priority=`) or unknown value fails enum validation → 400.
 * `additionalProperties: false` keeps unknown query keys a 400 too.
 */
export const listQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: STATUS_VALUES },
    priority: { type: 'string', enum: PRIORITY_VALUES },
    archived: { type: 'string', enum: ['true', 'false'] },
  },
} as const;

/** `POST /tasks/{id}/status` body: `{ "direction": "forward" | "backward" }`. */
export const statusBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['direction'],
  properties: {
    direction: { type: 'string', enum: ['forward', 'backward'] },
  },
} as const;

/**
 * `POST /tasks/{id}/archive` body: none expected. An empty or **absent** body is
 * accepted (Fastify passes `null` when there is no body, hence `'null'` in the
 * type union); any unknown field in a present object body → 400 (spec §4.6).
 */
export const archiveBodySchema = {
  type: ['object', 'null'],
  additionalProperties: false,
  properties: {},
} as const;
