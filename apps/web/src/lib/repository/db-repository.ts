/**
 * Finverse CRM — database-backed lead repository (local node:sqlite store).
 *
 * Implements the preserved IWealthLeadRepository contract plus follow-up
 * writes. Every method takes the WorkspaceSession explicitly and enforces
 * scope in the query itself: URL or parameter tampering cannot widen it.
 */

import { getDb } from '@/lib/db';
import type { WorkspaceSession } from '@/lib/session';
import type {
  IWealthLeadRepository,
  Lead,
  LeadActivity,
  LeadFilters,
  LeadOwnershipEntry,
  LeadStage,
  LeadTask,
  PaginatedResult,
} from './types';
import type { FollowUpInput, ILeadFollowUpRepository } from './types';

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
    vertical: r.vertical as Lead['vertical'],
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

function paginate<T>(items: T[], page = 1, pageSize = 50): PaginatedResult<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  return {
    items: items.slice((safePage - 1) * pageSize, safePage * pageSize),
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

export class DbLeadRepository implements IWealthLeadRepository, ILeadFollowUpRepository {
  async getLeads(session: WorkspaceSession, filters?: LeadFilters): Promise<PaginatedResult<Lead>> {
    const db = getDb();
    const scope = scopeClause(session);
    const where: string[] = [scope.sql];
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
    if (filters?.due === 'overdue') {
      where.push('due_at < ?');
      params.push(new Date().toISOString());
    } else if (filters?.due === 'today') {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      where.push('due_at >= ? AND due_at < ?');
      params.push(start.toISOString(), end.toISOString());
    }
    const order = filters?.sortBy === 'due-asc' ? 'due_at ASC' : 'due_at ASC';
    const rows = db
      .prepare(`SELECT * FROM leads WHERE ${where.join(' AND ')} ORDER BY ${order}, id ASC`)
      .all(...params) as LeadRow[];
    const mapped = rows.map(mapLead).filter((l) => !l.reassignedAway);
    if (filters?.sortBy !== 'due-asc') {
      mapped.sort((a, b) => (a.dueAt < b.dueAt ? -1 : a.dueAt > b.dueAt ? 1 : 0));
    }
    return paginate(mapped, filters ? 1 : 1);
  }

  async getLead(session: WorkspaceSession, id: string): Promise<Lead | null> {
    const db = getDb();
    const scope = scopeClause(session);
    const row = db.prepare(`SELECT * FROM leads WHERE id = ? AND ${scope.sql}`).get(id, ...scope.params) as
      | LeadRow
      | undefined;
    if (!row) return null;
    const lead = mapLead(row);
    return lead.reassignedAway ? null : lead;
  }

  async getLeadActivities(session: WorkspaceSession, leadId: string): Promise<PaginatedResult<LeadActivity>> {
    if (!(await this.getLead(session, leadId))) return paginate<LeadActivity>([]);
    const rows = getDb()
      .prepare('SELECT * FROM lead_activities WHERE lead_id = ? ORDER BY event_at DESC, created_at DESC')
      .all(leadId) as Array<{
      id: string;
      lead_id: string;
      actor: string;
      type: LeadActivity['type'];
      subject: string;
      description: string | null;
      outcome: string | null;
      event_at: string;
      created_at: string;
    }>;
    return paginate(
      rows.map((r) => ({
        id: r.id,
        leadId: r.lead_id,
        actor: r.actor,
        type: r.type,
        subject: r.subject,
        description: r.description ?? undefined,
        outcome: r.outcome ?? undefined,
        eventAt: r.event_at,
        createdAt: r.created_at,
      }))
    );
  }

  async getLeadTasks(session: WorkspaceSession, leadId: string): Promise<PaginatedResult<LeadTask>> {
    if (!(await this.getLead(session, leadId))) return paginate<LeadTask>([]);
    const rows = getDb()
      .prepare('SELECT * FROM lead_tasks WHERE lead_id = ? ORDER BY status ASC, due_at ASC')
      .all(leadId) as Array<{
      id: string;
      lead_id: string;
      title: string;
      due_at: string;
      priority: LeadTask['priority'];
      status: LeadTask['status'];
      reminder_at: string | null;
      created_at: string;
    }>;
    return paginate(
      rows.map((r) => ({
        id: r.id,
        leadId: r.lead_id,
        title: r.title,
        dueAt: r.due_at,
        priority: r.priority,
        status: r.status,
        reminderAt: r.reminder_at ?? undefined,
        createdAt: r.created_at,
      }))
    );
  }

  /** SC-11 follow-up save: validated by the caller; authorized here again. */
  async saveFollowUp(session: WorkspaceSession, input: FollowUpInput): Promise<{ ok: true; taskId: string } | { ok: false; error: string }> {
    const lead = await this.getLead(session, input.leadId);
    if (!lead) return { ok: false, error: 'Lead is not in your permitted workload.' };
    if (!input.action.trim()) return { ok: false, error: 'Next action is required.' };
    if (!input.purpose.trim()) return { ok: false, error: 'Purpose is required.' };
    const due = new Date(input.dueAt);
    if (Number.isNaN(due.getTime()) || due.getTime() <= Date.now()) {
      return { ok: false, error: 'Due date and time must be in the future.' };
    }
    const db = getDb();
    const nowIso = new Date().toISOString();
    const taskId = `TASK-${Date.now()}`;
    db.prepare(
      'INSERT INTO lead_tasks (id, lead_id, title, due_at, priority, status, purpose, reminder_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(taskId, lead.id, input.action.trim(), due.toISOString(), input.priority, 'open', input.purpose.trim(), input.reminderAt ?? null, nowIso);
    db.prepare(
      'INSERT INTO lead_activities (id, lead_id, actor, type, subject, description, event_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(`ACT-${Date.now()}`, lead.id, session.employeeId, 'task', `Follow-up scheduled: ${input.action.trim()}`, input.purpose.trim(), due.toISOString(), nowIso);
    db.prepare('UPDATE leads SET next_action = ?, due_at = ?, updated_at = ? WHERE id = ?').run(
      input.action.trim(),
      due.toISOString(),
      nowIso,
      lead.id
    );
    return { ok: true, taskId };
  }

  async getQueueCounts(session: WorkspaceSession): Promise<{ total: number; overdue: number; dueToday: number }> {
    const all = await this.getLeads(session, { sortBy: 'due-asc' });
    const now = new Date();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const overdue = all.items.filter((l) => new Date(l.dueAt) < now).length;
    const dueToday = all.items.filter((l) => {
      const d = new Date(l.dueAt);
      return d >= start && d < end;
    }).length;
    return { total: all.total, overdue, dueToday };
  }
}

export const leadRepository = new DbLeadRepository();
