import type {
  AuditEntry,
  ConversionInput,
  Enquiry,
  EnquiryInput,
  HandoffInput,
  HelpRequestInput,
  LossInput,
  ProposalInput,
  ProposalRecord,
  ProspectCorrectionInput,
  QualificationInput,
  ReopenInput,
  StageChangeInput,
} from '@finverse/contracts';
import { pool } from './db';
import type { Scope } from './users';
import { forbidden, notFound, HttpError } from '../lib/errors';
import { requireLeadForRead, requireLeadForWrite, attributionFor, type ScopedLead } from '../wealth/scope';
import { LOSS_REASONS, STAGE_RULE_VERSION, WEALTH_STAGE_TRANSITIONS, ENQUIRY_SOURCES, canTransition, WEALTH_PRODUCTS } from '../wealth/rules';
import {
  BANKING_STAGE_TRANSITIONS,
  BANKING_PRODUCTS,
  BANKING_SOURCES,
  BANKING_STAGE_RULE_VERSION,
  BANKING_LOSS_REASONS,
  canBankingTransition,
} from '../banking/rules';
import {
  MARKETS_STAGE_TRANSITIONS,
  MARKETS_PRODUCTS,
  MARKETS_SOURCES,
  MARKETS_STAGE_RULE_VERSION,
  MARKETS_LOSS_REASONS,
  canMarketsTransition,
} from '../markets/rules';
import {
  REAL_ESTATE_STAGE_TRANSITIONS,
  REAL_ESTATE_PRODUCTS,
  REAL_ESTATE_SOURCES,
  REAL_ESTATE_STAGE_RULE_VERSION,
  REAL_ESTATE_LOSS_REASONS,
  canRealEstateTransition,
} from '../real-estate/rules';

function id(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

async function ownedLead(scope: Scope, leadId: string): Promise<ScopedLead> {
  return requireLeadForRead(scope, leadId);
}

async function ownedLeadStrict(scope: Scope, leadId: string): Promise<ScopedLead> {
  return requireLeadForWrite(scope, leadId);
}

async function assertCallerAssignment(scope: Scope): Promise<string> {
  const { rows } = await pool.query(`SELECT vertical FROM teams WHERE id = $1`, [scope.teams[0] ?? '']);
  const teamVertical = rows[0]?.vertical || scope.verticals[0] || 'wealth';
  if (!scope.verticals.includes(teamVertical)) {
    throw forbidden('Self-sourced enquiries require an active assignment in the target vertical.');
  }
  return teamVertical;
}

export async function correctProspect(scope: Scope, leadId: string, input: ProspectCorrectionInput) {
  const lead = await ownedLeadStrict(scope, leadId);
  const fields: Array<[string, string | null, string | null]> = [];
  const next: Record<string, string | null> = {
    display_name: lead.display_name,
    phone: lead.phone,
    email: lead.email,
    preferred_language: lead.preferred_language,
  };
  if (input.displayName !== undefined && input.displayName !== lead.display_name) {
    fields.push(['display_name', lead.display_name, input.displayName]);
    next.display_name = input.displayName;
  }
  if (input.phone !== undefined && input.phone !== lead.phone) {
    // [ASSUMPTION] protected identity change: possible duplicate check pauses the change for review.
    const dup = await pool.query(
      `SELECT id FROM leads WHERE phone = $1 AND id <> $2`,
      [input.phone, leadId]
    );
    if ((dup.rowCount ?? 0) > 0) {
      const reqId = id('REQ');
      await pool.query(
        `INSERT INTO outcome_requests (id, lead_id, actor_employee_id, type, payload, status)
         VALUES ($1, $2, $3, 'correction', $4, 'pending')`,
        [reqId, leadId, scope.employeeId, JSON.stringify({ kind: 'identity-change-review', field: 'phone', requested: input.phone, reason: input.reason })]
      );
      return { status: 'pending-review', requestId: reqId, changed: false, audit: [] as AuditEntry[] };
    }
    fields.push(['phone', lead.phone, input.phone]);
    next.phone = input.phone;
  }
  if (input.email !== undefined && (input.email || null) !== lead.email) {
    fields.push(['email', lead.email, input.email || null]);
    next.email = input.email || null;
  }
  if (input.preferredLanguage !== undefined && input.preferredLanguage !== lead.preferred_language) {
    fields.push(['preferred_language', lead.preferred_language, input.preferredLanguage]);
    next.preferred_language = input.preferredLanguage;
  }
  if (fields.length === 0) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'No changes to save.', {
      fieldErrors: { displayName: ['Change at least one field.'] },
    });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE leads SET display_name = $2, phone = $3, email = $4, preferred_language = $5,
         updated_at = now(), record_version = record_version + 1
       WHERE id = $1`,
      [leadId, next.display_name, next.phone, next.email, next.preferred_language]
    );
    const audit: AuditEntry[] = [];
    for (const [field, before, after] of fields) {
      const auditId = id('AUD');
      await client.query(
        `INSERT INTO lead_audit (id, lead_id, actor_employee_id, field, before_value, after_value, reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [auditId, leadId, scope.employeeId, field, before, after, input.reason]
      );
      audit.push({
        id: auditId,
        field,
        beforeValue: before,
        afterValue: after,
        reason: input.reason,
        actorName: scope.displayName,
        occurredAt: new Date().toISOString(),
      });
    }
    await client.query('COMMIT');
    return { status: 'saved', requestId: null, changed: true, audit };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function listAudit(scope: Scope, leadId: string): Promise<AuditEntry[]> {
  await ownedLead(scope, leadId);
  const { rows } = await pool.query(
    `SELECT a.*, e.display_name AS actor_name FROM lead_audit a
     JOIN employees e ON e.id = a.actor_employee_id
     WHERE a.lead_id = $1 ORDER BY a.occurred_at DESC`,
    [leadId]
  );
  return rows.map((r: any) => ({
    id: r.id,
    field: r.field,
    beforeValue: r.before_value,
    afterValue: r.after_value,
    reason: r.reason,
    actorName: r.actor_name,
    occurredAt: new Date(r.occurred_at).toISOString(),
  }));
}

export async function createEnquiry(scope: Scope, input: EnquiryInput): Promise<Enquiry> {
  const teamVertical = await assertCallerAssignment(scope);
  const permittedProducts = teamVertical === 'banking'
    ? (BANKING_PRODUCTS as readonly string[])
    : teamVertical === 'markets'
    ? (MARKETS_PRODUCTS as readonly string[])
    : teamVertical === 'real_estate'
    ? (REAL_ESTATE_PRODUCTS as readonly string[])
    : (WEALTH_PRODUCTS as readonly string[]);
  if (!permittedProducts.includes(input.product)) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', {
      fieldErrors: { product: [`Choose a product within ${teamVertical === 'banking' ? 'Banking' : teamVertical === 'markets' ? 'Markets' : teamVertical === 'real_estate' ? 'Real Estate' : 'V1'}.`] },
    });
  }
  const permittedSources = teamVertical === 'banking'
    ? (BANKING_SOURCES as readonly string[])
    : teamVertical === 'markets'
    ? (MARKETS_SOURCES as readonly string[])
    : teamVertical === 'real_estate'
    ? (REAL_ESTATE_SOURCES as readonly string[])
    : (ENQUIRY_SOURCES as readonly string[]);
  if (!permittedSources.includes(input.source)) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', {
      fieldErrors: { source: ['Choose an approved source.'] },
    });
  }
  const dup = await pool.query(`SELECT id FROM leads WHERE phone = $1`, [input.phone]);
  const duplicateOf = dup.rows[0]?.id ?? null;
  const enquiryId = id('ENQ');
  const status = duplicateOf ? 'duplicate' : 'pending-validation';
  const { rows } = await pool.query(
    `INSERT INTO enquiries (id, created_by, display_name, phone, email, product, source, permission_evidence, need, status, duplicate_of)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id, display_name, status, duplicate_of, published_lead_id, created_at`,
    [enquiryId, scope.employeeId, input.displayName, input.phone, input.email || null, input.product, input.source, input.permissionEvidence, input.need, status, duplicateOf]
  );
  const r = rows[0];
  return {
    id: r.id,
    displayName: r.display_name,
    status: r.status,
    duplicateOf: r.duplicate_of,
    publishedLeadId: r.published_lead_id,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

export async function publishEnquiry(scope: Scope, enquiryId: string) {
  const teamVertical = await assertCallerAssignment(scope);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`SELECT * FROM enquiries WHERE id = $1 FOR UPDATE`, [enquiryId]);
    const enq = rows[0];
    if (!enq || enq.created_by !== scope.employeeId) {
      await client.query('ROLLBACK');
      throw notFound();
    }
    if (enq.status !== 'pending-validation') {
      await client.query('ROLLBACK');
      throw new HttpError(409, 'DUPLICATE_OPEN_TASK', `Enquiry is already ${enq.status}.`);
    }
    const leadId = `FV-5${Math.floor(100000 + Math.random() * 900000)}`;
    await client.query(
      `INSERT INTO leads (id, vertical, display_name, email, phone, preferred_language, product, source, stage, owner_employee_id, team_id)
       VALUES ($1, $2, $3, $4, $5, 'English', $6, $7, 'new', NULL, $8)`,
      [leadId, teamVertical, enq.display_name, enq.email, enq.phone, enq.product, enq.source, scope.teams[0] ?? null]
    );
    await client.query(`UPDATE enquiries SET status = 'published', published_lead_id = $2 WHERE id = $1`, [enquiryId, leadId]);
    await client.query(
      `INSERT INTO lead_events (id, lead_id, actor_employee_id, kind, note, actor_role, actor_team_id, assignment_id)
       VALUES ($1, $2, $3, 'note', $4, $5, $6, $7)`,
      [id('EVT'), leadId, scope.employeeId, `Manual intake published (created by ${scope.displayName}; self-ownership not assumed). Permission evidence: ${enq.permission_evidence}.`, scope.role, scope.teams[0] ?? null, scope.assignmentId]
    );
    await client.query('COMMIT');
    return { enquiryId, leadId, status: 'published' as const };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function listEnquiries(scope: Scope): Promise<Enquiry[]> {
  const { rows } = await pool.query(
    `SELECT id, display_name, status, duplicate_of, published_lead_id, created_at FROM enquiries
     WHERE created_by = $1 ORDER BY created_at DESC`,
    [scope.employeeId]
  );
  return rows.map((r: any) => ({
    id: r.id,
    displayName: r.display_name,
    status: r.status,
    duplicateOf: r.duplicate_of,
    publishedLeadId: r.published_lead_id,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

export async function saveQualification(scope: Scope, leadId: string, input: QualificationInput) {
  const lead = await ownedLeadStrict(scope, leadId);
  const isBanking = lead.vertical === 'banking';
  const isMarkets = lead.vertical === 'markets';
  const isRealEstate = lead.vertical === 'real_estate';
  const permitted = isBanking
    ? (BANKING_PRODUCTS as readonly string[])
    : isMarkets
    ? (MARKETS_PRODUCTS as readonly string[])
    : isRealEstate
    ? (REAL_ESTATE_PRODUCTS as readonly string[])
    : (WEALTH_PRODUCTS as readonly string[]);
  if (!permitted.includes(input.product)) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', {
      fieldErrors: { product: ['Product mismatch: request an approved referral instead.'] },
    });
  }
  const checklistVer = isBanking
    ? BANKING_STAGE_RULE_VERSION
    : isMarkets
    ? MARKETS_STAGE_RULE_VERSION
    : isRealEstate
    ? REAL_ESTATE_STAGE_RULE_VERSION
    : 'wealth-fit-v1';
  const qualId = id('QUAL');
  await pool.query(
    `INSERT INTO qualifications (id, lead_id, actor_employee_id, need, product, expected_value, currency, time_horizon, checklist, checklist_version, next_step)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [qualId, leadId, scope.employeeId, input.need, input.product, input.expectedValue ?? null, input.currency ?? null, input.timeHorizon, JSON.stringify(input.checklist), checklistVer, input.nextStep]
  );
  await pool.query(
    `INSERT INTO lead_events (id, lead_id, actor_employee_id, kind, note, actor_role, actor_team_id, assignment_id)
     VALUES ($1, $2, $3, 'note', $4, $5, $6, $7)`,
    [id('EVT'), leadId, scope.employeeId, `Qualification saved (checklist ${checklistVer}). Need: ${input.need}. Estimate (not verified revenue): ${input.expectedValue ?? 'n/a'} ${input.currency ?? ''}`, scope.role, scope.teams[0] ?? null, scope.assignmentId]
  );
  return { id: qualId, recommendedNextStep: input.nextStep };
}

export async function moveStage(scope: Scope, leadId: string, input: StageChangeInput) {
  const lead = await ownedLeadStrict(scope, leadId);
  const isBanking = lead.vertical === 'banking';
  const isMarkets = lead.vertical === 'markets';
  const isRealEstate = lead.vertical === 'real_estate';
  const [actorRole, actorTeam, actorAssignment] = attributionFor(scope, lead.team_id);
  if (input.toStage === 'converted' || input.toStage === 'lost' || input.toStage === 'disbursal' || input.toStage === 'active-funded') {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Converted/Disbursal/Active-funded follows approval rules and Lost uses the loss form.', {
      fieldErrors: { toStage: ['Use Submit conversion (SC-20) or Mark lost (SC-21) for this transition.'] },
    });
  }
  const validTransition = isBanking
    ? canBankingTransition(lead.stage, input.toStage)
    : isMarkets
    ? canMarketsTransition(lead.stage, input.toStage)
    : isRealEstate
    ? canRealEstateTransition(lead.stage, input.toStage)
    : canTransition(lead.stage, input.toStage);
  if (!validTransition) {
    const allowed = (
      isBanking
        ? (BANKING_STAGE_TRANSITIONS[lead.stage] ?? [])
        : isMarkets
        ? (MARKETS_STAGE_TRANSITIONS[lead.stage] ?? [])
        : isRealEstate
        ? (REAL_ESTATE_STAGE_TRANSITIONS[lead.stage] ?? [])
        : (WEALTH_STAGE_TRANSITIONS[lead.stage] ?? [])
    ).join(', ') || 'none';
    throw new HttpError(422, 'VALIDATION_FAILED', `The record changed or ${lead.stage} -> ${input.toStage} is not an allowed transition.`, {
      fieldErrors: { toStage: [`Allowed from ${lead.stage}: ${allowed}.`] },
    });
  }
  const ruleVer = isBanking
    ? BANKING_STAGE_RULE_VERSION
    : isMarkets
    ? MARKETS_STAGE_RULE_VERSION
    : isRealEstate
    ? REAL_ESTATE_STAGE_RULE_VERSION
    : STAGE_RULE_VERSION;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO stage_events (id, lead_id, actor_employee_id, from_stage, to_stage, reason, rule_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id('STG'), leadId, scope.employeeId, lead.stage, input.toStage, input.reason, ruleVer]
    );
    await client.query(
      `UPDATE leads SET stage = $2, updated_at = now(), record_version = record_version + 1 WHERE id = $1`,
      [leadId, input.toStage]
    );
    await client.query(
      `INSERT INTO lead_events (id, lead_id, actor_employee_id, kind, note, actor_role, actor_team_id, assignment_id)
       VALUES ($1, $2, $3, 'task-updated', $4, $5, $6, $7)`,
      [id('EVT'), leadId, scope.employeeId, `Stage moved ${lead.stage} -> ${input.toStage} (${input.reason})`, actorRole, actorTeam, actorAssignment]
    );
    await client.query('COMMIT');
    return { ok: true, stage: input.toStage };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function createProposal(scope: Scope, leadId: string, input: ProposalInput): Promise<ProposalRecord> {
  await ownedLeadStrict(scope, leadId);
  const proposalId = id('PROP');
  const { rows } = await pool.query(
    `INSERT INTO proposals (id, lead_id, actor_employee_id, product, template_version, terms, valid_until, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft') RETURNING *`,
    [proposalId, leadId, scope.employeeId, input.product, input.templateVersion, input.terms, input.validUntil]
  );
  return proposalView(rows[0]);
}

export async function submitProposal(scope: Scope, proposalId: string) {
  const { rows } = await pool.query(`SELECT * FROM proposals WHERE id = $1 AND actor_employee_id = $2`, [proposalId, scope.employeeId]);
  const proposal = rows[0];
  if (!proposal) throw notFound();
  if (proposal.status !== 'draft') throw new HttpError(409, 'DUPLICATE_OPEN_TASK', `Proposal is already ${proposal.status}.`);
  await pool.query(`UPDATE proposals SET status = 'pending-approval', version = version + 1 WHERE id = $1`, [proposalId]);
  await pool.query(
    `INSERT INTO lead_events (id, lead_id, actor_employee_id, kind, note, actor_role, actor_team_id, assignment_id)
     VALUES ($1, $2, $3, 'note', $4, $5, $6, $7)`,
    [id('EVT'), proposal.lead_id, scope.employeeId, `Proposal ${proposalId} submitted for approval (pending until an authorized approver decides).`, scope.role, scope.teams[0] ?? null, scope.assignmentId]
  );
  return { ok: true, status: 'pending-approval' };
}

export async function listProposals(scope: Scope, leadId: string): Promise<ProposalRecord[]> {
  await ownedLead(scope, leadId);
  const { rows } = await pool.query(`SELECT * FROM proposals WHERE lead_id = $1 ORDER BY created_at DESC`, [leadId]);
  return rows.map(proposalView);
}

function proposalView(r: any): ProposalRecord {
  return {
    id: r.id,
    leadId: r.lead_id,
    product: r.product,
    templateVersion: r.template_version,
    terms: r.terms,
    validUntil: r.valid_until,
    status: r.status,
    version: r.version,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

export async function requestConversion(scope: Scope, leadId: string, input: ConversionInput) {
  const lead = await ownedLeadStrict(scope, leadId);
  const isBanking = lead.vertical === 'banking';
  const isMarkets = lead.vertical === 'markets';
  const isRealEstate = lead.vertical === 'real_estate';
  const preWonStageValid = isBanking
    ? (lead.stage === 'sanction' || lead.stage === 'qualified')
    : isMarkets
    ? (lead.stage === 'demat-opened' || lead.stage === 'qualified')
    : isRealEstate
    ? (lead.stage === 'booking' || lead.stage === 'site-visit' || lead.stage === 'registration' || lead.stage === 'qualified')
    : (lead.stage === 'qualified');
  if (!preWonStageValid) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Complete the required credit / product milestones first.', {
      fieldErrors: { winMilestone: [`Conversion requires the ${isBanking ? 'Sanction' : isMarkets ? 'Demat & Trading Opened' : isRealEstate ? 'Booking / Registration' : 'Qualified'} stage.`] },
    });
  }
  const pending = await pool.query(
    `SELECT id FROM outcome_requests WHERE lead_id = $1 AND type = 'conversion' AND status = 'pending'`,
    [leadId]
  );
  if ((pending.rowCount ?? 0) > 0) {
    throw new HttpError(409, 'DUPLICATE_OPEN_TASK', 'A conversion request is already pending for this lead.');
  }
  const [actorRole, actorTeam, actorAssignment] = attributionFor(scope, lead.team_id);
  const reqId = id('REQ');
  await pool.query(
    `INSERT INTO outcome_requests (id, lead_id, actor_employee_id, type, payload, status)
     VALUES ($1, $2, $3, 'conversion', $4, 'pending')`,
    [reqId, leadId, scope.employeeId, JSON.stringify({ ...input, submittedAs: { stage: lead.stage, recordVersion: lead.record_version } })]
  );
  await pool.query(
    `INSERT INTO lead_events (id, lead_id, actor_employee_id, kind, note, actor_role, actor_team_id, assignment_id)
     VALUES ($1, $2, $3, 'note', $4, $5, $6, $7)`,
    [id('EVT'), leadId, scope.employeeId, `Conversion submitted (Pending conversion — not a win until approved). Value: ${input.value} ${input.currency}.`, actorRole, actorTeam, actorAssignment]
  );
  return { requestId: reqId, status: 'pending' as const };
}

export async function markLost(scope: Scope, leadId: string, input: LossInput) {
  const lead = await ownedLeadStrict(scope, leadId);
  if (lead.stage === 'converted' || lead.stage === 'disbursal' || lead.stage === 'active-funded') {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Converted records cannot be changed to Lost by the caller.', {
      fieldErrors: { reason: ['Use a cancellation/refund request to protect financial history.'] },
    });
  }
  const isBanking = lead.vertical === 'banking';
  const isMarkets = lead.vertical === 'markets';
  const isRealEstate = lead.vertical === 'real_estate';
  const validReasons = isBanking
    ? [...(LOSS_REASONS as readonly string[]), ...(BANKING_LOSS_REASONS as readonly string[])]
    : isMarkets
    ? [...(LOSS_REASONS as readonly string[]), ...(MARKETS_LOSS_REASONS as readonly string[])]
    : isRealEstate
    ? [...(LOSS_REASONS as readonly string[]), ...(REAL_ESTATE_LOSS_REASONS as readonly string[])]
    : (LOSS_REASONS as readonly string[]);
  if (!validReasons.includes(input.reason)) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', {
      fieldErrors: { reason: ['Loss requires an allowed reason.'] },
    });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const pendingConversion = await client.query(
      `SELECT id FROM outcome_requests WHERE lead_id = $1 AND type = 'conversion' AND status = 'pending'`,
      [leadId]
    );
    if ((pendingConversion.rowCount ?? 0) > 0) {
      await client.query('ROLLBACK');
      throw new HttpError(409, 'DUPLICATE_OPEN_TASK', 'A conversion request is pending — resolve it before recording a loss.');
    }
    const [actorRole, actorTeam, actorAssignment] = attributionFor(scope, lead.team_id);
    await client.query(
      `INSERT INTO loss_records (id, lead_id, actor_employee_id, reason, explanation, competitor, future_contact)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id('LOSS'), leadId, scope.employeeId, input.reason, input.explanation, input.competitor ?? null, input.futureContact ?? null]
    );
    await client.query(
      `INSERT INTO stage_events (id, lead_id, actor_employee_id, from_stage, to_stage, reason, rule_version)
       VALUES ($1, $2, $3, $4, 'lost', $5, $6)`,
      [id('STG'), leadId, scope.employeeId, lead.stage, input.reason, STAGE_RULE_VERSION]
    );
    await client.query(`UPDATE leads SET stage = 'lost', updated_at = now(), record_version = record_version + 1 WHERE id = $1`, [leadId]);
    await client.query(`UPDATE lead_tasks SET status = 'cancelled', completed_at = now() WHERE lead_id = $1 AND status = 'open'`, [leadId]);
    await client.query(`UPDATE reminders r SET status = 'cancelled' FROM lead_tasks t WHERE r.task_id = t.id AND t.lead_id = $1 AND r.status = 'scheduled'`, [leadId]);
    if (input.futureContact && /opt.?out|stop|suppress/i.test(input.futureContact)) {
      await client.query(
        `INSERT INTO contact_suppressions (id, lead_id, created_by, channels, reason, source, active)
         VALUES ($1, $2, $3, ARRAY['voice','whatsapp','sms','email'], $4, 'loss-form', true)`,
        [id('SUP'), leadId, scope.employeeId, input.futureContact]
      );
    }
    await client.query(
      `INSERT INTO lead_events (id, lead_id, actor_employee_id, kind, note, actor_role, actor_team_id, assignment_id)
       VALUES ($1, $2, $3, 'note', $4, $5, $6, $7)`,
      [id('EVT'), leadId, scope.employeeId, `Loss recorded: ${input.reason} — ${input.explanation}`, actorRole, actorTeam, actorAssignment]
    );
    await client.query('COMMIT');
    return { ok: true, stage: 'lost' as const };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

async function createRequest(scope: Scope, leadId: string, type: string, payload: Record<string, unknown>) {
  await ownedLeadStrict(scope, leadId);
  const reqId = id('REQ');
  await pool.query(
    `INSERT INTO outcome_requests (id, lead_id, actor_employee_id, type, payload, status)
     VALUES ($1, $2, $3, $4, $5, 'pending')`,
    [reqId, leadId, scope.employeeId, type, JSON.stringify(payload)]
  );
  return { id: reqId, requestId: reqId, status: 'pending' as const };
}

export const requestReopen = (scope: Scope, leadId: string, input: ReopenInput) =>
  createRequest(scope, leadId, 'reopen', { ...input });

export const requestHandoff = (scope: Scope, leadId: string, input: HandoffInput) =>
  createRequest(scope, leadId, 'handoff', { ...input });

export async function requestHelp(scope: Scope, leadId: string, input: HelpRequestInput) {
  if (input.recordReference && input.recordReference !== leadId) {
    const params: unknown[] = [input.recordReference, scope.verticals, scope.employeeId, scope.teams];
    const { rows } = await pool.query(
      `SELECT id FROM leads l WHERE l.id = $1 AND l.vertical = ANY($2) AND (l.owner_employee_id = $3 OR l.team_id = ANY($4))`,
      params
    );
    if (!rows[0]) {
      throw new HttpError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', {
        fieldErrors: { recordReference: ['Reference a record you may identify.'] },
      });
    }
  }
  const type = input.requestType === 'metric-correction' ? 'correction' : 'blocker';
  return createRequest(scope, leadId, type, { ...input, kind: input.requestType });
}

export async function listRequests(scope: Scope, leadId: string) {
  await ownedLead(scope, leadId);
  const { rows } = await pool.query(
    `SELECT * FROM outcome_requests WHERE lead_id = $1 ORDER BY created_at DESC`,
    [leadId]
  );
  return rows.map((r: any) => ({
    id: r.id,
    leadId: r.lead_id,
    type: r.type,
    status: r.status,
    payload: r.payload,
    decisionReason: r.decision_reason,
    decisionEvidence: r.decision_evidence ?? {},
    decidedBy: r.decided_by ?? null,
    createdAt: new Date(r.created_at).toISOString(),
    decidedAt: r.decided_at ? new Date(r.decided_at).toISOString() : null,
  }));
}

export async function approveProposal(scope: Scope, proposalId: string) {
  if (scope.role !== 'TL') throw forbidden('Only an authorized approver can approve proposals.');
  const { rows } = await pool.query(
    `SELECT p.*, l.team_id FROM proposals p JOIN leads l ON l.id = p.lead_id WHERE p.id = $1`,
    [proposalId]
  );
  if (!rows[0]) throw notFound();
  const proposal = rows[0];
  if (proposal.actor_employee_id === scope.employeeId) {
    throw forbidden('You cannot approve your own proposal.');
  }
  if (!scope.teams.includes(proposal.team_id)) throw notFound();
  if (proposal.status !== 'pending-approval') {
    throw new HttpError(409, 'DUPLICATE_OPEN_TASK', `Proposal is already ${proposal.status}.`);
  }
  await pool.query(
    `UPDATE proposals SET status = 'approved', approver_employee_id = $2, decided_at = now() WHERE id = $1`,
    [proposalId, scope.employeeId]
  );
  return { ok: true, status: 'approved' as const };
}

export async function sendProposal(scope: Scope, proposalId: string) {
  const { rows } = await pool.query(`SELECT * FROM proposals WHERE id = $1`, [proposalId]);
  const proposal = rows[0];
  if (!proposal || proposal.actor_employee_id !== scope.employeeId) throw notFound();
  if (proposal.status !== 'approved') {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Only approved proposals can be sent.', {
      fieldErrors: { terms: ['Submit for approval first. An edited proposal must be approved again.'] },
    });
  }
  await pool.query(`UPDATE proposals SET status = 'sent', sent_at = now() WHERE id = $1`, [proposalId]);
  await pool.query(
    `INSERT INTO lead_events (id, lead_id, actor_employee_id, kind, note, actor_role, actor_team_id, assignment_id)
     VALUES ($1, $2, $3, 'note', $4, $5, $6, $7)`,
    [id('EVT'), proposal.lead_id, scope.employeeId, `Proposal ${proposalId} sent (SIMULATED — no provider integration). Proposal sent is a pipeline milestone, not revenue.`, scope.role, scope.teams[0] ?? null, scope.assignmentId]
  );
  return { ok: true, status: 'sent' as const };
}

export async function decideRequest(
  scope: Scope,
  requestId: string,
  decision: 'approve' | 'return' | 'reject' | boolean,
  reason: string,
  evidence?: Record<string, unknown>
) {
  // Approval boundary: only TL role with team scope may decide. Callers can never approve their own requests.
  if (scope.role !== 'TL') throw forbidden('Only an authorized decision-maker can decide requests.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT r.*, l.team_id FROM outcome_requests r JOIN leads l ON l.id = r.lead_id WHERE r.id = $1 FOR UPDATE`,
      [requestId]
    );
    const req = rows[0];
    if (!req || !scope.teams.includes(req.team_id)) {
      await client.query('ROLLBACK');
      throw notFound();
    }
    if (req.actor_employee_id === scope.employeeId) {
      await client.query('ROLLBACK');
      throw forbidden('You cannot decide your own request.');
    }
    if (req.status !== 'pending') {
      await client.query('ROLLBACK');
      throw new HttpError(409, 'DUPLICATE_OPEN_TASK', 'This request is already decided.');
    }

    let resolvedStatus: 'approved' | 'returned' | 'rejected';
    if (decision === 'approve' || decision === true) {
      resolvedStatus = 'approved';
    } else if (decision === 'return') {
      resolvedStatus = 'returned';
    } else {
      resolvedStatus = 'rejected';
    }

    const [actorRole, actorTeam, actorAssignment] = attributionFor(scope, req.team_id);
    await client.query(
      `UPDATE outcome_requests SET status = $2, decided_by = $3, decision_reason = $4, decision_evidence = $5, decided_at = now() WHERE id = $1`,
      [requestId, resolvedStatus, scope.employeeId, reason, JSON.stringify(evidence ?? {})]
    );

    if (resolvedStatus === 'approved' && req.type === 'reopen') {
      const payload = (req.payload ?? {}) as Record<string, unknown>;
      const { rows: stageRows } = await client.query(`SELECT stage, vertical FROM leads WHERE id = $1`, [req.lead_id]);
      const currentStage = String(stageRows[0]?.stage ?? '');
      const leadVertical = String(stageRows[0]?.vertical ?? 'wealth');
      const defaultNextStage = leadVertical === 'banking'
        ? 'eligibility'
        : leadVertical === 'markets'
        ? 'kyc'
        : leadVertical === 'real_estate'
        ? 'requirement'
        : 'contacted';
      const toStage = String(payload.requestedNextStage ?? defaultNextStage);
      const targetOk = !['converted', 'lost', 'disbursal', 'active-funded'].includes(toStage);
      const reopenAllowed = currentStage === 'lost'
        ? targetOk
        : (leadVertical === 'banking'
            ? canBankingTransition(currentStage, toStage)
            : leadVertical === 'markets'
            ? canMarketsTransition(currentStage, toStage)
            : leadVertical === 'real_estate'
            ? canRealEstateTransition(currentStage, toStage)
            : canTransition(currentStage, toStage));
      if (!reopenAllowed) {
        await client.query('ROLLBACK');
        throw new HttpError(422, 'VALIDATION_FAILED', 'Requested reopen stage is not an allowed transition.', {
          fieldErrors: { requestedNextStage: [`Stage ${toStage} is not an allowed transition from ${currentStage}.`] },
        });
      }
      await client.query(
        `UPDATE leads SET stage = $2, updated_at = now(), record_version = record_version + 1 WHERE id = $1`,
        [req.lead_id, toStage]
      );
      await client.query(
        `INSERT INTO stage_events (id, lead_id, actor_employee_id, from_stage, to_stage, reason, rule_version)
         VALUES ($1, $2, $3, $4, $5, 'reopen approved', $6)`,
        [id('STG'), req.lead_id, scope.employeeId, currentStage, toStage, STAGE_RULE_VERSION]
      );
      await client.query(
        `INSERT INTO lead_tasks (id, lead_id, owner_employee_id, action, purpose, due_at, priority, status)
         VALUES ($1, $2, $3, 'other', $4, $5, 'normal', 'open')`,
        [id('TASK'), req.lead_id, req.actor_employee_id, String((payload as any).nextAction ?? 'Reopened lead follow-up'), new Date(Date.now() + 86_400_000)]
      );
    }
    if (resolvedStatus === 'approved' && req.type === 'conversion') {
      const { rows: stageRows } = await client.query(`SELECT stage, vertical FROM leads WHERE id = $1 FOR UPDATE`, [req.lead_id]);
      const currentStage = String(stageRows[0]?.stage ?? '');
      const leadVertical = String(stageRows[0]?.vertical ?? 'wealth');
      const expectedPreWonStage = leadVertical === 'banking'
        ? 'sanction'
        : leadVertical === 'markets'
        ? 'demat-opened'
        : leadVertical === 'real_estate'
        ? 'booking'
        : 'qualified';
      const targetWonStage = leadVertical === 'banking'
        ? 'disbursal'
        : leadVertical === 'markets'
        ? 'active-funded'
        : 'converted';
      if (currentStage !== expectedPreWonStage && currentStage !== 'qualified' && !(leadVertical === 'real_estate' && (currentStage === 'site-visit' || currentStage === 'booking' || currentStage === 'registration'))) {
        await client.query('ROLLBACK');
        throw new HttpError(409, 'DUPLICATE_OPEN_TASK', 'Lead state changed since submission (now ' + currentStage + ') — resubmit a new conversion version.');
      }
      await client.query(
        `UPDATE leads SET stage = $2, updated_at = now(), record_version = record_version + 1 WHERE id = $1`,
        [req.lead_id, targetWonStage]
      );
      await client.query(
        `INSERT INTO stage_events (id, lead_id, actor_employee_id, from_stage, to_stage, reason, rule_version)
         VALUES ($1, $2, $3, $4, $5, 'conversion approved', $6)`,
        [id('STG'), req.lead_id, scope.employeeId, currentStage, targetWonStage, STAGE_RULE_VERSION]
      );
    }
    if (resolvedStatus === 'approved' && req.type === 'correction') {
      const payload = (req.payload ?? {}) as Record<string, unknown>;
      if (payload.kind === 'reschedule-approval' && payload.taskId) {
        await client.query(
          `UPDATE lead_tasks SET original_due_at = COALESCE(original_due_at, due_at), due_at = $2, deferral_count = deferral_count + 1
           WHERE id = $1 AND lead_id = $3`,
          [String(payload.taskId), new Date(String(payload.requestedDueAt)), req.lead_id]
        );
        await client.query(`UPDATE reminders SET status = 'cancelled' WHERE task_id = $1 AND status = 'scheduled'`, [String(payload.taskId)]);
      }
      if (payload.kind === 'identity-change-review' && payload.field === 'phone') {
        const { rows: prior } = await client.query(`SELECT phone FROM leads WHERE id = $1`, [req.lead_id]);
        await client.query(
          `UPDATE leads SET phone = $2, updated_at = now(), record_version = record_version + 1 WHERE id = $1`,
          [req.lead_id, String(payload.requested)]
        );
        await client.query(
          `INSERT INTO lead_audit (id, lead_id, actor_employee_id, field, before_value, after_value, reason)
           VALUES ($1, $2, $3, 'phone', $4, $5, $6)`,
          [id('AUD'), req.lead_id, scope.employeeId, prior[0]?.phone ?? null, String(payload.requested), `approved identity-change review: ${String(payload.reason ?? '')}`]
        );
      }
    }
    await client.query(
      `INSERT INTO lead_events (id, lead_id, actor_employee_id, kind, note, actor_role, actor_team_id, assignment_id)
       VALUES ($1, $2, $3, 'task-updated', $4, $5, $6, $7)`,
      [id('EVT'), req.lead_id, scope.employeeId, `Request ${requestId} (${req.type}) ${resolvedStatus}: ${reason}`, actorRole, actorTeam, actorAssignment]
    );
    await client.query('COMMIT');
    return { ok: true, status: resolvedStatus };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
