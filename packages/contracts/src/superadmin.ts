import { z } from 'zod';
import { ROLES, VERTICALS } from './index';

// SA: Account Activation & Provisioning from HR Onboarding Request
export const saApproveOnboardingSchema = z.object({
  requestId: z.string().trim().min(1, 'Request ID is required.'),
  role: z.enum(ROLES, { errorMap: () => ({ message: 'Select an authorized role.' }) }),
  vertical: z.enum(VERTICALS, { errorMap: () => ({ message: 'Select an authorized vertical.' }) }),
  teamId: z.string().trim().min(1, 'Assigned team is required.'),
  reportingManagerId: z.string().trim().nullable().optional(),
  username: z.string().trim().optional(),
});
export type SaApproveOnboardingInput = z.infer<typeof saApproveOnboardingSchema>;

export const saRejectOnboardingSchema = z.object({
  requestId: z.string().trim().min(1, 'Request ID is required.'),
  rejectionReason: z.string().trim().min(3, 'Rejection reason must be provided.'),
});
export type SaRejectOnboardingInput = z.infer<typeof saRejectOnboardingSchema>;

export interface SaApproveOnboardingResponse {
  success: boolean;
  employeeId: string;
  username: string;
  role: string;
  vertical: string;
  teamId: string;
  temporaryPassword: string;
  mustChangePassword: true;
  message: string;
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
