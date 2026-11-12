import type {
  SaApproveOnboardingInput,
  SaRejectOnboardingInput,
  SaApproveOnboardingResponse,
  SaHrRequestItem,
  SaCreateAccountInput,
  SaGrantScopeInput,
  SaAdditionalScopeInput,
  SaRestructureHierarchyInput,
  SaActivateTransferInput,
  SaOffboardEmployeeInput,
  SaAccountRecoveryInput,
  SaPublishConfigInput,
  SaIncidentActionInput,
  SaRetryJobInput,
  SaDecideDelegationInput,
  SaCreateTeamInput,
  SaUpdateTeamInput,
  SaAssignCallerInput,
  SaTeamItem,
  SaEligibleRelationshipManager,
  SaEligibleCaller,
  PlacementOptions,
} from '@finverse/contracts';
import { request } from './api';

async function req<T>(path: string, options: RequestInit = {}): Promise<T> {
  const body = await request<{ data?: T } | T>(`/api/superadmin${path}`, options);
  return ((body as { data?: T }).data ?? body) as T;
}

export const superadminApi = {
  getOverview: () => req<any>('/overview'),
  getPlacementOptions: (vertical: string) => req<PlacementOptions>(`/placement-options?vertical=${encodeURIComponent(vertical)}`),

  // HR Requests (Unified: New Employee, Role/Team/Vertical Change, Exit)
  listHrRequests: (status?: 'pending' | 'approved' | 'rejected' | 'all', vertical?: string) => {
    const params = new URLSearchParams();
    if (status && status !== 'all') params.set('status', status);
    if (vertical && vertical !== 'all') params.set('vertical', vertical);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return req<SaHrRequestItem[]>(`/hr/requests${qs}`);
  },
  approveLifecycleChange: (requestId: string, notes?: string) =>
    req<any>(`/hr/requests/${requestId}/approve-lifecycle`, {
      method: 'POST',
      body: JSON.stringify({ requestId, decisionNotes: notes }),
    }),
  approveExit: (requestId: string, notes?: string, handoffSupervisedQueue: boolean = true) =>
    req<any>(`/hr/requests/${requestId}/approve-exit`, {
      method: 'POST',
      body: JSON.stringify({ requestId, decisionNotes: notes, handoffSupervisedQueue }),
    }),
  rejectHrRequest: (requestId: string, rejectionReason: string) =>
    req<any>(`/hr/requests/${requestId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ requestId, rejectionReason }),
    }),

  // Onboarding Requests from HR
  listOnboardingRequests: () => req<any[]>('/onboarding/requests'),
  approveOnboarding: (data: SaApproveOnboardingInput) =>
    req<SaApproveOnboardingResponse>('/onboarding/approve', { method: 'POST', body: JSON.stringify(data) }),
  rejectOnboarding: (data: SaRejectOnboardingInput) =>
    req<any>('/onboarding/reject', { method: 'POST', body: JSON.stringify(data) }),

  // SA-01
  provisionAccount: (data: SaCreateAccountInput) =>
    req<any>('/accounts/provision', { method: 'POST', body: JSON.stringify(data) }),
  listInvitations: () => req<any[]>('/accounts/invitations'),

  // SA-02
  grantScope: (data: SaGrantScopeInput) =>
    req<any>('/scopes/grant', { method: 'POST', body: JSON.stringify(data) }),

  // SA-03
  grantAdditionalScope: (data: SaAdditionalScopeInput) =>
    req<any>('/scopes/additional-grant', { method: 'POST', body: JSON.stringify(data) }),
  getEmployeeAssignments: (id: string) => req<any[]>(`/scopes/employee/${id}`),

  // SA-04
  getHierarchy: (vertical?: string) =>
    req<any[]>(`/hierarchy${vertical ? `?vertical=${encodeURIComponent(vertical)}` : ''}`),
  restructureHierarchy: (data: SaRestructureHierarchyInput) =>
    req<any>('/hierarchy/restructure', { method: 'POST', body: JSON.stringify(data) }),

  // SA-05
  listPendingTransfers: () => req<any[]>('/lifecycle/transfers'),
  activateTransfer: (data: SaActivateTransferInput) =>
    req<any>('/lifecycle/transfers/activate', { method: 'POST', body: JSON.stringify(data) }),

  // SA-06
  offboardEmployee: (data: SaOffboardEmployeeInput) =>
    req<any>('/lifecycle/offboard', { method: 'POST', body: JSON.stringify(data) }),
  listHoldingQueues: () => req<any[]>('/lifecycle/holding-queues'),

  // SA-07
  requestAccountRecovery: (data: SaAccountRecoveryInput) =>
    req<any>('/accounts/recovery-reset', { method: 'POST', body: JSON.stringify(data) }),
  listAccountRecoveries: () => req<any[]>('/accounts/recoveries'),

  // SA-08
  listBusinessConfigurations: () => req<any[]>('/configuration/versions'),
  publishBusinessConfiguration: (data: SaPublishConfigInput) =>
    req<any>('/configuration/publish', { method: 'POST', body: JSON.stringify(data) }),

  // SA-09
  listAuditIncidents: (search?: string) =>
    req<any[]>(`/incidents${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  actOnIncident: (data: SaIncidentActionInput) =>
    req<any>('/incidents/actions', { method: 'POST', body: JSON.stringify(data) }),

  // SA-10
  listBackgroundJobs: (queue?: string) =>
    req<any[]>(`/jobs${queue ? `?queue=${encodeURIComponent(queue)}` : ''}`),
  retryBackgroundJob: (data: SaRetryJobInput) =>
    req<any>('/jobs/retry', { method: 'POST', body: JSON.stringify(data) }),

  // SA-11
  listTemporaryGrants: () => req<any[]>('/delegations'),
  decideTemporaryGrant: (data: SaDecideDelegationInput) =>
    req<any>('/delegations/decide', { method: 'POST', body: JSON.stringify(data) }),

  // Demo Adapter Local Delivery Outbox
  listLocalDeliveryOutbox: (limit = 20) => req<any[]>(`/local-delivery?limit=${limit}`),

  // Teams & Relationship Manager Management
  listTeams: (vertical?: string) =>
    req<SaTeamItem[]>(`/teams${vertical && vertical !== 'all' ? `?vertical=${encodeURIComponent(vertical)}` : ''}`),
  createTeam: (data: SaCreateTeamInput) =>
    req<SaTeamItem>('/teams', { method: 'POST', body: JSON.stringify(data) }),
  updateTeam: (teamId: string, data: SaUpdateTeamInput) =>
    req<SaTeamItem>(`/teams/${teamId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  assignCaller: (teamId: string, data: SaAssignCallerInput) =>
    req<{ success: boolean; message: string; reassignedLeads: number }>(`/teams/${teamId}/callers`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getEligibleManagers: (vertical: string) =>
    req<SaEligibleRelationshipManager[]>(`/teams/eligible-managers?vertical=${encodeURIComponent(vertical)}`),
  getEligibleCallers: (vertical: string) =>
    req<SaEligibleCaller[]>(`/teams/eligible-callers?vertical=${encodeURIComponent(vertical)}`),
};
