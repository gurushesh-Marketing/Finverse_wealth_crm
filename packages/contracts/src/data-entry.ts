import { z } from 'zod';
import { VERTICALS, type Vertical } from './index';

// ====================================================================
// DE-01: Capture a source-backed enquiry (P263–P264)
// ====================================================================
export const enquiryCaptureSchema = z.object({
  prospectName: z.string().trim().min(2, 'Name must be at least 2 characters.').max(120),
  phone: z.string().trim().min(10, 'Enter a valid phone number.').max(18),
  email: z.string().trim().email('Invalid email address.').optional().or(z.literal('')),
  vertical: z.enum(VERTICALS),
  targetTeamId: z.string().trim().min(2, 'Select a target frontline team.'),
  product: z.string().trim().min(2, 'Product is required.').max(120),
  sourceId: z.string().trim().min(2, 'Select an authorized intake source.'),
  permissionEvidence: z.string().trim().min(3, 'Consent/permission evidence reference is required.').max(500),
  permissionDate: z.string().trim().min(8, 'Permission date is required.'),
  needSummary: z.string().trim().max(500).optional(),
});
export type EnquiryCaptureInput = z.infer<typeof enquiryCaptureSchema>;

export interface IntakeEnquiryReceipt {
  id: string;
  rowId: string;
  batchId?: string;
  status: 'valid' | 'rejected' | 'duplicate_hold' | 'published';
  prospectName: string;
  phone: string;
  vertical: Vertical;
  product: string;
  validationErrors: Array<{ field: string; code: string; message: string }>;
  isDuplicate: boolean;
  duplicateMatchLeadId?: string;
  canonicalLeadId?: string;
  createdAt: string;
}

// ====================================================================
// DE-02: Upload and map a data file (P265–P266)
// ====================================================================
export const batchUploadSchema = z.object({
  batchName: z.string().trim().min(3, 'Batch name must be at least 3 characters.').max(120),
  sourceId: z.string().trim().min(2, 'Select an authorized intake source.'),
  vertical: z.enum(VERTICALS),
  targetTeamId: z.string().trim().min(2, 'Select a target destination team.'),
  fileName: z.string().trim().min(1, 'File name is required.').max(120),
  csvContent: z.string().min(1, 'CSV content or file payload is required.'),
  columnMapping: z.record(z.string()).optional(),
  notes: z.string().trim().max(500).optional(),
});
export type BatchUploadInput = z.infer<typeof batchUploadSchema>;

export interface IntakeBatchSummary {
  id: string;
  batchName: string;
  sourceId: string;
  sourceName: string;
  vertical: Vertical;
  targetTeamId: string;
  teamName: string;
  uploadedByEmployeeId: string;
  uploadedByName: string;
  fileName: string;
  fileHash: string;
  columnMapping: Record<string, string>;
  totalRows: number;
  validRows: number;
  rejectedRows: number;
  duplicateRows: number;
  publishedRows: number;
  heldRows: number;
  status: 'staging' | 'validating' | 'ready_for_publish' | 'partially_published' | 'published' | 'archived';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IntakeRowSummary {
  id: string;
  batchId: string | null;
  rowIndex: number;
  rawPayload: Record<string, unknown>;
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
  duplicateDecision: 'pending' | 'linked' | 'new_enquiry' | 'escalated' | null;
  duplicateDecisionNotes: string | null;
  status: 'staged' | 'valid' | 'rejected' | 'duplicate_hold' | 'published' | 'archived';
  correctionHistory: Array<{
    correctedAt: string;
    correctedBy: string;
    reason: string;
    previous: Record<string, unknown>;
  }>;
  publishedLeadId: string | null;
  publishedAt: string | null;
  createdAt: string;
}

// ====================================================================
// DE-03: Correct rejected intake rows (P267–P268)
// ====================================================================
export const rowCorrectionSchema = z.object({
  rowId: z.string().trim().min(2, 'Row ID is required.'),
  correctedName: z.string().trim().min(2).max(120).optional(),
  correctedPhone: z.string().trim().min(10).max(18).optional(),
  correctedEmail: z.string().trim().email().optional().or(z.literal('')),
  correctedProduct: z.string().trim().min(2).max(120).optional(),
  permissionEvidence: z.string().trim().min(3).max(500).optional(),
  permissionDate: z.string().trim().min(8).optional(),
  needSummary: z.string().trim().max(500).optional(),
  correctionReason: z.string().trim().min(3, 'Correction reason with source evidence is required.').max(500),
});
export type RowCorrectionInput = z.infer<typeof rowCorrectionSchema>;

// ====================================================================
// DE-04: Review a possible duplicate (P269–P270)
// ====================================================================
export const duplicateDecisionSchema = z.object({
  rowId: z.string().trim().min(2, 'Row ID is required.'),
  decision: z.enum(['link', 'new_enquiry', 'escalate']),
  decisionNotes: z.string().trim().min(3, 'Review rationale is required.').max(500),
  targetLeadId: z.string().trim().min(2).optional(),
});
export type DuplicateDecisionInput = z.infer<typeof duplicateDecisionSchema>;

export interface RestrictedCandidateSummary {
  rowId: string;
  incomingName: string;
  incomingPhone: string;
  incomingProduct: string;
  incomingVertical: Vertical;
  matchLeadId: string;
  matchLeadVertical: Vertical;
  matchLeadStage: string;
  matchCreatedDate: string;
  isCrossVertical: boolean;
  /** Restricted summary safe for display without cross-vertical sensitive data disclosure */
  safeSummary: string;
}
export type DuplicateCandidateSummary = RestrictedCandidateSummary;

// ====================================================================
// DE-05: Publish valid rows to allocation (P271–P272)
// ====================================================================
export const publishBatchSchema = z.object({
  batchId: z.string().trim().min(2, 'Batch ID is required.'),
  idempotencyKey: z.string().trim().min(4).optional(),
});
export type PublishBatchInput = z.infer<typeof publishBatchSchema>;

export interface BatchPublishReceipt {
  batchId: string;
  publishedCount: number;
  heldCount: number;
  targetVertical: Vertical;
  targetTeamId: string;
  targetTeamName: string;
  canonicalLeadIds: string[];
  alreadyPublishedCount: number;
  unresolvedReceipt: {
    rejectedRows: number;
    duplicateHolds: number;
    reason: string;
  };
  publishedAt: string;
}

// ====================================================================
// DE-06: Maintain source evidence and contact provenance (P273–P274)
// ====================================================================
export const sourceEvidenceSchema = z.object({
  sourceCode: z.string().trim().min(2, 'Source code is required.').max(40),
  sourceName: z.string().trim().min(2, 'Source name is required.').max(120),
  vendorName: z.string().trim().max(120).optional(),
  collectionBasis: z.string().trim().min(3, 'Collection basis is required.').max(300),
  evidenceDocumentUrl: z.string().trim().max(300).optional().or(z.literal('')),
  effectiveFrom: z.string().trim().min(8, 'Effective from date is required.'),
  effectiveTo: z.string().trim().max(40).optional().or(z.literal('')),
  permittedVerticals: z.array(z.enum(VERTICALS)).min(1, 'Select at least one permitted vertical.'),
  permittedProducts: z.array(z.string().trim()).default([]),
  status: z.enum(['active', 'under_review', 'suspended']),
  notes: z.string().trim().max(500).optional(),
});
export type SourceEvidenceInput = z.infer<typeof sourceEvidenceSchema>;

export interface IntakeSourceSummary {
  id: string;
  sourceCode: string;
  sourceName: string;
  vendorName?: string;
  collectionBasis: string;
  evidenceDocumentUrl?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  permittedVerticals: Vertical[];
  permittedProducts: string[];
  status: 'active' | 'under_review' | 'suspended';
  notes?: string;
  totalBatches: number;
  totalRows: number;
  createdAt: string;
}

// ====================================================================
// DE-07: Export an intake quality report (P275–P276)
// ====================================================================
export const DE_PERIODS = [
  'today',
  'this-week',
  'this-month',
  'this-quarter',
  'last-quarter',
  'fy-to-date',
] as const;
export type DePeriod = (typeof DE_PERIODS)[number];

export const qualityReportQuerySchema = z.object({
  period: z.enum(DE_PERIODS).default('this-month'),
  sourceId: z.string().trim().optional(),
  vertical: z.enum(VERTICALS).optional(),
});
export type QualityReportQuery = z.infer<typeof qualityReportQuerySchema>;

export interface IntakeQualityReport {
  period: DePeriod;
  periodLabel: string;
  asOf: string;
  summary: {
    totalSubmitted: number;
    totalValid: number;
    totalRejected: number;
    totalDuplicate: number;
    totalPublished: number;
    totalHeld: number;
    errorRatePct: number;
    duplicateRatePct: number;
    avgTurnaroundMinutes: number;
  };
  batchReconciliation: Array<{
    batchId: string;
    batchName: string;
    sourceName: string;
    vertical: Vertical;
    submitted: number;
    valid: number;
    rejected: number;
    duplicate: number;
    published: number;
    held: number;
    status: string;
  }>;
  sourceCompleteness: Array<{
    sourceId: string;
    sourceName: string;
    status: 'active' | 'under_review' | 'suspended';
    completenessPct: number;
    heldBatchCount: number;
    evidenceVerified: boolean;
  }>;
}

export interface IntakeWorklistExport {
  exportId: string;
  periodLabel: string;
  generatedAt: string;
  recordCount: number;
  format: 'json' | 'csv' | 'pdf';
  downloadUrl: string;
}
