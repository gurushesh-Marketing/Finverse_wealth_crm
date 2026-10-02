'use client';

import { useState, useSyncExternalStore } from 'react';
import { cn } from '@/lib/utils';
import type { DocumentRecord, DocRequest, LeadTask } from '@/lib/repository/types';
import type {
  OutcomeSummary,
  WealthLeadActivity,
  WealthLeadRecord,
} from '@/lib/repository/wealth-record';

const TABS = ['Summary', 'Timeline', 'Tasks', 'Documents', 'Outcome'] as const;
type Tab = (typeof TABS)[number];

const TYPE_CHIP: Record<string, string> = {
  task: 'Scheduled',
  call: 'Call record',
  whatsapp: 'Message',
  note: 'Note',
  email: 'Email',
  meeting: 'Meeting',
};

const STAGE_LABEL: Record<string, string> = {
  'not-contacted': 'Not contacted',
  contacted: 'Contacted',
  'follow-up': 'Follow-up',
  qualified: 'Qualified',
  unqualified: 'Unqualified',
  converted: 'Converted',
  lost: 'Lost',
};

const EVIDENCE_LABEL: Record<string, string> = {
  simulated: 'Simulated',
  'self-reported': 'Self-reported',
  system: 'System',
};

const emptySubscribe = () => () => {};

export function WealthRecordTabs({
  lead,
  activities,
  tasks,
  documents,
  docRequests,
  outcome,
}: {
  lead: WealthLeadRecord;
  activities: WealthLeadActivity[];
  tasks: LeadTask[];
  documents: DocumentRecord[];
  docRequests: DocRequest[];
  outcome: OutcomeSummary;
}) {
  const [active, setActive] = useState<Tab>('Summary');
  // Hydration-safe "is mounted" flag (mirrors MobileNav): the server snapshot is
  // false and the client snapshot is true, so the first client render matches SSR
  // and data-hydrated flips only after hydration — by then the tab onClick
  // handlers are attached and keyboard activation is safe to test.
  const hydrated = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const openTasks = tasks.filter((t) => t.status === 'open').length;

  return (
    <section className="rounded-xl border border-border bg-card" data-hydrated={hydrated ? 'true' : 'false'}>
      <div role="tablist" aria-label="Prospect record sections" className="flex items-center gap-1 overflow-x-auto border-b border-border px-2">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={active === t}
            onClick={() => setActive(t)}
            className={cn(
              'border-b-2 whitespace-nowrap px-3 py-2 text-sm transition-colors',
              active === t
                ? 'border-accent font-semibold text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {active === 'Summary' ? (
        <div role="tabpanel" className="grid grid-cols-1 gap-x-8 gap-y-3 p-4 sm:grid-cols-2">
          <div className="space-y-2.5">
            {[
              ['Contact', lead.maskedPhone, 'Masked: revealed only during an authorised dial'],
              ...(lead.email ? [['Email', lead.email, '']] : []),
              ['Product', lead.product, ''],
              ['Source', `${lead.source}${lead.sourceDetail ? ` / ${lead.sourceDetail}` : ''}`, 'Intake provenance retained'],
              ['Next action', `${lead.nextAction} · ${new Date(lead.dueAt).toLocaleString()}`, ''],
            ].map(([label, value, note]) => (
              <div key={label as string}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
                <p className={cn('text-sm', label === 'Contact' || label === 'Next action' ? 'font-mono' : 'font-medium')}>
                  {value}
                </p>
                {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
              </div>
            ))}
          </div>
          <div className="space-y-2.5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Current owner</p>
              <p className="text-sm font-medium">{lead.ownerName} / {lead.ownerTeamName}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Ownership history</p>
              <ul className="mt-1 space-y-1">
                {lead.ownershipHistory.map((entry) => (
                  <li key={`${entry.ownerName}-${entry.from}`} className="text-sm">
                    <span className="font-medium">{entry.ownerName}</span>
                    <span className="text-muted-foreground"> / {entry.teamName} · from </span>
                    <span className="font-mono text-xs">{new Date(entry.from).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Contact permission</p>
              <p className="text-sm font-medium">{lead.contactPermission}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Preferred language</p>
              <p className="text-sm font-medium">{lead.preferredLanguage}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Outstanding tasks</p>
              <p className="text-sm font-medium">{openTasks}</p>
            </div>
          </div>
        </div>
      ) : null}

      {active === 'Timeline' ? (
        <div role="tabpanel" className="p-4">
          {activities.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No recorded activity yet.</p>
          ) : (
            <ol className="relative ml-2 space-y-4 border-l border-border pl-5">
              {activities.map((a) => (
                <li key={a.id} className="relative">
                  <span className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full bg-accent" aria-hidden="true" />
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-semibold">{a.subject}</span>
                    <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                      {TYPE_CHIP[a.type] ?? a.type}
                    </span>
                    <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {EVIDENCE_LABEL[a.evidenceStatus] ?? a.evidenceStatus}
                    </span>
                    <span className="ml-auto font-mono text-xs text-muted-foreground">
                      {new Date(a.eventAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{a.actor}</span>
                    {a.description ? ` · ${a.description}` : ''}
                  </p>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-4 border-t border-border pt-2 text-xs text-muted-foreground">
            Opening a record creates no activity and adds no sales credit.
          </p>
        </div>
      ) : null}

      {active === 'Tasks' ? (
        <div role="tabpanel" className="p-4">
          {tasks.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No open tasks.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  <th className="py-2 font-semibold">Status</th>
                  <th className="py-2 font-semibold">Task</th>
                  <th className="py-2 font-semibold">Priority</th>
                  <th className="py-2 text-right font-semibold">Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tasks.map((t) => (
                  <tr key={t.id}>
                    <td className="py-1.5">
                      <span className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-medium',
                        t.status === 'open' ? 'bg-accent/10 text-accent' : 'bg-muted text-muted-foreground'
                      )}>
                        {t.status}
                      </span>
                    </td>
                    <td className="py-1.5 font-medium">{t.title}</td>
                    <td className="py-1.5 text-muted-foreground">{t.priority}</td>
                    <td className="py-1.5 text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {new Date(t.dueAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}

      {active === 'Documents' ? (
        <div role="tabpanel" className="p-4">
          {docRequests.length > 0 && (
            <div className="mb-4 rounded-lg border border-border bg-background p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Document requests</p>
              <ul className="mt-1 space-y-1">
                {docRequests.map((r) => (
                  <li key={r.id} className="text-sm">
                    <span className="font-medium">{r.checklistVersion ?? 'Checklist'}</span>
                    <span className="text-muted-foreground"> · {r.status ?? 'pending'}</span>
                    {r.dueAt ? <span className="text-muted-foreground"> · due {new Date(r.dueAt).toLocaleDateString()}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {documents.length === 0 && docRequests.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No documents requested yet.</p>
          ) : documents.length === 0 ? null : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  <th className="py-2 font-semibold">File</th>
                  <th className="py-2 font-semibold">Type</th>
                  <th className="py-2 font-semibold">Version</th>
                  <th className="py-2 font-semibold">Scan status</th>
                  <th className="py-2 font-semibold">Review status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {documents.map((d) => (
                  <tr key={d.id}>
                    <td className="py-1.5">
                      <span className="font-mono text-xs">{d.id}</span>
                      <span className="ml-2 font-medium">{d.fileName}</span>
                    </td>
                    <td className="py-1.5 text-muted-foreground">{d.docType}</td>
                    <td className="py-1.5 text-muted-foreground">v{d.version}</td>
                    <td className="py-1.5">
                      {d.scanStatus === 'quarantined' ? (
                        <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                          Quarantined
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{d.scanStatus ?? 'pending'}</span>
                      )}
                    </td>
                    <td className="py-1.5 text-muted-foreground">{d.reviewStatus ?? 'pending'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}

      {active === 'Outcome' ? (
        <div role="tabpanel" className="p-4">
          <div className="mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Current stage</p>
            <span className="mt-1 inline-block rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
              {STAGE_LABEL[lead.stage] ?? lead.stage}
            </span>
          </div>
          <dl className="space-y-2">
            {[
              ['Qualification', outcome.qualification ? `${outcome.qualification.need ?? 'Recorded'} · ${outcome.qualification.checklistVersion ?? 'checklist'}` : 'Not yet recorded'],
              ['Conversion', outcome.conversion ? `${outcome.conversion.status ?? 'pending'}${outcome.conversion.value != null ? ` · ${outcome.conversion.currency ?? 'INR'} ${outcome.conversion.value}` : ''}` : 'Not yet recorded'],
              ['Loss', outcome.loss ? `${outcome.loss.reason ?? 'Recorded'}` : 'Not yet recorded'],
              ['Reopen', outcome.reopen ? `${outcome.reopen.status ?? 'pending'}${outcome.reopen.requestedStage ? ` · ${outcome.reopen.requestedStage}` : ''}` : 'Not yet recorded'],
            ].map(([label, value]) => (
              <div key={label as string} className="flex items-baseline gap-3">
                <dt className="w-32 shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</dt>
                <dd className="text-sm">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </section>
  );
}
