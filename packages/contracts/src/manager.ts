import { z } from 'zod';

export const MG_PERIODS = ['today', 'this-week', 'month-to-date', 'last-month', 'quarter-to-date'] as const;
export type MgPeriod = (typeof MG_PERIODS)[number];

// MG-01: Manager Overview
export const mgOverviewQuerySchema = z.object({
  period: z.enum(MG_PERIODS).default('month-to-date'),
  comparison: z.enum(['previous-period', 'same-period-last-year', 'target-pace']).default('previous-period'),
});
export type MgOverviewQuery = z.infer<typeof mgOverviewQuerySchema>;

// MG-01 / MG-02 / MG-08 / MG-11: Management Action
export const createManagementActionSchema = z.object({
  sourceAction: z.enum(['MG-01', 'MG-02', 'MG-08', 'MG-11']),
  kind: z.enum(['intervention', 'coaching', 'capacity', 'follow-up']),
  subjectTlEmployeeId: z.string().min(1, 'Select a team lead.'),
  ownerEmployeeId: z.string().min(1, 'Select an action owner.'),
  teamId: z.string().optional(),
  metricKey: z.string().optional(),
  periodLabel: z.string().optional(),
  title: z.string().trim().min(3, 'Enter a title (min 3 chars).').max(200),
  detail: z.string().trim().max(1000).optional(),
  dueAt: z.string().datetime({ message: 'Select a valid future due date.' }),
});
export type CreateManagementActionInput = z.infer<typeof createManagementActionSchema>;

// MG-03: Cross-Team Lead Transfer
export const createLeadTransferSchema = z.object({
  sourceTeamId: z.string().min(1, 'Source team is required.'),
  destinationTeamId: z.string().min(1, 'Destination team is required.'),
  leadIds: z.array(z.string()).min(1, 'Select at least one lead to transfer.'),
  reason: z.string().trim().min(5, 'Provide a valid transfer reason.').max(500),
});
export type CreateLeadTransferInput = z.infer<typeof createLeadTransferSchema>;

export const decideLeadTransferSchema = z.object({
  transferId: z.string().min(1),
  decision: z.enum(['approved', 'returned']),
  resolutionNotes: z.string().trim().min(3, 'Resolution note is required.'),
});
export type DecideLeadTransferInput = z.infer<typeof decideLeadTransferSchema>;

// MG-04: Capacity Recovery Plan
export const saveCapacityPlanSchema = z.object({
  name: z.string().trim().min(3, 'Plan name is required.'),
  periodLabel: z.string().default('October'),
  teamIds: z.array(z.string()).min(1, 'Select teams in scope.'),
  currentBacklog: z.number().int().nonnegative(),
  availableCallers: z.number().int().nonnegative(),
  plannedReallocations: z.array(
    z.object({
      fromTeamId: z.string(),
      toTeamId: z.string(),
      leadCount: z.number().int().positive(),
    })
  ).default([]),
  requiredAdditionalStaff: z.number().int().nonnegative().default(0),
  operationalDeadline: z.string().optional(),
  notes: z.string().trim().max(1000).optional(),
  approved: z.boolean().default(false),
});
export type SaveCapacityPlanInput = z.infer<typeof saveCapacityPlanSchema>;

// MG-05: Allocate Manager Targets to TLs
export const allocateManagerTargetSchema = z.object({
  periodLabel: z.string().min(1, 'Period is required.'),
  metric: z.string().default('approved-wins'),
  approvedParentTarget: z.number().positive('Parent target must be positive.'),
  tlAllocations: z.array(
    z.object({
      teamId: z.string().min(1),
      tlEmployeeId: z.string().min(1),
      allocatedValue: z.number().nonnegative('Allocation must be non-negative.'),
      prorateNote: z.string().optional(),
    })
  ).min(1, 'Allocate to at least one TL.'),
  publish: z.boolean().default(false),
});
export type AllocateManagerTargetInput = z.infer<typeof allocateManagerTargetSchema>;

// MG-06: TL Forecast Review Decision
export const decideTlForecastSchema = z.object({
  forecastId: z.string().min(1),
  decision: z.enum(['accepted', 'returned']),
  feedback: z.string().trim().min(5, 'Feedback/correction details are required.'),
});
export type DecideTlForecastInput = z.infer<typeof decideTlForecastSchema>;

// MG-07: Submit Manager Forecast to RM
export const submitManagerForecastSchema = z.object({
  periodLabel: z.string().min(1, 'Period is required.'),
  bottomUpRevenue: z.number().nonnegative(),
  managementAdjustment: z.number().default(0),
  adjustedRevenue: z.number().nonnegative(),
  currency: z.string().default('INR'),
  acceptedForecastIds: z.array(z.string()).min(1, 'At least one accepted TL forecast is required.'),
  overrideReason: z.string().optional(),
  riskNotes: z.string().trim().min(3, 'Identify risks (capacity, ageing, etc.).').max(1000),
});
export type SubmitManagerForecastInput = z.infer<typeof submitManagerForecastSchema>;

// MG-08: Resolve Repeated SLA Failure
export const resolveSlaBreachSchema = z.object({
  escalationId: z.string().min(1),
  actionType: z.enum(['corrective-action', 'capacity-change', 'coaching', 'escalate-to-rm']),
  resolutionPlan: z.string().trim().min(10, 'Provide a clear recovery plan and accountable owner.'),
  deadlineHours: z.number().int().positive().default(48),
  assigneeEmployeeId: z.string().optional(),
});
export type ResolveSlaBreachInput = z.infer<typeof resolveSlaBreachSchema>;

// MG-09: Approve Delegated Commercial Exception
export const decideCommercialExceptionSchema = z.object({
  exceptionId: z.string().min(1),
  decision: z.enum(['approved', 'rejected', 'escalated_to_rm']),
  decisionNotes: z.string().trim().min(5, 'Decision notes are required.'),
  delegatedLimitMet: z.boolean().default(true),
});
export type DecideCommercialExceptionInput = z.infer<typeof decideCommercialExceptionSchema>;

// MG-10: Source Quality Remediation Request
export const createSourceRemediationSchema = z.object({
  sourceName: z.string().min(1, 'Source name is required.'),
  cohortPeriod: z.string().min(1, 'Cohort period is required.'),
  sampleSize: z.number().int().positive('Sample size must be greater than zero.'),
  invalidIntakeCount: z.number().int().nonnegative().default(0),
  contactFailedCount: z.number().int().nonnegative().default(0),
  commercialLossCount: z.number().int().nonnegative().default(0),
  remediationType: z.enum(['routing-change', 'intake-correction', 'quality-warning', 'pause-source']),
  justification: z.string().trim().min(10, 'Provide data-backed justification for remediation.'),
});
export type CreateSourceRemediationInput = z.infer<typeof createSourceRemediationSchema>;

// MG-11: TL Performance Review
export const createTlPerformanceReviewSchema = z.object({
  subjectTlEmployeeId: z.string().min(1, 'Select a TL.'),
  periodLabel: z.string().min(1, 'Period is required.'),
  strengths: z.string().trim().min(5, 'Strengths are required.'),
  blockers: z.string().trim().min(5, 'Blockers/challenges are required.'),
  commitments: z.array(
    z.object({
      dimension: z.string(),
      goal: z.string(),
      targetDate: z.string(),
    })
  ).min(1, 'Record at least one commitment.'),
  supportNeeded: z.string().optional(),
});
export type CreateTlPerformanceReviewInput = z.infer<typeof createTlPerformanceReviewSchema>;

// MG-12: Employee Transfers or Promotions
export const createEmployeeLifecycleSchema = z.object({
  employeeId: z.string().min(1, 'Select an employee.'),
  proposedRole: z.enum(['SC', 'TL', 'MG']),
  proposedTeamId: z.string().optional(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD required'),
  businessJustification: z.string().trim().min(10, 'Provide a business justification.'),
  handoffPlan: z.string().trim().min(10, 'Specify workload, open leads, and targets handoff plan.'),
});
export type CreateEmployeeLifecycleInput = z.infer<typeof createEmployeeLifecycleSchema>;

// MG-13: Manager Meeting Pack PDF & Recurring Schedule
export const managerMeetingPackQuerySchema = z.object({
  period: z.enum(['this-week', 'month-to-date', 'quarter-to-date', 'last-month']).default('month-to-date'),
});
export type ManagerMeetingPackQuery = z.infer<typeof managerMeetingPackQuerySchema>;

export const managerReportScheduleSchema = z.object({
  name: z.string().trim().min(3, 'Name is required.'),
  cadence: z.enum(['weekly', 'monthly']),
  period: z.enum(['this-week', 'month-to-date', 'quarter-to-date']),
  recipients: z.array(z.string().email()).min(1, 'At least one recipient email required.'),
});
export type ManagerReportScheduleInput = z.infer<typeof managerReportScheduleSchema>;
