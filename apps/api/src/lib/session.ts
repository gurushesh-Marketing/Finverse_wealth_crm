import { createHash, randomBytes } from 'node:crypto';

export const SESSION_COOKIE = 'fv_session';
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

export function createSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
