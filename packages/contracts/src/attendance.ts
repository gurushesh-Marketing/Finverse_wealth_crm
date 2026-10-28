import { z } from 'zod';

// ============================================================================
// Enums & Literals
// ============================================================================

export const WorkModeSchema = z.enum(['office', 'wfh', 'field']);
export type WorkMode = z.infer<typeof WorkModeSchema>;

export const AttendanceStatusSchema = z.enum([
  'confirmed',
  'pending_confirmation',
  'regularization_requested',
  'rejected',
]);
export type AttendanceStatus = z.infer<typeof AttendanceStatusSchema>;

export const ResourceClassificationSchema = z.enum([
  'confirmed_present',
  'wfh',
  'approved_leave',
  'holiday',
  'weekly_off',
  'pending_confirmation',
  'recorded_absence',
]);
export type ResourceClassification = z.infer<typeof ResourceClassificationSchema>;

export const HolidayTypeSchema = z.enum(['mandatory', 'statutory', 'festival', 'optional']);
export type HolidayType = z.infer<typeof HolidayTypeSchema>;

// ============================================================================
// Input Validation Schemas
// ============================================================================

export const CheckInInputSchema = z.object({
  workMode: WorkModeSchema,
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD format required').optional(),
  isOfflineWork: z.boolean().optional().default(false),
  crmActivityCount: z.number().int().min(0).optional().default(0),
});
export type CheckInInput = z.infer<typeof CheckInInputSchema>;

export const CheckOutInputSchema = z.object({
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD format required').optional(),
  wfhProgressSummary: z.string().optional(),
  workEvidenceUrl: z.string().optional(),
  isOfflineWork: z.boolean().optional(),
  crmActivityCount: z.number().int().min(0).optional(),
});
export type CheckOutInput = z.infer<typeof CheckOutInputSchema>;

export const ProgressLogInputSchema = z.object({
  deliverableTitle: z.string().min(2, 'Deliverable title required (at least 2 chars)'),
  deliverableProgressPct: z.number().int().min(0).max(100),
  notes: z.string().optional(),
  evidenceArtifactPath: z.string().optional(),
  isOfflineDeliverable: z.boolean().optional().default(true),
});
export type ProgressLogInput = z.infer<typeof ProgressLogInputSchema>;

export const RegularizationRequestInputSchema = z.object({
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD format required'),
  requestedWorkMode: WorkModeSchema,
  requestedCheckInAt: z.string(), // ISO timestamptz
  requestedCheckOutAt: z.string(), // ISO timestamptz
  reason: z.string().min(3, 'Substantive explanation required (at least 3 chars)'),
  progressSummary: z.string().optional(),
});
export type RegularizationRequestInput = z.infer<typeof RegularizationRequestInputSchema>;

export const RegularizationDecisionInputSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  decisionNotes: z.string().min(2, 'Decision explanation required'),
});
export type RegularizationDecisionInput = z.infer<typeof RegularizationDecisionInputSchema>;

export const SupervisorReviewInputSchema = z.object({
  decision: z.enum(['confirmed', 'rejected', 'regularization_requested']),
  reviewNotes: z.string().optional(),
});
export type SupervisorReviewInput = z.infer<typeof SupervisorReviewInputSchema>;

export const ResourceViewQuerySchema = z.object({
  vertical: z.enum(['all', 'wealth', 'banking', 'markets', 'real_estate']).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  role: z.string().optional(),
  teamId: z.string().optional(),
  employeeId: z.string().optional(),
});
export type ResourceViewQuery = z.infer<typeof ResourceViewQuerySchema>;

// ============================================================================
// Record Types
// ============================================================================

export interface AttendanceProgressLogRecord {
  id: string;
  attendanceRecordId: string;
  loggedAt: string;
  deliverableTitle: string;
  deliverableProgressPct: number;
  notes?: string | null;
  evidenceArtifactPath?: string | null;
  isOfflineDeliverable: boolean;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  vertical: string;
  teamId?: string | null;
  teamName?: string | null;
  workLocationName?: string | null;
  workDate: string;
  workMode: WorkMode;
  checkInAt: string;
  checkOutAt?: string | null;
  totalHours?: number | null;
  wfhProgressSummary?: string | null;
  workEvidenceUrl?: string | null;
  status: AttendanceStatus;
  isOfflineWork: boolean;
  crmActivityCount: number;
  reviewedByEmployeeId?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
  reviewNotes?: string | null;
  progressLogs?: AttendanceProgressLogRecord[];
  createdAt: string;
}

export interface AttendanceRegularizationRecord {
  id: string;
  attendanceRecordId?: string | null;
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  vertical: string;
  workDate: string;
  requestedWorkMode: WorkMode;
  requestedCheckInAt: string;
  requestedCheckOutAt: string;
  reason: string;
  progressSummary?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  supervisorEmployeeId: string;
  supervisorName?: string | null;
  decisionNotes?: string | null;
  decidedAt?: string | null;
  createdAt: string;
}

export interface CalendarHolidayRecord {
  id: string;
  calendarId: string;
  workLocationId: string;
  locationName: string;
  holidayDate: string;
  holidayName: string;
  holidayType: HolidayType;
  description?: string | null;
}

export interface DailyResourceBreakdownItem {
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  employeeRole: string;
  vertical: string;
  teamId?: string | null;
  teamName?: string | null;
  workLocationName: string;
  date: string;
  classification: ResourceClassification;
  workMode?: WorkMode | null;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  totalHours?: number | null;
  isOfflineWork?: boolean;
  crmActivityCount?: number;
  attendanceRecordId?: string | null;
  status?: AttendanceStatus | null;
  leaveDetails?: {
    requestId: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    status: string;
    approvingSuperiorName?: string | null;
  } | null;
  holidayDetails?: {
    holidayName: string;
    holidayType: HolidayType;
  } | null;
  notes?: string | null;
}

export interface ResourceSummaryMetrics {
  totalEmployees: number;
  confirmedPresent: number;
  wfhCount: number;
  approvedLeaveCount: number;
  holidayCount: number;
  weeklyOffCount: number;
  pendingConfirmationCount: number;
  recordedAbsenceCount: number;
  scheduledWorkingDays: number;
}

export interface ResourceViewPayload {
  selectedVertical: 'all' | 'wealth' | 'banking' | 'markets' | 'real_estate';
  selectedDate: string;
  metrics: ResourceSummaryMetrics;
  breakdown: DailyResourceBreakdownItem[];
  holidaysForMonth: CalendarHolidayRecord[];
}
