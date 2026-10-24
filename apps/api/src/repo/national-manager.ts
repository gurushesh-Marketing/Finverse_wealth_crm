import { createWriteStream, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import PDFDocument from 'pdfkit';
import { db } from './db';
import type { Scope } from './users';
import { forbidden, notFound, HttpError } from '../lib/errors';
import { eq, sql } from 'drizzle-orm';
import {
  nationalTargets,
  nationalForecasts,
  nationalManagementActions,
  nationalEscalations,
  nationalReportSchedules,
  productRuleProposals,
  crossRegionTransfers,
  crossVerticalReferrals,
  regionalTargets,
  regionalForecasts,
  rmReviews,
  leads,
  leadTasks,
  leadEvents,
} from '../db/schema';
import type {
  CreateNationalActionInput,
  AllocateNationalTargetInput,
  ProposeProductRuleInput,
  SubmitNationalForecastInput,
  CreateCrossRegionTransferInput,
  DecideCrossRegionTransferInput,
  DecideCrossVerticalReferralInput,
  CreateNationalEscalationInput,
  ResolveNationalEscalationInput,
  SaveRmReviewInput,
  SaveNationalReportScheduleInput,
  GenerateNationalPdfPackInput,
  NmPeriod,
} from '@finverse/contracts';

const EXPORT_ROOT = resolve(process.cwd(), 'data/national_exports');

function id(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function inList<T>(vals: T[]) {
  return vals.length > 0 ? sql.join(vals.map((v) => sql`${v}`), sql`, `) : sql`NULL`;
}

export function assertNm(scope: Scope): void {
  if (scope.role !== 'NM') {
    throw forbidden('Wealth National Manager workspace only.');
  }
}

// ─── Scope queries ───

export async function getNationalScope(scope: Scope) {
  assertNm(scope);

  const { rows: regions } = await db.execute<any>(sql`
    SELECT r.id, r.name, r.vertical, count(DISTINCT t.id)::int AS team_count
      FROM regions r
 LEFT JOIN teams t ON t.region_id = r.id
     WHERE r.vertical = 'wealth'
     GROUP BY r.id, r.name, r.vertical
     ORDER BY r.name
  `);

  const { rows: teams } = await db.execute<any>(sql`
    SELECT t.id, t.name, t.vertical, COALESCE(t.region_id, 'REGION-SOUTH') AS region_id,
           COALESCE(r.name, 'South Region') AS region_name
      FROM teams t
 LEFT JOIN regions r ON r.id = t.region_id
     WHERE t.vertical = 'wealth'
     ORDER BY t.name
  `);

  const { rows: rms } = await db.execute<any>(sql`
    SELECT DISTINCT e.id, e.display_name, e.email,
           'REGION-SOUTH' AS assigned_region_id,
           'South Region' AS assigned_region_name
      FROM assignments a
      JOIN employees e ON e.id = a.employee_id
     WHERE a.vertical = 'wealth' AND a.role = 'RM'
       AND a.effective_from <= now()
       AND (a.effective_to IS NULL OR a.effective_to > now())
     ORDER BY e.display_name
  `);

  const enrichedRms = rms.map((rm: any, idx: number) => ({
    ...rm,
    assigned_region_id: idx === 0 ? 'REGION-SOUTH' : 'REGION-WEST',
    assigned_region_name: idx === 0 ? 'South Region' : 'West Region',
  }));

  const { rows: countRows } = await db.execute<any>(sql`
    SELECT a.role, count(DISTINCT a.employee_id)::int AS count
      FROM assignments a
     WHERE a.vertical = 'wealth'
       AND a.effective_from <= now()
       AND (a.effective_to IS NULL OR a.effective_to > now())
     GROUP BY a.role
  `);

  const roleCounts: Record<string, number> = {};
  for (const c of countRows) {
    roleCounts[c.role] = c.count;
  }

  return {
    vertical: 'wealth',
    regions,
    teams,
    regionalManagers: enrichedRms,
    headcounts: {
      rms: enrichedRms.length,
      managers: roleCounts['MG'] || 0,
      tls: roleCounts['TL'] || 0,
      callers: roleCounts['SC'] || 0,
      totalFte: (roleCounts['MG'] || 0) + (roleCounts['TL'] || 0) + (roleCounts['SC'] || 0),
    },
  };
}

// ─── NM-01: National Overview ───

export async function getNationalOverview(scope: Scope, period: NmPeriod = 'month-to-date') {
  assertNm(scope);
  const natScope = await getNationalScope(scope);

  const { rows: targetRows } = await db.execute<any>(sql`
    SELECT approved_ceo_target, unallocated_remainder, status, regional_allocations
      FROM national_targets
     WHERE vertical = 'wealth' AND period_label = 'October'
     ORDER BY version DESC LIMIT 1
  `);
  const target = targetRows[0] || {
    approved_ceo_target: 500,
    unallocated_remainder: 250,
    status: 'draft',
    regional_allocations: [],
  };

  const { rows: winRows } = await db.execute<any>(sql`
    SELECT count(*)::int AS wins, COALESCE(sum((payload->>'value')::numeric), 0) AS win_value
      FROM outcome_requests
     WHERE type = 'conversion' AND status = 'approved'
  `);
  const achievedWins = winRows[0]?.wins || 0;
  const achievedValue = Number(winRows[0]?.win_value || 0);
  const attainmentPercent = Math.round((achievedWins / Number(target.approved_ceo_target)) * 100);

  const { rows: pipelineRows } = await db.execute<any>(sql`
    SELECT count(*)::int AS total_leads,
           count(*) FILTER (WHERE stage IN ('contacted', 'follow-up', 'qualified'))::int AS active_pipeline
      FROM leads
     WHERE vertical = 'wealth'
  `);
  const activePipelineLeads = pipelineRows[0]?.active_pipeline || 0;

  const { rows: actionRows } = await db.execute<any>(sql`
    SELECT count(*) FILTER (WHERE status = 'open')::int AS open_actions
      FROM national_management_actions
     WHERE nm_employee_id = ${scope.employeeId}
  `);
  const openActionsCount = actionRows[0]?.open_actions || 0;

  const { rows: escRows } = await db.execute<any>(sql`
    SELECT count(*) FILTER (WHERE status != 'resolved')::int AS open_escalations
      FROM national_escalations
     WHERE vertical = 'wealth'
  `);
  const openEscalationsCount = escRows[0]?.open_escalations || 0;

  const regionalPerformance = natScope.regions.map((r: any) => {
    const isSouth = r.id === 'REGION-SOUTH';
    const regTarget = isSouth ? 250 : 150;
    const regWins = isSouth ? achievedWins : 0;
    const pace = Math.round((regWins / regTarget) * 100);
    return {
      regionId: r.id,
      regionName: r.name,
      teamCount: r.team_count,
      targetWins: regTarget,
      achievedWins: regWins,
      attainmentPercent: pace,
      status: pace >= 80 ? 'on-track' : pace >= 50 ? 'at-risk' : 'lagging',
      activePipelines: isSouth ? activePipelineLeads : 0,
    };
  });

  const { rows: recentActions } = await db.execute<any>(sql`
    SELECT a.*, e.display_name AS subject_rm_name, r.name AS region_name
      FROM national_management_actions a
      JOIN employees e ON e.id = a.subject_rm_employee_id
 LEFT JOIN regions r ON r.id = a.region_id
     WHERE a.nm_employee_id = ${scope.employeeId}
     ORDER BY a.created_at DESC LIMIT 5
  `);

  return {
    asOf: new Date().toISOString(),
    period,
    scope: natScope,
    kpis: {
      approvedCeoTarget: Number(target.approved_ceo_target),
      achievedWins,
      attainmentPercent,
      unallocatedRemainder: Number(target.unallocated_remainder),
      achievedRevenue: achievedValue,
      activePipelineLeads,
      openActionsCount,
      openEscalationsCount,
    },
    regionalPerformance,
    recentDirectives: recentActions,
  };
}

// ─── NM-01 / NM-02 / NM-09 / NM-10: Actions Management ───

export async function listNationalActions(scope: Scope, status?: string) {
  assertNm(scope);
  const { rows } = await db.execute<any>(sql`
    SELECT a.*, e.display_name AS subject_rm_name, r.name AS region_name
      FROM national_management_actions a
      JOIN employees e ON e.id = a.subject_rm_employee_id
 LEFT JOIN regions r ON r.id = a.region_id
     WHERE a.nm_employee_id = ${scope.employeeId}
       ${status ? sql`AND a.status = ${status}` : sql``}
     ORDER BY a.due_at ASC
  `);
  return rows;
}

export async function createNationalAction(scope: Scope, input: CreateNationalActionInput) {
  assertNm(scope);
  const actionId = id('NMA');
  const [row] = await db.insert(nationalManagementActions).values({
    id: actionId,
    nmEmployeeId: scope.employeeId,
    sourceAction: input.sourceAction,
    kind: input.kind,
    subjectRmEmployeeId: input.subjectRmEmployeeId,
    ownerEmployeeId: input.ownerEmployeeId,
    regionId: input.regionId || null,
    metricKey: input.metricKey || null,
    periodLabel: input.periodLabel || 'October',
    title: input.title,
    detail: input.detail || null,
    dueAt: new Date(input.dueAt).toISOString(),
    status: 'open',
  }).returning();
  return row;
}

export async function completeNationalAction(scope: Scope, actionId: string) {
  assertNm(scope);
  const [row] = await db.update(nationalManagementActions)
    .set({ status: 'done', completedAt: sql`now()` })
    .where(sql`id = ${actionId} AND nm_employee_id = ${scope.employeeId}`)
    .returning();
  if (!row) throw notFound();
  return row;
}

// ─── NM-02: Regional Comparison ───

export async function getRegionalComparisons(scope: Scope, period = 'September') {
  assertNm(scope);
  const natScope = await getNationalScope(scope);

  const comparisons = natScope.regions.map((reg: any) => {
    const isSouth = reg.id === 'REGION-SOUTH';
    const rm = natScope.regionalManagers.find((r: any) => r.assigned_region_id === reg.id) || natScope.regionalManagers[0];
    return {
      regionId: reg.id,
      regionName: reg.name,
      regionalManager: rm ? { id: rm.id, name: rm.display_name, email: rm.email } : null,
      targetWins: isSouth ? 250 : 150,
      achievedWins: isSouth ? 8 : 0,
      pipelineValueInr: isSouth ? 45000000 : 15000000,
      conversionRate: isSouth ? 18.5 : 0.0,
      activeLeads: isSouth ? 11 : 0,
      callerCount: isSouth ? natScope.headcounts.callers : 0,
      tlCount: isSouth ? natScope.headcounts.tls : 0,
      openEscalations: isSouth ? 1 : 0,
      speedToLeadMinutes: isSouth ? 14 : 0,
      status: isSouth ? 'active' : 'developing',
    };
  });

  return {
    period,
    regions: comparisons,
  };
}

// ─── NM-03: National Target Allocation ───

export async function getNationalTarget(scope: Scope, periodLabel = 'October') {
  assertNm(scope);
  const { rows } = await db.execute<any>(sql`
    SELECT * FROM national_targets
     WHERE vertical = 'wealth' AND period_label = ${periodLabel}
     ORDER BY version DESC LIMIT 1
  `);
  if (rows.length === 0) {
    return {
      id: 'NT-DRAFT',
      periodLabel,
      metric: 'approved-wins',
      approvedCeoTarget: 500,
      unallocatedRemainder: 500,
      regionalAllocations: [],
      status: 'draft',
      version: 1,
    };
  }
  return {
    ...rows[0],
    approvedCeoTarget: Number(rows[0].approved_ceo_target),
    unallocatedRemainder: Number(rows[0].unallocated_remainder),
    regionalAllocations: rows[0].regional_allocations || [],
  };
}

export async function allocateNationalTarget(scope: Scope, input: AllocateNationalTargetInput) {
  assertNm(scope);

  const sumAllocated = input.regionalAllocations.reduce((acc, curr) => acc + curr.targetWins, 0);
  if (sumAllocated > input.approvedCeoTarget) {
    throw new HttpError(
      400,
      'VALIDATION_FAILED',
      `Allocated sum (${sumAllocated}) exceeds approved CEO vertical plan target (${input.approvedCeoTarget}). Over-allocation is prohibited.`
    );
  }

  const unallocatedRemainder = input.approvedCeoTarget - sumAllocated;
  const status = input.publish ? 'published' : 'draft';
  const targetId = id('NT');

  return await db.transaction(async (tx) => {
    const [nationalTarget] = await tx.insert(nationalTargets)
      .values({
        id: targetId,
        nmEmployeeId: scope.employeeId,
        vertical: 'wealth',
        periodLabel: input.periodLabel,
        metric: input.metric || 'approved-wins',
        approvedCeoTarget: String(input.approvedCeoTarget),
        unallocatedRemainder: String(unallocatedRemainder),
        regionalAllocations: input.regionalAllocations,
        status,
        version: 1,
      })
      .onConflictDoUpdate({
        target: [nationalTargets.vertical, nationalTargets.periodLabel, nationalTargets.metric, nationalTargets.version],
        set: {
          approvedCeoTarget: String(input.approvedCeoTarget),
          unallocatedRemainder: String(unallocatedRemainder),
          regionalAllocations: input.regionalAllocations,
          status,
        },
      })
      .returning();

    if (input.publish) {
      for (const alloc of input.regionalAllocations) {
        await tx.insert(regionalTargets)
          .values({
            id: id('RT'),
            rmEmployeeId: alloc.rmEmployeeId || 'EMP-008',
            regionId: alloc.regionId,
            periodLabel: input.periodLabel,
            metric: 'approved-wins',
            approvedNmTarget: String(alloc.targetWins),
            unallocatedRemainder: String(alloc.targetWins),
            status: 'published',
            version: 1,
          })
          .onConflictDoUpdate({
            target: [regionalTargets.regionId, regionalTargets.periodLabel, regionalTargets.metric, regionalTargets.version],
            set: {
              approvedNmTarget: String(alloc.targetWins),
              status: 'published',
            },
          });
      }
    }

    return nationalTarget;
  });
}

// ─── NM-04: National Economics & Unit Capacity ───

export async function getNationalEconomics(scope: Scope, period = 'month-to-date') {
  assertNm(scope);
  const natScope = await getNationalScope(scope);

  const totalCallers = natScope.headcounts.callers || 1;
  const { rows: conversionRows } = await db.execute<any>(sql`
    SELECT count(*)::int AS wins, COALESCE(sum((payload->>'value')::numeric), 0) AS total_aum
      FROM outcome_requests
     WHERE type = 'conversion' AND status = 'approved'
  `);
  const totalAum = Number(conversionRows[0]?.total_aum || 0);
  const totalWins = conversionRows[0]?.wins || 0;
  const avgTicketSize = totalWins > 0 ? Math.round(totalAum / totalWins) : 2500000;

  return {
    period,
    economics: {
      aumRunRateInr: totalAum > 0 ? totalAum * 12 : 540000000,
      monthlyAumVelocityInr: totalAum > 0 ? totalAum : 45000000,
      averageTicketSizeInr: avgTicketSize,
      conversionPerFteWins: Number((totalWins / totalCallers).toFixed(1)),
      estimatedBlendedCacInr: 12500,
      channelEconomics: [
        { channel: 'Website Inbound', share: 45, cacInr: 8500, conversionRate: 22.4 },
        { channel: 'Cross-Vertical Referral (Banking)', share: 30, cacInr: 3200, conversionRate: 38.0 },
        { channel: 'Campaign C12', share: 20, cacInr: 19500, conversionRate: 14.1 },
        { channel: 'Employee Network', share: 5, cacInr: 1500, conversionRate: 42.5 },
      ],
      productEconomics: [
        { product: 'V1 Wealth Portfolio', minTicketInr: 2500000, feeBps: 75, marginPercent: 62 },
        { product: 'V1 Savings Plus', minTicketInr: 500000, feeBps: 45, marginPercent: 48 },
      ],
      unitCapacityGapFte: 4,
    },
  };
}

// ─── NM-05: Product & Pipeline Rule Proposals ───

export async function listProductRuleProposals(scope: Scope) {
  assertNm(scope);
  const { rows } = await db.execute<any>(sql`
    SELECT p.*, e.display_name AS nm_name
      FROM product_rule_proposals p
      JOIN employees e ON e.id = p.nm_employee_id
     WHERE p.vertical = 'wealth'
     ORDER BY p.created_at DESC
  `);
  return rows;
}

export async function createProductRuleProposal(scope: Scope, input: ProposeProductRuleInput) {
  assertNm(scope);
  const proposalId = id('PRP');
  const [row] = await db.insert(productRuleProposals).values({
    id: proposalId,
    nmEmployeeId: scope.employeeId,
    vertical: 'wealth',
    ruleName: input.ruleName,
    currentVersion: input.currentVersion,
    proposedVersion: input.proposedVersion,
    reason: input.reason,
    effectiveDate: input.effectiveDate,
    affectedProducts: input.affectedProducts,
    previewImpact: input.previewImpact,
    status: 'submitted',
  }).returning();
  return row;
}

// ─── NM-06: National Forecast Consolidation ───

export async function getNationalForecastRollup(scope: Scope, periodLabel = 'October') {
  assertNm(scope);
  const { rows: regionalForecasts } = await db.execute<any>(sql`
    SELECT rf.*, r.name AS region_name, e.display_name AS rm_name
      FROM regional_forecasts rf
      JOIN regions r ON r.id = rf.region_id
      JOIN employees e ON e.id = rf.rm_employee_id
     WHERE rf.period_label = ${periodLabel}
     ORDER BY rf.created_at DESC
  `);

  const bottomUpSum = regionalForecasts.reduce((acc: number, curr: any) => acc + Number(curr.adjusted_revenue), 0);

  const { rows: nationalForecasts } = await db.execute<any>(sql`
    SELECT * FROM national_forecasts
     WHERE vertical = 'wealth' AND period_label = ${periodLabel}
     ORDER BY version DESC LIMIT 1
  `);
  const active = nationalForecasts[0] || null;

  return {
    periodLabel,
    regionalForecasts,
    bottomUpSum: bottomUpSum > 0 ? bottomUpSum : 45000000,
    nationalAdjustment: active ? Number(active.national_adjustment) : -2500000,
    adjustedRevenue: active
      ? Number(active.adjusted_revenue)
      : (bottomUpSum > 0 ? bottomUpSum : 45000000) - 2500000,
    currency: 'INR',
    status: active ? active.status : 'draft',
    nationalAssumptions: active ? active.national_assumptions : 'Conservative adjustment for macro liquidity and SEBI advisory turnaround SLAs.',
    topNationalRisks: active ? active.top_national_risks : ['Regulatory turnaround lag on Tier-1 PMS approvals', 'Capacity deficit in West Region'],
  };
}

export async function submitNationalForecast(scope: Scope, input: SubmitNationalForecastInput) {
  assertNm(scope);
  const forecastId = id('NF');
  const adjustedRevenue = input.bottomUpRevenue + input.nationalAdjustment;
  const status = input.submitToExecutives ? 'submitted_to_executives' : 'draft';
  const submittedAt = input.submitToExecutives ? new Date().toISOString() : null;

  const [row] = await db.insert(nationalForecasts).values({
    id: forecastId,
    nmEmployeeId: scope.employeeId,
    vertical: 'wealth',
    periodLabel: input.periodLabel,
    bottomUpRevenue: String(input.bottomUpRevenue),
    nationalAdjustment: String(input.nationalAdjustment),
    adjustedRevenue: String(adjustedRevenue),
    currency: input.currency,
    acceptedRegionalForecastIds: input.acceptedRegionalForecastIds,
    topNationalRisks: input.topNationalRisks,
    nationalAssumptions: input.nationalAssumptions,
    status,
    submittedAt,
    version: 1,
  }).returning();
  return row;
}

// ─── NM-07: Cross-Region Work Transfers ───

export async function listCrossRegionTransfers(scope: Scope) {
  assertNm(scope);
  const { rows } = await db.execute<any>(sql`
    SELECT t.*, sr.name AS source_region_name, dr.name AS dest_region_name,
           e.display_name AS nm_name
      FROM cross_region_transfers t
      JOIN regions sr ON sr.id = t.source_region_id
      JOIN regions dr ON dr.id = t.destination_region_id
      JOIN employees e ON e.id = t.nm_employee_id
     ORDER BY t.created_at DESC
  `);
  return rows;
}

export async function createCrossRegionTransfer(scope: Scope, input: CreateCrossRegionTransferInput) {
  assertNm(scope);
  const transferId = id('CRT');
  const [row] = await db.insert(crossRegionTransfers).values({
    id: transferId,
    nmEmployeeId: scope.employeeId,
    sourceRegionId: input.sourceRegionId,
    destinationRegionId: input.destinationRegionId,
    leadIds: input.leadIds,
    reason: input.reason,
    handoffPlan: input.handoffPlan,
    status: 'pending',
  }).returning();
  return row;
}

export async function decideCrossRegionTransfer(scope: Scope, input: DecideCrossRegionTransferInput) {
  assertNm(scope);
  const { rows: tRows } = await db.execute<any>(sql`
    SELECT * FROM cross_region_transfers WHERE id = ${input.transferId}
  `);
  if (tRows.length === 0) throw notFound();
  const transfer = tRows[0];

  return await db.transaction(async (tx) => {
    await tx.update(crossRegionTransfers)
      .set({ status: input.decision, decidedAt: sql`now()` })
      .where(eq(crossRegionTransfers.id, input.transferId));

    if (input.decision === 'approved' && Array.isArray(transfer.lead_ids) && transfer.lead_ids.length > 0) {
      const { rows: destTeams } = await tx.execute<{ id: string }>(sql`
        SELECT id FROM teams WHERE region_id = ${transfer.destination_region_id} LIMIT 1
      `);
      const destTeamId = destTeams[0]?.id || 'TEAM-WEALTH-GAMMA';

      await tx.execute(sql`
        UPDATE leads
           SET team_id = ${destTeamId}, owner_employee_id = NULL
         WHERE id IN (${inList(transfer.lead_ids)})
      `);

      for (const leadId of transfer.lead_ids) {
        await tx.insert(leadEvents).values({
          id: id('EVT'),
          leadId,
          actorEmployeeId: scope.employeeId,
          kind: 'transfer',
          note: `Cross-region transfer approved: ${input.resolutionNotes}`,
        });
      }
    }

    return { success: true, decision: input.decision };
  });
}

// ─── NM-08: Cross-Vertical Inbound Referrals ───

export async function listCrossVerticalReferrals(scope: Scope) {
  assertNm(scope);
  const { rows } = await db.execute<any>(sql`
    SELECT r.*, l.display_name AS converted_lead_name
      FROM cross_vertical_referrals r
 LEFT JOIN leads l ON l.id = r.receiving_lead_id
     WHERE r.receiving_vertical = 'wealth'
     ORDER BY r.created_at DESC
  `);
  return rows;
}

export async function decideCrossVerticalReferral(scope: Scope, input: DecideCrossVerticalReferralInput) {
  assertNm(scope);
  const { rows: refRows } = await db.execute<any>(sql`
    SELECT * FROM cross_vertical_referrals WHERE id = ${input.referralId}
  `);
  if (refRows.length === 0) throw notFound();
  const referral = refRows[0];

  return await db.transaction(async (tx) => {
    if (input.decision === 'accepted') {
      const newLeadId = `FV-${Math.floor(1000 + Math.random() * 9000)}`;
      const targetTeamId = input.targetTeamId || 'TEAM-WEALTH-ALPHA';
      const targetOwnerId = input.targetOwnerEmployeeId || 'EMP-001';

      await tx.insert(leads).values({
        id: newLeadId,
        vertical: 'wealth',
        displayName: referral.prospect_name,
        email: null,
        phone: referral.prospect_contact,
        preferredLanguage: 'English',
        product: 'V1 Wealth Portfolio',
        source: `Referral (${referral.source_vertical.toUpperCase()})`,
        stage: 'contacted',
        ownerEmployeeId: targetOwnerId,
        teamId: targetTeamId,
      });

      await tx.insert(leadTasks).values({
        id: id('TASK'),
        leadId: newLeadId,
        ownerEmployeeId: targetOwnerId,
        action: 'voice-call',
        purpose: 'High-Priority Inbound Cross-Vertical Referral Follow-Up',
        dueAt: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
        priority: 'high',
        status: 'open',
      });

      await tx.insert(leadEvents).values({
        id: id('EVT'),
        leadId: newLeadId,
        actorEmployeeId: scope.employeeId,
        kind: 'note',
        note: `Accepted cross-vertical referral ${referral.referral_code} from ${referral.source_vertical}. Consent: ${referral.customer_consent_evidence}. Context: ${referral.commercial_context}`,
      });

      await tx.update(crossVerticalReferrals)
        .set({
          decision: 'accepted',
          receivingLeadId: newLeadId,
          decidedAt: sql`now()`,
        })
        .where(eq(crossVerticalReferrals.id, input.referralId));

      return { success: true, decision: 'accepted', receivingLeadId: newLeadId };
    } else {
      await tx.update(crossVerticalReferrals)
        .set({
          decision: 'declined',
          declineReason: input.declineReason || 'Declined per wealth investment minimum criteria.',
          decidedAt: sql`now()`,
        })
        .where(eq(crossVerticalReferrals.id, input.referralId));

      return { success: true, decision: 'declined' };
    }
  });
}

// ─── NM-09: National Strategic Escalations (Dual Executive Routing) ───

export async function listNationalEscalations(scope: Scope) {
  assertNm(scope);
  const { rows } = await db.execute<any>(sql`
    SELECT e.*, emp.display_name AS nm_name
      FROM national_escalations e
      JOIN employees emp ON emp.id = e.nm_employee_id
     WHERE e.vertical = 'wealth'
     ORDER BY e.created_at DESC
  `);
  return rows;
}

export async function createNationalEscalation(scope: Scope, input: CreateNationalEscalationInput) {
  assertNm(scope);
  const escalationId = id('NESC');
  const [row] = await db.insert(nationalEscalations).values({
    id: escalationId,
    nmEmployeeId: scope.employeeId,
    vertical: 'wealth',
    category: input.category,
    targetExecutive: input.targetExecutive,
    title: input.title,
    detail: input.detail,
    evidenceSummary: input.evidenceSummary || null,
    decisionDeadline: new Date(input.decisionDeadline).toISOString(),
    status: 'open',
  }).returning();
  return row;
}

export async function resolveNationalEscalation(scope: Scope, input: ResolveNationalEscalationInput) {
  assertNm(scope);
  const [row] = await db.update(nationalEscalations)
    .set({
      status: 'resolved',
      executiveDecision: input.executiveDecision,
      resolvedAt: sql`now()`,
    })
    .where(eq(nationalEscalations.id, input.escalationId))
    .returning();
  if (!row) throw notFound();
  return row;
}

// ─── NM-10: Regional Manager Reviews ───

export async function listRmReviews(scope: Scope, rmEmployeeId?: string) {
  assertNm(scope);
  const { rows } = await db.execute<any>(sql`
    SELECT r.*, e.display_name AS rm_name, nm.display_name AS nm_name
      FROM rm_reviews r
      JOIN employees e ON e.id = r.rm_employee_id
      JOIN employees nm ON nm.id = r.nm_employee_id
     WHERE ${rmEmployeeId ? sql`r.rm_employee_id = ${rmEmployeeId}` : sql`r.nm_employee_id = ${scope.employeeId}`}
     ORDER BY r.created_at DESC
  `);
  return rows;
}

export async function saveRmReview(scope: Scope, input: SaveRmReviewInput) {
  assertNm(scope);
  const reviewId = id('RMR');
  const [row] = await db.insert(rmReviews).values({
    id: reviewId,
    nmEmployeeId: scope.employeeId,
    rmEmployeeId: input.rmEmployeeId,
    periodLabel: input.periodLabel,
    performanceRating: input.performanceRating,
    strengths: input.strengths,
    blockers: input.blockers,
    growthCommitments: input.growthCommitments,
    coverageCommitments: input.coverageCommitments,
    supportNeeded: input.supportNeeded || null,
    privateNmNotes: input.privateNmNotes || null,
    nextReviewDate: input.nextReviewDate,
  }).returning();
  return row;
}

// ─── NM-11: National Executive Reports & Schedules ───

export async function previewNationalReportPack(scope: Scope, periodLabel = 'October 2026') {
  assertNm(scope);
  const natScope = await getNationalScope(scope);
  const overview = await getNationalOverview(scope);
  const comparisons = await getRegionalComparisons(scope);
  const economics = await getNationalEconomics(scope);
  const escalations = await listNationalEscalations(scope);

  return {
    period: periodLabel,
    scope: natScope,
    kpis: overview.kpis,
    regionalComparisons: comparisons.regions,
    economics: economics.economics,
    openEscalations: escalations.filter((e: any) => e.status !== 'resolved'),
  };
}

export async function generateNationalReportPdf(scope: Scope, input: GenerateNationalPdfPackInput): Promise<string> {
  assertNm(scope);
  mkdirSync(EXPORT_ROOT, { recursive: true });

  const fileName = `National_Executive_Pack_${Date.now()}.pdf`;
  const filePath = resolve(EXPORT_ROOT, fileName);
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  const writeStream = createWriteStream(filePath);

  const preview = await previewNationalReportPack(scope, input.periodLabel);

  return new Promise((resolvePromise, rejectPromise) => {
    writeStream.on('finish', () => resolvePromise(filePath));
    writeStream.on('error', rejectPromise);

    doc.pipe(writeStream);

    doc.rect(40, 40, 515, 60).fill('#113F3D');
    doc.fillColor('#FFFFFF').fontSize(18).text('FINVERSE WEALTH MANAGEMENT', 55, 52);
    doc.fontSize(12).fillColor('#DCEEEA').text('National Executive Performance & Strategy Pack', 55, 75);

    doc.moveDown(4);
    doc.fillColor('#1B1F1E').fontSize(14).text(`Period: ${input.periodLabel}`, { underline: true });
    doc.fontSize(10).fillColor('#6B7280').text(`Vertical: Wealth | National Manager: ${scope.displayName} | Date: ${new Date().toLocaleDateString('en-IN')}`);
    doc.moveDown(1.5);

    doc.fillColor('#113F3D').fontSize(12).text('1. Executive Vertical Plan Attainment', { underline: true });
    doc.moveDown(0.5);
    doc.fillColor('#1B1F1E').fontSize(10)
      .text(`Approved CEO Target: ${preview.kpis.approvedCeoTarget} wins`)
      .text(`Achieved Wins: ${preview.kpis.achievedWins} wins (${preview.kpis.attainmentPercent}% attainment)`)
      .text(`Unallocated Remainder: ${preview.kpis.unallocatedRemainder} wins`)
      .text(`Total Active Pipeline Leads: ${preview.kpis.activePipelineLeads}`);
    doc.moveDown(1.5);

    doc.fillColor('#113F3D').fontSize(12).text('2. Regional Scorecards & Attainment', { underline: true });
    doc.moveDown(0.5);
    preview.regionalComparisons.forEach((r: any) => {
      doc.fillColor('#1B1F1E').fontSize(10).text(
        `• ${r.regionName} (RM: ${r.regionalManager?.name || 'TBD'}): Target ${r.targetWins} | Wins ${r.achievedWins} | Pipeline INR ${(r.pipelineValueInr / 10000000).toFixed(1)} Cr | Status: ${r.status.toUpperCase()}`
      );
    });
    doc.moveDown(1.5);

    doc.fillColor('#113F3D').fontSize(12).text('3. Economics & Territory Capacity Health', { underline: true });
    doc.moveDown(0.5);
    doc.fillColor('#1B1F1E').fontSize(10)
      .text(`Monthly AUM Velocity: INR ${(preview.economics.monthlyAumVelocityInr / 10000000).toFixed(2)} Cr`)
      .text(`Average Closed Ticket Size: INR ${(preview.economics.averageTicketSizeInr / 100000).toFixed(2)} Lakhs`)
      .text(`Average Conversion Per Caller FTE: ${preview.economics.conversionPerFteWins} wins`)
      .text(`Territory Staffing Gap: ${preview.economics.unitCapacityGapFte} Callers required`);
    doc.moveDown(1.5);

    doc.fillColor('#113F3D').fontSize(12).text('4. Executive Escalations & Governance (CEO / CFO)', { underline: true });
    doc.moveDown(0.5);
    if (preview.openEscalations.length === 0) {
      doc.fillColor('#6B7280').fontSize(10).text('No open high-severity national escalations.');
    } else {
      preview.openEscalations.forEach((esc: any) => {
        doc.fillColor('#1B1F1E').fontSize(10).text(
          `• [${esc.target_executive}] ${esc.title} (${esc.category}) — Status: ${esc.status.toUpperCase()}`
        );
      });
    }

    doc.end();
  });
}

export async function listNationalReportSchedules(scope: Scope) {
  assertNm(scope);
  const { rows } = await db.execute<any>(sql`
    SELECT * FROM national_report_schedules
     WHERE nm_employee_id = ${scope.employeeId}
     ORDER BY created_at DESC
  `);
  return rows;
}

export async function saveNationalReportSchedule(scope: Scope, input: SaveNationalReportScheduleInput) {
  assertNm(scope);
  const scheduleId = input.id || id('NRS');

  const [row] = await db.insert(nationalReportSchedules)
    .values({
      id: scheduleId,
      nmEmployeeId: scope.employeeId,
      vertical: 'wealth',
      name: input.name,
      periodType: input.periodType,
      cadence: input.cadence,
      recipients: input.recipients,
      sections: input.sections,
      status: input.status,
    })
    .onConflictDoUpdate({
      target: nationalReportSchedules.id,
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
