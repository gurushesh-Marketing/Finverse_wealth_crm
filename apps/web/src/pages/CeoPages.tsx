import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ceoApi } from '../lib/ceo-api';
import { PageHeader, Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input, Textarea } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Panel, BusyButton } from '../components/ui/panel';
import { EmptyState, SkeletonRows, SuccessNote } from '../components/ui/states';
import type { CeoPeriod } from '@finverse/contracts';

function useLoad<T = any>(fn: () => Promise<T>): [T | null, () => void] {
  const [data, setData] = useState<T | null>(null);
  const load = useCallback(() => {
    void fn().then(setData).catch(() => setData(null));
  }, [fn]);
  useEffect(load, [load]);
  return [data, load];
}

function useSubmitAction() {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>, successMsg?: string) => {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await fn();
      if (successMsg) setNote(successMsg);
    } catch (err: any) {
      setError(err?.message || 'Action failed. Please verify your inputs.');
    } finally {
      setBusy(false);
    }
  };

  return { busy, note, error, setError, setNote, run };
}

function FormField({ label, children, error }: { label: string; children: ReactNode; error?: string }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-foreground">{label}</label>
      {children}
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

// ─── CEO-01: Company Operating Picture ───
export function CeoOperatingPage() {
  const [period, setPeriod] = useState<CeoPeriod>('month-to-date');
  const [focusVertical, setFocusVertical] = useState('all');
  const [data] = useLoad<any>(() => ceoApi.operatingPicture(period, focusVertical));
  const [commitmentDrawerOpen, setCommitmentDrawerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [accountableLeader, setAccountableLeader] = useState('Vikram Malhotra (NM - Wealth)');
  const [mandate, setMandate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const s = useSubmitAction();

  const handleCreateCommitment = async () => {
    if (!title.trim() || !mandate.trim() || !dueDate) {
      s.setError('Please provide title, actionable mandate, and target due date.');
      return;
    }
    await s.run(async () => {
      await ceoApi.createCommitment({
        sourceAction: 'CEO-01',
        title: title.trim(),
        accountableLeader: accountableLeader.trim(),
        vertical: 'all',
        actionableMandate: mandate.trim(),
        dueDate,
      });
      setCommitmentDrawerOpen(false);
      setTitle('');
      setMandate('');
      setDueDate('');
    }, 'Executive commitment recorded.');
  };

  if (!data) return <SkeletonRows rows={6} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Enterprise Operating Picture"
        subtitle="CEO-01 · Firm-wide cross-vertical revenue, win attainment, data watermark & financial close status"
        actions={
          <div className="flex items-center gap-3">
            <Select value={period} onChange={(e) => setPeriod(e.target.value as CeoPeriod)} className="w-44 text-xs">
              <option value="month-to-date">Month to Date</option>
              <option value="quarter-to-date">Quarter to Date</option>
              <option value="fiscal-year-to-date">Fiscal Year to Date</option>
              <option value="last-fiscal-year">Last Fiscal Year</option>
            </Select>
            <Select value={focusVertical} onChange={(e) => setFocusVertical(e.target.value)} className="w-40 text-xs">
              <option value="all">All Divisions</option>
              <option value="wealth">Wealth Management</option>
              <option value="banking">Banking</option>
            </Select>
            <Button variant="default" onClick={() => setCommitmentDrawerOpen(true)}>
              Record Commitment
            </Button>
          </div>
        }
      />

      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}
      {s.error ? <p role="alert" className="text-sm text-destructive">{s.error}</p> : null}

      {/* Watermark Banner */}
      <div className="p-3 bg-muted/30 border border-border/60 rounded-lg flex items-center justify-between text-xs text-muted-foreground">
        <div>
          Financial Status: <strong className="text-foreground">{data.watermark.financeCloseStatus}</strong>
        </div>
        <div>
          Data Freshness: <strong className="text-foreground">{data.watermark.dataFreshnessMinutes} mins ago</strong> | Reconciled against Finance Ledger
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Enterprise Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              ₹{(data.kpis.totalDeliveredRevenue / 10000000).toFixed(1)} / ₹{(data.kpis.totalRevenueTarget / 10000000).toFixed(1)} Cr
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge tone={data.kpis.revenueAttainmentPercent >= 80 ? 'open' : 'pending'}>
                {data.kpis.revenueAttainmentPercent}% Annual Target
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Enterprise Wins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {data.kpis.totalDeliveredWins} / {data.kpis.totalWinsTarget} wins
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge tone={data.kpis.winsAttainmentPercent >= 80 ? 'open' : 'pending'}>
                {data.kpis.winsAttainmentPercent}% Quota Attainment
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Strategic Unallocated Buffer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700">
              ₹{(data.kpis.unallocatedRevenueBuffer / 10000000).toFixed(1)} Cr
            </div>
            <p className="text-xs text-muted-foreground mt-1">{data.kpis.unallocatedWinsBuffer} wins contingency reserve</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Governance & Commitments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {data.kpis.openRisksCount} risks ({data.kpis.criticalRisksCount} critical)
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge tone="default">{data.kpis.inProgressCommitmentsCount} Active Board Commitments</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vertical Contribution Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Division Attainment & Leadership Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-border/60 text-xs font-semibold uppercase text-muted-foreground">
                <th className="py-2.5 px-3">Vertical</th>
                <th className="py-2.5 px-3">National Manager</th>
                <th className="py-2.5 px-3">Delivered Revenue</th>
                <th className="py-2.5 px-3">Closed Wins</th>
                <th className="py-2.5 px-3">Target Pace</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {data.verticalContributions.map((v: any) => (
                <tr key={v.vertical} className="hover:bg-muted/30">
                  <td className="py-3 px-3 font-semibold text-foreground">{v.name}</td>
                  <td className="py-3 px-3 font-medium">{v.nmName}</td>
                  <td className="py-3 px-3 font-mono">₹{(v.deliveredRevenueInr / 10000000).toFixed(2)} Cr</td>
                  <td className="py-3 px-3 font-bold text-primary">{v.deliveredWins} / {v.targetWins}</td>
                  <td className="py-3 px-3">{v.attainmentPace}%</td>
                  <td className="py-3 px-3">
                    <Badge tone={v.status === 'on-track' ? 'open' : 'pending'}>
                      {v.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Drawer: Record Commitment */}
      <Panel open={commitmentDrawerOpen} onClose={() => setCommitmentDrawerOpen(false)} title="Record Executive Commitment">
        <div className="space-y-4 p-4">
          <FormField label="Commitment Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. FY27 Wealth Division Staffing Envelope Finalization" />
          </FormField>

          <FormField label="Accountable Leader">
            <Input value={accountableLeader} onChange={(e) => setAccountableLeader(e.target.value)} />
          </FormField>

          <FormField label="Actionable Executive Mandate">
            <Textarea value={mandate} onChange={(e) => setMandate(e.target.value)} placeholder="State board context, success metrics, and review cadence." rows={4} />
          </FormField>

          <FormField label="Target Delivery Date">
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </FormField>

          <div className="pt-2 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCommitmentDrawerOpen(false)}>Cancel</Button>
            <BusyButton busy={s.busy} onClick={handleCreateCommitment}>Record Commitment</BusyButton>
          </div>
        </div>
      </Panel>
    </div>
  );
}

// ─── CEO-02: Compare Verticals Fairly ───
export function CeoVerticalsPage() {
  const [data] = useLoad<any>(() => ceoApi.compareVerticals('month-to-date'));

  if (!data) return <SkeletonRows rows={6} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cross-Vertical Performance Comparison"
        subtitle="CEO-02 · Fair comparisons across Wealth, Banking, Markets and Real Estate on revenue run-rate, CAC, and unit margins"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {data.comparisons.map((c: any) => (
          <Card key={c.vertical}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">{c.name}</CardTitle>
              <Badge tone={c.riskRating === 'low' ? 'open' : c.riskRating === 'moderate' ? 'pending' : 'overdue'}>
                {c.riskRating.toUpperCase()} RISK
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 bg-muted/20 rounded-md">
                  <div className="text-xs text-muted-foreground">Revenue Run-Rate</div>
                  <div className="text-xl font-bold text-foreground">₹{(c.revenueRunRateInr / 10000000).toFixed(1)} Cr</div>
                </div>
                <div className="p-3 bg-muted/20 rounded-md">
                  <div className="text-xs text-muted-foreground">Gross Margin</div>
                  <div className="text-xl font-bold text-primary">{c.grossMarginPercent}%</div>
                </div>
                <div className="p-3 bg-muted/20 rounded-md">
                  <div className="text-xs text-muted-foreground">Blended CAC</div>
                  <div className="text-xl font-bold text-foreground">₹{c.blendedCacInr.toLocaleString('en-IN')}</div>
                </div>
                <div className="p-3 bg-muted/20 rounded-md">
                  <div className="text-xs text-muted-foreground">Avg Deal Size</div>
                  <div className="text-xl font-bold text-foreground">₹{(c.averageTicketInr / 100000).toFixed(1)} L</div>
                </div>
              </div>

              <div className="border-t border-border/40 pt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>Headcount: <strong>{c.fteCount} FTEs</strong></span>
                <span>Revenue / FTE: <strong>₹{(c.revenuePerFteInr / 100000).toFixed(1)} L</strong></span>
                <span>Speed to Lead: <strong>{c.leadVelocityHours} hrs</strong></span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── CEO-03 & CEO-09: National Leadership ───
export function CeoNmReviewPage() {
  const [data] = useLoad<any>(() => ceoApi.getNmContribution('EMP-009'));
  const [reviews, loadReviews] = useLoad<any[]>(() => ceoApi.listNmReviews('EMP-009'));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [rating, setRating] = useState<'role_model' | 'strong_performer' | 'developing' | 'off_track'>('strong_performer');
  const [strategicAlignment, setStrategicAlignment] = useState('');
  const [operationalExecution, setOperationalExecution] = useState('');
  const [teamHealth, setTeamHealth] = useState('');
  const [boardVisibility, setBoardVisibility] = useState('');
  const [nextDate, setNextDate] = useState('');
  const s = useSubmitAction();

  const handleSaveReview = async () => {
    if (!strategicAlignment.trim() || !operationalExecution.trim() || !nextDate) {
      s.setError('Please complete strategic alignment, operational execution, and next review date.');
      return;
    }
    await s.run(async () => {
      await ceoApi.saveNmReview({
        nmEmployeeId: 'EMP-009',
        vertical: 'wealth',
        periodLabel: 'October 2026',
        overallLeadershipRating: rating,
        strategicAlignment: strategicAlignment.trim(),
        operationalExecution: operationalExecution.trim(),
        teamHealthAndRetention: teamHealth.trim() || 'Solid front-line retention; 0 caller attrition in South.',
        boardVisibilityReadiness: boardVisibility.trim() || 'Ready for Board Strategy presentation.',
        strategicCommitments: ['Activate Mumbai BKC wealth hub', 'Deliver 500 wins target quota'],
        nextReviewDate: nextDate,
      });
      setDrawerOpen(false);
      loadReviews();
    }, 'National Manager leadership review recorded.');
  };

  if (!data) return <SkeletonRows rows={6} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="National Manager Leadership & Contribution"
        subtitle="CEO-03 & CEO-09 · In-depth evaluation of National Manager governance, quota attainment, and executive capability"
        actions={
          <Button variant="default" onClick={() => setDrawerOpen(true)}>
            Conduct NM Leadership Review
          </Button>
        }
      />

      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}
      {s.error ? <p role="alert" className="text-sm text-destructive">{s.error}</p> : null}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">National Manager</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-foreground">{data.nationalManager.display_name}</div>
            <p className="text-xs text-muted-foreground mt-1">Wealth Management Vertical</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Vertical Target</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-foreground">{data.approvedVerticalTarget} wins</div>
            <p className="text-xs text-muted-foreground mt-1">Unallocated: {data.unallocatedRemainder} wins</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Governance Directives</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-foreground">
              {data.governanceRecord.directivesFulfilled} / {data.governanceRecord.directivesIssued}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Directives completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Forecast Variance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-primary">{data.governanceRecord.forecastAccuracyVariancePercent}%</div>
            <p className="text-xs text-muted-foreground mt-1">Within board threshold (±5%)</p>
          </CardContent>
        </Card>
      </div>

      {/* Review History */}
      <Card>
        <CardHeader>
          <CardTitle>Historical Leadership Reviews</CardTitle>
        </CardHeader>
        <CardContent>
          {!reviews || reviews.length === 0 ? (
            <EmptyState title="No leadership reviews" message="No formal CEO reviews recorded yet for this National Manager." />
          ) : (
            <div className="space-y-4">
              {reviews.map((r) => (
                <div key={r.id} className="p-4 border border-border/40 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">{r.nm_name} — {r.period_label}</span>
                    <Badge tone={r.overall_leadership_rating === 'role_model' || r.overall_leadership_rating === 'strong_performer' ? 'open' : 'pending'}>
                      {r.overall_leadership_rating.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                  <div className="text-sm"><strong>Strategic Alignment:</strong> {r.strategic_alignment}</div>
                  <div className="text-sm"><strong>Operational Execution:</strong> {r.operational_execution}</div>
                  <div className="text-xs text-muted-foreground">Next Review: {new Date(r.next_review_date).toLocaleDateString('en-IN')}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drawer: Conduct NM Review */}
      <Panel open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Conduct NM Leadership Review">
        <div className="space-y-4 p-4">
          <FormField label="Overall Leadership Rating">
            <Select value={rating} onChange={(e) => setRating(e.target.value as any)}>
              <option value="role_model">Role Model Executive</option>
              <option value="strong_performer">Strong Performer</option>
              <option value="developing">Developing Leadership</option>
              <option value="off_track">Off Track</option>
            </Select>
          </FormField>

          <FormField label="Strategic Alignment">
            <Textarea value={strategicAlignment} onChange={(e) => setStrategicAlignment(e.target.value)} placeholder="Alignment with firm-wide expansion, pricing governance, and cross-vertical synergy." rows={3} />
          </FormField>

          <FormField label="Operational Execution">
            <Textarea value={operationalExecution} onChange={(e) => setOperationalExecution(e.target.value)} placeholder="Regional division quota rigor, SLA discipline, and forecast accuracy." rows={3} />
          </FormField>

          <FormField label="Next Executive Review Date">
            <Input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
          </FormField>

          <div className="pt-2 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <BusyButton busy={s.busy} onClick={handleSaveReview}>Save Leadership Review</BusyButton>
          </div>
        </div>
      </Panel>
    </div>
  );
}

// ─── CEO-04: Approve Company & Vertical Targets ───
export function CeoTargetsPage() {
  const [data, load] = useLoad<any>(() => ceoApi.getTargets('October', 'FY2026-27'));
  const [totalRevenueTarget, setTotalRevenueTarget] = useState<number>(150000000);
  const [totalWinsTarget, setTotalWinsTarget] = useState<number>(1000);
  const [allocations, setAllocations] = useState<any[]>([
    { vertical: 'wealth', revenueTarget: 75000000, winsTarget: 500, nmEmployeeId: 'EMP-009', nmName: 'Vikram Malhotra' },
    { vertical: 'banking', revenueTarget: 45000000, winsTarget: 350, nmEmployeeId: 'EMP-004', nmName: 'Dev Kapoor' },
    { vertical: 'real-estate', revenueTarget: 20000000, winsTarget: 100, nmEmployeeId: null, nmName: 'Aditya Singhania' },
  ]);
  const s = useSubmitAction();

  useEffect(() => {
    if (data?.totalRevenueTarget) setTotalRevenueTarget(data.totalRevenueTarget);
    if (data?.totalWinsTarget) setTotalWinsTarget(data.totalWinsTarget);
    if (Array.isArray(data?.verticalAllocations) && data.verticalAllocations.length > 0) {
      setAllocations(data.verticalAllocations);
    }
  }, [data]);

  const allocatedWins = allocations.reduce((acc, curr) => acc + (Number(curr.winsTarget) || 0), 0);
  const allocatedRevenue = allocations.reduce((acc, curr) => acc + (Number(curr.revenueTarget) || 0), 0);

  const winsBuffer = totalWinsTarget - allocatedWins;
  const revenueBuffer = totalRevenueTarget - allocatedRevenue;
  const isOverAllocated = winsBuffer < 0 || revenueBuffer < 0;

  const handleUpdateAllocation = (idx: number, field: 'winsTarget' | 'revenueTarget', val: number) => {
    const next = [...allocations];
    next[idx][field] = val;
    setAllocations(next);
  };

  const handleApprove = async (ratify: boolean) => {
    if (isOverAllocated) {
      s.setError('Allocated targets exceed total company budget. Over-allocation is strictly prohibited.');
      return;
    }
    await s.run(async () => {
      await ceoApi.approveTargets({
        periodLabel: 'October',
        fiscalYear: 'FY2026-27',
        totalRevenueTarget,
        totalWinsTarget,
        verticalAllocations: allocations,
        boardRatify: ratify,
      });
      load();
    }, ratify ? 'Company targets ratified and cascaded down to National Managers.' : 'Company target draft saved.');
  };

  if (!data) return <SkeletonRows rows={6} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Company & Vertical Target Approval"
        subtitle="CEO-04 · Reconcile firm-wide budget with vertical divisions, protect strategic reserves, and cascade to NMs"
        actions={
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => handleApprove(false)} disabled={isOverAllocated || s.busy}>
              Save Target Draft
            </Button>
            <Button variant="default" onClick={() => handleApprove(true)} disabled={isOverAllocated || s.busy}>
              Ratify & Cascade to NMs
            </Button>
          </div>
        }
      />

      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}
      {s.error ? <p role="alert" className="text-sm text-destructive">{s.error}</p> : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Total Enterprise Revenue Target</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              type="number"
              value={totalRevenueTarget}
              onChange={(e) => setTotalRevenueTarget(Number(e.target.value))}
              className="text-2xl font-bold h-12"
            />
            <p className="text-xs text-muted-foreground mt-1">₹{(totalRevenueTarget / 10000000).toFixed(1)} Cr total budget</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Allocated Across Divisions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground h-12 flex items-center">
              ₹{(allocatedRevenue / 10000000).toFixed(1)} Cr ({allocatedWins} wins)
            </div>
            <p className="text-xs text-muted-foreground mt-1">Sum of all vertical quotas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Unallocated Strategic Buffer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold h-12 flex items-center ${isOverAllocated ? 'text-destructive' : 'text-amber-700'}`}>
              ₹{(revenueBuffer / 10000000).toFixed(1)} Cr ({winsBuffer} wins)
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {isOverAllocated ? '⚠️ Over-allocated! Reduce vertical allocations.' : 'Executive contingency buffer'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Division Target Allocations</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-border/60 text-xs font-semibold uppercase text-muted-foreground">
                <th className="py-2.5 px-3">Vertical Division</th>
                <th className="py-2.5 px-3">National Leader</th>
                <th className="py-2.5 px-3">Revenue Target (INR)</th>
                <th className="py-2.5 px-3">Wins Target</th>
                <th className="py-2.5 px-3">% of Company Plan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {allocations.map((alloc, idx) => (
                <tr key={alloc.vertical}>
                  <td className="py-3 px-3 font-semibold text-foreground uppercase">{alloc.vertical}</td>
                  <td className="py-3 px-3">{alloc.nmName || 'Unassigned'}</td>
                  <td className="py-3 px-3">
                    <Input
                      type="number"
                      value={alloc.revenueTarget}
                      onChange={(e) => handleUpdateAllocation(idx, 'revenueTarget', Number(e.target.value))}
                      className="w-44"
                    />
                  </td>
                  <td className="py-3 px-3">
                    <Input
                      type="number"
                      value={alloc.winsTarget}
                      onChange={(e) => handleUpdateAllocation(idx, 'winsTarget', Number(e.target.value))}
                      className="w-28"
                    />
                  </td>
                  <td className="py-3 px-3 text-muted-foreground">
                    {totalRevenueTarget > 0 ? Math.round((alloc.revenueTarget / totalRevenueTarget) * 100) : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── CEO-05: Consolidated Company Forecast ───
export function CeoForecastPage() {
  const [data, load] = useLoad<any>(() => ceoApi.getForecastRollup('October'));
  const [adjustment, setAdjustment] = useState<number>(-5000000);
  const [macroAssumptions, setMacroAssumptions] = useState('');
  const s = useSubmitAction();

  useEffect(() => {
    if (data?.executiveMacroAdjustment !== undefined) setAdjustment(data.executiveMacroAdjustment);
    if (data?.macroAssumptions) setMacroAssumptions(data.macroAssumptions);
  }, [data]);

  const handleSignOff = async (signOff: boolean) => {
    if (!macroAssumptions.trim()) {
      s.setError('Please state board macro assumptions.');
      return;
    }
    await s.run(async () => {
      await ceoApi.signOffForecast({
        periodLabel: 'October',
        bottomUpSum: data.bottomUpSum,
        executiveMacroAdjustment: adjustment,
        currency: 'INR',
        verticalSubmissions: data.verticalSubmissions,
        macroAssumptions: macroAssumptions.trim(),
        boardRiskNotes: 'Monitored regulatory delays on PMS advisory approvals.',
        signOff,
      });
      load();
    }, signOff ? 'Consolidated forecast signed off for Board of Directors.' : 'Forecast draft saved.');
  };

  if (!data) return <SkeletonRows rows={6} />;

  const netForecast = data.bottomUpSum + adjustment;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Consolidated Enterprise Forecast"
        subtitle="CEO-05 · Review bottom-up division rollups, apply macro adjustments, and sign off for Board presentation"
        actions={
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => handleSignOff(false)} disabled={s.busy}>
              Save Draft
            </Button>
            <Button variant="default" onClick={() => handleSignOff(true)} disabled={s.busy}>
              Sign Off for Board
            </Button>
          </div>
        }
      />

      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}
      {s.error ? <p role="alert" className="text-sm text-destructive">{s.error}</p> : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Division Bottom-Up Sum</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              ₹{(data.bottomUpSum / 10000000).toFixed(2)} Cr
            </div>
            <p className="text-xs text-muted-foreground mt-1">Rollup of all vertical submissions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Executive Macro Adjustment</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              type="number"
              value={adjustment}
              onChange={(e) => setAdjustment(Number(e.target.value))}
              className="text-2xl font-bold h-12"
            />
            <p className="text-xs text-muted-foreground mt-1">Macro sensitivity adjustment</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Signed-Off Board Forecast</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary h-12 flex items-center">
              ₹{(netForecast / 10000000).toFixed(2)} Cr
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge tone={data.status === 'signed_off_by_ceo' ? 'open' : 'pending'}>
                {data.status.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Board Macro Assumptions & Regulatory Headwinds</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField label="CEO & Board Macro Assumptions">
            <Textarea
              value={macroAssumptions}
              onChange={(e) => setMacroAssumptions(e.target.value)}
              placeholder="State interest rate outlook, market volatility, and liquidity factors."
              rows={3}
            />
          </FormField>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── CEO-06: Growth Initiatives ───
export function CeoGrowthPage() {
  const [initiatives, load] = useLoad<any[]>(() => ceoApi.listGrowthInitiatives());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [vertical, setVertical] = useState<'wealth' | 'banking' | 'markets' | 'real-estate'>('wealth');
  const [capital, setCapital] = useState<number>(15000000);
  const [roi, setRoi] = useState<number>(32.5);
  const [timeline, setTimeline] = useState<number>(6);
  const [sponsor, setSponsor] = useState('Vikram Malhotra (NM - Wealth)');
  const [justification, setJustification] = useState('');
  const s = useSubmitAction();

  const handleCreate = async () => {
    if (!title.trim() || !justification.trim()) {
      s.setError('Please provide title and business justification.');
      return;
    }
    await s.run(async () => {
      await ceoApi.createGrowthInitiative({
        title: title.trim(),
        vertical,
        initiativeType: 'geographic_expansion',
        capitalRequired: capital,
        currency: 'INR',
        projectedRoiPercent: roi,
        timelineMonths: timeline,
        sponsorExecutive: sponsor.trim(),
        justification: justification.trim(),
        implementationTasks: ['Secure office lease', 'Recruit branch manager', 'Deploy IT infrastructure'],
      });
      setDrawerOpen(false);
      setTitle('');
      setJustification('');
      load();
    }, 'Growth initiative submitted.');
  };

  const handleApprove = async (id: string, approved: boolean) => {
    await s.run(async () => {
      await ceoApi.approveGrowthInitiative(id, {
        approved,
        executiveRemarks: approved ? 'Approved by CEO for immediate execution.' : 'Rejected per capital rationing.',
      });
      load();
    }, `Initiative ${approved ? 'approved' : 'rejected'}.`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Strategic Growth & Capacity Initiatives"
        subtitle="CEO-06 · Capital allocation decisions, geographic expansions, and high-ROI capacity surges"
        actions={
          <Button variant="default" onClick={() => setDrawerOpen(true)}>
            Propose Growth Initiative
          </Button>
        }
      />

      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}
      {s.error ? <p role="alert" className="text-sm text-destructive">{s.error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Initiative Register & Capital Commitments</CardTitle>
        </CardHeader>
        <CardContent>
          {!initiatives || initiatives.length === 0 ? (
            <EmptyState title="No active initiatives" message="No pending capital allocation proposals." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-xs font-semibold uppercase text-muted-foreground">
                    <th className="py-2 px-3">Title</th>
                    <th className="py-2 px-3">Vertical</th>
                    <th className="py-2 px-3">Capital Required</th>
                    <th className="py-2 px-3">Projected ROI</th>
                    <th className="py-2 px-3">Sponsor</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-right">CEO Decision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {initiatives.map((gi) => (
                    <tr key={gi.id} className="hover:bg-muted/30">
                      <td className="py-3 px-3 font-semibold text-foreground">{gi.title}</td>
                      <td className="py-3 px-3 uppercase text-xs font-medium">{gi.vertical}</td>
                      <td className="py-3 px-3 font-mono">₹{(Number(gi.capital_required) / 10000000).toFixed(2)} Cr</td>
                      <td className="py-3 px-3 font-bold text-primary">{gi.projected_roi_percent}%</td>
                      <td className="py-3 px-3 text-muted-foreground">{gi.sponsor_executive}</td>
                      <td className="py-3 px-3">
                        <Badge tone={gi.status === 'approved_by_ceo' ? 'open' : gi.status === 'proposed' ? 'pending' : 'overdue'}>
                          {gi.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-right">
                        {gi.status === 'proposed' ? (
                          <div className="flex justify-end gap-1">
                            <Button variant="default" onClick={() => handleApprove(gi.id, true)}>Approve</Button>
                            <Button variant="secondary" onClick={() => handleApprove(gi.id, false)}>Reject</Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Decided</span>
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

      {/* Drawer: Propose Initiative */}
      <Panel open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Propose Strategic Growth Initiative">
        <div className="space-y-4 p-4">
          <FormField label="Initiative Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. West Region BKC Wealth Advisory Hub" />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Vertical">
              <Select value={vertical} onChange={(e) => setVertical(e.target.value as any)}>
                <option value="wealth">Wealth Management</option>
                <option value="banking">Corporate Banking</option>
                <option value="markets">Markets & Trading</option>
                <option value="real-estate">Real Estate</option>
              </Select>
            </FormField>
            <FormField label="Capital Required (INR)">
              <Input type="number" value={capital} onChange={(e) => setCapital(Number(e.target.value))} />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Projected ROI (%)">
              <Input type="number" value={roi} onChange={(e) => setRoi(Number(e.target.value))} />
            </FormField>
            <FormField label="Implementation Timeline (Months)">
              <Input type="number" value={timeline} onChange={(e) => setTimeline(Number(e.target.value))} />
            </FormField>
          </div>

          <FormField label="Business Justification & Market Case">
            <Textarea value={justification} onChange={(e) => setJustification(e.target.value)} placeholder="State client demand, revenue forecast unlock, and competitive moat." rows={4} />
          </FormField>

          <div className="pt-2 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <BusyButton busy={s.busy} onClick={handleCreate}>Submit for Decision</BusyButton>
          </div>
        </div>
      </Panel>
    </div>
  );
}

// ─── CEO-07: Cross-Vertical Conflicts ───
export function CeoConflictsPage() {
  const [conflicts, load] = useLoad<any[]>(() => ceoApi.listConflicts());
  const s = useSubmitAction();

  const handleArbitrate = async (conflictId: string, awardedVertical: any) => {
    await s.run(async () => {
      await ceoApi.arbitrateConflict(conflictId, {
        ceoDetermination: `Arbitrated in favor of ${awardedVertical.toUpperCase()} to maximize firm-wide fee margins.`,
        awardedVertical,
        resolvedAttribution: `${awardedVertical === 'wealth' ? '70% Wealth / 30% Banking' : '50% / 50% split attribution'}`,
      });
      load();
    }, 'Conflict determination recorded.');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cross-Vertical Conflict Arbitration"
        subtitle="CEO-07 · Resolve priority, account ownership, and revenue attribution disputes between division leaders"
      />

      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}
      {s.error ? <p role="alert" className="text-sm text-destructive">{s.error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Arbitration Queue</CardTitle>
        </CardHeader>
        <CardContent>
          {!conflicts || conflicts.length === 0 ? (
            <EmptyState title="No pending conflicts" message="No active inter-divisional ownership disputes." />
          ) : (
            <div className="space-y-4">
              {conflicts.map((c) => (
                <div key={c.id} className="p-4 border border-border/40 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-base text-foreground">{c.prospect_or_client_name}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {c.source_vertical.toUpperCase()} vs {c.conflicting_vertical.toUpperCase()} ({c.conflict_nature.replace('_', ' ')})
                      </span>
                    </div>
                    <Badge tone={c.status === 'resolved' ? 'open' : 'pending'}>{c.status.toUpperCase()}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{c.summary}</p>
                  <div className="grid grid-cols-2 gap-3 text-xs bg-muted/20 p-3 rounded-md">
                    <div><strong>{c.source_vertical.toUpperCase()} Argument:</strong> {c.source_argument}</div>
                    <div><strong>{c.conflicting_vertical.toUpperCase()} Argument:</strong> {c.counter_argument}</div>
                  </div>
                  {c.status === 'open' ? (
                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="default" onClick={() => handleArbitrate(c.id, 'wealth')}>Award to Wealth</Button>
                      <Button variant="secondary" onClick={() => handleArbitrate(c.id, 'banking')}>Award to Banking</Button>
                      <Button variant="outline" onClick={() => handleArbitrate(c.id, 'shared')}>50/50 Split Attribution</Button>
                    </div>
                  ) : (
                    <div className="text-xs text-primary font-semibold">
                      Determination: {c.ceo_determination} ({c.resolved_attribution})
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── CEO-08: Operating Risks & Critical Complaints ───
export function CeoRisksPage() {
  const [risks, load] = useLoad<any[]>(() => ceoApi.listOperatingRisks());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [vertical, setVertical] = useState<'wealth' | 'banking' | 'markets' | 'real-estate'>('wealth');
  const [severity, setSeverity] = useState<'high' | 'critical' | 'existential'>('high');
  const [details, setDetails] = useState('');
  const [deadline, setDeadline] = useState('');
  const s = useSubmitAction();

  const handleCreateRisk = async () => {
    if (!title.trim() || !details.trim() || !deadline) {
      s.setError('Please provide title, details, and executive deadline.');
      return;
    }
    await s.run(async () => {
      await ceoApi.createOperatingRisk({
        vertical,
        riskCategory: 'regulatory_breach',
        severity,
        title: title.trim(),
        details: details.trim(),
        accountableExecutive: 'Vikram Malhotra (NM - Wealth)',
        decisionDeadline: new Date(deadline).toISOString(),
        mitigationMandate: 'Engage legal & compliance for formal audit remediation.',
      });
      setDrawerOpen(false);
      setTitle('');
      setDetails('');
      load();
    }, 'Operating risk registered.');
  };

  const handleResolveRisk = async (id: string) => {
    await s.run(async () => {
      await ceoApi.resolveOperatingRisk(id, {
        mitigationOutcome: 'Mitigation plan executed and audited clean by Compliance.',
      });
      load();
    }, 'Operating risk marked resolved.');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Critical Complaints & Operating Risks"
        subtitle="CEO-08 · Board-level risk register covering regulatory breaches, operational failures, and litigation exposure"
        actions={
          <Button variant="default" onClick={() => setDrawerOpen(true)}>
            Log Operating Risk
          </Button>
        }
      />

      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}
      {s.error ? <p role="alert" className="text-sm text-destructive">{s.error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Board-Level Risk Register</CardTitle>
        </CardHeader>
        <CardContent>
          {!risks || risks.length === 0 ? (
            <EmptyState title="No active risks" message="All critical operating risks have been resolved." />
          ) : (
            <div className="space-y-4">
              {risks.map((r) => (
                <div key={r.id} className="p-4 border border-border/40 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-foreground">{r.title}</span>
                      <span className="text-xs text-muted-foreground ml-2">Vertical: {r.vertical.toUpperCase()}</span>
                    </div>
                    <Badge tone={r.severity === 'existential' || r.severity === 'critical' ? 'overdue' : 'pending'}>
                      {r.severity.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{r.details}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                    <span>Accountable: <strong>{r.accountable_executive}</strong></span>
                    <span>Deadline: <strong>{new Date(r.decision_deadline).toLocaleDateString('en-IN')}</strong></span>
                    {r.status === 'open' ? (
                      <Button variant="secondary" onClick={() => handleResolveRisk(r.id)}>Sign Off Mitigation</Button>
                    ) : (
                      <Badge tone="open">RESOLVED</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drawer: Log Risk */}
      <Panel open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Log Operating Risk">
        <div className="space-y-4 p-4">
          <FormField label="Risk Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. SEBI Advisory Disclosure Compliance" />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Vertical">
              <Select value={vertical} onChange={(e) => setVertical(e.target.value as any)}>
                <option value="wealth">Wealth</option>
                <option value="banking">Banking</option>
                <option value="markets">Markets</option>
              </Select>
            </FormField>
            <FormField label="Severity">
              <Select value={severity} onChange={(e) => setSeverity(e.target.value as any)}>
                <option value="high">High Exposure</option>
                <option value="critical">Critical Risk</option>
                <option value="existential">Existential / Board Level</option>
              </Select>
            </FormField>
          </div>

          <FormField label="Risk Details & Exposure">
            <Textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Document regulatory exposure, financial penalties, or client claims." rows={4} />
          </FormField>

          <FormField label="Mitigation Deadline">
            <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </FormField>

          <div className="pt-2 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <BusyButton busy={s.busy} onClick={handleCreateRisk}>Register Risk</BusyButton>
          </div>
        </div>
      </Panel>
    </div>
  );
}

// ─── CEO-10: Board Packs & Schedules ───
export function CeoBoardPackPage() {
  const [preview] = useLoad<any>(() => ceoApi.previewBoardPack('October 2026'));
  const [schedules, loadSchedules] = useLoad<any[]>(() => ceoApi.listBoardSchedules());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [title, setTitle] = useState('Quarterly Board of Directors Pack');
  const [frequency, setFrequency] = useState<'monthly' | 'quarterly' | 'annual'>('quarterly');
  const [cadence, setCadence] = useState('Last Friday of quarter, 17:00 IST');
  const [stakeholders, setStakeholders] = useState('board@finverse.demo, audit.chair@finverse.demo');
  const s = useSubmitAction();

  const handleExportPdf = async () => {
    await s.run(async () => {
      const res = await ceoApi.exportBoardPackPdf({
        periodLabel: 'October 2026',
        sections: ['company-performance', 'vertical-comparison', 'growth-initiatives', 'operating-risks'],
      });
      window.open(res.downloadUrl, '_blank');
    }, 'Board PDF Pack generated.');
  };

  const handleCreateSchedule = async () => {
    const list = stakeholders.split(',').map((e) => e.trim()).filter(Boolean);
    if (!title.trim() || list.length === 0) {
      s.setError('Please complete title and stakeholder emails.');
      return;
    }
    await s.run(async () => {
      await ceoApi.saveBoardSchedule({
        title: title.trim(),
        frequency,
        deliveryCadence: cadence.trim(),
        stakeholders: list,
        sections: ['company-performance', 'vertical-comparison', 'growth-initiatives', 'operating-risks'],
        status: 'active',
      });
      setDrawerOpen(false);
      loadSchedules();
    }, 'Board pack schedule configured.');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Board & Executive Meeting Packs"
        subtitle="CEO-10 · High-fidelity board packs with binary PDF exports and automated distribution schedules"
        actions={
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
              Schedule Board Pack
            </Button>
            <Button variant="default" onClick={handleExportPdf} disabled={s.busy}>
              Export Board PDF Pack
            </Button>
          </div>
        }
      />

      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}
      {s.error ? <p role="alert" className="text-sm text-destructive">{s.error}</p> : null}

      {/* Preview Card */}
      {preview ? (
        <Card>
          <CardHeader>
            <CardTitle>Board Meeting Pack Preview (Finverse Palette #113F3D)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="p-4 bg-muted/20 border border-border/40 rounded-lg space-y-2">
              <div className="font-bold text-base text-foreground">Section 1: Enterprise Operating Picture & Attainment</div>
              <p className="text-muted-foreground">
                Revenue Target: <strong>₹{(preview.picture.kpis.totalRevenueTarget / 10000000).toFixed(1)} Cr</strong> | Attainment: <strong>₹{(preview.picture.kpis.totalDeliveredRevenue / 10000000).toFixed(1)} Cr ({preview.picture.kpis.revenueAttainmentPercent}%)</strong> | Wins: <strong>{preview.picture.kpis.totalDeliveredWins} / {preview.picture.kpis.totalWinsTarget} ({preview.picture.kpis.winsAttainmentPercent}%)</strong>
              </p>
            </div>

            <div className="p-4 bg-muted/20 border border-border/40 rounded-lg space-y-2">
              <div className="font-bold text-base text-foreground">Section 2: Cross-Vertical Performance & Margins</div>
              <ul className="list-disc pl-5 text-muted-foreground">
                {preview.comparisons.map((c: any) => (
                  <li key={c.vertical}>
                    {c.name}: Run-Rate ₹{(c.revenueRunRateInr / 10000000).toFixed(1)} Cr | Margin {c.grossMarginPercent}% | Headcount: {c.fteCount} FTEs
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-4 bg-muted/20 border border-border/40 rounded-lg space-y-2">
              <div className="font-bold text-base text-foreground">Section 3: Strategic Growth & Capital Commitments</div>
              <p className="text-muted-foreground">
                {preview.initiatives.length} Active Growth Initiatives under executive implementation.
              </p>
            </div>

            <div className="p-4 bg-muted/20 border border-border/40 rounded-lg space-y-2">
              <div className="font-bold text-base text-foreground">Section 4: Operating Risks & Board Escalations</div>
              <p className="text-muted-foreground">
                {preview.criticalRisks.length} Critical Operating & Regulatory risks monitored.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <SkeletonRows rows={4} />
      )}

      {/* Schedules */}
      <Card>
        <CardHeader>
          <CardTitle>Automated Board Distribution Schedules</CardTitle>
        </CardHeader>
        <CardContent>
          {!schedules || schedules.length === 0 ? (
            <EmptyState title="No schedules configured" message="Set up recurring delivery for the Board of Directors." />
          ) : (
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-border/60 text-xs font-semibold uppercase text-muted-foreground">
                  <th className="py-2 px-3">Title</th>
                  <th className="py-2 px-3">Cadence</th>
                  <th className="py-2 px-3">Frequency</th>
                  <th className="py-2 px-3">Stakeholders</th>
                  <th className="py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {schedules.map((sc) => (
                  <tr key={sc.id}>
                    <td className="py-2.5 px-3 font-semibold text-foreground">{sc.title}</td>
                    <td className="py-2.5 px-3">{sc.delivery_cadence}</td>
                    <td className="py-2.5 px-3 capitalize">{sc.frequency}</td>
                    <td className="py-2.5 px-3 text-xs text-muted-foreground">{Array.isArray(sc.stakeholders) ? sc.stakeholders.join(', ') : ''}</td>
                    <td className="py-2.5 px-3"><Badge tone="open">{sc.status.toUpperCase()}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Drawer: Add Schedule */}
      <Panel open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Configure Board Pack Schedule">
        <div className="space-y-4 p-4">
          <FormField label="Schedule Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </FormField>

          <FormField label="Frequency">
            <Select value={frequency} onChange={(e) => setFrequency(e.target.value as any)}>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annual">Annual</option>
            </Select>
          </FormField>

          <FormField label="Delivery Cadence Description">
            <Input value={cadence} onChange={(e) => setCadence(e.target.value)} />
          </FormField>

          <FormField label="Stakeholder Emails (comma-separated)">
            <Input value={stakeholders} onChange={(e) => setStakeholders(e.target.value)} />
          </FormField>

          <div className="pt-2 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <BusyButton busy={s.busy} onClick={handleCreateSchedule}>Save Schedule</BusyButton>
          </div>
        </div>
      </Panel>
    </div>
  );
}

// ─── CEO-11: Executive Commitments ───
export function CeoCommitmentsPage() {
  const [commitments, load] = useLoad<any[]>(() => ceoApi.listCommitments());
  const s = useSubmitAction();

  const handleFulfill = async (id: string) => {
    await s.run(async () => {
      await ceoApi.fulfillCommitment(id, {
        fulfillmentNotes: 'Mandate delivered and ratified by CEO.',
      });
      load();
    }, 'Commitment marked fulfilled.');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Executive Commitments & Follow-Through"
        subtitle="CEO-11 · Track and enforce follow-through on CEO directives, board resolutions, and leadership actions"
      />

      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}
      {s.error ? <p role="alert" className="text-sm text-destructive">{s.error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Active Commitments Register</CardTitle>
        </CardHeader>
        <CardContent>
          {!commitments || commitments.length === 0 ? (
            <EmptyState title="No active commitments" message="All executive commitments have been fulfilled." />
          ) : (
            <div className="space-y-4">
              {commitments.map((c) => (
                <div key={c.id} className="p-4 border border-border/40 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-foreground">{c.title}</span>
                      <span className="text-xs text-muted-foreground ml-2">Lead: {c.accountable_leader}</span>
                    </div>
                    <Badge tone={c.status === 'fulfilled' ? 'open' : 'pending'}>
                      {c.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{c.actionable_mandate}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                    <span>Due Date: <strong>{new Date(c.due_date).toLocaleDateString('en-IN')}</strong></span>
                    {c.status === 'in_progress' ? (
                      <Button variant="secondary" onClick={() => handleFulfill(c.id)}>Mark Fulfilled</Button>
                    ) : (
                      <span className="text-xs text-primary font-semibold">Fulfilled</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
