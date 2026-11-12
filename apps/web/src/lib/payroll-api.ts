import type {
  CompensationPlanRecord,
  CompensationAuditRecord,
  CreateCompensationPlanInput,
  PayrollCycleRecord,
  PayrollPreviewQuery,
  PayrollPreviewResponse,
  FinalizePayrollInput,
} from '@finverse/contracts';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.method && options.method !== 'GET') {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(path, { credentials: 'include', ...options, headers });
  if (!res.ok) {
    let errorObj: any;
    try {
      errorObj = await res.json();
    } catch {
      errorObj = { error: { message: `HTTP ${res.status}: ${res.statusText}` } };
    }
    const err: any = new Error(errorObj?.error?.message || 'Payroll API request failed');
    err.status = res.status;
    err.code = errorObj?.error?.code;
    err.details = errorObj?.error?.details;
    throw err;
  }
  return res.json();
}

export const payrollApi = {
  // Compensation Plans
  getCompensationPlans: async (filter?: {
    employee_id?: string;
    vertical?: string;
    active_only?: boolean;
  }): Promise<{ plans: CompensationPlanRecord[] }> => {
    const params = new URLSearchParams();
    if (filter?.employee_id) params.set('employee_id', filter.employee_id);
    if (filter?.vertical && filter.vertical !== 'all') params.set('vertical', filter.vertical);
    if (filter?.active_only) params.set('active_only', 'true');
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request(`/api/payroll/compensation/plans${qs}`);
  },

  getCompensationPlanById: async (id: string): Promise<{ plan: CompensationPlanRecord }> => {
    return request(`/api/payroll/compensation/plans/${id}`);
  },

  getCompensationAuditHistory: async (
    employeeId?: string
  ): Promise<{ history: CompensationAuditRecord[] }> => {
    const qs = employeeId ? `?employee_id=${employeeId}` : '';
    return request(`/api/payroll/compensation/audit-history${qs}`);
  },

  createCompensationPlan: async (
    input: CreateCompensationPlanInput
  ): Promise<{ plan: CompensationPlanRecord }> => {
    return request('/api/payroll/compensation/plans', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  // Payroll Cycles
  getPayrollCycles: async (): Promise<{ cycles: PayrollCycleRecord[] }> => {
    return request('/api/payroll/cycles');
  },

  getPayrollCycleByCode: async (code: string): Promise<{ cycle: PayrollCycleRecord }> => {
    return request(`/api/payroll/cycles/${code}`);
  },

  // Calculation Preview Engine
  calculatePayrollPreview: async (
    query: PayrollPreviewQuery
  ): Promise<PayrollPreviewResponse> => {
    return request('/api/payroll/preview', {
      method: 'POST',
      body: JSON.stringify(query),
    });
  },

  // Policy-Gated Finalize Cycle
  finalizePayroll: async (
    input: FinalizePayrollInput
  ): Promise<{ cycle: PayrollCycleRecord }> => {
    return request('/api/payroll/finalize', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
};
