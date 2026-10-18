import type {
  HrRequestAccountInput,
  HrRequestTransferInput,
  HrRequestPromotionInput,
  HrCoordinateExitInput,
  HrRecordLeaveInput,
  HrUpdateMilestoneInput,
  HrPrepareReportPackInput,
  HrCreateReportScheduleInput,
  HrAttachApprovalInput,
  HrUpdateRequestInput,
} from '@finverse/contracts';

async function req<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api/hr${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg = body?.error?.message || body?.message || 'Request failed';
    throw new Error(errorMsg);
  }
  return body.data ?? body;
}

export const hrApi = {
  getOverview: () => req<any>('/overview'),

  // Requests tracker
  listRequests: (params?: { type?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.type) q.set('type', params.type);
    if (params?.status) q.set('status', params.status);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return req<any[]>(`/requests${qs}`);
  },
  getRequest: (id: string) => req<any>(`/requests/${id}`),
  attachApproval: (id: string, data: HrAttachApprovalInput) =>
    req<any>(`/requests/${id}/approve`, { method: 'POST', body: JSON.stringify(data) }),
  updateRequest: (id: string, data: HrUpdateRequestInput) =>
    req<any>(`/requests/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // HR-01
  requestAccount: (data: HrRequestAccountInput) =>
    req<any>('/accounts/request', { method: 'POST', body: JSON.stringify(data) }),

  // HR-02
  requestTransfer: (data: HrRequestTransferInput) =>
    req<any>('/transfers/request', { method: 'POST', body: JSON.stringify(data) }),

  // HR-03
  requestPromotion: (data: HrRequestPromotionInput) =>
    req<any>('/promotions/request', { method: 'POST', body: JSON.stringify(data) }),

  // HR-04
  coordinateExit: (data: HrCoordinateExitInput) =>
    req<any>('/exits/coordinate', { method: 'POST', body: JSON.stringify(data) }),

  // HR-05
  listLeaves: (params?: { employeeId?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.employeeId) q.set('employeeId', params.employeeId);
    if (params?.status) q.set('status', params.status);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return req<any[]>(`/leaves${qs}`);
  },
  recordLeave: (data: HrRecordLeaveInput) =>
    req<any>('/leaves', { method: 'POST', body: JSON.stringify(data) }),

  // HR-06
  listMilestones: (params?: { status?: string; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.search) q.set('search', params.search);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return req<any[]>(`/milestones${qs}`);
  },
  updateMilestone: (data: HrUpdateMilestoneInput) =>
    req<any>('/milestones/update', { method: 'POST', body: JSON.stringify(data) }),

  // HR-07
  listReports: () => req<any[]>('/reports'),
  generateReport: (data: HrPrepareReportPackInput) =>
    req<any>('/reports/generate', { method: 'POST', body: JSON.stringify(data) }),
  listSchedules: () => req<any[]>('/reports/schedules'),
  createSchedule: (data: HrCreateReportScheduleInput) =>
    req<any>('/reports/schedules', { method: 'POST', body: JSON.stringify(data) }),
};
