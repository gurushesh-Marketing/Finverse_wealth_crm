'use client';

import { useActionState } from 'react';
import { setProviderStatusAction, type ProviderActionState } from './actions';
import type { ProviderStatus } from '@/lib/repository/wealth-myday';

export function ProviderSimulator({ initialStatus }: { initialStatus: ProviderStatus }) {
  const [state, action, pending] = useActionState<ProviderActionState, FormData>(setProviderStatusAction, {
    status: initialStatus,
  });
  const status = state.status;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Provider simulator (demo):
      </span>
      <form action={action} className="flex items-center gap-1" aria-label="Provider simulator">
        <button
          type="submit"
          name="status"
          value="connected"
          disabled={pending}
          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${
            status === 'connected'
              ? 'border-accent bg-accent/15 text-accent'
              : 'border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          Connected
        </button>
        <button
          type="submit"
          name="status"
          value="delayed"
          disabled={pending}
          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${
            status === 'delayed'
              ? 'border-accent bg-accent/15 text-accent'
              : 'border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          Delayed
        </button>
      </form>
      <span aria-live="polite" data-testid="provider-status" className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {status === 'delayed' ? 'Delayed' : 'Connected'}
      </span>
    </div>
  );
}
