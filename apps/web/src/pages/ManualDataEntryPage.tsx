import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  Filter,
  Layers,
  MapPin,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  Send,
  Shield,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import type { ManualProspectInput, ManualProspectRecord, Vertical } from '@finverse/contracts';
import { useSession } from '../lib/session';
import {
  getManualProspect,
  listManualProspects,
  publishManualProspect,
  saveManualProspect,
} from '../lib/data-entry-api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { FieldError, Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { BulkProspectImportTab } from '../components/data-entry/BulkProspectImportTab';

const VERTICAL_LABELS: Record<Vertical, string> = {
  wealth: 'Wealth Management',
  banking: 'Commercial Banking',
  markets: 'Markets & Trading',
  'real-estate': 'Real Estate Advisory',
  real_estate: 'Real Estate Advisory',
};

function blankForm(): ManualProspectInput {
  return {
    prospectName: '',
    mobileNumber: '',
    email: '',
    whatsappNumber: '',
    location: '',
    vertical: '' as Vertical,
    isPriority: false,
  };
}

export function ManualDataEntryPage() {
  const { session } = useSession();
  const [entryMode, setEntryMode] = useState<'manual' | 'bulk'>('manual');
  const [form, setForm] = useState<ManualProspectInput>(blankForm);
  const [records, setRecords] = useState<ManualProspectRecord[]>([]);
  const [verified, setVerified] = useState<ManualProspectRecord | null>(null);
  const [verificationSource, setVerificationSource] = useState<'save' | 'verify'>('save');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  // Search & filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [verticalFilter, setVerticalFilter] = useState<string>('ALL');

  // Filter operator's valid grants
  const grants = useMemo(() => {
    const raw = session?.verticalGrants ?? [];
    const normalized = raw.map((v) => (v === 'real-estate' ? 'real_estate' : v));
    const set = new Set<string>(normalized);
    const order: Vertical[] = ['wealth', 'banking', 'markets', 'real_estate'];
    return order.filter((v) => set.has(v));
  }, [session]);

  const loadRecords = useCallback(async (query?: string) => {
    try {
      setLoading(true);
      const data = await listManualProspects(query);
      setRecords(data);
      setErrorMessage(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not load saved records from database.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRecords(searchQuery);
  }, [loadRecords, searchQuery]);

  const setField = (key: keyof ManualProspectInput, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const handleSave = async () => {
    setErrorMessage(null);
    setVerified(null);
    const nextErrors: Record<string, string> = {};

    if (form.prospectName.trim().length < 2) {
      nextErrors.prospectName = 'Enter a prospect name of at least 2 characters.';
    }
    if (form.mobileNumber.trim().length < 10) {
      nextErrors.mobileNumber = 'Enter a valid 10-digit Indian mobile number.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      nextErrors.email = 'Enter a valid email address.';
    }
    if (!form.vertical || !grants.includes(form.vertical)) {
      nextErrors.vertical = 'Select a vertical from your current assignment.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    try {
      // 1. Submit prospect record to database
      const saved = await saveManualProspect({ ...form, publishImmediately: true });

      // Read back the committed intake row and its caller assignment.
      const recordToShow = await getManualProspect(saved.id);

      // 3. Confirm readback
      setVerificationSource('save');
      setVerified(recordToShow);
      setForm(blankForm());
      setErrors({});
      await loadRecords(searchQuery);
    } catch (err: any) {
      // Never claim database confirmation on error
      setVerified(null);
      if (err.details?.fieldErrors) {
        setErrors(
          Object.fromEntries(
            Object.entries(err.details.fieldErrors).map(([key, value]) => [
              key,
              (value as string[])[0] ?? 'Invalid value.',
            ])
          )
        );
      }
      setErrorMessage(err.message || 'Could not save or verify this prospect record.');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (id: string) => {
    setErrorMessage(null);
    setPublishingId(id);
    try {
      const published = await publishManualProspect(id);
      setVerificationSource('verify');
      setVerified(published);
      await loadRecords(searchQuery);
    } catch (err: any) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not publish prospect to sales caller.');
    } finally {
      setPublishingId(null);
    }
  };

  const handleVerify = async (id: string) => {
    setErrorMessage(null);
    setVerifyingId(id);
    try {
      // Independent database readback
      const readBack = await getManualProspect(id);
      setVerificationSource('verify');
      setVerified(readBack);
    } catch (err) {
      setVerified(null);
      setErrorMessage(err instanceof Error ? err.message : 'Could not verify this record from database.');
    } finally {
      setVerifyingId(null);
    }
  };

  // Filtered records for display
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchVertical = verticalFilter === 'ALL' || r.vertical === verticalFilter;
      return matchVertical;
    });
  }, [records, verticalFilter]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      {/* Top Header & Institutional Scope */}
      <header className="border-b border-border pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            DATA ENTRY / MANUAL RECORDS / ENTER & VERIFY
          </p>
          <Badge variant="secondary" className="gap-1 font-mono text-[11px]">
            <Shield className="h-3 w-3 text-[#113F3D]" />
            Operator: {session?.employeeId || 'EMP-015'}
          </Badge>
        </div>
        <h1 className="mt-1 font-heading text-2xl font-bold tracking-tight text-foreground">
          Enter and verify prospect data
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Select an authorized vertical from your assignments, save the prospect record to PostgreSQL, and independently confirm the database readback below.
        </p>
      </header>

      {/* Mode Switcher Tabs */}
      <div className="flex border-b border-border gap-2" role="tablist" aria-label="Data Entry Modes">
        <button
          type="button"
          role="tab"
          id="tab-manual-entry"
          aria-selected={entryMode === 'manual'}
          onClick={() => setEntryMode('manual')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            entryMode === 'manual'
              ? 'border-[#113F3D] text-[#113F3D] font-bold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Database className="h-4 w-4" />
          Single Manual Entry
        </button>
        <button
          type="button"
          role="tab"
          id="tab-bulk-import"
          aria-selected={entryMode === 'bulk'}
          onClick={() => setEntryMode('bulk')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            entryMode === 'bulk'
              ? 'border-[#113F3D] text-[#113F3D] font-bold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Layers className="h-4 w-4" />
          Bulk Spreadsheet Import
        </button>
      </div>

      {entryMode === 'bulk' ? (
        <BulkProspectImportTab grants={grants} />
      ) : (
        <>
          {/* Error Alert — shown when save or readback fails */}
          {errorMessage && (
            <div
              role="alert"
              aria-live="assertive"
              className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 shadow-xs"
            >
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-rose-600" aria-hidden="true" />
              <div>
                <strong className="block font-semibold">Verification failed</strong>
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

      {/* Database Readback Confirmation Card */}
      {verified && (
        <div
          role="status"
          aria-live="polite"
          className={`rounded-lg border p-4 text-sm shadow-xs space-y-3 ${
            verified.status === 'published'
              ? 'border-emerald-200 bg-emerald-50/90 dark:bg-emerald-950/20 text-emerald-950'
              : verified.status === 'unassigned_exception'
              ? 'border-rose-200 bg-rose-50/90 dark:bg-rose-950/20 text-rose-950'
              : 'border-amber-200 bg-amber-50/90 dark:bg-amber-950/20 text-amber-950'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 border-current/20">
            <div className="flex items-center gap-2">
              {verified.status === 'published' ? (
                <CheckCircle2 className="size-5 text-emerald-700" aria-hidden="true" />
              ) : verified.status === 'unassigned_exception' ? (
                <AlertCircle className="size-5 text-rose-700" aria-hidden="true" />
              ) : (
                <Clock className="size-5 text-amber-700" aria-hidden="true" />
              )}
              <strong className="text-base font-bold">
                {verified.status === 'published'
                  ? 'Published & Assigned to Sales Caller'
                  : verified.status === 'unassigned_exception'
                  ? 'Routing Exception — Held in Unassigned Queue'
                  : 'Staged Draft — Saved in PostgreSQL (Not Assigned)'}
              </strong>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs">
              <Badge
                className={
                  verified.status === 'published'
                    ? 'bg-emerald-700 text-white font-mono'
                    : verified.status === 'unassigned_exception'
                    ? 'bg-rose-700 text-white font-mono'
                    : 'bg-amber-600 text-white font-mono'
                }
              >
                STATUS: {verified.status.toUpperCase()}
              </Badge>
              <Badge variant="outline" className="border-current/30 text-current">
                {verificationSource === 'save' ? 'Immediate Readback' : 'Manual Re-verification'}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="opacity-80 block font-semibold text-[11px] uppercase">
                Prospect Name
              </span>
              <span className="font-bold text-foreground text-sm">{verified.prospectName}</span>
            </div>
            <div>
              <span className="opacity-80 block font-semibold text-[11px] uppercase">
                Persisted Vertical
              </span>
              <Badge variant="secondary" className="font-medium text-xs mt-0.5">
                {VERTICAL_LABELS[verified.vertical] ?? verified.vertical}
              </Badge>
            </div>
            <div>
              <span className="opacity-80 block font-semibold text-[11px] uppercase">
                Contact Coordinates
              </span>
              <span className="font-mono text-foreground block">{verified.mobileNumber}</span>
              <span className="text-muted-foreground truncate block">{verified.email}</span>
            </div>
            <div>
              <span className="opacity-80 block font-semibold text-[11px] uppercase">
                PostgreSQL Record ID
              </span>
              <span className="font-mono font-bold text-foreground block">{verified.id}</span>
              <span className="text-[11px] text-muted-foreground block">
                {new Date(verified.savedAt).toLocaleString()}
              </span>
            </div>
            {verified.isPriority && (
              <div>
                <span className="opacity-80 block font-semibold text-[11px] uppercase">
                  Priority Flag
                </span>
                <Badge className="bg-amber-500/20 text-amber-900 border-amber-300 dark:text-amber-200 font-bold text-[10px] uppercase mt-0.5">
                  ★ Priority Lead
                </Badge>
              </div>
            )}
            {verified.publishedLeadId && (
              <div>
                <span className="opacity-80 block font-semibold text-[11px] uppercase">
                  Canonical Lead ID
                </span>
                <span className="font-mono font-bold text-foreground block">{verified.publishedLeadId}</span>
              </div>
            )}
            {verified.assignedCallerName && (
              <div>
                <span className="opacity-80 block font-semibold text-[11px] uppercase">
                  Assigned Sales Caller
                </span>
                <span className="font-semibold text-foreground block">
                  {verified.assignedCallerName} <span className="font-mono text-muted-foreground text-[10px]">({verified.assignedCallerId})</span>
                </span>
                {verified.assignedTeamId && (
                  <span className="font-mono text-[10px] text-muted-foreground block">Team: {verified.assignedTeamId}</span>
                )}
              </div>
            )}
          </div>

          {(verified.whatsappNumber || verified.location) && (
            <div className="flex flex-wrap gap-4 pt-1 text-xs border-t border-current/20">
              {verified.whatsappNumber && (
                <span className="flex items-center gap-1">
                  <MessageSquare className="size-3.5" /> WhatsApp: <strong>{verified.whatsappNumber}</strong>
                </span>
              )}
              {verified.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5" /> Location: <strong>{verified.location}</strong>
                </span>
              )}
            </div>
          )}

          {verified.status === 'staged' && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-md bg-amber-500/15 border border-amber-300 text-amber-950 dark:text-amber-200">
              <div className="flex items-start gap-2 text-xs">
                <AlertTriangle className="size-4 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <strong className="block font-semibold">Staged Draft Notice — Not Assigned to Caller</strong>
                  <span>This prospect is saved as a staged draft in PostgreSQL. It will not reach a Sales Caller until you publish it.</span>
                </div>
              </div>
              <Button
                type="button"
                onClick={() => void handlePublish(verified.id)}
                disabled={publishingId === verified.id}
                className="bg-[#113F3D] text-white hover:bg-[#155451] text-xs px-3.5 py-1.5 h-8 shrink-0 font-semibold"
              >
                {publishingId === verified.id ? (
                  <RefreshCw className="size-3.5 animate-spin mr-1.5" />
                ) : (
                  <Send className="size-3.5 mr-1.5" />
                )}
                Publish to Caller Queue
              </Button>
            </div>
          )}

          {verified.status === 'unassigned_exception' && (
            <div className="p-3 rounded-md bg-rose-500/15 border border-rose-300 text-rose-950 dark:text-rose-200 text-xs">
              <strong className="block font-semibold">Routing Exception Reason:</strong>
              <span>{verified.routingExceptionReason || 'No eligible Sales Callers available in this vertical/team. Lead is held in unassigned queue for Team Lead allocation.'}</span>
            </div>
          )}

          <p className="text-[11px] opacity-80 pt-1 leading-relaxed">
            Record is confirmed in PostgreSQL under operator ID <strong>{verified.operatorId || session?.employeeId || 'EMP-015'}</strong>.
          </p>
        </div>
      )}

      {/* 1. Manual Entry Form Card */}
      <Card>
        <CardHeader className="border-b border-border pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Database className="size-4 text-[#113F3D]" aria-hidden="true" />
            Manual Prospect Entry Form
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 p-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSave();
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Prospect Name */}
              <div>
                <label htmlFor="de-name" className="mb-1 block text-xs font-semibold">
                  Prospect Name *
                </label>
                <Input
                  id="de-name"
                  name="prospectName"
                  autoComplete="name"
                  placeholder="e.g. Rameshwar Singhania"
                  value={form.prospectName}
                  onChange={(e) => setField('prospectName', e.target.value)}
                  aria-required="true"
                  aria-invalid={Boolean(errors.prospectName)}
                  aria-describedby={errors.prospectName ? 'de-name-error' : undefined}
                />
                {errors.prospectName && (
                  <FieldError id="de-name-error">{errors.prospectName}</FieldError>
                )}
              </div>

              {/* Vertical Selection */}
              <div>
                <label htmlFor="de-vertical" className="mb-1 block text-xs font-semibold">
                  Vertical *
                </label>
                <Select
                  id="de-vertical"
                  name="vertical"
                  value={form.vertical}
                  onChange={(e) => setField('vertical', e.target.value as Vertical)}
                  aria-required="true"
                  aria-invalid={Boolean(errors.vertical)}
                  aria-describedby={errors.vertical ? 'de-vertical-error' : undefined}
                >
                  <option value="">Select an assigned vertical</option>
                  {grants.map((vertical) => (
                    <option key={vertical} value={vertical}>
                      {VERTICAL_LABELS[vertical]}
                    </option>
                  ))}
                </Select>
                {errors.vertical && (
                  <FieldError id="de-vertical-error">{errors.vertical}</FieldError>
                )}
              </div>

              {/* Primary Mobile */}
              <div>
                <label htmlFor="de-mobile" className="mb-1 block text-xs font-semibold">
                  Primary Mobile Number *
                </label>
                <Input
                  id="de-mobile"
                  name="mobileNumber"
                  type="tel"
                  autoComplete="tel"
                  placeholder="+91 98765 43210"
                  value={form.mobileNumber}
                  onChange={(e) => setField('mobileNumber', e.target.value)}
                  aria-required="true"
                  aria-invalid={Boolean(errors.mobileNumber)}
                  aria-describedby={errors.mobileNumber ? 'de-mobile-error' : undefined}
                />
                {errors.mobileNumber && (
                  <FieldError id="de-mobile-error">{errors.mobileNumber}</FieldError>
                )}
              </div>

              {/* Email Address */}
              <div>
                <label htmlFor="de-email" className="mb-1 block text-xs font-semibold">
                  Email Address *
                </label>
                <Input
                  id="de-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="prospect@domain.test"
                  value={form.email}
                  onChange={(e) => setField('email', e.target.value)}
                  aria-required="true"
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'de-email-error' : undefined}
                />
                {errors.email && (
                  <FieldError id="de-email-error">{errors.email}</FieldError>
                )}
              </div>

              {/* Optional WhatsApp Number */}
              <div>
                <label htmlFor="de-whatsapp" className="mb-1 block text-xs font-semibold">
                  WhatsApp number <span className="font-normal text-muted-foreground">optional</span>
                </label>
                <Input
                  id="de-whatsapp"
                  name="whatsappNumber"
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={form.whatsappNumber ?? ''}
                  onChange={(e) => setField('whatsappNumber', e.target.value)}
                  aria-invalid={Boolean(errors.whatsappNumber)}
                  aria-describedby={errors.whatsappNumber ? 'de-whatsapp-error' : undefined}
                />
                {errors.whatsappNumber && (
                  <FieldError id="de-whatsapp-error">{errors.whatsappNumber}</FieldError>
                )}
              </div>

              {/* Optional Location */}
              <div>
                <label htmlFor="de-location" className="mb-1 block text-xs font-semibold">
                  Location <span className="font-normal text-muted-foreground">optional</span>
                </label>
                <Input
                  id="de-location"
                  name="location"
                  placeholder="e.g. Bangalore, Karnataka"
                  value={form.location ?? ''}
                  onChange={(e) => setField('location', e.target.value)}
                  aria-invalid={Boolean(errors.location)}
                  aria-describedby={errors.location ? 'de-location-error' : undefined}
                />
                {errors.location && (
                  <FieldError id="de-location-error">{errors.location}</FieldError>
                )}
              </div>

              {/* Priority Flag Toggle */}
              <div className="sm:col-span-2 rounded-lg border border-border bg-secondary/30 p-3 flex items-center justify-between">
                <div>
                  <label htmlFor="de-priority" className="font-semibold text-xs text-foreground flex items-center gap-1.5 cursor-pointer">
                    <span className="text-amber-500 font-bold">★</span> Mark as Priority Lead
                  </label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Flags this prospect for immediate caller prioritization in the Lead Inbox.
                  </p>
                </div>
                <input
                  id="de-priority"
                  type="checkbox"
                  checked={form.isPriority ?? false}
                  onChange={(e) => setForm((prev) => ({ ...prev, isPriority: e.target.checked }))}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                />
              </div>
            </div>

            {/* Bottom Actions & Boundary Notice */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <p className="flex max-w-lg items-start gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="size-4 shrink-0 text-[#113F3D]" aria-hidden="true" />
                <span>
                  <strong>Intake Workflow:</strong> Submitting creates the prospect in the selected vertical and assigns an available Sales Caller by round-robin. The receipt names the assigned caller; other callers cannot see this lead. Previously saved drafts can be published from the table below.
                </span>
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setForm(blankForm());
                    setErrors({});
                    setErrorMessage(null);
                  }}
                  disabled={saving}
                  className="text-xs"
                >
                  Clear Form
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={saving || grants.length === 0}
                  className="bg-[#113F3D] text-white hover:bg-[#155451] shadow-xs font-semibold text-xs px-4"
                >
                  <Send className="mr-1.5 size-3.5" aria-hidden="true" />
                  {saving ? 'Publishing...' : 'Save & Assign Caller'}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 2. Searchable Saved Records Table with Verify Action */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-3">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Layers className="size-4 text-[#113F3D]" aria-hidden="true" />
              My Saved Records ({records.length})
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Records persisted in PostgreSQL under operator ID {session?.employeeId}. Click Verify to re-confirm database state.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Real-time Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" aria-hidden="true" />
              <Input
                placeholder="Search name, phone, email, ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-xs h-8"
                aria-label="Search saved records"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Vertical Filter Dropdown */}
            <Select
              value={verticalFilter}
              onChange={(e) => setVerticalFilter(e.target.value)}
              className="text-xs h-8 w-36"
              aria-label="Filter records by vertical"
            >
              <option value="ALL">All Verticals</option>
              {grants.map((v) => (
                <option key={v} value={v}>
                  {VERTICAL_LABELS[v]}
                </option>
              ))}
            </Select>

            {/* Refresh Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadRecords(searchQuery)}
              className="h-8 text-xs gap-1"
            >
              <RefreshCw className="size-3.5" aria-hidden="true" />
              <span>Refresh from database</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <RefreshCw className="size-5 animate-spin mx-auto mb-2 text-muted-foreground" />
              Reading saved records from PostgreSQL…
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground space-y-1">
              <Database className="size-6 mx-auto mb-2 opacity-40" />
              <p className="font-semibold text-foreground">No saved records found.</p>
              <p className="text-xs">
                {searchQuery || verticalFilter !== 'ALL'
                  ? 'No prospects match the search or vertical filter criteria.'
                  : 'Enter a prospect in the form above to persist and verify your first record.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs" aria-label="Saved prospect records">
                <thead className="bg-muted/40 border-b border-border text-muted-foreground font-semibold uppercase text-[10px]">
                  <tr>
                    <th scope="col" className="px-4 py-3">Record ID</th>
                    <th scope="col" className="px-4 py-3">Prospect Details</th>
                    <th scope="col" className="px-4 py-3">Vertical</th>
                    <th scope="col" className="px-4 py-3">Contact</th>
                    <th scope="col" className="px-4 py-3">Status</th>
                    <th scope="col" className="px-4 py-3">Saved Timestamp</th>
                    <th scope="col" className="px-4 py-3 text-right">Database Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRecords.map((record) => (
                    <tr
                      key={record.id}
                      className={
                        verified?.id === record.id
                          ? 'bg-emerald-50/50 dark:bg-emerald-950/20'
                          : 'hover:bg-muted/30 transition-colors'
                      }
                    >
                      <td className="px-4 py-3 font-mono font-bold text-foreground">
                        {record.id}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-foreground block">
                            {record.prospectName}
                          </span>
                          {record.isPriority && (
                            <Badge className="bg-amber-500/15 text-amber-900 border-amber-300 dark:text-amber-200 font-bold text-[9px] uppercase px-1 py-0">
                              ★ Priority
                            </Badge>
                          )}
                        </div>
                        {record.location && (
                          <span className="text-muted-foreground text-[11px] flex items-center gap-1 mt-0.5">
                            <MapPin className="size-3" /> {record.location}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="font-mono text-[10px] uppercase">
                          {VERTICAL_LABELS[record.vertical] ?? record.vertical}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-foreground block">
                          {record.mobileNumber}
                        </span>
                        <span className="text-muted-foreground text-[11px] truncate block">
                          {record.email}
                        </span>
                        {record.whatsappNumber && (
                          <span className="text-emerald-700 dark:text-emerald-400 text-[10px] flex items-center gap-1 mt-0.5">
                            <MessageSquare className="size-2.5" /> {record.whatsappNumber}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {record.status === 'published' ? (
                          <div>
                            <Badge className="bg-emerald-700 text-white font-mono text-[10px]">
                              PUBLISHED
                            </Badge>
                            {record.assignedCallerName && (
                              <span className="text-[10px] text-muted-foreground block font-mono mt-0.5 truncate max-w-[120px]">
                                {record.assignedCallerName}
                              </span>
                            )}
                          </div>
                        ) : record.status === 'unassigned_exception' ? (
                          <div>
                            <Badge variant="destructive" className="font-mono text-[10px]">
                              EXCEPTION
                            </Badge>
                            <span className="text-[10px] text-rose-600 block mt-0.5 truncate max-w-[120px]" title={record.routingExceptionReason || undefined}>
                              {record.routingExceptionReason || 'No caller'}
                            </span>
                          </div>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 font-mono text-[10px]"
                          >
                            STAGED DRAFT
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-[11px]">
                        {new Date(record.savedAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {record.status === 'staged' && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => void handlePublish(record.id)}
                              disabled={publishingId === record.id}
                              className="text-xs h-7 px-2.5 bg-[#113F3D] text-white hover:bg-[#155451] font-semibold"
                              aria-label={`Publish record ${record.id} to caller`}
                            >
                              {publishingId === record.id ? (
                                <RefreshCw className="size-3 animate-spin mr-1" />
                              ) : (
                                <Send className="size-3 mr-1" />
                              )}
                              Publish
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void handleVerify(record.id)}
                            disabled={verifyingId === record.id}
                            className="text-xs h-7 px-3 border-[#113F3D]/30 text-[#113F3D] hover:bg-[#113F3D]/10 font-semibold"
                            aria-label={`Verify record ${record.id} in database`}
                          >
                            {verifyingId === record.id ? (
                              <RefreshCw className="size-3 animate-spin mr-1" />
                            ) : (
                              <Database className="size-3 mr-1" />
                            )}
                            Verify
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
        </>
      )}
    </div>
  );
}
