import type {
  BatchPublishReceipt,
  BatchUploadInput,
  BulkImportJobStatusResponse,
  BulkImportJobSummary,
  BulkImportRowRecord,
  CreateBulkImportJobInput,
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
  ManualProspectInput,
  ManualProspectRecord,
  RowCorrectionInput,
  SourceEvidenceInput,
} from '@finverse/contracts';

export async function createBulkImportJob(input: CreateBulkImportJobInput): Promise<BulkImportJobSummary> {
  return request<BulkImportJobSummary>('/api/data-entry/bulk-import/jobs', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getBulkImportJob(jobId: string): Promise<BulkImportJobStatusResponse> {
  return request<BulkImportJobStatusResponse>(`/api/data-entry/bulk-import/jobs/${encodeURIComponent(jobId)}`);
}

export async function getBulkImportRows(
  jobId: string,
  query: { status?: string; limit?: number; offset?: number } = {}
): Promise<{ rows: BulkImportRowRecord[]; total: number }> {
  const params = new URLSearchParams();
  if (query.status) params.set('status', query.status);
  if (query.limit) params.set('limit', String(query.limit));
  if (query.offset) params.set('offset', String(query.offset));
  const qs = params.toString() ? `?${params.toString()}` : '';
  return request<{ rows: BulkImportRowRecord[]; total: number }>(
    `/api/data-entry/bulk-import/jobs/${encodeURIComponent(jobId)}/rows${qs}`
  );
}

export async function processImportJobChunk(jobId: string, chunkSize = 500): Promise<BulkImportJobSummary> {
  return request<BulkImportJobSummary>(`/api/data-entry/bulk-import/jobs/${encodeURIComponent(jobId)}/process-chunk`, {
    method: 'POST',
    body: JSON.stringify({ chunkSize }),
  });
}

export function getBulkImportReportUrl(jobId: string): string {
  return `/api/data-entry/bulk-import/jobs/${encodeURIComponent(jobId)}/report`;
}

export async function saveManualProspect(input: ManualProspectInput): Promise<ManualProspectRecord> {
  return request<ManualProspectRecord>('/api/data-entry/manual-records', {
    method: 'POST', body: JSON.stringify(input),
  });
}

export async function listManualProspects(search?: string): Promise<ManualProspectRecord[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  const response = await request<{ records: ManualProspectRecord[] }>(`/api/data-entry/manual-records${query}`);
  return response.records;
}

export async function getManualProspect(id: string): Promise<ManualProspectRecord> {
  return request<ManualProspectRecord>(`/api/data-entry/manual-records/${encodeURIComponent(id)}`);
}

export async function publishManualProspect(id: string, preferredTeamId?: string): Promise<ManualProspectRecord> {
  return request<ManualProspectRecord>(`/api/data-entry/manual-records/${encodeURIComponent(id)}/publish`, {
    method: 'POST',
    body: JSON.stringify({ preferredTeamId }),
  });
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const contentType = res.headers.get('content-type') || '';
  let data: any = null;
  if (contentType.includes('application/json')) {
    data = await res.json();
  }

  if (!res.ok) {
    const error = data?.error || {
      code: 'REQUEST_FAILED',
      message: res.statusText || 'An unexpected error occurred.',
    };
    const err = new Error(error.message) as any;
    err.status = res.status;
    err.code = error.code;
    err.details = error.details;
    throw err;
  }

  return data as T;
}

// DE-06: Sources Register
export async function fetchSources(): Promise<IntakeSourceSummary[]> {
  const res = await request<{ sources: IntakeSourceSummary[] }>('/api/data-entry/sources');
  return res.sources;
}

export async function createSource(input: SourceEvidenceInput): Promise<IntakeSourceSummary> {
  return request<IntakeSourceSummary>('/api/data-entry/sources', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateSource(id: string, input: SourceEvidenceInput): Promise<IntakeSourceSummary> {
  return request<IntakeSourceSummary>(`/api/data-entry/sources/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

// DE-01: Capture single enquiry
export async function captureEnquiry(input: EnquiryCaptureInput): Promise<IntakeEnquiryReceipt> {
  return request<IntakeEnquiryReceipt>('/api/data-entry/enquiries', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// DE-02: Batches & Upload
export async function fetchBatches(vertical?: string): Promise<IntakeBatchSummary[]> {
  const q = vertical ? `?vertical=${encodeURIComponent(vertical)}` : '';
  const res = await request<{ batches: IntakeBatchSummary[] }>(`/api/data-entry/batches${q}`);
  return res.batches;
}

export async function fetchBatchDetails(batchId: string): Promise<{
  batch: IntakeBatchSummary;
  rows: IntakeRowSummary[];
}> {
  return request<{ batch: IntakeBatchSummary; rows: IntakeRowSummary[] }>(
    `/api/data-entry/batches/${encodeURIComponent(batchId)}`
  );
}

export async function uploadBatch(input: BatchUploadInput): Promise<IntakeBatchSummary> {
  return request<IntakeBatchSummary>('/api/data-entry/batches/upload', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// DE-03: Correct rejected rows
export async function fetchRejectedRows(batchId?: string, errorReason?: string): Promise<IntakeRowSummary[]> {
  const params = new URLSearchParams();
  if (batchId) params.set('batchId', batchId);
  if (errorReason) params.set('errorReason', errorReason);
  const q = params.toString() ? `?${params.toString()}` : '';
  const res = await request<{ rows: IntakeRowSummary[] }>(`/api/data-entry/rejected-rows${q}`);
  return res.rows;
}

export async function correctRejectedRow(rowId: string, input: RowCorrectionInput): Promise<IntakeRowSummary> {
  return request<IntakeRowSummary>(`/api/data-entry/rejected-rows/${encodeURIComponent(rowId)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

// DE-04: Review duplicates
export async function fetchDuplicates(batchId?: string): Promise<DuplicateCandidateSummary[]> {
  const q = batchId ? `?batchId=${encodeURIComponent(batchId)}` : '';
  const res = await request<{ duplicates: DuplicateCandidateSummary[] }>(`/api/data-entry/duplicates${q}`);
  return res.duplicates;
}

export async function submitDuplicateDecision(
  rowId: string,
  input: DuplicateDecisionInput
): Promise<{ rowId: string; status: string; decision: string; safeSummary: string }> {
  return request<{ rowId: string; status: string; decision: string; safeSummary: string }>(
    `/api/data-entry/duplicates/${encodeURIComponent(rowId)}/decision`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    }
  );
}

// DE-05: Publish batches
export async function publishBatch(batchId: string): Promise<BatchPublishReceipt> {
  return request<BatchPublishReceipt>(`/api/data-entry/batches/${encodeURIComponent(batchId)}/publish`, {
    method: 'POST',
    body: JSON.stringify({ batchId }),
  });
}

// DE-07: Quality reports & exports
export async function fetchQualityReport(
  period: DePeriod = 'this-month',
  sourceId?: string,
  vertical?: string
): Promise<IntakeQualityReport> {
  const params = new URLSearchParams();
  params.set('period', period);
  if (sourceId) params.set('sourceId', sourceId);
  if (vertical) params.set('vertical', vertical);
  return request<IntakeQualityReport>(`/api/data-entry/reports/quality?${params.toString()}`);
}

export async function exportQualityReport(
  period: DePeriod = 'this-month',
  exportType: 'quality_report_pdf' | 'correction_worklist_csv' | 'batch_reconciliation_json' = 'quality_report_pdf'
): Promise<IntakeWorklistExport> {
  return request<IntakeWorklistExport>('/api/data-entry/reports/export', {
    method: 'POST',
    body: JSON.stringify({ period, exportType }),
  });
}
