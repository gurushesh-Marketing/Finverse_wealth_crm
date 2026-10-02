/**
 * Finverse CRM — Wealth prospect record repository (SC-03).
 *
 * Session-scoped SQL for /wealth/prospects/[id]. Every read verifies the lead
 * is in the caller's permitted workload before returning related rows, and
 * distinguishes a reassigned-away lead (access changed) from an out-of-scope
 * lead (not in workload). Sensitive customer fields are never returned for
 * either denied state.
 */

import { getDb } from '@/lib/db';
import type { WorkspaceSession } from '@/lib/session';
import type {
  ConversionRequest,
  DocRequest,
  DocumentRecord,
  Lead,
  LeadActivity,
  LeadOwnershipEntry,
  LeadStage,
  LeadTask,
  LossEvent,
  Qualification,
  ReopenRequest,
} from './types';

export interface WealthLeadRecord extends Lead {
  preferredLanguage: string;
  contactPermission: string;
}

export interface WealthLeadActivity extends LeadActivity {
  evidenceStatus: string;
}

export interface OutcomeSummary {
  qualification: Qualification | null;
  conversion: ConversionRequest | null;
  loss: LossEvent | null;
  reopen: ReopenRequest | null;
}

type LeadRow = {
  id: string;
  vertical: Lead['vertical'];
  team_id: string;
  employee_id: string;
  display_name: string;
  masked_phone: string;
  email: string | null;
  product: string;
  source: string;
  source_detail: string | null;
  stage: LeadStage;
  next_action: string;
  due_at: string;
  contact_eligible: number;
  owner_name: string;
  owner_team_name: string;
  ownership_history: string;
  reassigned_away: number;
  preferred_language: string;
  contact_permission: string;
  created_at: string;
  updated_at: string;
};

function mapLead(r: LeadRow): WealthLeadRecord {
  return {
    id: r.id,
    vertical: r.vertical,
    teamId: r.team_id,
    employeeId: r.employee_id,
    displayName: r.display_name,
    maskedPhone: r.masked_phone,
    email: r.email ?? undefined,
    product: r.product,
    source: r.source,
    sourceDetail: r.source_detail ?? undefined,
    stage: r.stage,
    nextAction: r.next_action,
    dueAt: r.due_at,
    contactEligible: r.contact_eligible === 1,
    ownerName: r.owner_name,
    ownerTeamName: r.owner_team_name,
    ownershipHistory: JSON.parse(r.ownership_history) as LeadOwnershipEntry[],
    reassignedAway: r.reassigned_away === 1,
    isOverdue: new Date(r.due_at).getTime() < Date.now(),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    preferredLanguage: r.preferred_language ?? 'English',
    contactPermission: r.contact_permission ?? 'active',
  };
}

function scopeClause(session: WorkspaceSession): { sql: string; params: string[] } {
  const verticals = session.verticalGrants;
  const vPlace = verticals.map(() => '?').join(', ');
  if (session.allowedActions.includes('*')) {
    return { sql: `vertical IN (${vPlace})`, params: verticals };
  }
  if (session.role === 'SC') {
    return {
      sql: `vertical IN (${vPlace}) AND team_id = ? AND employee_id = ?`,
      params: [...verticals, session.teamGrants[0] ?? '', session.employeeId],
    };
  }
  const teams = session.teamGrants.length ? session.teamGrants : [''];
  return {
    sql: `vertical IN (${vPlace}) AND team_id IN (${teams.map(() => '?').join(', ')})`,
    params: [...verticals, ...teams],
  };
}

export type LeadAccess =
  | { kind: 'ok'; lead: WealthLeadRecord }
  | { kind: 'reassigned' }
  | { kind: 'cross-vertical' }
  | { kind: 'not-in-scope' };

export async function getLeadAccess(session: WorkspaceSession, id: string): Promise<LeadAccess> {
  const db = getDb();
  // Classify the record's vertical without reading customer fields — this
  // only distinguishes "wrong vertical" (access denied) from "wrong owner"
  // (not in workload). No name/phone/email/product value is touched.
  const any = db.prepare('SELECT vertical FROM leads WHERE id = ?').get(id) as
    | { vertical: Lead['vertical'] }
    | undefined;
  if (any && any.vertical !== 'wealth') return { kind: 'cross-vertical' };

  const scope = scopeClause(session);
  const row = db
    .prepare(`SELECT * FROM leads WHERE id = ? AND ${scope.sql}`)
    .get(id, ...scope.params) as LeadRow | undefined;
  if (!row) return { kind: 'not-in-scope' };
  if (row.reassigned_away === 1) return { kind: 'reassigned' };
  return { kind: 'ok', lead: mapLead(row) };
}

async function isAccessible(session: WorkspaceSession, leadId: string): Promise<boolean> {
  return (await getLeadAccess(session, leadId)).kind === 'ok';
}

export async function getLeadActivities(
  session: WorkspaceSession,
  leadId: string
): Promise<WealthLeadActivity[]> {
  if (!(await isAccessible(session, leadId))) return [];
  const rows = getDb()
    .prepare(
      'SELECT id, lead_id, actor, type, subject, description, outcome, event_at, evidence_status, created_at FROM lead_activities WHERE lead_id = ? ORDER BY event_at DESC, created_at DESC'
    )
    .all(leadId) as Array<{
    id: string;
    lead_id: string;
    actor: string;
    type: LeadActivity['type'];
    subject: string;
    description: string | null;
    outcome: string | null;
    event_at: string;
    evidence_status: string;
    created_at: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    leadId: r.lead_id,
    actor: r.actor,
    type: r.type,
    subject: r.subject,
    description: r.description ?? undefined,
    outcome: r.outcome ?? undefined,
    eventAt: r.event_at,
    evidenceStatus: r.evidence_status ?? 'system',
    createdAt: r.created_at,
  }));
}

export async function getLeadTasks(
  session: WorkspaceSession,
  leadId: string
): Promise<LeadTask[]> {
  if (!(await isAccessible(session, leadId))) return [];
  const rows = getDb()
    .prepare(
      'SELECT id, lead_id, title, due_at, priority, status, reminder_at, created_at FROM lead_tasks WHERE lead_id = ? ORDER BY status ASC, due_at ASC'
    )
    .all(leadId) as Array<{
    id: string;
    lead_id: string;
    title: string;
    due_at: string;
    priority: LeadTask['priority'];
    status: LeadTask['status'];
    reminder_at: string | null;
    created_at: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    leadId: r.lead_id,
    title: r.title,
    dueAt: r.due_at,
    priority: r.priority,
    status: r.status,
    reminderAt: r.reminder_at ?? undefined,
    createdAt: r.created_at,
  }));
}

export async function getLeadDocuments(
  session: WorkspaceSession,
  leadId: string
): Promise<DocumentRecord[]> {
  if (!(await isAccessible(session, leadId))) return [];
  const rows = getDb()
    .prepare(
      'SELECT id, lead_id, request_id, doc_type, file_name, size_bytes, mime, version, visibility, scan_status, review_status, review_reason, uploaded_by, created_at FROM documents WHERE lead_id = ? ORDER BY created_at ASC, id ASC'
    )
    .all(leadId) as Array<{
    id: string;
    lead_id: string;
    request_id: string | null;
    doc_type: string | null;
    file_name: string | null;
    size_bytes: number | null;
    mime: string | null;
    version: number;
    visibility: string | null;
    scan_status: string | null;
    review_status: string | null;
    review_reason: string | null;
    uploaded_by: string | null;
    created_at: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    leadId: r.lead_id,
    requestId: r.request_id ?? undefined,
    docType: r.doc_type ?? undefined,
    fileName: r.file_name ?? undefined,
    sizeBytes: r.size_bytes ?? undefined,
    mime: r.mime ?? undefined,
    version: r.version,
    visibility: r.visibility ?? undefined,
    scanStatus: (r.scan_status as DocumentRecord['scanStatus']) ?? undefined,
    reviewStatus: (r.review_status as DocumentRecord['reviewStatus']) ?? undefined,
    reviewReason: r.review_reason ?? undefined,
    uploadedBy: r.uploaded_by ?? undefined,
    createdAt: r.created_at,
  }));
}

export async function getLeadDocRequests(
  session: WorkspaceSession,
  leadId: string
): Promise<DocRequest[]> {
  if (!(await isAccessible(session, leadId))) return [];
  const rows = getDb()
    .prepare(
      'SELECT id, lead_id, checklist_version, items_json, due_at, reminder_enabled, status, created_at FROM doc_requests WHERE lead_id = ? ORDER BY created_at DESC, id DESC'
    )
    .all(leadId) as Array<{
    id: string;
    lead_id: string;
    checklist_version: string | null;
    items_json: string | null;
    due_at: string | null;
    reminder_enabled: number | null;
    status: string | null;
    created_at: string;
  }>;
  return rows.map((r) => ({
    id: r.id,
    leadId: r.lead_id,
    checklistVersion: r.checklist_version ?? undefined,
    itemsJson: r.items_json ?? undefined,
    dueAt: r.due_at ?? undefined,
    reminderEnabled: r.reminder_enabled === 1,
    status: (r.status as DocRequest['status']) ?? undefined,
    createdAt: r.created_at,
  }));
}

export async function getLeadOutcome(
  session: WorkspaceSession,
  leadId: string
): Promise<OutcomeSummary> {
  const db = getDb();
  if (!(await isAccessible(session, leadId))) {
    return { qualification: null, conversion: null, loss: null, reopen: null };
  }
  const qualification =
    (db
      .prepare(
        'SELECT id, lead_id, checklist_version, need, product, expected_value, currency, time_horizon, answers_json, next_step, created_at, updated_at FROM qualifications WHERE lead_id = ? ORDER BY created_at DESC LIMIT 1'
      )
      .get(leadId) as Record<string, unknown> | undefined) ?? null;
  const conversion =
    (db
      .prepare(
        'SELECT id, lead_id, version, milestone, milestone_date, value, currency, evidence_ref, credit_json, status, payload_json, reject_reason, approver, submitted_by, created_at, decided_at FROM conversion_requests WHERE lead_id = ? ORDER BY created_at DESC LIMIT 1'
      )
      .get(leadId) as Record<string, unknown> | undefined) ?? null;
  const loss =
    (db
      .prepare(
        'SELECT id, lead_id, reason, explanation, competitor, future_contact, actor, created_at FROM loss_events WHERE lead_id = ? ORDER BY created_at DESC LIMIT 1'
      )
      .get(leadId) as Record<string, unknown> | undefined) ?? null;
  const reopen =
    (db
      .prepare(
        'SELECT id, lead_id, reason, evidence_ref, requested_stage, next_action, status, decided_by, created_at, decided_at FROM reopen_requests WHERE lead_id = ? ORDER BY created_at DESC LIMIT 1'
      )
      .get(leadId) as Record<string, unknown> | undefined) ?? null;
  return {
    qualification: mapQualification(qualification),
    conversion: mapConversion(conversion),
    loss: mapLoss(loss),
    reopen: mapReopen(reopen),
  };
}

function mapQualification(r: Record<string, unknown> | null): Qualification | null {
  if (!r) return null;
  return {
    id: String(r.id),
    leadId: String(r.lead_id),
    checklistVersion: r.checklist_version as string | undefined,
    need: r.need as string | undefined,
    product: r.product as string | undefined,
    expectedValue: r.expected_value as number | undefined,
    currency: r.currency as string | undefined,
    timeHorizon: r.time_horizon as string | undefined,
    answersJson: r.answers_json as string | undefined,
    nextStep: r.next_step as string | undefined,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function mapConversion(r: Record<string, unknown> | null): ConversionRequest | null {
  if (!r) return null;
  return {
    id: String(r.id),
    leadId: String(r.lead_id),
    version: Number(r.version),
    milestone: r.milestone as string | undefined,
    milestoneDate: r.milestone_date as string | undefined,
    value: r.value as number | undefined,
    currency: r.currency as string | undefined,
    evidenceRef: r.evidence_ref as string | undefined,
    creditJson: r.credit_json as string | undefined,
    status: r.status as ConversionRequest['status'] | undefined,
    payloadJson: r.payload_json as string | undefined,
    rejectReason: r.reject_reason as string | undefined,
    approver: r.approver as string | undefined,
    submittedBy: r.submitted_by as string | undefined,
    createdAt: String(r.created_at),
    decidedAt: r.decided_at as string | undefined,
  };
}

function mapLoss(r: Record<string, unknown> | null): LossEvent | null {
  if (!r) return null;
  return {
    id: String(r.id),
    leadId: String(r.lead_id),
    reason: r.reason as string | undefined,
    explanation: r.explanation as string | undefined,
    competitor: r.competitor as string | undefined,
    futureContact: r.future_contact as string | undefined,
    actor: r.actor as string | undefined,
    createdAt: String(r.created_at),
  };
}

function mapReopen(r: Record<string, unknown> | null): ReopenRequest | null {
  if (!r) return null;
  return {
    id: String(r.id),
    leadId: String(r.lead_id),
    reason: r.reason as string | undefined,
    evidenceRef: r.evidence_ref as string | undefined,
    requestedStage: r.requested_stage as string | undefined,
    nextAction: r.next_action as string | undefined,
    status: r.status as ReopenRequest['status'] | undefined,
    decidedBy: r.decided_by as string | undefined,
    createdAt: String(r.created_at),
    decidedAt: r.decided_at as string | undefined,
  };
}
