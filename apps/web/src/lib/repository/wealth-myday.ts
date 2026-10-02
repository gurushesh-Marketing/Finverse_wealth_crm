/**
 * Finverse CRM — Wealth "My day" repository (SC-01).
 *
 * Session-scoped SQL reads for the Wealth caller's start-of-day dashboard.
 * Mirrors the scope rules in db-repository.ts: SC sees own assigned leads
 * within granted vertical and team; every wider query is denied by default.
 * Server components must call resolveWorkspaceSession() and pass the result.
 */

import { getDb } from '@/lib/db';
import type { WorkspaceSession } from '@/lib/session';
import type { AvailabilityInput } from './types';

export type AvailabilityStatus = 'available' | 'busy' | 'away';
export type ProviderStatus = 'connected' | 'delayed';

export interface MyDayLead {
  id: string;
  displayName: string;
  product: string;
  stage: string;
  nextAction: string;
  dueAt: string;
  isOverdue: boolean;
}

export interface MyDayTask {
  id: string;
  leadId: string;
  leadName: string;
  title: string;
  dueAt: string;
  priority: string;
  status: string;
  kind: string;
  isOverdue: boolean;
}

export interface MyDayAvailability {
  status: AvailabilityStatus;
  note?: string;
  effectiveAt: string;
}

export interface MyDayData {
  asOf: string;
  leads: MyDayLead[];
  tasks: MyDayTask[];
  counts: {
    activeAssigned: number;
    dueToday: number;
    overdue: number;
    openTasks: number;
    verifiedActivity: number;
    promisedCallbacks: number;
    uncontactedToday: number;
    repliesToReview: number;
  };
  lastVerifiedAt: string | null;
  availability: MyDayAvailability | null;
  providerStatus: ProviderStatus;
}

const ACTIVE_STAGES = new Set(['not-contacted', 'contacted', 'follow-up', 'qualified']);

function scopeFor(session: WorkspaceSession, alias: string): { sql: string; params: string[] } {
  const col = (c: string) => `${alias}.${c}`;
  const verticals = session.verticalGrants;
  const vPlace = verticals.map(() => '?').join(', ');
  if (session.allowedActions.includes('*')) {
    return { sql: `${col('vertical')} IN (${vPlace})`, params: [...verticals] };
  }
  if (session.role === 'SC') {
    return {
      sql: `${col('vertical')} IN (${vPlace}) AND ${col('team_id')} = ? AND ${col('employee_id')} = ?`,
      params: [...verticals, session.teamGrants[0] ?? '', session.employeeId],
    };
  }
  const teams = session.teamGrants.length ? session.teamGrants : [''];
  return {
    sql: `${col('vertical')} IN (${vPlace}) AND ${col('team_id')} IN (${teams.map(() => '?').join(', ')})`,
    params: [...verticals, ...teams],
  };
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function isDueToday(iso: string): boolean {
  const d = new Date(iso);
  const start = startOfToday();
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return d >= start && d < end;
}

export async function getMyDay(session: WorkspaceSession): Promise<MyDayData> {
  const db = getDb();
  const scope = scopeFor(session, 'l');

  const leadRows = db
    .prepare(
      `SELECT id, display_name, product, stage, next_action, due_at
       FROM leads l
       WHERE l.reassigned_away = 0 AND ${scope.sql}
       ORDER BY l.due_at ASC, l.id ASC`
    )
    .all(...scope.params) as Array<{
    id: string;
    display_name: string;
    product: string;
    stage: string;
    next_action: string;
    due_at: string;
  }>;

  const leads: MyDayLead[] = leadRows.map((r) => ({
    id: r.id,
    displayName: r.display_name,
    product: r.product,
    stage: r.stage,
    nextAction: r.next_action,
    dueAt: r.due_at,
    isOverdue: new Date(r.due_at).getTime() < Date.now(),
  }));

  const taskRows = db
    .prepare(
      `SELECT t.id, t.lead_id, t.title, t.due_at, t.priority, t.status, t.kind, l.display_name AS lead_name
       FROM lead_tasks t
       JOIN leads l ON l.id = t.lead_id
       WHERE t.status = 'open' AND l.reassigned_away = 0 AND ${scope.sql}
       ORDER BY t.due_at ASC, t.id ASC`
    )
    .all(...scope.params) as Array<{
    id: string;
    lead_id: string;
    title: string;
    due_at: string;
    priority: string;
    status: string;
    kind: string;
    lead_name: string;
  }>;

  const tasks: MyDayTask[] = taskRows.map((r) => ({
    id: r.id,
    leadId: r.lead_id,
    leadName: r.lead_name,
    title: r.title,
    dueAt: r.due_at,
    priority: r.priority,
    status: r.status,
    kind: r.kind,
    isOverdue: new Date(r.due_at).getTime() < Date.now(),
  }));

  const callRows = db
    .prepare(
      `SELECT c.wrapup_saved_at
       FROM calls c
       JOIN leads l ON l.id = c.lead_id
       WHERE c.wrapup_saved_at IS NOT NULL AND l.reassigned_away = 0 AND ${scope.sql}`
    )
    .all(...scope.params) as Array<{ wrapup_saved_at: string }>;

  const replyRow = db
    .prepare(
      `SELECT COUNT(*) AS n
       FROM messages m
       JOIN leads l ON l.id = m.lead_id
       WHERE m.direction = 'inbound' AND m.handled = 0 AND l.reassigned_away = 0 AND ${scope.sql}`
    )
    .get(...scope.params) as { n: number } | undefined;

  const avRow = db
    .prepare(
      `SELECT status, note, effective_at
       FROM availability_events
       WHERE employee_id = ?
       ORDER BY created_at DESC, effective_at DESC LIMIT 1`
    )
    .get(session.employeeId) as { status: string; note: string | null; effective_at: string } | undefined;

  const activeLeads = leads.filter((l) => ACTIVE_STAGES.has(l.stage));
  const overdueLeads = activeLeads.filter((l) => l.isOverdue);
  const dueTodayLeads = activeLeads.filter((l) => isDueToday(l.dueAt));
  const promisedCallbacks = tasks.filter((t) => t.kind === 'follow-up' && (t.isOverdue || isDueToday(t.dueAt))).length;
  const uncontactedToday = activeLeads.filter((l) => l.stage === 'not-contacted').length;
  const lastVerifiedAt = callRows.length
    ? callRows.map((r) => r.wrapup_saved_at).sort().at(-1) ?? null
    : null;

  return {
    asOf: new Date().toISOString(),
    leads,
    tasks,
    counts: {
      activeAssigned: activeLeads.length,
      dueToday: dueTodayLeads.length,
      overdue: overdueLeads.length,
      openTasks: tasks.length,
      verifiedActivity: callRows.length,
      promisedCallbacks,
      uncontactedToday,
      repliesToReview: replyRow?.n ?? 0,
    },
    lastVerifiedAt,
    availability: avRow
      ? {
          status: (avRow.status === 'busy' || avRow.status === 'away' ? avRow.status : 'available') as AvailabilityStatus,
          note: avRow.note ?? undefined,
          effectiveAt: avRow.effective_at,
        }
      : null,
    providerStatus: getProviderStatus(),
  };
}

export async function saveAvailability(
  session: WorkspaceSession,
  input: AvailabilityInput
): Promise<{ ok: true; status: AvailabilityStatus; effectiveAt: string } | { ok: false; error: string }> {
  if (!session.allowedActions.includes('availability.update')) {
    return { ok: false, error: 'Your current assignment does not permit availability changes.' };
  }
  const status = input.status;
  if (status !== 'available' && status !== 'busy' && status !== 'away') {
    return { ok: false, error: 'Choose Available, Busy or Away.' };
  }
  const note = input.note?.trim() ?? '';
  const nowIso = new Date().toISOString();
  getDb()
    .prepare(
      'INSERT INTO availability_events (id, employee_id, status, note, effective_at, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(`AVL-${Date.now()}`, session.employeeId, status, note || null, nowIso, nowIso);
  return { ok: true, status, effectiveAt: nowIso };
}

/** Agreed demo simulator contract; the later dialer wave reads/writes the same key. */
export function getProviderStatus(): ProviderStatus {
  const row = getDb().prepare("SELECT value FROM meta WHERE key = 'provider.simulated.status'").get() as
    | { value: string }
    | undefined;
  return row?.value === 'delayed' ? 'delayed' : 'connected';
}

export function setProviderStatus(status: ProviderStatus): void {
  getDb()
    .prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('provider.simulated.status', ?)")
    .run(status);
}
