import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Database,
  Download,
  FilePlus2,
  FileSpreadsheet,
  FileText,
  Filter,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  Link as LinkIcon,
  ListChecks,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  UploadCloud,
  Users,
  X,
} from 'lucide-react';
import {
  captureEnquiry,
  correctRejectedRow,
  createSource,
  exportQualityReport,
  fetchBatchDetails,
  fetchBatches,
  fetchDuplicates,
  fetchQualityReport,
  fetchRejectedRows,
  fetchSources,
  publishBatch,
  submitDuplicateDecision,
  updateSource,
  uploadBatch,
} from '../lib/data-entry-api';
import type {
  BatchPublishReceipt,
  DePeriod,
  DuplicateCandidateSummary,
  EnquiryCaptureInput,
  IntakeBatchSummary,
  IntakeEnquiryReceipt,
  IntakeQualityReport,
  IntakeRowSummary,
  IntakeSourceSummary,
  IntakeWorklistExport,
  SourceEvidenceInput,
  Vertical,
} from '@finverse/contracts';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input, Textarea } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { EmptyState, SkeletonRows } from '../components/ui/states';

interface DeckFrameProps {
  actionCode: string;
  moduleLabel: string;
  title: string;
  subtitle?: string;
  statusText?: string;
  steps: string[];
  beforeProceed: string;
  systemCommit: string;
  reportingConsequence: string;
  exceptionRule: string;
  children: ReactNode;
  onSubmit?: () => void;
  submitting?: boolean;
  submitLabel?: string;
  submitDisabled?: boolean;
}

function DeckFrame({
  actionCode,
  moduleLabel,
  title,
  subtitle = 'Data Entry / Granted intake / authoritative action deck specifications',
  statusText = 'Ready for review',
  steps,
  beforeProceed,
  systemCommit,
  reportingConsequence,
  exceptionRule,
  children,
  onSubmit,
  submitting = false,
  submitLabel = 'Submit Action',
  submitDisabled = false,
}: DeckFrameProps) {
  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs uppercase bg-muted/40">
              {actionCode}
            </Badge>
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              {moduleLabel}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1 font-mono text-xs">
            <ShieldCheck className="h-3 w-3 text-emerald-600" />
            {statusText}
          </Badge>
          {onSubmit && (
            <Button
              onClick={onSubmit}
              disabled={submitDisabled || submitting}
              className="bg-[#113F3D] hover:bg-[#155451] text-white"
            >
              {submitting ? 'Processing...' : submitLabel}
            </Button>
          )}
        </div>
      </div>

      {/* Action Deck Protocol Metadata Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-muted/30 p-3 rounded-lg border border-border text-xs">
        <div>
          <span className="font-semibold text-muted-foreground block uppercase text-[10px]">
            User Action Steps
          </span>
          <ol className="list-decimal list-inside text-foreground space-y-0.5 mt-1">
            {steps.map((s, idx) => (
              <li key={idx} className="truncate" title={s}>
                {s}
              </li>
            ))}
          </ol>
        </div>
        <div>
          <span className="font-semibold text-amber-700 dark:text-amber-400 block uppercase text-[10px]">
            Before It Can Proceed
          </span>
          <p className="text-muted-foreground mt-1 line-clamp-3" title={beforeProceed}>
            {beforeProceed}
          </p>
        </div>
        <div>
          <span className="font-semibold text-teal-700 dark:text-teal-400 block uppercase text-[10px]">
            System Commit
          </span>
          <p className="text-muted-foreground mt-1 line-clamp-3" title={systemCommit}>
            {systemCommit}
          </p>
        </div>
        <div>
          <span className="font-semibold text-rose-700 dark:text-rose-400 block uppercase text-[10px]">
            Exception & Hold Policy
          </span>
          <p className="text-muted-foreground mt-1 line-clamp-3" title={exceptionRule}>
            {exceptionRule}
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <div>{children}</div>
    </div>
  );
}

// ====================================================================
// DE-01: Capture a source-backed enquiry
// ====================================================================
export function EnquiryIntakePage() {
  const [sources, setSources] = useState<IntakeSourceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<IntakeEnquiryReceipt | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [form, setForm] = useState<EnquiryCaptureInput>({
    prospectName: '',
    phone: '',
    email: '',
    vertical: 'wealth',
    targetTeamId: 'TEAM-WEALTH-ALPHA',
    product: 'V1 Wealth Portfolio',
    sourceId: '',
    permissionEvidence: '',
    permissionDate: new Date().toISOString().slice(0, 10),
    needSummary: '',
  });

  const loadSources = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchSources();
      setSources(data);
      if (data.length > 0 && !form.sourceId) {
        const active = data.find((s) => s.status === 'active') || data[0];
        if (active) setForm((prev) => ({ ...prev, sourceId: active.id }));
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load intake sources.');
    } finally {
      setLoading(false);
    }
  }, [form.sourceId]);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  const handleSubmit = async () => {
    setErrorMsg(null);
    setReceipt(null);
    setSubmitting(true);
    try {
      const res = await captureEnquiry(form);
      setReceipt(res);
      if (res.status === 'valid') {
        setForm((prev) => ({
          ...prev,
          prospectName: '',
          phone: '',
          email: '',
          permissionEvidence: '',
          needSummary: '',
        }));
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Validation failed. Check required fields.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DeckFrame
      actionCode="DE-01"
      moduleLabel="New entry"
      title="Capture a source-backed enquiry"
      steps={[
        'Open New entry and complete the approved fields.',
        'Review source and contact-permission evidence.',
        'Submit to validation and inspect the intake reference.',
      ]}
      beforeProceed="Data Entry cannot choose another vertical outside grants or mark a sales outcome. Required fields depend on product."
      systemCommit="Store immutable raw intake and validate before creating or linking an opportunity."
      reportingConsequence="Count accepted, invalid and duplicate intake separately."
      exceptionRule="Missing permission can retain a quarantined record for correction but cannot authorise outreach."
      onSubmit={handleSubmit}
      submitting={submitting}
      submitLabel="Submit Enquiry Intake"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FilePlus2 className="h-4 w-4 text-[#113F3D]" />
                Prospect & Contact Coordinates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-md flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {errorMsg}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Prospect Name *
                  </label>
                  <Input
                    placeholder="e.g. Vikramaditya Singhania"
                    value={form.prospectName}
                    onChange={(e) => setForm({ ...form, prospectName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Primary Phone (10-Digit Mobile) *
                  </label>
                  <Input
                    placeholder="+91 98765 43210"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Email Address (Optional)
                  </label>
                  <Input
                    type="email"
                    placeholder="prospect@domain.test"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Target Vertical Scope *
                  </label>
                  <Select
                    value={form.vertical}
                    onChange={(e) => setForm({ ...form, vertical: e.target.value as Vertical })}
                  >
                    <option value="wealth">Wealth Management (V1)</option>
                    <option value="banking">Commercial Banking (V2)</option>
                    <option value="markets">Markets & Trading (V3)</option>
                    <option value="real-estate">Real Estate Advisory (V4)</option>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Target Offering / Product *
                  </label>
                  <Input
                    placeholder="e.g. V1 Wealth Portfolio"
                    value={form.product}
                    onChange={(e) => setForm({ ...form, product: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Destination Allocation Team *
                  </label>
                  <Select
                    value={form.targetTeamId}
                    onChange={(e) => setForm({ ...form, targetTeamId: e.target.value })}
                  >
                    <option value="TEAM-WEALTH-ALPHA">Wealth Alpha (Bangalore HQ)</option>
                    <option value="TEAM-WEALTH-BETA">Wealth Beta (South Region)</option>
                    <option value="TEAM-BANKING-ALPHA">Banking Alpha (Corporate Desk)</option>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#113F3D]" />
                Consent & Provenance Evidence
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Authorized Intake Source *
                  </label>
                  <Select
                    value={form.sourceId}
                    onChange={(e) => setForm({ ...form, sourceId: e.target.value })}
                  >
                    {sources.map((s) => (
                      <option key={s.id} value={s.id} disabled={s.status === 'suspended'}>
                        {s.sourceName} ({s.sourceCode}) {s.status === 'suspended' ? '— [SUSPENDED]' : ''}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Permission Date *
                  </label>
                  <Input
                    type="date"
                    value={form.permissionDate}
                    onChange={(e) => setForm({ ...form, permissionDate: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Consent / Proof Reference *
                </label>
                <Input
                  placeholder="e.g. WEB-OPTIN-2026-10-15-9921 or Signed Slip Reference"
                  value={form.permissionEvidence}
                  onChange={(e) => setForm({ ...form, permissionEvidence: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Client Stated Need / Commercial Context
                </label>
                <Textarea
                  rows={3}
                  placeholder="Summary of client's requirements, asset size, or specific interest..."
                  value={form.needSummary}
                  onChange={(e) => setForm({ ...form, needSummary: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Intake Receipt & Rules Guarantee */}
        <div className="space-y-4">
          <Card className="border-border">
            <CardHeader className="bg-muted/20">
              <CardTitle className="text-sm font-semibold">Intake Validation Receipt</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {receipt ? (
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b">
                    <span className="text-muted-foreground">Receipt Reference</span>
                    <span className="font-mono font-bold text-foreground">{receipt.id}</span>
                  </div>
                  <div className="flex items-center justify-between pb-2 border-b">
                    <span className="text-muted-foreground">Ingestion Disposition</span>
                    <Badge
                      className={
                        receipt.status === 'valid'
                          ? 'bg-emerald-100 text-emerald-800'
                          : receipt.status === 'duplicate_hold'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }
                    >
                      {receipt.status.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between pb-2 border-b">
                    <span className="text-muted-foreground">Duplicate Candidate</span>
                    <span className="font-semibold">
                      {receipt.isDuplicate ? `Matched (${receipt.duplicateMatchLeadId})` : 'None — Clean'}
                    </span>
                  </div>
                  {receipt.validationErrors.length > 0 && (
                    <div className="bg-rose-50 p-2 rounded border border-rose-200">
                      <span className="font-semibold text-rose-800 block mb-1">Validation Errors:</span>
                      <ul className="list-disc list-inside space-y-0.5 text-rose-700">
                        {receipt.validationErrors.map((ve, i) => (
                          <li key={i}>{ve.message}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className="text-muted-foreground text-[11px] leading-relaxed pt-2">
                    {receipt.status === 'valid'
                      ? 'Row validated successfully. Raw payload stored immutably; ready for allocation publication.'
                      : receipt.status === 'duplicate_hold'
                      ? 'Row flagged for identity duplicate review (DE-04). No outreach permitted until reviewed.'
                      : 'Row held for correction (DE-03). Original source provenance retained.'}
                  </p>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-xs">
                  <Inbox className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  Submit an enquiry to inspect validation receipt and immutable reference ID.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-[#113F3D]/5 border-[#113F3D]/20">
            <CardHeader>
              <CardTitle className="text-xs uppercase tracking-wider text-[#113F3D] font-bold">
                Data Entry Boundary Invariants
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-2">
              <p>
                • <strong>Zero Lead Ownership:</strong> Operators never acquire ownership of leads. Leads route exclusively to Team Lead unassigned pools upon publication.
              </p>
              <p>
                • <strong>No Unsubstantiated Outreach:</strong> Entries without confirmed consent provenance are quarantined.
              </p>
              <p>
                • <strong>Scope Boundaries:</strong> Inquiries cannot be routed across vertical boundaries without formal National Manager referrals.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DeckFrame>
  );
}

// ====================================================================
// DE-02: Upload and map a data file
// ====================================================================
export function BatchUploadPage() {
  const [sources, setSources] = useState<IntakeSourceSummary[]>([]);
  const [batches, setBatches] = useState<IntakeBatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    batchName: '',
    sourceId: '',
    vertical: 'wealth' as Vertical,
    targetTeamId: 'TEAM-WEALTH-ALPHA',
    fileName: 'vendor_batch.csv',
    csvContent: [
      'Client Name,Primary Mobile,Email Address,Target Product,Consent Reference,Consent Date,Need Summary',
      'Sunil Gavaskar,+91 98765 88101,sunil.g@cricket.test,V1 Wealth Portfolio,APEX-CONSENT-01,2026-10-15,Long term portfolio advisory',
      'Kapil Dev,+91 98765 88102,kapil.d@sports.test,V1 Wealth Portfolio,APEX-CONSENT-02,2026-10-15,Discretionary investment management',
      'Ravi Shastri,+91 98765 88103,ravi.s@media.test,V1 Savings Plus,APEX-CONSENT-03,2026-10-15,Short term yield parking',
    ].join('\n'),
    notes: 'Vendor partner co-marketing list',
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [srcs, bts] = await Promise.all([fetchSources(), fetchBatches()]);
      setSources(srcs);
      setBatches(bts);
      if (srcs.length > 0 && !form.sourceId) {
        const active = srcs.find((s) => s.status === 'active') || srcs[0];
        if (active) setForm((prev) => ({ ...prev, sourceId: active.id }));
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load batch data.');
    } finally {
      setLoading(false);
    }
  }, [form.sourceId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUpload = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setUploading(true);
    try {
      const res = await uploadBatch({
        batchName: form.batchName.trim() || `Batch-${Date.now().toString().slice(-4)}`,
        sourceId: form.sourceId,
        vertical: form.vertical,
        targetTeamId: form.targetTeamId,
        fileName: form.fileName,
        csvContent: form.csvContent,
        notes: form.notes,
      });
      setSuccessMsg(`Batch '${res.id}' uploaded successfully (${res.validRows} valid, ${res.heldRows} held).`);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Batch upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <DeckFrame
      actionCode="DE-02"
      moduleLabel="Upload batches"
      title="Upload and map a data file"
      steps={[
        'Upload a permitted file and select the source and vertical.',
        'Map columns and review a preview with validation errors.',
        'Submit the import job and monitor progress.',
      ]}
      beforeProceed="Enforce size/row limits, safe parsing and required mappings. Formula-like values must not execute in exports."
      systemCommit="Store file hash, batch ID and row lineage; parse asynchronously with repeat-safe processing."
      reportingConsequence="Quality report reconciles submitted rows to accepted, duplicate, invalid and pending rows."
      exceptionRule="Retry the same batch without duplicating opportunities. A mapping change creates a new reviewed version."
      onSubmit={handleUpload}
      submitting={uploading}
      submitLabel="Upload & Stage Batch"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <UploadCloud className="h-4 w-4 text-[#113F3D]" />
                Batch Metadata & Source Binding
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-md flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {errorMsg}
                </div>
              )}
              {successMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-md flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {successMsg}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Batch Reference / Name *
                  </label>
                  <Input
                    placeholder="e.g. Apex Strategic Batch B-104"
                    value={form.batchName}
                    onChange={(e) => setForm({ ...form, batchName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    File Name *
                  </label>
                  <Input
                    placeholder="intake_leads.csv"
                    value={form.fileName}
                    onChange={(e) => setForm({ ...form, fileName: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Authorized Source *
                  </label>
                  <Select
                    value={form.sourceId}
                    onChange={(e) => setForm({ ...form, sourceId: e.target.value })}
                  >
                    {sources.map((s) => (
                      <option key={s.id} value={s.id} disabled={s.status === 'suspended'}>
                        {s.sourceName} {s.status === 'suspended' ? '— [SUSPENDED]' : ''}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Vertical *
                  </label>
                  <Select
                    value={form.vertical}
                    onChange={(e) => setForm({ ...form, vertical: e.target.value as Vertical })}
                  >
                    <option value="wealth">Wealth Management</option>
                    <option value="banking">Commercial Banking</option>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Destination Team *
                  </label>
                  <Select
                    value={form.targetTeamId}
                    onChange={(e) => setForm({ ...form, targetTeamId: e.target.value })}
                  >
                    <option value="TEAM-WEALTH-ALPHA">Wealth Alpha</option>
                    <option value="TEAM-WEALTH-BETA">Wealth Beta</option>
                    <option value="TEAM-BANKING-ALPHA">Banking Alpha</option>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  CSV Content / Staging Rows *
                </label>
                <Textarea
                  rows={6}
                  className="font-mono text-xs"
                  value={form.csvContent}
                  onChange={(e) => setForm({ ...form, csvContent: e.target.value })}
                />
                <span className="text-[11px] text-muted-foreground mt-1 block">
                  Enforces formula protection. Cells with =, +, -, @ are sanitized automatically. Max 500 rows per batch.
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Staged Batches List */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold">Active & Staged Intake Batches</CardTitle>
              <Button variant="ghost" size="sm" onClick={loadData}>
                <RefreshCw className="h-3 w-3" />
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 border-y border-border text-muted-foreground font-semibold uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Batch ID</th>
                      <th className="p-3">Batch Name</th>
                      <th className="p-3">Source</th>
                      <th className="p-3">Rows (Tot/Val/Held)</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {batches.map((b) => (
                      <tr key={b.id} className="hover:bg-muted/30">
                        <td className="p-3 font-mono font-bold text-foreground">{b.id}</td>
                        <td className="p-3 font-medium text-foreground">{b.batchName}</td>
                        <td className="p-3 text-muted-foreground">{b.sourceName}</td>
                        <td className="p-3 font-mono">
                          {b.totalRows} tot / <span className="text-emerald-700 font-semibold">{b.validRows} val</span> /{' '}
                          <span className="text-rose-700 font-semibold">{b.heldRows} held</span>
                        </td>
                        <td className="p-3">
                          <Badge
                            className={
                              b.status === 'published'
                                ? 'bg-blue-100 text-blue-800'
                                : b.status === 'ready_for_publish'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }
                          >
                            {b.status.replace(/_/g, ' ').toUpperCase()}
                          </Badge>
                        </td>
                        <td className="p-3 text-right text-muted-foreground">
                          {new Date(b.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                    {batches.length === 0 && !loading && (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-muted-foreground">
                          No batches staged yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-4">
          <Card className="bg-[#113F3D]/5 border-[#113F3D]/20">
            <CardHeader>
              <CardTitle className="text-xs uppercase tracking-wider text-[#113F3D] font-bold">
                Batch Integrity Invariant
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-2">
              <p>
                <strong>SHA-256 Hash Guard:</strong> Every uploaded file produces a deterministic content hash. Re-uploading identical file contents is rejected with a 409 conflict to prevent duplicate opportunities.
              </p>
              <p>
                <strong>Lineage Tracking:</strong> Every row maintains complete parent batch attribution and immutable original CSV payload.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DeckFrame>
  );
}

// ====================================================================
// DE-03: Correct rejected intake rows
// ====================================================================
export function ValidationCorrectionPage() {
  const [rows, setRows] = useState<IntakeRowSummary[]>([]);
  const [selectedRow, setSelectedRow] = useState<IntakeRowSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [correctionForm, setCorrectionForm] = useState({
    name: '',
    phone: '',
    email: '',
    product: '',
    evidence: '',
    reason: '',
  });

  const loadRejected = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchRejectedRows();
      setRows(data);
      if (data.length > 0 && !selectedRow) {
        selectRow(data[0]!);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load rejected rows.');
    } finally {
      setLoading(false);
    }
  }, [selectedRow]);

  useEffect(() => {
    loadRejected();
  }, [loadRejected]);

  const selectRow = (r: IntakeRowSummary) => {
    setSelectedRow(r);
    setCorrectionForm({
      name: r.parsedName,
      phone: r.parsedPhone,
      email: r.parsedEmail || '',
      product: r.parsedProduct,
      evidence: r.permissionEvidence,
      reason: 'Source verification and updated phone provided.',
    });
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleCorrect = async () => {
    if (!selectedRow) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(true);
    try {
      const res = await correctRejectedRow(selectedRow.id, {
        rowId: selectedRow.id,
        correctedName: correctionForm.name,
        correctedPhone: correctionForm.phone,
        correctedEmail: correctionForm.email,
        correctedProduct: correctionForm.product,
        permissionEvidence: correctionForm.evidence,
        correctionReason: correctionForm.reason,
      });

      setSuccessMsg(`Row '${res.id}' updated to status: ${res.status.toUpperCase()}`);
      loadRejected();
      if (res.status === 'valid') {
        setSelectedRow(null);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit correction.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DeckFrame
      actionCode="DE-03"
      moduleLabel="Validation"
      title="Correct rejected intake rows"
      steps={[
        'Filter errors by reason and open the affected row.',
        'Correct permitted fields with evidence.',
        'Revalidate selected rows and inspect the updated disposition.',
      ]}
      beforeProceed="Do not alter original source history. Accepted sales outcomes cannot be edited through intake correction."
      systemCommit="Store corrected version and validation result linked to the original row."
      reportingConsequence="Measure error rate and correction turnaround without treating retries as new submissions."
      exceptionRule="Ambiguous source information stays pending and routes back to the source owner."
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Rejected rows list */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span>Quarantined Rows ({rows.length})</span>
                <Button variant="ghost" size="sm" onClick={loadRejected}>
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
                {rows.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => selectRow(r)}
                    className={`p-3 cursor-pointer text-xs transition-colors ${
                      selectedRow?.id === r.id ? 'bg-[#113F3D]/10 border-l-4 border-[#113F3D]' : 'hover:bg-muted/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-bold text-foreground">{r.id}</span>
                      <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-800 border-rose-200">
                        REJECTED
                      </Badge>
                    </div>
                    <div className="font-semibold text-foreground">{r.parsedName}</div>
                    <div className="text-muted-foreground truncate">{r.parsedPhone} · {r.parsedProduct}</div>
                    {r.validationErrors.length > 0 && (
                      <div className="text-[11px] text-rose-600 mt-1 truncate">
                        ⚠️ {r.validationErrors[0]?.message}
                      </div>
                    )}
                  </div>
                ))}
                {rows.length === 0 && !loading && (
                  <div className="p-6 text-center text-muted-foreground text-xs">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600 mx-auto mb-2" />
                    Zero rejected rows pending correction. All intake rows clean!
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Correction Editor */}
        <div className="lg:col-span-2 space-y-4">
          {selectedRow ? (
            <Card>
              <CardHeader className="border-b pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">
                    Row Correction · {selectedRow.id} (Batch: {selectedRow.batchId ?? 'Manual'})
                  </CardTitle>
                  <Badge variant="secondary" className="font-mono text-xs">
                    Original Row Lineage Locked
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {errorMsg && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-md">
                    {errorMsg}
                  </div>
                )}
                {successMsg && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-md">
                    {successMsg}
                  </div>
                )}

                {/* Validation errors callout */}
                <div className="bg-rose-50/70 p-3 rounded border border-rose-200 text-xs">
                  <span className="font-semibold text-rose-800 block mb-1">Validation Failure Reasons:</span>
                  <ul className="list-disc list-inside space-y-0.5 text-rose-700">
                    {selectedRow.validationErrors.map((ve, i) => (
                      <li key={i}>
                        <strong>{ve.field}</strong>: {ve.message}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">
                      Corrected Prospect Name
                    </label>
                    <Input
                      value={correctionForm.name}
                      onChange={(e) => setCorrectionForm({ ...correctionForm, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">
                      Corrected Mobile Phone (10 Digits)
                    </label>
                    <Input
                      value={correctionForm.phone}
                      onChange={(e) => setCorrectionForm({ ...correctionForm, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">
                      Approved Product Catalog Name
                    </label>
                    <Input
                      value={correctionForm.product}
                      onChange={(e) => setCorrectionForm({ ...correctionForm, product: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">
                      Consent / Evidence Reference
                    </label>
                    <Input
                      value={correctionForm.evidence}
                      onChange={(e) => setCorrectionForm({ ...correctionForm, evidence: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Correction Reason & Source Confirmation Evidence *
                  </label>
                  <Textarea
                    rows={2}
                    placeholder="Document vendor source confirmation or customer verification notes..."
                    value={correctionForm.reason}
                    onChange={(e) => setCorrectionForm({ ...correctionForm, reason: e.target.value })}
                  />
                  <span className="text-[11px] text-muted-foreground mt-1 block">
                    Correction reasons are immutably appended to row provenance audit ledger. Original raw payload is preserved.
                  </span>
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    onClick={handleCorrect}
                    disabled={submitting || !correctionForm.reason.trim()}
                    className="bg-[#113F3D] hover:bg-[#155451] text-white"
                  >
                    {submitting ? 'Revalidating...' : 'Revalidate & Update Row'}
                  </Button>
                </div>

                {/* Original Payload comparison */}
                <div className="pt-4 border-t">
                  <span className="text-xs font-semibold text-muted-foreground block mb-2">
                    Original Raw Payload (Immutable Lineage)
                  </span>
                  <pre className="p-3 bg-muted/40 rounded text-[11px] font-mono text-muted-foreground overflow-x-auto">
                    {JSON.stringify(selectedRow.rawPayload, null, 2)}
                  </pre>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="p-8 text-center text-muted-foreground text-xs">
              Select a rejected row from the list to review and correct fields.
            </Card>
          )}
        </div>
      </div>
    </DeckFrame>
  );
}

// ====================================================================
// DE-04: Review a possible duplicate
// Invariant: No cross-vertical record disclosure
// ====================================================================
export function DuplicateReviewPage() {
  const [duplicates, setDuplicates] = useState<DuplicateCandidateSummary[]>([]);
  const [selectedDupe, setSelectedDupe] = useState<DuplicateCandidateSummary | null>(null);
  const [decisionNotes, setDecisionNotes] = useState('Reviewed contact history and confirmed separate commercial enquiry.');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadDupes = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchDuplicates();
      setDuplicates(data);
      if (data.length > 0 && !selectedDupe) {
        setSelectedDupe(data[0]!);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load duplicate candidates.');
    } finally {
      setLoading(false);
    }
  }, [selectedDupe]);

  useEffect(() => {
    loadDupes();
  }, [loadDupes]);

  const handleDecision = async (decision: 'link' | 'new_enquiry' | 'escalate') => {
    if (!selectedDupe) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(true);
    try {
      const res = await submitDuplicateDecision(selectedDupe.rowId, {
        rowId: selectedDupe.rowId,
        decision,
        decisionNotes,
        targetLeadId: selectedDupe.matchLeadId,
      });

      setSuccessMsg(`Decision '${decision}' applied: ${res.safeSummary}`);
      loadDupes();
      setSelectedDupe(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Decision submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DeckFrame
      actionCode="DE-04"
      moduleLabel="Duplicate review"
      title="Review a possible duplicate"
      steps={[
        'Inspect only permitted match fields and enquiry context.',
        'Link a genuine repeat intake or preserve a distinct enquiry.',
        'Escalate cross-scope identity decisions to the authorised data steward.',
      ]}
      beforeProceed="Same phone does not automatically mean duplicate opportunity. No cross-vertical record disclosure."
      systemCommit="Store reviewed match decision, surviving identifiers and full provenance."
      reportingConsequence="Duplicate intake is excluded from fresh-opportunity counts but remains visible in source quality."
      exceptionRule="Data Entry cannot merge restricted customer identities without a specific steward grant."
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Candidates List */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span>Duplicate Holds ({duplicates.length})</span>
                <Button variant="ghost" size="sm" onClick={loadDupes}>
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
                {duplicates.map((d) => (
                  <div
                    key={d.rowId}
                    onClick={() => setSelectedDupe(d)}
                    className={`p-3 cursor-pointer text-xs transition-colors ${
                      selectedDupe?.rowId === d.rowId ? 'bg-[#113F3D]/10 border-l-4 border-[#113F3D]' : 'hover:bg-muted/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono font-bold text-foreground">{d.rowId}</span>
                      <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-200">
                        {d.isCrossVertical ? 'CROSS-VERTICAL' : 'MATCH'}
                      </Badge>
                    </div>
                    <div className="font-semibold text-foreground">{d.incomingName}</div>
                    <div className="text-muted-foreground truncate">{d.incomingPhone} · {d.incomingProduct}</div>
                  </div>
                ))}
                {duplicates.length === 0 && !loading && (
                  <div className="p-6 text-center text-muted-foreground text-xs">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600 mx-auto mb-2" />
                    Zero candidate duplicates pending review!
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Restricted Summary & Decision Panel */}
        <div className="lg:col-span-2 space-y-4">
          {selectedDupe ? (
            <Card>
              <CardHeader className="border-b pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">
                    Restricted Candidate Summary · {selectedDupe.rowId}
                  </CardTitle>
                  <Badge variant="outline" className="font-mono text-xs">
                    Privacy Guard Active
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {errorMsg && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-md">
                    {errorMsg}
                  </div>
                )}
                {successMsg && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-md">
                    {successMsg}
                  </div>
                )}

                {/* Restricted Match Disclosure Banner */}
                <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-md text-xs space-y-1">
                  <div className="font-semibold text-amber-800 flex items-center gap-1.5">
                    <ShieldAlert className="h-4 w-4" />
                    Restricted Disclosure Safeguard (Deck P270)
                  </div>
                  <p className="text-amber-900 leading-relaxed">
                    {selectedDupe.safeSummary}
                  </p>
                </div>

                {/* Comparison Details */}
                <div className="grid grid-cols-2 gap-4 text-xs border rounded-lg p-3 bg-muted/20">
                  <div>
                    <span className="font-semibold text-muted-foreground block uppercase text-[10px] mb-1">
                      Incoming Intake Row
                    </span>
                    <p className="font-semibold text-foreground">{selectedDupe.incomingName}</p>
                    <p className="text-muted-foreground">{selectedDupe.incomingPhone}</p>
                    <p className="text-muted-foreground">{selectedDupe.incomingProduct}</p>
                    <p className="font-mono text-[10px] text-muted-foreground mt-1 uppercase">
                      Vertical: {selectedDupe.incomingVertical}
                    </p>
                  </div>
                  <div className="border-l pl-4">
                    <span className="font-semibold text-muted-foreground block uppercase text-[10px] mb-1">
                      Matched Surviving Candidate
                    </span>
                    <p className="font-semibold text-foreground">Lead ID: {selectedDupe.matchLeadId}</p>
                    <p className="text-muted-foreground">Stage: {selectedDupe.matchLeadStage}</p>
                    <p className="text-muted-foreground">Created: {selectedDupe.matchCreatedDate}</p>
                    <p className="font-mono text-[10px] text-muted-foreground mt-1 uppercase">
                      Vertical: {selectedDupe.matchLeadVertical}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Decision Review Notes & Evidence *
                  </label>
                  <Textarea
                    rows={2}
                    value={decisionNotes}
                    onChange={(e) => setDecisionNotes(e.target.value)}
                    placeholder="Document why this is a distinct enquiry or repeat intake..."
                  />
                </div>

                {/* Decision Actions */}
                <div className="pt-2 flex flex-wrap items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleDecision('escalate')}
                    disabled={submitting}
                    className="text-amber-700 border-amber-300 hover:bg-amber-50 text-xs"
                  >
                    Escalate to Data Steward
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleDecision('link')}
                    disabled={submitting}
                    className="text-blue-700 border-blue-300 hover:bg-blue-50 text-xs"
                  >
                    Link Repeat Enquiry
                  </Button>
                  <Button
                    onClick={() => handleDecision('new_enquiry')}
                    disabled={submitting || !decisionNotes.trim()}
                    className="bg-[#113F3D] hover:bg-[#155451] text-white text-xs"
                  >
                    Approve as Distinct New Enquiry
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="p-8 text-center text-muted-foreground text-xs">
              Select a candidate duplicate to inspect restricted match details.
            </Card>
          )}
        </div>
      </div>
    </DeckFrame>
  );
}

// ====================================================================
// DE-05: Publish valid rows to allocation
// ====================================================================
export function PublishBatchPage() {
  const [batches, setBatches] = useState<IntakeBatchSummary[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<IntakeBatchSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [receipt, setReceipt] = useState<BatchPublishReceipt | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadBatches = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchBatches();
      setBatches(data);
      if (data.length > 0 && !selectedBatch) {
        setSelectedBatch(data[0]!);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load batches.');
    } finally {
      setLoading(false);
    }
  }, [selectedBatch]);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  const handlePublish = async () => {
    if (!selectedBatch) return;
    setErrorMsg(null);
    setReceipt(null);
    setPublishing(true);
    try {
      const res = await publishBatch(selectedBatch.id);
      setReceipt(res);
      loadBatches();
    } catch (err: any) {
      setErrorMsg(err.message || 'Batch publication failed.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <DeckFrame
      actionCode="DE-05"
      moduleLabel="Upload batches"
      title="Publish valid rows to allocation"
      steps={[
        'Inspect validation summary and destination.',
        'Submit or publish the eligible rows within authority.',
        'Receive the canonical IDs and unresolved-row receipt.',
      ]}
      beforeProceed="Publish only validated, permitted records. Allocation follows eligibility rules, not arbitrary Data Entry ownership."
      systemCommit="Create/link canonical opportunities and enqueue routing once per intake key."
      reportingConsequence="Published count reconciles to linked opportunity IDs and excludes held rows."
      exceptionRule="Partial failures stay visible and retry independently. No duplicate creation on repeated publish."
      onSubmit={handlePublish}
      submitting={publishing}
      submitLabel={
        selectedBatch
          ? `Publish ${selectedBatch.validRows} Clean Rows → TL Queue`
          : 'Publish to Allocation'
      }
      submitDisabled={!selectedBatch || selectedBatch.validRows === 0}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Batches Table */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold">Ready & In-Flight Batches</CardTitle>
              <Button variant="ghost" size="sm" onClick={loadBatches}>
                <RefreshCw className="h-3 w-3" />
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 border-y border-border text-muted-foreground font-semibold uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Select</th>
                      <th className="p-3">Batch ID</th>
                      <th className="p-3">Destination Team</th>
                      <th className="p-3">Clean / Held</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {batches.map((b) => (
                      <tr
                        key={b.id}
                        onClick={() => setSelectedBatch(b)}
                        className={`cursor-pointer transition-colors ${
                          selectedBatch?.id === b.id ? 'bg-[#113F3D]/10' : 'hover:bg-muted/30'
                        }`}
                      >
                        <td className="p-3">
                          <input
                            type="radio"
                            name="selectedBatch"
                            checked={selectedBatch?.id === b.id}
                            onChange={() => setSelectedBatch(b)}
                          />
                        </td>
                        <td className="p-3 font-mono font-bold text-foreground">
                          {b.id}
                          <span className="block font-normal text-muted-foreground">{b.batchName}</span>
                        </td>
                        <td className="p-3">
                          <span className="font-semibold text-foreground">{b.teamName}</span>
                          <span className="block text-muted-foreground uppercase text-[10px]">
                            {b.vertical}
                          </span>
                        </td>
                        <td className="p-3 font-mono">
                          <span className="text-emerald-700 font-bold">{b.validRows} clean</span> /{' '}
                          <span className="text-rose-700">{b.heldRows} held</span>
                        </td>
                        <td className="p-3">
                          <Badge
                            className={
                              b.status === 'published'
                                ? 'bg-blue-100 text-blue-800'
                                : b.status === 'ready_for_publish'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }
                          >
                            {b.status.replace(/_/g, ' ').toUpperCase()}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Publication Receipt & Verification */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="bg-muted/20 pb-3">
              <CardTitle className="text-sm font-semibold">Allocation Routing Receipt</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-xs">
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded">
                  {errorMsg}
                </div>
              )}

              {receipt ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b">
                    <span className="text-muted-foreground">Published to Queue</span>
                    <span className="font-bold text-emerald-700">{receipt.publishedCount} Leads</span>
                  </div>
                  <div className="flex items-center justify-between pb-2 border-b">
                    <span className="text-muted-foreground">Destination Team</span>
                    <span className="font-semibold text-foreground">{receipt.targetTeamName}</span>
                  </div>
                  <div className="flex items-center justify-between pb-2 border-b">
                    <span className="text-muted-foreground">Remaining Held Rows</span>
                    <span className="font-semibold text-amber-700">{receipt.heldCount} Quarantined</span>
                  </div>

                  <div>
                    <span className="font-semibold text-muted-foreground block text-[10px] uppercase mb-1">
                      Generated Canonical Lead IDs
                    </span>
                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                      {receipt.canonicalLeadIds.map((cid) => (
                        <Badge key={cid} variant="secondary" className="font-mono text-[10px]">
                          {cid}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="p-2 bg-muted/40 rounded border text-[11px] leading-relaxed text-muted-foreground">
                    ✓ Leads arrived in <strong>{receipt.targetTeamName}</strong> unassigned queue (owner: NULL). Team Lead (Tara Iyer) can allocate immediately via TL-02/03.
                  </div>
                </div>
              ) : selectedBatch ? (
                <div className="space-y-3">
                  <p className="text-muted-foreground">
                    Selected batch <strong>{selectedBatch.id}</strong> has <strong>{selectedBatch.validRows}</strong> validated rows ready for frontline queue ingestion.
                  </p>
                  <div className="p-3 bg-muted/30 rounded border text-[11px] space-y-1">
                    <p>• Destination: <strong>{selectedBatch.teamName}</strong></p>
                    <p>• Repeating publish is duplicate-safe (idempotent).</p>
                    <p>• {selectedBatch.heldRows} held rows remain quarantined for independent remediation.</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  Select a batch to inspect publication readiness.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DeckFrame>
  );
}

// ====================================================================
// DE-06: Maintain source evidence and contact provenance
// ====================================================================
export function SourceRegisterPage() {
  const [sources, setSources] = useState<IntakeSourceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [form, setForm] = useState<SourceEvidenceInput>({
    sourceCode: '',
    sourceName: '',
    vendorName: '',
    collectionBasis: 'Explicit Web Opt-In Form with OTP Verification',
    evidenceDocumentUrl: '',
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: '',
    permittedVerticals: ['wealth'],
    permittedProducts: ['V1 Wealth Portfolio', 'V1 Savings Plus'],
    status: 'active',
    notes: '',
  });

  const loadSources = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchSources();
      setSources(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load source register.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  const handleCreateSource = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(true);
    try {
      const res = await createSource(form);
      setSuccessMsg(`Source '${res.sourceName}' (${res.sourceCode}) registered successfully.`);
      setForm({
        sourceCode: '',
        sourceName: '',
        vendorName: '',
        collectionBasis: 'Explicit Web Opt-In Form with OTP Verification',
        evidenceDocumentUrl: '',
        effectiveFrom: new Date().toISOString().slice(0, 10),
        effectiveTo: '',
        permittedVerticals: ['wealth'],
        permittedProducts: ['V1 Wealth Portfolio'],
        status: 'active',
        notes: '',
      });
      loadSources();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to register source.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (s: IntakeSourceSummary) => {
    const nextStatus = s.status === 'active' ? 'suspended' : 'active';
    try {
      await updateSource(s.id, {
        sourceCode: s.sourceCode,
        sourceName: s.sourceName,
        vendorName: s.vendorName,
        collectionBasis: s.collectionBasis,
        evidenceDocumentUrl: s.evidenceDocumentUrl,
        effectiveFrom: s.effectiveFrom,
        effectiveTo: s.effectiveTo,
        permittedVerticals: s.permittedVerticals,
        permittedProducts: s.permittedProducts,
        status: nextStatus,
        notes: s.notes,
      });
      loadSources();
    } catch (err: any) {
      setErrorMsg(err.message || 'Status update failed.');
    }
  };

  return (
    <DeckFrame
      actionCode="DE-06"
      moduleLabel="Source register"
      title="Maintain source evidence and contact provenance"
      steps={[
        'Open a source record and inspect evidence completeness.',
        'Submit a correction or renewed source document.',
        'Flag invalid source evidence for the accountable owner.',
      ]}
      beforeProceed="Source approval is a distinct permission. Data Entry cannot invent customer permission or override suppression."
      systemCommit="Version provenance and notify the policy/source owner about missing evidence."
      reportingConsequence="Report source completeness and held batches by cause."
      exceptionRule="Source suspension holds dependent new outreach until an approved resolution."
      onSubmit={handleCreateSource}
      submitting={submitting}
      submitLabel="Register Source"
      submitDisabled={!form.sourceCode.trim() || !form.sourceName.trim()}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Source Registration Form */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Database className="h-4 w-4 text-[#113F3D]" />
                Register Ingestion Source
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-md">
                  {errorMsg}
                </div>
              )}
              {successMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-md">
                  {successMsg}
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Source Code *
                </label>
                <Input
                  placeholder="e.g. SRC-PARTNER-01"
                  value={form.sourceCode}
                  onChange={(e) => setForm({ ...form, sourceCode: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Source Name *
                </label>
                <Input
                  placeholder="e.g. Apex Strategic Co-Marketing"
                  value={form.sourceName}
                  onChange={(e) => setForm({ ...form, sourceName: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Vendor / Partner Name
                </label>
                <Input
                  placeholder="e.g. Apex Marketing LLP"
                  value={form.vendorName}
                  onChange={(e) => setForm({ ...form, vendorName: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Collection Legal Basis *
                </label>
                <Select
                  value={form.collectionBasis}
                  onChange={(e) => setForm({ ...form, collectionBasis: e.target.value })}
                >
                  <option value="Explicit Web Opt-In Form with OTP Verification">
                    Explicit Web Opt-In Form with OTP Verification
                  </option>
                  <option value="Double Opt-In Co-Marketing Consent Card">
                    Double Opt-In Co-Marketing Consent Card
                  </option>
                  <option value="Signed Physical Registration Slip">
                    Signed Physical Registration Slip
                  </option>
                  <option value="Partner Direct API Integration">
                    Partner Direct API Integration
                  </option>
                </Select>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Evidence Document URL / Reference
                </label>
                <Input
                  placeholder="/evidence/sources/partner-sla.pdf"
                  value={form.evidenceDocumentUrl}
                  onChange={(e) => setForm({ ...form, evidenceDocumentUrl: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Effective From *
                  </label>
                  <Input
                    type="date"
                    value={form.effectiveFrom}
                    onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Status *
                  </label>
                  <Select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                  >
                    <option value="active">Active</option>
                    <option value="under_review">Under Review</option>
                    <option value="suspended">Suspended</option>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Source Register Grid */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold">Registered Sources & Provenance</CardTitle>
              <Button variant="ghost" size="sm" onClick={loadSources}>
                <RefreshCw className="h-3 w-3" />
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 border-y border-border text-muted-foreground font-semibold uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Source</th>
                      <th className="p-3">Collection Basis</th>
                      <th className="p-3">Permitted Verticals</th>
                      <th className="p-3">Volume</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {sources.map((s) => (
                      <tr key={s.id} className="hover:bg-muted/30">
                        <td className="p-3">
                          <span className="font-semibold text-foreground">{s.sourceName}</span>
                          <span className="block font-mono text-[10px] text-muted-foreground">{s.sourceCode}</span>
                        </td>
                        <td className="p-3 max-w-[200px] truncate" title={s.collectionBasis}>
                          {s.collectionBasis}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {s.permittedVerticals.map((v) => (
                              <Badge key={v} variant="outline" className="text-[10px] uppercase">
                                {v}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="p-3 font-mono">{s.totalBatches} bts / {s.totalRows} rows</td>
                        <td className="p-3">
                          <Badge
                            className={
                              s.status === 'active'
                                ? 'bg-emerald-100 text-emerald-800'
                                : s.status === 'suspended'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }
                          >
                            {s.status.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(s)}
                            className="text-xs h-7"
                          >
                            {s.status === 'active' ? 'Suspend' : 'Activate'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DeckFrame>
  );
}

// ====================================================================
// DE-07: Export an intake quality report
// ====================================================================
export function QualityReportsPage() {
  const [period, setPeriod] = useState<DePeriod>('this-month');
  const [report, setReport] = useState<IntakeQualityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportReceipt, setExportReceipt] = useState<IntakeWorklistExport | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchQualityReport(period);
      setReport(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to generate intake quality report.');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleExport = async (type: 'quality_report_pdf' | 'correction_worklist_csv') => {
    setExporting(true);
    setErrorMsg(null);
    try {
      const res = await exportQualityReport(period, type);
      setExportReceipt(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Export generation failed.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <DeckFrame
      actionCode="DE-07"
      moduleLabel="Quality reports"
      title="Export an intake quality report"
      steps={[
        'Select period and source filters.',
        'Inspect batch-to-row reconciliation.',
        'Generate a scoped PDF and correction worklist.',
      ]}
      beforeProceed="Report exposes only permitted intake data and minimal customer identifiers."
      systemCommit="Generate versioned export with cutoff, evidence status and download audit."
      reportingConsequence="Data-entry performance is data quality and timeliness, not the associates sales outcomes."
      exceptionRule="A batch still processing is labelled incomplete and not counted as fully accepted."
    >
      <div className="space-y-6">
        {/* Period Selector Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'today', label: 'Today' },
              { id: 'this-week', label: 'This Week' },
              { id: 'this-month', label: 'This Month' },
              { id: 'this-quarter', label: 'This Quarter' },
              { id: 'last-quarter', label: 'Last Quarter' },
              { id: 'fy-to-date', label: 'FY to Date' },
            ].map((p) => (
              <Button
                key={p.id}
                variant={period === p.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPeriod(p.id as DePeriod)}
                className={period === p.id ? 'bg-[#113F3D] text-white' : 'text-xs'}
              >
                {p.label}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('correction_worklist_csv')}
              disabled={exporting}
              className="text-xs gap-1.5"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Export Worklist CSV
            </Button>
            <Button
              size="sm"
              onClick={() => handleExport('quality_report_pdf')}
              disabled={exporting}
              className="bg-[#113F3D] hover:bg-[#155451] text-white text-xs gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              Download Scoped PDF Pack
            </Button>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-md">
            {errorMsg}
          </div>
        )}

        {exportReceipt && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-md flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-700" />
              <span>
                Export <strong>{exportReceipt.exportId}</strong> generated ({exportReceipt.recordCount} rows, format:{' '}
                {exportReceipt.format.toUpperCase()}). Audit logged.
              </span>
            </div>
            <a
              href={exportReceipt.downloadUrl}
              className="font-bold underline text-emerald-900"
              target="_blank"
              rel="noreferrer"
            >
              Open Download
            </a>
          </div>
        )}

        {/* Quality KPI Metric Cards */}
        {report && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <Card className="p-3">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase block">
                Total Submitted
              </span>
              <span className="text-xl font-bold text-foreground font-mono mt-1 block">
                {report.summary.totalSubmitted}
              </span>
              <span className="text-[10px] text-muted-foreground">All intake channels</span>
            </Card>

            <Card className="p-3">
              <span className="text-[11px] font-semibold text-emerald-700 uppercase block">
                Published Leads
              </span>
              <span className="text-xl font-bold text-emerald-700 font-mono mt-1 block">
                {report.summary.totalPublished}
              </span>
              <span className="text-[10px] text-muted-foreground">Enqueued to TL pools</span>
            </Card>

            <Card className="p-3">
              <span className="text-[11px] font-semibold text-rose-700 uppercase block">
                Error Rate %
              </span>
              <span className="text-xl font-bold text-rose-700 font-mono mt-1 block">
                {report.summary.errorRatePct}%
              </span>
              <span className="text-[10px] text-muted-foreground">
                {report.summary.totalRejected} rows invalid
              </span>
            </Card>

            <Card className="p-3">
              <span className="text-[11px] font-semibold text-amber-700 uppercase block">
                Duplicate Rate %
              </span>
              <span className="text-xl font-bold text-amber-700 font-mono mt-1 block">
                {report.summary.duplicateRatePct}%
              </span>
              <span className="text-[10px] text-muted-foreground">
                {report.summary.totalDuplicate} duplicate holds
              </span>
            </Card>

            <Card className="p-3">
              <span className="text-[11px] font-semibold text-foreground uppercase block">
                Turnaround SLA
              </span>
              <span className="text-xl font-bold text-foreground font-mono mt-1 block">
                {report.summary.avgTurnaroundMinutes}m
              </span>
              <span className="text-[10px] text-muted-foreground">Avg correction speed</span>
            </Card>

            <Card className="p-3">
              <span className="text-[11px] font-semibold text-foreground uppercase block">
                Held Quarantined
              </span>
              <span className="text-xl font-bold text-foreground font-mono mt-1 block">
                {report.summary.totalHeld}
              </span>
              <span className="text-[10px] text-muted-foreground">Requires remediation</span>
            </Card>
          </div>
        )}

        {/* Batch-to-Row Reconciliation Table */}
        {report && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                Batch-to-Row Intake Quality Reconciliation
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 border-y border-border text-muted-foreground font-semibold uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Batch Reference</th>
                      <th className="p-3">Source Channel</th>
                      <th className="p-3">Vertical</th>
                      <th className="p-3">Submitted</th>
                      <th className="p-3">Published</th>
                      <th className="p-3">Invalid</th>
                      <th className="p-3">Duplicate</th>
                      <th className="p-3">Held</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {report.batchReconciliation.map((b) => (
                      <tr key={b.batchId} className="hover:bg-muted/30">
                        <td className="p-3 font-mono font-bold text-foreground">
                          {b.batchId}
                          <span className="block font-normal text-muted-foreground">{b.batchName}</span>
                        </td>
                        <td className="p-3 text-muted-foreground">{b.sourceName}</td>
                        <td className="p-3 uppercase text-[10px] font-mono">{b.vertical}</td>
                        <td className="p-3 font-mono font-semibold">{b.submitted}</td>
                        <td className="p-3 font-mono text-emerald-700 font-bold">{b.published}</td>
                        <td className="p-3 font-mono text-rose-700">{b.rejected}</td>
                        <td className="p-3 font-mono text-amber-700">{b.duplicate}</td>
                        <td className="p-3 font-mono text-foreground font-semibold">{b.held}</td>
                        <td className="p-3">
                          <Badge
                            className={
                              b.status === 'published'
                                ? 'bg-blue-100 text-blue-800'
                                : b.status === 'ready_for_publish'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }
                          >
                            {b.status.replace(/_/g, ' ').toUpperCase()}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DeckFrame>
  );
}
