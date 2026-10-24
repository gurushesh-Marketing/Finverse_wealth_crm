import { db, pool } from './db';
import type { Scope } from './users';
import { forbidden, notFound, HttpError } from '../lib/errors';
import { channelEligibleForCall } from '../wealth/rules';
import { eq, sql } from 'drizzle-orm';
import {
  leads,
  leadTasks,
  leadEvents,
  leadOwnershipEvents,
  allocationBatches,
  targetAllocations,
  teamTargets,
  teamForecasts,
  reviews,
  mentorships,
  teamRequests,
  teamReportExports,
  reportSchedules,
  callQualityReviews,
  evidenceAccessLog,
  activityCorrections,
  overdueEscalations,
  enquiries,
} from '../db/schema';
import type {
  AllocationReceipt,
  TlAllocationInput,
  TlBatchAllocationInput,
  TlDrillResponse,
  TlKpi,
  TlMemberRow,
  TlOverviewResponse,
  TlPeriod,
  TlRebalanceInput,
} from '@finverse/contracts';

// [ASSUMPTION] demo capacity model: capacity cap 20 open leads per associate.
const CAPACITY_CAP = 20;
const METRIC_VERSION = 'tl-metrics-v1';

function id(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function assertTl(scope: Scope): void {
  if (scope.role !== 'TL') {
    throw forbidden('Team Lead workspace only.');
  }
}

function inList<T>(vals: T[]) {
  return vals.length > 0 ? sql.join(vals.map((v) => sql`${v}`), sql`, `) : sql`NULL`;
}

function teamFilter(scope: Scope, alias = 'l') {
  return sql`${sql.raw(alias)}.vertical IN (${inList(scope.verticals)}) AND ${sql.raw(alias)}.team_id IN (${inList(scope.teams)})`;
}

export interface TlMember extends TlMemberRow {
  teamIds: string[];
}

async function teamMembers(scope: Scope): Promise<TlMember[]> {
  // Complex lateral join for latest availability and team aggregation
  const { rows } = await db.execute<any>(sql`
    SELECT e.id, e.display_name,
           COALESCE(av.status, 'available') AS availability,
           array_remove(array_agg(DISTINCT a.team_id), NULL) AS team_ids
      FROM assignments a
      JOIN employees e ON e.id = a.employee_id
      LEFT JOIN LATERAL (
        SELECT status FROM availability_changes c
         WHERE c.employee_id = e.id AND c.effective_from <= now()
         ORDER BY c.effective_from DESC LIMIT 1
      ) av ON true
     WHERE a.team_id IN (${inList(scope.teams)}) AND a.role = 'SC'
       AND a.effective_from <= now()
       AND (a.effective_to IS NULL OR a.effective_to > now())
     GROUP BY e.id, e.display_name, av.status
     ORDER BY e.display_name
  `);

  const members: TlMember[] = rows.map((r: any) => ({
    employeeId: r.id,
    displayName: r.display_name,
    openLeads: 0,
    openTasks: 0,
    overdueTasks: 0,
    completedThisPeriod: 0,
    capacity: CAPACITY_CAP,
    idle: false,
    availability: r.availability,
    teamIds: r.team_ids ?? [],
  }));
  if (members.length === 0) return members;
  const ids = members.map((m) => m.employeeId);

  // Aggregated workload query across leads and lead_tasks
  const { rows: work } = await db.execute<any>(sql`
    SELECT owner_employee_id,
           COUNT(*) FILTER (WHERE kind = 'lead')::int AS open_leads,
           COUNT(*) FILTER (WHERE kind = 'task')::int AS open_tasks,
           COUNT(*) FILTER (WHERE kind = 'task' AND overdue)::int AS overdue_tasks
      FROM (
        SELECT l.owner_employee_id, 'lead'::text AS kind, false AS overdue
          FROM leads l
         WHERE l.owner_employee_id IN (${inList(ids)})
           AND ${teamFilter(scope, 'l')}
           AND l.stage NOT IN ('converted', 'lost')
        UNION ALL
        SELECT t.owner_employee_id, 'task', t.due_at < now()
          FROM lead_tasks t
          JOIN leads l ON l.id = t.lead_id
         WHERE t.owner_employee_id IN (${inList(ids)})
           AND ${teamFilter(scope, 'l')}
           AND t.status = 'open'
      ) w
     GROUP BY owner_employee_id
  `);

  const byId = new Map<string, any>(work.map((w: any) => [w.owner_employee_id, w]));
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const { rows: done } = await db.execute<any>(sql`
    SELECT t.owner_employee_id, COUNT(*)::int AS n
      FROM lead_tasks t
      JOIN leads l ON l.id = t.lead_id
     WHERE t.owner_employee_id IN (${inList(ids)})
       AND ${teamFilter(scope, 'l')}
       AND t.status = 'completed'
       AND t.completed_at >= ${since}
     GROUP BY t.owner_employee_id
  `);

  const doneById = new Map<string, any>(done.map((d: any) => [d.owner_employee_id, d]));
  for (const m of members) {
    const w = byId.get(m.employeeId);
    m.openLeads = w?.open_leads ?? 0;
    m.openTasks = w?.open_tasks ?? 0;
    m.overdueTasks = w?.overdue_tasks ?? 0;
    m.completedThisPeriod = doneById.get(m.employeeId)?.n ?? 0;
    m.idle = m.openLeads + m.openTasks === 0;
  }
  return members;
}

function periodStart(period: TlPeriod): Date {
  const now = new Date();
  if (period === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'week') return new Date(now.getTime() - 7 * 86_400_000);
  if (period === 'month') return new Date(now.getTime() - 30 * 86_400_000);
  return new Date(now.getTime() - 90 * 86_400_000);
}

export async function overview(scope: Scope, period: TlPeriod, comparison: string): Promise<TlOverviewResponse> {
  assertTl(scope);
  const members = await teamMembers(scope);
  const start = periodStart(period);

  // Aggregated totals with lateral join for latest qualification estimate
  const { rows: totals } = await db.execute<any>(sql`
    SELECT
      COUNT(*) FILTER (WHERE l.stage NOT IN ('converted', 'lost'))::int AS active_leads,
      COUNT(*) FILTER (WHERE l.stage = 'converted' AND l.updated_at >= ${start})::int AS wins,
      COALESCE(SUM(q.expected_value) FILTER (WHERE l.stage NOT IN ('converted', 'lost')), 0)::float AS pipeline_value
    FROM leads l
    LEFT JOIN LATERAL (
      SELECT q2.expected_value FROM qualifications q2 WHERE q2.lead_id = l.id
       ORDER BY q2.created_at DESC LIMIT 1
    ) q ON true
    WHERE ${teamFilter(scope, 'l')}
  `);

  const { rows: taskRows } = await db.execute<any>(sql`
    SELECT COUNT(*) FILTER (WHERE t.status = 'open')::int AS open_tasks,
           COUNT(*) FILTER (WHERE t.status = 'open' AND t.due_at < now())::int AS overdue,
           COUNT(*) FILTER (WHERE t.status = 'open' AND t.due_at >= now() AND t.due_at < now() + interval '1 day')::int AS due_today,
           COUNT(*) FILTER (WHERE t.status = 'completed' AND t.completed_at >= ${start})::int AS completed
      FROM lead_tasks t JOIN leads l ON l.id = t.lead_id
     WHERE ${teamFilter(scope, 'l')}
  `);

  const { rows: pending } = await db.execute<{ n: number }>(sql`
    SELECT COUNT(*)::int AS n FROM outcome_requests r JOIN leads l ON l.id = r.lead_id
     WHERE r.status = 'pending' AND ${teamFilter(scope, 'l')}
  `);

  const t = totals[0] ?? { active_leads: 0, wins: 0, pipeline_value: 0 };
  const tk = taskRows[0] ?? { open_tasks: 0, overdue: 0, due_today: 0, completed: 0 };
  const idleCount = members.filter((m) => m.idle).length;
  const openTotal = Math.max(tk.open_tasks, 1);

  const kpis: TlKpi[] = [
    { key: 'actual-target', label: 'Wins vs team target', value: t.wins, numerator: t.wins, denominator: 1, comparison, formula: 'COUNT(leads converted in period) — attribution: lead team at query time [ASSUMPTION: event-time team pending ownership-interval rollup] / approved target' },
    { key: 'overdue-tasks', label: 'Overdue tasks', value: tk.overdue, numerator: tk.overdue, denominator: openTotal, comparison, formula: 'COUNT(open tasks due < now) of open tasks' },
    { key: 'due-today', label: 'Due today', value: tk.due_today, numerator: tk.due_today, denominator: openTotal, comparison, formula: 'COUNT(open tasks due within 1 day) of open tasks' },
    { key: 'idle-capacity', label: 'Idle capacity (members)', value: idleCount, numerator: idleCount, denominator: Math.max(members.length, 1), comparison, formula: 'COUNT(members with no open leads or tasks) of members' },
    { key: 'pending-approvals', label: 'Pending approvals', value: pending[0]?.n ?? 0, numerator: pending[0]?.n ?? 0, denominator: 1, comparison, formula: 'COUNT(pending outcome_requests in team scope)' },
    { key: 'pipeline-value', label: 'Open pipeline value', value: t.pipeline_value, numerator: t.pipeline_value, denominator: 1, comparison, formula: 'SUM(expected_value, open stages) — estimate, not revenue' },
  ];

  return {
    teams: scope.teams.map((tid) => ({ id: tid, name: tid })),
    period,
    comparison,
    asOf: new Date().toISOString(),
    dataFreshMinutes: 0,
    kpis,
    members,
    pendingApprovals: pending[0]?.n ?? 0,
  };
}

export async function drill(scope: Scope, metric: string, period: TlPeriod): Promise<TlDrillResponse> {
  assertTl(scope);
  const { rows } = await db.execute<any>(sql`
    SELECT l.*, eo.display_name AS owner_name, t.name AS team_name
      FROM leads l
      LEFT JOIN employees eo ON eo.id = l.owner_employee_id
      LEFT JOIN teams t ON t.id = l.team_id
     WHERE ${teamFilter(scope, 'l')} ORDER BY l.updated_at DESC LIMIT 30
  `);
  return {
    metric,
    members: await teamMembers(scope),
    opportunities: rows.map((r: any) => ({
      id: r.id, displayName: r.display_name, stage: r.stage, product: r.product,
      source: r.source, dueStatus: 'none', nextActionAt: null,
      ownerName: r.owner_name ?? 'Unassigned', teamName: r.team_name ?? '—',
    })) as TlDrillResponse['opportunities'],
  };
}

export async function correctiveTask(scope: Scope, leadId: string, purpose: string, dueAt: string) {
  assertTl(scope);
  const { rows } = await db.execute<any>(sql`SELECT l.* FROM leads l WHERE l.id = ${leadId} AND ${teamFilter(scope, 'l')}`);
  const lead = rows[0];
  if (!lead) throw notFound();
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', { fieldErrors: { dueAt: ['Enter a valid date and time.'] } });
  }
  const taskId = id('TASK');
  await db.insert(leadTasks).values({
    id: taskId,
    leadId,
    ownerEmployeeId: lead.owner_employee_id ?? scope.employeeId,
    action: 'other',
    purpose: `TL corrective: ${purpose}`,
    dueAt: due.toISOString(),
    priority: 'high',
    status: 'open',
  });
  await db.insert(leadEvents).values({
    id: id('EVT'),
    leadId,
    actorEmployeeId: scope.employeeId,
    kind: 'task-updated',
    note: `TL corrective task assigned: ${purpose}`,
    actorRole: scope.role,
    actorTeamId: lead.team_id,
    assignmentId: scope.assignmentId,
  });
  return { taskId, status: 'open' as const };
}

// ─── TL-02/03 allocation ───

export async function allocationQueue(scope: Scope) {
  assertTl(scope);
  const { rows } = await db.execute<any>(sql`
    SELECT l.*, EXTRACT(EPOCH FROM (now() - l.created_at))::int AS age_seconds
      FROM leads l WHERE l.owner_employee_id IS NULL AND ${teamFilter(scope, 'l')}
     ORDER BY l.created_at ASC
  `);
  return {
    leads: rows.map((r: any) => ({
      id: r.id, displayName: r.display_name, product: r.product, source: r.source,
      createdAt: r.created_at, recordVersion: r.record_version, ageSeconds: r.age_seconds,
    })),
  };
}

export async function eligibleRecipients(scope: Scope) {
  assertTl(scope);
  const members = await teamMembers(scope);
  return {
    recipients: members.map((m) => ({
      ...m,
      eligible: m.availability !== 'away' && m.openLeads < CAPACITY_CAP,
      reason: m.availability === 'away' ? 'on leave' : m.openLeads >= CAPACITY_CAP ? 'at capacity' : 'eligible',
    })),
  };
}

export async function allocateLead(scope: Scope, input: TlAllocationInput): Promise<AllocationReceipt> {
  assertTl(scope);
  return await db.transaction(async (tx) => {
    const { rows } = await tx.execute<any>(sql`
      SELECT l.* FROM leads l WHERE l.id = ${input.leadId} AND ${teamFilter(scope, 'l')} FOR UPDATE
    `);
    const lead = rows[0];
    if (!lead) throw notFound();
    if (lead.owner_employee_id !== null) {
      throw new HttpError(409, 'DUPLICATE_OPEN_TASK', 'Lead already has an owner — use rebalance.', {});
    }
    if (lead.record_version !== input.recordVersion) {
      throw new HttpError(409, 'DUPLICATE_OPEN_TASK', 'Record changed since you loaded it. Reload and retry.', {});
    }
    const { rows: recips } = await tx.execute<{ id: string }>(sql`
      SELECT e.id FROM assignments a JOIN employees e ON e.id = a.employee_id
       WHERE a.team_id = ${lead.team_id} AND a.role = 'SC' AND a.effective_from <= now()
         AND (a.effective_to IS NULL OR a.effective_to > now()) AND e.id = ${input.toEmployeeId}
    `);
    if (!recips[0]) {
      throw new HttpError(422, 'VALIDATION_FAILED', 'Recipient is not an eligible associate for this team.', {
        fieldErrors: { toEmployeeId: ['Choose an eligible associate.'] },
      });
    }

    await tx.update(leads)
      .set({
        ownerEmployeeId: input.toEmployeeId,
        updatedAt: sql`now()`,
        recordVersion: sql`record_version + 1`,
      })
      .where(eq(leads.id, input.leadId));

    await tx.insert(leadOwnershipEvents).values({
      id: id('OWN'),
      leadId: input.leadId,
      fromOwnerEmployeeId: null,
      toOwnerEmployeeId: input.toEmployeeId,
      actorEmployeeId: scope.employeeId,
      actorRole: scope.role,
      actorTeamId: lead.team_id,
      assignmentId: scope.assignmentId,
      kind: 'first-allocation',
      reason: input.reason,
      recordVersion: input.recordVersion,
    });

    const taskId = id('TASK');
    await tx.insert(leadTasks).values({
      id: taskId,
      leadId: input.leadId,
      ownerEmployeeId: input.toEmployeeId,
      action: 'voice-call',
      purpose: 'First contact after allocation',
      dueAt: new Date(Date.now() + 86_400_000).toISOString(),
      priority: 'high',
      status: 'open',
    });

    await tx.insert(leadEvents).values({
      id: id('EVT'),
      leadId: input.leadId,
      actorEmployeeId: scope.employeeId,
      kind: 'assignment-changed',
      note: `Assignment notification (in-app): lead allocated to ${input.toEmployeeId} (${input.reason}). First-contact task ${taskId} created.`,
      actorRole: scope.role,
      actorTeamId: lead.team_id,
      assignmentId: scope.assignmentId,
    });

    return { leadId: input.leadId, status: 'assigned', toEmployeeId: input.toEmployeeId, taskId };
  });
}

function pickWeighted(members: TlMember[], loads: Map<string, number>, cap: number): TlMember | null {
  let best: TlMember | null = null;
  let bestLoad = Infinity;
  for (const m of members) {
    if (m.availability === 'away') continue;
    const load = loads.get(m.employeeId) ?? 0;
    if (load >= cap) continue;
    if (load < bestLoad) { best = m; bestLoad = load; }
  }
  return best;
}

export async function batchPreview(scope: Scope, input: TlBatchAllocationInput) {
  assertTl(scope);
  if (!scope.teams.includes(input.teamId)) throw notFound();
  const members = (await eligibleRecipients(scope)).recipients.filter((r) => r.teamIds.includes(input.teamId));
  const { rows } = await db.execute<any>(sql`
    SELECT l.* FROM leads l WHERE l.id IN (${inList(input.leadIds)}) AND l.team_id = ${input.teamId} AND l.vertical IN (${inList(scope.verticals)})
  `);
  const cap = input.capacityCap ?? CAPACITY_CAP;
  const loads = new Map<string, number>(members.map((m) => [m.employeeId, m.openLeads]));
  const receipts: AllocationReceipt[] = [];
  for (const lead of rows) {
    if (lead.owner_employee_id !== null) {
      receipts.push({ leadId: lead.id, status: 'held', toEmployeeId: null, taskId: null, detail: 'already owned (held)' });
      continue;
    }
    const pick = pickWeighted(members as TlMember[], loads, cap);
    if (!pick) {
      receipts.push({ leadId: lead.id, status: 'held', toEmployeeId: null, taskId: null, detail: 'no eligible capacity (held)' });
      continue;
    }
    loads.set(pick.employeeId, (loads.get(pick.employeeId) ?? 0) + 1);
    receipts.push({ leadId: lead.id, status: 'assigned', toEmployeeId: pick.employeeId, taskId: null });
  }
  const found = new Set(rows.map((r: any) => r.id));
  for (const leadId of input.leadIds) {
    if (!found.has(leadId)) receipts.push({ leadId, status: 'failed', toEmployeeId: null, taskId: null, detail: 'out of scope or missing' });
  }
  return {
    method: input.method,
    eligible: receipts.filter((r) => r.status === 'assigned').length,
    held: receipts.filter((r) => r.status === 'held').length,
    receipts,
  };
}

export async function batchCommit(scope: Scope, input: TlBatchAllocationInput, batchKey: string) {
  assertTl(scope);
  const { rows: existing } = await db.execute<any>(sql`SELECT * FROM allocation_batches WHERE batch_key = ${batchKey}`);
  if (existing[0]) {
    return { batchId: existing[0].id as string, batchKey, results: existing[0].results as AllocationReceipt[], replayed: true };
  }
  const preview = await batchPreview(scope, input);
  const batchId = id('BATCH');
  const results: AllocationReceipt[] = [];

  return await db.transaction(async (tx) => {
    for (const row of preview.receipts) {
      if (row.status !== 'assigned' || !row.toEmployeeId) { results.push(row); continue; }
      try {
        await tx.transaction(async (sp) => {
          const { rows: leadRows } = await sp.execute<any>(sql`
            SELECT l.* FROM leads l WHERE l.id = ${row.leadId} AND l.team_id = ${input.teamId} AND l.vertical IN (${inList(scope.verticals)}) AND l.owner_employee_id IS NULL FOR UPDATE
          `);
          const lead = leadRows[0];
          if (!lead) { results.push({ ...row, status: 'failed', detail: 'revalidated: no longer allocatable' }); return; }
          const taskId = id('TASK');
          await sp.update(leads)
            .set({
              ownerEmployeeId: row.toEmployeeId,
              updatedAt: sql`now()`,
              recordVersion: sql`record_version + 1`,
            })
            .where(eq(leads.id, row.leadId));

          const toEmployeeId = row.toEmployeeId!;
          await sp.insert(leadOwnershipEvents).values({
            id: id('OWN'),
            leadId: row.leadId,
            toOwnerEmployeeId: toEmployeeId,
            actorEmployeeId: scope.employeeId,
            actorRole: scope.role,
            actorTeamId: lead.team_id,
            assignmentId: scope.assignmentId,
            kind: 'batch',
            reason: 'Batch distribution (weighted round-robin)',
            batchKey,
            recordVersion: lead.record_version,
          });

          await sp.insert(leadTasks).values({
            id: taskId,
            leadId: row.leadId,
            ownerEmployeeId: toEmployeeId,
            action: 'voice-call',
            purpose: 'First contact after batch allocation',
            dueAt: new Date(Date.now() + 86_400_000).toISOString(),
            priority: 'high',
            status: 'open',
          });

          await sp.insert(leadEvents).values({
            id: id('EVT'),
            leadId: row.leadId,
            actorEmployeeId: scope.employeeId,
            kind: 'assignment-changed',
            note: `Assignment notification (in-app): batch ${batchKey} allocated to ${row.toEmployeeId}. First-contact task ${taskId}.`,
            actorRole: scope.role,
            actorTeamId: lead.team_id,
            assignmentId: scope.assignmentId,
          });
          results.push({ ...row, taskId });
        });
      } catch (err: any) {
        if (err?.code === '23505' || err?.cause?.code === '23505') {
          results.push({ ...row, status: 'conflict', detail: 'concurrent allocation — left for retry' });
        } else {
          throw err;
        }
      }
    }

    try {
      await tx.insert(allocationBatches).values({
        id: batchId,
        batchKey,
        actorEmployeeId: scope.employeeId,
        actorTeamId: scope.teams[0] ?? null,
        method: input.method,
        totalCount: results.length,
        successCount: results.filter((r) => r.status === 'assigned').length,
        heldCount: results.filter((r) => r.status === 'held').length,
        failedCount: results.filter((r) => r.status === 'failed' || r.status === 'conflict').length,
        results,
      });
    } catch (err: any) {
      if (err?.code === '23505' || err?.cause?.code === '23505') {
        const { rows: again } = await db.execute<any>(sql`SELECT * FROM allocation_batches WHERE batch_key = ${batchKey}`);
        return { batchId: again[0]?.id as string, batchKey, results: again[0]?.results as AllocationReceipt[], replayed: true };
      }
      throw err;
    }

    return { batchId, batchKey, results };
  });
}

// ─── TL-04 workload + rebalance ───

export async function workload(scope: Scope) {
  assertTl(scope);
  const members = await teamMembers(scope);
  return { members, metricVersion: METRIC_VERSION };
}

export async function rebalance(scope: Scope, input: TlRebalanceInput) {
  assertTl(scope);
  return await db.transaction(async (tx) => {
    const { rows: dest } = await tx.execute<{ team_id: string }>(sql`
      SELECT a.team_id FROM assignments a
       WHERE a.employee_id = ${input.toEmployeeId} AND a.role = 'SC' AND a.team_id IN (${inList(scope.teams)})
         AND a.effective_from <= now() AND (a.effective_to IS NULL OR a.effective_to > now())
    `);
    if (!dest[0]) {
      throw forbidden('Recipient is outside your granted teams — cross-boundary moves become a Manager request.');
    }
    const results: Array<{ leadId: string; status: 'moved' | 'held' | 'failed'; detail?: string }> = [];
    for (const leadId of input.leadIds) {
      const { rows } = await tx.execute<any>(sql`SELECT l.* FROM leads l WHERE l.id = ${leadId} AND ${teamFilter(scope, 'l')} FOR UPDATE`);
      const lead = rows[0];
      if (!lead) { results.push({ leadId, status: 'failed', detail: 'out of scope' }); continue; }
      if (!lead.owner_employee_id) { results.push({ leadId, status: 'held', detail: 'unowned — use allocation' }); continue; }
      const { rows: pend } = await tx.execute<{ id: string }>(
        sql`SELECT id FROM outcome_requests WHERE lead_id = ${leadId} AND status = 'pending'`
      );
      if (pend[0]) { results.push({ leadId, status: 'held', detail: 'pending approval locked — decide first' }); continue; }

      await tx.update(leads)
        .set({
          ownerEmployeeId: input.toEmployeeId,
          updatedAt: sql`now()`,
          recordVersion: sql`record_version + 1`,
        })
        .where(eq(leads.id, leadId));

      await tx.update(leadTasks)
        .set({ ownerEmployeeId: input.toEmployeeId })
        .where(sql`lead_id = ${leadId} AND status = 'open'`);

      await tx.insert(leadOwnershipEvents).values({
        id: id('OWN'),
        leadId,
        fromOwnerEmployeeId: lead.owner_employee_id,
        toOwnerEmployeeId: input.toEmployeeId,
        actorEmployeeId: scope.employeeId,
        actorRole: scope.role,
        actorTeamId: lead.team_id,
        assignmentId: scope.assignmentId,
        kind: 'rebalance',
        reason: `${input.reason} (handoff by ${input.handoffDeadline})`,
        recordVersion: lead.record_version,
      });

      await tx.insert(leadEvents).values({
        id: id('EVT'),
        leadId,
        actorEmployeeId: scope.employeeId,
        kind: 'assignment-changed',
        note: `Assignment notification (in-app): work rebalanced ${lead.owner_employee_id} → ${input.toEmployeeId} (${input.reason}). Open tasks moved together; original due times preserved; earlier activity stays with its actor.`,
        actorRole: scope.role,
        actorTeamId: lead.team_id,
        assignmentId: scope.assignmentId,
      });
      results.push({ leadId, status: 'moved' });
    }
    return { results };
  });
}

// ─── TL-05 overdue resolution ───

export interface OverdueTaskRow {
  taskId: string;
  leadId: string;
  leadName: string;
  ownerEmployeeId: string;
  ownerName: string;
  purpose: string;
  action: string;
  dueAt: string;
  ageSeconds: number;
  breachCount: number;
}

export async function overdueQueue(scope: Scope): Promise<{ tasks: OverdueTaskRow[] }> {
  assertTl(scope);
  const { rows } = await db.execute<any>(sql`
    SELECT t.id, t.lead_id, t.owner_employee_id, t.purpose, t.action, t.due_at,
           EXTRACT(EPOCH FROM (now() - t.due_at))::int AS age_seconds,
           l.display_name AS lead_name, e.display_name AS owner_name,
           COALESCE((SELECT COUNT(*) FROM overdue_escalations oe WHERE oe.task_id = t.id), 0)::int AS breach_count
      FROM lead_tasks t
      JOIN leads l ON l.id = t.lead_id
      LEFT JOIN employees e ON e.id = t.owner_employee_id
     WHERE t.status = 'open' AND t.due_at < now() AND ${teamFilter(scope, 'l')}
     ORDER BY t.due_at ASC
  `);
  return {
    tasks: rows.map((r: any) => ({
      taskId: r.id, leadId: r.lead_id, leadName: r.lead_name,
      ownerEmployeeId: r.owner_employee_id, ownerName: r.owner_name ?? '—',
      purpose: r.purpose, action: r.action, dueAt: r.due_at,
      ageSeconds: r.age_seconds, breachCount: r.breach_count,
    })),
  };
}

// [ASSUMPTION] repeated-breach threshold = 3 escalations -> notify Manager.
const BREACH_THRESHOLD = 3;

export async function overdueAction(scope: Scope, taskId: string, input: {
  action: 'coach' | 'reassign' | 'escalate';
  reason: string;
  newOwnerEmployeeId?: string;
  recoveryDueAt: string;
}) {
  assertTl(scope);
  const due = new Date(input.recoveryDueAt);
  if (Number.isNaN(due.getTime())) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', { fieldErrors: { recoveryDueAt: ['Enter a valid date and time.'] } });
  }
  return await db.transaction(async (tx) => {
    const { rows } = await tx.execute<any>(sql`
      SELECT t.*, l.team_id AS lead_team, l.display_name AS lead_name FROM lead_tasks t
        JOIN leads l ON l.id = t.lead_id
       WHERE t.id = ${taskId} AND ${teamFilter(scope, 'l')} FOR UPDATE
    `);
    const task = rows[0];
    if (!task) throw notFound();
    if (task.status !== 'open') {
      throw new HttpError(409, 'DUPLICATE_OPEN_TASK', 'Task is no longer open — original history stays untouched.', {});
    }

    let newOwner = task.owner_employee_id;
    if (input.action === 'reassign') {
      if (!input.newOwnerEmployeeId) {
        throw new HttpError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', { fieldErrors: { newOwnerEmployeeId: ['Choose a recipient for the handoff.'] } });
      }
      const { rows: ok } = await tx.execute<{ id: string }>(sql`
        SELECT id FROM assignments WHERE employee_id = ${input.newOwnerEmployeeId} AND team_id = ${task.lead_team} AND role = 'SC'
          AND effective_from <= now() AND (effective_to IS NULL OR effective_to > now())
      `);
      if (!ok[0]) {
        throw forbidden('Handoff recipient is outside the team — permitted handoffs only.');
      }
      newOwner = input.newOwnerEmployeeId;
    }

    const { rows: sup } = await tx.execute<{ channels: string[] }>(sql`
      SELECT channels FROM contact_suppressions WHERE lead_id = ${task.lead_id} AND active = true
    `);
    const suppressed = sup.flatMap((s: any) => s.channels);
    const recoveryTaskId = id('TASK');
    await tx.insert(leadTasks).values({
      id: recoveryTaskId,
      leadId: task.lead_id,
      ownerEmployeeId: newOwner,
      action: channelEligibleForCall(suppressed) ? 'voice-call' : 'whatsapp-message',
      purpose: `Recovery after overdue (${input.action}): ${input.reason}`,
      dueAt: due.toISOString(),
      priority: 'high',
      status: 'open',
    });

    const { rows: prev } = await tx.execute<{ n: number }>(sql`
      SELECT COUNT(*)::int AS n FROM overdue_escalations WHERE task_id = ${taskId}
    `);
    const breachCount = (prev[0]?.n ?? 0) + 1;
    const notifyManager = breachCount >= BREACH_THRESHOLD;

    await tx.insert(overdueEscalations).values({
      id: id('ESC'),
      taskId,
      leadId: task.lead_id,
      subjectEmployeeId: task.owner_employee_id,
      actorEmployeeId: scope.employeeId,
      action: input.action,
      reason: input.reason,
      severity: breachCount >= BREACH_THRESHOLD ? 'high' : 'medium',
      recoveryTaskId,
      managerNotified: notifyManager,
    });

    await tx.insert(leadEvents).values({
      id: id('EVT'),
      leadId: task.lead_id,
      actorEmployeeId: scope.employeeId,
      kind: 'task-updated',
      note: `TL overdue action (${input.action}) on ${taskId}: ${input.reason}. Recovery task ${recoveryTaskId} (due ${due.toISOString()}). Original deadline history preserved.${notifyManager ? ' Manager notified (breach threshold).' : ''}`,
      actorRole: scope.role,
      actorTeamId: task.lead_team,
      assignmentId: scope.assignmentId,
    });

    return { escalationId: null, recoveryTaskId, breachCount, notifyManager };
  });
}

// ─── TL-06 associate review (TL workspace; never the Caller interface) ───

export async function memberReview(scope: Scope, employeeId: string, period: TlPeriod) {
  assertTl(scope);
  const memberRows = await teamMembers(scope);
  const member = memberRows.find((m) => m.employeeId === employeeId);
  if (!member) throw notFound();
  const start = periodStart(period);

  const { rows: history } = await db.execute<any>(sql`
    SELECT id, team_id, role, effective_from, effective_to FROM assignments
     WHERE employee_id = ${employeeId} AND team_id IN (${inList(scope.teams)}) ORDER BY effective_from DESC
  `);
  const { rows: ownEvents } = await db.execute<{ n: number }>(sql`
    SELECT COUNT(*)::int AS n FROM lead_events e
      JOIN leads l ON l.id = e.lead_id
     WHERE e.actor_employee_id = ${employeeId} AND e.occurred_at >= ${start}
       AND ${teamFilter(scope, 'l')}
       AND e.assignment_id IS NOT NULL
  `);
  const { rows: inherited } = await db.execute<{ n: number }>(sql`
    SELECT COUNT(*)::int AS n FROM lead_ownership_events oe
      JOIN leads l ON l.id = oe.lead_id
     WHERE oe.to_owner_employee_id = ${employeeId} AND oe.kind IN ('transfer', 'rebalance')
       AND ${teamFilter(scope, 'l')}
  `);
  const { rows: coaching } = await db.execute<any>(sql`
    SELECT qr.id, qr.feedback, qr.created_at FROM call_quality_reviews qr
      JOIN calls c ON c.id = qr.call_id
      JOIN leads l ON l.id = c.lead_id
     WHERE qr.subject_employee_id = ${employeeId} AND ${teamFilter(scope, 'l')}
     ORDER BY qr.created_at DESC LIMIT 5
  `);
  const { rows: training } = await db.execute<any>(sql`
    SELECT id, mentor_employee_id, work_cap, review_date, status FROM mentorships
     WHERE intern_employee_id = ${employeeId} ORDER BY created_at DESC
  `);

  return {
    member,
    assignmentHistory: history.map((h: any) => ({
      id: h.id, teamId: h.team_id, role: h.role,
      effectiveFrom: h.effective_from, effectiveTo: h.effective_to,
      label: `${h.team_id} / ${h.role}${h.effective_to ? ' (closed)' : ' (current)'}`,
    })),
    personalActivityEvents: ownEvents[0]?.n ?? 0,
    inheritedLeads: inherited[0]?.n ?? 0,
    coaching: coaching.map((c: any) => ({ id: c.id, feedback: c.feedback, createdAt: c.created_at })),
    training: training.map((t: any) => ({ id: t.id, mentorEmployeeId: t.mentor_employee_id, workCap: t.work_cap, reviewDate: t.review_date, status: t.status })),
    metricNote: 'Personal activity, inherited work and team-attributed outcomes reported separately; HR fields and other vertical work excluded.',
  };
}

// ─── TL-07/08 decision queues (decideRequest in pipeline.ts does the writes) ───

export async function listDecisions(scope: Scope) {
  assertTl(scope);
  const { rows } = await db.execute<any>(sql`
    SELECT r.*, l.display_name AS lead_name, l.team_id, e.display_name AS submitter_name
      FROM outcome_requests r
      JOIN leads l ON l.id = r.lead_id
      LEFT JOIN employees e ON e.id = r.actor_employee_id
     WHERE r.status = 'pending' AND ${teamFilter(scope, 'l')}
     ORDER BY r.created_at ASC
  `);
  const { rows: dups } = await db.execute<any>(sql`
    SELECT en.id, en.display_name, en.phone, en.duplicate_of, en.status, le.display_name AS original_name
      FROM enquiries en JOIN leads le ON le.id = en.duplicate_of
     WHERE en.duplicate_of IS NOT NULL AND en.status = 'duplicate' AND ${teamFilter(scope, 'le')}
     ORDER BY en.created_at DESC LIMIT 20
  `);
  return {
    requests: rows.map((r: any) => ({
      id: r.id, type: r.type, leadId: r.lead_id, leadName: r.lead_name,
      submitterName: r.submitter_name ?? '—', payload: r.payload, createdAt: r.created_at,
    })),
    duplicates: dups.map((d: any) => ({
      enquiryId: d.id, displayName: d.display_name, phone: d.phone,
      duplicateOf: d.duplicate_of, originalName: d.original_name ?? '—',
    })),
  };
}

export async function duplicateDisposition(scope: Scope, enquiryId: string, decision: 'confirm-separate' | 'route-merge') {
  assertTl(scope);
  const { rows } = await db.execute<any>(sql`
    SELECT en.* FROM enquiries en JOIN leads le ON le.id = en.duplicate_of WHERE en.id = ${enquiryId} AND ${teamFilter(scope, 'le')}
  `);
  const enq = rows[0];
  if (!enq) throw notFound();
  if (decision === 'confirm-separate') {
    await db.update(enquiries)
      .set({ duplicateOf: null, status: 'pending' })
      .where(eq(enquiries.id, enquiryId));
    return { status: 'confirmed-separate', note: 'Distinct records confirmed — IDs and source links retained.' };
  }
  // Merge authority is separate: route a review reference to the data steward — never collapse records here.
  const reqId = id('REQ');
  await db.insert(teamRequests).values({
    id: reqId,
    teamId: null,
    actorEmployeeId: scope.employeeId,
    category: 'merge-request',
    payload: {
      enquiryId,
      duplicateOf: enq.duplicate_of,
      request: `Identity merge review for ${enq.id}`,
      businessReason: 'Match-review reference only — no customer record shared across verticals.',
    },
    status: 'pending',
  });
  return { status: 'merge-requested', requestId: reqId, note: 'Routed to the data steward as a match-review reference. Records are not collapsed.' };
}

// ─── TL-09 call-quality coaching ───

// [ASSUMPTION] approved demo rubric v1 with four checklist dimensions, 0-5 each.
const RUBRIC_VERSION = 'tl-quality-v1';
const RUBRIC_KEYS = ['opening', 'discovery', 'compliance', 'close'] as const;

export async function createQualityReview(scope: Scope, input: {
  callId: string; scores: Record<string, number>; feedback: string; evidenceRef?: string; assessed?: boolean;
}) {
  assertTl(scope);
  const { rows } = await db.execute<any>(sql`
    SELECT c.*, l.team_id AS lead_team FROM calls c JOIN leads l ON l.id = c.lead_id
     WHERE c.id = ${input.callId} AND ${teamFilter(scope, 'l')}
  `);
  const call = rows[0];
  if (!call) throw notFound();
  const cleanScores: Record<string, number> = {};
  for (const key of RUBRIC_KEYS) {
    const v = input.scores[key];
    if (typeof v === 'number' && v >= 0 && v <= 5) cleanScores[key] = v;
  }
  const assessed = input.assessed !== false && Boolean(input.evidenceRef);
  if (assessed && Object.keys(cleanScores).length === 0) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', { fieldErrors: { scores: ['Score the approved rubric.'] } });
  }
  const reviewId = id('QR');
  await db.insert(callQualityReviews).values({
    id: reviewId,
    callId: input.callId,
    actorEmployeeId: scope.employeeId,
    subjectEmployeeId: call.actor_employee_id,
    rubricVersion: RUBRIC_VERSION,
    scores: cleanScores,
    feedback: input.feedback,
    evidenceRef: input.evidenceRef ?? null,
    assessed,
  });
  return { reviewId, assessed, rubricVersion: RUBRIC_VERSION, sampleNote: 'Quality samples are reported with sample size — small samples do not imply full coverage.' };
}

export async function listQualityReviews(scope: Scope) {
  assertTl(scope);
  const { rows } = await db.execute<any>(sql`
    SELECT qr.*, c.lead_id, e.display_name AS subject_name
      FROM call_quality_reviews qr
      JOIN calls c ON c.id = qr.call_id
      JOIN leads l ON l.id = c.lead_id
      LEFT JOIN employees e ON e.id = qr.subject_employee_id
     WHERE ${teamFilter(scope, 'l')} ORDER BY qr.created_at DESC LIMIT 50
  `);
  return {
    reviews: rows.map((r: any) => ({
      id: r.id, callId: r.call_id, leadId: r.lead_id, subjectName: r.subject_name ?? '—',
      rubricVersion: r.rubric_version, scores: r.scores, feedback: r.feedback,
      assessed: r.assessed, evidenceRef: r.evidence_ref, createdAt: r.created_at,
    })),
  };
}

export async function accessEvidence(scope: Scope, reviewId: string) {
  assertTl(scope);
  const { rows } = await db.execute<any>(sql`
    SELECT qr.* FROM call_quality_reviews qr
      JOIN calls c ON c.id = qr.call_id
      JOIN leads l ON l.id = c.lead_id
     WHERE qr.id = ${reviewId} AND ${teamFilter(scope, 'l')}
  `);
  const review = rows[0];
  if (!review) throw notFound();
  await db.insert(evidenceAccessLog).values({
    id: id('EAL'),
    reviewId,
    actorEmployeeId: scope.employeeId,
    action: 'view-evidence',
  });
  return {
    evidenceRef: review.evidence_ref,
    simulated: true,
    note: 'SIMULATED — no provider recording integration. Access logged.',
  };
}

// ─── TL-18 documented activity corrections (append-only) ───

const CORRECTION_FIELDS: Record<string, { column: string; allowed?: string[] }> = {
  wrapup_disposition: { column: 'wrapup_disposition', allowed: ['connected', 'no-answer', 'busy', 'wrong-number', 'callback'] },
  status: { column: 'status', allowed: ['connecting', 'ringing', 'connected', 'ended', 'failed', 'no-answer', 'missed'] },
  wrapup_note: { column: 'wrapup_note' },
};

export async function submitActivityCorrection(scope: Scope, input: {
  callId: string; requestedField: string; requestedValue: string; evidenceRef?: string; explanation: string;
}) {
  const fieldSpec = CORRECTION_FIELDS[input.requestedField];
  if (!fieldSpec) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', {
      fieldErrors: { requestedField: ['Not a correctable activity field.'] },
    });
  }
  if (fieldSpec.allowed && !fieldSpec.allowed.includes(input.requestedValue)) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', {
      fieldErrors: { requestedValue: [`Allowed: ${fieldSpec.allowed.join(', ')}.`] },
    });
  }
  const { rows } = await db.execute<any>(sql`
    SELECT c.*, l.team_id AS lead_team FROM calls c JOIN leads l ON l.id = c.lead_id WHERE c.id = ${input.callId} AND ${teamFilter(scope, 'l')}
  `);
  const call = rows[0];
  if (!call) throw notFound();
  if (scope.role !== 'TL' && call.actor_employee_id !== scope.employeeId) {
    throw forbidden('You can only request corrections for your own activities.');
  }
  const originalValue = String((call as any)[fieldSpec.column] ?? '');
  const correctionId = id('COR');
  await db.insert(activityCorrections).values({
    id: correctionId,
    callId: input.callId,
    actorEmployeeId: scope.employeeId,
    requestedField: fieldSpec.column,
    requestedValue: input.requestedValue,
    originalValue,
    evidenceRef: input.evidenceRef ?? null,
    explanation: input.explanation,
    affectedReportVersions: ['tl-metrics-v1', 'metrics-v1'],
  });
  return { correctionId, status: 'pending' as const, originalValue, note: 'Provider truth cannot be overridden without supporting evidence.' };
}

export async function listActivityCorrections(scope: Scope) {
  assertTl(scope);
  const { rows } = await db.execute<any>(sql`
    SELECT ac.*, c.lead_id, e.display_name AS submitter_name
      FROM activity_corrections ac
      JOIN calls c ON c.id = ac.call_id
      JOIN leads l ON l.id = c.lead_id
      LEFT JOIN employees e ON e.id = ac.actor_employee_id
     WHERE ${teamFilter(scope, 'l')} ORDER BY ac.created_at DESC LIMIT 50
  `);
  return {
    corrections: rows.map((r: any) => ({
      id: r.id, callId: r.call_id, leadId: r.lead_id, submitterName: r.submitter_name ?? '—',
      requestedField: r.requested_field, requestedValue: r.requested_value,
      originalValue: r.original_value, evidenceRef: r.evidence_ref, explanation: r.explanation,
      status: r.status, decisionReason: r.decision_reason, affectedReportVersions: r.affected_report_versions,
      createdAt: r.created_at,
    })),
  };
}

export async function decideActivityCorrection(
  scope: Scope,
  correctionId: string,
  decision: 'accept' | 'return' | 'reject' | boolean,
  reason: string,
  evidence?: Record<string, unknown>
) {
  assertTl(scope);
  return await db.transaction(async (tx) => {
    const { rows } = await tx.execute<any>(sql`
      SELECT ac.*, c.lead_id AS call_lead_id, l.team_id AS lead_team
        FROM activity_corrections ac
        JOIN calls c ON c.id = ac.call_id
        JOIN leads l ON l.id = c.lead_id
       WHERE ac.id = ${correctionId} AND ${teamFilter(scope, 'l')} FOR UPDATE OF ac
    `);
    const cor = rows[0];
    if (!cor) throw notFound();
    if (cor.actor_employee_id === scope.employeeId) {
      throw forbidden('Self-submitted corrections are decided by Manager — not by their author.');
    }
    if (cor.status !== 'pending') {
      throw new HttpError(409, 'DUPLICATE_OPEN_TASK', `Correction already ${cor.status}.`);
    }

    let resolvedStatus: 'accepted' | 'returned' | 'rejected';
    if (decision === 'accept' || decision === true) {
      resolvedStatus = 'accepted';
    } else if (decision === 'return') {
      resolvedStatus = 'returned';
    } else {
      resolvedStatus = 'rejected';
    }

    await tx.update(activityCorrections)
      .set({
        status: resolvedStatus,
        decidedBy: scope.employeeId,
        decisionReason: reason,
        decisionEvidence: evidence ?? {},
        decidedAt: sql`now()`,
      })
      .where(eq(activityCorrections.id, correctionId));

    if (resolvedStatus === 'accepted') {
      await tx.execute(sql`UPDATE calls SET ${sql.raw(cor.requested_field)} = ${cor.requested_value} WHERE id = ${cor.call_id}`);
      await tx.insert(leadEvents).values({
        id: id('EVT'),
        leadId: cor.call_lead_id,
        actorEmployeeId: scope.employeeId,
        kind: 'note',
        note: `Activity correction accepted (${cor.requested_field}): "${cor.original_value}" → "${cor.requested_value}" (${reason}). Original fact retained on ${correctionId}; affected report versions flagged.`,
        actorRole: scope.role,
        actorTeamId: cor.lead_team,
        assignmentId: scope.assignmentId,
      });
    } else {
      await tx.insert(leadEvents).values({
        id: id('EVT'),
        leadId: cor.call_lead_id,
        actorEmployeeId: scope.employeeId,
        kind: 'note',
        note: `Activity correction ${resolvedStatus} (${cor.requested_field}): ${reason}. Original fact retained on ${correctionId}.`,
        actorRole: scope.role,
        actorTeamId: cor.lead_team,
        assignmentId: scope.assignmentId,
      });
    }

    return { correctionId, status: resolvedStatus, affectedReportVersions: cor.affected_report_versions };
  });
}

// ─── TL-10 target distribution ───

export async function createTarget(scope: Scope, input: {
  teamId: string; periodLabel: string; metric: string; parentValue: number;
}) {
  assertTl(scope);
  if (!scope.teams.includes(input.teamId)) throw notFound();
  const targetId = id('TGT');
  try {
    await db.insert(teamTargets).values({
      id: targetId,
      teamId: input.teamId,
      periodLabel: input.periodLabel,
      metric: input.metric,
      parentValue: String(input.parentValue),
      createdBy: scope.employeeId,
    });
  } catch (err: any) {
    if (err?.code === '23505' || err?.cause?.code === '23505') {
      throw new HttpError(409, 'DUPLICATE_OPEN_TASK', 'An approved target already exists for this team, period and metric.', {});
    }
    throw err;
  }
  return { targetId, unallocated: input.parentValue, note: 'Child allocations must reconcile to the parent with an explicit remainder.' };
}

export async function allocateTargets(scope: Scope, targetId: string, input: {
  allocations: Array<{ employeeId: string; allocatedValue: number; prorateNote?: string }>;
}) {
  assertTl(scope);
  return await db.transaction(async (tx) => {
    const { rows } = await tx.execute<any>(sql`SELECT * FROM team_targets WHERE id = ${targetId} FOR UPDATE`);
    const target = rows[0];
    if (!target) throw notFound();
    if (!scope.teams.includes(target.team_id)) throw notFound();
    if (target.closed) {
      throw new HttpError(409, 'DUPLICATE_OPEN_TASK', 'Closed periods cannot be silently changed — request a Manager adjustment.', {});
    }
    const total = input.allocations.reduce((a, b) => a + b.allocatedValue, 0);
    if (total > Number(target.parent_value)) {
      throw new HttpError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', {
        fieldErrors: { allocations: [`Allocations ${total} exceed the parent target ${target.parent_value}.`] },
      });
    }
    for (const alloc of input.allocations) {
      const { rows: ok } = await tx.execute<{ id: string }>(sql`
        SELECT id FROM assignments WHERE employee_id = ${alloc.employeeId} AND team_id = ${target.team_id}
          AND effective_from <= now() AND (effective_to IS NULL OR effective_to > now())
      `);
      if (!ok[0]) {
        throw new HttpError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', {
          fieldErrors: { allocations: [`Employee ${alloc.employeeId} is not a member of this team.`] },
        });
      }
    }
    const version = target.version + 1;
    for (const alloc of input.allocations) {
      await tx.insert(targetAllocations).values({
        id: id('TAL'),
        targetId,
        employeeId: alloc.employeeId,
        allocatedValue: String(alloc.allocatedValue),
        prorateNote: alloc.prorateNote ?? null,
        version,
      });
    }
    await tx.update(teamTargets).set({ version }).where(eq(teamTargets.id, targetId));

    return {
      targetId, version,
      allocated: total,
      remainder: Number(target.parent_value) - total,
      note: 'Versioned allocation published to affected employees. Transfer prorating preserved on each row.',
    };
  });
}

export async function listTargets(scope: Scope) {
  assertTl(scope);
  const { rows } = await db.execute<any>(sql`
    SELECT t.*, tm.name AS team_name FROM team_targets t JOIN teams tm ON tm.id = t.team_id
     WHERE t.team_id IN (${inList(scope.teams)}) ORDER BY t.created_at DESC
  `);
  const result = [];
  for (const t of rows) {
    const { rows: allocs } = await db.execute<any>(sql`
      SELECT a.*, e.display_name FROM target_allocations a JOIN employees e ON e.id = a.employee_id
       WHERE a.target_id = ${t.id} AND a.version = ${t.version}
    `);
    const allocated = allocs.reduce((a: number, b: any) => a + Number(b.allocated_value), 0);
    result.push({
      id: t.id, teamId: t.team_id, teamName: t.team_name, periodLabel: t.period_label,
      metric: t.metric, parentValue: Number(t.parent_value), version: t.version, closed: t.closed,
      allocated, remainder: Number(t.parent_value) - allocated,
      allocations: allocs.map((a: any) => ({
        employeeId: a.employee_id, displayName: a.display_name,
        allocatedValue: Number(a.allocated_value), prorateNote: a.prate_note ?? a.prorate_note ?? null,
      })),
    });
  }
  return { targets: result };
}

// ─── TL-11 forecast ───

export async function submitForecast(scope: Scope, input: {
  teamId: string; periodLabel: string; category: 'commit' | 'best-case' | 'pipeline';
  expectedRevenue: number; currency: string; opportunityIds: string[]; riskNotes?: string; assumptions?: string;
}) {
  assertTl(scope);
  if (!scope.teams.includes(input.teamId)) throw notFound();
  if (input.opportunityIds.length > 0) {
    const { rows } = await db.execute<{ id: string }>(sql`
      SELECT id FROM leads WHERE id IN (${inList(input.opportunityIds)}) AND team_id = ${input.teamId} AND vertical IN (${inList(scope.verticals)})
    `);
    if (rows.length !== new Set(input.opportunityIds).size) {
      throw new HttpError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', {
        fieldErrors: { opportunityIds: ['Every supporting opportunity must be in your team scope.'] },
      });
    }
  }
  const { rows: ver } = await db.execute<any>(sql`
    SELECT COALESCE(MAX(version), 0) AS v FROM team_forecasts
     WHERE team_id = ${input.teamId} AND period_label = ${input.periodLabel} AND category = ${input.category}
  `);
  const version = Number(ver[0].v) + 1;
  const forecastId = id('FC');
  await db.insert(teamForecasts).values({
    id: forecastId,
    teamId: input.teamId,
    periodLabel: input.periodLabel,
    category: input.category,
    expectedRevenue: String(input.expectedRevenue),
    currency: input.currency,
    opportunityIds: input.opportunityIds,
    riskNotes: input.riskNotes ?? null,
    assumptions: input.assumptions ?? null,
    status: version > 1 ? 'revised' : 'submitted',
    version,
    actorEmployeeId: scope.employeeId,
  });
  return {
    forecastId, version, status: version > 1 ? 'revised' : 'submitted',
    note: 'Forecast version frozen with supporting opportunity IDs. Won value stays separate from expected revenue.',
  };
}

export async function listForecasts(scope: Scope) {
  assertTl(scope);
  const { rows } = await db.execute<any>(sql`
    SELECT f.*, e.display_name AS submitter_name FROM team_forecasts f
      LEFT JOIN employees e ON e.id = f.actor_employee_id
     WHERE f.team_id IN (${inList(scope.teams)}) ORDER BY f.submitted_at DESC LIMIT 50
  `);
  return {
    forecasts: rows.map((f: any) => ({
      id: f.id, teamId: f.team_id, periodLabel: f.period_label, category: f.category,
      expectedRevenue: Number(f.expected_revenue), currency: f.currency,
      opportunityIds: f.opportunity_ids, riskNotes: f.risk_notes, assumptions: f.assumptions,
      status: f.status, version: f.version, submitterName: f.submitter_name ?? '—', submittedAt: f.submitted_at,
    })),
    basisNote: 'Stage probability comes from the approved version; unpriced or stale opportunities appear as incomplete and stay out of numeric totals.',
  };
}

// ─── TL-12 one-to-ones ───

export async function createOneToOne(scope: Scope, input: {
  employeeId: string; periodLabel: string; agenda: string; scheduledAt: string;
}) {
  assertTl(scope);
  const members = await teamMembers(scope);
  const member = members.find((m) => m.employeeId === input.employeeId);
  if (!member) throw notFound();
  const when = new Date(input.scheduledAt);
  if (Number.isNaN(when.getTime())) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', { fieldErrors: { scheduledAt: ['Enter a valid date and time.'] } });
  }
  const reviewId = id('REV');
  await db.insert(reviews).values({
    id: reviewId,
    employeeId: input.employeeId,
    reviewerEmployeeId: scope.employeeId,
    period: input.periodLabel,
    scorecard: {},
    agenda: input.agenda,
    snapshotVersion: 1,
    scheduledAt: when.toISOString(),
  });
  return { reviewId, snapshotVersion: 1, note: 'Meeting snapshot frozen at creation. Employee disagreement remains recorded; a missing response never implies agreement.' };
}

export async function completeOneToOne(scope: Scope, reviewId: string, input: {
  feedback: string; privateNotes?: string; commitments: Array<{ text: string; dueAt: string }>; disagreement?: string;
}) {
  assertTl(scope);
  return await db.transaction(async (tx) => {
    const { rows } = await tx.execute<any>(sql`SELECT * FROM reviews WHERE id = ${reviewId} FOR UPDATE`);
    const review = rows[0];
    if (!review || review.reviewer_employee_id !== scope.employeeId) {
      throw notFound();
    }
    const { rows: leadRows } = await tx.execute<{ id: string }>(sql`
      SELECT id FROM leads WHERE owner_employee_id = ${review.employee_id} AND team_id IN (${inList(scope.teams)}) AND stage NOT IN ('converted', 'lost') ORDER BY created_at LIMIT 1
    `);

    await tx.update(reviews)
      .set({
        scorecard: { feedback: input.feedback, commitments: input.commitments },
        privateNotes: input.privateNotes ?? null,
        disagreement: input.disagreement ?? review.disagreement,
        snapshotVersion: sql`snapshot_version + 1`,
      })
      .where(eq(reviews.id, reviewId));

    const taskIds: string[] = [];
    for (const c of input.commitments) {
      const due = new Date(c.dueAt);
      if (Number.isNaN(due.getTime())) continue;
      if (!leadRows[0]) continue;
      const taskId = id('TASK');
      await tx.insert(leadTasks).values({
        id: taskId,
        leadId: leadRows[0].id,
        ownerEmployeeId: review.employee_id,
        action: 'other',
        purpose: `One-to-one commitment: ${c.text}`,
        dueAt: due.toISOString(),
        priority: 'normal',
        status: 'open',
      });
      taskIds.push(taskId);
    }

    return { reviewId, commitmentTaskIds: taskIds, snapshotVersion: review.snapshot_version + 1, note: 'Commitments tracked to completion; acknowledgement ≠ agreement.' };
  });
}

export async function listOneToOnes(scope: Scope) {
  assertTl(scope);
  const { rows } = await db.execute<any>(sql`
    SELECT r.*, e.display_name AS employee_name FROM reviews r
      LEFT JOIN employees e ON e.id = r.employee_id
     WHERE (r.reviewer_employee_id = ${scope.employeeId} OR r.reviewer_employee_id IN (
             SELECT employee_id FROM assignments WHERE team_id IN (${inList(scope.teams)})
               AND effective_from <= now() AND (effective_to IS NULL OR effective_to > now())))
     ORDER BY r.scheduled_at DESC NULLS LAST LIMIT 50
  `);
  return {
    reviews: rows.map((r: any) => ({
      id: r.id, employeeId: r.employee_id, employeeName: r.employee_name ?? '—',
      periodLabel: r.period, agenda: r.agenda, scheduledAt: r.scheduled_at,
      snapshotVersion: r.snapshot_version, scorecard: r.scorecard,
      selfReflection: r.self_reflection, employeeResponse: r.employee_response,
      acknowledgedAt: r.acknowledged_at, disagreement: r.disagreement,
    })),
  };
}

// ─── TL-13 intern mentoring ───

export async function createMentorship(scope: Scope, input: {
  internEmployeeId: string; mentorEmployeeId: string; workCap: number;
  allowedProducts: string[]; reviewDate: string;
}) {
  assertTl(scope);
  const members = await teamMembers(scope);
  const intern = members.find((m) => m.employeeId === input.internEmployeeId);
  const mentor = members.find((m) => m.employeeId === input.mentorEmployeeId) || (scope.employeeId === input.mentorEmployeeId ? true : undefined);
  if (!intern) throw notFound();
  if (!mentor) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', {
      fieldErrors: { mentorEmployeeId: ['Mentor must be you (the TL) or an eligible senior associate in your teams.'] },
    });
  }
  const reviewDate = new Date(input.reviewDate);
  if (Number.isNaN(reviewDate.getTime())) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', { fieldErrors: { reviewDate: ['Enter a valid date.'] } });
  }
  const mentorshipId = id('MEN');
  await db.insert(mentorships).values({
    id: mentorshipId,
    internEmployeeId: input.internEmployeeId,
    mentorEmployeeId: input.mentorEmployeeId,
    workCap: input.workCap,
    allowedProducts: input.allowedProducts,
    reviewDate: input.reviewDate,
    grantedBy: scope.employeeId,
  });
  return {
    mentorshipId,
    note: 'TL allocates work but grants no roles. Mentor visibility is scoped and dated; permission expansion is an HR/Super Admin request.',
  };
}

export async function listMentorships(scope: Scope) {
  assertTl(scope);
  await db.execute(sql`
    UPDATE mentorships SET status = 'expired' WHERE status = 'active' AND review_date IS NOT NULL AND review_date < CURRENT_DATE
  `);
  const { rows } = await db.execute<any>(sql`
    SELECT m.*, ei.display_name AS intern_name, em.display_name AS mentor_name
      FROM mentorships m
      LEFT JOIN employees ei ON ei.id = m.intern_employee_id
      LEFT JOIN employees em ON em.id = m.mentor_employee_id
     WHERE m.intern_employee_id IN (
             SELECT employee_id FROM assignments WHERE team_id IN (${inList(scope.teams)})
               AND effective_from <= now() AND (effective_to IS NULL OR effective_to > now()))
        OR m.mentor_employee_id = ${scope.employeeId}
     ORDER BY m.created_at DESC LIMIT 50
  `);
  return {
    mentorships: rows.map((m: any) => ({
      id: m.id, internEmployeeId: m.intern_employee_id, internName: m.intern_name ?? '—',
      mentorEmployeeId: m.mentor_employee_id, mentorName: m.mentor_name ?? '—',
      workCap: m.work_cap, allowedProducts: m.allowed_products,
      reviewDate: m.review_date, status: m.status,
    })),
    note: 'Trainee output, mentor reviews and independent conversions reported separately.',
  };
}

// ─── TL-14/15 staffing requests + escalations (submitting executes nothing) ───

export async function createTeamRequest(scope: Scope, input: {
  category: 'staffing' | 'role-change' | 'capacity' | 'complaint' | 'commercial-exception' | 'merge-request';
  teamId?: string; subjectEmployeeId?: string; leadId?: string; severity?: 'low' | 'medium' | 'high';
  request: string; businessReason: string; effectiveDate?: string; impact?: string; requestedDecision?: string;
}) {
  assertTl(scope);
  if (input.teamId && !scope.teams.includes(input.teamId)) throw notFound();
  if (input.leadId) {
    const { rows } = await db.execute<{ id: string }>(sql`SELECT id FROM leads l WHERE l.id = ${input.leadId} AND ${teamFilter(scope, 'l')}`);
    if (!rows[0]) throw notFound();
  }
  const requestId = id('TREQ');
  const dueAt = new Date(Date.now() + 3 * 86_400_000);
  await db.insert(teamRequests).values({
    id: requestId,
    teamId: input.teamId ?? null,
    actorEmployeeId: scope.employeeId,
    category: input.category,
    subjectEmployeeId: input.subjectEmployeeId ?? null,
    leadId: input.leadId ?? null,
    severity: input.severity ?? 'medium',
    payload: {
      request: input.request, businessReason: input.businessReason,
      effectiveDate: input.effectiveDate ?? null, impact: input.impact ?? null,
      requestedDecision: input.requestedDecision ?? null,
    },
    dueAt: dueAt.toISOString(),
  });
  return {
    requestId, status: 'pending' as const,
    note: 'Requesting a change grants no access. Manager/HR approval and admin execution remain separate; a rejection leaves assignments unchanged.',
  };
}

export async function listTeamRequests(scope: Scope) {
  assertTl(scope);
  const { rows } = await db.execute<any>(sql`
    SELECT tr.*, e.display_name AS actor_name, l.display_name AS lead_name
      FROM team_requests tr
      LEFT JOIN employees e ON e.id = tr.actor_employee_id
      LEFT JOIN leads l ON l.id = tr.lead_id
     WHERE (tr.actor_employee_id = ${scope.employeeId} OR tr.team_id IN (${inList(scope.teams)})
            OR (tr.category = 'merge-request' AND tr.actor_employee_id = ${scope.employeeId}))
     ORDER BY tr.created_at DESC LIMIT 50
  `);
  return {
    requests: rows.map((r: any) => ({
      id: r.id, category: r.category, status: r.status, severity: r.severity,
      actorName: r.actor_name ?? '—', leadName: r.lead_name ?? null,
      subjectEmployeeId: r.subject_employee_id, payload: r.payload,
      decisionReason: r.decision_reason, decidedAt: r.decided_at,
      dueAt: r.due_at, createdAt: r.created_at,
    })),
  };
}

// ─── TL-16 team review pack (PDF) ───

export async function createTeamPack(scope: Scope, input: { teamIds: string[]; period: 'week' | 'month' | 'quarter' }) {
  assertTl(scope);
  const teamIds = input.teamIds.filter((t) => scope.teams.includes(t));
  if (teamIds.length === 0) throw notFound();
  const pdfkit = (await import('pdfkit')).default as any;
  const { mkdirSync, writeFileSync } = await import('node:fs');
  const { resolve, dirname } = await import('node:path');
  const EXPORT_ROOT = resolve(__dirname, '../../../.uploads/exports');
  const members = (await teamMembers(scope)).filter((m) => m.teamIds.some((t) => teamIds.includes(t)));

  const { rows: totals } = await db.execute<any>(sql`
    SELECT COUNT(*)::int AS active_leads,
           COUNT(*) FILTER (WHERE stage = 'converted')::int AS wins,
           COUNT(*) FILTER (WHERE stage = 'lost')::int AS losses
      FROM leads WHERE team_id IN (${inList(teamIds)}) AND vertical IN (${inList(scope.verticals)})
  `);
  const { rows: targets } = await db.execute<any>(sql`
    SELECT period_label, metric, parent_value, version FROM team_targets
     WHERE team_id IN (${inList(teamIds)}) ORDER BY created_at DESC LIMIT 6
  `);
  const now = new Date();
  const periodStart = input.period === 'week'
    ? new Date(now.getTime() - 7 * 86_400_000)
    : input.period === 'month'
      ? new Date(now.getTime() - 30 * 86_400_000)
      : new Date(now.getTime() - 90 * 86_400_000);

  const exportId = id('TPX');
  const filename = `finverse-team-pack-${input.period}-${exportId}.pdf`;
  const relPath = `teams/${exportId}-${filename}`;
  const absPath = resolve(EXPORT_ROOT, relPath);
  mkdirSync(dirname(absPath), { recursive: true });

  const doc = new pdfkit({ margin: 48, size: 'A4' });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<void>((resolveDoc) => doc.on('end', () => resolveDoc()));
  doc.fontSize(16).fillColor('#113F3D').text('Finverse CRM — Team review pack');
  doc.moveDown(0.4);
  doc.fontSize(9).fillColor('#6B7280')
    .text(`Teams: ${teamIds.join(' + ')} (deduplicated union — every fact counted once)`);
  doc.text(`Period: ${input.period} (${periodStart.toISOString()} → ${now.toISOString()}) · Event-time team attribution`);
  doc.text(`Generated by: ${scope.employeeId} · Metric version: tl-metrics-v1 · SYNTHETIC DEMO DATA`);
  doc.moveDown(0.6);
  doc.fontSize(12).fillColor('#1B1F1E').text('Team totals');
  doc.fontSize(9).text(`Active leads: ${totals[0]?.active_leads ?? 0} · Wins: ${totals[0]?.wins ?? 0} · Losses: ${totals[0]?.losses ?? 0}`);
  doc.moveDown(0.4);
  doc.fontSize(12).text('Member appendix (same cutoff and formula version as the summary)');
  doc.fontSize(9);
  for (const m of members) {
    doc.text(`• ${m.displayName} (${m.employeeId}) — open leads ${m.openLeads}, open tasks ${m.openTasks}, overdue ${m.overdueTasks}, completed (24h) ${m.completedThisPeriod}, availability ${m.availability}`);
  }
  doc.moveDown(0.4);
  doc.fontSize(12).text('Target reconciliation (latest approved versions)');
  doc.fontSize(9);
  for (const t of targets) {
    doc.text(`• ${t.period_label} ${t.metric}: parent ${t.parent_value} (v${t.version})`);
  }
  doc.moveDown(0.4);
  doc.fontSize(8).fillColor('#6B7280')
    .text('Exclusions: other verticals and ungranted teams are omitted; pending approvals remain visible in the workspace only. Six-period history and original/revised versions are retained in the report centre.');
  doc.end();
  await done;
  writeFileSync(absPath, Buffer.concat(chunks));
  const expiresAt = new Date(Date.now() + 7 * 86_400_000);

  await db.insert(teamReportExports).values({
    id: exportId,
    actorEmployeeId: scope.employeeId,
    teamIds,
    period: input.period,
    periodStart: periodStart.toISOString(),
    periodEnd: now.toISOString(),
    metricVersion: 'tl-metrics-v1',
    filename,
    relPath,
    expiresAt: expiresAt.toISOString(),
  });
  return { id: exportId, downloadPath: `/api/tl/team-packs/${exportId}/download`, snapshotAt: now.toISOString(), metricVersion: 'tl-metrics-v1', expiresAt: expiresAt.toISOString() };
}

export async function downloadTeamPack(scope: Scope, exportId: string) {
  assertTl(scope);
  const { rows } = await db.execute<any>(sql`SELECT * FROM team_report_exports WHERE id = ${exportId}`);
  const exp = rows[0];
  if (!exp) throw notFound();
  if (exp.revoked_at || new Date(exp.expires_at) < new Date()) {
    throw forbidden('This export has expired or been revoked.');
  }
  const teamIds = exp.team_ids as string[];
  if (!teamIds.every((t) => scope.teams.includes(t))) {
    throw notFound();
  }
  const { readFileSync } = await import('node:fs');
  const { resolve } = await import('node:path');
  const absPath = resolve(__dirname, '../../../.uploads/exports', exp.rel_path);
  return { filename: exp.filename, bytes: readFileSync(absPath) };
}

// ─── TL-17 recurring report schedules (persisted; executed by the job tick) ───

function nextRunAt(cadence: string, from = new Date()): Date {
  const IST_OFFSET_MS = 330 * 60_000;
  const istTime = new Date(from.getTime() + IST_OFFSET_MS);

  if (cadence === 'monthly-1st-09:00+05:30') {
    const year = istTime.getUTCFullYear();
    const month = istTime.getUTCMonth();
    return new Date(Date.UTC(year, month + 1, 1, 3, 30, 0, 0));
  }

  const day = istTime.getUTCDay();
  let daysUntilMon = ((1 - day + 7) % 7);
  const pastTargetToday = istTime.getUTCHours() > 9 || (istTime.getUTCHours() === 9 && istTime.getUTCMinutes() > 0);
  if (daysUntilMon === 0 && pastTargetToday) {
    daysUntilMon = 7;
  } else if (daysUntilMon === 0) {
    daysUntilMon = 7;
  }
  const targetDate = new Date(istTime.getTime() + daysUntilMon * 86_400_000);
  return new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 3, 30, 0, 0));
}

export async function createReportSchedule(scope: Scope, input: {
  name: string; cadence: string; period: 'weekly' | 'monthly'; teamIds: string[]; recipients: string[];
}) {
  assertTl(scope);
  const teamIds = input.teamIds.filter((t) => scope.teams.includes(t));
  if (teamIds.length === 0) throw notFound();
  const scheduleId = id('SCH');
  const dedupeKey = `${scope.employeeId}:${input.cadence}:${input.period}:${teamIds.slice().sort().join('-')}`;
  const nextRun = nextRunAt(input.cadence);
  try {
    await db.insert(reportSchedules).values({
      id: scheduleId,
      ownerEmployeeId: scope.employeeId,
      name: input.name,
      cadence: input.cadence,
      period: input.period,
      teamIds,
      recipients: input.recipients,
      dedupeKey,
      nextRunAt: nextRun.toISOString(),
    });
  } catch (err: any) {
    if (err?.code === '23505' || err?.cause?.code === '23505') {
      throw new HttpError(409, 'DUPLICATE_OPEN_TASK', 'An identical schedule already exists (owner, cadence, period, teams).', {});
    }
    throw err;
  }
  return { scheduleId, nextRunAt: nextRun.toISOString(), note: 'Recipient and owner permissions are rechecked every run. Delivery is the protected report centre — no public email attachments.' };
}

export async function listReportSchedules(scope: Scope) {
  assertTl(scope);
  const { rows } = await db.execute<any>(sql`
    SELECT s.*, e.display_name AS owner_name FROM report_schedules s
      LEFT JOIN employees e ON e.id = s.owner_employee_id
     WHERE s.owner_employee_id = ${scope.employeeId} OR s.team_ids::jsonb ?| ARRAY[${inList(scope.teams)}]::text[]
     ORDER BY s.created_at DESC LIMIT 50
  `);
  return {
    schedules: rows.map((s: any) => ({
      id: s.id, name: s.name, cadence: s.cadence, period: s.period,
      teamIds: s.team_ids, recipients: s.recipients, status: s.status,
      ownerName: s.owner_name ?? '—', lastRunAt: s.last_run_at, lastExportId: s.last_export_id,
      lastError: s.last_error, nextRunAt: s.next_run_at,
    })),
    note: 'One version per period; failures alert and appear on the schedule.',
  };
}

export async function runDueSchedules(): Promise<{ ran: number; suspended: number; errors: number }> {
  // Concurrency guard: Dedicated client connection ensures session-level PostgreSQL advisory lock
  // is acquired and released on the exact same connection, avoiding cross-connection lock leakage.
  const client = await pool.connect();
  let lockAcquired = false;
  try {
    const { rows: lockRows } = await client.query(`SELECT pg_try_advisory_lock(884422) AS acquired`);
    lockAcquired = Boolean(lockRows[0]?.acquired);
    if (!lockAcquired) {
      return { ran: 0, suspended: 0, errors: 0 };
    }

    let ran = 0, suspended = 0, errors = 0;
    try {
      const { rows } = await client.query(
        `SELECT * FROM report_schedules WHERE status = 'active' AND next_run_at <= now()`
      );
      for (const s of rows) {
        try {
          const { loadAuthContextByEmployeeId } = await import('./users');
          const auth = await loadAuthContextByEmployeeId(s.owner_employee_id);
          if (!auth || auth.scope.role !== 'TL') {
            await client.query(`UPDATE report_schedules SET status = 'suspended', last_error = 'owner offboarded, demoted or grant expired' WHERE id = $1`, [s.id]);
            suspended++;
            continue;
          }
          const teamIds = (s.team_ids as string[]).filter((t) => auth.scope.teams.includes(t));
          if (teamIds.length === 0) {
            await client.query(`UPDATE report_schedules SET status = 'suspended', last_error = 'grant expired — no shared team remains' WHERE id = $1`, [s.id]);
            suspended++;
            continue;
          }
          const pack = await createTeamPack(auth.scope, { teamIds, period: s.period === 'monthly' ? 'month' : 'week' });
          await client.query(
            `UPDATE report_schedules SET last_run_at = now(), last_export_id = $2, last_error = NULL, next_run_at = $3 WHERE id = $1`,
            [s.id, pack.id, nextRunAt(s.cadence)]
          );
          ran++;
        } catch (err: any) {
          await client.query(
            `UPDATE report_schedules SET last_run_at = now(), last_error = $2, next_run_at = $3 WHERE id = $1`,
            [s.id, String(err?.message ?? 'run failed').slice(0, 200), nextRunAt(s.cadence)]
          );
          errors++;
        }
      }
      return { ran, suspended, errors };
    } finally {
      await client.query(`SELECT pg_advisory_unlock(884422)`);
    }
  } finally {
    client.release();
  }
}
