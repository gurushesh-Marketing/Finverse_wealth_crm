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

// --- Wealth lead queue / prospect record (SC-01 / SC-02 / SC-03) ---

export type LeadStage = 'not-contacted' | 'contacted' | 'qualified' | 'unqualified' | 'converted' | 'follow-up' | 'lost';

export interface LeadOwnershipEntry {
  ownerName: string;
  teamName: string;
  from: string; // ISO 8601
  to?: string;
}

export interface Lead {
  id: string; // lead/opportunity ID, e.g. FV-1042
  vertical: Vertical;
  teamId: string;
  employeeId: string; // assigned SC (owner)
  displayName: string;
  maskedPhone: string;
  email?: string;
  product: string;
  source: string;
  sourceDetail?: string;
  stage: LeadStage;
  nextAction: string;
  dueAt: string; // ISO 8601
  contactEligible: boolean;
  ownerName: string;
  ownerTeamName: string;
  ownershipHistory: LeadOwnershipEntry[];
  /** SC-03 exception: reassigned away after intake; excluded from the owner's queue. */
  reassignedAway: boolean;
  /** Data-layer computed view flag (due date already passed). */
  isOverdue?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LeadActivity {
  id: string;
  leadId: string;
  actor: string;
  type: 'call' | 'whatsapp' | 'email' | 'meeting' | 'note' | 'task';
  subject: string;
  description?: string;
  outcome?: string;
  eventAt: string; // ISO 8601
  createdAt: string;
}

export interface LeadTask {
  id: string;
  leadId: string;
  title: string;
  dueAt: string; // ISO 8601
  priority: 'high' | 'medium' | 'low';
  status: 'open' | 'closed';
  reminderAt?: string;
  createdAt: string;
}

export interface LeadFilters {
  search?: string;
  stage?: LeadStage[];
  source?: string[];
  due?: 'all' | 'overdue' | 'today' | 'week';
  sortBy?: 'overdue-first' | 'due-asc';
}

/**
 * Lead-scoped reads for the Wealth caller slice. The session is passed
 * explicitly so scoping cannot be skipped. Named getLeadActivities /
 * getLeadTasks because IRepository.getActivities(filters) already exists —
 * its signature is never broken. Writes arrive with task FV-BATCH1-B.
 */
export interface IWealthLeadRepository {
  getLeads(session: WorkspaceSession, filters?: LeadFilters): Promise<PaginatedResult<Lead>>;
  getLead(session: WorkspaceSession, id: string): Promise<Lead | null>;
  getLeadActivities(session: WorkspaceSession, leadId: string): Promise<PaginatedResult<LeadActivity>>;
  getLeadTasks(session: WorkspaceSession, leadId: string): Promise<PaginatedResult<LeadTask>>;
}

// --- Follow-up scheduling writes (SC-11) ---

export interface FollowUpInput {
  leadId: string;
  action: string;
  dueAt: string; // ISO 8601; must be in the future
  purpose: string;
  priority: 'low' | 'normal' | 'high';
  reminderAt?: string;
}

export interface ILeadFollowUpRepository {
  saveFollowUp(
    session: WorkspaceSession,
    input: FollowUpInput
  ): Promise<{ ok: true; taskId: string } | { ok: false; error: string }>;
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

// --- Wealth Sales Caller data foundation (SC-01 … SC-28) ---
// Mapped entities mirror the v2 tables added in lib/db. Slices declare their own
// repository method interfaces later; these are the shared data contracts only.

/** SC-12 reschedule revision: preserves the original due date alongside the new one. */
export interface TaskRevision {
  id: string;
  taskId: string;
  fromDueAt?: string;
  toDueAt: string;
  reason?: string;
  customerInformed?: boolean;
  requestedBy?: string;
  status?: 'applied' | 'pending-approval';
  createdAt: string;
}

/**
 * SC-06/SC-07 dialer + wrap-up. Masking contract: the full customer number is
 * never attached to a call returned to the employee session; only the
 * authorised dial path reveals it.
 */
export interface CallRecord {
  id: string;
  leadId: string;
  employeeId?: string;
  idempotencyKey?: string;
  state?: 'connecting' | 'ringing' | 'connected' | 'ended' | 'failed';
  providerRef?: string;
  simulated: boolean;
  startedAt?: string;
  connectedAt?: string;
  endedAt?: string;
  durationSeconds?: number;
  wrapupDisposition?: 'connected' | 'no-answer' | 'busy' | 'wrong-number' | 'callback';
  wrapupNeedConfirmed?: boolean;
  wrapupNote?: string;
  wrapupNextAction?: string;
  wrapupDueAt?: string;
  wrapupSavedAt?: string;
  wrapupDraftJson?: string;
  wrapupDraftExpiresAt?: string;
  createdAt: string;
}

/** SC-09/SC-10 WhatsApp conversation record (outbound and inbound). */
export interface MessageRecord {
  id: string;
  leadId: string;
  employeeId?: string;
  direction: 'outbound' | 'inbound';
  channel?: string;
  templateKey?: string;
  language?: string;
  body?: string;
  variablesJson?: string;
  providerRef?: string;
  status?: 'queued' | 'delivered' | 'read' | 'replied' | 'failed' | 'suppressed' | 'received';
  inboundEventId?: string;
  intent?: string;
  handled: boolean;
  handledBy?: string;
  handledAt?: string;
  eventAt?: string;
  createdAt: string;
}

/** SC-02 saved lead-inbox filter view; stores filters, never customer data. */
export interface SavedView {
  id: string;
  employeeId: string;
  name: string;
  filtersJson?: string;
  createdAt: string;
}

/** SC-01 availability state change with an effective time. */
export interface AvailabilityEvent {
  id: string;
  employeeId: string;
  status: 'available' | 'busy' | 'away';
  note?: string;
  effectiveAt: string;
  createdAt: string;
}

/** SC-04 before/after audit of a permitted lead correction. */
export interface LeadEditAudit {
  id: string;
  leadId: string;
  actor?: string;
  beforeJson?: string;
  afterJson?: string;
  reason?: string;
  createdAt: string;
}

/** SC-04 protected identity change routed to a review queue. */
export interface IdentityReview {
  id: string;
  leadId: string;
  field?: string;
  requestedValue?: string;
  reason?: string;
  status?: string;
  createdAt: string;
}

/** SC-05 self-sourced enquiry held separately from routed intake. */
export interface Enquiry {
  id: string;
  createdBy?: string;
  displayName?: string;
  phone?: string;
  email?: string;
  product?: string;
  source?: string;
  sourceDetail?: string;
  permissionEvidence?: string;
  permissionDate?: string;
  need?: string;
  status?: 'pending-validation' | 'linked' | 'duplicate-review' | 'published' | 'invalid';
  linkedLeadId?: string;
  createdAt: string;
}

/** SC-14 booked prospect meeting/visit with invite delivery status. */
export interface Meeting {
  id: string;
  leadId: string;
  employeeId: string;
  meetingType?: string;
  slotAt?: string;
  location?: string;
  attendees?: string;
  agenda?: string;
  status?: 'booked' | 'attended' | 'no-show' | 'cancelled';
  inviteStatus?: 'pending' | 'queued' | 'delivered' | 'failed';
  createdAt: string;
}

/** SC-15 product-specific qualification answers with checklist version. */
export interface Qualification {
  id: string;
  leadId: string;
  checklistVersion?: string;
  need?: string;
  product?: string;
  expectedValue?: number;
  currency?: string;
  timeHorizon?: string;
  answersJson?: string;
  nextStep?: string;
  createdAt: string;
  updatedAt: string;
}

/** SC-16 authoritative pipeline stage transition event. */
export interface StageEvent {
  id: string;
  leadId: string;
  fromStage?: string;
  toStage?: string;
  reason?: string;
  requiredEvidence?: string;
  actor?: string;
  ruleVersion?: string;
  createdAt: string;
}

/** SC-17 versioned, read-only proposal with approval state. */
export interface Proposal {
  id: string;
  leadId: string;
  version: number;
  product?: string;
  templateKey?: string;
  termsJson?: string;
  validUntil?: string;
  attachmentName?: string;
  recipient?: string;
  status?: 'draft' | 'pending-approval' | 'approved' | 'sent' | 'rejected' | 'withdrawn' | 'expired';
  approvalNote?: string;
  sentVia?: string;
  sentAt?: string;
  createdBy?: string;
  createdAt: string;
}

/** SC-18 secure document upload request with expiring token. */
export interface DocRequest {
  id: string;
  leadId: string;
  checklistVersion?: string;
  itemsJson?: string;
  dueAt?: string;
  reminderEnabled?: boolean;
  token?: string;
  tokenExpiresAt?: string;
  channel?: string;
  status?: 'draft' | 'sent' | 'complete' | 'expired';
  createdAt: string;
}

/** SC-19 uploaded evidence; quarantined files stay unavailable to callers. */
export interface DocumentRecord {
  id: string;
  leadId: string;
  requestId?: string;
  docType?: string;
  fileName?: string;
  sizeBytes?: number;
  mime?: string;
  version: number;
  visibility?: string;
  scanStatus?: 'pending' | 'clean' | 'quarantined';
  reviewStatus?: 'pending' | 'accepted' | 'rejected';
  reviewReason?: string;
  uploadedBy?: string;
  createdAt: string;
}

/** SC-20 versioned conversion approval request with locked payload. */
export interface ConversionRequest {
  id: string;
  leadId: string;
  version: number;
  milestone?: string;
  milestoneDate?: string;
  value?: number;
  currency?: string;
  evidenceRef?: string;
  creditJson?: string;
  status?: 'pending' | 'approved' | 'rejected';
  payloadJson?: string;
  rejectReason?: string;
  approver?: string;
  submittedBy?: string;
  createdAt: string;
  decidedAt?: string;
}

/** SC-21 loss event preserving reason, context and future-contact permission. */
export interface LossEvent {
  id: string;
  leadId: string;
  reason?: string;
  explanation?: string;
  competitor?: string;
  futureContact?: string;
  actor?: string;
  createdAt: string;
}

/** SC-22 approval request to reopen a lost opportunity. */
export interface ReopenRequest {
  id: string;
  leadId: string;
  reason?: string;
  evidenceRef?: string;
  requestedStage?: string;
  nextAction?: string;
  status?: 'pending' | 'approved' | 'rejected';
  decidedBy?: string;
  createdAt: string;
  decidedAt?: string;
}

/** SC-23 handoff / cross-vertical referral request. */
export interface HandoffRequest {
  id: string;
  leadId: string;
  reason?: string;
  destination?: string;
  permissionEvidence?: string;
  note?: string;
  status?: 'pending' | 'accepted' | 'declined';
  deadlineAt?: string;
  responseReason?: string;
  createdAt: string;
  decidedAt?: string;
}

/** SC-24 opt-out / suppression record; blocks outbound on listed channels. */
export interface Suppression {
  id: string;
  leadId: string;
  channelsJson?: string;
  source?: string;
  receivedAt?: string;
  note?: string;
  active: boolean;
  createdAt: string;
}

/** SC-24 contact complaint linked to an accountable resolution queue. */
export interface Complaint {
  id: string;
  leadId: string;
  category?: string;
  statement?: string;
  status?: 'open' | 'resolved';
  resolution?: string;
  createdAt: string;
  resolvedAt?: string;
}

/** SC-25 metric target; zero-target metrics render as N/A. */
export interface Target {
  id: string;
  employeeId: string;
  period: string;
  metric: string;
  value: number;
  currency?: string;
}

/**
 * SC-26 review record. ratingPrivate MUST NEVER be sent to the employee session
 * — the employee cannot read the reviewer's private rating.
 */
export interface ReviewRecord {
  id: string;
  employeeId: string;
  period: string;
  reviewerName?: string;
  selfReflection?: string;
  commitmentsJson?: string;
  employeeResponse?: string;
  acknowledgedAt?: string;
  ratingPrivate?: string;
  snapshotJson?: string;
  snapshotVersion?: string;
  status?: 'awaiting-employee' | 'in-meeting' | 'acknowledged';
  createdAt: string;
  updatedAt: string;
}

/** SC-27 export job with snapshot version, recipient and expiry. */
export interface ExportJob {
  id: string;
  employeeId: string;
  period?: string;
  snapshotJson?: string;
  metricVersion?: string;
  cutoffAt?: string;
  status?: 'ready' | 'failed' | 'revoked';
  recipient?: string;
  fileName?: string;
  watermark?: string;
  expiresAt?: string;
  createdAt: string;
}

/** SC-28 help/blocker request with routing and correction linkage. */
export interface HelpRequest {
  id: string;
  employeeId: string;
  category?: string;
  recordRef?: string;
  description?: string;
  evidenceName?: string;
  priority?: string;
  routedTo?: string;
  status?: 'open' | 'resolved';
  slaDueAt?: string;
  resolution?: string;
  correctionRef?: string;
  createdAt: string;
  updatedAt: string;
}

// --- Wealth Sales Caller write inputs ---

export interface WrapUpInput {
  callId: string;
  disposition: 'connected' | 'no-answer' | 'busy' | 'wrong-number' | 'callback';
  needConfirmed: boolean;
  note?: string;
  nextAction?: string;
  dueAt?: string;
}

export interface ManualActivityInput {
  leadId: string;
  occurredAt: string;
  outcome: string;
  reason: string;
  note?: string;
  nextAction?: string;
}

export interface WhatsAppSendInput {
  leadId: string;
  templateKey: string;
  language?: string;
  variables?: Record<string, string>;
  channel?: string;
}

export interface RescheduleInput {
  taskId: string;
  newDueAt: string;
  reason: string;
  customerInformed: boolean;
}

export interface TaskCompletionInput {
  taskId: string;
  outcome: string;
  evidenceRef?: string;
  nextStep?: string;
  nextDueAt?: string;
  cancelReason?: string;
}

export interface MeetingInput {
  leadId: string;
  meetingType: string;
  slotAt: string;
  location?: string;
  attendees?: string;
  agenda?: string;
}

export interface QualificationInput {
  leadId: string;
  checklistVersion: string;
  need: string;
  product: string;
  expectedValue?: number;
  currency?: string;
  timeHorizon?: string;
  answers?: Record<string, unknown>;
  nextStep?: string;
}

export interface StageChangeInput {
  leadId: string;
  toStage: LeadStage;
  reason: string;
  requiredEvidence?: string;
}

export interface ProposalInput {
  leadId: string;
  product: string;
  templateKey: string;
  terms?: Record<string, unknown>;
  validUntil?: string;
  attachmentName?: string;
  recipient?: string;
}

export interface DocRequestInput {
  leadId: string;
  checklistVersion: string;
  items: string[];
  dueAt?: string;
  reminderEnabled?: boolean;
  channel?: string;
}

export interface DocumentUploadInput {
  leadId: string;
  requestId?: string;
  docType: string;
  fileName: string;
  sizeBytes: number;
  mime: string;
  visibility?: string;
}

export interface ConversionInput {
  leadId: string;
  milestone: string;
  milestoneDate: string;
  value: number;
  currency?: string;
  evidenceRef?: string;
  credit?: Record<string, number>;
}

export interface LossInput {
  leadId: string;
  reason: string;
  explanation?: string;
  competitor?: string;
  futureContact?: string;
}

export interface ReopenInput {
  leadId: string;
  reason: string;
  evidenceRef?: string;
  requestedStage?: string;
  nextAction?: string;
}

export interface HandoffInput {
  leadId: string;
  reason: string;
  destination: string;
  permissionEvidence?: string;
  note?: string;
}

export interface SuppressionInput {
  leadId: string;
  channels: string[];
  source?: string;
  note?: string;
}

export interface ComplaintInput {
  leadId: string;
  category: string;
  statement?: string;
}

export interface EnquiryInput {
  displayName: string;
  phone?: string;
  email?: string;
  product: string;
  source: string;
  sourceDetail?: string;
  permissionEvidence?: string;
  permissionDate?: string;
  need?: string;
}

export interface LeadCorrectionInput {
  leadId: string;
  displayName?: string;
  phone?: string;
  email?: string;
  preferredLanguage?: string;
  reason: string;
}

export interface ReviewResponseInput {
  reviewId: string;
  selfReflection?: string;
  employeeResponse?: string;
}

export interface HelpRequestInput {
  category: string;
  recordRef?: string;
  description: string;
  evidenceName?: string;
  priority?: string;
}

export interface ExportInput {
  period: string;
  recipient?: string;
  metricVersion?: string;
}

export interface AvailabilityInput {
  status: 'available' | 'busy' | 'away';
  note?: string;
}

export interface SavedViewInput {
  name: string;
  filtersJson: string;
}