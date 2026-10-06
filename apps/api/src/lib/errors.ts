import type { ErrorCode, ErrorDetails, ErrorResponse } from '@finverse/contracts';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: ErrorDetails
  ) {
    super(message);
  }
}

export function errorBody(
  code: ErrorCode,
  message: string,
  details?: ErrorDetails
): ErrorResponse {
  return { error: { code, message, ...(details ? { details } : {}) } };
}

export function unauthenticated(): HttpError {
  return new HttpError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
}

export function notFound(): HttpError {
  return new HttpError(404, 'NOT_FOUND', 'Record not found or outside your scope.');
}

export function forbidden(message = 'You do not have permission for this action.'): HttpError {
  return new HttpError(403, 'FORBIDDEN', message);
}
