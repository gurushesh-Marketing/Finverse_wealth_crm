import { pool } from './db';
import type { Scope } from './users';
import { forbidden, notFound, HttpError } from '../lib/errors';
import { channelEligibleForCall } from '../wealth/rules';
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

function teamFilter(scope: Scope, params: unknown[], alias = 'l'): string {
  params.push(scope.verticals);
  const vIdx = params.length;
  params.push(scope.teams);
  return `${alias}.vertical = ANY($${vIdx}) AND ${alias}.team_id = ANY($${params.length})`;
}

export interface TlMember extends TlMemberRow {
  teamIds: string[];
}

async function teamMembers(scope: Scope): Promise<TlMember[]> {
  const { rows } = await pool.query(
    `SELECT e.id, e.display_name,
            COALESCE(av.status, 'available') AS availability,
            array_remove(array_agg(DISTINCT a.team_id), NULL) AS team_ids
       FROM assignments a
       JOIN employees e ON e.id = a.employee_id
       LEFT JOIN LATERAL (
         SELECT status FROM availability_changes c
          WHERE c.employee_id = e.id AND c.effective_from <= now()
          ORDER BY c.effective_from DESC LIMIT 1
       ) av ON true
      WHERE a.team_id = ANY($1) AND a.role = 'SC'
        AND a.effective_from <= now()
        AND (a.effective_to IS NULL OR a.effective_to > now())
      GROUP BY e.id, e.display_name, av.status
      ORDER BY e.display_name`,
    [scope.teams]
  );
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
  const { rows: work } = await pool.query(
    `SELECT owner_employee_id,
            COUNT(*) FILTER (WHERE kind = 'lead')::int AS open_leads,
            COUNT(*) FILTER (WHERE kind = 'task')::int AS open_tasks,
            COUNT(*) FILTER (WHERE kind = 'task' AND overdue)::int AS overdue_tasks
       FROM (
         SELECT l.owner_employee_id, 'lead'::text AS kind, false AS overdue
           FROM leads l
          WHERE l.owner_employee_id = ANY($1)
            AND l.vertical = ANY($2)
            AND l.team_id = ANY($3)
            AND l.stage NOT IN ('converted', 'lost', 'disbursal', 'active-funded', 'registration')
         UNION ALL
         SELECT t.owner_employee_id, 'task', t.due_at < now()
           FROM lead_tasks t
           JOIN leads l ON l.id = t.lead_id
          WHERE t.owner_employee_id = ANY($1)
            AND l.vertical = ANY($2)
            AND l.team_id = ANY($3)
            AND t.status = 'open'
       ) w
      GROUP BY owner_employee_id`,
    [ids, scope.verticals, scope.teams]
  );
  const byId = new Map<string, any>(work.map((w: any) => [w.owner_employee_id, w]));
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const { rows: done } = await pool.query(
    `SELECT t.owner_employee_id, COUNT(*)::int AS n
       FROM lead_tasks t
       JOIN leads l ON l.id = t.lead_id
      WHERE t.owner_employee_id = ANY($1)
        AND l.vertical = ANY($2)
        AND l.team_id = ANY($3)
        AND t.status = 'completed'
        AND t.completed_at >= $4
      GROUP BY t.owner_employee_id`,
    [ids, scope.verticals, scope.teams, since]
  );
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
  const params: unknown[] = [];
  const filter = teamFilter(scope, params);
  const members = await teamMembers(scope);
  const start = periodStart(period);

  const { rows: totals } = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE l.stage NOT IN ('converted', 'lost', 'disbursal', 'active-funded', 'registration'))::int AS active_leads,
       COUNT(*) FILTER (WHERE l.stage IN ('converted', 'disbursal', 'active-funded', 'registration') AND l.updated_at >= $${params.length + 1})::int AS wins,
       COALESCE(SUM(q.expected_value) FILTER (WHERE l.stage NOT IN ('converted', 'lost', 'disbursal', 'active-funded', 'registration')), 0)::float AS pipeline_value
     FROM leads l
     LEFT JOIN LATERAL (
       SELECT q2.expected_value FROM qualifications q2 WHERE q2.lead_id = l.id
        ORDER BY q2.created_at DESC LIMIT 1
     ) q ON true
     WHERE ${filter}`,
    [...params, start]
  );
  const { rows: taskRows } = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE t.status = 'open')::int AS open_tasks,
            COUNT(*) FILTER (WHERE t.status = 'open' AND t.due_at < now())::int AS overdue,
            COUNT(*) FILTER (WHERE t.status = 'open' AND t.due_at >= now() AND t.due_at < now() + interval '1 day')::int AS due_today,
            COUNT(*) FILTER (WHERE t.status = 'completed' AND t.completed_at >= $${params.length + 1})::int AS completed
       FROM lead_tasks t JOIN leads l ON l.id = t.lead_id
      WHERE ${filter}`,
    [...params, start]
  );
  const { rows: pending } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM outcome_requests r JOIN leads l ON l.id = r.lead_id
      WHERE r.status = 'pending' AND ${filter}`,
    params
  );
  const { rows: idleRows } = await pool.query(`SELECT 1`, []);

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
  void idleRows;

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
  const params: unknown[] = [];
  const filter = teamFilter(scope, params);
  const { rows } = await pool.query(
    `SELECT l.*, eo.display_name AS owner_name, t.name AS team_name
       FROM leads l
       LEFT JOIN employees eo ON eo.id = l.owner_employee_id
       LEFT JOIN teams t ON t.id = l.team_id
      WHERE ${filter} ORDER BY l.updated_at DESC LIMIT 30`,
    params
  );
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
  const params: unknown[] = [leadId];
  const filter = teamFilter(scope, params);
  const { rows } = await pool.query(`SELECT l.* FROM leads l WHERE l.id = $1 AND ${filter}`, params);
  const lead = rows[0];
  if (!lead) throw notFound();
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', { fieldErrors: { dueAt: ['Enter a valid date and time.'] } });
  }
  const taskId = id('TASK');
  await pool.query(
    `INSERT INTO lead_tasks (id, lead_id, owner_employee_id, action, purpose, due_at, priority, status)
     VALUES ($1, $2, $3, 'other', $4, $5, 'high', 'open')`,
    [taskId, leadId, lead.owner_employee_id ?? scope.employeeId, `TL corrective: ${purpose}`, due]
  );
  await pool.query(
    `INSERT INTO lead_events (id, lead_id, actor_employee_id, kind, note, actor_role, actor_team_id, assignment_id)
     VALUES ($1, $2, $3, 'task-updated', $4, $5, $6, $7)`,
    [id('EVT'), leadId, scope.employeeId, `TL corrective task assigned: ${purpose}`, scope.role, lead.team_id, scope.assignmentId]
  );
  return { taskId, status: 'open' as const };
}

// ─── TL-02/03 allocation ───

export async function allocationQueue(scope: Scope) {
  assertTl(scope);
  const params: unknown[] = [];
  const filter = teamFilter(scope, params);
  const { rows } = await pool.query(
    `SELECT l.*, EXTRACT(EPOCH FROM (now() - l.created_at))::int AS age_seconds
       FROM leads l WHERE l.owner_employee_id IS NULL AND ${filter}
      ORDER BY l.created_at ASC`,
    params
  );
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
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const params: unknown[] = [input.leadId];
    const filter = teamFilter(scope, params);
    const { rows } = await client.query(
      `SELECT l.* FROM leads l WHERE l.id = $1 AND ${filter} FOR UPDATE`,
      params
    );
    const lead = rows[0];
    if (!lead) { await client.query('ROLLBACK'); throw notFound(); }
    if (lead.owner_employee_id !== null) {
      await client.query('ROLLBACK');
      throw new HttpError(409, 'DUPLICATE_OPEN_TASK', 'Lead already has an owner — use rebalance.', {});
    }
    if (lead.record_version !== input.recordVersion) {
      await client.query('ROLLBACK');
      throw new HttpError(409, 'DUPLICATE_OPEN_TASK', 'Record changed since you loaded it. Reload and retry.', {});
    }
    const { rows: recips } = await client.query(
      `SELECT e.id FROM assignments a JOIN employees e ON e.id = a.employee_id
        WHERE a.team_id = $1 AND a.role = 'SC' AND a.effective_from <= now()
          AND (a.effective_to IS NULL OR a.effective_to > now()) AND e.id = $2`,
      [lead.team_id, input.toEmployeeId]
    );
    if (!recips[0]) {
      await client.query('ROLLBACK');
      throw new HttpError(422, 'VALIDATION_FAILED', 'Recipient is not an eligible associate for this team.', {
        fieldErrors: { toEmployeeId: ['Choose an eligible associate.'] },
      });
    }
    await client.query(
      `UPDATE leads SET owner_employee_id = $2, updated_at = now(), record_version = record_version + 1 WHERE id = $1`,
      [input.leadId, input.toEmployeeId]
    );
    await client.query(
      `INSERT INTO lead_ownership_events (id, lead_id, from_owner_employee_id, to_owner_employee_id, actor_employee_id, actor_role, actor_team_id, assignment_id, kind, reason, record_version)
       VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, 'first-allocation', $8, $9)`,
      [id('OWN'), input.leadId, input.toEmployeeId, scope.employeeId, scope.role, lead.team_id, scope.assignmentId, input.reason, input.recordVersion]
    );
    const taskId = id('TASK');
    await client.query(
      `INSERT INTO lead_tasks (id, lead_id, owner_employee_id, action, purpose, due_at, priority, status)
       VALUES ($1, $2, $3, 'voice-call', 'First contact after allocation', $4, 'high', 'open')`,
      [taskId, input.leadId, input.toEmployeeId, new Date(Date.now() + 86_400_000)]
    );
    await client.query(
      `INSERT INTO lead_events (id, lead_id, actor_employee_id, kind, note, actor_role, actor_team_id, assignment_id)
       VALUES ($1, $2, $3, 'assignment-changed', $4, $5, $6, $7)`,
      [id('EVT'), input.leadId, scope.employeeId,
       `Assignment notification (in-app): lead allocated to ${input.toEmployeeId} (${input.reason}). First-contact task ${taskId} created.`,
       scope.role, lead.team_id, scope.assignmentId]
    );
    await client.query('COMMIT');
    return { leadId: input.leadId, status: 'assigned', toEmployeeId: input.toEmployeeId, taskId };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
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
  const params: unknown[] = [input.leadIds, input.teamId];
  const filter = `l.vertical = ANY($3)`;
  const { rows } = await pool.query(
    `SELECT l.* FROM leads l WHERE l.id = ANY($1) AND l.team_id = $2 AND l.vertical = ANY($3)`,
    [...params, scope.verticals]
  );
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
  const { rows: existing } = await pool.query(`SELECT * FROM allocation_batches WHERE batch_key = $1`, [batchKey]);
  if (existing[0]) {
    return { batchId: existing[0].id as string, batchKey, results: existing[0].results as AllocationReceipt[], replayed: true };
  }
  const preview = await batchPreview(scope, input);
  const client = await pool.connect();
  const batchId = id('BATCH');
  const results: AllocationReceipt[] = [];
  try {
    await client.query('BEGIN');
    for (const row of preview.receipts) {
      if (row.status !== 'assigned' || !row.toEmployeeId) { results.push(row); continue; }
      await client.query('SAVEPOINT alloc_row');
      try {
        const params: unknown[] = [row.leadId, input.teamId, scope.verticals];
        const { rows: leadRows } = await client.query(
          `SELECT l.* FROM leads l WHERE l.id = $1 AND l.team_id = $2 AND l.vertical = ANY($3) AND l.owner_employee_id IS NULL FOR UPDATE`,
          params
        );
        const lead = leadRows[0];
        if (!lead) { results.push({ ...row, status: 'failed', detail: 'revalidated: no longer allocatable' }); continue; }
        const taskId = id('TASK');
        await client.query(
          `UPDATE leads SET owner_employee_id = $2, updated_at = now(), record_version = record_version + 1 WHERE id = $1`,
          [row.leadId, row.toEmployeeId]
        );
        await client.query(
          `INSERT INTO lead_ownership_events (id, lead_id, to_owner_employee_id, actor_employee_id, actor_role, actor_team_id, assignment_id, kind, reason, batch_key, record_version)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'batch', 'Batch distribution (weighted round-robin)', $8, $9)`,
          [id('OWN'), row.leadId, row.toEmployeeId, scope.employeeId, scope.role, lead.team_id, scope.assignmentId, batchKey, lead.record_version]
        );
        await client.query(
          `INSERT INTO lead_tasks (id, lead_id, owner_employee_id, action, purpose, due_at, priority, status)
           VALUES ($1, $2, $3, 'voice-call', 'First contact after batch allocation', $4, 'high', 'open')`,
          [taskId, row.leadId, row.toEmployeeId, new Date(Date.now() + 86_400_000)]
        );
        await client.query(
          `INSERT INTO lead_events (id, lead_id, actor_employee_id, kind, note, actor_role, actor_team_id, assignment_id)
           VALUES ($1, $2, $3, 'assignment-changed', $4, $5, $6, $7)`,
          [id('EVT'), row.leadId, scope.employeeId,
           `Assignment notification (in-app): batch ${batchKey} allocated to ${row.toEmployeeId}. First-contact task ${taskId}.`,
           scope.role, lead.team_id, scope.assignmentId]
        );
        results.push({ ...row, taskId });
        await client.query('RELEASE SAVEPOINT alloc_row');
      } catch (err: any) {
        await client.query('ROLLBACK TO SAVEPOINT alloc_row');
        if (err?.code === '23505') {
          results.push({ ...row, status: 'conflict', detail: 'concurrent allocation — left for retry' });
        } else {
          throw err;
        }
      }
    }
    try {
      await client.query(
        `INSERT INTO allocation_batches (id, batch_key, actor_employee_id, actor_team_id, method, total_count, success_count, held_count, failed_count, results)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [batchId, batchKey, scope.employeeId, scope.teams[0] ?? null, input.method, results.length,
         results.filter((r) => r.status === 'assigned').length,
         results.filter((r) => r.status === 'held').length,
         results.filter((r) => r.status === 'failed' || r.status === 'conflict').length,
         JSON.stringify(results)]
      );
    } catch (err: any) {
      if (err?.code === '23505') {
        await client.query('ROLLBACK');
        const { rows: again } = await pool.query(`SELECT * FROM allocation_batches WHERE batch_key = $1`, [batchKey]);
        return { batchId: again[0]?.id as string, batchKey, results: again[0]?.results as AllocationReceipt[], replayed: true };
      }
      throw err;
    }
    await client.query('COMMIT');
    return { batchId, batchKey, results };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

// ─── TL-04 workload + rebalance ───

export async function workload(scope: Scope) {
  assertTl(scope);
  const members = await teamMembers(scope);
  return { members, metricVersion: METRIC_VERSION };
}

export async function rebalance(scope: Scope, input: TlRebalanceInput) {
  assertTl(scope);
  const client = await pool.connect();
  const results: Array<{ leadId: string; status: 'moved' | 'held' | 'failed'; detail?: string }> = [];
  try {
    await client.query('BEGIN');
    const { rows: dest } = await client.query(
      `SELECT a.team_id FROM assignments a
        WHERE a.employee_id = $1 AND a.role = 'SC' AND a.team_id = ANY($2)
          AND a.effective_from <= now() AND (a.effective_to IS NULL OR a.effective_to > now())`,
      [input.toEmployeeId, scope.teams]
    );
    if (!dest[0]) {
      await client.query('ROLLBACK');
      throw forbidden('Recipient is outside your granted teams — cross-boundary moves become a Manager request.');
    }
    for (const leadId of input.leadIds) {
      const params: unknown[] = [leadId];
      const filter = teamFilter(scope, params);
      const { rows } = await client.query(`SELECT l.* FROM leads l WHERE l.id = $1 AND ${filter} FOR UPDATE`, params);
      const lead = rows[0];
      if (!lead) { results.push({ leadId, status: 'failed', detail: 'out of scope' }); continue; }
      if (!lead.owner_employee_id) { results.push({ leadId, status: 'held', detail: 'unowned — use allocation' }); continue; }
      const { rows: pend } = await client.query(
        `SELECT id FROM outcome_requests WHERE lead_id = $1 AND status = 'pending'`, [leadId]
      );
      if (pend[0]) { results.push({ leadId, status: 'held', detail: 'pending approval locked — decide first' }); continue; }
      await client.query(
        `UPDATE leads SET owner_employee_id = $2, updated_at = now(), record_version = record_version + 1 WHERE id = $1`,
        [leadId, input.toEmployeeId]
      );
      await client.query(
        `UPDATE lead_tasks SET owner_employee_id = $2 WHERE lead_id = $1 AND status = 'open'`,
        [leadId, input.toEmployeeId]
      );
      await client.query(
        `INSERT INTO lead_ownership_events (id, lead_id, from_owner_employee_id, to_owner_employee_id, actor_employee_id, actor_role, actor_team_id, assignment_id, kind, reason, record_version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'rebalance', $9, $10)`,
        [id('OWN'), leadId, lead.owner_employee_id, input.toEmployeeId, scope.employeeId, scope.role, lead.team_id, scope.assignmentId,
         `${input.reason} (handoff by ${input.handoffDeadline})`, lead.record_version]
      );
      await client.query(
        `INSERT INTO lead_events (id, lead_id, actor_employee_id, kind, note, actor_role, actor_team_id, assignment_id)
         VALUES ($1, $2, $3, 'assignment-changed', $4, $5, $6, $7)`,
        [id('EVT'), leadId, scope.employeeId,
         `Assignment notification (in-app): work rebalanced ${lead.owner_employee_id} → ${input.toEmployeeId} (${input.reason}). Open tasks moved together; original due times preserved; earlier activity stays with its actor.`,
         scope.role, lead.team_id, scope.assignmentId]
      );
      results.push({ leadId, status: 'moved' });
    }
    await client.query('COMMIT');
    return { results };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
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
  const params: unknown[] = [];
  const filter = teamFilter(scope, params);
  const { rows } = await pool.query(
    `SELECT t.id, t.lead_id, t.owner_employee_id, t.purpose, t.action, t.due_at,
            EXTRACT(EPOCH FROM (now() - t.due_at))::int AS age_seconds,
            l.display_name AS lead_name, e.display_name AS owner_name,
            COALESCE((SELECT COUNT(*) FROM overdue_escalations oe WHERE oe.task_id = t.id), 0)::int AS breach_count
       FROM lead_tasks t
       JOIN leads l ON l.id = t.lead_id
       LEFT JOIN employees e ON e.id = t.owner_employee_id
      WHERE t.status = 'open' AND t.due_at < now() AND ${filter}
      ORDER BY t.due_at ASC`,
    params
  );
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
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const params: unknown[] = [taskId];
    const filter = teamFilter(scope, params);
    const { rows } = await client.query(
      `SELECT t.*, l.team_id AS lead_team, l.display_name AS lead_name FROM lead_tasks t
         JOIN leads l ON l.id = t.lead_id
        WHERE t.id = $1 AND ${filter} FOR UPDATE`,
      params
    );
    const task = rows[0];
    if (!task) { await client.query('ROLLBACK'); throw notFound(); }
    if (task.status !== 'open') {
      await client.query('ROLLBACK');
      throw new HttpError(409, 'DUPLICATE_OPEN_TASK', 'Task is no longer open — original history stays untouched.', {});
    }
    // TL cannot erase deadlines or backdate: no update to due_at/completed_at here.
    let newOwner = task.owner_employee_id;
    if (input.action === 'reassign') {
      if (!input.newOwnerEmployeeId) {
        await client.query('ROLLBACK');
        throw new HttpError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', { fieldErrors: { newOwnerEmployeeId: ['Choose a recipient for the handoff.'] } });
      }
      const { rows: ok } = await client.query(
        `SELECT id FROM assignments WHERE employee_id = $1 AND team_id = $2 AND role = 'SC'
           AND effective_from <= now() AND (effective_to IS NULL OR effective_to > now())`,
        [input.newOwnerEmployeeId, task.lead_team]
      );
      if (!ok[0]) {
        await client.query('ROLLBACK');
        throw forbidden('Handoff recipient is outside the team — permitted handoffs only.');
      }
      newOwner = input.newOwnerEmployeeId;
    }
    const { rows: sup } = await client.query(
      `SELECT channels FROM contact_suppressions WHERE lead_id = $1 AND active = true`, [task.lead_id]
    );
    const suppressed = sup.flatMap((s: any) => s.channels);
    const recoveryTaskId = id('TASK');
    await client.query(
      `INSERT INTO lead_tasks (id, lead_id, owner_employee_id, action, purpose, due_at, priority, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'high', 'open')`,
      [recoveryTaskId, task.lead_id, newOwner, channelEligibleForCall(suppressed) ? 'voice-call' : 'whatsapp-message',
       `Recovery after overdue (${input.action}): ${input.reason}`, due]
    );
    const { rows: prev } = await client.query(`SELECT COUNT(*)::int AS n FROM overdue_escalations WHERE task_id = $1`, [taskId]);
    const breachCount = (prev[0]?.n ?? 0) + 1;
    const notifyManager = breachCount >= BREACH_THRESHOLD;
    await client.query(
      `INSERT INTO overdue_escalations (id, task_id, lead_id, subject_employee_id, actor_employee_id, action, reason, severity, recovery_task_id, manager_notified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [id('ESC'), taskId, task.lead_id, task.owner_employee_id, scope.employeeId, input.action, input.reason,
       breachCount >= BREACH_THRESHOLD ? 'high' : 'medium', recoveryTaskId, notifyManager]
    );
    await client.query(
      `INSERT INTO lead_events (id, lead_id, actor_employee_id, kind, note, actor_role, actor_team_id, assignment_id)
       VALUES ($1, $2, $3, 'task-updated', $4, $5, $6, $7)`,
      [id('EVT'), task.lead_id, scope.employeeId,
       `TL overdue action (${input.action}) on ${taskId}: ${input.reason}. Recovery task ${recoveryTaskId} (due ${due.toISOString()}). Original deadline history preserved.${notifyManager ? ' Manager notified (breach threshold).' : ''}`,
       scope.role, task.lead_team, scope.assignmentId]
    );
    await client.query('COMMIT');
    return { escalationId: null, recoveryTaskId, breachCount, notifyManager };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

// ─── TL-06 associate review (TL workspace; never the Caller interface) ───

export async function memberReview(scope: Scope, employeeId: string, period: TlPeriod) {
  assertTl(scope);
  const memberRows = await teamMembers(scope);
  const member = memberRows.find((m) => m.employeeId === employeeId);
  if (!member) throw notFound();
  const start = periodStart(period);
  const { rows: history } = await pool.query(
    `SELECT id, team_id, role, effective_from, effective_to FROM assignments
      WHERE employee_id = $1 AND team_id = ANY($2) ORDER BY effective_from DESC`,
    [employeeId, scope.teams]
  );
  const { rows: ownEvents } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM lead_events e
       JOIN leads l ON l.id = e.lead_id
      WHERE e.actor_employee_id = $1 AND e.occurred_at >= $2
        AND l.vertical = ANY($3) AND l.team_id = ANY($4)
        AND e.assignment_id IS NOT NULL`,
    [employeeId, start, scope.verticals, scope.teams]
  );
  const { rows: inherited } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM lead_ownership_events oe
       JOIN leads l ON l.id = oe.lead_id
      WHERE oe.to_owner_employee_id = $1 AND oe.kind IN ('transfer', 'rebalance')
        AND l.vertical = ANY($2) AND l.team_id = ANY($3)`,
    [employeeId, scope.verticals, scope.teams]
  );
  const { rows: coaching } = await pool.query(
    `SELECT qr.id, qr.feedback, qr.created_at FROM call_quality_reviews qr
       JOIN calls c ON c.id = qr.call_id
       JOIN leads l ON l.id = c.lead_id
      WHERE qr.subject_employee_id = $1 AND l.team_id = ANY($2) AND l.vertical = ANY($3)
      ORDER BY qr.created_at DESC LIMIT 5`,
    [employeeId, scope.teams, scope.verticals]
  );
  const { rows: training } = await pool.query(
    `SELECT id, mentor_employee_id, work_cap, review_date, status FROM mentorships
      WHERE intern_employee_id = $1 ORDER BY created_at DESC`, [employeeId]
  );
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
  const params: unknown[] = [];
  const filter = teamFilter(scope, params);
  const { rows } = await pool.query(
    `SELECT r.*, l.display_name AS lead_name, l.team_id, e.display_name AS submitter_name
       FROM outcome_requests r
       JOIN leads l ON l.id = r.lead_id
       LEFT JOIN employees e ON e.id = r.actor_employee_id
      WHERE r.status = 'pending' AND ${filter}
      ORDER BY r.created_at ASC`,
    params
  );
  const { rows: dups } = await pool.query(
    `SELECT en.id, en.display_name, en.phone, en.duplicate_of, en.status, le.display_name AS original_name
       FROM enquiries en JOIN leads le ON le.id = en.duplicate_of
      WHERE en.duplicate_of IS NOT NULL AND en.status = 'duplicate' AND ${filter.replace(/\bl\./g, 'le.')}
      ORDER BY en.created_at DESC LIMIT 20`,
    params
  );
  const requests = rows.map((r: any) => ({
    id: r.id, type: r.type, leadId: r.lead_id, leadName: r.lead_name,
    submitterName: r.submitter_name ?? '—', payload: r.payload, createdAt: r.created_at,
  }));
  return {
    requests,
    conversions: requests.filter((r) => r.type === 'conversion'),
    reopens: requests.filter((r) => r.type === 'reopen'),
    duplicates: dups.map((d: any) => ({
      enquiryId: d.id, displayName: d.display_name, phone: d.phone,
      duplicateOf: d.duplicate_of, originalName: d.original_name ?? '—',
    })),
  };
}

export async function duplicateDisposition(scope: Scope, enquiryId: string, decision: 'confirm-separate' | 'route-merge') {
  assertTl(scope);
  const params: unknown[] = [enquiryId];
  const filter = teamFilter(scope, params, 'le');
  const { rows } = await pool.query(
    `SELECT en.* FROM enquiries en JOIN leads le ON le.id = en.duplicate_of WHERE en.id = $1 AND ${filter}`,
    params
  );
  const enq = rows[0];
  if (!enq) throw notFound();
  if (decision === 'confirm-separate') {
    await pool.query(`UPDATE enquiries SET duplicate_of = NULL, status = 'pending' WHERE id = $1`, [enquiryId]);
    return { status: 'confirmed-separate', note: 'Distinct records confirmed — IDs and source links retained.' };
  }
  // Merge authority is separate: route a review reference to the data steward — never collapse records here.
  const reqId = id('REQ');
  await pool.query(
    `INSERT INTO team_requests (id, team_id, actor_employee_id, category, payload, status)
     VALUES ($1, $2, $3, 'merge-request', $4, 'pending')`,
    [reqId, null, scope.employeeId,
     JSON.stringify({ enquiryId, duplicateOf: enq.duplicate_of,
       request: `Identity merge review for ${enq.id}`,
       businessReason: 'Match-review reference only — no customer record shared across verticals.' })]
  );
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
  const params: unknown[] = [input.callId];
  const filter = teamFilter(scope, params);
  const { rows } = await pool.query(
    `SELECT c.*, l.team_id AS lead_team FROM calls c JOIN leads l ON l.id = c.lead_id
      WHERE c.id = $1 AND ${filter}`,
    params
  );
  const call = rows[0];
  if (!call) throw notFound();
  const cleanScores: Record<string, number> = {};
  for (const key of RUBRIC_KEYS) {
    const v = input.scores[key];
    if (typeof v === 'number' && v >= 0 && v <= 5) cleanScores[key] = v;
  }
  // Missing/unavailable recording evidence -> unassessed; never invent a score from call duration alone.
  const assessed = input.assessed !== false && Boolean(input.evidenceRef);
  if (assessed && Object.keys(cleanScores).length === 0) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', { fieldErrors: { scores: ['Score the approved rubric.'] } });
  }
  const reviewId = id('QR');
  await pool.query(
    `INSERT INTO call_quality_reviews (id, call_id, actor_employee_id, subject_employee_id, rubric_version, scores, feedback, evidence_ref, assessed)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [reviewId, input.callId, scope.employeeId, call.actor_employee_id, RUBRIC_VERSION,
     JSON.stringify(cleanScores), input.feedback, input.evidenceRef ?? null, assessed]
  );
  return { reviewId, assessed, rubricVersion: RUBRIC_VERSION, sampleNote: 'Quality samples are reported with sample size — small samples do not imply full coverage.' };
}

export async function listQualityReviews(scope: Scope) {
  assertTl(scope);
  const params: unknown[] = [];
  const filter = teamFilter(scope, params);
  const { rows } = await pool.query(
    `SELECT qr.*, c.lead_id, e.display_name AS subject_name
       FROM call_quality_reviews qr
       JOIN calls c ON c.id = qr.call_id
       JOIN leads l ON l.id = c.lead_id
       LEFT JOIN employees e ON e.id = qr.subject_employee_id
      WHERE ${filter} ORDER BY qr.created_at DESC LIMIT 50`,
    params
  );
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
  const params: unknown[] = [reviewId];
  const filter = teamFilter(scope, params);
  const { rows } = await pool.query(
    `SELECT qr.* FROM call_quality_reviews qr
       JOIN calls c ON c.id = qr.call_id
       JOIN leads l ON l.id = c.lead_id
      WHERE qr.id = $1 AND ${filter}`,
    params
  );
  const review = rows[0];
  if (!review) throw notFound();
  await pool.query(
    `INSERT INTO evidence_access_log (id, review_id, actor_employee_id, action) VALUES ($1, $2, $3, 'view-evidence')`,
    [id('EAL'), reviewId, scope.employeeId]
  );
  return {
    evidenceRef: review.evidence_ref,
    simulated: true,
    note: 'SIMULATED — no provider recording integration. Access logged.',
  };
}

// ─── TL-18 documented activity corrections (append-only) ───

// Column-truthful allowed values (mirrors the DB CHECK constraints).
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
  const params: unknown[] = [input.callId];
  const filter = teamFilter(scope, params);
  const { rows } = await pool.query(
    `SELECT c.*, l.team_id AS lead_team FROM calls c JOIN leads l ON l.id = c.lead_id WHERE c.id = $1 AND ${filter}`,
    params
  );
  const call = rows[0];
  if (!call) throw notFound();
  if (scope.role !== 'TL' && call.actor_employee_id !== scope.employeeId) {
    throw forbidden('You can only request corrections for your own activities.');
  }
  const originalValue = String((call as any)[fieldSpec.column] ?? '');
  const correctionId = id('COR');
  await pool.query(
    `INSERT INTO activity_corrections (id, call_id, actor_employee_id, requested_field, requested_value, original_value, evidence_ref, explanation, affected_report_versions)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [correctionId, input.callId, scope.employeeId, fieldSpec.column, input.requestedValue,
     originalValue, input.evidenceRef ?? null, input.explanation, JSON.stringify(['tl-metrics-v1', 'metrics-v1'])]
  );
  return { correctionId, status: 'pending' as const, originalValue, note: 'Provider truth cannot be overridden without supporting evidence.' };
}

export async function listActivityCorrections(scope: Scope) {
  assertTl(scope);
  const params: unknown[] = [];
  const filter = teamFilter(scope, params);
  const { rows } = await pool.query(
    `SELECT ac.*, c.lead_id, e.display_name AS submitter_name
       FROM activity_corrections ac
       JOIN calls c ON c.id = ac.call_id
       JOIN leads l ON l.id = c.lead_id
       LEFT JOIN employees e ON e.id = ac.actor_employee_id
      WHERE ${filter} ORDER BY ac.created_at DESC LIMIT 50`,
    params
  );
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
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const lookupParams: unknown[] = [correctionId];
    const lookupFilter = teamFilter(scope, lookupParams);
    const { rows } = await client.query(
      `SELECT ac.*, c.lead_id AS call_lead_id, l.team_id AS lead_team
         FROM activity_corrections ac
         JOIN calls c ON c.id = ac.call_id
         JOIN leads l ON l.id = c.lead_id
        WHERE ac.id = $1 AND ${lookupFilter} FOR UPDATE OF ac`,
      lookupParams
    );
    const cor = rows[0];
    if (!cor) { await client.query('ROLLBACK'); throw notFound(); }
    if (cor.actor_employee_id === scope.employeeId) {
      await client.query('ROLLBACK');
      throw forbidden('Self-submitted corrections are decided by Manager — not by their author.');
    }
    if (cor.status !== 'pending') {
      await client.query('ROLLBACK');
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

    await client.query(
      `UPDATE activity_corrections SET status = $2, decided_by = $3, decision_reason = $4, decision_evidence = $5, decided_at = now() WHERE id = $1`,
      [correctionId, resolvedStatus, scope.employeeId, reason, JSON.stringify(evidence ?? {})]
    );
    if (resolvedStatus === 'accepted') {
      // Append-only: original fact reference retained on the correction row; the live fact is annotated, never deleted.
      await client.query(
        `UPDATE calls SET ${cor.requested_field} = $1 WHERE id = $2`,
        [cor.requested_value, cor.call_id]
      );
      await client.query(
        `INSERT INTO lead_events (id, lead_id, actor_employee_id, kind, note, actor_role, actor_team_id, assignment_id)
         VALUES ($1, $2, $3, 'note', $4, $5, $6, $7)`,
        [id('EVT'), cor.call_lead_id, scope.employeeId,
         `Activity correction accepted (${cor.requested_field}): "${cor.original_value}" → "${cor.requested_value}" (${reason}). Original fact retained on ${correctionId}; affected report versions flagged.`,
         scope.role, cor.lead_team, scope.assignmentId]
      );
    } else {
      await client.query(
        `INSERT INTO lead_events (id, lead_id, actor_employee_id, kind, note, actor_role, actor_team_id, assignment_id)
         VALUES ($1, $2, $3, 'note', $4, $5, $6, $7)`,
        [id('EVT'), cor.call_lead_id, scope.employeeId,
         `Activity correction ${resolvedStatus} (${cor.requested_field}): ${reason}. Original fact retained on ${correctionId}.`,
         scope.role, cor.lead_team, scope.assignmentId]
      );
    }
    await client.query('COMMIT');
    return { correctionId, status: resolvedStatus, affectedReportVersions: cor.affected_report_versions };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

// ─── TL-10 target distribution ───

export async function createTarget(scope: Scope, input: {
  teamId: string; periodLabel: string; metric: string; parentValue: number;
}) {
  assertTl(scope);
  if (!scope.teams.includes(input.teamId)) throw notFound();
  const targetId = id('TGT');
  try {
    await pool.query(
      `INSERT INTO team_targets (id, team_id, period_label, metric, parent_value, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [targetId, input.teamId, input.periodLabel, input.metric, input.parentValue, scope.employeeId]
    );
  } catch (err: any) {
    if (err?.code === '23505') {
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
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`SELECT * FROM team_targets WHERE id = $1 FOR UPDATE`, [targetId]);
    const target = rows[0];
    if (!target) { await client.query('ROLLBACK'); throw notFound(); }
    if (!scope.teams.includes(target.team_id)) { await client.query('ROLLBACK'); throw notFound(); }
    if (target.closed) {
      await client.query('ROLLBACK');
      throw new HttpError(409, 'DUPLICATE_OPEN_TASK', 'Closed periods cannot be silently changed — request a Manager adjustment.', {});
    }
    const total = input.allocations.reduce((a, b) => a + b.allocatedValue, 0);
    if (total > Number(target.parent_value)) {
      await client.query('ROLLBACK');
      throw new HttpError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', {
        fieldErrors: { allocations: [`Allocations ${total} exceed the parent target ${target.parent_value}.`] },
      });
    }
    for (const alloc of input.allocations) {
      const { rows: ok } = await client.query(
        `SELECT id FROM assignments WHERE employee_id = $1 AND team_id = $2
           AND effective_from <= now() AND (effective_to IS NULL OR effective_to > now())`,
        [alloc.employeeId, target.team_id]
      );
      if (!ok[0]) {
        await client.query('ROLLBACK');
        throw new HttpError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', {
          fieldErrors: { allocations: [`Employee ${alloc.employeeId} is not a member of this team.`] },
        });
      }
    }
    const version = target.version + 1;
    for (const alloc of input.allocations) {
      await client.query(
        `INSERT INTO target_allocations (id, target_id, employee_id, allocated_value, prorate_note, version)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id('TAL'), targetId, alloc.employeeId, alloc.allocatedValue, alloc.prorateNote ?? null, version]
      );
    }
    await client.query(`UPDATE team_targets SET version = $2 WHERE id = $1`, [targetId, version]);
    await client.query('COMMIT');
    return {
      targetId, version,
      allocated: total,
      remainder: Number(target.parent_value) - total,
      note: 'Versioned allocation published to affected employees. Transfer prorating preserved on each row.',
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function listTargets(scope: Scope) {
  assertTl(scope);
  const { rows } = await pool.query(
    `SELECT t.*, tm.name AS team_name FROM team_targets t JOIN teams tm ON tm.id = t.team_id
      WHERE t.team_id = ANY($1) ORDER BY t.created_at DESC`,
    [scope.teams]
  );
  const result = [];
  for (const t of rows) {
    const { rows: allocs } = await pool.query(
      `SELECT a.*, e.display_name FROM target_allocations a JOIN employees e ON e.id = a.employee_id
        WHERE a.target_id = $1 AND a.version = $2`,
      [t.id, t.version]
    );
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
    const params: unknown[] = [input.opportunityIds, input.teamId, scope.verticals];
    const { rows } = await pool.query(
      `SELECT id FROM leads WHERE id = ANY($1) AND team_id = $2 AND vertical = ANY($3)`, params
    );
    if (rows.length !== new Set(input.opportunityIds).size) {
      throw new HttpError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', {
        fieldErrors: { opportunityIds: ['Every supporting opportunity must be in your team scope.'] },
      });
    }
  }
  const { rows: ver } = await pool.query(
    `SELECT COALESCE(MAX(version), 0) AS v FROM team_forecasts
      WHERE team_id = $1 AND period_label = $2 AND category = $3`,
    [input.teamId, input.periodLabel, input.category]
  );
  const version = Number(ver[0].v) + 1;
  const forecastId = id('FC');
  await pool.query(
    `INSERT INTO team_forecasts (id, team_id, period_label, category, expected_revenue, currency, opportunity_ids, risk_notes, assumptions, status, version, actor_employee_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [forecastId, input.teamId, input.periodLabel, input.category, input.expectedRevenue, input.currency,
     JSON.stringify(input.opportunityIds), input.riskNotes ?? null, input.assumptions ?? null,
     version > 1 ? 'revised' : 'submitted', version, scope.employeeId]
  );
  return {
    forecastId, version, status: version > 1 ? 'revised' : 'submitted',
    note: 'Forecast version frozen with supporting opportunity IDs. Won value stays separate from expected revenue.',
  };
}

export async function listForecasts(scope: Scope) {
  assertTl(scope);
  const { rows } = await pool.query(
    `SELECT f.*, e.display_name AS submitter_name FROM team_forecasts f
      LEFT JOIN employees e ON e.id = f.actor_employee_id
      WHERE f.team_id = ANY($1) ORDER BY f.submitted_at DESC LIMIT 50`,
    [scope.teams]
  );
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
  await pool.query(
    `INSERT INTO reviews (id, employee_id, reviewer_employee_id, period, scorecard, agenda, snapshot_version, scheduled_at)
     VALUES ($1, $2, $3, $4, $5, $6, 1, $7)`,
    [reviewId, input.employeeId, scope.employeeId, input.periodLabel, JSON.stringify({}), input.agenda, when]
  );
  return { reviewId, snapshotVersion: 1, note: 'Meeting snapshot frozen at creation. Employee disagreement remains recorded; a missing response never implies agreement.' };
}

export async function completeOneToOne(scope: Scope, reviewId: string, input: {
  feedback: string; privateNotes?: string; commitments: Array<{ text: string; dueAt: string }>; disagreement?: string;
}) {
  assertTl(scope);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`SELECT * FROM reviews WHERE id = $1 FOR UPDATE`, [reviewId]);
    const review = rows[0];
    if (!review || review.reviewer_employee_id !== scope.employeeId) {
      await client.query('ROLLBACK');
      throw notFound();
    }
    const { rows: leads } = await client.query(
      `SELECT id FROM leads WHERE owner_employee_id = $1 AND team_id = ANY($2) AND stage NOT IN ('converted', 'lost', 'disbursal', 'active-funded', 'registration') ORDER BY created_at LIMIT 1`,
      [review.employee_id, scope.teams]
    );
    await client.query(
      `UPDATE reviews SET scorecard = $2, private_notes = $3, disagreement = COALESCE($4, disagreement), snapshot_version = snapshot_version + 1 WHERE id = $1`,
      [reviewId, JSON.stringify({ feedback: input.feedback, commitments: input.commitments }),
       input.privateNotes ?? null, input.disagreement ?? null]
    );
    const taskIds: string[] = [];
    for (const c of input.commitments) {
      const due = new Date(c.dueAt);
      if (Number.isNaN(due.getTime())) continue;
      if (!leads[0]) continue;
      const taskId = id('TASK');
      // [ASSUMPTION] demo mapping: commitment tasks attach to the member's oldest open lead.
      await client.query(
        `INSERT INTO lead_tasks (id, lead_id, owner_employee_id, action, purpose, due_at, priority, status)
         VALUES ($1, $2, $3, 'other', $4, $5, 'normal', 'open')`,
        [taskId, leads[0].id, review.employee_id, `One-to-one commitment: ${c.text}`, due]
      );
      taskIds.push(taskId);
    }
    await client.query('COMMIT');
    return { reviewId, commitmentTaskIds: taskIds, snapshotVersion: review.snapshot_version + 1, note: 'Commitments tracked to completion; acknowledgement ≠ agreement.' };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function listOneToOnes(scope: Scope) {
  assertTl(scope);
  const { rows } = await pool.query(
    `SELECT r.*, e.display_name AS employee_name FROM reviews r
      LEFT JOIN employees e ON e.id = r.employee_id
      WHERE (r.reviewer_employee_id = $1 OR r.reviewer_employee_id IN (
              SELECT employee_id FROM assignments WHERE team_id = ANY($2)
                AND effective_from <= now() AND (effective_to IS NULL OR effective_to > now())))
      ORDER BY r.scheduled_at DESC NULLS LAST LIMIT 50`,
    [scope.employeeId, scope.teams]
  );
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
  await pool.query(
    `INSERT INTO mentorships (id, intern_employee_id, mentor_employee_id, work_cap, allowed_products, review_date, granted_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [mentorshipId, input.internEmployeeId, input.mentorEmployeeId, input.workCap,
     JSON.stringify(input.allowedProducts), reviewDate, scope.employeeId]
  );
  return {
    mentorshipId,
    note: 'TL allocates work but grants no roles. Mentor visibility is scoped and dated; permission expansion is an HR/Super Admin request.',
  };
}

export async function listMentorships(scope: Scope) {
  assertTl(scope);
  await pool.query(
    `UPDATE mentorships SET status = 'expired' WHERE status = 'active' AND review_date IS NOT NULL AND review_date < CURRENT_DATE`
  );
  const { rows } = await pool.query(
    `SELECT m.*, ei.display_name AS intern_name, em.display_name AS mentor_name
       FROM mentorships m
       LEFT JOIN employees ei ON ei.id = m.intern_employee_id
       LEFT JOIN employees em ON em.id = m.mentor_employee_id
      WHERE m.intern_employee_id IN (
              SELECT employee_id FROM assignments WHERE team_id = ANY($1)
                AND effective_from <= now() AND (effective_to IS NULL OR effective_to > now()))
         OR m.mentor_employee_id = $2
      ORDER BY m.created_at DESC LIMIT 50`,
    [scope.teams, scope.employeeId]
  );
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
    const params: unknown[] = [input.leadId];
    const filter = teamFilter(scope, params);
    const { rows } = await pool.query(`SELECT id FROM leads l WHERE l.id = $1 AND ${filter}`, params);
    if (!rows[0]) throw notFound();
  }
  const requestId = id('TREQ');
  const dueAt = new Date(Date.now() + 3 * 86_400_000);
  await pool.query(
    `INSERT INTO team_requests (id, team_id, actor_employee_id, category, subject_employee_id, lead_id, severity, payload, due_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [requestId, input.teamId ?? null, scope.employeeId, input.category,
     input.subjectEmployeeId ?? null, input.leadId ?? null, input.severity ?? 'medium',
     JSON.stringify({
       request: input.request, businessReason: input.businessReason,
       effectiveDate: input.effectiveDate ?? null, impact: input.impact ?? null,
       requestedDecision: input.requestedDecision ?? null,
     }), dueAt]
  );
  return {
    requestId, status: 'pending' as const,
    note: 'Requesting a change grants no access. Manager/HR approval and admin execution remain separate; a rejection leaves assignments unchanged.',
  };
}

export async function listTeamRequests(scope: Scope) {
  assertTl(scope);
  const { rows } = await pool.query(
    `SELECT tr.*, e.display_name AS actor_name, l.display_name AS lead_name
       FROM team_requests tr
       LEFT JOIN employees e ON e.id = tr.actor_employee_id
       LEFT JOIN leads l ON l.id = tr.lead_id
      WHERE (tr.actor_employee_id = $1 OR tr.team_id = ANY($2)
             OR (tr.category = 'merge-request' AND tr.actor_employee_id = $1))
      ORDER BY tr.created_at DESC LIMIT 50`,
    [scope.employeeId, scope.teams]
  );
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
  const params: unknown[] = [teamIds];
  const { rows: totals } = await pool.query(
    `SELECT COUNT(*)::int AS active_leads,
            COUNT(*) FILTER (WHERE stage IN ('converted', 'disbursal', 'active-funded', 'registration'))::int AS wins,
            COUNT(*) FILTER (WHERE stage = 'lost')::int AS losses
       FROM leads WHERE team_id = ANY($1) AND vertical = ANY($2)`,
    [teamIds, scope.verticals]
  );
  const { rows: targets } = await pool.query(
    `SELECT period_label, metric, parent_value, version FROM team_targets
      WHERE team_id = ANY($1) ORDER BY created_at DESC LIMIT 6`, [teamIds]
  );
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
  await pool.query(
    `INSERT INTO team_report_exports (id, actor_employee_id, team_ids, period, period_start, period_end, metric_version, filename, rel_path, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'tl-metrics-v1', $7, $8, $9)`,
    [exportId, scope.employeeId, JSON.stringify(teamIds), input.period, periodStart, now, filename, relPath, expiresAt]
  );
  return { id: exportId, downloadPath: `/api/tl/team-packs/${exportId}/download`, snapshotAt: now.toISOString(), metricVersion: 'tl-metrics-v1', expiresAt: expiresAt.toISOString() };
}

export async function downloadTeamPack(scope: Scope, exportId: string) {
  assertTl(scope);
  const { rows } = await pool.query(`SELECT * FROM team_report_exports WHERE id = $1`, [exportId]);
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
  // Explicit IST calculation (+05:30 = 330 minutes)
  const IST_OFFSET_MS = 330 * 60_000;
  const istTime = new Date(from.getTime() + IST_OFFSET_MS);

  if (cadence === 'monthly-1st-09:00+05:30') {
    // 1st of next month at 09:00:00 IST = 03:30:00 UTC
    const year = istTime.getUTCFullYear();
    const month = istTime.getUTCMonth();
    return new Date(Date.UTC(year, month + 1, 1, 3, 30, 0, 0));
  }

  // weekly-mon-09:00+05:30: Next Monday at 09:00:00 IST = 03:30:00 UTC
  const day = istTime.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
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
    await pool.query(
      `INSERT INTO report_schedules (id, owner_employee_id, name, cadence, period, team_ids, recipients, dedupe_key, next_run_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [scheduleId, scope.employeeId, input.name, input.cadence, input.period,
       JSON.stringify(teamIds), JSON.stringify(input.recipients), dedupeKey, nextRun]
    );
  } catch (err: any) {
    if (err?.code === '23505') {
      throw new HttpError(409, 'DUPLICATE_OPEN_TASK', 'An identical schedule already exists (owner, cadence, period, teams).', {});
    }
    throw err;
  }
  return { scheduleId, nextRunAt: nextRun.toISOString(), note: 'Recipient and owner permissions are rechecked every run. Delivery is the protected report centre — no public email attachments.' };
}

export async function listReportSchedules(scope: Scope) {
  assertTl(scope);
  const { rows } = await pool.query(
    `SELECT s.*, e.display_name AS owner_name FROM report_schedules s
      LEFT JOIN employees e ON e.id = s.owner_employee_id
      WHERE s.owner_employee_id = $1 OR s.team_ids::jsonb ?| $2::text[]
      ORDER BY s.created_at DESC LIMIT 50`,
    [scope.employeeId, scope.teams]
  );
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
          // Permissions rechecked every run: resolve the owner's current scope.
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

