import { z } from 'zod';

export const RM_PERIODS = ['today', 'this-week', 'month-to-date', 'last-month', 'quarter-to-date'] as const;
export type RmPeriod = (typeof RM_PERIODS)[number];

// RM-01: Regional Overview
export const rmOverviewQuerySchema = z.object({
  period: z.enum(RM_PERIODS).default('month-to-date'),
  comparison: z.enum(['target-pace', 'previous-period', 'same-period-last-year']).default('target-pace'),
});
export type RmOverviewQuery = z.infer<typeof rmOverviewQuerySchema>;

// RM-01 / RM-02 / RM-08 / RM-09: Regional Management Action
export const createRegionalActionSchema = z.object({
  sourceAction: z.enum(['RM-01', 'RM-02', 'RM-08', 'RM-09']),
  kind: z.enum(['regional-intervention', 'manager-coaching', 'capacity-reallocation', 'sla-recovery']),
  subjectManagerEmployeeId: z.string().min(1, 'Select an accountable manager.'),
  ownerEmployeeId: z.string().min(1, 'Select an action owner.'),
  regionId: z.string().optional(),
  metricKey: z.string().optional(),
  periodLabel: z.string().optional(),
  title: z.string().trim().min(3, 'Title must be at least 3 characters.').max(200),
  detail: z.string().trim().max(1000).optional(),
  dueAt: z.string().datetime({ message: 'Select a valid future due date.' }),
});
export type CreateRegionalActionInput = z.infer<typeof createRegionalActionSchema>;

// RM-02: Manager Scorecard Query
export const rmManagerQuerySchema = z.object({
  managerId: z.string().min(1, 'Manager ID is required.'),
  period: z.string().default('September'),
});
export type RmManagerQuery = z.infer<typeof rmManagerQuerySchema>;

// RM-03: Territory Coverage Plan
export const saveTerritoryPlanSchema = z.object({
  id: z.string().optional(),
  territoryName: z.string().trim().min(3, 'Territory name is required.'),
  subRegion: z.string().trim().min(3, 'Sub-region is required.'),
  productScope: z.string().trim().min(3, 'Product scope is required.'),
  languageQueues: z.array(z.string()).default([]),
  targetTeamIds: z.array(z.string()).min(1, 'Select at least one destination team.'),
  capacityGap: z.number().int().nonnegative().default(0),
  routingProposal: z.string().trim().min(5, 'Provide a detailed routing proposal.'),
  activationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid YYYY-MM-DD date required.'),
  status: z.enum(['draft', 'submitted_for_activation', 'activated']).default('draft'),
});
export type SaveTerritoryPlanInput = z.infer<typeof saveTerritoryPlanSchema>;

// RM-04: Regional Target Allocation
export const allocateRegionalTargetSchema = z.object({
  periodLabel: z.string().min(1, 'Period label is required (e.g. October).'),
  metric: z.string().default('approved-wins').optional(),
  approvedNmTarget: z.number().positive('Approved NM target must be positive.'),
  managerAllocations: z.array(
    z.object({
      managerEmployeeId: z.string().min(1),
      managerName: z.string().optional(),
      targetWins: z.number().int().nonnegative(),
    })
  ).min(1, 'Allocate targets to at least one manager.'),
  publish: z.boolean().default(false),
});
export type AllocateRegionalTargetInput = z.infer<typeof allocateRegionalTargetSchema>;

// RM-05: Cross-Manager Lead Transfer
export const createCrossManagerTransferSchema = z.object({
  sourceManagerEmployeeId: z.string().min(1, 'Source manager is required.'),
  destinationManagerEmployeeId: z.string().min(1, 'Destination manager is required.'),
  sourceTeamId: z.string().min(1, 'Source team is required.'),
  destinationTeamId: z.string().min(1, 'Destination team is required.'),
  leadIds: z.array(z.string()).min(1, 'Select at least one lead to transfer.'),
  reason: z.string().trim().min(5, 'Transfer justification is required.').max(500),
  forecastImpactNotes: z.string().trim().max(500).optional(),
});
export type CreateCrossManagerTransferInput = z.infer<typeof createCrossManagerTransferSchema>;

export const decideCrossManagerTransferSchema = z.object({
  transferId: z.string().min(1),
  decision: z.enum(['approved', 'rejected']),
  resolutionNotes: z.string().trim().min(3, 'Resolution note is required.'),
});
export type DecideCrossManagerTransferInput = z.infer<typeof decideCrossManagerTransferSchema>;

// RM-06: Regional Staffing Plan
export const saveRegionalStaffingPlanSchema = z.object({
  id: z.string().optional(),
  periodLabel: z.string().default('October'),
  plannedHeadcount: z.number().int().nonnegative(),
  approvedHeadcount: z.number().int().nonnegative(),
  activeHeadcount: z.number().int().nonnegative(),
  requisitions: z.array(
    z.object({
      title: z.string().min(3),
      teamId: z.string(),
      count: z.number().int().positive(),
      justification: z.string().min(3),
      priority: z.enum(['low', 'normal', 'high']),
    })
  ).default([]),
  businessJustification: z.string().trim().min(5, 'Business justification is required.'),
  status: z.enum(['draft', 'approved_by_rm', 'submitted_to_hr', 'active']).default('draft'),
});
export type SaveRegionalStaffingPlanInput = z.infer<typeof saveRegionalStaffingPlanSchema>;

// RM-07: Regional Forecast Submission
export const submitRegionalForecastSchema = z.object({
  periodLabel: z.string().min(1, 'Period is required.'),
  regionalAdjustment: z.number().default(0),
  regionalAssumptions: z.string().trim().min(5, 'Regional assumptions are required.'),
  topRegionalRisks: z.array(
    z.object({
      title: z.string().min(2),
      severity: z.enum(['low', 'medium', 'high', 'critical']),
      impact: z.string().optional(),
    })
  ).default([]),
  acceptedManagerForecastIds: z.array(z.string()).min(1, 'At least one accepted Manager forecast required.'),
  submitToNm: z.boolean().default(false),
});
export type SubmitRegionalForecastInput = z.infer<typeof submitRegionalForecastSchema>;

// RM-08: Regional Escalations & Exceptions
export const createRegionalEscalationSchema = z.object({
  sourceType: z.enum(['commercial_exception', 'source_quality', 'sla_breach', 'operational_risk']),
  sourceId: z.string().optional(),
  title: z.string().trim().min(3, 'Escalation title required.').max(200),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  accountableManagerEmployeeId: z.string().optional(),
  detail: z.string().trim().min(5, 'Detail explanation is required.'),
  deadline: z.string().optional(),
});
export type CreateRegionalEscalationInput = z.infer<typeof createRegionalEscalationSchema>;

export const resolveRegionalEscalationSchema = z.object({
  escalationId: z.string().min(1),
  decision: z.enum(['recovery_plan_assigned', 'resolved', 'escalated_to_nm']),
  recoveryDecision: z.string().trim().min(5, 'Recovery decision / mitigation details required.'),
  deadline: z.string().optional(),
});
export type ResolveRegionalEscalationInput = z.infer<typeof resolveRegionalEscalationSchema>;

// RM-09: Manager Review
export const saveManagerReviewSchema = z.object({
  managerEmployeeId: z.string().min(1, 'Select a manager.'),
  periodLabel: z.string().min(1, 'Period is required (e.g. Q3 2026).'),
  performanceRating: z.enum(['exceeding', 'achieving', 'needs_improvement', 'critical']),
  strengths: z.string().trim().min(5, 'Strengths documentation is required.'),
  blockers: z.string().trim().min(5, 'Blockers documentation is required.'),
  improvementCommitments: z.array(z.string()).min(1, 'At least one commitment is required.'),
  supportActions: z.string().trim().max(1000).optional(),
  privateRmNotes: z.string().trim().max(1000).optional(),
  nextReviewDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid YYYY-MM-DD date required.'),
  acknowledged: z.boolean().default(false),
});
export type SaveManagerReviewInput = z.infer<typeof saveManagerReviewSchema>;

// RM-10: Regional Report Schedules & PDF Pack
export const generateRegionalPdfPackSchema = z.object({
  period: z.string().default('October 2026'),
  sections: z.array(z.string()).min(1, 'Select at least one report section.'),
  title: z.string().default('Regional Performance & Governance Review Pack'),
});
export type GenerateRegionalPdfPackInput = z.infer<typeof generateRegionalPdfPackSchema>;

export const saveRegionalReportScheduleSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(3).max(80),
  periodType: z.enum(['weekly', 'monthly', 'quarterly']),
  cadence: z.string().trim().min(3).max(80),
  recipients: z.array(z.string().trim().email()).min(1, 'At least one email recipient is required.'),
  sections: z.array(z.string()).min(1, 'At least one section is required.'),
  status: z.enum(['active', 'paused']).default('active'),
});
export type SaveRegionalReportScheduleInput = z.infer<typeof saveRegionalReportScheduleSchema>;
