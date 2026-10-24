import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { DocumentRecord, DocumentRequestInput, DocumentRequestRecord } from '@finverse/contracts';
import { eq, and, or, inArray, desc, sql } from 'drizzle-orm';
import { db } from './db';
import { documents, documentRequests, leads, leadEvents } from '../db/schema';
import type { Scope } from './users';
import { forbidden, notFound, HttpError } from '../lib/errors';
import { requireLeadForWrite, attributionFor } from '../wealth/scope';

const UPLOAD_ROOT = resolve(__dirname, '../../../.uploads');
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'text/plain'];

function id(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

async function ownedLead(scope: Scope, leadId: string): Promise<any> {
  const [lead] = await db
    .select()
    .from(leads)
    .where(
      and(
        eq(leads.id, leadId),
        inArray(leads.vertical, scope.verticals),
        or(
          eq(leads.ownerEmployeeId, scope.employeeId),
          inArray(leads.teamId, scope.teams)
        )
      )
    );
  if (!lead) throw notFound();
  return lead;
}

export async function createDocumentRequest(scope: Scope, leadId: string, input: DocumentRequestInput): Promise<DocumentRequestRecord> {
  const lead = await ownedLead(scope, leadId);
  if (lead.ownerEmployeeId !== scope.employeeId) throw forbidden('Only the current owner can request documents.');
  const reqId = id('DOCREQ');
  const token = id('UPL');
  const expiresAt = new Date(Date.now() + 7 * 86_400_000);

  const [r] = await db
    .insert(documentRequests)
    .values({
      id: reqId,
      leadId,
      actorEmployeeId: scope.employeeId,
      checklist: input.checklist,
      requestedFiles: input.requestedFiles,
      uploadToken: token,
      expiresAt: expiresAt.toISOString(),
      dueAt: new Date(input.dueAt).toISOString(),
      reminderEnabled: input.reminderEnabled,
      status: 'open',
    })
    .returning();

  await db.insert(leadEvents).values({
    id: id('EVT'),
    leadId,
    actorEmployeeId: scope.employeeId,
    kind: 'note',
    note: `Document request created (${input.checklist}): ${input.requestedFiles.join(', ')}. Secure upload link expires ${expiresAt.toUTCString()}.`,
    actorRole: scope.role,
    actorTeamId: scope.teams[0] ?? null,
    assignmentId: scope.assignmentId,
  });

  return docRequestView(r);
}

function docRequestView(r: any): DocumentRequestRecord {
  return {
    id: r.id,
    leadId: r.leadId ?? r.lead_id,
    checklist: r.checklist,
    requestedFiles: r.requestedFiles ?? r.requested_files,
    uploadToken: r.uploadToken ?? r.upload_token,
    expiresAt: new Date(r.expiresAt ?? r.expires_at).toISOString(),
    dueAt: new Date(r.dueAt ?? r.due_at).toISOString(),
    status: r.status,
  };
}

export async function listDocumentRequests(scope: Scope, leadId: string): Promise<DocumentRequestRecord[]> {
  await ownedLead(scope, leadId);
  const rows = await db
    .select()
    .from(documentRequests)
    .where(eq(documentRequests.leadId, leadId))
    .orderBy(desc(documentRequests.createdAt));
  return rows.map(docRequestView);
}

export async function rotateUploadToken(scope: Scope, requestId: string): Promise<DocumentRequestRecord> {
  const [row] = await db
    .update(documentRequests)
    .set({
      uploadToken: id('UPL'),
      expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    })
    .where(and(eq(documentRequests.id, requestId), eq(documentRequests.actorEmployeeId, scope.employeeId)))
    .returning();
  if (!row) throw notFound();
  return docRequestView(row);
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
    const [req] = await db
      .select({ id: documentRequests.id })
      .from(documentRequests)
      .where(and(eq(documentRequests.id, input.requestId), eq(documentRequests.leadId, input.leadId)));
    if (!req) {
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

  const [versionRow] = await db
    .select({ v: sql<number>`COALESCE(MAX(${documents.version}), 0)` })
    .from(documents)
    .where(and(eq(documents.leadId, input.leadId), eq(documents.documentType, input.documentType)));
  const version = Number(versionRow?.v ?? 0) + 1;

  const [doc] = await db
    .insert(documents)
    .values({
      id: docId,
      leadId: input.leadId,
      requestId: input.requestId ?? null,
      uploadedBy: scope.employeeId,
      documentType: input.documentType,
      filename: input.filename,
      storagePath: relPath,
      mimeType: input.mimeType,
      sizeBytes: bytes.length,
      version,
      scanStatus,
      validationStatus: 'pending',
    })
    .returning();

  if (scanStatus === 'clean') {
    await db.update(documents).set({ scanStatus: 'clean' }).where(eq(documents.id, docId));
  }
  const [actorRole, actorTeam, actorAssignment] = attributionFor(scope, lead.team_id ?? (lead as any).teamId);
  await db.insert(leadEvents).values({
    id: id('EVT'),
    leadId: input.leadId,
    actorEmployeeId: scope.employeeId,
    kind: 'note',
    note: `Document uploaded: ${input.filename} (${input.documentType}, v${version}, scan: ${scanStatus}, validation: pending — uploaded evidence is not verified evidence).`,
    actorRole,
    actorTeamId: actorTeam,
    assignmentId: actorAssignment,
  });
  return docView(doc);
}

function docView(r: any): DocumentRecord {
  return {
    id: r.id,
    leadId: r.leadId ?? r.lead_id,
    documentType: r.documentType ?? r.document_type,
    filename: r.filename,
    mimeType: r.mimeType ?? r.mime_type,
    sizeBytes: r.sizeBytes ?? r.size_bytes,
    version: r.version,
    scanStatus: r.scanStatus ?? r.scan_status,
    validationStatus: r.validationStatus ?? r.validation_status,
    rejectReason: r.rejectReason ?? r.reject_reason,
    createdAt: new Date(r.createdAt ?? r.created_at).toISOString(),
  };
}

export async function listDocuments(scope: Scope, leadId: string): Promise<DocumentRecord[]> {
  await ownedLead(scope, leadId);
  const rows = await db
    .select()
    .from(documents)
    .where(eq(documents.leadId, leadId))
    .orderBy(desc(documents.createdAt));
  return rows.map(docView);
}

export async function downloadDocument(scope: Scope, documentId: string): Promise<{ filename: string; mimeType: string; bytes: Buffer }> {
  const [row] = await db
    .select({
      filename: documents.filename,
      mimeType: documents.mimeType,
      storagePath: documents.storagePath,
      scanStatus: documents.scanStatus,
      vertical: leads.vertical,
      ownerEmployeeId: leads.ownerEmployeeId,
      teamId: leads.teamId,
    })
    .from(documents)
    .innerJoin(leads, eq(leads.id, documents.leadId))
    .where(eq(documents.id, documentId));

  if (!row) throw notFound();
  const inScope =
    row.vertical && scope.verticals.includes(row.vertical) &&
    (row.ownerEmployeeId === scope.employeeId || (row.teamId && scope.teams.includes(row.teamId)));
  if (!inScope) throw notFound();
  if (row.scanStatus === 'quarantined') throw forbidden('This file is quarantined and unavailable.');
  const absPath = resolve(UPLOAD_ROOT, row.storagePath);
  if (!existsSync(absPath)) throw notFound();
  return { filename: row.filename, mimeType: row.mimeType, bytes: readFileSync(absPath) };
}

export async function reviewDocument(scope: Scope, documentId: string, accept: boolean, reason?: string) {
  if (scope.role !== 'TL') throw forbidden('Only an authorized reviewer can validate evidence.');
  const [row] = await db
    .select({
      teamId: leads.teamId,
    })
    .from(documents)
    .innerJoin(leads, eq(leads.id, documents.leadId))
    .where(eq(documents.id, documentId));

  if (!row || !row.teamId || !scope.teams.includes(row.teamId)) throw notFound();
  await db
    .update(documents)
    .set({
      validationStatus: accept ? 'accepted' : 'rejected',
      rejectReason: accept ? null : reason ?? 'Not acceptable',
    })
    .where(eq(documents.id, documentId));
  return { ok: true, validationStatus: accept ? 'accepted' : 'rejected' };
}
