import type {
  AvailabilityChangeInput,
  AuditEntry,
  CallRecord,
  ConversionInput,
  DocumentRecord,
  DocumentRequestInput,
  DocumentRequestRecord,
  Enquiry,
  EnquiryInput,
  HandoffInput,
  HelpRequestInput,
  LossInput,
  ManualActivityInput,
  MeetingInput,
  MeetingRecord,
  MessageRecord,
  OptOutInput,
  PerformanceReport,
  ProposalInput,
  ProposalRecord,
  ProspectCorrectionInput,
  QualificationInput,
  ReportExportRecord,
  ReportPeriod,
  RescheduleInput,
  ReviewRecord,
  ReviewResponseInput,
  ReopenInput,
  SavedView,
  SavedViewInput,
  StageChangeInput,
  TaskAction,
  TaskPriority,
  TaskTransitionInput,
  WrapUpInput,
} from '@finverse/contracts';
import { ApiError, request } from './api';

export interface TaskView {
  id: string;
  leadId: string;
  leadName?: string;
  leadStage?: string;
  leadSource?: string;
  action: TaskAction;
  purpose: string;
  dueAt: string;
  originalDueAt: string | null;
  priority: TaskPriority;
  status: string;
  deferralCount: number;
  reminders: Array<{ id: string; taskId: string; remindAt: string; status: string }>;
}

export interface OutcomeRequestView {
  id: string;
  leadId: string;
  type: string;
  status: string;
  payload: Record<string, unknown>;
  decisionReason: string | null;
  decisionEvidence?: Record<string, unknown>;
  decidedBy?: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export const wealthApi = {
  setAvailability: (input: AvailabilityChangeInput) =>
    request<{ status: string; effectiveFrom: string }>('/api/availability', { method: 'POST', body: JSON.stringify(input) }),
  listViews: () => request<{ views: SavedView[] }>('/api/views'),
  createView: (input: SavedViewInput) => request<SavedView>('/api/views', { method: 'POST', body: JSON.stringify(input) }),
  removeView: (id: string) => request<void>(`/api/views/${id}`, { method: 'DELETE', body: JSON.stringify({}) }),
  correct: (leadId: string, input: ProspectCorrectionInput) =>
    request<{ status: string; changed: boolean; audit: AuditEntry[]; requestId?: string }>(`/api/leads/${leadId}`, { method: 'PATCH', body: JSON.stringify(input) }),
  audit: (leadId: string) => request<{ audit: AuditEntry[] }>(`/api/leads/${leadId}/audit`),
  listEnquiries: () => request<{ enquiries: Enquiry[] }>('/api/enquiries'),
  createEnquiry: (input: EnquiryInput) => request<Enquiry>('/api/enquiries', { method: 'POST', body: JSON.stringify(input) }),
  publishEnquiry: (id: string) => request<{ leadId: string; status: string }>(`/api/enquiries/${id}/publish`, { method: 'POST', body: JSON.stringify({}) }),
  conversations: (leadId: string) =>
    request<{ calls: CallRecord[]; messages: MessageRecord[] }>(`/api/leads/${leadId}/conversations`),
  startCall: (leadId: string, input: { mode: string; idempotencyKey: string }) =>
    request<CallRecord>(`/api/leads/${leadId}/calls`, { method: 'POST', body: JSON.stringify(input) }),
  callState: (callId: string, status: string) =>
    request<CallRecord>(`/api/calls/${callId}/state`, { method: 'POST', body: JSON.stringify({ status }) }),
  wrapup: (callId: string, input: WrapUpInput) =>
    request<{ ok: boolean }>(`/api/calls/${callId}/wrapup`, { method: 'POST', body: JSON.stringify(input) }),
  manualActivity: (leadId: string, input: ManualActivityInput) =>
    request<CallRecord>(`/api/leads/${leadId}/activities`, { method: 'POST', body: JSON.stringify(input) }),
  sendMessage: (leadId: string, input: { template: string; language: string; variables: Record<string, string>; bodyPreview: string }) =>
    request<MessageRecord>(`/api/leads/${leadId}/messages`, { method: 'POST', body: JSON.stringify(input) }),
  messageStatus: (id: string, status: string) =>
    request<MessageRecord>(`/api/messages/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
  inbound: (input: { channel: string; matchedLeadId?: string; receivedAt: string; intent: string; body: string; inboundKey: string }) =>
    request<{ status: string; routedTo: string }>('/api/inbound', { method: 'POST', body: JSON.stringify(input) }),
  optOut: (leadId: string, input: OptOutInput) =>
    request<{ ok: boolean }>(`/api/leads/${leadId}/opt-out`, { method: 'POST', body: JSON.stringify(input) }),
  tasks: (leadId?: string) =>
    request<{ tasks: TaskView[] }>(`/api/tasks${leadId ? `?leadId=${encodeURIComponent(leadId)}` : ''}`),
  reschedule: (taskId: string, input: RescheduleInput) =>
    request<{ status: string; requestId: string | null; task: TaskView }>(`/api/tasks/${taskId}/reschedule`, { method: 'POST', body: JSON.stringify(input) }),
  transition: (taskId: string, input: TaskTransitionInput) =>
    request<{ ok: boolean }>(`/api/tasks/${taskId}/transition`, { method: 'POST', body: JSON.stringify(input) }),
  tickReminders: () => request<{ sent: number }>('/api/reminders/tick', { method: 'POST', body: JSON.stringify({}) }),
  bookMeeting: (leadId: string, input: MeetingInput) =>
    request<MeetingRecord>(`/api/leads/${leadId}/meetings`, { method: 'POST', body: JSON.stringify(input) }),
  meetingOutcome: (id: string, outcome: string) =>
    request<{ ok: boolean }>(`/api/meetings/${id}/outcome`, { method: 'POST', body: JSON.stringify({ outcome }) }),
  qualification: (leadId: string, input: QualificationInput) =>
    request<{ id: string; recommendedNextStep: string }>(`/api/leads/${leadId}/qualification`, { method: 'POST', body: JSON.stringify(input) }),
  moveStage: (leadId: string, input: StageChangeInput) =>
    request<{ ok: boolean; stage: string }>(`/api/leads/${leadId}/stage`, { method: 'POST', body: JSON.stringify(input) }),
  proposals: (leadId: string) => request<{ proposals: ProposalRecord[] }>(`/api/leads/${leadId}/proposals`),
  createProposal: (leadId: string, input: ProposalInput) =>
    request<ProposalRecord>(`/api/leads/${leadId}/proposals`, { method: 'POST', body: JSON.stringify(input) }),
  submitProposal: (id: string) => request<{ status: string }>(`/api/proposals/${id}/submit`, { method: 'POST', body: JSON.stringify({}) }),
  sendProposal: (id: string) => request<{ status: string }>(`/api/proposals/${id}/send`, { method: 'POST', body: JSON.stringify({}) }),
  conversion: (leadId: string, input: ConversionInput) =>
    request<{ requestId: string; status: string }>(`/api/leads/${leadId}/conversion`, { method: 'POST', body: JSON.stringify(input) }),
  loss: (leadId: string, input: LossInput) =>
    request<{ ok: boolean }>(`/api/leads/${leadId}/loss`, { method: 'POST', body: JSON.stringify(input) }),
  reopen: (leadId: string, input: ReopenInput) =>
    request<{ requestId: string; status: string }>(`/api/leads/${leadId}/reopen`, { method: 'POST', body: JSON.stringify(input) }),
  handoff: (leadId: string, input: HandoffInput) =>
    request<{ requestId: string; status: string }>(`/api/leads/${leadId}/handoff`, { method: 'POST', body: JSON.stringify(input) }),
  help: (leadId: string, input: HelpRequestInput) =>
    request<{ requestId: string; status: string }>(`/api/leads/${leadId}/help`, { method: 'POST', body: JSON.stringify(input) }),
  requests: (leadId: string) => request<{ requests: OutcomeRequestView[] }>(`/api/leads/${leadId}/requests`),
  decide: (requestId: string, approve: boolean, reason: string) =>
    request<{ ok: boolean }>(`/api/requests/${requestId}/decide`, { method: 'POST', body: JSON.stringify({ approve, reason }) }),
  docRequests: (leadId: string) => request<{ requests: DocumentRequestRecord[] }>(`/api/leads/${leadId}/document-requests`),
  createDocRequest: (leadId: string, input: DocumentRequestInput) =>
    request<DocumentRequestRecord>(`/api/leads/${leadId}/document-requests`, { method: 'POST', body: JSON.stringify(input) }),
  rotateToken: (id: string) => request<DocumentRequestRecord>(`/api/document-requests/${id}/rotate`, { method: 'POST', body: JSON.stringify({}) }),
  documents: (leadId: string) => request<{ documents: DocumentRecord[] }>(`/api/leads/${leadId}/documents`),
  uploadDocument: (input: { leadId: string; requestId?: string; documentType: string; filename: string; mimeType: string; contentBase64: string }) =>
    request<DocumentRecord>('/api/documents', { method: 'POST', body: JSON.stringify(input) }),
  reviewDocument: (id: string, accept: boolean, reason?: string) =>
    request<{ validationStatus: string }>(`/api/documents/${id}/review`, { method: 'POST', body: JSON.stringify({ accept, reason }) }),
  performance: (period: ReportPeriod) => request<PerformanceReport>(`/api/reports/performance?period=${period}`),
  exportPdf: (period: ReportPeriod) =>
    request<ReportExportRecord>('/api/reports/exports', { method: 'POST', body: JSON.stringify({ period }) }),
  reviews: () => request<{ reviews: ReviewRecord[] }>('/api/reviews'),
  respondReview: (id: string, input: ReviewResponseInput) =>
    request<{ ok: boolean }>(`/api/reviews/${id}/response`, { method: 'POST', body: JSON.stringify(input) }),
};

export async function downloadFile(path: string, filename: string): Promise<void> {
  const res = await fetch(path, { credentials: 'include' });
  if (!res.ok) {
    let message = 'Download failed. Try again.';
    try {
      const body = await res.json();
      message = body?.error?.message ?? message;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, 'INTERNAL', message);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const docDownloadPath = (id: string) => `/api/documents/${id}/download`;
export const exportDownloadPath = (id: string) => `/api/reports/exports/${id}/download`;
