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
};

export type { WorkspaceSession };
