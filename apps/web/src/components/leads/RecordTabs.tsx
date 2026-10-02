'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { Lead, LeadActivity, LeadTask } from '@/lib/repository/types';

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

export function RecordTabs({
  lead,
  activities,
  tasks,
}: {
  lead: Lead;
  activities: LeadActivity[];
  tasks: LeadTask[];
}) {
  const [active, setActive] = useState<Tab>('Summary');

  return (
    <section className="rounded-xl border border-border bg-card">
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
              ['Contact', lead.maskedPhone, 'Masked: reveal requires authorised dial (out of scope)'],
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
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Current owner</p>
              <p className="text-sm font-medium">{lead.ownerName} / {lead.ownerTeamName}</p>
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
            Opening a record creates no activity and adds no sales credit. Corrections are appended, never silently rewritten.
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
        <div role="tabpanel" className="p-8 text-center">
          <p className="text-sm font-semibold">Document checklist placeholder</p>
          <p className="mt-1 text-sm text-muted-foreground">Document flows are out of scope for this milestone.</p>
        </div>
      ) : null}

      {active === 'Outcome' ? (
        <div role="tabpanel" className="p-8 text-center">
          <p className="text-sm font-semibold">Qualification and conversion placeholder</p>
          <p className="mt-1 text-sm text-muted-foreground">Outcome tracking is out of scope for this milestone.</p>
        </div>
      ) : null}
    </section>
  );
}
