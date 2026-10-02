import Link from 'next/link';
import { resolveWorkspaceSession } from '@/lib/auth/session';
import { hasVertical } from '@/lib/session';
import {
  getDistinctProducts,
  getDistinctSources,
  getLeads,
  getSavedViews,
} from '@/lib/repository/wealth-inbox';
import type { LeadStage } from '@/lib/repository/types';
import { deleteViewAction, saveViewAction } from './actions';

export const metadata = { title: 'Lead Inbox — Finverse CRM' };

const STAGES: Array<LeadStage | 'all'> = [
  'all',
  'not-contacted',
  'contacted',
  'follow-up',
  'qualified',
  'unqualified',
  'converted',
  'lost',
];
const STAGE_LABEL: Record<string, string> = {
  'not-contacted': 'Not contacted',
  contacted: 'Contacted',
  'follow-up': 'Follow-up',
  qualified: 'Qualified',
  unqualified: 'Unqualified',
  converted: 'Converted',
  lost: 'Lost',
};
const DUE_LABEL: Record<string, string> = {
  all: 'Due: all',
  overdue: 'Due: overdue',
  today: 'Due: today',
  week: 'Due: this week',
};

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">{children}</p>;
}

function savedViewHref(filtersJson: string | undefined): string {
  let f: { search?: string; stage?: string; source?: string; product?: string; due?: string } = {};
  try {
    f = filtersJson ? JSON.parse(filtersJson) : {};
  } catch {
    f = {};
  }
  const sp = new URLSearchParams();
  if (f.search) sp.set('search', f.search);
  if (f.stage && f.stage !== 'all') sp.set('stage', f.stage);
  if (f.source && f.source !== 'all') sp.set('source', f.source);
  if (f.product && f.product !== 'all') sp.set('product', f.product);
  if (f.due && f.due !== 'all') sp.set('due', f.due);
  const qs = sp.toString();
  return qs ? `/wealth/prospects?${qs}` : '/wealth/prospects';
}

export default async function WealthLeadInbox({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; stage?: string; source?: string; product?: string; due?: string; page?: string }>;
}) {
  const resolved = await resolveWorkspaceSession();
  if (!resolved || !hasVertical(resolved.session, 'wealth')) {
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
  const source = params.source && params.source !== 'all' ? [params.source] : undefined;
  const product = params.product && params.product !== 'all' ? [params.product] : undefined;
  const due = (params.due as 'all' | 'overdue' | 'today' | 'week' | undefined) ?? 'all';
  const page = Math.max(1, Number(params.page) || 1);

  const [result, sources, products, savedViews] = await Promise.all([
    getLeads(resolved.session, { search, stage, source, product, due, page, pageSize: 10 }),
    getDistinctSources(resolved.session),
    getDistinctProducts(resolved.session),
    getSavedViews(resolved.session),
  ]);

  const filtersJson = JSON.stringify({
    search: search ?? '',
    stage: params.stage ?? 'all',
    source: params.source ?? 'all',
    product: params.product ?? 'all',
    due,
  });

  const query = (pageNum: number) => {
    const sp = new URLSearchParams();
    if (search) sp.set('search', search);
    if (params.stage && params.stage !== 'all') sp.set('stage', params.stage);
    if (params.source && params.source !== 'all') sp.set('source', params.source);
    if (params.product && params.product !== 'all') sp.set('product', params.product);
    if (due !== 'all') sp.set('due', due);
    if (pageNum > 1) sp.set('page', String(pageNum));
    const qs = sp.toString();
    return qs ? `/wealth/prospects?${qs}` : '/wealth/prospects';
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>Personal workspace / Wealth</Eyebrow>
          <h1 className="mt-1 font-heading text-3xl font-bold tracking-tight">Lead inbox</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {result.total} lead{result.total === 1 ? '' : 's'} · owned scope only · {resolved.user.teamName}
          </p>
        </div>
        <span className="rounded-full border border-border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Wealth scope
        </span>
      </div>

      <div className="flex items-center gap-1 border-b border-border" role="navigation" aria-label="Workspace views">
        <Link href="/wealth/dashboard" className="border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
          My day
        </Link>
        <span className="border-b-2 border-accent px-3 py-2 text-sm font-semibold text-foreground">Lead Inbox</span>
      </div>

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
        <label htmlFor="source" className="sr-only">Source</label>
        <select id="source" name="source" defaultValue={params.source ?? 'all'} className="h-8 rounded-lg border border-input bg-background px-2 text-sm">
          <option value="all">Source: all</option>
          {sources.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <label htmlFor="product" className="sr-only">Product</label>
        <select id="product" name="product" defaultValue={params.product ?? 'all'} className="h-8 rounded-lg border border-input bg-background px-2 text-sm">
          <option value="all">Product: all</option>
          {products.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <label htmlFor="due" className="sr-only">Due</label>
        <select id="due" name="due" defaultValue={due} className="h-8 rounded-lg border border-input bg-background px-2 text-sm">
          {(['all', 'overdue', 'today', 'week'] as const).map((d) => (
            <option key={d} value={d}>{DUE_LABEL[d]}</option>
          ))}
        </select>
        <button type="submit" className="h-8 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          Apply filters
        </button>
        <Link href="/wealth/prospects" className="h-8 rounded-lg px-3 text-sm font-medium leading-8 text-muted-foreground hover:bg-muted hover:text-foreground">
          Clear filters
        </Link>
      </form>

      <section aria-label="Saved views" className="rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Eyebrow>Saved views</Eyebrow>
          <Link href="/wealth/prospects" className="text-xs font-semibold text-accent underline-offset-4 hover:underline">
            Reset
          </Link>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Saved views store filters, never a reusable copy of customer data.</p>

        <form action={saveViewAction} className="mt-2 flex flex-wrap items-center gap-2">
          <input type="hidden" name="filtersJson" value={filtersJson} />
          <label htmlFor="view-name" className="sr-only">View name</label>
          <input
            id="view-name"
            name="name"
            placeholder="View name"
            aria-label="View name"
            required
            className="h-8 rounded-lg border border-input bg-background px-3 text-sm"
          />
          <button type="submit" className="h-8 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
            Save view
          </button>
        </form>

        {savedViews.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No saved views yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {savedViews.map((view) => (
              <li key={view.id} className="flex items-center gap-2 py-1.5">
                <span className="text-sm font-medium">{view.name}</span>
                <Link
                  href={savedViewHref(view.filtersJson)}
                  aria-label={`Apply saved view ${view.name}`}
                  className="text-xs font-semibold text-accent underline-offset-4 hover:underline"
                >
                  Apply
                </Link>
                <form action={deleteViewAction} className="ml-auto">
                  <input type="hidden" name="id" value={view.id} />
                  <button
                    type="submit"
                    aria-label={`Delete saved view ${view.name}`}
                    className="text-xs font-medium text-muted-foreground hover:text-destructive"
                  >
                    Delete
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {result.items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="text-sm font-semibold">No match.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            No leads match these filters in your permitted workload.
          </p>
          <Link href="/wealth/prospects" className="mt-3 inline-block text-sm font-semibold text-accent underline-offset-4 hover:underline">
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
                  <th className="px-4 py-2 font-semibold">Source</th>
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
                        <Link href={`/wealth/prospects/${lead.id}`} className="font-mono text-xs font-medium text-accent hover:underline underline-offset-4">
                          {lead.id}
                        </Link>
                      </td>
                      <td className="px-4 py-1.5 font-semibold">{lead.displayName}</td>
                      <td className="px-4 py-1.5 text-muted-foreground">{lead.product}</td>
                      <td className="px-4 py-1.5 text-muted-foreground">{lead.source}</td>
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
                        <Link href={`/wealth/prospects/${lead.id}`} aria-label="Open record" className="text-muted-foreground hover:text-accent">
                          <span aria-hidden="true">›</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
              <span>
                Page {result.page} of {result.totalPages} · {result.total} total
              </span>
              <div className="flex items-center gap-2">
                {result.page > 1 ? (
                  <Link href={query(result.page - 1)} aria-label="Previous page" className="font-semibold text-accent hover:underline underline-offset-4">
                    ‹ Prev
                  </Link>
                ) : (
                  <span aria-hidden="true" className="text-muted-foreground/50">‹ Prev</span>
                )}
                {result.page < result.totalPages ? (
                  <Link href={query(result.page + 1)} aria-label="Next page" className="font-semibold text-accent hover:underline underline-offset-4">
                    Next ›
                  </Link>
                ) : (
                  <span aria-hidden="true" className="text-muted-foreground/50">Next ›</span>
                )}
              </div>
            </div>
            <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
              Only assigned Wealth enquiries appear. A transfer changes this queue at its effective time. Illustrative values · current permission scope.
            </p>
          </section>

          <ul className="space-y-2 md:hidden">
            {result.items.map((lead) => {
              const overdue = lead.isOverdue === true;
              return (
                <li key={lead.id}>
                  <Link href={`/wealth/prospects/${lead.id}`} className="block rounded-xl border border-border bg-card p-3 hover:bg-muted/50">
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
