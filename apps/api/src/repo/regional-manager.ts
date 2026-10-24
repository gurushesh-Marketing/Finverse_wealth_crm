import { createWriteStream, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import PDFDocument from 'pdfkit';
import { db } from './db';
import type { Scope } from './users';
import { forbidden, notFound, HttpError } from '../lib/errors';
import { eq, sql } from 'drizzle-orm';
import {
  regionalTargets,
  regionalForecasts,
  regionalManagementActions,
  regionalStaffingPlans,
  territoryCoveragePlans,
  regionalEscalations,
  regionalReportSchedules,
  crossManagerTransfers,
  managerTargets,
  managerForecasts,
  managerReviews,
  commercialExceptions,
  leads,
  leadEvents,
} from '../db/schema';
import type {
  CreateRegionalActionInput,
  SaveTerritoryPlanInput,
  AllocateRegionalTargetInput,
  CreateCrossManagerTransferInput,
  DecideCrossManagerTransferInput,
  SaveRegionalStaffingPlanInput,
  SubmitRegionalForecastInput,
  CreateRegionalEscalationInput,
  ResolveRegionalEscalationInput,
  SaveManagerReviewInput,
  SaveRegionalReportScheduleInput,
  GenerateRegionalPdfPackInput,
  RmPeriod,
} from '@finverse/contracts';

const EXPORT_ROOT = resolve(process.cwd(), 'data/regional_exports');

function id(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function inList<T>(vals: T[]) {
  return vals.length > 0 ? sql.join(vals.map((v) => sql`${v}`), sql`, `) : sql`NULL`;
}

export function assertRm(scope: Scope): void {
  if (scope.role !== 'RM') {
    throw forbidden('Wealth Regional Manager workspace only.');
  }
}

// ─── Scope queries ───

export async function getRegionalScope(scope: Scope) {
  assertRm(scope);
  const { rows: teamRows } = await db.execute<any>(sql`
    SELECT t.id, t.name, t.vertical, COALESCE(t.region_id, 'REGION-SOUTH') as region_id,
           COALESCE(r.name, 'South Region') as region_name
      FROM teams t
 LEFT JOIN regions r ON r.id = t.region_id
     WHERE t.id IN (${inList(scope.teams)})
     ORDER BY t.name
  `);

  const regionId = teamRows[0]?.region_id || 'REGION-SOUTH';
  const regionName = teamRows[0]?.region_name || 'South Region';

  const { rows: managerRows } = await db.execute<any>(sql`
    SELECT DISTINCT e.id, e.display_name, e.email,
           array_remove(array_agg(DISTINCT t.name), NULL) AS team_names,
           array_remove(array_agg(DISTINCT t.id), NULL) AS team_ids
      FROM assignments a
      JOIN employees e ON e.id = a.employee_id
      JOIN teams t ON t.id = a.team_id
     WHERE a.team_id IN (${inList(scope.teams)}) AND a.role = 'MG'
       AND a.effective_from <= now()
       AND (a.effective_to IS NULL OR a.effective_to > now())
     GROUP BY e.id, e.display_name, e.email
     ORDER BY e.display_name
  `);

  const { rows: tlRows } = await db.execute<any>(sql`
    SELECT DISTINCT e.id, e.display_name, e.email
      FROM assignments a
      JOIN employees e ON e.id = a.employee_id
     WHERE a.team_id IN (${inList(scope.teams)}) AND a.role = 'TL'
       AND a.effective_from <= now()
       AND (a.effective_to IS NULL OR a.effective_to > now())
  `);

  const { rows: associateRows } = await db.execute<any>(sql`
    SELECT DISTINCT e.id, e.display_name, e.email
      FROM assignments a
      JOIN employees e ON e.id = a.employee_id
     WHERE a.team_id IN (${inList(scope.teams)}) AND a.role = 'SC'
       AND a.effective_from <= now()
       AND (a.effective_to IS NULL OR a.effective_to > now())
  `);

  return {
    regionId,
    regionName,
    teams: teamRows,
    managers: managerRows,
    tlsCount: tlRows.length,
    associatesCount: associateRows.length,
  };
}

// ─── RM-01: Region Overview ───

export async function getRegionalOverview(scope: Scope, period: RmPeriod = 'month-to-date') {
  assertRm(scope);
  const regionalScope = await getRegionalScope(scope);

  const { rows: targetRows } = await db.execute<any>(sql`
    SELECT approved_nm_target, unallocated_remainder, status
      FROM regional_targets
     WHERE region_id = ${regionalScope.regionId}
     ORDER BY version DESC LIMIT 1
  `);
  const parentTarget = targetRows[0] ? Number(targetRows[0].approved_nm_target) : 250;
  const unallocatedRemainder = targetRows[0] ? Number(targetRows[0].unallocated_remainder) : 0;

  const { rows: winRows } = await db.execute<any>(sql`
    SELECT count(*)::int AS count
      FROM leads
     WHERE team_id IN (${inList(scope.teams)}) AND stage = 'converted'
  `);
  const achievedWins = winRows[0]?.count ?? 0;
  const attainmentPercent = parentTarget > 0 ? Math.round((achievedWins / parentTarget) * 100) : 0;

  const managersWithMetrics = await Promise.all(
    regionalScope.managers.map(async (mgr: any) => {
      const { rows: mgrTargetRows } = await db.execute<any>(sql`
        SELECT approved_parent_target
          FROM manager_targets
         WHERE manager_employee_id = ${mgr.id}
         ORDER BY version DESC LIMIT 1
      `);
      const allocatedTarget = mgrTargetRows[0] ? Number(mgrTargetRows[0].approved_parent_target) : 120;

      const { rows: mgrWins } = await db.execute<any>(sql`
        SELECT count(*)::int AS wins,
               count(*) FILTER (WHERE stage IN ('new', 'not-contacted', 'contacted', 'follow-up', 'qualified'))::int AS open_leads
          FROM leads
         WHERE team_id IN (${inList(mgr.team_ids)})
      `);
      const wins = mgrWins[0]?.wins ?? 0;
      const openLeads = mgrWins[0]?.open_leads ?? 0;
      const targetPace = allocatedTarget > 0 ? Math.round((wins / allocatedTarget) * 100) : 0;

      const { rows: actionRows } = await db.execute<any>(sql`
        SELECT count(*)::int AS open_actions
          FROM regional_management_actions
         WHERE subject_manager_employee_id = ${mgr.id} AND status = 'open'
      `);

      return {
        managerId: mgr.id,
        name: mgr.display_name,
        email: mgr.email,
        teams: mgr.team_names,
        allocatedTarget,
        achievedWins: wins,
        targetPace,
        openLeads,
        openInterventions: actionRows[0]?.open_actions ?? 0,
        status: targetPace >= 80 ? 'on-track' : targetPace >= 50 ? 'at-risk' : 'critical',
      };
    })
  );

  const { rows: sourceRows } = await db.execute<any>(sql`
    SELECT source,
           count(*)::int AS total_leads,
           count(*) FILTER (WHERE stage = 'converted')::int AS converted_leads
      FROM leads
     WHERE team_id IN (${inList(scope.teams)})
     GROUP BY source
     ORDER BY total_leads DESC
  `);
  const sourceMix = sourceRows.map((r: any) => ({
    source: r.source,
    totalLeads: r.total_leads,
    convertedLeads: r.converted_leads,
    conversionRate: r.total_leads > 0 ? Math.round((r.converted_leads / r.total_leads) * 100) : 0,
  }));

  const { rows: backlogRows } = await db.execute<any>(sql`
    SELECT count(*) FILTER (WHERE stage IN ('new', 'not-contacted'))::int AS uncontacted,
           count(*) FILTER (WHERE stage = 'follow-up')::int AS in_follow_up,
           count(*) FILTER (WHERE created_at < now() - interval '48 hours' AND stage NOT IN ('converted', 'lost'))::int AS older_than_48h,
           count(*) FILTER (WHERE created_at < now() - interval '7 days' AND stage NOT IN ('converted', 'lost'))::int AS older_than_7d
      FROM leads
     WHERE team_id IN (${inList(scope.teams)})
  `);
  const backlog = {
    uncontacted: backlogRows[0]?.uncontacted ?? 0,
    inFollowUp: backlogRows[0]?.in_follow_up ?? 0,
    olderThan48h: backlogRows[0]?.older_than_48h ?? 0,
    olderThan7d: backlogRows[0]?.older_than_7d ?? 0,
  };

  const { rows: escalationRows } = await db.execute<any>(sql`
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE severity IN ('high', 'critical'))::int AS high_critical
      FROM regional_escalations
     WHERE (region_id = ${regionalScope.regionId} OR region_id IS NULL) AND status IN ('open', 'recovery_plan_assigned')
  `);

  return {
    region: {
      id: regionalScope.regionId,
      name: regionalScope.regionName,
      vertical: 'wealth',
      teamsCount: regionalScope.teams.length,
      managersCount: regionalScope.managers.length,
      tlsCount: regionalScope.tlsCount,
      associatesCount: regionalScope.associatesCount,
    },
    target: {
      parentTarget,
      unallocatedRemainder,
      achievedWins,
      attainmentPercent,
      periodLabel: 'October 2026',
    },
    managers: managersWithMetrics,
    sourceMix,
    backlog,
    escalationsSummary: {
      openCount: escalationRows[0]?.total ?? 0,
      highCriticalCount: escalationRows[0]?.high_critical ?? 0,
    },
    asOf: new Date().toISOString(),
  };
}

// ─── RM-01/02/08/09: Regional Management Actions ───

export async function createRegionalAction(scope: Scope, input: CreateRegionalActionInput) {
  assertRm(scope);
  const actionId = id('RMA');
  const regionalScope = await getRegionalScope(scope);

  const [row] = await db.insert(regionalManagementActions).values({
    id: actionId,
    rmEmployeeId: scope.employeeId,
    sourceAction: input.sourceAction,
    kind: input.kind,
    subjectManagerEmployeeId: input.subjectManagerEmployeeId,
    ownerEmployeeId: input.ownerEmployeeId,
    regionId: input.regionId || regionalScope.regionId,
    metricKey: input.metricKey || null,
    periodLabel: input.periodLabel || 'October',
    title: input.title,
    detail: input.detail || null,
    dueAt: new Date(input.dueAt).toISOString(),
    status: 'open',
  }).returning();
  return row;
}

export async function listRegionalActions(scope: Scope, managerId?: string) {
  assertRm(scope);
  const { rows } = await db.execute<any>(sql`
    SELECT a.*, e.display_name as manager_name, o.display_name as owner_name
      FROM regional_management_actions a
      JOIN employees e ON e.id = a.subject_manager_employee_id
      JOIN employees o ON o.id = a.owner_employee_id
     WHERE a.rm_employee_id = ${scope.employeeId}
       ${managerId ? sql`AND a.subject_manager_employee_id = ${managerId}` : sql``}
     ORDER BY a.due_at ASC
  `);
  return rows;
}

// ─── RM-02: Manager Scorecard ───

export async function getManagerScorecard(scope: Scope, managerId: string, period = 'September') {
  assertRm(scope);
  const { rows: mgrRows } = await db.execute<any>(sql`
    SELECT e.id, e.display_name, e.email,
           array_remove(array_agg(DISTINCT t.name), NULL) AS team_names,
           array_remove(array_agg(DISTINCT t.id), NULL) AS team_ids
      FROM assignments a
      JOIN employees e ON e.id = a.employee_id
      JOIN teams t ON t.id = a.team_id
     WHERE e.id = ${managerId} AND a.team_id IN (${inList(scope.teams)}) AND a.role = 'MG'
     GROUP BY e.id, e.display_name, e.email
  `);

  if (!mgrRows[0]) {
    throw notFound();
  }
  const manager = mgrRows[0];

  const { rows: tlRows } = await db.execute<any>(sql`
    SELECT DISTINCT e.id, e.display_name, e.email, t.name as team_name
      FROM assignments a
      JOIN employees e ON e.id = a.employee_id
      JOIN teams t ON t.id = a.team_id
     WHERE a.team_id IN (${inList(manager.team_ids)}) AND a.role = 'TL'
  `);

  const { rows: targetRows } = await db.execute<any>(sql`
    SELECT approved_parent_target, unallocated_remainder, version, status
      FROM manager_targets
     WHERE manager_employee_id = ${managerId}
     ORDER BY version DESC LIMIT 1
  `);
  const target = targetRows[0] ? Number(targetRows[0].approved_parent_target) : 100;

  const { rows: leadMetrics } = await db.execute<any>(sql`
    SELECT count(*) FILTER (WHERE stage = 'converted')::int AS wins,
           count(*) FILTER (WHERE stage IN ('new', 'not-contacted', 'contacted', 'follow-up', 'qualified'))::int AS open_pipeline,
           count(*)::int AS total_leads
      FROM leads
     WHERE team_id IN (${inList(manager.team_ids)})
  `);
  const wins = leadMetrics[0]?.wins ?? 0;
  const attainmentRate = target > 0 ? Math.round((wins / target) * 100) : 0;

  const { rows: forecastRows } = await db.execute<any>(sql`
    SELECT id, period_label, bottom_up_revenue, management_adjustment, adjusted_revenue, status, submitted_at
      FROM manager_forecasts
     WHERE manager_employee_id = ${managerId}
     ORDER BY created_at DESC LIMIT 1
  `);

  const actions = await listRegionalActions(scope, managerId);
  const { rows: reviewRows } = await db.execute<any>(sql`
    SELECT * FROM manager_reviews
     WHERE manager_employee_id = ${managerId}
     ORDER BY created_at DESC
  `);

  return {
    manager: {
      id: manager.id,
      name: manager.display_name,
      email: manager.email,
      teams: manager.team_names,
      teamIds: manager.team_ids,
    },
    teamLeads: tlRows,
    performance: {
      targetWins: target,
      achievedWins: wins,
      attainmentRate,
      openPipeline: leadMetrics[0]?.open_pipeline ?? 0,
      totalLeads: leadMetrics[0]?.total_leads ?? 0,
      operationalHealthScore: attainmentRate >= 80 ? 92 : attainmentRate >= 50 ? 74 : 48,
    },
    latestForecast: forecastRows[0] || null,
    actions,
    reviews: reviewRows,
  };
}

// ─── RM-03: Territory Coverage Planning ───

export async function getTerritoryCoverage(scope: Scope) {
  assertRm(scope);
  const regionalScope = await getRegionalScope(scope);

  const { rows: teamStats } = await db.execute<any>(sql`
    SELECT t.id, t.name,
           count(l.id)::int AS total_leads,
           count(l.id) FILTER (WHERE l.stage IN ('new', 'not-contacted'))::int AS pending_intake,
           count(DISTINCT a.employee_id)::int AS caller_count
      FROM teams t
 LEFT JOIN leads l ON l.team_id = t.id
 LEFT JOIN assignments a ON a.team_id = t.id AND a.role = 'SC'
     WHERE t.id IN (${inList(scope.teams)})
     GROUP BY t.id, t.name
     ORDER BY t.name
  `);

  const { rows: plans } = await db.execute<any>(sql`
    SELECT * FROM territory_coverage_plans
     WHERE region_id = ${regionalScope.regionId}
     ORDER BY version DESC, created_at DESC
  `);

  return {
    regionName: regionalScope.regionName,
    subRegions: ['Karnataka South Hub', 'Tamil Nadu Metro Zone', 'Kerala Coastal Belt'],
    languageQueues: ['English', 'Hindi', 'Kannada', 'Tamil', 'Telugu'],
    teamStats: teamStats.map((t: any) => ({
      teamId: t.id,
      teamName: t.name,
      totalLeads: t.total_leads,
      pendingIntake: t.pending_intake,
      callerCount: t.caller_count,
      coverageRatio: t.caller_count > 0 ? (t.total_leads / t.caller_count).toFixed(1) : 'N/A',
    })),
    plans,
  };
}

export async function saveTerritoryPlan(scope: Scope, input: SaveTerritoryPlanInput) {
  assertRm(scope);
  const regionalScope = await getRegionalScope(scope);
  const planId = input.id || id('TCP');

  const [row] = await db.insert(territoryCoveragePlans)
    .values({
      id: planId,
      rmEmployeeId: scope.employeeId,
      regionId: regionalScope.regionId,
      territoryName: input.territoryName,
      subRegion: input.subRegion,
      productScope: input.productScope,
      languageQueues: input.languageQueues,
      targetTeamIds: input.targetTeamIds,
      capacityGap: input.capacityGap,
      routingProposal: input.routingProposal,
      activationDate: input.activationDate,
      status: input.status,
    })
    .onConflictDoUpdate({
      target: territoryCoveragePlans.id,
      set: {
        territoryName: input.territoryName,
        subRegion: input.subRegion,
        productScope: input.productScope,
        languageQueues: input.languageQueues,
        targetTeamIds: input.targetTeamIds,
        capacityGap: input.capacityGap,
        routingProposal: input.routingProposal,
        activationDate: input.activationDate,
        status: input.status,
        version: sql`territory_coverage_plans.version + 1`,
      },
    })
    .returning();
  return row;
}

// ─── RM-04: Regional Target Allocation ───

export async function getRegionalTargets(scope: Scope) {
  assertRm(scope);
  const regionalScope = await getRegionalScope(scope);

  const { rows: targets } = await db.execute<any>(sql`
    SELECT * FROM regional_targets
     WHERE region_id = ${regionalScope.regionId}
     ORDER BY version DESC, created_at DESC
  `);

  const activeTarget = targets[0] || {
    id: 'RT-OCT-2026',
    approved_nm_target: 250,
    unallocated_remainder: 0,
    period_label: 'October',
    status: 'draft',
    version: 1,
  };

  const { rows: managerAllocations } = await db.execute<any>(sql`
    SELECT mt.*, e.display_name as manager_name
      FROM manager_targets mt
      JOIN employees e ON e.id = mt.manager_employee_id
     WHERE mt.manager_employee_id IN (${inList(regionalScope.managers.map((m: any) => m.id))})
     ORDER BY mt.version DESC
  `);

  return {
    activeTarget: {
      id: activeTarget.id,
      approvedNmTarget: Number(activeTarget.approved_nm_target),
      unallocatedRemainder: Number(activeTarget.unallocated_remainder),
      periodLabel: activeTarget.period_label,
      metric: activeTarget.metric,
      status: activeTarget.status,
      version: activeTarget.version,
    },
    managers: regionalScope.managers.map((m: any) => {
      const alloc = managerAllocations.find((a: any) => a.manager_employee_id === m.id);
      return {
        managerId: m.id,
        managerName: m.display_name,
        targetWins: alloc ? Number(alloc.approved_parent_target) : 0,
        status: alloc?.status || 'draft',
      };
    }),
    history: targets,
  };
}

export async function allocateRegionalTarget(scope: Scope, input: AllocateRegionalTargetInput) {
  assertRm(scope);
  const regionalScope = await getRegionalScope(scope);

  return await db.transaction(async (tx) => {
    const totalAllocated = input.managerAllocations.reduce((sum, m) => sum + m.targetWins, 0);
    if (totalAllocated > input.approvedNmTarget) {
      throw new HttpError(400, 'VALIDATION_FAILED', `Total manager allocations (${totalAllocated}) exceed approved NM target (${input.approvedNmTarget}).`);
    }

    const unallocatedRemainder = input.approvedNmTarget - totalAllocated;
    const targetStatus = input.publish ? 'published' : 'draft';
    const targetId = id('RT');

    const [regionalTarget] = await tx.insert(regionalTargets)
      .values({
        id: targetId,
        rmEmployeeId: scope.employeeId,
        regionId: regionalScope.regionId,
        periodLabel: input.periodLabel,
        metric: input.metric || 'approved-wins',
        approvedNmTarget: String(input.approvedNmTarget),
        unallocatedRemainder: String(unallocatedRemainder),
        status: targetStatus,
        version: 1,
      })
      .onConflictDoUpdate({
        target: [regionalTargets.regionId, regionalTargets.periodLabel, regionalTargets.metric, regionalTargets.version],
        set: {
          approvedNmTarget: String(input.approvedNmTarget),
          unallocatedRemainder: String(unallocatedRemainder),
          status: targetStatus,
        },
      })
      .returning();

    for (const alloc of input.managerAllocations) {
      const mgrTargetId = id('MGT');
      await tx.insert(managerTargets)
        .values({
          id: mgrTargetId,
          managerEmployeeId: alloc.managerEmployeeId,
          periodLabel: input.periodLabel,
          metric: input.metric || 'approved-wins',
          approvedParentTarget: String(alloc.targetWins),
          unallocatedRemainder: '0',
          status: targetStatus,
          version: 1,
        })
        .onConflictDoUpdate({
          target: [managerTargets.managerEmployeeId, managerTargets.periodLabel, managerTargets.metric, managerTargets.version],
          set: {
            approvedParentTarget: String(alloc.targetWins),
            status: targetStatus,
          },
        });
    }

    return regionalTarget;
  });
}

// ─── RM-05: Cross-Manager Lead Transfers ───

export async function listCrossManagerTransfers(scope: Scope) {
  assertRm(scope);
  const { rows } = await db.execute<any>(sql`
    SELECT t.*,
           sm.display_name AS source_manager_name,
           dm.display_name AS destination_manager_name,
           st.name AS source_team_name,
           dt.name AS destination_team_name
      FROM cross_manager_transfers t
      JOIN employees sm ON sm.id = t.source_manager_employee_id
      JOIN employees dm ON dm.id = t.destination_manager_employee_id
      JOIN teams st ON st.id = t.source_team_id
      JOIN teams dt ON dt.id = t.destination_team_id
     WHERE t.rm_employee_id = ${scope.employeeId}
     ORDER BY t.created_at DESC
  `);
  return rows;
}

export async function createCrossManagerTransfer(scope: Scope, input: CreateCrossManagerTransferInput) {
  assertRm(scope);
  const transferId = id('CMT');

  const [row] = await db.insert(crossManagerTransfers).values({
    id: transferId,
    rmEmployeeId: scope.employeeId,
    sourceManagerEmployeeId: input.sourceManagerEmployeeId,
    destinationManagerEmployeeId: input.destinationManagerEmployeeId,
    sourceTeamId: input.sourceTeamId,
    destinationTeamId: input.destinationTeamId,
    leadIds: input.leadIds,
    reason: input.reason,
    forecastImpactNotes: input.forecastImpactNotes || null,
    status: 'pending',
  }).returning();
  return row;
}

export async function decideCrossManagerTransfer(scope: Scope, input: DecideCrossManagerTransferInput) {
  assertRm(scope);
  return await db.transaction(async (tx) => {
    const { rows } = await tx.execute<any>(sql`
      SELECT * FROM cross_manager_transfers WHERE id = ${input.transferId} FOR UPDATE
    `);
    if (!rows[0]) throw notFound();
    const transfer = rows[0];

    await tx.update(crossManagerTransfers)
      .set({ status: input.decision, decidedAt: sql`now()` })
      .where(eq(crossManagerTransfers.id, input.transferId));

    if (input.decision === 'approved') {
      const leadIds: string[] = typeof transfer.lead_ids === 'string'
        ? JSON.parse(transfer.lead_ids)
        : transfer.lead_ids;

      if (leadIds.length > 0) {
        await tx.execute(sql`
          UPDATE leads
             SET team_id = ${transfer.destination_team_id}, updated_at = now(), record_version = record_version + 1
           WHERE id IN (${inList(leadIds)})
        `);

        for (const leadId of leadIds) {
          const eventId = id('EV');
          await tx.insert(leadEvents).values({
            id: eventId,
            leadId,
            actorEmployeeId: scope.employeeId,
            kind: 'cross-manager-transfer',
            note: `Cross-manager transfer approved by RM ${scope.displayName}: transferred to team ${transfer.destination_team_id}. Notes: ${input.resolutionNotes}`,
            actorRole: 'RM',
            actorTeamId: transfer.destination_team_id,
          });
        }
      }
    }

    return { ...transfer, status: input.decision, resolutionNotes: input.resolutionNotes };
  });
}

// ─── RM-06: Regional Staffing Plans ───

export async function getRegionalCapacity(scope: Scope) {
  assertRm(scope);
  const regionalScope = await getRegionalScope(scope);

  const { rows: teamCapacities } = await db.execute<any>(sql`
    SELECT t.id, t.name,
           count(DISTINCT a.employee_id)::int AS active_callers,
           count(l.id) FILTER (WHERE l.stage IN ('new', 'not-contacted', 'contacted', 'follow-up', 'qualified'))::int AS open_leads
      FROM teams t
 LEFT JOIN assignments a ON a.team_id = t.id AND a.role = 'SC' AND (a.effective_to IS NULL OR a.effective_to > now())
 LEFT JOIN leads l ON l.team_id = t.id
     WHERE t.id IN (${inList(scope.teams)})
     GROUP BY t.id, t.name
  `);

  const { rows: plans } = await db.execute<any>(sql`
    SELECT * FROM regional_staffing_plans
     WHERE region_id = ${regionalScope.regionId}
     ORDER BY version DESC, created_at DESC
  `);

  const totalCallers = teamCapacities.reduce((sum: number, t: any) => sum + t.active_callers, 0);
  const totalOpenLeads = teamCapacities.reduce((sum: number, t: any) => sum + t.open_leads, 0);

  return {
    totalCallers,
    totalOpenLeads,
    teams: teamCapacities.map((t: any) => ({
      teamId: t.id,
      name: t.name,
      activeCallers: t.active_callers,
      openLeads: t.open_leads,
      workloadPerCaller: t.active_callers > 0 ? Math.round(t.open_leads / t.active_callers) : 0,
    })),
    activePlan: plans[0] || null,
    history: plans,
  };
}

export async function saveRegionalStaffingPlan(scope: Scope, input: SaveRegionalStaffingPlanInput) {
  assertRm(scope);
  const regionalScope = await getRegionalScope(scope);
  const planId = input.id || id('RSP');

  const [row] = await db.insert(regionalStaffingPlans)
    .values({
      id: planId,
      rmEmployeeId: scope.employeeId,
      regionId: regionalScope.regionId,
      periodLabel: input.periodLabel,
      plannedHeadcount: input.plannedHeadcount,
      approvedHeadcount: input.approvedHeadcount,
      activeHeadcount: input.activeHeadcount,
      requisitions: input.requisitions,
      businessJustification: input.businessJustification,
      status: input.status,
    })
    .onConflictDoUpdate({
      target: regionalStaffingPlans.id,
      set: {
        plannedHeadcount: input.plannedHeadcount,
        approvedHeadcount: input.approvedHeadcount,
        activeHeadcount: input.activeHeadcount,
        requisitions: input.requisitions,
        businessJustification: input.businessJustification,
        status: input.status,
        version: sql`regional_staffing_plans.version + 1`,
        decidedAt: sql`CASE WHEN ${input.status} IN ('approved_by_rm', 'submitted_to_hr') THEN now() ELSE NULL END`,
      },
    })
    .returning();
  return row;
}

// ─── RM-07: Regional Forecast Rollup & Submission ───

export async function getRegionalForecastRollup(scope: Scope, period = 'October') {
  assertRm(scope);
  const regionalScope = await getRegionalScope(scope);

  const { rows: managerForecastList } = await db.execute<any>(sql`
    SELECT mf.*, e.display_name AS manager_name
      FROM manager_forecasts mf
      JOIN employees e ON e.id = mf.manager_employee_id
     WHERE mf.manager_employee_id IN (${inList(regionalScope.managers.map((m: any) => m.id))})
     ORDER BY mf.created_at DESC
  `);

  const bottomUpSum = managerForecastList.reduce((sum: number, f: any) => sum + Number(f.adjusted_revenue), 0);

  const { rows: regionalForecastList } = await db.execute<any>(sql`
    SELECT * FROM regional_forecasts
     WHERE region_id = ${regionalScope.regionId} AND period_label = ${period}
     ORDER BY version DESC LIMIT 1
  `);

  const activeSubmission = regionalForecastList[0] || null;

  return {
    regionName: regionalScope.regionName,
    periodLabel: period,
    bottomUpSum,
    managerSubmissions: managerForecastList.map((f: any) => ({
      id: f.id,
      managerId: f.manager_employee_id,
      managerName: f.manager_name,
      periodLabel: f.period_label,
      adjustedRevenue: Number(f.adjusted_revenue),
      status: f.status,
      submittedAt: f.submitted_at,
    })),
    activeSubmission: activeSubmission
      ? {
          id: activeSubmission.id,
          bottomUpRevenue: Number(activeSubmission.bottom_up_revenue),
          regionalAdjustment: Number(activeSubmission.regional_adjustment),
          adjustedRevenue: Number(activeSubmission.adjusted_revenue),
          status: activeSubmission.status,
          regionalAssumptions: activeSubmission.regional_assumptions,
          topRegionalRisks: activeSubmission.top_regional_risks,
          submittedAt: activeSubmission.submitted_at,
        }
      : null,
  };
}

export async function submitRegionalForecast(scope: Scope, input: SubmitRegionalForecastInput) {
  assertRm(scope);
  const regionalScope = await getRegionalScope(scope);

  const { rows: acceptedForecasts } = await db.execute<any>(sql`
    SELECT adjusted_revenue FROM manager_forecasts WHERE id IN (${inList(input.acceptedManagerForecastIds)})
  `);
  const bottomUpRevenue = acceptedForecasts.reduce((sum: number, f: any) => sum + Number(f.adjusted_revenue), 0);
  const adjustedRevenue = bottomUpRevenue + input.regionalAdjustment;
  const forecastId = id('RF');
  const status = input.submitToNm ? 'submitted_to_nm' : 'draft';

  const [row] = await db.insert(regionalForecasts).values({
    id: forecastId,
    rmEmployeeId: scope.employeeId,
    regionId: regionalScope.regionId,
    periodLabel: input.periodLabel,
    bottomUpRevenue: String(bottomUpRevenue),
    regionalAdjustment: String(input.regionalAdjustment),
    adjustedRevenue: String(adjustedRevenue),
    currency: 'INR',
    acceptedManagerForecastIds: input.acceptedManagerForecastIds,
    topRegionalRisks: input.topRegionalRisks,
    regionalAssumptions: input.regionalAssumptions,
    status,
    submittedAt: status === 'submitted_to_nm' ? sql`now()` : null,
    version: 1,
  }).returning();
  return row;
}

// ─── RM-08: Regional Escalations & Exceptions ───

export async function listRegionalEscalations(scope: Scope) {
  assertRm(scope);
  const regionalScope = await getRegionalScope(scope);

  const { rows: commercialRows } = await db.execute<any>(sql`
    SELECT ce.id, 'commercial_exception' AS source_type,
           ce.exception_type || ' (' || ce.requested_terms || ')' AS title,
           'high' AS severity,
           ce.business_justification AS detail,
           ce.requested_by_employee_id AS accountable_manager_employee_id,
           e.display_name AS accountable_manager_name,
           ce.status,
           ce.created_at
      FROM commercial_exceptions ce
      JOIN employees e ON e.id = ce.requested_by_employee_id
     WHERE ce.status = 'escalated_to_rm'
  `);

  const { rows: regRows } = await db.execute<any>(sql`
    SELECT re.*, e.display_name AS accountable_manager_name
      FROM regional_escalations re
 LEFT JOIN employees e ON e.id = re.accountable_manager_employee_id
     WHERE (re.region_id = ${regionalScope.regionId} OR re.region_id IS NULL)
     ORDER BY re.created_at DESC
  `);

  return [...regRows, ...commercialRows];
}

export async function createRegionalEscalation(scope: Scope, input: CreateRegionalEscalationInput) {
  assertRm(scope);
  const regionalScope = await getRegionalScope(scope);
  const escalationId = id('ESC');

  const [row] = await db.insert(regionalEscalations).values({
    id: escalationId,
    rmEmployeeId: scope.employeeId,
    regionId: regionalScope.regionId,
    sourceType: input.sourceType,
    sourceId: input.sourceId || null,
    title: input.title,
    severity: input.severity,
    accountableManagerEmployeeId: input.accountableManagerEmployeeId || null,
    detail: input.detail,
    deadline: input.deadline ? new Date(input.deadline).toISOString() : null,
    status: 'open',
  }).returning();
  return row;
}

export async function resolveRegionalEscalation(scope: Scope, input: ResolveRegionalEscalationInput) {
  assertRm(scope);
  const [updated] = await db.update(regionalEscalations)
    .set({
      status: input.decision,
      recoveryDecision: input.recoveryDecision,
      resolvedAt: input.decision === 'resolved' ? sql`now()` : null,
      deadline: input.deadline ? new Date(input.deadline).toISOString() : undefined,
    })
    .where(eq(regionalEscalations.id, input.escalationId))
    .returning();

  if (input.escalationId.startsWith('CE-')) {
    await db.update(commercialExceptions)
      .set({
        status: input.decision === 'resolved' ? 'approved' : 'rejected',
        decisionNotes: input.recoveryDecision,
        decidedAt: sql`now()`,
      })
      .where(eq(commercialExceptions.id, input.escalationId));
  }

  return updated;
}

// ─── RM-09: Manager Performance Reviews ───

export async function listManagerReviews(scope: Scope, managerId?: string) {
  assertRm(scope);
  const { rows } = await db.execute<any>(sql`
    SELECT mr.*, e.display_name AS manager_name
      FROM manager_reviews mr
      JOIN employees e ON e.id = mr.manager_employee_id
     WHERE mr.rm_employee_id = ${scope.employeeId}
       ${managerId ? sql`AND mr.manager_employee_id = ${managerId}` : sql``}
     ORDER BY mr.created_at DESC
  `);
  return rows;
}

export async function saveManagerReview(scope: Scope, input: SaveManagerReviewInput) {
  assertRm(scope);
  const reviewId = id('MRV');

  const [row] = await db.insert(managerReviews).values({
    id: reviewId,
    rmEmployeeId: scope.employeeId,
    managerEmployeeId: input.managerEmployeeId,
    periodLabel: input.periodLabel,
    performanceRating: input.performanceRating,
    strengths: input.strengths,
    blockers: input.blockers,
    improvementCommitments: input.improvementCommitments,
    supportActions: input.supportActions || null,
    privateRmNotes: input.privateRmNotes || null,
    nextReviewDate: input.nextReviewDate,
    acknowledged: input.acknowledged,
  }).returning();
  return row;
}

// ─── RM-10: Regional Review Packs & Schedules ───

export async function previewRegionalReportPack(scope: Scope, period = 'October 2026') {
  assertRm(scope);
  const overview = await getRegionalOverview(scope, 'month-to-date');
  const forecast = await getRegionalForecastRollup(scope, 'October');
  const escalations = await listRegionalEscalations(scope);

  return {
    title: 'Regional Performance & Governance Review Pack',
    period,
    generatedAt: new Date().toISOString(),
    owner: scope.displayName,
    scope: overview.region,
    targetSummary: overview.target,
    managers: overview.managers,
    forecastSummary: {
      bottomUpSum: forecast.bottomUpSum,
      regionalAdjustment: forecast.activeSubmission?.regionalAdjustment ?? 0,
      adjustedRevenue: forecast.activeSubmission?.adjustedRevenue ?? forecast.bottomUpSum,
      status: forecast.activeSubmission?.status ?? 'draft',
    },
    riskRegister: escalations.slice(0, 5),
  };
}

export async function generateRegionalReportPdf(scope: Scope, input: GenerateRegionalPdfPackInput): Promise<string> {
  assertRm(scope);
  mkdirSync(EXPORT_ROOT, { recursive: true });

  const fileName = `Regional_Review_Pack_${Date.now()}.pdf`;
  const filePath = resolve(EXPORT_ROOT, fileName);
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  const writeStream = createWriteStream(filePath);

  const preview = await previewRegionalReportPack(scope, input.period);

  return new Promise((resolvePromise, rejectPromise) => {
    writeStream.on('finish', () => resolvePromise(filePath));
    writeStream.on('error', rejectPromise);

    doc.pipe(writeStream);

    doc.rect(40, 40, 515, 60).fill('#113F3D');
    doc.fillColor('#FFFFFF').fontSize(18).text('FINVERSE WEALTH MANAGEMENT', 55, 52);
    doc.fontSize(12).fillColor('#DCEEEA').text('Regional Executive Performance & Governance Pack', 55, 75);

    doc.moveDown(4);
    doc.fillColor('#1B1F1E').fontSize(14).text(`Period: ${input.period}`, { underline: true });
    doc.fontSize(10).fillColor('#6B7280').text(`Region: ${preview.scope.name} | Generated By: ${scope.displayName} | Date: ${new Date().toLocaleDateString('en-IN')}`);
    doc.moveDown(1.5);

    doc.fillColor('#113F3D').fontSize(12).text('1. Regional Attainment & Target Pace', { underline: true });
    doc.moveDown(0.5);
    doc.fillColor('#1B1F1E').fontSize(10)
      .text(`Parent NM Target: ${preview.targetSummary.parentTarget} wins`)
      .text(`Achieved Wins: ${preview.targetSummary.achievedWins} wins (${preview.targetSummary.attainmentPercent}% attainment)`)
      .text(`Unallocated Remainder: ${preview.targetSummary.unallocatedRemainder} wins`);
    doc.moveDown(1.5);

    doc.fillColor('#113F3D').fontSize(12).text('2. Manager Contributions & Status', { underline: true });
    doc.moveDown(0.5);
    preview.managers.forEach((m: any) => {
      doc.fillColor('#1B1F1E').fontSize(10).text(`• ${m.name} (${m.teams.join(', ')}): Target ${m.allocatedTarget} | Wins ${m.achievedWins} (${m.targetPace}%) | Open Interventions: ${m.openInterventions} | Status: ${m.status.toUpperCase()}`);
    });
    doc.moveDown(1.5);

    doc.fillColor('#113F3D').fontSize(12).text('3. Regional Forecast Rollup', { underline: true });
    doc.moveDown(0.5);
    doc.fillColor('#1B1F1E').fontSize(10)
      .text(`Bottom-Up Total: INR ${preview.forecastSummary.bottomUpSum.toLocaleString('en-IN')}`)
      .text(`Regional Management Adjustment: INR ${preview.forecastSummary.regionalAdjustment.toLocaleString('en-IN')}`)
      .text(`Net Regional Forecast: INR ${preview.forecastSummary.adjustedRevenue.toLocaleString('en-IN')} (Status: ${preview.forecastSummary.status.toUpperCase()})`);
    doc.moveDown(1.5);

    doc.fillColor('#113F3D').fontSize(12).text('4. Governance & Risk Register', { underline: true });
    doc.moveDown(0.5);
    if (preview.riskRegister.length === 0) {
      doc.fillColor('#6B7280').fontSize(10).text('No open high-severity regional escalations.');
    } else {
      preview.riskRegister.forEach((r: any) => {
        doc.fillColor('#1B1F1E').fontSize(10).text(`• [${r.severity?.toUpperCase()}] ${r.title} — Accountable: ${r.accountable_manager_name || 'Unassigned'} (Status: ${r.status})`);
      });
    }

    doc.end();
  });
}

export async function listRegionalReportSchedules(scope: Scope) {
  assertRm(scope);
  const { rows } = await db.execute<any>(sql`
    SELECT * FROM regional_report_schedules
     WHERE rm_employee_id = ${scope.employeeId}
     ORDER BY created_at DESC
  `);
  return rows;
}

export async function saveRegionalReportSchedule(scope: Scope, input: SaveRegionalReportScheduleInput) {
  assertRm(scope);
  const regionalScope = await getRegionalScope(scope);
  const scheduleId = input.id || id('RRS');

  const [row] = await db.insert(regionalReportSchedules)
    .values({
      id: scheduleId,
      rmEmployeeId: scope.employeeId,
      regionId: regionalScope.regionId,
      name: input.name,
      periodType: input.periodType,
      cadence: input.cadence,
      recipients: input.recipients,
      sections: input.sections,
      status: input.status,
    })
    .onConflictDoUpdate({
      target: regionalReportSchedules.id,
      set: {
        name: input.name,
        periodType: input.periodType,
        cadence: input.cadence,
        recipients: input.recipients,
        sections: input.sections,
        status: input.status,
      },
    })
    .returning();
  return row;
}
