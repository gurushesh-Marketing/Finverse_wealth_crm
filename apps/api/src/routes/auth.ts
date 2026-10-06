import { Router } from 'express';
import { parse as parseCookie, serialize as serializeCookie } from 'cookie';
import { loginRequestSchema, toZodFieldErrors, type SessionResponse } from '@finverse/contracts';
import { HttpError, errorBody, unauthenticated } from '../lib/errors';
import { verifyPassword } from '../lib/password';
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
} from '../lib/session';
import { loadAuthContextByEmail } from '../repo/users';
import { createSessionRow, deleteSessionRow, findSessionEmployeeId } from '../repo/sessions';
import { loadAuthContextByEmployeeId } from '../repo/users';
import type { AuthedRequest } from '../middleware/session';

const failures = new Map<string, { count: number; resetAt: number }>();
const MAX_FAILURES = 10;
const WINDOW_MS = 15 * 60 * 1000;

function recordFailure(key: string): number {
  const now = Date.now();
  if (failures.size > 1000) {
    for (const [k, v] of failures) {
      if (now > v.resetAt) failures.delete(k);
    }
    if (failures.size > 1000) failures.clear();
  }
  const entry = failures.get(key) ?? { count: 0, resetAt: now + WINDOW_MS };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + WINDOW_MS;
  }
  entry.count += 1;
  failures.set(key, entry);
  return entry.count;
}

export function authRouter(secureCookies: boolean): Router {
  const router = Router();

  router.post('/login', async (req, res, next) => {
    try {
      const parsed = loginRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(422)
          .json(errorBody('VALIDATION_FAILED', 'Check the highlighted fields.', { fieldErrors: toZodFieldErrors(parsed.error) }));
        return;
      }
      const { email, password } = parsed.data;
      const key = `${req.ip ?? 'ip'}|${email.toLowerCase()}`;
      const entry = failures.get(key);
      if (entry && entry.count >= MAX_FAILURES && Date.now() <= entry.resetAt) {
        res.status(429).json(errorBody('RATE_LIMITED', 'Too many attempts. Try again later.'));
        return;
      }

      // Demo-account access is disabled in production unless DEMO_ACCESS_ENABLED=true is set explicitly.
      const demoBlocked =
        process.env.NODE_ENV === 'production' &&
        process.env.DEMO_ACCESS_ENABLED !== 'true' &&
        email.toLowerCase().endsWith('@finverse.demo');
      const auth = demoBlocked ? null : await loadAuthContextByEmail(email);
      if (!auth || !verifyPassword(password, auth.passwordHash)) {
        recordFailure(key);
        res.status(401).json(errorBody('INVALID_CREDENTIALS', "We couldn't sign you in. Check your email and password."));
        return;
      }
      failures.delete(key);

      const token = createSessionToken();
      await createSessionRow(token, auth.employeeId, SESSION_TTL_SECONDS);
      res.setHeader(
        'Set-Cookie',
        serializeCookie(SESSION_COOKIE, token, {
          httpOnly: true,
          sameSite: 'strict',
          path: '/',
          maxAge: SESSION_TTL_SECONDS,
          secure: secureCookies,
        })
      );
      const body: SessionResponse = { session: auth.session };
      res.status(200).json(body);
    } catch (err) {
      next(err);
    }
  });

  router.post('/logout', async (req, res, next) => {
    try {
      const cookies = parseCookie(req.headers.cookie ?? '');
      const token = cookies[SESSION_COOKIE];
      if (token) await deleteSessionRow(token);
      res.setHeader(
        'Set-Cookie',
        serializeCookie(SESSION_COOKIE, '', {
          httpOnly: true,
          sameSite: 'strict',
          path: '/',
          maxAge: 0,
          secure: secureCookies,
        })
      );
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  router.get('/me', async (req: AuthedRequest, res, next) => {
    try {
      const cookies = parseCookie(req.headers.cookie ?? '');
      const token = cookies[SESSION_COOKIE];
      if (!token) throw unauthenticated();
      const employeeId = await findSessionEmployeeId(token);
      if (!employeeId) throw unauthenticated();
      const auth = await loadAuthContextByEmployeeId(employeeId);
      if (!auth) throw unauthenticated();
      const body: SessionResponse = { session: auth.session };
      res.status(200).json(body);
    } catch (err) {
      if (err instanceof HttpError) {
        res.status(err.status).json(errorBody(err.code, err.message));
        return;
      }
      next(err);
    }
  });

  return router;
}
