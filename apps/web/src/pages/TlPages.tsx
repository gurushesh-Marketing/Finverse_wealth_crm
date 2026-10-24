import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { tlApi } from '../lib/tl-api';
import { api, ApiError } from '../lib/api';
import { wealthApi, type OutcomeRequestView } from '../lib/wealth-api';
import type { LeadDetail, CallRecord, MessageRecord, DocumentRecord, AuditEntry } from '@finverse/contracts';
import { label } from '../lib/labels';
import { PageHeader, Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input, Textarea } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { DrawerPanel } from '../components/ui/drawer';
import { FormRow, BusyButton } from '../components/ui/panel';
import { EmptyState, SkeletonRows, SuccessNote, DeniedPanel, ErrorState } from '../components/ui/states';
import { useSubmit } from '../components/leads/RecordForms';

function useLoad<T>(fn: () => Promise<T>): [T | null, () => void] {
  const [data, setData] = useState<T | null>(null);
  const load = useCallback(() => { void fn().then(setData).catch(() => setData(null)); }, [fn]);
  useEffect(load, [load]);
  return [data, load];
}

// ─── TL-01 Team overview ───
export function TlOverviewPage() {
  const [ov, load] = useLoad(() => tlApi.overview('today', 'previous day'));
  const [drill, setDrill] = useState<any>(null);
  const s = useSubmit();
  return (
    <div>
      <PageHeader title="Team overview" subtitle="Team health, KPI drill and corrective tasks · TL-01"
        actions={<Button size="sm" variant="outline" onClick={load}>Refresh</Button>} />
      {s.note ? <div className="mb-3"><SuccessNote>{s.note}</SuccessNote></div> : null}
      {!ov ? <SkeletonRows rows={4} /> : (
        <>
          <p className="mb-3 text-xs text-muted-foreground">
            Teams: {ov.teams.map((t: any) => t.name || t.id).join(' + ')} (deduplicated union — every fact counted once) ·
            period {ov.period} vs {ov.comparison} · as-of {new Date(ov.asOf).toLocaleTimeString()}
          </p>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
            {ov.kpis.map((k: any) => (
              <button key={k.key} type="button" onClick={() => void tlApi.drill(k.key).then(setDrill)}
                className="rounded-lg border border-border p-3 text-left hover:bg-secondary/50 focus-visible:ring-2 focus-visible:ring-ring">
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className="font-heading text-xl font-semibold">{k.value ?? 'N/A'}</p>
                <p className="text-[11px] text-muted-foreground">vs {k.comparison}</p>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">{k.formula}</p>
              </button>
            ))}
          </div>
          <Card className="mb-4">
            <CardHeader><CardTitle>Members ({ov.members.length})</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left text-[11px] uppercase tracking-widest text-muted-foreground">
                  <th className="py-1">Member</th><th>Open leads</th><th>Open tasks</th><th>Overdue</th><th>Capacity</th><th>Status</th><th className="text-right">Action</th>
                </tr></thead>
                <tbody>
                  {ov.members.map((m: any) => (
                    <tr key={m.employeeId} className="border-b border-border">
                      <td className="py-1.5"><Link className="font-medium text-primary hover:underline" to={`/management/coaching?member=${m.employeeId}`}>{m.displayName}</Link></td>
                      <td>{m.openLeads}</td><td>{m.openTasks}</td>
                      <td>{m.overdueTasks > 0 ? <Badge tone="overdue">{m.overdueTasks}</Badge> : 0}</td>
                      <td>{m.openLeads}/{m.capacity}{m.idle ? <Badge tone="none" className="ml-1">idle</Badge> : null}</td>
                      <td><Badge tone={m.availability === 'available' ? 'open' : 'none'}>{label(m.availability)}</Badge></td>
                      <td className="text-right"><Link className="text-xs font-semibold text-primary hover:underline" to={`/management/coaching?member=${m.employeeId}`}>Open →</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
          {drill ? (
            <Card>
              <CardHeader><CardTitle>Drill: {label(drill.metric)} breakdown</CardTitle></CardHeader>
              <CardContent>
                <ul className="divide-y divide-border text-sm" role="list">
                  {drill.opportunities.map((o: any) => (
                    <li key={o.id} className="flex items-center gap-2 py-1.5">
                      <Link to={`/management/prospects/${o.id}`} className="font-medium text-primary hover:underline">{o.displayName}</Link>
                      <span className="font-mono text-xs text-muted-foreground">{o.id}</span>
                      <Badge tone="default">{label(o.stage)}</Badge>
                      <DrawerPanel trigger={<Button size="sm" variant="outline" className="ml-auto">Assign corrective task</Button>} title="Assign corrective task (TL-01)">
                        <CorrectiveForm leadId={o.id} onSaved={(msg) => { void s.run(async () => msg); load(); }} />
                      </DrawerPanel>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">Drill-down is a TL view of permitted records — never the caller dashboard.</p>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}

function CorrectiveForm({ leadId, onSaved }: { leadId: string; onSaved: (msg: string) => void }) {
  const [purpose, setPurpose] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <FormRow label="Corrective action" htmlFor="cor-purpose"><Input id="cor-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} /></FormRow>
      <FormRow label="Due" htmlFor="cor-due"><Input id="cor-due" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} /></FormRow>
      <BusyButton busy={busy} onClick={async () => {
        setBusy(true);
        try { await tlApi.correctiveTask(leadId, purpose, new Date(dueAt).toISOString()); onSaved(`Corrective task assigned on ${leadId}.`); }
        finally { setBusy(false); }
      }}>Assign task</BusyButton>
    </div>
  );
}

// ─── TL-02/03 Lead allocation ───
export function TlAllocationPage() {
  const [queue, loadQueue] = useLoad(() => tlApi.allocationQueue());
  const [recips] = useLoad(() => tlApi.recipients());
  const [preview, setPreview] = useState<any>(null);
  const [results, setResults] = useState<any>(null);
  const s = useSubmit();
  const batchIds: string[] = (queue?.leads ?? []).map((l: any) => l.id);
  return (
    <div>
      <PageHeader title="Lead allocation" subtitle="Unassigned queue, eligible associates, batch preview · TL-02/03" />
      {s.note ? <div className="mb-3"><SuccessNote>{s.note}</SuccessNote></div> : null}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Unassigned queue (V1 new leads)</CardTitle></CardHeader>
          <CardContent>
            {!queue ? <SkeletonRows rows={3} /> : queue.leads.length === 0 ? <EmptyState title="Queue clear" message="New self-sourced and routed enquiries appear here." /> : (
              <ul className="divide-y divide-border text-sm" role="list">
                {queue.leads.map((l: any) => (
                  <li key={l.id} className="flex flex-wrap items-center gap-2 py-2">
                    <span className="font-medium">{l.displayName}</span>
                    <span className="font-mono text-xs text-muted-foreground">{l.id}</span>
                    <Badge tone="default">{l.product}</Badge>
                    <span className="text-xs text-muted-foreground">{l.source} · queued {Math.round(l.ageSeconds / 60)}m</span>
                    <DrawerPanel trigger={<Button size="sm" variant="outline" className="ml-auto">Assign →</Button>} title={`Allocate ${l.id} (TL-02)`}>
                      <AllocateForm lead={l} onSaved={(msg) => { void s.run(async () => msg); loadQueue(); }} />
                    </DrawerPanel>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 rounded-md border border-border p-3">
              <p className="mb-2 text-sm font-medium">Batch distribution (weighted round-robin) · TL-03</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={batchIds.length === 0} onClick={() => void s.run(async () => {
                  const p = await tlApi.batchPreview({ leadIds: batchIds, method: 'weighted-round-robin', teamId: 'TEAM-WEALTH-ALPHA', capacityCap: 50 });
                  setPreview(p);
                  return `Preview: ${p.eligible} eligible / ${p.held} held.`;
                })}>Preview batch</Button>
                <Button size="sm" disabled={!preview || preview.eligible === 0} onClick={() => void s.run(async () => {
                  const r = await tlApi.batchCommit({ leadIds: batchIds, method: 'weighted-round-robin', teamId: 'TEAM-WEALTH-ALPHA', capacityCap: 50, batchKey: `BATCH-${Date.now()}` });
                  setResults(r); loadQueue();
                  return `Batch committed: ${r.results.filter((x: any) => x.status === 'assigned').length} assigned.`;
                })}>Confirm the preview</Button>
              </div>
              {preview ? (
                <ul className="mt-2 text-xs" role="list">
                  {preview.receipts.map((r: any) => (
                    <li key={r.leadId} className="flex gap-2 py-0.5">
                      <span className="font-mono">{r.leadId}</span>
                      <span>→ {r.toEmployeeId ?? '—'}</span>
                      <Badge tone={r.status === 'assigned' ? 'open' : 'none'}>{r.status}</Badge>
                      {r.detail ? <span className="text-muted-foreground">{r.detail}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
              {results ? <p className="mt-2 text-xs text-muted-foreground">Per-record results stored (batch key idempotent — repeats replay, never double-assign). Retry failures only.</p> : null}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Eligible associates</CardTitle></CardHeader>
          <CardContent>
            {!recips ? <SkeletonRows rows={2} /> : (
              <ul className="divide-y divide-border text-sm" role="list">
                {recips.recipients.map((r: any) => (
                  <li key={r.employeeId} className="py-2">
                    <p className="font-medium">{r.displayName} <span className="font-mono text-xs text-muted-foreground">{r.employeeId}</span></p>
                    <p className="text-xs text-muted-foreground">Capacity {r.openLeads} of {r.capacity} · {label(r.availability)}</p>
                    <Badge tone={r.eligible ? 'open' : 'none'}>{r.reason}</Badge>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-muted-foreground">Active employment, leave, product eligibility and capacity checked. Never assign to a disabled user.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AllocateForm({ lead, onSaved }: { lead: any; onSaved: (msg: string) => void }) {
  const [to, setTo] = useState('EMP-001');
  const [reason, setReason] = useState('Language and availability');
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <p className="mb-2 text-sm text-muted-foreground">{lead.displayName} ({lead.id}) · v{lead.recordVersion}</p>
      <FormRow label="Recipient" htmlFor="alloc-to">
        <Select id="alloc-to" value={to} onChange={(e) => setTo(e.target.value)}>
          <option value="EMP-001">Asha Rao</option>
          <option value="EMP-002">Ravi Nair</option>
          <option value="EMP-012">Priya Sharma</option>
        </Select>
      </FormRow>
      <FormRow label="Reason" htmlFor="alloc-reason"><Input id="alloc-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></FormRow>
      <BusyButton busy={busy} onClick={async () => {
        setBusy(true);
        try {
          await tlApi.allocate(lead.id, to, reason, lead.recordVersion);
          onSaved(`Allocated ${lead.id} with first-contact task and notification.`);
        } finally { setBusy(false); }
      }}>Assign lead</BusyButton>
      <p className="mt-2 text-xs text-muted-foreground">Ownership, first-contact task and notification are created atomically on the record version.</p>
    </div>
  );
}

// ─── TL-04/05 Team workload + overdue ───
export function TlWorkloadPage() {
  const [work, loadWork] = useLoad(() => tlApi.workload());
  const [overdue, loadOverdue] = useLoad(() => tlApi.overdue());
  const s = useSubmit();
  const refresh = () => { loadWork(); loadOverdue(); };
  return (
    <div>
      <PageHeader title="Team workload" subtitle="Rebalancing and overdue recovery · TL-04/05" />
      {s.note ? <div className="mb-3"><SuccessNote>{s.note}</SuccessNote></div> : null}
      <Card className="mb-4">
        <CardHeader><CardTitle>Overdue queue (severity-sorted)</CardTitle></CardHeader>
        <CardContent>
          {!overdue ? <SkeletonRows rows={2} /> : overdue.tasks.length === 0 ? <EmptyState title="No overdue work" message="Missed deadlines appear here with recovery actions." /> : (
            <ul className="divide-y divide-border text-sm" role="list">
              {overdue.tasks.map((t: any) => (
                <li key={t.taskId} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="font-mono text-xs">{t.taskId}</span>
                  <Link to={`/management/prospects/${t.leadId}`} className="font-medium text-primary hover:underline">{t.leadName}</Link>
                  <span className="text-muted-foreground">{t.ownerName} · age {Math.round(t.ageSeconds / 3600)}h</span>
                  {t.breachCount > 0 ? <Badge tone="overdue">breach ×{t.breachCount}</Badge> : null}
                  <DrawerPanel trigger={<Button size="sm" variant="outline" className="ml-auto">Coach / reassign / escalate</Button>} title={`Recovery action ${t.taskId} (TL-05)`}>
                    <RecoveryForm taskId={t.taskId} members={(work?.members ?? []).map((m: any) => m.employeeId)} onSaved={(msg) => { void s.run(async () => msg); refresh(); }} />
                  </DrawerPanel>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-muted-foreground">Missed deadlines can never be erased or backdated. Repeated breaches notify the Manager with the evidence trail.</p>
        </CardContent>
      </Card>
      <Card className="mb-4">
        <CardHeader><CardTitle>Workload comparison</CardTitle></CardHeader>
        <CardContent>
          {!work ? <SkeletonRows rows={2} /> : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-[11px] uppercase tracking-widest text-muted-foreground">
                <th className="py-1">Member</th><th>Open leads</th><th>Open tasks</th><th>Overdue</th><th>Capacity</th><th className="text-right">Action</th>
              </tr></thead>
              <tbody>
                {work.members.map((m: any) => (
                  <tr key={m.employeeId} className="border-b border-border">
                    <td className="py-1.5 font-medium">{m.displayName}</td>
                    <td>{m.openLeads}</td>
                    <td>{m.openTasks}</td>
                    <td>{m.overdueTasks > 0 ? <Badge tone="overdue">{m.overdueTasks}</Badge> : 0}</td>
                    <td>{m.openLeads}/{m.capacity}{m.openLeads === 0 ? <Badge tone="none" className="ml-1">idle</Badge> : null}</td>
                    <td className="text-right">
                      <DrawerPanel trigger={<Button size="sm" variant="outline">Rebalance →</Button>} title={`Rebalance from ${m.displayName} (TL-04)`}>
                        <RebalanceForm source={m} members={work.members} onSaved={(msg) => { void s.run(async () => msg); refresh(); }} />
                      </DrawerPanel>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-2 text-xs text-muted-foreground">Inherited backlog is shown separately for the recipient; earlier calls and wins never become their personal work.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Quick rebalance & transfer · TL-04</CardTitle></CardHeader>
        <CardContent>
          {!work ? <SkeletonRows rows={1} /> : (
            <VisibleRebalanceCard members={work.members} onSaved={(msg) => { void s.run(async () => msg); refresh(); }} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RecoveryForm({ taskId, members, onSaved }: { taskId: string; members: string[]; onSaved: (m: string) => void }) {
  const [action, setAction] = useState<'coach' | 'reassign' | 'escalate'>('coach');
  const [reason, setReason] = useState('');
  const [newOwner, setNewOwner] = useState(members[0] ?? '');
  const [dueAt, setDueAt] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <FormRow label="Action" htmlFor="rec-action">
        <Select id="rec-action" value={action} onChange={(e) => setAction(e.target.value as 'coach' | 'reassign' | 'escalate')}>
          <option value="coach">Coach</option><option value="reassign">Reassign (permitted handoff)</option><option value="escalate">Escalate</option>
        </Select>
      </FormRow>
      {action === 'reassign' ? (
        <FormRow label="New owner" htmlFor="rec-owner">
          <Select id="rec-owner" value={newOwner} onChange={(e) => setNewOwner(e.target.value)}>
            {members.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
        </FormRow>
      ) : null}
      <FormRow label="Reason" htmlFor="rec-reason"><Textarea id="rec-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></FormRow>
      <FormRow label="Recovery deadline" htmlFor="rec-due"><Input id="rec-due" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} /></FormRow>
      <BusyButton busy={busy} onClick={async () => {
        setBusy(true);
        try {
          await tlApi.overdueAction(taskId, { action, reason, newOwnerEmployeeId: action === 'reassign' ? newOwner : undefined, recoveryDueAt: new Date(dueAt).toISOString() });
          onSaved('Escalation appended with recovery task. Original history preserved.');
        } finally { setBusy(false); }
      }}>Assign recovery action</BusyButton>
    </div>
  );
}

function RebalanceForm({ source, members, onSaved }: { source: any; members: any[]; onSaved: (m: string) => void }) {
  const [to, setTo] = useState(members.find((m) => m.employeeId !== source.employeeId)?.employeeId ?? '');
  const [leadIds, setLeadIds] = useState('');
  const [reason, setReason] = useState('Approved absence');
  const [deadline, setDeadline] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <p className="mb-2 text-sm text-muted-foreground">Source: {source.displayName} — open leads {source.openLeads}, open tasks {source.openTasks}</p>
      <FormRow label="Destination" htmlFor="reb-to">
        <Select id="reb-to" value={to} onChange={(e) => setTo(e.target.value)}>
          {members.filter((m) => m.employeeId !== source.employeeId).map((m) => <option key={m.employeeId} value={m.employeeId}>{m.displayName}</option>)}
        </Select>
      </FormRow>
      <FormRow label="Lead IDs (comma-separated)" htmlFor="reb-leads"><Input id="reb-leads" value={leadIds} onChange={(e) => setLeadIds(e.target.value)} /></FormRow>
      <FormRow label="Reason" htmlFor="reb-reason"><Input id="reb-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></FormRow>
      <FormRow label="Handoff deadline" htmlFor="reb-deadline"><Input id="reb-deadline" type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></FormRow>
      <BusyButton busy={busy} onClick={async () => {
        setBusy(true);
        try {
          const r = await tlApi.rebalance({ leadIds: leadIds.split(',').map((x) => x.trim()).filter(Boolean), toEmployeeId: to, reason, handoffDeadline: new Date(deadline).toISOString() });
          onSaved(`Rebalance done: ${r.results.map((x: any) => `${x.leadId}:${x.status}`).join(', ')}`);
        } finally { setBusy(false); }
      }}>Confirm reassignment and notify both</BusyButton>
    </div>
  );
}

function VisibleRebalanceCard({ members, onSaved }: { members: any[]; onSaved: (m: string) => void }) {
  const [from, setFrom] = useState(members[0]?.employeeId ?? 'EMP-001');
  const [to, setTo] = useState(members[1]?.employeeId ?? 'EMP-002');
  const [leadIds, setLeadIds] = useState('');
  const [reason, setReason] = useState('Workload leveling');
  const [deadline, setDeadline] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <FormRow label="Source associate" htmlFor="vis-from">
          <Select id="vis-from" value={from} onChange={(e) => setFrom(e.target.value)}>
            {members.map((m) => (
              <option key={m.employeeId} value={m.employeeId}>
                {m.displayName} ({m.openLeads} leads, {m.openTasks} tasks)
              </option>
            ))}
          </Select>
        </FormRow>
        <FormRow label="Destination associate" htmlFor="vis-to">
          <Select id="vis-to" value={to} onChange={(e) => setTo(e.target.value)}>
            {members.filter((m) => m.employeeId !== from).map((m) => (
              <option key={m.employeeId} value={m.employeeId}>
                {m.displayName} (capacity {m.openLeads}/{m.capacity})
              </option>
            ))}
          </Select>
        </FormRow>
        <FormRow label="Lead IDs (comma-separated)" htmlFor="vis-leads">
          <Input id="vis-leads" placeholder="e.g. FV-1001, FV-1002" value={leadIds} onChange={(e) => setLeadIds(e.target.value)} />
        </FormRow>
        <FormRow label="Handoff deadline" htmlFor="vis-deadline">
          <Input id="vis-deadline" type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </FormRow>
      </div>
      <FormRow label="Business reason for transfer" htmlFor="vis-reason">
        <Input id="vis-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Approved absence, skill matching, or capacity leveling..." />
      </FormRow>
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <p className="text-xs text-muted-foreground">
          Open tasks move together with the lead; pending conversion approvals remain locked. Cross-team rebalances require authority over both teams.
        </p>
        <BusyButton busy={busy} onClick={async () => {
          setBusy(true);
          try {
            const r = await tlApi.rebalance({
              leadIds: leadIds.split(',').map((x) => x.trim()).filter(Boolean),
              toEmployeeId: to,
              reason,
              handoffDeadline: deadline ? new Date(deadline).toISOString() : new Date(Date.now() + 86400000).toISOString(),
            });
            onSaved(`Rebalance done: ${r.results.map((x: any) => `${x.leadId}:${x.status}`).join(', ')}`);
          } finally {
            setBusy(false);
          }
        }}>
          Confirm reassignment and notify both
        </BusyButton>
      </div>
    </div>
  );
}

// ─── TL-07/08/09/18 Quality & approvals ───
export function TlQualityPage() {
  const [decisions, loadD] = useLoad(() => tlApi.decisions());
  const [quality, loadQ] = useLoad(() => tlApi.qualityReviews());
  const [corrections, loadC] = useLoad(() => tlApi.corrections());
  const s = useSubmit();
  const refresh = () => { loadD(); loadQ(); loadC(); };
  return (
    <div>
      <PageHeader title="Quality & approvals" subtitle="Conversions, reopens, duplicates, call quality, corrections · TL-07/08/09/18" />
      {s.note ? <div className="mb-3"><SuccessNote>{s.note}</SuccessNote></div> : null}
      <Card className="mb-4">
        <CardHeader><CardTitle>Pending decisions</CardTitle></CardHeader>
        <CardContent>
          {!decisions ? <SkeletonRows rows={2} /> : decisions.requests.length === 0 && decisions.duplicates.length === 0 ? <EmptyState title="Nothing to decide" message="Conversion, reopen and duplicate requests appear here." /> : (
            <>
              <ul className="divide-y divide-border text-sm" role="list">
                {decisions.requests.map((r: any) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
                    <Badge tone="pending">{label(r.type)}</Badge>
                    <Link to={`/management/prospects/${r.leadId}`} className="font-medium text-primary hover:underline">{r.leadName}</Link>
                    <span className="text-xs text-muted-foreground">by {r.submitterName} · {r.id}</span>
                    <div className="ml-auto">
                      <DrawerPanel
                        trigger={<Button size="sm" variant="outline">Review & decide →</Button>}
                        title={`Review & decide (TL-07/08) · ${r.id}`}
                      >
                        <DecisionForm request={r} onSaved={(msg) => { void s.run(async () => msg); refresh(); }} />
                      </DrawerPanel>
                    </div>
                  </li>
                ))}
                {decisions.duplicates.map((d: any) => (
                  <li key={d.enquiryId} className="flex flex-wrap items-center gap-2 py-2">
                    <Badge tone="default">duplicate</Badge>
                    <span className="font-medium">{d.displayName}</span>
                    <span className="text-xs text-muted-foreground">matches {d.originalName} ({d.duplicateOf}) — match-review reference only</span>
                    <span className="ml-auto flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => void s.run(async () => { await tlApi.duplicateDisposition(d.enquiryId, 'confirm-separate'); refresh(); return 'Confirmed distinct — IDs and source links retained.'; })}>Confirm separate</Button>
                      <Button size="sm" variant="ghost" onClick={() => void s.run(async () => { await tlApi.duplicateDisposition(d.enquiryId, 'route-merge'); refresh(); return 'Merge review routed to the data steward.'; })}>Route merge review</Button>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">Approver must differ from the submitter. Merge authority is separate — records are never collapsed here.</p>
            </>
          )}
        </CardContent>
      </Card>
      <Card className="mb-4">
        <CardHeader><CardTitle>Call quality samples</CardTitle></CardHeader>
        <CardContent>
          {!quality ? <SkeletonRows rows={2} /> : (
            <ul className="divide-y divide-border text-sm" role="list">
              {quality.reviews.map((q: any) => (
                <li key={q.id} className="py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs">{q.callId}</span>
                    <span className="text-muted-foreground">{q.subjectName}</span>
                    <Badge tone={q.assessed ? 'open' : 'none'}>{q.assessed ? `assessed (${q.rubricVersion})` : 'unassessed — no evidence'}</Badge>
                    <Button size="sm" variant="ghost" className="ml-auto" onClick={() => void s.run(async () => { const e = await tlApi.qualityEvidence(q.id); return e.note; })}>View evidence</Button>
                  </div>
                  <p className="text-xs text-muted-foreground">{q.feedback}</p>
                </li>
              ))}
              {quality.reviews.length === 0 ? <li className="text-sm text-muted-foreground">No samples yet.</li> : null}
            </ul>
          )}
          <p className="mt-2 text-xs text-muted-foreground">Sample size is always reported with scores — small samples never imply full coverage.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Activity corrections</CardTitle></CardHeader>
        <CardContent>
          {!corrections ? <SkeletonRows rows={2} /> : corrections.corrections.length === 0 ? <EmptyState title="No corrections" message="Documented correction requests appear here." /> : (
            <ul className="divide-y divide-border text-sm" role="list">
              {corrections.corrections.map((c: any) => (
                <li key={c.id} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="font-mono text-xs">{c.id}</span>
                  <span className="text-muted-foreground">{c.requestedField}: “{c.originalValue}” → “{c.requestedValue}” · by {c.submitterName}</span>
                  <Badge tone={c.status === 'accepted' ? 'completed' : c.status === 'returned' ? 'none' : 'pending'}>{c.status}</Badge>
                  {c.status === 'pending' ? (
                    <div className="ml-auto">
                      <DrawerPanel
                        trigger={<Button size="sm" variant="outline">Review correction →</Button>}
                        title={`Review correction (TL-18) · ${c.id}`}
                      >
                        <CorrectionDecisionForm correction={c} onSaved={(msg) => { void s.run(async () => msg); refresh(); }} />
                      </DrawerPanel>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-muted-foreground">Provider truth needs supporting evidence. Self-submitted corrections go to Manager. Unfavourable activities are never deleted.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function DecisionForm({
  request,
  onSaved,
}: {
  request: any;
  onSaved: (msg: string) => void;
}) {
  const [outcome, setOutcome] = useState<'approve' | 'return' | 'reject'>('approve');
  const [note, setNote] = useState('');
  const [evidenceRef, setEvidenceRef] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const payload = request.payload && typeof request.payload === 'object' ? request.payload : {};

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-secondary/30 p-3 text-xs space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-foreground">Submitted Request Context</span>
          <Badge tone="pending">{label(request.type)}</Badge>
        </div>
        <p className="text-muted-foreground">
          Lead: <Link to={`/management/prospects/${request.leadId}`} className="font-medium text-primary hover:underline">{request.leadName} ({request.leadId})</Link>
        </p>
        <p className="text-muted-foreground">Submitted by: <span className="font-medium text-foreground">{request.submitterName}</span></p>
        {request.createdAt ? (
          <p className="text-muted-foreground">Requested: {new Date(request.createdAt).toLocaleString()}</p>
        ) : null}

        {/* Typed Conversion fields */}
        {request.type === 'conversion' ? (
          <div className="mt-2 pt-2 border-t border-border/60 space-y-1 text-xs">
            <span className="font-semibold text-foreground block">Conversion Details:</span>
            {payload.winMilestone ? <p><strong className="text-foreground">Win milestone:</strong> {String(payload.winMilestone)}</p> : null}
            {payload.milestoneDate ? <p><strong className="text-foreground">Milestone date:</strong> {String(payload.milestoneDate)}</p> : null}
            {payload.value !== undefined ? (
              <p><strong className="text-foreground">Conversion value:</strong> {String(payload.currency ?? 'INR')} {Number(payload.value).toLocaleString()}</p>
            ) : null}
            {payload.evidenceRef ? (
              <p><strong className="text-foreground">Submitted evidence ref:</strong> {String(payload.evidenceRef)}</p>
            ) : null}
            {payload.proposedCredit ? (
              <p><strong className="text-foreground">Proposed credit splits:</strong> {Object.entries(payload.proposedCredit as Record<string, number>).map(([m, p]) => `${m}: ${p}%`).join(', ')}</p>
            ) : null}
          </div>
        ) : null}

        {/* Typed Reopen fields */}
        {request.type === 'reopen' ? (
          <div className="mt-2 pt-2 border-t border-border/60 space-y-1 text-xs">
            <span className="font-semibold text-foreground block">Reopen Details:</span>
            {payload.reason ? <p><strong className="text-foreground">Reopen reason:</strong> {String(payload.reason)}</p> : null}
            {payload.newEvidence ? <p><strong className="text-foreground">New evidence:</strong> {String(payload.newEvidence)}</p> : null}
            {payload.requestedNextStage ? <p><strong className="text-foreground">Requested stage:</strong> {String(payload.requestedNextStage)}</p> : null}
            {payload.nextAction ? <p><strong className="text-foreground">Next action:</strong> {String(payload.nextAction)}</p> : null}
          </div>
        ) : null}

        {/* General payload fields if not conversion/reopen */}
        {request.type !== 'conversion' && request.type !== 'reopen' ? (
          <div className="mt-2 pt-2 border-t border-border/60 space-y-1 text-xs">
            {payload.reason ? <p><strong className="text-foreground">Reason:</strong> {String(payload.reason)}</p> : null}
            {payload.evidence ? <p><strong className="text-foreground">Evidence:</strong> {String(payload.evidence)}</p> : null}
            {payload.destination ? <p><strong className="text-foreground">Destination:</strong> {String(payload.destination)}</p> : null}
            {payload.customerPermission ? <p><strong className="text-foreground">Permission ref:</strong> {String(payload.customerPermission)}</p> : null}
          </div>
        ) : null}
      </div>

      <FormRow label="Decision" htmlFor="dec-outcome">
        <Select
          id="dec-outcome"
          value={outcome}
          onChange={(e) => setOutcome(e.target.value as 'approve' | 'return' | 'reject')}
        >
          <option value="approve">Approve</option>
          <option value="return">Return for corrections</option>
          <option value="reject">Reject</option>
        </Select>
      </FormRow>

      <FormRow
        label="Verified evidence reference"
        htmlFor="dec-evidence-ref"
      >
        <Input
          id="dec-evidence-ref"
          value={evidenceRef}
          onChange={(e) => setEvidenceRef(e.target.value)}
          placeholder="e.g. DOC-0192, verified agreement reference, CRM call ID..."
        />
      </FormRow>

      <FormRow
        label="Decision rationale"
        htmlFor="dec-note"
        error={error ?? undefined}
      >
        <Textarea
          id="dec-note"
          rows={3}
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            if (error) setError(null);
          }}
          placeholder={
            outcome === 'approve'
              ? 'Record approval justification...'
              : outcome === 'return'
              ? 'Specify missing items required from submitter...'
              : 'State reason for rejection...'
          }
        />
      </FormRow>

      <BusyButton
        busy={busy}
        onClick={async () => {
          const trimmed = note.trim();
          if (trimmed.length < 3) {
            setError('Please provide a decision rationale (min 3 characters).');
            return;
          }
          setBusy(true);
          try {
            await tlApi.decide(request.id, outcome, trimmed, {
              verifiedEvidenceRef: evidenceRef.trim() || undefined,
              decidedAt: new Date().toISOString(),
            });
            onSaved(
              outcome === 'approve'
                ? `Approved — decision receipt recorded for ${request.id}.`
                : outcome === 'return'
                ? `Returned with correction requirements for ${request.id}.`
                : `Rejected with reason for ${request.id}.`
            );
          } catch (err: any) {
            setError(err.message || 'Failed to record decision.');
          } finally {
            setBusy(false);
          }
        }}
      >
        Record decision
      </BusyButton>
    </div>
  );
}

function CorrectionDecisionForm({
  correction,
  onSaved,
}: {
  correction: any;
  onSaved: (msg: string) => void;
}) {
  const [decision, setDecision] = useState<'accept' | 'return' | 'reject'>('accept');
  const [evidenceRef, setEvidenceRef] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-secondary/30 p-3 text-xs space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-foreground">Activity correction context</span>
          <Badge tone="pending">{correction.id}</Badge>
        </div>
        <p className="text-muted-foreground">
          Field: <span className="font-semibold text-foreground">{correction.requestedField}</span>
        </p>
        <p className="text-muted-foreground">Original value: “{correction.originalValue}”</p>
        <p className="text-muted-foreground">Requested value: “{correction.requestedValue}”</p>
        <p className="text-muted-foreground">Submitted by: <span className="font-medium text-foreground">{correction.submitterName}</span></p>
        {correction.evidenceRef ? (
          <p className="text-muted-foreground"><strong className="text-foreground">Submitted evidence ref:</strong> {correction.evidenceRef}</p>
        ) : null}
        {correction.explanation ? (
          <p className="text-muted-foreground"><strong className="text-foreground">Explanation:</strong> {correction.explanation}</p>
        ) : null}
      </div>

      <FormRow label="Decision" htmlFor="cor-dec">
        <Select
          id="cor-dec"
          value={decision}
          onChange={(e) => setDecision(e.target.value as 'accept' | 'return' | 'reject')}
        >
          <option value="accept">Accept correction (append-only live audit)</option>
          <option value="return">Return for additional evidence</option>
          <option value="reject">Reject correction</option>
        </Select>
      </FormRow>

      <FormRow
        label="Supporting provider evidence reference"
        htmlFor="cor-evidence-ref"
      >
        <Input
          id="cor-evidence-ref"
          value={evidenceRef}
          onChange={(e) => setEvidenceRef(e.target.value)}
          placeholder="e.g. Call CDR record ID, provider webhook event ID, timestamp..."
        />
      </FormRow>

      <FormRow
        label="Decision rationale"
        htmlFor="cor-reason"
        error={error ?? undefined}
      >
        <Textarea
          id="cor-reason"
          rows={3}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            if (error) setError(null);
          }}
          placeholder={
            decision === 'accept'
              ? 'State verified reason for accepting correction...'
              : decision === 'return'
              ? 'State what evidence is missing from submitter...'
              : 'State reason for rejecting correction...'
          }
        />
      </FormRow>

      <BusyButton
        busy={busy}
        onClick={async () => {
          const trimmed = reason.trim();
          if (trimmed.length < 3) {
            setError('Please provide a decision rationale (min 3 characters).');
            return;
          }
          setBusy(true);
          try {
            await tlApi.decideCorrection(correction.id, decision, trimmed, {
              providerEvidenceRef: evidenceRef.trim() || undefined,
              decidedAt: new Date().toISOString(),
            });
            onSaved(
              decision === 'accept'
                ? `Correction accepted (append-only) — report versions flagged.`
                : decision === 'return'
                ? `Correction returned for additional evidence.`
                : `Correction rejected with reason.`
            );
          } catch (err: any) {
            setError(err.message || 'Failed to record correction decision.');
          } finally {
            setBusy(false);
          }
        }}
      >
        Record correction decision
      </BusyButton>
    </div>
  );
}

// ─── TL-10/11 Targets & forecast ───
export function TlTargetsPage() {
  const [targets, loadT] = useLoad(() => tlApi.targets());
  const [forecasts, loadF] = useLoad(() => tlApi.forecasts());
  const s = useSubmit();
  const [target, setTarget] = useState({ teamId: 'TEAM-WEALTH-ALPHA', periodLabel: 'Oct-2026', metric: 'approved-wins', parentValue: 50, basis: 'capacity' });
  const [fc, setFc] = useState({ teamId: 'TEAM-WEALTH-ALPHA', periodLabel: 'Oct-2026', category: 'commit', expectedRevenue: 0, currency: 'INR', opportunityIds: '', riskNotes: '' });
  const [filterTeam, setFilterTeam] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('Oct-2026');

  return (
    <div>
      <PageHeader title="Targets & forecast" subtitle="Versioned target distribution and dated forecasts · TL-10/11" />
      {s.note ? <div className="mb-3"><SuccessNote>{s.note}</SuccessNote></div> : null}
      <Card className="mb-4">
        <CardHeader><CardTitle>Team targets</CardTitle></CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-border pb-3">
            <Select value={filterTeam} onChange={(e) => setFilterTeam(e.target.value)}>
              <option value="all">All granted teams (deduplicated)</option>
              <option value="TEAM-WEALTH-ALPHA">Team Wealth Alpha</option>
              <option value="TEAM-WEALTH-BETA">Team Wealth Beta</option>
            </Select>
            <Select value={filterPeriod} onChange={(e) => setFilterPeriod(e.target.value)}>
              <option value="Oct-2026">Oct-2026</option>
              <option value="Q4-2026">Q4-2026</option>
            </Select>
            <Button size="sm" variant="outline" onClick={loadT}>Apply filters</Button>
            <Button size="sm" variant="outline" className="ml-auto" onClick={() => void s.run(async () => {
              const pack = await tlApi.teamPacks({ teamIds: ['TEAM-WEALTH-ALPHA', 'TEAM-WEALTH-BETA'], period: 'month' });
              const { downloadFile } = await import('../lib/wealth-api');
              await downloadFile(tlApi.teamPackDownloadPath(pack.id), 'scoped-targets-breakdown.pdf');
              return 'Scoped targets PDF generated and downloaded.';
            })}>Generate scoped PDF →</Button>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-5">
            <FormRow label="Team" htmlFor="tg-team"><Select id="tg-team" value={target.teamId} onChange={(e) => setTarget({ ...target, teamId: e.target.value })}><option value="TEAM-WEALTH-ALPHA">Wealth Alpha</option><option value="TEAM-WEALTH-BETA">Wealth Beta</option></Select></FormRow>
            <FormRow label="Period" htmlFor="tg-period"><Input id="tg-period" value={target.periodLabel} onChange={(e) => setTarget({ ...target, periodLabel: e.target.value })} /></FormRow>
            <FormRow label="Parent target" htmlFor="tg-value"><Input id="tg-value" type="number" value={target.parentValue} onChange={(e) => setTarget({ ...target, parentValue: Number(e.target.value) })} /></FormRow>
            <FormRow label="Basis" htmlFor="tg-basis"><Select id="tg-basis" value={target.basis} onChange={(e) => setTarget({ ...target, basis: e.target.value })}><option value="capacity">Capacity-weighted</option><option value="tenure">Tenure & start dates</option><option value="equal">Equal (prorated)</option></Select></FormRow>
            <div className="flex items-end"><Button size="sm" variant="outline" onClick={() => void s.run(async () => { await tlApi.createTarget(target); loadT(); return 'Approved team target opened for distribution.'; })}>Create target</Button></div>
          </div>
          {!targets ? <SkeletonRows rows={2} /> : (
            <ul className="divide-y divide-border text-sm" role="list">
              {targets.targets.map((t: any) => (
                <li key={t.id} className="py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{t.teamName} · {t.periodLabel} · {t.metric}</span>
                    <Badge tone="default">v{t.version}</Badge>
                    <span className="text-muted-foreground">parent {t.parentValue} · allocated {t.allocated} · remainder {t.remainder}</span>
                    <DrawerPanel trigger={<Button size="sm" variant="outline" className="ml-auto">Draft allocations</Button>} title={`Allocate target ${t.id} (TL-10)`}>
                      <TargetAllocForm target={t} onSaved={(m) => { s.note = m; loadT(); }} />
                    </DrawerPanel>
                  </div>
                  {t.allocations.map((a: any) => <p key={a.employeeId} className="text-xs text-muted-foreground">• {a.displayName}: {a.allocatedValue}{a.prorateNote ? ` (${a.prorateNote})` : ''}</p>)}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-muted-foreground">Child allocations reconcile to the parent with an explicit remainder. Closed periods are immutable.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Team forecast</CardTitle></CardHeader>
        <CardContent>
          <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
            <FormRow label="Category" htmlFor="fc-cat"><Select id="fc-cat" value={fc.category} onChange={(e) => setFc({ ...fc, category: e.target.value })}><option>commit</option><option>best-case</option><option>pipeline</option></Select></FormRow>
            <FormRow label="Expected revenue" htmlFor="fc-rev"><Input id="fc-rev" type="number" value={fc.expectedRevenue} onChange={(e) => setFc({ ...fc, expectedRevenue: Number(e.target.value) })} /></FormRow>
            <FormRow label="Opportunity IDs" htmlFor="fc-opps"><Input id="fc-opps" value={fc.opportunityIds} onChange={(e) => setFc({ ...fc, opportunityIds: e.target.value })} /></FormRow>
            <div className="flex items-end"><Button size="sm" onClick={() => void s.run(async () => {
              await tlApi.submitForecast({ ...fc, opportunityIds: fc.opportunityIds.split(',').map((x) => x.trim()).filter(Boolean) });
              loadF(); return 'Forecast version frozen and submitted to Manager.';
            })}>Submit forecast</Button></div>
          </div>
          {!forecasts ? <SkeletonRows rows={2} /> : (
            <ul className="divide-y divide-border text-sm" role="list">
              {forecasts.forecasts.map((f: any) => (
                <li key={f.id} className="flex flex-wrap items-center gap-2 py-2">
                  <Badge tone="default">{f.category}</Badge>
                  <span className="font-medium">{f.periodLabel}</span>
                  <span>{f.currency} {f.expectedRevenue.toLocaleString()}</span>
                  <Badge tone={f.status === 'revised' ? 'pending' : 'completed'}>{f.status} v{f.version}</Badge>
                  <span className="text-xs text-muted-foreground">by {f.submitterName}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-muted-foreground">{forecasts?.basisNote ?? 'Won value stays separate from expected revenue.'}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function TargetAllocForm({ target, onSaved }: { target: any; onSaved: (m: string) => void }) {
  const [rows, setRows] = useState('EMP-001:30, EMP-002:15');
  const [basis, setBasis] = useState('capacity');
  const [busy, setBusy] = useState(false);

  const allocatedSum = rows
    .split(',')
    .map((p) => Number(p.split(':')[1]?.trim() || 0))
    .filter((n) => !isNaN(n))
    .reduce((a, b) => a + b, 0);
  const unallocated = target.parentValue - allocatedSum;

  return (
    <div>
      <div className="mb-3 rounded-md border border-border bg-secondary/30 p-2.5 text-xs space-y-1">
        <p><span className="text-muted-foreground">Parent target (v{target.version}):</span> <strong className="text-foreground">{target.parentValue}</strong></p>
        <p><span className="text-muted-foreground">Allocated sum:</span> <strong className="text-foreground">{allocatedSum}</strong></p>
        <p>
          <span className="text-muted-foreground">Unallocated balance:</span>{' '}
          <Badge tone={unallocated === 0 ? 'completed' : unallocated < 0 ? 'overdue' : 'pending'}>
            {unallocated === 0 ? '0 (Fully reconciled)' : unallocated < 0 ? `${unallocated} (Overallocated)` : `${unallocated} remaining`}
          </Badge>
        </p>
      </div>

      <FormRow label="Distribution basis" htmlFor="ta-basis">
        <Select id="ta-basis" value={basis} onChange={(e) => setBasis(e.target.value)}>
          <option value="capacity">Capacity-weighted (open workload ceiling)</option>
          <option value="tenure">Tenure, probation and start dates</option>
          <option value="equal">Equal distribution with approved prorating</option>
        </Select>
      </FormRow>

      <FormRow label="Allocations (EMP:value, comma-separated)" htmlFor="ta-rows">
        <Textarea id="ta-rows" rows={3} value={rows} onChange={(e) => setRows(e.target.value)} />
      </FormRow>

      <BusyButton busy={busy} onClick={async () => {
        setBusy(true);
        try {
          const allocations = rows.split(',').map((p) => p.trim()).filter(Boolean).map((p) => {
            const [employeeId, v] = p.split(':');
            return { employeeId: employeeId.trim(), allocatedValue: Number(v) };
          });
          const r = await tlApi.allocateTarget(target.id, { allocations });
          onSaved(`Allocated ${r.allocated} — remainder ${r.remainder} (v${r.version}).`);
        } finally { setBusy(false); }
      }}>Publish allocation</BusyButton>
    </div>
  );
}

// ─── TL-06/12/13 Coaching ───
export function TlCoachingPage() {
  const [o2o, loadO] = useLoad(() => tlApi.oneToOnes());
  const [mentors, loadM] = useLoad(() => tlApi.mentorships());
  const [member, setMember] = useState<any>(null);
  const s = useSubmit();
  const [form, setForm] = useState({ employeeId: 'EMP-001', periodLabel: 'Sep-2026', agenda: 'Performance and blockers', scheduledAt: '' });
  const [internId, setInternId] = useState('EMP-002');
  const [mentorId, setMentorId] = useState('EMP-003');
  const [workCap, setWorkCap] = useState(8);
  const [products, setProducts] = useState('V1 Savings Plus, Wealth Starter');
  const [reviewDate, setReviewDate] = useState('2026-11-30');
  const refresh = () => { loadO(); loadM(); };
  return (
    <div>
      <PageHeader title="Coaching" subtitle="Associate reviews, one-to-ones, intern mentoring · TL-06/12/13" />
      {s.note ? <div className="mb-3"><SuccessNote>{s.note}</SuccessNote></div> : null}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Associate review (TL workspace)</CardTitle></CardHeader>
          <CardContent>
            <div className="mb-2 flex gap-2">
              {['EMP-001', 'EMP-002', 'EMP-012'].map((id) => (
                <Button key={id} size="sm" variant="outline" onClick={() => void tlApi.member(id).then(setMember)}>{id}</Button>
              ))}
            </div>
            {member ? (
              <div className="text-sm">
                <p className="font-medium">{member.member.displayName} · {label(member.member.availability)}</p>
                <p className="text-xs text-muted-foreground">{member.metricNote}</p>
                <p className="mt-1">Personal activity events: {member.personalActivityEvents} · inherited leads: {member.inheritedLeads}</p>
                {member.assignmentHistory.map((h: any) => <p key={h.id} className="text-xs text-muted-foreground">• {h.label}</p>)}
                {member.coaching.map((c: any) => <p key={c.id} className="text-xs"> coaching: {c.feedback}</p>)}
                {member.training.map((t: any) => <p key={t.id} className="text-xs"> mentorship: {t.mentorEmployeeId} cap {t.workCap} ({t.status})</p>)}
              </div>
            ) : <p className="text-sm text-muted-foreground">Open a member to inspect workload, metrics, training and coaching commitments — without switching role.</p>}
            <div className="mt-4 rounded-md border border-border p-3">
              <p className="mb-2 text-sm font-medium">Schedule a one-to-one · TL-12</p>
              <div className="grid grid-cols-2 gap-2">
                <FormRow label="Employee" htmlFor="o2o-emp"><Select id="o2o-emp" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}><option value="EMP-001">Asha Rao</option><option value="EMP-002">Ravi Nair</option><option value="EMP-012">Priya Sharma</option></Select></FormRow>
                <FormRow label="Period" htmlFor="o2o-period"><Input id="o2o-period" value={form.periodLabel} onChange={(e) => setForm({ ...form, periodLabel: e.target.value })} /></FormRow>
                <FormRow label="Agenda" htmlFor="o2o-agenda"><Input id="o2o-agenda" value={form.agenda} onChange={(e) => setForm({ ...form, agenda: e.target.value })} /></FormRow>
                <FormRow label="Scheduled at" htmlFor="o2o-when"><Input id="o2o-when" type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} /></FormRow>
              </div>
              <Button size="sm" onClick={() => void s.run(async () => {
                await tlApi.createOneToOne({ ...form, scheduledAt: new Date(form.scheduledAt).toISOString() });
                refresh(); return 'One-to-one scheduled — snapshot frozen; employee reflection requested.';
              })}>Schedule + request reflection</Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>One-to-ones</CardTitle></CardHeader>
          <CardContent>
            {!o2o ? <SkeletonRows rows={2} /> : (
              <ul className="divide-y divide-border text-sm" role="list">
                {o2o.reviews.map((r: any) => (
                  <li key={r.id} className="py-2">
                    <p className="font-medium">{r.employeeName} · {r.periodLabel} <Badge tone="default">snapshot v{r.snapshotVersion}</Badge></p>
                    <p className="text-xs text-muted-foreground">{r.agenda}</p>
                    {r.acknowledgedAt ? <Badge tone="completed">acknowledged</Badge> : <Badge tone="pending">awaiting acknowledgement</Badge>}
                    {r.disagreement ? <Badge tone="default">disagreement recorded</Badge> : null}
                    <DrawerPanel trigger={<Button size="sm" variant="outline" className="mt-1">Run review</Button>} title={`Run one-to-one (TL-12)`}>
                      <OneToOneForm reviewId={r.id} onSaved={(m) => { s.note = m; refresh(); }} />
                    </DrawerPanel>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader><CardTitle>Intern mentoring · TL-13</CardTitle></CardHeader>
        <CardContent>
          <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-5">
            <FormRow label="Intern" htmlFor="men-int">
              <Select id="men-int" value={internId} onChange={(e) => setInternId(e.target.value)}>
                <option value="EMP-002">Ravi Nair</option>
                <option value="EMP-001">Asha Rao</option>
              </Select>
            </FormRow>
            <FormRow label="Mentor" htmlFor="men-mnt">
              <Select id="men-mnt" value={mentorId} onChange={(e) => setMentorId(e.target.value)}>
                <option value="EMP-003">Tara Chand (TL)</option>
                <option value="EMP-001">Asha Rao (Senior)</option>
              </Select>
            </FormRow>
            <FormRow label="Work cap" htmlFor="men-cap">
              <Input id="men-cap" type="number" value={workCap} onChange={(e) => setWorkCap(Number(e.target.value))} />
            </FormRow>
            <FormRow label="Allowed products" htmlFor="men-prod">
              <Input id="men-prod" value={products} onChange={(e) => setProducts(e.target.value)} />
            </FormRow>
            <FormRow label="Review date" htmlFor="men-date">
              <Input id="men-date" type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} />
            </FormRow>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Mentorship assigns training oversight and product boundaries; it grants no elevated CRM roles or authorizations.
            </p>
            <Button size="sm" variant="outline" onClick={() => void s.run(async () => {
              await tlApi.createMentorship({
                internEmployeeId: internId,
                mentorEmployeeId: mentorId,
                workCap,
                allowedProducts: products.split(',').map((x) => x.trim()).filter(Boolean),
                reviewDate,
              });
              refresh(); return 'Mentorship created — scoped and dated; no role granted.';
            })}>Assign mentor</Button>
          </div>
          {!mentors ? <SkeletonRows rows={1} /> : (
            <ul className="mt-3 divide-y divide-border text-sm" role="list">
              {mentors.mentorships.map((m: any) => (
                <li key={m.id} className="flex items-center gap-2 py-1.5">
                  <span className="font-medium">{m.internName}</span>
                  <span className="text-muted-foreground">mentored by {m.mentorName} · cap {m.workCap} · review {m.reviewDate}</span>
                  <Badge tone={m.status === 'active' ? 'open' : 'none'}>{m.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function OneToOneForm({ reviewId, onSaved }: { reviewId: string; onSaved: (m: string) => void }) {
  const [strengths, setStrengths] = useState('');
  const [feedback, setFeedback] = useState('');
  const [commitment, setCommitment] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-3">
      {/* KPI Tiles Snapshot */}
      <div className="rounded-md border border-border bg-secondary/30 p-2.5 text-xs">
        <p className="mb-1.5 font-semibold text-foreground">Snapshot KPI metrics</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded border border-border bg-background p-1.5">
            <span className="block text-[10px] uppercase text-muted-foreground">Calls vs plan</span>
            <strong className="text-sm font-semibold text-foreground">42 / 50 (84%)</strong>
          </div>
          <div className="rounded border border-border bg-background p-1.5">
            <span className="block text-[10px] uppercase text-muted-foreground">Approved wins</span>
            <strong className="text-sm font-semibold text-foreground">5 wins (92% to target)</strong>
          </div>
          <div className="rounded border border-border bg-background p-1.5">
            <span className="block text-[10px] uppercase text-muted-foreground">Overdue breaches</span>
            <strong className="text-sm font-semibold text-foreground">0 breaches</strong>
          </div>
          <div className="rounded border border-border bg-background p-1.5">
            <span className="block text-[10px] uppercase text-muted-foreground">Active pipeline</span>
            <strong className="text-sm font-semibold text-foreground">18 open prospects</strong>
          </div>
        </div>
      </div>

      <FormRow label="Observed strengths & achievements" htmlFor="o2o-str">
        <Textarea
          id="o2o-str"
          rows={2}
          value={strengths}
          onChange={(e) => setStrengths(e.target.value)}
          placeholder="Key sales competencies, client empathy, or process consistency observed..."
        />
      </FormRow>

      <FormRow label="Feedback & coaching points (reviewer)" htmlFor="o2o-fb">
        <Textarea
          id="o2o-fb"
          rows={3}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Development opportunities and guidance for upcoming period..."
        />
      </FormRow>

      <FormRow label="Agreed commitment (action, owner + deadline)" htmlFor="o2o-com">
        <Input
          id="o2o-com"
          value={commitment}
          onChange={(e) => setCommitment(e.target.value)}
          placeholder="e.g. Complete 5 objection handling reviews by Friday (owner: associate)"
        />
      </FormRow>

      <p className="text-xs text-muted-foreground">
        Employee reflection and acknowledgement requested. Acknowledgement ≠ agreement (disagreements tracked separately).
      </p>

      <BusyButton busy={busy} onClick={async () => {
        setBusy(true);
        try {
          const finalFeedback = strengths ? `Strengths: ${strengths}\n\nCoaching: ${feedback}` : feedback;
          await tlApi.completeOneToOne(reviewId, {
            feedback: finalFeedback,
            privateNotes: 'Private reviewer note (not shown to employee).',
            commitments: [{ text: commitment || 'Maintain standard cadence', dueAt: new Date(Date.now() + 7 * 86400000).toISOString() }],
          });
          onSaved('Review completed — commitments tracked; acknowledgement ≠ agreement.');
        } finally { setBusy(false); }
      }}>Complete review + request acknowledgement</BusyButton>
    </div>
  );
}

// ─── TL-14/15 Requests & help ───
export function TlRequestsPage() {
  const [requests, load] = useLoad(() => tlApi.teamRequests());
  const s = useSubmit();
  const [form, setForm] = useState({
    category: 'capacity',
    severity: 'medium' as 'low' | 'medium' | 'high',
    request: '',
    businessReason: '',
    effectiveDate: '',
    impact: '',
    evidence: '',
    requestedDecision: '',
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Requests & help"
        subtitle="Staffing requests, moves, complaints and commercial escalations — submitting executes nothing · TL-14/15"
      />
      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}

      <Card>
        <CardHeader>
          <CardTitle>New request / escalation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FormRow label="Category / Request type" htmlFor="rq-cat">
              <Select
                id="rq-cat"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                <option value="capacity">Capacity increase (TL-14)</option>
                <option value="role-change">Role change / move (TL-14)</option>
                <option value="staffing">Staffing requisition (TL-14)</option>
                <option value="complaint">Customer complaint escalation (TL-15)</option>
                <option value="commercial-exception">Commercial exception (TL-15)</option>
                <option value="merge-request">Lead merge request</option>
              </Select>
            </FormRow>

            <FormRow label="Severity" htmlFor="rq-sev">
              <Select
                id="rq-sev"
                value={form.severity}
                onChange={(e) => setForm({ ...form, severity: e.target.value as 'low' | 'medium' | 'high' })}
              >
                <option value="low">Low — routine adjustment</option>
                <option value="medium">Medium — standard business priority</option>
                <option value="high">High — customer escalation / breach</option>
              </Select>
            </FormRow>

            <FormRow label="Requested decision" htmlFor="rq-dec">
              <Input
                id="rq-dec"
                value={form.requestedDecision}
                onChange={(e) => setForm({ ...form, requestedDecision: e.target.value })}
                placeholder="e.g. Manager exception approval"
              />
            </FormRow>

            <FormRow label="Effective date" htmlFor="rq-date">
              <Input
                id="rq-date"
                value={form.effectiveDate}
                onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })}
                placeholder="e.g. Immediate or 2026-10-15"
              />
            </FormRow>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormRow label="Request summary" htmlFor="rq-req">
              <Input
                id="rq-req"
                value={form.request}
                onChange={(e) => setForm({ ...form, request: e.target.value })}
                placeholder="Summary of request (min 3 characters)"
              />
            </FormRow>

            <FormRow label="Business impact" htmlFor="rq-imp">
              <Input
                id="rq-imp"
                value={form.impact}
                onChange={(e) => setForm({ ...form, impact: e.target.value })}
                placeholder="Impact on pipeline, capacity, or customer SLA"
              />
            </FormRow>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormRow label="Business reason" htmlFor="rq-why">
              <Textarea
                id="rq-why"
                rows={2}
                value={form.businessReason}
                onChange={(e) => setForm({ ...form, businessReason: e.target.value })}
                placeholder="Detailed business justification for the proposed change..."
              />
            </FormRow>

            <FormRow label="Evidence references (activity / lead / ticket)" htmlFor="rq-evi">
              <Textarea
                id="rq-evi"
                rows={2}
                value={form.evidence}
                onChange={(e) => setForm({ ...form, evidence: e.target.value })}
                placeholder="e.g. Lead #LEAD-WEALTH-01, Call recording #REC-482, Ticket #TCK-990"
              />
            </FormRow>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
            <p className="max-w-xl text-xs text-muted-foreground">
              Requesting a change grants no access. Approval and admin execution stay with Manager/HR; contact restrictions apply immediately regardless of the workflow.
            </p>
            <Button
              size="sm"
              disabled={!form.request.trim() || !form.businessReason.trim()}
              onClick={() =>
                void s.run(async () => {
                  const reasonWithEvidence = form.evidence.trim()
                    ? `${form.businessReason.trim()} [Evidence: ${form.evidence.trim()}]`
                    : form.businessReason.trim();
                  await tlApi.createTeamRequest({
                    category: form.category as any,
                    severity: form.severity,
                    request: form.request.trim(),
                    businessReason: reasonWithEvidence,
                    effectiveDate: form.effectiveDate.trim() || undefined,
                    impact: form.impact.trim() || undefined,
                    requestedDecision: form.requestedDecision.trim() || 'Manager review',
                  });
                  setForm({
                    category: 'capacity',
                    severity: 'medium',
                    request: '',
                    businessReason: '',
                    effectiveDate: '',
                    impact: '',
                    evidence: '',
                    requestedDecision: '',
                  });
                  load();
                  return 'Request submitted to Manager/HR — current assignments unchanged.';
                })
              }
            >
              Submit request
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Request tracker</CardTitle>
        </CardHeader>
        <CardContent>
          {!requests ? (
            <SkeletonRows rows={3} />
          ) : requests.requests.length === 0 ? (
            <EmptyState
              title="No requests"
              message="Staffing, move, complaint and escalation requests appear here."
            />
          ) : (
            <ul className="divide-y divide-border text-sm" role="list">
              {requests.requests.map((r: any) => (
                <li key={r.id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        tone={
                          r.status === 'pending'
                            ? 'pending'
                            : r.status === 'approved'
                            ? 'completed'
                            : 'none'
                        }
                      >
                        {r.status}
                      </Badge>
                      <Badge tone="default">{label(r.category)}</Badge>
                      <Badge
                        tone={
                          r.severity === 'high'
                            ? 'open'
                            : r.severity === 'medium'
                            ? 'default'
                            : 'none'
                        }
                      >
                        {r.severity ?? 'medium'} severity
                      </Badge>
                      <span className="font-semibold text-foreground">
                        {r.payload?.request ?? '—'}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      By {r.actorName} · {new Date(r.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="mt-2 grid grid-cols-1 gap-2 rounded-md border border-border bg-secondary/20 p-2.5 text-xs text-muted-foreground sm:grid-cols-3">
                    <div>
                      <span className="font-medium text-foreground">Requested decision: </span>
                      <span>{r.payload?.requestedDecision || 'Manager review'}</span>
                    </div>
                    <div>
                      <span className="font-medium text-foreground">Business impact: </span>
                      <span>{r.payload?.impact || 'Leads and targets'}</span>
                    </div>
                    <div>
                      <span className="font-medium text-foreground">Effective date: </span>
                      <span>{r.payload?.effectiveDate || 'Immediate'}</span>
                    </div>
                  </div>

                  {r.payload?.businessReason ? (
                    <p className="mt-2 text-xs text-foreground">
                      <span className="font-medium text-muted-foreground">Reason & Evidence: </span>
                      {r.payload.businessReason}
                    </p>
                  ) : null}

                  {r.decisionReason ? (
                    <div className="mt-2 rounded border border-border bg-background p-2 text-xs">
                      <span className="font-semibold text-foreground">Manager decision: </span>
                      <span className="text-muted-foreground">{r.decisionReason}</span>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── TL-16/17 Team reports ───
export function TlReportsPage() {
  const [schedules, load] = useLoad(() => tlApi.schedules());
  const s = useSubmit();

  // TL-16 Team Review Pack state
  const [packScope, setPackScope] = useState<'all' | 'alpha' | 'beta'>('all');
  const [packPeriod, setPackPeriod] = useState<'month' | 'quarter' | 'week'>('month');
  const [packSections, setPackSections] = useState({
    kpi: true,
    scorecard: true,
    exceptions: true,
  });

  // TL-17 Recurring Schedules state
  const [schedForm, setSchedForm] = useState({
    name: 'Team weekly review',
    scope: 'all' as 'all' | 'alpha' | 'beta',
    cadence: 'weekly-mon-09:00+05:30' as 'weekly-mon-09:00+05:30' | 'monthly-1st-09:00+05:30',
    period: 'weekly' as 'weekly' | 'monthly',
    recipients: 'EMP-003',
  });

  const getTeamIds = (scope: 'all' | 'alpha' | 'beta') => {
    if (scope === 'alpha') return ['TEAM-WEALTH-ALPHA'];
    if (scope === 'beta') return ['TEAM-WEALTH-BETA'];
    return ['TEAM-WEALTH-ALPHA', 'TEAM-WEALTH-BETA'];
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Team reports"
        subtitle="Review packs and recurring schedules · TL-16/17"
      />
      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}

      <Card>
        <CardHeader>
          <CardTitle>Team review pack (PDF export · TL-16)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Snapshot-bound export: recipient and current scope re-checked on generation and download.
            Appendix shares the summary cutoff and formula version.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FormRow label="Scope" htmlFor="pack-scope">
              <Select
                id="pack-scope"
                value={packScope}
                onChange={(e) => setPackScope(e.target.value as any)}
              >
                <option value="all">All granted teams (deduplicated union)</option>
                <option value="alpha">Team Wealth Alpha only</option>
                <option value="beta">Team Wealth Beta only</option>
              </Select>
            </FormRow>

            <FormRow label="Period" htmlFor="pack-per">
              <Select
                id="pack-per"
                value={packPeriod}
                onChange={(e) => setPackPeriod(e.target.value as any)}
              >
                <option value="month">Previous complete month</option>
                <option value="quarter">Previous complete quarter</option>
                <option value="week">Previous complete week</option>
              </Select>
            </FormRow>

            <FormRow label="Included sections" htmlFor="pack-sec">
              <div id="pack-sec" className="flex flex-wrap gap-2 pt-1 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={packSections.kpi}
                    onChange={(e) => setPackSections({ ...packSections, kpi: e.target.checked })}
                    className="rounded border-border text-primary"
                  />
                  <span>Team KPI roll-up</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={packSections.scorecard}
                    onChange={(e) => setPackSections({ ...packSections, scorecard: e.target.checked })}
                    className="rounded border-border text-primary"
                  />
                  <span>Member scorecards</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={packSections.exceptions}
                    onChange={(e) => setPackSections({ ...packSections, exceptions: e.target.checked })}
                    className="rounded border-border text-primary"
                  />
                  <span>Exceptions audit</span>
                </label>
              </div>
            </FormRow>

            <FormRow label="Delivery & access" htmlFor="pack-del">
              <div id="pack-del" className="pt-1.5 text-xs text-muted-foreground">
                <Badge tone="default">Protected report centre</Badge>
                <span className="block mt-0.5 text-[11px]">Direct encrypted PDF download</span>
              </div>
            </FormRow>
          </div>

          <div className="flex items-center justify-end pt-2">
            <Button
              size="sm"
              onClick={() =>
                void s.run(async () => {
                  const teamIds = getTeamIds(packScope);
                  const pack = await tlApi.teamPacks({ teamIds, period: packPeriod });
                  const { downloadFile } = await import('../lib/wealth-api');
                  await downloadFile(tlApi.teamPackDownloadPath(pack.id), 'finverse-team-pack.pdf');
                  return `Team pack generated (snapshot ${new Date(pack.snapshotAt).toLocaleTimeString()}, ${pack.metricVersion}) and downloaded.`;
                })
              }
            >
              Generate + download PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recurring report schedules (TL-17)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <FormRow label="Report name" htmlFor="sc-name">
              <Input
                id="sc-name"
                value={schedForm.name}
                onChange={(e) => setSchedForm({ ...schedForm, name: e.target.value })}
              />
            </FormRow>

            <FormRow label="Scope" htmlFor="sc-scope">
              <Select
                id="sc-scope"
                value={schedForm.scope}
                onChange={(e) => setSchedForm({ ...schedForm, scope: e.target.value as any })}
              >
                <option value="all">All granted teams</option>
                <option value="alpha">Team Wealth Alpha</option>
                <option value="beta">Team Wealth Beta</option>
              </Select>
            </FormRow>

            <FormRow label="Cadence" htmlFor="sc-cad">
              <Select
                id="sc-cad"
                value={schedForm.cadence}
                onChange={(e) => setSchedForm({ ...schedForm, cadence: e.target.value as any })}
              >
                <option value="weekly-mon-09:00+05:30">Monday, 09:00 IST</option>
                <option value="monthly-1st-09:00+05:30">1st of month, 09:00 IST</option>
              </Select>
            </FormRow>

            <FormRow label="Period" htmlFor="sc-per">
              <Select
                id="sc-per"
                value={schedForm.period}
                onChange={(e) => setSchedForm({ ...schedForm, period: e.target.value as any })}
              >
                <option value="weekly">Previous complete week</option>
                <option value="monthly">Previous month</option>
              </Select>
            </FormRow>

            <FormRow label="Recipients (internal)" htmlFor="sc-rec">
              <Input
                id="sc-rec"
                value={schedForm.recipients}
                onChange={(e) => setSchedForm({ ...schedForm, recipients: e.target.value })}
                placeholder="e.g. EMP-003, EMP-001"
              />
            </FormRow>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Delivery: </span>
              Protected report centre · recipient and owner permissions re-checked every run.
            </div>
            <Button
              size="sm"
              onClick={() =>
                void s.run(async () => {
                  const teamIds = getTeamIds(schedForm.scope);
                  const recipients = schedForm.recipients
                    .split(',')
                    .map((r) => r.trim())
                    .filter(Boolean);
                  await tlApi.createSchedule({
                    name: schedForm.name,
                    cadence: schedForm.cadence,
                    period: schedForm.period,
                    teamIds,
                    recipients: recipients.length > 0 ? recipients : ['EMP-003'],
                  });
                  load();
                  return 'Schedule saved — permissions are rechecked every run.';
                })
              }
            >
              Save schedule
            </Button>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Active schedules
            </p>
            {!schedules ? (
              <SkeletonRows rows={2} />
            ) : schedules.schedules.length === 0 ? (
              <EmptyState
                title="No schedules configured"
                message="Recurring report distributions appear here."
              />
            ) : (
              <ul className="divide-y divide-border text-sm" role="list">
                {schedules.schedules.map((sc: any) => (
                  <li key={sc.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground">{sc.name}</span>
                      <Badge tone={sc.status === 'active' ? 'open' : 'none'}>{sc.status}</Badge>
                      <Badge tone="default">{sc.cadence}</Badge>
                      <span className="text-xs text-muted-foreground">
                        Scope: {Array.isArray(sc.teamIds) ? sc.teamIds.join(', ') : 'Granted teams'} · Recipients: {Array.isArray(sc.recipients) ? sc.recipients.join(', ') : sc.recipients}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>Owner: {sc.ownerName}</span>
                      <span>·</span>
                      <span>Next: {new Date(sc.nextRunAt).toLocaleString()}</span>
                      {sc.lastError ? <Badge tone="none">Error: {sc.lastError}</Badge> : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            One version per period in the protected report centre; owner offboarded or grant expired suspends the schedule.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── TL Prospect Drill-down (Dedicated Management View · M1) ───
export function TlProspectDrillDownPage() {
  const { id = '' } = useParams();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [requests, setRequests] = useState<OutcomeRequestView[]>([]);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [denied, setDenied] = useState(false);
  const [tab, setTab] = useState<'summary' | 'timeline' | 'documents' | 'requests' | 'audit'>('summary');
  const s = useSubmit();

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    setDenied(false);
    try {
      const [detail, reqs, conv, docs, aud] = await Promise.all([
        api.lead(id),
        wealthApi.requests(id).catch(() => ({ requests: [] })),
        wealthApi.conversations(id).catch(() => ({ calls: [], messages: [] })),
        wealthApi.documents(id).catch(() => ({ documents: [] })),
        wealthApi.audit(id).catch(() => ({ audit: [] })),
      ]);
      setLead(detail);
      setRequests(reqs.requests);
      setCalls(conv.calls);
      setMessages(conv.messages);
      setDocuments(docs.documents);
      setAudit(aud.audit);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 403)) setDenied(true);
      else setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <SkeletonRows rows={6} />;
  if (denied) return <DeniedPanel title="Prospect outside TL scope" message="This prospect is outside your managed teams or does not exist." />;
  if (error || !lead) return <ErrorState onRetry={load} />;

  return (
    <div className="space-y-4">
      {/* Breadcrumb back to Management */}
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Link to="/management/team" className="hover:text-foreground">Management</Link>
        <span>/</span>
        <Link to="/management/workload" className="hover:text-foreground">Workload</Link>
        <span>/</span>
        <span className="font-semibold text-foreground">{lead.displayName} ({lead.id})</span>
      </nav>

      {/* Header with Management controls */}
      <PageHeader
        title={lead.displayName}
        subtitle={`TL Prospect Management View · ${lead.product} · ${lead.source} · Record version ${lead.recordVersion}`}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={load}>Refresh</Button>
            <DrawerPanel
              trigger={<Button size="sm">Assign corrective task</Button>}
              title={`Assign corrective task for ${lead.id}`}
            >
              <CorrectiveForm leadId={lead.id} onSaved={(msg) => { void s.run(async () => msg); load(); }} />
            </DrawerPanel>
          </div>
        }
      />

      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}

      {/* Key attributes ribbon */}
      <div className="flex flex-wrap items-center gap-2 border-y border-border py-2 text-xs">
        <Badge tone="default">{label(lead.stage)}</Badge>
        <span className="text-muted-foreground">ID:</span>
        <span className="font-mono font-semibold">{lead.id}</span>
        <span className="text-muted-foreground">· Owner:</span>
        <span className="font-medium text-foreground">{lead.ownerName || 'Unassigned'}</span>
        <span className="text-muted-foreground">· Team:</span>
        <span className="font-medium text-foreground">{lead.teamName || '—'}</span>
        <span className="text-muted-foreground">· Contact:</span>
        <span className="font-mono">{lead.phone}</span>
        {lead.email ? <span>· {lead.email}</span> : null}
        <span className="text-muted-foreground">· Lang:</span>
        <span>{lead.preferredLanguage}</span>
        <span className="ml-auto text-[11px] text-muted-foreground">Created {new Date(lead.createdAt).toLocaleDateString()}</span>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-border text-sm">
        {(['summary', 'timeline', 'documents', 'requests', 'audit'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`border-b-2 px-4 py-2 font-medium capitalize transition-colors ${
              tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'documents' ? `Documents (${documents.length})` : t === 'requests' ? `Requests (${requests.length})` : t === 'audit' ? `Audit (${audit.length})` : t}
          </button>
        ))}
      </div>

      {/* Tab Contents: NO Caller Operational Forms */}
      {tab === 'summary' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Profile & Demographics</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-border/50 py-1"><span className="text-muted-foreground">Full Name:</span><span className="font-medium">{lead.displayName}</span></div>
              <div className="flex justify-between border-b border-border/50 py-1"><span className="text-muted-foreground">Phone (Masked):</span><span className="font-mono">{lead.phone}</span></div>
              <div className="flex justify-between border-b border-border/50 py-1"><span className="text-muted-foreground">Email:</span><span>{lead.email || '—'}</span></div>
              <div className="flex justify-between border-b border-border/50 py-1"><span className="text-muted-foreground">Due Status:</span><span className="capitalize">{lead.dueStatus}</span></div>
              <div className="flex justify-between py-1"><span className="text-muted-foreground">Record Version:</span><span>v{lead.recordVersion}</span></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Assignment & Pipeline State</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-border/50 py-1"><span className="text-muted-foreground">Product:</span><span>{lead.product}</span></div>
              <div className="flex justify-between border-b border-border/50 py-1"><span className="text-muted-foreground">Source:</span><span>{lead.source}</span></div>
              <div className="flex justify-between border-b border-border/50 py-1"><span className="text-muted-foreground">Current Stage:</span><Badge tone="default">{label(lead.stage)}</Badge></div>
              <div className="flex justify-between border-b border-border/50 py-1"><span className="text-muted-foreground">Assigned Associate:</span><span className="font-medium">{lead.ownerName || 'Unassigned'}</span></div>
              <div className="flex justify-between py-1"><span className="text-muted-foreground">Managed Team:</span><span>{lead.teamName || '—'}</span></div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === 'timeline' ? (
        <Card>
          <CardHeader><CardTitle>Touchpoints & Timeline</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {lead.timeline.length === 0 ? <p className="text-xs text-muted-foreground">No events recorded.</p> : (
                <ul className="divide-y divide-border text-sm" role="list">
                  {lead.timeline.map((ev) => (
                    <li key={ev.id} className="py-2 space-y-0.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-foreground">{ev.actorName}</span>
                        <span className="text-muted-foreground">{new Date(ev.occurredAt).toLocaleString()}</span>
                      </div>
                      <p className="text-muted-foreground">{ev.note}</p>
                    </li>
                  ))}
                </ul>
              )}
              {calls.length > 0 ? (
                <div className="mt-4 pt-4 border-t border-border">
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Voice Calls ({calls.length})</h4>
                  <ul className="divide-y divide-border text-xs" role="list">
                    {calls.map((c) => (
                      <li key={c.id} className="py-1.5 flex items-center justify-between">
                        <div>
                          <span className="font-medium capitalize">{c.direction} call</span>
                          <span className="text-muted-foreground ml-2">({c.status} · {c.durationSeconds}s)</span>
                          {c.wrapupDisposition ? <Badge tone="default" className="ml-2">{c.wrapupDisposition}</Badge> : null}
                          {c.wrapupNote ? <p className="text-muted-foreground mt-0.5">{c.wrapupNote}</p> : null}
                        </div>
                        <span className="text-muted-foreground">{new Date(c.startedAt).toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {messages.length > 0 ? (
                <div className="mt-4 pt-4 border-t border-border">
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Messages ({messages.length})</h4>
                  <ul className="divide-y divide-border text-xs" role="list">
                    {messages.map((m) => (
                      <li key={m.id} className="py-1.5 flex items-center justify-between">
                        <div>
                          <span className="font-medium capitalize">{m.channel} ({m.direction})</span>
                          <span className="text-muted-foreground ml-2">· {m.status}</span>
                          <p className="text-muted-foreground mt-0.5">{m.body}</p>
                        </div>
                        <span className="text-muted-foreground">{new Date(m.createdAt).toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {tab === 'documents' ? (
        <Card>
          <CardHeader><CardTitle>Evidence & Uploaded Documents ({documents.length})</CardTitle></CardHeader>
          <CardContent>
            {documents.length === 0 ? <EmptyState title="No documents attached" message="Submitted evidence documents appear here for review." /> : (
              <ul className="divide-y divide-border text-sm" role="list">
                {documents.map((d) => (
                  <li key={d.id} className="py-2 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{d.filename}</p>
                      <p className="text-xs text-muted-foreground">
                        Type: <span className="font-medium">{d.documentType}</span> · Uploaded: {new Date(d.createdAt).toLocaleString()} · Status: <Badge tone="default">{d.validationStatus}</Badge>
                      </p>
                    </div>
                    <a
                      href={`/api/documents/${d.id}/download`}
                      download
                      className="text-xs font-semibold text-primary hover:underline ml-4"
                    >
                      Download →
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}

      {tab === 'requests' ? (
        <Card>
          <CardHeader><CardTitle>Outcome & Reopen Requests ({requests.length})</CardTitle></CardHeader>
          <CardContent>
            {requests.length === 0 ? <EmptyState title="No requests submitted" message="Outcome requests submitted for this lead appear here." /> : (
              <ul className="divide-y divide-border text-sm" role="list">
                {requests.map((r) => {
                  const p = (r.payload ?? {}) as Record<string, unknown>;
                  return (
                    <li key={r.id} className="py-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge tone={r.status === 'approved' ? 'open' : r.status === 'returned' ? 'pending' : r.status === 'rejected' ? 'overdue' : 'default'}>
                            {r.status}
                          </Badge>
                          <span className="font-semibold capitalize text-foreground">{r.type} request</span>
                          <span className="font-mono text-xs text-muted-foreground">({r.id})</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</span>
                      </div>
                      {/* Render typed conversion fields */}
                      {r.type === 'conversion' ? (
                        <div className="rounded bg-secondary/30 p-2 text-xs space-y-1">
                          {p.winMilestone ? <p><strong className="text-foreground">Win milestone:</strong> {String(p.winMilestone)}</p> : null}
                          {p.milestoneDate ? <p><strong className="text-foreground">Milestone date:</strong> {String(p.milestoneDate)}</p> : null}
                          {p.value !== undefined ? (
                            <p><strong className="text-foreground">Value:</strong> {String(p.currency ?? 'INR')} {Number(p.value).toLocaleString()}</p>
                          ) : null}
                          {p.evidenceRef ? <p><strong className="text-foreground">Evidence reference:</strong> {String(p.evidenceRef)}</p> : null}
                          {p.proposedCredit ? (
                            <p><strong className="text-foreground">Proposed credit splits:</strong> {Object.entries(p.proposedCredit as Record<string, number>).map(([m, pct]) => `${m}: ${pct}%`).join(', ')}</p>
                          ) : null}
                        </div>
                      ) : null}
                      {/* Render typed reopen fields */}
                      {r.type === 'reopen' ? (
                        <div className="rounded bg-secondary/30 p-2 text-xs space-y-1">
                          {p.reason ? <p><strong className="text-foreground">Reason:</strong> {String(p.reason)}</p> : null}
                          {p.newEvidence ? <p><strong className="text-foreground">New evidence:</strong> {String(p.newEvidence)}</p> : null}
                          {p.requestedNextStage ? <p><strong className="text-foreground">Requested stage:</strong> {String(p.requestedNextStage)}</p> : null}
                          {p.nextAction ? <p><strong className="text-foreground">Next action:</strong> {String(p.nextAction)}</p> : null}
                        </div>
                      ) : null}
                      {r.decisionReason ? (
                        <div className="border-l-2 border-primary/40 pl-2 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">Decision rationale:</span> {r.decisionReason}
                          {r.decisionEvidence && Object.keys(r.decisionEvidence).length > 0 ? (
                            <span className="block mt-0.5 text-[11px]">
                              Evidence verified: {JSON.stringify(r.decisionEvidence)}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}

      {tab === 'audit' ? (
        <Card>
          <CardHeader><CardTitle>Field-Level Audit Trail ({audit.length})</CardTitle></CardHeader>
          <CardContent>
            {audit.length === 0 ? <EmptyState title="No field modifications" message="Direct edits to customer fields are audited here." /> : (
              <ul className="divide-y divide-border text-xs" role="list">
                {audit.map((a) => (
                  <li key={a.id} className="py-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">{a.field}</span>
                      <span className="text-muted-foreground">{new Date(a.occurredAt).toLocaleString()} by {a.actorName}</span>
                    </div>
                    <p className="text-muted-foreground">
                      <span className="line-through text-destructive">{a.beforeValue || '(empty)'}</span> → <span className="font-medium text-primary">{a.afterValue}</span>
                    </p>
                    <p className="text-muted-foreground italic">Reason: {a.reason}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
