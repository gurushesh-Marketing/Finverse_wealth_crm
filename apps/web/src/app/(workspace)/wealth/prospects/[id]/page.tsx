import Link from 'next/link';
import { resolveWorkspaceSession } from '@/lib/auth/session';
import { hasVertical } from '@/lib/session';
import {
  getLeadAccess,
  getLeadActivities,
  getLeadDocuments,
  getLeadDocRequests,
  getLeadOutcome,
  getLeadTasks,
} from '@/lib/repository/wealth-record';
import { WealthRecordTabs } from './WealthRecordTabs';

export const metadata = { title: 'Prospect Record — Finverse CRM' };

const STAGE_LABEL: Record<string, string> = {
  'not-contacted': 'Not contacted',
  contacted: 'Contacted',
  'follow-up': 'Follow-up',
  qualified: 'Qualified',
  unqualified: 'Unqualified',
  converted: 'Converted',
  lost: 'Lost',
};

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">{children}</p>;
}

export default async function WealthProspectDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolved = await resolveWorkspaceSession();
  if (!resolved || !hasVertical(resolved.session, 'wealth')) {
    return (
      <div role="alert" className="rounded-xl border border-border bg-card p-6">
        <h1 className="font-heading text-lg font-semibold">Access denied</h1>
        <p className="mt-2 text-sm text-muted-foreground">This record is outside your granted verticals.</p>
      </div>
    );
  }

  const { id } = await params;
  const access = await getLeadAccess(resolved.session, id);

  if (access.kind === 'cross-vertical') {
    return (
      <div role="alert" className="rounded-xl border border-border bg-card p-6">
        <h1 className="font-heading text-lg font-semibold">Access denied</h1>
        <p className="mt-2 text-sm text-muted-foreground">This record is outside your granted verticals.</p>
      </div>
    );
  }

  if (access.kind === 'not-in-scope') {
    return (
      <div role="alert" className="rounded-xl border border-border bg-card p-6">
        <h1 className="font-heading text-lg font-semibold">Not in your permitted workload</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This lead does not exist in your authorized scope. No customer information is shown.
        </p>
        <Link href="/wealth/prospects" className="mt-4 inline-block text-sm font-semibold text-accent underline-offset-4 hover:underline">
          Return to inbox
        </Link>
      </div>
    );
  }

  if (access.kind === 'reassigned') {
    return (
      <div role="alert" className="rounded-xl border border-border bg-card p-6">
        <h1 className="font-heading text-lg font-semibold">Access changed</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This record was reassigned and is no longer in your workload. Sensitive details have been cleared.
        </p>
        <Link href="/wealth/prospects" className="mt-4 inline-block text-sm font-semibold text-accent underline-offset-4 hover:underline">
          Return to inbox
        </Link>
      </div>
    );
  }

  const lead = access.lead;
  const [activities, tasks, documents, docRequests, outcome] = await Promise.all([
    getLeadActivities(resolved.session, lead.id),
    getLeadTasks(resolved.session, lead.id),
    getLeadDocuments(resolved.session, lead.id),
    getLeadDocRequests(resolved.session, lead.id),
    getLeadOutcome(resolved.session, lead.id),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <Eyebrow>Prospect record / Wealth</Eyebrow>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-3xl font-bold tracking-tight">{lead.displayName}</h1>
          <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-medium text-accent">
            {STAGE_LABEL[lead.stage] ?? lead.stage}
          </span>
          <span className="rounded-full border border-border px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            Contact {lead.contactEligible ? 'eligible' : 'not eligible'}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-mono">{lead.id}</span> · {lead.product} · {lead.source}
          {lead.sourceDetail ? ` / ${lead.sourceDetail}` : ''} · Owner: {lead.ownerName} / {lead.ownerTeamName} · Next:{' '}
          {lead.nextAction} (<span className="font-mono">{new Date(lead.dueAt).toLocaleString()}</span>)
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card px-4 py-3">
        <Eyebrow>Start a conversation</Eyebrow>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Link
            href={`/wealth/activities?lead=${encodeURIComponent(lead.id)}&intent=call`}
            className="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 inline-flex items-center"
          >
            Call
          </Link>
          <Link
            href={`/wealth/activities?lead=${encodeURIComponent(lead.id)}&intent=whatsapp`}
            className="h-9 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground hover:bg-muted inline-flex items-center"
          >
            WhatsApp
          </Link>
          <Link
            href={`/wealth/activities?lead=${encodeURIComponent(lead.id)}&intent=manual`}
            className="h-9 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground hover:bg-muted inline-flex items-center"
          >
            Add activity
          </Link>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Routes to the conversations workspace; dialer states and provider messaging land in a later wave.
        </p>
      </div>

      <WealthRecordTabs
        lead={lead}
        activities={activities}
        tasks={tasks}
        documents={documents}
        docRequests={docRequests}
        outcome={outcome}
      />

      <p className="border-t border-border pt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Privacy by scope · illustrative values · opening a record creates no activity
      </p>
    </div>
  );
}
