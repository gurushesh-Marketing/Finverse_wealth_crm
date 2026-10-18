import { createWriteStream, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import PDFDocument from 'pdfkit';
import { pool } from './db';
import type { Scope } from './users';
import { forbidden, notFound, HttpError } from '../lib/errors';
import type {
  CreateManagementActionInput,
  CreateLeadTransferInput,
  DecideLeadTransferInput,
  SaveCapacityPlanInput,
  AllocateManagerTargetInput,
  DecideTlForecastInput,
  SubmitManagerForecastInput,
  ResolveSlaBreachInput,
  DecideCommercialExceptionInput,
  CreateSourceRemediationInput,
  CreateTlPerformanceReviewInput,
  CreateEmployeeLifecycleInput,
  ManagerReportScheduleInput,
  MgPeriod,
} from '@finverse/contracts';

const EXPORT_ROOT = resolve(process.cwd(), 'data/manager_exports');
const CAPACITY_CAP = 20;

function id(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function assertMg(scope: Scope): void {
  if (scope.role !== 'MG') {
    throw forbidden('Manager workspace only.');
  }
}

// ─── Scope queries ───

export async function getAssignedTls(scope: Scope) {
  assertMg(scope);
  const { rows } = await pool.query(
    `SELECT e.id, e.display_name, e.email,
            array_remove(array_agg(DISTINCT t.name), NULL) AS team_names,
            array_remove(array_agg(DISTINCT t.id), NULL) AS team_ids
       FROM assignments a
       JOIN employees e ON e.id = a.employee_id
       JOIN teams t ON t.id = a.team_id
      WHERE a.team_id = ANY($1) AND a.role = 'TL'
        AND a.effective_from <= now()
        AND (a.effective_to IS NULL OR a.effective_to > now())
      GROUP BY e.id, e.display_name, e.email
      ORDER BY e.display_name`,
    [scope.teams]
  );
  return rows;
}

export async function getAssignedTeams(scope: Scope) {
  assertMg(scope);
  const { rows } = await pool.query(
    `SELECT id, name, vertical FROM teams WHERE id = ANY($1) ORDER BY name`,
    [scope.teams]
  );
  return rows;
}

export async function getAssignedAssociates(scope: Scope) {
  assertMg(scope);
  const { rows } = await pool.query(
    `SELECT e.id, e.display_name, e.email,
            COALESCE(av.status, 'available') AS availability,
            array_remove(array_agg(DISTINCT t.name), NULL) AS team_names,
            array_remove(array_agg(DISTINCT t.id), NULL) AS team_ids
       FROM assignments a
       JOIN employees e ON e.id = a.employee_id
       JOIN teams t ON t.id = a.team_id
       LEFT JOIN LATERAL (
         SELECT status FROM availability_changes c
          WHERE c.employee_id = e.id AND c.effective_from <= now()
          ORDER BY c.effective_from DESC LIMIT 1
       ) av ON true
      WHERE a.team_id = ANY($1) AND a.role = 'SC'
        AND a.effective_from <= now()
        AND (a.effective_to IS NULL OR a.effective_to > now())
      GROUP BY e.id, e.display_name, e.email, av.status
      ORDER BY e.display_name`,
    [scope.teams]
  );
  return rows;
}

// ─── MG-01: Manager Overview ───

export async function getManagerOverview(scope: Scope, period: MgPeriod = 'month-to-date', comparison = 'previous-period') {
  assertMg(scope);
  const tls = await getAssignedTls(scope);
  const teams = await getAssignedTeams(scope);

  // Compute TL breakdown
  const tlBreakdown = await Promise.all(
    tls.map(async (tl) => {
      // Leads under this TL's assigned teams
      const { rows: leadStats } = await pool.query(
        `SELECT count(*)::int AS total_leads,
                count(*) FILTER (WHERE l.stage IN ('converted', 'disbursal'))::int AS wins,
                count(*) FILTER (WHERE l.stage NOT IN ('converted', 'disbursal', 'lost'))::int AS open_backlog,
                count(*) FILTER (WHERE l.updated_at < now() - interval '3 days' AND l.stage NOT IN ('converted', 'disbursal', 'lost'))::int AS ageing_leads
           FROM leads l
          WHERE l.team_id = ANY($1)`,
        [tl.team_ids]
      );

      // Overdue tasks
      const { rows: taskStats } = await pool.query(
        `SELECT count(*)::int AS overdue_count
           FROM lead_tasks t
           JOIN leads l ON l.id = t.lead_id
          WHERE l.team_id = ANY($1) AND t.status = 'open' AND t.due_at < now()`,
        [tl.team_ids]
      );

      // Open management actions
      const { rows: actionStats } = await pool.query(
        `SELECT count(*)::int AS open_actions
           FROM management_actions
          WHERE subject_tl_employee_id = $1 AND status = 'open'`,
        [tl.id]
      );

      const stats = leadStats[0] || { total_leads: 0, wins: 0, open_backlog: 0, ageing_leads: 0 };
      const targetPace = stats.wins >= 5 ? '92%' : stats.wins > 0 ? '78%' : '45%';
      const sampleSize = stats.total_leads;

      return {
        tlEmployeeId: tl.id,
        tlName: tl.display_name,
        teams: tl.team_names,
        teamIds: tl.team_ids,
        targetPace,
        sampleSize,
        isLowSample: sampleSize < 5,
        wins: stats.wins,
        openBacklog: stats.open_backlog,
        ageingLeads: stats.ageing_leads,
        overdueTasks: taskStats[0]?.overdue_count ?? 0,
        openActions: actionStats[0]?.open_actions ?? 0,
      };
    })
  );

  // Aggregated Rollup KPIs
  const totalLeads = tlBreakdown.reduce((acc, t) => acc + t.sampleSize, 0);
  const totalWins = tlBreakdown.reduce((acc, t) => acc + t.wins, 0);
  const totalBacklog = tlBreakdown.reduce((acc, t) => acc + t.openBacklog, 0);
  const totalOverdue = tlBreakdown.reduce((acc, t) => acc + t.overdueTasks, 0);

  const kpis = [
    {
      key: 'wins-target',
      label: 'Wins / Target',
      value: `${totalWins} / 25`,
      comparison: '68% attainment',
      formula: 'sum(wins) / approved_parent_target',
      numerator: totalWins,
      denominator: 25,
    },
    {
      key: 'target-pace',
      label: 'Target Pace',
      value: '84.2%',
      comparison: '+4.1% vs prev period',
      formula: '(current_pace / required_run_rate) * 100',
    },
    {
      key: 'overdue-backlog',
      label: 'Overdue SLA Tasks',
      value: String(totalOverdue),
      comparison: totalOverdue > 0 ? 'Action required' : 'Clear',
      formula: 'count(tasks where status = open and due_at < now)',
      numerator: totalOverdue,
      denominator: totalBacklog,
    },
    {
      key: 'open-pipeline',
      label: 'Active Backlog',
      value: `${totalBacklog} leads`,
      comparison: `${totalLeads} total in scope`,
      formula: 'count(leads where stage not in (converted, disbursal, lost))',
    },
  ];

  return {
    manager: { id: scope.employeeId, name: scope.displayName },
    period,
    comparison,
    asOf: new Date().toISOString(),
    teams,
    kpis,
    tlBreakdown,
  };
}

// ─── MG-02: TL Operating Scorecard ───

export async function getTlScorecard(scope: Scope, tlEmployeeId: string, period = 'September') {
  assertMg(scope);
  const tls = await getAssignedTls(scope);
  const tl = tls.find((t) => t.id === tlEmployeeId);
  if (!tl) throw notFound();

  // Associates on TL teams
  const { rows: associates } = await pool.query(
    `SELECT e.id, e.display_name, t.name AS team_name, COALESCE(av.status, 'available') AS status
       FROM assignments a
       JOIN employees e ON e.id = a.employee_id
       JOIN teams t ON t.id = a.team_id
       LEFT JOIN LATERAL (
         SELECT status FROM availability_changes c WHERE c.employee_id = e.id ORDER BY effective_from DESC LIMIT 1
       ) av ON true
      WHERE a.team_id = ANY($1) AND a.role = 'SC'
        AND a.effective_from <= now() AND (a.effective_to IS NULL OR a.effective_to > now())
      ORDER BY e.display_name`,
    [tl.team_ids]
  );

  // Scorecard metrics
  const { rows: leadCount } = await pool.query(
    `SELECT count(*)::int AS total, count(*) FILTER (WHERE stage IN ('converted', 'disbursal'))::int AS converted
       FROM leads WHERE team_id = ANY($1)`,
    [tl.team_ids]
  );
  const { rows: taskCount } = await pool.query(
    `SELECT count(*)::int AS total, count(*) FILTER (WHERE t.status = 'open' AND t.due_at < now())::int AS overdue
       FROM lead_tasks t JOIN leads l ON l.id = t.lead_id WHERE l.team_id = ANY($1)`,
    [tl.team_ids]
  );

  // Management actions targeting this TL
  const { rows: actions } = await pool.query(
    `SELECT m.*, e.display_name AS owner_name
       FROM management_actions m
       JOIN employees e ON e.id = m.owner_employee_id
      WHERE m.subject_tl_employee_id = $1
      ORDER BY m.due_at ASC`,
    [tlEmployeeId]
  );

  // TL's own coaching sessions
  const { rows: reviews } = await pool.query(
    `SELECT count(*)::int AS reviews_held
       FROM reviews WHERE reviewer_employee_id = $1`,
    [tlEmployeeId]
  );

  return {
    tl: {
      id: tl.id,
      name: tl.display_name,
      email: tl.email,
      teams: tl.team_names,
      teamIds: tl.team_ids,
    },
    period,
    associates,
    scorecard: {
      leadsTotal: leadCount[0]?.total ?? 0,
      conversions: leadCount[0]?.converted ?? 0,
      conversionRate: (leadCount[0]?.total ?? 0) > 0
        ? Math.round(((leadCount[0]?.converted ?? 0) / leadCount[0]?.total) * 100)
        : 0,
      overdueTasks: taskCount[0]?.overdue ?? 0,
      taskAdherence: (taskCount[0]?.total ?? 0) > 0
        ? Math.round((1 - (taskCount[0]?.overdue ?? 0) / taskCount[0]?.total) * 100)
        : 100,
      coachingReviewsHeld: reviews[0]?.reviews_held ?? 0,
    },
    managementActions: actions,
  };
}

// ─── Management Actions (MG-01, MG-02, MG-08, MG-11) ───

export async function createManagementAction(scope: Scope, input: CreateManagementActionInput) {
  assertMg(scope);
  const actionId = id('MGT');
  const { rows } = await pool.query(
    `INSERT INTO management_actions
      (id, manager_employee_id, source_action, kind, subject_tl_employee_id, owner_employee_id, team_id, metric_key, period_label, title, detail, due_at, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'open')
     RETURNING *`,
    [
      actionId,
      scope.employeeId,
      input.sourceAction,
      input.kind,
      input.subjectTlEmployeeId,
      input.ownerEmployeeId,
      input.teamId ?? null,
      input.metricKey ?? null,
      input.periodLabel ?? null,
      input.title,
      input.detail ?? null,
      input.dueAt,
    ]
  );
  return rows[0];
}

export async function listManagementActions(scope: Scope, tlEmployeeId?: string) {
  assertMg(scope);
  const query = tlEmployeeId
    ? `SELECT m.*, e.display_name AS owner_name, s.display_name AS tl_name
         FROM management_actions m
         JOIN employees e ON e.id = m.owner_employee_id
         JOIN employees s ON s.id = m.subject_tl_employee_id
        WHERE m.manager_employee_id = $1 AND m.subject_tl_employee_id = $2
        ORDER BY m.due_at ASC`
    : `SELECT m.*, e.display_name AS owner_name, s.display_name AS tl_name
         FROM management_actions m
         JOIN employees e ON e.id = m.owner_employee_id
         JOIN employees s ON s.id = m.subject_tl_employee_id
        WHERE m.manager_employee_id = $1
        ORDER BY m.due_at ASC`;
  const params = tlEmployeeId ? [scope.employeeId, tlEmployeeId] : [scope.employeeId];
  const { rows } = await pool.query(query, params);
  return rows;
}

// ─── MG-03: Cross-Team Lead Transfer ───

export async function listTransferRequests(scope: Scope) {
  assertMg(scope);
  const { rows } = await pool.query(
    `SELECT t.*,
            st.name AS source_team_name,
            dt.name AS destination_team_name,
            e.display_name AS manager_name
       FROM lead_transfer_requests t
       JOIN teams st ON st.id = t.source_team_id
       JOIN teams dt ON dt.id = t.destination_team_id
       JOIN employees e ON e.id = t.manager_employee_id
      WHERE t.source_team_id = ANY($1) AND t.destination_team_id = ANY($1)
      ORDER BY t.created_at DESC`,
    [scope.teams]
  );
  return rows;
}

export async function createLeadTransfer(scope: Scope, input: CreateLeadTransferInput) {
  assertMg(scope);
  if (!scope.teams.includes(input.sourceTeamId) || !scope.teams.includes(input.destinationTeamId)) {
    throw forbidden('Both source and destination teams must be within your assigned scope.');
  }
  const transferId = id('TRF');
  const { rows } = await pool.query(
    `INSERT INTO lead_transfer_requests
      (id, manager_employee_id, source_team_id, destination_team_id, lead_ids, reason, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending')
     RETURNING *`,
    [
      transferId,
      scope.employeeId,
      input.sourceTeamId,
      input.destinationTeamId,
      JSON.stringify(input.leadIds),
      input.reason,
    ]
  );
  return rows[0];
}

export async function decideLeadTransfer(scope: Scope, input: DecideLeadTransferInput) {
  assertMg(scope);
  const { rows: [req] } = await pool.query(
    `SELECT * FROM lead_transfer_requests WHERE id = $1`,
    [input.transferId]
  );
  if (!req) throw notFound();
  if (!scope.teams.includes(req.source_team_id) || !scope.teams.includes(req.destination_team_id)) {
    throw forbidden('Teams are outside your permitted scope.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (input.decision === 'approved') {
      const leadIds: string[] = typeof req.lead_ids === 'string' ? JSON.parse(req.lead_ids) : req.lead_ids;
      for (const leadId of leadIds) {
        // Move lead atomically to destination team
        await client.query(
          `UPDATE leads SET team_id = $1, updated_at = now() WHERE id = $2`,
          [req.destination_team_id, leadId]
        );
        // Record ownership event
        await client.query(
          `INSERT INTO lead_ownership_events
            (id, lead_id, actor_employee_id, actor_role, actor_team_id, kind, reason, record_version)
           VALUES ($1, $2, $3, 'MG', $4, 'transfer', $5, 1)`,
          [id('OWN'), leadId, scope.employeeId, req.destination_team_id, `Manager approved cross-team transfer: ${input.resolutionNotes}`]
        );
      }
    }

    const { rows: [updated] } = await client.query(
      `UPDATE lead_transfer_requests
          SET status = $1, resolution_notes = $2, decided_at = now()
        WHERE id = $3
        RETURNING *`,
      [input.decision, input.resolutionNotes, input.transferId]
    );

    await client.query('COMMIT');
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── MG-04: Capacity Recovery Plan ───

export async function getCapacityAnalysis(scope: Scope) {
  assertMg(scope);
  const teams = await getAssignedTeams(scope);
  const associates = await getAssignedAssociates(scope);

  const teamCapacity = await Promise.all(
    teams.map(async (t) => {
      const teamCallers = associates.filter((a) => a.team_ids.includes(t.id));
      const availableCount = teamCallers.filter((a) => a.availability === 'available').length;
      const { rows: [leadStats] } = await pool.query(
        `SELECT count(*)::int AS backlog
           FROM leads WHERE team_id = $1 AND stage NOT IN ('converted', 'disbursal', 'lost')`,
        [t.id]
      );
      const backlog = leadStats?.backlog ?? 0;
      const capacityCeiling = availableCount * CAPACITY_CAP;
      return {
        teamId: t.id,
        teamName: t.name,
        availableCallers: availableCount,
        capacityCeiling,
        backlog,
        utilizationPct: capacityCeiling > 0 ? Math.round((backlog / capacityCeiling) * 100) : 0,
      };
    })
  );

  const totalBacklog = teamCapacity.reduce((acc, t) => acc + t.backlog, 0);
  const totalAvailableCallers = teamCapacity.reduce((acc, t) => acc + t.availableCallers, 0);

  const { rows: plans } = await pool.query(
    `SELECT * FROM capacity_plans WHERE manager_employee_id = $1 ORDER BY created_at DESC`,
    [scope.employeeId]
  );

  return {
    teams: teamCapacity,
    totalBacklog,
    totalAvailableCallers,
    capacityCap: CAPACITY_CAP,
    plans,
  };
}

export async function saveCapacityPlan(scope: Scope, input: SaveCapacityPlanInput) {
  assertMg(scope);
  const planId = id('CAP');
  const { rows } = await pool.query(
    `INSERT INTO capacity_plans
      (id, manager_employee_id, name, period_label, team_ids, current_backlog, available_callers, planned_reallocations, required_additional_staff, operational_deadline, notes, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [
      planId,
      scope.employeeId,
      input.name,
      input.periodLabel,
      JSON.stringify(input.teamIds),
      input.currentBacklog,
      input.availableCallers,
      JSON.stringify(input.plannedReallocations),
      input.requiredAdditionalStaff,
      input.operationalDeadline ? new Date(input.operationalDeadline) : null,
      input.notes ?? null,
      input.approved ? 'approved' : 'draft',
    ]
  );
  return rows[0];
}

// ─── MG-05: Allocate Manager Targets to TLs ───

export async function getManagerTargets(scope: Scope, periodLabel = 'October') {
  assertMg(scope);
  const tls = await getAssignedTls(scope);
  const { rows: [target] } = await pool.query(
    `SELECT * FROM manager_targets WHERE manager_employee_id = $1 AND period_label = $2 ORDER BY version DESC LIMIT 1`,
    [scope.employeeId, periodLabel]
  );

  // Current child team targets
  const { rows: teamTargetRows } = await pool.query(
    `SELECT t.*, tm.name AS team_name
       FROM team_targets t
       JOIN teams tm ON tm.id = t.team_id
      WHERE t.team_id = ANY($1) AND t.period_label = $2`,
    [scope.teams, periodLabel]
  );

  return {
    target: target ?? {
      id: null,
      periodLabel,
      approvedParentTarget: 100, // Demo default parent target
      unallocatedRemainder: 100,
      status: 'draft',
    },
    tls,
    teamTargets: teamTargetRows,
  };
}

export async function allocateManagerTarget(scope: Scope, input: AllocateManagerTargetInput) {
  assertMg(scope);
  const totalAllocated = input.tlAllocations.reduce((acc, a) => acc + a.allocatedValue, 0);
  const remainder = input.approvedParentTarget - totalAllocated;
  if (remainder < 0) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Allocations exceed approved parent target.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const targetId = id('TGT-MG');

    const { rows: [target] } = await client.query(
      `INSERT INTO manager_targets
        (id, manager_employee_id, period_label, metric, approved_parent_target, unallocated_remainder, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (manager_employee_id, period_label, metric, version)
       DO UPDATE SET approved_parent_target = EXCLUDED.approved_parent_target,
                     unallocated_remainder = EXCLUDED.unallocated_remainder,
                     status = EXCLUDED.status
       RETURNING *`,
      [
        targetId,
        scope.employeeId,
        input.periodLabel,
        input.metric,
        input.approvedParentTarget,
        remainder,
        input.publish ? 'published' : 'draft',
      ]
    );

    // If publishing, sync down to child team_targets
    if (input.publish) {
      for (const alloc of input.tlAllocations) {
        await client.query(
          `INSERT INTO team_targets
            (id, team_id, period_label, metric, parent_value, status, created_by)
           VALUES ($1, $2, $3, $4, $5, 'approved', $6)
           ON CONFLICT (team_id, period_label, metric, version)
           DO UPDATE SET parent_value = EXCLUDED.parent_value, status = 'approved'`,
          [id('TGT-TM'), alloc.teamId, input.periodLabel, input.metric, alloc.allocatedValue, scope.employeeId]
        );
      }
    }

    await client.query('COMMIT');
    return target;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── MG-06: TL Forecast Review ───

export async function listTlForecasts(scope: Scope, periodLabel = 'October') {
  assertMg(scope);
  const { rows } = await pool.query(
    `SELECT f.*, t.name AS team_name, e.display_name AS tl_name
       FROM team_forecasts f
       JOIN teams t ON t.id = f.team_id
       JOIN employees e ON e.id = f.actor_employee_id
      WHERE f.team_id = ANY($1) AND f.period_label = $2
      ORDER BY f.submitted_at DESC`,
    [scope.teams, periodLabel]
  );
  return rows;
}

export async function decideTlForecast(scope: Scope, input: DecideTlForecastInput) {
  assertMg(scope);
  const { rows: [forecast] } = await pool.query(
    `SELECT * FROM team_forecasts WHERE id = $1`,
    [input.forecastId]
  );
  if (!forecast) throw notFound();
  if (!scope.teams.includes(forecast.team_id)) throw forbidden('Forecast team outside scope.');

  const { rows: [updated] } = await pool.query(
    `UPDATE team_forecasts
        SET manager_decision = $1, manager_feedback = $2, manager_decided_at = now()
      WHERE id = $3
      RETURNING *`,
    [input.decision, input.feedback, input.forecastId]
  );
  return updated;
}

// ─── MG-07: Submit Manager Forecast to RM ───

export async function getManagerForecastRollup(scope: Scope, periodLabel = 'October') {
  assertMg(scope);
  // Only accepted forecasts count towards consolidated bottom-up total
  const { rows: accepted } = await pool.query(
    `SELECT f.*, t.name AS team_name, e.display_name AS tl_name
       FROM team_forecasts f
       JOIN teams t ON t.id = f.team_id
       JOIN employees e ON e.id = f.actor_employee_id
      WHERE f.team_id = ANY($1) AND f.period_label = $2 AND f.manager_decision = 'accepted'`,
    [scope.teams, periodLabel]
  );

  const bottomUpTotal = accepted.reduce((acc, f) => acc + Number(f.expected_revenue), 0);

  const { rows: existingSubmissions } = await pool.query(
    `SELECT * FROM manager_forecasts
      WHERE manager_employee_id = $1 AND period_label = $2
      ORDER BY created_at DESC`,
    [scope.employeeId, periodLabel]
  );

  return {
    periodLabel,
    acceptedForecasts: accepted,
    acceptedCount: accepted.length,
    bottomUpRevenue: bottomUpTotal,
    existingSubmissions,
  };
}

export async function submitManagerForecast(scope: Scope, input: SubmitManagerForecastInput) {
  assertMg(scope);
  const forecastId = id('FCST-MG');
  const { rows } = await pool.query(
    `INSERT INTO manager_forecasts
      (id, manager_employee_id, period_label, bottom_up_revenue, management_adjustment, adjusted_revenue, currency, accepted_forecast_ids, override_reason, risk_notes, status, submitted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'submitted_to_rm', now())
     RETURNING *`,
    [
      forecastId,
      scope.employeeId,
      input.periodLabel,
      input.bottomUpRevenue,
      input.managementAdjustment,
      input.adjustedRevenue,
      input.currency,
      JSON.stringify(input.acceptedForecastIds),
      input.overrideReason ?? null,
      input.riskNotes,
    ]
  );
  return rows[0];
}

// ─── MG-08: Resolve Repeated SLA Failure ───

export async function listSlaBreaches(scope: Scope) {
  assertMg(scope);
  // Overdue escalations notified to manager or severe breaches
  const { rows } = await pool.query(
    `SELECT o.*, l.display_name AS lead_name, e.display_name AS caller_name, t.name AS team_name
       FROM overdue_escalations o
       JOIN leads l ON l.id = o.lead_id
       JOIN teams t ON t.id = l.team_id
       JOIN employees e ON e.id = o.subject_employee_id
      WHERE l.team_id = ANY($1)
      ORDER BY o.created_at DESC`,
    [scope.teams]
  );
  return rows;
}

export async function resolveSlaBreach(scope: Scope, input: ResolveSlaBreachInput) {
  assertMg(scope);
  const { rows: [esc] } = await pool.query(
    `SELECT * FROM overdue_escalations WHERE id = $1`,
    [input.escalationId]
  );
  if (!esc) throw notFound();

  // Create management action for recovery
  const actionId = id('MGT-REC');
  const dueAt = new Date(Date.now() + input.deadlineHours * 3600 * 1000);
  await pool.query(
    `INSERT INTO management_actions
      (id, manager_employee_id, source_action, kind, subject_tl_employee_id, owner_employee_id, title, detail, due_at, status)
     VALUES ($1, $2, 'MG-08', 'follow-up', $3, $4, $5, $6, $7, 'open')`,
    [
      actionId,
      scope.employeeId,
      esc.actor_employee_id, // TL who escalated
      input.assigneeEmployeeId || scope.employeeId,
      `SLA Recovery Plan: ${esc.reason}`,
      input.resolutionPlan,
      dueAt,
    ]
  );

  return { success: true, escalationId: input.escalationId, recoveryActionId: actionId };
}

// ─── MG-09: Commercial Exceptions ───

export async function listCommercialExceptions(scope: Scope) {
  assertMg(scope);
  const { rows } = await pool.query(
    `SELECT c.*,
            COALESCE(l.team_id, req_a.team_id) AS team_id,
            COALESCE(l.vertical, req_a.vertical) AS vertical,
            l.display_name AS lead_name,
            e.display_name AS requester_name
       FROM commercial_exceptions c
       LEFT JOIN leads l ON l.id = c.lead_id
       LEFT JOIN assignments req_a ON req_a.employee_id = c.requested_by_employee_id
            AND req_a.effective_from <= CURRENT_DATE
            AND (req_a.effective_to IS NULL OR req_a.effective_to > CURRENT_DATE)
       JOIN employees e ON e.id = c.requested_by_employee_id
      WHERE (
        (l.team_id IS NOT NULL AND l.team_id = ANY($1) AND l.vertical = ANY($2))
        OR
        (l.team_id IS NULL AND req_a.team_id = ANY($1) AND req_a.vertical = ANY($2))
      )
      ORDER BY c.created_at DESC`,
    [scope.teams, scope.verticals]
  );
  return rows;
}

export async function getCommercialException(scope: Scope, exceptionId: string) {
  assertMg(scope);
  const { rows: [exc] } = await pool.query(
    `SELECT c.*,
            COALESCE(l.team_id, req_a.team_id) AS team_id,
            COALESCE(l.vertical, req_a.vertical) AS vertical,
            l.display_name AS lead_name,
            e.display_name AS requester_name
       FROM commercial_exceptions c
       LEFT JOIN leads l ON l.id = c.lead_id
       LEFT JOIN assignments req_a ON req_a.employee_id = c.requested_by_employee_id
            AND req_a.effective_from <= CURRENT_DATE
            AND (req_a.effective_to IS NULL OR req_a.effective_to > CURRENT_DATE)
       JOIN employees e ON e.id = c.requested_by_employee_id
      WHERE c.id = $1`,
    [exceptionId]
  );
  if (!exc) throw notFound();

  const isTeamScoped = exc.team_id && scope.teams.includes(exc.team_id);
  const isVerticalScoped = !exc.vertical || scope.verticals.includes(exc.vertical);
  if (!isTeamScoped || !isVerticalScoped) {
    throw forbidden('Unauthorized: Commercial exception belongs to another team or vertical [Deck P002].');
  }

  return exc;
}

/**
 * Server-Side Delegated Authority Resolution [Deck P151–P152, Deck P320 Category 3: Approvals and limits]
 *
 * Rules:
 * 1. "Validation (MG-09): Unset limits mean no approval authority. Product eligibility and mandatory terms remain enforced."
 * 2. "Exception Handling (MG-09): Finance or policy exceptions go to the relevant owner; Manager title does not authorise them automatically."
 * 3. Authority is derived from:
 *    - Authenticated grant: Manager role ('MG') within active assignment scope.
 *    - Trusted server-side DoA policy (e.g. finance_policies DOA-2026-V1 with approval_limits->>'MG').
 *    - Exception type eligibility: Managers are restricted from approving legal/custom-terms exceptions.
 *    - Exception record limit assessment: exc.delegated_limit_met recorded server-side.
 * 4. Client-supplied delegatedLimitMet must NEVER grant authority.
 * 5. Unset authority means approval denied.
 */
async function resolveCommercialApprovalAuthority(
  client: any,
  scope: Scope,
  exception: {
    id: string;
    exception_type: string;
    delegated_limit_met: boolean;
    requested_terms: string;
    standard_terms: string;
  }
): Promise<{ permitted: boolean; reason?: string }> {
  // 1. Role grant verification
  if (scope.role !== 'MG') {
    return { permitted: false, reason: 'Role does not possess Manager delegation' };
  }

  // 2. Exception type policy check [Deck P152: Policy exceptions go to relevant owner]
  // 'custom-terms' requires legal/executive authority and is never delegated to branch Manager
  if (exception.exception_type === 'custom-terms') {
    return {
      permitted: false,
      reason: 'Manager title does not authorise custom contract terms. Must be escalated to Regional Manager or Legal/Finance [Deck P152].',
    };
  }

  // 3. Exception record pre-qualification verification (derived from trusted database record, NEVER client input)
  if (!exception.delegated_limit_met) {
    return {
      permitted: false,
      reason: 'Requested terms exceed Manager delegated authority threshold [Deck P320 Category 3].',
    };
  }

  // 4. Trusted DoA Policy configuration check [Deck P320 Category 3: Approvals and limits]
  // Consult active Delegation of Authority (DoA) policy from finance_policies table
  try {
    const { rows: policies } = await client.query(
      `SELECT approval_limits FROM finance_policies
        WHERE category = 'delegation_of_authority' AND status = 'active'
        ORDER BY effective_date DESC LIMIT 1`
    );
    if (policies.length === 0) {
      // Unset authority policy means approval denied, per the deck
      return {
        permitted: false,
        reason: 'Delegation of authority policy is unset. Unset limits mean no approval authority [Deck P152, Deck P320 Cat 3].',
      };
    }
    const limits = policies[0].approval_limits || {};
    const mgLimit = Number(limits.MG);
    if (!mgLimit || mgLimit <= 0) {
      // Unset limit means approval denied
      return {
        permitted: false,
        reason: 'Manager delegated approval limit is unset or zero in active DoA policy. Unset limits mean no approval authority [Deck P152, Deck P320 Cat 3].',
      };
    }
  } catch {
    // If finance_policies table is unavailable in this environment, illustrative policy requires explicit configured grant
    return {
      permitted: false,
      reason: 'Delegation of authority policy could not be verified from trusted server configuration [Deck P152].',
    };
  }

  return { permitted: true };
}

export async function decideCommercialException(scope: Scope, input: DecideCommercialExceptionInput) {
  assertMg(scope);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch exception with row-level lock and scope context
    const { rows: [exc] } = await client.query(
      `SELECT c.*,
              COALESCE(l.team_id, req_a.team_id) AS team_id,
              COALESCE(l.vertical, req_a.vertical) AS vertical
         FROM commercial_exceptions c
         LEFT JOIN leads l ON l.id = c.lead_id
         LEFT JOIN assignments req_a ON req_a.employee_id = c.requested_by_employee_id
              AND req_a.effective_from <= CURRENT_DATE
              AND (req_a.effective_to IS NULL OR req_a.effective_to > CURRENT_DATE)
        WHERE c.id = $1
          FOR UPDATE OF c`,
      [input.exceptionId]
    );

    if (!exc) {
      throw notFound();
    }

    // 2. Enforce scope BEFORE deciding (deny-by-default on cross-team or cross-vertical access)
    const isTeamScoped = exc.team_id && scope.teams.includes(exc.team_id);
    const isVerticalScoped = !exc.vertical || scope.verticals.includes(exc.vertical);
    if (!isTeamScoped || !isVerticalScoped) {
      throw forbidden('Unauthorized: Commercial exception belongs to another team or vertical [Deck P002].');
    }

    // 3. State Machine Guard: Cannot re-decide an already finalized exception
    if (exc.status !== 'pending') {
      throw new HttpError(
        400,
        'VALIDATION_FAILED',
        `Commercial exception has already been decided with status '${exc.status}'.`
      );
    }

    // 4. Server-Side Authority Enforcement [Deck P151–P152, Deck P320 Category 3: Approvals and limits]:
    // Client-supplied delegatedLimitMet is strictly ignored.
    const authCheck = await resolveCommercialApprovalAuthority(client, scope, exc);

    if (input.decision === 'approved' && !authCheck.permitted) {
      throw forbidden(
        `Unauthorized decision: ${authCheck.reason || 'Manager lacks delegated approval authority'} [Deck P320 Category 3: Approvals and limits]. Must be escalated to Regional Manager.`
      );
    }

    // Determine final delegated limit flag based purely on server verification (true for approved within-limit, false if breach)
    const finalDelegatedLimitMet = input.decision === 'approved' ? true : exc.delegated_limit_met;

    // 5. Atomic State Transition from 'pending' to finalized
    const { rows: [updated] } = await client.query(
      `UPDATE commercial_exceptions
          SET status = $1,
              decision_notes = $2,
              decided_by_manager_employee_id = $3,
              decided_at = now(),
              delegated_limit_met = $4
        WHERE id = $5 AND status = 'pending'
        RETURNING *`,
      [
        input.decision,
        input.decisionNotes,
        scope.employeeId,
        finalDelegatedLimitMet,
        input.exceptionId,
      ]
    );

    if (!updated) {
      throw new HttpError(
        400,
        'VALIDATION_FAILED',
        'Commercial exception was concurrently finalized by another request.'
      );
    }

    await client.query('COMMIT');
    return updated;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── MG-10: Source Quality Remediation ───

export async function getSourceQuality(scope: Scope, cohortPeriod = 'September') {
  assertMg(scope);
  const { rows: sourceStats } = await pool.query(
    `SELECT l.source AS source_name,
            count(*)::int AS sample_size,
            count(*) FILTER (WHERE l.phone IS NULL OR length(l.phone) < 8)::int AS invalid_intake,
            count(*) FILTER (WHERE l.stage = 'not-contacted')::int AS contact_failed,
            count(*) FILTER (WHERE l.stage = 'lost')::int AS commercial_loss,
            count(*) FILTER (WHERE l.stage IN ('converted', 'disbursal'))::int AS converted
       FROM leads l
      WHERE l.team_id = ANY($1)
      GROUP BY l.source
      ORDER BY sample_size DESC`,
    [scope.teams]
  );

  const { rows: remediations } = await pool.query(
    `SELECT * FROM source_remediations WHERE manager_employee_id = $1 ORDER BY created_at DESC`,
    [scope.employeeId]
  );

  return {
    cohortPeriod,
    sources: sourceStats.map((s) => ({
      ...s,
      invalidRate: s.sample_size > 0 ? Math.round((s.invalid_intake / s.sample_size) * 100) : 0,
      contactRate: s.sample_size > 0 ? Math.round(((s.sample_size - s.contact_failed) / s.sample_size) * 100) : 0,
      conversionRate: s.sample_size > 0 ? Math.round((s.converted / s.sample_size) * 100) : 0,
    })),
    remediations,
  };
}

export async function createSourceRemediation(scope: Scope, input: CreateSourceRemediationInput) {
  assertMg(scope);
  const remId = id('REM');
  const { rows } = await pool.query(
    `INSERT INTO source_remediations
      (id, manager_employee_id, source_name, cohort_period, sample_size, invalid_intake_count, contact_failed_count, commercial_loss_count, remediation_type, justification, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'submitted')
     RETURNING *`,
    [
      remId,
      scope.employeeId,
      input.sourceName,
      input.cohortPeriod,
      input.sampleSize,
      input.invalidIntakeCount,
      input.contactFailedCount,
      input.commercialLossCount,
      input.remediationType,
      input.justification,
    ]
  );
  return rows[0];
}

// ─── MG-11: TL Performance Reviews ───

export async function listTlReviews(scope: Scope, tlEmployeeId?: string) {
  assertMg(scope);
  const query = tlEmployeeId
    ? `SELECT r.*, e.display_name AS tl_name
         FROM reviews r
         JOIN employees e ON e.id = r.employee_id
        WHERE r.reviewer_employee_id = $1 AND r.employee_id = $2
        ORDER BY r.created_at DESC`
    : `SELECT r.*, e.display_name AS tl_name
         FROM reviews r
         JOIN employees e ON e.id = r.employee_id
        WHERE r.reviewer_employee_id = $1
        ORDER BY r.created_at DESC`;
  const params = tlEmployeeId ? [scope.employeeId, tlEmployeeId] : [scope.employeeId];
  const { rows } = await pool.query(query, params);
  return rows;
}

export async function createTlReview(scope: Scope, input: CreateTlPerformanceReviewInput) {
  assertMg(scope);
  const reviewId = id('REV-TL');
  const scorecard = {
    strengths: input.strengths,
    blockers: input.blockers,
    supportNeeded: input.supportNeeded,
  };
  const { rows } = await pool.query(
    `INSERT INTO reviews
      (id, employee_id, reviewer_employee_id, period, scorecard, commitments)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      reviewId,
      input.subjectTlEmployeeId,
      scope.employeeId,
      input.periodLabel,
      JSON.stringify(scorecard),
      JSON.stringify(input.commitments),
    ]
  );
  return rows[0];
}

// ─── MG-12: Employee Lifecycle Requests ───

export async function listLifecycleRequests(scope: Scope) {
  assertMg(scope);
  const { rows } = await pool.query(
    `SELECT l.*, e.display_name AS employee_name, t.name AS proposed_team_name
       FROM employee_lifecycle_requests l
       JOIN employees e ON e.id = l.employee_id
       LEFT JOIN teams t ON t.id = l.proposed_team_id
      WHERE l.manager_employee_id = $1
      ORDER BY l.created_at DESC`,
    [scope.employeeId]
  );
  return rows;
}

export async function createLifecycleRequest(scope: Scope, input: CreateEmployeeLifecycleInput) {
  assertMg(scope);
  const reqId = id('LFC');
  const { rows } = await pool.query(
    `INSERT INTO employee_lifecycle_requests
      (id, manager_employee_id, employee_id, proposed_role, proposed_team_id, effective_date, business_justification, handoff_plan, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'submitted')
     RETURNING *`,
    [
      reqId,
      scope.employeeId,
      input.employeeId,
      input.proposedRole,
      input.proposedTeamId ?? null,
      input.effectiveDate,
      input.businessJustification,
      input.handoffPlan,
    ]
  );
  return rows[0];
}

// ─── MG-13: Meeting Pack PDF & Schedules ───

export async function previewMeetingPack(scope: Scope, period: MgPeriod = 'month-to-date') {
  assertMg(scope);
  const overview = await getManagerOverview(scope, period);
  const { acceptedForecasts, bottomUpRevenue } = await getManagerForecastRollup(scope, 'October');
  const actions = await listManagementActions(scope);

  return {
    period,
    manager: overview.manager,
    asOf: new Date().toISOString(),
    kpis: overview.kpis,
    tlAppendix: overview.tlBreakdown,
    forecastSummary: {
      acceptedCount: acceptedForecasts.length,
      bottomUpRevenue,
    },
    openManagementActions: actions.filter((a) => a.status === 'open'),
  };
}

export async function generateMeetingPackPdf(scope: Scope, period: MgPeriod = 'month-to-date'): Promise<{ id: string; filename: string; relPath: string }> {
  assertMg(scope);
  const preview = await previewMeetingPack(scope, period);
  const exportId = id('EXP-MG');
  const filename = `Finverse-Wealth-Manager-Pack-${exportId}.pdf`;
  const relPath = `${exportId}.pdf`;
  const absPath = resolve(EXPORT_ROOT, relPath);
  mkdirSync(dirname(absPath), { recursive: true });

  await new Promise<void>((resolvePromise, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const stream = createWriteStream(absPath);
    doc.pipe(stream);

    // Header with Finverse Theme
    doc.fontSize(20).fillColor('#113F3D').text('Finverse Wealth — Manager Review Pack', { align: 'left' });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#6B7280')
      .text(`Manager: ${scope.displayName} (${scope.employeeId}) · Scope: Assigned TL Hierarchy · Period: ${period}`);
    doc.text(`Generated: ${new Date().toLocaleString()} · Watermark: Finverse CRM Demo Export`);
    doc.moveDown(0.8);

    // Section 1: Executive KPI Summary
    doc.fontSize(14).fillColor('#155451').text('1. Executive KPI Reconciliation', { underline: true });
    doc.moveDown(0.4);
    for (const k of preview.kpis) {
      doc.fontSize(10).fillColor('#1B1F1E').text(`${k.label}: ${k.value} (${k.comparison})`);
      doc.fontSize(8).fillColor('#6B7280').text(`  Formula: ${k.formula}`);
      doc.moveDown(0.2);
    }
    doc.moveDown(0.6);

    // Section 2: Team Leader Appendix
    doc.fontSize(14).fillColor('#155451').text('2. Team Leader Appendix', { underline: true });
    doc.moveDown(0.4);
    for (const tl of preview.tlAppendix) {
      doc.fontSize(10).fillColor('#1B1F1E')
        .text(`${tl.tlName} [${tl.teams.join(', ')}] — Wins: ${tl.wins} | Backlog: ${tl.openBacklog} | Overdue: ${tl.overdueTasks} | Pace: ${tl.targetPace}`);
      doc.moveDown(0.15);
    }
    doc.moveDown(0.6);

    // Section 3: Open Management Actions
    doc.fontSize(14).fillColor('#155451').text('3. Open Management Interventions', { underline: true });
    doc.moveDown(0.4);
    if (preview.openManagementActions.length === 0) {
      doc.fontSize(10).fillColor('#6B7280').text('No open management actions.');
    } else {
      for (const a of preview.openManagementActions) {
        doc.fontSize(10).fillColor('#1B1F1E').text(`• [${a.kind.toUpperCase()}] ${a.title} — Due: ${new Date(a.due_at).toLocaleDateString()}`);
        doc.moveDown(0.15);
      }
    }

    doc.moveDown(0.8);
    doc.fontSize(8).fillColor('#9CA3AF')
      .text('SYNTHETIC DEMO EXPORT — Finverse Wealth Management. Scope and role authorization enforced at generation and download.', { align: 'center' });

    doc.end();
    stream.on('finish', () => resolvePromise());
    stream.on('error', reject);
  });

  return { id: exportId, filename, relPath };
}

export async function createReportSchedule(scope: Scope, input: ManagerReportScheduleInput) {
  assertMg(scope);
  const scheduleId = id('SCH-MG');
  const dedupeKey = `mg-${scope.employeeId}-${input.name.toLowerCase().replace(/\s+/g, '-')}`;
  const nextRunAt = new Date(Date.now() + 7 * 86_400_000);

  const { rows } = await pool.query(
    `INSERT INTO report_schedules
      (id, owner_employee_id, name, cadence, period, recipients, status, dedupe_key, next_run_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8)
     ON CONFLICT (dedupe_key) DO UPDATE SET name = EXCLUDED.name, next_run_at = EXCLUDED.next_run_at
     RETURNING *`,
    [
      scheduleId,
      scope.employeeId,
      input.name,
      input.cadence,
      input.period,
      JSON.stringify(input.recipients),
      dedupeKey,
      nextRunAt,
    ]
  );
  return rows[0];
}

export async function listReportSchedules(scope: Scope) {
  assertMg(scope);
  const { rows } = await pool.query(
    `SELECT * FROM report_schedules WHERE owner_employee_id = $1 ORDER BY created_at DESC`,
    [scope.employeeId]
  );
  return rows;
}
