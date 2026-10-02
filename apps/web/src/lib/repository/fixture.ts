/**
 * Finverse CRM — Fixture Repository Implementation
 *
 * In-memory mock data scoped by WorkspaceSession.
 * Denied and empty results must not expose another role, team, employee, or vertical's data.
 *
 * [ASSUMPTION] Example prospect names, amounts, products, and pipeline stages
 * shown in the prototype and catalogue are illustrative only.
 * [ASSUMPTION] Vertical-specific compliance rules are not yet documented; fixture
 * grants conservative read — nothing extra by default.
 */

import type {
  IRepository,
  IWealthLeadRepository,
  Prospect,
  Activity,
  Deal,
  ProspectFilters,
  ActivityFilters,
  DealFilters,
  Lead,
  LeadActivity,
  LeadTask,
  LeadFilters,
  PaginatedResult,
} from './types';
import type { WorkspaceSession, Vertical } from '../session';

const MOCK_PROSPECTS: Prospect[] = [
  {
    id: 'PROS-001',
    vertical: 'wealth',
    teamId: 'TEAM-WEALTH-ALPHA',
    employeeId: 'EMP-001',
    name: 'Rajesh & Priya Sharma',
    email: 'rajesh.sharma@example.com',
    phone: '+91-98765-43210',
    status: 'qualified',
    source: 'referral',
    createdAt: '2026-01-15T10:30:00Z',
    updatedAt: '2026-02-20T14:15:00Z',
  },
  {
    id: 'PROS-002',
    vertical: 'wealth',
    teamId: 'TEAM-WEALTH-ALPHA',
    employeeId: 'EMP-001',
    name: 'Amit & Sunita Patel',
    email: 'amit.patel@example.com',
    phone: '+91-98765-43211',
    status: 'contacted',
    source: 'website',
    createdAt: '2026-02-01T09:00:00Z',
    updatedAt: '2026-02-18T11:30:00Z',
  },
  {
    id: 'PROS-003',
    vertical: 'wealth',
    teamId: 'TEAM-WEALTH-BETA',
    employeeId: 'EMP-002',
    name: 'Vikram & Meera Singh',
    email: 'vikram.singh@example.com',
    phone: '+91-98765-43212',
    status: 'new',
    source: 'event',
    createdAt: '2026-02-10T16:45:00Z',
    updatedAt: '2026-02-10T16:45:00Z',
  },
  {
    id: 'PROS-004',
    vertical: 'banking',
    teamId: 'TEAM-BANKING-ALPHA',
    employeeId: 'EMP-003',
    name: 'Corporate Finance Solutions Ltd.',
    email: 'finance@cfs.example.com',
    phone: '+91-22-4567-8900',
    status: 'qualified',
    source: 'outbound',
    createdAt: '2026-01-20T11:00:00Z',
    updatedAt: '2026-02-15T10:00:00Z',
  },
];

const MOCK_ACTIVITIES: Activity[] = [
  {
    id: 'ACT-001',
    prospectId: 'PROS-001',
    employeeId: 'EMP-001',
    type: 'meeting',
    subject: 'Initial discovery meeting',
    description: 'Discussed financial goals, risk tolerance, and current portfolio',
    outcome: 'Positive — interested in wealth planning',
    scheduledAt: '2026-01-20T10:00:00Z',
    completedAt: '2026-01-20T11:30:00Z',
    createdAt: '2026-01-20T11:35:00Z',
  },
  {
    id: 'ACT-002',
    prospectId: 'PROS-001',
    employeeId: 'EMP-001',
    type: 'email',
    subject: 'Follow-up: Portfolio analysis',
    description: 'Sent preliminary portfolio analysis and next steps',
    scheduledAt: '2026-01-22T09:00:00Z',
    completedAt: '2026-01-22T09:15:00Z',
    createdAt: '2026-01-22T09:15:00Z',
  },
  {
    id: 'ACT-003',
    prospectId: 'PROS-002',
    employeeId: 'EMP-001',
    type: 'call',
    subject: 'Introduction call',
    description: 'Brief intro, scheduled follow-up meeting',
    outcome: 'Scheduled meeting for next week',
    scheduledAt: '2026-02-05T14:00:00Z',
    completedAt: '2026-02-05T14:20:00Z',
    createdAt: '2026-02-05T14:25:00Z',
  },
  {
    id: 'ACT-004',
    prospectId: 'PROS-003',
    employeeId: 'EMP-002',
    type: 'note',
    subject: 'Event lead capture',
    description: 'Met at Wealth Summit 2026, expressed interest in estate planning',
    scheduledAt: '2026-02-10T17:00:00Z',
    completedAt: '2026-02-10T17:00:00Z',
    createdAt: '2026-02-10T17:05:00Z',
  },
];

const MOCK_DEALS: Deal[] = [
  {
    id: 'DEAL-001',
    prospectId: 'PROS-001',
    employeeId: 'EMP-001',
    vertical: 'wealth',
    teamId: 'TEAM-WEALTH-ALPHA',
    name: 'Sharma Family Wealth Plan',
    amount: 2_50_00_000,
    currency: 'INR',
    stage: 'proposal',
    probability: 65,
    expectedCloseDate: '2026-03-31',
    createdAt: '2026-01-25T10:00:00Z',
    updatedAt: '2026-02-18T15:30:00Z',
  },
  {
    id: 'DEAL-002',
    prospectId: 'PROS-002',
    employeeId: 'EMP-001',
    vertical: 'wealth',
    teamId: 'TEAM-WEALTH-ALPHA',
    name: 'Patel Retirement Corpus',
    amount: 1_20_00_000,
    currency: 'INR',
    stage: 'qualification',
    probability: 40,
    expectedCloseDate: '2026-04-15',
    createdAt: '2026-02-05T11:00:00Z',
    updatedAt: '2026-02-18T10:00:00Z',
  },
  {
    id: 'DEAL-003',
    prospectId: 'PROS-004',
    employeeId: 'EMP-003',
    vertical: 'banking',
    teamId: 'TEAM-BANKING-ALPHA',
    name: 'CFS Working Capital Facility',
    amount: 5_00_00_000,
    currency: 'INR',
    stage: 'negotiation',
    probability: 80,
    expectedCloseDate: '2026-03-15',
    createdAt: '2026-01-22T14:00:00Z',
    updatedAt: '2026-02-20T09:00:00Z',
  },
];

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

function matchesProspectFilters(prospect: Prospect, filters?: ProspectFilters, session?: WorkspaceSession): boolean {
  if (!filters) return true;

  // Session scoping — enforce vertical/team/employee isolation
  if (session) {
    const hasVerticalAccess = session.verticalGrants.includes(prospect.vertical);
    const hasTeamAccess = session.teamGrants.includes('*') ||
      session.teamGrants.includes(prospect.teamId);
    const hasEmployeeAccess = session.allowedActions.includes('*') ||
      session.employeeId === prospect.employeeId ||
      session.teamGrants.includes(prospect.teamId);

    if (!hasVerticalAccess || !hasTeamAccess || !hasEmployeeAccess) {
      return false;
    }
  }

  if (filters.vertical && prospect.vertical !== filters.vertical) return false;
  if (filters.teamId && prospect.teamId !== filters.teamId) return false;
  if (filters.employeeId && prospect.employeeId !== filters.employeeId) return false;
  if (filters.status?.length && !filters.status.includes(prospect.status)) return false;
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    if (!prospect.name.toLowerCase().includes(searchLower) &&
        !prospect.email?.toLowerCase().includes(searchLower) &&
        !prospect.phone?.includes(searchLower)) {
      return false;
    }
  }
  return true;
}

function matchesActivityFilters(activity: Activity, filters?: ActivityFilters): boolean {
  if (!filters) return true;
  if (filters.prospectId && activity.prospectId !== filters.prospectId) return false;
  if (filters.employeeId && activity.employeeId !== filters.employeeId) return false;
  if (filters.type?.length && !filters.type.includes(activity.type)) return false;
  if (filters.dateFrom && activity.scheduledAt < filters.dateFrom) return false;
  if (filters.dateTo && activity.scheduledAt > filters.dateTo) return false;
  return true;
}

function matchesDealFilters(deal: Deal, filters?: DealFilters, session?: WorkspaceSession): boolean {
  if (!filters) return true;

  // Session scoping
  if (session) {
    const hasVerticalAccess = session.verticalGrants.includes(deal.vertical);
    const hasTeamAccess = session.teamGrants.includes('*') ||
      session.teamGrants.includes(deal.teamId);
    const hasEmployeeAccess = session.allowedActions.includes('*') ||
      session.employeeId === deal.employeeId ||
      session.teamGrants.includes(deal.teamId);

    if (!hasVerticalAccess || !hasTeamAccess || !hasEmployeeAccess) {
      return false;
    }
  }

  if (filters.vertical && deal.vertical !== filters.vertical) return false;
  if (filters.teamId && deal.teamId !== filters.teamId) return false;
  if (filters.employeeId && deal.employeeId !== filters.employeeId) return false;
  if (filters.stage?.length && !filters.stage.includes(deal.stage)) return false;
  if (filters.minAmount !== undefined && deal.amount < filters.minAmount) return false;
  if (filters.maxAmount !== undefined && deal.amount > filters.maxAmount) return false;
  if (filters.dateFrom && deal.expectedCloseDate < filters.dateFrom) return false;
  if (filters.dateTo && deal.expectedCloseDate > filters.dateTo) return false;
  return true;
}

function paginate<T>(items: T[], page = 1, pageSize = 20): PaginatedResult<T> {
  const total = items.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const paginatedItems = items.slice(start, start + pageSize);
  return {
    items: paginatedItems,
    total,
    page,
    pageSize,
    totalPages,
  };
}

function sortProspects(prospects: Prospect[], sortBy?: ProspectFilters['sortBy'], sortOrder?: ProspectFilters['sortOrder']): Prospect[] {
  if (!sortBy) return prospects;
  return [...prospects].sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];
    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });
}

function sortDeals(deals: Deal[], sortBy?: DealFilters['sortBy'], sortOrder?: DealFilters['sortOrder']): Deal[] {
  if (!sortBy) return deals;
  return [...deals].sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];
    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });
}

export class FixtureRepository implements IRepository {
  private session: WorkspaceSession | null = null;
  private prospects = [...MOCK_PROSPECTS];
  private activities = [...MOCK_ACTIVITIES];
  private deals = [...MOCK_DEALS];

  setSession(session: WorkspaceSession): void {
    this.session = session;
  }

  getSession(): WorkspaceSession | null {
    return this.session;
  }

  // --- Prospects ---

  async getProspects(filters?: ProspectFilters): Promise<PaginatedResult<Prospect>> {
    await new Promise(r => setTimeout(r, 50)); // simulate network latency

    const filtered = this.prospects.filter(p => matchesProspectFilters(p, filters, this.session || undefined));
    const sorted = sortProspects(filtered, filters?.sortBy, filters?.sortOrder);
    return paginate(sorted, filters?.page, filters?.pageSize);
  }

  async getProspectById(id: string): Promise<Prospect | null> {
    await new Promise(r => setTimeout(r, 30));
    const prospect = this.prospects.find(p => p.id === id);
    if (!prospect) return null;
    if (!matchesProspectFilters(prospect, undefined, this.session || undefined)) return null;
    return prospect;
  }

  async createProspect(data: Omit<Prospect, 'id' | 'createdAt' | 'updatedAt'>): Promise<Prospect> {
    await new Promise(r => setTimeout(r, 100));
    const now = nowISO();
    const prospect: Prospect = {
      ...data,
      id: generateId('PROS'),
      createdAt: now,
      updatedAt: now,
    };
    this.prospects.push(prospect);
    return prospect;
  }

  async updateProspect(id: string, data: Partial<Prospect>): Promise<Prospect> {
    await new Promise(r => setTimeout(r, 80));
    const index = this.prospects.findIndex(p => p.id === id);
    if (index === -1) throw new Error('Prospect not found');
    if (!matchesProspectFilters(this.prospects[index], undefined, this.session || undefined)) {
      throw new Error('Access denied');
    }
    this.prospects[index] = {
      ...this.prospects[index],
      ...data,
      id, // preserve id
      updatedAt: nowISO(),
    };
    return this.prospects[index];
  }

  async deleteProspect(id: string): Promise<void> {
    await new Promise(r => setTimeout(r, 80));
    const index = this.prospects.findIndex(p => p.id === id);
    if (index === -1) throw new Error('Prospect not found');
    if (!matchesProspectFilters(this.prospects[index], undefined, this.session || undefined)) {
      throw new Error('Access denied');
    }
    this.prospects.splice(index, 1);
  }

  // --- Activities ---

  async getActivities(filters?: ActivityFilters): Promise<PaginatedResult<Activity>> {
    await new Promise(r => setTimeout(r, 50));

    // If session is set, also filter by prospect access
    let filtered = this.activities.filter(a => matchesActivityFilters(a, filters));

    if (this.session) {
      // Further filter by prospects the session can access
      const accessibleProspectIds = this.prospects
        .filter(p => matchesProspectFilters(p, undefined, this.session!))
        .map(p => p.id);
      filtered = filtered.filter(a => accessibleProspectIds.includes(a.prospectId));
    }

    return paginate(filtered, filters?.page, filters?.pageSize);
  }

  async getActivityById(id: string): Promise<Activity | null> {
    await new Promise(r => setTimeout(r, 30));
    const activity = this.activities.find(a => a.id === id);
    if (!activity) return null;
    if (this.session) {
      const prospect = this.prospects.find(p => p.id === activity.prospectId);
      if (!prospect || !matchesProspectFilters(prospect, undefined, this.session)) return null;
    }
    return activity;
  }

  async createActivity(data: Omit<Activity, 'id' | 'createdAt'>): Promise<Activity> {
    await new Promise(r => setTimeout(r, 80));
    const activity: Activity = {
      ...data,
      id: generateId('ACT'),
      createdAt: nowISO(),
    };
    this.activities.push(activity);
    return activity;
  }

  async updateActivity(id: string, data: Partial<Activity>): Promise<Activity> {
    await new Promise(r => setTimeout(r, 60));
    const index = this.activities.findIndex(a => a.id === id);
    if (index === -1) throw new Error('Activity not found');
    if (this.session) {
      const prospect = this.prospects.find(p => p.id === this.activities[index].prospectId);
      if (!prospect || !matchesProspectFilters(prospect, undefined, this.session)) {
        throw new Error('Access denied');
      }
    }
    this.activities[index] = { ...this.activities[index], ...data, id };
    return this.activities[index];
  }

  async deleteActivity(id: string): Promise<void> {
    await new Promise(r => setTimeout(r, 60));
    const index = this.activities.findIndex(a => a.id === id);
    if (index === -1) throw new Error('Activity not found');
    if (this.session) {
      const prospect = this.prospects.find(p => p.id === this.activities[index].prospectId);
      if (!prospect || !matchesProspectFilters(prospect, undefined, this.session)) {
        throw new Error('Access denied');
      }
    }
    this.activities.splice(index, 1);
  }

  // --- Deals ---

  async getDeals(filters?: DealFilters): Promise<PaginatedResult<Deal>> {
    await new Promise(r => setTimeout(r, 50));

    const filtered = this.deals.filter(d => matchesDealFilters(d, filters, this.session || undefined));
    const sorted = sortDeals(filtered, filters?.sortBy, filters?.sortOrder);
    return paginate(sorted, filters?.page, filters?.pageSize);
  }

  async getDealById(id: string): Promise<Deal | null> {
    await new Promise(r => setTimeout(r, 30));
    const deal = this.deals.find(d => d.id === id);
    if (!deal) return null;
    if (!matchesDealFilters(deal, undefined, this.session || undefined)) return null;
    return deal;
  }

  async createDeal(data: Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>): Promise<Deal> {
    await new Promise(r => setTimeout(r, 100));
    const now = nowISO();
    const deal: Deal = {
      ...data,
      id: generateId('DEAL'),
      createdAt: now,
      updatedAt: now,
    };
    this.deals.push(deal);
    return deal;
  }

  async updateDeal(id: string, data: Partial<Deal>): Promise<Deal> {
    await new Promise(r => setTimeout(r, 80));
    const index = this.deals.findIndex(d => d.id === id);
    if (index === -1) throw new Error('Deal not found');
    if (!matchesDealFilters(this.deals[index], undefined, this.session || undefined)) {
      throw new Error('Access denied');
    }
    this.deals[index] = {
      ...this.deals[index],
      ...data,
      id,
      updatedAt: nowISO(),
    };
    return this.deals[index];
  }

  async deleteDeal(id: string): Promise<void> {
    await new Promise(r => setTimeout(r, 80));
    const index = this.deals.findIndex(d => d.id === id);
    if (index === -1) throw new Error('Deal not found');
    if (!matchesDealFilters(this.deals[index], undefined, this.session || undefined)) {
      throw new Error('Access denied');
    }
    this.deals.splice(index, 1);
  }

  // --- Aggregations ---

  async getProspectCountByStatus(vertical?: Vertical): Promise<Record<Prospect['status'], number>> {
    await new Promise(r => setTimeout(r, 40));
    const filtered = this.prospects.filter(p =>
      matchesProspectFilters(p, vertical ? { vertical } : undefined, this.session || undefined)
    );
    const counts: Record<Prospect['status'], number> = {
      new: 0,
      contacted: 0,
      qualified: 0,
      unqualified: 0,
      converted: 0,
    };
    for (const p of filtered) {
      counts[p.status]++;
    }
    return counts;
  }

  async getDealPipelineSummary(vertical?: Vertical): Promise<Record<Deal['stage'], { count: number; totalAmount: number }>> {
    await new Promise(r => setTimeout(r, 40));
    const filtered = this.deals.filter(d =>
      matchesDealFilters(d, vertical ? { vertical } : undefined, this.session || undefined)
    );
    const stages: Deal['stage'][] = ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed-won', 'closed-lost'];
    const summary: Record<Deal['stage'], { count: number; totalAmount: number }> = {} as Record<Deal['stage'], { count: number; totalAmount: number }>;
    for (const stage of stages) {
      const stageDeals = filtered.filter(d => d.stage === stage);
      summary[stage] = {
        count: stageDeals.length,
        totalAmount: stageDeals.reduce((sum, d) => sum + d.amount, 0),
      };
    }
    return summary;
  }

  async getActivityCountByType(employeeId?: string): Promise<Record<Activity['type'], number>> {
    await new Promise(r => setTimeout(r, 40));
    let filtered = this.activities.filter(a =>
      !employeeId || a.employeeId === employeeId
    );
    if (this.session) {
      const accessibleProspectIds = this.prospects
        .filter(p => matchesProspectFilters(p, undefined, this.session!))
        .map(p => p.id);
      filtered = filtered.filter(a => accessibleProspectIds.includes(a.prospectId));
    }
    const types: Activity['type'][] = ['call', 'email', 'meeting', 'note', 'task'];
    const counts: Record<Activity['type'], number> = {} as Record<Activity['type'], number>;
    for (const type of types) {
      counts[type] = filtered.filter(a => a.type === type).length;
    }
    return counts;
  }
}

// Singleton instance for app-wide use
export const fixtureRepository = new FixtureRepository();