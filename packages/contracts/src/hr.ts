import { z } from 'zod';
import { ROLES, VERTICALS } from './index';

// HR-01: Request a New Employee Account (Joiner)
export const hrRequestAccountSchema = z.object({
  employeeName: z.string().trim().min(2, 'Employee name must be at least 2 characters.'),
  workEmail: z.string().trim().email('Valid corporate email is required.').toLowerCase(),
  employmentType: z.enum(['permanent', 'intern', 'contract'], { errorMap: () => ({ message: 'Select employment type (permanent/intern/contract).' }) }),
  proposedRole: z.enum(ROLES, { errorMap: () => ({ message: 'Select an approved role.' }) }),
  vertical: z.enum(VERTICALS, { errorMap: () => ({ message: 'Select target vertical.' }) }),
  teamId: z.string().trim().min(1, 'Target team placement is required.'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD.'),
  supervisorEmployeeId: z.string().trim().nullable().optional(),
  requiredTraining: z.string().trim().min(3, 'Required initial training modules must be specified.').default('Finverse Onboarding & Conduct Rules'),
  approvalsSummary: z.string().trim().min(3, 'Hiring authority approval is required.'),
  notes: z.string().trim().optional(),
});
export type HrRequestAccountInput = z.infer<typeof hrRequestAccountSchema>;

// Approval Verification and Audit Contracts
export const hrAttachApprovalSchema = z.object({
  approvalType: z.enum(['authorized_leader', 'verified_external_document'], {
    errorMap: () => ({ message: 'Select approval type (authorized_leader or verified_external_document).' }),
  }),
  approverEmployeeId: z.string().trim().optional(),
  externalReference: z.string().trim().optional(),
  verificationNotes: z.string().trim().min(3, 'Auditable verification notes are required.'),
});
export type HrAttachApprovalInput = z.infer<typeof hrAttachApprovalSchema>;

export const hrUpdateRequestSchema = z.object({
  targetRole: z.enum(ROLES).optional(),
  newVertical: z.enum(VERTICALS).optional(),
  newTeamId: z.string().trim().optional(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Effective date must be YYYY-MM-DD.').optional(),
  effectiveTime: z.string().trim().optional(),
  justification: z.string().trim().optional(),
});
export type HrUpdateRequestInput = z.infer<typeof hrUpdateRequestSchema>;

// HR-02: Request an Effective-Dated Team Transfer (Mover)
export const hrRequestTransferSchema = z.object({
  employeeId: z.string().trim().min(1, 'Employee is required.'),
  newVertical: z.enum(VERTICALS, { errorMap: () => ({ message: 'Select destination vertical.' }) }),
  newTeamId: z.string().trim().min(1, 'Destination team is required.'),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Effective date must be YYYY-MM-DD.'),
  effectiveTime: z.string().trim().min(1, 'Effective time is required (e.g. 09:00 IST).').default('09:00 IST'),
  namedHandoffOwners: z.string().trim().min(3, 'Named lead & task handoff owners are required.'),
  businessJustification: z.string().trim().min(3, 'Business justification is required.'),
  approvalsSummary: z.string().trim().min(3, 'Management approval evidence is required.'),
  verifiedApproval: hrAttachApprovalSchema.optional(),
});
export type HrRequestTransferInput = z.infer<typeof hrRequestTransferSchema>;

// HR-03: Request a Promotion with Retained Career History (Promotion)
export const hrRequestPromotionSchema = z.object({
  employeeId: z.string().trim().min(1, 'Employee is required.'),
  newRole: z.enum(ROLES, { errorMap: () => ({ message: 'Select new role.' }) }),
  newVertical: z.enum(VERTICALS, { errorMap: () => ({ message: 'Select target vertical.' }) }),
  newTeamId: z.string().trim().nullable().optional(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Effective date must be YYYY-MM-DD.'),
  effectiveTime: z.string().trim().min(1, 'Effective time is required.').default('09:00 IST'),
  reportingScope: z.string().trim().min(2, 'Approved reporting scope is required.'),
  oldWorkloadTreatment: z.string().trim().min(3, 'Old workload treatment is required (reassign or explicit secondary duty).'),
  businessJustification: z.string().trim().min(3, 'Business justification is required.'),
  approvalsSummary: z.string().trim().min(3, 'Leadership approval evidence is required.'),
  verifiedApproval: hrAttachApprovalSchema.optional(),
});
export type HrRequestPromotionInput = z.infer<typeof hrRequestPromotionSchema>;

// HR-04: Coordinate an Employee Exit (Leaver)
export const hrCoordinateExitSchema = z.object({
  employeeId: z.string().trim().min(1, 'Employee is required.'),
  exitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Exit date must be YYYY-MM-DD.'),
  exitTime: z.string().trim().min(1, 'Exit time is required (e.g. 18:00 IST).').default('18:00 IST'),
  openWorkHandoff: z.string().trim().min(3, 'Open work handoff plan and checklist are required.'),
  accessRevocationSchedule: z.enum(['immediate', 'scheduled_end_of_day', 'custom_time']).default('scheduled_end_of_day'),
  replacementPlan: z.string().trim().min(3, 'Replacement plan is required (new unique identity, never account recycling).'),
  approvalsSummary: z.string().trim().min(3, 'Authorised exit approval evidence is required.'),
  notes: z.string().trim().optional(),
});
export type HrCoordinateExitInput = z.infer<typeof hrCoordinateExitSchema>;

// HR-05: Record Leave and Allocation Availability
export const hrRecordLeaveSchema = z.object({
  employeeId: z.string().trim().min(1, 'Employee is required.'),
  absenceType: z.enum(['approved_leave', 'annual_leave', 'sick_leave', 'bereavement', 'unpaid', 'personal_leave'], {
    errorMap: () => ({ message: 'Select approved absence category.' }),
  }),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD.'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD.'),
  coverageOwnerRole: z.string().trim().min(1, 'Coverage owner role is required (e.g. TL).').default('TL'),
  coverageEmployeeId: z.string().trim().nullable().optional(),
  allocationStatus: z.enum(['unavailable', 'reduced', 'available']).default('unavailable'),
  leadsReassignmentConfirmed: z.boolean().default(false),
  notes: z.string().trim().optional(),
});
export type HrRecordLeaveInput = z.infer<typeof hrRecordLeaveSchema>;

// HR-06: Track Probation, Training & Review Completion
export const hrUpdateMilestoneSchema = z.object({
  milestoneId: z.string().trim().min(1, 'Milestone ID is required.'),
  status: z.enum(['active', 'in_progress', 'review', 'completed', 'extended', 'overdue']),
  completionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  evidenceSummary: z.string().trim().optional(),
  supervisorNotes: z.string().trim().optional(),
  decisionAction: z.enum(['none', 'confirm_permanent', 'extend_probation', 'assign_remedial_training', 'route_for_approval']).optional().default('none'),
});
export type HrUpdateMilestoneInput = z.infer<typeof hrUpdateMilestoneSchema>;

// HR-07: Prepare a People Operations Pack
export const hrPrepareReportPackSchema = z.object({
  periodLabel: z.enum(['2026-Q3', '2026-09', '2026-H2', '2026-Q4', '2026-08', '2026-YTD'], {
    errorMap: () => ({ message: 'Select a supported reporting period.' }),
  }),
  workforceScope: z.enum(['all', 'wealth', 'banking', 'markets', 'real-estate'], {
    errorMap: () => ({ message: 'Select workforce scope.' }),
  }),
  sections: z.array(z.enum(['joiners', 'movers', 'leavers', 'reviews', 'availability'])).min(1, 'Select at least one report section.'),
  sensitiveFieldsRestricted: z.boolean().default(true),
  notes: z.string().trim().optional(),
});
export type HrPrepareReportPackInput = z.infer<typeof hrPrepareReportPackSchema>;

export const hrCreateReportScheduleSchema = z.object({
  frequency: z.enum(['weekly', 'monthly', 'quarterly']),
  workforceScope: z.enum(['all', 'wealth', 'banking', 'markets', 'real-estate']),
  recipientEmails: z.array(z.string().email()).min(1, 'Specify at least one recipient email.'),
  sections: z.array(z.enum(['joiners', 'movers', 'leavers', 'reviews', 'availability'])).min(1),
});
export type HrCreateReportScheduleInput = z.infer<typeof hrCreateReportScheduleSchema>;
