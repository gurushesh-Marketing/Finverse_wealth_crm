import Link from 'next/link';
import { redirect } from 'next/navigation';
import { resolveWorkspaceSession } from '@/lib/auth/session';
import { hasVertical } from '@/lib/session';
import { getMyDay, type MyDayLead } from '@/lib/repository/wealth-myday';
import { AvailabilityControl } from './AvailabilityControl';
import { ProviderSimulator } from './ProviderSimulator';

export const metadata = { title: 'My day — Finverse CRM' };

const STAGE_FLOW: Array<{ key: string; label: string }> = [
  { key: 'not-contacted', label: 'Not contacted' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'follow-up', label: 'Follow-up' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'unqualified', label: 'Unqualified' },
  { key: 'converted', label: 'Converted' },
  { key: 'lost', label: 'Lost' },
];

const ACTIVE_STAGES = new Set(['not-contacted', 'contacted', 'follow-up', 'qualified']);

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">{children}</p>;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtDue(iso: string): string {
  return new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function isDueToday(iso: string): boolean {
  const d = new Date(iso);
  const start = startOfToday();
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return d >= start && d < end;
}

export default async function WealthDashboardPage() {
  const resolved = await resolveWorkspaceSession();
  if (!resolved) redirect('/login');

  if (!resolved.user.hasActiveAssignment) {
    return (
      <div role="alert" className="rounded-xl border border-border bg-card p-6">
        <Eyebrow>Personal workspace / Wealth</Eyebrow>
        <h1 className="mt-1 font-heading text-2xl font-bold tracking-tight text-foreground">Access pending</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          No active assignment — access pending. Contact your administrator.
        </p>
      </div>
    );
  }

  if (!hasVertical(resolved.session, 'wealth')) {
    return (
      <div role="alert" className="rounded-xl border border-border bg-card p-6">
        <h1 className="font-heading text-lg font-semibold">Access denied</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This workspace is outside your granted verticals. You are signed in for{' '}
          {resolved.session.verticalGrants.join(', ') || 'no vertical'}.
        </p>
        <Link href="/" className="mt-4 inline-block text-sm font-medium text-accent underline-offset-4 hover:underline">
          Return to your workspace
        </Link>
      </div>
    );
  }

  const { user, session } = resolved;
  const data = await getMyDay(session);

  const activeLeads = data.leads.filter((l) => ACTIVE_STAGES.has(l.stage));
  const overdueTasks = data.tasks.filter((t) => t.isOverdue);
  const priorityLead: MyDayLead | null = activeLeads[0] ?? null;
  const priorityTask = overdueTasks[0] ?? null;
  const priorityHref = priorityTask
    ? `/wealth/prospects/${priorityTask.leadId}`
    : priorityLead
      ? `/wealth/prospects/${priorityLead.id}`
      : null;
  const priorityCopy = priorityTask
    ? `${priorityTask.title} — ${priorityTask.leadName} before new outreach.`
    : priorityLead
      ? `${priorityLead.nextAction} — ${priorityLead.displayName} before new outreach.`
      : 'No open work. Check the assigned lead queue.';

  const overdueWorkCount = data.counts.overdue + overdueTasks.length;
  const newLeadDeadlines = activeLeads.filter(
    (l) => new Date(l.dueAt).getTime() >= startOfToday().getTime()
  ).length;

  const stageCounts = STAGE_FLOW.map((s) => ({
    ...s,
    count: data.leads.filter((l) => l.stage === s.key).length,
  }));

  const commitments = [
    ...activeLeads
      .filter((l) => l.isOverdue || isDueToday(l.dueAt))
      .map((l) => ({
        leadId: l.id,
        prospect: l.displayName,
        context: `${l.nextAction} · ${l.product}`,
        dueAt: l.dueAt,
        isOverdue: l.isOverdue,
      })),
    ...data.tasks
      .filter((t) => t.isOverdue || isDueToday(t.dueAt))
      .map((t) => ({
        leadId: t.leadId,
        prospect: t.leadName,
        context: t.title,
        dueAt: t.dueAt,
        isOverdue: t.isOverdue,
      })),
  ].sort((a, b) => a.dueAt.localeCompare(b.dueAt));

  const todayLabel = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>Personal workspace / Wealth</Eyebrow>
          <h1 className="mt-1 font-heading text-3xl font-bold tracking-tight text-foreground">
            Start the day and prioritise work.
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Wealth — My day · Today, {todayLabel} · overdue first, then promised follow-ups and new deadlines.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className="rounded-full border border-border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            My active assignment · Overdue first
          </span>
          <span className="text-xs font-semibold text-muted-foreground">As of {fmtTime(data.asOf)}</span>
        </div>
      </div>

      {/* Tab row (real destinations only) */}
      <div className="flex items-center gap-1 border-b border-border" role="navigation" aria-label="Workspace views">
        <span className="border-b-2 border-accent px-3 py-2 text-sm font-semibold text-foreground">My day</span>
        <Link href="/wealth/prospects" className="border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
          Lead Inbox
        </Link>
      </div>

      {/* Priority + KPI band + work review */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-xl bg-primary p-5 text-primary-foreground lg:col-span-1">
          <Eyebrow>Your priority</Eyebrow>
          <h2 className="mt-3 font-heading text-xl font-bold tracking-tight">Next best action</h2>
          <p className="mt-1 text-sm text-primary-foreground/85">{priorityCopy}</p>
          {priorityHref ? (
            <Link
              href={priorityHref}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-card px-4 py-1.5 text-sm font-semibold text-primary hover:bg-card/90"
            >
              Open work area <span aria-hidden="true">→</span>
            </Link>
          ) : null}
          <p className="mt-6 text-[10px] uppercase tracking-[0.12em] text-primary-foreground/60">
            As of {fmtTime(data.asOf)} · Assigned scope only
          </p>
        </section>

        <div className="space-y-4 lg:col-span-2">
          <div className="grid grid-cols-2 rounded-xl border border-border bg-card sm:grid-cols-3 lg:grid-cols-5">
            {[
              { label: 'Active assigned leads', value: data.counts.activeAssigned, note: 'assigned scope', warn: false },
              { label: 'Due today', value: data.counts.dueToday, note: 'scheduled today', warn: false },
              { label: 'Overdue', value: data.counts.overdue, note: 'needs action first', warn: data.counts.overdue > 0 },
              { label: 'Open tasks', value: data.counts.openTasks, note: 'across my leads', warn: false },
            ].map((c, i) => (
              <div key={c.label} className={`p-4 ${i > 0 ? 'border-t border-border sm:border-t-0 sm:border-l' : ''}`}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{c.label}</p>
                <p className={`mt-1 font-heading text-2xl font-bold tabular-nums ${c.warn ? 'text-destructive' : 'text-foreground'}`}>
                  {c.value}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{c.note}</p>
              </div>
            ))}
            <div className="p-4 border-t border-border sm:border-t-0 sm:border-l">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Verified activity and approved outcomes only
              </p>
              <p className="mt-1 font-heading text-2xl font-bold tabular-nums text-foreground" data-testid="verified-activity-count">{data.counts.verifiedActivity}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">SIMULATED provider</p>
              {data.providerStatus === 'delayed' ? (
                <p className="mt-2 inline-flex items-center rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent" data-testid="stale-data-badge">
                  Stale data — last verified as of {data.lastVerifiedAt ? fmtTime(data.lastVerifiedAt) : '—'}
                </p>
              ) : null}
            </div>
          </div>

          <section className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <div>
                <Eyebrow>Work review</Eyebrow>
                <h2 className="text-sm font-semibold">Prioritise the queue</h2>
              </div>
            </div>
            <ul className="divide-y divide-border">
              {[
                { n: overdueWorkCount, title: 'Overdue', note: 'tasks and leads past due', href: '/wealth/prospects?due=overdue' },
                { n: data.counts.promisedCallbacks, title: 'Promised callbacks', note: 'follow-ups due today or overdue', href: '/wealth/prospects?due=overdue' },
                { n: newLeadDeadlines, title: 'New lead deadlines', note: 'due today or upcoming', href: '/wealth/prospects?due=today' },
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

      {/* Needs attention */}
      <section className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <div>
            <Eyebrow>Needs attention</Eyebrow>
            <h2 className="text-sm font-semibold">Where to act next</h2>
          </div>
        </div>
        <ul className="divide-y divide-border">
          {[
            { n: data.counts.promisedCallbacks, title: 'Promised callbacks', note: 'call before new outreach', href: '/wealth/prospects?due=overdue' },
            { n: data.counts.uncontactedToday, title: 'Uncontacted today', note: 'stage: not contacted', href: '/wealth/prospects?stage=not-contacted' },
            { n: data.counts.repliesToReview, title: 'Replies to review', note: 'inbound, unhandled', href: '/wealth/prospects?replies=1' },
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

      {/* Today's commitments table */}
      <section className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <div>
            <Eyebrow>Your assigned work</Eyebrow>
            <h2 className="text-sm font-semibold">Today&apos;s commitments</h2>
          </div>
          <Link href="/wealth/prospects" className="text-sm font-semibold text-accent hover:underline underline-offset-4">
            View all <span aria-hidden="true">→</span>
          </Link>
        </div>
        {commitments.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">No commitments due today or overdue.</p>
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
              {commitments.slice(0, 8).map((c) => (
                <tr key={`${c.leadId}-${c.dueAt}-${c.context}`} className="hover:bg-muted/50">
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{c.leadId}</td>
                  <td className="px-4 py-2 font-semibold">{c.prospect}</td>
                  <td className="px-4 py-2 text-muted-foreground">{c.context}</td>
                  <td className={`px-4 py-2 text-right tabular-nums ${c.isOverdue ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>
                    {c.isOverdue ? 'Overdue · ' : ''}{fmtDue(c.dueAt)}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <Link href={`/wealth/prospects/${c.leadId}`} aria-label="Open record" className="text-muted-foreground hover:text-accent">
                      <span aria-hidden="true">›</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
          Only assigned Wealth leads and open tasks appear. A transfer changes this queue at its effective time. Illustrative values · current permission scope.
        </p>
      </section>

      {/* Availability */}
      <AvailabilityControl current={data.availability} />

      {/* Opportunity flow + shortcuts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <Eyebrow>Opportunity flow</Eyebrow>
              <h2 className="text-sm font-semibold">Wealth pipeline</h2>
            </div>
            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Illustrative stages
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
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
            [ASSUMPTION] Wealth stage vocabulary follows the Wealth flow (Not contacted → Contacted → Follow-up → Qualified → Converted) once business policy is confirmed; counts use current fixture stages.
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
              { title: 'Review overdue commitments first', href: '/wealth/prospects?due=overdue' },
              { title: 'Filter, search and scan the lead view', href: '/wealth/prospects' },
              ...(priorityHref ? [{ title: 'Open a prospect and inspect the full record', href: priorityHref }] : []),
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
          <p className="border-t border-border px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            28 defined actions · assigned scope only
          </p>
        </section>
      </div>

      {/* Footer strip: provider simulator + disclaimers */}
      <footer className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-5 py-3">
        <ProviderSimulator initialStatus={data.providerStatus} />
        <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          Illustrative values · current permission scope · as of {fmtTime(data.asOf)} · {user.teamName}
        </p>
      </footer>
    </div>
  );
}
