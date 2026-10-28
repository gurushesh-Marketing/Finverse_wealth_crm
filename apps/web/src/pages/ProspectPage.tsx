import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useParams, useLocation } from 'react-router-dom';
import type { CallRecord, LeadDetail, MessageRecord, ProposalRecord, LeadHandoffRecord } from '@finverse/contracts';
import { ApiError, api } from '../lib/api';
import { wealthApi, type OutcomeRequestView } from '../lib/wealth-api';
import { relApi } from '../lib/rel-api';
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

  if (session?.role === 'TL' || session?.role === 'REL') {
    return <Navigate to={`/rel/prospects/${id}`} replace />;
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

  const location = useLocation();
  const isBanking = location.pathname.startsWith('/banking') || lead?.vertical === 'banking';
  const isMarkets = location.pathname.startsWith('/markets') || lead?.vertical === 'markets';
  const isRealEstate = location.pathname.startsWith('/real-estate') || location.pathname.startsWith('/real_estate') || lead?.vertical === 'real_estate' || lead?.vertical === 'real-estate';
  const basePath = isBanking ? '/banking' : isMarkets ? '/markets' : isRealEstate ? '/real-estate' : '/wealth';

  const backLink = (
    <Link to={`${basePath}/prospects`} className="text-xs font-semibold text-primary underline-offset-4 hover:underline">
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
            <Link to={`${basePath}/prospects`} className="hover:text-primary hover:underline">
              ← Sales caller workspace
            </Link>
            <span>/</span>
            <span className="text-primary font-bold">SC-03 / LEAD INBOX</span>
          </div>
          <h1 className="mt-1 font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Prospect details
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isBanking ? 'Commercial Banking' : isMarkets ? 'Markets & Securities' : isRealEstate ? 'Real Estate Advisory' : 'Wealth'} · assigned permission scope · illustrative records
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
        <div role="tabpanel"><PipelineTab leadId={lead.id} stage={lead.stage} vertical={lead.vertical} onSaved={(msg) => void refresh(msg)} /></div>
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

function PipelineTab({
  leadId,
  stage,
  vertical,
  onSaved,
}: {
  leadId: string;
  stage: string;
  vertical?: string;
  onSaved: (msg: string) => void;
}) {
  const s = useSubmit();
  const isBanking = vertical === 'banking';
  const isMarkets = vertical === 'markets';
  const isRealEstate = vertical === 'real-estate' || vertical === 'real_estate';

  const defaultProduct = isBanking
    ? 'Corporate Term Loan'
    : isMarkets
    ? 'Equity Delivery & Intraday'
    : isRealEstate
    ? 'Luxury Residential Mandate'
    : 'V1 Wealth Portfolio';

  const stageOptions = isBanking
    ? ['eligibility', 'documents', 'sanction']
    : isMarkets
    ? ['kyc', 'risk-profile', 'demat-opened']
    : isRealEstate
    ? ['requirement', 'site-visit', 'booking']
    : ['not-contacted', 'contacted', 'follow-up', 'qualified'];

  const defaultMoveStage = isBanking ? 'eligibility' : isMarkets ? 'kyc' : isRealEstate ? 'requirement' : 'follow-up';

  const [proposals, setProposals] = useState<ProposalRecord[]>([]);
  const [qual, setQual] = useState({
    need: '',
    product: defaultProduct,
    expectedValue: 0,
    currency: 'INR',
    timeHorizon: '30 days',
    checklist: { riskProfile: false },
    nextStep: isBanking
      ? 'Request credit documents'
      : isMarkets
      ? 'Complete SEBI CKYC & risk disclosure'
      : isRealEstate
      ? 'Schedule property site visit'
      : 'Prepare proposal',
  });
  const [move, setMove] = useState({ toStage: defaultMoveStage, reason: '' });
  const [proposal, setProposal] = useState({
    product: defaultProduct,
    templateVersion: isBanking ? 'sanction-v1' : isMarkets ? 'demat-tariff-v1' : isRealEstate ? 'allotment-v1' : 'tpl-v1',
    terms: '',
    validUntil: '2026-10-31',
    recipient: '',
  });
  const [conversion, setConversion] = useState({
    winMilestone: isBanking
      ? 'Sanction approved and initial loan facility disbursed'
      : isMarkets
      ? 'Demat account funded and initial trade executed'
      : isRealEstate
      ? 'Sale agreement registered and booking milestone cleared'
      : 'Investment mandate executed',
    milestoneDate: '',
    value: 0,
    currency: 'INR',
    evidenceRef: '',
    credit: 100,
  });
  const [loss, setLoss] = useState({
    reason: isBanking ? 'Credit rejected' : isMarkets ? 'KYC rejected / CKYC mismatch' : isRealEstate ? 'Budget mismatch' : 'Not interested',
    explanation: '',
    futureContact: '',
  });
  const [reopen, setReopen] = useState({
    reason: '',
    newEvidence: '',
    requestedNextStage: isBanking ? 'eligibility' : isMarkets ? 'kyc' : isRealEstate ? 'requirement' : 'contacted',
    nextAction: '',
  });

  const isWealth = !isBanking && !isMarkets && !isRealEstate;

  const [handoffs, setHandoffs] = useState<LeadHandoffRecord[]>([]);

  // Banking Qualification State
  const [loanAmount, setLoanAmount] = useState<number>(7500000);
  const [facilityType, setFacilityType] = useState('Working Capital Term Loan');
  const [turnover, setTurnover] = useState<number>(25000000);
  const [constitution, setConstitution] = useState('Private Limited Company');
  const [loanPurpose, setLoanPurpose] = useState('Capacity expansion & operating capital');

  // Wealth Qualification State
  const [investibleSurplus, setInvestibleSurplus] = useState<number>(7500000);
  const [mandateType, setMandateType] = useState('Portfolio Management Services (PMS)');
  const [riskProfile, setRiskProfile] = useState<'Conservative' | 'Moderate' | 'Growth' | 'Aggressive'>('Growth');
  const [investmentHorizon, setInvestmentHorizon] = useState<'1-3 Years' | '3-5 Years' | '5-10 Years' | '10+ Years'>('3-5 Years');
  const [existingPortfolioSize, setExistingPortfolioSize] = useState<number>(5000000);
  const [currentBrokerOrAmc, setCurrentBrokerOrAmc] = useState('ICICI Securities Direct');
  const [targetReturn, setTargetReturn] = useState('14-16% CAGR alpha over Nifty 500');

  // Markets / Trading Qualification State
  const [tradingCapital, setTradingCapital] = useState<number>(2500000);
  const [tradingSegment, setTradingSegment] = useState('F&O Derivatives (Futures & Options)');
  const [tradingExperience, setTradingExperience] = useState<
    'Beginner (< 1 Year)' | 'Intermediate (1-3 Years)' | 'Active / Professional (3+ Years)' | 'Algorithmic / High-Frequency'
  >('Intermediate (1-3 Years)');
  const [marketsRiskTolerance, setMarketsRiskTolerance] = useState<
    'Low / Conservative (Cash & Delivery only)' | 'Moderate (Equity Delivery + Index Hedging)' | 'High / Speculative (Active F&O & Leverage)'
  >('Moderate (Equity Delivery + Index Hedging)');
  const [depositoryPreference, setDepositoryPreference] = useState<
    'CDSL (Central Depository Services India)' | 'NSDL (National Securities Depository Limited)'
  >('CDSL (Central Depository Services India)');
  const [incomeProofAvailable] = useState<boolean>(true);
  const [existingBroker, setExistingBroker] = useState('Zerodha Broking');

  // Real Estate Qualification State
  const [propertyBudget, setPropertyBudget] = useState<number>(35000000);
  const [propertyType, setPropertyType] = useState('Luxury Residential Villa / Apartment');
  const [preferredLocation, setPreferredLocation] = useState('Worli / Lower Parel, South Mumbai');
  const [purchaseTimeline, setPurchaseTimeline] = useState<
    'Immediate (Within 30 Days)' | '1-3 Months (Active Shortlist)' | '3-6 Months (Planning & Evaluation)' | '6+ Months (Investor Mandate)'
  >('1-3 Months (Active Shortlist)');
  const [purchasePurpose, setPurchasePurpose] = useState<
    'End-Use / Self-Occupation' | 'Rental Yield & Investment' | 'Corporate Headquarters / Branch' | 'Capital Gains Reinvestment (54EC)'
  >('End-Use / Self-Occupation');
  const [siteVisitPreference, setSiteVisitPreference] = useState<
    'Weekend Preferred' | 'Weekday Morning' | 'Private Chauffeur Inspection' | 'Virtual 3D Walkthrough First'
  >('Weekend Preferred');
  const [fundingSource, setFundingSource] = useState<
    'Self-Funded / Equity Liquidity' | 'Bank Home Loan Required' | 'Corporate Treasury / Escrow'
  >('Self-Funded / Equity Liquidity');
  const [possessionPreference, setPossessionPreference] = useState<
    'Ready to Move In (OC Received)' | 'Under Construction (Within 12M)' | 'Pre-Launch / Investor Allocation'
  >('Ready to Move In (OC Received)');
  const [developerPreference, setDeveloperPreference] = useState('Lodha Luxury');

  const [callerFindings, setCallerFindings] = useState(
    isRealEstate
      ? 'HNI buyer seeking luxury sea-facing villa/apartment in South Mumbai with verified funds; ready for weekend site visit.'
      : isMarkets
      ? 'Active derivative trader seeking low-latency DMA desk, margin trade facility, and competitive F&O brokerage.'
      : isWealth
      ? 'HNI prospect with ₹75L investible surplus seeking equity PMS advisory; growth objective.'
      : 'Borrower has 4 years audited financials, healthy cash flows, seeking growth funding.'
  );
  const [qualEvidence, setQualEvidence] = useState(
    isRealEstate
      ? 'Verified bank liquidity for ₹3.5 Cr purchase; PAN & KYC verified; site visit slot confirmed.'
      : isMarkets
      ? '6M bank statement & ITR-V verified for derivative activation; PAN-Aadhaar linked; SEBI risk disclosure accepted.'
      : isWealth
      ? 'Investor net worth > ₹5 Cr verified, PAN/Aadhaar validated, accredited investor fit for PMS mandate.'
      : 'Verified ROC filings, 12M GST returns, and clean banking operations.'
  );
  const [reqDocs] = useState<string[]>(
    isRealEstate
      ? [
          'Buyer PAN & Aadhaar KYC Copy',
          'Proof of Funds / Bank Statement',
          'RERA Allotment Terms Acknowledgement',
          'Site Visit Identity Verification Pass',
        ]
      : isMarkets
      ? [
          'PAN Card Copy',
          'Aadhaar KYC XML / Digilocker verification',
          '6 Months Bank Statement (F&O Income Proof)',
          'Cancelled Cheque / Depository Bank Proof',
          'SEBI Mandatory Derivative Risk Disclosure Acknowledgement',
        ]
      : isWealth
      ? [
          'PAN Card Copy',
          'Aadhaar Card Copy',
          'Client Master List (CML)',
          'Bank Proof / Cancelled Cheque',
          'Investor Suitability & Risk Declaration',
        ]
      : [
          'Audited Financial Statements (Last 3 Years)',
          'GST Returns (Last 12 Months)',
          'Bank Statements (Last 6 Months)',
          'Promoter KYC & PAN',
        ]
  );

  useEffect(() => {
    void relApi.getHandoffs({ leadId }).then((r) => setHandoffs(r.handoffs)).catch(() => undefined);
  }, [leadId]);

  useEffect(() => {
    void wealthApi.proposals(leadId).then((r) => setProposals(r.proposals)).catch(() => undefined);
  }, [leadId]);

  return (
    <div className="space-y-4">
      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}
      {s.failure ? <p role="alert" className="text-sm text-destructive">{s.failure}</p> : null}

      {/* Handoff Status Card if handoff exists */}
      {handoffs.length > 0 ? (
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span>🔄</span> Relationship Manager Handoff Status
              </span>
              <Badge tone={handoffs[0].status === 'accepted' ? 'verified' : handoffs[0].status === 'returned' ? 'default' : 'pending'}>
                {handoffs[0].status.toUpperCase()}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-1.5">
            <div>Assigned Relationship Manager: <strong className="text-foreground">{handoffs[0].relName}</strong></div>
            <div>Handoff Timestamp: <span className="font-mono">{new Date(handoffs[0].handoffTime).toLocaleString()}</span></div>
            {handoffs[0].realEstateRequirement ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-background/50 p-2 rounded text-xs text-muted-foreground mt-1">
                <div>Property Budget: <strong className="text-foreground">₹{(handoffs[0].realEstateRequirement.budget / 10000000).toFixed(2)} Cr</strong></div>
                <div>Property Type: <strong className="text-foreground">{handoffs[0].realEstateRequirement.propertyType}</strong></div>
                <div>Preferred Location: <strong className="text-foreground">{handoffs[0].realEstateRequirement.preferredLocation}</strong></div>
              </div>
            ) : handoffs[0].marketsRequirement ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-background/50 p-2 rounded text-xs text-muted-foreground mt-1">
                <div>Trading Capital: <strong className="text-foreground">₹{(handoffs[0].marketsRequirement.tradingCapital / 100000).toFixed(2)} Lakhs</strong></div>
                <div>Segment: <strong className="text-foreground">{handoffs[0].marketsRequirement.tradingSegment}</strong></div>
                <div>Experience: <strong className="text-foreground">{handoffs[0].marketsRequirement.tradingExperience}</strong></div>
              </div>
            ) : handoffs[0].wealthRequirement ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-background/50 p-2 rounded text-xs text-muted-foreground mt-1">
                <div>Investible Surplus: <strong className="text-foreground">₹{(handoffs[0].wealthRequirement.investibleSurplus / 100000).toFixed(2)} Lakhs</strong></div>
                <div>Mandate: <strong className="text-foreground">{handoffs[0].wealthRequirement.mandateType}</strong></div>
                <div>Risk Profile: <strong className="text-foreground">{handoffs[0].wealthRequirement.riskProfile}</strong></div>
              </div>
            ) : handoffs[0].loanRequirement ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-background/50 p-2 rounded text-xs text-muted-foreground mt-1">
                <div>Requested Loan: <strong className="text-foreground">₹{(handoffs[0].loanRequirement.requestedAmount / 100000).toFixed(2)} Lakhs</strong></div>
                <div>Facility: <strong className="text-foreground">{handoffs[0].loanRequirement.facilityType}</strong></div>
              </div>
            ) : null}
            {handoffs[0].status === 'returned' && handoffs[0].decisionReason ? (
              <div className="rounded bg-destructive/10 border border-destructive/30 p-2 text-destructive font-medium mt-1">
                ⚠️ Returned by Relationship Manager with reason: <em>"{handoffs[0].decisionReason}"</em>
              </div>
            ) : null}
            {handoffs[0].status === 'accepted' ? (
              <div className="text-emerald-700 font-medium">
                ✅ Accepted by Relationship Manager. Client is in institutional structuring and mandate review.
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {/* Qualify & Handoff to Relationship Manager (SC-15 New Workflow) */}
      <Card className="border-primary/50 shadow-xs">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>Qualify &amp; Handoff to Relationship Manager (SC-15)</span>
            <Badge tone="default">Same-Vertical Allocation</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md bg-secondary/30 p-3 text-xs text-muted-foreground">
            Frontline callers qualify prospects and hand off to an eligible Relationship Manager in the SAME vertical via least-loaded assignment. Record the findings, required documents, and mandate facts.
          </div>

          {isRealEstate ? (
            <div className="space-y-3 rounded-lg border border-border/80 p-3 bg-card">
              <span className="font-bold text-xs text-foreground block">
                Real Estate Advisory Mandate &amp; Property Criteria
              </span>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormRow label="Property Budget (INR) *" htmlFor="rel-re-budget">
                  <Input
                    id="rel-re-budget"
                    type="number"
                    value={propertyBudget}
                    onChange={(e) => setPropertyBudget(Number(e.target.value))}
                    data-testid="property-budget-input"
                  />
                </FormRow>
                <FormRow label="Property Type *" htmlFor="rel-property-type">
                  <Select
                    id="rel-property-type"
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value)}
                    data-testid="property-type-select"
                  >
                    <option value="Luxury Residential Villa / Apartment">Luxury Residential Villa / Apartment</option>
                    <option value="Commercial Office Space">Commercial Office Space</option>
                    <option value="Retail High Street & Mall Store">Retail High Street &amp; Mall Store</option>
                    <option value="Industrial & Logistics Warehousing">Industrial &amp; Logistics Warehousing</option>
                    <option value="Plotted Land Development">Plotted Land Development</option>
                    <option value="Penthouse / Duplex Mandate">Penthouse / Duplex Mandate</option>
                  </Select>
                </FormRow>
                <FormRow label="Preferred Location / Micro-Market *" htmlFor="rel-re-location">
                  <Input
                    id="rel-re-location"
                    value={preferredLocation}
                    onChange={(e) => setPreferredLocation(e.target.value)}
                    data-testid="preferred-location-input"
                  />
                </FormRow>
                <FormRow label="Purchase Timeline *" htmlFor="rel-re-timeline">
                  <Select
                    id="rel-re-timeline"
                    value={purchaseTimeline}
                    onChange={(e) => setPurchaseTimeline(e.target.value as any)}
                    data-testid="purchase-timeline-select"
                  >
                    <option value="Immediate (Within 30 Days)">Immediate (Within 30 Days)</option>
                    <option value="1-3 Months (Active Shortlist)">1-3 Months (Active Shortlist)</option>
                    <option value="3-6 Months (Planning & Evaluation)">3-6 Months (Planning &amp; Evaluation)</option>
                    <option value="6+ Months (Investor Mandate)">6+ Months (Investor Mandate)</option>
                  </Select>
                </FormRow>
                <FormRow label="Purchase Purpose *" htmlFor="rel-re-purpose">
                  <Select
                    id="rel-re-purpose"
                    value={purchasePurpose}
                    onChange={(e) => setPurchasePurpose(e.target.value as any)}
                    data-testid="purchase-purpose-select"
                  >
                    <option value="End-Use / Self-Occupation">End-Use / Self-Occupation</option>
                    <option value="Rental Yield & Investment">Rental Yield &amp; Investment</option>
                    <option value="Corporate Headquarters / Branch">Corporate Headquarters / Branch</option>
                    <option value="Capital Gains Reinvestment (54EC)">Capital Gains Reinvestment (54EC)</option>
                  </Select>
                </FormRow>
                <FormRow label="Site Visit Preference *" htmlFor="rel-re-site-visit">
                  <Select
                    id="rel-re-site-visit"
                    value={siteVisitPreference}
                    onChange={(e) => setSiteVisitPreference(e.target.value as any)}
                    data-testid="site-visit-select"
                  >
                    <option value="Weekend Preferred">Weekend Preferred</option>
                    <option value="Weekday Morning">Weekday Morning</option>
                    <option value="Private Chauffeur Inspection">Private Chauffeur Inspection</option>
                    <option value="Virtual 3D Walkthrough First">Virtual 3D Walkthrough First</option>
                  </Select>
                </FormRow>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormRow label="Funding Source" htmlFor="rel-re-funding">
                  <Select
                    id="rel-re-funding"
                    value={fundingSource}
                    onChange={(e) => setFundingSource(e.target.value as any)}
                  >
                    <option value="Self-Funded / Equity Liquidity">Self-Funded / Equity Liquidity</option>
                    <option value="Bank Home Loan Required">Bank Home Loan Required</option>
                    <option value="Corporate Treasury / Escrow">Corporate Treasury / Escrow</option>
                  </Select>
                </FormRow>
                <FormRow label="Developer Preference" htmlFor="rel-re-developer">
                  <Input
                    id="rel-re-developer"
                    value={developerPreference}
                    onChange={(e) => setDeveloperPreference(e.target.value)}
                    placeholder="e.g. Lodha, Godrej, DLF, Prestige..."
                  />
                </FormRow>
              </div>
            </div>
          ) : isMarkets ? (
            <div className="space-y-3 rounded-lg border border-border/80 p-3 bg-card">
              <span className="font-bold text-xs text-foreground block">
                Markets &amp; Securities Trading Mandate &amp; Risk Criteria
              </span>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormRow label="Trading Capital / Initial Margin (INR) *" htmlFor="rel-trading-capital">
                  <Input
                    id="rel-trading-capital"
                    type="number"
                    value={tradingCapital}
                    onChange={(e) => setTradingCapital(Number(e.target.value))}
                    data-testid="trading-capital-input"
                  />
                </FormRow>
                <FormRow label="Market Segment *" htmlFor="rel-trading-segment">
                  <Select
                    id="rel-trading-segment"
                    value={tradingSegment}
                    onChange={(e) => setTradingSegment(e.target.value)}
                    data-testid="trading-segment-select"
                  >
                    <option value="Equity Delivery & Intraday">Equity Delivery &amp; Intraday</option>
                    <option value="F&O Derivatives (Futures & Options)">F&amp;O Derivatives (Futures &amp; Options)</option>
                    <option value="Commodities & Currencies">Commodities &amp; Currencies</option>
                    <option value="Direct Mutual Funds & SGBs">Direct Mutual Funds &amp; SGBs</option>
                  </Select>
                </FormRow>
                <FormRow label="Trading Experience *" htmlFor="rel-trading-exp">
                  <Select
                    id="rel-trading-exp"
                    value={tradingExperience}
                    onChange={(e) => setTradingExperience(e.target.value as any)}
                    data-testid="trading-experience-select"
                  >
                    <option value="Beginner (< 1 Year)">Beginner (&lt; 1 Year)</option>
                    <option value="Intermediate (1-3 Years)">Intermediate (1-3 Years)</option>
                    <option value="Active / Professional (3+ Years)">Active / Professional (3+ Years)</option>
                    <option value="Algorithmic / High-Frequency">Algorithmic / High-Frequency</option>
                  </Select>
                </FormRow>
                <FormRow label="Risk Tolerance &amp; Derivative Suitability *" htmlFor="rel-markets-risk">
                  <Select
                    id="rel-markets-risk"
                    value={marketsRiskTolerance}
                    onChange={(e) => setMarketsRiskTolerance(e.target.value as any)}
                    data-testid="markets-risk-select"
                  >
                    <option value="Low / Conservative (Cash & Delivery only)">Low / Conservative (Cash &amp; Delivery only)</option>
                    <option value="Moderate (Equity Delivery + Index Hedging)">Moderate (Equity Delivery + Index Hedging)</option>
                    <option value="High / Speculative (Active F&O & Leverage)">High / Speculative (Active F&amp;O &amp; Leverage)</option>
                  </Select>
                </FormRow>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormRow label="Depository Participant Preference" htmlFor="rel-depository">
                  <Select
                    id="rel-depository"
                    value={depositoryPreference}
                    onChange={(e) => setDepositoryPreference(e.target.value as any)}
                    data-testid="depository-select"
                  >
                    <option value="CDSL (Central Depository Services India)">CDSL (Central Depository Services India)</option>
                    <option value="NSDL (National Securities Depository Limited)">NSDL (National Securities Depository Limited)</option>
                  </Select>
                </FormRow>
                <FormRow label="Current Broker / Platform" htmlFor="rel-existing-broker">
                  <Input
                    id="rel-existing-broker"
                    value={existingBroker}
                    onChange={(e) => setExistingBroker(e.target.value)}
                    placeholder="e.g. Zerodha, Groww, ICICI Direct..."
                  />
                </FormRow>
              </div>
            </div>
          ) : isWealth ? (
            <div className="space-y-3 rounded-lg border border-border/80 p-3 bg-card">
              <span className="font-bold text-xs text-foreground block">
                Wealth Management Mandate &amp; Suitability Criteria
              </span>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormRow label="Investible Surplus (INR) *" htmlFor="rel-investible-surplus">
                  <Input
                    id="rel-investible-surplus"
                    type="number"
                    value={investibleSurplus}
                    onChange={(e) => setInvestibleSurplus(Number(e.target.value))}
                    data-testid="investible-surplus-input"
                  />
                </FormRow>
                <FormRow label="Mandate Product *" htmlFor="rel-mandate-type">
                  <Select
                    id="rel-mandate-type"
                    value={mandateType}
                    onChange={(e) => setMandateType(e.target.value)}
                    data-testid="mandate-type-select"
                  >
                    <option value="Portfolio Management Services (PMS)">Portfolio Management Services (PMS)</option>
                    <option value="Alternative Investment Fund (AIF)">Alternative Investment Fund (AIF)</option>
                    <option value="Discretionary Portfolio Advisory">Discretionary Portfolio Advisory</option>
                    <option value="Multi-Asset Allocation Solution">Multi-Asset Allocation Solution</option>
                    <option value="Structured Wealth Products">Structured Wealth Products</option>
                    <option value="Mutual Fund Advisory & SIP">Mutual Fund Advisory & SIP</option>
                  </Select>
                </FormRow>
                <FormRow label="Risk Profile Band *" htmlFor="rel-risk-profile">
                  <Select
                    id="rel-risk-profile"
                    value={riskProfile}
                    onChange={(e) => setRiskProfile(e.target.value as any)}
                    data-testid="risk-profile-select"
                  >
                    <option value="Conservative">Conservative (Capital Preservation)</option>
                    <option value="Moderate">Moderate (Balanced Multi-Asset)</option>
                    <option value="Growth">Growth (High Equity Allocation)</option>
                    <option value="Aggressive">Aggressive (Concentrated Alpha / AIF)</option>
                  </Select>
                </FormRow>
                <FormRow label="Investment Horizon *" htmlFor="rel-horizon">
                  <Select
                    id="rel-horizon"
                    value={investmentHorizon}
                    onChange={(e) => setInvestmentHorizon(e.target.value as any)}
                    data-testid="investment-horizon-select"
                  >
                    <option value="1-3 Years">1-3 Years (Short-Term Liquidity)</option>
                    <option value="3-5 Years">3-5 Years (Medium-Term Capital Growth)</option>
                    <option value="5-10 Years">5-10 Years (Long-Term Wealth Compounding)</option>
                    <option value="10+ Years">10+ Years (Multi-Generational Trust)</option>
                  </Select>
                </FormRow>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <FormRow label="Existing Portfolio (INR)" htmlFor="rel-exist-port">
                  <Input
                    id="rel-exist-port"
                    type="number"
                    value={existingPortfolioSize}
                    onChange={(e) => setExistingPortfolioSize(Number(e.target.value))}
                  />
                </FormRow>
                <FormRow label="Current Broker / AMC" htmlFor="rel-broker">
                  <Input
                    id="rel-broker"
                    value={currentBrokerOrAmc}
                    onChange={(e) => setCurrentBrokerOrAmc(e.target.value)}
                  />
                </FormRow>
                <FormRow label="Target Return Expectation" htmlFor="rel-target-ret">
                  <Input
                    id="rel-target-ret"
                    value={targetReturn}
                    onChange={(e) => setTargetReturn(e.target.value)}
                  />
                </FormRow>
              </div>
            </div>
          ) : isBanking ? (
            <div className="space-y-3 rounded-lg border border-border/80 p-3 bg-card">
              <span className="font-bold text-xs text-foreground block">
                Commercial Banking Loan Requirement
              </span>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormRow label="Requested Loan Amount (INR) *" htmlFor="rel-req-amount">
                  <Input
                    id="rel-req-amount"
                    type="number"
                    value={loanAmount}
                    onChange={(e) => setLoanAmount(Number(e.target.value))}
                    data-testid="requested-amount-input"
                  />
                </FormRow>
                <FormRow label="Facility Type" htmlFor="rel-fac-type">
                  <Input
                    id="rel-fac-type"
                    value={facilityType}
                    onChange={(e) => setFacilityType(e.target.value)}
                  />
                </FormRow>
                <FormRow label="Annual Turnover (INR)" htmlFor="rel-turnover">
                  <Input
                    id="rel-turnover"
                    type="number"
                    value={turnover}
                    onChange={(e) => setTurnover(Number(e.target.value))}
                  />
                </FormRow>
                <FormRow label="Business Constitution" htmlFor="rel-const">
                  <Input
                    id="rel-const"
                    value={constitution}
                    onChange={(e) => setConstitution(e.target.value)}
                  />
                </FormRow>
              </div>
              <FormRow label="Loan Purpose" htmlFor="rel-purpose">
                <Input
                  id="rel-purpose"
                  value={loanPurpose}
                  onChange={(e) => setLoanPurpose(e.target.value)}
                />
              </FormRow>
            </div>
          ) : null}

          <FormRow label="Caller Discovery Findings *" htmlFor="rel-findings">
            <Textarea
              id="rel-findings"
              rows={2}
              value={callerFindings}
              onChange={(e) => setCallerFindings(e.target.value)}
              placeholder="Summary of borrower/investor needs, mandate fit, asset allocation..."
              data-testid="caller-findings-input"
            />
          </FormRow>

          <FormRow label="Qualification Evidence *" htmlFor="rel-evidence">
            <Input
              id="rel-evidence"
              value={qualEvidence}
              onChange={(e) => setQualEvidence(e.target.value)}
              placeholder="Criteria met (e.g. accredited net worth, documented surplus, business turnover)"
              data-testid="qual-evidence-input"
            />
          </FormRow>

          <BusyButton
            busy={s.busy}
            onClick={() => void s.run(async () => {
              const res = await relApi.qualifyAndHandoff({
                leadId,
                vertical: isRealEstate ? 'real_estate' : isMarkets ? 'markets' : isWealth ? 'wealth' : 'banking',
                notes: callerFindings,
                requiredDocuments: reqDocs,
                qualificationEvidence: qualEvidence,
                ...(isRealEstate
                  ? {
                      realEstateRequirement: {
                        budget: propertyBudget,
                        propertyType,
                        preferredLocation,
                        purchaseTimeline,
                        purchasePurpose,
                        siteVisitPreference,
                        fundingSource,
                        possessionPreference,
                        developerPreference,
                      },
                    }
                  : isMarkets
                  ? {
                      marketsRequirement: {
                        tradingCapital,
                        tradingSegment,
                        tradingExperience,
                        riskTolerance: marketsRiskTolerance,
                        depositoryPreference,
                        incomeProofAvailable,
                        existingBroker,
                      },
                    }
                  : isWealth
                  ? {
                      wealthRequirement: {
                        investibleSurplus,
                        mandateType,
                        riskProfile,
                        investmentHorizon,
                        existingPortfolioSize,
                        currentBrokerOrAmc,
                        targetReturnExpectation: targetReturn,
                      },
                    }
                  : {
                      loanRequirement: {
                        requestedAmount: loanAmount,
                        facilityType: 'Working Capital Facility',
                        annualTurnover: turnover,
                        businessConstitution: constitution,
                        loanPurpose,
                      },
                    }),
              });
              onSaved(`Prospect qualified and handed off to Relationship Manager ${res.assignedRel?.name || res.handoff?.relName}. Handoff assigned via fair distribution.`);
              const updated = await relApi.getHandoffs({ leadId });
              setHandoffs(updated.handoffs);
            })}
            className="bg-[#113F3D] hover:bg-[#0d2f2d] text-white"
            data-testid="qualify-handoff-btn"
          >
            Qualify &amp; Handoff to Relationship Manager
          </BusyButton>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Move in pipeline (SC-16) — current: {label(stage)}</CardTitle></CardHeader>
        <CardContent>
          <FormRow label="Requested stage" htmlFor="mv-stage" error={s.errors.toStage?.[0]}>
            <Select id="mv-stage" value={move.toStage} onChange={(e) => setMove({ ...move, toStage: e.target.value })}>
              {stageOptions.map((x) => <option key={x} value={x}>{label(x)}</option>)}
            </Select>
          </FormRow>
          <FormRow label="Reason" htmlFor="mv-reason" error={s.errors.reason?.[0]}>
            <Input id="mv-reason" value={move.reason} onChange={(e) => setMove({ ...move, reason: e.target.value })} />
          </FormRow>
          <BusyButton size="sm" busy={s.busy} onClick={() => void s.run(async () => {
            await wealthApi.moveStage(leadId, { toStage: move.toStage as never, reason: move.reason });
            onSaved(`Stage moved to ${label(move.toStage)}.`);
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
            <FormRow label="Loss reason" htmlFor="l-reason" error={s.errors.reason?.[0]}>
              <Select id="l-reason" value={loss.reason} onChange={(e) => setLoss({ ...loss, reason: e.target.value })}>
                {(isBanking
                  ? ['Credit rejected', 'CIBIL / score below threshold', 'Insufficient collateral', 'Pricing / interest rate', 'Customer dropped facility', 'Not interested', 'Duplicate']
                  : isMarkets
                  ? ['KYC rejected / CKYC mismatch', 'SEBI risk criteria not met', 'PAN/Aadhaar verification failed', 'Trading terms unacceptable', 'Customer dropped trading account', 'Not interested', 'Duplicate']
                  : isRealEstate
                  ? ['Budget mismatch', 'Micro-market preference change', 'Unit / inventory unavailable', 'Financing loan rejected', 'Customer dropped property purchase', 'Not interested', 'Duplicate']
                  : ['Not interested', 'Price', 'Competitor', 'No response', 'Not eligible', 'Invalid data', 'Duplicate']
                ).map((r) => <option key={r} value={r}>{r}</option>)}
              </Select>
            </FormRow>
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
