/**
 * Finverse CRM — Fixture Repository Interface
 *
 * This interface defines the contract that both the mock fixture repository
 * and the future real API repository will implement.
 *
 * All reads are scoped by WorkspaceSession — denied and empty results
 * must not expose another role, team, employee, or vertical's data.
 */

import type { WorkspaceSession, Vertical } from '../session';

// --- Core entity types (minimal for Phase 0) ---

export interface Prospect {
  id: string;
  vertical: Vertical;
  teamId: string;
  employeeId: string; // assigned SC
  name: string;
  email?: string;
  phone?: string;
  status: 'new' | 'contacted' | 'qualified' | 'unqualified' | 'converted';
  source: string;
  createdAt: string; // ISO 8601
  updatedAt: string;
}

export interface Activity {
  id: string;
  prospectId: string;
  employeeId: string;
  type: 'call' | 'email' | 'meeting' | 'note' | 'task';
  subject: string;
  description?: string;
  outcome?: string;
  scheduledAt: string;
  completedAt?: string;
  createdAt: string;
}

export interface Deal {
  id: string;
  prospectId: string;
  employeeId: string;
  vertical: Vertical;
  teamId: string;
  name: string;
  amount: number;
  currency: 'USD' | 'INR' | 'EUR';
  stage: 'prospecting' | 'qualification' | 'proposal' | 'negotiation' | 'closed-won' | 'closed-lost';
  probability: number; // 0-100
  expectedCloseDate: string;
  createdAt: string;
  updatedAt: string;
}

// --- Query/Filter types ---

export interface ProspectFilters {
  vertical?: Vertical;
  teamId?: string;
  employeeId?: string;
  status?: Prospect['status'][];
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'name';
  sortOrder?: 'asc' | 'desc';
}

export interface ActivityFilters {
  prospectId?: string;
  employeeId?: string;
  type?: Activity['type'][];
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface DealFilters {
  vertical?: Vertical;
  teamId?: string;
  employeeId?: string;
  stage?: Deal['stage'][];
  minAmount?: number;
  maxAmount?: number;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'amount' | 'expectedCloseDate';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// --- Repository interface ---

export interface IRepository {
  // Session-aware scoping
  setSession(session: WorkspaceSession): void;
  getSession(): WorkspaceSession | null;

  // Prospects
  getProspects(filters?: ProspectFilters): Promise<PaginatedResult<Prospect>>;
  getProspectById(id: string): Promise<Prospect | null>;
  createProspect(data: Omit<Prospect, 'id' | 'createdAt' | 'updatedAt'>): Promise<Prospect>;
  updateProspect(id: string, data: Partial<Prospect>): Promise<Prospect>;
  deleteProspect(id: string): Promise<void>;

  // Activities
  getActivities(filters?: ActivityFilters): Promise<PaginatedResult<Activity>>;
  getActivityById(id: string): Promise<Activity | null>;
  createActivity(data: Omit<Activity, 'id' | 'createdAt'>): Promise<Activity>;
  updateActivity(id: string, data: Partial<Activity>): Promise<Activity>;
  deleteActivity(id: string): Promise<void>;

  // Deals
  getDeals(filters?: DealFilters): Promise<PaginatedResult<Deal>>;
  getDealById(id: string): Promise<Deal | null>;
  createDeal(data: Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>): Promise<Deal>;
  updateDeal(id: string, data: Partial<Deal>): Promise<Deal>;
  deleteDeal(id: string): Promise<void>;

  // Aggregations (for reports/dashboards)
  getProspectCountByStatus(vertical?: Vertical): Promise<Record<Prospect['status'], number>>;
  getDealPipelineSummary(vertical?: Vertical): Promise<Record<Deal['stage'], { count: number; totalAmount: number }>>;
  getActivityCountByType(employeeId?: string): Promise<Record<Activity['type'], number>>;
}