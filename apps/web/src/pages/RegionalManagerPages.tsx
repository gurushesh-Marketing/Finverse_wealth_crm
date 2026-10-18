import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useSession } from '../lib/session';
import { regionalApi } from '../lib/regional-api';
import { PageHeader, Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input, Textarea } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Panel, BusyButton } from '../components/ui/panel';
import { EmptyState, SkeletonRows, SuccessNote } from '../components/ui/states';
import type { RmPeriod } from '@finverse/contracts';

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

// ─── RM-01: Region Overview ───
export function RegionalOverviewPage() {
  const { session } = useSession();
  const [period, setPeriod] = useState<RmPeriod>('month-to-date');
  const loadOverview = useCallback(() => regionalApi.overview(period), [period]);
  const [data, load, { loading, initialLoading, error, clearError }] = useLoad(loadOverview);

  const [actionDrawerOpen, setActionDrawerOpen] = useState(false);
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [kind, setKind] = useState<'regional-intervention' | 'manager-coaching' | 'capacity-reallocation' | 'sla-recovery'>('regional-intervention');
  const s = useSubmitAction();

  const handleCreateAction = async () => {
    if (!selectedManagerId || !title.trim() || !dueAt) {
      s.setError('Please fill in the Manager, title, and due date.');
      return;
    }
    await s.run(async () => {
      await regionalApi.createAction({
        sourceAction: 'RM-01',
        kind,
        subjectManagerEmployeeId: selectedManagerId,
        ownerEmployeeId: session?.employeeId || 'EMP-008',
        title: title.trim(),
        detail: detail.trim() || undefined,
        dueAt: new Date(dueAt).toISOString(),
      });
      setActionDrawerOpen(false);
      setTitle('');
      setDetail('');
      setDueAt('');
      load();
    }, 'Regional intervention created successfully.');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Investigate regional gaps"
        subtitle={`RM-01 / REGION OVERVIEW · ${data?.region?.vertical === 'banking' ? 'Commercial Banking' : data?.region?.vertical === 'markets' ? 'Markets & Securities' : (data?.region?.vertical === 'real-estate' || data?.region?.vertical === 'real_estate') ? 'Real Estate Advisory' : 'Wealth'} · assigned permission scope`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={period} onChange={(e) => setPeriod(e.target.value as RmPeriod)} className="w-36 text-xs">
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
              + Regional intervention
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

      {initialLoading ? (
        <SkeletonRows rows={4} />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* WORK AREA Context Summary Card */}
            <Card className="border-border/60 bg-card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">WORK AREA</p>
              <p className="mt-1 font-heading text-lg font-bold text-foreground">Investigate regional gaps</p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-md border border-border/40 bg-muted/20 p-3 text-xs">
                <div>
                  <p className="text-muted-foreground text-[11px]">Region</p>
                  <p className="font-semibold text-foreground">{data?.region?.name || 'South'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px]">Vertical</p>
                  <p className="font-semibold text-foreground capitalize">{data?.region?.vertical || 'Wealth'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px]">Period</p>
                  <p className="font-semibold text-foreground">Month to date</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px]">Focus</p>
                  <p className="font-semibold text-foreground">Target gap</p>
                </div>
              </div>
            </Card>

            {/* In This View Highlight Card */}
            <Card className="border-border/60 bg-primary/5 p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">IN THIS VIEW</p>
                <p className="mt-1 text-base font-bold text-foreground">Uncovered queues &amp; capacity gaps</p>
                <p className="text-xs text-muted-foreground">Territory gaps within this regional manager's scope.</p>
              </div>
              <div className="text-3xl font-heading font-extrabold text-primary">
                {String(data?.backlog?.olderThan48h ?? 3).padStart(2, '0')}
              </div>
            </Card>

            {/* Executive Regional Summary Cards */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Card className="border-border/60 bg-card p-4">
                <p className="text-xs font-medium text-muted-foreground">Parent NM Target</p>
                <p className="mt-1 font-heading text-2xl font-bold text-foreground">
                  {data?.target?.parentTarget} <span className="text-xs font-normal text-muted-foreground">wins</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{data?.target?.periodLabel}</p>
              </Card>

              <Card className="border-border/60 bg-card p-4">
                <p className="text-xs font-medium text-muted-foreground">Achieved Wins</p>
                <p className="mt-1 font-heading text-2xl font-bold text-primary">
                  {data?.target?.achievedWins} <span className="text-xs font-normal text-muted-foreground">wins</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{data?.target?.attainmentPercent}% attainment</p>
              </Card>

              <Card className="border-border/60 bg-card p-4">
                <p className="text-xs font-medium text-muted-foreground">Regional Backlog (&gt;48h)</p>
                <p className="mt-1 font-heading text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {data?.backlog?.olderThan48h} <span className="text-xs font-normal text-muted-foreground">leads</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{data?.backlog?.olderThan7d} older than 7d</p>
              </Card>

              <Card className="border-border/60 bg-card p-4">
                <p className="text-xs font-medium text-muted-foreground">Open Escalations</p>
                <p className="mt-1 font-heading text-2xl font-bold text-destructive">
                  {data?.escalationsSummary?.openCount}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{data?.escalationsSummary?.highCriticalCount} high/critical</p>
              </Card>
            </div>

            {/* Manager Contribution Table */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-base font-semibold">Manager contributions &amp; ranking</CardTitle>
                  <p className="text-xs text-muted-foreground">Authorised managers in {data?.region?.name}</p>
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border/60 bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Manager</th>
                      <th className="px-4 py-2.5 font-medium">Assigned teams</th>
                      <th className="px-4 py-2.5 font-medium">Allocated target</th>
                      <th className="px-4 py-2.5 font-medium">Wins</th>
                      <th className="px-4 py-2.5 font-medium">Target pace</th>
                      <th className="px-4 py-2.5 font-medium">Open pipeline</th>
                      <th className="px-4 py-2.5 font-medium">Interventions</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {data?.managers?.map((m: any) => (
                      <tr key={m.managerId} className="hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium text-foreground">
                          <div>{m.name}</div>
                          <div className="text-[11px] text-muted-foreground">{m.email}</div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{m.teams?.join(', ')}</td>
                        <td className="px-4 py-3 font-medium">{m.allocatedTarget} wins</td>
                        <td className="px-4 py-3 font-semibold text-primary">{m.achievedWins}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                              <div className="h-full bg-primary" style={{ width: `${Math.min(m.targetPace, 100)}%` }} />
                            </div>
                            <span>{m.targetPace}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{m.openLeads} leads</td>
                        <td className="px-4 py-3">
                          {m.openInterventions > 0 ? (
                            <Badge tone="overdue">{m.openInterventions} open</Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={m.status === 'on-track' ? 'open' : m.status === 'at-risk' ? 'pending' : 'overdue'}>
                            {m.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* Regional Source Mix & Backlog Breakdown */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">Lead source quality &amp; intake</CardTitle>
                  <p className="text-xs text-muted-foreground">Regional cohort volume and conversion efficiency</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data?.sourceMix?.map((s: any) => (
                    <div key={s.source} className="flex items-center justify-between border-b border-border/40 pb-2 text-xs">
                      <div>
                        <p className="font-medium text-foreground">{s.source}</p>
                        <p className="text-[11px] text-muted-foreground">{s.totalLeads} total leads</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-primary">{s.conversionRate}% conversion</p>
                        <p className="text-[11px] text-muted-foreground">{s.convertedLeads} wins</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">Queue ageing &amp; capacity profile</CardTitle>
                  <p className="text-xs text-muted-foreground">SLA vulnerability across assigned regional branches</p>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-border/40 pb-2">
                    <span className="text-muted-foreground">New / Uncontacted Queue</span>
                    <span className="font-semibold text-foreground">{data?.backlog?.uncontacted} leads</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-border/40 pb-2">
                    <span className="text-muted-foreground">Active Follow-up Queue</span>
                    <span className="font-semibold text-foreground">{data?.backlog?.inFollowUp} leads</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-border/40 pb-2">
                    <span className="text-muted-foreground">Breaching 48h SLA</span>
                    <span className="font-semibold text-amber-600 dark:text-amber-400">{data?.backlog?.olderThan48h} leads</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Severe Ageing (&gt;7 days)</span>
                    <span className="font-semibold text-destructive">{data?.backlog?.olderThan7d} leads</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <DeckBottomBar
              onAction={() => setActionDrawerOpen(true)}
              actionLabel="Create intervention ->"
            />
          </div>

          <div className="space-y-6">
            <DeckRightRail
              steps={[
                'Inspect Manager contributions and regional exceptions.',
                'Select a metric to drill through Managers, TLs and permitted evidence.',
                'Create an intervention while staying in the RM workspace.',
              ]}
              failure="Historical restructuring is shown by dated segments, not rewritten to match the current organisation."
              permission="Geographic scope never grants other vertical data. Scope is vertical plus assigned organisation."
            />
          </div>
        </div>
      )}

      {/* Regional Management Intervention Drawer */}
      <Panel
        open={actionDrawerOpen}
        onClose={() => setActionDrawerOpen(false)}
        title="Create Regional Intervention"
      >
        <div className="space-y-4 text-xs">
          {s.error ? <p className="text-destructive">{s.error}</p> : null}
          <FormField label="Accountable Manager">
            <Select value={selectedManagerId} onChange={(e) => setSelectedManagerId(e.target.value)}>
              <option value="">Select manager...</option>
              {data?.managers?.map((m: any) => (
                <option key={m.managerId} value={m.managerId}>{m.name} ({m.teams?.join(', ')})</option>
              ))}
            </Select>
          </FormField>

          <FormField label="Intervention Type">
            <Select value={kind} onChange={(e) => setKind(e.target.value as any)}>
              <option value="regional-intervention">Regional target intervention</option>
              <option value="manager-coaching">Manager coaching &amp; governance</option>
              <option value="capacity-reallocation">Capacity &amp; backlog reallocation</option>
              <option value="sla-recovery">SLA recovery plan</option>
            </Select>
          </FormField>

          <FormField label="Intervention Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Rebalance intake to address 48h backlog" />
          </FormField>

          <FormField label="Specific Instructions / Operational Plan">
            <Textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={3} placeholder="Document agreed recovery actions, headcount adjustment or milestones..." />
          </FormField>

          <FormField label="Target Completion Deadline">
            <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setActionDrawerOpen(false)}>Cancel</Button>
            <BusyButton size="sm" busy={s.busy} onClick={handleCreateAction}>Commit intervention</BusyButton>
          </div>
        </div>
      </Panel>
    </div>
  );
}

// ─── RM-02: Review a Manager scorecard ───
export function RegionalManagersPage() {
  const loadOverview = useCallback(() => regionalApi.overview(), []);
  const [overview] = useLoad<any>(loadOverview);

  const [selectedManagerId, setSelectedManagerId] = useState<string>('EMP-007');
  const loadScorecard = useCallback(() => regionalApi.getManagerScorecard(selectedManagerId), [selectedManagerId]);
  const [scorecard, reloadScorecard, { loading, initialLoading, error, clearError }] = useLoad<any>(loadScorecard);

  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [periodLabel, setPeriodLabel] = useState('Q3 2026');
  const [rating, setRating] = useState<'exceeding' | 'achieving' | 'needs_improvement' | 'critical'>('achieving');
  const [strengths, setStrengths] = useState('');
  const [blockers, setBlockers] = useState('');
  const [commitmentText, setCommitmentText] = useState('');
  const [supportActions, setSupportActions] = useState('');
  const [privateNotes, setPrivateNotes] = useState('');
  const [nextDate, setNextDate] = useState('2026-10-31');
  const [acknowledged, setAcknowledged] = useState(true);
  const s = useSubmitAction();

  const handleSaveReview = async () => {
    if (!strengths.trim() || !blockers.trim() || !commitmentText.trim()) {
      s.setError('Strengths, blockers, and at least one commitment are required.');
      return;
    }
    await s.run(async () => {
      await regionalApi.saveReview({
        managerEmployeeId: selectedManagerId,
        periodLabel,
        performanceRating: rating,
        strengths: strengths.trim(),
        blockers: blockers.trim(),
        improvementCommitments: commitmentText.split('\n').filter((c) => c.trim().length > 0),
        supportActions: supportActions.trim() || undefined,
        privateRmNotes: privateNotes.trim() || undefined,
        nextReviewDate: nextDate,
        acknowledged,
      });
      setReviewModalOpen(false);
      setStrengths('');
      setBlockers('');
      setCommitmentText('');
      reloadScorecard();
    }, 'Manager performance review recorded successfully.');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Review a Manager scorecard"
        subtitle="RM-02 / MANAGERS · Wealth · assigned permission scope · illustrative records"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={reloadScorecard} disabled={loading}>
              {loading && scorecard ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Button size="sm" onClick={() => setReviewModalOpen(true)}>
              + Run Manager Review (RM-09)
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
          <span>Failed to load scorecard: {error}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={reloadScorecard}>Retry</Button>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={clearError}>Dismiss</Button>
          </div>
        </div>
      ) : null}

      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}

      {/* Manager Selector Tabs */}
      <div className="flex gap-2 border-b border-border/60 pb-2">
        {overview?.managers?.map((m: any) => (
          <Button
            key={m.managerId}
            variant={selectedManagerId === m.managerId ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedManagerId(m.managerId)}
          >
            {m.name}
          </Button>
        ))}
      </div>

      {initialLoading ? (
        <SkeletonRows rows={4} />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* WORK AREA Header Banner */}
            <Card className="border-border/60 bg-card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">WORK AREA</p>
              <p className="mt-1 font-heading text-lg font-bold text-foreground">Review a Manager scorecard</p>
              <div className="mt-3 flex items-center justify-between rounded-md border border-border/40 bg-muted/20 p-3 text-xs">
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase">ASSIGNED PROSPECT / FV-1042</p>
                  <p className="font-heading text-base font-bold text-foreground">Aarav Shah</p>
                  <p className="text-muted-foreground">Website enquiry · Investment advisory · owner Asha Rao</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="h-7 text-xs">Call</Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs">WhatsApp</Button>
                </div>
              </div>
            </Card>

            {/* Customer Context & Recent History Cards */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Card className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">CUSTOMER CONTEXT</p>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between border-b border-border/40 pb-1.5">
                    <span className="text-muted-foreground">Manager</span>
                    <span className="font-semibold text-foreground">{scorecard?.manager?.name || 'Neel Verma'}</span>
                  </div>
                  <div className="flex justify-between border-b border-border/40 pb-1.5">
                    <span className="text-muted-foreground">Period</span>
                    <span className="text-foreground">September</span>
                  </div>
                  <div className="flex justify-between border-b border-border/40 pb-1.5">
                    <span className="text-muted-foreground">Scope</span>
                    <span className="text-foreground">Assigned hierarchy</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Evidence</span>
                    <span className="text-foreground">Forecast, capacity and reviews</span>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">RECENT HISTORY</p>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span>Today 09:42 · Assignment confirmed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    <span>Yesterday 16:10 · Follow-up committed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-muted-foreground" />
                    <span>21 Sep 10:30 · Enquiry received</span>
                  </div>
                </div>
              </Card>
            </div>

            {/* Scorecard Metric Cards */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Card className="border-border/60 bg-card p-4">
                <p className="text-xs text-muted-foreground">Target Wins</p>
                <p className="mt-1 font-heading text-2xl font-bold">{scorecard?.performance?.targetWins}</p>
                <p className="mt-1 text-xs text-muted-foreground">Parent allocated</p>
              </Card>

              <Card className="border-border/60 bg-card p-4">
                <p className="text-xs text-muted-foreground">Achieved Wins</p>
                <p className="mt-1 font-heading text-2xl font-bold text-primary">{scorecard?.performance?.achievedWins}</p>
                <p className="mt-1 text-xs text-muted-foreground">{scorecard?.performance?.attainmentRate}% attainment</p>
              </Card>

              <Card className="border-border/60 bg-card p-4">
                <p className="text-xs text-muted-foreground">Open Pipeline</p>
                <p className="mt-1 font-heading text-2xl font-bold">{scorecard?.performance?.openPipeline}</p>
                <p className="mt-1 text-xs text-muted-foreground">Across assigned teams</p>
              </Card>

              <Card className="border-border/60 bg-card p-4">
                <p className="text-xs text-muted-foreground">Operational Health</p>
                <p className="mt-1 font-heading text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {scorecard?.performance?.operationalHealthScore} / 100
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Cadence &amp; SLA compliance</p>
              </Card>
            </div>

            {/* Supervised Team Leads & Active Forecast */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">Supervised Team Leads</CardTitle>
                  <p className="text-xs text-muted-foreground">Frontline managers under {scorecard?.manager?.name}</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {scorecard?.teamLeads?.map((tl: any, idx: number) => (
                    <div key={`${tl.id}-${tl.team_name || idx}`} className="flex items-center justify-between border-b border-border/40 pb-2 text-xs">
                      <div>
                        <p className="font-medium text-foreground">{tl.display_name}</p>
                        <p className="text-[11px] text-muted-foreground">{tl.email}</p>
                      </div>
                      <Badge tone="default">{tl.team_name}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">Latest Submitted Forecast</CardTitle>
                  <p className="text-xs text-muted-foreground">Forecast submission rollup to Regional Manager</p>
                </CardHeader>
                <CardContent className="text-xs">
                  {scorecard?.latestForecast ? (
                    <div className="space-y-2">
                      <div className="flex justify-between border-b border-border/40 pb-1">
                        <span className="text-muted-foreground">Period:</span>
                        <span className="font-semibold">{scorecard.latestForecast.period_label}</span>
                      </div>
                      <div className="flex justify-between border-b border-border/40 pb-1">
                        <span className="text-muted-foreground">Bottom-up TL Revenue:</span>
                        <span>INR {Number(scorecard.latestForecast.bottom_up_revenue).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between border-b border-border/40 pb-1">
                        <span className="text-muted-foreground">Management Adjustment:</span>
                        <span>INR {Number(scorecard.latestForecast.management_adjustment).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between font-semibold text-primary pt-1">
                        <span>Adjusted Forecast:</span>
                        <span>INR {Number(scorecard.latestForecast.adjusted_revenue).toLocaleString('en-IN')}</span>
                      </div>
                      <Badge tone="open" className="mt-2">{scorecard.latestForecast.status}</Badge>
                    </div>
                  ) : (
                    <EmptyState title="No forecast submitted" message="Manager has not submitted a formal forecast for this period." />
                  )}
                </CardContent>
              </Card>
            </div>

            <DeckBottomBar
              onAction={() => setReviewModalOpen(true)}
              actionLabel="Open next task ->"
            />
          </div>

          <div className="space-y-6">
            <DeckRightRail
              steps={[
                'Open an authorised Manager.',
                'Inspect contribution, forecast accuracy and unresolved actions.',
                'Assign a management action or schedule a review.',
              ]}
              failure="Transferred Managers expose only approved history for the period of the RM relationship."
              permission="Only permitted fields and descendants are available; there is no Manager-dashboard impersonation."
            />
          </div>
        </div>
      )}

      {/* Review Dialog */}
      <Panel
        open={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        title="Conduct Manager Review (RM-09)"
      >
        <div className="space-y-4 text-xs">
          {s.error ? <p className="text-destructive">{s.error}</p> : null}
          <FormField label="Review Period">
            <Input value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} placeholder="e.g. Q3 2026" />
          </FormField>

          <FormField label="Performance Rating">
            <Select value={rating} onChange={(e) => setRating(e.target.value as any)}>
              <option value="exceeding">Exceeding plan</option>
              <option value="achieving">Achieving target</option>
              <option value="needs_improvement">Needs improvement</option>
              <option value="critical">Critical intervention required</option>
            </Select>
          </FormField>

          <FormField label="Demonstrated Strengths">
            <Textarea value={strengths} onChange={(e) => setStrengths(e.target.value)} rows={2} placeholder="Team leadership, coaching adherence, pipeline acceleration..." />
          </FormField>

          <FormField label="Operational Blockers">
            <Textarea value={blockers} onChange={(e) => setBlockers(e.target.value)} rows={2} placeholder="Source intake quality, caller capacity constraints, commercial exceptions..." />
          </FormField>

          <FormField label="Improvement Commitments (One per line)">
            <Textarea value={commitmentText} onChange={(e) => setCommitmentText(e.target.value)} rows={3} placeholder="Reduce 48h backlog to < 10%&#10;Complete all TL coaching sessions&#10;Attain 90% forecast accuracy" />
          </FormField>

          <FormField label="Support / Resource Commitments">
            <Input value={supportActions} onChange={(e) => setSupportActions(e.target.value)} placeholder="Provide 2 additional associates, approve fee waiver policy..." />
          </FormField>

          <FormField label="Private Regional Notes (RM Only)">
            <Textarea value={privateNotes} onChange={(e) => setPrivateNotes(e.target.value)} rows={2} placeholder="Confidential succession / organizational notes..." />
          </FormField>

          <FormField label="Next Review Date">
            <Input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
          </FormField>

          <div className="flex items-center gap-2 pt-1">
            <input type="checkbox" id="ack" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} className="rounded border-border" />
            <label htmlFor="ack">Manager acknowledged review outcomes</label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setReviewModalOpen(false)}>Cancel</Button>
            <BusyButton size="sm" busy={s.busy} onClick={handleSaveReview}>Commit review</BusyButton>
          </div>
        </div>
      </Panel>
    </div>
  );
}

// ─── RM-03: Plan territory coverage ───
export function RegionalTerritoriesPage() {
  const loadTerritories = useCallback(() => regionalApi.getTerritories(), []);
  const [data, load, { loading, initialLoading, error, clearError }] = useLoad<any>(loadTerritories);

  const [planDrawerOpen, setPlanDrawerOpen] = useState(false);
  const [territoryName, setTerritoryName] = useState('South Metro Zone');
  const [subRegion, setSubRegion] = useState('Karnataka South Hub');
  const [productScope, setProductScope] = useState('V1 Wealth Portfolio');
  const [selectedTeams] = useState<string[]>(['TEAM-WEALTH-ALPHA']);
  const [capacityGap, setCapacityGap] = useState(2);
  const [proposal, setProposal] = useState('');
  const [activationDate, setActivationDate] = useState('2026-10-15');
  const s = useSubmitAction();

  const handleSavePlan = async () => {
    if (!territoryName.trim() || !proposal.trim()) {
      s.setError('Territory name and proposal details are required.');
      return;
    }
    await s.run(async () => {
      await regionalApi.saveTerritoryPlan({
        territoryName: territoryName.trim(),
        subRegion: subRegion.trim(),
        productScope: productScope.trim(),
        languageQueues: ['English', 'Kannada', 'Tamil'],
        targetTeamIds: selectedTeams,
        capacityGap,
        routingProposal: proposal.trim(),
        activationDate,
        status: 'submitted_for_activation',
      });
      setPlanDrawerOpen(false);
      setProposal('');
      load();
    }, 'Territory coverage proposal submitted for activation.');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plan territory coverage"
        subtitle="RM-03 / TERRITORIES · Wealth · assigned permission scope · illustrative records"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={load} disabled={loading}>
              {loading && data ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Button size="sm" onClick={() => setPlanDrawerOpen(true)}>
              + Propose coverage plan (RM-03)
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
          <span>Failed to load territory plans: {error}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={load}>Retry</Button>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={clearError}>Dismiss</Button>
          </div>
        </div>
      ) : null}

      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}

      {initialLoading ? (
        <SkeletonRows rows={4} />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* WORK AREA Header Banner */}
            <Card className="border-border/60 bg-card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">WORK AREA</p>
              <p className="mt-1 font-heading text-lg font-bold text-foreground">Plan territory coverage</p>
            </Card>

            {/* Deck P165 Twin Cards: WORK TO ASSIGN vs AVAILABLE OWNERS */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Card className="p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">WORK TO ASSIGN</p>
                <p className="mt-1 font-heading text-base font-bold text-foreground">South sub-region</p>
                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex justify-between border-b border-border/40 pb-1.5">
                    <span className="text-muted-foreground">Products</span>
                    <span className="font-medium text-foreground">Wealth eligible products</span>
                  </div>
                  <div className="flex justify-between border-b border-border/40 pb-1.5">
                    <span className="text-muted-foreground">Queues</span>
                    <span className="font-medium text-foreground">Language and locality</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Coverage</span>
                    <span className="font-medium text-amber-600 dark:text-amber-400">Capacity gaps</span>
                  </div>
                </div>
                <div className="mt-4 rounded border border-border/60 bg-muted/20 p-2.5 text-[11px] text-muted-foreground">
                  🛡 Candidate list is limited to the granted team and vertical.
                </div>
              </Card>

              <Card className="p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">AVAILABLE OWNERS</p>
                <p className="mt-1 font-heading text-base font-bold text-foreground">Compare capacity before assigning</p>
                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between rounded border border-border/40 p-2">
                    <div>
                      <p className="font-medium text-foreground">Asha Rao</p>
                      <p className="text-[11px] text-muted-foreground">12 active · 4 due today</p>
                    </div>
                    <Badge tone="open">Available</Badge>
                  </div>
                  <div className="flex items-center justify-between rounded border border-border/40 p-2">
                    <div>
                      <p className="font-medium text-foreground">Dev Mehta</p>
                      <p className="text-[11px] text-muted-foreground">09 active · 2 due today</p>
                    </div>
                    <Badge tone="open">Available</Badge>
                  </div>
                  <div className="flex items-center justify-between rounded border border-border/40 p-2">
                    <div>
                      <p className="font-medium text-foreground">Riya Jain</p>
                      <p className="text-[11px] text-muted-foreground">16 active · 7 due today</p>
                    </div>
                    <Badge tone="overdue">At capacity</Badge>
                  </div>
                </div>
              </Card>
            </div>

            {/* Current Branch Coverage Table */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Active Team Coverage &amp; Intake Ratios</CardTitle>
                <p className="text-xs text-muted-foreground">Load distribution across authorized Wealth teams</p>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border/60 bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Team</th>
                      <th className="px-4 py-2.5 font-medium">Total leads</th>
                      <th className="px-4 py-2.5 font-medium">Pending intake</th>
                      <th className="px-4 py-2.5 font-medium">Active callers</th>
                      <th className="px-4 py-2.5 font-medium">Coverage ratio (Leads/Caller)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {data?.teamStats?.map((t: any) => (
                      <tr key={t.teamId} className="hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium text-foreground">{t.teamName}</td>
                        <td className="px-4 py-3">{t.totalLeads}</td>
                        <td className="px-4 py-3 font-semibold text-amber-600 dark:text-amber-400">{t.pendingIntake}</td>
                        <td className="px-4 py-3">{t.callerCount} callers</td>
                        <td className="px-4 py-3">
                          <Badge tone={Number(t.coverageRatio) > 20 ? 'overdue' : 'default'}>
                            {t.coverageRatio}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* Submitted Territory Plans */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Territory Proposals &amp; Version History</CardTitle>
                <p className="text-xs text-muted-foreground">Dated routing plans awaiting activation</p>
              </CardHeader>
              <CardContent>
                {!data?.plans || data.plans.length === 0 ? (
                  <EmptyState title="No territory plans" message="Propose a new coverage plan using the button above." />
                ) : (
                  <div className="space-y-4">
                    {data.plans.map((p: any) => (
                      <div key={p.id} className="rounded-md border border-border/60 p-4 text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm">{p.territory_name} (v{p.version})</span>
                          <Badge tone={p.status === 'activated' ? 'open' : 'pending'}>{p.status}</Badge>
                        </div>
                        <p><span className="font-medium">Sub-region:</span> {p.sub_region} | <span className="font-medium">Scope:</span> {p.product_scope}</p>
                        <p><span className="font-medium">Routing Proposal:</span> {p.routing_proposal}</p>
                        <div className="flex gap-4 text-muted-foreground pt-1">
                          <span>Capacity gap: {p.capacity_gap} associates</span>
                          <span>Activation date: {new Date(p.activation_date).toLocaleDateString('en-IN')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <DeckBottomBar
              onAction={() => setPlanDrawerOpen(true)}
              actionLabel="Continue ->"
            />
          </div>

          <div className="space-y-6">
            <DeckRightRail
              steps={[
                'Inspect lead demand against current authorised coverage.',
                'Propose queue-to-team coverage changes.',
                'Submit the dated configuration change for approved activation.',
              ]}
              failure="No eligible destination keeps the queue visible and assigned to an accountable supervisor."
              permission="Coverage changes cannot directly grant employees another vertical. Validate eligible skills and geography."
            />
          </div>
        </div>
      )}

      {/* Plan Drawer */}
      <Panel
        open={planDrawerOpen}
        onClose={() => setPlanDrawerOpen(false)}
        title="Propose Territory Coverage Plan"
      >
        <div className="space-y-4 text-xs">
          {s.error ? <p className="text-destructive">{s.error}</p> : null}
          <FormField label="Territory Name">
            <Input value={territoryName} onChange={(e) => setTerritoryName(e.target.value)} />
          </FormField>

          <FormField label="Sub-Region">
            <Select value={subRegion} onChange={(e) => setSubRegion(e.target.value)}>
              {data?.subRegions?.map((sr: string) => <option key={sr} value={sr}>{sr}</option>)}
            </Select>
          </FormField>

          <FormField label="Product Scope">
            <Input value={productScope} onChange={(e) => setProductScope(e.target.value)} />
          </FormField>

          <FormField label="Estimated Associate Capacity Gap">
            <Input type="number" min={0} value={capacityGap} onChange={(e) => setCapacityGap(Number(e.target.value))} />
          </FormField>

          <FormField label="Routing Proposal Details">
            <Textarea value={proposal} onChange={(e) => setProposal(e.target.value)} rows={3} placeholder="Route Kannada/Tamil prospects directly to Team Alpha senior callers..." />
          </FormField>

          <FormField label="Activation Date">
            <Input type="date" value={activationDate} onChange={(e) => setActivationDate(e.target.value)} />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setPlanDrawerOpen(false)}>Cancel</Button>
            <BusyButton size="sm" busy={s.busy} onClick={handleSavePlan}>Submit proposal</BusyButton>
          </div>
        </div>
      </Panel>
    </div>
  );
}

// ─── RM-04: Allocate regional targets to Managers ───
export function RegionalTargetsPage() {
  const loadTargets = useCallback(() => regionalApi.getTargets(), []);
  const [data, load, { loading, initialLoading, error, clearError }] = useLoad<any>(loadTargets);

  const [parentTarget, setParentTarget] = useState<number>(250);
  const [periodLabel, setPeriodLabel] = useState<string>('October');
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const s = useSubmitAction();

  useEffect(() => {
    if (data?.activeTarget) {
      setParentTarget(data.activeTarget.approvedNmTarget || 250);
      setPeriodLabel(data.activeTarget.periodLabel || 'October');
    }
    if (data?.managers) {
      const initial: Record<string, number> = {};
      data.managers.forEach((m: any) => {
        initial[m.managerId] = m.targetWins || 100;
      });
      setAllocations(initial);
    }
  }, [data]);

  const totalAllocated = Object.values(allocations).reduce((sum, val) => sum + (val || 0), 0);
  const remainder = parentTarget - totalAllocated;

  const handleAllocate = async (publish: boolean) => {
    if (remainder < 0) {
      s.setError('Total allocations cannot exceed the parent NM target.');
      return;
    }
    await s.run(async () => {
      const managerAllocations = data.managers.map((m: any) => ({
        managerEmployeeId: m.managerId,
        managerName: m.managerName,
        targetWins: allocations[m.managerId] || 0,
      }));
      await regionalApi.allocateTargets({
        periodLabel,
        approvedNmTarget: parentTarget,
        managerAllocations,
        publish,
      });
      load();
    }, publish ? 'Targets successfully published to Managers.' : 'Draft target allocation saved.');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Allocate regional targets to Managers"
        subtitle="RM-04 / REGIONAL TARGETS · Wealth · assigned permission scope · illustrative records"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={load} disabled={loading}>
              {loading && data ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleAllocate(false)}>Save draft</Button>
            <BusyButton size="sm" busy={s.busy} onClick={() => handleAllocate(true)}>Publish authorized allocation</BusyButton>
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
          <span>Failed to load targets: {error}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={load}>Retry</Button>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={clearError}>Dismiss</Button>
          </div>
        </div>
      ) : null}

      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}
      {s.error ? <p className="text-xs text-destructive">{s.error}</p> : null}

      {initialLoading ? (
        <SkeletonRows rows={4} />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* WORK AREA Header */}
            <Card className="border-border/60 bg-card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">CAPTURE</p>
              <p className="mt-1 font-heading text-lg font-bold text-foreground">Allocate regional targets to Managers</p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-md border border-border/40 bg-muted/20 p-3 text-xs">
                <div>
                  <p className="text-muted-foreground text-[11px]">Parent target</p>
                  <p className="font-semibold text-foreground">Approved regional plan</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px]">Period</p>
                  <p className="font-semibold text-foreground">{periodLabel}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px]">Manager split</p>
                  <p className="font-semibold text-foreground">Proposed</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[11px]">Remainder</p>
                  <p className="font-semibold text-foreground">{remainder} wins</p>
                </div>
              </div>
            </Card>

            {/* Target Bridge Header Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Card className="border-border/60 bg-card p-4">
                <p className="text-xs text-muted-foreground">Approved NM Target</p>
                <p className="mt-1 font-heading text-2xl font-bold text-foreground">{parentTarget} wins</p>
                <p className="mt-1 text-xs text-muted-foreground">{periodLabel} Plan</p>
              </Card>

              <Card className="border-border/60 bg-card p-4">
                <p className="text-xs text-muted-foreground">Allocated Across Managers</p>
                <p className="mt-1 font-heading text-2xl font-bold text-primary">{totalAllocated} wins</p>
                <p className="mt-1 text-xs text-muted-foreground">{data?.managers?.length} branch managers</p>
              </Card>

              <Card className="border-border/60 bg-card p-4">
                <p className="text-xs text-muted-foreground">Unallocated Remainder (Reconciliation)</p>
                <p className={`mt-1 font-heading text-2xl font-bold ${remainder < 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {remainder} wins
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {remainder === 0 ? 'Fully allocated' : remainder > 0 ? 'Visible reserve' : 'OVER-ALLOCATED'}
                </p>
              </Card>
            </div>

            {/* Allocation Matrix Table */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Manager Allocation Breakdown</CardTitle>
                <p className="text-xs text-muted-foreground">Allocations cascade directly to manager_targets upon publishing</p>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border/60 bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Manager</th>
                      <th className="px-4 py-2.5 font-medium">Target wins (Allocation)</th>
                      <th className="px-4 py-2.5 font-medium">Share of target</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {data?.managers?.map((m: any) => {
                      const currentVal = allocations[m.managerId] ?? m.targetWins ?? 0;
                      const share = parentTarget > 0 ? Math.round((currentVal / parentTarget) * 100) : 0;
                      return (
                        <tr key={m.managerId} className="hover:bg-muted/20">
                          <td className="px-4 py-3 font-medium text-foreground">{m.managerName}</td>
                          <td className="px-4 py-3">
                            <Input
                              type="number"
                              min={0}
                              className="w-28"
                              value={currentVal}
                              onChange={(e) => {
                                const val = Math.max(0, parseInt(e.target.value) || 0);
                                setAllocations((prev) => ({ ...prev, [m.managerId]: val }));
                              }}
                            />
                          </td>
                          <td className="px-4 py-3 font-semibold text-primary">{share}%</td>
                          <td className="px-4 py-3">
                            <Badge tone={m.status === 'published' ? 'open' : 'pending'}>{m.status}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <DeckBottomBar
              onAction={() => handleAllocate(true)}
              actionLabel="Continue ->"
            />
          </div>

          <div className="space-y-6">
            <DeckRightRail
              steps={[
                'Open the regional target approved by NM.',
                'Allocate by Manager and validate totals.',
                'Publish authorised allocation or request a change from NM.',
              ]}
              failure="A mid-period restructure requires approved prorating and preserves earlier assignments."
              permission="Metric and financial basis must match parent targets. Historic locked allocations are versioned."
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── RM-05 & RM-06: Capacity & Approvals ───
export function RegionalApprovalsPage() {
  const [tab, setTab] = useState<'transfers' | 'staffing'>('transfers');
  const loadTransfers = useCallback(() => regionalApi.listTransfers(), []);
  const [transfers, reloadTransfers, transfersState] = useLoad<any[]>(loadTransfers);

  const loadStaffing = useCallback(() => regionalApi.getStaffing(), []);
  const [staffing, reloadStaffing, staffingState] = useLoad<any>(loadStaffing);

  const [staffingModalOpen, setStaffingModalOpen] = useState(false);
  const [plannedHeadcount, setPlannedHeadcount] = useState(12);
  const [approvedHeadcount, setApprovedHeadcount] = useState(10);
  const [activeHeadcount] = useState(8);
  const [justification, setJustification] = useState('');
  const [decisionType, setDecisionType] = useState<'approve' | 'return' | 'reject'>('approve');
  const [decisionNote, setDecisionNote] = useState('');
  const s = useSubmitAction();

  const handleDecideTransfer = async (transferId: string, decision: 'approved' | 'rejected') => {
    const resolutionNotes = prompt(`Enter resolution justification for ${decision.toUpperCase()}:`) || 'Decision approved by Regional Manager.';
    await s.run(async () => {
      await regionalApi.decideTransfer({ transferId, decision, resolutionNotes });
      reloadTransfers();
    }, `Transfer request marked as ${decision}.`);
  };

  const handleSaveStaffing = async () => {
    if (!justification.trim()) {
      s.setError('Business justification is required for the staffing plan.');
      return;
    }
    await s.run(async () => {
      await regionalApi.saveStaffingPlan({
        periodLabel: 'October',
        plannedHeadcount,
        approvedHeadcount,
        activeHeadcount,
        requisitions: [
          { title: 'Senior Wealth Sales Associate', teamId: 'TEAM-WEALTH-ALPHA', count: 2, justification: 'Queue growth', priority: 'high' },
        ],
        businessJustification: justification.trim(),
        status: 'approved_by_rm',
      });
      setStaffingModalOpen(false);
      reloadStaffing();
    }, 'Regional staffing plan approved and submitted to HR.');
  };

  const handleDirectStaffingDecision = async () => {
    const status = decisionType === 'approve' ? 'approved_by_rm' : 'draft';
    const note = decisionNote.trim() || 'Queue ageing on South Wealth portfolios reviewed. Staffing envelope confirmed.';
    await s.run(async () => {
      await regionalApi.saveStaffingPlan({
        periodLabel: 'October',
        plannedHeadcount: staffing?.activePlan?.planned_headcount || plannedHeadcount,
        approvedHeadcount: staffing?.activePlan?.approved_headcount || approvedHeadcount,
        activeHeadcount: staffing?.activePlan?.active_headcount || activeHeadcount,
        requisitions: [
          { title: 'Senior Wealth Sales Associate', teamId: 'TEAM-WEALTH-ALPHA', count: 2, justification: 'Queue growth', priority: 'high' },
        ],
        businessJustification: note,
        status,
      });
      reloadStaffing();
    }, `Regional staffing plan ${decisionType === 'approve' ? 'approved within authority and submitted to HR' : decisionType === 'return' ? 'returned for correction' : 'rejected'}.`);
  };

  const activeLoading = tab === 'transfers' ? transfersState.loading : staffingState.loading;
  const activeInitialLoading = tab === 'transfers' ? transfersState.initialLoading : staffingState.initialLoading;
  const activeError = tab === 'transfers' ? transfersState.error : staffingState.error;
  const handleRefresh = tab === 'transfers' ? reloadTransfers : reloadStaffing;

  return (
    <div className="space-y-6">
      <PageHeader
        title={tab === 'transfers' ? 'Approve a cross-Manager transfer' : 'Approve a regional staffing plan'}
        subtitle={tab === 'transfers' ? 'RM-05 / CAPACITY & APPROVALS · Wealth · assigned permission scope · illustrative records' : 'RM-06 / CAPACITY & APPROVALS · Wealth · assigned permission scope · illustrative records'}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={handleRefresh} disabled={activeLoading}>
              {activeLoading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Button variant={tab === 'transfers' ? 'default' : 'outline'} size="sm" onClick={() => setTab('transfers')}>
              Cross-Manager Transfers (RM-05)
            </Button>
            <Button variant={tab === 'staffing' ? 'default' : 'outline'} size="sm" onClick={() => setTab('staffing')}>
              Staffing Requisitions (RM-06)
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

      {activeError ? (
        <div role="alert" className="flex items-center justify-between rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <span>Failed to load data: {activeError}</span>
          <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={handleRefresh}>Retry</Button>
        </div>
      ) : null}

      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}

      {activeInitialLoading ? (
        <SkeletonRows rows={4} />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {tab === 'transfers' ? (
              <div className="space-y-6">
                {/* WORK AREA Header */}
                <Card className="border-border/60 bg-card p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">WORK AREA</p>
                  <p className="mt-1 font-heading text-lg font-bold text-foreground">Approve a cross-Manager transfer</p>
                </Card>

                {/* Deck P169 Submitted Evidence vs Authority */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold">Cross-Manager Transfer Queue (RM-05)</CardTitle>
                    <p className="text-xs text-muted-foreground">Requests to transfer leads between different branch managers</p>
                  </CardHeader>
                  <CardContent>
                    {!transfers || transfers.length === 0 ? (
                      <EmptyState title="No pending transfers" message="No cross-manager lead transfers awaiting regional approval." />
                    ) : (
                      <div className="space-y-4">
                        {transfers.map((t: any) => {
                          const leadIds = typeof t.lead_ids === 'string' ? JSON.parse(t.lead_ids) : t.lead_ids;
                          return (
                            <div key={t.id} className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-md border border-border/60 p-4 text-xs">
                              {/* Left: Submitted Evidence */}
                              <div className="space-y-2 border-b md:border-b-0 md:border-r border-border/40 pb-3 md:pb-0 md:pr-4">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">SUBMITTED EVIDENCE</p>
                                <p className="font-heading text-sm font-bold text-foreground">Decision request</p>
                                <div className="space-y-1.5 pt-1">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Source Manager:</span>
                                    <span className="font-semibold">{t.source_manager_name}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Destination Manager:</span>
                                    <span className="font-semibold">{t.destination_manager_name}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Selected work:</span>
                                    <span>{leadIds?.length} open opportunities</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Reason:</span>
                                    <span>{t.reason}</span>
                                  </div>
                                </div>
                                <div className="mt-2 rounded bg-muted/20 p-2 text-[11px] text-muted-foreground">
                                  Original request and previous decisions remain in the audit trail.
                                </div>
                              </div>

                              {/* Right: Your Authority */}
                              <div className="space-y-2 md:pl-2">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">YOUR AUTHORITY</p>
                                <p className="font-heading text-sm font-bold text-foreground">Independent decision</p>
                                <div className="space-y-2 pt-1">
                                  <Badge tone={t.status === 'approved' ? 'open' : t.status === 'pending' ? 'pending' : 'overdue'}>
                                    Status: {t.status}
                                  </Badge>
                                  {t.status === 'pending' ? (
                                    <div className="flex gap-2 pt-2">
                                      <Button variant="outline" size="sm" onClick={() => handleDecideTransfer(t.id, 'rejected')}>
                                        Reject with reason
                                      </Button>
                                      <BusyButton size="sm" onClick={() => handleDecideTransfer(t.id, 'approved')}>
                                        ✓ Approve within authority
                                      </BusyButton>
                                    </div>
                                  ) : (
                                    <p className="text-muted-foreground pt-1">Decision finalized in audit trail.</p>
                                  )}
                                </div>
                                <p className="text-[10px] text-muted-foreground pt-2">
                                  Self-approval is blocked. A decision cannot exceed the current scope.
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <DeckBottomBar
                  actionLabel="Continue ->"
                />
              </div>
            ) : (
              <div className="space-y-6">
                {/* WORK AREA Header */}
                <Card className="border-border/60 bg-card p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">WORK AREA</p>
                  <p className="mt-1 font-heading text-lg font-bold text-foreground">Approve a regional staffing plan</p>
                </Card>

                {/* Deck P171 Twin Cards: SUBMITTED EVIDENCE vs YOUR AUTHORITY */}
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {/* Left: Submitted Evidence */}
                  <Card className="flex flex-col justify-between p-4 border-border/60">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">SUBMITTED EVIDENCE</p>
                      <p className="mt-1 font-heading text-base font-bold text-foreground">Decision request</p>
                      <div className="mt-4 space-y-3 text-xs">
                        <div className="flex justify-between border-b border-border/40 pb-2">
                          <span className="text-muted-foreground">Plan</span>
                          <span className="font-semibold text-foreground">
                            {staffing?.activePlan?.period_label ? `${staffing.activePlan.period_label} staffing` : 'South October staffing'}
                          </span>
                        </div>
                        <div className="flex justify-between border-b border-border/40 pb-2">
                          <span className="text-muted-foreground">Need</span>
                          <span className="text-foreground">Eligible callers by product</span>
                        </div>
                        <div className="flex justify-between border-b border-border/40 pb-2">
                          <span className="text-muted-foreground">Business evidence</span>
                          <span className="text-foreground">Queue ageing</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Decision</span>
                          <span className="font-semibold text-primary">Approve recommendation</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 rounded border border-border/40 bg-muted/30 p-2.5 text-[11px] text-muted-foreground">
                      <span className="mr-1">📄</span> Original request and previous decisions remain in the audit trail.
                    </div>
                  </Card>

                  {/* Right: Your Authority */}
                  <Card className="flex flex-col justify-between p-4 border-border/60">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">YOUR AUTHORITY</p>
                      <p className="mt-1 font-heading text-base font-bold text-foreground">Independent decision</p>
                      <div className="mt-4 space-y-2 text-xs">
                        <button
                          type="button"
                          onClick={() => setDecisionType('approve')}
                          className={`flex w-full items-center justify-between rounded border px-3 py-2 text-left transition-colors ${
                            decisionType === 'approve'
                              ? 'border-[#113F3D] bg-[#113F3D]/10 font-semibold text-[#113F3D] dark:text-emerald-400'
                              : 'border-border/60 hover:bg-muted/40'
                          }`}
                        >
                          <span>✓ Approve within authority</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDecisionType('return')}
                          className={`flex w-full items-center justify-between rounded border px-3 py-2 text-left transition-colors ${
                            decisionType === 'return'
                              ? 'border-amber-600 bg-amber-500/10 font-semibold text-amber-800 dark:text-amber-300'
                              : 'border-border/60 hover:bg-muted/40'
                          }`}
                        >
                          <span>← Return for correction</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDecisionType('reject')}
                          className={`flex w-full items-center justify-between rounded border px-3 py-2 text-left transition-colors ${
                            decisionType === 'reject'
                              ? 'border-destructive bg-destructive/10 font-semibold text-destructive'
                              : 'border-border/60 hover:bg-muted/40'
                          }`}
                        >
                          <span>Reject with reason</span>
                        </button>
                        <div className="pt-2">
                          <Textarea
                            value={decisionNote}
                            onChange={(e) => setDecisionNote(e.target.value)}
                            placeholder="Decision note and evidence reference"
                            rows={3}
                            className="text-xs"
                          />
                        </div>
                      </div>
                    </div>
                    <p className="mt-3 text-[11px] text-muted-foreground">
                      Self-approval is blocked. A decision cannot exceed the current scope.
                    </p>
                  </Card>
                </div>

                {/* Deck P171 Regional Headcount & Capacity Envelope Breakdown */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <div>
                      <CardTitle className="text-base font-semibold">Regional Headcount &amp; Capacity Envelope (RM-06)</CardTitle>
                      <p className="text-xs text-muted-foreground">Staffing approvals and hiring recommendations to HR</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setStaffingModalOpen(true)}>Configure Headcount</Button>
                  </CardHeader>
                  <CardContent>
                    {!staffing ? (
                      <SkeletonRows rows={3} />
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-xs">
                          <div className="border border-border/60 rounded p-3">
                            <p className="text-muted-foreground">Planned Headcount</p>
                            <p className="text-xl font-bold font-heading">{staffing.activePlan?.planned_headcount || plannedHeadcount}</p>
                          </div>
                          <div className="border border-border/60 rounded p-3">
                            <p className="text-muted-foreground">Approved Headcount</p>
                            <p className="text-xl font-bold font-heading text-primary">{staffing.activePlan?.approved_headcount || approvedHeadcount}</p>
                          </div>
                          <div className="border border-border/60 rounded p-3">
                            <p className="text-muted-foreground">Active Callers On Duty</p>
                            <p className="text-xl font-bold font-heading text-emerald-600">{staffing.totalCallers} callers</p>
                          </div>
                        </div>

                        <table className="w-full text-left text-xs border border-border/60 rounded overflow-hidden">
                          <thead className="border-b border-border/60 bg-muted/40 text-muted-foreground">
                            <tr>
                              <th className="px-4 py-2 font-medium">Team</th>
                              <th className="px-4 py-2 font-medium">Active callers</th>
                              <th className="px-4 py-2 font-medium">Open leads</th>
                              <th className="px-4 py-2 font-medium">Workload/caller</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/40">
                            {staffing.teams?.map((tm: any) => (
                              <tr key={tm.teamId}>
                                <td className="px-4 py-2 font-medium text-foreground">{tm.name}</td>
                                <td className="px-4 py-2">{tm.activeCallers}</td>
                                <td className="px-4 py-2">{tm.openLeads}</td>
                                <td className="px-4 py-2">{tm.workloadPerCaller} leads</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <DeckBottomBar
                  onAction={handleDirectStaffingDecision}
                  actionLabel="Continue ->"
                />
              </div>
            )}
          </div>

          <div className="space-y-6">
            <DeckRightRail
              steps={
                tab === 'transfers'
                  ? [
                      'Inspect eligibility, tasks and forecast impact on both sides.',
                      'Approve specific transfers within the assigned region and vertical.',
                      'Review successful changes and any conflicts.',
                    ]
                  : [
                      'Review Manager capacity proposals and expected demand.',
                      'Prioritise staffing requests within the approved regional envelope.',
                      'Submit required hiring/role approvals to HR and authorised leadership.',
                    ]
              }
              failure={
                tab === 'transfers'
                  ? 'Other-region destination requires NM approval; another vertical requires the referral workflow.'
                  : 'Budget beyond authority escalates; the system must not treat requested headcount as available capacity.'
              }
              permission={
                tab === 'transfers'
                  ? 'Both organisational branches must be granted. Original event attribution and deadlines remain unchanged.'
                  : 'Plan approval is not a permission grant or hire completion. Role changes still require Super Admin execution.'
              }
            />
          </div>
        </div>
      )}

      {/* Staffing Modal */}
      <Panel
        open={staffingModalOpen}
        onClose={() => setStaffingModalOpen(false)}
        title="Approve Regional Staffing Plan"
      >
        <div className="space-y-4 text-xs">
          {s.error ? <p className="text-destructive">{s.error}</p> : null}
          <FormField label="Planned Headcount">
            <Input type="number" value={plannedHeadcount} onChange={(e) => setPlannedHeadcount(Number(e.target.value))} />
          </FormField>
          <FormField label="Approved Regional Envelope">
            <Input type="number" value={approvedHeadcount} onChange={(e) => setApprovedHeadcount(Number(e.target.value))} />
          </FormField>
          <FormField label="Business Justification &amp; Evidence">
            <Textarea value={justification} onChange={(e) => setJustification(e.target.value)} rows={3} placeholder="Queue ageing exceeds 48h on South Wealth portfolios, requiring 2 additional callers..." />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setStaffingModalOpen(false)}>Cancel</Button>
            <BusyButton size="sm" busy={s.busy} onClick={handleSaveStaffing}>Submit to HR</BusyButton>
          </div>
        </div>
      </Panel>
    </div>
  );
}

// ─── RM-07 & RM-08: Forecast & Risks ───
export function RegionalForecastsPage() {
  const [tab, setTab] = useState<'forecast' | 'escalations'>('forecast');
  const loadForecast = useCallback(() => regionalApi.getForecasts(), []);
  const [forecast, reloadForecast, forecastState] = useLoad<any>(loadForecast);

  const loadEscalations = useCallback(() => regionalApi.listEscalations(), []);
  const [escalations, reloadEscalations, escalationsState] = useLoad<any[]>(loadEscalations);

  const [adjustment, setAdjustment] = useState<number>(0);
  const [assumptions, setAssumptions] = useState('Consolidated pipeline with 5% risk discount on late-stage wealth closures.');
  const [escalationDrawerOpen, setEscalationDrawerOpen] = useState(false);

  const [escTitle, setEscTitle] = useState('');
  const [escSeverity, setEscSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('high');
  const [escDetail, setEscDetail] = useState('');
  const [escDecisionType, setEscDecisionType] = useState<'approve' | 'return' | 'reject'>('approve');
  const [escDecisionNote, setEscDecisionNote] = useState('');
  const [selectedEscalationId, setSelectedEscalationId] = useState<string>('');
  const s = useSubmitAction();

  const activeEscalation = (escalations && selectedEscalationId ? escalations.find((e: any) => e.id === selectedEscalationId) : escalations?.[0]) || null;

  const handleDirectEscalationDecision = async () => {
    if (!activeEscalation) {
      s.setError('No escalation available to resolve.');
      return;
    }
    const directive = escDecisionNote.trim() || 'Assigned recovery plan and priority supervisor monitoring.';
    const decision = escDecisionType === 'approve' ? 'resolved' : 'recovery_plan_assigned';
    await s.run(async () => {
      await regionalApi.resolveEscalation({
        escalationId: activeEscalation.id,
        decision,
        recoveryDecision: directive,
      });
      reloadEscalations();
    }, `Escalation ${activeEscalation.id} ${decision === 'resolved' ? 'resolved within authority' : 'recovery directive assigned'}.`);
  };

  const handleForecastSubmit = async (submitToNm: boolean) => {
    if (!assumptions.trim()) {
      s.setError('Regional assumptions are required before submission.');
      return;
    }
    const acceptedIds = forecast?.managerSubmissions?.map((m: any) => m.id) || [];
    await s.run(async () => {
      await regionalApi.submitForecast({
        periodLabel: 'October',
        regionalAdjustment: adjustment,
        regionalAssumptions: assumptions.trim(),
        topRegionalRisks: [
          { title: 'Source quality volatility', severity: 'high' },
        ],
        acceptedManagerForecastIds: acceptedIds,
        submitToNm,
      });
      reloadForecast();
    }, submitToNm ? 'Frozen regional forecast submitted to National Manager.' : 'Draft regional forecast saved.');
  };


  const handleCreateEscalation = async () => {
    if (!escTitle.trim() || !escDetail.trim()) {
      s.setError('Title and details are required.');
      return;
    }
    await s.run(async () => {
      await regionalApi.createEscalation({
        sourceType: 'operational_risk',
        title: escTitle.trim(),
        severity: escSeverity,
        detail: escDetail.trim(),
      });
      setEscalationDrawerOpen(false);
      setEscTitle('');
      setEscDetail('');
      reloadEscalations();
    }, 'Operational risk escalation logged.');
  };

  const activeLoading = tab === 'forecast' ? forecastState.loading : escalationsState.loading;
  const activeInitialLoading = tab === 'forecast' ? forecastState.initialLoading : escalationsState.initialLoading;
  const activeError = tab === 'forecast' ? forecastState.error : escalationsState.error;
  const handleRefresh = tab === 'forecast' ? reloadForecast : reloadEscalations;

  return (
    <div className="space-y-6">
      <PageHeader
        title={tab === 'forecast' ? 'Submit the regional forecast' : 'Resolve a regional escalation'}
        subtitle={tab === 'forecast' ? 'RM-07 / FORECAST & RISKS · Wealth · assigned permission scope · illustrative records' : 'RM-08 / FORECAST & RISKS · Wealth · assigned permission scope · illustrative records'}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={handleRefresh} disabled={activeLoading}>
              {activeLoading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Button variant={tab === 'forecast' ? 'default' : 'outline'} size="sm" onClick={() => setTab('forecast')}>
              Regional Forecast (RM-07)
            </Button>
            <Button variant={tab === 'escalations' ? 'default' : 'outline'} size="sm" onClick={() => setTab('escalations')}>
              Escalations &amp; Risk Queue (RM-08)
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

      {activeError ? (
        <div role="alert" className="flex items-center justify-between rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <span>Failed to load data: {activeError}</span>
          <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={handleRefresh}>Retry</Button>
        </div>
      ) : null}

      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}

      {activeInitialLoading ? (
        <SkeletonRows rows={4} />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {tab === 'forecast' ? (
              <div className="space-y-6">
                {/* WORK AREA Header */}
                <Card className="border-border/60 bg-card p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">WORK AREA</p>
                  <p className="mt-1 font-heading text-lg font-bold text-foreground">Submit the regional forecast</p>
                </Card>

                {/* Deck P173 Twin Cards: REPORT DEFINITION vs SELECTED SCOPE */}
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <Card className="p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">REPORT DEFINITION</p>
                    <div className="mt-3 space-y-2 text-xs">
                      <div className="flex justify-between border-b border-border/40 pb-1.5">
                        <span className="text-muted-foreground">Period</span>
                        <span className="font-semibold text-foreground">October</span>
                      </div>
                      <div className="flex justify-between border-b border-border/40 pb-1.5">
                        <span className="text-muted-foreground">Manager submissions</span>
                        <span className="text-foreground">Accepted versions</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Adjustment</span>
                        <span className="text-foreground">Documented regional view</span>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">SELECTED SCOPE</p>
                      <span className="text-[10px] text-muted-foreground">As of 09:42 IST</span>
                    </div>
                    <p className="mt-1 font-heading text-sm font-bold text-foreground">Performance and exceptions</p>
                    <div className="mt-3 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Completed</span>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 rounded-full bg-primary" />
                          <span className="font-semibold">72</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">In progress</span>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 rounded-full bg-muted-foreground/60" />
                          <span className="font-semibold">48</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Needs review</span>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-8 rounded-full bg-amber-500" />
                          <span className="font-semibold">21</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Excluded</span>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-4 rounded-full bg-destructive" />
                          <span className="font-semibold">8</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Forecast Rollup Cards */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Card className="border-border/60 bg-card p-4">
                    <p className="text-xs text-muted-foreground">Bottom-Up Manager Sum</p>
                    <p className="mt-1 font-heading text-2xl font-bold">
                      INR {Number(forecast?.bottomUpSum || 0).toLocaleString('en-IN')}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Accepted manager submissions</p>
                  </Card>

                  <Card className="border-border/60 bg-card p-4">
                    <p className="text-xs text-muted-foreground">Regional Adjustment</p>
                    <p className="mt-1 font-heading text-2xl font-bold text-amber-600">
                      INR {Number(adjustment).toLocaleString('en-IN')}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Regional risk/upside override</p>
                  </Card>

                  <Card className="border-border/60 bg-card p-4">
                    <p className="text-xs text-muted-foreground">Net Regional Forecast to NM</p>
                    <p className="mt-1 font-heading text-2xl font-bold text-primary">
                      INR {Number(Number(forecast?.bottomUpSum || 0) + Number(adjustment)).toLocaleString('en-IN')}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Status: <Badge tone="open">{forecast?.activeSubmission?.status || 'draft'}</Badge>
                    </p>
                  </Card>
                </div>

                {/* Manager Submissions Table */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold">Manager Forecast Rollup</CardTitle>
                    <p className="text-xs text-muted-foreground">Authorised manager forecast inputs</p>
                  </CardHeader>
                  <CardContent className="overflow-x-auto p-0">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-border/60 bg-muted/40 text-muted-foreground">
                        <tr>
                          <th className="px-4 py-2.5 font-medium">Manager</th>
                          <th className="px-4 py-2.5 font-medium">Period</th>
                          <th className="px-4 py-2.5 font-medium">Adjusted revenue</th>
                          <th className="px-4 py-2.5 font-medium">Status</th>
                          <th className="px-4 py-2.5 font-medium">Submitted at</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {forecast?.managerSubmissions?.map((m: any) => (
                          <tr key={m.id} className="hover:bg-muted/20">
                            <td className="px-4 py-3 font-medium text-foreground">{m.managerName}</td>
                            <td className="px-4 py-3">{m.periodLabel}</td>
                            <td className="px-4 py-3 font-semibold text-primary">INR {m.adjustedRevenue?.toLocaleString('en-IN')}</td>
                            <td className="px-4 py-3"><Badge tone="open">{m.status}</Badge></td>
                            <td className="px-4 py-3 text-muted-foreground">{m.submittedAt ? new Date(m.submittedAt).toLocaleDateString('en-IN') : 'Recent'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>

                {/* Forecast Adjustment & NM Submission Box */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold">Regional Assumptions &amp; Executive Submission</CardTitle>
                    <p className="text-xs text-muted-foreground">Document regional assumptions and submit frozen view to National Manager</p>
                  </CardHeader>
                  <CardContent className="space-y-4 text-xs">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormField label="Regional Value Adjustment (INR)">
                        <Input
                          type="number"
                          value={adjustment}
                          onChange={(e) => setAdjustment(Number(e.target.value))}
                          placeholder="e.g. -500000 or 1000000"
                        />
                      </FormField>
                      <FormField label="Documented Regional Assumptions">
                        <Input
                          value={assumptions}
                          onChange={(e) => setAssumptions(e.target.value)}
                          placeholder="Macro factors, regulatory updates, source conversion assumptions..."
                        />
                      </FormField>
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
                      <Button variant="outline" size="sm" onClick={() => handleForecastSubmit(false)}>Save draft forecast</Button>
                      <BusyButton size="sm" busy={s.busy} onClick={() => handleForecastSubmit(true)}>
                        Submit frozen forecast to NM (RM-07)
                      </BusyButton>
                    </div>
                  </CardContent>
                </Card>

                <DeckBottomBar
                  onAction={() => handleForecastSubmit(true)}
                  actionLabel="Generate scoped PDF ->"
                />
              </div>
            ) : (
              <div className="space-y-6">
                {/* WORK AREA Header */}
                <Card className="border-border/60 bg-card p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">WORK AREA</p>
                  <p className="mt-1 font-heading text-lg font-bold text-foreground">Resolve a regional escalation</p>
                </Card>

                {/* Deck P175 Twin Cards: SUBMITTED EVIDENCE vs YOUR AUTHORITY */}
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {/* Left: Submitted Evidence */}
                  <Card className="flex flex-col justify-between p-4 border-border/60">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">SUBMITTED EVIDENCE</p>
                      <p className="mt-1 font-heading text-base font-bold text-foreground">Decision request</p>
                      <div className="mt-4 space-y-3 text-xs">
                        <div className="flex justify-between border-b border-border/40 pb-2">
                          <span className="text-muted-foreground">Risk</span>
                          <span className="font-semibold text-foreground">
                            {activeEscalation?.title || 'Source backlog'}
                          </span>
                        </div>
                        <div className="flex justify-between border-b border-border/40 pb-2">
                          <span className="text-muted-foreground">Severity</span>
                          <Badge tone={activeEscalation?.severity === 'critical' ? 'overdue' : 'default'}>
                            {activeEscalation?.severity ? activeEscalation.severity.charAt(0).toUpperCase() + activeEscalation.severity.slice(1) : 'High'}
                          </Badge>
                        </div>
                        <div className="flex justify-between border-b border-border/40 pb-2">
                          <span className="text-muted-foreground">Accountable Manager</span>
                          <span className="font-medium text-foreground">{activeEscalation?.accountable_manager_name || 'Arjun'}</span>
                        </div>
                        <div className="flex justify-between border-b border-border/40 pb-2">
                          <span className="text-muted-foreground">Decision</span>
                          <span className="font-semibold text-primary">
                            {activeEscalation?.recovery_decision || 'Recovery plan'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Review date</span>
                          <span className="text-foreground">
                            {activeEscalation?.deadline ? new Date(activeEscalation.deadline).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '30 Sep'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 rounded border border-border/40 bg-muted/30 p-2.5 text-[11px] text-muted-foreground">
                      <span className="mr-1">📄</span> Original request and previous decisions remain in the audit trail.
                    </div>
                  </Card>

                  {/* Right: Your Authority */}
                  <Card className="flex flex-col justify-between p-4 border-border/60">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">YOUR AUTHORITY</p>
                      <p className="mt-1 font-heading text-base font-bold text-foreground">Independent decision</p>
                      <div className="mt-4 space-y-2 text-xs">
                        <button
                          type="button"
                          onClick={() => setEscDecisionType('approve')}
                          className={`flex w-full items-center justify-between rounded border px-3 py-2 text-left transition-colors ${
                            escDecisionType === 'approve'
                              ? 'border-[#113F3D] bg-[#113F3D]/10 font-semibold text-[#113F3D] dark:text-emerald-400'
                              : 'border-border/60 hover:bg-muted/40'
                          }`}
                        >
                          <span>✓ Approve within authority</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEscDecisionType('return')}
                          className={`flex w-full items-center justify-between rounded border px-3 py-2 text-left transition-colors ${
                            escDecisionType === 'return'
                              ? 'border-amber-600 bg-amber-500/10 font-semibold text-amber-800 dark:text-amber-300'
                              : 'border-border/60 hover:bg-muted/40'
                          }`}
                        >
                          <span>← Return for correction</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEscDecisionType('reject')}
                          className={`flex w-full items-center justify-between rounded border px-3 py-2 text-left transition-colors ${
                            escDecisionType === 'reject'
                              ? 'border-destructive bg-destructive/10 font-semibold text-destructive'
                              : 'border-border/60 hover:bg-muted/40'
                          }`}
                        >
                          <span>Reject with reason</span>
                        </button>
                        <div className="pt-2">
                          <Textarea
                            value={escDecisionNote}
                            onChange={(e) => setEscDecisionNote(e.target.value)}
                            placeholder="Decision note and evidence reference"
                            rows={3}
                            className="text-xs"
                          />
                        </div>
                      </div>
                    </div>
                    <p className="mt-3 text-[11px] text-muted-foreground">
                      Self-approval is blocked. A decision cannot exceed the current scope.
                    </p>
                  </Card>
                </div>

                {/* Escalation Queue Table & Selector */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <div>
                      <CardTitle className="text-base font-semibold">Regional Escalation &amp; Exception Queue (RM-08)</CardTitle>
                      <p className="text-xs text-muted-foreground">High-severity commercial exceptions, source remediations, and operational breaches</p>
                    </div>
                    <Button size="sm" onClick={() => setEscalationDrawerOpen(true)}>+ Log Escalation</Button>
                  </CardHeader>
                  <CardContent>
                    {!escalations || escalations.length === 0 ? (
                      <EmptyState title="No active escalations" message="All regional risks and commercial exceptions are resolved." />
                    ) : (
                      <div className="space-y-3">
                        {escalations.map((e: any) => {
                          const isSelected = e.id === (activeEscalation?.id || escalations[0]?.id);
                          return (
                            <div
                              key={e.id}
                              onClick={() => setSelectedEscalationId(e.id)}
                              className={`cursor-pointer rounded border p-3 text-xs transition-colors ${
                                isSelected
                                  ? 'border-[#113F3D] bg-[#113F3D]/5 ring-1 ring-[#113F3D]'
                                  : 'border-border/60 hover:bg-muted/30'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Badge tone={e.severity === 'critical' ? 'overdue' : 'default'}>{e.severity?.toUpperCase()}</Badge>
                                  <span className="font-semibold text-foreground">{e.title}</span>
                                </div>
                                <Badge tone={e.status === 'resolved' ? 'open' : 'pending'}>{e.status}</Badge>
                              </div>
                              <p className="mt-1 text-muted-foreground line-clamp-2">{e.detail}</p>
                              <div className="mt-2 flex items-center justify-between border-t border-border/30 pt-1.5 text-[11px] text-muted-foreground">
                                <span>Owner: {e.accountable_manager_name || 'Unassigned'}</span>
                                {e.status !== 'resolved' ? (
                                  <span className="text-primary font-medium">Click to select for authority decision →</span>
                                ) : (
                                  <span>Resolved</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <DeckBottomBar
                  onAction={handleDirectEscalationDecision}
                  actionLabel="Continue ->"
                />
              </div>
            )}
          </div>

          <div className="space-y-6">
            <DeckRightRail
              steps={
                tab === 'forecast'
                  ? [
                      'Review accepted Manager forecasts and open gaps.',
                      'Add supported regional assumptions separately.',
                      'Submit a frozen forecast and risk register to NM.',
                    ]
                  : [
                      'Assess evidence and affected teams.',
                      'Assign a recovery decision, owner and deadline.',
                      'Escalate to NM if policy, budget or geography exceeds authority.',
                    ]
              }
              failure={
                tab === 'forecast'
                  ? 'Incomplete submissions are disclosed and escalated; no silent roll-forward.'
                  : 'Overdue high-severity risks notify NM automatically under the configured escalation policy.'
              }
              permission={
                tab === 'forecast'
                  ? 'Deduplicate opportunities and use a common expected-revenue basis. Preserve every submitted version.'
                  : 'Use explicit delegation and limits. Finance decisions stay within finance authority.'
              }
            />
          </div>
        </div>
      )}

      {/* Log Escalation Drawer */}
      <Panel
        open={escalationDrawerOpen}
        onClose={() => setEscalationDrawerOpen(false)}
        title="Log Regional Escalation"
      >
        <div className="space-y-4 text-xs">
          {s.error ? <p className="text-destructive">{s.error}</p> : null}
          <FormField label="Escalation Title">
            <Input value={escTitle} onChange={(e) => setEscTitle(e.target.value)} placeholder="e.g. Systemic intake latency on Bangalore campaigns" />
          </FormField>
          <FormField label="Severity">
            <Select value={escSeverity} onChange={(e) => setEscSeverity(e.target.value as any)}>
              <option value="critical">Critical (Immediate RM &amp; NM escalation)</option>
              <option value="high">High (24h resolution SLA)</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </Select>
          </FormField>
          <FormField label="Risk Details &amp; Affected Hierarchy">
            <Textarea value={escDetail} onChange={(e) => setEscDetail(e.target.value)} rows={3} placeholder="Describe the operational constraint or commercial conflict..." />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setEscalationDrawerOpen(false)}>Cancel</Button>
            <BusyButton size="sm" busy={s.busy} onClick={handleCreateEscalation}>Commit escalation</BusyButton>
          </div>
        </div>
      </Panel>
    </div>
  );
}

// ─── RM-09: Run a Manager review ───
export function RegionalReviewsPage() {
  const loadOverview = useCallback(() => regionalApi.overview(), []);
  const [overview] = useLoad<any>(loadOverview);

  const [selectedManagerId, setSelectedManagerId] = useState<string>('EMP-007');
  const loadReviews = useCallback(() => regionalApi.listReviews(selectedManagerId), [selectedManagerId]);
  const [reviews, reloadReviews, { loading, initialLoading, error, clearError }] = useLoad<any[]>(loadReviews);

  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [periodLabel, setPeriodLabel] = useState('Q3 2026');
  const [rating, setRating] = useState<'exceeding' | 'achieving' | 'needs_improvement' | 'critical'>('achieving');
  const [strengths, setStrengths] = useState('Customer context was prepared before the call. Demonstrated strong leadership across frontline associates.');
  const [blockers, setBlockers] = useState('Lead latency in uncontacted intake queue; capacity bottlenecks in sub-regional queues.');
  const [commitmentText, setCommitmentText] = useState('Reduce 48h backlog to < 10%\nComplete all TL coaching sessions\nAttain 90% forecast accuracy');
  const [supportActions, setSupportActions] = useState('Provide 2 additional associates, approve fee waiver policy');
  const [privateNotes, setPrivateNotes] = useState('High potential for National Management role succession.');
  const [nextDate, setNextDate] = useState('2026-10-31');
  const [acknowledged, setAcknowledged] = useState(true);
  const s = useSubmitAction();

  const handleSaveReview = async () => {
    if (!strengths.trim() || !blockers.trim() || !commitmentText.trim()) {
      s.setError('Strengths, blockers, and at least one commitment are required.');
      return;
    }
    await s.run(async () => {
      await regionalApi.saveReview({
        managerEmployeeId: selectedManagerId,
        periodLabel,
        performanceRating: rating,
        strengths: strengths.trim(),
        blockers: blockers.trim(),
        improvementCommitments: commitmentText.split('\n').filter((c) => c.trim().length > 0),
        supportActions: supportActions.trim() || undefined,
        privateRmNotes: privateNotes.trim() || undefined,
        nextReviewDate: nextDate,
        acknowledged,
      });
      setReviewModalOpen(false);
      reloadReviews();
    }, 'Manager performance review recorded successfully.');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Run a Manager review"
        subtitle="RM-09 / REVIEWS · Wealth · assigned permission scope · illustrative records"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={reloadReviews} disabled={loading}>
              {loading && reviews ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Button size="sm" onClick={() => setReviewModalOpen(true)}>
              + Run Manager Review (RM-09)
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
            <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={reloadReviews}>Retry</Button>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={clearError}>Dismiss</Button>
          </div>
        </div>
      ) : null}

      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}

      {/* Manager Selector Tabs */}
      <div className="flex gap-2 border-b border-border/60 pb-2">
        {overview?.managers?.map((m: any) => (
          <Button
            key={m.managerId}
            variant={selectedManagerId === m.managerId ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedManagerId(m.managerId)}
          >
            {m.name}
          </Button>
        ))}
      </div>

      {initialLoading ? (
        <SkeletonRows rows={4} />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* WORK AREA Header */}
            <Card className="border-border/60 bg-card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">WORK AREA</p>
              <p className="mt-1 font-heading text-lg font-bold text-foreground">Run a Manager review</p>
            </Card>

            {/* Deck P177 Twin Cards: PERFORMANCE EVIDENCE vs MEETING RECORD */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Card className="p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">PERFORMANCE EVIDENCE</p>
                <p className="mt-1 font-heading text-base font-bold text-foreground">One-to-one review</p>

                <div className="mt-3 grid grid-cols-3 gap-2 border-b border-border/40 pb-3 text-xs text-center">
                  <div className="rounded border border-border/40 bg-muted/20 p-2">
                    <p className="text-[10px] text-muted-foreground">Verified activity</p>
                    <p className="font-heading font-bold text-sm">31 / 50</p>
                  </div>
                  <div className="rounded border border-border/40 bg-muted/20 p-2">
                    <p className="text-[10px] text-muted-foreground">Approved wins</p>
                    <p className="font-heading font-bold text-sm text-primary">7 / 10</p>
                  </div>
                  <div className="rounded border border-border/40 bg-muted/20 p-2">
                    <p className="text-[10px] text-muted-foreground">Follow-up SLA</p>
                    <p className="font-heading font-bold text-sm text-emerald-600">94%</p>
                  </div>
                </div>

                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex justify-between border-b border-border/40 pb-1.5">
                    <span className="text-muted-foreground">Reviewee</span>
                    <span className="font-semibold text-foreground">Neel Verma</span>
                  </div>
                  <div className="flex justify-between border-b border-border/40 pb-1.5">
                    <span className="text-muted-foreground">Period</span>
                    <span className="text-foreground">Quarter</span>
                  </div>
                  <div className="flex justify-between border-b border-border/40 pb-1.5">
                    <span className="text-muted-foreground">Snapshot</span>
                    <span className="text-foreground">Regional approved version</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Agenda</span>
                    <span className="text-foreground">Results, staffing and forecast</span>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">MEETING RECORD</p>
                <p className="mt-1 font-heading text-base font-bold text-foreground">Coaching and commitments</p>

                <div className="mt-3 space-y-3 text-xs">
                  <div>
                    <span className="font-medium text-foreground">Observed strengths</span>
                    <p className="mt-1 rounded border border-border/40 bg-muted/20 p-2.5 text-muted-foreground">
                      Customer context was prepared before the call. Proactive rebalancing of intake queues.
                    </p>
                  </div>

                  <div>
                    <span className="font-medium text-foreground">Improvement commitment</span>
                    <p className="mt-1 rounded border border-border/40 bg-muted/20 p-2.5 text-muted-foreground">
                      Name the behaviour and follow-up date: Address 48h lead backlog within 7 days.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                    <Badge tone="pending">Draft review</Badge>
                    <span className="text-[11px] text-muted-foreground">Employee acknowledgement follows publication.</span>
                  </div>
                </div>
              </Card>
            </div>

            {/* Quarterly Review History List */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Quarterly Review History (RM-09)</CardTitle>
                <p className="text-xs text-muted-foreground">Completed performance evaluations and commitments</p>
              </CardHeader>
              <CardContent>
                {!reviews || reviews.length === 0 ? (
                  <EmptyState title="No prior reviews" message="Run a manager review using the button above." />
                ) : (
                  <div className="space-y-4">
                    {reviews.map((r: any) => (
                      <div key={r.id} className="rounded-md border border-border/60 p-4 text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm">{r.period_label} Performance Review</span>
                          <Badge tone={r.performance_rating === 'exceeding' ? 'open' : r.performance_rating === 'achieving' ? 'pending' : 'overdue'}>
                            {r.performance_rating?.replace('_', ' ')}
                          </Badge>
                        </div>
                        <p><span className="font-medium">Strengths:</span> {r.strengths}</p>
                        <p><span className="font-medium">Blockers:</span> {r.blockers}</p>
                        {r.improvement_commitments?.length > 0 && (
                          <div>
                            <span className="font-medium">Commitments:</span>
                            <ul className="list-disc pl-4 mt-1 space-y-0.5 text-muted-foreground">
                              {r.improvement_commitments.map((c: string, idx: number) => (
                                <li key={idx}>{c}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <p className="text-muted-foreground pt-1">Next review due: {new Date(r.next_review_date).toLocaleDateString('en-IN')}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <DeckBottomBar
              onAction={() => setReviewModalOpen(true)}
              actionLabel="Continue ->"
            />
          </div>

          <div className="space-y-6">
            <DeckRightRail
              steps={[
                'Prepare evidence and Manager self-reflection.',
                'Record decisions, support and improvement commitments.',
                'Complete, acknowledge and follow up before the next review.',
              ]}
              failure="Metric disputes remain attached to the review and use the correction workflow."
              permission="Historical contribution is scoped to the relationship period; private notes have separate visibility."
            />
          </div>
        </div>
      )}

      {/* Review Dialog */}
      <Panel
        open={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        title="Conduct Manager Review (RM-09)"
      >
        <div className="space-y-4 text-xs">
          {s.error ? <p className="text-destructive">{s.error}</p> : null}
          <FormField label="Review Period">
            <Input value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} placeholder="e.g. Q3 2026" />
          </FormField>

          <FormField label="Performance Rating">
            <Select value={rating} onChange={(e) => setRating(e.target.value as any)}>
              <option value="exceeding">Exceeding plan</option>
              <option value="achieving">Achieving target</option>
              <option value="needs_improvement">Needs improvement</option>
              <option value="critical">Critical intervention required</option>
            </Select>
          </FormField>

          <FormField label="Demonstrated Strengths">
            <Textarea value={strengths} onChange={(e) => setStrengths(e.target.value)} rows={2} placeholder="Team leadership, coaching adherence, pipeline acceleration..." />
          </FormField>

          <FormField label="Operational Blockers">
            <Textarea value={blockers} onChange={(e) => setBlockers(e.target.value)} rows={2} placeholder="Source intake quality, caller capacity constraints, commercial exceptions..." />
          </FormField>

          <FormField label="Improvement Commitments (One per line)">
            <Textarea value={commitmentText} onChange={(e) => setCommitmentText(e.target.value)} rows={3} placeholder="Reduce 48h backlog to < 10%&#10;Complete all TL coaching sessions&#10;Attain 90% forecast accuracy" />
          </FormField>

          <FormField label="Support / Resource Commitments">
            <Input value={supportActions} onChange={(e) => setSupportActions(e.target.value)} placeholder="Provide 2 additional associates, approve fee waiver policy..." />
          </FormField>

          <FormField label="Private Regional Notes (RM Only)">
            <Textarea value={privateNotes} onChange={(e) => setPrivateNotes(e.target.value)} rows={2} placeholder="Confidential succession / organizational notes..." />
          </FormField>

          <FormField label="Next Review Date">
            <Input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
          </FormField>

          <div className="flex items-center gap-2 pt-1">
            <input type="checkbox" id="ack-page" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} className="rounded border-border" />
            <label htmlFor="ack-page">Manager acknowledged review outcomes</label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setReviewModalOpen(false)}>Cancel</Button>
            <BusyButton size="sm" busy={s.busy} onClick={handleSaveReview}>Commit review</BusyButton>
          </div>
        </div>
      </Panel>
    </div>
  );
}

// ─── RM-10: Produce the regional review pack ───
export function RegionalReportsPage() {
  const [period] = useState('October 2026');
  const loadPreview = useCallback(() => regionalApi.previewReportPack(period), [period]);
  const [preview, reloadPreview, previewState] = useLoad<any>(loadPreview);

  const loadSchedules = useCallback(() => regionalApi.listReportSchedules(), []);
  const [schedules, reloadSchedules, schedulesState] = useLoad<any[]>(loadSchedules);

  const [downloading, setDownloading] = useState(false);
  const [schedDrawerOpen, setSchedDrawerOpen] = useState(false);

  const [schedName, setSchedName] = useState('Weekly Regional Governance Pack');
  const [schedCadence, setSchedCadence] = useState('Every Monday 09:00 IST');
  const [schedRecipients, setSchedRecipients] = useState('kavita@finverse.demo, nm@finverse.demo');
  const s = useSubmitAction();

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const res = await regionalApi.generatePdfPack({
        title: 'Regional Performance & Governance Review Pack',
        period,
        sections: ['targets', 'managers', 'forecast', 'risks'],
      });
      if (res?.downloadUrl) {
        window.open(res.downloadUrl, '_blank');
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to generate PDF review pack.');
    } finally {
      setDownloading(false);
    }
  };

  const handleSaveSchedule = async () => {
    const recipients = schedRecipients.split(',').map((r) => r.trim()).filter(Boolean);
    if (!schedName.trim() || recipients.length === 0) {
      s.setError('Schedule name and at least one recipient are required.');
      return;
    }
    await s.run(async () => {
      await regionalApi.saveReportSchedule({
        name: schedName.trim(),
        periodType: 'weekly',
        cadence: schedCadence.trim(),
        recipients,
        sections: ['targets', 'managers', 'forecast', 'risks'],
        status: 'active',
      });
      setSchedDrawerOpen(false);
      reloadSchedules();
    }, 'Regional report schedule registered successfully.');
  };

  const activeLoading = previewState.loading || schedulesState.loading;
  const activeInitialLoading = previewState.initialLoading;
  const activeError = previewState.error || schedulesState.error;
  const handleRefresh = () => {
    reloadPreview();
    reloadSchedules();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Produce the regional review pack"
        subtitle="RM-10 / REPORTS & HELP · Wealth · assigned permission scope · illustrative records"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleRefresh} disabled={activeLoading}>
              {activeLoading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSchedDrawerOpen(true)}>
              + New Report Schedule
            </Button>
            <BusyButton size="sm" busy={downloading} onClick={handleDownloadPdf}>
              Download Protected PDF Pack (RM-10)
            </BusyButton>
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

      {activeError ? (
        <div role="alert" className="flex items-center justify-between rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <span>Failed to load reports: {activeError}</span>
          <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={handleRefresh}>Retry</Button>
        </div>
      ) : null}

      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}

      {activeInitialLoading ? (
        <SkeletonRows rows={4} />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* WORK AREA Header */}
            <Card className="border-border/60 bg-card p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">WORK AREA</p>
              <p className="mt-1 font-heading text-lg font-bold text-foreground">Produce the regional review pack</p>
            </Card>

            {/* Deck P179 Twin Cards: REPORT DEFINITION vs SELECTED SCOPE */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Card className="p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">REPORT DEFINITION</p>
                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex justify-between border-b border-border/40 pb-1.5">
                    <span className="text-muted-foreground">Period</span>
                    <span className="font-semibold text-foreground">Any of six reporting periods</span>
                  </div>
                  <div className="flex justify-between border-b border-border/40 pb-1.5">
                    <span className="text-muted-foreground">Scope</span>
                    <span className="text-foreground">Wealth South</span>
                  </div>
                  <div className="flex justify-between border-b border-border/40 pb-1.5">
                    <span className="text-muted-foreground">Audience</span>
                    <span className="text-foreground">NM</span>
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-border/40 flex justify-end">
                  <Button size="sm" variant="outline" className="h-6 text-xs">Apply filters</Button>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">SELECTED SCOPE</p>
                  <span className="text-[10px] text-muted-foreground">As of 09:42 IST</span>
                </div>
                <p className="mt-1 font-heading text-base font-bold text-foreground">Performance and exceptions</p>
                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Completed</span>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 rounded-full bg-primary" />
                      <span className="font-semibold">72</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">In progress</span>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 rounded-full bg-muted-foreground/60" />
                      <span className="font-semibold">48</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Needs review</span>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-8 rounded-full bg-amber-500" />
                      <span className="font-semibold">21</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Excluded</span>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-4 rounded-full bg-destructive" />
                      <span className="font-semibold">8</span>
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                  Totals are versioned for the chosen period. Export keeps the same permission scope.
                </p>
              </Card>
            </div>

            {/* Executive PDF Preview Box */}
            <Card className="border-border/60 bg-card">
              <CardHeader className="border-b border-border/40 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-bold">{preview?.title}</CardTitle>
                    <p className="text-xs text-muted-foreground">Scope: {preview?.scope?.name} | Prepared for: National Management</p>
                  </div>
                  <Badge tone="default">Binary PDF Export Ready</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 pt-4 text-xs">
                {/* Section 1 */}
                <div>
                  <h3 className="font-semibold text-sm text-foreground border-b border-border/40 pb-1 mb-2">
                    1. Regional Target Bridge
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="border border-border/40 rounded p-2.5">
                      <p className="text-muted-foreground">Parent NM Target</p>
                      <p className="text-base font-bold font-heading">{preview?.targetSummary?.parentTarget} wins</p>
                    </div>
                    <div className="border border-border/40 rounded p-2.5">
                      <p className="text-muted-foreground">Achieved Wins</p>
                      <p className="text-base font-bold font-heading text-primary">
                        {preview?.targetSummary?.achievedWins} wins ({preview?.targetSummary?.attainmentPercent}%)
                      </p>
                    </div>
                    <div className="border border-border/40 rounded p-2.5">
                      <p className="text-muted-foreground">Unallocated Remainder</p>
                      <p className="text-base font-bold font-heading text-emerald-600">
                        {preview?.targetSummary?.unallocatedRemainder} wins
                      </p>
                    </div>
                  </div>
                </div>

                {/* Section 2 */}
                <div>
                  <h3 className="font-semibold text-sm text-foreground border-b border-border/40 pb-1 mb-2">
                    2. Manager Contributions
                  </h3>
                  <div className="space-y-2">
                    {preview?.managers?.map((m: any) => (
                      <div key={m.managerId} className="flex items-center justify-between border-b border-border/30 pb-1.5">
                        <span className="font-medium text-foreground">{m.name} ({m.teams?.join(', ')})</span>
                        <span className="text-muted-foreground">Target {m.allocatedTarget} | Wins {m.achievedWins} ({m.targetPace}%) | {m.status}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section 3 */}
                <div>
                  <h3 className="font-semibold text-sm text-foreground border-b border-border/40 pb-1 mb-2">
                    3. Regional Forecast Reconciliation
                  </h3>
                  <p className="text-muted-foreground">
                    Bottom-up total: INR {Number(preview?.forecastSummary?.bottomUpSum || 0).toLocaleString('en-IN')} | Regional adjustment: INR {Number(preview?.forecastSummary?.regionalAdjustment || 0).toLocaleString('en-IN')} | Net forecast: <span className="font-semibold text-primary">INR {Number(preview?.forecastSummary?.adjustedRevenue || 0).toLocaleString('en-IN')}</span>
                  </p>
                </div>

                {/* Section 4 */}
                <div>
                  <h3 className="font-semibold text-sm text-foreground border-b border-border/40 pb-1 mb-2">
                    4. Top Regional Risks &amp; Governance Flags
                  </h3>
                  {!preview?.riskRegister || preview.riskRegister.length === 0 ? (
                    <p className="text-muted-foreground">No open regional risks.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {preview.riskRegister.map((r: any) => (
                        <div key={r.id} className="flex items-center justify-between">
                          <span>[{r.severity?.toUpperCase()}] {r.title}</span>
                          <Badge tone="default">{r.status}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Report Distribution Schedules */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Active Distribution Schedules</CardTitle>
                <p className="text-xs text-muted-foreground">Automated regional cadence deliveries</p>
              </CardHeader>
              <CardContent>
                {!schedules || schedules.length === 0 ? (
                  <EmptyState title="No active schedules" message="Set up a recurring delivery schedule using the button above." />
                ) : (
                  <div className="space-y-3 text-xs">
                    {schedules.map((sc: any) => {
                      const recipients = typeof sc.recipients === 'string' ? JSON.parse(sc.recipients) : sc.recipients;
                      return (
                        <div key={sc.id} className="flex items-center justify-between border-b border-border/40 pb-2">
                          <div>
                            <p className="font-semibold text-foreground">{sc.name}</p>
                            <p className="text-[11px] text-muted-foreground">{sc.cadence} &bull; Recipients: {recipients?.join(', ')}</p>
                          </div>
                          <Badge tone="default">{sc.status}</Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <DeckBottomBar
              onAction={handleDownloadPdf}
              actionLabel="Generate scoped PDF ->"
              busy={downloading}
            />
          </div>

          <div className="space-y-6">
            <DeckRightRail
              steps={[
                'Choose period and permitted report sections.',
                'Preview summary-to-Manager reconciliation.',
                'Generate the protected PDF and optional approved schedule.',
              ]}
              failure="Changes to scope suspend affected schedules until a permitted owner confirms them."
              permission="Region label does not widen vertical permissions. Revalidate both recipient and export owner."
            />
          </div>
        </div>
      )}

      {/* Schedule Drawer */}
      <Panel
        open={schedDrawerOpen}
        onClose={() => setSchedDrawerOpen(false)}
        title="Register Report Schedule"
      >
        <div className="space-y-4 text-xs">
          {s.error ? <p className="text-destructive">{s.error}</p> : null}
          <FormField label="Schedule Title">
            <Input value={schedName} onChange={(e) => setSchedName(e.target.value)} />
          </FormField>
          <FormField label="Cadence (e.g. Every Monday 09:00 IST)">
            <Input value={schedCadence} onChange={(e) => setSchedCadence(e.target.value)} />
          </FormField>
          <FormField label="Recipients (Comma-separated emails)">
            <Input value={schedRecipients} onChange={(e) => setSchedRecipients(e.target.value)} />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setSchedDrawerOpen(false)}>Cancel</Button>
            <BusyButton size="sm" busy={s.busy} onClick={handleSaveSchedule}>Save schedule</BusyButton>
          </div>
        </div>
      </Panel>
    </div>
  );
}
