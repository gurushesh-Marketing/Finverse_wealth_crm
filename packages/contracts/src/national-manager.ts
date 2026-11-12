import { z } from 'zod';

export const NM_PERIODS = ['today', 'this-week', 'month-to-date', 'last-month', 'quarter-to-date'] as const;
export type NmPeriod = (typeof NM_PERIODS)[number];

// NM-01: National Overview
export const nmOverviewQuerySchema = z.object({
  period: z.enum(NM_PERIODS).default('month-to-date'),
  comparison: z.enum(['target-pace', 'previous-period', 'same-period-last-year']).default('target-pace'),
});
export type NmOverviewQuery = z.infer<typeof nmOverviewQuerySchema>;

// NM-01 / NM-02 / NM-09 / NM-10: National Management Action
export const createNationalActionSchema = z.object({
  sourceAction: z.enum(['NM-01', 'NM-02', 'NM-09', 'NM-10']),
  kind: z.enum(['regional-directive', 'rm-coaching', 'resource-rebalancing', 'policy-compliance']),
  subjectRmEmployeeId: z.string().min(1, 'Select an accountable Regional Manager.'),
  ownerEmployeeId: z.string().min(1, 'Select an action owner.'),
  regionId: z.string().optional(),
  metricKey: z.string().optional(),
  periodLabel: z.string().optional(),
  title: z.string().trim().min(3, 'Title must be at least 3 characters.').max(200),
  detail: z.string().trim().max(1000).optional(),
  dueAt: z.string().datetime({ message: 'Select a valid future due date.' }),
});
export type CreateNationalActionInput = z.infer<typeof createNationalActionSchema>;

// NM-02: Regional Comparison Query
export const nmRegionQuerySchema = z.object({
  regionId: z.string().optional(),
  period: z.string().default('September'),
});
export type NmRegionQuery = z.infer<typeof nmRegionQuerySchema>;

// NM-03: National Target Allocation
export const allocateNationalTargetSchema = z.object({
  periodLabel: z.string().min(1, 'Period label is required (e.g. October).'),
  metric: z.string().default('approved-wins').optional(),
  approvedCeoTarget: z.number().positive('Approved CEO target must be positive.'),
  regionalAllocations: z.array(
    z.object({
      regionId: z.string().min(1),
      regionName: z.string().optional(),
      rmEmployeeId: z.string().optional(),
      rmName: z.string().optional(),
      targetWins: z.number().int().nonnegative(),
    })
  ).min(1, 'Allocate targets to at least one region.'),
  publish: z.boolean().default(false),
});
export type AllocateNationalTargetInput = z.infer<typeof allocateNationalTargetSchema>;

// NM-04: National Economics Query
export const nmEconomicsQuerySchema = z.object({
  period: z.string().default('month-to-date'),
});
export type NmEconomicsQuery = z.infer<typeof nmEconomicsQuerySchema>;

// NM-05: Product & Pipeline Rule Proposals
export const proposeProductRuleSchema = z.object({
  ruleName: z.string().trim().min(3, 'Rule name is required.'),
  currentVersion: z.string().trim().min(1, 'Current version is required.'),
  proposedVersion: z.string().trim().min(1, 'Proposed version is required.'),
  reason: z.string().trim().min(5, 'Reason for modification is required.').max(500),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid YYYY-MM-DD date required.'),
  affectedProducts: z.array(z.string()).min(1, 'Select at least one affected product.'),
  previewImpact: z.string().trim().min(5, 'Describe projected impact on pipeline.').max(1000),
});
export type ProposeProductRuleInput = z.infer<typeof proposeProductRuleSchema>;

// NM-06: National Forecast Consolidation (Rollup to CEO/CFO)
export const submitNationalForecastSchema = z.object({
  periodLabel: z.string().min(1, 'Period label is required.'),
  bottomUpRevenue: z.number().nonnegative(),
  nationalAdjustment: z.number().default(0),
  currency: z.string().default('INR'),
  acceptedRegionalForecastIds: z.array(z.string()).default([]),
  topNationalRisks: z.array(z.string()).default([]),
  nationalAssumptions: z.string().trim().min(5, 'State executive assumptions.').max(1000),
  submitToExecutives: z.boolean().default(false),
});
export type SubmitNationalForecastInput = z.infer<typeof submitNationalForecastSchema>;

// NM-07: Cross-Region Work Transfers
export const createCrossRegionTransferSchema = z.object({
  sourceRegionId: z.string().min(1, 'Source region is required.'),
  destinationRegionId: z.string().min(1, 'Destination region is required.'),
  leadIds: z.array(z.string()).min(1, 'Select at least one lead to rebalance.'),
  reason: z.string().trim().min(5, 'Transfer rationale is required.').max(500),
  handoffPlan: z.string().trim().min(5, 'Handoff and SLAs must be specified.').max(500),
});
export type CreateCrossRegionTransferInput = z.infer<typeof createCrossRegionTransferSchema>;

export const decideCrossRegionTransferSchema = z.object({
  transferId: z.string().min(1),
  decision: z.enum(['approved', 'rejected']),
  resolutionNotes: z.string().trim().min(3, 'Resolution note is required.'),
});
export type DecideCrossRegionTransferInput = z.infer<typeof decideCrossRegionTransferSchema>;

// NM-08: Cross-Vertical Inbound Referrals
export const decideCrossVerticalReferralSchema = z.object({
  referralId: z.string().min(1),
  decision: z.enum(['accepted', 'declined']),
  targetTeamId: z.string().optional(),
  targetOwnerEmployeeId: z.string().optional(),
  declineReason: z.string().trim().optional(),
});
export type DecideCrossVerticalReferralInput = z.infer<typeof decideCrossVerticalReferralSchema>;

// NM-09: National Strategic Escalations (Dual Executive Routing)
export const createNationalEscalationSchema = z.object({
  category: z.enum(['revenue_assumption', 'strategic_exception', 'pricing_policy', 'governance_risk']),
  targetExecutive: z.enum(['CEO', 'CFO', 'BOTH']),
  title: z.string().trim().min(5, 'Title must be at least 5 characters.').max(200),
  detail: z.string().trim().min(10, 'Provide comprehensive detail.').max(2000),
  evidenceSummary: z.string().trim().max(1000).optional(),
  decisionDeadline: z.string().datetime({ message: 'Valid deadline required.' }),
});
export type CreateNationalEscalationInput = z.infer<typeof createNationalEscalationSchema>;

export const resolveNationalEscalationSchema = z.object({
  escalationId: z.string().min(1),
  executiveDecision: z.string().trim().min(5, 'Executive decision statement is required.'),
});
export type ResolveNationalEscalationInput = z.infer<typeof resolveNationalEscalationSchema>;

// NM-10: Regional Manager Periodic Review
export const saveRmReviewSchema = z.object({
  rmEmployeeId: z.string().min(1, 'Regional Manager is required.'),
  periodLabel: z.string().min(1, 'Period label is required.'),
  performanceRating: z.enum(['exceeding', 'achieving', 'needs_improvement', 'critical']),
  strengths: z.string().trim().min(5, 'Document strengths.').max(1000),
  blockers: z.string().trim().min(5, 'Document blockers and gaps.').max(1000),
  growthCommitments: z.array(z.string()).default([]),
  coverageCommitments: z.array(z.string()).default([]),
  supportNeeded: z.string().trim().max(1000).optional(),
  privateNmNotes: z.string().trim().max(1000).optional(),
  nextReviewDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid YYYY-MM-DD date required.'),
});
export type SaveRmReviewInput = z.infer<typeof saveRmReviewSchema>;

// NM-11: National Executive Report Schedules & PDF Export
export const generateNationalPdfPackSchema = z.object({
  periodLabel: z.string().default('October 2026'),
  sections: z.array(z.string()).default(['regional-rollup', 'attainment', 'pipeline-health', 'risks']),
});
export type GenerateNationalPdfPackInput = z.infer<typeof generateNationalPdfPackSchema>;

export const saveNationalReportScheduleSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(3, 'Report name is required.').max(100),
  periodType: z.enum(['monthly', 'quarterly', 'half-yearly', 'annual']),
  cadence: z.string().trim().min(3, 'Cadence description is required.').max(100),
  recipients: z.array(z.string().email()).min(1, 'Provide at least one recipient email.'),
  sections: z.array(z.string()).min(1, 'Select at least one report section.'),
  status: z.enum(['active', 'paused']).default('active'),
});
export type SaveNationalReportScheduleInput = z.infer<typeof saveNationalReportScheduleSchema>;
