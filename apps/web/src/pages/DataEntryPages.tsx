import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
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
  ExternalLink,
  FileCheck2,
  FilePlus2,
  FileSpreadsheet,
  FileText,
  Filter,
  GraduationCap,
  History,
  Inbox,
  Info,
  Layers,
  LayoutDashboard,
  Link as LinkIcon,
  ListChecks,
  Lock,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UploadCloud,
  UserCheck,
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
import { BatchStagingGrid, stagingRowErrors, stagingRowsToCsv, type StagingRow } from '../components/data-entry/BatchStagingGrid';

// ====================================================================
// Multi-vertical Team Mappings & Products Catalogue
// ====================================================================
const TEAMS_BY_VERTICAL: Record<Vertical, Array<{ id: string; name: string }>> = {
  wealth: [
    { id: 'TEAM-WEALTH-ALPHA', name: 'Wealth Alpha (Bangalore HQ)' },
    { id: 'TEAM-WEALTH-BETA', name: 'Wealth Beta (South Region)' },
  ],
  banking: [
    { id: 'TEAM-BANKING-ALPHA', name: 'Banking Alpha (Corporate Desk)' },
    { id: 'TEAM-BANKING-BETA', name: 'Banking Beta (SME Desk)' },
  ],
  markets: [
    { id: 'TEAM-MARKETS-ALPHA', name: 'Markets Alpha (Institutional Equities)' },
    { id: 'TEAM-MARKETS-BETA', name: 'Markets Beta (FX & Commodities)' },
  ],
  'real-estate': [
    { id: 'TEAM-REALESTATE-ALPHA', name: 'Real Estate Alpha (Commercial REIT)' },
    { id: 'TEAM-REALESTATE-BETA', name: 'Real Estate Beta (Luxury Residential)' },
  ],
  real_estate: [
    { id: 'TEAM-REALESTATE-ALPHA', name: 'Real Estate Alpha (Commercial REIT)' },
    { id: 'TEAM-REALESTATE-BETA', name: 'Real Estate Beta (Luxury Residential)' },
  ],
};

const PRODUCTS_BY_VERTICAL: Record<Vertical, string[]> = {
  wealth: ['V1 Wealth Portfolio', 'V1 Savings Plus', 'V1 Discretionary PMS', 'V1 Offshore Asset Fund'],
  banking: ['V2 Working Capital Line', 'V2 Commercial Trade Finance', 'V2 Treasury Deposit', 'V2 Corporate Loan'],
  markets: ['V3 Institutional Equities', 'V3 FX Derivatives', 'V3 Algorithmic Execution', 'V3 Structured Notes'],
  'real-estate': ['V4 Commercial REIT Advisory', 'V4 Luxury Villa Portfolio', 'V4 Industrial Land Bank', 'V4 Grade-A Office Lease'],
  real_estate: ['V4 Commercial REIT Advisory', 'V4 Luxury Villa Portfolio', 'V4 Industrial Land Bank', 'V4 Grade-A Office Lease'],
};

// ====================================================================
// DeckFrame: Action Deck Canonical Layout with 3-Card Guidance Stack
// ====================================================================
interface DeckFrameProps {
  actionCode: string;
  moduleLabel: string;
  title: string;
  subtitle?: string;
  statusText?: string;
  steps: string[];
  beforeProceed: string;
  systemCommit: string;
  reportingConsequence?: string;
  exceptionRule: string;
  permissionEvidenceText?: string;
  children: ReactNode;
  rightRailExtra?: ReactNode;
  wideWorkspace?: boolean;
  onSubmit?: () => void;
  submitting?: boolean;
  submitLabel?: string;
  submitDisabled?: boolean;
  onReset?: () => void;
  resetLabel?: string;
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
  permissionEvidenceText = 'Granted intake · Source-specific grant. Zero operator lead ownership. Routing commits exclusively to Team Lead unassigned pools.',
  children,
  rightRailExtra,
  wideWorkspace = false,
  onSubmit,
  submitting = false,
  submitLabel = 'Submit Action',
  submitDisabled = false,
  onReset,
  resetLabel = 'Clear',
}: DeckFrameProps) {
  return (
    <div className="space-y-6 pb-12">
      {/* Top Institutional Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
              DATA ENTRY / INTAKE WORKSPACE / {moduleLabel.toUpperCase()}
            </span>
            <span className="text-muted-foreground">•</span>
            <Badge variant="outline" className="font-mono text-xs font-bold uppercase bg-muted/60 border-primary/20">
              {actionCode}
            </Badge>
            <Badge variant="secondary" className="gap-1 font-mono text-[11px] bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
              <Shield className="h-3 w-3 text-teal-600 dark:text-teal-400" />
              Scope: Granted intake · Source-specific grant
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1.5">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <Badge variant="outline" className="gap-1.5 font-mono text-xs py-1 px-2.5 bg-background shadow-xs">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            {statusText}
          </Badge>
          {onSubmit && (
            <Button
              onClick={onSubmit}
              disabled={submitDisabled || submitting}
              className="bg-[#113F3D] hover:bg-[#155451] text-white shadow-xs font-medium text-xs h-9 px-4"
            >
              {submitting ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Processing...
                </>
              ) : (
                submitLabel
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Action Deck Protocol Metadata Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-muted/20 p-3 rounded-lg border border-border text-xs">
        <div>
          <span className="font-semibold text-muted-foreground block uppercase text-[10px] tracking-wider">
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
          <span className="font-semibold text-amber-700 dark:text-amber-400 block uppercase text-[10px] tracking-wider">
            Before It Can Proceed
          </span>
          <p className="text-muted-foreground mt-1 line-clamp-3 leading-relaxed" title={beforeProceed}>
            {beforeProceed}
          </p>
        </div>
        <div>
          <span className="font-semibold text-teal-700 dark:text-teal-400 block uppercase text-[10px] tracking-wider">
            System Commit
          </span>
          <p className="text-muted-foreground mt-1 line-clamp-3 leading-relaxed" title={systemCommit}>
            {systemCommit}
          </p>
        </div>
        <div>
          <span className="font-semibold text-rose-700 dark:text-rose-400 block uppercase text-[10px] tracking-wider">
            Exception & Hold Policy
          </span>
          <p className="text-muted-foreground mt-1 line-clamp-3 leading-relaxed" title={exceptionRule}>
            {exceptionRule}
          </p>
        </div>
      </div>

      {/* Main Grid: Left Main Area + Right-Rail Guidance Stack */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Workspace Column */}
        <div className={`${wideWorkspace ? 'lg:col-span-12' : 'lg:col-span-8'} space-y-6`}>{children}</div>

        {/* Right Rail: 3-Card Guidance Stack */}
        <div className={`${wideWorkspace ? 'lg:col-span-12 lg:grid lg:grid-cols-4 lg:gap-4' : 'lg:col-span-4'} space-y-4`}>
          {/* Card 1: How this works */}
          <Card className="border shadow-xs">
            <CardContent className="p-4 space-y-3">
              <div className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground flex items-center justify-between">
                <span>HOW THIS WORKS</span>
                <span className="font-mono text-[10px] text-muted-foreground font-normal">Workflow</span>
              </div>
              <div className="text-sm font-semibold text-foreground">Operational Action Steps</div>
              <div className="space-y-3 pt-1">
                {steps.map((st, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#113F3D]/10 font-mono text-[10px] font-bold text-[#113F3D] dark:text-teal-300">
                      0{i + 1}
                    </span>
                    <span>{st}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Card 2: When a check fails */}
          <Card className="border shadow-xs">
            <CardContent className="p-4 space-y-2">
              <div className="text-[11px] font-bold tracking-wider uppercase text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>WHEN A CHECK FAILS</span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">{exceptionRule}</p>
            </CardContent>
          </Card>

          {/* Card 3: Permission & Evidence */}
          <Card className="border shadow-xs">
            <CardContent className="p-4 space-y-2">
              <div className="text-[11px] font-bold tracking-wider uppercase text-teal-800 dark:text-teal-300 flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-teal-600" />
                <span>PERMISSION & EVIDENCE</span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">{permissionEvidenceText}</p>
            </CardContent>
          </Card>

          {/* Extra contextual cards if provided */}
          {rightRailExtra}
        </div>
      </div>

      {/* Bottom Sticky Action Bar */}
      {onSubmit && (
        <div className="sticky bottom-0 z-10 -mx-4 -mb-6 bg-background/95 backdrop-blur-sm border-t border-border px-6 py-3 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-4 w-4 text-[#113F3D]" />
            <span>Invariant: Raw payload preserved immutably · Frontline TL queue destination</span>
          </div>
          <div className="flex items-center gap-2">
            {onReset && (
              <Button variant="outline" size="sm" onClick={onReset} disabled={submitting} className="text-xs">
                {resetLabel}
              </Button>
            )}
            <Button
              onClick={onSubmit}
              disabled={submitDisabled || submitting}
              className="bg-[#113F3D] hover:bg-[#155451] text-white shadow-xs font-medium text-xs px-5"
            >
              {submitting ? 'Processing...' : submitLabel}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ====================================================================
// DE-01: Capture a source-backed enquiry
// Deck Pages: P263-P264
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

  // Update targetTeamId and product when vertical changes
  const handleVerticalChange = (v: Vertical) => {
    const teams = TEAMS_BY_VERTICAL[v] || [];
    const products = PRODUCTS_BY_VERTICAL[v] || [];
    setForm((prev) => ({
      ...prev,
      vertical: v,
      targetTeamId: teams[0]?.id || prev.targetTeamId,
      product: products[0] || prev.product,
    }));
  };

  const handleReset = () => {
    setForm({
      prospectName: '',
      phone: '',
      email: '',
      vertical: 'wealth',
      targetTeamId: 'TEAM-WEALTH-ALPHA',
      product: 'V1 Wealth Portfolio',
      sourceId: sources.find((s) => s.status === 'active')?.id || '',
      permissionEvidence: '',
      permissionDate: new Date().toISOString().slice(0, 10),
      needSummary: '',
    });
    setReceipt(null);
    setErrorMsg(null);
  };

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

  const availableTeams = TEAMS_BY_VERTICAL[form.vertical] || [];
  const availableProducts = PRODUCTS_BY_VERTICAL[form.vertical] || [];

  return (
    <DeckFrame
      actionCode="DE-01"
      moduleLabel="New entry"
      title="Capture a source-backed enquiry"
      subtitle="Store immutable raw intake and validate before creating or linking an opportunity [Deck P263]."
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
      submitDisabled={!form.prospectName.trim() || !form.phone.trim() || !form.permissionEvidence.trim()}
      onReset={handleReset}
      rightRailExtra={
        receipt ? (
          <Card className="border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-xs">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                <span>INTAKE VALIDATION RECEIPT</span>
                <Badge
                  className={
                    receipt.status === 'valid'
                      ? 'bg-emerald-600 text-white'
                      : receipt.status === 'duplicate_hold'
                      ? 'bg-amber-600 text-white'
                      : 'bg-rose-600 text-white'
                  }
                >
                  {receipt.status.toUpperCase()}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-1 space-y-2 text-xs">
              <div className="flex items-center justify-between border-b pb-1.5 pt-1">
                <span className="text-muted-foreground">Receipt Reference</span>
                <span className="font-mono font-bold text-foreground">{receipt.id}</span>
              </div>
              <div className="flex items-center justify-between border-b pb-1.5">
                <span className="text-muted-foreground">Duplicate Candidate</span>
                <span className="font-semibold">
                  {receipt.isDuplicate ? `Matched (${receipt.duplicateMatchLeadId})` : 'Clean — None'}
                </span>
              </div>
              {receipt.validationErrors.length > 0 && (
                <div className="bg-rose-50 p-2 rounded border border-rose-200 text-rose-800">
                  <span className="font-semibold block mb-0.5">Validation Errors:</span>
                  <ul className="list-disc list-inside space-y-0.5">
                    {receipt.validationErrors.map((ve, i) => (
                      <li key={i}>{ve.message}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
                {receipt.status === 'valid'
                  ? 'Row validated. Raw payload stored immutably; staged for allocation publication.'
                  : receipt.status === 'duplicate_hold'
                  ? 'Quarantined for duplicate review (DE-04). No frontline outreach allowed.'
                  : 'Held for correction (DE-03). Original source lineage preserved.'}
              </p>
            </CardContent>
          </Card>
        ) : null
      }
    >
      <div className="space-y-4">
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-md flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {errorMsg}
          </div>
        )}

        {/* Prospect & Contact Coordinates Card */}
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FilePlus2 className="h-4 w-4 text-[#113F3D]" />
              Prospect & Contact Coordinates
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
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
                  Primary Mobile Phone (10 Digits) *
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
                  onChange={(e) => handleVerticalChange(e.target.value as Vertical)}
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
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. V1 Wealth Portfolio"
                    value={form.product}
                    onChange={(e) => setForm({ ...form, product: e.target.value })}
                  />
                  <Select
                    className="w-32 text-xs"
                    value=""
                    onChange={(e) => {
                      if (e.target.value) setForm({ ...form, product: e.target.value });
                    }}
                  >
                    <option value="">Quick Pick</option>
                    {availableProducts.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Destination Allocation Team *
                </label>
                <Select
                  value={form.targetTeamId}
                  onChange={(e) => setForm({ ...form, targetTeamId: e.target.value })}
                >
                  {availableTeams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Consent & Provenance Evidence Card */}
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#113F3D]" />
              Consent & Provenance Evidence
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
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
                placeholder="Summary of client's requirements, portfolio size, or stated interest..."
                value={form.needSummary}
                onChange={(e) => setForm({ ...form, needSummary: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </DeckFrame>
  );
}

// ====================================================================
// DE-02: Upload and map a data file
// Deck Pages: P265-P266
// ====================================================================
export function BatchUploadPage() {
  const [sources, setSources] = useState<IntakeSourceSummary[]>([]);
  const [batches, setBatches] = useState<IntakeBatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [stagingRows, setStagingRows] = useState<StagingRow[]>([]);

  const [form, setForm] = useState({
    batchName: '',
    sourceId: '',
    vertical: '' as Vertical,
    targetTeamId: '',
    fileName: 'manual_intake.csv',
    notes: '',
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

  const handleVerticalChange = (v: Vertical) => {
    const teams = TEAMS_BY_VERTICAL[v] || [];
    setForm((prev) => ({
      ...prev,
      vertical: v,
      targetTeamId: teams[0]?.id || prev.targetTeamId,
    }));
    setStagingRows((current) => current.map((row) => ({ ...row, product: '' })));
  };

  const handleUpload = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!stagingRows.length || stagingRows.some((row) => Object.keys(stagingRowErrors(row, PRODUCTS_BY_VERTICAL[form.vertical])).length > 0)) {
      setErrorMsg('Add at least one row and complete every required cell before staging. Use “Show missing fields” to review errors.');
      return;
    }
    setUploading(true);
    try {
      const res = await uploadBatch({
        batchName: form.batchName.trim() || `Batch-${form.vertical.toUpperCase()}-${Date.now().toString().slice(-4)}`,
        sourceId: form.sourceId,
        vertical: form.vertical,
        targetTeamId: form.targetTeamId,
        fileName: form.fileName,
        csvContent: stagingRowsToCsv(stagingRows),
        notes: form.notes,
      });
      setSuccessMsg(`Batch '${res.id}' uploaded successfully (${res.validRows} valid rows, ${res.heldRows} held).`);
      setStagingRows([]);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Batch upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const availableTeams = TEAMS_BY_VERTICAL[form.vertical] || [];

  return (
    <DeckFrame
      actionCode="DE-02"
      moduleLabel="Upload batches"
      title="Upload and map a data file"
      subtitle="Enter prospect rows in aligned columns or import the approved CSV template, then review before staging [Deck P265]."
      steps={[
        'Select the source and vertical for this batch.',
        'Add rows or import a CSV, then review required cells.',
        'Stage validated rows and inspect the batch receipt.',
      ]}
      beforeProceed="Require name, mobile, email, product and permission details for every row. Limit each batch to 500 rows."
      systemCommit="Store file hash, batch ID and row lineage; parse asynchronously with repeat-safe processing."
      reportingConsequence="Quality report reconciles submitted rows to accepted, duplicate, invalid and pending rows."
      exceptionRule="Retry the same batch without duplicating opportunities. A mapping change creates a new reviewed version."
      wideWorkspace
      onSubmit={handleUpload}
      submitting={uploading}
      submitLabel="Upload & Stage Batch"
      submitDisabled={!form.sourceId || !form.vertical || !form.targetTeamId || !form.batchName.trim() || stagingRows.length === 0 || stagingRows.some((row) => Object.keys(stagingRowErrors(row, PRODUCTS_BY_VERTICAL[form.vertical])).length > 0)}
      rightRailExtra={
        <Card className="border border-border bg-muted/20 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
              FORMULA INJECTION SAFEGUARD
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-2 text-xs text-muted-foreground leading-relaxed">
            <p>
              Cells starting with dangerous spreadsheet operators (<code className="bg-muted px-1 rounded font-bold">=, +, -, @</code>) are automatically neutralized with leading single quotes during intake parsing to eliminate CSV formula execution risks.
            </p>
            <p>
              SHA-256 batch hash ensures idempotent ingestion: uploading identical CSV payload is rejected with a 409 conflict to prevent duplicated records.
            </p>
          </CardContent>
        </Card>
      }
    >
      <div className="space-y-4">
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

        {/* Upload Form Card */}
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <UploadCloud className="h-4 w-4 text-[#113F3D]" />
              Batch Metadata & Ingestion Parameters
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Batch Name / Reference *
                </label>
                <Input
                  placeholder="e.g. Apex Strategic Batch B-104"
                  value={form.batchName}
                  onChange={(e) => setForm({ ...form, batchName: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  File Name / Batch Origin
                </label>
                <Input
                  placeholder="intake_leads.csv"
                  value={form.fileName}
                  readOnly
                />
                <p className="mt-1 text-[11px] text-muted-foreground">Set automatically when you import a CSV; manual rows use a generated CSV payload.</p>
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
                  Target Vertical *
                </label>
                <Select
                  value={form.vertical}
                  onChange={(e) => handleVerticalChange(e.target.value as Vertical)}
                >
                  <option value="">Select a vertical</option>
                  <option value="wealth">Wealth Management (V1)</option>
                  <option value="banking">Commercial Banking (V2)</option>
                  <option value="markets">Markets & Trading (V3)</option>
                  <option value="real-estate">Real Estate Advisory (V4)</option>
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
                  <option value="">Select a destination team</option>
                  {availableTeams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <BatchStagingGrid
              rows={stagingRows}
              onChange={setStagingRows}
              onFileNameChange={(fileName) => setForm((previous) => ({ ...previous, fileName }))}
              products={PRODUCTS_BY_VERTICAL[form.vertical] || []}
            />
          </CardContent>
        </Card>

        {/* Staged Batches List Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Layers className="h-4 w-4 text-[#113F3D]" />
              Active & Staged Intake Batches ({batches.length})
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={loadData} className="h-7 text-xs">
              <RefreshCw className="h-3 w-3 mr-1" /> Refresh
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 border-b border-border text-muted-foreground font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Batch ID</th>
                    <th className="p-3">Batch Name</th>
                    <th className="p-3">Source Channel</th>
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
    </DeckFrame>
  );
}

// ====================================================================
// DE-03: Correct rejected intake rows
// Deck Pages: P267-P268
// ====================================================================
export function ValidationCorrectionPage() {
  const [rows, setRows] = useState<IntakeRowSummary[]>([]);
  const [selectedRow, setSelectedRow] = useState<IntakeRowSummary | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterReason, setFilterReason] = useState('ALL');
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
      reason: 'Source contact verification confirmed and updated coordinate.',
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

      setSuccessMsg(`Row '${res.id}' revalidated to status: ${res.status.toUpperCase()}`);
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

  // Filter rows
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const matchSearch =
        !searchTerm.trim() ||
        r.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.parsedName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.parsedPhone.includes(searchTerm);
      const matchReason =
        filterReason === 'ALL' ||
        r.validationErrors.some((ve) => ve.field.toLowerCase().includes(filterReason.toLowerCase()));
      return matchSearch && matchReason;
    });
  }, [rows, searchTerm, filterReason]);

  return (
    <DeckFrame
      actionCode="DE-03"
      moduleLabel="Validation"
      title="Correct rejected intake rows"
      subtitle="Filter errors by reason, correct permitted fields with evidence, and revalidate without losing lineage [Deck P267]."
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
      <div className="space-y-4">
        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-muted/20 p-3 rounded-lg border border-border">
          <div className="relative w-full sm:w-72">
            <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Search reference, name or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 text-xs h-9"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-muted-foreground font-semibold">Filter:</span>
            <Select
              value={filterReason}
              onChange={(e) => setFilterReason(e.target.value)}
              className="text-xs h-9 w-44"
            >
              <option value="ALL">All Rejections</option>
              <option value="phone">Invalid Phone</option>
              <option value="evidence">Missing Consent</option>
              <option value="product">Invalid Product</option>
            </Select>
            <Button variant="ghost" size="sm" onClick={loadRejected} className="h-9 text-xs">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

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

        {/* Quarantined Rows Table + Correction Drawer/Card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Rows List */}
          <div className="lg:col-span-5 space-y-2">
            <Card>
              <CardHeader className="p-3 pb-2 border-b">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>QUARANTINED ROWS ({filteredRows.length})</span>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    Status: Held
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border max-h-[520px] overflow-y-auto">
                  {filteredRows.map((r) => (
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
                  {filteredRows.length === 0 && !loading && (
                    <div className="p-6 text-center text-muted-foreground text-xs">
                      <CheckCircle2 className="h-6 w-6 text-emerald-600 mx-auto mb-2" />
                      Zero rejected rows matching criteria!
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Correction Panel */}
          <div className="lg:col-span-7">
            {selectedRow ? (
              <Card>
                <CardHeader className="p-4 pb-3 border-b">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <FileCheck2 className="h-4 w-4 text-[#113F3D]" />
                      Row Correction · {selectedRow.id}
                    </CardTitle>
                    <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
                      Batch: {selectedRow.batchId ?? 'Manual Direct'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
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
                        Corrected Phone (10 Digits)
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
                        Approved Product Offering
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
                      Correction Reason & Evidence Note *
                    </label>
                    <Textarea
                      rows={2}
                      placeholder="Document source confirmation, customer correction, or verification note..."
                      value={correctionForm.reason}
                      onChange={(e) => setCorrectionForm({ ...correctionForm, reason: e.target.value })}
                    />
                    <span className="text-[11px] text-muted-foreground mt-1 block">
                      Correction reason is immutably appended to row provenance audit ledger. Original raw payload remains unchanged.
                    </span>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={handleCorrect}
                      disabled={submitting || !correctionForm.reason.trim()}
                      className="bg-[#113F3D] hover:bg-[#155451] text-white text-xs h-9 px-4"
                    >
                      {submitting ? 'Revalidating...' : 'Revalidate & Update Row'}
                    </Button>
                  </div>

                  {/* Original Raw Payload comparison */}
                  <div className="pt-3 border-t">
                    <span className="text-xs font-semibold text-muted-foreground block mb-1.5">
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
                Select a quarantined row to review errors and apply validated corrections.
              </Card>
            )}
          </div>
        </div>
      </div>
    </DeckFrame>
  );
}

// ====================================================================
// DE-04: Review a possible duplicate (Twin Cards Architecture)
// Deck Pages: P269-P270
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
      subtitle="Inspect only permitted match fields and enquiry context; link repeat intake or preserve distinct enquiry [Deck P269]."
      steps={[
        'Inspect only permitted match fields and enquiry context.',
        'Link a genuine repeat intake or preserve a distinct enquiry.',
        'Escalate cross-scope identity decisions to the authorised data steward.',
      ]}
      beforeProceed="Same phone does not automatically mean duplicate opportunity. No cross-vertical record disclosure."
      systemCommit="Store reviewed match decision, surviving identifiers and full provenance."
      reportingConsequence="Duplicate intake is excluded from fresh-opportunity counts but remains visible in source quality."
      exceptionRule="Data Entry cannot merge restricted customer identities without a specific steward grant."
      rightRailExtra={
        <Card className="border border-border bg-muted/20 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-[#113F3D]" />
              RESTRICTED PRIVACY BOUNDARIES
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-2 text-xs text-muted-foreground leading-relaxed">
            <p>
              Cross-vertical customer records are legally confidential. Matching candidates in different business lines display obfuscated references to prevent non-permitted prospect browsing [Deck P270].
            </p>
            <p>
              Merging customer master identities is reserved exclusively for authorized Data Stewards (`SA-04`).
            </p>
          </CardContent>
        </Card>
      }
    >
      <div className="space-y-4">
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

        {/* Candidate Selector Bar */}
        <div className="flex items-center justify-between bg-muted/20 p-3 rounded-lg border border-border">
          <div className="flex items-center gap-2 text-xs">
            <Users className="h-4 w-4 text-[#113F3D]" />
            <span className="font-semibold text-foreground">
              Candidate Queue: {duplicates.length} duplicate holds pending review
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={loadDupes} className="h-7 text-xs">
            <RefreshCw className="h-3 w-3 mr-1" /> Refresh Queue
          </Button>
        </div>

        {/* Twin Cards Layout */}
        {selectedDupe ? (
          <div className="space-y-4">
            {/* Restricted Disclosure Notice */}
            <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-lg text-xs space-y-1">
              <div className="font-semibold text-amber-800 flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>Restricted Disclosure Safeguard [Deck P270]</span>
              </div>
              <p className="text-amber-900 leading-relaxed">
                {selectedDupe.safeSummary}
              </p>
            </div>

            {/* Twin Cards Container */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Twin Card: SUBMITTED EVIDENCE */}
              <Card className="border border-border">
                <CardHeader className="bg-muted/30 p-4 pb-3 border-b">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      SUBMITTED EVIDENCE / DECISION REQUEST
                    </CardTitle>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      Row: {selectedDupe.rowId}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-3 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Candidate Prospect</span>
                    <span className="font-bold text-base text-foreground block">{selectedDupe.incomingName}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 border-y py-2">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Primary Phone</span>
                      <span className="font-mono font-semibold">{selectedDupe.incomingPhone}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Target Vertical</span>
                      <Badge variant="secondary" className="font-mono text-[10px] uppercase">
                        {selectedDupe.incomingVertical}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Target Product</span>
                    <span className="font-medium text-foreground">{selectedDupe.incomingProduct}</span>
                  </div>
                  <div className="p-2.5 bg-muted/40 rounded border text-[11px] space-y-1">
                    <span className="font-semibold text-foreground block">Intake Lineage Note:</span>
                    <p className="text-muted-foreground leading-relaxed">
                      Raw enquiry captured under explicit consent. Holds are enforced pending independent identity verification.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Right Twin Card: YOUR AUTHORITY / INDEPENDENT DECISION */}
              <Card className="border border-border">
                <CardHeader className="bg-muted/30 p-4 pb-3 border-b">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      YOUR AUTHORITY / INDEPENDENT DECISION
                    </CardTitle>
                    <Badge
                      className={
                        selectedDupe.isCrossVertical
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                      }
                    >
                      {selectedDupe.isCrossVertical ? 'CROSS-VERTICAL' : 'INTRA-VERTICAL MATCH'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-3 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Existing Match Lead ID</span>
                    <span className="font-mono font-bold text-foreground">{selectedDupe.matchLeadId}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 border-y py-2">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Current Lifecycle Stage</span>
                      <Badge variant="outline" className="font-mono text-[10px] uppercase">
                        {selectedDupe.matchLeadStage}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Origin Vertical</span>
                      <Badge variant="secondary" className="font-mono text-[10px] uppercase">
                        {selectedDupe.matchLeadVertical}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Match Creation Date</span>
                    <span className="text-foreground">{selectedDupe.matchCreatedDate}</span>
                  </div>
                  <div className="p-2.5 bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800 rounded text-[11px] space-y-1">
                    <span className="font-semibold text-teal-800 dark:text-teal-300 block">Decision Protocol:</span>
                    <p className="text-muted-foreground leading-relaxed">
                      Choose distinct enquiry if customer seeks separate commercial product. Choose link if repeat contact.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Decision Submission Panel */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Decision Justification & Provenance Notes *
                  </label>
                  <Textarea
                    rows={2}
                    value={decisionNotes}
                    onChange={(e) => setDecisionNotes(e.target.value)}
                    placeholder="Document rationale for distinct enquiry or repeat intake..."
                  />
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
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
                    className="bg-[#113F3D] hover:bg-[#155451] text-white text-xs h-9 px-4"
                  >
                    Approve as Distinct New Enquiry
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card className="p-12 text-center text-muted-foreground text-xs">
            <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
            <p className="font-semibold text-sm text-foreground">Zero Duplicate Holds Pending</p>
            <p className="mt-1">All incoming enquiries have been verified and processed cleanly.</p>
          </Card>
        )}
      </div>
    </DeckFrame>
  );
}

// ====================================================================
// DE-05: Publish valid rows to allocation (Twin Cards Architecture)
// Deck Pages: P271-P272
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
      subtitle="Publish validated, permitted records to frontline allocation queue once per intake key [Deck P271]."
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
      rightRailExtra={
        <Card className="border border-border bg-muted/20 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <UserCheck className="h-3.5 w-3.5 text-[#113F3D]" />
              ZERO OPERATOR OWNERSHIP
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-2 text-xs text-muted-foreground leading-relaxed">
            <p>
              Data Entry personnel never acquire individual ownership of customer records (<code className="bg-muted px-1 rounded font-bold">owner_employee_id: NULL</code>).
            </p>
            <p>
              Published leads route directly to the designated Team Lead unassigned pool (<code className="bg-muted px-1 rounded font-bold">TL-02/03</code>) for institutional frontline allocation.
            </p>
          </CardContent>
        </Card>
      }
    >
      <div className="space-y-4">
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-md">
            {errorMsg}
          </div>
        )}

        {/* Publication Receipt Banner */}
        {receipt && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-xs space-y-2 text-emerald-950">
            <div className="flex items-center justify-between font-bold text-sm text-emerald-900">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                <span>Batch {receipt.batchId} Successfully Published!</span>
              </div>
              <Badge className="bg-emerald-700 text-white font-mono text-xs">
                {receipt.publishedCount} Leads Enqueued
              </Badge>
            </div>
            <p>
              Published leads routed to <strong>{receipt.targetTeamName}</strong> unassigned pool. Team Lead can allocate immediately.
            </p>
            <div className="pt-2 border-t border-emerald-200/80">
              <span className="font-semibold block mb-1">Generated Canonical Lead IDs:</span>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                {receipt.canonicalLeadIds.map((cid) => (
                  <Badge key={cid} variant="outline" className="font-mono text-[10px] bg-white">
                    {cid}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Batches Selection Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-2 border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Layers className="h-4 w-4 text-[#113F3D]" />
              Select Batch for Allocation Publication
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={loadBatches} className="h-7 text-xs">
              <RefreshCw className="h-3 w-3 mr-1" /> Refresh
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 border-b border-border text-muted-foreground font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="p-3 w-10">Select</th>
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

        {/* Twin Cards: BATCH SPECIFICATION vs ALLOCATION TARGET */}
        {selectedBatch && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Card: BATCH PUBLISHING SPECIFICATION */}
            <Card className="border border-border">
              <CardHeader className="bg-muted/30 p-4 pb-3 border-b">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  BATCH PUBLISHING SPECIFICATION
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-xs">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Selected Batch</span>
                  <span className="font-bold text-sm text-foreground">{selectedBatch.batchName} ({selectedBatch.id})</span>
                </div>
                <div className="grid grid-cols-2 gap-2 border-y py-2">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Valid Clean Rows</span>
                    <span className="font-mono font-bold text-emerald-700 text-base">{selectedBatch.validRows}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Held / Quarantined</span>
                    <span className="font-mono font-bold text-rose-700 text-base">{selectedBatch.heldRows}</span>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Source Attribution</span>
                  <span className="text-foreground">{selectedBatch.sourceName}</span>
                </div>
              </CardContent>
            </Card>

            {/* Right Card: ALLOCATION COMMITMENT & TARGET */}
            <Card className="border border-border">
              <CardHeader className="bg-muted/30 p-4 pb-3 border-b">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  ALLOCATION COMMITMENT & TARGET
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-xs">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Destination Team</span>
                  <span className="font-bold text-sm text-foreground">{selectedBatch.teamName}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 border-y py-2">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Target Vertical</span>
                    <Badge variant="outline" className="font-mono text-[10px] uppercase">
                      {selectedBatch.vertical}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Routing Queue</span>
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      TL Unassigned Pool
                    </Badge>
                  </div>
                </div>
                <div className="p-2.5 bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800 rounded text-[11px]">
                  ✓ Idempotent commitment: re-publishing same batch is duplicate-safe.
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DeckFrame>
  );
}

// ====================================================================
// DE-06: Maintain source evidence and contact provenance
// Deck Pages: P273-P274
// ====================================================================
export function SourceRegisterPage() {
  const [activeTab, setActiveTab] = useState<'provenance' | 'sources'>('provenance');
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
      subtitle="Open source records, verify evidence completeness, and maintain contact provenance [Deck P273]."
      steps={[
        'Open a source record and inspect evidence completeness.',
        'Submit a correction or renewed source document.',
        'Flag invalid source evidence for the accountable owner.',
      ]}
      beforeProceed="Source approval is a distinct permission. Data Entry cannot invent customer permission or override suppression."
      systemCommit="Version provenance and notify the policy/source owner about missing evidence."
      reportingConsequence="Report source completeness and held batches by cause."
      exceptionRule="Source suspension holds dependent new outreach until an approved resolution."
      rightRailExtra={
        <Card className="border border-border bg-muted/20 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />
              SOURCE SUSPENSION GOVERNANCE
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-2 text-xs text-muted-foreground leading-relaxed">
            <p>
              When a source channel is marked <strong>SUSPENDED</strong>, new intake ingestion is blocked immediately across all batch and direct enquiry channels.
            </p>
            <p>
              Existing records derived from that source are placed on policy hold for National Manager and Compliance inspection.
            </p>
          </CardContent>
        </Card>
      }
    >
      <div className="space-y-4">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b pb-3">
          <Button
            variant={activeTab === 'provenance' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('provenance')}
            className={activeTab === 'provenance' ? 'bg-[#113F3D] text-white text-xs' : 'text-xs'}
          >
            <History className="h-3.5 w-3.5 mr-1.5" />
            Prospect Contact Provenance (Deck P273)
          </Button>
          <Button
            variant={activeTab === 'sources' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('sources')}
            className={activeTab === 'sources' ? 'bg-[#113F3D] text-white text-xs' : 'text-xs'}
          >
            <Database className="h-3.5 w-3.5 mr-1.5" />
            Source Register & Suspension Governance
          </Button>
        </div>

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

        {/* Tab A: Prospect Contact Provenance (Matching Deck P273) */}
        {activeTab === 'provenance' && (
          <div className="space-y-4">
            {/* Customer Context Top Card */}
            <Card className="border border-border">
              <CardHeader className="bg-muted/20 p-4 pb-3 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs bg-muted px-2 py-0.5 rounded">
                      FV-1042
                    </span>
                    <CardTitle className="text-sm font-semibold">
                      Aarav Shah · Contact Provenance & Evidence Trace
                    </CardTitle>
                  </div>
                  <Badge variant="outline" className="gap-1 font-mono text-[10px] text-emerald-700 bg-emerald-50">
                    <CheckCircle2 className="h-3 w-3" />
                    Verified Consent Trace
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-4 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Primary Contact</span>
                    <span className="font-semibold text-foreground">+91 98765 43210</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Email Address</span>
                    <span className="font-semibold text-foreground">aarav.shah@invest.test</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Authorized Source</span>
                    <span className="font-semibold text-foreground">Apex Strategic Co-Marketing</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Legal Basis</span>
                    <span className="font-semibold text-foreground">Explicit Web Opt-In Form</span>
                  </div>
                </div>

                <div className="p-3 bg-muted/30 rounded border space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-foreground">Consent Document Hash:</span>
                    <span className="font-mono text-muted-foreground">sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-foreground">Evidence Reference:</span>
                    <span className="font-mono text-muted-foreground">WEB-OPTIN-2026-10-15-9921 (Timestamp: 2026-10-15T09:30:00Z)</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Provenance & Interaction Timeline */}
            <Card>
              <CardHeader className="p-4 pb-3 border-b">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[#113F3D]" />
                  Intake Lineage & Interaction History (Deck P273)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="relative pl-6 border-l-2 border-border space-y-6 text-xs">
                  {/* Event 1 */}
                  <div className="relative">
                    <span className="absolute -left-[31px] top-0 size-4 rounded-full bg-emerald-600 ring-4 ring-background" />
                    <div>
                      <span className="font-bold text-foreground">Explicit Consent Logged</span>
                      <span className="text-muted-foreground ml-2 text-[11px]">2026-10-15 09:30 IST</span>
                    </div>
                    <p className="text-muted-foreground mt-0.5">
                      Customer submitted web inquiry on partner portal. OTP verification confirmed against registered mobile.
                    </p>
                  </div>

                  {/* Event 2 */}
                  <div className="relative">
                    <span className="absolute -left-[31px] top-0 size-4 rounded-full bg-[#113F3D] ring-4 ring-background" />
                    <div>
                      <span className="font-bold text-foreground">Intake Ingestion & Validation</span>
                      <span className="text-muted-foreground ml-2 text-[11px]">2026-10-15 09:31 IST</span>
                    </div>
                    <p className="text-muted-foreground mt-0.5">
                      Ingested by Data Entry (Deepa Patel · EMP-015). Validated without duplicate conflict; raw CSV payload locked.
                    </p>
                  </div>

                  {/* Event 3 */}
                  <div className="relative">
                    <span className="absolute -left-[31px] top-0 size-4 rounded-full bg-blue-600 ring-4 ring-background" />
                    <div>
                      <span className="font-bold text-foreground">Enqueued to Team Lead Pool</span>
                      <span className="text-muted-foreground ml-2 text-[11px]">2026-10-15 09:35 IST</span>
                    </div>
                    <p className="text-muted-foreground mt-0.5">
                      Published to Wealth Alpha unassigned queue (owner: NULL). Tara Iyer (TL-02) assigned to Vikramaditya.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tab B: Source Register & Suspension Governance */}
        {activeTab === 'sources' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Source Register Form */}
            <div className="lg:col-span-5 space-y-4">
              <Card>
                <CardHeader className="p-4 pb-3 border-b">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Plus className="h-4 w-4 text-[#113F3D]" />
                    Register Ingestion Source
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
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

                  <div className="pt-2">
                    <Button
                      onClick={handleCreateSource}
                      disabled={submitting || !form.sourceCode.trim() || !form.sourceName.trim()}
                      className="bg-[#113F3D] hover:bg-[#155451] text-white text-xs w-full h-9"
                    >
                      {submitting ? 'Registering...' : 'Register Ingestion Source'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sources Table */}
            <div className="lg:col-span-7 space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between p-4 pb-2 border-b">
                  <CardTitle className="text-sm font-semibold">Registered Sources & Provenance</CardTitle>
                  <Button variant="ghost" size="sm" onClick={loadSources} className="h-7 text-xs">
                    <RefreshCw className="h-3 w-3 mr-1" /> Refresh
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/40 border-b border-border text-muted-foreground font-semibold uppercase text-[10px]">
                        <tr>
                          <th className="p-3">Source</th>
                          <th className="p-3">Collection Basis</th>
                          <th className="p-3">Permitted Verticals</th>
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
                            <td className="p-3 max-w-[180px] truncate" title={s.collectionBasis}>
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
        )}
      </div>
    </DeckFrame>
  );
}

// ====================================================================
// DE-07: Export an intake quality report (Twin Cards Architecture)
// Deck Pages: P275-P276
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
      // Trigger browser download if URL provided
      if (res.downloadUrl) {
        window.open(res.downloadUrl, '_blank');
      }
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
      subtitle="Reconcile submitted rows to accepted, duplicate and invalid rows with tamper-evident PDF export [Deck P275]."
      steps={[
        'Select period and source filters.',
        'Inspect batch-to-row reconciliation.',
        'Generate a scoped PDF and correction worklist.',
      ]}
      beforeProceed="Report exposes only permitted intake data and minimal customer identifiers."
      systemCommit="Generate versioned export with cutoff, evidence status and download audit."
      reportingConsequence="Data-entry performance is data quality and timeliness, not the associates sales outcomes."
      exceptionRule="A batch still processing is labelled incomplete and not counted as fully accepted."
      rightRailExtra={
        <Card className="border border-border bg-muted/20 shadow-xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
              <Download className="h-3.5 w-3.5 text-[#113F3D]" />
              TAMPER-EVIDENT EXPORT LOG
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-2 text-xs text-muted-foreground leading-relaxed">
            <p>
              Every exported document generates a SHA-256 integrity hash recorded in <code className="bg-muted px-1 rounded font-bold">intake_export_audits</code> with requesting operator ID (<code className="bg-muted px-1 rounded font-bold">EMP-015</code>).
            </p>
            <p>
              PDF reports stream binary content with authentic institutional letterhead and data-entry quality score reconciliation.
            </p>
          </CardContent>
        </Card>
      }
    >
      <div className="space-y-6">
        {/* Period Selector Tabs & Export Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
          <div className="flex flex-wrap gap-1.5">
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
                className={period === p.id ? 'bg-[#113F3D] text-white text-xs' : 'text-xs'}
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

        {/* Twin Cards Layout: REPORT DEFINITION vs SELECTED SCOPE (Deck P275) */}
        {report && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Card: REPORT DEFINITION */}
            <Card className="border border-border">
              <CardHeader className="bg-muted/30 p-4 pb-3 border-b">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>REPORT DEFINITION</span>
                  <Badge variant="outline" className="font-mono text-[10px] uppercase">
                    Period: {period}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3 border-b pb-3">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Total Intake Submitted</span>
                    <span className="font-bold font-mono text-xl text-foreground">{report.summary.totalSubmitted}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Published to Allocation</span>
                    <span className="font-bold font-mono text-xl text-emerald-700">{report.summary.totalPublished}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center border-b pb-3">
                  <div className="bg-muted/30 p-2 rounded">
                    <span className="text-muted-foreground block text-[10px]">Error Rate %</span>
                    <span className="font-mono font-bold text-rose-700">{report.summary.errorRatePct}%</span>
                  </div>
                  <div className="bg-muted/30 p-2 rounded">
                    <span className="text-muted-foreground block text-[10px]">Duplicate Rate %</span>
                    <span className="font-mono font-bold text-amber-700">{report.summary.duplicateRatePct}%</span>
                  </div>
                  <div className="bg-muted/30 p-2 rounded">
                    <span className="text-muted-foreground block text-[10px]">Avg Turnaround</span>
                    <span className="font-mono font-bold text-foreground">{report.summary.avgTurnaroundMinutes}m</span>
                  </div>
                </div>

                <div className="text-[11px] text-muted-foreground leading-relaxed">
                  Data-entry performance measures intake compliance and data hygiene timeliness, entirely independent of frontline sales outcomes.
                </div>
              </CardContent>
            </Card>

            {/* Right Card: SELECTED SCOPE & QUALITY METRICS */}
            <Card className="border border-border">
              <CardHeader className="bg-muted/30 p-4 pb-3 border-b">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>SELECTED SCOPE & QUALITY METRICS</span>
                  <span className="font-mono text-xs font-bold text-emerald-700">
                    Quality Score: {100 - Number(report.summary.errorRatePct)}%
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4 text-xs">
                {/* Horizontal Progress Bars matching Deck P275 */}
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="font-semibold text-emerald-700">Completed & Published</span>
                      <span className="font-mono font-bold text-emerald-700">
                        {report.summary.totalPublished} rows ({report.summary.totalSubmitted > 0 ? Math.round((report.summary.totalPublished / report.summary.totalSubmitted) * 100) : 100}%)
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-emerald-600 h-2 rounded-full"
                        style={{
                          width: `${report.summary.totalSubmitted > 0 ? Math.min(100, Math.round((report.summary.totalPublished / report.summary.totalSubmitted) * 100)) : 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="font-semibold text-blue-700">In Progress / Validated Staged</span>
                      <span className="font-mono font-bold text-blue-700">
                        {report.summary.totalHeld} rows
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{
                          width: `${report.summary.totalSubmitted > 0 ? Math.min(100, Math.round((report.summary.totalHeld / report.summary.totalSubmitted) * 100)) : 10}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="font-semibold text-amber-700">Needs Review / Duplicate Holds</span>
                      <span className="font-mono font-bold text-amber-700">
                        {report.summary.totalDuplicate} rows ({report.summary.duplicateRatePct}%)
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-amber-500 h-2 rounded-full"
                        style={{
                          width: `${Math.min(100, Number(report.summary.duplicateRatePct) || 5)}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="font-semibold text-rose-700">Excluded / Validation Rejected</span>
                      <span className="font-mono font-bold text-rose-700">
                        {report.summary.totalRejected} rows ({report.summary.errorRatePct}%)
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-rose-600 h-2 rounded-full"
                        style={{
                          width: `${Math.min(100, Number(report.summary.errorRatePct) || 5)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Batch-to-Row Reconciliation Table */}
        {report && (
          <Card>
            <CardHeader className="p-4 pb-2 border-b">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-[#113F3D]" />
                Batch-to-Row Intake Quality Reconciliation
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/40 border-b border-border text-muted-foreground font-semibold uppercase text-[10px]">
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
