import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { nationalApi } from '../lib/national-api';
import { PageHeader, Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input, Textarea } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Panel, BusyButton } from '../components/ui/panel';
import { EmptyState, SkeletonRows, SuccessNote } from '../components/ui/states';
import type { NmPeriod } from '@finverse/contracts';

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

// ─── NM-01: National Overview ───
export function NationalOverviewPage() {
  const [period, setPeriod] = useState<NmPeriod>('month-to-date');
  const [data, load] = useLoad<any>(() => nationalApi.overview(period));
  const [actionDrawerOpen, setActionDrawerOpen] = useState(false);
  const [selectedRmId, setSelectedRmId] = useState('');
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [kind, setKind] = useState<'regional-directive' | 'rm-coaching' | 'resource-rebalancing' | 'policy-compliance'>('regional-directive');
  const s = useSubmitAction();

  const handleCreateDirective = async () => {
    if (!selectedRmId || !title.trim() || !dueAt) {
      s.setError('Please select a Regional Manager, enter a title, and select a due date.');
      return;
    }
    await s.run(async () => {
      await nationalApi.createAction({
        sourceAction: 'NM-01',
        kind,
        subjectRmEmployeeId: selectedRmId,
        ownerEmployeeId: 'EMP-009',
        title: title.trim(),
        detail: detail.trim() || undefined,
        dueAt: new Date(dueAt).toISOString(),
      });
      setActionDrawerOpen(false);
      setTitle('');
      setDetail('');
      setDueAt('');
      load();
    }, 'National directive issued to Regional Manager.');
  };

  const handleCompleteAction = async (actionId: string) => {
    await s.run(async () => {
      await nationalApi.completeAction(actionId);
      load();
    }, 'Directive marked completed.');
  };

  if (!data) return <SkeletonRows rows={6} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="National Overview"
        subtitle="Wealth Vertical · Performance Rollup, Regional Pace & Executive Directives"
        actions={
          <div className="flex items-center gap-3">
            <Select value={period} onChange={(e) => setPeriod(e.target.value as NmPeriod)} className="w-40 text-xs">
              <option value="today">Today</option>
              <option value="this-week">This Week</option>
              <option value="month-to-date">Month to Date</option>
              <option value="last-month">Last Month</option>
              <option value="quarter-to-date">Quarter to Date</option>
            </Select>
            <Button variant="default" onClick={() => setActionDrawerOpen(true)}>
              Issue Directive
            </Button>
          </div>
        }
      />

      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}
      {s.error ? <p role="alert" className="text-sm text-destructive">{s.error}</p> : null}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Vertical Attainment Pace</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {data.kpis.achievedWins} / {data.kpis.approvedCeoTarget}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge tone={data.kpis.attainmentPercent >= 80 ? 'open' : 'pending'}>
                {data.kpis.attainmentPercent}% CEO Target
              </Badge>
              <span className="text-xs text-muted-foreground">Wins achieved</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Unallocated Target</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700">
              {data.kpis.unallocatedRemainder} wins
            </div>
            <p className="text-xs text-muted-foreground mt-1">Pending regional division allocation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Active Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {data.kpis.activePipelineLeads} leads
            </div>
            <p className="text-xs text-muted-foreground mt-1">Across South & West divisions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Governance & Risks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {data.kpis.openEscalationsCount} escalations
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge tone={data.kpis.openActionsCount > 0 ? 'pending' : 'open'}>
                {data.kpis.openActionsCount} Open Directives
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Regional Attainment Division Table */}
      <Card>
        <CardHeader>
          <CardTitle>Regional Division Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-border/60 text-xs font-semibold uppercase text-muted-foreground">
                  <th className="py-2.5 px-3">Region</th>
                  <th className="py-2.5 px-3">Teams</th>
                  <th className="py-2.5 px-3">Target Wins</th>
                  <th className="py-2.5 px-3">Achieved Wins</th>
                  <th className="py-2.5 px-3">Attainment Pace</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Active Pipeline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {data.regionalPerformance.map((r: any) => (
                  <tr key={r.regionId} className="hover:bg-muted/30">
                    <td className="py-3 px-3 font-semibold text-foreground">{r.regionName}</td>
                    <td className="py-3 px-3">{r.teamCount} teams</td>
                    <td className="py-3 px-3 font-medium">{r.targetWins}</td>
                    <td className="py-3 px-3 font-bold text-primary">{r.achievedWins}</td>
                    <td className="py-3 px-3">{r.attainmentPercent}%</td>
                    <td className="py-3 px-3">
                      <Badge tone={r.status === 'on-track' ? 'open' : r.status === 'at-risk' ? 'pending' : 'overdue'}>
                        {r.status.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="py-3 px-3">{r.activePipelines} leads</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Recent Directives & Action Items */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Executive Directives & Interventions</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentDirectives.length === 0 ? (
            <EmptyState title="No active directives" message="All regional directives and interventions are up to date." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-xs font-semibold uppercase text-muted-foreground">
                    <th className="py-2 px-3">Kind</th>
                    <th className="py-2 px-3">Accountable RM</th>
                    <th className="py-2 px-3">Region</th>
                    <th className="py-2 px-3">Directive</th>
                    <th className="py-2 px-3">Due Date</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {data.recentDirectives.map((a: any) => (
                    <tr key={a.id} className="hover:bg-muted/30">
                      <td className="py-2.5 px-3">
                        <Badge tone="default">{a.kind.replace('-', ' ').toUpperCase()}</Badge>
                      </td>
                      <td className="py-2.5 px-3 font-medium">{a.subject_rm_name}</td>
                      <td className="py-2.5 px-3 text-muted-foreground">{a.region_name || 'All Regions'}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-foreground">{a.title}</div>
                        {a.detail ? <div className="text-xs text-muted-foreground">{a.detail}</div> : null}
                      </td>
                      <td className="py-2.5 px-3 text-xs">{new Date(a.due_at).toLocaleDateString('en-IN')}</td>
                      <td className="py-2.5 px-3">
                        <Badge tone={a.status === 'done' ? 'open' : 'pending'}>{a.status.toUpperCase()}</Badge>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {a.status === 'open' ? (
                          <Button variant="secondary" onClick={() => handleCompleteAction(a.id)}>
                            Mark Complete
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Completed</span>
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

      {/* Drawer: Issue Directive */}
      <Panel open={actionDrawerOpen} onClose={() => setActionDrawerOpen(false)} title="Issue Regional Directive">
        <div className="space-y-4 p-4">
          <FormField label="Directive Type">
            <Select value={kind} onChange={(e) => setKind(e.target.value as any)}>
              <option value="regional-directive">Regional Directive</option>
              <option value="rm-coaching">RM Coaching & Alignment</option>
              <option value="resource-rebalancing">Resource & Queue Rebalancing</option>
              <option value="policy-compliance">Policy & Governance Compliance</option>
            </Select>
          </FormField>

          <FormField label="Accountable Regional Manager">
            <Select value={selectedRmId} onChange={(e) => setSelectedRmId(e.target.value)}>
              <option value="">Select Regional Manager...</option>
              {data.scope.regionalManagers.map((rm: any) => (
                <option key={rm.id} value={rm.id}>
                  {rm.display_name} ({rm.assigned_region_name})
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Directive Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. South Region SLA recovery on Tier-1 PMS" />
          </FormField>

          <FormField label="Actionable Instructions & Context">
            <Textarea value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="State mandatory milestones, expected target recovery pace, and escalation thresholds." rows={4} />
          </FormField>

          <FormField label="Commitment Due Date">
            <Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </FormField>

          <div className="pt-2 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setActionDrawerOpen(false)}>Cancel</Button>
            <BusyButton busy={s.busy} onClick={handleCreateDirective}>Issue Directive</BusyButton>
          </div>
        </div>
      </Panel>
    </div>
  );
}

// ─── NM-02: Regional Scorecards Comparison ───
export function NationalRegionsPage() {
  const [data] = useLoad<any>(() => nationalApi.getComparisons('September'));

  if (!data) return <SkeletonRows rows={6} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Regional Comparisons & Division Scorecards"
        subtitle="NM-02 · Side-by-side performance benchmarks, conversion efficiency and RM accountability"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {data.regions.map((reg: any) => (
          <Card key={reg.regionId}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-lg">{reg.regionName}</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Regional Manager: <strong className="text-foreground">{reg.regionalManager?.name || 'Unassigned'}</strong> ({reg.regionalManager?.email || 'N/A'})
                </p>
              </div>
              <Badge tone={reg.status === 'active' ? 'open' : 'pending'}>{reg.status.toUpperCase()}</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 bg-muted/20 rounded-md">
                  <div className="text-xs text-muted-foreground">Target Wins</div>
                  <div className="text-xl font-bold text-foreground">{reg.targetWins} wins</div>
                </div>
                <div className="p-3 bg-muted/20 rounded-md">
                  <div className="text-xs text-muted-foreground">Achieved Wins</div>
                  <div className="text-xl font-bold text-primary">{reg.achievedWins} wins</div>
                </div>
                <div className="p-3 bg-muted/20 rounded-md">
                  <div className="text-xs text-muted-foreground">Pipeline AUM</div>
                  <div className="text-xl font-bold text-foreground">₹{(reg.pipelineValueInr / 10000000).toFixed(1)} Cr</div>
                </div>
                <div className="p-3 bg-muted/20 rounded-md">
                  <div className="text-xs text-muted-foreground">Lead Conversion</div>
                  <div className="text-xl font-bold text-foreground">{reg.conversionRate}%</div>
                </div>
              </div>

              <div className="border-t border-border/40 pt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>Headcount: <strong>{reg.callerCount} Callers</strong>, <strong>{reg.tlCount} TLs</strong></span>
                <span>Speed to Lead: <strong>{reg.speedToLeadMinutes} mins</strong></span>
                <span>Open Escalations: <strong>{reg.openEscalations}</strong></span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── NM-03: National Target Allocation ───
export function NationalPlanPage() {
  const [data, load] = useLoad<any>(() => nationalApi.getTarget('October'));
  const [ceoTarget, setCeoTarget] = useState<number>(500);
  const [allocations, setAllocations] = useState<Array<{ regionId: string; regionName: string; rmEmployeeId: string; targetWins: number }>>([
    { regionId: 'REGION-SOUTH', regionName: 'South Region', rmEmployeeId: 'EMP-008', targetWins: 250 },
    { regionId: 'REGION-WEST', regionName: 'West Region', rmEmployeeId: 'EMP-008', targetWins: 150 },
  ]);
  const s = useSubmitAction();

  useEffect(() => {
    if (data?.approvedCeoTarget) {
      setCeoTarget(data.approvedCeoTarget);
    }
    if (Array.isArray(data?.regionalAllocations) && data.regionalAllocations.length > 0) {
      setAllocations(data.regionalAllocations);
    }
  }, [data]);

  const allocatedSum = allocations.reduce((acc, curr) => acc + (Number(curr.targetWins) || 0), 0);
  const remainder = ceoTarget - allocatedSum;
  const isOverAllocated = remainder < 0;

  const handleUpdateAllocation = (idx: number, wins: number) => {
    const next = [...allocations];
    next[idx].targetWins = wins;
    setAllocations(next);
  };

  const handleSavePlan = async (publish: boolean) => {
    if (isOverAllocated) {
      s.setError('Allocated targets exceed the approved CEO target. Over-allocation is prohibited.');
      return;
    }
    await s.run(async () => {
      await nationalApi.allocateTarget({
        periodLabel: 'October',
        approvedCeoTarget: ceoTarget,
        regionalAllocations: allocations,
        publish,
      });
      load();
    }, publish ? 'National plan published and distributed to Regional Managers.' : 'National draft plan saved.');
  };

  if (!data) return <SkeletonRows rows={6} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="National Vertical Target Allocation"
        subtitle="NM-03 · Reconcile approved CEO target against regional divisions with transparent remainder tracking"
        actions={
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => handleSavePlan(false)} disabled={isOverAllocated || s.busy}>
              Save Draft
            </Button>
            <Button variant="default" onClick={() => handleSavePlan(true)} disabled={isOverAllocated || s.busy}>
              Publish & Distribute to RMs
            </Button>
          </div>
        }
      />

      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}
      {s.error ? <p role="alert" className="text-sm text-destructive">{s.error}</p> : null}

      {/* Target Balance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Approved CEO Vertical Target</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              type="number"
              value={ceoTarget}
              onChange={(e) => setCeoTarget(Math.max(1, Number(e.target.value)))}
              className="text-2xl font-bold h-12"
            />
            <p className="text-xs text-muted-foreground mt-1">Authoritative annual business plan</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Total Regional Allocations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground h-12 flex items-center">
              {allocatedSum} wins
            </div>
            <p className="text-xs text-muted-foreground mt-1">Sum of divisions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Unallocated Remainder</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold h-12 flex items-center ${isOverAllocated ? 'text-destructive' : 'text-amber-700'}`}>
              {remainder} wins
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {isOverAllocated ? '⚠️ Over-allocated! Reduce regional targets.' : 'Reserved for future capacity/expansion'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Allocations Table */}
      <Card>
        <CardHeader>
          <CardTitle>Regional Division Allocations</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-border/60 text-xs font-semibold uppercase text-muted-foreground">
                <th className="py-2.5 px-3">Division</th>
                <th className="py-2.5 px-3">Accountable RM</th>
                <th className="py-2.5 px-3">Target Wins Allocation</th>
                <th className="py-2.5 px-3">% of CEO Plan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {allocations.map((alloc, idx) => (
                <tr key={alloc.regionId}>
                  <td className="py-3 px-3 font-semibold text-foreground">{alloc.regionName}</td>
                  <td className="py-3 px-3">Kavita Rao (EMP-008)</td>
                  <td className="py-3 px-3">
                    <Input
                      type="number"
                      value={alloc.targetWins}
                      onChange={(e) => handleUpdateAllocation(idx, Math.max(0, Number(e.target.value)))}
                      className="w-32"
                    />
                  </td>
                  <td className="py-3 px-3 font-medium text-muted-foreground">
                    {ceoTarget > 0 ? Math.round((alloc.targetWins / ceoTarget) * 100) : 0}%
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

// ─── NM-04: National Economics & Unit Capacity ───
export function NationalEconomicsPage() {
  const [data] = useLoad<any>(() => nationalApi.getEconomics('month-to-date'));

  if (!data) return <SkeletonRows rows={6} />;

  const { economics } = data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="National Economics & Unit Capacity"
        subtitle="NM-04 · Territory unit economics, AUM velocity, blended CAC and caller productivity benchmarks"
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">AUM Run-Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">₹{(economics.aumRunRateInr / 10000000).toFixed(1)} Cr</div>
            <p className="text-xs text-muted-foreground mt-1">₹{(economics.monthlyAumVelocityInr / 10000000).toFixed(1)} Cr / month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Average Ticket Size</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">₹{(economics.averageTicketSizeInr / 100000).toFixed(1)} Lakhs</div>
            <p className="text-xs text-muted-foreground mt-1">Per approved conversion</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Blended CAC</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">₹{economics.estimatedBlendedCacInr.toLocaleString('en-IN')}</div>
            <p className="text-xs text-muted-foreground mt-1">Per acquired client</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">FTE Capacity Gap</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700">+{economics.unitCapacityGapFte} Callers</div>
            <p className="text-xs text-muted-foreground mt-1">Required to reach 500 wins plan</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Channel Economics */}
        <Card>
          <CardHeader>
            <CardTitle>Acquisition Channel Efficiency</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-border/60 text-xs font-semibold uppercase text-muted-foreground">
                  <th className="py-2 px-3">Channel</th>
                  <th className="py-2 px-3">Volume Share</th>
                  <th className="py-2 px-3">Est. CAC</th>
                  <th className="py-2 px-3">Conv. Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {economics.channelEconomics.map((ch: any) => (
                  <tr key={ch.channel}>
                    <td className="py-2.5 px-3 font-medium">{ch.channel}</td>
                    <td className="py-2.5 px-3">{ch.share}%</td>
                    <td className="py-2.5 px-3">₹{ch.cacInr.toLocaleString('en-IN')}</td>
                    <td className="py-2.5 px-3 font-semibold text-primary">{ch.conversionRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Product Unit Economics */}
        <Card>
          <CardHeader>
            <CardTitle>Product Margin & Fee Structure</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-border/60 text-xs font-semibold uppercase text-muted-foreground">
                  <th className="py-2 px-3">Product</th>
                  <th className="py-2 px-3">Min. Ticket</th>
                  <th className="py-2 px-3">Advisory Fee</th>
                  <th className="py-2 px-3">Gross Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {economics.productEconomics.map((pr: any) => (
                  <tr key={pr.product}>
                    <td className="py-2.5 px-3 font-semibold text-foreground">{pr.product}</td>
                    <td className="py-2.5 px-3">₹{(pr.minTicketInr / 100000).toFixed(0)} L</td>
                    <td className="py-2.5 px-3">{pr.feeBps} bps</td>
                    <td className="py-2.5 px-3 font-bold text-primary">{pr.marginPercent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── NM-05: Product & Pipeline Rule Proposals ───
export function NationalProductRulesPage() {
  const [data, load] = useLoad<any[]>(() => nationalApi.listProductRules());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [currentVersion, setCurrentVersion] = useState('2.1');
  const [proposedVersion, setProposedVersion] = useState('3.0');
  const [reason, setReason] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [affectedProducts, setAffectedProducts] = useState<string[]>(['V1 Wealth Portfolio']);
  const [previewImpact, setPreviewImpact] = useState('');
  const s = useSubmitAction();

  const handleProposeRule = async () => {
    if (!ruleName.trim() || !reason.trim() || !effectiveDate || !previewImpact.trim()) {
      s.setError('Please complete all proposal fields.');
      return;
    }
    await s.run(async () => {
      await nationalApi.createProductRule({
        ruleName: ruleName.trim(),
        currentVersion: currentVersion.trim(),
        proposedVersion: proposedVersion.trim(),
        reason: reason.trim(),
        effectiveDate,
        affectedProducts,
        previewImpact: previewImpact.trim(),
      });
      setDrawerOpen(false);
      setRuleName('');
      setReason('');
      setPreviewImpact('');
      load();
    }, 'Product & pipeline rule proposal submitted to Product Committee.');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product & Pipeline Rule Proposals"
        subtitle="NM-05 · Formal proposals to Product & Governance for pipeline milestone SLAs, gating and distribution rules"
        actions={
          <Button variant="default" onClick={() => setDrawerOpen(true)}>
            Propose Rule Modification
          </Button>
        }
      />

      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}
      {s.error ? <p role="alert" className="text-sm text-destructive">{s.error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Active Rule Proposals</CardTitle>
        </CardHeader>
        <CardContent>
          {!data || data.length === 0 ? (
            <EmptyState title="No active proposals" message="No product or pipeline modifications currently pending review." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-xs font-semibold uppercase text-muted-foreground">
                    <th className="py-2.5 px-3">Rule Name</th>
                    <th className="py-2.5 px-3">Versions</th>
                    <th className="py-2.5 px-3">Reason</th>
                    <th className="py-2.5 px-3">Effective Date</th>
                    <th className="py-2.5 px-3">Pipeline Impact</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {data.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/30">
                      <td className="py-3 px-3 font-semibold text-foreground">{p.rule_name}</td>
                      <td className="py-3 px-3 text-xs text-muted-foreground">
                        v{p.current_version} → <strong className="text-foreground">v{p.proposed_version}</strong>
                      </td>
                      <td className="py-3 px-3">{p.reason}</td>
                      <td className="py-3 px-3 text-xs">{new Date(p.effective_date).toLocaleDateString('en-IN')}</td>
                      <td className="py-3 px-3 text-xs text-muted-foreground">{p.preview_impact}</td>
                      <td className="py-3 px-3">
                        <Badge tone={p.status === 'activated' ? 'open' : 'pending'}>
                          {p.status.toUpperCase()}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drawer: Propose Rule */}
      <Panel open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Propose Pipeline Rule Modification">
        <div className="space-y-4 p-4">
          <FormField label="Rule Name">
            <Input value={ruleName} onChange={(e) => setRuleName(e.target.value)} placeholder="e.g. Mandatory Risk Profile Completion SLA" />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Current Version">
              <Input value={currentVersion} onChange={(e) => setCurrentVersion(e.target.value)} />
            </FormField>
            <FormField label="Proposed Version">
              <Input value={proposedVersion} onChange={(e) => setProposedVersion(e.target.value)} />
            </FormField>
          </div>

          <FormField label="Business Justification & Context">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this pipeline SLA or qualification rule change necessary?" rows={3} />
          </FormField>

          <FormField label="Effective Date">
            <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
          </FormField>

          <FormField label="Projected Pipeline Impact">
            <Textarea value={previewImpact} onChange={(e) => setPreviewImpact(e.target.value)} placeholder="Estimate affected stages, lead volumes, and SLA turnaround delta." rows={3} />
          </FormField>

          <div className="pt-2 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <BusyButton busy={s.busy} onClick={handleProposeRule}>Submit Proposal</BusyButton>
          </div>
        </div>
      </Panel>
    </div>
  );
}

// ─── NM-06: Consolidated National Forecast ───
export function NationalForecastPage() {
  const [data, load] = useLoad<any>(() => nationalApi.getForecastRollup('October'));
  const [adjustment, setAdjustment] = useState<number>(-2500000);
  const [assumptions, setAssumptions] = useState('');
  const s = useSubmitAction();

  useEffect(() => {
    if (data?.nationalAdjustment !== undefined) {
      setAdjustment(data.nationalAdjustment);
    }
    if (data?.nationalAssumptions) {
      setAssumptions(data.nationalAssumptions);
    }
  }, [data]);

  const handleSubmitForecast = async (submitToExecs: boolean) => {
    if (!assumptions.trim()) {
      s.setError('Please state executive assumptions.');
      return;
    }
    await s.run(async () => {
      await nationalApi.submitForecast({
        periodLabel: 'October',
        bottomUpRevenue: data.bottomUpSum,
        nationalAdjustment: adjustment,
        currency: 'INR',
        acceptedRegionalForecastIds: data.regionalForecasts.map((r: any) => r.id),
        topNationalRisks: data.topNationalRisks,
        nationalAssumptions: assumptions.trim(),
        submitToExecutives: submitToExecs,
      });
      load();
    }, submitToExecs ? 'Consolidated forecast submitted to CEO & CFO.' : 'National forecast draft saved.');
  };

  if (!data) return <SkeletonRows rows={6} />;

  const netForecast = data.bottomUpSum + adjustment;

  return (
    <div className="space-y-6">
      <PageHeader
        title="National Forecast Consolidation"
        subtitle="NM-06 · Consolidate regional bottom-up forecasts, apply executive macro adjustments, and submit to CEO/CFO"
        actions={
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => handleSubmitForecast(false)} disabled={s.busy}>
              Save Forecast Draft
            </Button>
            <Button variant="default" onClick={() => handleSubmitForecast(true)} disabled={s.busy}>
              Submit to CEO & CFO
            </Button>
          </div>
        }
      />

      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}
      {s.error ? <p role="alert" className="text-sm text-destructive">{s.error}</p> : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Regional Bottom-Up Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              ₹{(data.bottomUpSum / 10000000).toFixed(2)} Cr
            </div>
            <p className="text-xs text-muted-foreground mt-1">Rollup of all regional submissions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">National Executive Adjustment</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              type="number"
              value={adjustment}
              onChange={(e) => setAdjustment(Number(e.target.value))}
              className="text-2xl font-bold h-12"
            />
            <p className="text-xs text-muted-foreground mt-1">Macro liquidity / market adjustment</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Net Consolidated Forecast</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary h-12 flex items-center">
              ₹{(netForecast / 10000000).toFixed(2)} Cr
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge tone={data.status === 'submitted_to_executives' ? 'open' : 'pending'}>
                {data.status.toUpperCase()}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Assumptions & Top Risks */}
      <Card>
        <CardHeader>
          <CardTitle>Executive Assumptions & National Governance Risks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField label="Consolidated Assumptions for CEO / CFO">
            <Textarea
              value={assumptions}
              onChange={(e) => setAssumptions(e.target.value)}
              placeholder="State key macro drivers, regulatory turnaround factors, and fee policy sensitivities."
              rows={3}
            />
          </FormField>

          <div>
            <div className="text-xs font-medium text-foreground mb-2">Top National Headwinds & Risks</div>
            <ul className="list-disc pl-5 text-sm space-y-1 text-muted-foreground">
              {data.topNationalRisks.map((risk: string, i: number) => (
                <li key={i}>{risk}</li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── NM-07: Cross-Region Work Rebalancing ───
export function NationalTransfersPage() {
  const [transfers, load] = useLoad<any[]>(() => nationalApi.listTransfers());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sourceRegionId, setSourceRegionId] = useState('REGION-SOUTH');
  const [destinationRegionId, setDestinationRegionId] = useState('REGION-WEST');
  const [leadIdsText, setLeadIdsText] = useState('FV-1002, FV-1005');
  const [reason, setReason] = useState('');
  const [handoffPlan, setHandoffPlan] = useState('');
  const s = useSubmitAction();

  const handleCreateTransfer = async () => {
    const leadIds = leadIdsText.split(',').map((s) => s.trim()).filter(Boolean);
    if (!reason.trim() || !handoffPlan.trim() || leadIds.length === 0) {
      s.setError('Please complete all transfer details.');
      return;
    }
    await s.run(async () => {
      await nationalApi.createTransfer({
        sourceRegionId,
        destinationRegionId,
        leadIds,
        reason: reason.trim(),
        handoffPlan: handoffPlan.trim(),
      });
      setDrawerOpen(false);
      setReason('');
      setHandoffPlan('');
      load();
    }, 'Cross-region work transfer request registered.');
  };

  const handleDecide = async (transferId: string, decision: 'approved' | 'rejected') => {
    await s.run(async () => {
      await nationalApi.decideTransfer(transferId, {
        decision,
        resolutionNotes: `${decision.toUpperCase()} by National Manager.`,
      });
      load();
    }, `Transfer request ${decision}.`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cross-Region Work Rebalancing"
        subtitle="NM-07 · Rebalance prospect tranches between regional divisions to resolve localized capacity deficits"
        actions={
          <Button variant="default" onClick={() => setDrawerOpen(true)}>
            Initiate Cross-Region Transfer
          </Button>
        }
      />

      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}
      {s.error ? <p role="alert" className="text-sm text-destructive">{s.error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Transfer History & Queue</CardTitle>
        </CardHeader>
        <CardContent>
          {!transfers || transfers.length === 0 ? (
            <EmptyState title="No active transfers" message="No pending cross-region transfers." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-xs font-semibold uppercase text-muted-foreground">
                    <th className="py-2 px-3">Source Region</th>
                    <th className="py-2 px-3">Destination Region</th>
                    <th className="py-2 px-3">Prospects</th>
                    <th className="py-2 px-3">Reason</th>
                    <th className="py-2 px-3">Handoff SLA</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {transfers.map((t) => (
                    <tr key={t.id} className="hover:bg-muted/30">
                      <td className="py-2.5 px-3 font-medium">{t.source_region_name}</td>
                      <td className="py-2.5 px-3 font-semibold text-primary">{t.dest_region_name}</td>
                      <td className="py-2.5 px-3 text-xs">{Array.isArray(t.lead_ids) ? t.lead_ids.length : 0} leads</td>
                      <td className="py-2.5 px-3">{t.reason}</td>
                      <td className="py-2.5 px-3 text-xs text-muted-foreground">{t.handoff_plan}</td>
                      <td className="py-2.5 px-3">
                        <Badge tone={t.status === 'approved' ? 'open' : t.status === 'pending' ? 'pending' : 'overdue'}>
                          {t.status.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {t.status === 'pending' ? (
                          <div className="flex justify-end gap-1">
                            <Button variant="default" onClick={() => handleDecide(t.id, 'approved')}>Approve</Button>
                            <Button variant="secondary" onClick={() => handleDecide(t.id, 'rejected')}>Reject</Button>
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

      {/* Drawer: Create Transfer */}
      <Panel open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Initiate Cross-Region Work Transfer">
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Source Region">
              <Select value={sourceRegionId} onChange={(e) => setSourceRegionId(e.target.value)}>
                <option value="REGION-SOUTH">South Region</option>
                <option value="REGION-WEST">West Region</option>
              </Select>
            </FormField>
            <FormField label="Destination Region">
              <Select value={destinationRegionId} onChange={(e) => setDestinationRegionId(e.target.value)}>
                <option value="REGION-WEST">West Region</option>
                <option value="REGION-SOUTH">South Region</option>
              </Select>
            </FormField>
          </div>

          <FormField label="Lead IDs (comma-separated)">
            <Input value={leadIdsText} onChange={(e) => setLeadIdsText(e.target.value)} placeholder="e.g. FV-1002, FV-1005" />
          </FormField>

          <FormField label="Rebalancing Rationale">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="State capacity deficit, language requirement or load factor." rows={3} />
          </FormField>

          <FormField label="Handoff Plan & SLAs">
            <Textarea value={handoffPlan} onChange={(e) => setHandoffPlan(e.target.value)} placeholder="Mandate 24h intake SLA and receiving TL allocation review." rows={3} />
          </FormField>

          <div className="pt-2 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <BusyButton busy={s.busy} onClick={handleCreateTransfer}>Submit Transfer</BusyButton>
          </div>
        </div>
      </Panel>
    </div>
  );
}

// ─── NM-08: Cross-Vertical Inbound Referrals ───
export function NationalReferralsPage() {
  const [referrals, load] = useLoad<any[]>(() => nationalApi.listReferrals());
  const s = useSubmitAction();

  const handleDecision = async (referralId: string, decision: 'accepted' | 'declined') => {
    await s.run(async () => {
      await nationalApi.decideReferral(referralId, {
        decision,
        targetTeamId: 'TEAM-WEALTH-ALPHA',
        targetOwnerEmployeeId: 'EMP-001',
      });
      load();
    }, `Referral ${decision === 'accepted' ? 'accepted and added to Wealth intake queue' : 'declined'}.`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cross-Vertical Inbound Referrals"
        subtitle="NM-08 · Review and accept high-value prospect referrals from Banking and Real Estate into Wealth"
      />

      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}
      {s.error ? <p role="alert" className="text-sm text-destructive">{s.error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Inbound Referrals Queue</CardTitle>
        </CardHeader>
        <CardContent>
          {!referrals || referrals.length === 0 ? (
            <EmptyState title="No inbound referrals" message="No pending cross-vertical prospect handoffs." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-xs font-semibold uppercase text-muted-foreground">
                    <th className="py-2 px-3">Referral Code</th>
                    <th className="py-2 px-3">Source Vertical</th>
                    <th className="py-2 px-3">Prospect</th>
                    <th className="py-2 px-3">Consent Evidence</th>
                    <th className="py-2 px-3">Commercial Context</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-right">Intake Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {referrals.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/30">
                      <td className="py-3 px-3 font-mono font-bold text-foreground">{r.referral_code}</td>
                      <td className="py-3 px-3 font-semibold text-primary uppercase">{r.source_vertical}</td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-foreground">{r.prospect_name}</div>
                        <div className="text-xs text-muted-foreground">{r.prospect_contact}</div>
                      </td>
                      <td className="py-3 px-3 text-xs">{r.customer_consent_evidence}</td>
                      <td className="py-3 px-3 text-xs text-muted-foreground">{r.commercial_context}</td>
                      <td className="py-3 px-3">
                        <Badge tone={r.decision === 'accepted' ? 'open' : r.decision === 'declined' ? 'overdue' : 'pending'}>
                          {r.decision.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-right">
                        {r.decision === 'pending' ? (
                          <div className="flex justify-end gap-1">
                            <Button variant="default" onClick={() => handleDecision(r.id, 'accepted')}>Accept to Wealth</Button>
                            <Button variant="secondary" onClick={() => handleDecision(r.id, 'declined')}>Decline</Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {r.converted_lead_name ? `Intake: ${r.receiving_lead_id}` : 'Processed'}
                          </span>
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
    </div>
  );
}

// ─── NM-09: National Strategic Escalations (Dual Executive Routing) ───
export function NationalEscalationsPage() {
  const [escalations, load] = useLoad<any[]>(() => nationalApi.listEscalations());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [category, setCategory] = useState<'revenue_assumption' | 'strategic_exception' | 'pricing_policy' | 'governance_risk'>('pricing_policy');
  const [targetExecutive, setTargetExecutive] = useState<'CEO' | 'CFO' | 'BOTH'>('CFO');
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [deadline, setDeadline] = useState('');
  const s = useSubmitAction();

  const handleCreateEscalation = async () => {
    if (!title.trim() || !detail.trim() || !deadline) {
      s.setError('Please provide title, detail, and executive deadline.');
      return;
    }
    await s.run(async () => {
      await nationalApi.createEscalation({
        category,
        targetExecutive,
        title: title.trim(),
        detail: detail.trim(),
        decisionDeadline: new Date(deadline).toISOString(),
      });
      setDrawerOpen(false);
      setTitle('');
      setDetail('');
      setDeadline('');
      load();
    }, 'Strategic escalation routed to executive office.');
  };

  const handleResolve = async (escalationId: string) => {
    await s.run(async () => {
      await nationalApi.resolveEscalation(escalationId, {
        executiveDecision: 'Executive determination recorded and approved for implementation.',
      });
      load();
    }, 'Escalation resolved.');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="National Strategic Escalations"
        subtitle="NM-09 · Dual executive routing for strategic exceptions (CEO) and pricing / advisory fee schedules (CFO)"
        actions={
          <Button variant="default" onClick={() => setDrawerOpen(true)}>
            Raise Executive Escalation
          </Button>
        }
      />

      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}
      {s.error ? <p role="alert" className="text-sm text-destructive">{s.error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Executive Escalation Register</CardTitle>
        </CardHeader>
        <CardContent>
          {!escalations || escalations.length === 0 ? (
            <EmptyState title="No open escalations" message="All national escalations are resolved." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-xs font-semibold uppercase text-muted-foreground">
                    <th className="py-2 px-3">Target Executive</th>
                    <th className="py-2 px-3">Category</th>
                    <th className="py-2 px-3">Escalation Issue</th>
                    <th className="py-2 px-3">Deadline</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {escalations.map((e) => (
                    <tr key={e.id} className="hover:bg-muted/30">
                      <td className="py-3 px-3">
                        <Badge tone={e.target_executive === 'CEO' ? 'open' : e.target_executive === 'CFO' ? 'pending' : 'default'}>
                          {e.target_executive}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 font-medium">{e.category.replace('_', ' ')}</td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-foreground">{e.title}</div>
                        <div className="text-xs text-muted-foreground">{e.detail}</div>
                      </td>
                      <td className="py-3 px-3 text-xs">{new Date(e.decision_deadline).toLocaleDateString('en-IN')}</td>
                      <td className="py-3 px-3">
                        <Badge tone={e.status === 'resolved' ? 'open' : 'pending'}>{e.status.toUpperCase()}</Badge>
                      </td>
                      <td className="py-3 px-3 text-right">
                        {e.status !== 'resolved' ? (
                          <Button variant="secondary" onClick={() => handleResolve(e.id)}>Record Resolution</Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Resolved</span>
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

      {/* Drawer: Create Escalation */}
      <Panel open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Route Strategic Escalation">
        <div className="space-y-4 p-4">
          <FormField label="Target Executive Office">
            <Select value={targetExecutive} onChange={(e) => setTargetExecutive(e.target.value as any)}>
              <option value="CEO">CEO (Strategic / Market Exceptions)</option>
              <option value="CFO">CFO (Pricing / Fee Schedules / Governance)</option>
              <option value="BOTH">Dual Routing (CEO & CFO)</option>
            </Select>
          </FormField>

          <FormField label="Escalation Category">
            <Select value={category} onChange={(e) => setCategory(e.target.value as any)}>
              <option value="pricing_policy">Pricing Policy & Advisory Tiering</option>
              <option value="revenue_assumption">Revenue Assumption Variance</option>
              <option value="strategic_exception">Strategic Client Exception</option>
              <option value="governance_risk">Regulatory & Governance Risk</option>
            </Select>
          </FormField>

          <FormField label="Escalation Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 30 bps Advisory Tier for >10 Cr PMS Clients" />
          </FormField>

          <FormField label="Detailed Case & Business Impact">
            <Textarea value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Detail competitive risk, projected volume unlock, and financial trade-offs." rows={4} />
          </FormField>

          <FormField label="Required Executive Decision Deadline">
            <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </FormField>

          <div className="pt-2 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <BusyButton busy={s.busy} onClick={handleCreateEscalation}>Route Escalation</BusyButton>
          </div>
        </div>
      </Panel>
    </div>
  );
}

// ─── NM-10: Regional Manager Reviews ───
export function NationalReviewsPage() {
  const [reviews, load] = useLoad<any[]>(() => nationalApi.listReviews());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [rmEmployeeId] = useState('EMP-008');
  const [rating, setRating] = useState<'exceeding' | 'achieving' | 'needs_improvement' | 'critical'>('achieving');
  const [strengths, setStrengths] = useState('');
  const [blockers, setBlockers] = useState('');
  const [nextReviewDate, setNextReviewDate] = useState('');
  const s = useSubmitAction();

  const handleSaveReview = async () => {
    if (!strengths.trim() || !blockers.trim() || !nextReviewDate) {
      s.setError('Please document strengths, blockers, and next review date.');
      return;
    }
    await s.run(async () => {
      await nationalApi.saveReview({
        rmEmployeeId,
        periodLabel: 'September 2026',
        performanceRating: rating,
        strengths: strengths.trim(),
        blockers: blockers.trim(),
        growthCommitments: ['Activate West Region capacity', 'Achieve 85% PMS turnaround SLA'],
        coverageCommitments: ['Full South coverage'],
        nextReviewDate,
      });
      setDrawerOpen(false);
      setStrengths('');
      setBlockers('');
      load();
    }, 'Regional Manager review recorded.');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Regional Manager Performance Reviews"
        subtitle="NM-10 · Structured periodic reviews of Regional Managers, coverage commitments and development plans"
        actions={
          <Button variant="default" onClick={() => setDrawerOpen(true)}>
            Conduct RM Review
          </Button>
        }
      />

      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}
      {s.error ? <p role="alert" className="text-sm text-destructive">{s.error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Completed RM Reviews</CardTitle>
        </CardHeader>
        <CardContent>
          {!reviews || reviews.length === 0 ? (
            <EmptyState title="No reviews on file" message="No RM performance reviews recorded yet." />
          ) : (
            <div className="space-y-4">
              {reviews.map((r) => (
                <div key={r.id} className="p-4 border border-border/40 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-foreground">{r.rm_name}</span>
                      <span className="text-xs text-muted-foreground ml-2">Period: {r.period_label}</span>
                    </div>
                    <Badge tone={r.performance_rating === 'achieving' || r.performance_rating === 'exceeding' ? 'open' : 'pending'}>
                      {r.performance_rating.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="text-sm">
                    <strong>Strengths:</strong> {r.strengths}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <strong>Focus Areas:</strong> {r.blockers}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Next Evaluation: {new Date(r.next_review_date).toLocaleDateString('en-IN')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drawer: Conduct Review */}
      <Panel open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Conduct Regional Manager Review">
        <div className="space-y-4 p-4">
          <FormField label="Regional Manager">
            <Input value="Kavita Rao (EMP-008 — South & West Divisions)" readOnly />
          </FormField>

          <FormField label="Performance Rating">
            <Select value={rating} onChange={(e) => setRating(e.target.value as any)}>
              <option value="exceeding">Exceeding Plan</option>
              <option value="achieving">Achieving Expectations</option>
              <option value="needs_improvement">Needs Improvement</option>
              <option value="critical">Critical Attention</option>
            </Select>
          </FormField>

          <FormField label="Observed Strengths">
            <Textarea value={strengths} onChange={(e) => setStrengths(e.target.value)} placeholder="Document operational rigor, team leadership, and quota pace." rows={3} />
          </FormField>

          <FormField label="Blockers & Gaps to Bridge">
            <Textarea value={blockers} onChange={(e) => setBlockers(e.target.value)} placeholder="Address capacity deficits, escalation response times, or SLA adherence." rows={3} />
          </FormField>

          <FormField label="Next Formal Review Date">
            <Input type="date" value={nextReviewDate} onChange={(e) => setNextReviewDate(e.target.value)} />
          </FormField>

          <div className="pt-2 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <BusyButton busy={s.busy} onClick={handleSaveReview}>Save Review</BusyButton>
          </div>
        </div>
      </Panel>
    </div>
  );
}

// ─── NM-11: National Executive Reports & Schedules ───
export function NationalReportsPage() {
  const [preview] = useLoad<any>(() => nationalApi.previewReportPack('October 2026'));
  const [schedules, loadSchedules] = useLoad<any[]>(() => nationalApi.listReportSchedules());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scheduleName, setScheduleName] = useState('Monthly CEO/CFO Strategic Pack');
  const [periodType, setPeriodType] = useState<'monthly' | 'quarterly' | 'half-yearly' | 'annual'>('monthly');
  const [cadence, setCadence] = useState('1st business day of month, 08:00 IST');
  const [recipientsText, setRecipientsText] = useState('ceo@finverse.demo, cfo@finverse.demo');
  const s = useSubmitAction();

  const handleExportPdf = async () => {
    await s.run(async () => {
      const res = await nationalApi.exportReportPdf({
        periodLabel: 'October 2026',
        sections: ['attainment', 'regional-scorecards', 'economics', 'governance-risks'],
      });
      window.open(res.downloadUrl, '_blank');
    }, 'Executive PDF Pack generated.');
  };

  const handleCreateSchedule = async () => {
    const recipients = recipientsText.split(',').map((r) => r.trim()).filter(Boolean);
    if (!scheduleName.trim() || recipients.length === 0) {
      s.setError('Please complete schedule name and recipient emails.');
      return;
    }
    await s.run(async () => {
      await nationalApi.saveReportSchedule({
        name: scheduleName.trim(),
        periodType,
        cadence: cadence.trim(),
        recipients,
        sections: ['attainment', 'regional-scorecards', 'economics', 'governance-risks'],
        status: 'active',
      });
      setDrawerOpen(false);
      loadSchedules();
    }, 'Executive report schedule registered.');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="National Executive Reports & Governance Packs"
        subtitle="NM-11 · High-fidelity executive reporting packs with binary PDF exports and automated distribution schedules"
        actions={
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
              Schedule Automated Delivery
            </Button>
            <Button variant="default" onClick={handleExportPdf} disabled={s.busy}>
              Export Executive PDF Pack
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
            <CardTitle>Executive Pack Preview (Finverse Palette #113F3D)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="p-4 bg-muted/20 border border-border/40 rounded-lg space-y-2">
              <div className="font-bold text-base text-foreground">Section 1: Vertical Plan Attainment</div>
              <p className="text-muted-foreground">
                Approved CEO Target: <strong>{preview.kpis.approvedCeoTarget} wins</strong> | Achieved Wins: <strong>{preview.kpis.achievedWins} wins</strong> ({preview.kpis.attainmentPercent}%) | Unallocated: <strong>{preview.kpis.unallocatedRemainder} wins</strong>
              </p>
            </div>

            <div className="p-4 bg-muted/20 border border-border/40 rounded-lg space-y-2">
              <div className="font-bold text-base text-foreground">Section 2: Regional Attainment & Scorecards</div>
              <ul className="list-disc pl-5 text-muted-foreground">
                {preview.regionalComparisons.map((r: any) => (
                  <li key={r.regionId}>
                    {r.regionName} (RM: {r.regionalManager?.name || 'TBD'}): Target {r.targetWins} | Wins {r.achievedWins} | Status {r.status.toUpperCase()}
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-4 bg-muted/20 border border-border/40 rounded-lg space-y-2">
              <div className="font-bold text-base text-foreground">Section 3: Economics & Territory Capacity Health</div>
              <p className="text-muted-foreground">
                Monthly AUM Velocity: ₹{(preview.economics.monthlyAumVelocityInr / 10000000).toFixed(2)} Cr | Avg Ticket: ₹{(preview.economics.averageTicketSizeInr / 100000).toFixed(2)} Lakhs | Capacity Gap: +{preview.economics.unitCapacityGapFte} Callers
              </p>
            </div>

            <div className="p-4 bg-muted/20 border border-border/40 rounded-lg space-y-2">
              <div className="font-bold text-base text-foreground">Section 4: Executive Escalations & Governance (CEO / CFO)</div>
              <p className="text-muted-foreground">
                {preview.openEscalations.length} Open Strategic / Pricing Escalations currently under executive consideration.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <SkeletonRows rows={4} />
      )}

      {/* Active Schedules */}
      <Card>
        <CardHeader>
          <CardTitle>Automated Delivery Schedules</CardTitle>
        </CardHeader>
        <CardContent>
          {!schedules || schedules.length === 0 ? (
            <EmptyState title="No schedules configured" message="Set up automated distribution for executive stakeholders." />
          ) : (
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-border/60 text-xs font-semibold uppercase text-muted-foreground">
                  <th className="py-2 px-3">Report Name</th>
                  <th className="py-2 px-3">Cadence</th>
                  <th className="py-2 px-3">Period</th>
                  <th className="py-2 px-3">Recipients</th>
                  <th className="py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {schedules.map((sc) => (
                  <tr key={sc.id}>
                    <td className="py-2.5 px-3 font-semibold text-foreground">{sc.name}</td>
                    <td className="py-2.5 px-3">{sc.cadence}</td>
                    <td className="py-2.5 px-3 capitalize">{sc.period_type}</td>
                    <td className="py-2.5 px-3 text-xs text-muted-foreground">
                      {Array.isArray(sc.recipients) ? sc.recipients.join(', ') : ''}
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge tone={sc.status === 'active' ? 'open' : 'pending'}>{sc.status.toUpperCase()}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Drawer: Add Schedule */}
      <Panel open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Configure Executive Delivery Schedule">
        <div className="space-y-4 p-4">
          <FormField label="Report Name">
            <Input value={scheduleName} onChange={(e) => setScheduleName(e.target.value)} />
          </FormField>

          <FormField label="Period Type">
            <Select value={periodType} onChange={(e) => setPeriodType(e.target.value as any)}>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="half-yearly">Half-Yearly</option>
              <option value="annual">Annual</option>
            </Select>
          </FormField>

          <FormField label="Delivery Cadence Description">
            <Input value={cadence} onChange={(e) => setCadence(e.target.value)} />
          </FormField>

          <FormField label="Recipient Emails (comma-separated)">
            <Input value={recipientsText} onChange={(e) => setRecipientsText(e.target.value)} />
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
