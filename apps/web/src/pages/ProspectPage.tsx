import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import type { CallRecord, LeadDetail, MessageRecord, ProposalRecord } from '@finverse/contracts';
import { ApiError, api } from '../lib/api';
import { wealthApi, type OutcomeRequestView } from '../lib/wealth-api';
import { useSession } from '../lib/session';
import { PageHeader, Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input, Textarea } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { FormRow, BusyButton, SimulatedChip, LiveStatus, Panel } from '../components/ui/panel';
import { DeniedPanel, ErrorState, SkeletonRows, SuccessNote } from '../components/ui/states';
import { FollowUpForm } from '../components/leads/FollowUpForm';
import {
  CallPanel, DocumentsTab, EditDetailsDrawer, InboundForm, ManualActivityForm, RequestsTab, TasksTab,
  WrapUpDrawer, WhatsAppDrawer, fmt, useSubmit,
} from '../components/leads/RecordForms';
import { DrawerPanel } from '../components/ui/drawer';
import { label } from '../lib/labels';

type Tab = 'summary' | 'timeline' | 'tasks' | 'conversations' | 'documents' | 'pipeline' | 'requests';

export function ProspectPage() {
  const { id = '' } = useParams();
  const { session } = useSession();

  if (session?.role === 'TL') {
    return <Navigate to={`/management/prospects/${id}`} replace />;
  }

  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [requests, setRequests] = useState<OutcomeRequestView[]>([]);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [denied, setDenied] = useState(false);
  const [tab, setTab] = useState<Tab>('summary');
  const [justSaved, setJustSaved] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [wrapCall, setWrapCall] = useState<string | null>(null);
  const [waOpen, setWaOpen] = useState(false);
  const [showContractModal, setShowContractModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    setDenied(false);
    try {
      const [detail, reqs, conv] = await Promise.all([
        api.lead(id),
        wealthApi.requests(id),
        wealthApi.conversations(id),
      ]);
      setLead(detail);
      setRequests(reqs.requests);
      setCalls(conv.calls);
      setMessages(conv.messages);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 403)) setDenied(true);
      else setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = async (msg: string) => {
    setJustSaved(msg);
    await load();
  };

  const backLink = (
    <Link to="/wealth/prospects" className="text-xs font-semibold text-primary underline-offset-4 hover:underline">
      ← Back to Lead Inbox
    </Link>
  );

  if (loading) {
    return <div><PageHeader title="Prospect" /><SkeletonRows rows={5} /></div>;
  }
  if (denied) {
    return (
      <div>
        <PageHeader title="Prospect" />
        <DeniedPanel action={backLink} />
      </div>
    );
  }
  if (error || !lead) {
    return <div><PageHeader title="Prospect" /><ErrorState onRetry={() => void load()} /></div>;
  }

  const pendingWrap = calls.find((c) => c.needsWrapup);
  const tabs: Array<[Tab, string]> = [
    ['summary', 'Summary'], ['timeline', 'Timeline'], ['tasks', 'Tasks'],
    ['conversations', 'Conversations'], ['documents', 'Documents'],
    ['pipeline', 'Pipeline & outcomes'], ['requests', 'Requests'],
  ];

  return (
    <div className="space-y-5">
      {/* Workspace Header matching Deck P047 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-muted-foreground">
            <Link to="/wealth/prospects" className="hover:text-primary hover:underline">
              ← Sales caller workspace
            </Link>
            <span>/</span>
            <span className="text-primary font-bold">SC-03 / LEAD INBOX</span>
          </div>
          <h1 className="mt-1 font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Prospect details
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Wealth · assigned permission scope · illustrative records
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="default" className="bg-[#DCEEEA] text-primary font-medium">
            Scoped action
          </Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowContractModal(true)}
            className="border-primary/40 font-medium hover:bg-secondary"
          >
            SC-03 Guidance
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
            ✏️ Edit details (SC-04)
          </Button>
        </div>
      </div>

      {justSaved ? <SuccessNote>{justSaved}</SuccessNote> : null}

      {/* Prospect Key Banner Box matching Deck P047 */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-5 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Assigned Prospect / {lead.id}
              </span>
              <Badge tone={lead.stage === 'follow-up' ? 'open' : 'default'} className="text-[10px]">
                {label(lead.stage)}
              </Badge>
              <Badge tone={lead.dueStatus} className="text-[10px]">
                {label(lead.dueStatus)}
              </Badge>
            </div>
            <h2 className="mt-0.5 font-heading text-xl font-bold text-foreground sm:text-2xl">
              {lead.displayName} / <span className="font-mono font-medium">{lead.phone}</span>
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{lead.source}</span>
              <span>·</span>
              <span>{lead.product}</span>
              <span>·</span>
              <span>Owner: <strong className="text-foreground">{lead.ownerName || 'Asha Rao'}</strong></span>
              {lead.teamName ? <span>({lead.teamName})</span> : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => setTab('conversations')}
            className="gap-1.5 font-semibold"
          >
            <span>📞</span> Place call (SC-06)
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setWaOpen(true)}
            className="gap-1.5 font-semibold"
          >
            <span>💬</span> WhatsApp (SC-09)
          </Button>
          {pendingWrap ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setWrapCall(pendingWrap.id)}
              className="border-accent text-accent font-semibold"
            >
              Wrap-up (SC-07)
            </Button>
          ) : null}
        </div>
      </div>

      {/* Tabs navigation */}
      <div role="tablist" aria-label="Prospect sections" className="flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map(([key, lbl]) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={tab === key
              ? 'shrink-0 rounded-t-md border-x border-t border-border bg-secondary/80 px-4 py-2.5 text-sm font-bold text-primary shadow-xs'
              : 'shrink-0 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors'}
          >
            {lbl}
          </button>
        ))}
      </div>

      {tab === 'summary' ? (
        <div role="tabpanel" className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Customer Context Card matching Deck P047 */}
          <Card>
            <CardHeader className="border-b border-border/60 pb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Customer Context
              </span>
              <CardTitle className="text-base">Opportunity key facts</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-4 border-b border-border/40 pb-2">
                  <dt className="text-muted-foreground">Opportunity</dt>
                  <dd className="font-mono font-semibold text-primary">{lead.id}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-border/40 pb-2">
                  <dt className="text-muted-foreground">Contact</dt>
                  <dd className="font-semibold text-foreground">{lead.displayName} / <span className="font-mono font-normal">{lead.phone}</span></dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-border/40 pb-2">
                  <dt className="text-muted-foreground">Email</dt>
                  <dd className="text-foreground">{lead.email ?? '—'}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-border/40 pb-2">
                  <dt className="text-muted-foreground">Product</dt>
                  <dd className="font-semibold text-foreground">{lead.product}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-border/40 pb-2">
                  <dt className="text-muted-foreground">Source</dt>
                  <dd className="text-foreground">{lead.source}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-border/40 pb-2">
                  <dt className="text-muted-foreground">Owner</dt>
                  <dd className="font-semibold text-foreground">{lead.ownerName || 'Asha Rao'}{lead.teamName ? ` (${lead.teamName})` : ''}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-border/40 pb-2">
                  <dt className="text-muted-foreground">Preferred language</dt>
                  <dd className="text-foreground">{lead.preferredLanguage}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Next action</dt>
                  <dd className="font-mono text-xs font-semibold text-accent">{lead.nextActionAt ? fmt(lead.nextActionAt) : 'None scheduled'}</dd>
                </div>
              </dl>
              <div className="mt-4 flex gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                  Edit details (SC-04)
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent History Card matching Deck P047 */}
          <Card>
            <CardHeader className="border-b border-border/60 pb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Recent History
              </span>
              <CardTitle className="text-base">Timeline preview</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {lead.timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent activity recorded.</p>
              ) : (
                <ul className="space-y-3" role="list">
                  {lead.timeline.slice(0, 6).map((event) => (
                    <li key={event.id} className="border-l-2 border-primary/40 pl-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold text-foreground">• {fmt(event.occurredAt)}</span>
                        <Badge tone={event.kind === 'follow-up-scheduled' ? 'open' : 'default'} className="text-[10px]">
                          {label(event.kind)}
                        </Badge>
                        <span className="text-muted-foreground font-medium">({event.actorName})</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{event.note}</p>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-5 border-t border-border/60 pt-3">
                <DrawerPanel
                  trigger={<Button variant="outline" className="w-full">Schedule follow-up (SC-11)</Button>}
                  title="Schedule follow-up (SC-11)"
                >
                  <FollowUpForm
                    leadId={lead.id}
                    onSaved={async () => {
                      await refresh('Follow-up saved. Task and timeline updated.');
                      setTab('tasks');
                    }}
                  />
                </DrawerPanel>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === 'timeline' ? (
        <div role="tabpanel">
          <Card>
            <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
            <CardContent>
              {lead.timeline.length === 0 ? <p className="text-sm text-muted-foreground">No activity yet.</p> : (
                <ul className="space-y-3" role="list">
                  {lead.timeline.map((event) => (
                    <li key={event.id} className="border-l-2 border-secondary pl-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted-foreground">{fmt(event.occurredAt)}</span>
                        <Badge tone={event.kind === 'follow-up-scheduled' ? 'open' : 'default'}>{label(event.kind)}</Badge>
                        <span className="text-xs text-muted-foreground">{event.actorName}</span>
                      </div>
                      <p className="mt-1 text-sm text-foreground">{event.note}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === 'tasks' ? (
        <div role="tabpanel">
          <Card><CardContent><TasksTab leadId={lead.id} canEdit onSaved={() => void load()} /></CardContent></Card>
        </div>
      ) : null}

      {tab === 'conversations' ? (
        <div role="tabpanel" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Calls & messages</CardTitle></CardHeader>
            <CardContent>
              <LiveStatus>
                <ul className="space-y-2" role="list">
                  {calls.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-2 py-1 text-sm">
                      <span className="text-xs text-muted-foreground">{fmt(c.startedAt)}</span>
                      <Badge tone={c.evidenceStatus === 'manual' ? 'manual' : 'simulated'}>{label(c.evidenceStatus)}</Badge>
                      <span>{label(c.direction)} call · {label(c.status)}{c.durationSeconds ? ` · ${c.durationSeconds}s` : ''}</span>
                      {c.needsWrapup ? <Button size="sm" variant="outline" onClick={() => setWrapCall(c.id)}>Needs wrap-up</Button> : null}
                    </li>
                  ))}
                  {messages.map((m) => (
                    <li key={m.id} className="flex flex-wrap items-center gap-2 py-1 text-sm">
                      <span className="text-xs text-muted-foreground">{fmt(m.createdAt)}</span>
                      <Badge tone={m.direction === 'inbound' ? 'today' : 'default'}>{label(`${m.direction} ${m.channel}`)}</Badge>
                      <span>{label(m.status)}</span>
                      <span className="text-muted-foreground">{m.body.slice(0, 60)}</span>
                    </li>
                  ))}
                  {calls.length === 0 && messages.length === 0 ? <li className="text-sm text-muted-foreground">No conversations yet.</li> : null}
                </ul>
              </LiveStatus>
            </CardContent>
          </Card>
          <div className="space-y-4">
            <CallPanel leadId={lead.id} onCallEnded={() => void load()} />
            <ManualActivityForm leadId={lead.id} onSaved={() => void load()} />
            <InboundForm leadId={lead.id} onSaved={() => void load()} />
          </div>
        </div>
      ) : null}

      {tab === 'documents' ? (
        <div role="tabpanel"><Card><CardContent><DocumentsTab leadId={lead.id} onSaved={() => void load()} /></CardContent></Card></div>
      ) : null}

      {tab === 'pipeline' ? (
        <div role="tabpanel"><PipelineTab leadId={lead.id} stage={lead.stage} onSaved={(msg) => void refresh(msg)} /></div>
      ) : null}

      {tab === 'requests' ? (
        <div role="tabpanel"><Card><CardContent><RequestsTab leadId={lead.id} requests={requests} onSaved={() => void load()} /></CardContent></Card></div>
      ) : null}

      <EditDetailsDrawer
        leadId={lead.id}
        current={{ displayName: lead.displayName, phone: lead.phone, email: lead.email, preferredLanguage: lead.preferredLanguage }}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={() => void refresh('Prospect updated. Audit history recorded.')}
      />
      <WrapUpDrawer callId={wrapCall} open={!!wrapCall} onClose={() => setWrapCall(null)} onSaved={() => void refresh('Wrap-up saved. Task and timeline updated.')} />
      <WhatsAppDrawer leadId={lead.id} open={waOpen} onClose={() => setWaOpen(false)} onSaved={() => void load()} />

      {/* SC-03 Guidance Modal */}
      {showContractModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label="SC-03 / LEAD INBOX — Open a prospect and inspect the full record"
        >
          <div className="absolute inset-0" onClick={() => setShowContractModal(false)} aria-hidden />
          <div className="relative w-full max-w-2xl rounded-xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-heading text-base font-bold text-foreground">
                  SC-03 / LEAD INBOX — Open a prospect and inspect the full record
                </h3>
                <p className="text-xs text-muted-foreground">
                  Physical deck specification from P047 and P048.
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
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                <div className="rounded-lg border border-border p-3">
                  <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px]">How This Works / Next Steps</h4>
                  <ol className="mt-1.5 list-decimal pl-4 space-y-1 text-muted-foreground">
                    <li><strong className="text-foreground">01</strong> Open a lead from the inbox or a valid notification.</li>
                    <li><strong className="text-foreground">02</strong> Use Summary, Timeline, Tasks, Documents and Outcome tabs.</li>
                    <li><strong className="text-foreground">03</strong> Select Call, WhatsApp or Add activity from the prospect header.</li>
                  </ol>
                </div>

                <div className="rounded-lg border border-border p-3">
                  <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px]">Before It Can Proceed</h4>
                  <p className="mt-1 text-muted-foreground">
                    The opportunity must belong to the current permitted workload. Contact links expose only enquiries the caller may see.
                  </p>
                </div>

                <div className="rounded-lg border border-border p-3">
                  <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px]">System Commit</h4>
                  <p className="mt-1 text-muted-foreground">
                    Fetch opportunity and scoped related records. Show provenance, ownership history, permissions and outstanding tasks.
                  </p>
                </div>

                <div className="rounded-lg border border-border p-3">
                  <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px]">Reporting Consequence</h4>
                  <p className="mt-1 text-muted-foreground">
                    Viewing a record is not a contact activity and adds no sales credit. Sensitive document access is separately audited.
                  </p>
                </div>

                <div className="rounded-lg border border-border p-3">
                  <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px]">When a Check Fails</h4>
                  <p className="mt-1 text-muted-foreground">
                    Reassigned while open: show a read-only access-changed message, clear sensitive fields and return to the inbox.
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

function PipelineTab({ leadId, stage, onSaved }: { leadId: string; stage: string; onSaved: (msg: string) => void }) {
  const s = useSubmit();
  const [proposals, setProposals] = useState<ProposalRecord[]>([]);
  const [qual, setQual] = useState({ need: '', product: 'V1 Wealth Portfolio', expectedValue: 0, currency: 'INR', timeHorizon: '30 days', checklist: { riskProfile: false }, nextStep: 'Prepare proposal' });
  const [move, setMove] = useState({ toStage: 'follow-up', reason: '' });
  const [proposal, setProposal] = useState({ product: 'V1 Wealth Portfolio', templateVersion: 'tpl-v1', terms: '', validUntil: '2026-10-31', recipient: '' });
  const [conversion, setConversion] = useState({ winMilestone: '', milestoneDate: '', value: 0, currency: 'INR', evidenceRef: '', credit: 100 });
  const [loss, setLoss] = useState({ reason: 'Not interested', explanation: '', futureContact: '' });
  const [reopen, setReopen] = useState({ reason: '', newEvidence: '', requestedNextStage: 'contacted', nextAction: '' });

  useEffect(() => {
    void wealthApi.proposals(leadId).then((r) => setProposals(r.proposals)).catch(() => undefined);
  }, [leadId]);

  return (
    <div className="space-y-4">
      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}
      {s.failure ? <p role="alert" className="text-sm text-destructive">{s.failure}</p> : null}
      <Card>
        <CardHeader><CardTitle>Qualification (SC-15)</CardTitle></CardHeader>
        <CardContent>
          <FormRow label="Documented requirement" htmlFor="q-need" error={s.errors.need?.[0]}>
            <Textarea id="q-need" rows={2} value={qual.need} onChange={(e) => setQual({ ...qual, need: e.target.value })} />
          </FormRow>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <FormRow label="Expected value (estimate, not revenue)" htmlFor="q-val">
              <Input id="q-val" type="number" value={qual.expectedValue} onChange={(e) => setQual({ ...qual, expectedValue: Number(e.target.value) })} />
            </FormRow>
            <FormRow label="Time horizon" htmlFor="q-hor">
              <Input id="q-hor" value={qual.timeHorizon} onChange={(e) => setQual({ ...qual, timeHorizon: e.target.value })} />
            </FormRow>
            <FormRow label="Next step" htmlFor="q-next" error={s.errors.nextStep?.[0]}>
              <Input id="q-next" value={qual.nextStep} onChange={(e) => setQual({ ...qual, nextStep: e.target.value })} />
            </FormRow>
          </div>
          <BusyButton size="sm" busy={s.busy} onClick={() => void s.run(async () => {
            const r = await wealthApi.qualification(leadId, qual);
            onSaved(`Qualification saved (checklist wealth-fit-v1). Recommended next: ${r.recommendedNextStep}`);
          })}>Save qualification</BusyButton>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Move in pipeline (SC-16) — current: {stage}</CardTitle></CardHeader>
        <CardContent>
          <FormRow label="Requested stage" htmlFor="mv-stage" error={s.errors.toStage?.[0]}>
            <Select id="mv-stage" value={move.toStage} onChange={(e) => setMove({ ...move, toStage: e.target.value })}>
              {['not-contacted', 'contacted', 'follow-up', 'qualified'].map((x) => <option key={x} value={x}>{x}</option>)}
            </Select>
          </FormRow>
          <FormRow label="Reason" htmlFor="mv-reason" error={s.errors.reason?.[0]}>
            <Input id="mv-reason" value={move.reason} onChange={(e) => setMove({ ...move, reason: e.target.value })} />
          </FormRow>
          <BusyButton size="sm" busy={s.busy} onClick={() => void s.run(async () => {
            await wealthApi.moveStage(leadId, { toStage: move.toStage as 'follow-up', reason: move.reason });
            onSaved(`Stage moved to ${move.toStage}.`);
          })}>Confirm move</BusyButton>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Proposal (SC-17)</CardTitle></CardHeader>
        <CardContent>
          <ul className="mb-3 divide-y divide-border" role="list">
            {proposals.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <span className="font-mono text-xs">{p.id}</span>
                <Badge tone={p.status === 'sent' ? 'verified' : p.status === 'pending-approval' ? 'pending' : 'default'}>{p.status}</Badge>
                <span className="text-muted-foreground">v{p.version} · valid to {p.validUntil}</span>
                {p.status === 'pending-approval' ? <span className="text-xs text-muted-foreground">Awaiting review</span> : null}
                {p.status === 'approved' ? (
                  <Button size="sm" variant="outline" onClick={() => void s.run(async () => { await wealthApi.sendProposal(p.id); onSaved('Proposal sent (SIMULATED). Milestone, not revenue.'); })}>Send</Button>
                ) : null}
                {p.status === 'draft' ? (
                  <Button size="sm" variant="outline" onClick={() => void s.run(async () => { await wealthApi.submitProposal(p.id); onSaved('Proposal submitted for approval. Pending until an authorized approver decides.'); })}>Submit</Button>
                ) : null}
              </li>
            ))}
          </ul>
          <FormRow label="Terms" htmlFor="p-terms" error={s.errors.terms?.[0]}>
            <Textarea id="p-terms" rows={2} value={proposal.terms} onChange={(e) => setProposal({ ...proposal, terms: e.target.value })} />
          </FormRow>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <FormRow label="Validity" htmlFor="p-valid">
              <Input id="p-valid" type="date" value={proposal.validUntil} onChange={(e) => setProposal({ ...proposal, validUntil: e.target.value })} />
            </FormRow>
            <FormRow label="Recipient" htmlFor="p-recip">
              <Input id="p-recip" value={proposal.recipient} onChange={(e) => setProposal({ ...proposal, recipient: e.target.value })} />
            </FormRow>
          </div>
          <BusyButton size="sm" busy={s.busy} onClick={() => void s.run(async () => {
            await wealthApi.createProposal(leadId, proposal);
            onSaved('Proposal draft created.');
          })}>Create draft</BusyButton>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Outcomes (SC-20/21/22)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="mb-1 text-sm font-semibold">Submit conversion (SC-20)</h4>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <FormRow label="Win milestone" htmlFor="c-ms" error={s.errors.winMilestone?.[0]}>
                <Input id="c-ms" value={conversion.winMilestone} onChange={(e) => setConversion({ ...conversion, winMilestone: e.target.value })} />
              </FormRow>
              <FormRow label="Milestone date" htmlFor="c-date">
                <Input id="c-date" type="date" value={conversion.milestoneDate} onChange={(e) => setConversion({ ...conversion, milestoneDate: e.target.value })} />
              </FormRow>
              <FormRow label="Value" htmlFor="c-val">
                <Input id="c-val" type="number" value={conversion.value} onChange={(e) => setConversion({ ...conversion, value: Number(e.target.value) })} />
              </FormRow>
              <FormRow label="Evidence reference" htmlFor="c-ev" error={s.errors.evidenceRef?.[0]}>
                <Input id="c-ev" value={conversion.evidenceRef} onChange={(e) => setConversion({ ...conversion, evidenceRef: e.target.value })} />
              </FormRow>
            </div>
            <BusyButton size="sm" busy={s.busy} onClick={() => void s.run(async () => {
              await wealthApi.conversion(leadId, {
                winMilestone: conversion.winMilestone, milestoneDate: conversion.milestoneDate,
                value: conversion.value, currency: conversion.currency, evidenceRef: conversion.evidenceRef,
                proposedCredit: { me: conversion.credit },
              });
              onSaved('Conversion submitted — Pending conversion, routed to an independent approver. Not a win yet.');
            })}>Submit conversion</BusyButton>
          </div>
          <div>
            <h4 className="mb-1 text-sm font-semibold">Mark lost (SC-21)</h4>
            <FormRow label="Explanation" htmlFor="l-exp" error={s.errors.explanation?.[0]}>
              <Input id="l-exp" value={loss.explanation} onChange={(e) => setLoss({ ...loss, explanation: e.target.value })} />
            </FormRow>
            <FormRow label="Future contact / opt-out note" htmlFor="l-fc">
              <Input id="l-fc" value={loss.futureContact} onChange={(e) => setLoss({ ...loss, futureContact: e.target.value })} />
            </FormRow>
            <BusyButton size="sm" variant="destructive" busy={s.busy} onClick={() => void s.run(async () => {
              await wealthApi.loss(leadId, { ...loss });
              onSaved('Marked lost with reason. Obsolete tasks cancelled; history preserved.');
            })}>Confirm loss</BusyButton>
          </div>
          <div>
            <h4 className="mb-1 text-sm font-semibold">Request reopen (SC-22)</h4>
            <FormRow label="Reason" htmlFor="r-reason" error={s.errors.reason?.[0]}>
              <Input id="r-reason" value={reopen.reason} onChange={(e) => setReopen({ ...reopen, reason: e.target.value })} />
            </FormRow>
            <FormRow label="New evidence" htmlFor="r-ev" error={s.errors.newEvidence?.[0]}>
              <Input id="r-ev" value={reopen.newEvidence} onChange={(e) => setReopen({ ...reopen, newEvidence: e.target.value })} />
            </FormRow>
            <FormRow label="Next action" htmlFor="r-next">
              <Input id="r-next" value={reopen.nextAction} onChange={(e) => setReopen({ ...reopen, nextAction: e.target.value })} />
            </FormRow>
            <BusyButton size="sm" busy={s.busy} onClick={() => void s.run(async () => {
              await wealthApi.reopen(leadId, { ...reopen, requestedNextStage: reopen.requestedNextStage as 'contacted' });
              onSaved('Reopen requested. Work resumes only after approval and ownership confirmation.');
            })}>Request reopen</BusyButton>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
