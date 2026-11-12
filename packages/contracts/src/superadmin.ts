import { z } from 'zod';
import { ROLES, VERTICALS } from './index';

// SA: Account Activation & Provisioning from HR Onboarding Request
export const saApproveOnboardingSchema = z.object({
  requestId: z.string().trim().min(1, 'Request ID is required.'),
  role: z.enum(ROLES, { errorMap: () => ({ message: 'Select an authorized role.' }) }),
  vertical: z.enum(VERTICALS, { errorMap: () => ({ message: 'Select an authorized vertical.' }) }),
  teamId: z.string().trim().min(1, 'Assigned team is required.'),
  reportingManagerId: z.string().trim().nullable().optional(),
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters.')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Username can only contain alphanumeric characters, dots, underscores, and hyphens.'),
  temporaryPassword: z
    .string()
    .trim()
    .min(8, 'Temporary password must be at least 8 characters.'),
});
export type SaApproveOnboardingInput = z.infer<typeof saApproveOnboardingSchema>;

export const saRejectOnboardingSchema = z.object({
  requestId: z.string().trim().min(1, 'Request ID is required.'),
  rejectionReason: z.string().trim().min(3, 'Rejection reason must be provided.'),
});
export type SaRejectOnboardingInput = z.infer<typeof saRejectOnboardingSchema>;

// Unified HR Request Schemas
export const saApproveLifecycleChangeSchema = z.object({
  requestId: z.string().trim().min(1, 'Request ID is required.'),
  decisionNotes: z.string().trim().optional(),
});
export type SaApproveLifecycleChangeInput = z.infer<typeof saApproveLifecycleChangeSchema>;

export const saApproveExitSchema = z.object({
  requestId: z.string().trim().min(1, 'Request ID is required.'),
  decisionNotes: z.string().trim().optional(),
  handoffSupervisedQueue: z.boolean().default(true),
});
export type SaApproveExitInput = z.infer<typeof saApproveExitSchema>;

export const saRejectHrRequestSchema = z.object({
  requestId: z.string().trim().min(1, 'Request ID is required.'),
  rejectionReason: z.string().trim().min(3, 'Rejection reason must be provided.'),
});
export type SaRejectHrRequestInput = z.infer<typeof saRejectHrRequestSchema>;

export interface SaApproveOnboardingResponse {
  success: boolean;
  employeeId: string;
  username: string;
  role: string;
  vertical: string;
  teamId: string;
  mustChangePassword: true;
  message: string;
}

export interface SaHrRequestItem {
  id: string;
  requestType: 'new_account' | 'team_transfer' | 'promotion' | 'exit';
  status: 'submitted' | 'approved' | 'approved_by_rm' | 'pending_approval' | 'activated_by_admin' | 'rejected' | 'returned';
  employeeId: string;
  employeeName: string;
  employeeEmail: string | null;
  primaryMobile?: string | null;
  whatsappNumber?: string | null;
  currentUsername?: string | null;
  currentRole?: string | null;
  currentVertical?: string | null;
  currentTeamName?: string | null;
  targetRole: string;
  targetVertical: string;
  targetTeamId: string | null;
  targetTeamName?: string | null;
  supervisorEmployeeId?: string | null;
  supervisorName?: string | null;
  effectiveDate: string;
  effectiveTime?: string | null;
  approvalsSummary: string;
  handoffPlan?: string | null;
  oldWorkloadTreatment?: string | null;
  replacementPlan?: string | null;
  adminDecisionNotes?: string | null;
  createdByName?: string | null;
  createdAt: string;
  updatedAt: string;
}

// SA-01: Legacy Account Creation & Expiring Activation Invitation
export const saCreateAccountSchema = z.object({
  employeeName: z.string().trim().min(2, 'Employee name must be at least 2 characters.'),
  workEmail: z.string().trim().email('Valid work email is required.').toLowerCase(),
  proposedRole: z.enum(ROLES, { errorMap: () => ({ message: 'Select an approved role.' }) }),
  vertical: z.enum(VERTICALS, { errorMap: () => ({ message: 'Select an authorized vertical.' }) }),
  teamId: z.string().trim().min(1, 'Assigned team is required.'),
  employmentEpisode: z.enum(['Active', 'Scheduled']).default('Active'),
  invitationExpiryHours: z.number().int().min(1).max(168).default(48),
});
export type SaCreateAccountInput = z.infer<typeof saCreateAccountSchema>;


// SA-02: Precise Role & Organisation Scope Grant
export const saGrantScopeSchema = z.object({
  employeeId: z.string().trim().min(1, 'Employee ID is required.'),
  role: z.enum(ROLES, { errorMap: () => ({ message: 'Select an approved role.' }) }),
  vertical: z.enum(VERTICALS, { errorMap: () => ({ message: 'Select a vertical.' }) }),
  allowedTeamIds: z.array(z.string().trim().min(1)).min(1, 'Select at least one allowed team.'),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Effective start date must be YYYY-MM-DD.'),
  effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expiry date must be YYYY-MM-DD.').nullable().optional(),
  approverReference: z.string().trim().min(3, 'Approver reference is required (e.g. REQ-AUTH-091).'),
});
export type SaGrantScopeInput = z.infer<typeof saGrantScopeSchema>;

// SA-03: Additional Team/Vertical Scope Grant (Same Role)
export const saAdditionalScopeSchema = z.object({
  employeeId: z.string().trim().min(1, 'Employee ID is required.'),
  additionalVertical: z.enum(VERTICALS, { errorMap: () => ({ message: 'Select additional vertical.' }) }),
  additionalTeamId: z.string().trim().min(1, 'Select additional team.'),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Effective start date must be YYYY-MM-DD.'),
  effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expiry date must be YYYY-MM-DD.').nullable().optional(),
  approverReference: z.string().trim().min(3, 'Approver reference is required.'),
});
export type SaAdditionalScopeInput = z.infer<typeof saAdditionalScopeSchema>;

// SA-04: Reporting Hierarchy Restructuring
export const saRestructureHierarchySchema = z.object({
  nodeId: z.string().optional(),
  unitName: z.string().trim().min(2, 'Unit name must be at least 2 characters.'),
  vertical: z.enum(VERTICALS, { errorMap: () => ({ message: 'Select vertical.' }) }),
  unitLevel: z.string().trim().min(2, 'Unit level is required.'),
  parentNodeId: z.string().nullable().optional(),
  leaderEmployeeId: z.string().nullable().optional(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Effective date must be YYYY-MM-DD.'),
});
export type SaRestructureHierarchyInput = z.infer<typeof saRestructureHierarchySchema>;

// SA-05: Transfer/Promotion Activation
export const saActivateTransferSchema = z.object({
  requestId: z.string().trim().min(1, 'Request ID is required.'),
  decision: z.enum(['approve', 'return', 'reject']),
  decisionNote: z.string().trim().min(3, 'Decision note and evidence reference is required.'),
  effectiveTime: z.string().optional(),
});
export type SaActivateTransferInput = z.infer<typeof saActivateTransferSchema>;

// SA-06: Offboarding & Access Revocation
export const saOffboardEmployeeSchema = z.object({
  employeeId: z.string().trim().min(1, 'Employee ID is required.'),
  reason: z.string().trim().min(3, 'Approved offboarding reason is required.'),
  effectiveTime: z.string().min(1, 'Effective time is required.'),
  revokeAllSessions: z.boolean().default(true),
  handoffSupervisedQueue: z.boolean().default(true),
  notes: z.string().trim().optional(),
});
export type SaOffboardEmployeeInput = z.infer<typeof saOffboardEmployeeSchema>;

// SA-07: Verified Account Recovery
export const saAccountRecoverySchema = z.object({
  employeeId: z.string().trim().min(1, 'Employee ID is required.'),
  issueType: z.enum(['Locked account', 'MFA recovery', 'Credential reset', 'Compromised session']),
  identityCheckProcedure: z.string().trim().min(5, 'Approved identity verification procedure is required.'),
  revokeExistingSessions: z.boolean().default(true),
  expiryHours: z.number().int().min(1).max(72).default(24),
});
export type SaAccountRecoveryInput = z.infer<typeof saAccountRecoverySchema>;

// SA-08: Publish Business Configuration Version
export const saPublishConfigSchema = z.object({
  configKey: z.string().trim().min(2, 'Configuration key is required.'),
  title: z.string().trim().min(2, 'Configuration title is required.'),
  category: z.enum(['stage', 'sla', 'routing', 'fiscal_calendar']),
  version: z.number().int().positive('Version must be a positive integer.'),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Effective date must be YYYY-MM-DD.'),
  schemaPayload: z.record(z.any()),
  approvedBy: z.string().trim().min(2, 'Approved business owner is required.'),
});
export type SaPublishConfigInput = z.infer<typeof saPublishConfigSchema>;

// SA-09: Incident Investigation Actions
export const saIncidentActionSchema = z.object({
  incidentId: z.string().trim().min(1, 'Incident ID is required.'),
  actionType: z.enum(['acknowledge', 'revoke_access', 'route_to_security', 'close_incident']),
  actionNote: z.string().trim().min(3, 'Action note is required.'),
  targetEmployeeId: z.string().optional(),
});
export type SaIncidentActionInput = z.infer<typeof saIncidentActionSchema>;

// SA-10: Recover Failed Integration Job
export const saRetryJobSchema = z.object({
  jobId: z.string().trim().min(1, 'Job ID is required.'),
  idempotencyKey: z.string().trim().min(1, 'Idempotency key is required.'),
  reason: z.string().trim().optional(),
});
export type SaRetryJobInput = z.infer<typeof saRetryJobSchema>;

// SA-11: Expiring Delegation Decision
export const saDecideDelegationSchema = z.object({
  grantId: z.string().trim().min(1, 'Grant ID is required.'),
  decision: z.enum(['expire', 'renew', 'revoke']),
  renewalDays: z.number().int().min(1).max(90).optional(),
  decisionReason: z.string().trim().min(3, 'Decision rationale is required.'),
});
export type SaDecideDelegationInput = z.infer<typeof saDecideDelegationSchema>;

// SA: Dynamic Team Management & Relationship Manager Assignment
export const saCreateTeamSchema = z.object({
  id: z.string().trim().min(3).optional(),
  name: z.string().trim().min(2, 'Team name must be at least 2 characters.'),
  vertical: z.enum(VERTICALS, { errorMap: () => ({ message: 'Select an authorized vertical.' }) }),
  relationshipManagerId: z.string().trim().nullable().optional(),
});
export type SaCreateTeamInput = z.infer<typeof saCreateTeamSchema>;

export const saUpdateTeamSchema = z.object({
  name: z.string().trim().min(2, 'Team name must be at least 2 characters.').optional(),
  relationshipManagerId: z.string().trim().nullable().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});
export type SaUpdateTeamInput = z.infer<typeof saUpdateTeamSchema>;

export const saAssignCallerSchema = z.object({
  callerEmployeeId: z.string().trim().min(1, 'Caller Employee ID is required.'),
  reason: z.string().trim().optional(),
});
export type SaAssignCallerInput = z.infer<typeof saAssignCallerSchema>;

export interface SaTeamCaller {
  employeeId: string;
  name: string;
  email: string;
  username: string | null;
  assignedAt: string;
}

export interface SaTeamItem {
  id: string;
  name: string;
  vertical: string;
  status: 'active' | 'inactive';
  relationshipManagerId: string | null;
  relationshipManagerName: string | null;
  callerCount: number;
  callers: SaTeamCaller[];
  createdAt: string;
  updatedAt: string;
}

export interface SaEligibleRelationshipManager {
  id: string;
  name: string;
  email: string;
  vertical: string;
  supervisedTeamCount: number;
}

export interface SaEligibleCaller {
  id: string;
  name: string;
  email: string;
  vertical: string;
  currentTeamId: string | null;
  currentTeamName: string | null;
}
