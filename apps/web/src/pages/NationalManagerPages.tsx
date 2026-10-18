import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useSession } from '../lib/session';
import { nationalApi } from '../lib/national-api';

function useVerticalInfo() {
  const { session } = useSession();
  const isBanking = session?.verticalGrants?.includes('banking') ?? false;
  const isMarkets = session?.verticalGrants?.includes('markets') ?? false;
  const isRealEstate = (session?.verticalGrants?.includes('real-estate') || session?.verticalGrants?.includes('real_estate')) ?? false;
  return {
    isBanking,
    isMarkets,
    isRealEstate,
    verticalName: isBanking
      ? 'Commercial Banking'
      : isMarkets
      ? 'Markets & Securities'
      : isRealEstate
      ? 'Real Estate Advisory'
      : 'Wealth',
    verticalScopeLabel: isBanking
      ? 'Banking'
      : isMarkets
      ? 'Markets'
      : isRealEstate
      ? 'Real Estate'
      : 'Wealth',
    defaultTeamId: isBanking
      ? 'TEAM-BANKING-ALPHA'
      : isMarkets
      ? 'TEAM-MARKETS-ALPHA'
      : isRealEstate
      ? 'TEAM-REALESTATE-ALPHA'
      : 'TEAM-WEALTH-ALPHA',
    defaultTeamName: isBanking
      ? 'Banking Alpha'
      : isMarkets
      ? 'Markets Alpha'
      : isRealEstate
      ? 'Real Estate Alpha'
      : 'Wealth Alpha',
    defaultOwnerId: isBanking
      ? 'EMP-004'
      : isMarkets
      ? 'EMP-021'
      : isRealEstate
      ? 'EMP-026'
      : 'EMP-001',
    defaultOwnerName: isBanking
      ? 'Dev Kapoor (EMP-004)'
      : isMarkets
      ? 'Kabir Joshi (EMP-021)'
      : isRealEstate
      ? 'Sameer Kulkarni (EMP-026)'
      : 'Asha Rao (EMP-001)',
    defaultProduct: isBanking
      ? 'V1 Commercial Term Loan'
      : isMarkets
      ? 'Equity Delivery & Intraday'
      : isRealEstate
      ? 'Luxury Residential Mandate'
      : 'V1 Wealth Portfolio',
    affectedProducts: isBanking
      ? ['V1 Commercial Term Loan', 'V1 Current Account']
      : isMarkets
      ? ['Equity Delivery & Intraday', 'F&O Derivatives']
      : isRealEstate
      ? ['Luxury Residential Mandate', 'Commercial Office Space']
      : ['V1 Wealth Portfolio'],
  };
}
import { PageHeader, Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input, Textarea } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Panel, BusyButton } from '../components/ui/panel';
import { EmptyState, SkeletonRows, SuccessNote } from '../components/ui/states';
import type { NmPeriod } from '@finverse/contracts';

export interface UseLoadState {
  loading: boolean;
  initialLoading: boolean;
  error: string | null;
  clearError: () => void;
}

export function useLoad<T = any>(
  fn: () => Promise<T>
): [T | null, () => void, UseLoadState] {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reqIdRef = useRef(0);
  const isMountedRef = useRef(true);

  const load = useCallback(() => {
    const currentReqId = ++reqIdRef.current;
    setLoading(true);
    setError(null);

    fn()
      .then((res) => {
        if (!isMountedRef.current || currentReqId !== reqIdRef.current) return;
        setData(res);
        setError(null);
        setLoading(false);
      })
      .catch((err: any) => {
        if (!isMountedRef.current || currentReqId !== reqIdRef.current) return;
        setError(err?.message || 'Failed to load data. Please retry.');
        setLoading(false);
      });
  }, [fn]);

  useEffect(() => {
    isMountedRef.current = true;
    load();
    return () => {
      reqIdRef.current++;
    };
  }, [load]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return [
    data,
    load,
    {
      loading,
      initialLoading: loading && data === null,
      error,
      clearError,
    },
  ];
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

function DeckRightRail({
  steps,
  failure,
  permission,
}: {
  steps: string[];
  failure: string;
  permission: string;
}) {
  return (
    <div className="space-y-4">
      <Card className="border-border/60 bg-card p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">HOW THIS WORKS</p>
        <p className="mt-1 font-heading text-sm font-bold text-foreground">Your next steps</p>
        <div className="mt-3 space-y-2.5">
          {steps.map((s, idx) => (
            <div key={idx} className="flex items-start gap-2 text-xs">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                {String(idx + 1).padStart(2, '0')}
              </span>
              <span className="text-muted-foreground leading-snug">{s}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="border-border/60 bg-card p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">WHEN A CHECK FAILS</p>
        <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{failure}</p>
      </Card>

      <Card className="border-border/60 bg-card p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">PERMISSION &amp; EVIDENCE</p>
        <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{permission}</p>
      </Card>
    </div>
  );
}

function DeckBottomBar({
  onAction,
  actionLabel,
  disabled,
  busy,
}: {
  onAction?: () => void;
  actionLabel: string;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card/60 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="text-primary font-bold">🛡</span>
        <span>Current role and scope checked on submit</span>
      </div>
      <div className="flex items-center justify-end gap-2">
        {onAction && (
          <BusyButton
            size="sm"
            busy={busy}
            disabled={disabled}
            onClick={onAction}
            className="bg-[#113F3D] text-white hover:bg-[#113F3D]/90"
          >
            {actionLabel}
          </BusyButton>
        )}
      </div>
    </div>
  );
}

// ─── NM-01: National Overview ───
export function NationalOverviewPage() {
  const [period, setPeriod] = useState<NmPeriod>('month-to-date');
  const loadOverview = useCallback(() => nationalApi.overview(period), [period]);
  const [data, load, { loading, initialLoading, error, clearError }] = useLoad(loadOverview);

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

  const { verticalScopeLabel, verticalName } = useVerticalInfo();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inspect national vertical performance"
        subtitle={`NM-01 / VERTICAL OVERVIEW · ${verticalScopeLabel} · assigned permission scope · illustrative records`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={period} onChange={(e) => setPeriod(e.target.value as NmPeriod)} className="w-40 text-xs">
              <option value="today">Today</option>
              <option value="this-week">This week</option>
              <option value="month-to-date">Month to date</option>
              <option value="last-month">Last month</option>
              <option value="quarter-to-date">Quarter to date</option>
            </Select>
            <Button size="sm" variant="outline" onClick={load} disabled={loading}>
              {loading && data ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Button size="sm" onClick={() => setActionDrawerOpen(true)}>
              + National directive
            </Button>
          </div>
        }
      />

      <div className="flex items-center justify-between border-b border-border/40 pb-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Ready for review
        </span>
        <span>Updated 09:42 IST</span>
      </div>

      {error ? (
        <div role="alert" className="flex items-center justify-between rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <span>Failed to load overview: {error}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={load}>Retry</Button>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={clearError}>Dismiss</Button>
          </div>
        </div>
      ) : null}

      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}
      {s.error ? <p role="alert" className="text-xs text-destructive">{s.error}</p> : null}

      {initialLoading ? (
        <SkeletonRows rows={6} />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* WORK AREA Context Summary Card */}
            <Card className="border-border/60 bg-card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">WORK AREA</p>
              <p className="mt-1 font-heading text-lg font-bold text-foreground">Inspect national vertical performance</p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-md border border-border/40 bg-muted/20 p-3 text-xs">
                <div>
                  <p className="text-muted-foreground text-[11px]">Region</p>
                  <p className="font-semibold text-foreground">All Regions</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px]">Vertical</p>
                  <p className="font-semibold text-foreground">{verticalName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px]">Period</p>
                  <p className="font-semibold text-foreground">Month to date</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px]">Focus</p>
                  <p className="font-semibold text-foreground">Quota pace</p>
                </div>
              </div>
            </Card>

            {/* In This View Highlight Card */}
            <Card className="border-border/60 bg-primary/5 p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">IN THIS VIEW</p>
                <p className="mt-1 text-base font-bold text-foreground">Active national pipeline &amp; quota gaps</p>
                <p className="text-xs text-muted-foreground">Consolidated prospective deal pipeline across authorized divisions.</p>
              </div>
              <div className="text-3xl font-heading font-extrabold text-primary">
                {String(data?.kpis?.activePipelineLeads ?? 11).padStart(2, '0')}
              </div>
            </Card>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card className="border-border/60 bg-card p-4">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Vertical Attainment</p>
                <p className="mt-1 text-xl font-bold text-foreground">
                  {data?.kpis?.achievedWins ?? 8} / {data?.kpis?.approvedCeoTarget ?? 500}
                </p>
                <div className="mt-1 flex items-center gap-1.5">
                  <Badge tone={data?.kpis?.attainmentPercent >= 80 ? 'open' : 'pending'}>
                    {data?.kpis?.attainmentPercent ?? 2}% CEO Target
                  </Badge>
                </div>
              </Card>

              <Card className="border-border/60 bg-card p-4">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Unallocated Target</p>
                <p className="mt-1 text-xl font-bold text-amber-700 dark:text-amber-400">
                  {data?.kpis?.unallocatedRemainder ?? 250} wins
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">Pending regional division allocation</p>
              </Card>

              <Card className="border-border/60 bg-card p-4">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Active Pipeline</p>
                <p className="mt-1 text-xl font-bold text-foreground">
                  {data?.kpis?.activePipelineLeads ?? 11} leads
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">Across South &amp; West divisions</p>
              </Card>

              <Card className="border-border/60 bg-card p-4">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Governance &amp; Risks</p>
                <p className="mt-1 text-xl font-bold text-foreground">
                  {data?.kpis?.openEscalationsCount ?? 1} escalations
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {data?.kpis?.openActionsCount ?? 0} open directives
                </p>
              </Card>
            </div>

            {/* Regional Attainment Division Table */}
            <Card className="border-border/60 bg-card p-4">
              <p className="font-heading text-sm font-bold text-foreground">Regional Division Breakdown</p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border/60 text-[11px] font-semibold uppercase text-muted-foreground">
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
                    {data?.regionalPerformance?.map((r: any) => (
                      <tr key={r.regionId} className="hover:bg-muted/30">
                        <td className="py-2.5 px-3 font-semibold text-foreground">{r.regionName}</td>
                        <td className="py-2.5 px-3">{r.teamCount} teams</td>
                        <td className="py-2.5 px-3 font-medium">{r.targetWins}</td>
                        <td className="py-2.5 px-3 font-bold text-primary">{r.achievedWins}</td>
                        <td className="py-2.5 px-3">{r.attainmentPercent}%</td>
                        <td className="py-2.5 px-3">
                          <Badge tone={r.status === 'on-track' ? 'open' : r.status === 'at-risk' ? 'pending' : 'overdue'}>
                            {r.status.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3">{r.activePipelines} leads</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Recent Directives & Action Items */}
            <Card className="border-border/60 bg-card p-4">
              <p className="font-heading text-sm font-bold text-foreground">Recent Executive Directives &amp; Interventions</p>
              <div className="mt-3 overflow-x-auto">
                {!data?.recentDirectives || data.recentDirectives.length === 0 ? (
                  <EmptyState title="No active directives" message="All regional directives and interventions are up to date." />
                ) : (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border/60 text-[11px] font-semibold uppercase text-muted-foreground">
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
                          <td className="py-2 px-3">
                            <Badge tone="default">{a.kind.replace('-', ' ').toUpperCase()}</Badge>
                          </td>
                          <td className="py-2 px-3 font-medium text-foreground">{a.subject_rm_name}</td>
                          <td className="py-2 px-3 text-muted-foreground">{a.region_name || 'All'}</td>
                          <td className="py-2 px-3 font-medium text-foreground">{a.title}</td>
                          <td className="py-2 px-3 text-muted-foreground">{new Date(a.due_at).toLocaleDateString('en-IN')}</td>
                          <td className="py-2 px-3">
                            <Badge tone={a.status === 'done' ? 'open' : 'pending'}>{a.status.toUpperCase()}</Badge>
                          </td>
                          <td className="py-2 px-3 text-right">
                            {a.status === 'open' ? (
                              <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => handleCompleteAction(a.id)}>
                                Mark Done
                              </Button>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">Completed</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>

            <DeckBottomBar
              actionLabel="Issue Directive →"
              onAction={() => setActionDrawerOpen(true)}
            />
          </div>

          <div className="lg:col-span-1">
            <DeckRightRail
              steps={[
                "Inspect region contributions, national pipeline and unresolved risk.",
                "Drill into authorised regional evidence within the NM interface.",
                "Assign an accountable regional action.",
              ]}
              failure="Missing regional data displays as incomplete; it never appears as a zero-performance region."
              permission="Other vertical data is excluded unless separately granted for the same role. Union views never double-count facts. National metrics show formula, cutoff, currency and source readiness."
            />
          </div>
        </div>
      )}

      {/* Drawer: Issue Directive */}
      <Panel open={actionDrawerOpen} onClose={() => setActionDrawerOpen(false)} title="Issue National Directive to Regional Manager">
        <div className="space-y-4 p-4">
          <FormField label="Directive Type">
            <Select value={kind} onChange={(e) => setKind(e.target.value as any)}>
              <option value="regional-directive">Regional Directive</option>
              <option value="rm-coaching">RM Coaching &amp; Alignment</option>
              <option value="resource-rebalancing">Resource &amp; Queue Rebalancing</option>
              <option value="policy-compliance">Policy &amp; Governance Compliance</option>
            </Select>
          </FormField>

          <FormField label="Accountable Regional Manager">
            <Select value={selectedRmId} onChange={(e) => setSelectedRmId(e.target.value)}>
              <option value="">Select Regional Manager...</option>
              {data?.scope?.regionalManagers?.map((rm: any) => (
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
            <BusyButton busy={s.busy} onClick={handleCreateDirective} className="bg-[#113F3D] text-white hover:bg-[#113F3D]/90">
              Issue Directive
            </BusyButton>
          </div>
        </div>
      </Panel>
    </div>
  );
}

// ─── NM-02: Regional Scorecards Comparison ───
export function NationalRegionsPage() {
  const [period, setPeriod] = useState('September');
  const loadComparisons = useCallback(() => nationalApi.getComparisons(period), [period]);
  const [data, load, { loading, initialLoading, error, clearError }] = useLoad(loadComparisons);

  const { verticalScopeLabel } = useVerticalInfo();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compare regions and open an RM scorecard"
        subtitle={`NM-02 / REGIONS · ${verticalScopeLabel} · assigned permission scope · illustrative records`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="w-36 text-xs">
              <option value="September">September 2026</option>
              <option value="October">October 2026</option>
            </Select>
            <Button size="sm" variant="outline" onClick={load} disabled={loading}>
              {loading && data ? 'Refreshing…' : 'Refresh'}
            </Button>
          </div>
        }
      />

      <div className="flex items-center justify-between border-b border-border/40 pb-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Ready for review
        </span>
        <span>Updated 09:42 IST</span>
      </div>

      {error ? (
        <div role="alert" className="flex items-center justify-between rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <span>Failed to load comparisons: {error}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={load}>Retry</Button>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={clearError}>Dismiss</Button>
          </div>
        </div>
      ) : null}

      {initialLoading ? (
        <SkeletonRows rows={6} />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card className="border-border/60 bg-card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">WORK AREA</p>
              <p className="mt-1 font-heading text-lg font-bold text-foreground">Compare regions and open an RM scorecard</p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-md border border-border/40 bg-muted/20 p-3 text-xs">
                <div>
                  <p className="text-muted-foreground text-[11px]">Focus</p>
                  <p className="font-semibold text-foreground">Regional scorecards</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px]">Cohort</p>
                  <p className="font-semibold text-foreground">{period} 2026</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px]">Currency</p>
                  <p className="font-semibold text-foreground">INR (Lakhs/Cr)</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px]">Basis</p>
                  <p className="font-semibold text-foreground">Target pace</p>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data?.regions?.map((reg: any) => (
                <Card key={reg.regionId} className="border-border/60 bg-card p-4 space-y-4">
                  <div className="flex items-center justify-between border-b border-border/40 pb-2">
                    <div>
                      <p className="font-heading text-base font-bold text-foreground">{reg.regionName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        RM: <strong className="text-foreground">{reg.regionalManager?.name || 'Unassigned'}</strong>
                      </p>
                    </div>
                    <Badge tone={reg.status === 'active' ? 'open' : 'pending'}>{reg.status.toUpperCase()}</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 bg-muted/20 rounded border border-border/30">
                      <p className="text-muted-foreground text-[10px]">Target Wins</p>
                      <p className="text-base font-bold text-foreground">{reg.targetWins} wins</p>
                    </div>
                    <div className="p-2.5 bg-muted/20 rounded border border-border/30">
                      <p className="text-muted-foreground text-[10px]">Achieved Wins</p>
                      <p className="text-base font-bold text-primary">{reg.achievedWins} wins</p>
                    </div>
                    <div className="p-2.5 bg-muted/20 rounded border border-border/30">
                      <p className="text-muted-foreground text-[10px]">Pipeline AUM</p>
                      <p className="text-base font-bold text-foreground">₹{(reg.pipelineValueInr / 10000000).toFixed(1)} Cr</p>
                    </div>
                    <div className="p-2.5 bg-muted/20 rounded border border-border/30">
                      <p className="text-muted-foreground text-[10px]">Lead Conversion</p>
                      <p className="text-base font-bold text-foreground">{reg.conversionRate}%</p>
                    </div>
                  </div>

                  <div className="border-t border-border/30 pt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Headcount: <strong>{reg.callerCount} Callers</strong>, <strong>{reg.tlCount} TLs</strong></span>
                    <span>Speed to Lead: <strong>{reg.speedToLeadMinutes}m</strong></span>
                  </div>
                </Card>
              ))}
            </div>

            <DeckBottomBar
              actionLabel="Review Regional Allocation →"
              onAction={() => window.location.assign('/national/plan')}
            />
          </div>

          <div className="lg:col-span-1">
            <DeckRightRail
              steps={[
                "Compare eligible regional scorecards.",
                "Inspect sample size, source mix and target basis before drawing conclusions.",
                "Open an RM record and agree a regional improvement action.",
              ]}
              failure="Changing filters does not change official submitted report versions."
              permission="Comparison needs consistent currency, cohort and observation cutoff. No RM interface is opened. Show actual results plus reasons for incomparable or immature cohorts."
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── NM-03: National Target Allocation ───
export function NationalPlanPage() {
  const loadTarget = useCallback(() => nationalApi.getTarget('October'), []);
  const [data, load, { loading, initialLoading, error, clearError }] = useLoad(loadTarget);
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

  const { verticalScopeLabel } = useVerticalInfo();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Allocate the national target to regions"
        subtitle={`NM-03 / NATIONAL PLAN · ${verticalScopeLabel} · assigned permission scope · illustrative records`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={load} disabled={loading}>
              {loading && data ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => handleSavePlan(false)} disabled={isOverAllocated || s.busy}>
              Save Draft
            </Button>
            <Button size="sm" onClick={() => handleSavePlan(true)} disabled={isOverAllocated || s.busy} className="bg-[#113F3D] text-white hover:bg-[#113F3D]/90">
              Publish &amp; Distribute to RMs
            </Button>
          </div>
        }
      />

      <div className="flex items-center justify-between border-b border-border/40 pb-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Ready for review
        </span>
        <span>Updated 09:42 IST</span>
      </div>

      {error ? (
        <div role="alert" className="flex items-center justify-between rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <span>Failed to load plan: {error}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={load}>Retry</Button>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={clearError}>Dismiss</Button>
          </div>
        </div>
      ) : null}

      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}
      {s.error ? <p role="alert" className="text-xs text-destructive">{s.error}</p> : null}

      {initialLoading ? (
        <SkeletonRows rows={6} />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card className="border-border/60 bg-card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">WORK AREA</p>
              <p className="mt-1 font-heading text-lg font-bold text-foreground">Allocate the national target to regions</p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-md border border-border/40 bg-muted/20 p-3 text-xs">
                <div>
                  <p className="text-muted-foreground text-[11px]">Approved Target</p>
                  <p className="font-semibold text-foreground">{ceoTarget} wins</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px]">Allocated Sum</p>
                  <p className="font-semibold text-foreground">{allocatedSum} wins</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px]">Unallocated</p>
                  <p className={`font-semibold ${isOverAllocated ? 'text-destructive font-bold' : 'text-foreground'}`}>
                    {remainder} wins
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px]">Plan Status</p>
                  <p className="font-semibold text-foreground">{(data?.status || 'draft').toUpperCase()}</p>
                </div>
              </div>
            </Card>

            {isOverAllocated && (
              <div role="alert" className="p-3 bg-destructive/10 border border-destructive/30 rounded text-xs text-destructive flex items-center gap-2">
                <span className="font-bold">⚠️ Warning:</span>
                <span>Regional allocations ({allocatedSum}) exceed approved CEO target ({ceoTarget}). Please adjust before publishing.</span>
              </div>
            )}

            <Card className="border-border/60 bg-card p-4">
              <p className="font-heading text-sm font-bold text-foreground">Regional Target Distribution Editor</p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border/60 text-[11px] font-semibold uppercase text-muted-foreground">
                      <th className="py-2.5 px-3">Division</th>
                      <th className="py-2.5 px-3">Assigned RM</th>
                      <th className="py-2.5 px-3">Allocated Target Wins</th>
                      <th className="py-2.5 px-3">Share %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {allocations.map((alloc, idx) => (
                      <tr key={alloc.regionId} className="hover:bg-muted/30">
                        <td className="py-2.5 px-3 font-semibold text-foreground">{alloc.regionName}</td>
                        <td className="py-2.5 px-3 text-muted-foreground">Kavita Rao (EMP-008)</td>
                        <td className="py-2.5 px-3">
                          <Input
                            type="number"
                            className="w-28 text-xs h-7"
                            value={alloc.targetWins}
                            onChange={(e) => handleUpdateAllocation(idx, parseInt(e.target.value) || 0)}
                          />
                        </td>
                        <td className="py-2.5 px-3 font-medium text-muted-foreground">
                          {ceoTarget > 0 ? Math.round((alloc.targetWins / ceoTarget) * 100) : 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <DeckBottomBar
              actionLabel="Publish Delegated Plan →"
              disabled={isOverAllocated || s.busy}
              busy={s.busy}
              onAction={() => handleSavePlan(true)}
            />
          </div>

          <div className="lg:col-span-1">
            <DeckRightRail
              steps={[
                "Open the agreed vertical target and capacity assumptions.",
                "Allocate regional targets using the same metric basis.",
                "Publish delegated allocations or submit a change for approval.",
              ]}
              failure="A CEO target revision triggers controlled downstream revision, not silent overwrite."
              permission="Annual, quarterly and monthly targets must reconcile by approved policy. Preserve effective versions. Store parent-child target relationships and notify RMs."
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── NM-04: National Economics & Unit Capacity ───
export function NationalEconomicsPage() {
  const [period] = useState('month-to-date');
  const loadEconomics = useCallback(() => nationalApi.getEconomics(period), [period]);
  const [data, load, { loading, initialLoading, error, clearError }] = useLoad(loadEconomics);

  const { verticalScopeLabel } = useVerticalInfo();
  const economics = data?.economics;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Review product and source economics"
        subtitle={`NM-04 / PRODUCT & SOURCES · ${verticalScopeLabel} · assigned permission scope · illustrative records`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={load} disabled={loading}>
              {loading && data ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Button size="sm" onClick={() => window.location.assign('/national/rules')} className="bg-[#113F3D] text-white hover:bg-[#113F3D]/90">
              Propose Rule Changes →
            </Button>
          </div>
        }
      />

      <div className="flex items-center justify-between border-b border-border/40 pb-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Ready for review
        </span>
        <span>Updated 09:42 IST</span>
      </div>

      {error ? (
        <div role="alert" className="flex items-center justify-between rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <span>Failed to load economics: {error}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={load}>Retry</Button>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={clearError}>Dismiss</Button>
          </div>
        </div>
      ) : null}

      {initialLoading ? (
        <SkeletonRows rows={6} />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card className="border-border/60 bg-card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">WORK AREA</p>
              <p className="mt-1 font-heading text-lg font-bold text-foreground">Review product and source economics</p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-md border border-border/40 bg-muted/20 p-3 text-xs">
                <div>
                  <p className="text-muted-foreground text-[11px]">Attributable Run-Rate</p>
                  <p className="font-semibold text-foreground">₹{((economics?.aumRunRateInr || 0) / 10000000).toFixed(1)} Cr</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px]">Blended CAC</p>
                  <p className="font-semibold text-foreground">₹{(economics?.estimatedBlendedCacInr || 0).toLocaleString('en-IN')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px]">Avg Ticket Size</p>
                  <p className="font-semibold text-foreground">₹{((economics?.averageTicketSizeInr || 0) / 100000).toFixed(1)} Lakhs</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px]">Unit Capacity Gap</p>
                  <p className="font-semibold text-amber-700 dark:text-amber-400">+{economics?.unitCapacityGapFte || 4} Callers</p>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-border/60 bg-card p-4">
                <p className="font-heading text-sm font-bold text-foreground">Acquisition Channel Efficiency</p>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border/60 text-[11px] font-semibold uppercase text-muted-foreground">
                        <th className="py-2 px-2">Channel</th>
                        <th className="py-2 px-2">Share %</th>
                        <th className="py-2 px-2">CAC (INR)</th>
                        <th className="py-2 px-2">Conversion</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {economics?.channelEconomics?.map((c: any) => (
                        <tr key={c.channel} className="hover:bg-muted/30">
                          <td className="py-2 px-2 font-medium text-foreground">{c.channel}</td>
                          <td className="py-2 px-2">{c.share}%</td>
                          <td className="py-2 px-2 font-semibold">₹{c.cacInr.toLocaleString('en-IN')}</td>
                          <td className="py-2 px-2 font-bold text-primary">{c.conversionRate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card className="border-border/60 bg-card p-4">
                <p className="font-heading text-sm font-bold text-foreground">Product Margins &amp; Economics</p>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border/60 text-[11px] font-semibold uppercase text-muted-foreground">
                        <th className="py-2 px-2">Product</th>
                        <th className="py-2 px-2">Min Ticket</th>
                        <th className="py-2 px-2">Fee (bps)</th>
                        <th className="py-2 px-2">Margin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {economics?.productEconomics?.map((p: any) => (
                        <tr key={p.product} className="hover:bg-muted/30">
                          <td className="py-2 px-2 font-medium text-foreground">{p.product}</td>
                          <td className="py-2 px-2">₹{(p.minTicketInr / 100000).toFixed(0)} Lakhs</td>
                          <td className="py-2 px-2 font-semibold">{p.feeBps} bps</td>
                          <td className="py-2 px-2 font-bold text-primary">{p.marginPercent}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            <DeckBottomBar
              actionLabel="Propose Source Rebalancing →"
              onAction={() => window.location.assign('/national/rules')}
            />
          </div>

          <div className="lg:col-span-1">
            <DeckRightRail
              steps={[
                "Compare product/source cohorts and data completeness.",
                "Inspect verified commercial outcomes and approved cost inputs.",
                "Propose a source, product or budget action with evidence.",
              ]}
              failure="Unknown cost displays N/A for ROI and a data-owner action."
              permission="ROI appears only with defined attributable revenue and validated costs. Revenue and gross sales values must not mix. Show sample size, time lag, cancellations and cost coverage alongside ratios."
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── NM-05: Product & Pipeline Rule Proposals ───
export function NationalProductRulesPage() {
  const loadRules = useCallback(() => nationalApi.listProductRules(), []);
  const [rules, load, { loading, initialLoading, error, clearError }] = useLoad<any[]>(loadRules);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [currentVersion, setCurrentVersion] = useState('v1.2');
  const [proposedVersion, setProposedVersion] = useState('v1.3');
  const [reason, setReason] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('2026-11-01');
  const [previewImpact, setPreviewImpact] = useState('');
  const s = useSubmitAction();

  const handleCreateProposal = async () => {
    if (!ruleName.trim() || !reason.trim() || !previewImpact.trim()) {
      s.setError('Please complete all rule change proposal fields.');
      return;
    }
    await s.run(async () => {
      await nationalApi.createProductRule({
        ruleName: ruleName.trim(),
        currentVersion,
        proposedVersion,
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
    }, 'Rule modification proposal submitted for executive review.');
  };

  const { verticalScopeLabel, affectedProducts } = useVerticalInfo();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Propose pipeline or product rule changes"
        subtitle={`NM-05 / PRODUCT & SOURCES · ${verticalScopeLabel} · assigned permission scope · illustrative records`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={load} disabled={loading}>
              {loading && rules ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Button size="sm" onClick={() => setDrawerOpen(true)} className="bg-[#113F3D] text-white hover:bg-[#113F3D]/90">
              + Propose Rule Change
            </Button>
          </div>
        }
      />

      <div className="flex items-center justify-between border-b border-border/40 pb-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Ready for review
        </span>
        <span>Updated 09:42 IST</span>
      </div>

      {error ? (
        <div role="alert" className="flex items-center justify-between rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <span>Failed to load rule proposals: {error}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={load}>Retry</Button>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={clearError}>Dismiss</Button>
          </div>
        </div>
      ) : null}

      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}
      {s.error ? <p role="alert" className="text-xs text-destructive">{s.error}</p> : null}

      {initialLoading ? (
        <SkeletonRows rows={6} />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card className="border-border/60 bg-card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">WORK AREA</p>
              <p className="mt-1 font-heading text-lg font-bold text-foreground">Propose pipeline or product rule changes</p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-md border border-border/40 bg-muted/20 p-3 text-xs">
                <div>
                  <p className="text-muted-foreground text-[11px]">Scope</p>
                  <p className="font-semibold text-foreground">Pipeline &amp; Gates</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px]">Governance</p>
                  <p className="font-semibold text-foreground">Multi-executive</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px]">Active Proposals</p>
                  <p className="font-semibold text-foreground">{rules?.length || 0} active</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px]">Migration</p>
                  <p className="font-semibold text-foreground">Controlled</p>
                </div>
              </div>
            </Card>

            <Card className="border-border/60 bg-card p-4">
              <p className="font-heading text-sm font-bold text-foreground">Submitted Pipeline &amp; Qualification Proposals</p>
              <div className="mt-3 overflow-x-auto">
                {!rules || rules.length === 0 ? (
                  <EmptyState title="No active proposals" message="No pending product or qualification rule modifications." />
                ) : (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border/60 text-[11px] font-semibold uppercase text-muted-foreground">
                        <th className="py-2.5 px-3">Rule Name</th>
                        <th className="py-2.5 px-3">Version Transition</th>
                        <th className="py-2.5 px-3">Effective Date</th>
                        <th className="py-2.5 px-3">Rationale</th>
                        <th className="py-2.5 px-3">Projected Impact</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {rules.map((r) => (
                        <tr key={r.id} className="hover:bg-muted/30">
                          <td className="py-2.5 px-3 font-semibold text-foreground">{r.rule_name}</td>
                          <td className="py-2.5 px-3 font-mono">{r.current_version} → {r.proposed_version}</td>
                          <td className="py-2.5 px-3 text-muted-foreground">{new Date(r.effective_date).toLocaleDateString('en-IN')}</td>
                          <td className="py-2.5 px-3">{r.reason}</td>
                          <td className="py-2.5 px-3 text-muted-foreground">{r.preview_impact}</td>
                          <td className="py-2.5 px-3">
                            <Badge tone={r.status === 'activated' ? 'open' : 'pending'}>
                              {r.status.toUpperCase()}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>

            <DeckBottomBar
              actionLabel="Draft Rule Proposal →"
              onAction={() => setDrawerOpen(true)}
            />
          </div>

          <div className="lg:col-span-1">
            <DeckRightRail
              steps={[
                "Draft milestone, evidence, template or routing changes.",
                "Preview affected opportunities and reporting definitions.",
                "Submit to required product/finance owners and Admin for publication.",
              ]}
              failure="Failed validation blocks publication. NM proposal does not directly rewrite all active opportunities."
              permission="Existing work retains its rule version unless an explicit migration is approved. Mandatory policy terms cannot be bypassed. Store change proposal, approvers, test evidence and scheduled activation."
            />
          </div>
        </div>
      )}

      {/* Drawer: Propose Rule */}
      <Panel open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Propose Pipeline or Product Rule Modification">
        <div className="space-y-4 p-4">
          <FormField label="Rule Name">
            <Input value={ruleName} onChange={(e) => setRuleName(e.target.value)} placeholder="e.g. Ultra HNW Minimum Allocation Gate" />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Current Version">
              <Input value={currentVersion} onChange={(e) => setCurrentVersion(e.target.value)} />
            </FormField>
            <FormField label="Proposed Version">
              <Input value={proposedVersion} onChange={(e) => setProposedVersion(e.target.value)} />
            </FormField>
          </div>

          <FormField label="Effective Date">
            <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
          </FormField>

          <FormField label="Business Justification & Rationale">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explain why the qualification threshold or SLA must be updated." rows={3} />
          </FormField>

          <FormField label="Projected Pipeline & Conversion Impact">
            <Textarea value={previewImpact} onChange={(e) => setPreviewImpact(e.target.value)} placeholder="Describe impact on throughput, team capacity, and quota attainment." rows={3} />
          </FormField>

          <div className="pt-2 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <BusyButton busy={s.busy} onClick={handleCreateProposal} className="bg-[#113F3D] text-white hover:bg-[#113F3D]/90">
              Submit Proposal
            </BusyButton>
          </div>
        </div>
      </Panel>
    </div>
  );
}

// ─── NM-06: National Forecast Consolidation ───
export function NationalForecastPage() {
  const [period, setPeriod] = useState('October');
  const loadForecast = useCallback(() => nationalApi.getForecastRollup(period), [period]);
  const [data, load, { loading, initialLoading, error, clearError }] = useLoad(loadForecast);

  const [adjustment, setAdjustment] = useState<number>(-2500000);
  const [assumptions, setAssumptions] = useState('Conservative macro adjustment applied for festive quarter liquidity.');
  const s = useSubmitAction();

  const handleForecastSubmit = async (submitToExecs: boolean) => {
    if (!assumptions.trim()) {
      s.setError('Executive assumptions are required.');
      return;
    }
    await s.run(async () => {
      await nationalApi.submitForecast({
        periodLabel: period,
        bottomUpRevenue: data?.bottomUpSum || 45000000,
        nationalAdjustment: adjustment,
        currency: 'INR',
        acceptedRegionalForecastIds: data?.regionalForecasts?.map((rf: any) => rf.id) || [],
        topNationalRisks: data?.topNationalRisks || ['Market volatility in Q4', 'Delayed PMS approvals'],
        nationalAssumptions: assumptions.trim(),
        submitToExecutives: submitToExecs,
      });
      load();
    }, submitToExecs ? 'National forecast frozen and submitted to CEO & CFO.' : 'Forecast draft saved.');
  };

  const { verticalScopeLabel } = useVerticalInfo();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Submit the national forecast"
        subtitle={`NM-06 / PIPELINE & FORECAST · ${verticalScopeLabel} · assigned permission scope · illustrative records`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="w-36 text-xs">
              <option value="October">October 2026</option>
              <option value="Q4">Q4 2026</option>
            </Select>
            <Button size="sm" variant="outline" onClick={load} disabled={loading}>
              {loading && data ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => handleForecastSubmit(false)} disabled={s.busy}>
              Save Draft
            </Button>
            <Button size="sm" onClick={() => handleForecastSubmit(true)} disabled={s.busy} className="bg-[#113F3D] text-white hover:bg-[#113F3D]/90">
              Submit to CEO &amp; CFO
            </Button>
          </div>
        }
      />

      <div className="flex items-center justify-between border-b border-border/40 pb-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Ready for review
        </span>
        <span>Updated 09:42 IST</span>
      </div>

      {error ? (
        <div role="alert" className="flex items-center justify-between rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <span>Failed to load forecast: {error}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={load}>Retry</Button>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={clearError}>Dismiss</Button>
          </div>
        </div>
      ) : null}

      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}
      {s.error ? <p role="alert" className="text-xs text-destructive">{s.error}</p> : null}

      {initialLoading ? (
        <SkeletonRows rows={6} />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card className="border-border/60 bg-card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">WORK AREA</p>
              <p className="mt-1 font-heading text-lg font-bold text-foreground">Submit the national forecast</p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-md border border-border/40 bg-muted/20 p-3 text-xs">
                <div>
                  <p className="text-muted-foreground text-[11px]">Bottom-Up Sum</p>
                  <p className="font-semibold text-foreground">₹{((data?.bottomUpSum || 0) / 10000000).toFixed(2)} Cr</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px]">Macro Adjustment</p>
                  <p className="font-semibold text-amber-700 dark:text-amber-400">₹{(adjustment / 100000).toFixed(1)} Lakhs</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px]">Final Forecast</p>
                  <p className="font-semibold text-primary">₹{(((data?.bottomUpSum || 0) + adjustment) / 10000000).toFixed(2)} Cr</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px]">Submission Status</p>
                  <p className="font-semibold text-foreground">{(data?.status || 'draft').toUpperCase()}</p>
                </div>
              </div>
            </Card>

            <Card className="border-border/60 bg-card p-4">
              <p className="font-heading text-sm font-bold text-foreground">Regional Submissions Rollup</p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border/60 text-[11px] font-semibold uppercase text-muted-foreground">
                      <th className="py-2.5 px-3">Division</th>
                      <th className="py-2.5 px-3">Accountable RM</th>
                      <th className="py-2.5 px-3">Submitted Forecast</th>
                      <th className="py-2.5 px-3">Top Regional Risk</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    <tr className="hover:bg-muted/30">
                      <td className="py-2.5 px-3 font-semibold text-foreground">South Region</td>
                      <td className="py-2.5 px-3 text-muted-foreground">Kavita Rao (EMP-008)</td>
                      <td className="py-2.5 px-3 font-bold text-foreground">₹3.50 Cr</td>
                      <td className="py-2.5 px-3 text-muted-foreground">Turnaround SLA on Tier-1 approvals</td>
                      <td className="py-2.5 px-3"><Badge tone="open">SUBMITTED</Badge></td>
                    </tr>
                    <tr className="hover:bg-muted/30">
                      <td className="py-2.5 px-3 font-semibold text-foreground">West Region</td>
                      <td className="py-2.5 px-3 text-muted-foreground">Kavita Rao (EMP-008)</td>
                      <td className="py-2.5 px-3 font-bold text-foreground">₹1.00 Cr</td>
                      <td className="py-2.5 px-3 text-muted-foreground">Associate capacity ramp-up lag</td>
                      <td className="py-2.5 px-3"><Badge tone="pending">SUBMITTED</Badge></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="border-border/60 bg-card p-4 space-y-4">
              <p className="font-heading text-sm font-bold text-foreground">National Executive Adjustments &amp; Assumptions</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="National Adjustment Amount (INR)">
                  <Input
                    type="number"
                    value={adjustment}
                    onChange={(e) => setAdjustment(parseInt(e.target.value) || 0)}
                  />
                </FormField>
                <FormField label="Assumptions &amp; Risk Commentary">
                  <Textarea
                    value={assumptions}
                    onChange={(e) => setAssumptions(e.target.value)}
                    rows={2}
                  />
                </FormField>
              </div>
            </Card>

            <DeckBottomBar
              actionLabel="Submit National Forecast →"
              disabled={s.busy}
              busy={s.busy}
              onAction={() => handleForecastSubmit(true)}
            />
          </div>

          <div className="lg:col-span-1">
            <DeckRightRail
              steps={[
                "Review regional submissions, ageing and stage assumptions.",
                "Document the national adjustment and main risks.",
                "Submit a frozen vertical forecast to authorised executive recipients.",
              ]}
              failure="Unresolved regional submissions are visible in the national pack."
              permission="Use approved expected CRM revenue and comparable periods. Customer detail is only attached where explicitly permitted. Version forecast and notify CEO sales review and CFO financial review workflows."
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── NM-07: Cross-Region Work Transfers (Twin Cards) ───
export function NationalTransfersPage() {
  const loadTransfers = useCallback(() => nationalApi.listTransfers(), []);
  const [transfers, load, { loading, initialLoading, error, clearError }] = useLoad<any[]>(loadTransfers);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedTransferId, setSelectedTransferId] = useState<string | null>(null);
  const [sourceRegionId, setSourceRegionId] = useState('REGION-SOUTH');
  const [destinationRegionId, setDestinationRegionId] = useState('REGION-WEST');
  const [leadIdsText, setLeadIdsText] = useState('FV-1002, FV-1005');
  const [reason, setReason] = useState('');
  const [handoffPlan, setHandoffPlan] = useState('');
  const s = useSubmitAction();

  const defaultTransfer = {
    id: 'CRT-DEMO-01',
    source_region_name: 'South Region',
    dest_region_name: 'West Region',
    lead_ids: ['FV-1002', 'FV-1005', 'FV-1009'],
    reason: 'Balance HNW prospect queues to cover Bangalore & Mumbai pipeline parity.',
    handoff_plan: 'Transfer to West intake queue with 24h SLA. Receiving TL conducts assignment audit.',
    status: 'pending',
  };
  const selectedTransfer = transfers?.find((t) => t.id === selectedTransferId) || transfers?.[0] || defaultTransfer;

  const handleCreateTransfer = async () => {
    const leadIds = leadIdsText.split(',').map((str) => str.trim()).filter(Boolean);
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
        resolutionNotes: `${decision.toUpperCase()} by National Manager for capacity rebalancing.`,
      });
      load();
    }, `Transfer request ${decision}.`);
  };

  const { verticalScopeLabel } = useVerticalInfo();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approve a cross-region work transfer"
        subtitle={`NM-07 / EXCEPTIONS & REFERRALS · ${verticalScopeLabel} · assigned permission scope · illustrative records`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={load} disabled={loading}>
              {loading && transfers ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Button size="sm" onClick={() => setDrawerOpen(true)} className="bg-[#113F3D] text-white hover:bg-[#113F3D]/90">
              + Initiate Transfer
            </Button>
          </div>
        }
      />

      <div className="flex items-center justify-between border-b border-border/40 pb-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Ready for review
        </span>
        <span>Updated 09:42 IST</span>
      </div>

      {error ? (
        <div role="alert" className="flex items-center justify-between rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <span>Failed to load transfers: {error}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={load}>Retry</Button>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={clearError}>Dismiss</Button>
          </div>
        </div>
      ) : null}

      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}
      {s.error ? <p role="alert" className="text-xs text-destructive">{s.error}</p> : null}

      {initialLoading ? (
        <SkeletonRows rows={6} />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card className="border-border/60 bg-card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">WORK AREA</p>
              <p className="mt-1 font-heading text-lg font-bold text-foreground">Approve a cross-region work transfer</p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-md border border-border/40 bg-muted/20 p-3 text-xs">
                <div>
                  <p className="text-muted-foreground text-[11px]">Type</p>
                  <p className="font-semibold text-foreground">Cross-Region Rebalancing</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px]">Scope</p>
                  <p className="font-semibold text-foreground">South ↔ West</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px]">Lead Provenance</p>
                  <p className="font-semibold text-foreground">Preserved</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px]">Audit Logging</p>
                  <p className="font-semibold text-foreground">Enabled</p>
                </div>
              </div>
            </Card>

            {/* Twin Cards Anatomy */}
            {selectedTransfer && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-border/60 bg-card p-4 space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">SUBMITTED EVIDENCE</p>
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Source Region:</span>{' '}
                      <strong className="text-foreground">{selectedTransfer.source_region_name}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Destination Region:</span>{' '}
                      <strong className="text-primary font-bold">{selectedTransfer.dest_region_name}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Lead Batch Count:</span>{' '}
                      <strong className="text-foreground">{Array.isArray(selectedTransfer.lead_ids) ? selectedTransfer.lead_ids.length : 0} leads</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Rebalancing Rationale:</span>
                      <p className="mt-0.5 text-foreground bg-muted/20 p-2 rounded border border-border/30">{selectedTransfer.reason}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Handoff SLA &amp; Plan:</span>
                      <p className="mt-0.5 text-foreground bg-muted/20 p-2 rounded border border-border/30">{selectedTransfer.handoff_plan}</p>
                    </div>
                  </div>
                </Card>

                <Card className="border-border/60 bg-card p-4 space-y-3 flex flex-col justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">YOUR AUTHORITY</p>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      As National Manager, your authorization reassigns lead territory queues across regional divisions while preserving historic conversation events and source credit.
                    </p>
                    <div className="mt-4 flex items-center justify-between border-t border-border/30 pt-3 text-xs">
                      <span className="text-muted-foreground">Status:</span>
                      <Badge tone={selectedTransfer.status === 'approved' ? 'open' : selectedTransfer.status === 'pending' ? 'pending' : 'overdue'}>
                        {selectedTransfer.status.toUpperCase()}
                      </Badge>
                    </div>
                  </div>

                  <div className="border-t border-border/30 pt-4 flex gap-2 justify-end">
                    {selectedTransfer.status === 'pending' ? (
                      <>
                        <Button size="sm" variant="secondary" onClick={() => handleDecide(selectedTransfer.id, 'rejected')} disabled={s.busy}>
                          Decline
                        </Button>
                        <Button size="sm" onClick={() => handleDecide(selectedTransfer.id, 'approved')} disabled={s.busy} className="bg-[#113F3D] text-white hover:bg-[#113F3D]/90">
                          Approve Transfer
                        </Button>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground font-medium">Decision finalized</span>
                    )}
                  </div>
                </Card>
              </div>
            )}

            <Card className="border-border/60 bg-card p-4">
              <p className="font-heading text-sm font-bold text-foreground">Transfer Queue &amp; History</p>
              <div className="mt-3 overflow-x-auto">
                {!transfers || transfers.length === 0 ? (
                  <EmptyState title="No active transfers" message="No cross-region transfers on file." />
                ) : (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border/60 text-[11px] font-semibold uppercase text-muted-foreground">
                        <th className="py-2 px-3">From</th>
                        <th className="py-2 px-3">To</th>
                        <th className="py-2 px-3">Leads</th>
                        <th className="py-2 px-3">Reason</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {transfers.map((t) => (
                        <tr
                          key={t.id}
                          onClick={() => setSelectedTransferId(t.id)}
                          className={`cursor-pointer hover:bg-muted/30 ${selectedTransfer?.id === t.id ? 'bg-primary/5' : ''}`}
                        >
                          <td className="py-2.5 px-3 font-medium text-foreground">{t.source_region_name}</td>
                          <td className="py-2.5 px-3 font-bold text-primary">{t.dest_region_name}</td>
                          <td className="py-2.5 px-3">{Array.isArray(t.lead_ids) ? t.lead_ids.length : 0}</td>
                          <td className="py-2.5 px-3 text-muted-foreground">{t.reason}</td>
                          <td className="py-2.5 px-3">
                            <Badge tone={t.status === 'approved' ? 'open' : t.status === 'pending' ? 'pending' : 'overdue'}>
                              {t.status.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs">View</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>

            <DeckBottomBar
              actionLabel="Initiate Work Transfer →"
              onAction={() => setDrawerOpen(true)}
            />
          </div>

          <div className="lg:col-span-1">
            <DeckRightRail
              steps={[
                "Review both regional approvals and recipient eligibility.",
                "Approve exact records and effective handoff.",
                "Confirm completion to both RMs.",
              ]}
              failure="Cross-vertical need uses a new linked enquiry with explicit receiving acceptance."
              permission="Both regions must be in the granted vertical. Keep past credit and original task deadlines. Execute per-record ownership transactions with audit and notifications. Transfer reports distinguish moved backlog from new business generation."
            />
          </div>
        </div>
      )}

      {/* Drawer: Initiate Transfer */}
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

          <FormField label="Handoff Plan &amp; SLAs">
            <Textarea value={handoffPlan} onChange={(e) => setHandoffPlan(e.target.value)} placeholder="Mandate 24h intake SLA and receiving TL allocation review." rows={3} />
          </FormField>

          <div className="pt-2 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <BusyButton busy={s.busy} onClick={handleCreateTransfer} className="bg-[#113F3D] text-white hover:bg-[#113F3D]/90">
              Submit Transfer
            </BusyButton>
          </div>
        </div>
      </Panel>
    </div>
  );
}

// ─── NM-08: Cross-Vertical Inbound Referrals (Twin Cards) ───
export function NationalReferralsPage() {
  const loadReferrals = useCallback(() => nationalApi.listReferrals(), []);
  const [referrals, load, { loading, initialLoading, error, clearError }] = useLoad<any[]>(loadReferrals);

  const [selectedReferralId, setSelectedReferralId] = useState<string | null>(null);
  const s = useSubmitAction();

  const selectedReferral = referrals?.find((r) => r.id === selectedReferralId) || referrals?.[0] || null;

  const { verticalScopeLabel, defaultTeamId, defaultTeamName, defaultOwnerId, defaultOwnerName } = useVerticalInfo();

  const handleDecision = async (referralId: string, decision: 'accepted' | 'declined') => {
    await s.run(async () => {
      await nationalApi.decideReferral(referralId, {
        decision,
        targetTeamId: defaultTeamId,
        targetOwnerEmployeeId: defaultOwnerId,
      });
      load();
    }, `Referral ${decision === 'accepted' ? `accepted and added to ${verticalScopeLabel} intake queue` : 'declined'}.`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accept or decline a cross-vertical referral"
        subtitle={`NM-08 / EXCEPTIONS & REFERRALS · ${verticalScopeLabel} · assigned permission scope · illustrative records`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={load} disabled={loading}>
              {loading && referrals ? 'Refreshing…' : 'Refresh'}
            </Button>
          </div>
        }
      />

      <div className="flex items-center justify-between border-b border-border/40 pb-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Ready for review
        </span>
        <span>Updated 09:42 IST</span>
      </div>

      {error ? (
        <div role="alert" className="flex items-center justify-between rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <span>Failed to load referrals: {error}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={load}>Retry</Button>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={clearError}>Dismiss</Button>
          </div>
        </div>
      ) : null}

      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}
      {s.error ? <p role="alert" className="text-xs text-destructive">{s.error}</p> : null}

      {initialLoading ? (
        <SkeletonRows rows={6} />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card className="border-border/60 bg-card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">WORK AREA</p>
              <p className="mt-1 font-heading text-lg font-bold text-foreground">Accept or decline a cross-vertical referral</p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-md border border-border/40 bg-muted/20 p-3 text-xs">
                <div>
                  <p className="text-muted-foreground text-[11px]">Direction</p>
                  <p className="font-semibold text-foreground">Inbound Cross-Vertical</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px]">Sources</p>
                  <p className="font-semibold text-foreground">Other Verticals</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px]">Receiving Authority</p>
                  <p className="font-semibold text-foreground">{verticalScopeLabel} NM</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px]">Isolation</p>
                  <p className="font-semibold text-foreground">No cross-workspace leak</p>
                </div>
              </div>
            </Card>

            {/* Twin Cards Anatomy */}
            {selectedReferral && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-border/60 bg-card p-4 space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">INBOUND REFERRAL PAYLOAD</p>
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Referral Code:</span>{' '}
                      <strong className="text-foreground font-mono font-bold">{selectedReferral.referral_code}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Source Vertical:</span>{' '}
                      <Badge tone="default">{selectedReferral.source_vertical.toUpperCase()}</Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Prospect Name:</span>{' '}
                      <strong className="text-foreground">{selectedReferral.prospect_name}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Contact:</span>{' '}
                      <span className="text-muted-foreground">{selectedReferral.prospect_contact}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Consent Evidence:</span>{' '}
                      <p className="mt-0.5 text-foreground bg-muted/20 p-2 rounded border border-border/30">{selectedReferral.customer_consent_evidence}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Commercial Context:</span>
                      <p className="mt-0.5 text-foreground bg-muted/20 p-2 rounded border border-border/30">{selectedReferral.commercial_context}</p>
                    </div>
                  </div>
                </Card>

                <Card className="border-border/60 bg-card p-4 space-y-3 flex flex-col justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">RECEIVING AUTHORITY &amp; QUEUE</p>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      Acceptance creates an authentic {verticalScopeLabel} lead in {defaultTeamName} intake queue with an immediate 2-hour voice outreach task. Provenance is maintained without granting the sending vertical access to customer records.
                    </p>
                    <div className="mt-4 space-y-2 border-t border-border/30 pt-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Target Team:</span>
                        <strong className="text-foreground">{defaultTeamName}</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Assigned Caller:</span>
                        <strong className="text-foreground">{defaultOwnerName}</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Status:</span>
                        <Badge tone={selectedReferral.decision === 'accepted' ? 'open' : selectedReferral.decision === 'pending' ? 'pending' : 'overdue'}>
                          {selectedReferral.decision.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-border/30 pt-4 flex gap-2 justify-end">
                    {selectedReferral.decision === 'pending' ? (
                      <>
                        <Button size="sm" variant="secondary" onClick={() => handleDecision(selectedReferral.id, 'declined')} disabled={s.busy}>
                          Decline
                        </Button>
                        <Button size="sm" onClick={() => handleDecision(selectedReferral.id, 'accepted')} disabled={s.busy} className="bg-[#113F3D] text-white hover:bg-[#113F3D]/90">
                          Accept into {verticalScopeLabel}
                        </Button>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground font-medium">Disposition finalized</span>
                    )}
                  </div>
                </Card>
              </div>
            )}

            <Card className="border-border/60 bg-card p-4">
              <p className="font-heading text-sm font-bold text-foreground">Inbound Cross-Vertical Referrals Queue</p>
              <div className="mt-3 overflow-x-auto">
                {!referrals || referrals.length === 0 ? (
                  <EmptyState title="No inbound referrals" message="No pending cross-vertical prospect handoffs." />
                ) : (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border/60 text-[11px] font-semibold uppercase text-muted-foreground">
                        <th className="py-2 px-3">Referral Code</th>
                        <th className="py-2 px-3">Source Vertical</th>
                        <th className="py-2 px-3">Prospect</th>
                        <th className="py-2 px-3">Commercial Context</th>
                        <th className="py-2 px-3">Decision</th>
                        <th className="py-2 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {referrals.map((r) => (
                        <tr
                          key={r.id}
                          onClick={() => setSelectedReferralId(r.id)}
                          className={`cursor-pointer hover:bg-muted/30 ${selectedReferral?.id === r.id ? 'bg-primary/5' : ''}`}
                        >
                          <td className="py-2.5 px-3 font-mono font-bold text-foreground">{r.referral_code}</td>
                          <td className="py-2.5 px-3">
                            <Badge tone="default">{r.source_vertical.toUpperCase()}</Badge>
                          </td>
                          <td className="py-2.5 px-3 font-medium text-foreground">{r.prospect_name}</td>
                          <td className="py-2.5 px-3 text-muted-foreground">{r.commercial_context}</td>
                          <td className="py-2.5 px-3">
                            <Badge tone={r.decision === 'accepted' ? 'open' : r.decision === 'pending' ? 'pending' : 'overdue'}>
                              {r.decision.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs">View</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>

            <DeckBottomBar
              actionLabel="Accept Inbound Referral →"
              disabled={selectedReferral?.decision !== 'pending'}
              onAction={() => selectedReferral && handleDecision(selectedReferral.id, 'accepted')}
            />
          </div>

          <div className="lg:col-span-1">
            <DeckRightRail
              steps={[
                "Inspect the minimal referral payload and receiving-product fit.",
                "Accept into an authorised queue or decline with reason.",
                "Notify the sender of status without granting receiver-workspace access.",
              ]}
              failure="No acceptance leaves the request pending and escalates at its deadline; it does not expose the other vertical."
              permission="Receiving authority must be explicitly granted. Check consent and duplicates inside receiving scope. Create/link the receiving opportunity with provenance. Preserve separate ownership and source records."
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── NM-09: National Strategic Escalations ───
export function NationalEscalationsPage() {
  const loadEscalations = useCallback(() => nationalApi.listEscalations(), []);
  const [escalations, load, { loading, initialLoading, error, clearError }] = useLoad<any[]>(loadEscalations);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [category, setCategory] = useState<'revenue_assumption' | 'strategic_exception' | 'pricing_policy' | 'governance_risk'>('strategic_exception');
  const [targetExecutive, setTargetExecutive] = useState<'CEO' | 'CFO' | 'BOTH'>('BOTH');
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [deadline, setDeadline] = useState('');
  const s = useSubmitAction();

  const handleCreateEscalation = async () => {
    if (!title.trim() || !detail.trim() || !deadline) {
      s.setError('Please complete title, detail, and decision deadline.');
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
    }, 'Strategic escalation routed to executive leadership.');
  };

  const handleResolveEscalation = async (escalationId: string) => {
    await s.run(async () => {
      await nationalApi.resolveEscalation(escalationId, {
        executiveDecision: 'Authorized by CEO/CFO subject to 50bps margin floor.',
      });
      load();
    }, 'Executive escalation marked resolved.');
  };

  const { verticalScopeLabel } = useVerticalInfo();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Escalate a national commercial or finance issue"
        subtitle={`NM-09 / EXCEPTIONS & REFERRALS · ${verticalScopeLabel} · assigned permission scope · illustrative records`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={load} disabled={loading}>
              {loading && escalations ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Button size="sm" onClick={() => setDrawerOpen(true)} className="bg-[#113F3D] text-white hover:bg-[#113F3D]/90">
              + Route Escalation
            </Button>
          </div>
        }
      />

      <div className="flex items-center justify-between border-b border-border/40 pb-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Ready for review
        </span>
        <span>Updated 09:42 IST</span>
      </div>

      {error ? (
        <div role="alert" className="flex items-center justify-between rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <span>Failed to load escalations: {error}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={load}>Retry</Button>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={clearError}>Dismiss</Button>
          </div>
        </div>
      ) : null}

      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}
      {s.error ? <p role="alert" className="text-xs text-destructive">{s.error}</p> : null}

      {initialLoading ? (
        <SkeletonRows rows={6} />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card className="border-border/60 bg-card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">WORK AREA</p>
              <p className="mt-1 font-heading text-lg font-bold text-foreground">Escalate a national commercial or finance issue</p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-md border border-border/40 bg-muted/20 p-3 text-xs">
                <div>
                  <p className="text-muted-foreground text-[11px]">Routing Model</p>
                  <p className="font-semibold text-foreground">Dual Executive</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px]">Recipients</p>
                  <p className="font-semibold text-foreground">CEO &amp; CFO</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px]">Resolution</p>
                  <p className="font-semibold text-foreground">Named Accountable</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px]">Open Issues</p>
                  <p className="font-semibold text-foreground">{escalations?.filter((e) => e.status !== 'resolved').length || 0}</p>
                </div>
              </div>
            </Card>

            <Card className="border-border/60 bg-card p-4">
              <p className="font-heading text-sm font-bold text-foreground">Executive Escalation Register</p>
              <div className="mt-3 overflow-x-auto">
                {!escalations || escalations.length === 0 ? (
                  <EmptyState title="No active escalations" message="No pending national governance or commercial issues." />
                ) : (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border/60 text-[11px] font-semibold uppercase text-muted-foreground">
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3">Target Executive</th>
                        <th className="py-2.5 px-3">Title</th>
                        <th className="py-2.5 px-3">Deadline</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {escalations.map((e) => (
                        <tr key={e.id} className="hover:bg-muted/30">
                          <td className="py-2.5 px-3">
                            <Badge tone="default">{e.category.replace('_', ' ').toUpperCase()}</Badge>
                          </td>
                          <td className="py-2.5 px-3 font-bold text-primary">{e.target_executive}</td>
                          <td className="py-2.5 px-3 font-semibold text-foreground">{e.title}</td>
                          <td className="py-2.5 px-3 text-muted-foreground">{new Date(e.decision_deadline).toLocaleDateString('en-IN')}</td>
                          <td className="py-2.5 px-3">
                            <Badge tone={e.status === 'resolved' ? 'open' : 'pending'}>{e.status.toUpperCase()}</Badge>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {e.status !== 'resolved' ? (
                              <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => handleResolveEscalation(e.id)}>
                                Resolve
                              </Button>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">Decided</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>

            <DeckBottomBar
              actionLabel="Route Issue to Executives →"
              onAction={() => setDrawerOpen(true)}
            />
          </div>

          <div className="lg:col-span-1">
            <DeckRightRail
              steps={[
                "Document the issue and proposed action.",
                "Route execution or strategy to CEO, finance policy to CFO, and access changes to Admin.",
                "Track decisions and resulting action owners.",
              ]}
              failure="Conflicting decisions pause the dependent action and escalate to the named accountable executive."
              permission="Dual executive reporting does not duplicate hierarchy facts or grant financial approval authority to NM. Create linked decision requests with independent owners where both subjects are involved."
            />
          </div>
        </div>
      )}

      {/* Drawer: Route Escalation */}
      <Panel open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Route Strategic Commercial Escalation">
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Escalation Category">
              <Select value={category} onChange={(e) => setCategory(e.target.value as any)}>
                <option value="strategic_exception">Strategic Commercial Exception</option>
                <option value="pricing_policy">Fee Schedule / Pricing Policy</option>
                <option value="revenue_assumption">Revenue Assumption Dispute</option>
                <option value="governance_risk">Regulatory &amp; Governance Risk</option>
              </Select>
            </FormField>
            <FormField label="Target Accountable Executive">
              <Select value={targetExecutive} onChange={(e) => setTargetExecutive(e.target.value as any)}>
                <option value="BOTH">Dual Route (CEO &amp; CFO)</option>
                <option value="CEO">Chief Executive Officer (CEO)</option>
                <option value="CFO">Chief Financial Officer (CFO)</option>
              </Select>
            </FormField>
          </div>

          <FormField label="Issue Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Special Advisory Rate Approval for 10 Cr HNW Family" />
          </FormField>

          <FormField label="Detailed Case &amp; Proposed Resolution">
            <Textarea value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="State client background, revenue tradeoffs, competitive risk, and policy impact." rows={4} />
          </FormField>

          <FormField label="Required Decision Deadline">
            <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </FormField>

          <div className="pt-2 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <BusyButton busy={s.busy} onClick={handleCreateEscalation} className="bg-[#113F3D] text-white hover:bg-[#113F3D]/90">
              Route Escalation
            </BusyButton>
          </div>
        </div>
      </Panel>
    </div>
  );
}

// ─── NM-10: Regional Manager Reviews (Twin Cards) ───
export function NationalReviewsPage() {
  const loadReviews = useCallback(() => nationalApi.listReviews(), []);
  const [reviews, load, { loading, initialLoading, error, clearError }] = useLoad<any[]>(loadReviews);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [rmEmployeeId] = useState('EMP-008');
  const [rating, setRating] = useState<'exceeding' | 'achieving' | 'needs_improvement' | 'critical'>('achieving');
  const [strengths, setStrengths] = useState('');
  const [blockers, setBlockers] = useState('');
  const [nextReviewDate, setNextReviewDate] = useState('');
  const s = useSubmitAction();

  const defaultReview = {
    id: 'RMR-DEMO-01',
    rm_name: 'Kavita Rao (EMP-008)',
    period_label: 'September 2026',
    performance_rating: 'achieving',
    strengths: 'Strong team governance, quota attainment pace (104%), and tight SLA adherence across South teams.',
    blockers: 'West division onboarding capacity ramping up slower than quarterly target.',
    next_review_date: '2026-12-15',
  };
  const selectedReview = reviews?.find((r) => r.id === selectedReviewId) || reviews?.[0] || defaultReview;

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
      setNextReviewDate('');
      load();
    }, 'Regional Manager review recorded.');
  };

  const { verticalScopeLabel } = useVerticalInfo();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Run an RM performance review"
        subtitle={`NM-10 / REVIEWS · ${verticalScopeLabel} · assigned permission scope · illustrative records`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={load} disabled={loading}>
              {loading && reviews ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Button size="sm" onClick={() => setDrawerOpen(true)} className="bg-[#113F3D] text-white hover:bg-[#113F3D]/90">
              + Conduct RM Review
            </Button>
          </div>
        }
      />

      <div className="flex items-center justify-between border-b border-border/40 pb-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Ready for review
        </span>
        <span>Updated 09:42 IST</span>
      </div>

      {error ? (
        <div role="alert" className="flex items-center justify-between rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <span>Failed to load reviews: {error}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={load}>Retry</Button>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={clearError}>Dismiss</Button>
          </div>
        </div>
      ) : null}

      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}
      {s.error ? <p role="alert" className="text-xs text-destructive">{s.error}</p> : null}

      {initialLoading ? (
        <SkeletonRows rows={6} />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card className="border-border/60 bg-card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">WORK AREA</p>
              <p className="mt-1 font-heading text-lg font-bold text-foreground">Run an RM performance review</p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-md border border-border/40 bg-muted/20 p-3 text-xs">
                <div>
                  <p className="text-muted-foreground text-[11px]">Subject RM</p>
                  <p className="font-semibold text-foreground">Kavita Rao (EMP-008)</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px]">Division</p>
                  <p className="font-semibold text-foreground">South &amp; West</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px]">Attainment Basis</p>
                  <p className="font-semibold text-foreground">Verified</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px]">Cadence</p>
                  <p className="font-semibold text-foreground">Periodic</p>
                </div>
              </div>
            </Card>

            {/* Twin Cards Anatomy */}
            {selectedReview && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-border/60 bg-card p-4 space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">PERFORMANCE EVIDENCE &amp; HISTORY</p>
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Regional Manager:</span>{' '}
                      <strong className="text-foreground">{selectedReview.rm_name}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Review Period:</span>{' '}
                      <Badge tone="default">{selectedReview.period_label}</Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Historic Quota Attainment:</span>{' '}
                      <strong className="text-primary font-bold">104% (South Region)</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Speed to Lead SLA:</span>{' '}
                      <span className="text-foreground font-semibold">14 minutes</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Open Territory Escalations:</span>{' '}
                      <span className="text-foreground font-semibold">1</span>
                    </div>
                  </div>
                </Card>

                <Card className="border-border/60 bg-card p-4 space-y-3 flex flex-col justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">MEETING RECORD &amp; COMMITMENTS</p>
                    <div className="mt-2 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Assigned Rating:</span>
                        <Badge tone={selectedReview.performance_rating === 'achieving' || selectedReview.performance_rating === 'exceeding' ? 'open' : 'pending'}>
                          {selectedReview.performance_rating.toUpperCase()}
                        </Badge>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Demonstrated Strengths:</span>
                        <p className="mt-0.5 text-foreground bg-muted/20 p-2 rounded border border-border/30">{selectedReview.strengths}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Operational Blockers:</span>
                        <p className="mt-0.5 text-foreground bg-muted/20 p-2 rounded border border-border/30">{selectedReview.blockers}</p>
                      </div>
                      <div className="flex items-center justify-between border-t border-border/30 pt-2 text-[11px]">
                        <span className="text-muted-foreground">Next Formal Review:</span>
                        <strong className="text-foreground">{new Date(selectedReview.next_review_date).toLocaleDateString('en-IN')}</strong>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            <Card className="border-border/60 bg-card p-4">
              <p className="font-heading text-sm font-bold text-foreground">Completed RM Evaluations Register</p>
              <div className="mt-3 overflow-x-auto">
                {!reviews || reviews.length === 0 ? (
                  <EmptyState title="No reviews on file" message="No RM performance reviews recorded yet." />
                ) : (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border/60 text-[11px] font-semibold uppercase text-muted-foreground">
                        <th className="py-2 px-3">Regional Manager</th>
                        <th className="py-2 px-3">Period</th>
                        <th className="py-2 px-3">Performance Rating</th>
                        <th className="py-2 px-3">Key Strengths</th>
                        <th className="py-2 px-3">Next Review</th>
                        <th className="py-2 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {reviews.map((r) => (
                        <tr
                          key={r.id}
                          onClick={() => setSelectedReviewId(r.id)}
                          className={`cursor-pointer hover:bg-muted/30 ${selectedReview?.id === r.id ? 'bg-primary/5' : ''}`}
                        >
                          <td className="py-2.5 px-3 font-semibold text-foreground">{r.rm_name}</td>
                          <td className="py-2.5 px-3 text-muted-foreground">{r.period_label}</td>
                          <td className="py-2.5 px-3">
                            <Badge tone={r.performance_rating === 'achieving' || r.performance_rating === 'exceeding' ? 'open' : 'pending'}>
                              {r.performance_rating.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3">{r.strengths}</td>
                          <td className="py-2.5 px-3 text-muted-foreground">{new Date(r.next_review_date).toLocaleDateString('en-IN')}</td>
                          <td className="py-2.5 px-3 text-right">
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs">View</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>

            <DeckBottomBar
              actionLabel="Record Formal Review →"
              onAction={() => setDrawerOpen(true)}
            />
          </div>

          <div className="lg:col-span-1">
            <DeckRightRail
              steps={[
                "Prepare the regional snapshot and request reflection.",
                "Review results, resourcing and follow-through.",
                "Complete the meeting and track agreed commitments.",
              ]}
              failure="Unresolved metric corrections remain visible and linked."
              permission="Use approved historical attribution and permitted employee data. Acknowledgement does not imply agreement. Store review version, employee response and dated actions."
            />
          </div>
        </div>
      )}

      {/* Drawer: Conduct Review */}
      <Panel open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Conduct Regional Manager Review">
        <div className="space-y-4 p-4">
          <FormField label="Regional Manager">
            <Input value="Kavita Rao (EMP-008 — South &amp; West Divisions)" readOnly />
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

          <FormField label="Blockers &amp; Gaps to Bridge">
            <Textarea value={blockers} onChange={(e) => setBlockers(e.target.value)} placeholder="Address capacity deficits, escalation response times, or SLA adherence." rows={3} />
          </FormField>

          <FormField label="Next Formal Review Date">
            <Input type="date" value={nextReviewDate} onChange={(e) => setNextReviewDate(e.target.value)} />
          </FormField>

          <div className="pt-2 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <BusyButton busy={s.busy} onClick={handleSaveReview} className="bg-[#113F3D] text-white hover:bg-[#113F3D]/90">
              Save Review
            </BusyButton>
          </div>
        </div>
      </Panel>
    </div>
  );
}

// ─── NM-11: National Executive Reports & Schedules ───
export function NationalReportsPage() {
  const loadPreview = useCallback(() => nationalApi.previewReportPack('October 2026'), []);
  const [preview, loadPrev, { loading: prevLoading, initialLoading: prevInitialLoading, error: prevError }] = useLoad(loadPreview);

  const loadSchedules = useCallback(() => nationalApi.listReportSchedules(), []);
  const [schedules, loadSched, { loading: schedLoading, error: schedError }] = useLoad<any[]>(loadSchedules);

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
    }, 'Executive PDF Pack generated and download started.');
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
      loadSched();
    }, 'Executive report schedule registered.');
  };

  const { verticalScopeLabel } = useVerticalInfo();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prepare the national executive pack"
        subtitle={`NM-11 / REPORTS & HELP · ${verticalScopeLabel} · assigned permission scope · illustrative records`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => { loadPrev(); loadSched(); }} disabled={prevLoading || schedLoading}>
              {(prevLoading || schedLoading) && preview ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setDrawerOpen(true)}>
              Schedule Automated Delivery
            </Button>
            <Button size="sm" onClick={handleExportPdf} disabled={s.busy} className="bg-[#113F3D] text-white hover:bg-[#113F3D]/90">
              Export Executive PDF Pack
            </Button>
          </div>
        }
      />

      <div className="flex items-center justify-between border-b border-border/40 pb-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Ready for review
        </span>
        <span>Updated 09:42 IST</span>
      </div>

      {(prevError || schedError) ? (
        <div role="alert" className="rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          Failed to load reports: {prevError || schedError}
        </div>
      ) : null}

      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}
      {s.error ? <p role="alert" className="text-xs text-destructive">{s.error}</p> : null}

      {prevInitialLoading ? (
        <SkeletonRows rows={6} />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card className="border-border/60 bg-card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">WORK AREA</p>
              <p className="mt-1 font-heading text-lg font-bold text-foreground">Prepare the national executive pack</p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-md border border-border/40 bg-muted/20 p-3 text-xs">
                <div>
                  <p className="text-muted-foreground text-[11px]">Pack Type</p>
                  <p className="font-semibold text-foreground">Executive Governance</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px]">Brand Palette</p>
                  <p className="font-semibold text-foreground">Finverse #113F3D</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px]">Format</p>
                  <p className="font-semibold text-foreground">Binary PDF + Schedule</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px]">Audience</p>
                  <p className="font-semibold text-foreground">CEO &amp; CFO</p>
                </div>
              </div>
            </Card>

            {preview && (
              <Card className="border-border/60 bg-card p-4 space-y-4">
                <p className="font-heading text-sm font-bold text-foreground">Executive Pack Preview (Finverse Palette #113F3D)</p>
                <div className="space-y-3 text-xs">
                  <div className="p-3 bg-muted/20 rounded border border-border/30">
                    <p className="font-bold text-foreground">Section 1: Vertical Plan Attainment</p>
                    <p className="text-muted-foreground mt-0.5">
                      CEO Quota: <strong>{preview.kpis?.approvedCeoTarget} wins</strong> | Achieved: <strong>{preview.kpis?.achievedWins} wins</strong> | Remainder: <strong>{preview.kpis?.unallocatedRemainder} wins</strong>
                    </p>
                  </div>
                  <div className="p-3 bg-muted/20 rounded border border-border/30">
                    <p className="font-bold text-foreground">Section 2: Regional Division Breakdown</p>
                    <p className="text-muted-foreground mt-0.5">
                      South Region vs West Region comparison across quota attainment, AUM velocity, and conversion efficiency.
                    </p>
                  </div>
                  <div className="p-3 bg-muted/20 rounded border border-border/30">
                    <p className="font-bold text-foreground">Section 3: Unit Economics &amp; CAC Run-Rate</p>
                    <p className="text-muted-foreground mt-0.5">
                      Estimated Blended CAC: <strong>₹{(preview.economics?.estimatedBlendedCacInr || 12500).toLocaleString('en-IN')}</strong> | Capacity Gap: <strong>+{preview.economics?.unitCapacityGapFte || 4} Callers</strong>
                    </p>
                  </div>
                  <div className="p-3 bg-muted/20 rounded border border-border/30">
                    <p className="font-bold text-foreground">Section 4: Governance &amp; Risk Register</p>
                    <p className="text-muted-foreground mt-0.5">
                      {preview.openEscalations?.length || 0} active commercial escalations pending executive decision.
                    </p>
                  </div>
                </div>
              </Card>
            )}

            <Card className="border-border/60 bg-card p-4">
              <p className="font-heading text-sm font-bold text-foreground">Automated Executive Delivery Schedules</p>
              <div className="mt-3 overflow-x-auto">
                {!schedules || schedules.length === 0 ? (
                  <EmptyState title="No active schedules" message="No automated report delivery jobs configured." />
                ) : (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border/60 text-[11px] font-semibold uppercase text-muted-foreground">
                        <th className="py-2 px-3">Report Name</th>
                        <th className="py-2 px-3">Cadence</th>
                        <th className="py-2 px-3">Period</th>
                        <th className="py-2 px-3">Recipients</th>
                        <th className="py-2 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {schedules.map((s) => (
                        <tr key={s.id} className="hover:bg-muted/30">
                          <td className="py-2.5 px-3 font-semibold text-foreground">{s.name}</td>
                          <td className="py-2.5 px-3">{s.cadence}</td>
                          <td className="py-2.5 px-3 uppercase text-muted-foreground">{s.period_type}</td>
                          <td className="py-2.5 px-3 text-muted-foreground font-mono">{Array.isArray(s.recipients) ? s.recipients.join(', ') : ''}</td>
                          <td className="py-2.5 px-3">
                            <Badge tone={s.status === 'active' ? 'open' : 'pending'}>{s.status.toUpperCase()}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>

            <DeckBottomBar
              actionLabel="Export Executive PDF Pack →"
              busy={s.busy}
              disabled={s.busy}
              onAction={handleExportPdf}
            />
          </div>

          <div className="lg:col-span-1">
            <DeckRightRail
              steps={[
                "Select approved report versions and recipient-specific sections.",
                "Preview reconciliation to regional totals.",
                "Generate the protected executive pack and schedule if authorised.",
              ]}
              failure="A scope or recipient change invalidates queued exports and is evaluated again before delivery."
              permission="CFO receives relevant finance content; raw customer evidence requires a separate grant. No extra verticals are inferred. Pack identifies target, forecast and finance close versions plus open decisions."
            />
          </div>
        </div>
      )}

      {/* Drawer: Schedule Report */}
      <Panel open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Configure Automated Executive Delivery Schedule">
        <div className="space-y-4 p-4">
          <FormField label="Report Schedule Name">
            <Input value={scheduleName} onChange={(e) => setScheduleName(e.target.value)} placeholder="e.g. Monthly CEO/CFO Strategic Governance Pack" />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Cadence Period">
              <Select value={periodType} onChange={(e) => setPeriodType(e.target.value as any)}>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="half-yearly">Half-Yearly</option>
                <option value="annual">Annual</option>
              </Select>
            </FormField>
            <FormField label="Delivery Cadence Description">
              <Input value={cadence} onChange={(e) => setCadence(e.target.value)} placeholder="e.g. 1st business day, 08:00 IST" />
            </FormField>
          </div>

          <FormField label="Recipient Emails (comma-separated)">
            <Input value={recipientsText} onChange={(e) => setRecipientsText(e.target.value)} placeholder="ceo@finverse.demo, cfo@finverse.demo" />
          </FormField>

          <div className="pt-2 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <BusyButton busy={s.busy} onClick={handleCreateSchedule} className="bg-[#113F3D] text-white hover:bg-[#113F3D]/90">
              Register Schedule
            </BusyButton>
          </div>
        </div>
      </Panel>
    </div>
  );
}
