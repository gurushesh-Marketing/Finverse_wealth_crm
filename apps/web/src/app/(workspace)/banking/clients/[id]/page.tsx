import Link from 'next/link';
import { resolveWorkspaceSession } from '@/lib/auth/session';
import { leadRepository } from '@/lib/repository/db-repository';
import { hasVertical } from '@/lib/session';
import { RecordTabs } from '@/components/leads/RecordTabs';
import { FollowUpForm } from '@/components/leads/FollowUpForm';

export const metadata = { title: 'Prospect Record — Finverse CRM' };

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">{children}</p>;
}

export default async function BankingProspectDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolved = await resolveWorkspaceSession();
  if (!resolved || !hasVertical(resolved.session, 'banking')) {
    return (
      <div role="alert" className="rounded-xl border border-border bg-card p-6">
        <h1 className="font-heading text-lg font-semibold">Access denied</h1>
        <p className="mt-2 text-sm text-muted-foreground">This record is outside your granted verticals.</p>
      </div>
    );
  }

  const { id } = await params;
  const lead = await leadRepository.getLead(resolved.session, id);
  if (!lead) {
    return (
      <div role="alert" className="rounded-xl border border-border bg-card p-6">
        <h1 className="font-heading text-lg font-semibold">Not in your permitted workload</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This lead does not exist in your authorized scope. No customer information is shown.
        </p>
        <Link href="/banking/clients" className="mt-4 inline-block text-sm font-semibold text-accent underline-offset-4 hover:underline">
          Return to inbox
        </Link>
      </div>
    );
  }

  const [activities, tasks] = await Promise.all([
    leadRepository.getLeadActivities(resolved.session, lead.id),
    leadRepository.getLeadTasks(resolved.session, lead.id),
  ]);

  return (
    <div className="space-y-4">
      {/* Record header (deck reference 006 composition) */}
      <div>
        <Eyebrow>Prospect record / Banking</Eyebrow>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-3xl font-bold tracking-tight">{lead.displayName}</h1>
          <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-medium text-accent">{lead.stage}</span>
          <span className="rounded-full border border-border px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            Contact {lead.contactEligible ? 'eligible' : 'not eligible'}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-mono">{lead.id}</span> · {lead.product} · Next: {lead.nextAction} (
          <span className="font-mono">{new Date(lead.dueAt).toLocaleString()}</span>)
        </p>
      </div>

      {/* Channel controls — simulated, honestly labelled (SC-06/SC-09 out of scope) */}
      <div className="rounded-xl border border-border bg-card px-4 py-3">
        <Eyebrow>Channel controls</Eyebrow>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled
            aria-label="Call — SIMULATED, no provider integration"
            className="h-9 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-muted-foreground"
          >
            Call
          </button>
          <button
            type="button"
            disabled
            aria-label="WhatsApp — SIMULATED, no provider integration"
            className="h-9 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-muted-foreground"
          >
            WhatsApp
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          SIMULATED — no provider integration. Dialer states and message sending are out of scope for this milestone.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecordTabs lead={lead} activities={activities.items} tasks={tasks.items} />
        </div>

        {/* Elevated next-action rail (deck composition: one elevated panel) */}
        <aside className="h-fit rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-4 py-3">
            <Eyebrow>Next action</Eyebrow>
            <h2 className="text-sm font-semibold">Schedule follow-up</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Requires a future due date/time, an action and a purpose. Saved to persistent storage.
            </p>
          </div>
          <div className="p-4">
            <FollowUpForm leadId={lead.id} />
          </div>
        </aside>
      </div>

      {/* Provenance footer strip (deck reference 007) */}
      <p className="border-t border-border pt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Privacy by scope · illustrative values · opening a record creates no activity
      </p>
    </div>
  );
}
