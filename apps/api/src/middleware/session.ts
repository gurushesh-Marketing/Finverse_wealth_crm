import type { NextFunction, Request, Response } from 'express';
import { parse as parseCookie } from 'cookie';
import type { AuthContext } from '../repo/users';
import { loadAuthContextByEmployeeId } from '../repo/users';
import { errorBody, unauthenticated, HttpError } from '../lib/errors';
import { SESSION_COOKIE } from '../lib/session';

export interface AuthedRequest extends Request {
  auth?: AuthContext;
}

export function jsonGuard(req: Request, res: Response, next: NextFunction): void {
  // HTML forms can only send GET/POST, so JSON-only enforcement on POST/PATCH/PUT
  // blocks cross-site form mutations; DELETE cannot come from a form at all.
  if (['POST', 'PATCH', 'PUT'].includes(req.method) && !req.is('json')) {
    res.status(415).json(errorBody('MEDIA_TYPE', 'Content-Type must be application/json.'));
    return;
  }
  next();
}

export async function requireSession(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const cookies = parseCookie(req.headers.cookie ?? '');
    const token = cookies[SESSION_COOKIE];
    if (!token) throw unauthenticated();
    const employeeId = await (await import('../repo/sessions')).findSessionEmployeeId(token);
    if (!employeeId) throw unauthenticated();
    const auth = await loadAuthContextByEmployeeId(employeeId);
    if (!auth) throw unauthenticated();
    req.auth = auth;
    next();
  } catch (err) {
    next(err);
  }
}

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof HttpError) {
    res.status(err.status).json(errorBody(err.code, err.message, err.details));
    return;
  }
  if (err?.type === 'entity.too.large') {
    res.status(413).json(errorBody('VALIDATION_FAILED', 'Request body is too large.'));
    return;
  }
  console.error('[api] unhandled error:', err);
  res.status(500).json(errorBody('INTERNAL', 'Something went wrong. Try again.'));
}
