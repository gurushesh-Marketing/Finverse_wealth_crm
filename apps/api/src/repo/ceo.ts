import { createWriteStream, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import PDFDocument from 'pdfkit';
import { pool } from './db';
import type { Scope } from './users';
import { forbidden, notFound, HttpError } from '../lib/errors';
import type {
  ApproveCompanyTargetInput,
  SignOffCompanyForecastInput,
  CreateGrowthInitiativeInput,
  ApproveGrowthInitiativeInput,
  ArbitrateCrossVerticalConflictInput,
  CreateCriticalRiskInput,
  ResolveCriticalRiskInput,
  SaveNmLeadershipReviewInput,
  SaveBoardReportScheduleInput,
  CreateExecutiveCommitmentInput,
  FulfillExecutiveCommitmentInput,
  GenerateBoardPackPdfInput,
  CeoPeriod,
} from '@finverse/contracts';

const EXPORT_ROOT = resolve(process.cwd(), 'data/ceo_exports');

function id(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function assertCeo(scope: Scope): void {
  if (scope.role !== 'CEO') {
    throw forbidden('Chief Executive Officer executive workspace only.');
  }
}

// ─── Executive Scope Queries ───

export async function getCeoScope(scope: Scope) {
  assertCeo(scope);

  // Cross-vertical high-level summary
  const { rows: verticalCounts } = await pool.query(
    `SELECT vertical, count(DISTINCT id)::int AS team_count
       FROM teams
      GROUP BY vertical
      ORDER BY vertical`
  );

  const { rows: leadCounts } = await pool.query(
    `SELECT vertical, count(*)::int AS lead_count
       FROM leads
      GROUP BY vertical`
  );

  const leadMap: Record<string, number> = {};
  for (const l of leadCounts) leadMap[l.vertical] = l.lead_count;

  const verticals = [
    {
      id: 'wealth',
      name: 'Wealth Management',
      nmName: 'Vikram Malhotra',
      nmEmail: 'vikram@finverse.demo',
      teamCount: verticalCounts.find((v) => v.vertical === 'wealth')?.team_count || 3,
      activeLeads: leadMap['wealth'] || 9,
      status: 'operational',
    },
    {
      id: 'banking',
      name: 'Corporate & Retail Banking',
      nmName: 'Dev Kapoor',
      nmEmail: 'dev@finverse.demo',
      teamCount: verticalCounts.find((v) => v.vertical === 'banking')?.team_count || 1,
      activeLeads: leadMap['banking'] || 2,
      status: 'operational',
    },
    {
      id: 'markets',
      name: 'Markets & Trading',
      nmName: 'Ananya Roy (Designate)',
      nmEmail: 'ananya@finverse.demo',
      teamCount: 0,
      activeLeads: 0,
      status: 'expansion_mandate',
    },
    {
      id: 'real-estate',
      name: 'Institutional Real Estate',
      nmName: 'Aditya Singhania (Advisor)',
      nmEmail: 'aditya@finverse.demo',
      teamCount: 0,
      activeLeads: 0,
      status: 'expansion_mandate',
    },
  ];

  return {
    ceo: {
      id: scope.employeeId,
      name: scope.displayName,
      role: 'CEO',
    },
    verticals,
  };
}

// ─── CEO-01: Company Operating Picture ───

export async function getCompanyOperatingPicture(
  scope: Scope,
  period: CeoPeriod = 'month-to-date',
  focusVertical = 'all'
) {
  assertCeo(scope);
  const ceoScope = await getCeoScope(scope);

  // 1. Company targets
  const { rows: targetRows } = await pool.query(
    `SELECT * FROM company_targets
      WHERE period_label = 'October'
      ORDER BY version DESC LIMIT 1`
  );
  const target = targetRows[0] || {
    total_revenue_target: 150000000,
    total_wins_target: 1000,
    unallocated_revenue_buffer: 10000000,
    unallocated_wins_buffer: 50,
    status: 'approved_by_ceo',
  };

  // 2. Real conversion numbers from database
  const { rows: winRows } = await pool.query(
    `SELECT count(*)::int AS wins, COALESCE(sum((payload->>'value')::numeric), 0) AS total_value
       FROM outcome_requests
      WHERE type = 'conversion' AND status = 'approved'`
  );
  const wealthWins = winRows[0]?.wins || 0;
  const wealthRevenue = Number(winRows[0]?.total_value || 0);

  // Firm-wide aggregates (Wealth real + simulated banking/markets baseline)
  const totalClosedWins = wealthWins + 145; // 145 from banking
  const totalClosedRevenue = wealthRevenue + 38000000;
  const winsAttainmentPercent = Math.round((totalClosedWins / Number(target.total_wins_target)) * 100);
  const revenueAttainmentPercent = Math.round((totalClosedRevenue / Number(target.total_revenue_target)) * 100);

  // 3. Open risks & commitments
  const { rows: riskRows } = await pool.query(
    `SELECT count(*) FILTER (WHERE status != 'resolved')::int AS open_risks,
            count(*) FILTER (WHERE severity = 'critical' OR severity = 'existential')::int AS critical_risks
       FROM critical_operating_risks`
  );

  const { rows: commitRows } = await pool.query(
    `SELECT count(*) FILTER (WHERE status = 'in_progress')::int AS in_progress_commits
       FROM executive_commitments
      WHERE ceo_employee_id = $1`,
    [scope.employeeId]
  );

  // 4. Vertical Contribution Breakdown
  const verticalContributions = [
    {
      vertical: 'wealth',
      name: 'Wealth Management',
      targetRevenueInr: 75000000,
      deliveredRevenueInr: wealthRevenue > 0 ? wealthRevenue : 45000000,
      targetWins: 500,
      deliveredWins: wealthWins > 0 ? wealthWins : 8,
      attainmentPace: wealthWins > 0 ? Math.round((wealthWins / 500) * 100) : 16,
      status: 'on-track',
      nmName: 'Vikram Malhotra',
    },
    {
      vertical: 'banking',
      name: 'Corporate & Retail Banking',
      targetRevenueInr: 45000000,
      deliveredRevenueInr: 38000000,
      targetWins: 350,
      deliveredWins: 145,
      attainmentPace: 41,
      status: 'on-track',
      nmName: 'Dev Kapoor',
    },
    {
      vertical: 'markets',
      name: 'Markets & Trading',
      targetRevenueInr: 20000000,
      deliveredRevenueInr: 0,
      targetWins: 100,
      deliveredWins: 0,
      attainmentPace: 0,
      status: 'expansion_mandate',
      nmName: 'Ananya Roy (Designate)',
    },
    {
      vertical: 'real-estate',
      name: 'Institutional Real Estate',
      targetRevenueInr: 10000000,
      deliveredRevenueInr: 0,
      targetWins: 50,
      deliveredWins: 0,
      attainmentPace: 0,
      status: 'expansion_mandate',
      nmName: 'Aditya Singhania',
    },
  ];

  return {
    period,
    focusVertical,
    scope: ceoScope,
    watermark: {
      dataFreshnessMinutes: 4,
      financeCloseStatus: 'M-1 Reconciled / Q3 Open',
      asOf: new Date().toISOString(),
    },
    kpis: {
      totalRevenueTarget: Number(target.total_revenue_target),
      totalDeliveredRevenue: totalClosedRevenue,
      revenueAttainmentPercent,
      totalWinsTarget: Number(target.total_wins_target),
      totalDeliveredWins: totalClosedWins,
      winsAttainmentPercent,
      unallocatedRevenueBuffer: Number(target.unallocated_revenue_buffer),
      unallocatedWinsBuffer: Number(target.unallocated_wins_buffer),
      openRisksCount: riskRows[0]?.open_risks || 0,
      criticalRisksCount: riskRows[0]?.critical_risks || 0,
      inProgressCommitmentsCount: commitRows[0]?.in_progress_commits || 0,
    },
    verticalContributions,
  };
}

// ─── CEO-02: Compare Verticals Fairly ───

export async function getVerticalComparisons(scope: Scope, period: CeoPeriod = 'month-to-date') {
  assertCeo(scope);
  return {
    period,
    comparisons: [
      {
        vertical: 'wealth',
        name: 'Wealth Management',
        revenueRunRateInr: 540000000,
        grossMarginPercent: 62.5,
        blendedCacInr: 12500,
        averageTicketInr: 2500000,
        fteCount: 9,
        revenuePerFteInr: 6000000,
        riskRating: 'moderate',
        leadVelocityHours: 1.2,
      },
      {
        vertical: 'banking',
        name: 'Corporate & Retail Banking',
        revenueRunRateInr: 456000000,
        grossMarginPercent: 44.0,
        blendedCacInr: 4200,
        averageTicketInr: 500000,
        fteCount: 14,
        revenuePerFteInr: 2714000,
        riskRating: 'low',
        leadVelocityHours: 0.8,
      },
      {
        vertical: 'markets',
        name: 'Markets & Trading',
        revenueRunRateInr: 0,
        grossMarginPercent: 78.0,
        blendedCacInr: 35000,
        averageTicketInr: 10000000,
        fteCount: 2,
        revenuePerFteInr: 0,
        riskRating: 'high',
        leadVelocityHours: 0,
      },
      {
        vertical: 'real-estate',
        name: 'Institutional Real Estate',
        revenueRunRateInr: 0,
        grossMarginPercent: 55.0,
        blendedCacInr: 50000,
        averageTicketInr: 50000000,
        fteCount: 1,
        revenuePerFteInr: 0,
        riskRating: 'high',
        leadVelocityHours: 0,
      },
    ],
  };
}

// ─── CEO-03: National Manager Contribution Review ───

export async function getNmContribution(scope: Scope, nmEmployeeId: string, period = 'October 2026') {
  assertCeo(scope);
  const { rows: empRows } = await pool.query(
    `SELECT id, display_name, email FROM employees WHERE id = $1`,
    [nmEmployeeId]
  );
  if (empRows.length === 0) throw notFound();
  const nm = empRows[0];

  // Pull regional divisions
  const { rows: targets } = await pool.query(
    `SELECT * FROM national_targets WHERE nm_employee_id = $1 ORDER BY version DESC LIMIT 1`,
    [nmEmployeeId]
  );
  const target = targets[0] || null;

  return {
    period,
    nationalManager: nm,
    approvedVerticalTarget: target ? Number(target.approved_ceo_target) : 500,
    unallocatedRemainder: target ? Number(target.unallocated_remainder) : 250,
    regionalAllocations: target?.regional_allocations || [],
    governanceRecord: {
      directivesIssued: 4,
      directivesFulfilled: 3,
      escalationsResolved: 2,
      forecastAccuracyVariancePercent: -4.2,
    },
  };
}

// ─── CEO-04: Approve Company & Vertical Targets ───

export async function getCompanyTarget(scope: Scope, periodLabel = 'October', fiscalYear = 'FY2026-27') {
  assertCeo(scope);
  const { rows } = await pool.query(
    `SELECT * FROM company_targets
      WHERE fiscal_year = $1 AND period_label = $2
      ORDER BY version DESC LIMIT 1`,
    [fiscalYear, periodLabel]
  );
  if (rows.length === 0) {
    return {
      id: 'CT-DRAFT',
      fiscalYear,
      periodLabel,
      totalRevenueTarget: 150000000,
      totalWinsTarget: 1000,
      verticalAllocations: [],
      unallocatedRevenueBuffer: 150000000,
      unallocatedWinsBuffer: 1000,
      status: 'draft',
      version: 1,
    };
  }
  return {
    ...rows[0],
    totalRevenueTarget: Number(rows[0].total_revenue_target),
    totalWinsTarget: Number(rows[0].total_wins_target),
    unallocatedRevenueBuffer: Number(rows[0].unallocated_revenue_buffer),
    unallocatedWinsBuffer: Number(rows[0].unallocated_wins_buffer),
    verticalAllocations: rows[0].vertical_allocations || [],
  };
}

export async function approveCompanyTarget(scope: Scope, input: ApproveCompanyTargetInput) {
  assertCeo(scope);

  const sumWins = input.verticalAllocations.reduce((acc, curr) => acc + curr.winsTarget, 0);
  const sumRevenue = input.verticalAllocations.reduce((acc, curr) => acc + curr.revenueTarget, 0);

  if (sumWins > input.totalWinsTarget || sumRevenue > input.totalRevenueTarget) {
    throw new HttpError(
      400,
      'VALIDATION_FAILED',
      'Allocated vertical targets exceed total enterprise budget. Over-allocation is strictly prohibited.'
    );
  }

  const unallocatedWinsBuffer = input.totalWinsTarget - sumWins;
  const unallocatedRevenueBuffer = input.totalRevenueTarget - sumRevenue;
  const status = input.boardRatify ? 'board_ratified' : 'approved_by_ceo';
  const targetId = id('CT');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Persist Company Target
    const { rows } = await client.query(
      `INSERT INTO company_targets (
         id, ceo_employee_id, period_label, fiscal_year, total_revenue_target,
         total_wins_target, vertical_allocations, unallocated_revenue_buffer,
         unallocated_wins_buffer, status, approved_at, version
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), 1)
       ON CONFLICT (fiscal_year, period_label, version) DO UPDATE SET
         total_revenue_target = EXCLUDED.total_revenue_target,
         total_wins_target = EXCLUDED.total_wins_target,
         vertical_allocations = EXCLUDED.vertical_allocations,
         unallocated_revenue_buffer = EXCLUDED.unallocated_revenue_buffer,
         unallocated_wins_buffer = EXCLUDED.unallocated_wins_buffer,
         status = EXCLUDED.status,
         approved_at = now()
       RETURNING *`,
      [
        targetId,
        scope.employeeId,
        input.periodLabel,
        input.fiscalYear,
        input.totalRevenueTarget,
        input.totalWinsTarget,
        JSON.stringify(input.verticalAllocations),
        unallocatedRevenueBuffer,
        unallocatedWinsBuffer,
        status,
      ]
    );

    // 2. Cascade down to national_targets for in-scope verticals
    for (const alloc of input.verticalAllocations) {
      if (alloc.vertical === 'wealth') {
        await client.query(
          `INSERT INTO national_targets (
             id, nm_employee_id, vertical, period_label, metric, approved_ceo_target,
             unallocated_remainder, regional_allocations, status, version
           ) VALUES ($1, $2, 'wealth', $3, 'approved-wins', $4, $4, '[]', 'published', 1)
           ON CONFLICT (vertical, period_label, metric, version) DO UPDATE SET
             approved_ceo_target = EXCLUDED.approved_ceo_target`,
          [
            id('NT'),
            alloc.nmEmployeeId || 'EMP-009',
            input.periodLabel,
            alloc.winsTarget,
          ]
        );
      }
    }

    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── CEO-05: Sign-Off Consolidated Company Forecast ───

export async function getCompanyForecastRollup(scope: Scope, periodLabel = 'October') {
  assertCeo(scope);

  // Pull active national forecasts
  const { rows: natForecasts } = await pool.query(
    `SELECT nf.*, e.display_name AS nm_name
       FROM national_forecasts nf
       JOIN employees e ON e.id = nf.nm_employee_id
      WHERE nf.period_label = $1
      ORDER BY nf.created_at DESC`,
    [periodLabel]
  );

  const wealthRevenue = natForecasts[0] ? Number(natForecasts[0].adjusted_revenue) : 42500000;
  const bankingRevenue = 36000000;
  const bottomUpSum = wealthRevenue + bankingRevenue;

  // Pull latest company forecast if signed off
  const { rows: companyForecasts } = await pool.query(
    `SELECT * FROM company_forecasts
      WHERE period_label = $1
      ORDER BY version DESC LIMIT 1`,
    [periodLabel]
  );
  const active = companyForecasts[0] || null;

  return {
    periodLabel,
    bottomUpSum,
    executiveMacroAdjustment: active ? Number(active.executive_macro_adjustment) : -5000000,
    signedOffRevenue: active ? Number(active.signed_off_revenue) : bottomUpSum - 5000000,
    currency: 'INR',
    verticalSubmissions: [
      { vertical: 'Wealth Management', reportedRevenue: wealthRevenue, status: natForecasts[0]?.status || 'submitted_to_executives' },
      { vertical: 'Corporate Banking', reportedRevenue: bankingRevenue, status: 'submitted' },
      { vertical: 'Markets / Trading', reportedRevenue: 0, status: 'inactive' },
      { vertical: 'Real Estate', reportedRevenue: 0, status: 'inactive' },
    ],
    macroAssumptions: active ? active.macro_assumptions : 'Conservative posture for SEBI advisory turnaround & Tier-1 HNI liquidity shifts.',
    boardRiskNotes: active ? active.board_risk_notes : 'Headwind on debt syndication fee recognition timeline.',
    status: active ? active.status : 'draft',
  };
}

export async function signOffCompanyForecast(scope: Scope, input: SignOffCompanyForecastInput) {
  assertCeo(scope);
  const forecastId = id('CF');
  const signedOffRevenue = input.bottomUpSum + input.executiveMacroAdjustment;
  const status = input.signOff ? 'signed_off_by_ceo' : 'draft';
  const signedOffAt = input.signOff ? new Date().toISOString() : null;

  const { rows } = await pool.query(
    `INSERT INTO company_forecasts (
       id, ceo_employee_id, period_label, bottom_up_sum, executive_macro_adjustment,
       signed_off_revenue, currency, vertical_submissions, macro_assumptions,
       board_risk_notes, status, signed_off_at, version
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 1)
     RETURNING *`,
    [
      forecastId,
      scope.employeeId,
      input.periodLabel,
      input.bottomUpSum,
      input.executiveMacroAdjustment,
      signedOffRevenue,
      input.currency,
      JSON.stringify(input.verticalSubmissions),
      input.macroAssumptions,
      input.boardRiskNotes || null,
      status,
      signedOffAt,
    ]
  );
  return rows[0];
}

// ─── CEO-06: Growth & Capacity Initiatives ───

export async function listGrowthInitiatives(scope: Scope, status?: string) {
  assertCeo(scope);
  const query = status
    ? `SELECT * FROM growth_initiatives WHERE status = $1 ORDER BY created_at DESC`
    : `SELECT * FROM growth_initiatives ORDER BY created_at DESC`;
  const params = status ? [status] : [];
  const { rows } = await pool.query(query, params);
  return rows;
}

export async function createGrowthInitiative(scope: Scope, input: CreateGrowthInitiativeInput) {
  assertCeo(scope);
  const initiativeId = id('GI');
  const { rows } = await pool.query(
    `INSERT INTO growth_initiatives (
       id, ceo_employee_id, title, vertical, initiative_type, capital_required,
       currency, projected_roi_percent, timeline_months, sponsor_executive,
       justification, implementation_tasks, status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'proposed')
     RETURNING *`,
    [
      initiativeId,
      scope.employeeId,
      input.title,
      input.vertical,
      input.initiativeType,
      input.capitalRequired,
      input.currency,
      input.projectedRoiPercent,
      input.timelineMonths,
      input.sponsorExecutive,
      input.justification,
      JSON.stringify(input.implementationTasks),
    ]
  );
  return rows[0];
}

export async function approveGrowthInitiative(scope: Scope, input: ApproveGrowthInitiativeInput) {
  assertCeo(scope);
  const newStatus = input.approved ? 'approved_by_ceo' : 'rejected';
  const { rows } = await pool.query(
    `UPDATE growth_initiatives
        SET status = $1, approved_at = now()
      WHERE id = $2
      RETURNING *`,
    [newStatus, input.initiativeId]
  );
  if (rows.length === 0) throw notFound();
  return rows[0];
}

// ─── CEO-07: Resolve Cross-Vertical Conflict ───

export async function listCrossVerticalConflicts(scope: Scope) {
  assertCeo(scope);
  const { rows } = await pool.query(
    `SELECT * FROM cross_vertical_conflicts ORDER BY created_at DESC`
  );
  return rows;
}

export async function arbitrateCrossVerticalConflict(scope: Scope, input: ArbitrateCrossVerticalConflictInput) {
  assertCeo(scope);
  const { rows } = await pool.query(
    `UPDATE cross_vertical_conflicts
        SET status = 'resolved',
            ceo_determination = $1,
            resolved_attribution = $2,
            awarded_lead_id = $3,
            resolved_at = now()
      WHERE id = $4
      RETURNING *`,
    [
      input.ceoDetermination,
      input.resolvedAttribution,
      input.awardedLeadId || null,
      input.conflictId,
    ]
  );
  if (rows.length === 0) throw notFound();
  return rows[0];
}

// ─── CEO-08: Critical Complaints & Operating Risks ───

export async function listCriticalOperatingRisks(scope: Scope) {
  assertCeo(scope);
  const { rows } = await pool.query(
    `SELECT * FROM critical_operating_risks ORDER BY created_at DESC`
  );
  return rows;
}

export async function createCriticalRisk(scope: Scope, input: CreateCriticalRiskInput) {
  assertCeo(scope);
  const riskId = id('COR');
  const { rows } = await pool.query(
    `INSERT INTO critical_operating_risks (
       id, ceo_employee_id, vertical, risk_category, severity, title, details,
       exposure_amount, accountable_executive, decision_deadline, mitigation_mandate, status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'open')
     RETURNING *`,
    [
      riskId,
      scope.employeeId,
      input.vertical,
      input.riskCategory,
      input.severity,
      input.title,
      input.details,
      input.exposureAmount || null,
      input.accountableExecutive,
      input.decisionDeadline,
      input.mitigationMandate || null,
    ]
  );
  return rows[0];
}

export async function resolveCriticalRisk(scope: Scope, input: ResolveCriticalRiskInput) {
  assertCeo(scope);
  const { rows } = await pool.query(
    `UPDATE critical_operating_risks
        SET status = 'resolved', mitigation_mandate = $1, resolved_at = now()
      WHERE id = $2
      RETURNING *`,
    [input.mitigationOutcome, input.riskId]
  );
  if (rows.length === 0) throw notFound();
  return rows[0];
}

// ─── CEO-09: National Manager Leadership Review ───

export async function listNmLeadershipReviews(scope: Scope, nmEmployeeId?: string) {
  assertCeo(scope);
  const query = nmEmployeeId
    ? `SELECT r.*, e.display_name AS nm_name
         FROM nm_leadership_reviews r
         JOIN employees e ON e.id = r.nm_employee_id
        WHERE r.nm_employee_id = $1
        ORDER BY r.created_at DESC`
    : `SELECT r.*, e.display_name AS nm_name
         FROM nm_leadership_reviews r
         JOIN employees e ON e.id = r.nm_employee_id
        ORDER BY r.created_at DESC`;
  const params = nmEmployeeId ? [nmEmployeeId] : [];
  const { rows } = await pool.query(query, params);
  return rows;
}

export async function saveNmLeadershipReview(scope: Scope, input: SaveNmLeadershipReviewInput) {
  assertCeo(scope);
  const reviewId = id('NLR');
  const { rows } = await pool.query(
    `INSERT INTO nm_leadership_reviews (
       id, ceo_employee_id, nm_employee_id, vertical, period_label,
       overall_leadership_rating, strategic_alignment, operational_execution,
       team_health_and_retention, board_visibility_readiness, strategic_commitments,
       support_from_ceo, next_review_date
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING *`,
    [
      reviewId,
      scope.employeeId,
      input.nmEmployeeId,
      input.vertical,
      input.periodLabel,
      input.overallLeadershipRating,
      input.strategicAlignment,
      input.operationalExecution,
      input.teamHealthAndRetention,
      input.boardVisibilityReadiness,
      JSON.stringify(input.strategicCommitments),
      input.supportFromCeo || null,
      input.nextReviewDate,
    ]
  );
  return rows[0];
}

// ─── CEO-10: Board & Executive Meeting Pack PDF Export & Schedules ───

export async function previewBoardPack(scope: Scope, periodLabel = 'October 2026') {
  assertCeo(scope);
  const picture = await getCompanyOperatingPicture(scope);
  const comparisons = await getVerticalComparisons(scope);
  const initiatives = await listGrowthInitiatives(scope);
  const risks = await listCriticalOperatingRisks(scope);
  const commitments = await listExecutiveCommitments(scope);

  return {
    period: periodLabel,
    picture,
    comparisons: comparisons.comparisons,
    initiatives: initiatives.slice(0, 3),
    criticalRisks: risks.filter((r) => r.status !== 'resolved'),
    commitments: commitments.filter((c) => c.status !== 'fulfilled'),
  };
}

export async function generateBoardPackPdf(scope: Scope, input: GenerateBoardPackPdfInput): Promise<string> {
  assertCeo(scope);
  mkdirSync(EXPORT_ROOT, { recursive: true });

  const fileName = `Board_Executive_Pack_${Date.now()}.pdf`;
  const filePath = resolve(EXPORT_ROOT, fileName);
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  const writeStream = createWriteStream(filePath);

  const preview = await previewBoardPack(scope, input.periodLabel);

  return new Promise((resolvePromise, rejectPromise) => {
    writeStream.on('finish', () => resolvePromise(filePath));
    writeStream.on('error', rejectPromise);

    doc.pipe(writeStream);

    // Header & Brand Palette (#113F3D)
    doc.rect(40, 40, 515, 60).fill('#113F3D');
    doc.fillColor('#FFFFFF').fontSize(18).text('FINVERSE GROUP HOLDINGS', 55, 52);
    doc.fontSize(12).fillColor('#DCEEEA').text('Board of Directors & Executive Leadership Pack', 55, 75);

    doc.moveDown(4);
    doc.fillColor('#1B1F1E').fontSize(14).text(`Period: ${input.periodLabel}`, { underline: true });
    doc.fontSize(10).fillColor('#6B7280').text(`Audience: Board & Executive Committee | Sign-off: ${scope.displayName} (CEO) | Date: ${new Date().toLocaleDateString('en-IN')}`);
    doc.moveDown(1.5);

    // Section 1: Firm-wide Financial & Strategic Health
    doc.fillColor('#113F3D').fontSize(12).text('1. Enterprise Operating Picture & Attainment', { underline: true });
    doc.moveDown(0.5);
    doc.fillColor('#1B1F1E').fontSize(10)
      .text(`Total Enterprise Revenue Target: INR ${(preview.picture.kpis.totalRevenueTarget / 10000000).toFixed(1)} Cr`)
      .text(`Signed-off Revenue: INR ${(preview.picture.kpis.totalDeliveredRevenue / 10000000).toFixed(1)} Cr (${preview.picture.kpis.revenueAttainmentPercent}% attainment)`)
      .text(`Closed Wins: ${preview.picture.kpis.totalDeliveredWins} / ${preview.picture.kpis.totalWinsTarget} wins (${preview.picture.kpis.winsAttainmentPercent}%)`)
      .text(`Unallocated Strategic Buffer: INR ${(preview.picture.kpis.unallocatedRevenueBuffer / 10000000).toFixed(1)} Cr | ${preview.picture.kpis.unallocatedWinsBuffer} wins`);
    doc.moveDown(1.5);

    // Section 2: Cross-Vertical Comparison
    doc.fillColor('#113F3D').fontSize(12).text('2. Division Attainment & Gross Margins', { underline: true });
    doc.moveDown(0.5);
    preview.comparisons.forEach((c) => {
      doc.fillColor('#1B1F1E').fontSize(10).text(
        `• ${c.name}: Run-Rate INR ${(c.revenueRunRateInr / 10000000).toFixed(1)} Cr | Margin ${c.grossMarginPercent}% | CAC INR ${c.blendedCacInr.toLocaleString('en-IN')} | Headcount: ${c.fteCount} FTEs`
      );
    });
    doc.moveDown(1.5);

    // Section 3: Strategic Growth & Capital Allocation
    doc.fillColor('#113F3D').fontSize(12).text('3. Strategic Growth Initiatives', { underline: true });
    doc.moveDown(0.5);
    preview.initiatives.forEach((gi) => {
      doc.fillColor('#1B1F1E').fontSize(10).text(
        `• [${gi.status.toUpperCase()}] ${gi.title} (${gi.vertical.toUpperCase()}): Capital INR ${(Number(gi.capital_required) / 10000000).toFixed(2)} Cr | ROI ${gi.projected_roi_percent}% | Sponsor: ${gi.sponsor_executive}`
      );
    });
    doc.moveDown(1.5);

    // Section 4: Critical Operating Risks & Mitigation
    doc.fillColor('#113F3D').fontSize(12).text('4. Critical Operating Risks & Board Escalations', { underline: true });
    doc.moveDown(0.5);
    if (preview.criticalRisks.length === 0) {
      doc.fillColor('#6B7280').fontSize(10).text('No open critical operating or regulatory risks.');
    } else {
      preview.criticalRisks.forEach((r) => {
        doc.fillColor('#1B1F1E').fontSize(10).text(
          `• [${r.severity.toUpperCase()}] ${r.title} (${r.risk_category}): Accountable: ${r.accountable_executive}`
        );
      });
    }

    doc.end();
  });
}

export async function listBoardReportSchedules(scope: Scope) {
  assertCeo(scope);
  const { rows } = await pool.query(
    `SELECT * FROM board_report_schedules WHERE ceo_employee_id = $1 ORDER BY created_at DESC`,
    [scope.employeeId]
  );
  return rows;
}

export async function saveBoardReportSchedule(scope: Scope, input: SaveBoardReportScheduleInput) {
  assertCeo(scope);
  const scheduleId = input.id || id('BRS');
  const { rows } = await pool.query(
    `INSERT INTO board_report_schedules (
       id, ceo_employee_id, title, frequency, delivery_cadence, stakeholders, sections, status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO UPDATE SET
       title = EXCLUDED.title,
       frequency = EXCLUDED.frequency,
       delivery_cadence = EXCLUDED.delivery_cadence,
       stakeholders = EXCLUDED.stakeholders,
       sections = EXCLUDED.sections,
       status = EXCLUDED.status
     RETURNING *`,
    [
      scheduleId,
      scope.employeeId,
      input.title,
      input.frequency,
      input.deliveryCadence,
      JSON.stringify(input.stakeholders),
      JSON.stringify(input.sections),
      input.status,
    ]
  );
  return rows[0];
}

// ─── CEO-11: Executive Commitments & Actions Tracker ───

export async function listExecutiveCommitments(scope: Scope, status?: string) {
  assertCeo(scope);
  const query = status
    ? `SELECT * FROM executive_commitments WHERE status = $1 ORDER BY due_date ASC`
    : `SELECT * FROM executive_commitments ORDER BY due_date ASC`;
  const params = status ? [status] : [];
  const { rows } = await pool.query(query, params);
  return rows;
}

export async function createExecutiveCommitment(scope: Scope, input: CreateExecutiveCommitmentInput) {
  assertCeo(scope);
  const commitId = id('EXC');
  const { rows } = await pool.query(
    `INSERT INTO executive_commitments (
       id, ceo_employee_id, source_action, title, accountable_leader, vertical,
       actionable_mandate, due_date, status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'in_progress')
     RETURNING *`,
    [
      commitId,
      scope.employeeId,
      input.sourceAction,
      input.title,
      input.accountableLeader,
      input.vertical,
      input.actionableMandate,
      input.dueDate,
    ]
  );
  return rows[0];
}

export async function fulfillExecutiveCommitment(scope: Scope, input: FulfillExecutiveCommitmentInput) {
  assertCeo(scope);
  const { rows } = await pool.query(
    `UPDATE executive_commitments
        SET status = 'fulfilled', evidence_url = $1, fulfilled_at = now()
      WHERE id = $2
      RETURNING *`,
    [input.evidenceUrl || null, input.commitmentId]
  );
  if (rows.length === 0) throw notFound();
  return rows[0];
}
