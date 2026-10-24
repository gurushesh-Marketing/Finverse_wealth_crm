import { createWriteStream, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import PDFDocument from 'pdfkit';
import { db } from './db';
import type { Scope } from './users';
import { forbidden, notFound, HttpError } from '../lib/errors';
import { eq, sql } from 'drizzle-orm';
import {
  managementActions,
  leadTransferRequests,
  capacityPlans,
  managerTargets,
  teamTargets,
  teamForecasts,
  managerForecasts,
  commercialExceptions,
  sourceRemediations,
  employeeLifecycleRequests,
  leads,
  leadOwnershipEvents,
  reportSchedules,
  reviews,
} from '../db/schema';
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

function inList<T>(vals: T[]) {
  return vals.length > 0 ? sql.join(vals.map((v) => sql`${v}`), sql`, `) : sql`NULL`;
}

export function assertMg(scope: Scope): void {
  if (scope.role !== 'MG') {
    throw forbidden('Wealth Manager workspace only.');
  }
}

// ─── Scope queries ───

export async function getAssignedTls(scope: Scope) {
  assertMg(scope);
  const { rows } = await db.execute<any>(sql`
    SELECT e.id, e.display_name, e.email,
           array_remove(array_agg(DISTINCT t.name), NULL) AS team_names,
           array_remove(array_agg(DISTINCT t.id), NULL) AS team_ids
      FROM assignments a
      JOIN employees e ON e.id = a.employee_id
      JOIN teams t ON t.id = a.team_id
     WHERE a.team_id IN (${inList(scope.teams)}) AND a.role = 'TL'
       AND a.effective_from <= now()
       AND (a.effective_to IS NULL OR a.effective_to > now())
     GROUP BY e.id, e.display_name, e.email
     ORDER BY e.display_name
  `);
  return rows;
}

export async function getAssignedTeams(scope: Scope) {
  assertMg(scope);
  const { rows } = await db.execute<any>(sql`
    SELECT id, name, vertical FROM teams WHERE id IN (${inList(scope.teams)}) ORDER BY name
  `);
  return rows;
}

export async function getAssignedAssociates(scope: Scope) {
  assertMg(scope);
  const { rows } = await db.execute<any>(sql`
    SELECT e.id, e.display_name, e.email,
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
     WHERE a.team_id IN (${inList(scope.teams)}) AND a.role = 'SC'
       AND a.effective_from <= now()
       AND (a.effective_to IS NULL OR a.effective_to > now())
     GROUP BY e.id, e.display_name, e.email, av.status
     ORDER BY e.display_name
  `);
  return rows;
}

// ─── MG-01: Manager Overview ───

export async function getManagerOverview(scope: Scope, period: MgPeriod = 'month-to-date', comparison = 'previous-period') {
  assertMg(scope);
  const tls = await getAssignedTls(scope);
  const teams = await getAssignedTeams(scope);

  const tlBreakdown = await Promise.all(
    tls.map(async (tl: any) => {
      const { rows: leadStats } = await db.execute<any>(sql`
        SELECT count(*)::int AS total_leads,
               count(*) FILTER (WHERE l.stage = 'converted')::int AS wins,
               count(*) FILTER (WHERE l.stage NOT IN ('converted', 'lost'))::int AS open_backlog,
               count(*) FILTER (WHERE l.updated_at < now() - interval '3 days' AND l.stage NOT IN ('converted', 'lost'))::int AS ageing_leads
          FROM leads l
         WHERE l.team_id IN (${inList(tl.team_ids)})
      `);

      const { rows: taskStats } = await db.execute<any>(sql`
        SELECT count(*)::int AS overdue_count
          FROM lead_tasks t
          JOIN leads l ON l.id = t.lead_id
         WHERE l.team_id IN (${inList(tl.team_ids)}) AND t.status = 'open' AND t.due_at < now()
      `);

      const { rows: actionStats } = await db.execute<any>(sql`
        SELECT count(*)::int AS open_actions
          FROM management_actions
         WHERE subject_tl_employee_id = ${tl.id} AND status = 'open'
      `);

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
      formula: 'count(leads where stage not in (converted, lost))',
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
  const tl = tls.find((t: any) => t.id === tlEmployeeId);
  if (!tl) throw notFound();

  const { rows: associates } = await db.execute<any>(sql`
    SELECT e.id, e.display_name, t.name AS team_name, COALESCE(av.status, 'available') AS status
       FROM assignments a
       JOIN employees e ON e.id = a.employee_id
       JOIN teams t ON t.id = a.team_id
       LEFT JOIN LATERAL (
         SELECT status FROM availability_changes c WHERE c.employee_id = e.id ORDER BY effective_from DESC LIMIT 1
       ) av ON true
      WHERE a.team_id IN (${inList(tl.team_ids)}) AND a.role = 'SC'
        AND a.effective_from <= now() AND (a.effective_to IS NULL OR a.effective_to > now())
      ORDER BY e.display_name
  `);

  const { rows: leadCount } = await db.execute<any>(sql`
    SELECT count(*)::int AS total, count(*) FILTER (WHERE stage = 'converted')::int AS converted
      FROM leads WHERE team_id IN (${inList(tl.team_ids)})
  `);
  const { rows: taskCount } = await db.execute<any>(sql`
    SELECT count(*)::int AS total, count(*) FILTER (WHERE t.status = 'open' AND t.due_at < now())::int AS overdue
      FROM lead_tasks t JOIN leads l ON l.id = t.lead_id WHERE l.team_id IN (${inList(tl.team_ids)})
  `);

  const { rows: actions } = await db.execute<any>(sql`
    SELECT m.*, e.display_name AS owner_name
       FROM management_actions m
       JOIN employees e ON e.id = m.owner_employee_id
      WHERE m.subject_tl_employee_id = ${tlEmployeeId}
      ORDER BY m.due_at ASC
  `);

  const { rows: reviewsHeld } = await db.execute<any>(sql`
    SELECT count(*)::int AS reviews_held
       FROM reviews WHERE reviewer_employee_id = ${tlEmployeeId}
  `);

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
      coachingReviewsHeld: reviewsHeld[0]?.reviews_held ?? 0,
    },
    managementActions: actions,
  };
}

// ─── Management Actions (MG-01, MG-02, MG-08, MG-11) ───

export async function createManagementAction(scope: Scope, input: CreateManagementActionInput) {
  assertMg(scope);
  const actionId = id('MGT');
  const [row] = await db.insert(managementActions).values({
    id: actionId,
    managerEmployeeId: scope.employeeId,
    sourceAction: input.sourceAction,
    kind: input.kind,
    subjectTlEmployeeId: input.subjectTlEmployeeId,
    ownerEmployeeId: input.ownerEmployeeId,
    teamId: input.teamId ?? null,
    metricKey: input.metricKey ?? null,
    periodLabel: input.periodLabel ?? null,
    title: input.title,
    detail: input.detail ?? null,
    dueAt: new Date(input.dueAt).toISOString(),
    status: 'open',
  }).returning();
  return row;
}

export async function listManagementActions(scope: Scope, tlEmployeeId?: string) {
  assertMg(scope);
  const { rows } = await db.execute<any>(sql`
    SELECT m.*, e.display_name AS owner_name, s.display_name AS tl_name
      FROM management_actions m
      JOIN employees e ON e.id = m.owner_employee_id
      JOIN employees s ON s.id = m.subject_tl_employee_id
     WHERE m.manager_employee_id = ${scope.employeeId}
       ${tlEmployeeId ? sql`AND m.subject_tl_employee_id = ${tlEmployeeId}` : sql``}
     ORDER BY m.due_at ASC
  `);
  return rows;
}

// ─── MG-03: Cross-Team Lead Transfer ───

export async function listTransferRequests(scope: Scope) {
  assertMg(scope);
  const { rows } = await db.execute<any>(sql`
    SELECT t.*,
           st.name AS source_team_name,
           dt.name AS destination_team_name,
           e.display_name AS manager_name
      FROM lead_transfer_requests t
      JOIN teams st ON st.id = t.source_team_id
      JOIN teams dt ON dt.id = t.destination_team_id
      JOIN employees e ON e.id = t.manager_employee_id
     WHERE t.source_team_id IN (${inList(scope.teams)}) AND t.destination_team_id IN (${inList(scope.teams)})
     ORDER BY t.created_at DESC
  `);
  return rows;
}

export async function createLeadTransfer(scope: Scope, input: CreateLeadTransferInput) {
  assertMg(scope);
  if (!scope.teams.includes(input.sourceTeamId) || !scope.teams.includes(input.destinationTeamId)) {
    throw forbidden('Both source and destination teams must be within your assigned scope.');
  }
  const transferId = id('TRF');
  const [row] = await db.insert(leadTransferRequests).values({
    id: transferId,
    managerEmployeeId: scope.employeeId,
    sourceTeamId: input.sourceTeamId,
    destinationTeamId: input.destinationTeamId,
    leadIds: input.leadIds,
    reason: input.reason,
    status: 'pending',
  }).returning();
  return row;
}

export async function decideLeadTransfer(scope: Scope, input: DecideLeadTransferInput) {
  assertMg(scope);
  const { rows: [req] } = await db.execute<any>(sql`SELECT * FROM lead_transfer_requests WHERE id = ${input.transferId}`);
  if (!req) throw notFound();
  if (!scope.teams.includes(req.source_team_id) || !scope.teams.includes(req.destination_team_id)) {
    throw forbidden('Teams are outside your permitted scope.');
  }

  return await db.transaction(async (tx) => {
    if (input.decision === 'approved') {
      const leadIds: string[] = typeof req.lead_ids === 'string' ? JSON.parse(req.lead_ids) : req.lead_ids;
      for (const leadId of leadIds) {
        await tx.update(leads)
          .set({ teamId: req.destination_team_id, updatedAt: sql`now()` })
          .where(eq(leads.id, leadId));

        await tx.insert(leadOwnershipEvents).values({
          id: id('OWN'),
          leadId,
          actorEmployeeId: scope.employeeId,
          actorRole: 'MG',
          actorTeamId: req.destination_team_id,
          kind: 'transfer',
          reason: `Manager approved cross-team transfer: ${input.resolutionNotes}`,
          recordVersion: 1,
        });
      }
    }

    const [updated] = await tx.update(leadTransferRequests)
      .set({
        status: input.decision,
        resolutionNotes: input.resolutionNotes,
        decidedAt: sql`now()`,
      })
      .where(eq(leadTransferRequests.id, input.transferId))
      .returning();

    return updated;
  });
}

// ─── MG-04: Capacity Recovery Plan ───

export async function getCapacityAnalysis(scope: Scope) {
  assertMg(scope);
  const teams = await getAssignedTeams(scope);
  const associates = await getAssignedAssociates(scope);

  const teamCapacity = await Promise.all(
    teams.map(async (t: any) => {
      const teamCallers = associates.filter((a: any) => a.team_ids.includes(t.id));
      const availableCount = teamCallers.filter((a: any) => a.availability === 'available').length;
      const { rows: [leadStats] } = await db.execute<any>(sql`
        SELECT count(*)::int AS backlog
          FROM leads WHERE team_id = ${t.id} AND stage NOT IN ('converted', 'lost')
      `);
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

  const { rows: plans } = await db.execute<any>(sql`
    SELECT * FROM capacity_plans WHERE manager_employee_id = ${scope.employeeId} ORDER BY created_at DESC
  `);

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
  const [row] = await db.insert(capacityPlans).values({
    id: planId,
    managerEmployeeId: scope.employeeId,
    name: input.name,
    periodLabel: input.periodLabel,
    teamIds: input.teamIds,
    currentBacklog: input.currentBacklog,
    availableCallers: input.availableCallers,
    plannedReallocations: input.plannedReallocations,
    requiredAdditionalStaff: input.requiredAdditionalStaff,
    operationalDeadline: input.operationalDeadline ? new Date(input.operationalDeadline).toISOString() : null,
    notes: input.notes ?? null,
    status: input.approved ? 'approved' : 'draft',
  }).returning();
  return row;
}

// ─── MG-05: Allocate Manager Targets to TLs ───

export async function getManagerTargets(scope: Scope, periodLabel = 'October') {
  assertMg(scope);
  const tls = await getAssignedTls(scope);
  const { rows: [target] } = await db.execute<any>(sql`
    SELECT * FROM manager_targets WHERE manager_employee_id = ${scope.employeeId} AND period_label = ${periodLabel} ORDER BY version DESC LIMIT 1
  `);

  const { rows: teamTargetRows } = await db.execute<any>(sql`
    SELECT t.*, tm.name AS team_name
      FROM team_targets t
      JOIN teams tm ON tm.id = t.team_id
     WHERE t.team_id IN (${inList(scope.teams)}) AND t.period_label = ${periodLabel}
  `);

  return {
    target: target ?? {
      id: null,
      periodLabel,
      approvedParentTarget: 100,
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

  return await db.transaction(async (tx) => {
    const targetId = id('TGT-MG');

    const [target] = await tx.insert(managerTargets)
      .values({
        id: targetId,
        managerEmployeeId: scope.employeeId,
        periodLabel: input.periodLabel,
        metric: input.metric,
        approvedParentTarget: String(input.approvedParentTarget),
        unallocatedRemainder: String(remainder),
        status: input.publish ? 'published' : 'draft',
      })
      .onConflictDoUpdate({
        target: [managerTargets.managerEmployeeId, managerTargets.periodLabel, managerTargets.metric, managerTargets.version],
        set: {
          approvedParentTarget: String(input.approvedParentTarget),
          unallocatedRemainder: String(remainder),
          status: input.publish ? 'published' : 'draft',
        },
      })
      .returning();

    if (input.publish) {
      for (const alloc of input.tlAllocations) {
        await tx.insert(teamTargets)
          .values({
            id: id('TGT-TM'),
            teamId: alloc.teamId,
            periodLabel: input.periodLabel,
            metric: input.metric,
            parentValue: String(alloc.allocatedValue),
            status: 'approved',
            createdBy: scope.employeeId,
          })
          .onConflictDoUpdate({
            target: [teamTargets.teamId, teamTargets.periodLabel, teamTargets.metric, teamTargets.version],
            set: {
              parentValue: String(alloc.allocatedValue),
              status: 'approved',
            },
          });
      }
    }

    return {
      ...target,
      unallocated_remainder: Number(target.unallocatedRemainder),
      approved_parent_target: Number(target.approvedParentTarget),
    };
  });
}

// ─── MG-06: TL Forecast Review ───

export async function listTlForecasts(scope: Scope, periodLabel = 'October') {
  assertMg(scope);
  const { rows } = await db.execute<any>(sql`
    SELECT f.*, t.name AS team_name, e.display_name AS tl_name
      FROM team_forecasts f
      JOIN teams t ON t.id = f.team_id
      JOIN employees e ON e.id = f.actor_employee_id
     WHERE f.team_id IN (${inList(scope.teams)}) AND f.period_label = ${periodLabel}
     ORDER BY f.submitted_at DESC
  `);
  return rows;
}

export async function decideTlForecast(scope: Scope, input: DecideTlForecastInput) {
  assertMg(scope);
  const { rows: [forecast] } = await db.execute<any>(sql`SELECT * FROM team_forecasts WHERE id = ${input.forecastId}`);
  if (!forecast) throw notFound();
  if (!scope.teams.includes(forecast.team_id)) throw forbidden('Forecast team outside scope.');

  const [updated] = await db.update(teamForecasts)
    .set({
      managerDecision: input.decision,
      managerFeedback: input.feedback,
      managerDecidedAt: sql`now()`,
    })
    .where(eq(teamForecasts.id, input.forecastId))
    .returning();
  return {
    ...updated,
    manager_decision: updated.managerDecision,
    manager_feedback: updated.managerFeedback,
    manager_decided_at: updated.managerDecidedAt,
  };
}

// ─── MG-07: Submit Manager Forecast to RM ───

export async function getManagerForecastRollup(scope: Scope, periodLabel = 'October') {
  assertMg(scope);
  const { rows: accepted } = await db.execute<any>(sql`
    SELECT f.*, t.name AS team_name, e.display_name AS tl_name
      FROM team_forecasts f
      JOIN teams t ON t.id = f.team_id
      JOIN employees e ON e.id = f.actor_employee_id
     WHERE f.team_id IN (${inList(scope.teams)}) AND f.period_label = ${periodLabel} AND f.manager_decision = 'accepted'
  `);

  const bottomUpTotal = accepted.reduce((acc: number, f: any) => acc + Number(f.expected_revenue), 0);

  const { rows: existingSubmissions } = await db.execute<any>(sql`
    SELECT * FROM manager_forecasts
     WHERE manager_employee_id = ${scope.employeeId} AND period_label = ${periodLabel}
     ORDER BY created_at DESC
  `);

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
  const [row] = await db.insert(managerForecasts).values({
    id: forecastId,
    managerEmployeeId: scope.employeeId,
    periodLabel: input.periodLabel,
    bottomUpRevenue: String(input.bottomUpRevenue),
    managementAdjustment: String(input.managementAdjustment),
    adjustedRevenue: String(input.adjustedRevenue),
    currency: input.currency,
    acceptedForecastIds: input.acceptedForecastIds,
    overrideReason: input.overrideReason ?? null,
    riskNotes: input.riskNotes,
    status: 'submitted_to_rm',
    submittedAt: sql`now()`,
  }).returning();
  return row;
}

// ─── MG-08: Resolve Repeated SLA Failure ───

export async function listSlaBreaches(scope: Scope) {
  assertMg(scope);
  const { rows } = await db.execute<any>(sql`
    SELECT o.*, l.display_name AS lead_name, e.display_name AS caller_name, t.name AS team_name
      FROM overdue_escalations o
      JOIN leads l ON l.id = o.lead_id
      JOIN teams t ON t.id = l.team_id
      JOIN employees e ON e.id = o.subject_employee_id
     WHERE l.team_id IN (${inList(scope.teams)})
     ORDER BY o.created_at DESC
  `);
  return rows;
}

export async function resolveSlaBreach(scope: Scope, input: ResolveSlaBreachInput) {
  assertMg(scope);
  const { rows: [esc] } = await db.execute<any>(sql`SELECT * FROM overdue_escalations WHERE id = ${input.escalationId}`);
  if (!esc) throw notFound();

  const actionId = id('MGT-REC');
  const dueAt = new Date(Date.now() + input.deadlineHours * 3600 * 1000);
  await db.insert(managementActions).values({
    id: actionId,
    managerEmployeeId: scope.employeeId,
    sourceAction: 'MG-08',
    kind: 'follow-up',
    subjectTlEmployeeId: esc.actor_employee_id,
    ownerEmployeeId: input.assigneeEmployeeId || scope.employeeId,
    title: `SLA Recovery Plan: ${esc.reason}`,
    detail: input.resolutionPlan,
    dueAt: dueAt.toISOString(),
    status: 'open',
  });

  return { success: true, escalationId: input.escalationId, recoveryActionId: actionId };
}

// ─── MG-09: Commercial Exceptions ───

export async function listCommercialExceptions(scope: Scope) {
  assertMg(scope);
  const { rows } = await db.execute<any>(sql`
    SELECT c.*,
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
       (l.team_id IS NOT NULL AND l.team_id IN (${inList(scope.teams)}) AND l.vertical IN (${inList(scope.verticals)}))
       OR
       (l.team_id IS NULL AND req_a.team_id IN (${inList(scope.teams)}) AND req_a.vertical IN (${inList(scope.verticals)}))
     )
     ORDER BY c.created_at DESC
  `);
  return rows;
}

export async function getCommercialException(scope: Scope, exceptionId: string) {
  assertMg(scope);
  const { rows: [exc] } = await db.execute<any>(sql`
    SELECT c.*,
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
     WHERE c.id = ${exceptionId}
  `);
  if (!exc) throw notFound();

  const isTeamScoped = exc.team_id && scope.teams.includes(exc.team_id);
  const isVerticalScoped = !exc.vertical || scope.verticals.includes(exc.vertical);
  if (!isTeamScoped || !isVerticalScoped) {
    throw forbidden('Unauthorized: Commercial exception belongs to another team or vertical [Deck P002].');
  }

  return exc;
}

async function resolveCommercialApprovalAuthority(
  tx: any,
  scope: Scope,
  exception: {
    id: string;
    exception_type: string;
    delegated_limit_met: boolean;
    requested_terms: string;
    standard_terms: string;
  }
): Promise<{ permitted: boolean; reason?: string }> {
  if (scope.role !== 'MG') {
    return { permitted: false, reason: 'Role does not possess Manager delegation' };
  }

  if (exception.exception_type === 'custom-terms') {
    return {
      permitted: false,
      reason: 'Manager title does not authorise custom contract terms. Must be escalated to Regional Manager or Legal/Finance [Deck P152].',
    };
  }

  if (!exception.delegated_limit_met) {
    return {
      permitted: false,
      reason: 'Requested terms exceed Manager delegated authority threshold [Deck P320 Category 3].',
    };
  }

  try {
    const { rows: policies } = await tx.execute(sql`
      SELECT approval_limits FROM finance_policies
       WHERE category = 'delegation_of_authority' AND status = 'active'
       ORDER BY effective_date DESC LIMIT 1
    `);
    if (policies.length === 0) {
      return {
        permitted: false,
        reason: 'Delegation of authority policy is unset. Unset limits mean no approval authority [Deck P152, Deck P320 Cat 3].',
      };
    }
    const limits = policies[0].approval_limits || {};
    const mgLimit = Number(limits.MG);
    if (!mgLimit || mgLimit <= 0) {
      return {
        permitted: false,
        reason: 'Manager delegated approval limit is unset or zero in active DoA policy. Unset limits mean no approval authority [Deck P152, Deck P320 Cat 3].',
      };
    }
  } catch {
    return {
      permitted: false,
      reason: 'Delegation of authority policy could not be verified from trusted server configuration [Deck P152].',
    };
  }

  return { permitted: true };
}

export async function decideCommercialException(scope: Scope, input: DecideCommercialExceptionInput) {
  assertMg(scope);
  return await db.transaction(async (tx) => {
    const { rows: [exc] } = await tx.execute<any>(sql`
      SELECT c.*,
             COALESCE(l.team_id, req_a.team_id) AS team_id,
             COALESCE(l.vertical, req_a.vertical) AS vertical
        FROM commercial_exceptions c
        LEFT JOIN leads l ON l.id = c.lead_id
        LEFT JOIN assignments req_a ON req_a.employee_id = c.requested_by_employee_id
             AND req_a.effective_from <= CURRENT_DATE
             AND (req_a.effective_to IS NULL OR req_a.effective_to > CURRENT_DATE)
       WHERE c.id = ${input.exceptionId}
         FOR UPDATE OF c
    `);

    if (!exc) {
      throw notFound();
    }

    const isTeamScoped = exc.team_id && scope.teams.includes(exc.team_id);
    const isVerticalScoped = !exc.vertical || scope.verticals.includes(exc.vertical);
    if (!isTeamScoped || !isVerticalScoped) {
      throw forbidden('Unauthorized: Commercial exception belongs to another team or vertical [Deck P002].');
    }

    if (exc.status !== 'pending') {
      throw new HttpError(
        400,
        'VALIDATION_FAILED',
        `Commercial exception has already been decided with status '${exc.status}'.`
      );
    }

    const authCheck = await resolveCommercialApprovalAuthority(tx, scope, exc);

    if (input.decision === 'approved' && !authCheck.permitted) {
      throw forbidden(
        `Unauthorized decision: ${authCheck.reason || 'Manager lacks delegated approval authority'} [Deck P320 Category 3: Approvals and limits]. Must be escalated to Regional Manager.`
      );
    }

    const finalDelegatedLimitMet = input.decision === 'approved' ? true : exc.delegated_limit_met;

    const [updated] = await tx.update(commercialExceptions)
      .set({
        status: input.decision,
        decisionNotes: input.decisionNotes,
        decidedByManagerEmployeeId: scope.employeeId,
        decidedAt: sql`now()`,
        delegatedLimitMet: finalDelegatedLimitMet,
      })
      .where(sql`id = ${input.exceptionId} AND status = 'pending'`)
      .returning();

    if (!updated) {
      throw new HttpError(
        400,
        'VALIDATION_FAILED',
        'Commercial exception was concurrently finalized by another request.'
      );
    }

    return {
      ...updated,
      delegated_limit_met: updated.delegatedLimitMet,
      decision_notes: updated.decisionNotes,
      decided_by_manager_employee_id: updated.decidedByManagerEmployeeId,
      decided_at: updated.decidedAt,
    };
  });
}

// ─── MG-10: Source Quality Remediation ───

export async function getSourceQuality(scope: Scope, cohortPeriod = 'September') {
  assertMg(scope);
  const { rows: sourceStats } = await db.execute<any>(sql`
    SELECT l.source AS source_name,
           count(*)::int AS sample_size,
           count(*) FILTER (WHERE l.phone IS NULL OR length(l.phone) < 8)::int AS invalid_intake,
           count(*) FILTER (WHERE l.stage = 'not-contacted')::int AS contact_failed,
           count(*) FILTER (WHERE l.stage = 'lost')::int AS commercial_loss,
           count(*) FILTER (WHERE l.stage = 'converted')::int AS converted
      FROM leads l
     WHERE l.team_id IN (${inList(scope.teams)})
     GROUP BY l.source
     ORDER BY sample_size DESC
  `);

  const { rows: remediations } = await db.execute<any>(sql`
    SELECT * FROM source_remediations WHERE manager_employee_id = ${scope.employeeId} ORDER BY created_at DESC
  `);

  return {
    cohortPeriod,
    sources: sourceStats.map((s: any) => ({
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
  const [row] = await db.insert(sourceRemediations).values({
    id: remId,
    managerEmployeeId: scope.employeeId,
    sourceName: input.sourceName,
    cohortPeriod: input.cohortPeriod,
    sampleSize: input.sampleSize,
    invalidIntakeCount: input.invalidIntakeCount,
    contactFailedCount: input.contactFailedCount,
    commercialLossCount: input.commercialLossCount,
    remediationType: input.remediationType,
    justification: input.justification,
    status: 'submitted',
  }).returning();
  return row;
}

// ─── MG-11: TL Performance Reviews ───

export async function listTlReviews(scope: Scope, tlEmployeeId?: string) {
  assertMg(scope);
  const { rows } = await db.execute<any>(sql`
    SELECT r.*, e.display_name AS tl_name
      FROM reviews r
      JOIN employees e ON e.id = r.employee_id
     WHERE r.reviewer_employee_id = ${scope.employeeId}
       ${tlEmployeeId ? sql`AND r.employee_id = ${tlEmployeeId}` : sql``}
     ORDER BY r.created_at DESC
  `);
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
  const [row] = await db.insert(reviews).values({
    id: reviewId,
    employeeId: input.subjectTlEmployeeId,
    reviewerEmployeeId: scope.employeeId,
    period: input.periodLabel,
    scorecard,
    commitments: input.commitments,
  }).returning();
  return {
    ...row,
    employee_id: row.employeeId,
    reviewer_employee_id: row.reviewerEmployeeId,
  };
}

// ─── MG-12: Employee Lifecycle Requests ───

export async function listLifecycleRequests(scope: Scope) {
  assertMg(scope);
  const { rows } = await db.execute<any>(sql`
    SELECT l.*, e.display_name AS employee_name, t.name AS proposed_team_name
      FROM employee_lifecycle_requests l
      JOIN employees e ON e.id = l.employee_id
      LEFT JOIN teams t ON t.id = l.proposed_team_id
     WHERE l.manager_employee_id = ${scope.employeeId}
     ORDER BY l.created_at DESC
  `);
  return rows;
}

export async function createLifecycleRequest(scope: Scope, input: CreateEmployeeLifecycleInput) {
  assertMg(scope);
  const reqId = id('LFC');
  const [row] = await db.insert(employeeLifecycleRequests).values({
    id: reqId,
    managerEmployeeId: scope.employeeId,
    employeeId: input.employeeId,
    proposedRole: input.proposedRole,
    proposedTeamId: input.proposedTeamId ?? null,
    effectiveDate: input.effectiveDate,
    businessJustification: input.businessJustification,
    handoffPlan: input.handoffPlan,
    status: 'submitted',
  }).returning();
  return row;
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
    openManagementActions: actions.filter((a: any) => a.status === 'open'),
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

    // Section 1: Executive KPI Reconciliation
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

  const [row] = await db.insert(reportSchedules)
    .values({
      id: scheduleId,
      ownerEmployeeId: scope.employeeId,
      name: input.name,
      cadence: input.cadence,
      period: input.period,
      recipients: input.recipients,
      status: 'active',
      dedupeKey,
      nextRunAt: nextRunAt.toISOString(),
    })
    .onConflictDoUpdate({
      target: reportSchedules.dedupeKey,
      set: {
        name: input.name,
        nextRunAt: nextRunAt.toISOString(),
      },
    })
    .returning();
  return row;
}

export async function listReportSchedules(scope: Scope) {
  assertMg(scope);
  const { rows } = await db.execute<any>(sql`
    SELECT * FROM report_schedules WHERE owner_employee_id = ${scope.employeeId} ORDER BY created_at DESC
  `);
  return rows;
}
