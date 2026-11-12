import { request } from './api';
import type {
  ApproveCompanyTargetInput,
  SignOffCompanyForecastInput,
  CreateGrowthInitiativeInput,
  ApproveGrowthInitiativeInput,
  ArbitrateCrossVerticalConflictInput,
  CreateCriticalRiskInput,
  ResolveCriticalRiskInput,
  SaveNmLeadershipReviewInput,
  SaveBoardReportScheduleInput,
  CreateExecutiveCommitmentInput,
  FulfillExecutiveCommitmentInput,
  GenerateBoardPackPdfInput,
  CeoPeriod,
} from '@finverse/contracts';

const BASE = '/api/ceo';

export const ceoApi = {
  // Scope
  getScope: () => request<{ data: any }>(`${BASE}/scope`).then((r) => r.data),

  // CEO-01: Company Operating Picture
  operatingPicture: (period: CeoPeriod = 'month-to-date', focusVertical = 'all') =>
    request<{ data: any }>(
      `${BASE}/operating-picture?period=${encodeURIComponent(period)}&focusVertical=${encodeURIComponent(focusVertical)}`
    ).then((r) => r.data),

  // CEO-02: Compare Verticals
  compareVerticals: (period: CeoPeriod = 'month-to-date') =>
    request<{ data: any }>(`${BASE}/verticals/comparison?period=${encodeURIComponent(period)}`).then((r) => r.data),

  // CEO-03: NM Contribution
  getNmContribution: (nmEmployeeId: string, period = 'October 2026') =>
    request<{ data: any }>(
      `${BASE}/nms/${encodeURIComponent(nmEmployeeId)}/contribution?period=${encodeURIComponent(period)}`
    ).then((r) => r.data),

  // CEO-04: Approve Targets
  getTargets: (period = 'October', fiscalYear = 'FY2026-27') =>
    request<{ data: any }>(
      `${BASE}/targets?period=${encodeURIComponent(period)}&fiscalYear=${encodeURIComponent(fiscalYear)}`
    ).then((r) => r.data),

  approveTargets: (input: ApproveCompanyTargetInput) =>
    request<{ data: any }>(`${BASE}/targets/approve`, { method: 'POST', body: JSON.stringify(input) }).then((r) => r.data),

  // CEO-05: Consolidated Forecast
  getForecastRollup: (period = 'October') =>
    request<{ data: any }>(`${BASE}/forecast/rollup?period=${encodeURIComponent(period)}`).then((r) => r.data),

  signOffForecast: (input: SignOffCompanyForecastInput) =>
    request<{ data: any }>(`${BASE}/forecast/sign-off`, { method: 'POST', body: JSON.stringify(input) }).then((r) => r.data),

  // CEO-06: Growth Initiatives
  listGrowthInitiatives: (status?: string) =>
    request<{ data: any[] }>(status ? `${BASE}/growth-initiatives?status=${encodeURIComponent(status)}` : `${BASE}/growth-initiatives`).then((r) => r.data),

  createGrowthInitiative: (input: CreateGrowthInitiativeInput) =>
    request<{ data: any }>(`${BASE}/growth-initiatives`, { method: 'POST', body: JSON.stringify(input) }).then((r) => r.data),

  approveGrowthInitiative: (initiativeId: string, input: Omit<ApproveGrowthInitiativeInput, 'initiativeId'>) =>
    request<{ data: any }>(`${BASE}/growth-initiatives/${encodeURIComponent(initiativeId)}/approve`, {
      method: 'POST',
      body: JSON.stringify(input),
    }).then((r) => r.data),

  // CEO-07: Cross-Vertical Conflicts
  listConflicts: () => request<{ data: any[] }>(`${BASE}/conflicts`).then((r) => r.data),

  arbitrateConflict: (conflictId: string, input: Omit<ArbitrateCrossVerticalConflictInput, 'conflictId'>) =>
    request<{ data: any }>(`${BASE}/conflicts/${encodeURIComponent(conflictId)}/arbitrate`, {
      method: 'POST',
      body: JSON.stringify(input),
    }).then((r) => r.data),

  // CEO-08: Critical Operating Risks
  listOperatingRisks: () => request<{ data: any[] }>(`${BASE}/operating-risks`).then((r) => r.data),

  createOperatingRisk: (input: CreateCriticalRiskInput) =>
    request<{ data: any }>(`${BASE}/operating-risks`, { method: 'POST', body: JSON.stringify(input) }).then((r) => r.data),

  resolveOperatingRisk: (riskId: string, input: Omit<ResolveCriticalRiskInput, 'riskId'>) =>
    request<{ data: any }>(`${BASE}/operating-risks/${encodeURIComponent(riskId)}/resolve`, {
      method: 'POST',
      body: JSON.stringify(input),
    }).then((r) => r.data),

  // CEO-09: NM Leadership Reviews
  listNmReviews: (nmEmployeeId?: string) =>
    request<{ data: any[] }>(nmEmployeeId ? `${BASE}/nm-reviews?nmEmployeeId=${encodeURIComponent(nmEmployeeId)}` : `${BASE}/nm-reviews`).then((r) => r.data),

  saveNmReview: (input: SaveNmLeadershipReviewInput) =>
    request<{ data: any }>(`${BASE}/nm-reviews`, { method: 'POST', body: JSON.stringify(input) }).then((r) => r.data),

  // CEO-10: Board Packs & Schedules
  previewBoardPack: (period = 'October 2026') =>
    request<{ data: any }>(`${BASE}/board-packs/preview?period=${encodeURIComponent(period)}`).then((r) => r.data),

  exportBoardPackPdf: (input: GenerateBoardPackPdfInput) =>
    request<{ data: { downloadUrl: string; fileName: string } }>(`${BASE}/board-packs/export-pdf`, {
      method: 'POST',
      body: JSON.stringify(input),
    }).then((r) => r.data),

  listBoardSchedules: () => request<{ data: any[] }>(`${BASE}/board-packs/schedules`).then((r) => r.data),

  saveBoardSchedule: (input: SaveBoardReportScheduleInput) =>
    request<{ data: any }>(`${BASE}/board-packs/schedules`, { method: 'POST', body: JSON.stringify(input) }).then((r) => r.data),

  // CEO-11: Executive Commitments
  listCommitments: (status?: string) =>
    request<{ data: any[] }>(status ? `${BASE}/commitments?status=${encodeURIComponent(status)}` : `${BASE}/commitments`).then((r) => r.data),

  createCommitment: (input: CreateExecutiveCommitmentInput) =>
    request<{ data: any }>(`${BASE}/commitments`, { method: 'POST', body: JSON.stringify(input) }).then((r) => r.data),

  fulfillCommitment: (commitmentId: string, input: Omit<FulfillExecutiveCommitmentInput, 'commitmentId'>) =>
    request<{ data: any }>(`${BASE}/commitments/${encodeURIComponent(commitmentId)}/fulfill`, {
      method: 'POST',
      body: JSON.stringify(input),
    }).then((r) => r.data),
};
