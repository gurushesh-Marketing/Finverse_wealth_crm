import { createWriteStream, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import PDFDocument from 'pdfkit';
import { pool } from './db';
import type { Scope } from './users';
import { forbidden, notFound, HttpError } from '../lib/errors';
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

export function assertRm(scope: Scope): void {
  if (scope.role !== 'RM') {
    throw forbidden('Regional Manager workspace only.');
  }
}

// ─── Scope queries ───

export async function getRegionalScope(scope: Scope) {
  assertRm(scope);
  // Resolve region assigned to teams in scope
  const { rows: teamRows } = await pool.query(
    `SELECT t.id, t.name, t.vertical, COALESCE(t.region_id, 'REGION-SOUTH') as region_id,
            COALESCE(r.name, 'South Region') as region_name
       FROM teams t
  LEFT JOIN regions r ON r.id = t.region_id
      WHERE t.id = ANY($1)
      ORDER BY t.name`,
    [scope.teams]
  );

  const regionId = teamRows[0]?.region_id || (scope.verticals.includes('banking') ? 'REGION-BANKING-WEST' : scope.verticals.includes('markets') ? 'REGION-MARKETS-WEST' : scope.verticals.includes('real_estate') ? 'REGION-REALESTATE-WEST' : 'REGION-SOUTH');
  const regionName = teamRows[0]?.region_name || (scope.verticals.includes('banking') ? 'Commercial Banking West Zone' : scope.verticals.includes('markets') ? 'Markets & Securities West Zone' : scope.verticals.includes('real_estate') ? 'Real Estate Advisory West Zone' : 'South Region');

  // Managers in scope: employees with MG assignment on in-scope teams
  const { rows: managerRows } = await pool.query(
    `SELECT DISTINCT e.id, e.display_name, e.email,
            array_remove(array_agg(DISTINCT t.name), NULL) AS team_names,
            array_remove(array_agg(DISTINCT t.id), NULL) AS team_ids
       FROM assignments a
       JOIN employees e ON e.id = a.employee_id
       JOIN teams t ON t.id = a.team_id
      WHERE a.team_id = ANY($1) AND a.role = 'MG'
        AND a.effective_from <= now()
        AND (a.effective_to IS NULL OR a.effective_to > now())
      GROUP BY e.id, e.display_name, e.email
      ORDER BY e.display_name`,
    [scope.teams]
  );

  // TLs in scope
  const { rows: tlRows } = await pool.query(
    `SELECT DISTINCT e.id, e.display_name, e.email
       FROM assignments a
       JOIN employees e ON e.id = a.employee_id
      WHERE a.team_id = ANY($1) AND a.role = 'TL'
        AND a.effective_from <= now()
        AND (a.effective_to IS NULL OR a.effective_to > now())`,
    [scope.teams]
  );

  // Associates in scope
  const { rows: associateRows } = await pool.query(
    `SELECT DISTINCT e.id, e.display_name, e.email
       FROM assignments a
       JOIN employees e ON e.id = a.employee_id
      WHERE a.team_id = ANY($1) AND a.role = 'SC'
        AND a.effective_from <= now()
        AND (a.effective_to IS NULL OR a.effective_to > now())`,
    [scope.teams]
  );

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

  // 1. Regional targets & achieved wins
  const { rows: targetRows } = await pool.query(
    `SELECT approved_nm_target, unallocated_remainder, status
       FROM regional_targets
      WHERE region_id = $1
      ORDER BY version DESC LIMIT 1`,
    [regionalScope.regionId]
  );
  const parentTarget = targetRows[0] ? Number(targetRows[0].approved_nm_target) : 250;
  const unallocatedRemainder = targetRows[0] ? Number(targetRows[0].unallocated_remainder) : 0;

  // Actual wins (leads converted/disbursed in in-scope teams)
  const { rows: winRows } = await pool.query(
    `SELECT count(*)::int AS count
       FROM leads
      WHERE team_id = ANY($1) AND stage IN ('converted', 'disbursal', 'active-funded', 'registration')`,
    [scope.teams]
  );
  const achievedWins = winRows[0]?.count ?? 0;
  const attainmentPercent = parentTarget > 0 ? Math.round((achievedWins / parentTarget) * 100) : 0;

  // 2. Manager contributions
  const managersWithMetrics = await Promise.all(
    regionalScope.managers.map(async (mgr) => {
      const { rows: mgrTargetRows } = await pool.query(
        `SELECT approved_parent_target
           FROM manager_targets
          WHERE manager_employee_id = $1
          ORDER BY version DESC LIMIT 1`,
        [mgr.id]
      );
      const allocatedTarget = mgrTargetRows[0] ? Number(mgrTargetRows[0].approved_parent_target) : 120;

      const { rows: mgrWins } = await pool.query(
        `SELECT count(*)::int AS wins,
                count(*) FILTER (WHERE stage IN ('new', 'not-contacted', 'contacted', 'follow-up', 'qualified', 'eligibility', 'documents', 'sanction', 'kyc', 'risk-profile', 'demat-opened', 'requirement', 'site-visit', 'booking'))::int AS open_leads
           FROM leads
          WHERE team_id = ANY($1)`,
        [mgr.team_ids]
      );
      const wins = mgrWins[0]?.wins ?? 0;
      const openLeads = mgrWins[0]?.open_leads ?? 0;
      const targetPace = allocatedTarget > 0 ? Math.round((wins / allocatedTarget) * 100) : 0;

      // Breaches & Actions
      const { rows: actionRows } = await pool.query(
        `SELECT count(*)::int AS open_actions
           FROM regional_management_actions
          WHERE subject_manager_employee_id = $1 AND status = 'open'`,
        [mgr.id]
      );

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

  // 3. Source mix across region
  const { rows: sourceRows } = await pool.query(
    `SELECT source,
            count(*)::int AS total_leads,
            count(*) FILTER (WHERE stage IN ('converted', 'disbursal', 'active-funded'))::int AS converted_leads
       FROM leads
      WHERE team_id = ANY($1)
      GROUP BY source
      ORDER BY total_leads DESC`,
    [scope.teams]
  );
  const sourceMix = sourceRows.map((r) => ({
    source: r.source,
    totalLeads: r.total_leads,
    convertedLeads: r.converted_leads,
    conversionRate: r.total_leads > 0 ? Math.round((r.converted_leads / r.total_leads) * 100) : 0,
  }));

  // 4. Queue ageing & regional backlog
  const { rows: backlogRows } = await pool.query(
    `SELECT count(*) FILTER (WHERE stage IN ('new', 'not-contacted'))::int AS uncontacted,
            count(*) FILTER (WHERE stage = 'follow-up')::int AS in_follow_up,
            count(*) FILTER (WHERE created_at < now() - interval '48 hours' AND stage NOT IN ('converted', 'disbursal', 'active-funded', 'lost'))::int AS older_than_48h,
            count(*) FILTER (WHERE created_at < now() - interval '7 days' AND stage NOT IN ('converted', 'disbursal', 'active-funded', 'lost'))::int AS older_than_7d
       FROM leads
      WHERE team_id = ANY($1)`,
    [scope.teams]
  );
  const backlog = {
    uncontacted: backlogRows[0]?.uncontacted ?? 0,
    inFollowUp: backlogRows[0]?.in_follow_up ?? 0,
    olderThan48h: backlogRows[0]?.older_than_48h ?? 0,
    olderThan7d: backlogRows[0]?.older_than_7d ?? 0,
  };

  // 5. Open regional escalations
  const { rows: escalationRows } = await pool.query(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE severity IN ('high', 'critical'))::int AS high_critical
       FROM regional_escalations
      WHERE (region_id = $1 OR region_id IS NULL) AND status IN ('open', 'recovery_plan_assigned')`,
    [regionalScope.regionId]
  );

  return {
    region: {
      id: regionalScope.regionId,
      name: regionalScope.regionName,
      vertical: regionalScope.teams[0]?.vertical || (scope.verticals[0] ?? 'wealth'),
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

  const { rows } = await pool.query(
    `INSERT INTO regional_management_actions (
       id, rm_employee_id, source_action, kind, subject_manager_employee_id,
       owner_employee_id, region_id, metric_key, period_label, title, detail, due_at, status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'open')
     RETURNING *`,
    [
      actionId,
      scope.employeeId,
      input.sourceAction,
      input.kind,
      input.subjectManagerEmployeeId,
      input.ownerEmployeeId,
      input.regionId || regionalScope.regionId,
      input.metricKey || null,
      input.periodLabel || 'October',
      input.title,
      input.detail || null,
      input.dueAt,
    ]
  );
  return rows[0];
}

export async function listRegionalActions(scope: Scope, managerId?: string) {
  assertRm(scope);
  const query = managerId
    ? `SELECT a.*, e.display_name as manager_name, o.display_name as owner_name
         FROM regional_management_actions a
         JOIN employees e ON e.id = a.subject_manager_employee_id
         JOIN employees o ON o.id = a.owner_employee_id
        WHERE a.rm_employee_id = $1 AND a.subject_manager_employee_id = $2
        ORDER BY a.due_at ASC`
    : `SELECT a.*, e.display_name as manager_name, o.display_name as owner_name
         FROM regional_management_actions a
         JOIN employees e ON e.id = a.subject_manager_employee_id
         JOIN employees o ON o.id = a.owner_employee_id
        WHERE a.rm_employee_id = $1
        ORDER BY a.due_at ASC`;

  const params = managerId ? [scope.employeeId, managerId] : [scope.employeeId];
  const { rows } = await pool.query(query, params);
  return rows;
}

// ─── RM-02: Manager Scorecard ───

export async function getManagerScorecard(scope: Scope, managerId: string, period = 'September') {
  assertRm(scope);
  // Verify manager is in scope
  const { rows: mgrRows } = await pool.query(
    `SELECT e.id, e.display_name, e.email,
            array_remove(array_agg(DISTINCT t.name), NULL) AS team_names,
            array_remove(array_agg(DISTINCT t.id), NULL) AS team_ids
       FROM assignments a
       JOIN employees e ON e.id = a.employee_id
       JOIN teams t ON t.id = a.team_id
      WHERE e.id = $1 AND a.team_id = ANY($2) AND a.role = 'MG'
      GROUP BY e.id, e.display_name, e.email`,
    [managerId, scope.teams]
  );

  if (!mgrRows[0]) {
    throw notFound();
  }
  const manager = mgrRows[0];

  // TLs supervised by this manager
  const { rows: tlRows } = await pool.query(
    `SELECT DISTINCT e.id, e.display_name, e.email, t.name as team_name
       FROM assignments a
       JOIN employees e ON e.id = a.employee_id
       JOIN teams t ON t.id = a.team_id
      WHERE a.team_id = ANY($1) AND a.role = 'TL'`,
    [manager.team_ids]
  );

  // Attainment
  const { rows: targetRows } = await pool.query(
    `SELECT approved_parent_target, unallocated_remainder, version, status
       FROM manager_targets
      WHERE manager_employee_id = $1
      ORDER BY version DESC LIMIT 1`,
    [managerId]
  );
  const target = targetRows[0] ? Number(targetRows[0].approved_parent_target) : 100;

  const { rows: leadMetrics } = await pool.query(
    `SELECT count(*) FILTER (WHERE stage IN ('converted', 'disbursal'))::int AS wins,
            count(*) FILTER (WHERE stage IN ('new', 'not-contacted', 'contacted', 'follow-up', 'qualified', 'eligibility', 'documents', 'sanction'))::int AS open_pipeline,
            count(*)::int AS total_leads
       FROM leads
      WHERE team_id = ANY($1)`,
    [manager.team_ids]
  );
  const wins = leadMetrics[0]?.wins ?? 0;
  const attainmentRate = target > 0 ? Math.round((wins / target) * 100) : 0;

  // Forecast accuracy & latest submission
  const { rows: forecastRows } = await pool.query(
    `SELECT id, period_label, bottom_up_revenue, management_adjustment, adjusted_revenue, status, submitted_at
       FROM manager_forecasts
      WHERE manager_employee_id = $1
      ORDER BY created_at DESC LIMIT 1`,
    [managerId]
  );

  // Actions & reviews
  const actions = await listRegionalActions(scope, managerId);
  const { rows: reviewRows } = await pool.query(
    `SELECT * FROM manager_reviews
      WHERE manager_employee_id = $1
      ORDER BY created_at DESC`,
    [managerId]
  );

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

  // Current lead distribution and queue load by team
  const { rows: teamStats } = await pool.query(
    `SELECT t.id, t.name,
            count(l.id)::int AS total_leads,
            count(l.id) FILTER (WHERE l.stage IN ('new', 'not-contacted'))::int AS pending_intake,
            count(DISTINCT a.employee_id)::int AS caller_count
       FROM teams t
  LEFT JOIN leads l ON l.team_id = t.id
  LEFT JOIN assignments a ON a.team_id = t.id AND a.role = 'SC'
      WHERE t.id = ANY($1)
      GROUP BY t.id, t.name
      ORDER BY t.name`,
    [scope.teams]
  );

  const { rows: plans } = await pool.query(
    `SELECT * FROM territory_coverage_plans
      WHERE region_id = $1
      ORDER BY version DESC, created_at DESC`,
    [regionalScope.regionId]
  );

  return {
    regionName: regionalScope.regionName,
    subRegions: regionalScope.teams[0]?.vertical === 'banking'
      ? ['Mumbai Commercial Hub', 'Gujarat Industrial Zone', 'Pune SME Belt']
      : ['Karnataka South Hub', 'Tamil Nadu Metro Zone', 'Kerala Coastal Belt'],
    languageQueues: ['English', 'Hindi', 'Kannada', 'Tamil', 'Telugu'],
    teamStats: teamStats.map((t) => ({
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

  const { rows } = await pool.query(
    `INSERT INTO territory_coverage_plans (
       id, rm_employee_id, region_id, territory_name, sub_region, product_scope,
       language_queues, target_team_ids, capacity_gap, routing_proposal, activation_date, status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (id) DO UPDATE SET
       territory_name = EXCLUDED.territory_name,
       sub_region = EXCLUDED.sub_region,
       product_scope = EXCLUDED.product_scope,
       language_queues = EXCLUDED.language_queues,
       target_team_ids = EXCLUDED.target_team_ids,
       capacity_gap = EXCLUDED.capacity_gap,
       routing_proposal = EXCLUDED.routing_proposal,
       activation_date = EXCLUDED.activation_date,
       status = EXCLUDED.status,
       version = territory_coverage_plans.version + 1
     RETURNING *`,
    [
      planId,
      scope.employeeId,
      regionalScope.regionId,
      input.territoryName,
      input.subRegion,
      input.productScope,
      JSON.stringify(input.languageQueues),
      JSON.stringify(input.targetTeamIds),
      input.capacityGap,
      input.routingProposal,
      input.activationDate,
      input.status,
    ]
  );
  return rows[0];
}

// ─── RM-04: Regional Target Allocation ───

export async function getRegionalTargets(scope: Scope) {
  assertRm(scope);
  const regionalScope = await getRegionalScope(scope);

  const { rows: targets } = await pool.query(
    `SELECT * FROM regional_targets
      WHERE region_id = $1
      ORDER BY version DESC, created_at DESC`,
    [regionalScope.regionId]
  );

  // Active target
  const activeTarget = targets[0] || {
    id: 'RT-OCT-2026',
    approved_nm_target: 250,
    unallocated_remainder: 0,
    period_label: 'October',
    status: 'draft',
    version: 1,
  };

  // Manager target allocations under this regional target
  const { rows: managerAllocations } = await pool.query(
    `SELECT mt.*, e.display_name as manager_name
       FROM manager_targets mt
       JOIN employees e ON e.id = mt.manager_employee_id
      WHERE mt.manager_employee_id = ANY($1)
      ORDER BY mt.version DESC`,
    [regionalScope.managers.map((m) => m.id)]
  );

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
    managers: regionalScope.managers.map((m) => {
      const alloc = managerAllocations.find((a) => a.manager_employee_id === m.id);
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
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const totalAllocated = input.managerAllocations.reduce((sum, m) => sum + m.targetWins, 0);
    if (totalAllocated > input.approvedNmTarget) {
      throw new HttpError(400, 'VALIDATION_FAILED', `Total manager allocations (${totalAllocated}) exceed approved NM target (${input.approvedNmTarget}).`);
    }

    const unallocatedRemainder = input.approvedNmTarget - totalAllocated;
    const targetStatus = input.publish ? 'published' : 'draft';
    const targetId = id('RT');

    // 1. Record Regional Target
    const { rows: regionalTargetRows } = await client.query(
      `INSERT INTO regional_targets (
         id, rm_employee_id, region_id, period_label, metric, approved_nm_target, unallocated_remainder, status, version
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)
       ON CONFLICT (region_id, period_label, metric, version) DO UPDATE SET
         approved_nm_target = EXCLUDED.approved_nm_target,
         unallocated_remainder = EXCLUDED.unallocated_remainder,
         status = EXCLUDED.status
       RETURNING *`,
      [
        targetId,
        scope.employeeId,
        regionalScope.regionId,
        input.periodLabel,
        input.metric || 'approved-wins',
        input.approvedNmTarget,
        unallocatedRemainder,
        targetStatus,
      ]
    );

    // 2. Cascade down to manager_targets
    for (const alloc of input.managerAllocations) {
      const mgrTargetId = id('MGT');
      await client.query(
        `INSERT INTO manager_targets (
           id, manager_employee_id, period_label, metric, approved_parent_target, unallocated_remainder, status, version
         ) VALUES ($1, $2, $3, $4, $5, 0, $6, 1)
         ON CONFLICT (manager_employee_id, period_label, metric, version) DO UPDATE SET
           approved_parent_target = EXCLUDED.approved_parent_target,
           status = EXCLUDED.status`,
        [
          mgrTargetId,
          alloc.managerEmployeeId,
          input.periodLabel,
          input.metric || 'approved-wins',
          alloc.targetWins,
          targetStatus,
        ]
      );
    }

    await client.query('COMMIT');
    return regionalTargetRows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── RM-05: Cross-Manager Lead Transfers ───

export async function listCrossManagerTransfers(scope: Scope) {
  assertRm(scope);
  const { rows } = await pool.query(
    `SELECT t.*,
            sm.display_name AS source_manager_name,
            dm.display_name AS destination_manager_name,
            st.name AS source_team_name,
            dt.name AS destination_team_name
       FROM cross_manager_transfers t
       JOIN employees sm ON sm.id = t.source_manager_employee_id
       JOIN employees dm ON dm.id = t.destination_manager_employee_id
       JOIN teams st ON st.id = t.source_team_id
       JOIN teams dt ON dt.id = t.destination_team_id
      WHERE t.rm_employee_id = $1
      ORDER BY t.created_at DESC`,
    [scope.employeeId]
  );
  return rows;
}

export async function createCrossManagerTransfer(scope: Scope, input: CreateCrossManagerTransferInput) {
  assertRm(scope);
  // Enforce organizational branch scope: source and destination teams must be within RM's scope
  if (!scope.teams.includes(input.sourceTeamId) || !scope.teams.includes(input.destinationTeamId)) {
    throw forbidden('Source and destination teams must be within authorized regional scope.');
  }

  // Enforce lead scope: all leads must belong to sourceTeamId and be within scope
  const { rows: leadRows } = await pool.query(
    `SELECT id, team_id FROM leads WHERE id = ANY($1)`,
    [input.leadIds]
  );
  if (leadRows.length !== input.leadIds.length || leadRows.some((l) => l.team_id !== input.sourceTeamId)) {
    throw forbidden('Transferred leads must belong to authorized source team.');
  }

  const transferId = id('CMT');

  const { rows } = await pool.query(
    `INSERT INTO cross_manager_transfers (
       id, rm_employee_id, source_manager_employee_id, destination_manager_employee_id,
       source_team_id, destination_team_id, lead_ids, reason, forecast_impact_notes, status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
     RETURNING *`,
    [
      transferId,
      scope.employeeId,
      input.sourceManagerEmployeeId,
      input.destinationManagerEmployeeId,
      input.sourceTeamId,
      input.destinationTeamId,
      JSON.stringify(input.leadIds),
      input.reason,
      input.forecastImpactNotes || null,
    ]
  );
  return rows[0];
}

export async function decideCrossManagerTransfer(scope: Scope, input: DecideCrossManagerTransferInput) {
  assertRm(scope);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT * FROM cross_manager_transfers WHERE id = $1 FOR UPDATE`,
      [input.transferId]
    );
    if (!rows[0]) throw notFound();
    const transfer = rows[0];

    // Atomic transition guard: only pending transfers can be decided
    if (transfer.status !== 'pending') {
      throw new HttpError(400, 'VALIDATION_FAILED', 'Transfer request has already been decided.', {
        fieldErrors: { status: ['ALREADY_DECIDED'] },
      });
    }

    // Verify regional scope
    if (!scope.teams.includes(transfer.source_team_id) || !scope.teams.includes(transfer.destination_team_id)) {
      throw forbidden('Transfer is outside authorized regional scope.');
    }

    await client.query(
      `UPDATE cross_manager_transfers
          SET status = $1, decided_at = now()
        WHERE id = $2`,
      [input.decision, input.transferId]
    );

    // If approved, atomically transfer the leads to the destination team
    if (input.decision === 'approved') {
      const leadIds: string[] = typeof transfer.lead_ids === 'string'
        ? JSON.parse(transfer.lead_ids)
        : transfer.lead_ids;

      if (leadIds.length > 0) {
        await client.query(
          `UPDATE leads
              SET team_id = $1, updated_at = now(), record_version = record_version + 1
            WHERE id = ANY($2)`,
          [transfer.destination_team_id, leadIds]
        );

        for (const leadId of leadIds) {
          const eventId = id('EV');
          await client.query(
            `INSERT INTO lead_events (id, lead_id, actor_employee_id, kind, note)
             VALUES ($1, $2, $3, 'cross-manager-transfer', $4)`,
            [
              eventId,
              leadId,
              scope.employeeId,
              `Cross-manager transfer approved by RM ${scope.displayName}: transferred to team ${transfer.destination_team_id}. Notes: ${input.resolutionNotes}`,
            ]
          );
        }
      }
    }

    await client.query('COMMIT');
    return { ...transfer, status: input.decision, resolutionNotes: input.resolutionNotes };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── RM-06: Regional Staffing Plans ───

export async function getRegionalCapacity(scope: Scope) {
  assertRm(scope);
  const regionalScope = await getRegionalScope(scope);

  const { rows: teamCapacities } = await pool.query(
    `SELECT t.id, t.name,
            count(DISTINCT a.employee_id)::int AS active_callers,
            count(l.id) FILTER (WHERE l.stage IN ('new', 'not-contacted', 'contacted', 'follow-up', 'qualified', 'eligibility', 'documents', 'sanction'))::int AS open_leads
       FROM teams t
  LEFT JOIN assignments a ON a.team_id = t.id AND a.role = 'SC' AND (a.effective_to IS NULL OR a.effective_to > now())
  LEFT JOIN leads l ON l.team_id = t.id
      WHERE t.id = ANY($1)
      GROUP BY t.id, t.name`,
    [scope.teams]
  );

  const { rows: plans } = await pool.query(
    `SELECT * FROM regional_staffing_plans
      WHERE region_id = $1
      ORDER BY version DESC, created_at DESC`,
    [regionalScope.regionId]
  );

  const totalCallers = teamCapacities.reduce((sum, t) => sum + t.active_callers, 0);
  const totalOpenLeads = teamCapacities.reduce((sum, t) => sum + t.open_leads, 0);

  return {
    totalCallers,
    totalOpenLeads,
    teams: teamCapacities.map((t) => ({
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

  const { rows } = await pool.query(
    `INSERT INTO regional_staffing_plans (
       id, rm_employee_id, region_id, period_label, planned_headcount, approved_headcount,
       active_headcount, requisitions, business_justification, status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (id) DO UPDATE SET
       planned_headcount = EXCLUDED.planned_headcount,
       approved_headcount = EXCLUDED.approved_headcount,
       active_headcount = EXCLUDED.active_headcount,
       requisitions = EXCLUDED.requisitions,
       business_justification = EXCLUDED.business_justification,
       status = EXCLUDED.status,
       version = regional_staffing_plans.version + 1,
       decided_at = CASE WHEN EXCLUDED.status IN ('approved_by_rm', 'submitted_to_hr') THEN now() ELSE NULL END
     RETURNING *`,
    [
      planId,
      scope.employeeId,
      regionalScope.regionId,
      input.periodLabel,
      input.plannedHeadcount,
      input.approvedHeadcount,
      input.activeHeadcount,
      JSON.stringify(input.requisitions),
      input.businessJustification,
      input.status,
    ]
  );
  return rows[0];
}

// ─── RM-07: Regional Forecast Rollup & Submission ───

export async function getRegionalForecastRollup(scope: Scope, period = 'October') {
  assertRm(scope);
  const regionalScope = await getRegionalScope(scope);

  // Accepted manager forecasts
  const { rows: managerForecasts } = await pool.query(
    `SELECT mf.*, e.display_name AS manager_name
       FROM manager_forecasts mf
       JOIN employees e ON e.id = mf.manager_employee_id
      WHERE mf.manager_employee_id = ANY($1)
      ORDER BY mf.created_at DESC`,
    [regionalScope.managers.map((m) => m.id)]
  );

  const bottomUpSum = managerForecasts.reduce((sum, f) => sum + Number(f.adjusted_revenue), 0);

  // Existing regional forecast submission
  const { rows: regionalForecasts } = await pool.query(
    `SELECT * FROM regional_forecasts
      WHERE region_id = $1 AND period_label = $2
      ORDER BY version DESC LIMIT 1`,
    [regionalScope.regionId, period]
  );

  const activeSubmission = regionalForecasts[0] || null;

  return {
    regionName: regionalScope.regionName,
    periodLabel: period,
    bottomUpSum,
    managerSubmissions: managerForecasts.map((f) => ({
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

  // Calculate bottom up revenue from accepted manager forecasts
  const { rows: acceptedForecasts } = await pool.query(
    `SELECT adjusted_revenue FROM manager_forecasts WHERE id = ANY($1)`,
    [input.acceptedManagerForecastIds]
  );
  const bottomUpRevenue = acceptedForecasts.reduce((sum, f) => sum + Number(f.adjusted_revenue), 0);
  const adjustedRevenue = bottomUpRevenue + input.regionalAdjustment;
  const forecastId = id('RF');
  const status = input.submitToNm ? 'submitted_to_nm' : 'draft';

  const { rows } = await pool.query(
    `INSERT INTO regional_forecasts (
       id, rm_employee_id, region_id, period_label, bottom_up_revenue, regional_adjustment,
       adjusted_revenue, currency, accepted_manager_forecast_ids, top_regional_risks,
       regional_assumptions, status, submitted_at, version
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'INR', $8, $9, $10, $11, CASE WHEN $11 = 'submitted_to_nm' THEN now() ELSE NULL END, 1)
     RETURNING *`,
    [
      forecastId,
      scope.employeeId,
      regionalScope.regionId,
      input.periodLabel,
      bottomUpRevenue,
      input.regionalAdjustment,
      adjustedRevenue,
      JSON.stringify(input.acceptedManagerForecastIds),
      JSON.stringify(input.topRegionalRisks),
      input.regionalAssumptions,
      status,
    ]
  );
  return rows[0];
}

// ─── RM-08: Regional Escalations & Exceptions ───

export async function listRegionalEscalations(scope: Scope) {
  assertRm(scope);
  const regionalScope = await getRegionalScope(scope);

  // 1. Escalated commercial exceptions from MG-09
  const { rows: commercialRows } = await pool.query(
    `SELECT ce.id, 'commercial_exception' AS source_type,
            ce.exception_type || ' (' || ce.requested_terms || ')' AS title,
            'high' AS severity,
            ce.business_justification AS detail,
            ce.requested_by_employee_id AS accountable_manager_employee_id,
            e.display_name AS accountable_manager_name,
            ce.status,
            ce.created_at
       FROM commercial_exceptions ce
       JOIN employees e ON e.id = ce.requested_by_employee_id
      WHERE ce.status = 'escalated_to_rm'`
  );

  // 2. Direct regional escalations
  const { rows: regRows } = await pool.query(
    `SELECT re.*, e.display_name AS accountable_manager_name
       FROM regional_escalations re
  LEFT JOIN employees e ON e.id = re.accountable_manager_employee_id
      WHERE (re.region_id = $1 OR re.region_id IS NULL)
      ORDER BY re.created_at DESC`,
    [regionalScope.regionId]
  );

  return [...regRows, ...commercialRows];
}

export async function createRegionalEscalation(scope: Scope, input: CreateRegionalEscalationInput) {
  assertRm(scope);
  const regionalScope = await getRegionalScope(scope);
  const escalationId = id('ESC');

  const { rows } = await pool.query(
    `INSERT INTO regional_escalations (
       id, rm_employee_id, region_id, source_type, source_id, title, severity,
       accountable_manager_employee_id, detail, deadline, status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'open')
     RETURNING *`,
    [
      escalationId,
      scope.employeeId,
      regionalScope.regionId,
      input.sourceType,
      input.sourceId || null,
      input.title,
      input.severity,
      input.accountableManagerEmployeeId || null,
      input.detail,
      input.deadline ? new Date(input.deadline) : null,
    ]
  );
  return rows[0];
}

export async function resolveRegionalEscalation(scope: Scope, input: ResolveRegionalEscalationInput) {
  assertRm(scope);

  // If this was an escalated commercial exception from MG-09
  if (input.escalationId.startsWith('CE-') || input.escalationId.startsWith('EXC-')) {
    const { rows: ceRows } = await pool.query(
      `UPDATE commercial_exceptions
          SET status = $1, decision_notes = $2, decided_at = now()
        WHERE id = $3
        RETURNING *`,
      [input.decision === 'resolved' ? 'approved' : 'rejected', input.recoveryDecision, input.escalationId]
    );
    if (!ceRows[0]) throw notFound();
    return {
      id: ceRows[0].id,
      status: input.decision,
      recovery_decision: input.recoveryDecision,
      resolved_at: ceRows[0].decided_at,
    };
  }

  const { rows } = await pool.query(
    `UPDATE regional_escalations
        SET status = $1,
            recovery_decision = $2,
            resolved_at = CASE WHEN $1 = 'resolved' THEN now() ELSE NULL END,
            deadline = COALESCE($3, deadline)
      WHERE id = $4
      RETURNING *`,
    [
      input.decision,
      input.recoveryDecision,
      input.deadline ? new Date(input.deadline) : null,
      input.escalationId,
    ]
  );

  if (!rows[0]) throw notFound();
  return rows[0];
}

// ─── RM-09: Manager Performance Reviews ───

export async function listManagerReviews(scope: Scope, managerId?: string) {
  assertRm(scope);
  const query = managerId
    ? `SELECT mr.*, e.display_name AS manager_name
         FROM manager_reviews mr
         JOIN employees e ON e.id = mr.manager_employee_id
        WHERE mr.rm_employee_id = $1 AND mr.manager_employee_id = $2
        ORDER BY mr.created_at DESC`
    : `SELECT mr.*, e.display_name AS manager_name
         FROM manager_reviews mr
         JOIN employees e ON e.id = mr.manager_employee_id
        WHERE mr.rm_employee_id = $1
        ORDER BY mr.created_at DESC`;

  const params = managerId ? [scope.employeeId, managerId] : [scope.employeeId];
  const { rows } = await pool.query(query, params);
  return rows;
}

export async function saveManagerReview(scope: Scope, input: SaveManagerReviewInput) {
  assertRm(scope);

  // Enforce manager scope: reviewee must be an active MG in regional scope
  const { rows: mgrRows } = await pool.query(
    `SELECT e.id FROM assignments a
       JOIN employees e ON e.id = a.employee_id
      WHERE e.id = $1 AND a.team_id = ANY($2) AND a.role = 'MG'
      LIMIT 1`,
    [input.managerEmployeeId, scope.teams]
  );
  if (!mgrRows[0]) {
    throw forbidden('Reviewee must be an authorized Manager within regional scope.');
  }

  const reviewId = id('MRV');

  const { rows } = await pool.query(
    `INSERT INTO manager_reviews (
       id, rm_employee_id, manager_employee_id, period_label, performance_rating,
       strengths, blockers, improvement_commitments, support_actions, private_rm_notes,
       next_review_date, acknowledged
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [
      reviewId,
      scope.employeeId,
      input.managerEmployeeId,
      input.periodLabel,
      input.performanceRating,
      input.strengths,
      input.blockers,
      JSON.stringify(input.improvementCommitments),
      input.supportActions || null,
      input.privateRmNotes || null,
      input.nextReviewDate,
      input.acknowledged,
    ]
  );
  return rows[0];
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

    // Header & Brand Palette (#113F3D)
    doc.rect(40, 40, 515, 60).fill('#113F3D');
    const brandTitle =
      preview.scope.vertical === 'banking'
        ? 'FINVERSE COMMERCIAL BANKING'
        : preview.scope.vertical === 'markets'
        ? 'FINVERSE MARKETS & SECURITIES'
        : preview.scope.vertical === 'real-estate' || preview.scope.vertical === 'real_estate'
        ? 'FINVERSE REAL ESTATE ADVISORY'
        : 'FINVERSE WEALTH MANAGEMENT';
    doc.fillColor('#FFFFFF').fontSize(18).text(brandTitle, 55, 52);
    doc.fontSize(12).fillColor('#DCEEEA').text('Regional Executive Performance & Governance Pack', 55, 75);

    doc.moveDown(4);
    doc.fillColor('#1B1F1E').fontSize(14).text(`Period: ${input.period}`, { underline: true });
    doc.fontSize(10).fillColor('#6B7280').text(`Region: ${preview.scope.name} | Generated By: ${scope.displayName} | Date: ${new Date().toLocaleDateString('en-IN')}`);
    doc.moveDown(1.5);

    // Section 1: Executive Regional Target Attainment
    doc.fillColor('#113F3D').fontSize(12).text('1. Regional Attainment & Target Pace', { underline: true });
    doc.moveDown(0.5);
    doc.fillColor('#1B1F1E').fontSize(10)
      .text(`Parent NM Target: ${preview.targetSummary.parentTarget} wins`)
      .text(`Achieved Wins: ${preview.targetSummary.achievedWins} wins (${preview.targetSummary.attainmentPercent}% attainment)`)
      .text(`Unallocated Remainder: ${preview.targetSummary.unallocatedRemainder} wins`);
    doc.moveDown(1.5);

    // Section 2: Manager Contribution Breakdown
    doc.fillColor('#113F3D').fontSize(12).text('2. Manager Contributions & Status', { underline: true });
    doc.moveDown(0.5);
    preview.managers.forEach((m) => {
      doc.fillColor('#1B1F1E').fontSize(10).text(`• ${m.name} (${m.teams.join(', ')}): Target ${m.allocatedTarget} | Wins ${m.achievedWins} (${m.targetPace}%) | Open Interventions: ${m.openInterventions} | Status: ${m.status.toUpperCase()}`);
    });
    doc.moveDown(1.5);

    // Section 3: Regional Forecast Rollup
    doc.fillColor('#113F3D').fontSize(12).text('3. Regional Forecast Rollup', { underline: true });
    doc.moveDown(0.5);
    doc.fillColor('#1B1F1E').fontSize(10)
      .text(`Bottom-Up Total: INR ${preview.forecastSummary.bottomUpSum.toLocaleString('en-IN')}`)
      .text(`Regional Management Adjustment: INR ${preview.forecastSummary.regionalAdjustment.toLocaleString('en-IN')}`)
      .text(`Net Regional Forecast: INR ${preview.forecastSummary.adjustedRevenue.toLocaleString('en-IN')} (Status: ${preview.forecastSummary.status.toUpperCase()})`);
    doc.moveDown(1.5);

    // Section 4: Risk & Escalation Register
    doc.fillColor('#113F3D').fontSize(12).text('4. Governance & Risk Register', { underline: true });
    doc.moveDown(0.5);
    if (preview.riskRegister.length === 0) {
      doc.fillColor('#6B7280').fontSize(10).text('No open high-severity regional escalations.');
    } else {
      preview.riskRegister.forEach((r) => {
        doc.fillColor('#1B1F1E').fontSize(10).text(`• [${r.severity?.toUpperCase()}] ${r.title} — Accountable: ${r.accountable_manager_name || 'Unassigned'} (Status: ${r.status})`);
      });
    }

    doc.end();
  });
}

export async function listRegionalReportSchedules(scope: Scope) {
  assertRm(scope);
  const { rows } = await pool.query(
    `SELECT * FROM regional_report_schedules
      WHERE rm_employee_id = $1
      ORDER BY created_at DESC`,
    [scope.employeeId]
  );
  return rows;
}

export async function saveRegionalReportSchedule(scope: Scope, input: SaveRegionalReportScheduleInput) {
  assertRm(scope);
  const regionalScope = await getRegionalScope(scope);
  const scheduleId = input.id || id('RRS');

  const { rows } = await pool.query(
    `INSERT INTO regional_report_schedules (
       id, rm_employee_id, region_id, name, period_type, cadence, recipients, sections, status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       period_type = EXCLUDED.period_type,
       cadence = EXCLUDED.cadence,
       recipients = EXCLUDED.recipients,
       sections = EXCLUDED.sections,
       status = EXCLUDED.status
     RETURNING *`,
    [
      scheduleId,
      scope.employeeId,
      regionalScope.regionId,
      input.name,
      input.periodType,
      input.cadence,
      JSON.stringify(input.recipients),
      JSON.stringify(input.sections),
      input.status,
    ]
  );
  return rows[0];
}
