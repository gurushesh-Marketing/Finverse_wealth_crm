import React, { useState, useEffect } from 'react';
import {
  CfoBalancesOverview,
  CfoHandoffItem,
  LedgerEntry,
  ReceivableInvoice,
  BankSettledReceipt,
  FinanceReconciliation,
  RefundRequest,
  IncentiveCalculation,
  IncentiveDispute,
  ReportingPeriod,
  PeriodReopenRequest,
  VerticalBudgetLine,
  ForecastFinanceReview,
  FinancePackPreview,
  FinancePackSchedule,
  FinancePolicy,
  AgeingBucketsSummary,
} from '@finverse/contracts';
import { cfoApi } from '../lib/cfo-api';
import { Card, CardHeader, CardContent, CardTitle, PageHeader } from '../components/ui/card';
import { Button } from '../components/ui/button';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Download,
  FileCheck,
  FileText,
  Filter,
  Layers,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  SlidersHorizontal,
  Unlock,
  Users,
} from 'lucide-react';

function formatInr(val: number): string {
  if (Math.abs(val) >= 10000000) {
    return `₹${(val / 10000000).toFixed(2)} Cr`;
  }
  if (Math.abs(val) >= 100000) {
    return `₹${(val / 100000).toFixed(2)} L`;
  }
  return `₹${val.toLocaleString('en-IN')}`;
}

// =========================================================================
// CFO-01 & CFO-08: Finance Overview & Three-Way Reconciliation Bridge
// =========================================================================
export function CfoOverviewPage() {
  const [overview, setOverview] = useState<CfoBalancesOverview | null>(null);
  const [reconciliations, setReconciliations] = useState<FinanceReconciliation[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('FY26-Q1');
  const [showFreezeModal, setShowFreezeModal] = useState(false);
  const [explanationNotes, setExplanationNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [period]);

  async function loadData() {
    setLoading(true);
    try {
      const [ovData, recData] = await Promise.all([
        cfoApi.getOverview(period),
        cfoApi.getReconciliations(),
      ]);
      setOverview(ovData.overview);
      setReconciliations(recData.reconciliations);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleFreezeReconciliation(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await cfoApi.freezeReconciliation({
        periodId: 'PER-2026-Q1',
        explanationNotes,
      });
      setShowFreezeModal(false);
      setExplanationNotes('');
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !overview) {
    return <div className="p-8 text-center text-muted-foreground">Loading financial balances and reconciliation...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader
          title="Financial Balances & Cash Run-Rate (CFO-01)"
          subtitle="Real-time multi-vertical balance sheet rollup, revenue recognition, and three-way reconciliation bridge."
        />
        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-3 py-1.5 rounded border border-border bg-card text-foreground text-sm font-medium"
          >
            <option value="FY26-Q1">Fiscal 2026 — Q1</option>
            <option value="FY26-Q2">Fiscal 2026 — Q2</option>
          </select>
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      {/* 4 Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recognised Revenue</p>
            <p className="text-2xl font-bold text-foreground mt-1">{formatInr(overview.recognisedRevenue)}</p>
            <p className="text-xs text-primary font-medium mt-1">SEBI accrual policy compliant</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-600">
          <CardContent className="pt-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cash Receipts (Settled)</p>
            <p className="text-2xl font-bold text-foreground mt-1">{formatInr(overview.cashReceipts)}</p>
            <p className="text-xs text-emerald-600 font-medium mt-1">Matched against bank UTR feeds</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Outstanding Receivables</p>
            <p className="text-2xl font-bold text-foreground mt-1">{formatInr(overview.outstandingReceivables)}</p>
            <p className="text-xs text-amber-600 font-medium mt-1">Active client billing invoices</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-rose-500">
          <CardContent className="pt-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Unmatched / Suspense Cash</p>
            <p className="text-2xl font-bold text-foreground mt-1">{formatInr(overview.unmatchedCash)}</p>
            <p className="text-xs text-rose-600 font-medium mt-1">Pending client PAN/deal match</p>
          </CardContent>
        </Card>
      </div>

      {/* CFO-08: Three-Way Reconciliation Bridge */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-lg font-bold">Three-Way Sales vs Revenue vs Cash Reconciliation Bridge (CFO-08)</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Strict audit trail preventing revenue leaks: reconciles frontline closed sales milestones against GAAP recognised revenue and bank receipts.
            </p>
          </div>
          <Button variant="default" size="sm" onClick={() => setShowFreezeModal(true)}>
            <Lock className="w-4 h-4 mr-1.5" /> Freeze Reconciliation Version
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 p-4 rounded-lg bg-muted/40 border border-border text-center">
            <div className="p-3 bg-card rounded border border-border">
              <p className="text-xs font-medium text-muted-foreground">Frontline Sales Wins</p>
              <p className="text-lg font-bold text-foreground mt-1">₹7.80 Cr</p>
              <p className="text-[11px] text-muted-foreground">Signed mandates</p>
            </div>
            <div className="p-3 bg-card rounded border border-border">
              <p className="text-xs font-medium text-muted-foreground">Recognised Revenue</p>
              <p className="text-lg font-bold text-primary mt-1">₹7.45 Cr</p>
              <p className="text-[11px] text-primary">Earned advisory fee</p>
            </div>
            <div className="p-3 bg-card rounded border border-border">
              <p className="text-xs font-medium text-muted-foreground">Documented Timing Gap</p>
              <p className="text-lg font-bold text-amber-600 mt-1">-₹35.00 L</p>
              <p className="text-[11px] text-amber-600">Milestone pending</p>
            </div>
            <div className="p-3 bg-card rounded border border-border">
              <p className="text-xs font-medium text-muted-foreground">Bank Settled Cash</p>
              <p className="text-lg font-bold text-emerald-600 mt-1">₹5.80 Cr</p>
              <p className="text-[11px] text-emerald-600">Received in bank</p>
            </div>
            <div className="p-3 bg-card rounded border border-border">
              <p className="text-xs font-medium text-muted-foreground">Unexplained Variance</p>
              <p className="text-lg font-bold text-emerald-600 mt-1">₹0.00</p>
              <p className="text-[11px] text-emerald-600 font-semibold">100% Balanced</p>
            </div>
          </div>

          {reconciliations.length > 0 && (
            <div className="mt-4 border-t border-border pt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Approved Reconciliation Records</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="p-2">Code</th>
                      <th className="p-2">Period</th>
                      <th className="p-2">Closed Wins</th>
                      <th className="p-2">Recognised Rev</th>
                      <th className="p-2">Settled Cash</th>
                      <th className="p-2">Status</th>
                      <th className="p-2">Frozen By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {reconciliations.map((r) => (
                      <tr key={r.id}>
                        <td className="p-2 font-mono font-bold text-primary">{r.reconciliationCode}</td>
                        <td className="p-2">{r.periodLabel || 'FY26-Q1'}</td>
                        <td className="p-2">{formatInr(r.salesClosedWinsTotal)}</td>
                        <td className="p-2 font-medium">{formatInr(r.recognisedRevenueTotal)}</td>
                        <td className="p-2 text-emerald-600 font-medium">{formatInr(r.cashReceiptsTotal)}</td>
                        <td className="p-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            {r.reconciliationStatus.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                        <td className="p-2 text-muted-foreground">{r.frozenByName || 'Ananya Roy (CFO)'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Vertical Summary & Recent Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base font-bold">Vertical Revenue & Margins</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {overview.verticalSummary.map((v) => (
              <div key={v.vertical} className="p-3 rounded-lg border border-border bg-card">
                <div className="flex justify-between items-center">
                  <p className="font-semibold text-sm text-foreground">{v.vertical}</p>
                  <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-bold">
                    {v.marginPct}% Margin
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-border/50 text-xs">
                  <div>
                    <span className="text-muted-foreground">Recognised:</span>
                    <p className="font-bold text-foreground">{formatInr(v.recognisedRevenue)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Receivables:</span>
                    <p className="font-bold text-amber-600">{formatInr(v.outstandingReceivables)}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-bold">Recent Finance Ledger Entries (CFO-01 Drill-down)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="p-2">Entry Code</th>
                    <th className="p-2">Type</th>
                    <th className="p-2">Account</th>
                    <th className="p-2">Net Amount</th>
                    <th className="p-2">Description</th>
                    <th className="p-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {overview.recentLedgerEntries.map((e) => (
                    <tr key={e.id}>
                      <td className="p-2 font-mono font-bold text-primary">{e.entryCode}</td>
                      <td className="p-2 capitalize">{e.entryType.replace('_', ' ')}</td>
                      <td className="p-2 font-mono text-muted-foreground">{e.accountCode}</td>
                      <td className={`p-2 font-bold ${e.netAmount < 0 ? 'text-rose-600' : 'text-foreground'}`}>
                        {formatInr(e.netAmount)}
                      </td>
                      <td className="p-2 max-w-[200px] truncate text-muted-foreground">{e.description}</td>
                      <td className="p-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary">
                          {e.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Freeze Reconciliation Modal */}
      {showFreezeModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg max-w-lg w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-foreground">Freeze Reconciliation Version (CFO-08)</h3>
            <p className="text-xs text-muted-foreground">
              Freezing creates an immutable audit watermark for the reporting period. All current differences must be traceable and justified.
            </p>
            <form onSubmit={handleFreezeReconciliation} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground">Period</label>
                <input
                  type="text"
                  disabled
                  value={period}
                  className="w-full mt-1 p-2 rounded border border-border bg-muted text-muted-foreground text-sm font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">Traceable Variance & Timing Explanation</label>
                <textarea
                  required
                  rows={3}
                  value={explanationNotes}
                  onChange={(e) => setExplanationNotes(e.target.value)}
                  placeholder="Explain verified timing offsets (e.g. ₹35L deposit cleared in bank post-cutoff)..."
                  className="w-full mt-1 p-2 rounded border border-border bg-background text-foreground text-sm"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowFreezeModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="default" disabled={submitting}>
                  {submitting ? 'Freezing...' : 'Confirm & Freeze Audit Record'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// CFO-02, CFO-03, CFO-11: Revenue Recognition & Sales Handoffs
// =========================================================================
export function CfoRecognitionPage() {
  const [handoffs, setHandoffs] = useState<CfoHandoffItem[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRecModal, setShowRecModal] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<LedgerEntry | null>(null);

  // Recognition form
  const [recGross, setRecGross] = useState(500000);
  const [recTax, setRecTax] = useState(90000);
  const [recAccount, setRecAccount] = useState('4001-WEALTH-PMS');
  const [recDesc, setRecDesc] = useState('Recognised Discretionary PMS Advisory Fee Q1');

  // Credit Note form
  const [cnAmount, setCnAmount] = useState(50000);
  const [cnReason, setCnReason] = useState('Client renegotiated advisory concession approved under DoA');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [hData, lData] = await Promise.all([
        cfoApi.getHandoffs(),
        cfoApi.getLedger(),
      ]);
      setHandoffs(hData.handoffs);
      setLedger(lData.entries);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyHandoff(id: string, decision: 'accepted_for_processing' | 'returned_deficiencies') {
    const notes = decision === 'returned_deficiencies' ? prompt('Enter deficiency notes:') || undefined : undefined;
    try {
      await cfoApi.verifyHandoff(id, { decision, deficiencyNotes: notes });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handlePostRecognition(e: React.FormEvent) {
    e.preventDefault();
    try {
      await cfoApi.postRecognition({
        periodId: 'PER-2026-Q1',
        vertical: 'wealth',
        grossAmount: Number(recGross),
        taxAmount: Number(recTax),
        policyCode: 'REV-2026-V1',
        sourceReferenceType: 'invoice',
        sourceReferenceId: 'INV-2026-MANUAL',
        accountCode: recAccount,
        description: recDesc,
      });
      setShowRecModal(false);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handlePostCreditNote(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEntry) return;
    try {
      await cfoApi.postCreditNote({
        originalEntryId: selectedEntry.id,
        creditAmount: Number(cnAmount),
        policyCode: 'REV-2026-V1',
        reversalReason: cnReason,
      });
      setShowCreditModal(false);
      setSelectedEntry(null);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader
          title="Revenue Recognition & Sales Handoffs (CFO-02, CFO-03, CFO-11)"
          subtitle="Independent verification of sales wins, statutory revenue recognition, and negative credit reversals."
        />
        <Button variant="default" size="sm" onClick={() => setShowRecModal(true)}>
          <Plus className="w-4 h-4 mr-1.5" /> Post Revenue Entry (CFO-03)
        </Button>
      </div>

      {/* CFO-02: Sales to Finance Handoffs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold">Sales-to-Finance Verification Queue (CFO-02)</CardTitle>
          <p className="text-xs text-muted-foreground">
            Frontline conversion milestone validation. Sales conversion alone is insufficient for recognition without finance verification.
          </p>
        </CardHeader>
        <CardContent>
          {handoffs.length === 0 ? (
            <p className="text-xs text-muted-foreground">No pending sales handoffs in queue.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="p-2">Code</th>
                    <th className="p-2">Client</th>
                    <th className="p-2">Sales Rep</th>
                    <th className="p-2">Converted Amount</th>
                    <th className="p-2">Milestone</th>
                    <th className="p-2">Status</th>
                    <th className="p-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {handoffs.map((h) => (
                    <tr key={h.id}>
                      <td className="p-2 font-mono font-bold text-primary">{h.handoffCode}</td>
                      <td className="p-2 font-semibold text-foreground">{h.clientName}</td>
                      <td className="p-2 text-muted-foreground">{h.salesRepName}</td>
                      <td className="p-2 font-bold">{formatInr(h.convertedAmount)}</td>
                      <td className="p-2">
                        <span className="px-2 py-0.5 rounded bg-muted text-[11px] font-mono">
                          {h.earningMilestone}
                        </span>
                      </td>
                      <td className="p-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          h.reviewStatus === 'accepted_for_processing'
                            ? 'bg-emerald-100 text-emerald-800'
                            : h.reviewStatus === 'returned_deficiencies'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {h.reviewStatus.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="p-2 text-right space-x-2">
                        {h.reviewStatus === 'pending_verification' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 text-emerald-600 hover:text-emerald-700"
                              onClick={() => handleVerifyHandoff(h.id, 'accepted_for_processing')}
                            >
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 text-rose-600 hover:text-rose-700"
                              onClick={() => handleVerifyHandoff(h.id, 'returned_deficiencies')}
                            >
                              Return
                            </Button>
                          </>
                        )}
                        {h.reviewStatus !== 'pending_verification' && (
                          <span className="text-[11px] text-muted-foreground">Verified</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CFO-03 & CFO-11: Posted Revenue & Credit Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold">Finance Revenue Ledger & Credit Note Reversals (CFO-03, CFO-11)</CardTitle>
          <p className="text-xs text-muted-foreground">
            Immutable audit register. Original entries are never overwritten; adjustments require linked credit note reversals.
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="p-2">Entry Code</th>
                  <th className="p-2">Type</th>
                  <th className="p-2">Account</th>
                  <th className="p-2">Net Amount</th>
                  <th className="p-2">Policy</th>
                  <th className="p-2">Description</th>
                  <th className="p-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ledger.map((e) => (
                  <tr key={e.id}>
                    <td className="p-2 font-mono font-bold text-primary">{e.entryCode}</td>
                    <td className="p-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        e.isReversal ? 'bg-rose-100 text-rose-800' : 'bg-primary/10 text-primary'
                      }`}>
                        {e.entryType.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="p-2 font-mono text-muted-foreground">{e.accountCode}</td>
                    <td className={`p-2 font-bold ${e.netAmount < 0 ? 'text-rose-600' : 'text-foreground'}`}>
                      {formatInr(e.netAmount)}
                    </td>
                    <td className="p-2 font-mono text-[11px]">{e.policyCode}</td>
                    <td className="p-2 max-w-[220px] truncate text-muted-foreground">{e.description}</td>
                    <td className="p-2 text-right">
                      {!e.isReversal && e.entryType === 'revenue_recognition' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 text-rose-600"
                          onClick={() => {
                            setSelectedEntry(e);
                            setCnAmount(Math.min(50000, e.netAmount));
                            setShowCreditModal(true);
                          }}
                        >
                          Credit Note (CFO-11)
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Post Revenue Modal */}
      {showRecModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg max-w-lg w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-foreground">Post Revenue Recognition Entry (CFO-03)</h3>
            <form onSubmit={handlePostRecognition} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground">Gross Advisory Fee (₹)</label>
                  <input
                    type="number"
                    required
                    value={recGross}
                    onChange={(e) => setRecGross(Number(e.target.value))}
                    className="w-full mt-1 p-2 rounded border border-border bg-background text-foreground text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">GST / Tax Provision (₹)</label>
                  <input
                    type="number"
                    required
                    value={recTax}
                    onChange={(e) => setRecTax(Number(e.target.value))}
                    className="w-full mt-1 p-2 rounded border border-border bg-background text-foreground text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">GL Account Code</label>
                <select
                  value={recAccount}
                  onChange={(e) => setRecAccount(e.target.value)}
                  className="w-full mt-1 p-2 rounded border border-border bg-background text-foreground text-sm"
                >
                  <option value="4001-WEALTH-PMS">4001-WEALTH-PMS (Portfolio Management)</option>
                  <option value="4002-WEALTH-MUTUAL">4002-WEALTH-MUTUAL (Distribution Trail)</option>
                  <option value="4003-WEALTH-AIF">4003-WEALTH-AIF (Alternate Investment Funds)</option>
                  <option value="4004-WEALTH-ESTATE">4004-WEALTH-ESTATE (Trust & Estate Planning)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">Description & Policy Evidence</label>
                <textarea
                  required
                  rows={2}
                  value={recDesc}
                  onChange={(e) => setRecDesc(e.target.value)}
                  className="w-full mt-1 p-2 rounded border border-border bg-background text-foreground text-sm"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowRecModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="default">
                  Post Immutable Entry
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credit Note Modal */}
      {showCreditModal && selectedEntry && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg max-w-lg w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-foreground">Approve Credit Note / Revenue Reversal (CFO-11)</h3>
            <p className="text-xs text-muted-foreground">
              Posting negative revenue adjustment linked to original entry <span className="font-mono font-bold text-primary">{selectedEntry.entryCode}</span>.
            </p>
            <form onSubmit={handlePostCreditNote} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground">Reversal Amount (₹)</label>
                <input
                  type="number"
                  required
                  max={selectedEntry.netAmount}
                  value={cnAmount}
                  onChange={(e) => setCnAmount(Number(e.target.value))}
                  className="w-full mt-1 p-2 rounded border border-border bg-background text-foreground text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">Business Justification & Concession Reason</label>
                <textarea
                  required
                  rows={3}
                  value={cnReason}
                  onChange={(e) => setCnReason(e.target.value)}
                  className="w-full mt-1 p-2 rounded border border-border bg-background text-foreground text-sm"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowCreditModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="default" className="bg-rose-600 hover:bg-rose-700">
                  Authorize Credit Note
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// CFO-04 & CFO-09: Receivable Invoices & Ageing / Collections
// =========================================================================
export function CfoInvoicesPage() {
  const [invoices, setInvoices] = useState<ReceivableInvoice[]>([]);
  const [ageing, setAgeing] = useState<AgeingBucketsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<ReceivableInvoice | null>(null);

  // New Invoice Form
  const [clientName, setClientName] = useState('');
  const [clientPan, setClientPan] = useState('');
  const [issueDate, setIssueDate] = useState('2026-10-01');
  const [dueDate, setDueDate] = useState('2026-10-31');
  const [itemDesc, setItemDesc] = useState('Wealth Advisory Retainer Q3');
  const [itemAmount, setItemAmount] = useState(300000);
  const [taxAmount, setTaxAmount] = useState(54000);

  // Collection Form
  const [agentId, setAgentId] = useState('EMP-007');
  const [colStatus, setColStatus] = useState<'standard' | 'promise_to_pay' | 'disputed' | 'escalated_legal'>('promise_to_pay');
  const [promiseDate, setPromiseDate] = useState('2026-10-25');
  const [colNotes, setColNotes] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [invData, ageData] = await Promise.all([
        cfoApi.getInvoices(),
        cfoApi.getAgeingSummary(),
      ]);
      setInvoices(invData.invoices);
      setAgeing(ageData.summary);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateInvoice(e: React.FormEvent) {
    e.preventDefault();
    try {
      await cfoApi.createInvoice({
        periodId: 'PER-2026-Q1',
        clientName,
        clientPan: clientPan || undefined,
        vertical: 'wealth',
        issueDate,
        dueDate,
        lineItems: [{ description: itemDesc, amount: Number(itemAmount) }],
        taxAmount: Number(taxAmount),
      });
      setShowCreateModal(false);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleAssignCollection(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedInvoice) return;
    try {
      await cfoApi.assignCollection(selectedInvoice.id, {
        assignedEmployeeId: agentId,
        collectionStatus: colStatus,
        promiseToPayDate: colStatus === 'promise_to_pay' ? promiseDate : undefined,
        collectionNotes: colNotes,
      });
      setShowAssignModal(false);
      setSelectedInvoice(null);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader
          title="Receivable Invoices & Ageing (CFO-04, CFO-09)"
          subtitle="Client receivable management, statutory GST invoices, overdue ageing buckets, and collection follow-up assignment."
        />
        <Button variant="default" size="sm" onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-1.5" /> Issue Invoice (CFO-04)
        </Button>
      </div>

      {/* Ageing Summary Cards */}
      {ageing && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3 bg-card rounded-lg border border-border">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase">Current (0-30d)</p>
            <p className="text-xl font-bold text-foreground mt-1">{formatInr(ageing.current)}</p>
          </div>
          <div className="p-3 bg-card rounded-lg border border-border">
            <p className="text-[11px] font-semibold text-amber-600 uppercase">31 - 60 Days</p>
            <p className="text-xl font-bold text-amber-600 mt-1">{formatInr(ageing.days31To60)}</p>
          </div>
          <div className="p-3 bg-card rounded-lg border border-border">
            <p className="text-[11px] font-semibold text-orange-600 uppercase">61 - 90 Days</p>
            <p className="text-xl font-bold text-orange-600 mt-1">{formatInr(ageing.days61To90)}</p>
          </div>
          <div className="p-3 bg-card rounded-lg border border-border">
            <p className="text-[11px] font-semibold text-rose-600 uppercase">&gt; 90 Days Overdue</p>
            <p className="text-xl font-bold text-rose-600 mt-1">{formatInr(ageing.over90Days)}</p>
          </div>
          <div className="p-3 bg-card rounded-lg border border-primary/30 bg-primary/5">
            <p className="text-[11px] font-semibold text-primary uppercase">Total Outstanding</p>
            <p className="text-xl font-bold text-primary mt-1">{formatInr(ageing.totalOutstanding)}</p>
          </div>
        </div>
      )}

      {/* Invoice Register */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold">Active Receivable Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="p-2">Invoice #</th>
                  <th className="p-2">Client Name</th>
                  <th className="p-2">Total Amount</th>
                  <th className="p-2">Paid</th>
                  <th className="p-2">Balance</th>
                  <th className="p-2">Due Date</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Collection Follow-up</th>
                  <th className="p-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="p-2 font-mono font-bold text-primary">{inv.invoiceNumber}</td>
                    <td className="p-2 font-medium text-foreground">{inv.clientName}</td>
                    <td className="p-2">{formatInr(inv.totalAmount)}</td>
                    <td className="p-2 text-emerald-600 font-medium">{formatInr(inv.paidAmount)}</td>
                    <td className="p-2 font-bold text-rose-600">{formatInr(inv.outstandingBalance)}</td>
                    <td className="p-2 text-muted-foreground">{inv.dueDate}</td>
                    <td className="p-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        inv.status === 'settled'
                          ? 'bg-emerald-100 text-emerald-800'
                          : inv.status === 'partially_paid'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {inv.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="p-2">
                      {inv.collectionStatus !== 'standard' ? (
                        <div className="text-[11px]">
                          <span className="font-semibold capitalize text-primary">{inv.collectionStatus.replace('_', ' ')}</span>
                          {inv.promiseToPayDate && (
                            <span className="text-muted-foreground ml-1">({inv.promiseToPayDate})</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">Standard</span>
                      )}
                    </td>
                    <td className="p-2 text-right">
                      {inv.outstandingBalance > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7"
                          onClick={() => {
                            setSelectedInvoice(inv);
                            setShowAssignModal(true);
                          }}
                        >
                          Assign Collection (CFO-09)
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create Invoice Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg max-w-lg w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-foreground">Create Receivable Invoice (CFO-04)</h3>
            <form onSubmit={handleCreateInvoice} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground">Client Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Singhania Family Trust"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full mt-1 p-2 rounded border border-border bg-background text-foreground text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">Client PAN (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. ABCPS1234F"
                    value={clientPan}
                    onChange={(e) => setClientPan(e.target.value)}
                    className="w-full mt-1 p-2 rounded border border-border bg-background text-foreground text-sm uppercase"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground">Issue Date</label>
                  <input
                    type="date"
                    required
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full mt-1 p-2 rounded border border-border bg-background text-foreground text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">Due Date</label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full mt-1 p-2 rounded border border-border bg-background text-foreground text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">Line Item Description</label>
                <input
                  type="text"
                  required
                  value={itemDesc}
                  onChange={(e) => setItemDesc(e.target.value)}
                  className="w-full mt-1 p-2 rounded border border-border bg-background text-foreground text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground">Net Fee Amount (₹)</label>
                  <input
                    type="number"
                    required
                    value={itemAmount}
                    onChange={(e) => setItemAmount(Number(e.target.value))}
                    className="w-full mt-1 p-2 rounded border border-border bg-background text-foreground text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">GST @ 18% (₹)</label>
                  <input
                    type="number"
                    required
                    value={taxAmount}
                    onChange={(e) => setTaxAmount(Number(e.target.value))}
                    className="w-full mt-1 p-2 rounded border border-border bg-background text-foreground text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="default">
                  Issue Receivable Invoice
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Collection Modal */}
      {showAssignModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg max-w-lg w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-foreground">Assign Collection Work (CFO-09)</h3>
            <p className="text-xs text-muted-foreground">
              Invoice <span className="font-mono font-bold text-primary">{selectedInvoice.invoiceNumber}</span> ({selectedInvoice.clientName}) — Balance: {formatInr(selectedInvoice.outstandingBalance)}
            </p>
            <form onSubmit={handleAssignCollection} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground">Assigned Recovery Agent</label>
                <select
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  className="w-full mt-1 p-2 rounded border border-border bg-background text-foreground text-sm"
                >
                  <option value="EMP-007">Neel Verma (Wealth Manager)</option>
                  <option value="EMP-005">Meera Nair (Team Lead)</option>
                  <option value="EMP-001">Aarav Sharma (Senior Associate)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">Collection Status</label>
                <select
                  value={colStatus}
                  onChange={(e) => setColStatus(e.target.value as any)}
                  className="w-full mt-1 p-2 rounded border border-border bg-background text-foreground text-sm"
                >
                  <option value="promise_to_pay">Promise to Pay (PTP)</option>
                  <option value="disputed">Commercial Dispute</option>
                  <option value="escalated_legal">Legal Recovery Escalation</option>
                </select>
              </div>
              {colStatus === 'promise_to_pay' && (
                <div>
                  <label className="text-xs font-semibold text-foreground">Promised Settlement Date</label>
                  <input
                    type="date"
                    required
                    value={promiseDate}
                    onChange={(e) => setPromiseDate(e.target.value)}
                    className="w-full mt-1 p-2 rounded border border-border bg-background text-foreground text-sm"
                  />
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-foreground">Follow-up Directives & Channel Restrictions</label>
                <textarea
                  rows={2}
                  value={colNotes}
                  onChange={(e) => setColNotes(e.target.value)}
                  placeholder="Official channels only (Email & Direct Phone). WhatsApp collection contact strictly prohibited per regulatory policy."
                  className="w-full mt-1 p-2 rounded border border-border bg-background text-foreground text-sm"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowAssignModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="default">
                  Assign Follow-up Task
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// CFO-05, CFO-06, CFO-07, CFO-10: Payments, Matching & Refunds
// =========================================================================
export function CfoPaymentsPage() {
  const [receipts, setReceipts] = useState<BankSettledReceipt[]>([]);
  const [invoices, setInvoices] = useState<ReceivableInvoice[]>([]);
  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<BankSettledReceipt[] | any>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [matchAmount, setMatchAmount] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [rData, iData, refData] = await Promise.all([
        cfoApi.getReceipts(),
        cfoApi.getInvoices(),
        cfoApi.getRefunds(),
      ]);
      setReceipts(rData.receipts);
      setInvoices(iData.invoices.filter((i) => i.outstandingBalance > 0));
      setRefunds(refData.refunds);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleMatch(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedReceipt || !selectedInvoiceId) return;
    try {
      await cfoApi.matchReceipt({
        receiptId: selectedReceipt.id,
        invoiceId: selectedInvoiceId,
        allocatedAmount: Number(matchAmount),
      });
      setShowMatchModal(false);
      setSelectedReceipt(null);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleDecideRefund(id: string, decision: 'approved' | 'rejected' | 'executed_paid') {
    const extRef = decision === 'executed_paid' ? prompt('Enter Bank UTR execution reference:') || 'UTR-PAYOUT-EXEC' : undefined;
    try {
      await cfoApi.decideRefund(id, { decision, externalPaymentRef: extRef });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settled Receipts, Invoice Matching & Refunds (CFO-05, CFO-06, CFO-10)"
        subtitle="Bank settlement reconciliation, transactional invoice allocation, suspense resolution, and refund payouts."
      />

      {/* Receipts Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold">Bank Settled Receipts (CFO-05)</CardTitle>
          <p className="text-xs text-muted-foreground">
            Inbound bank feeds with verified UTR references. Allocate payments across invoices to clear outstanding AR.
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="p-2">Receipt Code</th>
                  <th className="p-2">Bank Reference (UTR)</th>
                  <th className="p-2">Bank</th>
                  <th className="p-2">Payer Name</th>
                  <th className="p-2">Settlement Date</th>
                  <th className="p-2">Total Amount</th>
                  <th className="p-2">Unmatched Balance</th>
                  <th className="p-2">Status</th>
                  <th className="p-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {receipts.map((r) => (
                  <tr key={r.id}>
                    <td className="p-2 font-mono font-bold text-primary">{r.receiptCode}</td>
                    <td className="p-2 font-mono text-foreground font-medium">{r.bankReference}</td>
                    <td className="p-2 text-muted-foreground">{r.bankName}</td>
                    <td className="p-2 font-semibold">{r.payerName}</td>
                    <td className="p-2 text-muted-foreground">{r.settlementDate}</td>
                    <td className="p-2 font-bold">{formatInr(r.amount)}</td>
                    <td className="p-2 font-bold text-rose-600">{formatInr(r.unmatchedAmount)}</td>
                    <td className="p-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        r.status === 'matched'
                          ? 'bg-emerald-100 text-emerald-800'
                          : r.status === 'partially_matched'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {r.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="p-2 text-right">
                      {r.unmatchedAmount > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7"
                          onClick={() => {
                            setSelectedReceipt(r);
                            setMatchAmount(r.unmatchedAmount);
                            if (invoices.length > 0) setSelectedInvoiceId(invoices[0].id);
                            setShowMatchModal(true);
                          }}
                        >
                          Match to Invoice (CFO-06)
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Refunds Queue */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold">Refund Requests & Payout Authorizations (CFO-10)</CardTitle>
          <p className="text-xs text-muted-foreground">
            Strict verification against prior refunds and bank beneficiary credentials before external execution.
          </p>
        </CardHeader>
        <CardContent>
          {refunds.length === 0 ? (
            <p className="text-xs text-muted-foreground">No pending refund requests.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="p-2">Refund Code</th>
                    <th className="p-2">Client Name</th>
                    <th className="p-2">Amount</th>
                    <th className="p-2">Beneficiary Bank Details</th>
                    <th className="p-2">Reason</th>
                    <th className="p-2">Status</th>
                    <th className="p-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {refunds.map((ref) => (
                    <tr key={ref.id}>
                      <td className="p-2 font-mono font-bold text-primary">{ref.refundCode}</td>
                      <td className="p-2 font-semibold text-foreground">{ref.clientName}</td>
                      <td className="p-2 font-bold text-rose-600">{formatInr(ref.refundAmount)}</td>
                      <td className="p-2 font-mono text-[11px]">
                        {ref.bankBeneficiaryName} · A/C: {ref.bankAccountNumber} · IFSC: {ref.bankIfsc}
                      </td>
                      <td className="p-2 text-muted-foreground">{ref.reason}</td>
                      <td className="p-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          ref.status === 'executed_paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : ref.status === 'approved'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {ref.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="p-2 text-right space-x-2">
                        {ref.status === 'pending_approval' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 text-emerald-600"
                              onClick={() => handleDecideRefund(ref.id, 'approved')}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 text-rose-600"
                              onClick={() => handleDecideRefund(ref.id, 'rejected')}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                        {ref.status === 'approved' && (
                          <Button
                            size="sm"
                            variant="default"
                            className="text-xs h-7 bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => handleDecideRefund(ref.id, 'executed_paid')}
                          >
                            Confirm Payment Execution
                          </Button>
                        )}
                        {ref.status === 'executed_paid' && (
                          <span className="text-[11px] text-muted-foreground">Executed ({ref.externalPaymentRef})</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Match Modal */}
      {showMatchModal && selectedReceipt && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg max-w-lg w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-foreground">Match Receipt to Open Invoice (CFO-06)</h3>
            <p className="text-xs text-muted-foreground">
              Receipt <span className="font-mono font-bold text-primary">{selectedReceipt.receiptCode}</span> (Available: {formatInr(selectedReceipt.unmatchedAmount)})
            </p>
            <form onSubmit={handleMatch} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground">Select Candidate Invoice</label>
                <select
                  value={selectedInvoiceId}
                  onChange={(e) => {
                    setSelectedInvoiceId(e.target.value);
                    const inv = invoices.find((i) => i.id === e.target.value);
                    if (inv) {
                      setMatchAmount(Math.min(selectedReceipt.unmatchedAmount, inv.outstandingBalance));
                    }
                  }}
                  className="w-full mt-1 p-2 rounded border border-border bg-background text-foreground text-sm"
                >
                  {invoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNumber} — {inv.clientName} (Balance: {formatInr(inv.outstandingBalance)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">Allocation Amount (₹)</label>
                <input
                  type="number"
                  required
                  max={selectedReceipt.unmatchedAmount}
                  value={matchAmount}
                  onChange={(e) => setMatchAmount(Number(e.target.value))}
                  className="w-full mt-1 p-2 rounded border border-border bg-background text-foreground text-sm"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowMatchModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="default">
                  Confirm Transactional Match
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// CFO-12 & CFO-13: Incentive Calculations & Disputes
// =========================================================================
export function CfoIncentivesPage() {
  const [calculations, setCalculations] = useState<IncentiveCalculation[]>([]);
  const [disputes, setDisputes] = useState<IncentiveDispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFreezeModal, setShowFreezeModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [selectedCalc, setSelectedCalc] = useState<IncentiveCalculation | null>(null);
  const [selectedDispute, setSelectedDispute] = useState<IncentiveDispute | null>(null);

  const [payoutRef, setPayoutRef] = useState('PAYOUT-BATCH-2026-Q1');
  const [resDecision, setResDecision] = useState<'resolved_upheld' | 'resolved_rejected'>('resolved_upheld');
  const [resAmount, setResAmount] = useState(25000);
  const [resNotes, setResNotes] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [cData, dData] = await Promise.all([
        cfoApi.getIncentives(),
        cfoApi.getIncentiveDisputes(),
      ]);
      setCalculations(cData.calculations);
      setDisputes(dData.disputes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleFreezePayout(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCalc) return;
    try {
      await cfoApi.freezeIncentivePayout(selectedCalc.id, { payoutHandoffReference: payoutRef });
      setShowFreezeModal(false);
      setSelectedCalc(null);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleResolveDispute(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDispute) return;
    try {
      await cfoApi.resolveIncentiveDispute(selectedDispute.id, {
        resolution: resDecision,
        resolutionAmount: resDecision === 'resolved_upheld' ? Number(resAmount) : 0,
        decisionNotes: resNotes,
      });
      setShowResolveModal(false);
      setSelectedDispute(null);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Commissions & Incentive Governance (CFO-12, CFO-13)"
        subtitle="Scheme rule compliance, clawback reserve provisions, dispute arbitration, and payroll payout freeze."
      />

      {/* Calculations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold">Incentive Calculations Pool & Clawback Reserves (CFO-12)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {calculations.map((calc) => (
            <div key={calc.id} className="p-4 rounded-lg border border-border bg-card space-y-3">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <span className="font-mono font-bold text-primary mr-2">{calc.calculationCode}</span>
                  <span className="font-bold text-foreground text-sm">{calc.schemeName} (v{calc.schemeVersion})</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                    calc.status === 'frozen_for_payout' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {calc.status.replace('_', ' ').toUpperCase()}
                  </span>
                  {calc.status === 'calculated' && (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => {
                        setSelectedCalc(calc);
                        setShowFreezeModal(true);
                      }}
                    >
                      Freeze for Payroll Payout
                    </Button>
                  )}
                </div>
              </div>

              {/* Pool metrics */}
              <div className="grid grid-cols-3 gap-3 p-3 rounded bg-muted/40 text-center text-xs">
                <div>
                  <span className="text-muted-foreground">Total Pool:</span>
                  <p className="font-bold text-foreground mt-0.5">{formatInr(calc.totalIncentivePool)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Clawback Reserve (15%):</span>
                  <p className="font-bold text-amber-600 mt-0.5">{formatInr(calc.clawbackReserve)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Net Payable Payout:</span>
                  <p className="font-bold text-emerald-600 mt-0.5">{formatInr(calc.payableIncentiveTotal)}</p>
                </div>
              </div>

              {/* Employee Breakdown */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="text-muted-foreground bg-muted/20">
                    <tr>
                      <th className="p-1.5">Employee</th>
                      <th className="p-1.5">Role</th>
                      <th className="p-1.5">Gross Calculated</th>
                      <th className="p-1.5">Clawback Provision</th>
                      <th className="p-1.5">Net Payout</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {calc.employeeAllocations.map((alloc) => (
                      <tr key={alloc.employeeId}>
                        <td className="p-1.5 font-medium">{alloc.employeeName}</td>
                        <td className="p-1.5 text-muted-foreground font-mono">{alloc.role}</td>
                        <td className="p-1.5">{formatInr(alloc.grossIncentive)}</td>
                        <td className="p-1.5 text-amber-600">-{formatInr(alloc.clawback)}</td>
                        <td className="p-1.5 font-bold text-emerald-600">{formatInr(alloc.netPayable)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Disputes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold">Incentive Disputes Register (CFO-13)</CardTitle>
        </CardHeader>
        <CardContent>
          {disputes.length === 0 ? (
            <p className="text-xs text-muted-foreground">No active incentive disputes logged.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="p-2">Dispute #</th>
                    <th className="p-2">Employee</th>
                    <th className="p-2">Disputed Amount</th>
                    <th className="p-2">Claim Details</th>
                    <th className="p-2">Status</th>
                    <th className="p-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {disputes.map((d) => (
                    <tr key={d.id}>
                      <td className="p-2 font-mono font-bold text-primary">{d.disputeCode}</td>
                      <td className="p-2 font-semibold text-foreground">{d.employeeName || d.employeeId}</td>
                      <td className="p-2 font-bold text-rose-600">{formatInr(d.disputedAmount)}</td>
                      <td className="p-2 text-muted-foreground max-w-[250px] truncate">{d.employeeClaim}</td>
                      <td className="p-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          d.status === 'resolved_upheld'
                            ? 'bg-emerald-100 text-emerald-800'
                            : d.status === 'resolved_rejected'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {d.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="p-2 text-right">
                        {d.status === 'open' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7"
                            onClick={() => {
                              setSelectedDispute(d);
                              setResAmount(d.disputedAmount);
                              setShowResolveModal(true);
                            }}
                          >
                            Resolve Dispute
                          </Button>
                        )}
                        {d.status !== 'open' && (
                          <span className="text-[11px] text-muted-foreground">Resolved</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Freeze Payout Modal */}
      {showFreezeModal && selectedCalc && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-foreground">Freeze Incentive Payout (CFO-12)</h3>
            <p className="text-xs text-muted-foreground">
              Freezes calculation <span className="font-mono font-bold">{selectedCalc.calculationCode}</span> and exports handoff to payroll system.
            </p>
            <form onSubmit={handleFreezePayout} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground">Payroll Payout Reference</label>
                <input
                  type="text"
                  required
                  value={payoutRef}
                  onChange={(e) => setPayoutRef(e.target.value)}
                  className="w-full mt-1 p-2 rounded border border-border bg-background text-foreground text-sm font-mono"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowFreezeModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="default">
                  Lock & Authorize Payout
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resolve Dispute Modal */}
      {showResolveModal && selectedDispute && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg max-w-lg w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-foreground">Resolve Incentive Dispute (CFO-13)</h3>
            <p className="text-xs text-muted-foreground">
              Employee Claim: "{selectedDispute.employeeClaim}" (Claimed: {formatInr(selectedDispute.disputedAmount)})
            </p>
            <form onSubmit={handleResolveDispute} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground">Resolution Ruling</label>
                <select
                  value={resDecision}
                  onChange={(e) => setResDecision(e.target.value as any)}
                  className="w-full mt-1 p-2 rounded border border-border bg-background text-foreground text-sm"
                >
                  <option value="resolved_upheld">Uphold Claim (Award Adjustment)</option>
                  <option value="resolved_rejected">Reject Claim (Strict Policy Adherence)</option>
                </select>
              </div>
              {resDecision === 'resolved_upheld' && (
                <div>
                  <label className="text-xs font-semibold text-foreground">Approved Adjustment Amount (₹)</label>
                  <input
                    type="number"
                    required
                    value={resAmount}
                    onChange={(e) => setResAmount(Number(e.target.value))}
                    className="w-full mt-1 p-2 rounded border border-border bg-background text-foreground text-sm"
                  />
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-foreground">Independent Decision Rationale</label>
                <textarea
                  required
                  rows={3}
                  value={resNotes}
                  onChange={(e) => setResNotes(e.target.value)}
                  placeholder="Document audited policy evidence and precedent rationale..."
                  className="w-full mt-1 p-2 rounded border border-border bg-background text-foreground text-sm"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowResolveModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="default">
                  Submit Binding Ruling
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// CFO-16 & CFO-17: Budgets, Cost Variance & Forecast Concurrence
// =========================================================================
export function CfoPlanningPage() {
  const [budgets, setBudgets] = useState<VerticalBudgetLine[]>([]);
  const [reviews, setReviews] = useState<ForecastFinanceReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConcurModal, setShowConcurModal] = useState(false);

  // Concurrence form
  const [salesProj, setSalesProj] = useState(85000000);
  const [discRate, setDiscRate] = useState(12);
  const [paceDays, setPaceDays] = useState(45);
  const [assumptions, setAssumptions] = useState('12% macro discount applied due to Q3 SEBI fee disclosure transition; 45d cash collection lag expected.');
  const [status, setStatus] = useState<'concurred' | 'concurred_with_reservations' | 'corrections_required'>('concurred');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [bData, fData] = await Promise.all([
        cfoApi.getBudgets(),
        cfoApi.getForecastReviews(),
      ]);
      setBudgets(bData.budgets);
      setReviews(fData.reviews);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleConcur(e: React.FormEvent) {
    e.preventDefault();
    try {
      await cfoApi.submitForecastConcurrence({
        periodLabel: 'FY26-Q3',
        vertical: 'wealth',
        salesProjectedRevenue: Number(salesProj),
        financeDiscountRatePct: Number(discRate),
        cashConversionPaceDays: Number(paceDays),
        financeAssumptions: assumptions,
        concurrenceStatus: status,
      });
      setShowConcurModal(false);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader
          title="Budgets & Forecast Finance Concurrence (CFO-16, CFO-17)"
          subtitle="Operating cost category performance, variance management, and finance discount rate sign-off on executive forecasts."
        />
        <Button variant="default" size="sm" onClick={() => setShowConcurModal(true)}>
          <Plus className="w-4 h-4 mr-1.5" /> Concur on Forecast (CFO-17)
        </Button>
      </div>

      {/* Budget Lines */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold">Vertical Operating Expense & Budget Lines (CFO-16)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="p-2">Code</th>
                  <th className="p-2">Cost Category</th>
                  <th className="p-2">Approved Budget</th>
                  <th className="p-2">Committed</th>
                  <th className="p-2">Actual Costs</th>
                  <th className="p-2">Variance Left</th>
                  <th className="p-2">Variance %</th>
                  <th className="p-2">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {budgets.map((b) => (
                  <tr key={b.id}>
                    <td className="p-2 font-mono font-bold text-primary">{b.budgetCode}</td>
                    <td className="p-2 font-semibold text-foreground">{b.costCategory}</td>
                    <td className="p-2">{formatInr(b.approvedBudget)}</td>
                    <td className="p-2 text-muted-foreground">{formatInr(b.committedCosts)}</td>
                    <td className="p-2 font-medium">{formatInr(b.actualCosts)}</td>
                    <td className="p-2 font-bold text-emerald-600">{formatInr(b.varianceAmount)}</td>
                    <td className="p-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                        +{b.variancePct}%
                      </span>
                    </td>
                    <td className="p-2 text-muted-foreground max-w-[200px] truncate">{b.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Forecast Concurrence */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold">Executive Forecast Finance Reviews (CFO-17)</CardTitle>
        </CardHeader>
        <CardContent>
          {reviews.length === 0 ? (
            <p className="text-xs text-muted-foreground">No forecast concurrence reviews submitted.</p>
          ) : (
            <div className="space-y-3">
              {reviews.map((r) => (
                <div key={r.id} className="p-3 rounded-lg border border-border bg-card">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-bold text-sm text-foreground">{r.periodLabel} ({r.vertical.toUpperCase()})</span>
                      <span className="ml-2 text-xs text-muted-foreground">by {r.concurredByName || 'Ananya Roy (CFO)'}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      r.concurrenceStatus === 'concurred'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {r.concurrenceStatus.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-2 border-t border-border text-xs">
                    <div>
                      <span className="text-muted-foreground">Sales Projected:</span>
                      <p className="font-bold">{formatInr(r.salesProjectedRevenue)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Finance Discount:</span>
                      <p className="font-bold text-rose-600">-{r.financeDiscountRatePct}%</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Risk-Adjusted Rev:</span>
                      <p className="font-bold text-emerald-600">{formatInr(r.riskAdjustedRevenue)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Cash Pace Days:</span>
                      <p className="font-bold">{r.cashConversionPaceDays} days</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 italic">"{r.financeAssumptions}"</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Concur Modal */}
      {showConcurModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg max-w-lg w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-foreground">Finance Forecast Concurrence (CFO-17)</h3>
            <form onSubmit={handleConcur} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground">Sales Projected Revenue (₹)</label>
                  <input
                    type="number"
                    required
                    value={salesProj}
                    onChange={(e) => setSalesProj(Number(e.target.value))}
                    className="w-full mt-1 p-2 rounded border border-border bg-background text-foreground text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">Discount Rate (%)</label>
                  <input
                    type="number"
                    required
                    value={discRate}
                    onChange={(e) => setDiscRate(Number(e.target.value))}
                    className="w-full mt-1 p-2 rounded border border-border bg-background text-foreground text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">Cash Conversion Lag (Days)</label>
                <input
                  type="number"
                  required
                  value={paceDays}
                  onChange={(e) => setPaceDays(Number(e.target.value))}
                  className="w-full mt-1 p-2 rounded border border-border bg-background text-foreground text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">Concurrence Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full mt-1 p-2 rounded border border-border bg-background text-foreground text-sm"
                >
                  <option value="concurred">Concurred (Unqualified)</option>
                  <option value="concurred_with_reservations">Concurred with Reservations</option>
                  <option value="corrections_required">Corrections Required</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">Documented Finance Assumptions</label>
                <textarea
                  required
                  rows={3}
                  value={assumptions}
                  onChange={(e) => setAssumptions(e.target.value)}
                  className="w-full mt-1 p-2 rounded border border-border bg-background text-foreground text-sm"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowConcurModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="default">
                  Submit Concurrence
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// CFO-14 & CFO-15: Reporting Periods & Reopening Governance
// =========================================================================
export function CfoClosePage() {
  const [periods, setPeriods] = useState<ReportingPeriod[]>([]);
  const [requests, setRequests] = useState<PeriodReopenRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCertifyModal, setShowCertifyModal] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<ReportingPeriod | null>(null);

  // Certify Checklist
  const [chkRecons, setChkRecons] = useState(true);
  const [chkExceptions, setChkExceptions] = useState(true);
  const [chkLedger, setChkLedger] = useState(true);
  const [chkTax, setChkTax] = useState(true);

  // Reopen Form
  const [reopenReason, setReopenReason] = useState('');
  const [reopenImpact, setReopenImpact] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [pData, rData] = await Promise.all([
        cfoApi.getPeriods(),
        cfoApi.getPeriodReopenRequests(),
      ]);
      setPeriods(pData.periods);
      setRequests(rData.requests);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCertify(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPeriod) return;
    try {
      await cfoApi.certifyPeriod(selectedPeriod.id, {
        checklistState: {
          reconciliations_passed: chkRecons,
          exceptions_reviewed: chkExceptions,
          ledger_balanced: chkLedger,
          tax_provisioned: chkTax,
        },
      });
      setShowCertifyModal(false);
      setSelectedPeriod(null);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleCreateReopen(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPeriod) return;
    try {
      await cfoApi.createPeriodReopenRequest({
        periodId: selectedPeriod.id,
        reason: reopenReason,
        impactAssessment: reopenImpact,
        affectedAccounts: ['4001-WEALTH-PMS'],
      });
      setShowReopenModal(false);
      setSelectedPeriod(null);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleDecideReopen(id: string, decision: 'approved' | 'rejected') {
    try {
      await cfoApi.decidePeriodReopenRequest(id, { decision, unlockHours: 48 });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reporting Period Close & Controlled Reopening (CFO-14, CFO-15)"
        subtitle="Cryptographic certification lock of financial ledgers and controlled unlock governance."
      />

      {/* Periods */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold">Reporting Periods & Close Certification (CFO-14)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="p-2">Period Label</th>
                  <th className="p-2">Dates</th>
                  <th className="p-2">Governed Writes Lock</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Certification Hash</th>
                  <th className="p-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {periods.map((p) => (
                  <tr key={p.id}>
                    <td className="p-2 font-mono font-bold text-primary">{p.periodLabel}</td>
                    <td className="p-2 text-muted-foreground">{p.startDate} to {p.endDate}</td>
                    <td className="p-2">
                      {p.lockGovernedWrites ? (
                        <span className="flex items-center text-rose-600 font-semibold">
                          <Lock className="w-3.5 h-3.5 mr-1" /> Locked (Read-Only)
                        </span>
                      ) : (
                        <span className="flex items-center text-emerald-600 font-semibold">
                          <Unlock className="w-3.5 h-3.5 mr-1" /> Open for Writes
                        </span>
                      )}
                    </td>
                    <td className="p-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        p.status === 'certified_closed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {p.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="p-2 font-mono text-[11px] text-muted-foreground">
                      {p.certificationHash || 'Pending Certification'}
                    </td>
                    <td className="p-2 text-right space-x-2">
                      {p.status === 'open' && (
                        <Button
                          size="sm"
                          variant="default"
                          className="text-xs h-7"
                          onClick={() => {
                            setSelectedPeriod(p);
                            setShowCertifyModal(true);
                          }}
                        >
                          Certify Close
                        </Button>
                      )}
                      {p.status === 'certified_closed' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 text-amber-600"
                          onClick={() => {
                            setSelectedPeriod(p);
                            setShowReopenModal(true);
                          }}
                        >
                          Request Reopening (CFO-15)
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Reopening Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold">Controlled Period Reopening Requests (CFO-15)</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-xs text-muted-foreground">No period reopening requests logged.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="p-2">Period</th>
                    <th className="p-2">Requested By</th>
                    <th className="p-2">Reason</th>
                    <th className="p-2">Impact Assessment</th>
                    <th className="p-2">Status</th>
                    <th className="p-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {requests.map((req) => (
                    <tr key={req.id}>
                      <td className="p-2 font-mono font-bold text-primary">{req.periodLabel || req.periodId}</td>
                      <td className="p-2 font-medium">{req.requestedByName || 'Employee'}</td>
                      <td className="p-2 text-foreground">{req.reason}</td>
                      <td className="p-2 text-muted-foreground max-w-[200px] truncate">{req.impactAssessment}</td>
                      <td className="p-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          req.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : req.status === 'rejected'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {req.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-2 text-right space-x-2">
                        {req.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 text-emerald-600"
                              onClick={() => handleDecideReopen(req.id, 'approved')}
                            >
                              Authorize Unlock
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 text-rose-600"
                              onClick={() => handleDecideReopen(req.id, 'rejected')}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Certify Modal */}
      {showCertifyModal && selectedPeriod && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-foreground">Certify Period Close (CFO-14)</h3>
            <p className="text-xs text-muted-foreground">
              Period <span className="font-mono font-bold text-primary">{selectedPeriod.periodLabel}</span>. All checks must pass to enforce lock.
            </p>
            <form onSubmit={handleCertify} className="space-y-3">
              <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                <input type="checkbox" checked={chkRecons} onChange={(e) => setChkRecons(e.target.checked)} />
                Three-Way Sales vs Cash Reconciliations Passed
              </label>
              <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                <input type="checkbox" checked={chkExceptions} onChange={(e) => setChkExceptions(e.target.checked)} />
                All Commercial Exceptions & Concessions Cleared
              </label>
              <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                <input type="checkbox" checked={chkLedger} onChange={(e) => setChkLedger(e.target.checked)} />
                Trial Balance & Sub-Ledgers Balanced
              </label>
              <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                <input type="checkbox" checked={chkTax} onChange={(e) => setChkTax(e.target.checked)} />
                Statutory GST & Withholding Tax Fully Provisioned
              </label>
              <div className="flex justify-end gap-3 pt-3">
                <Button type="button" variant="outline" onClick={() => setShowCertifyModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="default" disabled={!chkRecons || !chkExceptions || !chkLedger || !chkTax}>
                  Lock & Certify Period
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reopen Modal */}
      {showReopenModal && selectedPeriod && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg max-w-lg w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-foreground">Request Period Reopening (CFO-15)</h3>
            <form onSubmit={handleCreateReopen} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground">Reason for Reopening</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Audit correction for late overseas receipt..."
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  className="w-full mt-1 p-2 rounded border border-border bg-background text-foreground text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">Financial Impact Assessment</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Detail affected ledger accounts and projected revenue adjustment..."
                  value={reopenImpact}
                  onChange={(e) => setReopenImpact(e.target.value)}
                  className="w-full mt-1 p-2 rounded border border-border bg-background text-foreground text-sm"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowReopenModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="default">
                  Submit Reopen Request
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// CFO-18: Certified Finance Pack & Schedules
// =========================================================================
export function CfoReportsPage() {
  const [preview, setPreview] = useState<FinancePackPreview | null>(null);
  const [schedules, setSchedules] = useState<FinancePackSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  const [schedTitle, setSchedTitle] = useState('Monthly Executive Financial Statement');
  const [schedCadence, setSchedCadence] = useState<'monthly_close' | 'quarterly_board' | 'bi_weekly_cash'>('monthly_close');
  const [schedEmails, setSchedEmails] = useState('board@finverse.demo, cfo@finverse.demo');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [prvData, schData] = await Promise.all([
        cfoApi.getReportPreview('FY26-Q1'),
        cfoApi.getSchedules(),
      ]);
      setPreview(prvData.preview);
      setSchedules(schData.schedules);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleExportPdf() {
    setExporting(true);
    try {
      const res = await cfoApi.exportPdf('FY26-Q1');
      window.open(res.downloadUrl, '_blank');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setExporting(false);
    }
  }

  async function handleCreateSchedule(e: React.FormEvent) {
    e.preventDefault();
    try {
      const recipients = schedEmails.split(',').map((s) => s.trim()).filter(Boolean);
      await cfoApi.createSchedule({
        title: schedTitle,
        cadence: schedCadence,
        recipients,
        includeFullLedger: false,
      });
      setShowScheduleModal(false);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader
          title="Certified Finance Pack & Automated Schedules (CFO-18)"
          subtitle="Board-ready certified financial statements, PDF pack generation with Finverse branding, and distribution schedules."
        />
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setShowScheduleModal(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> New Schedule
          </Button>
          <Button variant="default" size="sm" onClick={handleExportPdf} disabled={exporting}>
            <Download className="w-4 h-4 mr-1.5" />
            {exporting ? 'Exporting PDF...' : 'Download Certified Finance Pack (PDF)'}
          </Button>
        </div>
      </div>

      {/* Preview Card */}
      {preview && (
        <Card className="border-t-4 border-t-primary">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-base font-bold">Official Financial Pack Preview — {preview.periodLabel}</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Statutory Close Version: <span className="font-mono text-primary font-bold">{preview.closeVersion}</span>
                </p>
              </div>
              <span className="px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 text-xs font-semibold">
                {preview.complianceCertification.status}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-lg bg-muted/40 border border-border text-center text-xs">
              <div>
                <span className="text-muted-foreground">Recognised Revenue:</span>
                <p className="text-sm font-bold text-foreground mt-0.5">{formatInr(preview.executiveFinancialSummary.recognisedRevenue)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Cash Receipts:</span>
                <p className="text-sm font-bold text-emerald-600 mt-0.5">{formatInr(preview.executiveFinancialSummary.cashReceipts)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Receivables:</span>
                <p className="text-sm font-bold text-amber-600 mt-0.5">{formatInr(preview.executiveFinancialSummary.receivables)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Unexplained Variance:</span>
                <p className="text-sm font-bold text-foreground mt-0.5">{formatInr(preview.salesCashReconciliation.variance)} (Balanced)</p>
              </div>
            </div>

            <div className="p-3 rounded border border-border text-xs text-muted-foreground space-y-1">
              <p><span className="font-semibold text-foreground">Signatory:</span> {preview.complianceCertification.certifiedBy}</p>
              <p><span className="font-semibold text-foreground">Audit Hash:</span> <span className="font-mono text-[11px]">{preview.complianceCertification.certificationHash}</span></p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Schedules Register */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold">Automated Executive Distribution Schedules</CardTitle>
        </CardHeader>
        <CardContent>
          {schedules.length === 0 ? (
            <p className="text-xs text-muted-foreground">No recurring distribution schedules registered.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="p-2">Title</th>
                    <th className="p-2">Cadence</th>
                    <th className="p-2">Recipients</th>
                    <th className="p-2">Full Ledger Included</th>
                    <th className="p-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {schedules.map((s) => (
                    <tr key={s.id}>
                      <td className="p-2 font-bold text-foreground">{s.title}</td>
                      <td className="p-2 capitalize text-muted-foreground">{s.cadence.replace('_', ' ')}</td>
                      <td className="p-2 font-mono text-[11px]">{s.recipients.join(', ')}</td>
                      <td className="p-2">{s.includeFullLedger ? 'Yes' : 'No (Summary Only)'}</td>
                      <td className="p-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                          ACTIVE
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-foreground">Create Distribution Schedule (CFO-18)</h3>
            <form onSubmit={handleCreateSchedule} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground">Report Title</label>
                <input
                  type="text"
                  required
                  value={schedTitle}
                  onChange={(e) => setSchedTitle(e.target.value)}
                  className="w-full mt-1 p-2 rounded border border-border bg-background text-foreground text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">Cadence</label>
                <select
                  value={schedCadence}
                  onChange={(e) => setSchedCadence(e.target.value as any)}
                  className="w-full mt-1 p-2 rounded border border-border bg-background text-foreground text-sm"
                >
                  <option value="monthly_close">Monthly Financial Close</option>
                  <option value="quarterly_board">Quarterly Board Pack</option>
                  <option value="bi_weekly_cash">Bi-Weekly Cash Run-Rate</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">Recipient Emails (comma separated)</label>
                <input
                  type="text"
                  required
                  value={schedEmails}
                  onChange={(e) => setSchedEmails(e.target.value)}
                  className="w-full mt-1 p-2 rounded border border-border bg-background text-foreground text-sm"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowScheduleModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="default">
                  Register Schedule
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// CFO-19: Finance Approval Limits & Policies (DoA)
// =========================================================================
export function CfoPoliciesPage() {
  const [policies, setPolicies] = useState<FinancePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'delegation_of_authority' | 'revenue_recognition' | 'incentive_scheme' | 'credit_terms'>('delegation_of_authority');
  const [effectiveDate, setEffectiveDate] = useState('2026-11-01');
  const [summary, setSummary] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const data = await cfoApi.getPolicies();
      setPolicies(data.policies);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleProposePolicy(e: React.FormEvent) {
    e.preventDefault();
    try {
      await cfoApi.proposePolicy({
        title,
        category,
        version: '1.1',
        effectiveDate,
        rulesSummary: summary,
        approvalLimits: {
          TL: 50000,
          MG: 200000,
          RM: 1000000,
          NM: 5000000,
          CFO: 50000000,
        },
      });
      setShowModal(false);
      setTitle('');
      setSummary('');
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader
          title="Delegation of Authority & Financial Policies (CFO-19)"
          subtitle="Approval limits matrix across management tiers, revenue recognition rules, and credit concession governance."
        />
        <Button variant="default" size="sm" onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4 mr-1.5" /> Propose Policy Modification (CFO-19)
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {policies.map((p) => (
          <Card key={p.id}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-mono text-xs font-bold text-primary mr-2">{p.policyCode}</span>
                  <CardTitle className="text-base font-bold mt-1">{p.title}</CardTitle>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-semibold">
                  v{p.version} · {p.status.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Effective Date: {p.effectiveDate}</p>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <p className="text-foreground">{p.rulesSummary}</p>
              {Object.keys(p.approvalLimits).length > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="font-semibold text-muted-foreground uppercase text-[11px] mb-2">Delegated Concession Approval Limits</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(p.approvalLimits).map(([role, limit]) => (
                      <div key={role} className="p-2 rounded bg-muted/40 border border-border">
                        <span className="font-semibold text-primary">{role}:</span>
                        <p className="font-bold text-foreground">{formatInr(limit)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Propose Policy Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg max-w-lg w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-foreground">Propose Financial Policy / Limit Modification (CFO-19)</h3>
            <form onSubmit={handleProposePolicy} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground">Policy Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. FY27 Revised Delegation of Authority (DoA)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full mt-1 p-2 rounded border border-border bg-background text-foreground text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full mt-1 p-2 rounded border border-border bg-background text-foreground text-sm"
                  >
                    <option value="delegation_of_authority">Delegation of Authority (DoA)</option>
                    <option value="revenue_recognition">Revenue Recognition</option>
                    <option value="incentive_scheme">Incentive Scheme</option>
                    <option value="credit_terms">Credit & Billing Terms</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">Effective Date</label>
                  <input
                    type="date"
                    required
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    className="w-full mt-1 p-2 rounded border border-border bg-background text-foreground text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">Summary & Governance Rules</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Describe proposed changes to fee discount thresholds, independent approver chains, and audit controls..."
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  className="w-full mt-1 p-2 rounded border border-border bg-background text-foreground text-sm"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="default">
                  Submit Policy Proposal
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
