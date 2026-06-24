// Error model and the stable error envelope (TASK-006, spec §5, FR-12).
//
// Every 4xx response body has the shape:
//   { "error": { "code": "VALIDATION_ERROR", "message": "title is required" } }
// Clients branch on `code` only; `message` carries the specifics.

/** Stable, distinct error codes — one per failure class (rest-api-conventions). */
export type ErrorCode = 'VALIDATION_ERROR' | 'NOT_FOUND' | 'ILLEGAL_TRANSITION';

/** The serialized error-envelope shape returned to clients. */
export interface ErrorEnvelope {
  error: {
    code: ErrorCode;
    message: string;
  };
}

/**
 * Domain/HTTP error carrying both the HTTP status and the envelope code.
 * Thrown by routes/repository and re-shaped by the Fastify error handler.
 */
export class ApiError extends Error {
  readonly httpStatus: number;
  readonly code: ErrorCode;

  constructor(httpStatus: number, code: ErrorCode, message: string) {
    super(message);
    this.name = 'ApiError';
    this.httpStatus = httpStatus;
    this.code = code;
  }

  /** 400 — malformed input (bad id, bad enum, unknown/server-owned field, empty PATCH). */
  static validation(message: string): ApiError {
    return new ApiError(400, 'VALIDATION_ERROR', message);
  }

  /** 404 — well-formed id with no matching row. */
  static notFound(message = 'task not found'): ApiError {
    return new ApiError(404, 'NOT_FOUND', message);
  }

  /** 409 — illegal status transition (boundary move out of `done` / `backlog`). */
  static illegalTransition(message: string): ApiError {
    return new ApiError(409, 'ILLEGAL_TRANSITION', message);
  }

  /** Build the stable envelope body for this error. */
  toEnvelope(): ErrorEnvelope {
    return { error: { code: this.code, message: this.message } };
  }
}

/** Build an envelope from raw parts (used by the error handler for non-ApiError cases). */
export function toEnvelope(code: ErrorCode, message: string): ErrorEnvelope {
  return { error: { code, message } };
}
