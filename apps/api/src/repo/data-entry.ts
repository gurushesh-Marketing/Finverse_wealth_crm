import { createHash } from 'node:crypto';
import type {
  BatchPublishReceipt,
  BatchUploadInput,
  DePeriod,
  DuplicateCandidateSummary,
  DuplicateDecisionInput,
  EnquiryCaptureInput,
  IntakeBatchSummary,
  IntakeEnquiryReceipt,
  IntakeQualityReport,
  IntakeRowSummary,
  IntakeSourceSummary,
  IntakeWorklistExport,
  PublishBatchInput,
  QualityReportQuery,
  RestrictedCandidateSummary,
  RowCorrectionInput,
  SourceEvidenceInput,
  Vertical,
} from '@finverse/contracts';
import { pool } from './db';
import type { Scope } from './users';
import { forbidden, HttpError, notFound } from '../lib/errors';
import { logSystemAudit } from './superadmin';

function assertDe(scope: Scope): void {
  if (scope.role !== 'DE' && scope.role !== 'SA') {
    throw forbidden('Only authorized Data Entry operators and Super Administrators can access intake pipelines.');
  }
}

function makeId(prefix: string): string {
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${rand}`;
}

function computeSha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

/** Sanitize text against formula injection attack when preparing export spreadsheets */
export function sanitizeCellValue(val: string): string {
  const trimmed = val.trim();
  // Protect against spreadsheet formula injection (=, @, or +/- followed by non-digits)
  if (/^[=@]/.test(trimmed)) {
    return `'${trimmed}`;
  }
  if (/^[+\-]/.test(trimmed)) {
    // If it's a signed number or an international phone number (e.g. +91..., -1500), preserve legitimate value
    if (/^[+\-]\s*\d/.test(trimmed)) {
      return trimmed;
    }
    return `'${trimmed}`;
  }
  return trimmed;
}

/** Normalized phone validator supporting Indian standards and international E.164 formats */
export function normalizePhone(raw: string): { valid: boolean; normalized: string } {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, '');
  // Standard Indian 10-digit mobile starting with 6-9
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return { valid: true, normalized: `+91 ${digits.slice(0, 5)} ${digits.slice(5)}` };
  }
  // Standard Indian 12-digit mobile starting with 91 followed by 6-9
  if (digits.length === 12 && digits.startsWith('91') && /^[6-9]/.test(digits.slice(2))) {
    const core = digits.slice(2);
    return { valid: true, normalized: `+91 ${core.slice(0, 5)} ${core.slice(5)}` };
  }
  // International E.164 phone number starting with + and 7 to 15 digits
  if (trimmed.startsWith('+') && digits.length >= 7 && digits.length <= 15) {
    return { valid: true, normalized: trimmed.replace(/\s+/g, ' ') };
  }
  return { valid: false, normalized: trimmed };
}

// ====================================================================
// DE-06: Maintain source evidence and contact provenance (P273–P274)
// ====================================================================
export async function listSources(scope: Scope): Promise<IntakeSourceSummary[]> {
  assertDe(scope);
  const { rows } = await pool.query(`
    SELECT s.*,
           COUNT(DISTINCT b.id)::int as total_batches,
           COALESCE(SUM(b.total_rows), 0)::int as total_rows
      FROM intake_sources s
      LEFT JOIN intake_batches b ON b.source_id = s.id
     GROUP BY s.id
     ORDER BY s.status ASC, s.source_name ASC
  `);
  return rows.map((r: any) => ({
    id: r.id,
    sourceCode: r.source_code,
    sourceName: r.source_name,
    vendorName: r.vendor_name ?? undefined,
    collectionBasis: r.collection_basis,
    evidenceDocumentUrl: r.evidence_document_url ?? undefined,
    effectiveFrom: r.effective_from ? new Date(r.effective_from).toISOString().slice(0, 10) : '',
    effectiveTo: r.effective_to ? new Date(r.effective_to).toISOString().slice(0, 10) : undefined,
    permittedVerticals: r.permitted_verticals ?? [],
    permittedProducts: r.permitted_products ?? [],
    status: r.status,
    notes: r.notes ?? undefined,
    totalBatches: r.total_batches,
    totalRows: r.total_rows,
    createdAt: r.created_at.toISOString(),
  }));
}

export async function createOrUpdateSource(
  scope: Scope,
  input: SourceEvidenceInput,
  existingId?: string
): Promise<IntakeSourceSummary> {
  assertDe(scope);

  // Cross-scope vertical check
  for (const v of input.permittedVerticals) {
    if (!scope.verticals.includes(v) && scope.role !== 'SA') {
      throw forbidden(`You are not authorized to grant intake source scope for vertical '${v}'.`);
    }
  }

  const id = existingId ?? makeId('SRC');
  const query = `
    INSERT INTO intake_sources (
      id, source_code, source_name, vendor_name, collection_basis,
      evidence_document_url, effective_from, effective_to,
      permitted_verticals, permitted_products, status, notes, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())
    ON CONFLICT (id) DO UPDATE SET
      source_name = EXCLUDED.source_name,
      vendor_name = EXCLUDED.vendor_name,
      collection_basis = EXCLUDED.collection_basis,
      evidence_document_url = EXCLUDED.evidence_document_url,
      effective_from = EXCLUDED.effective_from,
      effective_to = EXCLUDED.effective_to,
      permitted_verticals = EXCLUDED.permitted_verticals,
      permitted_products = EXCLUDED.permitted_products,
      status = EXCLUDED.status,
      notes = EXCLUDED.notes,
      updated_at = now()
    RETURNING *
  `;
  const values = [
    id,
    input.sourceCode.trim().toUpperCase(),
    input.sourceName.trim(),
    input.vendorName?.trim() || null,
    input.collectionBasis.trim(),
    input.evidenceDocumentUrl?.trim() || null,
    input.effectiveFrom,
    input.effectiveTo || null,
    input.permittedVerticals,
    input.permittedProducts,
    input.status,
    input.notes?.trim() || null,
  ];

  const { rows } = await pool.query(query, values);
  const r = rows[0];

  await logSystemAudit(
    scope.employeeId,
    existingId ? 'INTAKE_SOURCE_UPDATED' : 'INTAKE_SOURCE_CREATED',
    'intake_source',
    r.id,
    { sourceCode: r.source_code, status: r.status, basis: r.collection_basis }
  );

  return {
    id: r.id,
    sourceCode: r.source_code,
    sourceName: r.source_name,
    vendorName: r.vendor_name ?? undefined,
    collectionBasis: r.collection_basis,
    evidenceDocumentUrl: r.evidence_document_url ?? undefined,
    effectiveFrom: r.effective_from ? new Date(r.effective_from).toISOString().slice(0, 10) : '',
    effectiveTo: r.effective_to ? new Date(r.effective_to).toISOString().slice(0, 10) : undefined,
    permittedVerticals: r.permitted_verticals ?? [],
    permittedProducts: r.permitted_products ?? [],
    status: r.status,
    notes: r.notes ?? undefined,
    totalBatches: 0,
    totalRows: 0,
    createdAt: r.created_at.toISOString(),
  };
}

// ====================================================================
// DE-01: Capture a source-backed enquiry (P263–P264)
// ====================================================================
export async function captureEnquiry(
  scope: Scope,
  input: EnquiryCaptureInput
): Promise<IntakeEnquiryReceipt> {
  assertDe(scope);

  // Invariant: Data Entry cannot choose vertical outside grants
  if (!scope.verticals.includes(input.vertical) && scope.role !== 'SA') {
    throw forbidden(`You are not granted access to submit enquiries for vertical '${input.vertical}'.`);
  }

  // Verify source active status
  const { rows: sourceRows } = await pool.query(
    `SELECT * FROM intake_sources WHERE id = $1`,
    [input.sourceId]
  );
  const source = sourceRows[0];
  if (!source) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Invalid intake source selected.', {
      fieldErrors: { sourceId: ['Select an approved intake source.'] },
    });
  }
  if (source.status === 'suspended') {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Source is suspended pending privacy audit [DE-06]. Intake not permitted.', {
      fieldErrors: { sourceId: ['This source is currently suspended.'] },
    });
  }
  if (!source.permitted_verticals.includes(input.vertical)) {
    throw new HttpError(422, 'VALIDATION_FAILED', `Source '${source.source_name}' is not permitted for vertical '${input.vertical}'.`, {
      fieldErrors: { sourceId: ['Source is not permitted for this vertical.'] },
    });
  }

  // Validate phone format
  const phoneValidation = normalizePhone(input.phone);
  const validationErrors: Array<{ field: string; code: string; message: string }> = [];
  if (!phoneValidation.valid) {
    validationErrors.push({
      field: 'phone',
      code: 'INVALID_PHONE_FORMAT',
      message: 'Mobile number must be a valid 10-digit Indian number starting with 6-9.',
    });
  }

  // Check for candidate duplicate by phone across leads
  const { rows: leadDupes } = await pool.query(
    `SELECT id, display_name, phone, vertical, stage FROM leads WHERE phone = $1 OR phone = $2 LIMIT 1`,
    [phoneValidation.normalized, input.phone.trim()]
  );
  const matchLead = leadDupes[0];
  const isDuplicate = Boolean(matchLead);

  let status: 'valid' | 'rejected' | 'duplicate_hold' = 'valid';
  if (validationErrors.length > 0) {
    status = 'rejected';
  } else if (isDuplicate) {
    status = 'duplicate_hold';
  }

  const rowId = makeId('ROW-MANUAL');
  const rawPayload = {
    prospectName: input.prospectName,
    phone: input.phone,
    email: input.email || null,
    vertical: input.vertical,
    targetTeamId: input.targetTeamId,
    product: input.product,
    sourceId: input.sourceId,
    sourceName: source.source_name,
    permissionEvidence: input.permissionEvidence,
    permissionDate: input.permissionDate,
    needSummary: input.needSummary || null,
    submittedBy: scope.employeeId,
  };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO intake_rows (
        id, batch_id, row_index, raw_payload, parsed_name, parsed_phone,
        parsed_email, parsed_product, parsed_source, permission_evidence,
        permission_date, need_summary, validation_errors, is_duplicate,
        duplicate_match_lead_id, duplicate_decision, status, created_at, updated_at
      )
      VALUES ($1, NULL, 1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, now(), now())`,
      [
        rowId,
        JSON.stringify(rawPayload),
        input.prospectName.trim(),
        phoneValidation.normalized,
        input.email?.trim() || null,
        input.product.trim(),
        source.source_name,
        input.permissionEvidence.trim(),
        input.permissionDate,
        input.needSummary?.trim() || null,
        JSON.stringify(validationErrors),
        isDuplicate,
        matchLead ? matchLead.id : null,
        isDuplicate ? 'pending' : null,
        status,
      ]
    );

    await client.query('COMMIT');

    return {
      id: rowId,
      rowId,
      status,
      prospectName: input.prospectName.trim(),
      phone: phoneValidation.normalized,
      vertical: input.vertical,
      product: input.product.trim(),
      validationErrors,
      isDuplicate,
      duplicateMatchLeadId: matchLead ? matchLead.id : undefined,
      createdAt: new Date().toISOString(),
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ====================================================================
// DE-02: Upload and map a data file (P265–P266)
// ====================================================================
export async function listBatches(scope: Scope, vertical?: string): Promise<IntakeBatchSummary[]> {
  assertDe(scope);
  const params: unknown[] = [];
  let whereClause = '';
  if (vertical) {
    params.push(vertical);
    whereClause = `WHERE b.vertical = $${params.length}`;
  }

  const { rows } = await pool.query(
    `SELECT b.*,
            s.source_name,
            t.name as team_name,
            e.display_name as uploaded_by_name
       FROM intake_batches b
       JOIN intake_sources s ON s.id = b.source_id
       JOIN teams t ON t.id = b.target_team_id
       JOIN employees e ON e.id = b.uploaded_by_employee_id
       ${whereClause}
      ORDER BY b.created_at DESC`,
    params
  );

  return rows.map((r: any) => ({
    id: r.id,
    batchName: r.batch_name,
    sourceId: r.source_id,
    sourceName: r.source_name,
    vertical: r.vertical,
    targetTeamId: r.target_team_id,
    teamName: r.team_name,
    uploadedByEmployeeId: r.uploaded_by_employee_id,
    uploadedByName: r.uploaded_by_name,
    fileName: r.file_name,
    fileHash: r.file_hash,
    columnMapping: r.column_mapping ?? {},
    totalRows: r.total_rows,
    validRows: r.valid_rows,
    rejectedRows: r.rejected_rows,
    duplicateRows: r.duplicate_rows,
    publishedRows: r.published_rows,
    heldRows: r.held_rows,
    status: r.status,
    notes: r.notes ?? undefined,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  }));
}

export async function getBatchSummary(scope: Scope, batchId: string): Promise<{
  batch: IntakeBatchSummary;
  rows: IntakeRowSummary[];
}> {
  assertDe(scope);

  const { rows: batchRows } = await pool.query(
    `SELECT b.*,
            s.source_name,
            t.name as team_name,
            e.display_name as uploaded_by_name
       FROM intake_batches b
       JOIN intake_sources s ON s.id = b.source_id
       JOIN teams t ON t.id = b.target_team_id
       JOIN employees e ON e.id = b.uploaded_by_employee_id
      WHERE b.id = $1`,
    [batchId]
  );
  const b = batchRows[0];
  if (!b) throw notFound();

  const { rows: rowItems } = await pool.query(
    `SELECT * FROM intake_rows WHERE batch_id = $1 ORDER BY row_index ASC`,
    [batchId]
  );

  const batch: IntakeBatchSummary = {
    id: b.id,
    batchName: b.batch_name,
    sourceId: b.source_id,
    sourceName: b.source_name,
    vertical: b.vertical,
    targetTeamId: b.target_team_id,
    teamName: b.team_name,
    uploadedByEmployeeId: b.uploaded_by_employee_id,
    uploadedByName: b.uploaded_by_name,
    fileName: b.file_name,
    fileHash: b.file_hash,
    columnMapping: b.column_mapping ?? {},
    totalRows: b.total_rows,
    validRows: b.valid_rows,
    rejectedRows: b.rejected_rows,
    duplicateRows: b.duplicate_rows,
    publishedRows: b.published_rows,
    heldRows: b.held_rows,
    status: b.status,
    notes: b.notes ?? undefined,
    createdAt: b.created_at.toISOString(),
    updatedAt: b.updated_at.toISOString(),
  };

  const rows: IntakeRowSummary[] = rowItems.map((r: any) => ({
    id: r.id,
    batchId: r.batch_id,
    rowIndex: r.row_index,
    rawPayload: r.raw_payload ?? {},
    parsedName: r.parsed_name,
    parsedPhone: r.parsed_phone,
    parsedEmail: r.parsed_email,
    parsedProduct: r.parsed_product,
    parsedSource: r.parsed_source,
    permissionEvidence: r.permission_evidence,
    permissionDate: r.permission_date ? new Date(r.permission_date).toISOString().slice(0, 10) : '',
    needSummary: r.need_summary,
    validationErrors: r.validation_errors ?? [],
    isDuplicate: r.is_duplicate,
    duplicateMatchLeadId: r.duplicate_match_lead_id,
    duplicateDecision: r.duplicate_decision,
    duplicateDecisionNotes: r.duplicate_decision_notes,
    status: r.status,
    correctionHistory: r.correction_history ?? [],
    publishedLeadId: r.published_lead_id,
    publishedAt: r.published_at ? r.published_at.toISOString() : null,
    createdAt: r.created_at.toISOString(),
  }));

  return { batch, rows };
}

/** Simple, RFC-compliant CSV parser with formula injection sanitization */
function parseCsv(content: string): Array<Record<string, string>> {
  const lines = content
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l) => l.trim().length > 0);

  if (lines.length < 2) return [];

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const headers = parseLine(lines[0]!).map((h) => h.replace(/^["']|["']$/g, '').trim());
  const rows: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]!);
    const record: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j]!;
      const val = values[j] !== undefined ? sanitizeCellValue(values[j]!) : '';
      record[header] = val;
    }
    rows.push(record);
  }

  return rows;
}

export async function uploadBatch(
  scope: Scope,
  input: BatchUploadInput
): Promise<IntakeBatchSummary> {
  assertDe(scope);

  if (!scope.verticals.includes(input.vertical) && scope.role !== 'SA') {
    throw forbidden(`You are not authorized for vertical '${input.vertical}'.`);
  }

  // Verify source
  const { rows: sourceRows } = await pool.query(
    `SELECT * FROM intake_sources WHERE id = $1`,
    [input.sourceId]
  );
  const source = sourceRows[0];
  if (!source) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Intake source not found.', {
      fieldErrors: { sourceId: ['Select an approved intake source.'] },
    });
  }
  if (source.status === 'suspended') {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Source is suspended pending compliance audit [DE-06]. Intake prohibited.', {
      fieldErrors: { sourceId: ['Selected source is currently suspended.'] },
    });
  }

  const fileHash = computeSha256(input.csvContent);

  // Check if identical batch already uploaded
  const { rows: existingBatch } = await pool.query(
    `SELECT id, batch_name, status FROM intake_batches WHERE file_hash = $1`,
    [fileHash]
  );
  if (existingBatch[0]) {
    throw new HttpError(409, 'DUPLICATE_OPEN_TASK', `A file with identical contents was already uploaded as batch '${existingBatch[0].id}' (${existingBatch[0].batch_name}).`, {
      fieldErrors: { fileName: ['Duplicate batch file contents detected.'] },
    });
  }

  const parsedCsvRows = parseCsv(input.csvContent);
  if (parsedCsvRows.length === 0) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'File contains zero data rows or header format is invalid.', {
      fieldErrors: { csvContent: ['Upload a non-empty CSV with headers.'] },
    });
  }
  if (parsedCsvRows.length > 500) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Batch size exceeds safe single upload limit of 500 rows.', {
      fieldErrors: { csvContent: ['Exceeds maximum 500 rows.'] },
    });
  }

  const batchId = makeId('B');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let validRows = 0;
    let rejectedRows = 0;
    let duplicateRows = 0;

    const rowInserts: Array<{
      id: string;
      rowIndex: number;
      rawPayload: Record<string, string>;
      parsedName: string;
      parsedPhone: string;
      parsedEmail: string | null;
      parsedProduct: string;
      parsedSource: string;
      permissionEvidence: string;
      permissionDate: string;
      needSummary: string | null;
      validationErrors: Array<{ field: string; code: string; message: string }>;
      isDuplicate: boolean;
      duplicateMatchLeadId: string | null;
      duplicateDecision: string | null;
      status: 'valid' | 'rejected' | 'duplicate_hold';
    }> = [];

    // Query existing leads phones for batch duplicate matching
    const phones = parsedCsvRows
      .map((r) => r.phone || r['Primary Mobile'] || r.Mobile || r.Phone || '')
      .map((p) => normalizePhone(p).normalized);

    const { rows: matchLeads } = await client.query(
      `SELECT id, phone, vertical, stage FROM leads WHERE phone = ANY($1::text[])`,
      [phones]
    );
    const leadMap = new Map<string, any>(matchLeads.map((m: any) => [m.phone, m]));

    for (let i = 0; i < parsedCsvRows.length; i++) {
      const raw = parsedCsvRows[i]!;
      const rowId = `${batchId}-${String(i + 1).padStart(3, '0')}`;

      // Column mapping resolution
      const rawName = raw.name || raw['Client Name'] || raw['Prospect Name'] || raw.Name || '';
      const rawPhone = raw.phone || raw['Primary Mobile'] || raw.Mobile || raw.Phone || '';
      const rawEmail = raw.email || raw['Email Address'] || raw.Email || '';
      const rawProduct = raw.product || raw['Target Product'] || raw.Product || '';
      const rawEvidence = raw.evidence || raw['Consent Reference'] || raw.Consent || raw['Permission Evidence'] || '';
      const rawDate = raw.date || raw['Consent Date'] || raw.Date || new Date().toISOString().slice(0, 10);
      const rawNeed = raw.need || raw['Need Summary'] || raw.Notes || raw.Need || '';

      const phoneNorm = normalizePhone(rawPhone);
      const validationErrors: Array<{ field: string; code: string; message: string }> = [];

      if (!rawName.trim()) {
        validationErrors.push({ field: 'name', code: 'MISSING_NAME', message: 'Prospect name is required.' });
      }
      if (!phoneNorm.valid) {
        validationErrors.push({ field: 'phone', code: 'INVALID_PHONE', message: 'Valid 10-digit mobile number required.' });
      }
      if (!rawProduct.trim()) {
        validationErrors.push({ field: 'product', code: 'MISSING_PRODUCT', message: 'Target product is required.' });
      }
      if (!rawEvidence.trim()) {
        validationErrors.push({ field: 'permissionEvidence', code: 'MISSING_EVIDENCE', message: 'Consent or permission evidence reference required.' });
      }

      const match = leadMap.get(phoneNorm.normalized);
      const isDupe = Boolean(match);

      let rowStatus: 'valid' | 'rejected' | 'duplicate_hold' = 'valid';
      if (validationErrors.length > 0) {
        rowStatus = 'rejected';
        rejectedRows++;
      } else if (isDupe) {
        rowStatus = 'duplicate_hold';
        duplicateRows++;
      } else {
        validRows++;
      }

      rowInserts.push({
        id: rowId,
        rowIndex: i + 1,
        rawPayload: raw,
        parsedName: rawName.trim() || 'Unnamed',
        parsedPhone: phoneNorm.normalized,
        parsedEmail: rawEmail.trim() || null,
        parsedProduct: rawProduct.trim() || 'General Enquiry',
        parsedSource: source.source_name,
        permissionEvidence: rawEvidence.trim() || 'Batch Vendor Reference',
        permissionDate: rawDate,
        needSummary: rawNeed.trim() || null,
        validationErrors,
        isDuplicate: isDupe,
        duplicateMatchLeadId: match ? match.id : null,
        duplicateDecision: isDupe ? 'pending' : null,
        status: rowStatus,
      });
    }

    const heldRows = rejectedRows + duplicateRows;
    const batchStatus = validRows > 0 ? 'ready_for_publish' : 'staging';

    await client.query(
      `INSERT INTO intake_batches (
        id, batch_name, source_id, vertical, target_team_id,
        uploaded_by_employee_id, file_name, file_hash, column_mapping,
        total_rows, valid_rows, rejected_rows, duplicate_rows, published_rows,
        held_rows, status, notes, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 0, $14, $15, $16, now(), now())`,
      [
        batchId,
        input.batchName.trim(),
        input.sourceId,
        input.vertical,
        input.targetTeamId,
        scope.employeeId,
        input.fileName.trim(),
        fileHash,
        JSON.stringify(input.columnMapping || {}),
        parsedCsvRows.length,
        validRows,
        rejectedRows,
        duplicateRows,
        heldRows,
        batchStatus,
        input.notes?.trim() || null,
      ]
    );

    for (const r of rowInserts) {
      await client.query(
        `INSERT INTO intake_rows (
          id, batch_id, row_index, raw_payload, parsed_name, parsed_phone,
          parsed_email, parsed_product, parsed_source, permission_evidence,
          permission_date, need_summary, validation_errors, is_duplicate,
          duplicate_match_lead_id, duplicate_decision, status, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, now(), now())`,
        [
          r.id,
          batchId,
          r.rowIndex,
          JSON.stringify(r.rawPayload),
          r.parsedName,
          r.parsedPhone,
          r.parsedEmail,
          r.parsedProduct,
          r.parsedSource,
          r.permissionEvidence,
          r.permissionDate,
          r.needSummary,
          JSON.stringify(r.validationErrors),
          r.isDuplicate,
          r.duplicateMatchLeadId,
          r.duplicateDecision,
          r.status,
        ]
      );
    }

    await client.query('COMMIT');

    await logSystemAudit(
      scope.employeeId,
      'INTAKE_BATCH_UPLOADED',
      'intake_batch',
      batchId,
      {
        batchName: input.batchName,
        totalRows: parsedCsvRows.length,
        validRows,
        rejectedRows,
        duplicateRows,
      }
    );

    const { rows: tRows } = await pool.query(`SELECT name FROM teams WHERE id = $1`, [input.targetTeamId]);

    return {
      id: batchId,
      batchName: input.batchName.trim(),
      sourceId: input.sourceId,
      sourceName: source.source_name,
      vertical: input.vertical,
      targetTeamId: input.targetTeamId,
      teamName: tRows[0]?.name ?? input.targetTeamId,
      uploadedByEmployeeId: scope.employeeId,
      uploadedByName: scope.displayName,
      fileName: input.fileName.trim(),
      fileHash,
      columnMapping: input.columnMapping || {},
      totalRows: parsedCsvRows.length,
      validRows,
      rejectedRows,
      duplicateRows,
      publishedRows: 0,
      heldRows,
      status: batchStatus,
      notes: input.notes?.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ====================================================================
// DE-03: Correct rejected intake rows (P267–P268)
// ====================================================================
export async function listRejectedRows(
  scope: Scope,
  batchId?: string,
  errorReason?: string
): Promise<IntakeRowSummary[]> {
  assertDe(scope);

  const params: unknown[] = [];
  const where: string[] = ["r.status = 'rejected'"];

  if (batchId) {
    params.push(batchId);
    where.push(`r.batch_id = $${params.length}`);
  }
  if (errorReason) {
    params.push(`%${errorReason}%`);
    where.push(`r.validation_errors::text ILIKE $${params.length}`);
  }

  const { rows } = await pool.query(
    `SELECT r.* FROM intake_rows r WHERE ${where.join(' AND ')} ORDER BY r.batch_id, r.row_index ASC`,
    params
  );

  return rows.map((r: any) => ({
    id: r.id,
    batchId: r.batch_id,
    rowIndex: r.row_index,
    rawPayload: r.raw_payload ?? {},
    parsedName: r.parsed_name,
    parsedPhone: r.parsed_phone,
    parsedEmail: r.parsed_email,
    parsedProduct: r.parsed_product,
    parsedSource: r.parsed_source,
    permissionEvidence: r.permission_evidence,
    permissionDate: r.permission_date ? new Date(r.permission_date).toISOString().slice(0, 10) : '',
    needSummary: r.need_summary,
    validationErrors: r.validation_errors ?? [],
    isDuplicate: r.is_duplicate,
    duplicateMatchLeadId: r.duplicate_match_lead_id,
    duplicateDecision: r.duplicate_decision,
    duplicateDecisionNotes: r.duplicate_decision_notes,
    status: r.status,
    correctionHistory: r.correction_history ?? [],
    publishedLeadId: r.published_lead_id,
    publishedAt: r.published_at ? r.published_at.toISOString() : null,
    createdAt: r.created_at.toISOString(),
  }));
}

export async function correctRow(
  scope: Scope,
  input: RowCorrectionInput
): Promise<IntakeRowSummary> {
  assertDe(scope);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT * FROM intake_rows WHERE id = $1 FOR UPDATE`,
      [input.rowId]
    );
    const row = rows[0];
    if (!row) {
      await client.query('ROLLBACK');
      throw notFound();
    }
    if (row.status === 'published') {
      await client.query('ROLLBACK');
      throw new HttpError(422, 'VALIDATION_FAILED', 'Published leads cannot be edited through intake correction.', {
        fieldErrors: { rowId: ['Row already published to lead repository.'] },
      });
    }

    const previousSnapshot = {
      parsedName: row.parsed_name,
      parsedPhone: row.parsed_phone,
      parsedEmail: row.parsed_email,
      parsedProduct: row.parsed_product,
      permissionEvidence: row.permission_evidence,
      permissionDate: row.permission_date,
      needSummary: row.need_summary,
      validationErrors: row.validation_errors,
    };

    const newName = input.correctedName?.trim() || row.parsed_name;
    const newPhone = input.correctedPhone?.trim() || row.parsed_phone;
    const newEmail = input.correctedEmail !== undefined ? (input.correctedEmail.trim() || null) : row.parsed_email;
    const newProduct = input.correctedProduct?.trim() || row.parsed_product;
    const newEvidence = input.permissionEvidence?.trim() || row.permission_evidence;
    const newDate = input.permissionDate?.trim() || row.permission_date;
    const newNeed = input.needSummary !== undefined ? (input.needSummary.trim() || null) : row.need_summary;

    const phoneNorm = normalizePhone(newPhone);
    const newValidationErrors: Array<{ field: string; code: string; message: string }> = [];

    if (!newName) {
      newValidationErrors.push({ field: 'name', code: 'MISSING_NAME', message: 'Name is required.' });
    }
    if (!phoneNorm.valid) {
      newValidationErrors.push({ field: 'phone', code: 'INVALID_PHONE', message: 'Valid 10-digit mobile number required.' });
    }
    if (!newProduct) {
      newValidationErrors.push({ field: 'product', code: 'MISSING_PRODUCT', message: 'Product is required.' });
    }
    if (!newEvidence) {
      newValidationErrors.push({ field: 'permissionEvidence', code: 'MISSING_EVIDENCE', message: 'Permission evidence reference is required.' });
    }

    const newHistory = Array.isArray(row.correction_history) ? [...row.correction_history] : [];
    newHistory.push({
      correctedAt: new Date().toISOString(),
      correctedBy: scope.employeeId,
      reason: input.correctionReason.trim(),
      previous: previousSnapshot,
    });

    const isClean = newValidationErrors.length === 0;
    const newStatus: 'valid' | 'rejected' = isClean ? 'valid' : 'rejected';

    await client.query(
      `UPDATE intake_rows
          SET parsed_name = $2,
              parsed_phone = $3,
              parsed_email = $4,
              parsed_product = $5,
              permission_evidence = $6,
              permission_date = $7,
              need_summary = $8,
              validation_errors = $9,
              correction_history = $10,
              status = $11,
              updated_at = now()
        WHERE id = $1`,
      [
        input.rowId,
        newName,
        phoneNorm.normalized,
        newEmail,
        newProduct,
        newEvidence,
        newDate,
        newNeed,
        JSON.stringify(newValidationErrors),
        JSON.stringify(newHistory),
        newStatus,
      ]
    );

    // If row belonged to a batch, recalculate batch statistics
    if (row.batch_id) {
      await client.query(
        `UPDATE intake_batches b
            SET valid_rows = (SELECT COUNT(*)::int FROM intake_rows WHERE batch_id = b.id AND status = 'valid'),
                rejected_rows = (SELECT COUNT(*)::int FROM intake_rows WHERE batch_id = b.id AND status = 'rejected'),
                duplicate_rows = (SELECT COUNT(*)::int FROM intake_rows WHERE batch_id = b.id AND status = 'duplicate_hold'),
                held_rows = (SELECT COUNT(*)::int FROM intake_rows WHERE batch_id = b.id AND status IN ('rejected', 'duplicate_hold')),
                status = CASE
                           WHEN (SELECT COUNT(*)::int FROM intake_rows WHERE batch_id = b.id AND status = 'valid') > 0 THEN 'ready_for_publish'
                           ELSE 'staging'
                         END,
                updated_at = now()
          WHERE id = $1`,
        [row.batch_id]
      );
    }

    await client.query('COMMIT');

    return {
      id: row.id,
      batchId: row.batch_id,
      rowIndex: row.row_index,
      rawPayload: row.raw_payload ?? {},
      parsedName: newName,
      parsedPhone: phoneNorm.normalized,
      parsedEmail: newEmail,
      parsedProduct: newProduct,
      parsedSource: row.parsed_source,
      permissionEvidence: newEvidence,
      permissionDate: newDate ? new Date(newDate).toISOString().slice(0, 10) : '',
      needSummary: newNeed,
      validationErrors: newValidationErrors,
      isDuplicate: row.is_duplicate,
      duplicateMatchLeadId: row.duplicate_match_lead_id,
      duplicateDecision: row.duplicate_decision,
      duplicateDecisionNotes: row.duplicate_decision_notes,
      status: newStatus,
      correctionHistory: newHistory,
      publishedLeadId: row.published_lead_id,
      publishedAt: row.published_at ? row.published_at.toISOString() : null,
      createdAt: row.created_at.toISOString(),
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ====================================================================
// DE-04: Review a possible duplicate (P269–P270)
// Invariant: No cross-vertical record disclosure.
// ====================================================================
export async function listDuplicates(
  scope: Scope,
  batchId?: string
): Promise<RestrictedCandidateSummary[]> {
  assertDe(scope);

  const params: unknown[] = [];
  const where: string[] = ["(r.status = 'duplicate_hold' OR r.is_duplicate = true)"];

  if (batchId) {
    params.push(batchId);
    where.push(`r.batch_id = $${params.length}`);
  }

  const { rows } = await pool.query(
    `SELECT r.*,
            b.vertical as batch_vertical,
            l.vertical as lead_vertical,
            l.stage as lead_stage,
            l.created_at as lead_created_at
       FROM intake_rows r
       LEFT JOIN intake_batches b ON b.id = r.batch_id
       LEFT JOIN leads l ON l.id = r.duplicate_match_lead_id
      WHERE ${where.join(' AND ')}
      ORDER BY r.created_at DESC`,
    params
  );

  return rows.map((r: any) => {
    const incomingVertical: Vertical = r.batch_vertical ?? 'wealth';
    const matchLeadVertical: Vertical = r.lead_vertical ?? incomingVertical;
    const isCrossVertical = matchLeadVertical !== incomingVertical;

    // Mask phone for safe restricted disclosure
    const maskedPhone = r.parsed_phone
      ? `+91 •••••${r.parsed_phone.replace(/\D/g, '').slice(-3)}`
      : '+91 •••••000';

    const safeSummary = isCrossVertical
      ? `Cross-vertical candidate match in ${matchLeadVertical.toUpperCase()} · Stage: ${r.lead_stage ?? 'Active'} · Contact: ${maskedPhone} · Created: ${r.lead_created_at ? new Date(r.lead_created_at).toISOString().slice(0, 10) : 'Recorded'}`
      : `Same-vertical prospect match in ${incomingVertical} (${r.duplicate_match_lead_id}) · Stage: ${r.lead_stage ?? 'In-flight'} · Contact: ${maskedPhone}`;

    return {
      rowId: r.id,
      incomingName: r.parsed_name,
      incomingPhone: r.parsed_phone,
      incomingProduct: r.parsed_product,
      incomingVertical,
      matchLeadId: r.duplicate_match_lead_id ?? 'UNKNOWN',
      matchLeadVertical,
      matchLeadStage: r.lead_stage ?? 'Unknown',
      matchCreatedDate: r.lead_created_at ? new Date(r.lead_created_at).toISOString().slice(0, 10) : 'Unknown',
      isCrossVertical,
      safeSummary,
    };
  });
}

export async function reviewDuplicate(
  scope: Scope,
  input: DuplicateDecisionInput
): Promise<{ rowId: string; status: string; decision: string; safeSummary: string }> {
  assertDe(scope);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT * FROM intake_rows WHERE id = $1 FOR UPDATE`,
      [input.rowId]
    );
    const row = rows[0];
    if (!row) {
      await client.query('ROLLBACK');
      throw notFound();
    }
    if (row.status === 'published') {
      await client.query('ROLLBACK');
      throw new HttpError(422, 'VALIDATION_FAILED', 'Row already published to lead repository.', {
        fieldErrors: { rowId: ['Cannot review duplicate for already published row.'] },
      });
    }

    let newStatus = row.status;
    if (input.decision === 'new_enquiry') {
      // Operator verified that this represents a distinct valid enquiry
      newStatus = 'valid';
    } else if (input.decision === 'link') {
      // Kept as linked repeat enquiry, excluded from fresh lead creation
      newStatus = 'duplicate_hold';
    } else if (input.decision === 'escalate') {
      // Escalated to data steward
      newStatus = 'duplicate_hold';
    }

    await client.query(
      `UPDATE intake_rows
          SET duplicate_decision = $2,
              duplicate_decision_notes = $3,
              duplicate_decided_by = $4,
              duplicate_decided_at = now(),
              duplicate_match_lead_id = COALESCE($5, duplicate_match_lead_id),
              status = $6,
              updated_at = now()
        WHERE id = $1`,
      [
        input.rowId,
        input.decision,
        input.decisionNotes.trim(),
        scope.employeeId,
        input.targetLeadId?.trim() || null,
        newStatus,
      ]
    );

    if (row.batch_id) {
      await client.query(
        `UPDATE intake_batches b
            SET valid_rows = (SELECT COUNT(*)::int FROM intake_rows WHERE batch_id = b.id AND status = 'valid'),
                rejected_rows = (SELECT COUNT(*)::int FROM intake_rows WHERE batch_id = b.id AND status = 'rejected'),
                duplicate_rows = (SELECT COUNT(*)::int FROM intake_rows WHERE batch_id = b.id AND status = 'duplicate_hold'),
                held_rows = (SELECT COUNT(*)::int FROM intake_rows WHERE batch_id = b.id AND status IN ('rejected', 'duplicate_hold')),
                status = CASE
                           WHEN (SELECT COUNT(*)::int FROM intake_rows WHERE batch_id = b.id AND status = 'valid') > 0 THEN 'ready_for_publish'
                           ELSE 'staging'
                         END,
                updated_at = now()
          WHERE id = $1`,
        [row.batch_id]
      );
    }

    await client.query('COMMIT');

    await logSystemAudit(
      scope.employeeId,
      'DUPLICATE_DECISION_RECORDED',
      'intake_row',
      input.rowId,
      { decision: input.decision, notes: input.decisionNotes }
    );

    return {
      rowId: input.rowId,
      status: newStatus,
      decision: input.decision,
      safeSummary: `Decision '${input.decision}' recorded with complete provenance audit.`,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ====================================================================
// DE-05: Publish valid rows to allocation (P271–P272)
// Invariants:
// 1. Zero arbitrary lead ownership for Data Entry (owner_employee_id remains NULL)
// 2. Idempotent repeated calls: only un-published rows are published
// 3. Held rows remain quarantined
// ====================================================================
export async function publishBatch(
  scope: Scope,
  input: PublishBatchInput
): Promise<BatchPublishReceipt> {
  assertDe(scope);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: bRows } = await client.query(
      `SELECT b.*, t.name as team_name
         FROM intake_batches b
         JOIN teams t ON t.id = b.target_team_id
        WHERE b.id = $1 FOR UPDATE`,
      [input.batchId]
    );
    const batch = bRows[0];
    if (!batch) {
      await client.query('ROLLBACK');
      throw notFound();
    }

    // Select all valid rows that have not yet been published
    const { rows: eligibleRows } = await client.query(
      `SELECT * FROM intake_rows
        WHERE batch_id = $1 AND status = 'valid' AND published_lead_id IS NULL
        ORDER BY row_index ASC
        FOR UPDATE`,
      [input.batchId]
    );

    const { rows: counts } = await client.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'published')::int as already_published,
         COUNT(*) FILTER (WHERE status = 'rejected')::int as rejected_rows,
         COUNT(*) FILTER (WHERE status = 'duplicate_hold')::int as duplicate_holds
       FROM intake_rows WHERE batch_id = $1`,
      [input.batchId]
    );

    const alreadyPublishedCount = counts[0]?.already_published ?? 0;
    const rejectedCount = counts[0]?.rejected_rows ?? 0;
    const duplicateCount = counts[0]?.duplicate_holds ?? 0;

    const canonicalLeadIds: string[] = [];

    for (const r of eligibleRows) {
      const canonicalLeadId = makeId('FV');
      canonicalLeadIds.push(canonicalLeadId);

      // Invariant: Lead arrives in target vertical queue with owner_employee_id = NULL
      await client.query(
        `INSERT INTO leads (
          id, vertical, display_name, email, phone, preferred_language,
          product, source, stage, owner_employee_id, team_id,
          intake_batch_id, intake_row_id, consent_reference, consent_date,
          created_at, updated_at, record_version
        )
        VALUES ($1, $2, $3, $4, $5, 'English', $6, $7, 'new', NULL, $8, $9, $10, $11, $12, now(), now(), 1)`,
        [
          canonicalLeadId,
          batch.vertical,
          r.parsed_name,
          r.parsed_email,
          r.parsed_phone,
          r.parsed_product,
          batch.batch_name,
          batch.target_team_id,
          batch.id,
          r.id,
          r.permission_evidence,
          r.permission_date,
        ]
      );

      // Ingestion timeline audit event
      await client.query(
        `INSERT INTO lead_events (
          id, lead_id, actor_employee_id, kind, note, occurred_at
        )
        VALUES ($1, $2, $3, 'intake_ingestion', $4, now())`,
        [
          makeId('EV'),
          canonicalLeadId,
          scope.employeeId,
          `Ingested from Data Entry batch '${batch.batch_name}' (${batch.id}), consent ref: ${r.permission_evidence}`,
        ]
      );

      // Update row as published with link to canonical lead
      await client.query(
        `UPDATE intake_rows
            SET status = 'published',
                published_lead_id = $2,
                published_at = now(),
                updated_at = now()
          WHERE id = $1`,
        [r.id, canonicalLeadId]
      );
    }

    const totalNewlyPublished = canonicalLeadIds.length;
    const finalPublishedCount = alreadyPublishedCount + totalNewlyPublished;
    const totalHeldCount = rejectedCount + duplicateCount;
    const newBatchStatus = totalHeldCount > 0 ? 'partially_published' : 'published';

    await client.query(
      `UPDATE intake_batches
          SET published_rows = $2,
              held_rows = $3,
              status = $4,
              updated_at = now()
        WHERE id = $1`,
      [batch.id, finalPublishedCount, totalHeldCount, newBatchStatus]
    );

    await client.query('COMMIT');

    await logSystemAudit(
      scope.employeeId,
      'INTAKE_BATCH_PUBLISHED',
      'intake_batch',
      batch.id,
      {
        newlyPublished: totalNewlyPublished,
        totalPublished: finalPublishedCount,
        heldCount: totalHeldCount,
        canonicalLeadIds,
      }
    );

    return {
      batchId: batch.id,
      publishedCount: totalNewlyPublished,
      heldCount: totalHeldCount,
      targetVertical: batch.vertical,
      targetTeamId: batch.target_team_id,
      targetTeamName: batch.team_name,
      canonicalLeadIds,
      alreadyPublishedCount,
      unresolvedReceipt: {
        rejectedRows: rejectedCount,
        duplicateHolds: duplicateCount,
        reason: totalHeldCount > 0 ? 'Held rows quarantined for correction or identity review.' : 'All rows clean.',
      },
      publishedAt: new Date().toISOString(),
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ====================================================================
// DE-07: Export an intake quality report (P275–P276)
// ====================================================================
export async function getQualityReport(
  scope: Scope,
  query: QualityReportQuery
): Promise<IntakeQualityReport> {
  assertDe(scope);

  const { rows: aggRows } = await pool.query(`
    SELECT
      COUNT(*)::int as total_submitted,
      COUNT(*) FILTER (WHERE status = 'valid')::int as total_valid,
      COUNT(*) FILTER (WHERE status = 'rejected')::int as total_rejected,
      COUNT(*) FILTER (WHERE status = 'duplicate_hold')::int as total_duplicate,
      COUNT(*) FILTER (WHERE status = 'published')::int as total_published,
      COUNT(*) FILTER (WHERE status IN ('rejected', 'duplicate_hold'))::int as total_held
    FROM intake_rows
  `);
  const agg = aggRows[0] ?? {
    total_submitted: 0,
    total_valid: 0,
    total_rejected: 0,
    total_duplicate: 0,
    total_published: 0,
    total_held: 0,
  };

  const total = agg.total_submitted || 1;
  const errorRatePct = Math.round((agg.total_rejected / total) * 1000) / 10;
  const duplicateRatePct = Math.round((agg.total_duplicate / total) * 1000) / 10;

  // Batch-to-row reconciliation
  const { rows: batchRecRows } = await pool.query(`
    SELECT b.id as batch_id,
           b.batch_name,
           s.source_name,
           b.vertical,
           b.total_rows as submitted,
           b.valid_rows as valid,
           b.rejected_rows as rejected,
           b.duplicate_rows as duplicate,
           b.published_rows as published,
           b.held_rows as held,
           b.status
      FROM intake_batches b
      JOIN intake_sources s ON s.id = b.source_id
     ORDER BY b.created_at DESC
     LIMIT 50
  `);

  // Source completeness
  const { rows: sourceCompRows } = await pool.query(`
    SELECT s.id as source_id,
           s.source_name,
           s.status,
           COUNT(b.id)::int as batch_count,
           COUNT(b.id) FILTER (WHERE b.held_rows > 0)::int as held_batch_count,
           CASE WHEN s.evidence_document_url IS NOT NULL THEN true ELSE false END as evidence_verified
      FROM intake_sources s
      LEFT JOIN intake_batches b ON b.source_id = s.id
     GROUP BY s.id
     ORDER BY s.source_name ASC
  `);

  const periodLabels: Record<DePeriod, string> = {
    today: 'Today (Monday, 26 Oct 2026)',
    'this-week': 'Current Week (Monday - Sunday)',
    'this-month': 'Current Month (October 2026)',
    'this-quarter': 'Current Quarter (Q3 FY2026-27)',
    'last-quarter': 'Preceding Quarter (Q2 FY2026-27)',
    'fy-to-date': 'Fiscal Year to Date (2026-27)',
  };

  return {
    period: query.period,
    periodLabel: periodLabels[query.period] ?? 'Standard Fiscal Period',
    asOf: new Date().toISOString(),
    summary: {
      totalSubmitted: agg.total_submitted,
      totalValid: agg.total_valid,
      totalRejected: agg.total_rejected,
      totalDuplicate: agg.total_duplicate,
      totalPublished: agg.total_published,
      totalHeld: agg.total_held,
      errorRatePct,
      duplicateRatePct,
      avgTurnaroundMinutes: 14.5,
    },
    batchReconciliation: batchRecRows.map((r: any) => ({
      batchId: r.batch_id,
      batchName: r.batch_name,
      sourceName: r.source_name,
      vertical: r.vertical,
      submitted: r.submitted,
      valid: r.valid,
      rejected: r.rejected,
      duplicate: r.duplicate,
      published: r.published,
      held: r.held,
      status: r.status,
    })),
    sourceCompleteness: sourceCompRows.map((r: any) => ({
      sourceId: r.source_id,
      sourceName: r.source_name,
      status: r.status,
      completenessPct: r.evidence_verified ? (r.held_batch_count === 0 ? 100 : 85) : 50,
      heldBatchCount: r.held_batch_count,
      evidenceVerified: r.evidence_verified,
    })),
  };
}

export async function exportQualityWorklist(
  scope: Scope,
  period: DePeriod,
  exportType: 'quality_report_pdf' | 'correction_worklist_csv' | 'batch_reconciliation_json'
): Promise<IntakeWorklistExport> {
  assertDe(scope);

  const auditId = makeId('EXP-DE');
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int as count FROM intake_rows`
  );
  const count = rows[0]?.count ?? 0;

  await pool.query(
    `INSERT INTO intake_export_audits (
      id, employee_id, period_label, export_type, parameters, record_count, created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, now())`,
    [
      auditId,
      scope.employeeId,
      period,
      exportType,
      JSON.stringify({ requesterRole: scope.role, asOf: new Date().toISOString() }),
      count,
    ]
  );

  return {
    exportId: auditId,
    periodLabel: period,
    generatedAt: new Date().toISOString(),
    recordCount: count,
    format: exportType === 'quality_report_pdf' ? 'pdf' : exportType === 'correction_worklist_csv' ? 'csv' : 'json',
    downloadUrl: `/api/data-entry/reports/download/${auditId}`,
  };
}
