import { request } from './api';

const BASE = '/api/tl';

export const tlApi = {
  daySignal: () => request<any>('/api/my-day/signal'),
  overview: (period = 'today', comparison = 'previous day') =>
    request<any>(`${BASE}/overview?period=${period}&comparison=${encodeURIComponent(comparison)}`),
  drill: (metric: string, period = 'today') =>
    request<any>(`${BASE}/overview/drill?metric=${metric}&period=${period}`),
  correctiveTask: (leadId: string, purpose: string, dueAt: string) =>
    request<any>(`${BASE}/overview/corrective-task`, { method: 'POST', body: JSON.stringify({ leadId, purpose, dueAt }) }),

  allocationQueue: () => request<any>(`${BASE}/allocation/queue`),
  recipients: () => request<any>(`${BASE}/allocation/recipients`),
  allocate: (leadId: string, toEmployeeId: string, reason: string, recordVersion: number) =>
    request<any>(`${BASE}/allocation`, { method: 'POST', body: JSON.stringify({ leadId, toEmployeeId, reason, recordVersion }) }),
  batchPreview: (body: any) => request<any>(`${BASE}/allocation/batch/preview`, { method: 'POST', body: JSON.stringify(body) }),
  batchCommit: (body: any) => request<any>(`${BASE}/allocation/batch`, { method: 'POST', body: JSON.stringify(body) }),

  workload: () => request<any>(`${BASE}/workload`),
  rebalance: (body: any) => request<any>(`${BASE}/rebalance`, { method: 'POST', body: JSON.stringify(body) }),

  overdue: () => request<any>(`${BASE}/overdue`),
  overdueAction: (taskId: string, body: any) => request<any>(`${BASE}/overdue/${taskId}/action`, { method: 'POST', body: JSON.stringify(body) }),

  member: (id: string, period = 'month') => request<any>(`${BASE}/members/${id}?period=${period}`),

  decisions: () => request<any>(`${BASE}/decisions`),
  decide: (
    requestId: string,
    decision: 'approve' | 'return' | 'reject' | boolean,
    reason: string,
    evidence?: Record<string, unknown>
  ) => {
    const payload =
      typeof decision === 'string'
        ? { decision, reason, evidence: evidence ?? {} }
        : { approve: decision, reason, evidence: evidence ?? {} };
    return request<any>(`/api/requests/${requestId}/decide`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  duplicateDisposition: (enquiryId: string, decision: 'confirm-separate' | 'route-merge') =>
    request<any>(`${BASE}/duplicates/${enquiryId}/disposition`, { method: 'POST', body: JSON.stringify({ decision }) }),

  qualityReviews: () => request<any>(`${BASE}/quality-reviews`),
  createQualityReview: (body: any) => request<any>(`${BASE}/quality-reviews`, { method: 'POST', body: JSON.stringify(body) }),
  qualityEvidence: (id: string) => request<any>(`${BASE}/quality-reviews/${id}/evidence`),

  corrections: () => request<any>(`${BASE}/activity-corrections`),
  submitCorrection: (body: any) => request<any>(`${BASE}/activity-corrections`, { method: 'POST', body: JSON.stringify(body) }),
  decideCorrection: (
    id: string,
    decision: 'accept' | 'return' | 'reject' | boolean,
    reason: string,
    evidence?: Record<string, unknown>
  ) => {
    const payload =
      typeof decision === 'string'
        ? { decision, reason, evidence: evidence ?? {} }
        : { accept: decision, reason, evidence: evidence ?? {} };
    return request<any>(`${BASE}/activity-corrections/${id}/decision`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  targets: () => request<any>(`${BASE}/targets`),
  createTarget: (body: any) => request<any>(`${BASE}/targets`, { method: 'POST', body: JSON.stringify(body) }),
  allocateTarget: (id: string, body: any) => request<any>(`${BASE}/targets/${id}/allocations`, { method: 'POST', body: JSON.stringify(body) }),

  forecasts: () => request<any>(`${BASE}/forecasts`),
  submitForecast: (body: any) => request<any>(`${BASE}/forecasts`, { method: 'POST', body: JSON.stringify(body) }),

  oneToOnes: () => request<any>(`${BASE}/one-to-ones`),
  createOneToOne: (body: any) => request<any>(`${BASE}/one-to-ones`, { method: 'POST', body: JSON.stringify(body) }),
  completeOneToOne: (id: string, body: any) => request<any>(`${BASE}/one-to-ones/${id}/complete`, { method: 'POST', body: JSON.stringify(body) }),

  mentorships: () => request<any>(`${BASE}/mentorships`),
  createMentorship: (body: any) => request<any>(`${BASE}/mentorships`, { method: 'POST', body: JSON.stringify(body) }),

  teamRequests: () => request<any>(`${BASE}/team-requests`),
  createTeamRequest: (body: any) => request<any>(`${BASE}/team-requests`, { method: 'POST', body: JSON.stringify(body) }),

  teamPacks: (body: any) => request<any>(`${BASE}/team-packs`, { method: 'POST', body: JSON.stringify(body) }),
  teamPackDownloadPath: (id: string) => `${BASE}/team-packs/${id}/download`,

  schedules: () => request<any>(`${BASE}/report-schedules`),
  createSchedule: (body: any) => request<any>(`${BASE}/report-schedules`, { method: 'POST', body: JSON.stringify(body) }),
  tickSchedules: () => request<any>(`${BASE}/report-schedules/tick`, { method: 'POST', body: JSON.stringify({}) }),
};
