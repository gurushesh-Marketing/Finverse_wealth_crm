import { createWriteStream, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import PDFDocument from 'pdfkit';
import { db } from './db';
import type { Scope } from './users';
import { forbidden, notFound, HttpError } from '../lib/errors';
import { eq, sql } from 'drizzle-orm';
import {
  companyTargets,
  companyForecasts,
  growthInitiatives,
  crossVerticalConflicts,
  criticalOperatingRisks,
  boardReportSchedules,
  executiveCommitments,
  nmLeadershipReviews,
  nationalTargets,
  nationalForecasts,
} from '../db/schema';
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

  const { rows: verticalCounts } = await db.execute<any>(sql`
    SELECT vertical, count(DISTINCT id)::int AS team_count
      FROM teams
     GROUP BY vertical
     ORDER BY vertical
  `);

  const { rows: leadCounts } = await db.execute<any>(sql`
    SELECT vertical, count(*)::int AS lead_count
      FROM leads
     GROUP BY vertical
  `);

  const leadMap: Record<string, number> = {};
  for (const l of leadCounts) leadMap[l.vertical] = l.lead_count;

  const verticals = [
    {
      id: 'wealth',
      name: 'Wealth Management',
      nmName: 'Vikram Malhotra',
      nmEmail: 'vikram@finverse.demo',
      teamCount: verticalCounts.find((v: any) => v.vertical === 'wealth')?.team_count || 3,
      activeLeads: leadMap['wealth'] || 9,
      status: 'operational',
    },
    {
      id: 'banking',
      name: 'Corporate & Retail Banking',
      nmName: 'Dev Kapoor',
      nmEmail: 'dev@finverse.demo',
      teamCount: verticalCounts.find((v: any) => v.vertical === 'banking')?.team_count || 1,
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

  const { rows: targetRows } = await db.execute<any>(sql`
    SELECT * FROM company_targets
     WHERE period_label = 'October'
     ORDER BY version DESC LIMIT 1
  `);
  const target = targetRows[0] || {
    total_revenue_target: 150000000,
    total_wins_target: 1000,
    unallocated_revenue_buffer: 10000000,
    unallocated_wins_buffer: 50,
    status: 'approved_by_ceo',
  };

  const { rows: winRows } = await db.execute<any>(sql`
    SELECT count(*)::int AS wins, COALESCE(sum((payload->>'value')::numeric), 0) AS total_value
      FROM outcome_requests
     WHERE type = 'conversion' AND status = 'approved'
  `);
  const wealthWins = winRows[0]?.wins || 0;
  const wealthRevenue = Number(winRows[0]?.total_value || 0);

  const totalClosedWins = wealthWins + 145;
  const totalClosedRevenue = wealthRevenue + 38000000;
  const winsAttainmentPercent = Math.round((totalClosedWins / Number(target.total_wins_target)) * 100);
  const revenueAttainmentPercent = Math.round((totalClosedRevenue / Number(target.total_revenue_target)) * 100);

  const { rows: riskRows } = await db.execute<any>(sql`
    SELECT count(*) FILTER (WHERE status != 'resolved')::int AS open_risks,
           count(*) FILTER (WHERE severity = 'critical' OR severity = 'existential')::int AS critical_risks
      FROM critical_operating_risks
  `);

  const { rows: commitRows } = await db.execute<any>(sql`
    SELECT count(*) FILTER (WHERE status = 'in_progress')::int AS in_progress_commits
      FROM executive_commitments
     WHERE ceo_employee_id = ${scope.employeeId}
  `);

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
  const { rows: empRows } = await db.execute<any>(sql`SELECT id, display_name, email FROM employees WHERE id = ${nmEmployeeId}`);
  if (empRows.length === 0) throw notFound();
  const nm = empRows[0];

  const { rows: targets } = await db.execute<any>(sql`
    SELECT * FROM national_targets WHERE nm_employee_id = ${nmEmployeeId} ORDER BY version DESC LIMIT 1
  `);
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
  const { rows } = await db.execute<any>(sql`
    SELECT * FROM company_targets
     WHERE fiscal_year = ${fiscalYear} AND period_label = ${periodLabel}
     ORDER BY version DESC LIMIT 1
  `);
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

  return await db.transaction(async (tx) => {
    const [companyTarget] = await tx.insert(companyTargets)
      .values({
        id: targetId,
        ceoEmployeeId: scope.employeeId,
        periodLabel: input.periodLabel,
        fiscalYear: input.fiscalYear,
        totalRevenueTarget: String(input.totalRevenueTarget),
        totalWinsTarget: String(input.totalWinsTarget),
        verticalAllocations: input.verticalAllocations,
        unallocatedRevenueBuffer: String(unallocatedRevenueBuffer),
        unallocatedWinsBuffer: String(unallocatedWinsBuffer),
        status,
        approvedAt: sql`now()`,
        version: 1,
      })
      .onConflictDoUpdate({
        target: [companyTargets.periodLabel, companyTargets.fiscalYear, companyTargets.version],
        set: {
          totalRevenueTarget: String(input.totalRevenueTarget),
          totalWinsTarget: String(input.totalWinsTarget),
          verticalAllocations: input.verticalAllocations,
          unallocatedRevenueBuffer: String(unallocatedRevenueBuffer),
          unallocatedWinsBuffer: String(unallocatedWinsBuffer),
          status,
          approvedAt: sql`now()`,
        },
      })
      .returning();

    for (const alloc of input.verticalAllocations) {
      if (alloc.vertical === 'wealth') {
        await tx.insert(nationalTargets)
          .values({
            id: id('NT'),
            nmEmployeeId: alloc.nmEmployeeId || 'EMP-009',
            vertical: 'wealth',
            periodLabel: input.periodLabel,
            metric: 'approved-wins',
            approvedCeoTarget: String(alloc.winsTarget),
            unallocatedRemainder: String(alloc.winsTarget),
            regionalAllocations: [],
            status: 'published',
            version: 1,
          })
          .onConflictDoUpdate({
            target: [nationalTargets.vertical, nationalTargets.periodLabel, nationalTargets.metric, nationalTargets.version],
            set: {
              approvedCeoTarget: String(alloc.winsTarget),
            },
          });
      }
    }

    return companyTarget;
  });
}

// ─── CEO-05: Sign-Off Consolidated Company Forecast ───

export async function getCompanyForecastRollup(scope: Scope, periodLabel = 'October') {
  assertCeo(scope);

  const { rows: natForecasts } = await db.execute<any>(sql`
    SELECT nf.*, e.display_name AS nm_name
      FROM national_forecasts nf
      JOIN employees e ON e.id = nf.nm_employee_id
     WHERE nf.period_label = ${periodLabel}
     ORDER BY nf.created_at DESC
  `);

  const wealthRevenue = natForecasts[0] ? Number(natForecasts[0].adjusted_revenue) : 42500000;
  const bankingRevenue = 36000000;
  const bottomUpSum = wealthRevenue + bankingRevenue;

  const { rows: companyForecastList } = await db.execute<any>(sql`
    SELECT * FROM company_forecasts
     WHERE period_label = ${periodLabel}
     ORDER BY version DESC LIMIT 1
  `);
  const active = companyForecastList[0] || null;

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

  const [row] = await db.insert(companyForecasts).values({
    id: forecastId,
    ceoEmployeeId: scope.employeeId,
    periodLabel: input.periodLabel,
    bottomUpSum: String(input.bottomUpSum),
    executiveMacroAdjustment: String(input.executiveMacroAdjustment),
    signedOffRevenue: String(signedOffRevenue),
    currency: input.currency,
    verticalSubmissions: input.verticalSubmissions,
    macroAssumptions: input.macroAssumptions,
    boardRiskNotes: input.boardRiskNotes || null,
    status,
    signedOffAt,
    version: 1,
  }).returning();
  return row;
}

// ─── CEO-06: Growth & Capacity Initiatives ───

export async function listGrowthInitiatives(scope: Scope, status?: string) {
  assertCeo(scope);
  const { rows } = await db.execute<any>(sql`
    SELECT * FROM growth_initiatives
     ${status ? sql`WHERE status = ${status}` : sql``}
     ORDER BY created_at DESC
  `);
  return rows;
}

export async function createGrowthInitiative(scope: Scope, input: CreateGrowthInitiativeInput) {
  assertCeo(scope);
  const initiativeId = id('GI');
  const [row] = await db.insert(growthInitiatives).values({
    id: initiativeId,
    ceoEmployeeId: scope.employeeId,
    title: input.title,
    vertical: input.vertical,
    initiativeType: input.initiativeType,
    capitalRequired: String(input.capitalRequired),
    currency: input.currency,
    projectedRoiPercent: String(input.projectedRoiPercent),
    timelineMonths: input.timelineMonths,
    sponsorExecutive: input.sponsorExecutive,
    justification: input.justification,
    implementationTasks: input.implementationTasks,
    status: 'proposed',
  }).returning();
  return row;
}

export async function approveGrowthInitiative(scope: Scope, input: ApproveGrowthInitiativeInput) {
  assertCeo(scope);
  const newStatus = input.approved ? 'approved_by_ceo' : 'rejected';
  const [row] = await db.update(growthInitiatives)
    .set({ status: newStatus, approvedAt: sql`now()` })
    .where(eq(growthInitiatives.id, input.initiativeId))
    .returning();
  if (!row) throw notFound();
  return row;
}

// ─── CEO-07: Resolve Cross-Vertical Conflict ───

export async function listCrossVerticalConflicts(scope: Scope) {
  assertCeo(scope);
  const { rows } = await db.execute<any>(sql`
    SELECT * FROM cross_vertical_conflicts ORDER BY created_at DESC
  `);
  return rows;
}

export async function arbitrateCrossVerticalConflict(scope: Scope, input: ArbitrateCrossVerticalConflictInput) {
  assertCeo(scope);
  const [row] = await db.update(crossVerticalConflicts)
    .set({
      status: 'resolved',
      ceoDetermination: input.ceoDetermination,
      resolvedAttribution: input.resolvedAttribution,
      awardedLeadId: input.awardedLeadId || null,
      resolvedAt: sql`now()`,
    })
    .where(eq(crossVerticalConflicts.id, input.conflictId))
    .returning();
  if (!row) throw notFound();
  return row;
}

// ─── CEO-08: Critical Complaints & Operating Risks ───

export async function listCriticalOperatingRisks(scope: Scope) {
  assertCeo(scope);
  const { rows } = await db.execute<any>(sql`
    SELECT * FROM critical_operating_risks ORDER BY created_at DESC
  `);
  return rows;
}

export async function createCriticalRisk(scope: Scope, input: CreateCriticalRiskInput) {
  assertCeo(scope);
  const riskId = id('COR');
  const [row] = await db.insert(criticalOperatingRisks).values({
    id: riskId,
    ceoEmployeeId: scope.employeeId,
    vertical: input.vertical,
    riskCategory: input.riskCategory,
    severity: input.severity,
    title: input.title,
    details: input.details,
    exposureAmount: input.exposureAmount ? String(input.exposureAmount) : null,
    accountableExecutive: input.accountableExecutive,
    decisionDeadline: new Date(input.decisionDeadline).toISOString(),
    mitigationMandate: input.mitigationMandate || null,
    status: 'open',
  }).returning();
  return row;
}

export async function resolveCriticalRisk(scope: Scope, input: ResolveCriticalRiskInput) {
  assertCeo(scope);
  const [row] = await db.update(criticalOperatingRisks)
    .set({
      status: 'resolved',
      mitigationMandate: input.mitigationOutcome,
      resolvedAt: sql`now()`,
    })
    .where(eq(criticalOperatingRisks.id, input.riskId))
    .returning();
  if (!row) throw notFound();
  return row;
}

// ─── CEO-09: National Manager Leadership Review ───

export async function listNmLeadershipReviews(scope: Scope, nmEmployeeId?: string) {
  assertCeo(scope);
  const { rows } = await db.execute<any>(sql`
    SELECT r.*, e.display_name AS nm_name
      FROM nm_leadership_reviews r
      JOIN employees e ON e.id = r.nm_employee_id
     ${nmEmployeeId ? sql`WHERE r.nm_employee_id = ${nmEmployeeId}` : sql``}
     ORDER BY r.created_at DESC
  `);
  return rows;
}

export async function saveNmLeadershipReview(scope: Scope, input: SaveNmLeadershipReviewInput) {
  assertCeo(scope);
  const reviewId = id('NLR');
  const [row] = await db.insert(nmLeadershipReviews).values({
    id: reviewId,
    ceoEmployeeId: scope.employeeId,
    nmEmployeeId: input.nmEmployeeId,
    vertical: input.vertical,
    periodLabel: input.periodLabel,
    overallLeadershipRating: input.overallLeadershipRating,
    strategicAlignment: input.strategicAlignment,
    operationalExecution: input.operationalExecution,
    teamHealthAndRetention: input.teamHealthAndRetention,
    boardVisibilityReadiness: input.boardVisibilityReadiness,
    strategicCommitments: input.strategicCommitments,
    supportFromCeo: input.supportFromCeo || null,
    nextReviewDate: input.nextReviewDate,
  }).returning();
  return row;
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
    criticalRisks: risks.filter((r: any) => r.status !== 'resolved'),
    commitments: commitments.filter((c: any) => c.status !== 'fulfilled'),
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

    doc.rect(40, 40, 515, 60).fill('#113F3D');
    doc.fillColor('#FFFFFF').fontSize(18).text('FINVERSE GROUP HOLDINGS', 55, 52);
    doc.fontSize(12).fillColor('#DCEEEA').text('Board of Directors & Executive Leadership Pack', 55, 75);

    doc.moveDown(4);
    doc.fillColor('#1B1F1E').fontSize(14).text(`Period: ${input.periodLabel}`, { underline: true });
    doc.fontSize(10).fillColor('#6B7280').text(`Audience: Board & Executive Committee | Sign-off: ${scope.displayName} (CEO) | Date: ${new Date().toLocaleDateString('en-IN')}`);
    doc.moveDown(1.5);

    doc.fillColor('#113F3D').fontSize(12).text('1. Enterprise Operating Picture & Attainment', { underline: true });
    doc.moveDown(0.5);
    doc.fillColor('#1B1F1E').fontSize(10)
      .text(`Total Enterprise Revenue Target: INR ${(preview.picture.kpis.totalRevenueTarget / 10000000).toFixed(1)} Cr`)
      .text(`Signed-off Revenue: INR ${(preview.picture.kpis.totalDeliveredRevenue / 10000000).toFixed(1)} Cr (${preview.picture.kpis.revenueAttainmentPercent}% attainment)`)
      .text(`Closed Wins: ${preview.picture.kpis.totalDeliveredWins} / ${preview.picture.kpis.totalWinsTarget} wins (${preview.picture.kpis.winsAttainmentPercent}%)`)
      .text(`Unallocated Strategic Buffer: INR ${(preview.picture.kpis.unallocatedRevenueBuffer / 10000000).toFixed(1)} Cr | ${preview.picture.kpis.unallocatedWinsBuffer} wins`);
    doc.moveDown(1.5);

    doc.fillColor('#113F3D').fontSize(12).text('2. Division Attainment & Gross Margins', { underline: true });
    doc.moveDown(0.5);
    preview.comparisons.forEach((c: any) => {
      doc.fillColor('#1B1F1E').fontSize(10).text(
        `• ${c.name}: Run-Rate INR ${(c.revenueRunRateInr / 10000000).toFixed(1)} Cr | Margin ${c.grossMarginPercent}% | CAC INR ${c.blendedCacInr.toLocaleString('en-IN')} | Headcount: ${c.fteCount} FTEs`
      );
    });
    doc.moveDown(1.5);

    doc.fillColor('#113F3D').fontSize(12).text('3. Strategic Growth Initiatives', { underline: true });
    doc.moveDown(0.5);
    preview.initiatives.forEach((gi: any) => {
      doc.fillColor('#1B1F1E').fontSize(10).text(
        `• [${gi.status.toUpperCase()}] ${gi.title} (${gi.vertical.toUpperCase()}): Capital INR ${(Number(gi.capital_required) / 10000000).toFixed(2)} Cr | ROI ${gi.projected_roi_percent}% | Sponsor: ${gi.sponsor_executive}`
      );
    });
    doc.moveDown(1.5);

    doc.fillColor('#113F3D').fontSize(12).text('4. Critical Operating Risks & Board Escalations', { underline: true });
    doc.moveDown(0.5);
    if (preview.criticalRisks.length === 0) {
      doc.fillColor('#6B7280').fontSize(10).text('No open critical operating or regulatory risks.');
    } else {
      preview.criticalRisks.forEach((r: any) => {
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
  const { rows } = await db.execute<any>(sql`
    SELECT * FROM board_report_schedules WHERE ceo_employee_id = ${scope.employeeId} ORDER BY created_at DESC
  `);
  return rows;
}

export async function saveBoardReportSchedule(scope: Scope, input: SaveBoardReportScheduleInput) {
  assertCeo(scope);
  const scheduleId = input.id || id('BRS');
  const [row] = await db.insert(boardReportSchedules)
    .values({
      id: scheduleId,
      ceoEmployeeId: scope.employeeId,
      title: input.title,
      frequency: input.frequency,
      deliveryCadence: input.deliveryCadence,
      stakeholders: input.stakeholders,
      sections: input.sections,
      status: input.status,
    })
    .onConflictDoUpdate({
      target: boardReportSchedules.id,
      set: {
        title: input.title,
        frequency: input.frequency,
        deliveryCadence: input.deliveryCadence,
        stakeholders: input.stakeholders,
        sections: input.sections,
        status: input.status,
      },
    })
    .returning();
  return row;
}

// ─── CEO-11: Executive Commitments & Actions Tracker ───

export async function listExecutiveCommitments(scope: Scope, status?: string) {
  assertCeo(scope);
  const { rows } = await db.execute<any>(sql`
    SELECT * FROM executive_commitments
     ${status ? sql`WHERE status = ${status}` : sql``}
     ORDER BY due_date ASC
  `);
  return rows;
}

export async function createExecutiveCommitment(scope: Scope, input: CreateExecutiveCommitmentInput) {
  assertCeo(scope);
  const commitId = id('EXC');
  const [row] = await db.insert(executiveCommitments).values({
    id: commitId,
    ceoEmployeeId: scope.employeeId,
    sourceAction: input.sourceAction,
    title: input.title,
    accountableLeader: input.accountableLeader,
    vertical: input.vertical,
    actionableMandate: input.actionableMandate,
    dueDate: input.dueDate,
    status: 'in_progress',
  }).returning();
  return row;
}

export async function fulfillExecutiveCommitment(scope: Scope, input: FulfillExecutiveCommitmentInput) {
  assertCeo(scope);
  const [row] = await db.update(executiveCommitments)
    .set({
      status: 'fulfilled',
      evidenceUrl: input.evidenceUrl || null,
      fulfilledAt: sql`now()`,
    })
    .where(eq(executiveCommitments.id, input.commitmentId))
    .returning();
  if (!row) throw notFound();
  return row;
}
