import { request } from './api';
import type {
  QualifyAndHandoffInput,
  HandoffDecisionInput,
  InstitutionCoordinationInput,
  LeadHandoffRecord,
  InstitutionCoordinationRecord,
  RelPortfolioItem,
  WealthSuitabilityCheck,
  MarketsKycCheck,
  RealEstateVerificationCheck,
  RecordVerificationInput,
} from '@finverse/contracts';

export interface RelPortfolioStats {
  totalActive: number;
  byStage: Record<string, number>;
  totalRequestedAmount: number;
  totalFacilities: number;
}

export interface RelPortfolioResponse {
  portfolio: RelPortfolioItem[];
  stats: RelPortfolioStats;
}

export interface RelProspectDetailResponse {
  prospect: any;
  lead?: any;
  handoffs: LeadHandoffRecord[];
  handoff?: LeadHandoffRecord;
  institutionOptions: InstitutionCoordinationRecord[];
  bureauStatus?: {
    isLiveProviderConnected: boolean;
    provider: string;
    score: number | null;
    status: string;
    consentVerified: boolean;
    notice: string;
  } | null;
  suitabilityCheck?: WealthSuitabilityCheck | null;
  marketsKycCheck?: MarketsKycCheck | null;
  realEstateCheck?: RealEstateVerificationCheck | null;
  timeline?: any[];
}

export const relApi = {
  qualifyAndHandoff: (input: QualifyAndHandoffInput) =>
    request<{ handoff: LeadHandoffRecord; assignedRel: { id: string; name: string } }>(
      '/api/rel/qualify-and-handoff',
      {
        method: 'POST',
        body: JSON.stringify(input),
      }
    ),

  getHandoffs: (params: { status?: string; leadId?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.leadId) qs.set('leadId', params.leadId);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<{ handoffs: LeadHandoffRecord[] }>(`/api/rel/handoffs${suffix}`);
  },

  decideHandoff: (handoffId: string, input: HandoffDecisionInput) =>
    request<{ handoff: LeadHandoffRecord }>(`/api/rel/handoffs/${handoffId}/decision`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  addInstitutionCoordination: (handoffId: string, input: InstitutionCoordinationInput) =>
    request<{ record: InstitutionCoordinationRecord }>(
      `/api/rel/handoffs/${handoffId}/institution-coordination`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      }
    ),

  getPortfolio: () => request<RelPortfolioResponse>('/api/rel/portfolio'),

  getProspectDetail: (leadId: string) =>
    request<RelProspectDetailResponse>(`/api/rel/prospects/${leadId}`),

  recordVerification: (leadId: string, input: RecordVerificationInput) =>
    request<RelProspectDetailResponse>(`/api/rel/prospects/${leadId}/verification`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  getReviewPackSummary: () =>
    request<{
      generatedAt: string;
      relName: string;
      vertical: string;
      activeDealsCount: number;
      totalFacilityPipeline: number;
      pendingHandoffsCount: number;
    }>('/api/rel/reports/summary'),
};
