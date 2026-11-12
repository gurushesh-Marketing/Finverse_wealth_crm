import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { DocumentRecord, DocumentRequestInput, DocumentRequestRecord } from '@finverse/contracts';
import { pool } from './db';
import type { Scope } from './users';
import { forbidden, notFound, HttpError } from '../lib/errors';
import { requireLeadForRead, requireLeadForWrite, attributionFor } from '../wealth/scope';

const UPLOAD_ROOT = resolve(__dirname, '../../../.uploads');
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'text/plain'];

function id(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

async function ownedLead(scope: Scope, leadId: string): Promise<any> {
  const { rows } = await pool.query(
    `SELECT l.* FROM leads l WHERE l.id = $1
       AND l.vertical = ANY($2) AND (l.owner_employee_id = $3 OR l.team_id = ANY($4))`,
    [leadId, scope.verticals, scope.employeeId, scope.teams]
  );
  if (!rows[0]) throw notFound();
  return rows[0];
}

export async function createDocumentRequest(scope: Scope, leadId: string, input: DocumentRequestInput): Promise<DocumentRequestRecord> {
  const lead = await ownedLead(scope, leadId);
  if (lead.owner_employee_id !== scope.employeeId) throw forbidden('Only the current owner can request documents.');
  const reqId = id('DOCREQ');
  const token = id('UPL');
  const expiresAt = new Date(Date.now() + 7 * 86_400_000);
  const { rows } = await pool.query(
    `INSERT INTO document_requests (id, lead_id, actor_employee_id, checklist, requested_files, upload_token, expires_at, due_at, reminder_enabled, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'open') RETURNING *`,
    [reqId, leadId, scope.employeeId, input.checklist, input.requestedFiles, token, expiresAt, new Date(input.dueAt), input.reminderEnabled]
  );
  await pool.query(
    `INSERT INTO lead_events (id, lead_id, actor_employee_id, kind, note, actor_role, actor_team_id, assignment_id)
     VALUES ($1, $2, $3, 'note', $4, $5, $6, $7)`,
    [id('EVT'), leadId, scope.employeeId, `Document request created (${input.checklist}): ${input.requestedFiles.join(', ')}. Secure upload link expires ${expiresAt.toUTCString()}.`, scope.role, scope.teams[0] ?? null, scope.assignmentId]
  );
  const r = rows[0];
  return docRequestView(r);
}

function docRequestView(r: any): DocumentRequestRecord {
  return {
    id: r.id,
    leadId: r.lead_id,
    checklist: r.checklist,
    requestedFiles: r.requested_files,
    uploadToken: r.upload_token,
    expiresAt: new Date(r.expires_at).toISOString(),
    dueAt: new Date(r.due_at).toISOString(),
    status: r.status,
  };
}

export async function listDocumentRequests(scope: Scope, leadId: string): Promise<DocumentRequestRecord[]> {
  await ownedLead(scope, leadId);
  const { rows } = await pool.query(`SELECT * FROM document_requests WHERE lead_id = $1 ORDER BY created_at DESC`, [leadId]);
  return rows.map(docRequestView);
}

export async function rotateUploadToken(scope: Scope, requestId: string): Promise<DocumentRequestRecord> {
  const { rows } = await pool.query(
    `UPDATE document_requests SET upload_token = $2, expires_at = $3
     WHERE id = $1 AND actor_employee_id = $4 RETURNING *`,
    [requestId, id('UPL'), new Date(Date.now() + 7 * 86_400_000), scope.employeeId]
  );
  if (!rows[0]) throw notFound();
  return docRequestView(rows[0]);
}

export interface UploadInput {
  leadId: string;
  requestId?: string;
  documentType: string;
  filename: string;
  mimeType: string;
  contentBase64: string;
}

export async function uploadDocument(scope: Scope, input: UploadInput): Promise<DocumentRecord> {
  const lead = await requireLeadForWrite(scope, input.leadId);
  if (input.requestId) {
    const { rows: reqRows } = await pool.query(
      `SELECT id FROM document_requests WHERE id = $1 AND lead_id = $2`,
      [input.requestId, input.leadId]
    );
    if (!reqRows[0]) {
      throw new HttpError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', {
        fieldErrors: { requestId: ['Request does not belong to this lead.'] },
      });
    }
  }
  const bytes = Buffer.from(input.contentBase64, 'base64');
  if (bytes.length === 0) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', {
      fieldErrors: { contentBase64: ['Upload a file.'] },
    });
  }
  if (bytes.length > MAX_BYTES) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', {
      fieldErrors: { contentBase64: ['File exceeds the 2 MB limit.'] },
    });
  }
  if (!ALLOWED_TYPES.includes(input.mimeType)) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', {
      fieldErrors: { mimeType: ['File type is not permitted (pdf/png/jpeg/txt).'] },
    });
  }
  // [ASSUMPTION] simulated scan: executable-looking names are quarantined, others are clean.
  const scanStatus = /\.(exe|bat|cmd|scr)$/i.test(input.filename) ? 'quarantined' : 'clean';
  const docId = id('DOC');
  const safeLead = input.leadId.replace(/[^A-Za-z0-9_-]/g, '_');
  const relPath = `${safeLead}/${docId}-${input.filename.replace(/[^A-Za-z0-9._-]/g, '_')}`;
  const absPath = resolve(UPLOAD_ROOT, relPath);
  if (!absPath.startsWith(UPLOAD_ROOT)) {
    throw new HttpError(422, 'VALIDATION_FAILED', 'Invalid file path.', {});
  }
  mkdirSync(dirname(absPath), { recursive: true });
  writeFileSync(absPath, bytes);

  const { rows: versionRows } = await pool.query(
    `SELECT COALESCE(MAX(version), 0) AS v FROM documents WHERE lead_id = $1 AND document_type = $2`,
    [input.leadId, input.documentType]
  );
  const version = Number(versionRows[0].v) + 1;
  const { rows } = await pool.query(
    `INSERT INTO documents (id, lead_id, request_id, uploaded_by, document_type, filename, storage_path, mime_type, size_bytes, version, scan_status, validation_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending') RETURNING *`,
    [docId, input.leadId, input.requestId ?? null, scope.employeeId, input.documentType, input.filename, relPath, input.mimeType, bytes.length, version, scanStatus]
  );
  if (scanStatus === 'clean') {
    await pool.query(`UPDATE documents SET scan_status = 'clean' WHERE id = $1`, [docId]);
  }
  if (lead.owner_employee_id !== scope.employeeId) {
    // uploader on behalf of customer allowed only for scope members; attribution preserved above
  }
  const [actorRole, actorTeam, actorAssignment] = attributionFor(scope, lead.team_id);
  await pool.query(
    `INSERT INTO lead_events (id, lead_id, actor_employee_id, kind, note, actor_role, actor_team_id, assignment_id)
     VALUES ($1, $2, $3, 'note', $4, $5, $6, $7)`,
    [id('EVT'), input.leadId, scope.employeeId, `Document uploaded: ${input.filename} (${input.documentType}, v${version}, scan: ${scanStatus}, validation: pending — uploaded evidence is not verified evidence).`, actorRole, actorTeam, actorAssignment]
  );
  return docView(rows[0]);
}

function docView(r: any): DocumentRecord {
  return {
    id: r.id,
    leadId: r.lead_id,
    documentType: r.document_type,
    filename: r.filename,
    mimeType: r.mime_type,
    sizeBytes: r.size_bytes,
    version: r.version,
    scanStatus: r.scan_status,
    validationStatus: r.validation_status,
    rejectReason: r.reject_reason,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

export async function listDocuments(scope: Scope, leadId: string): Promise<DocumentRecord[]> {
  await ownedLead(scope, leadId);
  const { rows } = await pool.query(`SELECT * FROM documents WHERE lead_id = $1 ORDER BY created_at DESC`, [leadId]);
  return rows.map(docView);
}

export async function downloadDocument(scope: Scope, documentId: string): Promise<{ filename: string; mimeType: string; bytes: Buffer }> {
  const { rows } = await pool.query(
    `SELECT d.*, l.vertical, l.owner_employee_id, l.team_id FROM documents d JOIN leads l ON l.id = d.lead_id WHERE d.id = $1`,
    [documentId]
  );
  const row = rows[0];
  if (!row) throw notFound();
  const inScope =
    row.vertical && scope.verticals.includes(row.vertical) &&
    (row.owner_employee_id === scope.employeeId || scope.teams.includes(row.team_id));
  if (!inScope) throw notFound();
  if (row.scan_status === 'quarantined') throw forbidden('This file is quarantined and unavailable.');
  const absPath = resolve(UPLOAD_ROOT, row.storage_path);
  if (!existsSync(absPath)) throw notFound();
  return { filename: row.filename, mimeType: row.mime_type, bytes: readFileSync(absPath) };
}

export async function reviewDocument(scope: Scope, documentId: string, accept: boolean, reason?: string) {
  // Caller cannot self-verify independent evidence; review is an authorized TL action.
  if (scope.role !== 'TL') throw forbidden('Only an authorized reviewer can validate evidence.');
  const { rows } = await pool.query(
    `SELECT d.*, l.team_id FROM documents d JOIN leads l ON l.id = d.lead_id WHERE d.id = $1`,
    [documentId]
  );
  const row = rows[0];
  if (!row || !scope.teams.includes(row.team_id)) throw notFound();
  await pool.query(
    `UPDATE documents SET validation_status = $2, reject_reason = $3 WHERE id = $1`,
    [documentId, accept ? 'accepted' : 'rejected', accept ? null : reason ?? 'Not acceptable']
  );
  return { ok: true, validationStatus: accept ? 'accepted' : 'rejected' };
}
