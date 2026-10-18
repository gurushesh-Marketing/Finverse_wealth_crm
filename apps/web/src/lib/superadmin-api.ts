import type {
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
} from '@finverse/contracts';

async function req<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api/superadmin${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg = body?.error?.message || body?.message || 'Request failed';
    throw new Error(errorMsg);
  }
  return body.data ?? body;
}

export const superadminApi = {
  getOverview: () => req<any>('/overview'),

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
};
