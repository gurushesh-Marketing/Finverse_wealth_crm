import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { MyDayResponse } from '@finverse/contracts';
import { api } from '../lib/api';
import { wealthApi, type TaskView } from '../lib/wealth-api';
import { tlApi } from '../lib/tl-api';
import { useSession } from '../lib/session';
import { label } from '../lib/labels';
import { PageHeader, Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { EmptyState, ErrorState, SkeletonRows, SuccessNote } from '../components/ui/states';
import { cn } from 'cn';

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function fmtFull(iso: string): string {
  return `${fmtDate(iso)}, ${fmtTime(iso)}`;
}

function MetricCard({
  label: lbl,
  value,
  denom,
  caption,
  highlight = false,
}: {
  label: string;
  value: number | string;
  denom?: number | string;
  caption?: string;
  highlight?: boolean;
}) {
  const pct =
    typeof value === 'number' && typeof denom === 'number' && denom > 0
      ? Math.min(100, Math.round((value / denom) * 100))
      : null;

  return (
    <Card className={cn('p-4 transition-shadow hover:shadow-sm', highlight && 'border-primary/30 bg-[#DCEEEA]/20')}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{lbl}</span>
        {pct !== null ? (
          <span className="text-xs font-mono text-accent">{pct}%</span>
        ) : null}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="font-heading text-2xl font-bold tracking-tight text-foreground">{value}</span>
        {denom !== undefined ? (
          <span className="text-sm font-medium text-muted-foreground">/ {denom}</span>
        ) : null}
      </div>
      {pct !== null ? (
        <div className="mt-2 h-1.5 w-full rounded-full bg-secondary overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-accent transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
      ) : null}
      {caption ? <p className="mt-1.5 text-xs text-muted-foreground">{caption}</p> : null}
    </Card>
  );
}

function TrendChart({ signal }: { signal: any }) {
  const counts: number[] = signal?.trend?.counts?.length ? signal.trend.counts : [12, 18, 15, 22, 28, 24, 31];
  const days: string[] = signal?.trend?.days?.length ? signal.trend.days : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const max = Math.max(1, ...counts);
  const w = 320, h = 64;
  const step = counts.length > 1 ? w / (counts.length - 1) : w;
  const points = counts.map((n, i) => `${i * step},${h - (n / max) * (h - 14) - 7}`).join(' ');

  return (
    <div className="mt-2">
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="Verified activity trend, last 7 days">
        <defs>
          <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#113F3D" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#113F3D" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <polygon fill="url(#trendGradient)" points={`0,${h} ${points} ${w},${h}`} />
        <polyline fill="none" stroke="#113F3D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
      </svg>
      <div className="mt-2 flex justify-between text-[11px] font-medium text-muted-foreground">
        {days.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
    </div>
  );
}

export function MyDayPage() {
  const { session } = useSession();
  const [data, setData] = useState<MyDayResponse | null>(null);
  const [tasks, setTasks] = useState<TaskView[]>([]);
  const [signal, setSignal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [availability, setAvailability] = useState<string>('available');
  const [saved, setSaved] = useState<string | null>(null);
  const [showContractModal, setShowContractModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);

    try {
      const dayRes = await api.myDay();
      setData(dayRes);
      setAvailability(dayRes.availability?.status ?? 'available');
    } catch {
      setError(true);
    }

    try {
      const taskRes = await wealthApi.tasks();
      setTasks(taskRes.tasks.filter((t) => t.status === 'open'));
    } catch (err) {
      console.warn('Tasks fetch fallback:', err);
    }

    try {
      const sig = await tlApi.daySignal();
      setSignal(sig);
    } catch (err) {
      console.warn('Signal fetch fallback:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function changeAvailability(status: string) {
    setAvailability(status);
    try {
      await wealthApi.setAvailability({ status: status as 'available' | 'busy' | 'away' });
      setSaved(`Availability set to ${status} (effective now). Ownership unchanged.`);
    } catch {
      setSaved('Availability could not be saved. Try again.');
    }
  }

  const overdue = tasks.filter((t) => new Date(t.dueAt).getTime() < Date.now());
  const upcoming = tasks.filter((t) => new Date(t.dueAt).getTime() >= Date.now());
  const next = overdue[0] ?? upcoming[0] ?? null;
  const staleMinutes = data ? (Date.now() - new Date(data.asOf).getTime()) / 60000 : 0;

  const location = useLocation();
  const isBanking = location.pathname.startsWith('/banking');
  const isMarkets = location.pathname.startsWith('/markets');
  const isRealEstate = location.pathname.startsWith('/real-estate') || location.pathname.startsWith('/real_estate');
  const basePath = isBanking ? '/banking' : isMarkets ? '/markets' : isRealEstate ? '/real-estate' : '/wealth';
  const verticalTitle = isBanking ? 'BANKING' : isMarkets ? 'MARKETS & SECURITIES' : isRealEstate ? 'REAL ESTATE ADVISORY' : 'WEALTH';
  const verticalScopeLabel = isBanking ? 'Banking scope' : isMarkets ? 'Markets scope' : isRealEstate ? 'Real Estate scope' : 'Wealth scope';

  // Deck P005, P006 / P007 Pipeline stages
  const pipelineStages = isBanking
    ? [
        { num: '01', name: 'New', count: signal?.stageFlow?.find((s: any) => s.stage === 'new')?.count ?? 18 },
        { num: '02', name: 'Eligibility', count: signal?.stageFlow?.find((s: any) => s.stage === 'eligibility' || s.stage === 'contacted')?.count ?? 12 },
        { num: '03', name: 'Documents', count: signal?.stageFlow?.find((s: any) => s.stage === 'documents')?.count ?? 9 },
        { num: '04', name: 'Sanction', count: signal?.stageFlow?.find((s: any) => s.stage === 'sanction')?.count ?? 6 },
        { num: '05', name: 'Disbursal', count: signal?.stageFlow?.find((s: any) => s.stage === 'disbursal' || s.stage === 'converted')?.count ?? 4 },
      ]
    : isMarkets
    ? [
        { num: '01', name: 'New', count: signal?.stageFlow?.find((s: any) => s.stage === 'new')?.count ?? 25 },
        { num: '02', name: 'KYC', count: signal?.stageFlow?.find((s: any) => s.stage === 'kyc' || s.stage === 'contacted')?.count ?? 19 },
        { num: '03', name: 'Risk Profile', count: signal?.stageFlow?.find((s: any) => s.stage === 'risk-profile')?.count ?? 14 },
        { num: '04', name: 'Demat Opened', count: signal?.stageFlow?.find((s: any) => s.stage === 'demat-opened')?.count ?? 8 },
        { num: '05', name: 'Funded & Active', count: signal?.stageFlow?.find((s: any) => s.stage === 'active-funded' || s.stage === 'converted')?.count ?? 5 },
      ]
    : isRealEstate
    ? [
        { num: '01', name: 'New', count: signal?.stageFlow?.find((s: any) => s.stage === 'new')?.count ?? 15 },
        { num: '02', name: 'Requirement', count: signal?.stageFlow?.find((s: any) => s.stage === 'requirement' || s.stage === 'qualified')?.count ?? 11 },
        { num: '03', name: 'Site Visit', count: signal?.stageFlow?.find((s: any) => s.stage === 'site-visit')?.count ?? 8 },
        { num: '04', name: 'Booking', count: signal?.stageFlow?.find((s: any) => s.stage === 'booking')?.count ?? 5 },
        { num: '05', name: 'Registration', count: signal?.stageFlow?.find((s: any) => s.stage === 'registration' || s.stage === 'converted')?.count ?? 3 },
      ]
    : [
        { num: '01', name: 'New', count: signal?.stageFlow?.find((s: any) => s.stage === 'new')?.count ?? 42 },
        { num: '02', name: 'Discovery', count: signal?.stageFlow?.find((s: any) => s.stage === 'contacted')?.count ?? 31 },
        { num: '03', name: 'Suitability', count: signal?.stageFlow?.find((s: any) => s.stage === 'qualified')?.count ?? 24 },
        { num: '04', name: 'Proposal', count: signal?.stageFlow?.find((s: any) => s.stage === 'follow-up')?.count ?? 14 },
        { num: '05', name: 'Onboarding', count: signal?.stageFlow?.find((s: any) => s.stage === 'converted')?.count ?? 7 },
      ];

  return (
    <div className="space-y-6">
      {/* Workspace Sub-banner and Top Actions (Deck P036 / P038) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-muted-foreground">
            <span>Personal Workspace</span>
            <span>/</span>
            <span className="text-primary font-bold">{verticalTitle}</span>
          </div>
          <h1 className="mt-1 font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Your next conversation starts here.
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A clear path through today&apos;s assigned prospects, promised follow-ups and customer context.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="default" className="bg-[#DCEEEA] text-primary font-medium inline-flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            {verticalScopeLabel}
          </Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowContractModal(true)}
            className="border-primary/40 font-medium hover:bg-secondary inline-flex items-center gap-1"
          >
            <span>Actions</span>
          </Button>
          <div className="flex items-center rounded-md border border-border bg-card p-0.5" role="group" aria-label="Caller availability">
            {(['available', 'busy', 'away'] as const).map((st) => (
              <button
                key={st}
                type="button"
                aria-pressed={availability === st}
                onClick={() => void changeAvailability(st)}
                className={cn(
                  'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                  availability === st
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {st === 'away' ? 'Off' : st[0].toUpperCase() + st.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sub-navigation Tabs matching Action Deck P036 */}
      <div className="flex items-center gap-6 border-b border-border/40 pb-2 text-sm font-medium">
        <span className="border-b-2 border-primary pb-2 font-semibold text-primary">
          My day
        </span>
        <Link to={`${basePath}/prospects`} className="pb-2 text-muted-foreground hover:text-foreground">
          Lead inbox
        </Link>
        <Link to={`${basePath}/deals`} className="pb-2 text-muted-foreground hover:text-foreground">
          Pipeline
        </Link>
        <Link to={`${basePath}/reports`} className="pb-2 text-muted-foreground hover:text-foreground">
          Performance
        </Link>
      </div>

      {saved ? <SuccessNote>{saved}</SuccessNote> : null}

      {session?.role === 'TL' ? (
        <div className="rounded-md border border-border bg-secondary/60 px-3 py-2 text-sm text-accent">
          Your Team Lead workspace lives under Team lead in the sidebar. You are seeing your personal caller view here.
        </div>
      ) : null}

      {/* Main Top Grid: Tall Emerald "Your Priority" Card + 4 Metric Cards & Middle Rows */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Tall Emerald Card (Deck P006) */}
        <section
          className="relative flex flex-col justify-between rounded-xl bg-primary p-6 text-primary-foreground shadow-sm lg:col-span-4"
          aria-label="Your Priority"
        >
          <div>
            <div className="flex items-center justify-between text-[#7FB5AE]">
              <span className="text-xs font-bold tracking-widest uppercase">Your Priority</span>
              <svg className="h-5 w-5 opacity-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>

            <h2 className="mt-4 font-heading text-2xl font-bold tracking-tight text-white">
              Next best action
            </h2>

            {loading ? (
              <p className="mt-3 text-sm text-[#DCEEEA]">Loading your queue…</p>
            ) : next ? (
              <div className="mt-3 space-y-2">
                <p className="text-sm font-medium text-[#DCEEEA]">
                  Call the promised callback before new outreach.
                </p>
                <div className="rounded-lg bg-black/20 p-3 text-xs backdrop-blur-sm">
                  <div className="font-semibold text-white">
                    {next.leadName || next.leadId}
                  </div>
                  <div className="mt-1 text-[#DCEEEA]">
                    {label(next.action)} · Due {fmtTime(next.dueAt)}
                  </div>
                  <div className="mt-1 truncate text-muted text-[#7FB5AE]">
                    {next.purpose}
                  </div>
                </div>
                <Link
                  to={`${basePath}/prospects/${next.leadId}`}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-[#DCEEEA]"
                >
                  Open work area →
                </Link>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                <p className="text-sm text-[#DCEEEA]">
                  Queue clear — capture a self-sourced enquiry or review conversations.
                </p>
                <Link
                  to={`${basePath}/prospects`}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-[#DCEEEA]"
                >
                  Open lead inbox →
                </Link>
              </div>
            )}
          </div>

          <div className="mt-6 border-t border-white/10 pt-4 text-[11px] text-[#7FB5AE]">
            <span className="font-mono">
              As of {data ? fmtTime(data.asOf) : '09:42 IST'}
            </span>
            {staleMinutes > 15 ? (
              <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-200">Stale</span>
            ) : null}
            <span className="ml-2">· Assigned scope only</span>
          </div>
        </section>

        {/* Right Section: 4 Metric Cards + Trend + Needs Attention (Deck P006) */}
        <div className="space-y-6 lg:col-span-8">
          {/* 4 Metric Cards Matching Deck P006 */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MetricCard
              label="Due today"
              value={data?.counts.dueToday ?? 18}
              caption="Across assigned leads"
              highlight
            />
            <MetricCard
              label="Overdue"
              value={data?.counts.overdue ?? 3}
              caption="Updated today"
            />
            <MetricCard
              label="Contacted / eligible"
              value={signal?.completion?.done ?? 31}
              denom={signal?.completion?.planned ?? 50}
              caption="Selected period"
            />
            <MetricCard
              label="Wins / target"
              value={signal?.whr?.wins ?? 7}
              denom={signal?.whr?.target || 10}
              caption="View breakdown"
            />
          </div>

          {/* Middle Row: Trend Chart & Where to Act Next */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Verified Activity Trend */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Operating Signal
                    </span>
                    <CardTitle className="text-base">Verified activity trend</CardTitle>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge tone="default" className="text-[10px]">Last 7 days</Badge>
                    <Badge tone="simulated" className="text-[10px]">Simulated</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading && !signal ? (
                  <SkeletonRows rows={2} />
                ) : (
                  <>
                    <div className="flex items-baseline gap-2">
                      <span className="font-heading text-2xl font-bold text-foreground">
                        {signal?.trend?.total ?? 31} calls
                      </span>
                      <span className="text-xs font-semibold text-accent">
                        ↗ +8.4%
                      </span>
                    </div>
                    <TrendChart signal={signal} />
                    <p className="mt-3 text-[11px] text-muted-foreground">
                      Verified activity and approved outcomes only.
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Where to Act Next */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Needs Attention
                    </span>
                    <CardTitle className="text-base">Where to act next</CardTitle>
                  </div>
                  <span className="flex h-5 w-5 items-center justify-center rounded-full border border-border text-xs text-muted-foreground">
                    i
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                {loading && !signal ? (
                  <SkeletonRows rows={3} />
                ) : (
                  <ul className="divide-y divide-border/60" role="list">
                    {(signal?.attention ?? [
                      { count: 3, label: 'Promised callbacks', caption: '11:00 is the next deadline', href: `${basePath}/tasks` },
                      { count: 8, label: 'Uncontacted today', caption: isBanking ? 'New borrower enquiries & facilities' : isMarkets ? 'New trading accounts & broking leads' : 'New website and intake leads', href: `${basePath}/prospects` },
                      { count: 4, label: 'Replies to review', caption: 'Two request a call', href: `${basePath}/activities` },
                    ]).map((row: any) => (
                      <li key={row.label}>
                        <Link
                          to={row.href}
                          className="group flex items-center justify-between py-2.5 transition-colors hover:bg-secondary/40"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-7 font-heading text-lg font-bold text-primary">
                              {String(row.count).padStart(2, '0')}
                            </span>
                            <div>
                              <div className="text-sm font-semibold text-foreground group-hover:text-primary">
                                {row.label}
                              </div>
                              <div className="text-xs text-muted-foreground">{row.caption}</div>
                            </div>
                          </div>
                          <span className="text-sm text-muted-foreground group-hover:translate-x-0.5 group-hover:text-primary transition-transform">
                            ›
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Today's Commitments Section (Deck P006 / P007) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/60 pb-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Your Assigned Work
            </span>
            <CardTitle className="text-lg">Today&apos;s commitments</CardTitle>
          </div>
          <Link
            to={`${basePath}/tasks`}
            className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
          >
            View all →
          </Link>
        </CardHeader>

        <CardContent className="pt-4">
          {loading ? (
            <SkeletonRows rows={4} />
          ) : error ? (
            <ErrorState onRetry={() => void load()} />
          ) : tasks.length === 0 ? (
            <EmptyState
              title="Nothing due today"
              message="New follow-ups, promised callbacks and customer tasks will appear here."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm" role="table">
                <thead>
                  <tr className="border-b border-border/60 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <th scope="col" className="pb-2 font-medium">Lead ID</th>
                    <th scope="col" className="pb-2 font-medium">Prospect</th>
                    <th scope="col" className="pb-2 font-medium">Context</th>
                    <th scope="col" className="pb-2 text-right font-medium">Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {tasks.slice(0, 8).map((task) => {
                    const isOverdue = new Date(task.dueAt).getTime() < Date.now();
                    return (
                      <tr key={task.id} className="transition-colors hover:bg-secondary/30">
                        <td className="py-2.5 font-mono text-xs font-semibold">
                          <Link
                            to={`${basePath}/prospects/${task.leadId}`}
                            className="text-primary underline-offset-4 hover:underline"
                          >
                            {task.leadId}
                          </Link>
                        </td>
                        <td className="py-2.5 font-medium text-foreground">
                          {task.leadName || (isBanking ? 'Arjun Commercial Works' : 'Aarav Shah')}
                        </td>
                        <td className="py-2.5 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {label(task.action)}
                          </span>
                          {' — '}
                          <span>{task.purpose}</span>
                        </td>
                        <td className="py-2.5 text-right font-mono text-xs">
                          {isOverdue ? (
                            <span className="inline-flex items-center gap-1 rounded bg-destructive/10 px-2 py-0.5 font-semibold text-destructive">
                              Overdue {fmtTime(task.dueAt)}
                            </span>
                          ) : (
                            <span className="text-foreground">{fmtTime(task.dueAt)}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 border-t border-border/60 pt-3 text-xs text-muted-foreground">
            {isBanking
              ? 'Only assigned Commercial Banking borrowers appear. A transfer changes this queue at its effective time.'
              : isMarkets
              ? 'Only assigned Markets & Trading clients appear. A transfer changes this queue at its effective time.'
              : 'Only assigned Wealth enquiries appear. A transfer changes this queue at its effective time.'}
          </div>
        </CardContent>
      </Card>

      {/* Bottom Row (Deck P007): Opportunity Flow & Shortcuts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Pipeline Opportunity Flow */}
        <Card className="lg:col-span-7">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Opportunity Flow
              </span>
              <CardTitle className="text-base">{isBanking ? 'Banking pipeline' : isMarkets ? 'Markets pipeline' : 'Wealth pipeline'}</CardTitle>
            </div>
            <Badge tone="default" className="text-[10px]">Illustrative stages</Badge>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-2 pt-2">
              {pipelineStages.map((stage) => (
                <div key={stage.num} className="space-y-1">
                  <span className="text-[10px] font-mono text-muted-foreground">{stage.num}</span>
                  <div className="text-xs font-semibold text-foreground truncate">{stage.name}</div>
                  <div className="font-heading text-xl font-bold text-primary">{stage.count}</div>
                  <div className="h-1 w-full rounded-full bg-primary/20 overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, stage.count * 2)}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 border-t border-border/60 pt-3">
              <Link
                to={`${basePath}/deals`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary underline-offset-4 hover:underline"
              >
                Explore all 28 Sales caller actions →
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Shortcuts / Continue the Work */}
        <Card className="lg:col-span-5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Shortcuts
              </span>
              <CardTitle className="text-base">Continue the work</CardTitle>
            </div>
            <span className="text-xs font-semibold text-muted-foreground">28 defined actions</span>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1" role="list">
              <li>
                <button
                  type="button"
                  onClick={() => setShowContractModal(true)}
                  className="group flex w-full items-center justify-between rounded-md p-2 text-left text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  <span className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-primary font-bold">+</span>
                    <span>Start the day and prioritise work</span>
                  </span>
                  <span className="text-muted-foreground group-hover:translate-x-0.5 group-hover:text-primary transition-transform">→</span>
                </button>
              </li>
              <li>
                <Link
                  to={`${basePath}/prospects`}
                  className="group flex items-center justify-between rounded-md p-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  <span className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-primary">🔍</span>
                    <span>Filter, search and save a lead view</span>
                  </span>
                  <span className="text-muted-foreground group-hover:translate-x-0.5 group-hover:text-primary transition-transform">→</span>
                </Link>
              </li>
              <li>
                <Link
                  to={next ? `${basePath}/prospects/${next.leadId}` : `${basePath}/prospects`}
                  className="group flex items-center justify-between rounded-md p-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  <span className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-primary">🎧</span>
                    <span>Open a prospect and inspect the full record</span>
                  </span>
                  <span className="text-muted-foreground group-hover:translate-x-0.5 group-hover:text-primary transition-transform">→</span>
                </Link>
              </li>
            </ul>

            <p className="mt-4 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
              Illustrative business values; authority and product rules remain to be confirmed.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* SC-01 Contract Guidance Modal (Deck P043 / P044) */}
      {showContractModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label="SC-01 / MY DAY — Start the day and prioritise work"
        >
          <div
            className="absolute inset-0"
            onClick={() => setShowContractModal(false)}
            aria-hidden
          />
          <div className="relative w-full max-w-2xl rounded-xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-heading text-base font-bold text-foreground">
                  SC-01 / MY DAY — Start the day and prioritise work
                </h3>
                <p className="text-xs text-muted-foreground">
                  Physical deck specification from P043 and P044.
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
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-secondary/30 p-3 sm:grid-cols-4">
                <div>
                  <span className="block text-[10px] uppercase text-muted-foreground font-semibold">Period</span>
                  <span className="font-semibold text-foreground">Today, {new Date().toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-muted-foreground font-semibold">Priority</span>
                  <span className="font-semibold text-foreground">Overdue first</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-muted-foreground font-semibold">Availability</span>
                  <span className="font-semibold text-accent capitalize">{availability}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-muted-foreground font-semibold">Queue</span>
                  <span className="font-semibold text-foreground">My active assignment</span>
                </div>
              </div>

              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                <div className="rounded-lg border border-border p-3">
                  <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px]">How This Works / Next Steps</h4>
                  <ol className="mt-1.5 list-decimal pl-4 space-y-1 text-muted-foreground">
                    <li><strong className="text-foreground">01</strong> Review overdue, promised callbacks and new lead deadlines.</li>
                    <li><strong className="text-foreground">02</strong> Open a priority row to enter that prospect record.</li>
                    <li><strong className="text-foreground">03</strong> Mark availability for allocation; this never changes the login role.</li>
                  </ol>
                </div>

                <div className="rounded-lg border border-border p-3">
                  <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px]">Before It Can Proceed</h4>
                  <p className="mt-1 text-muted-foreground">
                    Current active assignment is mandatory. Availability uses approved hours and absence status; it does not change ownership.
                  </p>
                </div>

                <div className="rounded-lg border border-border p-3">
                  <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px]">System Commit</h4>
                  <p className="mt-1 text-muted-foreground">
                    Load own tasks, lead counts and reminders with an as-of timestamp. Record availability changes with effective time.
                  </p>
                </div>

                <div className="rounded-lg border border-border p-3">
                  <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px]">When a Check Fails</h4>
                  <p className="mt-1 text-muted-foreground">
                    No active assignment: show access pending. A delayed provider shows a stale-data badge, not zero calls.
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
