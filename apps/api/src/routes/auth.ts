import { Router } from 'express';
import { parse as parseCookie, serialize as serializeCookie } from 'cookie';
import {
  loginRequestSchema,
  toZodFieldErrors,
  type SessionResponse,
  changePasswordSchema,
  forgotPasswordRequestSchema,
} from '@finverse/contracts';
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

  // SA-01: User-Facing Token Consumption (Account Activation)
  router.post('/activate', async (req, res, next) => {
    try {
      const { token, password } = req.body ?? {};
      if (!token || typeof token !== 'string') {
        res.status(422).json(errorBody('VALIDATION_FAILED', 'Activation token is required.'));
        return;
      }
      if (!password || typeof password !== 'string' || password.length < 8) {
        res.status(422).json(errorBody('VALIDATION_FAILED', 'Password must be at least 8 characters.'));
        return;
      }
      const { consumeActivationToken } = await import('../repo/superadmin');
      const result = await consumeActivationToken({ token: token.trim(), password });
      res.status(200).json({ data: result });
    } catch (err: any) {
      const msg = err?.message || 'Activation failed';
      if (
        msg.startsWith('INVALID_TOKEN') ||
        msg.startsWith('TOKEN_ALREADY_USED') ||
        msg.startsWith('TOKEN_EXPIRED') ||
        msg.startsWith('ACCOUNT_INACTIVE')
      ) {
        res.status(422).json(errorBody('VALIDATION_FAILED', msg));
        return;
      }
      next(err);
    }
  });

  // SA-07: User-Facing Token Consumption (Password Recovery)
  router.post('/reset-password', async (req, res, next) => {
    try {
      const { token, password } = req.body ?? {};
      if (!token || typeof token !== 'string') {
        res.status(422).json(errorBody('VALIDATION_FAILED', 'Recovery token is required.'));
        return;
      }
      if (!password || typeof password !== 'string' || password.length < 8) {
        res.status(422).json(errorBody('VALIDATION_FAILED', 'Password must be at least 8 characters.'));
        return;
      }
      const { consumeAccountRecovery } = await import('../repo/superadmin');
      const result = await consumeAccountRecovery({ token: token.trim(), password });
      res.status(200).json({ data: result });
    } catch (err: any) {
      const msg = err?.message || 'Password reset failed';
      if (
        msg.startsWith('INVALID_TOKEN') ||
        msg.startsWith('TOKEN_ALREADY_USED') ||
        msg.startsWith('TOKEN_EXPIRED') ||
        msg.startsWith('ACCOUNT_INACTIVE')
      ) {
        res.status(422).json(errorBody('VALIDATION_FAILED', msg));
        return;
      }
      next(err);
    }
  });

  // SA-07 / Auth: Forgot Password (Neutral enumeration prevention + rate limited)
  const forgotFailures = new Map<string, { count: number; resetAt: number }>();
  const MAX_FORGOT_ATTEMPTS = 5;
  const FORGOT_WINDOW_MS = 15 * 60 * 1000;

  router.post('/forgot-password', async (req, res, next) => {
    try {
      const parsed = forgotPasswordRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(422).json(
          errorBody('VALIDATION_FAILED', 'Enter your work email or username.', {
            fieldErrors: toZodFieldErrors(parsed.error),
          })
        );
        return;
      }
      const { identity } = parsed.data;
      const key = `${req.ip ?? 'ip'}|${identity.toLowerCase()}`;
      const now = Date.now();
      const entry = forgotFailures.get(key) ?? { count: 0, resetAt: now + FORGOT_WINDOW_MS };
      if (now > entry.resetAt) {
        entry.count = 0;
        entry.resetAt = now + FORGOT_WINDOW_MS;
      }
      if (entry.count >= MAX_FORGOT_ATTEMPTS) {
        res
          .status(429)
          .json(
            errorBody(
              'RATE_LIMITED',
              'Too many password recovery requests. Please wait a few minutes before trying again.'
            )
          );
        return;
      }
      entry.count += 1;
      forgotFailures.set(key, entry);

      const { requestPasswordReset } = await import('../repo/superadmin');
      const result = await requestPasswordReset(identity, req.ip);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  });

  // Mandatory first login password change or authenticated self-service update
  router.post('/change-password', async (req: AuthedRequest, res, next) => {
    try {
      const cookies = parseCookie(req.headers.cookie ?? '');
      const token = cookies[SESSION_COOKIE];
      if (!token) throw unauthenticated();
      const employeeId = await findSessionEmployeeId(token);
      if (!employeeId) throw unauthenticated();

      const parsed = changePasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(422).json(
          errorBody('VALIDATION_FAILED', 'Check the highlighted fields.', {
            fieldErrors: toZodFieldErrors(parsed.error),
          })
        );
        return;
      }

      const { changeEmployeePassword } = await import('../repo/superadmin');
      const result = await changeEmployeePassword(employeeId, parsed.data.newPassword);
      res.status(200).json({ data: result });
    } catch (err) {
      if (err instanceof HttpError) {
        res.status(err.status).json(errorBody(err.code, err.message));
        return;
      }
      next(err);
    }
  });

  // Demo Delivery Adapter Outbox Inspector (Local delivery, no external email service)
  router.get('/local-delivery', async (req, res, next) => {
    try {
      const limit = Number(req.query.limit) || 20;
      const { listLocalDeliveryOutbox } = await import('../repo/superadmin');
      const data = await listLocalDeliveryOutbox(limit);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
