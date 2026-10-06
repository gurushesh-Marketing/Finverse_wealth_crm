import { useEffect, useState } from 'react';
import type { AuditEntry, DocumentRecord, DocumentRequestRecord, MeetingRecord, ProposalRecord } from '@finverse/contracts';
import { ApiError } from '../../lib/api';
import { wealthApi, type OutcomeRequestView, type TaskView, downloadFile, docDownloadPath } from '../../lib/wealth-api';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { FieldError, Input, Label, Textarea } from '../ui/input';
import { Select } from '../ui/select';
import { Panel, FormRow, BusyButton, SimulatedChip, LiveStatus } from '../ui/panel';
import { SuccessNote, SkeletonRows, EmptyState } from '../ui/states';

export function fmt(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  async function run(fn: () => Promise<string | void>) {
    setBusy(true);
    setFailure(null);
    setErrors({});
    try {
      const message = await fn();
      setNote(message ?? 'Saved.');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VALIDATION_FAILED') setErrors(err.fieldErrors ?? {});
      else setFailure(err instanceof ApiError ? err.message : 'Could not be saved. Try again.');
    } finally {
      setBusy(false);
    }
  }
  return { busy, errors, failure, note, setNote, run };
}

/* SC-04 Edit details + audit history */
export function EditDetailsDrawer({ leadId, current, open, onClose, onSaved }: {
  leadId: string;
  current: { displayName: string; phone: string; email: string | null; preferredLanguage: string };
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({ displayName: current.displayName, phone: current.phone, email: current.email ?? '', preferredLanguage: current.preferredLanguage, reason: '' });
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const s = useSubmit();

  useEffect(() => {
    if (open) void wealthApi.audit(leadId).then((r) => setAudit(r.audit)).catch(() => undefined);
  }, [open, leadId]);

  return (
    <Panel open={open} onClose={onClose} title="Correct prospect information"
      footer={<BusyButton busy={s.busy} onClick={() => void s.run(async () => {
        const res = await wealthApi.correct(leadId, form);
        if (res.status === 'pending-review') {
          onSaved();
          return 'Identity change paused: possible duplicate. Submitted for review — original values retained.';
        }
        onSaved();
        return 'Changes saved and recorded in audit history.';
      })}>Save changes</BusyButton>}>
      <p className="mb-3 text-xs text-muted-foreground">Changes are recorded in audit history. Source attribution, vertical and ownership cannot be edited here.</p>
      <FormRow label="Display name" htmlFor="ed-name" error={s.errors.displayName?.[0]}>
        <Input id="ed-name" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
      </FormRow>
      <FormRow label="Phone (verified field)" htmlFor="ed-phone" error={s.errors.phone?.[0]}>
        <Input id="ed-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      </FormRow>
      <FormRow label="Email (optional)" htmlFor="ed-email" error={s.errors.email?.[0]}>
        <Input id="ed-email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </FormRow>
      <FormRow label="Preferred language" htmlFor="ed-lang" error={s.errors.preferredLanguage?.[0]}>
        <Input id="ed-lang" value={form.preferredLanguage} onChange={(e) => setForm({ ...form, preferredLanguage: e.target.value })} />
      </FormRow>
      <FormRow label="Correction reason (required)" htmlFor="ed-reason" error={s.errors.reason?.[0]}>
        <Textarea id="ed-reason" rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Customer correction" />
      </FormRow>
      {s.failure ? <p role="alert" className="mb-2 text-sm text-destructive">{s.failure}</p> : null}
      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}
      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium text-foreground">Audit history ({audit.length})</summary>
        <ul className="mt-2 space-y-2" role="list">
          {audit.map((a) => (
            <li key={a.id} className="text-xs text-muted-foreground">
              <span className="font-mono">{fmt(a.occurredAt)}</span> · {a.actorName} · <span className="text-foreground">{a.field}</span>: {a.beforeValue ?? '—'} → {a.afterValue ?? '—'} ({a.reason})
            </li>
          ))}
        </ul>
      </details>
    </Panel>
  );
}

/* SC-07 wrap-up drawer */
export function WrapUpDrawer({ callId, open, onClose, onSaved }: { callId: string | null; open: boolean; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ disposition: 'connected', needConfirmed: false, note: '', nextAction: '', dueAt: '' });
  const s = useSubmit();
  return (
    <Panel open={open} onClose={onClose} title="Call wrap-up" footer={<BusyButton busy={s.busy} onClick={() => void s.run(async () => {
      await wealthApi.wrapup(callId!, {
        disposition: form.disposition as 'connected',
        needConfirmed: form.needConfirmed,
        note: form.note,
        nextAction: form.nextAction || undefined,
        dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : undefined,
      });
      onSaved();
      return 'Wrap-up saved. Activity and next task updated (repeated saves count once).';
    })}>Save wrap-up</BusyButton>}>
      <div className="mb-3"><SimulatedChip /></div>
      <FormRow label="Disposition" htmlFor="wu-disp">
        <Select id="wu-disp" value={form.disposition} onChange={(e) => setForm({ ...form, disposition: e.target.value })}>
          <option value="connected">Connected</option>
          <option value="no-answer">No answer</option>
          <option value="busy">Busy</option>
          <option value="wrong-number">Wrong number</option>
          <option value="callback">Callback</option>
        </Select>
      </FormRow>
      <label className="mb-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.needConfirmed} onChange={(e) => setForm({ ...form, needConfirmed: e.target.checked })} />
        Need confirmed (Connected alone does not prove qualified need)
      </label>
      <FormRow label="Conversation note" htmlFor="wu-note" error={s.errors.note?.[0]}>
        <Textarea id="wu-note" rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Callback requested" />
      </FormRow>
      <FormRow label="Next action" htmlFor="wu-next" error={s.errors.nextAction?.[0]}>
        <Input id="wu-next" value={form.nextAction} onChange={(e) => setForm({ ...form, nextAction: e.target.value })} placeholder="Follow-up call" />
      </FormRow>
      <FormRow label="Due" htmlFor="wu-due" error={s.errors.dueAt?.[0]}>
        <Input id="wu-due" type="datetime-local" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} />
      </FormRow>
      {s.failure ? <p role="alert" className="mb-2 text-sm text-destructive">{s.failure}</p> : null}
      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}
    </Panel>
  );
}

/* SC-09 WhatsApp drawer */
export function WhatsAppDrawer({ leadId, open, onClose, onSaved }: { leadId: string; open: boolean; onClose: () => void; onSaved: () => void }) {
  const [template, setTemplate] = useState('Appointment reminder');
  const [body, setBody] = useState('Reminder: appointment tomorrow at 11:00. Secure link: https://example.test');
  const s = useSubmit();
  return (
    <Panel open={open} onClose={onClose} title="Send approved WhatsApp" footer={<BusyButton busy={s.busy} onClick={() => void s.run(async () => {
      const msg = await wealthApi.sendMessage(leadId, { template, language: 'English', variables: {}, bodyPreview: body });
      onSaved();
      return `Message queued (${msg.status}, ${msg.evidenceStatus}). Sent or delivered is not a successful contact.`;
    })}>Send</BusyButton>}>
      <div className="mb-3"><SimulatedChip /></div>
      <FormRow label="Approved template" htmlFor="wa-tpl" error={s.errors.template?.[0]}>
        <Select id="wa-tpl" value={template} onChange={(e) => setTemplate(e.target.value)}>
          <option>Appointment reminder</option>
          <option>Brochure follow-up</option>
          <option>Document checklist</option>
        </Select>
      </FormRow>
      <FormRow label="Customer-facing preview" htmlFor="wa-body">
        <Textarea id="wa-body" rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
      </FormRow>
      <div className="rounded-lg bg-secondary p-3 text-sm text-foreground">{body}</div>
      {s.failure ? <p role="alert" className="mt-2 text-sm text-destructive">{s.failure}</p> : null}
      {s.note ? <div className="mt-2"><SuccessNote>{s.note}</SuccessNote></div> : null}
    </Panel>
  );
}

/* SC-08 manual activity + SC-10 inbound (inline forms) */
export function ManualActivityForm({ leadId, onSaved }: { leadId: string; onSaved: () => void }) {
  const [form, setForm] = useState({ activityType: 'Manual voice call', occurredAt: '', outcome: 'Connected', durationMinutes: 5, reason: '', note: '' });
  const s = useSubmit();
  return (
    <div className="mb-4 rounded-lg border border-border p-3">
      <h3 className="mb-2 text-sm font-semibold text-foreground">Log manual activity (SC-08)</h3>
      <p className="mb-2 text-xs text-muted-foreground">Manual entries are self-reported and never counted as verified calls. Backdating window: 24h [ASSUMPTION].</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <FormRow label="Activity type" htmlFor="ma-type"><Input id="ma-type" value={form.activityType} onChange={(e) => setForm({ ...form, activityType: e.target.value })} /></FormRow>
        <FormRow label="Occurred at" htmlFor="ma-occ" error={s.errors.occurredAt?.[0]}><Input id="ma-occ" type="datetime-local" value={form.occurredAt} onChange={(e) => setForm({ ...form, occurredAt: e.target.value })} /></FormRow>
        <FormRow label="Outcome" htmlFor="ma-out"><Input id="ma-out" value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value })} /></FormRow>
        <FormRow label="Duration (minutes, self-reported)" htmlFor="ma-dur"><Input id="ma-dur" type="number" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })} /></FormRow>
      </div>
      <FormRow label="Reason for manual entry" htmlFor="ma-reason" error={s.errors.reason?.[0]}><Input id="ma-reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Provider outage" /></FormRow>
      <FormRow label="Note" htmlFor="ma-note" error={s.errors.note?.[0]}><Textarea id="ma-note" rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></FormRow>
      {s.failure ? <p role="alert" className="mb-2 text-sm text-destructive">{s.failure}</p> : null}
      {s.note ? <div className="mb-2"><SuccessNote>{s.note}</SuccessNote></div> : null}
      <BusyButton busy={s.busy} onClick={() => void s.run(async () => {
        await wealthApi.manualActivity(leadId, { ...form, occurredAt: new Date(form.occurredAt).toISOString() });
        onSaved();
        return 'Manual activity saved and labelled MANUAL.';
      })}>Save activity</BusyButton>
    </div>
  );
}

export function InboundForm({ leadId, onSaved }: { leadId: string; onSaved: () => void }) {
  const [form, setForm] = useState({ channel: 'whatsapp', intent: '', body: '' });
  const s = useSubmit();
  return (
    <div className="rounded-lg border border-border p-3">
      <h3 className="mb-2 text-sm font-semibold text-foreground">Handle inbound reply / missed call (SC-10)</h3>
      <FormRow label="Channel" htmlFor="in-ch">
        <Select id="in-ch" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
          <option value="whatsapp">WhatsApp reply</option>
          <option value="voice">Missed call</option>
          <option value="email">Email</option>
        </Select>
      </FormRow>
      <FormRow label="Customer intent" htmlFor="in-int" error={s.errors.intent?.[0]}><Input id="in-int" value={form.intent} onChange={(e) => setForm({ ...form, intent: e.target.value })} placeholder="Reschedule" /></FormRow>
      <FormRow label="Message / detail" htmlFor="in-body" error={s.errors.body?.[0]}><Textarea id="in-body" rows={2} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></FormRow>
      {s.failure ? <p role="alert" className="mb-2 text-sm text-destructive">{s.failure}</p> : null}
      {s.note ? <div className="mb-2"><SuccessNote>{s.note}</SuccessNote></div> : null}
      <BusyButton busy={s.busy} onClick={() => void s.run(async () => {
        const r = await wealthApi.inbound({ ...form, matchedLeadId: leadId, receivedAt: new Date().toISOString(), inboundKey: `in-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` });
        onSaved();
        return `Inbound recorded (${r.status}); next task routed to ${r.routedTo}.`;
      })}>Record inbound</BusyButton>
    </div>
  );
}

/* Tasks tab with SC-12/13/14 */
export function TasksTab({ leadId, canEdit, onSaved }: { leadId: string; canEdit: boolean; onSaved: () => void }) {
  const [tasks, setTasks] = useState<TaskView[] | null>(null);
  const [rescheduleFor, setRescheduleFor] = useState<TaskView | null>(null);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const s = useSubmit();
  const load = () => void wealthApi.tasks(leadId).then((r) => setTasks(r.tasks)).catch(() => setTasks([]));
  useEffect(load, [leadId]);

  return (
    <div>
      {s.note ? <div className="mb-2"><SuccessNote>{s.note}</SuccessNote></div> : null}
      {s.failure ? <p role="alert" className="mb-2 text-sm text-destructive">{s.failure}</p> : null}
      <div className="mb-2 flex justify-end">
        <Button size="sm" variant="outline" onClick={() => setMeetingOpen(true)}>Book meeting (SC-14)</Button>
      </div>
      {!tasks ? <SkeletonRows rows={2} /> : tasks.length === 0 ? (
        <EmptyState title="No follow-ups scheduled" message="Schedule one from the Summary tab." />
      ) : (
        <ul className="divide-y divide-border" role="list">
          {tasks.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="font-mono text-xs text-muted-foreground">{fmt(t.dueAt)}</span>
              {t.originalDueAt ? <span className="font-mono text-xs text-muted-foreground line-through">{fmt(t.originalDueAt)}</span> : null}
              <span className="text-sm font-medium">{t.action}</span>
              <span className="text-sm text-muted-foreground">{t.purpose}</span>
              <Badge tone={t.status === 'open' ? 'open' : t.status}>{t.status}</Badge>
              {t.reminders.map((r) => <Badge key={r.id} tone={r.status === 'sent' ? 'completed' : 'today'}>reminder {r.status}</Badge>)}
              {t.deferralCount > 0 ? <Badge tone="today">{t.deferralCount} deferrals</Badge> : null}
              {canEdit && t.status === 'open' ? (
                <span className="ml-auto flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => setRescheduleFor(t)}>Reschedule</Button>
                  <Button size="sm" onClick={() => void s.run(async () => {
                    await wealthApi.transition(t.id, { action: 'complete', outcome: 'Completed from record' });
                    load(); onSaved(); return 'Task completed.';
                  })}>Complete</Button>
                </span>
              ) : null}
              {canEdit && t.status !== 'open' ? (
                <Button size="sm" variant="ghost" className="ml-auto" onClick={() => void s.run(async () => {
                  await wealthApi.transition(t.id, { action: 'reopen' });
                  load(); onSaved(); return 'Task reopened (logged correction).';
                })}>Reopen</Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <RescheduleDrawer task={rescheduleFor} onClose={() => setRescheduleFor(null)} onSaved={() => { load(); onSaved(); }} />
      <MeetingDialog leadId={leadId} open={meetingOpen} onClose={() => setMeetingOpen(false)} onSaved={() => { load(); onSaved(); }} />
    </div>
  );
}

function RescheduleDrawer({ task, onClose, onSaved }: { task: TaskView | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ newDueAt: '', reason: '', customerInformed: false });
  const s = useSubmit();
  return (
    <Panel open={!!task} onClose={onClose} title="Reschedule follow-up (SC-12)" footer={<BusyButton busy={s.busy} onClick={() => void s.run(async () => {
      const r = await wealthApi.reschedule(task!.id, { ...form, newDueAt: new Date(form.newDueAt).toISOString() });
      onSaved();
      return r.status === 'pending-approval'
        ? 'Third deferral: TL approval requested. The original committed deadline stays active until approved.'
        : 'Rescheduled. Original deadline retained and reminders replaced.';
    })}>Save</BusyButton>}>
      {task ? (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            Original deadline: <span className="font-mono">{fmt(task.originalDueAt ?? task.dueAt)}</span> (kept for SLA history)
          </p>
          <FormRow label="New due" htmlFor="rs-due" error={s.errors.newDueAt?.[0]}>
            <Input id="rs-due" type="datetime-local" value={form.newDueAt} onChange={(e) => setForm({ ...form, newDueAt: e.target.value })} />
          </FormRow>
          <FormRow label="Reason" htmlFor="rs-reason" error={s.errors.reason?.[0]}>
            <Input id="rs-reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Customer requested" />
          </FormRow>
          <label className="mb-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.customerInformed} onChange={(e) => setForm({ ...form, customerInformed: e.target.checked })} />
            Customer informed
          </label>
          {s.failure ? <p role="alert" className="text-sm text-destructive">{s.failure}</p> : null}
          {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}
        </>
      ) : null}
    </Panel>
  );
}

function MeetingDialog({ leadId, open, onClose, onSaved }: { leadId: string; open: boolean; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ meetingType: 'Consultation', slotAt: '', location: 'Office', attendees: 'Prospect and advisor', agenda: '' });
  const s = useSubmit();
  return (
    <Panel open={open} onClose={onClose} title="Book meeting or visit (SC-14)" footer={<BusyButton busy={s.busy} onClick={() => void s.run(async () => {
      await wealthApi.bookMeeting(leadId, { ...form, slotAt: new Date(form.slotAt).toISOString() });
      onSaved();
      return 'Slot reserved and attendee task created. Invite delivery is SIMULATED.';
    })}>Book slot</BusyButton>}>
      <div className="mb-3"><SimulatedChip /></div>
      <FormRow label="Meeting type" htmlFor="mt-type"><Input id="mt-type" value={form.meetingType} onChange={(e) => setForm({ ...form, meetingType: e.target.value })} /></FormRow>
      <FormRow label="Slot" htmlFor="mt-slot" error={s.errors.slotAt?.[0]}><Input id="mt-slot" type="datetime-local" value={form.slotAt} onChange={(e) => setForm({ ...form, slotAt: e.target.value })} /></FormRow>
      <FormRow label="Location / approved link" htmlFor="mt-loc"><Input id="mt-loc" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></FormRow>
      <FormRow label="Attendees" htmlFor="mt-att"><Input id="mt-att" value={form.attendees} onChange={(e) => setForm({ ...form, attendees: e.target.value })} /></FormRow>
      <FormRow label="Agenda" htmlFor="mt-ag" error={s.errors.agenda?.[0]}><Textarea id="mt-ag" rows={2} value={form.agenda} onChange={(e) => setForm({ ...form, agenda: e.target.value })} /></FormRow>
      {s.failure ? <p role="alert" className="text-sm text-destructive">{s.failure}</p> : null}
      {s.note ? <SuccessNote>{s.note}</SuccessNote> : null}
    </Panel>
  );
}

/* Documents tab (SC-18/19) */
export function DocumentsTab({ leadId, onSaved }: { leadId: string; onSaved: () => void }) {
  const [docs, setDocs] = useState<DocumentRecord[] | null>(null);
  const [requests, setRequests] = useState<DocumentRequestRecord[]>([]);
  const [form, setForm] = useState({ documentType: 'ID proof', filename: '', mimeType: 'text/plain', content: '' });
  const [requestForm, setRequestForm] = useState({ checklist: 'V1 product version 2', requestedFiles: 'ID proof, Address proof', dueAt: '' });
  const s = useSubmit();
  const load = () => {
    void wealthApi.documents(leadId).then((r) => setDocs(r.documents)).catch(() => setDocs([]));
    void wealthApi.docRequests(leadId).then((r) => setRequests(r.requests)).catch(() => setRequests([]));
  };
  useEffect(load, [leadId]);

  return (
    <div>
      {s.note ? <div className="mb-2"><SuccessNote>{s.note}</SuccessNote></div> : null}
      {s.failure ? <p role="alert" className="mb-2 text-sm text-destructive">{s.failure}</p> : null}
      <div className="mb-4 rounded-lg border border-border p-3">
        <h3 className="mb-2 text-sm font-semibold">Request documents (SC-18)</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <FormRow label="Checklist" htmlFor="dr-cl"><Input id="dr-cl" value={requestForm.checklist} onChange={(e) => setRequestForm({ ...requestForm, checklist: e.target.value })} /></FormRow>
          <FormRow label="Requested files (comma separated)" htmlFor="dr-files"><Input id="dr-files" value={requestForm.requestedFiles} onChange={(e) => setRequestForm({ ...requestForm, requestedFiles: e.target.value })} /></FormRow>
          <FormRow label="Due" htmlFor="dr-due" error={s.errors.dueAt?.[0]}><Input id="dr-due" type="date" value={requestForm.dueAt} onChange={(e) => setRequestForm({ ...requestForm, dueAt: e.target.value })} /></FormRow>
        </div>
        <BusyButton size="sm" busy={s.busy} onClick={() => void s.run(async () => {
          const r = await wealthApi.createDocRequest(leadId, {
            checklist: requestForm.checklist,
            requestedFiles: requestForm.requestedFiles.split(',').map((x) => x.trim()).filter(Boolean),
            dueAt: new Date(requestForm.dueAt).toISOString(),
            reminderEnabled: true,
          });
          load();
          return `Request created. Upload token ${r.uploadToken} — link expires ${fmt(r.expiresAt)} (shown once; reissue rotates it).`;
        })}>Create request</BusyButton>
      </div>
      <div className="mb-4 rounded-lg border border-border p-3">
        <h3 className="mb-2 text-sm font-semibold">Upload evidence (SC-19)</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <FormRow label="Document type" htmlFor="up-type"><Input id="up-type" value={form.documentType} onChange={(e) => setForm({ ...form, documentType: e.target.value })} /></FormRow>
          <FormRow label="Filename" htmlFor="up-name"><Input id="up-name" value={form.filename} onChange={(e) => setForm({ ...form, filename: e.target.value })} placeholder="id-proof.txt" /></FormRow>
        </div>
        <FormRow label="File content (text demo; stored as a real file)" htmlFor="up-content">
          <Textarea id="up-content" rows={2} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
        </FormRow>
        <BusyButton size="sm" busy={s.busy} onClick={() => void s.run(async () => {
          const doc = await wealthApi.uploadDocument({
            leadId,
            documentType: form.documentType,
            filename: form.filename || 'upload.txt',
            mimeType: form.mimeType,
            contentBase64: btoa(form.content || 'empty'),
          });
          load(); onSaved();
          return `Uploaded v${doc.version} — scan: ${doc.scanStatus}, validation: ${doc.validationStatus} (uploaded evidence is not verified evidence).`;
        })}>Upload file</BusyButton>
      </div>
      <h3 className="mb-2 text-sm font-semibold">Evidence ({docs?.length ?? 0})</h3>
      {!docs ? <SkeletonRows rows={2} /> : docs.length === 0 ? (
        <EmptyState title="No evidence yet" message="Requested and uploaded files appear here." />
      ) : (
        <ul className="divide-y divide-border" role="list">
          {docs.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="text-sm font-medium">{d.filename}</span>
              <span className="font-mono text-xs text-muted-foreground">v{d.version} · {d.sizeBytes}B · {fmt(d.createdAt)}</span>
              <Badge tone={d.scanStatus === 'quarantined' ? 'quarantined' : d.scanStatus === 'clean' ? 'verified' : 'pending'}>scan: {d.scanStatus}</Badge>
              <Badge tone={d.validationStatus === 'accepted' ? 'verified' : d.validationStatus === 'rejected' ? 'overdue' : 'default'}>validation: {d.validationStatus}</Badge>
              {d.rejectReason ? <span className="text-xs text-destructive">{d.rejectReason}</span> : null}
              <span className="ml-auto flex gap-1">
                <Button size="sm" variant="outline" disabled={d.scanStatus === 'quarantined'} onClick={() => void downloadFile(docDownloadPath(d.id), d.filename).catch((e: Error) => s.setNote(e.message))}>Download</Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* Requests tab (SC-23/24/28) */
export function RequestsTab({ leadId, requests, onSaved }: { leadId: string; requests: OutcomeRequestView[]; onSaved: () => void }) {
  const [handoff, setHandoff] = useState({ reason: '', destination: 'Banking queue', customerPermission: '', note: '' });
  const [optOut, setOptOut] = useState({ request: 'Stop WhatsApp contact', source: 'Customer reply', channels: 'whatsapp', complaintNote: '' });
  const [help, setHelp] = useState({ requestType: 'blocker' as 'blocker' | 'metric-correction', recordReference: leadId, expectedCorrection: '', priority: 'normal' as 'low' | 'normal' | 'high' });
  const s = useSubmit();
  return (
    <div>
      {s.note ? <div className="mb-2"><SuccessNote>{s.note}</SuccessNote></div> : null}
      {s.failure ? <p role="alert" className="mb-2 text-sm text-destructive">{s.failure}</p> : null}
      <h3 className="mb-2 text-sm font-semibold">Requests (pending until an authorized decision-maker acts)</h3>
      {requests.length === 0 ? <EmptyState title="No requests" message="Handoff, opt-out and correction requests appear here." /> : (
        <ul className="mb-4 divide-y divide-border" role="list">
          {requests.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="font-mono text-xs text-muted-foreground">{fmt(r.createdAt)}</span>
              <Badge tone="default">{r.type}</Badge>
              <Badge tone={r.status === 'pending' ? 'pending' : r.status === 'approved' ? 'verified' : 'completed'}>{r.status}</Badge>
              {r.decisionReason ? <span className="text-xs text-muted-foreground">{r.decisionReason}</span> : <span className="text-xs text-muted-foreground">Awaiting review</span>}
            </li>
          ))}
        </ul>
      )}
      <div className="mb-4 rounded-lg border border-border p-3">
        <h4 className="mb-2 text-sm font-semibold">Request handoff / cross-vertical referral (SC-23)</h4>
        <FormRow label="Reason" htmlFor="ho-reason" error={s.errors.reason?.[0]}><Input id="ho-reason" value={handoff.reason} onChange={(e) => setHandoff({ ...handoff, reason: e.target.value })} placeholder="Different product need" /></FormRow>
        <FormRow label="Destination" htmlFor="ho-dest"><Input id="ho-dest" value={handoff.destination} onChange={(e) => setHandoff({ ...handoff, destination: e.target.value })} /></FormRow>
        <FormRow label="Customer permission evidence" htmlFor="ho-perm" error={s.errors.customerPermission?.[0]}><Input id="ho-perm" value={handoff.customerPermission} onChange={(e) => setHandoff({ ...handoff, customerPermission: e.target.value })} /></FormRow>
        <FormRow label="Handoff note (minimum necessary)" htmlFor="ho-note" error={s.errors.note?.[0]}><Textarea id="ho-note" rows={2} value={handoff.note} onChange={(e) => setHandoff({ ...handoff, note: e.target.value })} /></FormRow>
        <BusyButton size="sm" busy={s.busy} onClick={() => void s.run(async () => {
          await wealthApi.handoff(leadId, handoff); onSaved();
          return 'Handoff request submitted. You keep working this enquiry until acceptance.';
        })}>Submit handoff</BusyButton>
      </div>
      <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
        <h4 className="mb-2 text-sm font-semibold">Opt-out / contact complaint (SC-24)</h4>
        <FormRow label="Request" htmlFor="oo-req"><Input id="oo-req" value={optOut.request} onChange={(e) => setOptOut({ ...optOut, request: e.target.value })} /></FormRow>
        <FormRow label="Channels (comma separated: voice, whatsapp, sms, email)" htmlFor="oo-ch"><Input id="oo-ch" value={optOut.channels} onChange={(e) => setOptOut({ ...optOut, channels: e.target.value })} /></FormRow>
        <FormRow label="Complaint note (optional)" htmlFor="oo-note"><Textarea id="oo-note" rows={2} value={optOut.complaintNote} onChange={(e) => setOptOut({ ...optOut, complaintNote: e.target.value })} /></FormRow>
        <BusyButton size="sm" busy={s.busy} onClick={() => void s.run(async () => {
          await wealthApi.optOut(leadId, {
            request: optOut.request, source: optOut.source, receivedAt: new Date().toISOString(),
            channels: optOut.channels.split(',').map((x) => x.trim()).filter(Boolean) as ['voice'],
            complaintNote: optOut.complaintNote || undefined,
          });
          onSaved();
          return 'Suppression active immediately. Queued outbound cancelled; future voice/WhatsApp blocked.';
        })}>Record opt-out</BusyButton>
      </div>
      <div className="rounded-lg border border-border p-3">
        <h4 className="mb-2 text-sm font-semibold">Raise blocker / metric correction (SC-28)</h4>
        <FormRow label="Request type" htmlFor="hp-type">
          <Select id="hp-type" value={help.requestType} onChange={(e) => setHelp({ ...help, requestType: e.target.value as 'blocker' })}>
            <option value="blocker">Blocker</option>
            <option value="metric-correction">Metric correction</option>
          </Select>
        </FormRow>
        <FormRow label="Record reference" htmlFor="hp-ref" error={s.errors.recordReference?.[0]}><Input id="hp-ref" value={help.recordReference} onChange={(e) => setHelp({ ...help, recordReference: e.target.value })} /></FormRow>
        <FormRow label="Expected correction" htmlFor="hp-exp" error={s.errors.expectedCorrection?.[0]}><Textarea id="hp-exp" rows={2} value={help.expectedCorrection} onChange={(e) => setHelp({ ...help, expectedCorrection: e.target.value })} /></FormRow>
        <BusyButton size="sm" busy={s.busy} onClick={() => void s.run(async () => {
          await wealthApi.help(leadId, help); onSaved();
          return 'Request routed (TL/operations/finance/access by category). Pending until resolved.';
        })}>Submit request</BusyButton>
      </div>
    </div>
  );
}

export { useSubmit };
export type { MeetingRecord, ProposalRecord };

/* SC-06 call control (simulator) */
export function CallPanel({ leadId, onCallEnded }: { leadId: string; onCallEnded: () => void }) {
  const [callId, setCallId] = useState<string | null>(null);
  const [state, setState] = useState('idle');
  const s = useSubmit();
  const nextStates: Record<string, string[]> = {
    connecting: ['ringing', 'failed'],
    ringing: ['connected', 'no-answer', 'failed'],
    connected: ['ended'],
  };
  return (
    <div className="rounded-lg border border-border p-3">
      <h3 className="mb-2 text-sm font-semibold">Place voice call (SC-06)</h3>
      <div className="mb-2"><SimulatedChip /></div>
      <LiveStatus>Call state: {state === 'idle' ? 'ready' : state}. SIMULATED, no provider integration.</LiveStatus>
      <div className="mt-2 flex flex-wrap gap-2">
        {!callId ? (
          <BusyButton size="sm" busy={s.busy} onClick={() => void s.run(async () => {
            const call = await wealthApi.startCall(leadId, { mode: 'Approved business line', idempotencyKey: `ui-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` });
            setCallId(call.id);
            setState(call.status);
            return undefined as unknown as void;
          })}>Start call</BusyButton>
        ) : (nextStates[state] ?? []).map((next) => (
          <Button key={next} size="sm" variant={next === 'ended' || next === 'failed' || next === 'no-answer' ? 'outline' : 'default'} onClick={() => void s.run(async () => {
            const updated = await wealthApi.callState(callId, next);
            setState(updated.status);
            if (['ended', 'failed', 'no-answer'].includes(updated.status)) onCallEnded();
            return undefined as unknown as void;
          })}>{next}</Button>
        ))}
      </div>
      {s.failure ? <p role="alert" className="mt-2 text-sm text-destructive">{s.failure}</p> : null}
    </div>
  );
}
