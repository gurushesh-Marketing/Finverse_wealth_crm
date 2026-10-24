import { eq, and, lte, gt, sql } from 'drizzle-orm';
import { db } from './db';
import { sessions } from '../db/schema';
import { hashToken } from '../lib/session';

export async function createSessionRow(token: string, employeeId: string, ttlSeconds: number): Promise<void> {
  await db.insert(sessions).values({
    tokenHash: hashToken(token),
    employeeId,
    createdAt: sql`now()`,
    expiresAt: sql`now() + make_interval(secs => ${ttlSeconds})`,
    lastSeenAt: sql`now()`,
  });
}

export async function findSessionEmployeeId(token: string): Promise<string | null> {
  const deleted = await db
    .delete(sessions)
    .where(and(eq(sessions.tokenHash, hashToken(token)), lte(sessions.expiresAt, sql`now()`)))
    .returning({ employeeId: sessions.employeeId });

  if (deleted.length > 0) return null;

  const updated = await db
    .update(sessions)
    .set({ lastSeenAt: sql`now()` })
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, sql`now()`)))
    .returning({ employeeId: sessions.employeeId });

  return updated[0]?.employeeId ?? null;
}

export async function deleteSessionRow(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}
