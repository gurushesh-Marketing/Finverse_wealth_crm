import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { regionalApi } from '../lib/regional-api';
import { PageHeader, Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input, Textarea } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Panel, BusyButton } from '../components/ui/panel';
import { EmptyState, SkeletonRows, SuccessNote } from '../components/ui/states';
import type { RmPeriod } from '@finverse/contracts';

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

// ─── RM-01: Region Overview ───
export function RegionalOverviewPage() {
  const [period, setPeriod] = useState<RmPeriod>('month-to-date');
  const [data, load] = useLoad<any>(() => regionalApi.overview(period));
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
        ownerEmployeeId: 'EMP-008',
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
        title="Region overview"
        subtitle="Regional attainment, manager contribution comparison, backlog and risk posture · RM-01"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={period} onChange={(e) => setPeriod(e.target.value as RmPeriod)} className="w-36 text-xs">
              <option value="today">Today</option>
              <option value="this-week">This week</option>
              <option value="month-to-date">Month to date</option>
              <option value="last-month">Last month</option>
              <option value="quarter-to-date">Quarter to date</option>
            </Select>
            <Button variant="outline" size="sm" onClick={() => setActionDrawerOpen(true)}>
              + Regional intervention
            </Button>
          </div>
        }
      />

      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}

      {!data ? (
        <SkeletonRows rows={4} />
      ) : (
        <>
          {/* Executive Regional Summary Cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card className="border-border/60 bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground">Parent NM Target</p>
              <p className="mt-1 font-heading text-2xl font-bold text-foreground">
                {data.target?.parentTarget} <span className="text-xs font-normal text-muted-foreground">wins</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{data.target?.periodLabel}</p>
            </Card>

            <Card className="border-border/60 bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground">Achieved Wins</p>
              <p className="mt-1 font-heading text-2xl font-bold text-primary">
                {data.target?.achievedWins} <span className="text-xs font-normal text-muted-foreground">wins</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{data.target?.attainmentPercent}% attainment pace</p>
            </Card>

            <Card className="border-border/60 bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground">Regional Backlog (&gt;48h)</p>
              <p className="mt-1 font-heading text-2xl font-bold text-amber-600 dark:text-amber-400">
                {data.backlog?.olderThan48h} <span className="text-xs font-normal text-muted-foreground">leads</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{data.backlog?.olderThan7d} older than 7 days</p>
            </Card>

            <Card className="border-border/60 bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground">Open Escalations</p>
              <p className="mt-1 font-heading text-2xl font-bold text-destructive">
                {data.escalationsSummary?.openCount}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{data.escalationsSummary?.highCriticalCount} high/critical</p>
            </Card>
          </div>

          {/* Manager Contribution Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-semibold">Manager contributions &amp; ranking</CardTitle>
                <p className="text-xs text-muted-foreground">Authorised managers in {data.region?.name}</p>
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
                  {data.managers?.map((m: any) => (
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
                {data.sourceMix?.map((s: any) => (
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
                  <span className="font-semibold text-foreground">{data.backlog?.uncontacted} leads</span>
                </div>
                <div className="flex items-center justify-between border-b border-border/40 pb-2">
                  <span className="text-muted-foreground">Active Follow-up Queue</span>
                  <span className="font-semibold text-foreground">{data.backlog?.inFollowUp} leads</span>
                </div>
                <div className="flex items-center justify-between border-b border-border/40 pb-2">
                  <span className="text-muted-foreground">Breaching 48h SLA</span>
                  <span className="font-semibold text-amber-600 dark:text-amber-400">{data.backlog?.olderThan48h} leads</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Severe Ageing (&gt;7 days)</span>
                  <span className="font-semibold text-destructive">{data.backlog?.olderThan7d} leads</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
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

// ─── RM-02 & RM-09: Managers & Reviews ───
export function RegionalManagersPage() {
  const [overview] = useLoad<any>(() => regionalApi.overview());
  const [selectedManagerId, setSelectedManagerId] = useState<string>('EMP-007');
  const [scorecard, loadScorecard] = useLoad<any>(() => regionalApi.getManagerScorecard(selectedManagerId));
  const [reviewModalOpen, setReviewModalOpen] = useState(false);

  // Review Form state
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
      loadScorecard();
    }, 'Manager performance review recorded successfully.');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Managers &amp; reviews"
        subtitle="Review manager scorecards, operational health vs sales performance, and run governance reviews · RM-02, RM-09"
        actions={
          <Button size="sm" onClick={() => setReviewModalOpen(true)}>
            + Run Manager Review (RM-09)
          </Button>
        }
      />

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

      {!scorecard ? (
        <SkeletonRows rows={4} />
      ) : (
        <div className="space-y-6">
          {/* Scorecard Header Cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card className="border-border/60 bg-card p-4">
              <p className="text-xs text-muted-foreground">Target Wins</p>
              <p className="mt-1 font-heading text-2xl font-bold">{scorecard.performance?.targetWins}</p>
              <p className="mt-1 text-xs text-muted-foreground">Parent allocated</p>
            </Card>

            <Card className="border-border/60 bg-card p-4">
              <p className="text-xs text-muted-foreground">Achieved Wins</p>
              <p className="mt-1 font-heading text-2xl font-bold text-primary">{scorecard.performance?.achievedWins}</p>
              <p className="mt-1 text-xs text-muted-foreground">{scorecard.performance?.attainmentRate}% attainment</p>
            </Card>

            <Card className="border-border/60 bg-card p-4">
              <p className="text-xs text-muted-foreground">Open Pipeline</p>
              <p className="mt-1 font-heading text-2xl font-bold">{scorecard.performance?.openPipeline}</p>
              <p className="mt-1 text-xs text-muted-foreground">Across assigned teams</p>
            </Card>

            <Card className="border-border/60 bg-card p-4">
              <p className="text-xs text-muted-foreground">Operational Health</p>
              <p className="mt-1 font-heading text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {scorecard.performance?.operationalHealthScore} / 100
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Cadence, SLA, capacity</p>
            </Card>
          </div>

          {/* Supervised Team Leads & Active Forecast */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Supervised Team Leads</CardTitle>
                <p className="text-xs text-muted-foreground">Frontline managers under {scorecard.manager?.name}</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {scorecard.teamLeads?.map((tl: any) => (
                  <div key={tl.id} className="flex items-center justify-between border-b border-border/40 pb-2 text-xs">
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
                {scorecard.latestForecast ? (
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

          {/* Past Review Records */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Quarterly Review History (RM-09)</CardTitle>
              <p className="text-xs text-muted-foreground">Performance evaluations, blockers, and committed outcomes</p>
            </CardHeader>
            <CardContent>
              {scorecard.reviews?.length === 0 ? (
                <EmptyState title="No prior reviews" message="Run a manager review using the button above." />
              ) : (
                <div className="space-y-4">
                  {scorecard.reviews.map((r: any) => (
                    <div key={r.id} className="rounded-md border border-border/60 p-4 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm">{r.period_label} Performance Review</span>
                        <Badge tone={r.performance_rating === 'exceeding' ? 'open' : r.performance_rating === 'achieving' ? 'pending' : 'overdue'}>
                          {r.performance_rating.replace('_', ' ')}
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

// ─── RM-03: Territories ───
export function RegionalTerritoriesPage() {
  const [data, load] = useLoad<any>(() => regionalApi.getTerritories());
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
        title="Territories &amp; queue coverage"
        subtitle="Plan territory coverage, language queue specializations, and capacity routing · RM-03"
        actions={
          <Button size="sm" onClick={() => setPlanDrawerOpen(true)}>
            + Propose coverage plan (RM-03)
          </Button>
        }
      />

      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}

      {!data ? (
        <SkeletonRows rows={4} />
      ) : (
        <div className="space-y-6">
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
                  {data.teamStats?.map((t: any) => (
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
              {data.plans?.length === 0 ? (
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

// ─── RM-04: Regional Targets ───
export function RegionalTargetsPage() {
  const [data, load] = useLoad<any>(() => regionalApi.getTargets());
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
        title="Regional targets"
        subtitle="Allocate parent regional targets approved by NM across branch managers · RM-04"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleAllocate(false)}>Save draft</Button>
            <BusyButton size="sm" busy={s.busy} onClick={() => handleAllocate(true)}>Publish authorized allocation</BusyButton>
          </div>
        }
      />

      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}
      {s.error ? <p className="text-xs text-destructive">{s.error}</p> : null}

      {!data ? (
        <SkeletonRows rows={4} />
      ) : (
        <div className="space-y-6">
          {/* Target Bridge Header */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="border-border/60 bg-card p-4">
              <p className="text-xs text-muted-foreground">Approved NM Target</p>
              <p className="mt-1 font-heading text-2xl font-bold text-foreground">{parentTarget} wins</p>
              <p className="mt-1 text-xs text-muted-foreground">{periodLabel} Plan</p>
            </Card>

            <Card className="border-border/60 bg-card p-4">
              <p className="text-xs text-muted-foreground">Allocated Across Managers</p>
              <p className="mt-1 font-heading text-2xl font-bold text-primary">{totalAllocated} wins</p>
              <p className="mt-1 text-xs text-muted-foreground">{data.managers?.length} branch managers</p>
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
                  {data.managers?.map((m: any) => {
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
        </div>
      )}
    </div>
  );
}

// ─── RM-05 & RM-06: Capacity & Approvals ───
export function RegionalApprovalsPage() {
  const [tab, setTab] = useState<'transfers' | 'staffing'>('transfers');
  const [transfers, loadTransfers] = useLoad<any[]>(() => regionalApi.listTransfers());
  const [staffing, loadStaffing] = useLoad<any>(() => regionalApi.getStaffing());
  const [staffingModalOpen, setStaffingModalOpen] = useState(false);

  // Staffing Form state
  const [plannedHeadcount, setPlannedHeadcount] = useState(12);
  const [approvedHeadcount, setApprovedHeadcount] = useState(10);
  const [activeHeadcount] = useState(8);
  const [justification, setJustification] = useState('');
  const s = useSubmitAction();

  const handleDecideTransfer = async (transferId: string, decision: 'approved' | 'rejected') => {
    const resolutionNotes = prompt(`Enter resolution justification for ${decision.toUpperCase()}:`) || 'Decision approved by Regional Manager.';
    await s.run(async () => {
      await regionalApi.decideTransfer({ transferId, decision, resolutionNotes });
      loadTransfers();
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
      loadStaffing();
    }, 'Regional staffing plan approved and submitted to HR.');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Capacity &amp; approvals"
        subtitle="Approve cross-manager lead transfers and regional staffing plans · RM-05, RM-06"
        actions={
          <div className="flex gap-2">
            <Button variant={tab === 'transfers' ? 'default' : 'outline'} size="sm" onClick={() => setTab('transfers')}>
              Cross-Manager Transfers (RM-05)
            </Button>
            <Button variant={tab === 'staffing' ? 'default' : 'outline'} size="sm" onClick={() => setTab('staffing')}>
              Staffing Requisitions (RM-06)
            </Button>
          </div>
        }
      />

      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}

      {tab === 'transfers' ? (
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
                    <div key={t.id} className="rounded-md border border-border/60 p-4 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm">
                          {t.source_manager_name} ({t.source_team_name}) &rarr; {t.destination_manager_name} ({t.destination_team_name})
                        </span>
                        <Badge tone={t.status === 'approved' ? 'open' : t.status === 'pending' ? 'pending' : 'overdue'}>
                          {t.status}
                        </Badge>
                      </div>
                      <p><span className="font-medium">Selected Leads:</span> {leadIds?.length} leads ({leadIds?.join(', ')})</p>
                      <p><span className="font-medium">Business Reason:</span> {t.reason}</p>
                      {t.forecast_impact_notes && <p><span className="font-medium">Forecast Impact:</span> {t.forecast_impact_notes}</p>}
                      {t.status === 'pending' && (
                        <div className="flex justify-end gap-2 pt-2">
                          <Button variant="outline" size="sm" onClick={() => handleDecideTransfer(t.id, 'rejected')}>Reject</Button>
                          <Button size="sm" onClick={() => handleDecideTransfer(t.id, 'approved')}>Approve transfer</Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-semibold">Regional Headcount &amp; Capacity Envelope (RM-06)</CardTitle>
                <p className="text-xs text-muted-foreground">Staffing approvals and hiring recommendations to HR</p>
              </div>
              <Button size="sm" onClick={() => setStaffingModalOpen(true)}>+ New Staffing Plan</Button>
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
  const [forecast, loadForecast] = useLoad<any>(() => regionalApi.getForecasts());
  const [escalations, loadEscalations] = useLoad<any[]>(() => regionalApi.listEscalations());
  const [adjustment, setAdjustment] = useState<number>(0);
  const [assumptions, setAssumptions] = useState('Consolidated pipeline with 5% risk discount on late-stage wealth closures.');
  const [escalationDrawerOpen, setEscalationDrawerOpen] = useState(false);

  // New Escalation state
  const [escTitle, setEscTitle] = useState('');
  const [escSeverity, setEscSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('high');
  const [escDetail, setEscDetail] = useState('');
  const s = useSubmitAction();

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
      loadForecast();
    }, submitToNm ? 'Frozen regional forecast submitted to National Manager.' : 'Draft regional forecast saved.');
  };

  const handleResolveEscalation = async (escalationId: string) => {
    const recoveryDecision = prompt('Enter recovery decision or mitigation directive:') || 'Assigned priority queue monitoring.';
    await s.run(async () => {
      await regionalApi.resolveEscalation({
        escalationId,
        decision: 'resolved',
        recoveryDecision,
      });
      loadEscalations();
    }, 'Escalation marked as resolved.');
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
      loadEscalations();
    }, 'Operational risk escalation logged.');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Forecast &amp; risks"
        subtitle="Consolidate manager forecasts, apply regional view, and resolve operational escalations · RM-07, RM-08"
        actions={
          <div className="flex gap-2">
            <Button variant={tab === 'forecast' ? 'default' : 'outline'} size="sm" onClick={() => setTab('forecast')}>
              Regional Forecast (RM-07)
            </Button>
            <Button variant={tab === 'escalations' ? 'default' : 'outline'} size="sm" onClick={() => setTab('escalations')}>
              Escalations &amp; Risk Queue (RM-08)
            </Button>
          </div>
        }
      />

      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}

      {tab === 'forecast' ? (
        <div className="space-y-6">
          {!forecast ? (
            <SkeletonRows rows={4} />
          ) : (
            <>
              {/* Forecast Rollup Cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Card className="border-border/60 bg-card p-4">
                  <p className="text-xs text-muted-foreground">Bottom-Up Manager Sum</p>
                  <p className="mt-1 font-heading text-2xl font-bold">
                    INR {Number(forecast.bottomUpSum || 0).toLocaleString('en-IN')}
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
                    INR {Number(Number(forecast.bottomUpSum || 0) + Number(adjustment)).toLocaleString('en-IN')}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Status: <Badge tone="open">{forecast.activeSubmission?.status || 'draft'}</Badge>
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
                      {forecast.managerSubmissions?.map((m: any) => (
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
            </>
          )}
        </div>
      ) : (
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
                {escalations.map((e: any) => (
                  <div key={e.id} className="rounded-md border border-border/60 p-4 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge tone={e.severity === 'critical' ? 'overdue' : e.severity === 'high' ? 'overdue' : 'default'}>
                          {e.severity?.toUpperCase()}
                        </Badge>
                        <span className="font-semibold text-sm">{e.title}</span>
                      </div>
                      <Badge tone="default">{e.status}</Badge>
                    </div>
                    <p className="text-muted-foreground">{e.detail}</p>
                    <div className="flex items-center justify-between pt-2 border-t border-border/40">
                      <span className="text-muted-foreground">Accountable: {e.accountable_manager_name || 'Unassigned'}</span>
                      {e.status !== 'resolved' && (
                        <Button size="sm" onClick={() => handleResolveEscalation(e.id)}>Resolve escalation</Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
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

// ─── RM-10: Reports & Help ───
export function RegionalReportsPage() {
  const [period] = useState('October 2026');
  const [preview] = useLoad<any>(() => regionalApi.previewReportPack(period));
  const [schedules, loadSchedules] = useLoad<any[]>(() => regionalApi.listReportSchedules());
  const [downloading, setDownloading] = useState(false);
  const [schedDrawerOpen, setSchedDrawerOpen] = useState(false);

  // Schedule Form state
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
      loadSchedules();
    }, 'Regional report schedule registered successfully.');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports &amp; review pack"
        subtitle="Produce the protected regional review pack and manage scheduled governance distribution · RM-10"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSchedDrawerOpen(true)}>
              + New Report Schedule
            </Button>
            <BusyButton size="sm" busy={downloading} onClick={handleDownloadPdf}>
              Download Protected PDF Pack (RM-10)
            </BusyButton>
          </div>
        }
      />

      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}

      {!preview ? (
        <SkeletonRows rows={4} />
      ) : (
        <div className="space-y-6">
          {/* Executive PDF Preview Box */}
          <Card className="border-border/60 bg-card">
            <CardHeader className="border-b border-border/40 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold">{preview.title}</CardTitle>
                  <p className="text-xs text-muted-foreground">Scope: {preview.scope?.name} | Prepared for: National Management</p>
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
                    <p className="text-base font-bold font-heading">{preview.targetSummary?.parentTarget} wins</p>
                  </div>
                  <div className="border border-border/40 rounded p-2.5">
                    <p className="text-muted-foreground">Achieved Wins</p>
                    <p className="text-base font-bold font-heading text-primary">
                      {preview.targetSummary?.achievedWins} wins ({preview.targetSummary?.attainmentPercent}%)
                    </p>
                  </div>
                  <div className="border border-border/40 rounded p-2.5">
                    <p className="text-muted-foreground">Unallocated Remainder</p>
                    <p className="text-base font-bold font-heading text-emerald-600">
                      {preview.targetSummary?.unallocatedRemainder} wins
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
                  {preview.managers?.map((m: any) => (
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
                  Bottom-up total: INR {Number(preview.forecastSummary?.bottomUpSum || 0).toLocaleString('en-IN')} | Regional adjustment: INR {Number(preview.forecastSummary?.regionalAdjustment || 0).toLocaleString('en-IN')} | Net forecast: <span className="font-semibold text-primary">INR {Number(preview.forecastSummary?.adjustedRevenue || 0).toLocaleString('en-IN')}</span>
                </p>
              </div>

              {/* Section 4 */}
              <div>
                <h3 className="font-semibold text-sm text-foreground border-b border-border/40 pb-1 mb-2">
                  4. Top Regional Risks &amp; Governance Flags
                </h3>
                {preview.riskRegister?.length === 0 ? (
                  <p className="text-muted-foreground">No open regional risks.</p>
                ) : (
                  <div className="space-y-1.5">
                    {preview.riskRegister?.map((r: any) => (
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
