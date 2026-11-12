import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { wealthApi, type TaskView } from '../lib/wealth-api';
import { api } from '../lib/api';
import type { LeadSummary } from '@finverse/contracts';
import { PageHeader, Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/select';
import { Label } from '../components/ui/input';
import { SkeletonRows, EmptyState, SuccessNote } from '../components/ui/states';
import { DrawerPanel } from '../components/ui/drawer';
import { label } from '../lib/labels';
import { ManualActivityForm, InboundForm, fmt, useSubmit } from '../components/leads/RecordForms';

export function TasksAreaPage() {
  const location = useLocation();
  const basePath = location.pathname.startsWith('/banking') ? '/banking' : location.pathname.startsWith('/markets') ? '/markets' : location.pathname.startsWith('/real-estate') ? '/real-estate' : '/wealth';
  const [tasks, setTasks] = useState<TaskView[] | null>(null);
  const s = useSubmit();
  const load = () => void wealthApi.tasks().then((r) => setTasks(r.tasks)).catch(() => setTasks([]));
  useEffect(load, []);

  const groups: Array<[string, (t: TaskView) => boolean]> = [
    ['Overdue', (t) => t.status === 'open' && new Date(t.dueAt).getTime() < Date.now()],
    ['Today', (t) => t.status === 'open' && new Date(t.dueAt).toDateString() === new Date().toDateString() && new Date(t.dueAt).getTime() >= Date.now()],
    ['Later', (t) => t.status === 'open' && new Date(t.dueAt).toDateString() !== new Date().toDateString()],
    ['Finished', (t) => t.status !== 'open'],
  ];

  return (
    <div>
      <PageHeader title="Calendar & tasks" subtitle="Follow-ups with reminders · SC-11–14"
        actions={<Button size="sm" variant="outline" onClick={() => void s.run(async () => { const r = await wealthApi.tickReminders(); load(); return `Reminders executed: ${r.sent} sent.`; })}>Run due reminders</Button>} />
      {s.note ? <div className="mb-3"><SuccessNote>{s.note}</SuccessNote></div> : null}
      {s.failure ? <p role="alert" className="mb-3 text-sm text-destructive">{s.failure}</p> : null}
      {!tasks ? <SkeletonRows rows={5} /> : tasks.length === 0 ? (
        <EmptyState title="No tasks" message="Follow-ups you schedule appear here." />
      ) : groups.map(([title, match]) => {
        const rows = tasks.filter(match);
        if (rows.length === 0) return null;
        return (
          <Card key={title} className="mb-3">
            <CardContent>
              <h2 className="mb-2 text-sm font-semibold text-foreground">{title} ({rows.length})</h2>
              <ul className="divide-y divide-border" role="list">
                {rows.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-2 py-2">
                    <span className="text-xs text-muted-foreground">{fmt(t.dueAt)}</span>
                    {t.originalDueAt ? <span className="text-xs text-muted-foreground line-through">{fmt(t.originalDueAt)}</span> : null}
                    <Link to={`${basePath}/prospects/${t.leadId}`} className="text-sm font-medium text-primary hover:underline">{t.leadId}</Link>
                    <span className="text-sm">{label(t.action)}</span>
                    <span className="text-sm text-muted-foreground">{t.purpose}</span>
                    <Badge tone={t.status === 'open' ? 'open' : 'completed'}>{label(t.status)}</Badge>
                    {t.reminders.map((r) => <Badge key={r.id} tone="default">{label(`reminder ${r.status}`)}</Badge>)}
                    {t.status === 'open' ? (
                      <span className="ml-auto flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => void s.run(async () => {
                          await wealthApi.transition(t.id, { action: 'complete', outcome: 'Completed from calendar' });
                          load(); return 'Task completed.';
                        })}>Complete</Button>
                        <Button size="sm" variant="ghost" onClick={() => void s.run(async () => {
                          await wealthApi.transition(t.id, { action: 'cancel', cancellationReason: 'Cancelled from calendar' });
                          load(); return 'Task cancelled with reason.';
                        })}>Cancel</Button>
                      </span>
                    ) : (
                      <Button size="sm" variant="ghost" className="ml-auto" onClick={() => void s.run(async () => {
                        await wealthApi.transition(t.id, { action: 'reopen' });
                        load(); return 'Task reopened (logged correction).';
                      })}>Reopen</Button>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function ConversationsAreaPage() {
  const [leads, setLeads] = useState<LeadSummary[]>([]);
  const [leadId, setLeadId] = useState('');
  const [calls, setCalls] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  useEffect(() => {
    void api.leads({}).then((r) => {
      setLeads(r.leads);
      if (r.leads[0]) setLeadId(r.leads[0].id);
    }).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (!leadId) return;
    void wealthApi.conversations(leadId).then((r) => { setCalls(r.calls); setMessages(r.messages); }).catch(() => undefined);
  }, [leadId]);

  return (
    <div>
      <PageHeader title="Conversations" subtitle="Calls, messages and manual activities · SC-06–10" />
      <Card className="mb-4">
        <CardContent>
          <Label htmlFor="conv-lead">Prospect</Label>
          <Select id="conv-lead" value={leadId} onChange={(e) => setLeadId(e.target.value)}>
            {leads.map((l) => <option key={l.id} value={l.id}>{l.displayName} ({l.id})</option>)}
          </Select>
        </CardContent>
      </Card>
      {leadId ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardContent>
              <h2 className="mb-2 text-sm font-semibold">Activity feed</h2>
              <ul className="space-y-2" role="list">
                {calls.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-2 py-1 text-sm">
                    <span className="text-xs text-muted-foreground">{fmt(c.startedAt)}</span>
                    <Badge tone={c.evidenceStatus === 'manual' ? 'manual' : 'simulated'}>{label(c.evidenceStatus)}</Badge>
                    <span>{label(c.direction)} call · {label(c.status)}</span>
                  </li>
                ))}
                {messages.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-2 py-1 text-sm">
                    <span className="text-xs text-muted-foreground">{fmt(m.createdAt)}</span>
                    <Badge tone={m.direction === 'inbound' ? 'today' : 'default'}>{label(`${m.direction} ${m.channel}`)}</Badge>
                    <span>{label(m.status)}</span>
                  </li>
                ))}
                {calls.length === 0 && messages.length === 0 ? <li className="text-sm text-muted-foreground">No activity for this prospect.</li> : null}
              </ul>
            </CardContent>
          </Card>
          <div className="space-y-4">
            <DrawerPanel trigger={<Button variant="outline" className="w-full">Log manual activity (SC-08)</Button>} title="Log manual activity (SC-08)">
              <ManualActivityForm leadId={leadId} onSaved={() => void wealthApi.conversations(leadId).then((r) => { setCalls(r.calls); setMessages(r.messages); })} />
            </DrawerPanel>
            <DrawerPanel trigger={<Button variant="outline" className="w-full">Handle inbound reply (SC-10)</Button>} title="Handle inbound reply (SC-10)">
              <InboundForm leadId={leadId} onSaved={() => void wealthApi.conversations(leadId).then((r) => { setCalls(r.calls); setMessages(r.messages); })} />
            </DrawerPanel>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PipelineAreaPage() {
  const location = useLocation();
  const isBanking = location.pathname.startsWith('/banking');
  const isMarkets = location.pathname.startsWith('/markets');
  const isRealEstate = location.pathname.startsWith('/real-estate') || location.pathname.startsWith('/real_estate');
  const basePath = isBanking ? '/banking' : isMarkets ? '/markets' : isRealEstate ? '/real-estate' : '/wealth';
  const [leads, setLeads] = useState<LeadSummary[]>([]);
  useEffect(() => {
    void api.leads({}).then((r) => setLeads(r.leads)).catch(() => undefined);
  }, []);
  const stages = isBanking
    ? ['new', 'eligibility', 'documents', 'sanction', 'disbursal', 'lost']
    : isMarkets
    ? ['new', 'kyc', 'risk-profile', 'demat-opened', 'active-funded', 'lost']
    : isRealEstate
    ? ['new', 'requirement', 'site-visit', 'booking', 'registration', 'lost']
    : ['new', 'not-contacted', 'contacted', 'follow-up', 'qualified', 'converted', 'lost'];
  return (
    <div>
      <PageHeader title={isBanking ? "Commercial Banking pipeline" : isMarkets ? "Trading pipeline" : isRealEstate ? "Property pipeline" : "My pipeline"} subtitle="Stage board · SC-15–22 live on each record" />
      <div className="mb-3 text-xs text-muted-foreground">Open a record to run transition forms, qualification, proposals, conversion, loss and reopen requests.</div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {stages.map((stage) => {
          const rows = leads.filter((l) => l.stage === stage);
          return (
            <Card key={stage}>
              <CardContent>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label(stage)} ({rows.length})</h2>
                <ul className="space-y-1" role="list">
                  {rows.map((l) => (
                    <li key={l.id} className="rounded-md border border-border px-2 py-1">
                      <Link to={`${basePath}/prospects/${l.id}`} className="text-sm font-medium text-primary hover:underline">{l.displayName}</Link>
                      <div className="font-mono text-[11px] text-muted-foreground">{l.id} · {l.product}</div>
                    </li>
                  ))}
                  {rows.length === 0 ? <li className="text-xs text-muted-foreground">Empty</li> : null}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export function DocumentsAreaPage() {
  const location = useLocation();
  const basePath = location.pathname.startsWith('/banking') ? '/banking' : location.pathname.startsWith('/markets') ? '/markets' : location.pathname.startsWith('/real-estate') ? '/real-estate' : '/wealth';
  const [leads, setLeads] = useState<LeadSummary[]>([]);
  const [leadId, setLeadId] = useState('');
  useEffect(() => {
    void api.leads({}).then((r) => { setLeads(r.leads); if (r.leads[0]) setLeadId(r.leads[0].id); }).catch(() => undefined);
  }, []);
  return (
    <div>
      <PageHeader title="Documents" subtitle="Requests and evidence · SC-18–19" />
      <Card className="mb-4">
        <CardContent>
          <Label htmlFor="doc-lead">Prospect</Label>
          <Select id="doc-lead" value={leadId} onChange={(e) => setLeadId(e.target.value)}>
            {leads.map((l) => <option key={l.id} value={l.id}>{l.displayName} ({l.id})</option>)}
          </Select>
        </CardContent>
      </Card>
      {leadId ? (
        <Card>
          <CardContent>
            <p className="mb-2 text-sm text-muted-foreground">Document request and evidence management live on the record:</p>
            <Link to={`${basePath}/prospects/${leadId}`} className="text-sm font-medium text-primary hover:underline">Open {leadId} → Documents tab</Link>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export function PerformancePage() {
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'daily'>('weekly');
  const [report, setReport] = useState<any>(null);
  const s = useSubmit();
  const load = () => void wealthApi.performance(period).then(setReport).catch(() => undefined);
  useEffect(load, [period]);
  return (
    <div>
      <PageHeader title="Performance" subtitle="Personal metrics from stored events · SC-25/27"
        actions={<Button size="sm" onClick={() => void s.run(async () => {
          const exp = await wealthApi.exportPdf(period);
          const { downloadFile, exportDownloadPath } = await import('../lib/wealth-api');
          await downloadFile(exportDownloadPath(exp.id), `finverse-performance-${period}.pdf`);
          return `PDF generated (snapshot ${fmt(exp.snapshotAt)}, ${exp.metricVersion}) and downloaded.`;
        })}>Export PDF</Button>} />
      {s.note ? <div className="mb-3"><SuccessNote>{s.note}</SuccessNote></div> : null}
      <Card className="mb-4">
        <CardContent>
          <Label htmlFor="perf-period">Period</Label>
          <Select id="perf-period" value={period} onChange={(e) => setPeriod(e.target.value as 'weekly')}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </Select>
          {report ? <p className="mt-2 font-mono text-xs text-muted-foreground">as-of {fmt(report.asOf)} · {report.metricVersion} · {report.timezone}</p> : null}
        </CardContent>
      </Card>
      {!report ? <SkeletonRows rows={4} /> : (
        <Card>
          <CardContent>
            <ul className="divide-y divide-border" role="list">
              {report.metrics.map((m: any) => (
                <li key={m.key} className="py-2">
                  <details>
                    <summary className="flex cursor-pointer items-center gap-2 text-sm">
                      <span className="font-medium">{m.label}</span>
                      <span className="ml-auto font-mono">{m.value ?? 'N/A'}</span>
                      <Badge tone="default">{m.evidenceKind}</Badge>
                    </summary>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">{m.formula}</p>
                    <p className="text-xs text-muted-foreground">numerator {m.numerator} · denominator {m.denominator}</p>
                  </details>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function ReviewsPage() {
  const [reviews, setReviews] = useState<any[]>([]);
  const s = useSubmit();
  const load = () => void wealthApi.reviews().then((r) => setReviews(r.reviews)).catch(() => undefined);
  useEffect(load, []);
  return (
    <div>
      <PageHeader title="Reviews & help" subtitle="One-to-ones and requests · SC-26/28" />
      {s.note ? <div className="mb-3"><SuccessNote>{s.note}</SuccessNote></div> : null}
      <Card>
        <CardHeaderTitle>One-to-ones</CardHeaderTitle>
        <CardContent>
          {!reviews ? <SkeletonRows rows={2} /> : reviews.length === 0 ? (
            <EmptyState title="No reviews" message="Assigned one-to-ones appear here." />
          ) : (
            <ul className="divide-y divide-border" role="list">
              {reviews.map((r) => (
                <li key={r.id} className="py-2">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">{r.period}</span>
                    <span className="text-muted-foreground">reviewer: {r.reviewerName}</span>
                    <Badge tone={r.acknowledgedAt ? 'completed' : 'pending'}>{r.acknowledgedAt ? `acknowledged ${fmt(r.acknowledgedAt)}` : 'awaiting acknowledgement'}</Badge>
                    {!r.acknowledgedAt ? (
                      <Button size="sm" className="ml-auto" onClick={() => void s.run(async () => {
                        await wealthApi.respondReview(r.id, { selfReflection: 'Wins and blockers reviewed.', commitments: [], employeeResponse: 'Acknowledged (acknowledgement is not agreement).' });
                        load(); return 'Review acknowledged. Reviewer rating unchanged.';
                      })}>Acknowledge</Button>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Scorecard: {JSON.stringify(r.scorecard)}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <p className="mt-3 text-sm text-muted-foreground">
        Blockers and metric corrections (SC-28) are raised from each record's Requests tab. Handoff (SC-23) and opt-out (SC-24) entry points live on the record too.
      </p>
    </div>
  );
}

function CardHeaderTitle({ children }: { children: React.ReactNode }) {
  return <div className="border-b border-border px-4 py-3 text-base font-semibold">{children}</div>;
}
