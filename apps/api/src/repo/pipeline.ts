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
import { eq, and, or, ne, inArray, desc, sql } from 'drizzle-orm';
import { db } from './db';
import {
  leads,
  teams,
  employees,
  enquiries,
  proposals,
  qualifications,
  lossRecords,
  outcomeRequests,
  stageEvents,
  leadEvents,
  leadAudit,
  leadTasks,
  reminders,
  contactSuppressions,
} from '../db/schema';
import type { Scope } from './users';
import { forbidden, notFound, HttpError } from '../lib/errors';
import { requireLeadForRead, requireLeadForWrite, attributionFor, type ScopedLead } from '../wealth/scope';
import {
  LOSS_REASONS,
  STAGE_RULE_VERSION,
  WEALTH_STAGE_TRANSITIONS,
  ENQUIRY_SOURCES,
  canTransition,
  WEALTH_PRODUCTS,
} from '../wealth/rules';

function id(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

async function ownedLead(scope: Scope, leadId: string): Promise<ScopedLead> {
  return requireLeadForRead(scope, leadId);
}

async function ownedLeadStrict(scope: Scope, leadId: string): Promise<ScopedLead> {
  return requireLeadForWrite(scope, leadId);
}

async function assertWealthAssignment(scope: Scope): Promise<void> {
  const [team] = await db
    .select({ vertical: teams.vertical })
    .from(teams)
    .where(eq(teams.id, scope.teams[0] ?? ''));
  if (team?.vertical !== 'wealth' || !scope.verticals.includes('wealth')) {
    throw forbidden('Self-sourced enquiries require a wealth assignment.');
  }
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
    const [dup] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.phone, input.phone), ne(leads.id, leadId)))
      .limit(1);

    if (dup) {
      const reqId = id('REQ');
      await db.insert(outcomeRequests).values({
        id: reqId,
        leadId,
        actorEmployeeId: scope.employeeId,
        type: 'correction',
        payload: {
          kind: 'identity-change-review',
          field: 'phone',
          requested: input.phone,
          reason: input.reason,
        },
        status: 'pending',
      });
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

  return await db.transaction(async (tx) => {
    await tx
      .update(leads)
      .set({
        displayName: next.display_name!,
        phone: next.phone!,
        email: next.email,
        preferredLanguage: next.preferred_language!,
        updatedAt: sql`now()`,
        recordVersion: sql`${leads.recordVersion} + 1`,
      })
      .where(eq(leads.id, leadId));

    const audit: AuditEntry[] = [];
    for (const [field, before, after] of fields) {
      const auditId = id('AUD');
      const [audRow] = await tx
        .insert(leadAudit)
        .values({
          id: auditId,
          leadId,
          actorEmployeeId: scope.employeeId,
          field,
          beforeValue: before,
          afterValue: after,
          reason: input.reason,
        })
        .returning();

      audit.push({
        id: audRow.id,
        field: audRow.field,
        beforeValue: audRow.beforeValue,
        afterValue: audRow.afterValue,
        reason: audRow.reason,
        actorName: scope.displayName,
        occurredAt: new Date(audRow.occurredAt).toISOString(),
      });
    }

    const [actorRole, actorTeam, actorAssignment] = attributionFor(scope, lead.team_id);
    await tx.insert(leadEvents).values({
      id: id('EVT'),
      leadId,
      actorEmployeeId: scope.employeeId,
      kind: 'task-updated',
      note: `Prospect details corrected (${fields.map(([f]) => f).join(', ')}): ${input.reason}`,
      actorRole,
      actorTeamId: actorTeam,
      assignmentId: actorAssignment,
    });

    return { status: 'saved', changed: true, audit };
  });
}

export async function listAudit(scope: Scope, leadId: string): Promise<AuditEntry[]> {
  await ownedLead(scope, leadId);
  const rows = await db
    .select({
      id: leadAudit.id,
      field: leadAudit.field,
      before_value: leadAudit.beforeValue,
      after_value: leadAudit.afterValue,
      reason: leadAudit.reason,
      actor_name: employees.displayName,
      occurred_at: leadAudit.occurredAt,
    })
    .from(leadAudit)
    .innerJoin(employees, eq(employees.id, leadAudit.actorEmployeeId))
    .where(eq(leadAudit.leadId, leadId))
    .orderBy(desc(leadAudit.occurredAt));

  return rows.map((r) => ({
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
  await assertWealthAssignment(scope);
  if (!(WEALTH_PRODUCTS as readonly string[]).includes(input.product)) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', {
      fieldErrors: { product: ['Choose a product within V1.'] },
    });
  }
  if (!(ENQUIRY_SOURCES as readonly string[]).includes(input.source)) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', {
      fieldErrors: { source: ['Choose an approved source.'] },
    });
  }

  const [dup] = await db
    .select({ id: leads.id })
    .from(leads)
    .where(eq(leads.phone, input.phone))
    .limit(1);

  const duplicateOf = dup?.id ?? null;
  const enquiryId = id('ENQ');
  const status = duplicateOf ? 'duplicate' : 'pending-validation';

  const [r] = await db
    .insert(enquiries)
    .values({
      id: enquiryId,
      createdBy: scope.employeeId,
      displayName: input.displayName,
      phone: input.phone,
      email: input.email || null,
      product: input.product,
      source: input.source,
      permissionEvidence: input.permissionEvidence,
      need: input.need,
      status,
      duplicateOf,
    })
    .returning();

  return {
    id: r.id,
    displayName: r.displayName,
    status: r.status as Enquiry['status'],
    duplicateOf: r.duplicateOf,
    publishedLeadId: r.publishedLeadId,
    createdAt: new Date(r.createdAt).toISOString(),
  };
}

export async function publishEnquiry(scope: Scope, enquiryId: string) {
  await assertWealthAssignment(scope);
  return await db.transaction(async (tx) => {
    const [enq] = await tx
      .select()
      .from(enquiries)
      .where(eq(enquiries.id, enquiryId))
      .for('update');

    if (!enq || enq.createdBy !== scope.employeeId) {
      throw notFound();
    }
    if (enq.status !== 'pending-validation') {
      throw new HttpError(409, 'DUPLICATE_OPEN_TASK', `Enquiry is already ${enq.status}.`);
    }

    const leadId = `FV-5${Math.floor(100000 + Math.random() * 900000)}`;
    await tx.insert(leads).values({
      id: leadId,
      vertical: 'wealth',
      displayName: enq.displayName,
      email: enq.email,
      phone: enq.phone,
      preferredLanguage: 'English',
      product: enq.product,
      source: enq.source,
      stage: 'new',
      ownerEmployeeId: null,
      teamId: scope.teams[0] ?? null,
    });

    await tx
      .update(enquiries)
      .set({ status: 'published', publishedLeadId: leadId })
      .where(eq(enquiries.id, enquiryId));

    await tx.insert(leadEvents).values({
      id: id('EVT'),
      leadId,
      actorEmployeeId: scope.employeeId,
      kind: 'note',
      note: `Manual intake published (created by ${scope.displayName}; self-ownership not assumed). Permission evidence: ${enq.permissionEvidence}.`,
      actorRole: scope.role,
      actorTeamId: scope.teams[0] ?? null,
      assignmentId: scope.assignmentId,
    });

    return { enquiryId, leadId, status: 'published' as const };
  });
}

export async function listEnquiries(scope: Scope): Promise<Enquiry[]> {
  const rows = await db
    .select({
      id: enquiries.id,
      displayName: enquiries.displayName,
      status: enquiries.status,
      duplicateOf: enquiries.duplicateOf,
      publishedLeadId: enquiries.publishedLeadId,
      createdAt: enquiries.createdAt,
    })
    .from(enquiries)
    .where(eq(enquiries.createdBy, scope.employeeId))
    .orderBy(desc(enquiries.createdAt));

  return rows.map((r) => ({
    id: r.id,
    displayName: r.displayName,
    status: r.status as Enquiry['status'],
    duplicateOf: r.duplicateOf,
    publishedLeadId: r.publishedLeadId,
    createdAt: new Date(r.createdAt).toISOString(),
  }));
}

export async function saveQualification(scope: Scope, leadId: string, input: QualificationInput) {
  await ownedLeadStrict(scope, leadId);
  if (!(WEALTH_PRODUCTS as readonly string[]).includes(input.product)) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', {
      fieldErrors: { product: ['Product mismatch: request an approved referral instead.'] },
    });
  }
  const qualId = id('QUAL');
  await db.insert(qualifications).values({
    id: qualId,
    leadId,
    actorEmployeeId: scope.employeeId,
    need: input.need,
    product: input.product,
    expectedValue: input.expectedValue ? String(input.expectedValue) : null,
    currency: input.currency ?? null,
    timeHorizon: input.timeHorizon,
    checklist: input.checklist as any,
    checklistVersion: 'wealth-fit-v1',
    nextStep: input.nextStep,
  });

  await db.insert(leadEvents).values({
    id: id('EVT'),
    leadId,
    actorEmployeeId: scope.employeeId,
    kind: 'note',
    note: `Qualification saved (checklist wealth-fit-v1). Need: ${input.need}. Estimate (not verified revenue): ${input.expectedValue ?? 'n/a'} ${input.currency ?? ''}`,
    actorRole: scope.role,
    actorTeamId: scope.teams[0] ?? null,
    assignmentId: scope.assignmentId,
  });

  return { id: qualId, recommendedNextStep: input.nextStep };
}

export async function moveStage(scope: Scope, leadId: string, input: StageChangeInput) {
  const lead = await ownedLeadStrict(scope, leadId);
  const [actorRole, actorTeam, actorAssignment] = attributionFor(scope, lead.team_id);

  if (input.toStage === 'converted' || input.toStage === 'lost') {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Converted follows approval rules and Lost uses the loss form.', {
      fieldErrors: { toStage: ['Use Submit conversion (SC-20) or Mark lost (SC-21) for this transition.'] },
    });
  }
  if (!canTransition(lead.stage, input.toStage)) {
    const allowed = (WEALTH_STAGE_TRANSITIONS[lead.stage] ?? []).join(', ') || 'none';
    throw new HttpError(422, 'VALIDATION_FAILED', `The record changed or ${lead.stage} -> ${input.toStage} is not an allowed transition.`, {
      fieldErrors: { toStage: [`Allowed from ${lead.stage}: ${allowed}.`] },
    });
  }

  return await db.transaction(async (tx) => {
    await tx.insert(stageEvents).values({
      id: id('STG'),
      leadId,
      actorEmployeeId: scope.employeeId,
      fromStage: lead.stage,
      toStage: input.toStage,
      reason: input.reason,
      ruleVersion: STAGE_RULE_VERSION,
    });

    await tx
      .update(leads)
      .set({
        stage: input.toStage,
        updatedAt: sql`now()`,
        recordVersion: sql`${leads.recordVersion} + 1`,
      })
      .where(eq(leads.id, leadId));

    await tx.insert(leadEvents).values({
      id: id('EVT'),
      leadId,
      actorEmployeeId: scope.employeeId,
      kind: 'task-updated',
      note: `Stage moved ${lead.stage} -> ${input.toStage} (${input.reason})`,
      actorRole,
      actorTeamId: actorTeam,
      assignmentId: actorAssignment,
    });

    return { ok: true, stage: input.toStage };
  });
}

export async function createProposal(scope: Scope, leadId: string, input: ProposalInput): Promise<ProposalRecord> {
  await ownedLeadStrict(scope, leadId);
  const proposalId = id('PROP');
  const [row] = await db
    .insert(proposals)
    .values({
      id: proposalId,
      leadId,
      actorEmployeeId: scope.employeeId,
      product: input.product,
      templateVersion: input.templateVersion,
      terms: input.terms as any,
      validUntil: input.validUntil,
      status: 'draft',
    })
    .returning();

  return proposalView(row);
}

export async function submitProposal(scope: Scope, proposalId: string) {
  const [proposal] = await db
    .select()
    .from(proposals)
    .where(and(eq(proposals.id, proposalId), eq(proposals.actorEmployeeId, scope.employeeId)));
  if (!proposal) throw notFound();
  if (proposal.status !== 'draft') {
    throw new HttpError(409, 'DUPLICATE_OPEN_TASK', `Proposal is already ${proposal.status}.`);
  }

  await db
    .update(proposals)
    .set({
      status: 'pending-approval',
      version: sql`${proposals.version} + 1`,
    })
    .where(eq(proposals.id, proposalId));

  await db.insert(leadEvents).values({
    id: id('EVT'),
    leadId: proposal.leadId,
    actorEmployeeId: scope.employeeId,
    kind: 'note',
    note: `Proposal ${proposalId} submitted for approval (pending until an authorized approver decides).`,
    actorRole: scope.role,
    actorTeamId: scope.teams[0] ?? null,
    assignmentId: scope.assignmentId,
  });

  return { ok: true, status: 'pending-approval' };
}

export async function listProposals(scope: Scope, leadId: string): Promise<ProposalRecord[]> {
  await ownedLead(scope, leadId);
  const rows = await db
    .select()
    .from(proposals)
    .where(eq(proposals.leadId, leadId))
    .orderBy(desc(proposals.createdAt));
  return rows.map(proposalView);
}

function proposalView(r: any): ProposalRecord {
  return {
    id: r.id,
    leadId: r.leadId ?? r.lead_id,
    product: r.product,
    templateVersion: r.templateVersion ?? r.template_version,
    terms: r.terms,
    validUntil: r.validUntil ?? r.valid_until,
    status: r.status,
    version: r.version,
    createdAt: new Date(r.createdAt ?? r.created_at).toISOString(),
  };
}

export async function requestConversion(scope: Scope, leadId: string, input: ConversionInput) {
  const lead = await ownedLeadStrict(scope, leadId);
  if (lead.stage !== 'qualified') {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Complete the required product milestones first.', {
      fieldErrors: { winMilestone: ['Conversion requires the Qualified stage.'] },
    });
  }

  const [pending] = await db
    .select({ id: outcomeRequests.id })
    .from(outcomeRequests)
    .where(
      and(
        eq(outcomeRequests.leadId, leadId),
        eq(outcomeRequests.type, 'conversion'),
        eq(outcomeRequests.status, 'pending')
      )
    )
    .limit(1);

  if (pending) {
    throw new HttpError(409, 'DUPLICATE_OPEN_TASK', 'A conversion request is already pending for this lead.');
  }

  const [actorRole, actorTeam, actorAssignment] = attributionFor(scope, lead.team_id);
  const reqId = id('REQ');

  await db.insert(outcomeRequests).values({
    id: reqId,
    leadId,
    actorEmployeeId: scope.employeeId,
    type: 'conversion',
    payload: { ...input, submittedAs: { stage: lead.stage, recordVersion: lead.record_version } },
    status: 'pending',
  });

  await db.insert(leadEvents).values({
    id: id('EVT'),
    leadId,
    actorEmployeeId: scope.employeeId,
    kind: 'note',
    note: `Conversion submitted (Pending conversion — not a win until approved). Value: ${input.value} ${input.currency}.`,
    actorRole,
    actorTeamId: actorTeam,
    assignmentId: actorAssignment,
  });

  return { requestId: reqId, status: 'pending' as const };
}

export async function markLost(scope: Scope, leadId: string, input: LossInput) {
  const lead = await ownedLeadStrict(scope, leadId);
  if (lead.stage === 'converted') {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Converted records cannot be changed to Lost by the caller.', {
      fieldErrors: { reason: ['Use a cancellation/refund request to protect financial history.'] },
    });
  }
  if (!(LOSS_REASONS as readonly string[]).includes(input.reason)) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', {
      fieldErrors: { reason: ['Loss requires an allowed reason.'] },
    });
  }

  return await db.transaction(async (tx) => {
    const [pendingConversion] = await tx
      .select({ id: outcomeRequests.id })
      .from(outcomeRequests)
      .where(
        and(
          eq(outcomeRequests.leadId, leadId),
          eq(outcomeRequests.type, 'conversion'),
          eq(outcomeRequests.status, 'pending')
        )
      )
      .limit(1);

    if (pendingConversion) {
      throw new HttpError(409, 'DUPLICATE_OPEN_TASK', 'A conversion request is pending — resolve it before recording a loss.');
    }

    const [actorRole, actorTeam, actorAssignment] = attributionFor(scope, lead.team_id);

    await tx.insert(lossRecords).values({
      id: id('LOSS'),
      leadId,
      actorEmployeeId: scope.employeeId,
      reason: input.reason,
      explanation: input.explanation,
      competitor: input.competitor ?? null,
      futureContact: input.futureContact ?? null,
    });

    await tx.insert(stageEvents).values({
      id: id('STG'),
      leadId,
      actorEmployeeId: scope.employeeId,
      fromStage: lead.stage,
      toStage: 'lost',
      reason: input.reason,
      ruleVersion: STAGE_RULE_VERSION,
    });

    await tx
      .update(leads)
      .set({
        stage: 'lost',
        updatedAt: sql`now()`,
        recordVersion: sql`${leads.recordVersion} + 1`,
      })
      .where(eq(leads.id, leadId));

    await tx
      .update(leadTasks)
      .set({ status: 'cancelled', completedAt: sql`now()` })
      .where(and(eq(leadTasks.leadId, leadId), eq(leadTasks.status, 'open')));

    await tx.execute(
      sql`UPDATE reminders r SET status = 'cancelled' FROM lead_tasks t WHERE r.task_id = t.id AND t.lead_id = ${leadId} AND r.status = 'scheduled'`
    );

    if (input.futureContact && /opt.?out|stop|suppress/i.test(input.futureContact)) {
      await tx.insert(contactSuppressions).values({
        id: id('SUP'),
        leadId,
        createdBy: scope.employeeId,
        channels: ['voice', 'whatsapp', 'sms', 'email'],
        reason: input.futureContact,
        source: 'loss-form',
        active: true,
      });
    }

    await tx.insert(leadEvents).values({
      id: id('EVT'),
      leadId,
      actorEmployeeId: scope.employeeId,
      kind: 'note',
      note: `Loss recorded: ${input.reason} — ${input.explanation}`,
      actorRole,
      actorTeamId: actorTeam,
      assignmentId: actorAssignment,
    });

    return { ok: true, stage: 'lost' as const };
  });
}

async function createRequest(scope: Scope, leadId: string, type: string, payload: Record<string, unknown>) {
  await ownedLeadStrict(scope, leadId);
  const reqId = id('REQ');
  await db.insert(outcomeRequests).values({
    id: reqId,
    leadId,
    actorEmployeeId: scope.employeeId,
    type,
    payload: payload as any,
    status: 'pending',
  });
  return { requestId: reqId, status: 'pending' as const };
}

export const requestReopen = (scope: Scope, leadId: string, input: ReopenInput) =>
  createRequest(scope, leadId, 'reopen', { ...input });

export const requestHandoff = (scope: Scope, leadId: string, input: HandoffInput) =>
  createRequest(scope, leadId, 'handoff', { ...input });

export async function requestHelp(scope: Scope, leadId: string, input: HelpRequestInput) {
  if (input.recordReference && input.recordReference !== leadId) {
    const [row] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(
        and(
          eq(leads.id, input.recordReference),
          inArray(leads.vertical, scope.verticals),
          or(
            eq(leads.ownerEmployeeId, scope.employeeId),
            inArray(leads.teamId, scope.teams)
          )
        )
      )
      .limit(1);

    if (!row) {
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
  const rows = await db
    .select()
    .from(outcomeRequests)
    .where(eq(outcomeRequests.leadId, leadId))
    .orderBy(desc(outcomeRequests.createdAt));

  return rows.map((r) => ({
    id: r.id,
    leadId: r.leadId,
    type: r.type,
    status: r.status,
    payload: r.payload,
    decisionReason: r.decisionReason,
    decisionEvidence: (r.decisionEvidence as Record<string, unknown>) ?? {},
    decidedBy: r.decidedBy ?? null,
    createdAt: new Date(r.createdAt).toISOString(),
    decidedAt: r.decidedAt ? new Date(r.decidedAt).toISOString() : null,
  }));
}

export async function approveProposal(scope: Scope, proposalId: string) {
  if (scope.role !== 'TL') throw forbidden('Only an authorized approver can approve proposals.');

  const [row] = await db
    .select({
      id: proposals.id,
      actorEmployeeId: proposals.actorEmployeeId,
      status: proposals.status,
      teamId: leads.teamId,
    })
    .from(proposals)
    .innerJoin(leads, eq(leads.id, proposals.leadId))
    .where(eq(proposals.id, proposalId));

  if (!row) throw notFound();
  if (row.actorEmployeeId === scope.employeeId) {
    throw forbidden('You cannot approve your own proposal.');
  }
  if (!row.teamId || !scope.teams.includes(row.teamId)) throw notFound();
  if (row.status !== 'pending-approval') {
    throw new HttpError(409, 'DUPLICATE_OPEN_TASK', `Proposal is already ${row.status}.`);
  }

  await db
    .update(proposals)
    .set({
      status: 'approved',
      approverEmployeeId: scope.employeeId,
      decidedAt: sql`now()`,
    })
    .where(eq(proposals.id, proposalId));

  return { ok: true, status: 'approved' as const };
}

export async function sendProposal(scope: Scope, proposalId: string) {
  const [proposal] = await db.select().from(proposals).where(eq(proposals.id, proposalId));
  if (!proposal || proposal.actorEmployeeId !== scope.employeeId) throw notFound();
  if (proposal.status !== 'approved') {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Only approved proposals can be sent.', {
      fieldErrors: { terms: ['Submit for approval first. An edited proposal must be approved again.'] },
    });
  }

  await db
    .update(proposals)
    .set({ status: 'sent', sentAt: sql`now()` })
    .where(eq(proposals.id, proposalId));

  await db.insert(leadEvents).values({
    id: id('EVT'),
    leadId: proposal.leadId,
    actorEmployeeId: scope.employeeId,
    kind: 'note',
    note: `Proposal ${proposalId} sent (SIMULATED — no provider integration). Proposal sent is a pipeline milestone, not revenue.`,
    actorRole: scope.role,
    actorTeamId: scope.teams[0] ?? null,
    assignmentId: scope.assignmentId,
  });

  return { ok: true, status: 'sent' as const };
}

export async function decideRequest(
  scope: Scope,
  requestId: string,
  decision: 'approve' | 'return' | 'reject' | boolean,
  reason: string,
  evidence?: Record<string, unknown>
) {
  if (scope.role !== 'TL') throw forbidden('Only an authorized decision-maker can decide requests.');

  return await db.transaction(async (tx) => {
    const [req] = await tx
      .select({
        id: outcomeRequests.id,
        leadId: outcomeRequests.leadId,
        actorEmployeeId: outcomeRequests.actorEmployeeId,
        type: outcomeRequests.type,
        payload: outcomeRequests.payload,
        status: outcomeRequests.status,
        teamId: leads.teamId,
      })
      .from(outcomeRequests)
      .innerJoin(leads, eq(leads.id, outcomeRequests.leadId))
      .where(eq(outcomeRequests.id, requestId))
      .for('update');

    if (!req || !req.teamId || !scope.teams.includes(req.teamId)) {
      throw notFound();
    }
    if (req.actorEmployeeId === scope.employeeId) {
      throw forbidden('You cannot decide your own request.');
    }
    if (req.status !== 'pending') {
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

    const [actorRole, actorTeam, actorAssignment] = attributionFor(scope, req.teamId);

    await tx
      .update(outcomeRequests)
      .set({
        status: resolvedStatus,
        decidedBy: scope.employeeId,
        decisionReason: reason,
        decisionEvidence: (evidence ?? {}) as any,
        decidedAt: sql`now()`,
      })
      .where(eq(outcomeRequests.id, requestId));

    if (resolvedStatus === 'approved' && req.type === 'reopen') {
      const payload = (req.payload ?? {}) as Record<string, unknown>;
      const toStage = String(payload.requestedNextStage ?? 'contacted');
      const [stageRow] = await tx.select({ stage: leads.stage }).from(leads).where(eq(leads.id, req.leadId));
      const currentStage = String(stageRow?.stage ?? '');
      const targetOk = !['converted', 'lost'].includes(toStage);
      const reopenAllowed = currentStage === 'lost' ? targetOk : canTransition(currentStage, toStage);
      if (!reopenAllowed) {
        throw new HttpError(422, 'VALIDATION_FAILED', 'Requested reopen stage is not an allowed transition.', {
          fieldErrors: {
            requestedNextStage: [
              `Allowed from ${currentStage}: ${(WEALTH_STAGE_TRANSITIONS[currentStage] ?? []).join(', ') || 'none (use reopen)'}.`,
            ],
          },
        });
      }

      await tx
        .update(leads)
        .set({
          stage: toStage,
          updatedAt: sql`now()`,
          recordVersion: sql`${leads.recordVersion} + 1`,
        })
        .where(eq(leads.id, req.leadId));

      await tx.insert(stageEvents).values({
        id: id('STG'),
        leadId: req.leadId,
        actorEmployeeId: scope.employeeId,
        fromStage: currentStage,
        toStage,
        reason: 'reopen approved',
        ruleVersion: STAGE_RULE_VERSION,
      });

      await tx.insert(leadTasks).values({
        id: id('TASK'),
        leadId: req.leadId,
        ownerEmployeeId: req.actorEmployeeId,
        action: 'other',
        purpose: String((payload as any).nextAction ?? 'Reopened lead follow-up'),
        dueAt: new Date(Date.now() + 86_400_000).toISOString(),
        priority: 'normal',
        status: 'open',
      });
    }

    if (resolvedStatus === 'approved' && req.type === 'conversion') {
      const [stageRow] = await tx
        .select({ stage: leads.stage })
        .from(leads)
        .where(eq(leads.id, req.leadId))
        .for('update');

      const currentStage = String(stageRow?.stage ?? '');
      if (currentStage !== 'qualified') {
        throw new HttpError(
          409,
          'DUPLICATE_OPEN_TASK',
          'Lead state changed since submission (now ' + currentStage + ') — resubmit a new conversion version.'
        );
      }

      await tx
        .update(leads)
        .set({
          stage: 'converted',
          updatedAt: sql`now()`,
          recordVersion: sql`${leads.recordVersion} + 1`,
        })
        .where(eq(leads.id, req.leadId));

      await tx.insert(stageEvents).values({
        id: id('STG'),
        leadId: req.leadId,
        actorEmployeeId: scope.employeeId,
        fromStage: currentStage,
        toStage: 'converted',
        reason: 'conversion approved',
        ruleVersion: STAGE_RULE_VERSION,
      });
    }

    if (resolvedStatus === 'approved' && req.type === 'correction') {
      const payload = (req.payload ?? {}) as Record<string, unknown>;
      if (payload.kind === 'reschedule-approval' && payload.taskId) {
        await tx
          .update(leadTasks)
          .set({
            originalDueAt: sql`COALESCE(${leadTasks.originalDueAt}, ${leadTasks.dueAt})`,
            dueAt: new Date(String(payload.requestedDueAt)).toISOString(),
            deferralCount: sql`${leadTasks.deferralCount} + 1`,
          })
          .where(and(eq(leadTasks.id, String(payload.taskId)), eq(leadTasks.leadId, req.leadId)));

        await tx
          .update(reminders)
          .set({ status: 'cancelled' })
          .where(and(eq(reminders.taskId, String(payload.taskId)), eq(reminders.status, 'scheduled')));
      }

      if (payload.kind === 'identity-change-review' && payload.field === 'phone') {
        const [prior] = await tx.select({ phone: leads.phone }).from(leads).where(eq(leads.id, req.leadId));
        await tx
          .update(leads)
          .set({
            phone: String(payload.requested),
            updatedAt: sql`now()`,
            recordVersion: sql`${leads.recordVersion} + 1`,
          })
          .where(eq(leads.id, req.leadId));

        await tx.insert(leadAudit).values({
          id: id('AUD'),
          leadId: req.leadId,
          actorEmployeeId: scope.employeeId,
          field: 'phone',
          beforeValue: prior?.phone ?? null,
          afterValue: String(payload.requested),
          reason: `approved identity-change review: ${String(payload.reason ?? '')}`,
        });
      }
    }

    await tx.insert(leadEvents).values({
      id: id('EVT'),
      leadId: req.leadId,
      actorEmployeeId: scope.employeeId,
      kind: 'task-updated',
      note: `Request ${requestId} (${req.type}) ${resolvedStatus}: ${reason}`,
      actorRole,
      actorTeamId: actorTeam,
      assignmentId: actorAssignment,
    });

    return { ok: true, status: resolvedStatus };
  });
}
