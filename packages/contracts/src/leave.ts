import { z } from 'zod';
import { ROLES, VERTICALS } from './index';

export const LEAVE_TYPES = [
  'casual',
  'sick',
  'earned',
  'unpaid',
  'bereavement',
  'paternity',
  'maternity',
  'annual',
] as const;

export type LeaveType = (typeof LEAVE_TYPES)[number];

export const LEAVE_STATUSES = [
  'submitted',
  'approved',
  'rejected',
  'withdrawn',
] as const;

export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

export const submitLeaveRequestSchema = z.object({
  leaveType: z.enum(LEAVE_TYPES, {
    errorMap: () => ({ message: 'Please select an approved leave category.' }),
  }),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD.'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD.'),
  reason: z.string().trim().min(3, 'Leave reason must be at least 3 characters.'),
  handoverNotes: z.string().trim().optional(),
});

export type SubmitLeaveRequestInput = z.infer<typeof submitLeaveRequestSchema>;

export const decideLeaveRequestSchema = z.object({
  decision: z.enum(['approved', 'rejected'], {
    errorMap: () => ({ message: 'Decision must be either approved or rejected.' }),
  }),
  notes: z.string().trim().min(2, 'Decision notes are required.'),
});

export type DecideLeaveRequestInput = z.infer<typeof decideLeaveRequestSchema>;

export const withdrawLeaveRequestSchema = z.object({
  notes: z.string().trim().optional(),
});

export type WithdrawLeaveRequestInput = z.infer<typeof withdrawLeaveRequestSchema>;

export const configureApproverSchema = z.object({
  employeeId: z.string().trim().optional(),
  role: z.enum(ROLES).optional(),
  vertical: z.enum(VERTICALS).optional(),
  approverEmployeeId: z.string().trim().nullable().optional(),
  approverTitle: z.string().trim().min(2, 'Approver title must be specified.'),
  isConfigured: z.boolean().default(true),
  notes: z.string().trim().optional(),
});

export type ConfigureApproverInput = z.infer<typeof configureApproverSchema>;

export interface LeaveApprovalActionRecord {
  id: string;
  leaveRequestId: string;
  actorEmployeeId: string;
  actorName?: string;
  actorRole: string;
  action: 'submitted' | 'approved' | 'rejected' | 'withdrawn' | 'escalated';
  notes?: string | null;
  createdAt: string;
}

export interface LeaveRequestRecord {
  id: string;
  employeeId: string;
  employeeName?: string;
  employeeEmail?: string;
  employeeRole?: string;
  vertical?: string;
  teamId?: string;
  teamName?: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  handoverNotes?: string | null;
  status: LeaveStatus;
  currentApproverId?: string | null;
  currentApproverName?: string | null;
  currentApproverTitle?: string | null;
  decidedByEmployeeId?: string | null;
  decidedByName?: string | null;
  decisionNotes?: string | null;
  decidedAt?: string | null;
  recordVersion: number;
  createdAt: string;
  updatedAt: string;
  actions?: LeaveApprovalActionRecord[];
}

export interface ApproverConfigRecord {
  id: string;
  employeeId?: string | null;
  employeeName?: string | null;
  role?: string | null;
  vertical?: string | null;
  approverEmployeeId?: string | null;
  approverName?: string | null;
  approverTitle: string;
  isConfigured: boolean;
  notes?: string | null;
  updatedAt: string;
}

export interface LeaveFilterQuery {
  vertical?: string;
  role?: string;
  teamId?: string;
  employeeId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}
