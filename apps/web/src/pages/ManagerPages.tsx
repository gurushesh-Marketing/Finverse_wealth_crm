import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { managerApi } from '../lib/manager-api';
import { PageHeader, Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input, Textarea } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Panel, BusyButton } from '../components/ui/panel';
import { EmptyState, SkeletonRows, SuccessNote } from '../components/ui/states';
import type { MgPeriod } from '@finverse/contracts';

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

// ─── MG-01: Manager Overview ───
export function ManagerOverviewPage() {
  const [period, setPeriod] = useState<MgPeriod>('month-to-date');
  const [comparison, setComparison] = useState('previous-period');
  const loadOverview = useCallback(() => managerApi.overview(period, comparison), [period, comparison]);
  const [data, load, { loading, initialLoading, error, clearError }] = useLoad(loadOverview);
  const [actionDrawerOpen, setActionDrawerOpen] = useState(false);
  const [selectedTlId, setSelectedTlId] = useState('');
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [kind, setKind] = useState<'intervention' | 'coaching' | 'capacity' | 'follow-up'>('intervention');
  const s = useSubmitAction();

  const handleCreateAction = async () => {
    if (!selectedTlId || !title.trim() || !dueAt) {
      s.setError('Please fill in the TL, title, and due date.');
      return;
    }
    await s.run(async () => {
      await managerApi.createAction({
        sourceAction: 'MG-01',
        kind,
        subjectTlEmployeeId: selectedTlId,
        ownerEmployeeId: data?.manager?.id || 'EMP-007',
        title: title.trim(),
        detail: detail.trim() || undefined,
        dueAt: new Date(dueAt).toISOString(),
      });
      setActionDrawerOpen(false);
      setTitle('');
      setDetail('');
      setDueAt('');
      load();
    }, 'Management intervention created successfully.');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manager overview"
        subtitle="Performance, target pace, ageing, and backlog across assigned team leaders · MG-01"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={period} onChange={(e) => setPeriod(e.target.value as MgPeriod)} className="w-36 text-xs">
              <option value="today">Today</option>
              <option value="this-week">This week</option>
              <option value="month-to-date">Month to date</option>
              <option value="last-month">Last month</option>
              <option value="quarter-to-date">Quarter to date</option>
            </Select>
            <Select value={comparison} onChange={(e) => setComparison(e.target.value)} className="w-36 text-xs">
              <option value="previous-period">vs Prev Period</option>
              <option value="target-pace">vs Target Pace</option>
            </Select>
            <Button size="sm" variant="outline" onClick={load} disabled={loading}>
              {loading && data ? 'Refreshing…' : 'Refresh'}
            </Button>
          </div>
        }
      />

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
      {s.error ? (
        <div role="alert" className="rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          {s.error}
        </div>
      ) : null}

      {initialLoading && !data ? (
        <SkeletonRows rows={4} />
      ) : !data ? (
        <EmptyState title="No overview data" message="Overview metrics could not be loaded for the selected period." />
      ) : (
        <>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <p>
              Scope: {data.teams.map((t: any) => t.name).join(' + ')} · As of {new Date(data.asOf).toLocaleTimeString()} ·
              Role: Wealth Manager ({data.manager.name})
            </p>
            {loading ? <span className="font-mono text-[11px] text-primary animate-pulse">Refreshing…</span> : null}
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {data.kpis.map((k: any) => (
              <Card key={k.key} className="p-4 border-l-4 border-l-primary">
                <p className="text-xs font-medium text-muted-foreground">{k.label}</p>
                <p className="mt-1 font-heading text-2xl font-bold text-foreground">{k.value}</p>
                <p className="text-xs text-primary font-medium mt-0.5">{k.comparison}</p>
                <p className="mt-2 font-mono text-[10px] text-muted-foreground">{k.formula}</p>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-semibold">Team Leader Contribution & Backlog</CardTitle>
              <span className="text-xs text-muted-foreground">
                Notice: Low sample size teams display count explicitly; never automatically ranked worst.
              </span>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                      <th className="py-2">Team Leader</th>
                      <th>Assigned Teams</th>
                      <th>Target Pace</th>
                      <th>Wins</th>
                      <th>Active Backlog</th>
                      <th>Ageing (&gt;3d)</th>
                      <th>Overdue SLA</th>
                      <th>Open Actions</th>
                      <th className="text-right">Intervention</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.tlBreakdown.map((tl: any) => (
                      <tr key={tl.tlEmployeeId} className="hover:bg-muted/40">
                        <td className="py-3 font-medium">
                          {tl.tlName}
                          {tl.isLowSample ? (
                            <Badge tone="pending" className="ml-2 text-[10px]">
                              Sample: {tl.sampleSize}
                            </Badge>
                          ) : null}
                        </td>
                        <td className="text-muted-foreground">{tl.teams.join(', ')}</td>
                        <td>
                          <span className="font-semibold text-emerald-700 dark:text-emerald-400">{tl.targetPace}</span>
                        </td>
                        <td>{tl.wins}</td>
                        <td>{tl.openBacklog} leads</td>
                        <td>
                          {tl.ageingLeads > 0 ? (
                            <span className="text-amber-600 font-medium">{tl.ageingLeads}</span>
                          ) : (
                            '0'
                          )}
                        </td>
                        <td>
                          {tl.overdueTasks > 0 ? (
                            <span className="text-rose-600 font-bold">{tl.overdueTasks}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                        <td>{tl.openActions}</td>
                        <td className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedTlId(tl.tlEmployeeId);
                              setActionDrawerOpen(true);
                            }}
                          >
                            Assign Action
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* MG-01 Intervention Drawer */}
      <Panel
        open={actionDrawerOpen}
        onClose={() => setActionDrawerOpen(false)}
        title="Assign Management Intervention"
      >
        <div className="space-y-4 py-3">
          <FormField label="Assigned Team Leader">
            <Select value={selectedTlId} onChange={(e) => setSelectedTlId(e.target.value)}>
              <option value="">Select Team Leader</option>
              {data?.tlBreakdown.map((t: any) => (
                <option key={t.tlEmployeeId} value={t.tlEmployeeId}>
                  {t.tlName} ({t.teams.join(', ')})
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Action Type">
            <Select value={kind} onChange={(e) => setKind(e.target.value as any)}>
              <option value="intervention">Operational Intervention</option>
              <option value="coaching">Targeted Coaching</option>
              <option value="capacity">Capacity Adjustment</option>
              <option value="follow-up">SLA Follow-up</option>
            </Select>
          </FormField>

          <FormField label="Title / Objective">
            <Input placeholder="e.g. Clear overdue callback backlog" value={title} onChange={(e) => setTitle(e.target.value)} />
          </FormField>

          <FormField label="Specific Directives / Details">
            <Textarea
              placeholder="Actionable steps, expectations, and metrics..."
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={3}
            />
          </FormField>

          <FormField label="Due Date & Time">
            <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </FormField>

          <div className="pt-2">
            <BusyButton busy={s.busy} onClick={handleCreateAction} className="w-full">
              Commit Management Action
            </BusyButton>
          </div>
        </div>
      </Panel>
    </div>
  );
}

// ─── MG-02 & MG-10: Team Leaders Page ───
export function ManagerLeadersPage() {
  const [tab, setTab] = useState<'scorecard' | 'source-quality'>('scorecard');
  const loadTls = useCallback(() => managerApi.getTls(), []);
  const [tls] = useLoad<any[]>(loadTls);
  const [selectedTlId, setSelectedTlId] = useState<string>('EMP-003'); // Tara Iyer default
  const loadScorecard = useCallback(
    () => (selectedTlId ? managerApi.getTlScorecard(selectedTlId, 'September') : Promise.resolve(null)),
    [selectedTlId]
  );
  const [scorecardData, loadScorecardFn, { loading: scLoading, initialLoading: scInitialLoading, error: scError, clearError: clearScError }] = useLoad<any>(loadScorecard);
  const loadSources = useCallback(() => managerApi.getSourceQuality('September'), []);
  const [sourceData, loadSourcesFn, { loading: sqLoading, initialLoading: sqInitialLoading, error: sqError, clearError: clearSqError }] = useLoad<any>(loadSources);

  // MG-10 Remediate Drawer State
  const [remDrawerOpen, setRemDrawerOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState('Campaign C12');
  const [sampleSize, setSampleSize] = useState(50);
  const [remType, setRemType] = useState<'routing-change' | 'intake-correction' | 'quality-warning' | 'pause-source'>('routing-change');
  const [justification, setJustification] = useState('');
  const s = useSubmitAction();

  const handleRemediate = async () => {
    if (!justification.trim()) {
      s.setError('Provide a clear justification for source remediation.');
      return;
    }
    await s.run(async () => {
      await managerApi.createSourceRemediation({
        sourceName: selectedSource,
        cohortPeriod: 'September',
        sampleSize,
        invalidIntakeCount: 5,
        contactFailedCount: 15,
        commercialLossCount: 10,
        remediationType: remType,
        justification: justification.trim(),
      });
      setRemDrawerOpen(false);
      setJustification('');
      loadSourcesFn();
    }, 'Remediation request logged and routed to campaign owner.');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team leaders & source quality"
        subtitle="Inspect TL operating scorecards (MG-02) and review lead source quality (MG-10)"
        actions={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={tab === 'scorecard' ? 'default' : 'outline'}
              onClick={() => setTab('scorecard')}
            >
              TL Scorecards (MG-02)
            </Button>
            <Button
              size="sm"
              variant={tab === 'source-quality' ? 'default' : 'outline'}
              onClick={() => setTab('source-quality')}
            >
              Source Quality (MG-10)
            </Button>
          </div>
        }
      />

      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}
      {s.error ? (
        <div role="alert" className="rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          {s.error}
        </div>
      ) : null}

      {tab === 'scorecard' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">Select Team Leader:</span>
              <Select
                value={selectedTlId}
                onChange={(e) => setSelectedTlId(e.target.value)}
                className="w-64"
              >
                {tls?.map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.display_name} ({t.team_names.join(', ')})
                  </option>
                ))}
              </Select>
            </div>
            <Button size="sm" variant="outline" onClick={loadScorecardFn} disabled={scLoading}>
              {scLoading && scorecardData ? 'Refreshing…' : 'Refresh'}
            </Button>
          </div>

          {scError ? (
            <div role="alert" className="flex items-center justify-between rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <span>Failed to load scorecard: {scError}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={loadScorecardFn}>Retry</Button>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={clearScError}>Dismiss</Button>
              </div>
            </div>
          ) : null}

          {scInitialLoading && !scorecardData ? (
            <SkeletonRows rows={3} />
          ) : !scorecardData ? (
            <EmptyState title="No scorecard data" message="Select a team leader to view operational profile and metrics." />
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="text-base">TL Operating Profile</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground">Name:</span>
                    <p className="font-semibold">{scorecardData.tl.name}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Assigned Teams:</span>
                    <p>{scorecardData.tl.teams.join(', ')}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Email:</span>
                    <p className="font-mono text-xs">{scorecardData.tl.email}</p>
                  </div>
                  <div className="pt-2">
                    <span className="text-xs text-muted-foreground">Supervised Associates:</span>
                    <ul className="mt-1 space-y-1 text-xs">
                      {scorecardData.associates.map((a: any) => (
                        <li key={a.id} className="flex justify-between border-b pb-1">
                          <span>{a.display_name} ({a.team_name})</span>
                          <Badge tone={a.status === 'available' ? 'simulated' : 'pending'}>{a.status}</Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Operating Scorecard & Coaching</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded border p-2 text-center">
                      <p className="text-xs text-muted-foreground">Leads Scoped</p>
                      <p className="text-xl font-bold">{scorecardData.scorecard.leadsTotal}</p>
                    </div>
                    <div className="rounded border p-2 text-center">
                      <p className="text-xs text-muted-foreground">Conversions</p>
                      <p className="text-xl font-bold text-emerald-600">{scorecardData.scorecard.conversions}</p>
                    </div>
                    <div className="rounded border p-2 text-center">
                      <p className="text-xs text-muted-foreground">Task Adherence</p>
                      <p className="text-xl font-bold">{scorecardData.scorecard.taskAdherence}%</p>
                    </div>
                    <div className="rounded border p-2 text-center">
                      <p className="text-xs text-muted-foreground">1-on-1 Reviews</p>
                      <p className="text-xl font-bold text-blue-600">{scorecardData.scorecard.coachingReviewsHeld}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold mb-2">Management Actions Targeting This TL</h4>
                    {scorecardData.managementActions.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No active management actions logged.</p>
                    ) : (
                      <div className="space-y-2">
                        {scorecardData.managementActions.map((a: any) => (
                          <div key={a.id} className="flex items-center justify-between rounded border p-2 text-xs">
                            <div>
                              <Badge tone="none" className="mr-2 uppercase">{a.kind}</Badge>
                              <span className="font-medium">{a.title}</span>
                              <p className="text-muted-foreground">{a.detail}</p>
                            </div>
                            <div className="text-right">
                              <span className="text-muted-foreground">Due: {new Date(a.due_at).toLocaleDateString()}</span>
                              <p><Badge tone={a.status === 'open' ? 'pending' : 'simulated'}>{a.status}</Badge></p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={loadSourcesFn} disabled={sqLoading}>
              {sqLoading && sourceData ? 'Refreshing…' : 'Refresh'}
            </Button>
          </div>

          {sqError ? (
            <div role="alert" className="flex items-center justify-between rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <span>Failed to load source quality: {sqError}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={loadSourcesFn}>Retry</Button>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={clearSqError}>Dismiss</Button>
              </div>
            </div>
          ) : null}

          {sqInitialLoading && !sourceData ? (
            <SkeletonRows rows={3} />
          ) : !sourceData ? (
            <EmptyState title="No source quality data" message="No source quality cohort data available for September." />
          ) : (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Lead Source Quality Cohort</CardTitle>
                  <p className="text-xs text-muted-foreground">Separates invalid intake, failed contact, and commercial loss · MG-10</p>
                </div>
                <Button size="sm" onClick={() => setRemDrawerOpen(true)}>
                  Request Source Remediation
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs uppercase text-muted-foreground">
                        <th className="py-2 text-left">Source Channel</th>
                        <th>Sample Size</th>
                        <th>Invalid Intake %</th>
                        <th>Contact Rate %</th>
                        <th>Conversion %</th>
                        <th>Commercial Loss</th>
                        <th className="text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {sourceData.sources.map((s: any) => (
                        <tr key={s.source_name} className="hover:bg-muted/40">
                          <td className="py-2.5 font-medium">{s.source_name}</td>
                          <td className="text-center">{s.sample_size}</td>
                          <td className="text-center text-rose-600 font-semibold">{s.invalidRate}%</td>
                          <td className="text-center">{s.contactRate}%</td>
                          <td className="text-center text-emerald-600 font-semibold">{s.conversionRate}%</td>
                          <td className="text-center">{s.commercial_loss}</td>
                          <td className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedSource(s.source_name);
                                setSampleSize(s.sample_size);
                                setRemDrawerOpen(true);
                              }}
                            >
                              Remediate
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {sourceData.remediations.length > 0 ? (
                  <div className="mt-6 border-t pt-4">
                    <h4 className="text-sm font-semibold mb-2">Logged Remediation Requests</h4>
                    <div className="space-y-2">
                      {sourceData.remediations.map((r: any) => (
                        <div key={r.id} className="flex justify-between items-center rounded border p-2 text-xs">
                          <div>
                            <span className="font-semibold">{r.source_name}</span> · <span className="uppercase text-muted-foreground">{r.remediation_type}</span>
                            <p className="text-muted-foreground">{r.justification}</p>
                          </div>
                          <Badge tone="pending">{r.status}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )}

          {/* MG-10 Remediation Drawer */}
          <Panel
            open={remDrawerOpen}
            onClose={() => setRemDrawerOpen(false)}
            title="Request Source Remediation"
          >
            <div className="space-y-4 py-3">
              <FormField label="Source Channel">
                <Input value={selectedSource} onChange={(e) => setSelectedSource(e.target.value)} />
              </FormField>
              <FormField label="Cohort Sample Size">
                <Input type="number" value={sampleSize} onChange={(e) => setSampleSize(Number(e.target.value))} />
              </FormField>
              <FormField label="Requested Action">
                <Select value={remType} onChange={(e) => setRemType(e.target.value as any)}>
                  <option value="routing-change">Routing / Allocation Filter Change</option>
                  <option value="intake-correction">Intake Validation Hardening</option>
                  <option value="quality-warning">Issue Formal Quality Warning</option>
                  <option value="pause-source">Pause Channel Intake</option>
                </Select>
              </FormField>
              <FormField label="Justification & Evidence">
                <Textarea
                  placeholder="Explain defect patterns (e.g. invalid phone formats, spam campaigns)..."
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  rows={4}
                />
              </FormField>
              <div className="pt-2">
                <BusyButton busy={s.busy} onClick={handleRemediate} className="w-full">
                  Submit Remediation Request
                </BusyButton>
              </div>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}

// ─── MG-03, MG-04, MG-12: Capacity & Transfers Page ───
export function ManagerCapacityPage() {
  const [tab, setTab] = useState<'transfers' | 'recovery' | 'lifecycle'>('transfers');
  const loadTransfers = useCallback(() => managerApi.listTransfers(), []);
  const [transfers, loadTransfersFn, { loading: trLoading, initialLoading: trInitialLoading, error: trError, clearError: clearTrError }] = useLoad<any[]>(loadTransfers);
  const loadCapacity = useCallback(() => managerApi.getCapacity(), []);
  const [capacity, loadCapacityFn, { loading: capLoading, initialLoading: capInitialLoading, error: capError, clearError: clearCapError }] = useLoad<any>(loadCapacity);
  const loadLifecycle = useCallback(() => managerApi.getLifecycleRequests(), []);
  const [lifecycle, loadLifecycleFn, { loading: lcLoading, initialLoading: lcInitialLoading, error: lcError, clearError: clearLcError }] = useLoad<any[]>(loadLifecycle);

  // MG-03 New Transfer State
  const [sourceTeam, setSourceTeam] = useState('TEAM-WEALTH-ALPHA');
  const [destTeam, setDestTeam] = useState('TEAM-WEALTH-BETA');
  const [leadInput, setLeadInput] = useState('FV-1002, FV-1003');
  const [transferReason, setTransferReason] = useState('');

  // MG-04 Recovery Plan State
  const [planName, setPlanName] = useState('October Capacity Recovery');
  const [additionalStaff, setAdditionalStaff] = useState(1);
  const [planNotes, setPlanNotes] = useState('');

  // MG-12 Lifecycle State
  const [empId, setEmpId] = useState('EMP-001'); // Asha Rao
  const [proposedRole, setProposedRole] = useState<'SC' | 'TL' | 'MG'>('TL');
  const [effectiveDate, setEffectiveDate] = useState('2026-11-01');
  const [justification, setJustification] = useState('');
  const [handoffPlan, setHandoffPlan] = useState('');

  const s = useSubmitAction();

  const handleCreateTransfer = async () => {
    if (!transferReason.trim()) {
      s.setError('Transfer reason is required.');
      return;
    }
    const leadIds = leadInput.split(',').map((x) => x.trim()).filter(Boolean);
    await s.run(async () => {
      await managerApi.createTransfer({
        sourceTeamId: sourceTeam,
        destinationTeamId: destTeam,
        leadIds,
        reason: transferReason.trim(),
      });
      setTransferReason('');
      loadTransfersFn();
    }, 'Transfer request submitted.');
  };

  const handleDecideTransfer = async (id: string, decision: 'approved' | 'returned') => {
    await s.run(async () => {
      await managerApi.decideTransfer({
        transferId: id,
        decision,
        resolutionNotes: decision === 'approved' ? 'Approved by Manager' : 'Returned for adjustment',
      });
      loadTransfersFn();
    }, `Transfer ${decision}.`);
  };

  const handleSavePlan = async (approved: boolean) => {
    await s.run(async () => {
      await managerApi.saveCapacityPlan({
        name: planName,
        periodLabel: 'October',
        teamIds: capacity?.teams.map((t: any) => t.teamId) || [],
        currentBacklog: capacity?.totalBacklog || 0,
        availableCallers: capacity?.totalAvailableCallers || 0,
        plannedReallocations: [],
        requiredAdditionalStaff: additionalStaff,
        notes: planNotes,
        approved,
      });
      loadCapacityFn();
    }, approved ? 'Capacity plan approved and enacted.' : 'Plan draft saved.');
  };

  const handleCreateLifecycle = async () => {
    if (!justification.trim() || !handoffPlan.trim()) {
      s.setError('Justification and handoff plan are required.');
      return;
    }
    await s.run(async () => {
      await managerApi.createLifecycleRequest({
        employeeId: empId,
        proposedRole,
        effectiveDate,
        businessJustification: justification.trim(),
        handoffPlan: handoffPlan.trim(),
      });
      setJustification('');
      setHandoffPlan('');
      loadLifecycleFn();
    }, 'Lifecycle request submitted to HR & RM.');
  };

  const isCurrentTabLoading = tab === 'transfers' ? trLoading : tab === 'recovery' ? capLoading : lcLoading;
  const handleCurrentRefresh = tab === 'transfers' ? loadTransfersFn : tab === 'recovery' ? loadCapacityFn : loadLifecycleFn;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Capacity, transfers & promotions"
        subtitle="Approve cross-team transfers (MG-03), plan capacity (MG-04), and request promotions (MG-12)"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant={tab === 'transfers' ? 'default' : 'outline'} onClick={() => setTab('transfers')}>
              Lead Transfers (MG-03)
            </Button>
            <Button size="sm" variant={tab === 'recovery' ? 'default' : 'outline'} onClick={() => setTab('recovery')}>
              Capacity Plan (MG-04)
            </Button>
            <Button size="sm" variant={tab === 'lifecycle' ? 'default' : 'outline'} onClick={() => setTab('lifecycle')}>
              Employee Lifecycle (MG-12)
            </Button>
            <Button size="sm" variant="outline" onClick={handleCurrentRefresh} disabled={isCurrentTabLoading}>
              {isCurrentTabLoading ? 'Refreshing…' : 'Refresh'}
            </Button>
          </div>
        }
      />

      {trError && tab === 'transfers' ? (
        <div role="alert" className="flex items-center justify-between rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <span>Failed to load transfers: {trError}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={loadTransfersFn}>Retry</Button>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={clearTrError}>Dismiss</Button>
          </div>
        </div>
      ) : null}

      {capError && tab === 'recovery' ? (
        <div role="alert" className="flex items-center justify-between rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <span>Failed to load capacity data: {capError}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={loadCapacityFn}>Retry</Button>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={clearCapError}>Dismiss</Button>
          </div>
        </div>
      ) : null}

      {lcError && tab === 'lifecycle' ? (
        <div role="alert" className="flex items-center justify-between rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <span>Failed to load lifecycle requests: {lcError}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={loadLifecycleFn}>Retry</Button>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={clearLcError}>Dismiss</Button>
          </div>
        </div>
      ) : null}

      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}
      {s.error ? (
        <div role="alert" className="rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          {s.error}
        </div>
      ) : null}

      {tab === 'transfers' ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader><CardTitle className="text-base">Request Cross-Team Transfer</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <FormField label="Source Team">
                <Select value={sourceTeam} onChange={(e) => setSourceTeam(e.target.value)}>
                  <option value="TEAM-WEALTH-ALPHA">Wealth Alpha</option>
                  <option value="TEAM-WEALTH-BETA">Wealth Beta</option>
                  <option value="TEAM-WEALTH-GAMMA">Wealth Gamma</option>
                </Select>
              </FormField>
              <FormField label="Destination Team">
                <Select value={destTeam} onChange={(e) => setDestTeam(e.target.value)}>
                  <option value="TEAM-WEALTH-BETA">Wealth Beta</option>
                  <option value="TEAM-WEALTH-ALPHA">Wealth Alpha</option>
                  <option value="TEAM-WEALTH-GAMMA">Wealth Gamma</option>
                </Select>
              </FormField>
              <FormField label="Lead IDs (comma-separated)">
                <Input value={leadInput} onChange={(e) => setLeadInput(e.target.value)} />
              </FormField>
              <FormField label="Business Reason">
                <Textarea value={transferReason} onChange={(e) => setTransferReason(e.target.value)} placeholder="e.g. Skill match or workload rebalance" rows={3} />
              </FormField>
              <BusyButton busy={s.busy} onClick={handleCreateTransfer} className="w-full">
                Submit Transfer Request
              </BusyButton>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Pending & Decided Transfer Requests</CardTitle></CardHeader>
            <CardContent>
              {trInitialLoading && !transfers ? <SkeletonRows rows={2} /> : !transfers ? (
                <EmptyState title="No transfer data" message="Transfer records could not be loaded." />
              ) : transfers.length === 0 ? (
                <EmptyState title="No transfer requests" message="No pending cross-team lead transfers in your scope." />
              ) : (
                <div className="space-y-3">
                  {transfers.map((t: any) => (
                    <div key={t.id} className="rounded border p-3 text-sm flex flex-col sm:flex-row justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{t.source_team_name} → {t.destination_team_name}</span>
                          <Badge tone={t.status === 'approved' ? 'simulated' : t.status === 'returned' ? 'none' : 'pending'}>{t.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Leads: {Array.isArray(t.lead_ids) ? t.lead_ids.join(', ') : t.lead_ids}</p>
                        <p className="text-xs mt-1">Reason: {t.reason}</p>
                        {t.resolution_notes ? <p className="text-xs text-emerald-600 mt-1">Decision note: {t.resolution_notes}</p> : null}
                      </div>
                      {t.status === 'pending' ? (
                        <div className="flex gap-2 items-center">
                          <Button size="sm" onClick={() => handleDecideTransfer(t.id, 'approved')}>Approve</Button>
                          <Button size="sm" variant="outline" onClick={() => handleDecideTransfer(t.id, 'returned')}>Return</Button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : tab === 'recovery' ? (
        <div className="space-y-4">
          {capInitialLoading && !capacity ? <SkeletonRows rows={3} /> : !capacity ? (
            <EmptyState title="No capacity data" message="Capacity records could not be loaded." />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Card className="p-4 text-center">
                  <p className="text-xs text-muted-foreground">Total Open Backlog</p>
                  <p className="text-2xl font-bold">{capacity.totalBacklog} leads</p>
                </Card>
                <Card className="p-4 text-center">
                  <p className="text-xs text-muted-foreground">Available Callers</p>
                  <p className="text-2xl font-bold">{capacity.totalAvailableCallers}</p>
                </Card>
                <Card className="p-4 text-center">
                  <p className="text-xs text-muted-foreground">Capacity Ceiling (20/caller)</p>
                  <p className="text-2xl font-bold">{capacity.totalAvailableCallers * capacity.capacityCap} leads</p>
                </Card>
              </div>

              <Card>
                <CardHeader><CardTitle className="text-base">Team Workload & Capacity Utilization</CardTitle></CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs uppercase text-muted-foreground">
                        <th className="py-2 text-left">Team</th>
                        <th>Available Callers</th>
                        <th>Cap Ceiling</th>
                        <th>Backlog</th>
                        <th>Utilization</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {capacity.teams.map((t: any) => (
                        <tr key={t.teamId}>
                          <td className="py-2.5 font-medium">{t.teamName}</td>
                          <td className="text-center">{t.availableCallers}</td>
                          <td className="text-center">{t.capacityCeiling}</td>
                          <td className="text-center">{t.backlog}</td>
                          <td className="text-center">
                            <Badge tone={t.utilizationPct > 80 ? 'pending' : 'simulated'}>{t.utilizationPct}%</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Model Operational Recovery Plan</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <FormField label="Plan Name">
                    <Input value={planName} onChange={(e) => setPlanName(e.target.value)} />
                  </FormField>
                  <FormField label="Additional Callers Needed">
                    <Input type="number" value={additionalStaff} onChange={(e) => setAdditionalStaff(Number(e.target.value))} />
                  </FormField>
                  <FormField label="Operational Directives / Milestones">
                    <Textarea value={planNotes} onChange={(e) => setPlanNotes(e.target.value)} placeholder="Milestones, rebalancing instructions..." rows={3} />
                  </FormField>
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" onClick={() => handleSavePlan(false)}>Save Draft</Button>
                    <Button onClick={() => handleSavePlan(true)}>Approve & Enact Plan</Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader><CardTitle className="text-base">Request Transfer / Promotion</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <FormField label="Employee">
                <Select value={empId} onChange={(e) => setEmpId(e.target.value)}>
                  <option value="EMP-001">Asha Rao (Wealth Alpha)</option>
                  <option value="EMP-002">Ravi Menon (Wealth Beta)</option>
                  <option value="EMP-006">Karan Shah (Wealth Gamma)</option>
                </Select>
              </FormField>
              <FormField label="Proposed Role">
                <Select value={proposedRole} onChange={(e) => setProposedRole(e.target.value as any)}>
                  <option value="TL">Promote to Team Lead (TL)</option>
                  <option value="SC">Lateral Transfer (Caller)</option>
                </Select>
              </FormField>
              <FormField label="Effective Date">
                <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
              </FormField>
              <FormField label="Business Justification">
                <Textarea value={justification} onChange={(e) => setJustification(e.target.value)} placeholder="Performance record, readiness..." rows={3} />
              </FormField>
              <FormField label="Handoff Plan (Workload/Leads/Targets)">
                <Textarea value={handoffPlan} onChange={(e) => setHandoffPlan(e.target.value)} placeholder="Specify lead reassignment plan..." rows={3} />
              </FormField>
              <BusyButton busy={s.busy} onClick={handleCreateLifecycle} className="w-full">
                Submit Lifecycle Request
              </BusyButton>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Lifecycle Requests (HR & RM Queue)</CardTitle></CardHeader>
            <CardContent>
              {lcInitialLoading && !lifecycle ? <SkeletonRows rows={2} /> : !lifecycle ? (
                <EmptyState title="No lifecycle data" message="Lifecycle records could not be loaded." />
              ) : lifecycle.length === 0 ? (
                <EmptyState title="No lifecycle requests" message="No pending employee promotions or transfers." />
              ) : (
                <div className="space-y-3">
                  {lifecycle.map((l: any) => (
                    <div key={l.id} className="rounded border p-3 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold">{l.employee_name} → {l.proposed_role}</span>
                        <Badge tone="pending">{l.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Effective: {l.effective_date}</p>
                      <p className="text-xs mt-1">Justification: {l.business_justification}</p>
                      <p className="text-xs text-muted-foreground mt-1">Handoff: {l.handoff_plan}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── MG-05: Targets Page ───
export function ManagerTargetsPage() {
  const loadTargets = useCallback(() => managerApi.getTargets('October'), []);
  const [data, load, { loading, initialLoading, error, clearError }] = useLoad<any>(loadTargets);
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const s = useSubmitAction();

  useEffect(() => {
    if (data?.tls) {
      setAllocations((prev) => {
        if (Object.keys(prev).length > 0) return prev;
        const init: Record<string, number> = {};
        const count = data.tls.length || 1;
        const share = Math.floor(data.target.approvedParentTarget / count);
        data.tls.forEach((t: any) => {
          init[t.id] = share;
        });
        return init;
      });
    }
  }, [data]);

  const allocatedSum = Object.values(allocations).reduce((a, b) => a + (Number(b) || 0), 0);
  const remainder = (data?.target.approvedParentTarget || 100) - allocatedSum;

  const handleSave = async (publish: boolean) => {
    if (remainder < 0) {
      s.setError('Allocations exceed approved parent target.');
      return;
    }
    await s.run(async () => {
      const tlAllocList = data.tls.map((t: any) => ({
        teamId: t.team_ids[0] || 'TEAM-WEALTH-ALPHA',
        tlEmployeeId: t.id,
        allocatedValue: allocations[t.id] || 0,
      }));
      await managerApi.allocateTargets({
        periodLabel: 'October',
        metric: 'approved-wins',
        approvedParentTarget: data.target.approvedParentTarget,
        tlAllocations: tlAllocList,
        publish,
      });
      load();
    }, publish ? 'Targets published down to Team Leads.' : 'Target allocations saved as draft.');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Target distribution to TLs"
        subtitle="Allocate approved Manager target to Team Leads with explicit remainder reconciliation · MG-05"
        actions={
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            {loading && data ? 'Refreshing…' : 'Refresh'}
          </Button>
        }
      />

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
      {s.error ? (
        <div role="alert" className="rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          {s.error}
        </div>
      ) : null}

      {initialLoading && !data ? <SkeletonRows rows={3} /> : !data ? (
        <EmptyState title="No target data" message="Target records could not be loaded for October." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader><CardTitle className="text-base">Parent Target Reconciliation</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded bg-muted p-3">
                <span className="text-xs text-muted-foreground">Approved Parent Target:</span>
                <p className="text-3xl font-bold text-foreground">{data.target.approvedParentTarget} wins</p>
                <p className="text-xs text-muted-foreground mt-1">Period: October · Metric: Approved Wins</p>
              </div>

              <div className="space-y-2 border-t pt-3">
                <div className="flex justify-between text-sm">
                  <span>Total Allocated:</span>
                  <span className="font-semibold">{allocatedSum} wins</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Unallocated Remainder:</span>
                  <span className={`font-bold ${remainder < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {remainder} wins
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Notice: Unallocated remainder is visible and never silently distributed.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="w-1/2" onClick={() => handleSave(false)}>Save Draft</Button>
                <Button className="w-1/2" onClick={() => handleSave(true)} disabled={remainder < 0}>Publish</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Team Leader Allocations</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.tls.map((tl: any) => (
                  <div key={tl.id} className="rounded border p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <p className="font-semibold">{tl.display_name}</p>
                      <p className="text-xs text-muted-foreground">Teams: {tl.team_names.join(', ')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">Allocation:</span>
                      <Input
                        type="number"
                        className="w-28 text-right font-bold"
                        value={allocations[tl.id] ?? 0}
                        onChange={(e) => setAllocations({ ...allocations, [tl.id]: Number(e.target.value) })}
                      />
                      <span className="text-xs text-muted-foreground">wins</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── MG-06 & MG-07: Forecasts Page ───
export function ManagerForecastsPage() {
  const [tab, setTab] = useState<'review-tl' | 'submit-rm'>('review-tl');
  const loadTl = useCallback(() => managerApi.getForecasts('October'), []);
  const [tlForecasts, loadTlFn, { loading: tlLoading, initialLoading: tlInitialLoading, error: tlError, clearError: clearTlError }] = useLoad<any[]>(loadTl);
  const loadRollup = useCallback(() => managerApi.getForecastRollup('October'), []);
  const [rollup, loadRollupFn, { loading: rollupLoading, initialLoading: rollupInitialLoading, error: rollupError, clearError: clearRollupError }] = useLoad<any>(loadRollup);

  // MG-06 Decide State
  const [decideForecastId, setDecideForecastId] = useState('');
  const [feedback, setFeedback] = useState('');

  // MG-07 Submit State
  const [adj, setAdj] = useState(0);
  const [riskNotes, setRiskNotes] = useState('Capacity constraints in Alpha; ageing lead backlog in Beta.');
  const [overrideReason, setOverrideReason] = useState('Adjusted run-rate based on upcoming marketing campaign.');
  const s = useSubmitAction();

  const handleDecide = async (decision: 'accepted' | 'returned') => {
    if (!feedback.trim()) {
      s.setError('Feedback or correction details are required.');
      return;
    }
    await s.run(async () => {
      await managerApi.decideForecast({
        forecastId: decideForecastId,
        decision,
        feedback: feedback.trim(),
      });
      setDecideForecastId('');
      setFeedback('');
      loadTlFn();
      loadRollupFn();
    }, `Forecast ${decision}.`);
  };

  const handleSubmitRm = async () => {
    if (!riskNotes.trim()) {
      s.setError('Risk notes are required.');
      return;
    }
    const bottomUp = rollup?.bottomUpRevenue || 0;
    const adjusted = bottomUp + adj;
    await s.run(async () => {
      await managerApi.submitForecast({
        periodLabel: 'October',
        bottomUpRevenue: bottomUp,
        managementAdjustment: adj,
        adjustedRevenue: adjusted,
        currency: 'INR',
        acceptedForecastIds: rollup?.acceptedForecasts.map((f: any) => f.id) || ['DEFAULT'],
        overrideReason: adj !== 0 ? overrideReason : undefined,
        riskNotes: riskNotes.trim(),
      });
      loadRollupFn();
    }, 'Manager forecast frozen and submitted to Regional Manager.');
  };

  const isCurrentTabLoading = tab === 'review-tl' ? tlLoading : rollupLoading;
  const handleCurrentRefresh = tab === 'review-tl' ? loadTlFn : loadRollupFn;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline & forecast"
        subtitle="Challenge and approve TL forecasts (MG-06) and submit consolidated Manager forecast to RM (MG-07)"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant={tab === 'review-tl' ? 'default' : 'outline'} onClick={() => setTab('review-tl')}>
              Review TL Forecasts (MG-06)
            </Button>
            <Button size="sm" variant={tab === 'submit-rm' ? 'default' : 'outline'} onClick={() => setTab('submit-rm')}>
              Consolidated Submission (MG-07)
            </Button>
            <Button size="sm" variant="outline" onClick={handleCurrentRefresh} disabled={isCurrentTabLoading}>
              {isCurrentTabLoading ? 'Refreshing…' : 'Refresh'}
            </Button>
          </div>
        }
      />

      {tlError && tab === 'review-tl' ? (
        <div role="alert" className="flex items-center justify-between rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <span>Failed to load TL forecasts: {tlError}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={loadTlFn}>Retry</Button>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={clearTlError}>Dismiss</Button>
          </div>
        </div>
      ) : null}

      {rollupError && tab === 'submit-rm' ? (
        <div role="alert" className="flex items-center justify-between rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <span>Failed to load forecast consolidation: {rollupError}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={loadRollupFn}>Retry</Button>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={clearRollupError}>Dismiss</Button>
          </div>
        </div>
      ) : null}

      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}
      {s.error ? (
        <div role="alert" className="rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          {s.error}
        </div>
      ) : null}

      {tab === 'review-tl' ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Submitted Team Lead Forecasts (October)</CardTitle></CardHeader>
          <CardContent>
            {tlInitialLoading && !tlForecasts ? <SkeletonRows rows={2} /> : !tlForecasts ? (
              <EmptyState title="No forecast data" message="Forecasts could not be loaded." />
            ) : tlForecasts.length === 0 ? (
              <EmptyState title="No forecasts submitted" message="Team leads have not submitted forecasts for October yet." />
            ) : (
              <div className="space-y-4">
                {tlForecasts.map((f: any) => (
                  <div key={f.id} className="rounded border p-4 text-sm space-y-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-bold">{f.tl_name}</span> · <span className="text-muted-foreground">{f.team_name}</span>
                        <Badge tone="none" className="ml-2 uppercase">{f.category}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-foreground">₹{Number(f.expected_revenue).toLocaleString()}</span>
                        <Badge tone={f.manager_decision === 'accepted' ? 'simulated' : f.manager_decision === 'returned' ? 'none' : 'pending'}>
                          {f.manager_decision || 'Pending Review'}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">Assumptions: {f.assumptions || 'Standard pipeline velocity'}</p>
                    {f.risk_notes ? <p className="text-xs text-amber-600">Risk Notes: {f.risk_notes}</p> : null}
                    {f.manager_feedback ? <p className="text-xs text-emerald-600">Manager Note: {f.manager_feedback}</p> : null}

                    {decideForecastId === f.id ? (
                      <div className="mt-3 border-t pt-3 space-y-2">
                        <Textarea
                          placeholder="Provide specific feedback or reason for return/acceptance..."
                          value={feedback}
                          onChange={(e) => setFeedback(e.target.value)}
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleDecide('accepted')}>Accept Version</Button>
                          <Button size="sm" variant="outline" onClick={() => handleDecide('returned')}>Return with Corrections</Button>
                          <Button size="sm" variant="ghost" onClick={() => setDecideForecastId('')}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-2">
                        <Button size="sm" variant="outline" onClick={() => { setDecideForecastId(f.id); setFeedback(''); }}>
                          Review & Challenge
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader><CardTitle className="text-base">Consolidation Summary</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded bg-muted p-3">
                <p className="text-xs text-muted-foreground">Bottom-up Total (Accepted TLs):</p>
                <p className="text-2xl font-bold">₹{(rollup?.bottomUpRevenue || 0).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">Accepted Forecasts: {rollup?.acceptedCount || 0}</p>
              </div>

              <div className="space-y-2 border-t pt-3">
                <FormField label="Management Adjustment (+/- ₹)">
                  <Input type="number" value={adj} onChange={(e) => setAdj(Number(e.target.value))} />
                </FormField>
                <div className="flex justify-between font-bold text-base pt-2">
                  <span>Adjusted Forecast:</span>
                  <span className="text-emerald-700">₹{((rollup?.bottomUpRevenue || 0) + adj).toLocaleString()}</span>
                </div>
              </div>

              <FormField label="Adjustment Justification">
                <Textarea value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} rows={2} />
              </FormField>

              <FormField label="Risk & Ageing Analysis">
                <Textarea value={riskNotes} onChange={(e) => setRiskNotes(e.target.value)} rows={3} />
              </FormField>

              <BusyButton busy={s.busy} onClick={handleSubmitRm} className="w-full">
                Freeze & Submit to RM
              </BusyButton>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Accepted Forecast Submissions</CardTitle></CardHeader>
            <CardContent>
              {rollupInitialLoading && !rollup ? <SkeletonRows rows={2} /> : !rollup ? (
                <EmptyState title="No consolidation data" message="Consolidated forecast data could not be loaded." />
              ) : rollup.acceptedForecasts.length === 0 ? (
                <EmptyState title="No accepted forecasts" message="Accept TL submissions in the Review tab first before consolidating." />
              ) : (
                <div className="space-y-3">
                  {rollup.acceptedForecasts.map((f: any) => (
                    <div key={f.id} className="rounded border p-3 flex justify-between items-center text-sm">
                      <div>
                        <p className="font-semibold">{f.tl_name} ({f.team_name})</p>
                        <p className="text-xs text-muted-foreground">Version: {f.version} · Category: {f.category}</p>
                      </div>
                      <span className="font-bold text-base">₹{Number(f.expected_revenue).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── MG-08 & MG-09: Exceptions Page ───
export function ManagerExceptionsPage() {
  const [tab, setTab] = useState<'sla-breach' | 'commercial'>('sla-breach');
  const loadBreaches = useCallback(() => managerApi.getSlaBreaches(), []);
  const [breaches, loadBreachesFn, { loading: brLoading, initialLoading: brInitialLoading, error: brError, clearError: clearBrError }] = useLoad<any[]>(loadBreaches);
  const loadExceptions = useCallback(() => managerApi.getCommercialExceptions(), []);
  const [exceptions, loadExceptionsFn, { loading: excLoading, initialLoading: excInitialLoading, error: excError, clearError: clearExcError }] = useLoad<any[]>(loadExceptions);

  // MG-08 Resolution State
  const [activeEscId, setActiveEscId] = useState('');
  const [resolutionPlan, setResolutionPlan] = useState('');
  const [actionType, setActionType] = useState<'corrective-action' | 'capacity-change' | 'coaching' | 'escalate-to-rm'>('corrective-action');

  // MG-09 Decision State
  const [activeExcId, setActiveExcId] = useState('');
  const [decisionNotes, setDecisionNotes] = useState('');

  const s = useSubmitAction();

  const handleResolveSla = async () => {
    if (!resolutionPlan.trim()) {
      s.setError('Resolution plan is required.');
      return;
    }
    await s.run(async () => {
      await managerApi.resolveSlaBreach({
        escalationId: activeEscId,
        actionType,
        resolutionPlan: resolutionPlan.trim(),
        deadlineHours: 48,
      });
      setActiveEscId('');
      setResolutionPlan('');
      loadBreachesFn();
    }, 'SLA recovery action logged.');
  };

  const handleDecideException = async (decision: 'approved' | 'rejected' | 'escalated_to_rm') => {
    if (!decisionNotes.trim()) {
      s.setError('Decision notes are required.');
      return;
    }
    const target = exceptions?.find((x: any) => x.id === activeExcId);
    if (decision === 'approved' && target && !target.delegated_limit_met) {
      s.setError('Unauthorized: Cannot approve commercial exception that exceeds Manager delegated authority limit [Deck P320 Category 3]. Escalate to Regional Manager.');
      return;
    }
    await s.run(async () => {
      await managerApi.decideCommercialException({
        exceptionId: activeExcId,
        decision,
        decisionNotes: decisionNotes.trim(),
      });
      setActiveExcId('');
      setDecisionNotes('');
      loadExceptionsFn();
    }, `Commercial exception ${decision}.`);
  };

  const isCurrentTabLoading = tab === 'sla-breach' ? brLoading : excLoading;
  const handleCurrentRefresh = tab === 'sla-breach' ? loadBreachesFn : loadExceptionsFn;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exceptions & escalation resolution"
        subtitle="Resolve repeated SLA failures (MG-08) and approve delegated commercial exceptions (MG-09)"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant={tab === 'sla-breach' ? 'default' : 'outline'} onClick={() => setTab('sla-breach')}>
              SLA Breach Recovery (MG-08)
            </Button>
            <Button size="sm" variant={tab === 'commercial' ? 'default' : 'outline'} onClick={() => setTab('commercial')}>
              Commercial Exceptions (MG-09)
            </Button>
            <Button size="sm" variant="outline" onClick={handleCurrentRefresh} disabled={isCurrentTabLoading}>
              {isCurrentTabLoading ? 'Refreshing…' : 'Refresh'}
            </Button>
          </div>
        }
      />

      {brError && tab === 'sla-breach' ? (
        <div role="alert" className="flex items-center justify-between rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <span>Failed to load SLA breaches: {brError}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={loadBreachesFn}>Retry</Button>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={clearBrError}>Dismiss</Button>
          </div>
        </div>
      ) : null}

      {excError && tab === 'commercial' ? (
        <div role="alert" className="flex items-center justify-between rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <span>Failed to load commercial exceptions: {excError}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={loadExceptionsFn}>Retry</Button>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={clearExcError}>Dismiss</Button>
          </div>
        </div>
      ) : null}

      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}
      {s.error ? (
        <div role="alert" className="rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          {s.error}
        </div>
      ) : null}

      {tab === 'sla-breach' ? (
        <Card>
          <CardHeader><CardTitle className="text-base">SLA Breaches & Overdue Task Escalations</CardTitle></CardHeader>
          <CardContent>
            {brInitialLoading && !breaches ? <SkeletonRows rows={2} /> : !breaches ? (
              <EmptyState title="No SLA breach data" message="SLA breach records could not be loaded." />
            ) : breaches.length === 0 ? (
              <EmptyState title="No active SLA breaches" message="All tasks and team SLAs are currently healthy." />
            ) : (
              <div className="space-y-3">
                {breaches.map((b: any) => (
                  <div key={b.id} className="rounded border p-3 text-sm space-y-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-semibold">{b.lead_name}</span> ({b.team_name}) · Owner: {b.caller_name}
                        <Badge tone="pending" className="ml-2 uppercase">{b.severity}</Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">{new Date(b.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-xs">Reason: {b.reason}</p>

                    {activeEscId === b.id ? (
                      <div className="mt-3 border-t pt-3 space-y-3">
                        <FormField label="Resolution Action">
                          <Select value={actionType} onChange={(e) => setActionType(e.target.value as any)}>
                            <option value="corrective-action">Assign Corrective Action (48h)</option>
                            <option value="capacity-change">Capacity Reallocation</option>
                            <option value="coaching">Targeted Coaching Session</option>
                            <option value="escalate-to-rm">Escalate to Regional Manager (Outage/Policy)</option>
                          </Select>
                        </FormField>
                        <FormField label="Recovery Directives">
                          <Textarea value={resolutionPlan} onChange={(e) => setResolutionPlan(e.target.value)} rows={2} />
                        </FormField>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleResolveSla}>Commit Resolution</Button>
                          <Button size="sm" variant="ghost" onClick={() => setActiveEscId('')}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => { setActiveEscId(b.id); setResolutionPlan(''); }}>
                        Resolve Breach
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <CardTitle className="text-base">Delegated Commercial Exceptions (MG-09)</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Compare requested terms against standard product terms. Approve within explicit delegated authority or escalate to Regional Manager.
                </p>
              </div>
              <Badge tone="none" className="text-[11px] whitespace-nowrap">
                Illustrative Policy [Deck P320 Cat 3]
              </Badge>
            </div>
            <div className="mt-2 rounded bg-muted/60 p-2 text-xs text-muted-foreground border">
              <span className="font-semibold text-foreground">Delegated Authority Rule:</span> Manager delegated limit is verified server-side. Requests exceeding threshold cannot be approved by Manager and must be escalated to Regional Manager (RM) or rejected.
            </div>
          </CardHeader>
          <CardContent>
            {excInitialLoading && !exceptions ? <SkeletonRows rows={2} /> : !exceptions ? (
              <EmptyState title="No commercial exception data" message="Commercial exceptions could not be loaded." />
            ) : exceptions.length === 0 ? (
              <EmptyState title="No commercial exceptions" message="No pending commercial or fee exception requests." />
            ) : (
              <div className="space-y-4">
                {exceptions.map((e: any) => {
                  const isPending = e.status === 'pending';
                  const limitMet = e.delegated_limit_met !== false;
                  return (
                    <div key={e.id} className="rounded border p-4 text-sm space-y-3 bg-card">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground">{e.lead_name || 'Prospect'}</span>
                            <Badge tone="none">{e.exception_type}</Badge>
                            {limitMet ? (
                              <Badge tone="simulated">Within Manager Limit</Badge>
                            ) : (
                              <Badge tone="pending" className="border-amber-500/50 text-amber-700 dark:text-amber-300">
                                Exceeds Manager Limit
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">Requested by: {e.requester_name}</p>
                        </div>
                        <Badge tone={e.status === 'approved' ? 'simulated' : e.status === 'rejected' ? 'none' : e.status === 'escalated_to_rm' ? 'pending' : 'pending'}>
                          {e.status}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-muted/40 p-2.5 rounded border">
                        <div><span className="text-muted-foreground font-medium">Standard Terms:</span> <span className="text-foreground">{e.standard_terms}</span></div>
                        <div><span className="text-muted-foreground font-medium">Requested Terms:</span> <span className="font-semibold text-foreground">{e.requested_terms}</span></div>
                      </div>

                      <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Business Justification:</span> {e.business_justification}</p>

                      {!limitMet && isPending ? (
                        <div className="rounded border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-800 dark:text-amber-200">
                          ⚠️ Requested terms exceed Manager delegated authority threshold. Server-side guard prevents Manager approval; you must escalate to Regional Manager (RM) or reject.
                        </div>
                      ) : null}

                      {!isPending ? (
                        <div className="text-xs text-muted-foreground italic border-t pt-2 mt-2">
                          Finalized as <span className="font-semibold">{e.status}</span> on {new Date(e.decided_at || e.created_at).toLocaleString()}
                          {e.decision_notes ? ` · Decision Notes: "${e.decision_notes}"` : ''}
                        </div>
                      ) : activeExcId === e.id ? (
                        <div className="mt-3 border-t pt-3 space-y-3">
                          <FormField label="Decision Rationale & Limit Justification">
                            <Textarea
                              placeholder="Document decision notes and delegated limit verification..."
                              value={decisionNotes}
                              onChange={(ev) => setDecisionNotes(ev.target.value)}
                              rows={2}
                            />
                          </FormField>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              disabled={!limitMet}
                              title={!limitMet ? "Approval blocked: Exceeds Manager delegated limit. Escalate to RM." : undefined}
                              onClick={() => handleDecideException('approved')}
                            >
                              Approve (Within Limit)
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleDecideException('rejected')}>
                              Reject
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleDecideException('escalated_to_rm')}>
                              Escalate to Regional Manager
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setActiveExcId('')}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="pt-1">
                          <Button size="sm" variant="outline" onClick={() => { setActiveExcId(e.id); setDecisionNotes(''); }}>
                            Review Exception Decision
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── MG-11: Reviews Page ───
export function ManagerReviewsPage() {
  const loadTls = useCallback(() => managerApi.getTls(), []);
  const [tls] = useLoad<any[]>(loadTls);
  const [selectedTlId, setSelectedTlId] = useState('EMP-003'); // Tara Iyer default
  const loadReviews = useCallback(() => managerApi.getReviews(selectedTlId), [selectedTlId]);
  const [reviews, loadReviewsFn, { loading: revLoading, initialLoading: revInitialLoading, error: revError, clearError: clearRevError }] = useLoad<any[]>(loadReviews);

  const [strengths, setStrengths] = useState('Strong team discipline and high task adherence across Alpha.');
  const [blockers, setBlockers] = useState('Capacity pinch during surge campaigns; ageing follow-up backlog.');
  const [goal, setGoal] = useState('Reduce overdue SLA rate below 3%');
  const [targetDate, setTargetDate] = useState('2026-10-31');
  const s = useSubmitAction();

  const handleCreateReview = async () => {
    if (!strengths.trim() || !blockers.trim() || !goal.trim()) {
      s.setError('Strengths, blockers, and commitment goal are required.');
      return;
    }
    await s.run(async () => {
      await managerApi.createReview({
        subjectTlEmployeeId: selectedTlId,
        periodLabel: 'September',
        strengths: strengths.trim(),
        blockers: blockers.trim(),
        commitments: [{ dimension: 'Task SLA', goal: goal.trim(), targetDate }],
        supportNeeded: 'Additional caller allocation from pool',
      });
      loadReviewsFn();
    }, 'TL performance review completed and commitments distributed.');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team lead performance reviews"
        subtitle="Versioned TL reviews, scorecard reflection, and visible commitments · MG-11"
        actions={
          <Button size="sm" variant="outline" onClick={loadReviewsFn} disabled={revLoading}>
            {revLoading && reviews ? 'Refreshing…' : 'Refresh'}
          </Button>
        }
      />

      {revError ? (
        <div role="alert" className="flex items-center justify-between rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <span>Failed to load reviews: {revError}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={loadReviewsFn}>Retry</Button>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={clearRevError}>Dismiss</Button>
          </div>
        </div>
      ) : null}

      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}
      {s.error ? (
        <div role="alert" className="rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          {s.error}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Select Reviewee:</span>
        <Select value={selectedTlId} onChange={(e) => setSelectedTlId(e.target.value)} className="w-64">
          {tls?.map((t: any) => (
            <option key={t.id} value={t.id}>{t.display_name} ({t.team_names.join(', ')})</option>
          ))}
        </Select>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Conduct Performance Review (September)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <FormField label="Observed Strengths">
              <Textarea value={strengths} onChange={(e) => setStrengths(e.target.value)} rows={3} />
            </FormField>
            <FormField label="Blockers & Challenges">
              <Textarea value={blockers} onChange={(e) => setBlockers(e.target.value)} rows={3} />
            </FormField>
            <div className="grid grid-cols-2 gap-2">
              <FormField label="Action Commitment">
                <Input value={goal} onChange={(e) => setGoal(e.target.value)} />
              </FormField>
              <FormField label="Target Date">
                <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
              </FormField>
            </div>
            <BusyButton busy={s.busy} onClick={handleCreateReview} className="w-full">
              Complete Review & Distribute Commitments
            </BusyButton>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Review History & Commitments</CardTitle></CardHeader>
          <CardContent>
            {revInitialLoading && !reviews ? <SkeletonRows rows={2} /> : !reviews ? (
              <EmptyState title="No review data" message="Reviews could not be loaded." />
            ) : reviews.length === 0 ? (
              <EmptyState title="No prior reviews" message="No previous reviews recorded for this TL." />
            ) : (
              <div className="space-y-3">
                {reviews.map((r: any) => (
                  <div key={r.id} className="rounded border p-3 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="font-semibold">{r.tl_name} · Period: {r.period}</span>
                      <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                    {r.scorecard ? (
                      <p className="text-xs text-muted-foreground">
                        {typeof r.scorecard === 'string' ? r.scorecard : JSON.stringify(r.scorecard)}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── MG-13: Reports & Meeting Pack Page ───
export function ManagerReportsPage() {
  const [period, setPeriod] = useState<MgPeriod>('month-to-date');
  const loadPreview = useCallback(() => managerApi.previewMeetingPack(period), [period]);
  const [preview, loadPreviewFn, { loading: prevLoading, initialLoading: prevInitialLoading, error: prevError, clearError: clearPrevError }] = useLoad<any>(loadPreview);
  const loadSchedules = useCallback(() => managerApi.getSchedules(), []);
  const [schedules, loadSchedulesFn, { loading: schedLoading, initialLoading: schedInitialLoading, error: schedError, clearError: clearSchedError }] = useLoad<any[]>(loadSchedules);

  const [schedName, setSchedName] = useState('Weekly Regional Meeting Pack');
  const [cadence, setCadence] = useState<'weekly' | 'monthly'>('weekly');
  const [recipients, setRecipients] = useState('neel@finverse.demo, rm@finverse.demo');
  const s = useSubmitAction();

  const handleExportPdf = async () => {
    await s.run(async () => {
      const res = await managerApi.exportMeetingPack(period);
      // Trigger browser download via direct URL
      window.open(`/api/manager/meeting-pack/download/${res.id}`, '_blank');
    }, 'Manager Meeting Pack generated and download started.');
  };

  const handleCreateSchedule = async () => {
    const list = recipients.split(',').map((x) => x.trim()).filter(Boolean);
    await s.run(async () => {
      await managerApi.createSchedule({
        name: schedName,
        cadence,
        period: 'month-to-date',
        recipients: list,
      });
      loadSchedulesFn();
    }, 'Recurring schedule created.');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manager meeting pack & schedules"
        subtitle="Audited binary PDF export and permission-checked recurring schedules · MG-13"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={period} onChange={(e) => setPeriod(e.target.value as MgPeriod)} className="w-36 text-xs">
              <option value="this-week">This week</option>
              <option value="month-to-date">Month to date</option>
              <option value="quarter-to-date">Quarter to date</option>
              <option value="last-month">Last month</option>
            </Select>
            <Button size="sm" variant="outline" onClick={loadPreviewFn} disabled={prevLoading}>
              {prevLoading && preview ? 'Refreshing…' : 'Refresh'}
            </Button>
            <BusyButton busy={s.busy} onClick={handleExportPdf}>
              Export Meeting Pack (PDF)
            </BusyButton>
          </div>
        }
      />

      {prevError ? (
        <div role="alert" className="flex items-center justify-between rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <span>Failed to load preview: {prevError}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={loadPreviewFn}>Retry</Button>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={clearPrevError}>Dismiss</Button>
          </div>
        </div>
      ) : null}

      {schedError ? (
        <div role="alert" className="flex items-center justify-between rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <span>Failed to load schedules: {schedError}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={loadSchedulesFn}>Retry</Button>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={clearSchedError}>Dismiss</Button>
          </div>
        </div>
      ) : null}

      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}
      {s.error ? (
        <div role="alert" className="rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          {s.error}
        </div>
      ) : null}

      {prevInitialLoading && !preview ? <SkeletonRows rows={3} /> : !preview ? (
        <EmptyState title="No preview available" message="Meeting pack preview could not be generated." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Pack Preview — Executive Summary & TL Appendix</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {preview.kpis.map((k: any) => (
                  <div key={k.key} className="rounded border p-2">
                    <p className="text-xs text-muted-foreground">{k.label}</p>
                    <p className="text-lg font-bold">{k.value}</p>
                  </div>
                ))}
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Team Leader Appendix Reconciliation</h4>
                <div className="space-y-2">
                  {preview.tlAppendix.map((tl: any) => (
                    <div key={tl.tlEmployeeId} className="flex justify-between items-center rounded border p-2 text-xs">
                      <div>
                        <span className="font-semibold">{tl.tlName}</span> ({tl.teams.join(', ')})
                        <p className="text-muted-foreground">Pace: {tl.targetPace} · Overdue: {tl.overdueTasks}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold">{tl.wins} Wins</span>
                        <p className="text-muted-foreground">{tl.openBacklog} leads</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-1">
            <CardHeader><CardTitle className="text-base">Recurring Report Schedules</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <FormField label="Schedule Name">
                <Input value={schedName} onChange={(e) => setSchedName(e.target.value)} />
              </FormField>
              <FormField label="Cadence">
                <Select value={cadence} onChange={(e) => setCadence(e.target.value as any)}>
                  <option value="weekly">Weekly (Mon 09:00 IST)</option>
                  <option value="monthly">Monthly (1st 09:00 IST)</option>
                </Select>
              </FormField>
              <FormField label="Recipients (comma-separated)">
                <Input value={recipients} onChange={(e) => setRecipients(e.target.value)} />
              </FormField>
              <BusyButton busy={s.busy} onClick={handleCreateSchedule} className="w-full">
                Save Schedule
              </BusyButton>

              {schedules && schedules.length > 0 ? (
                <div className="border-t pt-3 space-y-2">
                  <h5 className="text-xs font-semibold">Active Schedules</h5>
                  {schedules.map((sch: any) => (
                    <div key={sch.id} className="text-xs rounded border p-2">
                      <p className="font-medium">{sch.name}</p>
                      <p className="text-muted-foreground">{sch.cadence} · Next: {new Date(sch.next_run_at).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
