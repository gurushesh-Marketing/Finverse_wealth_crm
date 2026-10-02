import Link from 'next/link';
import { resolveWorkspaceSession } from '@/lib/auth/session';
import { leadRepository } from '@/lib/repository/db-repository';
import { hasVertical } from '@/lib/session';

export const metadata = { title: 'My day — Finverse CRM' };

const STAGE_FLOW: Array<{ key: string; label: string }> = [
  { key: 'not-contacted', label: 'Not contacted' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'unqualified', label: 'Unqualified' },
  { key: 'converted', label: 'Converted' },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">{children}</p>;
}

export default async function BankingDashboard() {
  const resolved = await resolveWorkspaceSession();
  if (!resolved || !hasVertical(resolved.session, 'banking')) {
    return (
      <div role="alert" className="rounded-xl border border-border bg-card p-6">
        <h1 className="font-heading text-lg font-semibold">Access denied</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This workspace is outside your granted verticals. You are signed in for{' '}
          {resolved ? resolved.session.verticalGrants.join(', ') : 'no vertical'}.
        </p>
        <Link href="/" className="mt-4 inline-block text-sm font-medium text-accent underline-offset-4 hover:underline">
          Return to your workspace
        </Link>
      </div>
    );
  }

  const { user, session } = resolved;
  const counts = await leadRepository.getQueueCounts(session);
  const leads = await leadRepository.getLeads(session, { sortBy: 'due-asc' });
  const top = leads.items[0];
  const stageCounts = STAGE_FLOW.map((s) => ({
    ...s,
    count: leads.items.filter((l) => l.stage === s.key).length,
  }));
  const openTasks = leads.items.length; // one open follow-up max per lead in this slice

  return (
    <div className="space-y-4">
      {/* Page header (deck reference 006) */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>Personal workspace / Banking</Eyebrow>
          <h1 className="mt-1 font-heading text-3xl font-bold tracking-tight text-foreground">
            Your next conversation starts here.
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Banking — My day · a clear path through today&apos;s assigned leads, promised follow-ups and customer context.
          </p>
        </div>
        <span className="rounded-full border border-border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Banking scope
        </span>
      </div>

      {/* Tab row (real destinations only) */}
      <div className="flex items-center gap-1 border-b border-border" role="navigation" aria-label="Workspace views">
        <span className="border-b-2 border-accent px-3 py-2 text-sm font-semibold text-foreground">My day</span>
        <Link href="/banking/clients" className="border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
          Lead Inbox
        </Link>
      </div>

      {/* Priority + KPI band (deck reference 006) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-xl bg-primary p-5 text-primary-foreground lg:col-span-1">
          <Eyebrow>Your priority</Eyebrow>
          <h2 className="mt-3 font-heading text-xl font-bold tracking-tight">Next best action</h2>
          <p className="mt-1 text-sm text-primary-foreground/85">
            {top
              ? `${top.nextAction} — ${top.displayName} before new outreach.`
              : 'No open work. Check the assigned lead queue.'}
          </p>
          {top ? (
            <Link
              href={`/banking/clients/${top.id}`}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-card px-4 py-1.5 text-sm font-semibold text-primary hover:bg-card/90"
            >
              Open work area <span aria-hidden="true">→</span>
            </Link>
          ) : null}
          <p className="mt-6 text-[10px] uppercase tracking-[0.12em] text-primary-foreground/60">
            As of {new Date().toLocaleTimeString()} · Assigned scope only
          </p>
        </section>

        <div className="space-y-4 lg:col-span-2">
          <div className="grid grid-cols-2 rounded-xl border border-border bg-card sm:grid-cols-4">
            {[
              { label: 'Do today', value: counts.dueToday, note: 'before promised tasks', warn: false },
              { label: 'Overdue', value: counts.overdue, note: 'needs action first', warn: counts.overdue > 0 },
              { label: 'Pipeline', value: counts.total, note: 'assigned leads', warn: false },
              { label: 'Done vs goal', value: `${counts.total - counts.overdue} / ${counts.total}`, note: 'on-time commitments', warn: false },
            ].map((c, i) => (
              <div key={c.label} className={`p-4 ${i > 0 ? 'border-t border-border sm:border-t-0 sm:border-l' : ''}`}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{c.label}</p>
                <p className={`mt-1 font-heading text-2xl font-bold tabular-nums ${c.warn ? 'text-destructive' : 'text-foreground'}`}>
                  {c.value}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{c.note}</p>
              </div>
            ))}
          </div>

          <section className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <div>
                <Eyebrow>Needs attention</Eyebrow>
                <h2 className="text-sm font-semibold">Where to act next</h2>
              </div>
            </div>
            <ul className="divide-y divide-border">
              {[
                { n: counts.overdue, title: 'Promised callbacks', note: 'overdue commitments', href: '/banking/clients?due=overdue' },
                { n: counts.dueToday, title: 'Due today', note: 'scheduled for today', href: '/banking/clients?due=today' },
                { n: openTasks, title: 'Assigned leads open', note: 'full assigned workload', href: '/banking/clients' },
              ].map((r) => (
                <li key={r.title}>
                  <Link href={r.href} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50">
                    <span className="w-8 font-heading text-xl font-bold tabular-nums text-accent">
                      {String(r.n).padStart(2, '0')}
                    </span>
                    <span className="text-sm font-semibold">{r.title}</span>
                    <span className="text-xs text-muted-foreground">{r.note}</span>
                    <span aria-hidden="true" className="ml-auto text-muted-foreground">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      {/* Assigned work table (deck reference 006/007) */}
      <section className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <div>
            <Eyebrow>Your assigned work</Eyebrow>
            <h2 className="text-sm font-semibold">Today&apos;s commitments</h2>
          </div>
          <Link href="/banking/clients" className="text-sm font-semibold text-accent hover:underline underline-offset-4">
            View all <span aria-hidden="true">→</span>
          </Link>
        </div>
        {leads.items.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">No work due. Check filters in the assigned lead queue.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <th className="px-4 py-2 font-semibold">Lead ID</th>
                <th className="px-4 py-2 font-semibold">Prospect</th>
                <th className="px-4 py-2 font-semibold">Context</th>
                <th className="px-4 py-2 text-right font-semibold">Due</th>
                <th className="w-8 px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {leads.items.slice(0, 5).map((lead) => (
                <tr key={lead.id} className="hover:bg-muted/50">
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{lead.id}</td>
                  <td className="px-4 py-2 font-semibold">{lead.displayName}</td>
                  <td className="px-4 py-2 text-muted-foreground">{lead.nextAction} · {lead.product}</td>
                  <td className={`px-4 py-2 text-right tabular-nums ${lead.isOverdue ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>
                    {lead.isOverdue ? 'Overdue · ' : ''}{new Date(lead.dueAt).toLocaleString()}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <Link href={`/banking/clients/${lead.id}`} aria-label="Open record" className="text-muted-foreground hover:text-accent">
                      <span aria-hidden="true">›</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
          Only assigned Banking enquiries appear. A transfer changes this queue at its effective time. Illustrative values · current permission scope.
        </p>
      </section>

      {/* Below-fold modules (deck reference 007) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <Eyebrow>Opportunity flow</Eyebrow>
              <h2 className="text-sm font-semibold">Banking pipeline</h2>
            </div>
            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Illustrative stages
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {stageCounts.map((s, i) => (
              <div key={s.key} className="border-t-2 border-accent/60 pt-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {String(i + 1).padStart(2, '0')}
                </p>
                <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
                <p className="mt-0.5 font-heading text-2xl font-bold tabular-nums">{s.count}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            [ASSUMPTION] Product stage vocabulary follows the deck&apos;s Banking flow (New → Eligibility → Documents → Sanction → Disbursal) once business policy is confirmed; counts use current fixture stages.
          </p>
        </section>

        <section className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <div>
              <Eyebrow>Shortcuts</Eyebrow>
              <h2 className="text-sm font-semibold">Continue the work</h2>
            </div>
          </div>
          <ul className="divide-y divide-border">
            {[
              { title: 'Review overdue commitments first', href: '/banking/clients?due=overdue' },
              { title: 'Filter, search and scan the lead view', href: '/banking/clients' },
              ...(top ? [{ title: 'Open a prospect and inspect the full record', href: `/banking/clients/${top.id}` }] : []),
            ].map((s) => (
              <li key={s.title}>
                <Link href={s.href} className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-muted/50">
                  <span className="text-accent" aria-hidden="true">+</span>
                  <span>{s.title}</span>
                  <span aria-hidden="true" className="ml-auto text-muted-foreground">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Full-width CTA strip (deck reference 007) */}
      <Link
        href="/banking/clients"
        className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-3.5 text-sm font-semibold hover:bg-muted/50"
      >
        Open assigned lead queue
        <span aria-hidden="true">→</span>
      </Link>

      <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        Illustrative values · current permission scope · as of {new Date().toLocaleTimeString()} · {user.teamName}
      </p>
    </div>
  );
}
