import type {
  ErrorResponse,
  FollowUpInput,
  FollowUpResult,
  LeadDetail,
  LeadSummary,
  MyDayResponse,
  SessionResponse,
  WorkspaceSession,
} from '@finverse/contracts';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fieldErrors?: Record<string, string[]>
  ) {
    super(message);
  }
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: init.body ? { 'Content-Type': 'application/json' } : {},
    ...init,
    body: init.body,
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  if (!res.ok) {
    const err: ErrorResponse | null = parsed;
    if (res.status === 401 && err?.error?.code === 'UNAUTHENTICATED' && !path.startsWith('/api/auth/')) {
      sessionStorage.setItem('finverse-session-expired', '1');
      window.dispatchEvent(new Event('finverse:session-expired'));
    }
    throw new ApiError(
      res.status,
      err?.error?.code ?? 'INTERNAL',
      err?.error?.message ?? 'Something went wrong. Try again.',
      err?.error?.details?.fieldErrors
    );
  }
  return parsed as T;
}

export const api = {
  me: () => request<SessionResponse>('/api/auth/me'),
  login: (email: string, password: string) =>
    request<SessionResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request<void>('/api/auth/logout', { method: 'POST', body: JSON.stringify({}) }),
  myDay: () => request<MyDayResponse>('/api/my-day'),
  leads: (params: Record<string, string>) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v));
    const suffix = qs.toString() ? `?${qs}` : '';
    return request<{ leads: LeadSummary[] }>(`/api/leads${suffix}`);
  },
  lead: (id: string) => request<LeadDetail>(`/api/leads/${encodeURIComponent(id)}`),
  followUp: (id: string, input: FollowUpInput) =>
    request<FollowUpResult>(`/api/leads/${encodeURIComponent(id)}/follow-ups`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  activate: (token: string, password: string) =>
    request<{ data: any }>('/api/auth/activate', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }),
  resetPassword: (token: string, password: string) =>
    request<{ data: any }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }),
  forgotPassword: (identity: string) =>
    request<{ data: { success: boolean; message: string } }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ identity }),
    }),
  changePassword: (newPassword: string) =>
    request<{ data: { success: boolean; message: string } }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    }),
  localDelivery: (limit = 20) =>
    request<{ data: any[] }>(`/api/auth/local-delivery?limit=${limit}`),
};

export type { WorkspaceSession };
