import Link from 'next/link';
import { resolveWorkspaceSession } from '@/lib/auth/session';
import { leadRepository } from '@/lib/repository/db-repository';
import { hasVertical } from '@/lib/session';
import type { LeadStage } from '@/lib/repository/types';

export const metadata = { title: 'Lead Inbox — Finverse CRM' };

const STAGES: Array<LeadStage | 'all'> = ['all', 'not-contacted', 'contacted', 'qualified', 'unqualified', 'converted'];
const STAGE_LABEL: Record<string, string> = {
  'not-contacted': 'Not contacted',
  contacted: 'Contacted',
  qualified: 'Qualified',
  unqualified: 'Unqualified',
  converted: 'Converted',
};

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">{children}</p>;
}

export default async function BankingLeadQueue({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; stage?: string; due?: string }>;
}) {
  const resolved = await resolveWorkspaceSession();
  if (!resolved || !hasVertical(resolved.session, 'banking')) {
    return (
      <div role="alert" className="rounded-xl border border-border bg-card p-6">
        <h1 className="font-heading text-lg font-semibold">Access denied</h1>
        <p className="mt-2 text-sm text-muted-foreground">This queue is outside your granted verticals.</p>
      </div>
    );
  }

  const params = await searchParams;
  const search = params.search?.trim() || undefined;
  const stage = params.stage && params.stage !== 'all' ? [params.stage as LeadStage] : undefined;
  const due = (params.due as 'all' | 'overdue' | 'today' | undefined) ?? 'all';

  const result = await leadRepository.getLeads(resolved.session, {
    search,
    stage,
    due: due === 'all' ? 'all' : due,
    sortBy: 'due-asc',
  });

  return (
    <div className="space-y-4">
      {/* Workspace header (deck reference 006/008) */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>Personal workspace / Banking</Eyebrow>
          <h1 className="mt-1 font-heading text-3xl font-bold tracking-tight">Lead inbox</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {result.total} lead{result.total === 1 ? '' : 's'} · owned scope only · {resolved.user.teamName}
          </p>
        </div>
        <span className="rounded-full border border-border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Banking scope
        </span>
      </div>

      <div className="flex items-center gap-1 border-b border-border" role="navigation" aria-label="Workspace views">
        <Link href="/banking/dashboard" className="border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
          My day
        </Link>
        <span className="border-b-2 border-accent px-3 py-2 text-sm font-semibold text-foreground">Lead Inbox</span>
      </div>

      {/* Toolbar-integrated filters (deck reference 008: no floating filter card) */}
      <form
        method="get"
        className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2"
        aria-label="Lead filters"
      >
        <input
          id="search"
          name="search"
          defaultValue={search ?? ''}
          placeholder="Prospect or lead ID"
          aria-label="Search"
          className="h-8 min-w-44 flex-1 rounded-lg border border-input bg-background px-3 text-sm"
        />
        <label htmlFor="stage" className="sr-only">Stage</label>
        <select id="stage" name="stage" defaultValue={params.stage ?? 'all'} className="h-8 rounded-lg border border-input bg-background px-2 text-sm">
          {STAGES.map((s) => (
            <option key={s} value={s}>{STAGE_LABEL[s] ?? s}</option>
          ))}
        </select>
        <label htmlFor="due" className="sr-only">Due</label>
        <select id="due" name="due" defaultValue={due} className="h-8 rounded-lg border border-input bg-background px-2 text-sm">
          <option value="all">Due: all</option>
          <option value="overdue">Due: overdue</option>
          <option value="today">Due: today</option>
        </select>
        <button type="submit" className="h-8 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          Apply filters
        </button>
        <Link href="/banking/clients" className="h-8 rounded-lg px-3 text-sm font-medium leading-8 text-muted-foreground hover:bg-muted hover:text-foreground">
          Clear filters
        </Link>
      </form>

      {result.items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="text-sm font-semibold">No match.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            No leads match these filters in your permitted workload.
          </p>
          <Link href="/banking/clients" className="mt-3 inline-block text-sm font-semibold text-accent underline-offset-4 hover:underline">
            Clear filters
          </Link>
        </div>
      ) : (
        <>
          <section className="rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  <th className="px-4 py-2 font-semibold">Lead ID</th>
                  <th className="px-4 py-2 font-semibold">Prospect</th>
                  <th className="px-4 py-2 font-semibold">Product</th>
                  <th className="px-4 py-2 font-semibold">Stage</th>
                  <th className="px-4 py-2 font-semibold">Next action</th>
                  <th className="px-4 py-2 text-right font-semibold">Due</th>
                  <th className="w-8 px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result.items.map((lead) => {
                  const overdue = lead.isOverdue === true;
                  return (
                    <tr key={lead.id} className="hover:bg-muted/50">
                      <td className="px-4 py-1.5">
                        <Link href={`/banking/clients/${lead.id}`} className="font-mono text-xs font-medium text-accent hover:underline underline-offset-4">
                          {lead.id}
                        </Link>
                      </td>
                      <td className="px-4 py-1.5 font-semibold">{lead.displayName}</td>
                      <td className="px-4 py-1.5 text-muted-foreground">{lead.product}</td>
                      <td className="px-4 py-1.5">
                        <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
                          {STAGE_LABEL[lead.stage] ?? lead.stage}
                        </span>
                      </td>
                      <td className="px-4 py-1.5 text-muted-foreground">{lead.nextAction}</td>
                      <td className={`px-4 py-1.5 text-right tabular-nums ${overdue ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>
                        {overdue ? 'Overdue · ' : ''}{new Date(lead.dueAt).toLocaleString()}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <Link href={`/banking/clients/${lead.id}`} aria-label="Open record" className="text-muted-foreground hover:text-accent">
                          <span aria-hidden="true">›</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
              Only assigned Banking enquiries appear. A transfer changes this queue at its effective time. Illustrative values · current permission scope.
            </p>
          </section>

          {/* Mobile stacked list */}
          <ul className="space-y-2 md:hidden">
            {result.items.map((lead) => {
              const overdue = lead.isOverdue === true;
              return (
                <li key={lead.id}>
                  <Link href={`/banking/clients/${lead.id}`} className="block rounded-xl border border-border bg-card p-3 hover:bg-muted/50">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{lead.displayName}</span>
                      <span className={`text-xs tabular-nums ${overdue ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>
                        {new Date(lead.dueAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <span className="font-mono">{lead.id}</span>
                      <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                        {STAGE_LABEL[lead.stage] ?? lead.stage}
                      </span>
                      <span>· {lead.nextAction}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
