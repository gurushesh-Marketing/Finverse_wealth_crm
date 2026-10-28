import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from 'cn';
import { ceoApi } from '../lib/ceo-api';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input, Textarea } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Panel, BusyButton } from '../components/ui/panel';
import { EmptyState, SkeletonRows, SuccessNote } from '../components/ui/states';
import type { CeoPeriod } from '@finverse/contracts';

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
        setError(err?.message || 'Failed to load executive data. Please retry.');
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

function DeckBreadcrumbs({
  actionCode,
  actionTitle,
}: {
  actionCode: string;
  actionTitle: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
      <div className="flex items-center gap-2 text-xs font-mono tracking-wide text-muted-foreground">
        <span className="font-bold text-foreground">CEO</span>
        <span>/</span>
        <span className="font-bold text-primary">{actionCode}</span>
        <span>/</span>
        <span className="uppercase text-muted-foreground">{actionTitle}</span>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Ready for review
        </span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground font-mono text-[11px]">Updated 09:42 IST</span>
      </div>
    </div>
  );
}

function ContextCard({
  pills,
}: {
  pills: { label: string; value: string; badgeTone?: 'open' | 'pending' | 'overdue' | 'default' }[];
}) {
  return (
    <Card className="border-border/60 bg-muted/15 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
        EXECUTIVE SCOPE &amp; WATERMARK
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {pills.map((p, idx) => (
          <div key={idx} className="space-y-0.5">
            <div className="text-[11px] text-muted-foreground">{p.label}</div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-foreground">{p.value}</span>
              {p.badgeTone && (
                <Badge tone={p.badgeTone} className="text-[10px] px-1.5 py-0">
                  {p.badgeTone.toUpperCase()}
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
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
        <span>Executive authority and scope checked on submit</span>
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

// ─── CEO-01: Company Operating Picture ───
export function CeoOperatingPage() {
  const [period, setPeriod] = useState<CeoPeriod>('month-to-date');
  const [focusVertical, setFocusVertical] = useState('all');

  const loadOperating = useCallback(() => ceoApi.operatingPicture(period, focusVertical), [period, focusVertical]);
  const [data, load, { initialLoading, error, clearError }] = useLoad(loadOperating);

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
      load();
    }, 'Executive commitment recorded.');
  };

  if (initialLoading) return <SkeletonRows rows={6} />;

  return (
    <div className="space-y-6">
      <DeckBreadcrumbs actionCode="CEO-01" actionTitle="INSPECT COMPANY OPERATING PICTURE" />

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-center justify-between">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={clearError}>Dismiss</Button>
        </div>
      ) : null}
      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}
      {s.error ? <p role="alert" className="text-sm text-destructive">{s.error}</p> : null}

      <ContextCard
        pills={[
          { label: 'Role Scope', value: 'Enterprise CEO' },
          { label: 'Finance Close', value: data?.watermark?.financeCloseStatus || 'M-1 Reconciled' },
          { label: 'Data Freshness', value: `${data?.watermark?.dataFreshnessMinutes || 4} mins ago` },
          { label: 'Ledger Audit', value: 'Reconciled', badgeTone: 'open' },
        ]}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-card p-3">
            <div className="flex items-center gap-3">
              <Select value={period} onChange={(e) => setPeriod(e.target.value as CeoPeriod)} className="w-44 text-xs">
                <option value="month-to-date">Month to Date</option>
                <option value="quarter-to-date">Quarter to Date</option>
                <option value="fiscal-year-to-date">Fiscal Year to Date</option>
                <option value="last-fiscal-year">Last Fiscal Year</option>
              </Select>
              <Select value={focusVertical} onChange={(e) => setFocusVertical(e.target.value)} className="w-44 text-xs">
                <option value="all">All Divisions</option>
                <option value="wealth">Wealth Management</option>
                <option value="banking">Commercial Banking</option>
                <option value="markets">Markets & Trading</option>
                <option value="real_estate">Real Estate Advisory</option>
              </Select>
            </div>
            <Button size="sm" variant="outline" onClick={() => load()}>
              Refresh
            </Button>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Enterprise Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-foreground">
                  ₹{((data?.kpis?.totalDeliveredRevenue || 0) / 10000000).toFixed(1)} / ₹{((data?.kpis?.totalRevenueTarget || 0) / 10000000).toFixed(1)} Cr
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge tone={(data?.kpis?.revenueAttainmentPercent || 0) >= 80 ? 'open' : 'pending'}>
                    {data?.kpis?.revenueAttainmentPercent || 0}% Target
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Enterprise Wins</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-foreground">
                  {data?.kpis?.totalDeliveredWins || 0} / {data?.kpis?.totalWinsTarget || 0}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge tone={(data?.kpis?.winsAttainmentPercent || 0) >= 80 ? 'open' : 'pending'}>
                    {data?.kpis?.winsAttainmentPercent || 0}% Quota
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Strategic Buffer</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-amber-700">
                  ₹{((data?.kpis?.unallocatedRevenueBuffer || 0) / 10000000).toFixed(1)} Cr
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">{data?.kpis?.unallocatedWinsBuffer || 0} wins reserve</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Governance &amp; Risks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-foreground">
                  {data?.kpis?.openRisksCount || 0} risks ({data?.kpis?.criticalRisksCount || 0} crit)
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge tone="default">{data?.kpis?.inProgressCommitmentsCount || 0} Commitments</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Division Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Division Attainment &amp; Leadership Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border/60 uppercase text-muted-foreground font-semibold">
                      <th className="py-2.5 px-3">Vertical</th>
                      <th className="py-2.5 px-3">National Leader</th>
                      <th className="py-2.5 px-3">Delivered Revenue</th>
                      <th className="py-2.5 px-3">Closed Wins</th>
                      <th className="py-2.5 px-3">Pace</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {(data?.verticalContributions || []).map((v: any) => (
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
              </div>
            </CardContent>
          </Card>

          <DeckBottomBar
            actionLabel="Record Strategic Commitment"
            onAction={() => setCommitmentDrawerOpen(true)}
          />
        </div>

        <div className="space-y-4">
          <DeckRightRail
            steps={[
              'Inspect attainment, pipeline, forecast confidence and critical decisions.',
              'Open a vertical contribution within the executive workspace without switching roles.',
              'Assign a named strategic action or leadership review.',
            ]}
            failure="Unreconciled or missing vertical data is visibly flagged and excluded from certified totals as appropriate."
            permission="Company aggregation is an explicit scope grant. It does not grant another role interface or unrestricted customer/HR access."
          />
        </div>
      </div>

      {/* Drawer: Record Commitment */}
      <Panel open={commitmentDrawerOpen} onClose={() => setCommitmentDrawerOpen(false)} title="Record Executive Commitment">
        <div className="space-y-4 p-4">
          <FormField label="Commitment Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. FY27 Wealth Division Capacity Surge Requisition" />
          </FormField>
          <FormField label="Accountable Leader">
            <Select value={accountableLeader} onChange={(e) => setAccountableLeader(e.target.value)} className="w-full text-xs">
              <option value="Vikram Malhotra (NM - Wealth Management)">Vikram Malhotra (NM - Wealth Management)</option>
              <option value="Suresh Nair (NM - Commercial Banking)">Suresh Nair (NM - Commercial Banking)</option>
              <option value="Sanjay Singhania (NM - Markets & Securities)">Sanjay Singhania (NM - Markets & Securities)</option>
              <option value="Aditya Singhania (NM - Real Estate Advisory)">Aditya Singhania (NM - Real Estate Advisory)</option>
              <option value="Ananya Roy (CFO - Finance)">Ananya Roy (CFO - Finance)</option>
              <option value="Rajiv Mehta (CEO - Executive)">Rajiv Mehta (CEO - Executive)</option>
            </Select>
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
  const [period, setPeriod] = useState<CeoPeriod>('month-to-date');
  const loadComps = useCallback(() => ceoApi.compareVerticals(period), [period]);
  const [data, load, { initialLoading, error, clearError }] = useLoad(loadComps);

  if (initialLoading) return <SkeletonRows rows={6} />;

  return (
    <div className="space-y-6">
      <DeckBreadcrumbs actionCode="CEO-02" actionTitle="COMPARE VERTICALS FAIRLY" />

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-center justify-between">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={clearError}>Dismiss</Button>
        </div>
      ) : null}

      <ContextCard
        pills={[
          { label: 'Comparison Basis', value: 'FX & Run-Rate' },
          { label: 'Reporting Currency', value: 'INR (Normalized)' },
          { label: 'Active Verticals', value: '4 Divisions' },
          { label: 'Benchmark Status', value: 'Certified', badgeTone: 'open' },
        ]}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card p-3">
            <Select value={period} onChange={(e) => setPeriod(e.target.value as CeoPeriod)} className="w-48 text-xs">
              <option value="month-to-date">Month to Date</option>
              <option value="quarter-to-date">Quarter to Date</option>
              <option value="fiscal-year-to-date">Fiscal Year to Date</option>
            </Select>
            <Button size="sm" variant="outline" onClick={() => load()}>Refresh</Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(data?.comparisons || []).map((c: any) => (
              <Card key={c.vertical} className="border-border/60">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base">{c.name}</CardTitle>
                  <Badge tone={c.riskRating === 'low' ? 'open' : c.riskRating === 'moderate' ? 'pending' : 'overdue'}>
                    {c.riskRating.toUpperCase()} RISK
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 bg-muted/20 rounded">
                      <div className="text-[10px] text-muted-foreground">Revenue Run-Rate</div>
                      <div className="text-lg font-bold text-foreground">₹{(c.revenueRunRateInr / 10000000).toFixed(1)} Cr</div>
                    </div>
                    <div className="p-2.5 bg-muted/20 rounded">
                      <div className="text-[10px] text-muted-foreground">Gross Margin</div>
                      <div className="text-lg font-bold text-primary">{c.grossMarginPercent}%</div>
                    </div>
                    <div className="p-2.5 bg-muted/20 rounded">
                      <div className="text-[10px] text-muted-foreground">Blended CAC</div>
                      <div className="text-lg font-bold text-foreground">₹{c.blendedCacInr.toLocaleString('en-IN')}</div>
                    </div>
                    <div className="p-2.5 bg-muted/20 rounded">
                      <div className="text-[10px] text-muted-foreground">Avg Deal Size</div>
                      <div className="text-lg font-bold text-foreground">₹{(c.averageTicketInr / 100000).toFixed(1)} L</div>
                    </div>
                  </div>

                  <div className="border-t border-border/40 pt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Headcount: <strong>{c.fteCount} FTEs</strong></span>
                    <span>Rev / FTE: <strong>₹{(c.revenuePerFteInr / 100000).toFixed(1)} L</strong></span>
                    <span>Speed: <strong>{c.leadVelocityHours} hrs</strong></span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <DeckBottomBar
            actionLabel="Save Comparison Snapshot"
            onAction={() => alert('Comparison snapshot attached to executive session.')}
          />
        </div>

        <div className="space-y-4">
          <DeckRightRail
            steps={[
              'Choose comparable measures and observation periods.',
              'Inspect target pace, growth and operating constraints by vertical.',
              'Record decisions with the supporting comparison snapshot.',
            ]}
            failure="Incomparable or incomplete data shows a labelled limitation rather than an invented rank."
            permission="Do not rank different products by raw lead count alone. Separate differing sales cycles, margins and data maturity."
          />
        </div>
      </div>
    </div>
  );
}

const NM_DIRECTORY: { id: string; name: string; vertical: 'wealth' | 'banking' | 'markets' | 'real-estate'; label: string }[] = [
  { id: 'EMP-009', name: 'Vikram Malhotra', vertical: 'wealth', label: 'Wealth Management' },
  { id: 'EMP-020', name: 'Suresh Nair', vertical: 'banking', label: 'Commercial Banking' },
  { id: 'EMP-025', name: 'Sanjay Singhania', vertical: 'markets', label: 'Markets & Securities' },
  { id: 'EMP-030', name: 'Aditya Singhania', vertical: 'real-estate', label: 'Real Estate Advisory' },
];

// ─── CEO-03 & CEO-09: National Leadership & NM Review ───
export function CeoNmReviewPage() {
  const [selectedNmId, setSelectedNmId] = useState('EMP-009');
  const currentNm = NM_DIRECTORY.find((n) => n.id === selectedNmId) || NM_DIRECTORY[0];
  const loadContribution = useCallback(() => ceoApi.getNmContribution(selectedNmId), [selectedNmId]);
  const loadReviews = useCallback(() => ceoApi.listNmReviews(selectedNmId), [selectedNmId]);

  const [data, loadData, { initialLoading, error, clearError }] = useLoad(loadContribution);
  const [reviews, loadReviewsData] = useLoad<any[]>(loadReviews);

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
        nmEmployeeId: selectedNmId,
        vertical: currentNm.vertical,
        periodLabel: 'October 2026',
        overallLeadershipRating: rating,
        strategicAlignment: strategicAlignment.trim(),
        operationalExecution: operationalExecution.trim(),
        teamHealthAndRetention: teamHealth.trim() || `Solid front-line retention across ${currentNm.label}.`,
        boardVisibilityReadiness: boardVisibility.trim() || 'Ready for Board Strategy presentation.',
        strategicCommitments: ['Deliver quarterly division quota', 'Enforce operational SLAs and compliance'],
        nextReviewDate: nextDate,
      });
      setDrawerOpen(false);
      loadReviewsData();
    }, `Leadership review recorded for ${currentNm.name}.`);
  };

  if (initialLoading) return <SkeletonRows rows={6} />;

  return (
    <div className="space-y-6">
      <DeckBreadcrumbs actionCode="CEO-03 / CEO-09" actionTitle="NATIONAL MANAGER CONTRIBUTION &amp; LEADERSHIP REVIEW" />

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-center justify-between">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={clearError}>Dismiss</Button>
        </div>
      ) : null}
      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}
      {s.error ? <p role="alert" className="text-sm text-destructive">{s.error}</p> : null}

      {/* NM Directory Selector */}
      <div className="flex flex-wrap items-center gap-2 p-2 bg-card rounded-lg border border-border/60">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mr-1">Select National Manager:</span>
        {NM_DIRECTORY.map((nm) => (
          <Button
            key={nm.id}
            size="sm"
            variant={selectedNmId === nm.id ? 'default' : 'outline'}
            onClick={() => setSelectedNmId(nm.id)}
            className="text-xs h-8"
          >
            {nm.name} ({nm.label})
          </Button>
        ))}
      </div>

      <ContextCard
        pills={[
          { label: 'National Leader', value: data?.nationalManager?.display_name || currentNm.name },
          { label: 'Vertical Mandate', value: currentNm.label },
          { label: 'Directives Fulfilled', value: `${data?.governanceRecord?.directivesFulfilled || 0}/${data?.governanceRecord?.directivesIssued || 0}` },
          { label: 'Forecast Variance', value: `${data?.governanceRecord?.forecastAccuracyVariancePercent || 0}%`, badgeTone: 'open' },
        ]}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Twin Cards: NM Evidence vs Leadership Review */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">NM OPERATIONAL EVIDENCE</p>
                <CardTitle className="text-base">Quota Delivery &amp; Governance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="p-3 bg-muted/20 rounded space-y-1">
                  <div className="font-semibold text-foreground">Approved Vertical Target: {data?.approvedVerticalTarget} wins</div>
                  <div className="text-muted-foreground">Unallocated Regional Remainder: {data?.unallocatedRemainder} wins</div>
                </div>
                <div className="p-3 bg-muted/20 rounded space-y-1">
                  <div className="font-semibold text-foreground">Governance Adherence: High</div>
                  <div className="text-muted-foreground">Directive execution pace matches CEO cadence.</div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">LEADERSHIP EVALUATION &amp; COMMITMENTS</p>
                <CardTitle className="text-base">Executive Readiness</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <p className="text-muted-foreground leading-relaxed">
                  Evaluate strategic alignment, board visibility readiness, and regional team health. Record binding executive commitments.
                </p>
                <Button size="sm" className="w-full bg-[#113F3D] text-white hover:bg-[#113F3D]/90" onClick={() => setDrawerOpen(true)}>
                  Conduct Leadership Review
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Historical Reviews */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Historical Leadership Reviews</CardTitle>
            </CardHeader>
            <CardContent>
              {!reviews || reviews.length === 0 ? (
                <EmptyState title="No leadership reviews" message="No formal CEO reviews recorded yet for this National Manager." />
              ) : (
                <div className="space-y-3">
                  {reviews.map((r) => (
                    <div key={r.id} className="p-3.5 border border-border/40 rounded-lg space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground">{r.nm_name} — {r.period_label}</span>
                        <Badge tone={r.overall_leadership_rating === 'role_model' || r.overall_leadership_rating === 'strong_performer' ? 'open' : 'pending'}>
                          {r.overall_leadership_rating.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </div>
                      <div><strong>Strategic Alignment:</strong> {r.strategic_alignment}</div>
                      <div><strong>Operational Execution:</strong> {r.operational_execution}</div>
                      <div className="text-[11px] text-muted-foreground">Next Review: {new Date(r.next_review_date).toLocaleDateString('en-IN')}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <DeckBottomBar
            actionLabel="Schedule Next Quarterly Review"
            onAction={() => setDrawerOpen(true)}
          />
        </div>

        <div className="space-y-4">
          <DeckRightRail
            steps={[
              'Open the NM contribution from the company view.',
              'Review results, risks, accepted forecasts and action delivery.',
              'Schedule a leadership review or record binding strategic commitments.',
            ]}
            failure="An NM replacement sees a new personal record; the vertical retains organisational history."
            permission="Executive drill-down is a CEO view. Lower-level customer evidence remains separately permissioned."
          />
        </div>
      </div>

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
          <FormField label="Team Health & Retention">
            <Input value={teamHealth} onChange={(e) => setTeamHealth(e.target.value)} placeholder="Front-line morale and retention observation." />
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
  const loadTargets = useCallback(() => ceoApi.getTargets('October', 'FY2026-27'), []);
  const [data, load, { initialLoading, error, clearError }] = useLoad(loadTargets);

  const [totalRevenueTarget, setTotalRevenueTarget] = useState<number>(170000000);
  const [totalWinsTarget, setTotalWinsTarget] = useState<number>(1500);
  const [allocations, setAllocations] = useState<any[]>([
    { vertical: 'wealth', revenueTarget: 75000000, winsTarget: 500, nmEmployeeId: 'EMP-009', nmName: 'Vikram Malhotra' },
    { vertical: 'banking', revenueTarget: 45000000, winsTarget: 300, nmEmployeeId: 'EMP-020', nmName: 'Suresh Nair' },
    { vertical: 'markets', revenueTarget: 25000000, winsTarget: 400, nmEmployeeId: 'EMP-025', nmName: 'Sanjay Singhania' },
    { vertical: 'real_estate', revenueTarget: 20000000, winsTarget: 200, nmEmployeeId: 'EMP-030', nmName: 'Aditya Singhania' },
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

  if (initialLoading) return <SkeletonRows rows={6} />;

  return (
    <div className="space-y-6">
      <DeckBreadcrumbs actionCode="CEO-04" actionTitle="APPROVE COMPANY &amp; VERTICAL TARGETS" />

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-center justify-between">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={clearError}>Dismiss</Button>
        </div>
      ) : null}
      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}
      {s.error ? <p role="alert" className="text-sm text-destructive">{s.error}</p> : null}

      <ContextCard
        pills={[
          { label: 'Fiscal Year', value: 'FY2026-27' },
          { label: 'Target Cycle', value: 'October (Q3)' },
          { label: 'Strategic Buffer', value: `₹${(revenueBuffer / 10000000).toFixed(1)} Cr` },
          { label: 'Approval Status', value: data?.status || 'Draft', badgeTone: data?.status === 'board_ratified' ? 'open' : 'pending' },
        ]}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Target Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Enterprise Revenue Budget</CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  type="number"
                  value={totalRevenueTarget}
                  onChange={(e) => setTotalRevenueTarget(Number(e.target.value))}
                  className="text-lg font-bold h-10"
                />
                <p className="text-[11px] text-muted-foreground mt-1">₹{(totalRevenueTarget / 10000000).toFixed(1)} Cr enterprise plan</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Allocated to Verticals</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold text-foreground h-10 flex items-center">
                  ₹{(allocatedRevenue / 10000000).toFixed(1)} Cr ({allocatedWins} wins)
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">Sum of all divisions</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Strategic Unallocated Buffer</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-lg font-bold h-10 flex items-center ${isOverAllocated ? 'text-destructive' : 'text-amber-700'}`}>
                  ₹{(revenueBuffer / 10000000).toFixed(1)} Cr ({winsBuffer} wins)
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {isOverAllocated ? '⚠️ Over-allocated!' : 'Contingency reserve'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Allocation Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Division Target Allocations &amp; Cascade</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border/60 uppercase text-muted-foreground font-semibold">
                      <th className="py-2.5 px-3">Division</th>
                      <th className="py-2.5 px-3">National Leader</th>
                      <th className="py-2.5 px-3">Revenue (INR)</th>
                      <th className="py-2.5 px-3">Wins</th>
                      <th className="py-2.5 px-3">Share</th>
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
                            className="w-36 text-xs h-8"
                          />
                        </td>
                        <td className="py-3 px-3">
                          <Input
                            type="number"
                            value={alloc.winsTarget}
                            onChange={(e) => handleUpdateAllocation(idx, 'winsTarget', Number(e.target.value))}
                            className="w-24 text-xs h-8"
                          />
                        </td>
                        <td className="py-3 px-3 text-muted-foreground">
                          {totalRevenueTarget > 0 ? Math.round((alloc.revenueTarget / totalRevenueTarget) * 100) : 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <DeckBottomBar
            actionLabel="Ratify &amp; Cascade to NMs"
            disabled={isOverAllocated || s.busy}
            busy={s.busy}
            onAction={() => handleApprove(true)}
          />
        </div>

        <div className="space-y-4">
          <DeckRightRail
            steps={[
              'Review bottom-up capacity and the proposed company plan.',
              'Approve targets and reconcile vertical allocations.',
              'Publish the signed target version for NM cascade.',
            ]}
            failure="Unresolved finance basis or inconsistent allocations block final approval. Over-allocation is strictly prohibited."
            permission="Company total equals allocations plus a visible reserved/unallocated amount."
          />
        </div>
      </div>
    </div>
  );
}

// ─── CEO-05: Consolidated Company Forecast ───
export function CeoForecastPage() {
  const loadForecast = useCallback(() => ceoApi.getForecastRollup('October'), []);
  const [data, load, { initialLoading, error, clearError }] = useLoad(loadForecast);

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
        bottomUpSum: data?.bottomUpSum || 78500000,
        executiveMacroAdjustment: adjustment,
        currency: 'INR',
        verticalSubmissions: data?.verticalSubmissions || [],
        macroAssumptions: macroAssumptions.trim(),
        boardRiskNotes: 'Monitored regulatory delays on PMS advisory approvals.',
        signOff,
      });
      load();
    }, signOff ? 'Consolidated forecast signed off for Board of Directors.' : 'Forecast draft saved.');
  };

  if (initialLoading) return <SkeletonRows rows={6} />;

  const netForecast = (data?.bottomUpSum || 0) + adjustment;

  return (
    <div className="space-y-6">
      <DeckBreadcrumbs actionCode="CEO-05" actionTitle="REVIEW CONSOLIDATED COMPANY FORECAST" />

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-center justify-between">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={clearError}>Dismiss</Button>
        </div>
      ) : null}
      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}
      {s.error ? <p role="alert" className="text-sm text-destructive">{s.error}</p> : null}

      <ContextCard
        pills={[
          { label: 'Forecast Period', value: 'October 2026' },
          { label: 'Bottom-Up Total', value: `₹${((data?.bottomUpSum || 0) / 10000000).toFixed(2)} Cr` },
          { label: 'Macro Adjustment', value: `₹${(adjustment / 10000000).toFixed(2)} Cr` },
          { label: 'Board Status', value: data?.status || 'Draft', badgeTone: data?.status === 'signed_off_by_ceo' ? 'open' : 'pending' },
        ]}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Division Bottom-Up Sum</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold text-foreground">
                  ₹{((data?.bottomUpSum || 0) / 10000000).toFixed(2)} Cr
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">Rollup of all vertical submissions</p>
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
                  className="text-lg font-bold h-10"
                />
                <p className="text-[11px] text-muted-foreground mt-1">Sensitivity / headwind reserve</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Signed-Off Board Forecast</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold text-primary h-10 flex items-center">
                  ₹{(netForecast / 10000000).toFixed(2)} Cr
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge tone={data?.status === 'signed_off_by_ceo' ? 'open' : 'pending'}>
                    {(data?.status || 'draft').replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Division Bottom-Up Submissions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Division Bottom-Up Submissions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border/60 uppercase text-muted-foreground font-semibold">
                      <th className="py-2.5 px-3">Division</th>
                      <th className="py-2.5 px-3">National Leader</th>
                      <th className="py-2.5 px-3">Submitted Forecast</th>
                      <th className="py-2.5 px-3">Wins</th>
                      <th className="py-2.5 px-3">Variance</th>
                      <th className="py-2.5 px-3">Confidence</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {(data?.verticalSubmissions || []).map((sub: any) => (
                      <tr key={sub.vertical || sub.name} className="hover:bg-muted/30">
                        <td className="py-3 px-3 font-semibold text-foreground uppercase">{String(sub.name || sub.vertical || '').replace('_', ' ')}</td>
                        <td className="py-3 px-3 font-medium">{sub.nmName || 'Assigned NM'}</td>
                        <td className="py-3 px-3 font-mono">₹{((sub.submittedForecastInr || sub.reportedRevenue || 0) / 10000000).toFixed(2)} Cr</td>
                        <td className="py-3 px-3 font-bold text-primary">{sub.submittedWins || 300}</td>
                        <td className="py-3 px-3">
                          <span className={(sub.variancePercent ?? 0) >= 0 ? 'text-emerald-600 font-semibold' : 'text-amber-600 font-semibold'}>
                            {(sub.variancePercent ?? 0) >= 0 ? `+${sub.variancePercent ?? 0}%` : `${sub.variancePercent}%`}
                          </span>
                        </td>
                        <td className="py-3 px-3 uppercase text-[11px] font-semibold">{sub.confidenceLevel || 'High'}</td>
                        <td className="py-3 px-3">
                          <Badge tone={(sub.submissionStatus || sub.status) === 'submitted' ? 'open' : 'pending'}>
                            {String(sub.submissionStatus || sub.status || 'SUBMITTED').replace('_', ' ').toUpperCase()}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Board Macro Assumptions &amp; Regulatory Headwinds</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField label="CEO &amp; Board Macro Assumptions">
                <Textarea
                  value={macroAssumptions}
                  onChange={(e) => setMacroAssumptions(e.target.value)}
                  placeholder="State interest rate outlook, market volatility, and liquidity factors."
                  rows={3}
                />
              </FormField>
            </CardContent>
          </Card>

          <DeckBottomBar
            actionLabel="Sign Off Forecast for Board"
            busy={s.busy}
            disabled={s.busy}
            onAction={() => handleSignOff(true)}
          />
        </div>

        <div className="space-y-4">
          <DeckRightRail
            steps={[
              'Inspect national submissions and consolidation gaps.',
              'Review executive adjustments separately from bottom-up totals.',
              'Freeze the executive forecast for the leadership meeting.',
            ]}
            failure="Unaccepted or late submissions remain visible rather than silently replaced."
            permission="Deduplicate linked revenue and avoid counting referrals twice. Use consistent expected-revenue definitions."
          />
        </div>
      </div>
    </div>
  );
}

// ─── CEO-06: Growth Initiatives ───
export function CeoGrowthPage() {
  const loadInitiatives = useCallback(() => ceoApi.listGrowthInitiatives(), []);
  const [initiatives, load, { initialLoading, error, clearError }] = useLoad<any[]>(loadInitiatives);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [vertical, setVertical] = useState<'wealth' | 'banking' | 'markets' | 'real_estate' | 'real-estate'>('wealth');
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
        vertical: (vertical === 'real_estate' ? 'real-estate' : vertical) as 'wealth' | 'banking' | 'markets' | 'real-estate',
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

  if (initialLoading) return <SkeletonRows rows={6} />;

  return (
    <div className="space-y-6">
      <DeckBreadcrumbs actionCode="CEO-06" actionTitle="APPROVE GROWTH OR CAPACITY INITIATIVE" />

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-center justify-between">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={clearError}>Dismiss</Button>
        </div>
      ) : null}
      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}
      {s.error ? <p role="alert" className="text-sm text-destructive">{s.error}</p> : null}

      <ContextCard
        pills={[
          { label: 'Active Proposals', value: `${(initiatives || []).length} Initiatives` },
          { label: 'Capital Envelope', value: 'INR 50 Cr' },
          { label: 'Evaluation Hurdle', value: '25% Min ROI' },
          { label: 'Governance Rule', value: 'Executive Only', badgeTone: 'open' },
        ]}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Initiative Register &amp; Capital Commitments</CardTitle>
              <Button size="sm" variant="outline" onClick={() => load()}>Refresh</Button>
            </CardHeader>
            <CardContent>
              {!initiatives || initiatives.length === 0 ? (
                <EmptyState title="No active initiatives" message="No pending capital allocation proposals." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border/60 uppercase text-muted-foreground font-semibold">
                        <th className="py-2 px-3">Title</th>
                        <th className="py-2 px-3">Vertical</th>
                        <th className="py-2 px-3">Capital</th>
                        <th className="py-2 px-3">ROI</th>
                        <th className="py-2 px-3">Sponsor</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3 text-right">Decision</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {initiatives.map((gi) => (
                        <tr key={gi.id} className="hover:bg-muted/30">
                          <td className="py-3 px-3 font-semibold text-foreground">{gi.title}</td>
                          <td className="py-3 px-3 uppercase text-[11px] font-medium">{gi.vertical}</td>
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
                                <Button size="sm" variant="default" onClick={() => handleApprove(gi.id, true)}>Approve</Button>
                                <Button size="sm" variant="secondary" onClick={() => handleApprove(gi.id, false)}>Reject</Button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">Decided</span>
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

          <DeckBottomBar
            actionLabel="Propose Strategic Initiative"
            onAction={() => setDrawerOpen(true)}
          />
        </div>

        <div className="space-y-4">
          <DeckRightRail
            steps={[
              'Review expected outcome, capacity assumptions and dependencies.',
              'Approve strategic direction within authority and request finance concurrence where needed.',
              'Assign milestones and review dates.',
            ]}
            failure="Budget not approved: keep initiative conditionally approved and block dependent spending commitments."
            permission="Strategic approval is separate from finance funding approval and employee access provisioning."
          />
        </div>
      </div>

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
                <option value="markets">Markets &amp; Trading</option>
                <option value="real_estate">Real Estate Advisory</option>
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
            <FormField label="Timeline (Months)">
              <Input type="number" value={timeline} onChange={(e) => setTimeline(Number(e.target.value))} />
            </FormField>
          </div>
          <FormField label="Business Justification &amp; Market Case">
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
  const loadConflicts = useCallback(() => ceoApi.listConflicts(), []);
  const [conflicts, load, { initialLoading, error, clearError }] = useLoad<any[]>(loadConflicts);
  const s = useSubmitAction();

  const handleArbitrate = async (conflictId: string, awardedVertical: any) => {
    await s.run(async () => {
      await ceoApi.arbitrateConflict(conflictId, {
        ceoDetermination: `Arbitrated in favor of ${awardedVertical.toUpperCase()} to maximize firm-wide fee margins.`,
        awardedVertical,
        resolvedAttribution: `${awardedVertical === 'shared' ? '50% / 50% split attribution' : `100% ${awardedVertical.toUpperCase()}`}`,
      });
      load();
    }, 'Conflict determination recorded.');
  };

  if (initialLoading) return <SkeletonRows rows={6} />;

  return (
    <div className="space-y-6">
      <DeckBreadcrumbs actionCode="CEO-07" actionTitle="RESOLVE CROSS-VERTICAL PRIORITY CONFLICT" />

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-center justify-between">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={clearError}>Dismiss</Button>
        </div>
      ) : null}
      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}
      {s.error ? <p role="alert" className="text-sm text-destructive">{s.error}</p> : null}

      <ContextCard
        pills={[
          { label: 'Arbitration Queue', value: `${(conflicts || []).filter((c) => c.status === 'open').length} Open Disputes` },
          { label: 'Attribution Model', value: 'Margin Weighted' },
          { label: 'Dual Coverage', value: 'Permitted', badgeTone: 'open' },
          { label: 'Authority Tier', value: 'CEO Final' },
        ]}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {!conflicts || conflicts.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <EmptyState title="No pending conflicts" message="No active inter-divisional ownership disputes." />
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {conflicts.map((c) => (
                <div key={c.id} className="space-y-3 rounded-lg border border-border/60 bg-card p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-base text-foreground">{c.prospect_or_client_name}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {c.source_vertical.toUpperCase()} vs {c.conflicting_vertical.toUpperCase()} ({c.conflict_nature.replace('_', ' ')})
                      </span>
                    </div>
                    <Badge tone={c.status === 'resolved' ? 'open' : 'pending'}>{c.status.toUpperCase()}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{c.summary}</p>

                  {/* Twin Cards: Prospect Context vs Arbitration Ruling */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-muted/20 rounded-md border border-border/40">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                        {c.source_vertical.toUpperCase()} ARGUMENT
                      </p>
                      <p className="text-foreground">{c.source_argument}</p>
                    </div>
                    <div className="p-3 bg-muted/20 rounded-md border border-border/40">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                        {c.conflicting_vertical.toUpperCase()} ARGUMENT
                      </p>
                      <p className="text-foreground">{c.counter_argument}</p>
                    </div>
                  </div>

                  {c.status === 'open' ? (
                    <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-border/40">
                      <Button size="sm" variant="default" onClick={() => handleArbitrate(c.id, c.source_vertical)}>
                        Award to {c.source_vertical.replace('_', ' ').toUpperCase()}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => handleArbitrate(c.id, c.conflicting_vertical)}>
                        Award to {c.conflicting_vertical.replace('_', ' ').toUpperCase()}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleArbitrate(c.id, 'shared')}>
                        50/50 Split Attribution
                      </Button>
                    </div>
                  ) : (
                    <div className="text-xs text-primary font-semibold border-t border-border/40 pt-2">
                      Determination: {c.ceo_determination} ({c.resolved_attribution})
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <DeckBottomBar
            actionLabel="Refresh Arbitration Queue"
            onAction={() => load()}
          />
        </div>

        <div className="space-y-4">
          <DeckRightRail
            steps={[
              'Review both NM proposals and customer/service impact.',
              'Record the priority, limits and follow-up commitments.',
              'Notify affected NMs and route access changes through Admin if needed.',
            ]}
            failure="If policy or finance approval is required, keep the action pending until that independent decision is complete."
            permission="A commercial priority does not automatically share customer data or employee permissions across verticals."
          />
        </div>
      </div>
    </div>
  );
}

// ─── CEO-08: Operating Risks & Critical Complaints ───
export function CeoRisksPage() {
  const loadRisks = useCallback(() => ceoApi.listOperatingRisks(), []);
  const [risks, load, { initialLoading, error, clearError }] = useLoad<any[]>(loadRisks);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [vertical, setVertical] = useState<'wealth' | 'banking' | 'markets' | 'real_estate' | 'real-estate'>('wealth');
  const [severity, setSeverity] = useState<'high' | 'critical' | 'existential'>('high');
  const [details, setDetails] = useState('');
  const [deadline, setDeadline] = useState('');
  const [accountableExec, setAccountableExec] = useState('Vikram Malhotra (NM - Wealth)');
  const s = useSubmitAction();

  const handleCreateRisk = async () => {
    if (!title.trim() || !details.trim() || !deadline) {
      s.setError('Please provide title, details, and executive deadline.');
      return;
    }
    await s.run(async () => {
      await ceoApi.createOperatingRisk({
        vertical: (vertical === 'real_estate' ? 'real-estate' : vertical) as 'wealth' | 'banking' | 'markets' | 'real-estate',
        riskCategory: 'regulatory_breach',
        severity,
        title: title.trim(),
        details: details.trim(),
        accountableExecutive: accountableExec,
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

  if (initialLoading) return <SkeletonRows rows={6} />;

  return (
    <div className="space-y-6">
      <DeckBreadcrumbs actionCode="CEO-08" actionTitle="REVIEW CRITICAL COMPLAINT OR OPERATING RISK" />

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-center justify-between">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={clearError}>Dismiss</Button>
        </div>
      ) : null}
      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}
      {s.error ? <p role="alert" className="text-sm text-destructive">{s.error}</p> : null}

      <ContextCard
        pills={[
          { label: 'Register Status', value: `${(risks || []).filter((r) => r.status === 'open').length} Open Exposures` },
          { label: 'Highest Severity', value: 'Critical' },
          { label: 'Legal Audit', value: 'Active Oversight', badgeTone: 'open' },
          { label: 'Escalation Tier', value: 'Board Audit' },
        ]}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Board-Level Operating Risk Register</CardTitle>
              <Button size="sm" variant="outline" onClick={() => load()}>Refresh</Button>
            </CardHeader>
            <CardContent>
              {!risks || risks.length === 0 ? (
                <EmptyState title="No active risks" message="All critical operating risks have been resolved." />
              ) : (
                <div className="space-y-3">
                  {risks.map((r) => (
                    <div key={r.id} className="p-3.5 border border-border/40 rounded-lg space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-foreground text-sm">{r.title}</span>
                          <span className="text-[11px] text-muted-foreground ml-2">Vertical: {r.vertical.toUpperCase()}</span>
                        </div>
                        <Badge tone={r.severity === 'existential' || r.severity === 'critical' ? 'overdue' : 'pending'}>
                          {r.severity.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground leading-relaxed">{r.details}</p>
                      <div className="flex items-center justify-between pt-1 border-t border-border/40">
                        <span className="text-muted-foreground">Accountable: <strong className="text-foreground">{r.accountable_executive}</strong></span>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">Deadline: <strong className="text-foreground">{new Date(r.decision_deadline).toLocaleDateString('en-IN')}</strong></span>
                          {r.status === 'open' ? (
                            <Button size="sm" variant="secondary" onClick={() => handleResolveRisk(r.id)}>Sign Off Mitigation</Button>
                          ) : (
                            <Badge tone="open">RESOLVED</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <DeckBottomBar
            actionLabel="Register Critical Operating Risk"
            onAction={() => setDrawerOpen(true)}
          />
        </div>

        <div className="space-y-4">
          <DeckRightRail
            steps={[
              'Inspect the executive risk summary and previous decisions.',
              'Set accountable owner, priority and due date.',
              'Escalate specialist decisions to finance or policy owners where appropriate.',
            ]}
            failure="A sensitive incident may require a restricted case grant; seniority alone cannot bypass that boundary."
            permission="Show only the minimum required personal/customer information. Preserve evidence and suppression controls."
          />
        </div>
      </div>

      {/* Drawer: Log Risk */}
      <Panel open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Log Operating Risk">
        <div className="space-y-4 p-4">
          <FormField label="Risk Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. SEBI Advisory Fee Disclosure Compliance" />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Vertical">
              <Select value={vertical} onChange={(e) => setVertical(e.target.value as any)}>
                <option value="wealth">Wealth</option>
                <option value="banking">Banking</option>
                <option value="markets">Markets</option>
                <option value="real_estate">Real Estate</option>
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
          <FormField label="Accountable Executive">
            <Select value={accountableExec} onChange={(e) => setAccountableExec(e.target.value)} className="w-full text-xs">
              <option value="Vikram Malhotra (NM - Wealth)">Vikram Malhotra (NM - Wealth)</option>
              <option value="Suresh Nair (NM - Banking)">Suresh Nair (NM - Banking)</option>
              <option value="Sanjay Singhania (NM - Markets)">Sanjay Singhania (NM - Markets)</option>
              <option value="Aditya Singhania (NM - Real Estate)">Aditya Singhania (NM - Real Estate)</option>
              <option value="Ananya Roy (CFO - Finance)">Ananya Roy (CFO - Finance)</option>
              <option value="Rajiv Mehta (CEO - Executive)">Rajiv Mehta (CEO - Executive)</option>
            </Select>
          </FormField>
          <FormField label="Risk Details &amp; Exposure">
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
  const loadPreview = useCallback(() => ceoApi.previewBoardPack('October 2026'), []);
  const loadSchedules = useCallback(() => ceoApi.listBoardSchedules(), []);

  const [preview, loadPrevData, { initialLoading, error, clearError }] = useLoad<any>(loadPreview);
  const [schedules, loadSchedData] = useLoad<any[]>(loadSchedules);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [title, setTitle] = useState('Quarterly Board of Directors Pack');
  const [frequency, setFrequency] = useState<'monthly' | 'quarterly' | 'annual'>('quarterly');
  const [cadence, setCadence] = useState('Last Friday of quarter, 17:00 IST');
  const [stakeholders, setStakeholders] = useState('board@finverse.demo, cfo@finverse.demo');
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
      loadSchedData();
    }, 'Board pack schedule configured.');
  };

  if (initialLoading) return <SkeletonRows rows={6} />;

  return (
    <div className="space-y-6">
      <DeckBreadcrumbs actionCode="CEO-10" actionTitle="CREATE EXECUTIVE OR BOARD MEETING PACK" />

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-center justify-between">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={clearError}>Dismiss</Button>
        </div>
      ) : null}
      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}
      {s.error ? <p role="alert" className="text-sm text-destructive">{s.error}</p> : null}

      <ContextCard
        pills={[
          { label: 'Pack Format', value: 'High-Res PDF (%PDF)' },
          { label: 'Design Palette', value: '#113F3D Finverse Deep' },
          { label: 'Audited Cutoff', value: 'October 2026' },
          { label: 'Recipient Tier', value: 'Board of Directors', badgeTone: 'open' },
        ]}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {preview ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">Board Pack Certified Snapshots</CardTitle>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => loadPrevData()}>Refresh</Button>
                  <Button size="sm" variant="default" onClick={handleExportPdf} disabled={s.busy}>
                    Export Board PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="p-3 bg-muted/20 border border-border/40 rounded-lg space-y-1">
                  <div className="font-bold text-foreground">Section 1: Enterprise Operating Picture</div>
                  <p className="text-muted-foreground">
                    Target: ₹{((preview?.picture?.kpis?.totalRevenueTarget || 0) / 10000000).toFixed(1)} Cr | Attainment: ₹{((preview?.picture?.kpis?.totalDeliveredRevenue || 0) / 10000000).toFixed(1)} Cr ({preview?.picture?.kpis?.revenueAttainmentPercent || 0}%)
                  </p>
                </div>

                <div className="p-3 bg-muted/20 border border-border/40 rounded-lg space-y-1">
                  <div className="font-bold text-foreground">Section 2: Cross-Vertical Margins &amp; Headcount</div>
                  <p className="text-muted-foreground">
                    All 4 divisions represented with FX normalized margins and blended CAC.
                  </p>
                </div>

                <div className="p-3 bg-muted/20 border border-border/40 rounded-lg space-y-1">
                  <div className="font-bold text-foreground">Section 3: Growth Initiatives &amp; Risk Register</div>
                  <p className="text-muted-foreground">
                    {preview?.initiatives?.length || 0} Growth Initiatives | {preview?.criticalRisks?.length || 0} Critical Operating Risks
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Schedules Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Automated Distribution Schedules</CardTitle>
              <Button size="sm" variant="secondary" onClick={() => setDrawerOpen(true)}>
                New Schedule
              </Button>
            </CardHeader>
            <CardContent>
              {!schedules || schedules.length === 0 ? (
                <EmptyState title="No schedules configured" message="Set up recurring delivery for the Board of Directors." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border/60 uppercase text-muted-foreground font-semibold">
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
                          <td className="py-2.5 px-3 text-muted-foreground">{Array.isArray(sc.stakeholders) ? sc.stakeholders.join(', ') : ''}</td>
                          <td className="py-2.5 px-3"><Badge tone="open">{sc.status.toUpperCase()}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <DeckBottomBar
            actionLabel="Generate &amp; Download Board Pack PDF"
            busy={s.busy}
            disabled={s.busy}
            onAction={handleExportPdf}
          />
        </div>

        <div className="space-y-4">
          <DeckRightRail
            steps={[
              'Choose certified snapshots and recipient-appropriate detail.',
              'Preview the executive narrative, charts and decision list.',
              'Generate an audited PDF with protected download and expiry.',
            ]}
            failure="If a section is provisional, label it clearly instead of mixing it into certified results."
            permission="Board access is not assumed as a user role. External recipients require an explicitly approved sharing process."
          />
        </div>
      </div>

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
  const loadCommitments = useCallback(() => ceoApi.listCommitments(), []);
  const [commitments, load, { initialLoading, error, clearError }] = useLoad<any[]>(loadCommitments);
  const s = useSubmitAction();

  const handleFulfill = async (id: string) => {
    await s.run(async () => {
      await ceoApi.fulfillCommitment(id, {
        fulfillmentNotes: 'Mandate delivered and ratified by CEO.',
      });
      load();
    }, 'Commitment marked fulfilled.');
  };

  if (initialLoading) return <SkeletonRows rows={6} />;

  return (
    <div className="space-y-6">
      <DeckBreadcrumbs actionCode="CEO-11" actionTitle="FOLLOW THROUGH ON EXECUTIVE COMMITMENTS" />

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-center justify-between">
          <span>{error}</span>
          <Button size="sm" variant="outline" onClick={clearError}>Dismiss</Button>
        </div>
      ) : null}
      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}
      {s.error ? <p role="alert" className="text-sm text-destructive">{s.error}</p> : null}

      <ContextCard
        pills={[
          { label: 'Commitment Queue', value: `${(commitments || []).filter((c) => c.status === 'in_progress').length} In-Progress` },
          { label: 'Follow-Through SLA', value: '14 Days' },
          { label: 'Outcome Evidence', value: 'Mandatory' },
          { label: 'Resolution Rate', value: '94%', badgeTone: 'open' },
        ]}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Executive Directive &amp; Mandate Tracker</CardTitle>
              <Button size="sm" variant="outline" onClick={() => load()}>Refresh</Button>
            </CardHeader>
            <CardContent>
              {!commitments || commitments.length === 0 ? (
                <EmptyState title="No active commitments" message="All executive commitments have been fulfilled." />
              ) : (
                <div className="space-y-3">
                  {commitments.map((c) => (
                    <div key={c.id} className="p-3.5 border border-border/40 rounded-lg space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-foreground text-sm">{c.title}</span>
                          <span className="text-[11px] text-muted-foreground ml-2">Lead: {c.accountable_leader}</span>
                        </div>
                        <Badge tone={c.status === 'fulfilled' ? 'open' : 'pending'}>
                          {c.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground leading-relaxed">{c.actionable_mandate}</p>
                      <div className="flex items-center justify-between pt-1 border-t border-border/40">
                        <span className="text-muted-foreground">Due Date: <strong className="text-foreground">{new Date(c.due_date).toLocaleDateString('en-IN')}</strong></span>
                        {c.status === 'in_progress' ? (
                          <Button size="sm" variant="secondary" onClick={() => handleFulfill(c.id)}>Mark Fulfilled</Button>
                        ) : (
                          <span className="text-xs text-primary font-semibold">Fulfilled with verified outcome</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <DeckBottomBar
            actionLabel="Review Overdue Executive Directives"
            onAction={() => load()}
          />
        </div>

        <div className="space-y-4">
          <DeckRightRail
            steps={[
              'Review decisions requiring action and overdue commitments.',
              'Update own actions or request evidence from the accountable leader.',
              'Close only after recording the actual outcome.',
            ]}
            failure="Overdue delegated actions return to the accountable sponsor for intervention."
            permission="Delegating an action does not delegate a role, approval limit or dashboard access."
          />
        </div>
      </div>
    </div>
  );
}
