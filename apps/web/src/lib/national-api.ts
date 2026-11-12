import { request } from './api';
import type {
  CreateNationalActionInput,
  AllocateNationalTargetInput,
  ProposeProductRuleInput,
  SubmitNationalForecastInput,
  CreateCrossRegionTransferInput,
  DecideCrossRegionTransferInput,
  DecideCrossVerticalReferralInput,
  CreateNationalEscalationInput,
  ResolveNationalEscalationInput,
  SaveRmReviewInput,
  SaveNationalReportScheduleInput,
  GenerateNationalPdfPackInput,
  NmPeriod,
} from '@finverse/contracts';

const BASE = '/api/national';

export const nationalApi = {
  // Scope
  getScope: () => request<{ data: any }>(`${BASE}/scope`).then((r) => r.data),

  // NM-01: National Overview
  overview: (period: NmPeriod = 'month-to-date') =>
    request<{ data: any }>(`${BASE}/overview?period=${encodeURIComponent(period)}`).then((r) => r.data),

  // National Actions (NM-01, NM-02, NM-09, NM-10)
  listActions: (status?: string) =>
    request<{ data: any[] }>(status ? `${BASE}/actions?status=${encodeURIComponent(status)}` : `${BASE}/actions`).then((r) => r.data),

  createAction: (input: CreateNationalActionInput) =>
    request<{ data: any }>(`${BASE}/actions`, { method: 'POST', body: JSON.stringify(input) }).then((r) => r.data),

  completeAction: (actionId: string) =>
    request<{ data: any }>(`${BASE}/actions/${encodeURIComponent(actionId)}/complete`, { method: 'POST' }).then((r) => r.data),

  // NM-02: Regional Comparisons
  getComparisons: (period = 'September') =>
    request<{ data: any }>(`${BASE}/comparisons?period=${encodeURIComponent(period)}`).then((r) => r.data),

  // NM-03: National Target Allocation
  getTarget: (period = 'October') =>
    request<{ data: any }>(`${BASE}/target?period=${encodeURIComponent(period)}`).then((r) => r.data),

  allocateTarget: (input: AllocateNationalTargetInput) =>
    request<{ data: any }>(`${BASE}/target/allocate`, { method: 'POST', body: JSON.stringify(input) }).then((r) => r.data),

  // NM-04: National Economics & Unit Capacity
  getEconomics: (period = 'month-to-date') =>
    request<{ data: any }>(`${BASE}/economics?period=${encodeURIComponent(period)}`).then((r) => r.data),

  // NM-05: Product & Pipeline Rule Proposals
  listProductRules: () =>
    request<{ data: any[] }>(`${BASE}/product-rules`).then((r) => r.data),

  createProductRule: (input: ProposeProductRuleInput) =>
    request<{ data: any }>(`${BASE}/product-rules`, { method: 'POST', body: JSON.stringify(input) }).then((r) => r.data),

  // NM-06: National Forecast Consolidation
  getForecastRollup: (period = 'October') =>
    request<{ data: any }>(`${BASE}/forecast/rollup?period=${encodeURIComponent(period)}`).then((r) => r.data),

  submitForecast: (input: SubmitNationalForecastInput) =>
    request<{ data: any }>(`${BASE}/forecast/submit`, { method: 'POST', body: JSON.stringify(input) }).then((r) => r.data),

  // NM-07: Cross-Region Work Transfers
  listTransfers: () =>
    request<{ data: any[] }>(`${BASE}/transfers`).then((r) => r.data),

  createTransfer: (input: CreateCrossRegionTransferInput) =>
    request<{ data: any }>(`${BASE}/transfers`, { method: 'POST', body: JSON.stringify(input) }).then((r) => r.data),

  decideTransfer: (transferId: string, input: Omit<DecideCrossRegionTransferInput, 'transferId'>) =>
    request<{ data: any }>(`${BASE}/transfers/${encodeURIComponent(transferId)}/decide`, {
      method: 'POST',
      body: JSON.stringify(input),
    }).then((r) => r.data),

  // NM-08: Cross-Vertical Inbound Referrals
  listReferrals: () =>
    request<{ data: any[] }>(`${BASE}/referrals`).then((r) => r.data),

  decideReferral: (referralId: string, input: Omit<DecideCrossVerticalReferralInput, 'referralId'>) =>
    request<{ data: any }>(`${BASE}/referrals/${encodeURIComponent(referralId)}/decide`, {
      method: 'POST',
      body: JSON.stringify(input),
    }).then((r) => r.data),

  // NM-09: National Strategic Escalations
  listEscalations: () =>
    request<{ data: any[] }>(`${BASE}/escalations`).then((r) => r.data),

  createEscalation: (input: CreateNationalEscalationInput) =>
    request<{ data: any }>(`${BASE}/escalations`, { method: 'POST', body: JSON.stringify(input) }).then((r) => r.data),

  resolveEscalation: (escalationId: string, input: Omit<ResolveNationalEscalationInput, 'escalationId'>) =>
    request<{ data: any }>(`${BASE}/escalations/${encodeURIComponent(escalationId)}/resolve`, {
      method: 'POST',
      body: JSON.stringify(input),
    }).then((r) => r.data),

  // NM-10: Regional Manager Reviews
  listReviews: (rmEmployeeId?: string) =>
    request<{ data: any[] }>(rmEmployeeId ? `${BASE}/reviews?rmEmployeeId=${encodeURIComponent(rmEmployeeId)}` : `${BASE}/reviews`).then((r) => r.data),

  saveReview: (input: SaveRmReviewInput) =>
    request<{ data: any }>(`${BASE}/reviews`, { method: 'POST', body: JSON.stringify(input) }).then((r) => r.data),

  // NM-11: National Executive Reports & Schedules
  previewReportPack: (period = 'October 2026') =>
    request<{ data: any }>(`${BASE}/reports/preview?period=${encodeURIComponent(period)}`).then((r) => r.data),

  exportReportPdf: (input: GenerateNationalPdfPackInput) =>
    request<{ data: { downloadUrl: string; fileName: string } }>(`${BASE}/reports/export-pdf`, {
      method: 'POST',
      body: JSON.stringify(input),
    }).then((r) => r.data),

  listReportSchedules: () =>
    request<{ data: any[] }>(`${BASE}/reports/schedules`).then((r) => r.data),

  saveReportSchedule: (input: SaveNationalReportScheduleInput) =>
    request<{ data: any }>(`${BASE}/reports/schedules`, { method: 'POST', body: JSON.stringify(input) }).then((r) => r.data),
};
