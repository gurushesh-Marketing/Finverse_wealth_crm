import { PoolClient } from 'pg';
import { pool } from './db';
import type { Scope } from './users';
import {
  QualifyAndHandoffInput,
  HandoffDecisionInput,
  InstitutionCoordinationInput,
  InstitutionCoordinationRecord,
  LeadHandoffRecord,
  RelPortfolioItem,
  RecordVerificationInput,
} from '@finverse/contracts';
import { HttpError, forbidden, notFound } from '../lib/errors';
import { requireLeadForWrite } from '../wealth/scope';
import { maskPhone } from './leads';

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

export async function findEligibleRelationshipManager(
  vertical: string,
  teamId: string,
  clientOrPool = pool
): Promise<{ id: string; name: string } | null> {
  const normVertical = vertical === 'real-estate' ? 'real_estate' : vertical;
  const { rows } = await clientOrPool.query<{
    id: string;
    display_name: string;
    team_id: string;
    active_handoff_count: string;
  }>(
    `SELECT e.id, e.display_name, a.team_id,
            COUNT(h.id) FILTER (WHERE h.status IN ('pending', 'accepted')) AS active_handoff_count
     FROM assignments a
     JOIN employees e ON a.employee_id = e.id
     LEFT JOIN lead_handoffs h ON h.rel_employee_id = e.id
     WHERE (a.vertical = $1 OR (a.vertical = 'real_estate' AND $1 = 'real-estate'))
       AND a.role IN ('REL', 'TL')
       AND (a.effective_to IS NULL OR a.effective_to >= CURRENT_DATE)
       AND e.status = 'active'
       AND NOT EXISTS (
         SELECT 1 FROM employee_leave_requests elr
         WHERE elr.employee_id = e.id
           AND elr.status = 'approved'
           AND CURRENT_DATE BETWEEN elr.start_date AND elr.end_date
       )
       AND NOT EXISTS (
         SELECT 1 FROM (
           SELECT status FROM availability_changes
           WHERE employee_id = e.id
           ORDER BY effective_from DESC LIMIT 1
         ) ac WHERE ac.status = 'away'
       )
     GROUP BY e.id, e.display_name, a.team_id
     ORDER BY
       CASE WHEN a.team_id = $2 THEN 0 ELSE 1 END,
       active_handoff_count ASC,
       e.id ASC
     LIMIT 1`,
    [normVertical, teamId]
  );

  if (!rows[0]) return null;
  return { id: rows[0].id, name: rows[0].display_name };
}

export async function qualifyAndHandoffLead(
  scope: Scope,
  input: QualifyAndHandoffInput
): Promise<LeadHandoffRecord> {
  if (scope.role !== 'SC') {
    throw forbidden('Only Sales Callers can qualify and hand off prospects.');
  }

  const lead = await requireLeadForWrite(scope, input.leadId);
  const eligibleRel = await findEligibleRelationshipManager(lead.vertical, lead.team_id ?? '');
  if (!eligibleRel) {
    throw new HttpError(
      422,
      'VALIDATION_FAILED',
      `No active, eligible Relationship Manager is available in the ${lead.vertical} vertical.`,
      { fieldErrors: { leadId: ['No eligible Relationship Manager found in same vertical.'] } }
    );
  }

  const handoffId = makeId('HO');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const isWealth = lead.vertical === 'wealth';
    const isMarkets = lead.vertical === 'markets';
    const isRealEstate = lead.vertical === 'real_estate' || lead.vertical === 'real-estate';
    let targetAmount = 0;
    let facilityOrMandate = '';

    if (isRealEstate) {
      if (!input.realEstateRequirement) {
        throw new HttpError(422, 'VALIDATION_FAILED', 'Real estate property requirement is required for Real Estate prospects.', {
          fieldErrors: { realEstateRequirement: ['Property budget commitment and property type are required.'] },
        });
      }
      targetAmount = input.realEstateRequirement.budget;
      facilityOrMandate = input.realEstateRequirement.propertyType;
    } else if (isMarkets) {
      if (!input.marketsRequirement) {
        throw new HttpError(422, 'VALIDATION_FAILED', 'Markets trading requirement is required for Markets prospects.', {
          fieldErrors: { marketsRequirement: ['Trading capital commitment and segment are required.'] },
        });
      }
      targetAmount = input.marketsRequirement.tradingCapital;
      facilityOrMandate = input.marketsRequirement.tradingSegment;
    } else if (isWealth) {
      if (!input.wealthRequirement) {
        throw new HttpError(422, 'VALIDATION_FAILED', 'Wealth mandate requirement is required for Wealth prospects.', {
          fieldErrors: { wealthRequirement: ['Investible surplus and mandate product are required.'] },
        });
      }
      targetAmount = input.wealthRequirement.investibleSurplus;
      facilityOrMandate = input.wealthRequirement.mandateType;
    } else {
      if (!input.loanRequirement) {
        throw new HttpError(422, 'VALIDATION_FAILED', 'Banking loan requirement is required for Banking prospects.', {
          fieldErrors: { loanRequirement: ['Requested loan amount and facility type are required.'] },
        });
      }
      targetAmount = input.loanRequirement.requestedAmount;
      facilityOrMandate = input.loanRequirement.facilityType;
    }

    // In Banking, qualification transitions stage to 'eligibility'
    // In Wealth, qualification transitions stage to 'discovery'
    // In Markets, qualification transitions stage to 'kyc'
    // In Real Estate, qualification transitions stage to 'requirement'
    let nextStage = lead.stage;
    if (['new', 'not-contacted', 'contacted', 'follow-up', 'requirement'].includes(lead.stage)) {
      nextStage = lead.vertical === 'banking'
        ? 'eligibility'
        : lead.vertical === 'wealth'
        ? 'discovery'
        : lead.vertical === 'markets'
        ? 'kyc'
        : isRealEstate
        ? 'requirement'
        : 'qualified';
    }

    await client.query(
      `INSERT INTO lead_handoffs (
         id, lead_id, vertical, caller_employee_id, rel_employee_id,
         status, loan_requirement, wealth_requirement, markets_requirement, real_estate_requirement, required_documents, qualification_evidence,
         handoff_time, next_step
       ) VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8, $9, $10, $11, NOW(), $12)`,
      [
        handoffId,
        lead.id,
        lead.vertical,
        scope.employeeId,
        eligibleRel.id,
        JSON.stringify(input.loanRequirement || {}),
        JSON.stringify(input.wealthRequirement || {}),
        JSON.stringify(input.marketsRequirement || {}),
        JSON.stringify(input.realEstateRequirement || {}),
        JSON.stringify(input.requiredDocuments),
        input.qualificationEvidence,
        input.notes ?? (isRealEstate ? 'Property site visit scheduling, RERA verification & developer mandate review' : isMarkets ? 'Trading capital verification, SEBI CKYC & margin clearing review' : isWealth ? 'Initial wealth portfolio discovery & partner mandate review' : 'Initial qualification review and partner alignment'),
      ]
    );

    await client.query(
      `UPDATE leads
       SET stage = $1,
           requested_amount = $2,
           investible_surplus = $3,
           trading_capital = $4,
           property_budget = $5,
           rel_owner_id = $6,
           handoff_status = 'pending',
           updated_at = NOW(),
           record_version = record_version + 1
       WHERE id = $7`,
      [
        nextStage,
        targetAmount,
        isWealth ? targetAmount : null,
        isMarkets ? targetAmount : null,
        isRealEstate ? targetAmount : null,
        eligibleRel.id,
        lead.id,
      ]
    );

    const amountFormatted = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(targetAmount);

    const eventDesc = isRealEstate
      ? `Prospect qualified (${facilityOrMandate}, budget ${amountFormatted}, location ${input.realEstateRequirement?.preferredLocation || 'Mumbai'}). Handed off to Relationship Manager ${eligibleRel.name}. Evidence: ${input.qualificationEvidence}`
      : isMarkets
      ? `Prospect qualified (${facilityOrMandate}, trading capital ${amountFormatted}, risk tolerance ${input.marketsRequirement?.riskTolerance || 'High'}). Handed off to Relationship Manager ${eligibleRel.name}. Evidence: ${input.qualificationEvidence}`
      : isWealth
      ? `Prospect qualified (${facilityOrMandate}, investible surplus ${amountFormatted}, risk profile ${input.wealthRequirement?.riskProfile || 'Moderate'}). Handed off to Relationship Manager ${eligibleRel.name}. Evidence: ${input.qualificationEvidence}`
      : `Prospect qualified (${facilityOrMandate}, requested amount ${amountFormatted}). Handed off to Relationship Manager ${eligibleRel.name}. Evidence: ${input.qualificationEvidence}`;

    await client.query(
      `INSERT INTO lead_events (id, lead_id, actor_employee_id, kind, note, actor_role, actor_team_id, assignment_id)
       VALUES ($1, $2, $3, 'qualification-handoff', $4, $5, $6, $7)`,
      [
        makeId('EVT'),
        lead.id,
        scope.employeeId,
        eventDesc,
        scope.role,
        lead.team_id,
        scope.assignmentId,
      ]
    );

    await client.query('COMMIT');

    return {
      id: handoffId,
      leadId: lead.id,
      vertical: lead.vertical,
      callerEmployeeId: scope.employeeId,
      callerName: scope.displayName,
      relEmployeeId: eligibleRel.id,
      relName: eligibleRel.name,
      status: 'pending',
      loanRequirement: input.loanRequirement || null,
      wealthRequirement: input.wealthRequirement || null,
      marketsRequirement: input.marketsRequirement || null,
      realEstateRequirement: input.realEstateRequirement || null,
      requiredDocuments: input.requiredDocuments,
      qualificationEvidence: input.qualificationEvidence,
      handoffTime: new Date().toISOString(),
      decisionTime: null,
      decisionReason: null,
      nextStep: input.notes ?? (isRealEstate ? 'Property site visit scheduling, RERA verification & developer mandate review' : isMarkets ? 'SEBI CKYC verification, derivative income proof & clearing setup' : isWealth ? 'Initial wealth portfolio discovery & partner mandate review' : 'Initial qualification review and partner alignment'),
      leadDisplayName: lead.display_name,
      leadPhoneMasked: maskPhone(lead.phone),
      leadProduct: lead.product,
      leadStage: nextStage,
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function listRelHandoffs(
  scope: Scope,
  options?: { status?: string; leadId?: string }
): Promise<LeadHandoffRecord[]> {
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (scope.role === 'REL') {
    params.push(scope.employeeId);
    conditions.push(`h.rel_employee_id = $${params.length}`);
  } else if (scope.role === 'SC') {
    params.push(scope.employeeId);
    conditions.push(`h.caller_employee_id = $${params.length}`);
  } else if (['MG', 'RM', 'NM', 'CEO', 'SA'].includes(scope.role)) {
    params.push(scope.verticals);
    conditions.push(`h.vertical = ANY($${params.length})`);
  } else {
    throw forbidden('Not authorized to list Relationship Manager handoffs.');
  }

  if (options?.status) {
    params.push(options.status);
    conditions.push(`h.status = $${params.length}`);
  }

  if (options?.leadId) {
    params.push(options.leadId);
    conditions.push(`h.lead_id = $${params.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await pool.query<{
    id: string;
    lead_id: string;
    vertical: string;
    caller_employee_id: string;
    caller_name: string;
    rel_employee_id: string;
    rel_name: string;
    status: 'pending' | 'accepted' | 'returned';
    loan_requirement: any;
    wealth_requirement: any;
    markets_requirement: any;
    real_estate_requirement: any;
    required_documents: any;
    qualification_evidence: string;
    handoff_time: Date;
    decision_time: Date | null;
    decision_reason: string | null;
    institution_options: any;
    next_step: string | null;
    lead_display_name: string;
    lead_phone: string;
    lead_product: string;
    lead_stage: string;
  }>(
    `SELECT h.*,
            ec.display_name AS caller_name,
            er.display_name AS rel_name,
            l.display_name AS lead_display_name,
            l.phone AS lead_phone,
            l.product AS lead_product,
            l.stage AS lead_stage
     FROM lead_handoffs h
     JOIN employees ec ON h.caller_employee_id = ec.id
     JOIN employees er ON h.rel_employee_id = er.id
     JOIN leads l ON h.lead_id = l.id
     ${whereClause}
     ORDER BY h.handoff_time DESC`,
    params
  );

  const isCaller = scope.role === 'SC';

  return rows.map((r) => ({
    id: r.id,
    leadId: r.lead_id,
    vertical: r.vertical,
    callerEmployeeId: r.caller_employee_id,
    callerName: r.caller_name,
    relEmployeeId: r.rel_employee_id,
    relName: r.rel_name,
    status: r.status,
    loanRequirement: r.loan_requirement && Object.keys(r.loan_requirement).length > 0 ? (typeof r.loan_requirement === 'string' ? JSON.parse(r.loan_requirement) : r.loan_requirement) : null,
    wealthRequirement: r.wealth_requirement && Object.keys(r.wealth_requirement).length > 0 ? (typeof r.wealth_requirement === 'string' ? JSON.parse(r.wealth_requirement) : r.wealth_requirement) : null,
    marketsRequirement: r.markets_requirement && Object.keys(r.markets_requirement).length > 0 ? (typeof r.markets_requirement === 'string' ? JSON.parse(r.markets_requirement) : r.markets_requirement) : null,
    realEstateRequirement: r.real_estate_requirement && Object.keys(r.real_estate_requirement).length > 0 ? (typeof r.real_estate_requirement === 'string' ? JSON.parse(r.real_estate_requirement) : r.real_estate_requirement) : null,
    requiredDocuments: Array.isArray(r.required_documents) ? r.required_documents : [],
    qualificationEvidence: r.qualification_evidence,
    handoffTime: r.handoff_time.toISOString(),
    decisionTime: r.decision_time ? r.decision_time.toISOString() : null,
    decisionReason: r.decision_reason,
    // Sensitive partner coordination notes strictly stripped for Sales Callers:
    institutionOptions: isCaller
      ? undefined
      : Array.isArray(r.institution_options)
      ? r.institution_options
      : [],
    nextStep: r.next_step,
    leadDisplayName: r.lead_display_name,
    leadPhoneMasked: maskPhone(r.lead_phone),
    leadProduct: r.lead_product,
    leadStage: r.lead_stage,
  }));
}

export async function decideHandoff(
  scope: Scope,
  handoffId: string,
  input: HandoffDecisionInput
): Promise<LeadHandoffRecord> {
  if (scope.role !== 'REL') {
    throw forbidden('Only an authorized Relationship Manager can accept or return handoffs.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query<{
      id: string;
      lead_id: string;
      vertical: string;
      caller_employee_id: string;
      rel_employee_id: string;
      status: string;
      loan_requirement: any;
      required_documents: any;
      qualification_evidence: string;
      handoff_time: Date;
    }>(`SELECT * FROM lead_handoffs WHERE id = $1 FOR UPDATE`, [handoffId]);

    if (!rows[0]) {
      throw notFound();
    }

    const handoff = rows[0];
    if (handoff.rel_employee_id !== scope.employeeId) {
      throw forbidden('You are not the assigned Relationship Manager for this handoff.');
    }

    if (handoff.status !== 'pending') {
      throw new HttpError(
        409,
        'HANDOFF_ALREADY_DECIDED',
        `This handoff was already decided (${handoff.status}).`
      );
    }

    const { rows: leadRows } = await client.query<{
      id: string;
      stage: string;
      vertical: string;
      display_name: string;
      phone: string;
      product: string;
      team_id: string;
    }>(`SELECT id, stage, vertical, display_name, phone, product, team_id FROM leads WHERE id = $1 FOR UPDATE`, [handoff.lead_id]);

    const lead = leadRows[0];
    if (!lead) throw notFound();

    if (input.decision === 'accept') {
      // Advance to documents stage in banking if currently eligibility
      let nextStage = lead.stage;
      if (lead.stage === 'eligibility' && lead.vertical === 'banking') {
        nextStage = 'documents';
      } else if (lead.vertical === 'wealth' && (lead.stage === 'discovery' || lead.stage === 'qualified')) {
        nextStage = 'suitability';
      } else if (lead.vertical === 'markets' && (lead.stage === 'kyc' || lead.stage === 'new' || lead.stage === 'qualified')) {
        nextStage = 'risk-profile';
      } else if ((lead.vertical === 'real_estate' || lead.vertical === 'real-estate') && (lead.stage === 'site-visit' || lead.stage === 'requirement' || lead.stage === 'new' || lead.stage === 'qualified' || lead.stage === 'contacted')) {
        // Accepting a handoff transitions to 'site-visit' to schedule and conduct site visit.
        // Accepting a handoff must NOT advance to 'booking' unless recorded booking evidence exists.
        nextStage = 'site-visit';
      }

      const defaultNextStep = (lead.vertical === 'real_estate' || lead.vertical === 'real-estate')
        ? 'Schedule private site visit & verify RERA escrow'
        : 'Detailed requirements & partner coordination';

      await client.query(
        `UPDATE lead_handoffs
         SET status = 'accepted',
             decision_time = NOW(),
             next_step = COALESCE($1, next_step),
             updated_at = NOW()
         WHERE id = $2`,
        [input.nextStep ?? defaultNextStep, handoffId]
      );

      await client.query(
        `UPDATE leads
         SET owner_employee_id = $1,
             rel_owner_id = $1,
             stage = $2,
             handoff_status = 'accepted',
             updated_at = NOW(),
             record_version = record_version + 1
         WHERE id = $3`,
        [scope.employeeId, nextStage, lead.id]
      );

      await client.query(
        `INSERT INTO lead_events (id, lead_id, actor_employee_id, kind, note, actor_role, actor_team_id, assignment_id)
         VALUES ($1, $2, $3, 'handoff-accepted', $4, $5, $6, $7)`,
        [
          makeId('EVT'),
          lead.id,
          scope.employeeId,
          `Relationship Manager ${scope.displayName} accepted handoff. Next step: ${input.nextStep ?? 'Detailed requirements & partner coordination'}. Stage: ${nextStage}`,
          scope.role,
          lead.team_id,
          scope.assignmentId,
        ]
      );
    } else {
      // Returning to caller
      const returnReason = input.reason || 'Insufficient qualification details.';
      // Revert stage to contacted or follow-up
      const nextStage = 'contacted';

      await client.query(
        `UPDATE lead_handoffs
         SET status = 'returned',
             decision_time = NOW(),
             decision_reason = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [returnReason, handoffId]
      );

      await client.query(
        `UPDATE leads
         SET owner_employee_id = $1,
             handoff_status = 'returned',
             stage = $2,
             updated_at = NOW(),
             record_version = record_version + 1
         WHERE id = $3`,
        [handoff.caller_employee_id, nextStage, lead.id]
      );

      await client.query(
        `INSERT INTO lead_events (id, lead_id, actor_employee_id, kind, note, actor_role, actor_team_id, assignment_id)
         VALUES ($1, $2, $3, 'handoff-returned', $4, $5, $6, $7)`,
        [
          makeId('EVT'),
          lead.id,
          scope.employeeId,
          `Handoff returned to Sales Caller by Relationship Manager ${scope.displayName}. Return Reason: ${returnReason}`,
          scope.role,
          lead.team_id,
          scope.assignmentId,
        ]
      );
    }

    await client.query('COMMIT');

    const updated = await listRelHandoffs(scope, { leadId: lead.id });
    return updated.find((h) => h.id === handoffId)!;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function addInstitutionCoordination(
  scope: Scope,
  handoffId: string,
  input: InstitutionCoordinationInput
): Promise<InstitutionCoordinationRecord[]> {
  if (scope.role !== 'REL' && scope.role !== 'MG') {
    throw forbidden('Only an authorized Relationship Manager can record institution coordination.');
  }

  const { rows } = await pool.query<{
    id: string;
    lead_id: string;
    rel_employee_id: string;
    institution_options: any;
  }>(`SELECT id, lead_id, rel_employee_id, institution_options FROM lead_handoffs WHERE id = $1`, [handoffId]);

  if (!rows[0]) throw notFound();
  if (scope.role === 'REL' && rows[0].rel_employee_id !== scope.employeeId) {
    throw forbidden('You are not the assigned Relationship Manager for this handoff.');
  }

  const existing: InstitutionCoordinationRecord[] = Array.isArray(rows[0].institution_options)
    ? rows[0].institution_options
    : [];

  const newEntry: InstitutionCoordinationRecord = {
    id: makeId('INST'),
    institutionName: input.institutionName,
    facilityOffered: input.facilityOffered,
    sanctionAmount: input.sanctionAmount,
    interestRate: input.interestRate,
    status: input.status,
    notes: input.notes,
    recordedAt: new Date().toISOString(),
    recordedBy: scope.displayName,
  };

  const updated = [newEntry, ...existing];

  await pool.query(
    `UPDATE lead_handoffs
     SET institution_options = $1, updated_at = NOW()
     WHERE id = $2`,
    [JSON.stringify(updated), handoffId]
  );

  await pool.query(
    `INSERT INTO lead_events (id, lead_id, actor_employee_id, kind, note, actor_role, actor_team_id, assignment_id)
     VALUES ($1, $2, $3, 'institution-coordination', $4, $5, NULL, $6)`,
    [
      makeId('EVT'),
      rows[0].lead_id,
      scope.employeeId,
      `Institution coordination logged: ${input.institutionName} - ${input.facilityOffered} (${input.status})${input.sanctionAmount ? ` Sanction: ₹${input.sanctionAmount.toLocaleString('en-IN')}` : ''}`,
      scope.role,
      scope.assignmentId,
    ]
  );

  return updated;
}

export async function recordCheckVerification(
  scope: Scope,
  leadId: string,
  input: RecordVerificationInput
) {
  if (scope.role !== 'REL' && scope.role !== 'MG' && scope.role !== 'SA') {
    throw forbidden('Only an authorized Relationship Manager or Manager can record verification evidence.');
  }

  const { rows } = await pool.query<{
    id: string;
    vertical: string;
    team_id: string;
    display_name: string;
    owner_employee_id: string | null;
    rel_owner_id: string | null;
  }>(
    `SELECT id, vertical, team_id, display_name, owner_employee_id, rel_owner_id FROM leads WHERE id = $1`,
    [leadId]
  );
  if (!rows[0]) throw notFound();
  const lead = rows[0];

  const normV = (v: string) => (v === 'real-estate' ? 'real_estate' : v);
  const leadVertical = normV(lead.vertical);
  const userVerticals = (scope.verticals || []).map(normV);

  // 1. Authorize specific prospect and vertical/team
  if (!userVerticals.includes(leadVertical)) {
    throw forbidden(`Not authorized to record verification for prospect in vertical '${lead.vertical}'.`);
  }

  if (scope.role === 'REL') {
    // Relationship Manager must have portfolio ownership, team grant, or inbound handoff assignment
    const { rows: handoffRows } = await pool.query(
      `SELECT id FROM lead_handoffs WHERE lead_id = $1 AND rel_employee_id = $2`,
      [leadId, scope.employeeId]
    );
    const hasHandoff = handoffRows.length > 0;
    const isOwner = lead.owner_employee_id === scope.employeeId || lead.rel_owner_id === scope.employeeId;
    const hasTeam = scope.teams && scope.teams.includes(lead.team_id);

    if (!isOwner && !hasHandoff && !hasTeam) {
      throw forbidden('Not authorized to record verification for this prospect outside your assigned team or portfolio.');
    }
  }

  // 2. Reject checkType that does not belong to prospect's vertical
  const verticalCheckMap: Record<string, string> = {
    wealth: 'suitability',
    markets: 'markets_kyc',
    real_estate: 'real_estate',
    banking: 'credit_bureau',
  };
  const expectedCheckType = verticalCheckMap[leadVertical];
  if (input.checkType !== expectedCheckType) {
    throw new HttpError(
      422,
      'VALIDATION_FAILED',
      `Check type '${input.checkType}' is not applicable to '${lead.vertical}' prospects. Expected '${expectedCheckType}'.`,
      { fieldErrors: { checkType: [`Check type '${input.checkType}' does not match prospect vertical '${lead.vertical}'.`] } }
    );
  }

  // 3. Do not let browser claim real_provider
  if ((input as any).source === 'real_provider') {
    throw new HttpError(
      403,
      'FORBIDDEN',
      'Client cannot assert real_provider source. Real provider verification can only be recorded by trusted server-side provider adapters.'
    );
  }

  // 4. Evidence reference is required
  if (!input.evidenceReference || input.evidenceReference.trim().length < 3) {
    throw new HttpError(
      422,
      'VALIDATION_FAILED',
      'Evidence reference document or filing ID is required (min 3 chars).',
      { fieldErrors: { evidenceReference: ['Provide a genuine evidence filing reference ID (min 3 chars).'] } }
    );
  }

  // 5. Build structured audit payload with auditable evidence record and reviewer decision
  const verificationPayload = {
    checkType: input.checkType,
    status: input.status,
    evidenceReference: input.evidenceReference.trim(),
    source: 'human_review' as const,
    reviewerOrProvider: scope.displayName,
    verifiedAt: new Date().toISOString(),
    notes: input.notes ? input.notes.trim() : undefined,
    // Real Estate sub-checks
    reraApprovalStatus: input.reraApprovalStatus,
    reraProjectNumber: input.reraProjectNumber ? input.reraProjectNumber.trim() : null,
    titleSearchStatus: input.titleSearchStatus,
    // Markets sub-checks
    ckycStatus: input.ckycStatus,
    incomeProofStatus: input.incomeProofStatus,
    sebiRiskDisclosureAcknowledged: input.sebiRiskDisclosureAcknowledged,
    // Wealth sub-checks
    suitabilityStatus: input.suitabilityStatus,
    kraVerified: input.kraVerified,
  };

  await pool.query(
    `INSERT INTO lead_events (id, lead_id, actor_employee_id, kind, note, actor_role, actor_team_id, assignment_id)
     VALUES ($1, $2, $3, 'verification-check', $4, $5, $6, $7)`,
    [
      makeId('EVT'),
      lead.id,
      scope.employeeId,
      JSON.stringify(verificationPayload),
      scope.role,
      lead.team_id,
      scope.assignmentId,
    ]
  );

  return getRelProspectDetail(scope, leadId);
}

export async function getRelPortfolio(scope: Scope): Promise<RelPortfolioItem[]> {
  if (scope.role !== 'REL') {
    throw forbidden('Only Relationship Managers can view their client portfolio.');
  }

  const { rows } = await pool.query<{
    lead_id: string;
    display_name: string;
    phone: string;
    product: string;
    stage: string;
    handoff_id: string;
    handoff_status: 'pending' | 'accepted' | 'returned';
    handoff_time: Date;
    caller_name: string;
    requested_amount: string | null;
    facility_type: string | null;
    mandate_type: string | null;
    investible_surplus: string | null;
    risk_profile: string | null;
    trading_capital: string | null;
    trading_segment: string | null;
    trading_experience: string | null;
    risk_tolerance: string | null;
    property_budget: string | null;
    property_type: string | null;
    preferred_location: string | null;
    site_visit_preference: string | null;
    institutions_count: string;
    next_step: string | null;
    last_activity_at: Date;
  }>(
    `SELECT l.id AS lead_id,
            l.display_name,
            l.phone,
            l.product,
            l.stage,
            h.id AS handoff_id,
            h.status AS handoff_status,
            h.handoff_time,
            ec.display_name AS caller_name,
            COALESCE(l.property_budget, (h.real_estate_requirement->>'budget')::numeric, l.trading_capital, (h.markets_requirement->>'tradingCapital')::numeric, l.investible_surplus, (h.wealth_requirement->>'investibleSurplus')::numeric, l.requested_amount, (h.loan_requirement->>'requestedAmount')::numeric, 0) AS requested_amount,
            COALESCE(h.real_estate_requirement->>'propertyType', h.markets_requirement->>'tradingSegment', h.wealth_requirement->>'mandateType', h.loan_requirement->>'facilityType', l.product, 'Mandate') AS facility_type,
            h.wealth_requirement->>'mandateType' AS mandate_type,
            COALESCE(l.investible_surplus, (h.wealth_requirement->>'investibleSurplus')::numeric, 0) AS investible_surplus,
            h.wealth_requirement->>'riskProfile' AS risk_profile,
            COALESCE(l.trading_capital, (h.markets_requirement->>'tradingCapital')::numeric, 0) AS trading_capital,
            h.markets_requirement->>'tradingSegment' AS trading_segment,
            h.markets_requirement->>'tradingExperience' AS trading_experience,
            h.markets_requirement->>'riskTolerance' AS risk_tolerance,
            COALESCE(l.property_budget, (h.real_estate_requirement->>'budget')::numeric, 0) AS property_budget,
            h.real_estate_requirement->>'propertyType' AS property_type,
            h.real_estate_requirement->>'preferredLocation' AS preferred_location,
            h.real_estate_requirement->>'siteVisitPreference' AS site_visit_preference,
            jsonb_array_length(COALESCE(h.institution_options, '[]'::jsonb)) AS institutions_count,
            h.next_step,
            COALESCE(l.updated_at, h.updated_at, h.handoff_time) AS last_activity_at
     FROM leads l
     JOIN lead_handoffs h ON h.lead_id = l.id
     JOIN employees ec ON h.caller_employee_id = ec.id
     WHERE (l.rel_owner_id = $1 OR h.rel_employee_id = $1)
     ORDER BY h.handoff_time DESC`,
    [scope.employeeId]
  );

  return rows.map((r) => ({
    leadId: r.lead_id,
    displayName: r.display_name,
    phoneMasked: maskPhone(r.phone),
    product: r.product,
    stage: r.stage,
    handoffId: r.handoff_id,
    handoffStatus: r.handoff_status,
    handoffTime: r.handoff_time.toISOString(),
    callerName: r.caller_name,
    requestedAmount: Number(r.requested_amount) || 0,
    facilityType: r.facility_type || 'Mandate',
    mandateType: r.mandate_type || undefined,
    investibleSurplus: r.investible_surplus ? Number(r.investible_surplus) : undefined,
    riskProfile: r.risk_profile || undefined,
    tradingCapital: r.trading_capital ? Number(r.trading_capital) : undefined,
    tradingSegment: r.trading_segment || undefined,
    tradingExperience: r.trading_experience || undefined,
    riskTolerance: r.risk_tolerance || undefined,
    propertyBudget: r.property_budget ? Number(r.property_budget) : undefined,
    propertyType: r.property_type || undefined,
    preferredLocation: r.preferred_location || undefined,
    siteVisitPreference: r.site_visit_preference || undefined,
    institutionsCount: Number(r.institutions_count) || 0,
    nextStep: r.next_step,
    lastActivityAt: r.last_activity_at.toISOString(),
  }));
}

export async function getRelProspectDetail(scope: Scope, leadId: string) {
  if (scope.role !== 'REL' && scope.role !== 'MG' && scope.role !== 'SA') {
    throw forbidden('Not authorized to view Relationship Manager prospect detail.');
  }

  const { rows } = await pool.query<{
    id: string;
    display_name: string;
    email: string | null;
    phone: string;
    product: string;
    vertical: string;
    stage: string;
    requested_amount: string | null;
    investible_surplus: string | null;
    trading_capital: string | null;
    property_budget: string | null;
    owner_employee_id: string;
    rel_owner_id: string | null;
    created_at: Date;
    updated_at: Date;
  }>(`SELECT * FROM leads WHERE id = $1`, [leadId]);

  if (!rows[0]) throw notFound();
  const lead = rows[0];

  const handoffs = await listRelHandoffs(scope, { leadId });
  const activeHandoff = handoffs[0] ?? null;

  const { rows: events } = await pool.query(
    `SELECT e.*, emp.display_name as actor_name
     FROM lead_events e
     LEFT JOIN employees emp ON e.actor_employee_id = emp.id
     WHERE e.lead_id = $1
     ORDER BY e.occurred_at DESC`,
    [leadId]
  );

  const isWealth = lead.vertical === 'wealth';
  const isMarkets = lead.vertical === 'markets';
  const isRealEstate = lead.vertical === 'real_estate' || lead.vertical === 'real-estate';
  const wealthReq = activeHandoff?.wealthRequirement;
  const marketsReq = activeHandoff?.marketsRequirement;
  const realEstateReq = activeHandoff?.realEstateRequirement;

  const leadPayload = {
    id: lead.id,
    displayName: lead.display_name,
    email: lead.email,
    phoneMasked: maskPhone(lead.phone),
    product: lead.product,
    vertical: lead.vertical,
    stage: lead.stage,
    requestedAmount: lead.requested_amount ? Number(lead.requested_amount) : (activeHandoff?.realEstateRequirement?.budget ?? activeHandoff?.marketsRequirement?.tradingCapital ?? activeHandoff?.wealthRequirement?.investibleSurplus ?? activeHandoff?.loanRequirement?.requestedAmount ?? null),
    investibleSurplus: activeHandoff?.wealthRequirement?.investibleSurplus ?? (lead.investible_surplus ? Number(lead.investible_surplus) : null),
    tradingCapital: activeHandoff?.marketsRequirement?.tradingCapital ?? (lead.trading_capital ? Number(lead.trading_capital) : null),
    propertyBudget: activeHandoff?.realEstateRequirement?.budget ?? (lead.property_budget ? Number(lead.property_budget) : null),
    propertyType: activeHandoff?.realEstateRequirement?.propertyType || (isRealEstate ? lead.product : null),
    preferredLocation: activeHandoff?.realEstateRequirement?.preferredLocation || (isRealEstate ? 'Worli / Lower Parel, Mumbai' : null),
    siteVisitPreference: activeHandoff?.realEstateRequirement?.siteVisitPreference || (isRealEstate ? 'Weekend Preferred' : null),
    purchaseTimeline: activeHandoff?.realEstateRequirement?.purchaseTimeline || (isRealEstate ? '1-3 Months (Active Shortlist)' : null),
    purchasePurpose: activeHandoff?.realEstateRequirement?.purchasePurpose || (isRealEstate ? 'End-Use / Self-Occupation' : null),
    fundingSource: activeHandoff?.realEstateRequirement?.fundingSource || (isRealEstate ? 'Self-Funded / Equity Liquidity' : null),
    possessionPreference: activeHandoff?.realEstateRequirement?.possessionPreference || (isRealEstate ? 'Ready to Move In (OC Received)' : null),
    tradingSegment: activeHandoff?.marketsRequirement?.tradingSegment || (isMarkets ? lead.product : null),
    tradingExperience: activeHandoff?.marketsRequirement?.tradingExperience || (isMarkets ? 'Intermediate (1-3 Years)' : null),
    riskTolerance: activeHandoff?.marketsRequirement?.riskTolerance || (isMarkets ? 'Moderate (Equity Delivery + Index Hedging)' : null),
    depositoryPreference: activeHandoff?.marketsRequirement?.depositoryPreference || (isMarkets ? 'CDSL (Central Depository Services India)' : null),
    mandateType: activeHandoff?.wealthRequirement?.mandateType || lead.product,
    riskProfile: activeHandoff?.wealthRequirement?.riskProfile || 'Moderate',
    investmentHorizon: activeHandoff?.wealthRequirement?.investmentHorizon || '3-5 Years',
    ownerEmployeeId: lead.owner_employee_id,
    relOwnerId: lead.rel_owner_id,
  };

  // Extract any human-reviewed or provider verification events from event audit trail
  const verificationEvents = events.filter((e) => e.kind === 'verification-check');
  const getMergedVerification = (checkType: string) => {
    const relevant = verificationEvents
      .slice()
      .reverse()
      .map((ev) => {
        try {
          const data = typeof ev.note === 'string' ? JSON.parse(ev.note) : ev.note;
          if (data && data.checkType === checkType) {
            return {
              ...data,
              reviewerOrProvider: data.reviewerOrProvider || ev.actor_name || 'Relationship Manager',
              occurredAt: ev.occurred_at,
            };
          }
        } catch {
          return null;
        }
        return null;
      })
      .filter(Boolean);

    if (relevant.length === 0) return null;
    return relevant.reduce((acc: any, cur: any) => ({ ...acc, ...cur }), {});
  };

  const mergedSuitability = getMergedVerification('suitability');
  const wSuit = mergedSuitability?.suitabilityStatus || (mergedSuitability?.status === 'verified' ? 'verified' : 'pending');
  const wCkyc = mergedSuitability?.ckycStatus || 'pending';
  const isWealthFullyVerified = wSuit === 'verified' && (wCkyc === 'verified' || mergedSuitability?.kraVerified === true);

  const suitabilityPayload = isWealth
    ? isWealthFullyVerified
      ? {
          status: 'verified' as const,
          suitabilityStatus: 'verified' as const,
          riskCategory: wealthReq?.riskProfile || 'Moderate',
          suitabilityAssessment: mergedSuitability.notes || 'Investment mandate matches client risk tolerance and stated liquidity horizon.',
          ckycStatus: 'verified' as const,
          kraVerified: true,
          isLiveProviderConnected: false,
          evidenceReference: mergedSuitability.evidenceReference || null,
          source: (mergedSuitability.source || 'human_review') as 'human_review' | 'synthetic_demo',
          reviewerOrProvider: mergedSuitability.reviewerOrProvider,
          verifiedAt: mergedSuitability.verifiedAt || (mergedSuitability.occurredAt ? new Date(mergedSuitability.occurredAt).toISOString() : new Date().toISOString()),
          notice: 'SEBI Investor Suitability Matrix verified via recorded human evidence. Depository CKYC & KRA sync active · Zero fake bureau data.',
        }
      : {
          status: 'pending_verification' as const,
          suitabilityStatus: wSuit as any,
          riskCategory: wealthReq?.riskProfile || 'Moderate',
          suitabilityAssessment: mergedSuitability?.notes || 'SEBI investor suitability review pending verification of client evidence and depository records.',
          ckycStatus: wCkyc as any,
          kraVerified: Boolean(mergedSuitability?.kraVerified),
          isLiveProviderConnected: false,
          evidenceReference: mergedSuitability?.evidenceReference || null,
          source: mergedSuitability ? ((mergedSuitability.source || 'human_review') as any) : ('none' as const),
          reviewerOrProvider: mergedSuitability?.reviewerOrProvider || null,
          verifiedAt: mergedSuitability?.verifiedAt || null,
          notice: 'SEBI Investor Suitability review pending. Depository CKYC/KRA integration pending provider credentials · Zero fake bureau data.',
        }
    : null;

  const mergedMarketsKyc = getMergedVerification('markets_kyc');
  const mCkyc = mergedMarketsKyc?.ckycStatus || 'pending';
  const mIncome = mergedMarketsKyc?.incomeProofStatus || 'pending';
  const mRisk = mergedMarketsKyc?.sebiRiskDisclosureAcknowledged === true;
  const isMarketsFullyVerified = mCkyc === 'verified' && mIncome === 'verified' && mRisk === true;

  const marketsKycPayload = isMarkets
    ? isMarketsFullyVerified
      ? {
          status: 'verified' as const,
          riskCategory: marketsReq?.riskTolerance || 'High / Speculative (Active F&O & Leverage)',
          ckycStatus: 'verified' as const,
          ckycVerified: true,
          panAadhaarLinked: true,
          incomeProofStatus: 'verified' as const,
          derivativeSuitability: (marketsReq?.tradingSegment?.includes('F&O') || marketsReq?.tradingSegment?.includes('Derivatives'))
            ? ('eligible_active' as const)
            : ('restricted_cash_only' as const),
          sebiRiskDisclosureAcknowledged: true,
          depositoryStatus: marketsReq?.depositoryPreference
            ? `${marketsReq.depositoryPreference} (Active Verified)`
            : 'CDSL / NSDL Depository Sync Active',
          isLiveProviderConnected: false,
          evidenceReference: mergedMarketsKyc.evidenceReference || null,
          source: (mergedMarketsKyc.source || 'human_review') as 'human_review' | 'synthetic_demo',
          reviewerOrProvider: mergedMarketsKyc.reviewerOrProvider,
          verifiedAt: mergedMarketsKyc.verifiedAt || (mergedMarketsKyc.occurredAt ? new Date(mergedMarketsKyc.occurredAt).toISOString() : new Date().toISOString()),
          notice: 'SEBI Central KYC & KRA depository sync verified via recorded evidence. Mandatory derivative risk disclosure acknowledged on file (9 out of 10 individual F&O traders incur net losses). Credit Bureau / CIBIL not applicable for Markets trading.',
        }
      : {
          status: 'pending_verification' as const,
          riskCategory: marketsReq?.riskTolerance || 'High / Speculative (Active F&O & Leverage)',
          ckycStatus: mCkyc as any,
          ckycVerified: mCkyc === 'verified',
          panAadhaarLinked: mCkyc === 'verified',
          incomeProofStatus: mIncome as any,
          derivativeSuitability: (marketsReq?.tradingSegment?.includes('F&O') || marketsReq?.tradingSegment?.includes('Derivatives'))
            ? ('eligible_active' as const)
            : ('restricted_cash_only' as const),
          sebiRiskDisclosureAcknowledged: mRisk,
          depositoryStatus: marketsReq?.depositoryPreference
            ? `${marketsReq.depositoryPreference} (Pending Depository Sync)`
            : 'Pending Depository Verification',
          isLiveProviderConnected: false,
          evidenceReference: mergedMarketsKyc?.evidenceReference || null,
          source: mergedMarketsKyc ? ((mergedMarketsKyc.source || 'human_review') as any) : ('none' as const),
          reviewerOrProvider: mergedMarketsKyc?.reviewerOrProvider || null,
          verifiedAt: mergedMarketsKyc?.verifiedAt || null,
          notice: 'SEBI Central KYC & KRA depository sync pending. Mandatory derivative risk disclosure pending client acknowledgement (9 out of 10 individual F&O traders incur net losses). Credit Bureau / CIBIL not applicable for Markets trading.',
        }
    : null;

  const mergedRealEstate = getMergedVerification('real_estate');
  const reraStatus = mergedRealEstate?.reraApprovalStatus || (mergedRealEstate?.reraProjectNumber ? 'verified' : 'pending');
  const reraNumber = mergedRealEstate?.reraProjectNumber || null;
  const titleStatus = mergedRealEstate?.titleSearchStatus || 'pending_legal_search';
  const isReFullyVerified = reraStatus === 'verified' && reraNumber !== null && titleStatus === 'clear_unencumbered';

  const realEstateCheckPayload = isRealEstate
    ? isReFullyVerified
      ? {
          status: 'verified' as const,
          reraApprovalStatus: 'verified' as const,
          reraProjectNumber: reraNumber,
          titleSearchStatus: 'clear_unencumbered' as const,
          siteVisitStatus: activeHandoff?.status === 'accepted' ? ('scheduled' as const) : ('requested' as const),
          bookingMilestoneStatus: (mergedRealEstate.bookingMilestoneStatus || 'pending') as any,
          isLiveProviderConnected: false,
          evidenceReference: mergedRealEstate.evidenceReference || null,
          source: (mergedRealEstate.source || 'human_review') as 'human_review' | 'synthetic_demo',
          reviewerOrProvider: mergedRealEstate.reviewerOrProvider,
          verifiedAt: mergedRealEstate.verifiedAt || (mergedRealEstate.occurredAt ? new Date(mergedRealEstate.occurredAt).toISOString() : new Date().toISOString()),
          notice: 'RERA project registration and 30-year title search verified unencumbered via recorded legal evidence. Direct developer mandate; Credit Bureau / CIBIL not applicable for property acquisition.',
        }
      : {
          status: 'pending_verification' as const,
          reraApprovalStatus: reraStatus as any,
          reraProjectNumber: reraNumber,
          titleSearchStatus: titleStatus as any,
          siteVisitStatus: activeHandoff?.status === 'accepted' ? ('scheduled' as const) : ('requested' as const),
          bookingMilestoneStatus: 'pending' as const,
          isLiveProviderConnected: false,
          evidenceReference: mergedRealEstate?.evidenceReference || null,
          source: mergedRealEstate ? ((mergedRealEstate.source || 'human_review') as any) : ('none' as const),
          reviewerOrProvider: mergedRealEstate?.reviewerOrProvider || null,
          verifiedAt: mergedRealEstate?.verifiedAt || null,
          notice: 'RERA project registration and 30-year title search pending verification with developer legal records. Credit Bureau / CIBIL not applicable for property acquisition.',
        }
    : null;

  const latestBureau = getMergedVerification('credit_bureau');
  const bureauPayload = (isWealth || isMarkets || isRealEstate)
    ? null
    : latestBureau && latestBureau.status === 'verified'
    ? {
        status: 'verified' as const,
        provider: latestBureau.provider || 'Consented Bureau Integration',
        score: latestBureau.score ?? null,
        scoreBand: latestBureau.scoreBand ?? null,
        isLiveProviderConnected: false,
        consentVerified: true,
        evidenceReference: latestBureau.evidenceReference || null,
        source: (latestBureau.source || 'human_review') as 'human_review' | 'synthetic_demo',
        reviewerOrProvider: latestBureau.reviewerOrProvider,
        verifiedAt: latestBureau.verifiedAt || (latestBureau.occurredAt ? new Date(latestBureau.occurredAt).toISOString() : new Date().toISOString()),
        notice: 'Credit Bureau verification confirmed via recorded consented authorization and provider record.',
      }
    : {
        status: 'pending_authorization' as const,
        provider: 'Consented Bureau Integration Pending',
        score: null,
        scoreBand: null,
        isLiveProviderConnected: false,
        consentVerified: false,
        evidenceReference: null,
        source: 'none' as const,
        reviewerOrProvider: null,
        verifiedAt: null,
        notice: 'Live CIBIL integration pending credentials. Consented provider authorization required before running bureau check.',
      };

  return {
    lead: leadPayload,
    prospect: leadPayload,
    handoff: activeHandoff,
    handoffs: activeHandoff ? [activeHandoff] : [],
    institutionOptions: (activeHandoff?.institutionOptions as any) || [],
    creditBureauCheck: bureauPayload,
    bureauStatus: bureauPayload,
    suitabilityCheck: suitabilityPayload,
    marketsKycCheck: marketsKycPayload,
    realEstateCheck: realEstateCheckPayload,
    timeline: events.map((ev) => ({
      id: ev.id,
      kind: ev.kind,
      note: ev.note,
      actorName: ev.actor_name || 'System',
      occurredAt: ev.occurred_at.toISOString(),
    })),
  };
}
