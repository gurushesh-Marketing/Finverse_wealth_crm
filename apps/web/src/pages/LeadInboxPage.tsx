import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { EnquiryInput, LeadSummary, SavedView } from '@finverse/contracts';
import { api, ApiError } from '../lib/api';
import { wealthApi } from '../lib/wealth-api';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input, Label, Textarea } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Dialog, FormRow, BusyButton } from '../components/ui/panel';
import { EmptyState, ErrorState, SkeletonRows, SuccessNote } from '../components/ui/states';
import { label } from '../lib/labels';

function fmt(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const EMPTY_FILTERS = { search: '', stage: '', due: '', source: '', product: '' };

export function LeadInboxPage() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [leads, setLeads] = useState<LeadSummary[] | null>(null);
  const [views, setViews] = useState<SavedView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [enquiryOpen, setEnquiryOpen] = useState(false);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [viewName, setViewName] = useState('');
  const [showContractModal, setShowContractModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.leads(filters);
      setLeads(res.leads);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void wealthApi.listViews().then((r) => setViews(r.views)).catch(() => undefined);
  }, []);

  async function saveView() {
    try {
      const v = await wealthApi.createView({ name: viewName, filters: filters as SavedView['filters'] });
      setViews([...views, v]);
      setNote(`View "${viewName}" saved (filters only — permissions re-checked on every load).`);
      setSaveViewOpen(false);
      setViewName('');
    } catch (err) {
      setNote(err instanceof ApiError ? err.message : 'View could not be saved.');
    }
  }

  async function removeView(id: string) {
    await wealthApi.removeView(id).catch(() => undefined);
    setViews(views.filter((v) => v.id !== id));
  }

  return (
    <div className="space-y-5">
      {/* Workspace Breadcrumb & Header matching Deck P045 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-muted-foreground">
            <Link to="/wealth/dashboard" className="hover:text-primary hover:underline">
              ← Sales caller workspace
            </Link>
            <span>/</span>
            <span className="text-primary font-bold">SC-02 / LEAD INBOX</span>
          </div>
          <h1 className="mt-1 font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Lead Inbox
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Wealth · assigned permission scope · illustrative records
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="default" className="bg-[#DCEEEA] text-primary font-medium">
            Scoped action
          </Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowContractModal(true)}
            className="border-primary/40 font-medium hover:bg-secondary"
          >
            SC-02 Guidance
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSaveViewOpen(true)}>
            Save view
          </Button>
          <Button size="sm" onClick={() => setEnquiryOpen(true)}>
            + New enquiry (SC-05)
          </Button>
        </div>
      </div>

      {note ? <SuccessNote>{note}</SuccessNote> : null}

      {/* Saved Views Pills */}
      {views.length > 0 ? (
        <div className="flex items-center gap-2 overflow-x-auto pb-1" role="list" aria-label="Saved views">
          <span className="text-xs font-semibold uppercase text-muted-foreground shrink-0">Saved views:</span>
          {views.map((v) => (
            <span
              key={v.id}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-secondary/80 px-3 py-1 text-xs font-medium text-accent"
            >
              <button
                type="button"
                role="listitem"
                className="hover:underline"
                onClick={() => setFilters({ ...EMPTY_FILTERS, ...(v.filters as Record<string, string>) })}
              >
                {v.name}
              </button>
              <button
                type="button"
                aria-label={`Delete view ${v.name}`}
                className="text-muted-foreground hover:text-destructive transition-colors ml-1 font-bold"
                onClick={() => void removeView(v.id)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {/* Filters Area matching Deck P045 */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                placeholder="Search within permitted scope"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="stage">Stage</Label>
              <Select
                id="stage"
                value={filters.stage}
                onChange={(e) => setFilters({ ...filters, stage: e.target.value })}
              >
                <option value="">All stages</option>
                {['new', 'not-contacted', 'contacted', 'follow-up', 'qualified', 'converted', 'lost'].map((s) => (
                  <option key={s} value={s}>{label(s)}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="due">Due date</Label>
              <Select
                id="due"
                value={filters.due}
                onChange={(e) => setFilters({ ...filters, due: e.target.value })}
              >
                <option value="">Any due date</option>
                <option value="overdue">Overdue</option>
                <option value="today">Due today</option>
                <option value="upcoming">Upcoming</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="product">Product</Label>
              <Select
                id="product"
                value={filters.product}
                onChange={(e) => setFilters({ ...filters, product: e.target.value })}
              >
                <option value="">All products</option>
                <option value="V1 Wealth Portfolio">V1 Wealth Portfolio</option>
                <option value="V1 Savings Plus">V1 Savings Plus</option>
                <option value="Investment advisory">Investment advisory</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="source">Source</Label>
              <Select
                id="source"
                value={filters.source}
                onChange={(e) => setFilters({ ...filters, source: e.target.value })}
              >
                <option value="">All sources</option>
                <option value="Website">Website</option>
                <option value="Campaign C12">Campaign C12</option>
                <option value="Employee referral">Employee referral</option>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leads Table matching Deck P045 */}
      {loading ? (
        <SkeletonRows rows={5} />
      ) : error ? (
        <ErrorState onRetry={() => void load()} message="Leads in your scope are unavailable right now." />
      ) : leads && leads.length > 0 ? (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" role="table">
              <thead>
                <tr className="border-b border-border text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <th scope="col" className="px-4 py-3 font-semibold">REFERENCE</th>
                  <th scope="col" className="px-4 py-3 font-semibold">PROSPECT / SEARCH</th>
                  <th scope="col" className="px-4 py-3 font-semibold">STAGE</th>
                  <th scope="col" className="px-4 py-3 font-semibold">STATE / DUE</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">NEXT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {leads.map((lead) => (
                  <tr key={lead.id} className="transition-colors hover:bg-secondary/40">
                    <td className="px-4 py-3 font-mono text-xs font-semibold">
                      <Link
                        to={`/wealth/prospects/${lead.id}`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {lead.id}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-foreground">{lead.displayName}</div>
                      <div className="text-xs text-muted-foreground">
                        {lead.source} · {lead.product}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={lead.stage === 'follow-up' ? 'open' : 'default'}>
                        {label(lead.stage)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="flex items-center gap-1.5">
                        <Badge tone={lead.dueStatus}>{label(lead.dueStatus)}</Badge>
                        <span className="text-muted-foreground">{fmt(lead.nextActionAt)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/wealth/prospects/${lead.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary underline-offset-4 hover:underline"
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <EmptyState
          title="No leads match"
          message="None of your active filters match assigned records. Another caller's lead ID returns no exposed customer information."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilters(EMPTY_FILTERS)}
            >
              Clear filters
            </Button>
          }
        />
      )}

      {/* Save View Dialog */}
      <Dialog
        open={saveViewOpen}
        onClose={() => setSaveViewOpen(false)}
        title="Save current view (SC-02)"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSaveViewOpen(false)}>Cancel</Button>
            <BusyButton busy={false} onClick={() => void saveView()}>Save view</BusyButton>
          </>
        }
      >
        <FormRow label="View name" htmlFor="view-name">
          <Input
            id="view-name"
            value={viewName}
            onChange={(e) => setViewName(e.target.value)}
            placeholder="e.g. New website leads"
          />
        </FormRow>
        <p className="text-xs text-muted-foreground">
          Saved views store filter parameters only. Scoped ownership permissions are re-evaluated on every load.
        </p>
      </Dialog>

      {/* SC-05 New Enquiry Dialog */}
      <NewEnquiryDialog
        open={enquiryOpen}
        onClose={() => setEnquiryOpen(false)}
        onSaved={(msg) => { setNote(msg); setEnquiryOpen(false); void load(); }}
      />

      {/* SC-02 Guidance Modal */}
      {showContractModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label="SC-02 / LEAD INBOX — Filter, search and save a lead view"
        >
          <div className="absolute inset-0" onClick={() => setShowContractModal(false)} aria-hidden />
          <div className="relative w-full max-w-2xl rounded-xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-heading text-base font-bold text-foreground">
                  SC-02 / LEAD INBOX — Filter, search and save a lead view
                </h3>
                <p className="text-xs text-muted-foreground">
                  Physical deck specification from P045 and P046.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowContractModal(false)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground text-sm"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 pt-4 text-xs">
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                <div className="rounded-lg border border-border p-3">
                  <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px]">How This Works / Next Steps</h4>
                  <ol className="mt-1.5 list-decimal pl-4 space-y-1 text-muted-foreground">
                    <li><strong className="text-foreground">01</strong> Choose stage, due date, source and product filters.</li>
                    <li><strong className="text-foreground">02</strong> Select Apply filters; view only owned results and permitted contact fields.</li>
                    <li><strong className="text-foreground">03</strong> Save view with a name or Reset to the default inbox.</li>
                  </ol>
                </div>

                <div className="rounded-lg border border-border p-3">
                  <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px]">Before It Can Proceed</h4>
                  <p className="mt-1 text-muted-foreground">
                    Search, counts and suggestions must obey ownership scope. Saved views store filters, never a reusable copy of customer data.
                  </p>
                </div>

                <div className="rounded-lg border border-border p-3">
                  <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px]">System Commit</h4>
                  <p className="mt-1 text-muted-foreground">
                    Run a paginated scoped query. Store the employee-specific view definition and reapply current permissions each time.
                  </p>
                </div>

                <div className="rounded-lg border border-border p-3">
                  <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px]">When a Check Fails</h4>
                  <p className="mt-1 text-muted-foreground">
                    No match: show an empty state and Clear filters. Another caller lead ID returns no exposed customer information.
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-border">
                <Button size="sm" onClick={() => setShowContractModal(false)}>
                  Close Guidance
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NewEnquiryDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (msg: string) => void }) {
  const [form, setForm] = useState<EnquiryInput>({
    displayName: '',
    phone: '',
    email: '',
    product: 'V1 Wealth Portfolio',
    source: 'Employee referral',
    permissionEvidence: '',
    need: '',
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setFailure(null);
    setErrors({});
    try {
      const enq = await wealthApi.createEnquiry(form);
      if (enq.status === 'duplicate') {
        onSaved(`Existing enquiry detected (duplicate of ${enq.duplicateOf}). Linked for review — no new opportunity created.`);
        return;
      }
      const pub = await wealthApi.publishEnquiry(enq.id);
      onSaved(`Enquiry ${enq.id} submitted and published as ${pub.leadId} to the routing queue (self-ownership not assumed).`);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VALIDATION_FAILED') {
        setErrors(err.fieldErrors ?? {});
      } else {
        setFailure(err instanceof ApiError ? err.message : 'Enquiry could not be saved.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="SC-05 / LEAD INBOX — Create a permitted self-sourced enquiry"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <BusyButton busy={busy} onClick={() => void submit()}>Submit enquiry</BusyButton>
        </>
      }
    >
      <div className="mb-3 rounded border border-border bg-secondary/30 p-2 text-xs text-muted-foreground">
        Capture source, need and contact-permission evidence. Run duplicate checks before making a new opportunity. Self-ownership is not assumed.
      </div>
      <FormRow label="Prospect name" htmlFor="enq-name" error={errors.displayName?.[0]}>
        <Input
          id="enq-name"
          placeholder="New prospect"
          value={form.displayName}
          onChange={(e) => setForm({ ...form, displayName: e.target.value })}
        />
      </FormRow>
      <FormRow label="Phone (required verified format)" htmlFor="enq-phone" error={errors.phone?.[0]}>
        <Input
          id="enq-phone"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          placeholder="+91 98765 43210"
        />
      </FormRow>
      <FormRow label="Email (optional)" htmlFor="enq-email" error={errors.email?.[0]}>
        <Input
          id="enq-email"
          value={form.email ?? ''}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="Optional"
        />
      </FormRow>
      <FormRow label="Product (within Wealth)" htmlFor="enq-product" error={errors.product?.[0]}>
        <Select
          id="enq-product"
          value={form.product}
          onChange={(e) => setForm({ ...form, product: e.target.value })}
        >
          <option>V1 Wealth Portfolio</option>
          <option>V1 Savings Plus</option>
          <option>Investment advisory</option>
        </Select>
      </FormRow>
      <FormRow label="Source" htmlFor="enq-source" error={errors.source?.[0]}>
        <Select
          id="enq-source"
          value={form.source}
          onChange={(e) => setForm({ ...form, source: e.target.value })}
        >
          <option>Employee referral</option>
          <option>Website</option>
          <option>Campaign C12</option>
        </Select>
      </FormRow>
      <FormRow label="Permission evidence (reference and date)" htmlFor="enq-perm" error={errors.permissionEvidence?.[0]}>
        <Input
          id="enq-perm"
          value={form.permissionEvidence}
          onChange={(e) => setForm({ ...form, permissionEvidence: e.target.value })}
          placeholder="Reference and date, e.g. Ref EMP-1, 2026-10-01"
        />
      </FormRow>
      <FormRow label="Customer requirement (need)" htmlFor="enq-need" error={errors.need?.[0]}>
        <Textarea
          id="enq-need"
          rows={2}
          value={form.need}
          onChange={(e) => setForm({ ...form, need: e.target.value })}
          placeholder="Customer requirement"
        />
      </FormRow>
      {failure ? <p role="alert" className="text-sm text-destructive">{failure}</p> : null}
    </Dialog>
  );
}
