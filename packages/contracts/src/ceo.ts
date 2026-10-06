import { z } from 'zod';

export const CEO_PERIODS = ['month-to-date', 'quarter-to-date', 'fiscal-year-to-date', 'last-fiscal-year'] as const;
export type CeoPeriod = (typeof CEO_PERIODS)[number];

// CEO-01: Company Operating Picture
export const ceoOperatingQuerySchema = z.object({
  period: z.enum(CEO_PERIODS).default('month-to-date'),
  focusVertical: z.enum(['all', 'wealth', 'banking', 'markets', 'real-estate']).default('all'),
});
export type CeoOperatingQuery = z.infer<typeof ceoOperatingQuerySchema>;

// CEO-02: Vertical Comparison
export const ceoVerticalCompareQuerySchema = z.object({
  period: z.enum(CEO_PERIODS).default('month-to-date'),
});
export type CeoVerticalCompareQuery = z.infer<typeof ceoVerticalCompareQuerySchema>;

// CEO-03: National Manager Contribution Review
export const ceoNmQuerySchema = z.object({
  nmEmployeeId: z.string().min(1, 'Select a National Manager.'),
  period: z.string().default('October 2026'),
});
export type CeoNmQuery = z.infer<typeof ceoNmQuerySchema>;

// CEO-04: Approve Company & Vertical Targets
export const approveCompanyTargetSchema = z.object({
  periodLabel: z.string().min(1, 'Period label is required (e.g. October).'),
  fiscalYear: z.string().default('FY2026-27'),
  totalRevenueTarget: z.number().positive('Total revenue target must be positive.'),
  totalWinsTarget: z.number().int().positive('Total wins target must be positive.'),
  verticalAllocations: z.array(
    z.object({
      vertical: z.enum(['wealth', 'banking', 'markets', 'real-estate']),
      revenueTarget: z.number().nonnegative(),
      winsTarget: z.number().int().nonnegative(),
      nmEmployeeId: z.string().nullable().optional(),
      nmName: z.string().nullable().optional(),
    })
  ).min(1, 'Allocate targets across at least one vertical.'),
  boardRatify: z.boolean().default(false),
});
export type ApproveCompanyTargetInput = z.infer<typeof approveCompanyTargetSchema>;

// CEO-05: Sign-Off Consolidated Company Forecast
export const signOffCompanyForecastSchema = z.object({
  periodLabel: z.string().min(1, 'Period label is required.'),
  bottomUpSum: z.number().nonnegative(),
  executiveMacroAdjustment: z.number().default(0),
  currency: z.string().default('INR'),
  verticalSubmissions: z.array(
    z.object({
      vertical: z.string(),
      reportedRevenue: z.number(),
      status: z.string(),
    })
  ).default([]),
  macroAssumptions: z.string().trim().min(5, 'Document board macro assumptions.').max(1500),
  boardRiskNotes: z.string().trim().max(1000).optional(),
  signOff: z.boolean().default(false),
});
export type SignOffCompanyForecastInput = z.infer<typeof signOffCompanyForecastSchema>;

// CEO-06: Growth & Capacity Initiatives
export const createGrowthInitiativeSchema = z.object({
  title: z.string().trim().min(5, 'Initiative title required.').max(200),
  vertical: z.enum(['wealth', 'banking', 'markets', 'real-estate']),
  initiativeType: z.enum(['geographic_expansion', 'digital_channel', 'talent_surge', 'product_launch']),
  capitalRequired: z.number().positive('Capital amount required.'),
  currency: z.string().default('INR'),
  projectedRoiPercent: z.number().positive(),
  timelineMonths: z.number().int().positive(),
  sponsorExecutive: z.string().trim().min(2),
  justification: z.string().trim().min(10).max(2000),
  implementationTasks: z.array(z.string()).default([]),
});
export type CreateGrowthInitiativeInput = z.infer<typeof createGrowthInitiativeSchema>;

export const approveGrowthInitiativeSchema = z.object({
  initiativeId: z.string().min(1),
  approved: z.boolean(),
  executiveRemarks: z.string().trim().min(3).max(500),
});
export type ApproveGrowthInitiativeInput = z.infer<typeof approveGrowthInitiativeSchema>;

// CEO-07: Resolve Cross-Vertical Conflict
export const arbitrateCrossVerticalConflictSchema = z.object({
  conflictId: z.string().min(1),
  ceoDetermination: z.string().trim().min(10, 'Executive determination is required.').max(1000),
  awardedVertical: z.enum(['wealth', 'banking', 'markets', 'real-estate', 'shared']),
  resolvedAttribution: z.string().trim().min(3).max(500),
  awardedLeadId: z.string().optional(),
});
export type ArbitrateCrossVerticalConflictInput = z.infer<typeof arbitrateCrossVerticalConflictSchema>;

// CEO-08: Critical Operating Risks & Complaints
export const createCriticalRiskSchema = z.object({
  vertical: z.enum(['wealth', 'banking', 'markets', 'real-estate']),
  riskCategory: z.enum(['regulatory_breach', 'client_litigation', 'reputational_loss', 'operational_failure']),
  severity: z.enum(['high', 'critical', 'existential']),
  title: z.string().trim().min(5).max(200),
  details: z.string().trim().min(10).max(2000),
  exposureAmount: z.number().nonnegative().optional(),
  accountableExecutive: z.string().trim().min(2),
  decisionDeadline: z.string().datetime({ message: 'Valid deadline required.' }),
  mitigationMandate: z.string().trim().max(1000).optional(),
});
export type CreateCriticalRiskInput = z.infer<typeof createCriticalRiskSchema>;

export const resolveCriticalRiskSchema = z.object({
  riskId: z.string().min(1),
  mitigationOutcome: z.string().trim().min(5).max(1000),
});
export type ResolveCriticalRiskInput = z.infer<typeof resolveCriticalRiskSchema>;

// CEO-09: National Manager Leadership Review
export const saveNmLeadershipReviewSchema = z.object({
  nmEmployeeId: z.string().min(1, 'Select a National Manager.'),
  vertical: z.enum(['wealth', 'banking', 'markets', 'real-estate']),
  periodLabel: z.string().min(1),
  overallLeadershipRating: z.enum(['role_model', 'strong_performer', 'developing', 'off_track']),
  strategicAlignment: z.string().trim().min(5).max(1000),
  operationalExecution: z.string().trim().min(5).max(1000),
  teamHealthAndRetention: z.string().trim().min(5).max(1000),
  boardVisibilityReadiness: z.string().trim().min(5).max(1000),
  strategicCommitments: z.array(z.string()).default([]),
  supportFromCeo: z.string().trim().max(1000).optional(),
  nextReviewDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid YYYY-MM-DD date required.'),
});
export type SaveNmLeadershipReviewInput = z.infer<typeof saveNmLeadershipReviewSchema>;

// CEO-10: Board & Executive Meeting Pack PDF & Schedules
export const generateBoardPackPdfSchema = z.object({
  periodLabel: z.string().default('October 2026'),
  sections: z.array(z.string()).default([
    'company-performance',
    'vertical-comparison',
    'growth-initiatives',
    'operating-risks',
    'executive-commitments',
  ]),
});
export type GenerateBoardPackPdfInput = z.infer<typeof generateBoardPackPdfSchema>;

export const saveBoardReportScheduleSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(3).max(120),
  frequency: z.enum(['monthly', 'quarterly', 'annual']),
  deliveryCadence: z.string().trim().min(3).max(120),
  stakeholders: z.array(z.string().email()).min(1),
  sections: z.array(z.string()).min(1),
  status: z.enum(['active', 'paused']).default('active'),
});
export type SaveBoardReportScheduleInput = z.infer<typeof saveBoardReportScheduleSchema>;

// CEO-11: Executive Commitments & Actions Tracker
export const createExecutiveCommitmentSchema = z.object({
  sourceAction: z.enum(['CEO-01', 'CEO-02', 'CEO-06', 'CEO-07', 'CEO-08', 'CEO-11']),
  title: z.string().trim().min(5).max(200),
  accountableLeader: z.string().trim().min(2),
  vertical: z.enum(['wealth', 'banking', 'markets', 'real-estate', 'all']).default('all'),
  actionableMandate: z.string().trim().min(10).max(1000),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid YYYY-MM-DD date required.'),
});
export type CreateExecutiveCommitmentInput = z.infer<typeof createExecutiveCommitmentSchema>;

export const fulfillExecutiveCommitmentSchema = z.object({
  commitmentId: z.string().min(1),
  evidenceUrl: z.string().trim().optional(),
  fulfillmentNotes: z.string().trim().min(3).max(500),
});
export type FulfillExecutiveCommitmentInput = z.infer<typeof fulfillExecutiveCommitmentSchema>;
