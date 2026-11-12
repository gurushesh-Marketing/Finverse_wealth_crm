import { request } from './api';
import type {
  CreateManagementActionInput,
  CreateLeadTransferInput,
  DecideLeadTransferInput,
  SaveCapacityPlanInput,
  AllocateManagerTargetInput,
  DecideTlForecastInput,
  SubmitManagerForecastInput,
  ResolveSlaBreachInput,
  DecideCommercialExceptionInput,
  CreateSourceRemediationInput,
  CreateTlPerformanceReviewInput,
  CreateEmployeeLifecycleInput,
  ManagerReportScheduleInput,
  MgPeriod,
} from '@finverse/contracts';

const BASE = '/api/manager';

export const managerApi = {
  // MG-01: Manager Overview
  overview: (period: MgPeriod = 'month-to-date', comparison = 'previous-period') =>
    request<any>(`${BASE}/overview?period=${encodeURIComponent(period)}&comparison=${encodeURIComponent(comparison)}`),

  getTls: () => request<any[]>(`${BASE}/tls`),

  // MG-02: TL Scorecard
  getTlScorecard: (tlId: string, period = 'September') =>
    request<any>(`${BASE}/scorecard/${encodeURIComponent(tlId)}?period=${encodeURIComponent(period)}`),

  // Management actions (MG-01, MG-02, MG-08, MG-11)
  createAction: (input: CreateManagementActionInput) =>
    request<any>(`${BASE}/actions`, { method: 'POST', body: JSON.stringify(input) }),

  listActions: (tlId?: string) =>
    request<any[]>(tlId ? `${BASE}/actions?tlId=${encodeURIComponent(tlId)}` : `${BASE}/actions`),

  // MG-03: Cross-Team Lead Transfers
  listTransfers: () => request<any[]>(`${BASE}/transfers`),

  createTransfer: (input: CreateLeadTransferInput) =>
    request<any>(`${BASE}/transfers`, { method: 'POST', body: JSON.stringify(input) }),

  decideTransfer: (input: DecideLeadTransferInput) =>
    request<any>(`${BASE}/transfers/decide`, { method: 'POST', body: JSON.stringify(input) }),

  // MG-04: Capacity Recovery Plans
  getCapacity: () => request<any>(`${BASE}/capacity`),

  saveCapacityPlan: (input: SaveCapacityPlanInput) =>
    request<any>(`${BASE}/capacity/plan`, { method: 'POST', body: JSON.stringify(input) }),

  // MG-05: Targets
  getTargets: (period = 'October') =>
    request<any>(`${BASE}/targets?period=${encodeURIComponent(period)}`),

  allocateTargets: (input: AllocateManagerTargetInput) =>
    request<any>(`${BASE}/targets/allocate`, { method: 'POST', body: JSON.stringify(input) }),

  // MG-06: TL Forecast Review
  getForecasts: (period = 'October') =>
    request<any[]>(`${BASE}/forecasts?period=${encodeURIComponent(period)}`),

  decideForecast: (input: DecideTlForecastInput) =>
    request<any>(`${BASE}/forecasts/decide`, { method: 'POST', body: JSON.stringify(input) }),

  // MG-07: Submit Manager Forecast to RM
  getForecastRollup: (period = 'October') =>
    request<any>(`${BASE}/forecasts/rollup?period=${encodeURIComponent(period)}`),

  submitForecast: (input: SubmitManagerForecastInput) =>
    request<any>(`${BASE}/forecasts/submit`, { method: 'POST', body: JSON.stringify(input) }),

  // MG-08: Resolve SLA Breach
  getSlaBreaches: () => request<any[]>(`${BASE}/sla-breaches`),

  resolveSlaBreach: (input: ResolveSlaBreachInput) =>
    request<any>(`${BASE}/sla-breaches/resolve`, { method: 'POST', body: JSON.stringify(input) }),

  // MG-09: Commercial Exceptions
  getCommercialExceptions: () => request<any[]>(`${BASE}/commercial-exceptions`),

  decideCommercialException: (input: DecideCommercialExceptionInput) =>
    request<any>(`${BASE}/commercial-exceptions/decide`, { method: 'POST', body: JSON.stringify(input) }),

  // MG-10: Source Quality
  getSourceQuality: (period = 'September') =>
    request<any>(`${BASE}/source-quality?period=${encodeURIComponent(period)}`),

  createSourceRemediation: (input: CreateSourceRemediationInput) =>
    request<any>(`${BASE}/source-quality/remediation`, { method: 'POST', body: JSON.stringify(input) }),

  // MG-11: TL Reviews
  getReviews: (tlId?: string) =>
    request<any[]>(tlId ? `${BASE}/reviews?tlId=${encodeURIComponent(tlId)}` : `${BASE}/reviews`),

  createReview: (input: CreateTlPerformanceReviewInput) =>
    request<any>(`${BASE}/reviews`, { method: 'POST', body: JSON.stringify(input) }),

  // MG-12: Employee Lifecycle
  getLifecycleRequests: () => request<any[]>(`${BASE}/lifecycle`),

  createLifecycleRequest: (input: CreateEmployeeLifecycleInput) =>
    request<any>(`${BASE}/lifecycle`, { method: 'POST', body: JSON.stringify(input) }),

  // MG-13: Meeting Pack PDF & Schedules
  previewMeetingPack: (period: MgPeriod = 'month-to-date') =>
    request<any>(`${BASE}/meeting-pack/preview?period=${encodeURIComponent(period)}`),

  exportMeetingPack: (period: MgPeriod = 'month-to-date') =>
    request<{ id: string; filename: string; relPath: string }>(`${BASE}/meeting-pack/export`, {
      method: 'POST',
      body: JSON.stringify({ period }),
    }),

  getSchedules: () => request<any[]>(`${BASE}/schedules`),

  createSchedule: (input: ManagerReportScheduleInput) =>
    request<any>(`${BASE}/schedules`, { method: 'POST', body: JSON.stringify(input) }),
};
