import type {
  CheckInInput,
  CheckOutInput,
  ProgressLogInput,
  RegularizationRequestInput,
  RegularizationDecisionInput,
  SupervisorReviewInput,
  ResourceViewQuery,
  AttendanceRecord,
  AttendanceProgressLogRecord,
  AttendanceRegularizationRecord,
  ResourceViewPayload,
} from '@finverse/contracts';

async function req<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'same-origin',
  });

  if (!res.ok) {
    let errBody: any;
    try {
      errBody = await res.json();
    } catch {
      errBody = { error: { message: `Request failed with HTTP ${res.status}` } };
    }
    const message = errBody?.error?.message || `HTTP ${res.status}`;
    const err: any = new Error(message);
    err.status = res.status;
    err.code = errBody?.error?.code;
    throw err;
  }

  return res.json();
}

export const attendanceApi = {
  checkIn: async (input: CheckInInput): Promise<AttendanceRecord> => {
    return req<AttendanceRecord>('/api/attendance/check-in', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  checkOut: async (input: CheckOutInput): Promise<AttendanceRecord> => {
    return req<AttendanceRecord>('/api/attendance/check-out', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  addProgressLog: async (input: ProgressLogInput): Promise<AttendanceProgressLogRecord> => {
    return req<AttendanceProgressLogRecord>('/api/attendance/progress-log', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  getMyAttendance: async (dateOrMonth?: string): Promise<{
    todayRecord: AttendanceRecord | null;
    history: AttendanceRecord[];
    pendingRegularizations: AttendanceRegularizationRecord[];
  }> => {
    const q = dateOrMonth ? `?dateOrMonth=${encodeURIComponent(dateOrMonth)}` : '';
    return req(`/api/attendance/my-attendance${q}`);
  },

  getSupervisorExceptions: async (): Promise<{
    pendingRecords: AttendanceRecord[];
    pendingRegularizations: AttendanceRegularizationRecord[];
  }> => {
    return req('/api/attendance/supervisor-exceptions');
  },

  reviewAttendanceRecord: async (
    recordId: string,
    input: SupervisorReviewInput
  ): Promise<AttendanceRecord> => {
    return req<AttendanceRecord>(`/api/attendance/records/${recordId}/review`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  requestRegularization: async (
    input: RegularizationRequestInput
  ): Promise<AttendanceRegularizationRecord> => {
    return req<AttendanceRegularizationRecord>('/api/attendance/regularization', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  decideRegularization: async (
    requestId: string,
    input: RegularizationDecisionInput
  ): Promise<AttendanceRegularizationRecord> => {
    return req<AttendanceRegularizationRecord>(`/api/attendance/regularization/${requestId}/decision`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  getResourceView: async (query: ResourceViewQuery = {}): Promise<ResourceViewPayload> => {
    const params = new URLSearchParams();
    if (query.vertical) params.set('vertical', query.vertical);
    if (query.date) params.set('date', query.date);
    if (query.month) params.set('month', query.month);
    if (query.role) params.set('role', query.role);
    const qs = params.toString();
    return req<ResourceViewPayload>(`/api/attendance/resource-view${qs ? `?${qs}` : ''}`);
  },
};
