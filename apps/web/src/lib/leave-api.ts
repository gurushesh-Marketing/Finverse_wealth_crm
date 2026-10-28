import type {
  SubmitLeaveRequestInput,
  DecideLeaveRequestInput,
  ConfigureApproverInput,
  LeaveFilterQuery,
  LeaveRequestRecord,
  ApproverConfigRecord,
} from '@finverse/contracts';

async function req<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api/leave${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg = body?.error?.message || body?.message || 'Request failed';
    const err = new Error(errorMsg);
    (err as any).code = body?.error?.code;
    throw err;
  }
  return body.data ?? body;
}

export const leaveApi = {
  submitRequest: (data: SubmitLeaveRequestInput) =>
    req<{ success: boolean; requestId: string; status: string; approverId: string; approverTitle: string; totalDays: number }>(
      '/requests',
      { method: 'POST', body: JSON.stringify(data) }
    ),

  getMyRequests: () => req<LeaveRequestRecord[]>('/my-requests'),

  withdrawRequest: (id: string, notes?: string) =>
    req<{ success: boolean; requestId: string; status: string }>(
      `/requests/${id}/withdraw`,
      { method: 'POST', body: JSON.stringify({ notes }) }
    ),

  getApprovalsQueue: () => req<LeaveRequestRecord[]>('/approvals'),

  approveRequest: (id: string, notes?: string) =>
    req<{ success: boolean; requestId: string; status: string; decidedAt: string }>(
      `/requests/${id}/approve`,
      { method: 'POST', body: JSON.stringify({ notes }) }
    ),

  rejectRequest: (id: string, notes: string) =>
    req<{ success: boolean; requestId: string; status: string; decidedAt: string }>(
      `/requests/${id}/reject`,
      { method: 'POST', body: JSON.stringify({ notes }) }
    ),

  getOrganizationRequests: (filters: LeaveFilterQuery = {}) => {
    const q = new URLSearchParams();
    if (filters.vertical) q.set('vertical', filters.vertical);
    if (filters.role) q.set('role', filters.role);
    if (filters.teamId) q.set('teamId', filters.teamId);
    if (filters.employeeId) q.set('employeeId', filters.employeeId);
    if (filters.status) q.set('status', filters.status);
    if (filters.startDate) q.set('startDate', filters.startDate);
    if (filters.endDate) q.set('endDate', filters.endDate);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return req<LeaveRequestRecord[]>(`/organization-requests${qs}`);
  },

  getApproverConfigs: () => req<ApproverConfigRecord[]>('/approver-configs'),

  configureApprover: (data: ConfigureApproverInput) =>
    req<{ success: boolean; configId: string }>('/approver-configs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
