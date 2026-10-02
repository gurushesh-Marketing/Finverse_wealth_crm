/**
 * Finverse CRM — Wealth lead inbox repository (SC-02).
 *
 * Session-scoped SQL for the /wealth/prospects queue and the saved-view
 * store. Mirrors db-repository.ts scope rules: SC sees own assigned leads
 * within granted vertical + team; deny by default. Saved views store filters
 * only — never a reusable copy of customer data.
 */

import { getDb } from '@/lib/db';
import type { WorkspaceSession } from '@/lib/session';
import type {
  Lead,
  LeadOwnershipEntry,
  LeadStage,
  PaginatedResult,
  SavedView,
} from './types';

type LeadRow = {
  id: string;
  vertical: Lead['vertical'];
  team_id: string;
  employee_id: string;
  display_name: string;
  masked_phone: string;
  email: string | null;
  product: string;
  source: string;
  source_detail: string | null;
  stage: LeadStage;
  next_action: string;
  due_at: string;
  contact_eligible: number;
  owner_name: string;
  owner_team_name: string;
  ownership_history: string;
  reassigned_away: number;
  created_at: string;
  updated_at: string;
};

function mapLead(r: LeadRow): Lead {
  return {
    id: r.id,
    vertical: r.vertical,
    teamId: r.team_id,
    employeeId: r.employee_id,
    displayName: r.display_name,
    maskedPhone: r.masked_phone,
    email: r.email ?? undefined,
    product: r.product,
    source: r.source,
    sourceDetail: r.source_detail ?? undefined,
    stage: r.stage,
    nextAction: r.next_action,
    dueAt: r.due_at,
    contactEligible: r.contact_eligible === 1,
    ownerName: r.owner_name,
    ownerTeamName: r.owner_team_name,
    ownershipHistory: JSON.parse(r.ownership_history) as LeadOwnershipEntry[],
    reassignedAway: r.reassigned_away === 1,
    isOverdue: new Date(r.due_at).getTime() < Date.now(),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/**
 * Scope rule (deny by default):
 * - wildcard/CEO sessions: vertical grants only;
 * - SC: own assigned leads within granted verticals and teams;
 * - team-scoped roles (TL and up): granted teams within granted verticals.
 */
function scopeClause(session: WorkspaceSession): { sql: string; params: string[] } {
  const verticals = session.verticalGrants;
  const vPlace = verticals.map(() => '?').join(', ');
  if (session.allowedActions.includes('*')) {
    return { sql: `vertical IN (${vPlace})`, params: verticals };
  }
  if (session.role === 'SC') {
    return {
      sql: `vertical IN (${vPlace}) AND team_id = ? AND employee_id = ?`,
      params: [...verticals, session.teamGrants[0] ?? '', session.employeeId],
    };
  }
  const teams = session.teamGrants.length ? session.teamGrants : [''];
  return {
    sql: `vertical IN (${vPlace}) AND team_id IN (${teams.map(() => '?').join(', ')})`,
    params: [...verticals, ...teams],
  };
}

export interface InboxFilters {
  search?: string;
  stage?: LeadStage[];
  source?: string[];
  product?: string[];
  due?: 'all' | 'overdue' | 'today' | 'week';
  page?: number;
  pageSize?: number;
}

function buildWhere(
  session: WorkspaceSession,
  filters?: InboxFilters
): { where: string[]; params: string[] } {
  const scope = scopeClause(session);
  const where: string[] = [scope.sql, 'reassigned_away = 0'];
  const params: string[] = [...scope.params];
  if (filters?.search) {
    where.push('(id LIKE ? OR display_name LIKE ?)');
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }
  if (filters?.stage?.length) {
    where.push(`stage IN (${filters.stage.map(() => '?').join(', ')})`);
    params.push(...filters.stage);
  }
  if (filters?.source?.length) {
    where.push(`source IN (${filters.source.map(() => '?').join(', ')})`);
    params.push(...filters.source);
  }
  if (filters?.product?.length) {
    where.push(`product IN (${filters.product.map(() => '?').join(', ')})`);
    params.push(...filters.product);
  }
  const due = filters?.due ?? 'all';
  if (due === 'overdue') {
    where.push('due_at < ?');
    params.push(new Date().toISOString());
  } else if (due === 'today') {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    where.push('due_at >= ? AND due_at < ?');
    params.push(start.toISOString(), end.toISOString());
  } else if (due === 'week') {
    const now = new Date();
    const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    where.push('due_at >= ? AND due_at < ?');
    params.push(now.toISOString(), end.toISOString());
  }
  return { where, params };
}

export async function getLeads(
  session: WorkspaceSession,
  filters?: InboxFilters
): Promise<PaginatedResult<Lead>> {
  const db = getDb();
  const { where, params } = buildWhere(session, filters);
  const countRow = db
    .prepare(`SELECT COUNT(*) AS n FROM leads WHERE ${where.join(' AND ')}`)
    .get(...params) as { n: number };
  const total = countRow.n;
  const pageSize = Math.max(1, filters?.pageSize ?? 10);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, filters?.page ?? 1), totalPages);
  const offset = (page - 1) * pageSize;
  const rows = db
    .prepare(
      `SELECT * FROM leads WHERE ${where.join(' AND ')} ORDER BY due_at ASC, id ASC LIMIT ? OFFSET ?`
    )
    .all(...params, pageSize, offset) as LeadRow[];
  return {
    items: rows.map(mapLead),
    total,
    page,
    pageSize,
    totalPages,
  };
}

export async function getDistinctSources(session: WorkspaceSession): Promise<string[]> {
  const scope = scopeClause(session);
  const rows = getDb()
    .prepare(
      `SELECT DISTINCT source FROM leads WHERE ${scope.sql} AND reassigned_away = 0 ORDER BY source ASC`
    )
    .all(...scope.params) as Array<{ source: string }>;
  return rows.map((r) => r.source);
}

export async function getDistinctProducts(session: WorkspaceSession): Promise<string[]> {
  const scope = scopeClause(session);
  const rows = getDb()
    .prepare(
      `SELECT DISTINCT product FROM leads WHERE ${scope.sql} AND reassigned_away = 0 ORDER BY product ASC`
    )
    .all(...scope.params) as Array<{ product: string }>;
  return rows.map((r) => r.product);
}

export async function getSavedViews(session: WorkspaceSession): Promise<SavedView[]> {
  const rows = getDb()
    .prepare(
      'SELECT id, employee_id, name, filters_json, created_at FROM saved_views WHERE employee_id = ? ORDER BY created_at DESC, id DESC'
    )
    .all(session.employeeId) as Array<{
    id: string;
    employee_id: string;
    name: string;
    filters_json: string | null;
    created_at: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    employeeId: r.employee_id,
    name: r.name,
    filtersJson: r.filters_json ?? undefined,
    createdAt: r.created_at,
  }));
}

export async function saveView(
  session: WorkspaceSession,
  name: string,
  filtersJson: string
): Promise<{ ok: boolean; error?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: 'View name is required.' };
  const db = getDb();
  const existing = db
    .prepare('SELECT id FROM saved_views WHERE employee_id = ? AND name = ?')
    .get(session.employeeId, trimmed) as { id: string } | undefined;
  if (existing) return { ok: false, error: 'A saved view with this name already exists.' };
  db.prepare(
    'INSERT INTO saved_views (id, employee_id, name, filters_json, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(`SV-${Date.now()}`, session.employeeId, trimmed, filtersJson, new Date().toISOString());
  return { ok: true };
}

export async function deleteView(session: WorkspaceSession, id: string): Promise<void> {
  getDb()
    .prepare('DELETE FROM saved_views WHERE id = ? AND employee_id = ?')
    .run(id, session.employeeId);
}
