/**
 * Finverse CRM — server-side authentication and session resolution.
 *
 * ONE shared login for all four verticals. After authentication the server
 * resolves the employee's effective role, vertical grants, team grants and
 * permissions into the WorkspaceSession contract; every repository read and
 * mutation receives that session explicitly and enforces scope server-side.
 * URL, role or vertical parameters grant nothing.
 */

import { cookies } from 'next/headers';
import type { Role, Vertical, WorkspaceSession } from '@/lib/session';
import { getDb, hashPassword, hashToken, newToken } from '@/lib/db';

export const SESSION_COOKIE = 'fv_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  employeeId: string;
  role: Role;
  vertical: Vertical;
  teamId: string;
  teamName: string;
  assignmentId: string;
  effectiveFrom: string;
  permissionVersion: string;
  /** False when the user has no active assignment — the "access pending" state. */
  hasActiveAssignment: boolean;
}

// Grant parity with the WorkspaceSession fixture contract (lib/session.ts):
// SC workload actions only — never more than the fixture allowed.
const SC_ACTIONS = [
  'prospect.create',
  'prospect.read',
  'prospect.update',
  'prospect.delete',
  'activity.create',
  'activity.read',
  'activity.update',
  'deal.create',
  'deal.read',
  'deal.update',
  'deal.stage-transition',
  'report.read:personal',
  'enquiry.create',
  'lead.correct',
  'call.place',
  'call.wrapup',
  'activity.manual.create',
  'whatsapp.send',
  'conversation.handle',
  'task.manage',
  'task.reschedule',
  'meeting.book',
  'qualification.edit',
  'pipeline.move',
  'proposal.create',
  'document.request',
  'document.upload',
  'conversion.submit',
  'loss.record',
  'reopen.request',
  'handoff.request',
  'consent.record',
  'complaint.record',
  'report.export',
  'review.acknowledge',
  'help.raise',
  'availability.update',
  'savedview.manage',
];

export async function verifyCredentials(email: string, password: string): Promise<AuthUser | null> {
  const db = getDb();
  const row = db
    .prepare('SELECT id, email, display_name, employee_id, password_hash, password_salt FROM users WHERE email = ?')
    .get(email.trim().toLowerCase()) as
    | { id: string; email: string; display_name: string; employee_id: string; password_hash: string; password_salt: string }
    | undefined;
  if (!row) return null;
  const hash = hashPassword(password, row.password_salt);
  if (hash !== row.password_hash) return null;
  return loadAuthUser(row.id);
}

function loadAuthUser(userId: string): AuthUser | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.display_name, u.employee_id,
              a.id AS assignment_id, a.role, a.vertical, a.team_id, a.team_name,
              a.effective_from, a.permission_version
       FROM users u LEFT JOIN assignments a ON a.user_id = u.id AND a.active = 1
       WHERE u.id = ?`
    )
    .get(userId) as
    | {
        id: string;
        email: string;
        display_name: string;
        employee_id: string;
        assignment_id: string | null;
        role: Role | null;
        vertical: Vertical | null;
        team_id: string | null;
        team_name: string | null;
        effective_from: string | null;
        permission_version: string | null;
      }
    | undefined;
  if (!row) return null;
  const hasActiveAssignment = row.assignment_id !== null;
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    employeeId: row.employee_id,
    role: row.role ?? 'SC',
    vertical: row.vertical ?? 'wealth',
    teamId: row.team_id ?? '',
    teamName: row.team_name ?? '',
    assignmentId: row.assignment_id ?? '',
    effectiveFrom: row.effective_from ?? '',
    permissionVersion: row.permission_version ?? '',
    hasActiveAssignment,
  };
}

export async function createSession(userId: string): Promise<void> {
  const db = getDb();
  const token = newToken();
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_TTL_MS);
  db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(
    hashToken(token),
    userId,
    now.toISOString(),
    expires.toISOString()
  );
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    expires: expires,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    getDb().prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
  }
  jar.delete(SESSION_COOKIE);
}

export async function getSessionUser(): Promise<AuthUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = getDb()
    .prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash = ?')
    .get(hashToken(token)) as { user_id: string; expires_at: string } | undefined;
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  return loadAuthUser(row.user_id);
}

/** Resolve identity, role and scope from the server session. */
export async function resolveWorkspaceSession(): Promise<{ user: AuthUser; session: WorkspaceSession } | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const session: WorkspaceSession = {
    employeeId: user.employeeId,
    role: user.role,
    activeAssignmentId: user.assignmentId,
    verticalGrants: [user.vertical],
    teamGrants: user.hasActiveAssignment ? [user.teamId] : [],
    allowedActions: user.hasActiveAssignment
      ? user.role === 'SC' ? SC_ACTIONS : [...SC_ACTIONS, 'report.read:team']
      : [],
    effectiveFrom: user.effectiveFrom,
    permissionVersion: user.permissionVersion,
  };
  return { user, session };
}
