import { z } from 'zod';

export const ROLES = ['SC', 'TL', 'MG', 'RM', 'NM', 'CEO', 'CFO', 'DE', 'HR', 'SA'] as const;
export type Role = (typeof ROLES)[number];

export const VERTICALS = ['wealth', 'banking', 'markets', 'real-estate'] as const;
export type Vertical = (typeof VERTICALS)[number];

export const STAGES = [
  'new',
  'not-contacted',
  'contacted',
  'follow-up',
  'qualified',
  'converted',
  'lost',
] as const;
export type Stage = (typeof STAGES)[number];

export const TASK_ACTIONS = [
  'voice-call',
  'whatsapp',
  'email',
  'meeting',
  'document-check',
  'other',
] as const;
export type TaskAction = (typeof TASK_ACTIONS)[number];

export const TASK_PRIORITIES = ['low', 'normal', 'high'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_STATUSES = ['open', 'completed', 'cancelled'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const LEAD_DUE_STATUSES = ['overdue', 'today', 'upcoming', 'none'] as const;
export type DueStatus = (typeof LEAD_DUE_STATUSES)[number];

export const ERROR_CODES = [
  'INVALID_CREDENTIALS',
  'UNAUTHENTICATED',
  'NOT_FOUND',
  'FORBIDDEN',
  'VALIDATION_FAILED',
  'DUPLICATE_OPEN_TASK',
  'RATE_LIMITED',
  'MEDIA_TYPE',
  'INTERNAL',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export interface WorkspaceSession {
  employeeId: string;
  displayName: string;
  role: Role;
  activeAssignmentId: string;
  verticalGrants: Vertical[];
  teamGrants: string[];
  allowedActions: string[];
  effectiveFrom: string;
  permissionVersion: string;
}

export interface ErrorDetails {
  fieldErrors?: Record<string, string[]>;
}

export interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetails;
  };
}

export const loginRequestSchema = z.object({
  email: z.string().trim().min(1, 'Enter your work email.'),
  password: z.string().min(1, 'Enter your password.'),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export interface SessionResponse {
  session: WorkspaceSession;
}

export const leadsQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  stage: z.enum(STAGES).optional(),
  due: z.enum(['overdue', 'today', 'upcoming']).optional(),
  source: z.string().trim().max(100).optional(),
  product: z.string().trim().max(100).optional(),
});
export type LeadsQuery = z.infer<typeof leadsQuerySchema>;

export interface LeadSummary {
  id: string;
  displayName: string;
  product: string;
  source: string;
  stage: Stage;
  ownerName: string;
  teamName: string;
  nextActionAt: string | null;
  dueStatus: DueStatus;
}

export interface TimelineEvent {
  id: string;
  kind: 'follow-up-scheduled' | 'task-updated' | 'note';
  actorName: string;
  note: string;
  occurredAt: string;
}

export interface LeadTask {
  id: string;
  leadId: string;
  action: TaskAction;
  purpose: string;
  dueAt: string;
  priority: TaskPriority;
  status: TaskStatus;
  createdAt: string;
}

export interface LeadDetail {
  id: string;
  displayName: string;
  phone: string;
  email: string | null;
  preferredLanguage: string;
  product: string;
  source: string;
  stage: Stage;
  ownerName: string;
  teamName: string;
  nextActionAt: string | null;
  dueStatus: DueStatus;
  recordVersion: number;
  createdAt: string;
  tasks: LeadTask[];
  timeline: TimelineEvent[];
}

export const followUpInputSchema = z.object({
  action: z.enum(TASK_ACTIONS, {
    errorMap: () => ({ message: 'Choose an action.' }),
  }),
  purpose: z
    .string()
    .trim()
    .min(3, 'Purpose must be at least 3 characters.')
    .max(200, 'Purpose must be at most 200 characters.'),
  dueAt: z.string().min(1, 'Choose a date and time.'),
  priority: z.enum(TASK_PRIORITIES).default('normal'),
  reminderMinutes: z.union([
    z.literal(5),
    z.literal(15),
    z.literal(30),
    z.literal(60),
  ]).optional(),
});
export type FollowUpInput = z.infer<typeof followUpInputSchema>;

export interface FollowUpResult {
  task: LeadTask;
  timeline: TimelineEvent;
}

export interface MyDayResponse {
  asOf: string;
  counts: {
    overdue: number;
    dueToday: number;
    upcoming: number;
    activeLeads: number;
  };
  nextTasks: LeadTask[];
  availability: { status: AvailabilityStatus; effectiveFrom: string } | null;
}

export function toZodFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

/* ---- Wealth Caller SC-01..SC-28 contracts ---- */

export const AVAILABILITY_STATUSES = ['available', 'busy', 'away'] as const;
export type AvailabilityStatus = (typeof AVAILABILITY_STATUSES)[number];

export const availabilityChangeSchema = z.object({
  status: z.enum(AVAILABILITY_STATUSES),
  note: z.string().trim().max(200).optional(),
});
export type AvailabilityChangeInput = z.infer<typeof availabilityChangeSchema>;

export const savedViewSchema = z.object({
  name: z.string().trim().min(1, 'Name the view.').max(60),
  filters: leadsQuerySchema,
});
export type SavedViewInput = z.infer<typeof savedViewSchema>;

export interface SavedView {
  id: string;
  name: string;
  filters: LeadsQuery;
  createdAt: string;
}

export const prospectCorrectionSchema = z.object({
  displayName: z.string().trim().min(1).max(100).optional(),
  phone: z.string().trim().min(5).max(30).optional(),
  email: z.string().trim().email('Enter a valid email.').optional().or(z.literal('')),
  preferredLanguage: z.string().trim().min(1).max(40).optional(),
  reason: z.string().trim().min(3, 'Explain the correction (at least 3 characters).').max(200),
});
export type ProspectCorrectionInput = z.infer<typeof prospectCorrectionSchema>;

export interface AuditEntry {
  id: string;
  field: string;
  beforeValue: string | null;
  afterValue: string | null;
  reason: string;
  actorName: string;
  occurredAt: string;
}

export const enquirySchema = z.object({
  displayName: z.string().trim().min(1, 'Prospect name is required.').max(100),
  phone: z.string().trim().min(5, 'Phone is required.').max(30),
  email: z.string().trim().email('Enter a valid email.').optional().or(z.literal('')),
  product: z.string().trim().min(1, 'Choose a V1 product.'),
  source: z.string().trim().min(1, 'Choose a source.'),
  permissionEvidence: z.string().trim().min(3, 'Record permission evidence (reference and date).').max(200),
  need: z.string().trim().min(3, 'Describe the customer requirement.').max(500),
});
export type EnquiryInput = z.infer<typeof enquirySchema>;

export interface Enquiry {
  id: string;
  displayName: string;
  status: 'pending-validation' | 'published' | 'duplicate' | 'invalid';
  duplicateOf: string | null;
  publishedLeadId: string | null;
  createdAt: string;
}

export const callStartSchema = z.object({
  mode: z.string().trim().min(1),
  idempotencyKey: z.string().trim().min(8).max(80),
});
export type CallStartInput = z.infer<typeof callStartSchema>;

export const wrapUpSchema = z.object({
  disposition: z.enum(['connected', 'no-answer', 'busy', 'wrong-number', 'callback']),
  needConfirmed: z.boolean().default(false),
  note: z.string().trim().min(3, 'Record the conversation result.').max(500),
  nextAction: z.string().trim().max(100).optional(),
  dueAt: z.string().optional(),
});
export type WrapUpInput = z.infer<typeof wrapUpSchema>;

export interface CallRecord {
  id: string;
  leadId: string;
  direction: 'outbound' | 'inbound';
  providerMode: string;
  status: string;
  evidenceStatus: 'simulated' | 'provider-verified' | 'manual';
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  needsWrapup: boolean;
  wrapupDisposition: string | null;
  wrapupNote: string | null;
}

export const manualActivitySchema = z.object({
  activityType: z.string().trim().min(1).max(60),
  occurredAt: z.string().min(1, 'Enter the actual event time.'),
  outcome: z.string().trim().min(1).max(60),
  durationMinutes: z.number().int().min(0).max(600).optional(),
  reason: z.string().trim().min(3, 'State why this is a manual entry.').max(200),
  note: z.string().trim().min(3).max(500),
});
export type ManualActivityInput = z.infer<typeof manualActivitySchema>;

export const whatsappSendSchema = z.object({
  template: z.string().trim().min(1, 'Choose an approved template.'),
  language: z.string().trim().min(1).max(40),
  variables: z.record(z.string()).default({}),
  bodyPreview: z.string().trim().min(1).max(1000),
});
export type WhatsAppSendInput = z.infer<typeof whatsappSendSchema>;

export const inboundMessageSchema = z.object({
  channel: z.enum(['whatsapp', 'sms', 'email', 'voice']),
  matchedLeadId: z.string().trim().optional(),
  receivedAt: z.string().min(1),
  intent: z.string().trim().min(1).max(100),
  body: z.string().trim().min(1).max(1000),
  inboundKey: z.string().trim().min(4).max(80),
});
export type InboundMessageInput = z.infer<typeof inboundMessageSchema>;

export interface MessageRecord {
  id: string;
  leadId: string;
  direction: 'outbound' | 'inbound';
  channel: string;
  template: string | null;
  body: string;
  status: string;
  evidenceStatus: 'simulated' | 'provider-verified' | 'manual';
  intent: string | null;
  createdAt: string;
}

export interface ReminderRecord {
  id: string;
  taskId: string;
  remindAt: string;
  status: 'scheduled' | 'sent' | 'cancelled';
}

export const rescheduleSchema = z.object({
  newDueAt: z.string().min(1, 'Choose the new time.'),
  reason: z.string().trim().min(3, 'Give a specific reason.').max(200),
  customerInformed: z.boolean().default(false),
});
export type RescheduleInput = z.infer<typeof rescheduleSchema>;

export const taskTransitionSchema = z.object({
  action: z.enum(['complete', 'cancel', 'reopen']),
  outcome: z.string().trim().max(200).optional(),
  evidence: z.string().trim().max(200).optional(),
  nextStep: z.string().trim().max(100).optional(),
  nextDueAt: z.string().optional(),
  cancellationReason: z.string().trim().max(200).optional(),
});
export type TaskTransitionInput = z.infer<typeof taskTransitionSchema>;

export const meetingSchema = z.object({
  meetingType: z.string().trim().min(1).max(60),
  slotAt: z.string().min(1, 'Choose a slot.'),
  location: z.string().trim().min(1).max(200),
  attendees: z.string().trim().min(1).max(200),
  agenda: z.string().trim().min(3).max(500),
});
export type MeetingInput = z.infer<typeof meetingSchema>;

export interface MeetingRecord {
  id: string;
  leadId: string;
  meetingType: string;
  slotAt: string;
  location: string;
  attendees: string;
  agenda: string;
  inviteStatus: 'queued' | 'delivered' | 'failed';
  outcome: 'attended' | 'no-show' | 'cancelled' | null;
}

export const qualificationSchema = z.object({
  need: z.string().trim().min(3, 'Document the requirement.').max(500),
  product: z.string().trim().min(1, 'Choose an approved V1 product.'),
  expectedValue: z.number().min(0).optional(),
  currency: z.string().trim().max(8).optional(),
  timeHorizon: z.string().trim().min(1).max(60),
  checklist: z.record(z.union([z.boolean(), z.string()])).default({}),
  nextStep: z.string().trim().min(3).max(100),
});
export type QualificationInput = z.infer<typeof qualificationSchema>;

export const stageChangeSchema = z.object({
  toStage: z.enum(STAGES),
  reason: z.string().trim().min(3, 'State the reason for the move.').max(200),
  requiredEvidence: z.string().trim().max(200).optional(),
});
export type StageChangeInput = z.infer<typeof stageChangeSchema>;

export const proposalSchema = z.object({
  product: z.string().trim().min(1),
  templateVersion: z.string().trim().min(1),
  terms: z.string().trim().min(3).max(2000),
  validUntil: z.string().min(1, 'Set a validity date.'),
  recipient: z.string().trim().min(1).max(100),
});
export type ProposalInput = z.infer<typeof proposalSchema>;

export interface ProposalRecord {
  id: string;
  leadId: string;
  product: string;
  templateVersion: string;
  terms: string;
  validUntil: string;
  status: 'draft' | 'pending-approval' | 'approved' | 'sent' | 'withdrawn';
  version: number;
  createdAt: string;
}

export const conversionSchema = z.object({
  winMilestone: z.string().trim().min(3).max(100),
  milestoneDate: z.string().min(1),
  value: z.number().min(0),
  currency: z.string().trim().min(1).max(8),
  evidenceRef: z.string().trim().min(3, 'Reference the verified evidence.').max(200),
  proposedCredit: z.record(z.number()).refine(
    (credit) => Object.values(credit).reduce((a, b) => a + b, 0) === 100,
    { message: 'Credit splits must total 100%.' }
  ),
});
export type ConversionInput = z.infer<typeof conversionSchema>;

export const lossSchema = z.object({
  reason: z.string().trim().min(1, 'Choose a loss reason.'),
  explanation: z.string().trim().min(3).max(500),
  competitor: z.string().trim().max(100).optional(),
  futureContact: z.string().trim().max(100).optional(),
});
export type LossInput = z.infer<typeof lossSchema>;

export const reopenSchema = z.object({
  reason: z.string().trim().min(3).max(300),
  newEvidence: z.string().trim().min(3).max(200),
  requestedNextStage: z.enum(['not-contacted', 'contacted', 'follow-up', 'qualified'], {
    errorMap: () => ({ message: 'Choose a non-terminal stage.' }),
  }),
  nextAction: z.string().trim().min(3).max(100),
});
export type ReopenInput = z.infer<typeof reopenSchema>;

export const handoffSchema = z.object({
  reason: z.string().trim().min(3).max(300),
  destination: z.string().trim().min(3).max(100),
  customerPermission: z.string().trim().min(3, 'Record customer permission evidence.').max(200),
  note: z.string().trim().min(3).max(500),
});
export type HandoffInput = z.infer<typeof handoffSchema>;

export const OUTCOME_DECISIONS = ['approve', 'return', 'reject'] as const;
export type OutcomeDecision = (typeof OUTCOME_DECISIONS)[number];

export const outcomeDecisionSchema = z
  .object({
    decision: z.enum(OUTCOME_DECISIONS).optional(),
    approve: z.boolean().optional(),
    reason: z
      .string({ required_error: 'Decision rationale is required.' })
      .trim()
      .min(3, 'Decision rationale must be at least 3 characters.')
      .max(500),
    evidence: z.record(z.unknown()).optional().default({}),
  })
  .superRefine((val, ctx) => {
    if (val.decision === undefined && val.approve === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['decision'],
        message: 'A valid decision (approve, return, or reject) is required.',
      });
    }
  })
  .transform((val) => {
    let resolvedDecision: OutcomeDecision;
    if (val.decision) {
      resolvedDecision = val.decision;
    } else if (val.approve === true) {
      resolvedDecision = 'approve';
    } else {
      resolvedDecision = 'reject';
    }
    return {
      decision: resolvedDecision,
      reason: val.reason,
      evidence: val.evidence ?? {},
    };
  });
export type OutcomeDecisionInput = z.infer<typeof outcomeDecisionSchema>;

export const CORRECTION_DECISIONS = ['accept', 'return', 'reject'] as const;
export type CorrectionDecision = (typeof CORRECTION_DECISIONS)[number];

export const correctionDecisionSchema = z
  .object({
    decision: z.enum(CORRECTION_DECISIONS).optional(),
    accept: z.boolean().optional(),
    reason: z
      .string({ required_error: 'Decision rationale is required.' })
      .trim()
      .min(3, 'Decision rationale must be at least 3 characters.')
      .max(500),
    evidence: z.record(z.unknown()).optional().default({}),
  })
  .superRefine((val, ctx) => {
    if (val.decision === undefined && val.accept === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['decision'],
        message: 'A valid decision (accept, return, or reject) is required.',
      });
    }
  })
  .transform((val) => {
    let resolvedDecision: CorrectionDecision;
    if (val.decision) {
      resolvedDecision = val.decision;
    } else if (val.accept === true) {
      resolvedDecision = 'accept';
    } else {
      resolvedDecision = 'return';
    }
    return {
      decision: resolvedDecision,
      reason: val.reason,
      evidence: val.evidence ?? {},
    };
  });
export type CorrectionDecisionInput = z.infer<typeof correctionDecisionSchema>;

export const optOutSchema = z.object({
  request: z.string().trim().min(3).max(200),
  source: z.string().trim().min(1).max(100),
  receivedAt: z.string().min(1),
  channels: z.array(z.enum(['voice', 'whatsapp', 'sms', 'email'])).min(1),
  complaintNote: z.string().trim().max(500).optional(),
});
export type OptOutInput = z.infer<typeof optOutSchema>;

export const helpRequestSchema = z.object({
  requestType: z.enum(['blocker', 'metric-correction', 'other']),
  recordReference: z.string().trim().min(1).max(40),
  expectedCorrection: z.string().trim().min(3).max(500),
  evidence: z.string().trim().max(200).optional(),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
});
export type HelpRequestInput = z.infer<typeof helpRequestSchema>;

export interface OutcomeRequestRecord {
  id: string;
  leadId: string;
  type: 'conversion' | 'reopen' | 'handoff' | 'correction' | 'blocker' | 'loss';
  status: 'pending' | 'approved' | 'returned' | 'rejected' | 'completed';
  payload: Record<string, unknown>;
  decisionReason: string | null;
  decisionEvidence?: Record<string, unknown>;
  decidedBy?: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export interface DocumentRequestRecord {
  id: string;
  leadId: string;
  checklist: string;
  requestedFiles: string[];
  uploadToken: string;
  expiresAt: string;
  dueAt: string;
  status: 'open' | 'fulfilled' | 'expired';
}

export interface DocumentRecord {
  id: string;
  leadId: string;
  documentType: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  version: number;
  scanStatus: 'pending' | 'clean' | 'quarantined';
  validationStatus: 'pending' | 'accepted' | 'rejected';
  rejectReason: string | null;
  createdAt: string;
}

export const documentRequestSchema = z.object({
  checklist: z.string().trim().min(1).max(100),
  requestedFiles: z.array(z.string().trim().min(1).max(100)).min(1),
  dueAt: z.string().min(1, 'Set a due date.'),
  reminderEnabled: z.boolean().default(true),
});
export type DocumentRequestInput = z.infer<typeof documentRequestSchema>;

export const reviewResponseSchema = z.object({
  selfReflection: z.string().trim().min(3).max(1000),
  commitments: z
    .array(z.object({ text: z.string().trim().min(3).max(200), dueAt: z.string().min(1) }))
    .default([]),
  employeeResponse: z.string().trim().max(500).optional(),
});
export type ReviewResponseInput = z.infer<typeof reviewResponseSchema>;

export interface ReviewRecord {
  id: string;
  period: string;
  reviewerName: string;
  scorecard: Record<string, unknown>;
  selfReflection: string | null;
  commitments: Array<{ text: string; dueAt: string; completed?: boolean }>;
  employeeResponse: string | null;
  acknowledgedAt: string | null;
}

export const REPORT_PERIODS = ['daily', 'weekly', 'monthly', 'quarter', 'half-year', 'year'] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];

export interface MetricInspection {
  key: string;
  label: string;
  value: number | null;
  numerator: number;
  denominator: number;
  formula: string;
  evidenceKind: string;
}

export interface PerformanceReport {
  period: ReportPeriod;
  periodStart: string;
  periodEnd: string;
  timezone: string;
  metricVersion: string;
  asOf: string;
  metrics: MetricInspection[];
}

export interface ReportExportRecord {
  id: string;
  period: ReportPeriod;
  snapshotAt: string;
  metricVersion: string;
  expiresAt: string;
  downloadPath: string;
}

// ─── Team Lead (TL-01..TL-18) ───

export const TL_PERIODS = ['today', 'week', 'month', 'quarter'] as const;
export type TlPeriod = (typeof TL_PERIODS)[number];

export interface TlKpi {
  key: string;
  label: string;
  value: number | null;
  numerator: number;
  denominator: number;
  comparison: string;
  formula: string;
}

export interface TlMemberRow {
  employeeId: string;
  displayName: string;
  openLeads: number;
  openTasks: number;
  overdueTasks: number;
  completedThisPeriod: number;
  capacity: number;
  idle: boolean;
  availability: string;
}

export interface TlOverviewResponse {
  teams: Array<{ id: string; name: string }>;
  period: TlPeriod;
  comparison: string;
  asOf: string;
  dataFreshMinutes: number;
  kpis: TlKpi[];
  members: TlMemberRow[];
  pendingApprovals: number;
}

export interface TlDrillResponse {
  metric: string;
  members: TlMemberRow[];
  opportunities: LeadSummary[];
}

export const allocationSchema = z.object({
  leadId: z.string().trim().min(3),
  toEmployeeId: z.string().trim().min(3),
  reason: z.string().trim().min(3).max(200),
  recordVersion: z.number().int().min(1),
});
export type TlAllocationInput = z.infer<typeof allocationSchema>;

export const batchAllocationSchema = z.object({
  leadIds: z.array(z.string().trim().min(3)).min(1).max(200),
  method: z.enum(['weighted-round-robin']),
  teamId: z.string().trim().min(3),
  capacityCap: z.number().int().min(1).max(50).optional(),
});
export type TlBatchAllocationInput = z.infer<typeof batchAllocationSchema>;

export interface AllocationReceipt {
  leadId: string;
  status: 'assigned' | 'held' | 'failed' | 'conflict';
  toEmployeeId: string | null;
  taskId: string | null;
  detail?: string;
}

export const rebalanceSchema = z.object({
  leadIds: z.array(z.string().trim().min(3)).min(1).max(100),
  toEmployeeId: z.string().trim().min(3),
  reason: z.string().trim().min(3).max(200),
  handoffDeadline: z.string().trim().min(4),
});
export type TlRebalanceInput = z.infer<typeof rebalanceSchema>;

export const overdueActionSchema = z.object({
  action: z.enum(['coach', 'reassign', 'escalate']),
  reason: z.string().trim().min(3).max(300),
  newOwnerEmployeeId: z.string().trim().min(3).optional(),
  recoveryDueAt: z.string().trim().min(4),
});
export type TlOverdueActionInput = z.infer<typeof overdueActionSchema>;

export const qualityReviewSchema = z.object({
  callId: z.string().trim().min(3),
  scores: z.record(z.number().min(0).max(5)),
  feedback: z.string().trim().min(3).max(500),
  evidenceRef: z.string().trim().max(120).optional(),
  assessed: z.boolean().optional(),
});
export type TlQualityReviewInput = z.infer<typeof qualityReviewSchema>;

export const targetSchema = z.object({
  teamId: z.string().trim().min(3),
  periodLabel: z.string().trim().min(2).max(40),
  metric: z.string().trim().min(2).max(40),
  parentValue: z.number().min(0),
});
export type TlTargetInput = z.infer<typeof targetSchema>;

export const targetAllocationSchema = z.object({
  allocations: z.array(z.object({
    employeeId: z.string().trim().min(3),
    allocatedValue: z.number().min(0),
    prorateNote: z.string().trim().max(120).optional(),
  })).min(1),
});
export type TlTargetAllocationInput = z.infer<typeof targetAllocationSchema>;

export const forecastSchema = z.object({
  teamId: z.string().trim().min(3),
  periodLabel: z.string().trim().min(2).max(40),
  category: z.enum(['commit', 'best-case', 'pipeline']),
  expectedRevenue: z.number().min(0),
  currency: z.string().trim().min(2).max(8),
  opportunityIds: z.array(z.string().trim().min(3)),
  riskNotes: z.string().trim().max(500).optional(),
  assumptions: z.string().trim().max(500).optional(),
});
export type TlForecastInput = z.infer<typeof forecastSchema>;

export const oneToOneSchema = z.object({
  employeeId: z.string().trim().min(3),
  periodLabel: z.string().trim().min(2).max(40),
  agenda: z.string().trim().min(3).max(500),
  scheduledAt: z.string().trim().min(4),
});
export type TlOneToOneInput = z.infer<typeof oneToOneSchema>;

export const mentorshipSchema = z.object({
  internEmployeeId: z.string().trim().min(3),
  mentorEmployeeId: z.string().trim().min(3),
  workCap: z.number().int().min(1).max(20),
  allowedProducts: z.array(z.string().trim().min(2)),
  reviewDate: z.string().trim().min(4),
});
export type TlMentorshipInput = z.infer<typeof mentorshipSchema>;

export const teamRequestSchema = z.object({
  category: z.enum(['staffing', 'role-change', 'capacity', 'complaint', 'commercial-exception', 'merge-request']),
  teamId: z.string().trim().min(3).optional(),
  subjectEmployeeId: z.string().trim().min(3).optional(),
  leadId: z.string().trim().min(3).optional(),
  severity: z.enum(['low', 'medium', 'high']).optional(),
  request: z.string().trim().min(3).max(300),
  businessReason: z.string().trim().min(3).max(500),
  effectiveDate: z.string().trim().max(40).optional(),
  impact: z.string().trim().max(300).optional(),
  requestedDecision: z.string().trim().max(120).optional(),
});
export type TlTeamRequestInput = z.infer<typeof teamRequestSchema>;

export const activityCorrectionSchema = z.object({
  callId: z.string().trim().min(3),
  requestedField: z.enum(['wrapup_disposition', 'wrapup_note', 'status']),
  requestedValue: z.string().trim().min(1).max(300),
  evidenceRef: z.string().trim().max(120).optional(),
  explanation: z.string().trim().min(3).max(500),
});
export type TlActivityCorrectionInput = z.infer<typeof activityCorrectionSchema>;

export const reportScheduleSchema = z.object({
  name: z.string().trim().min(3).max(80),
  cadence: z.enum(['weekly-mon-09:00+05:30', 'monthly-1st-09:00+05:30']),
  period: z.enum(['weekly', 'monthly']),
  teamIds: z.array(z.string().trim().min(3)).min(1),
  recipients: z.array(z.string().trim().min(3)).min(1),
});
export type TlReportScheduleInput = z.infer<typeof reportScheduleSchema>;

export * from './manager';
export * from './regional-manager';
export * from './national-manager';
export * from './ceo';
export * from './cfo';
