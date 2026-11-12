import { request } from './api';
import type {
  CreateRegionalActionInput,
  SaveTerritoryPlanInput,
  AllocateRegionalTargetInput,
  CreateCrossManagerTransferInput,
  DecideCrossManagerTransferInput,
  SaveRegionalStaffingPlanInput,
  SubmitRegionalForecastInput,
  CreateRegionalEscalationInput,
  ResolveRegionalEscalationInput,
  SaveManagerReviewInput,
  SaveRegionalReportScheduleInput,
  GenerateRegionalPdfPackInput,
  RmPeriod,
} from '@finverse/contracts';

const BASE = '/api/regional';

export const regionalApi = {
  // Scope
  getScope: () => request<{ data: any }>(`${BASE}/scope`).then((r) => r.data),

  // RM-01: Regional Overview
  overview: (period: RmPeriod = 'month-to-date') =>
    request<{ data: any }>(`${BASE}/overview?period=${encodeURIComponent(period)}`).then((r) => r.data),

  // Regional Actions (RM-01, RM-02, RM-08, RM-09)
  createAction: (input: CreateRegionalActionInput) =>
    request<{ data: any }>(`${BASE}/actions`, { method: 'POST', body: JSON.stringify(input) }).then((r) => r.data),

  listActions: (managerId?: string) =>
    request<{ data: any[] }>(managerId ? `${BASE}/actions?managerId=${encodeURIComponent(managerId)}` : `${BASE}/actions`).then((r) => r.data),

  // RM-02: Manager Scorecard
  getManagerScorecard: (managerId: string, period = 'September') =>
    request<{ data: any }>(`${BASE}/managers/${encodeURIComponent(managerId)}/scorecard?period=${encodeURIComponent(period)}`).then((r) => r.data),

  // RM-03: Territory Coverage Plans
  getTerritories: () => request<{ data: any }>(`${BASE}/territories`).then((r) => r.data),

  saveTerritoryPlan: (input: SaveTerritoryPlanInput) =>
    request<{ data: any }>(`${BASE}/territories`, { method: 'POST', body: JSON.stringify(input) }).then((r) => r.data),

  // RM-04: Regional Targets
  getTargets: () => request<{ data: any }>(`${BASE}/targets`).then((r) => r.data),

  allocateTargets: (input: AllocateRegionalTargetInput) =>
    request<{ data: any }>(`${BASE}/targets/allocate`, { method: 'POST', body: JSON.stringify(input) }).then((r) => r.data),

  // RM-05: Cross-Manager Transfers
  listTransfers: () => request<{ data: any[] }>(`${BASE}/transfers`).then((r) => r.data),

  createTransfer: (input: CreateCrossManagerTransferInput) =>
    request<{ data: any }>(`${BASE}/transfers`, { method: 'POST', body: JSON.stringify(input) }).then((r) => r.data),

  decideTransfer: (input: DecideCrossManagerTransferInput) =>
    request<{ data: any }>(`${BASE}/transfers/decide`, { method: 'POST', body: JSON.stringify(input) }).then((r) => r.data),

  // RM-06: Regional Staffing Plans
  getStaffing: () => request<{ data: any }>(`${BASE}/staffing`).then((r) => r.data),

  saveStaffingPlan: (input: SaveRegionalStaffingPlanInput) =>
    request<{ data: any }>(`${BASE}/staffing`, { method: 'POST', body: JSON.stringify(input) }).then((r) => r.data),

  // RM-07: Regional Forecast Rollup & Submission
  getForecasts: (period = 'October') =>
    request<{ data: any }>(`${BASE}/forecasts?period=${encodeURIComponent(period)}`).then((r) => r.data),

  submitForecast: (input: SubmitRegionalForecastInput) =>
    request<{ data: any }>(`${BASE}/forecasts/submit`, { method: 'POST', body: JSON.stringify(input) }).then((r) => r.data),

  // RM-08: Regional Escalations & Exceptions
  listEscalations: () => request<{ data: any[] }>(`${BASE}/escalations`).then((r) => r.data),

  createEscalation: (input: CreateRegionalEscalationInput) =>
    request<{ data: any }>(`${BASE}/escalations`, { method: 'POST', body: JSON.stringify(input) }).then((r) => r.data),

  resolveEscalation: (input: ResolveRegionalEscalationInput) =>
    request<{ data: any }>(`${BASE}/escalations/resolve`, { method: 'POST', body: JSON.stringify(input) }).then((r) => r.data),

  // RM-09: Manager Reviews
  listReviews: (managerId?: string) =>
    request<{ data: any[] }>(managerId ? `${BASE}/reviews?managerId=${encodeURIComponent(managerId)}` : `${BASE}/reviews`).then((r) => r.data),

  saveReview: (input: SaveManagerReviewInput) =>
    request<{ data: any }>(`${BASE}/reviews`, { method: 'POST', body: JSON.stringify(input) }).then((r) => r.data),

  // RM-10: Reports & Schedules
  previewReportPack: (period = 'October 2026') =>
    request<{ data: any }>(`${BASE}/reports/preview?period=${encodeURIComponent(period)}`).then((r) => r.data),

  generatePdfPack: (input: GenerateRegionalPdfPackInput) =>
    request<{ data: { downloadUrl: string } }>(`${BASE}/reports/generate-pdf`, { method: 'POST', body: JSON.stringify(input) }).then((r) => r.data),

  listReportSchedules: () =>
    request<{ data: any[] }>(`${BASE}/reports/schedules`).then((r) => r.data),

  saveReportSchedule: (input: SaveRegionalReportScheduleInput) =>
    request<{ data: any }>(`${BASE}/reports/schedules`, { method: 'POST', body: JSON.stringify(input) }).then((r) => r.data),
};
