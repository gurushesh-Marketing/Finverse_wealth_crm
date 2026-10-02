'use client';

import { useActionState, useState } from 'react';
import { saveAvailabilityAction, type AvailabilityActionState } from './actions';
import type { AvailabilityStatus, MyDayAvailability } from '@/lib/repository/wealth-myday';

const STATUS_LABEL: Record<string, string> = {
  available: 'Available',
  busy: 'Busy',
  away: 'Away',
};

function fmtTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function AvailabilityControl({ current }: { current: MyDayAvailability | null }) {
  const [state, action, pending] = useActionState<AvailabilityActionState, FormData>(saveAvailabilityAction, {
    ok: false,
    message: '',
    status: current?.status ?? null,
    changedAt: current?.effectiveAt ?? null,
  });

  const shownStatus = state.status ?? current?.status ?? null;
  const shownChangedAt = state.changedAt ?? current?.effectiveAt ?? null;
  const [selected, setSelected] = useState<AvailabilityStatus>(current?.status ?? 'available');

  return (
    <section className="rounded-xl border border-border bg-card" aria-label="Availability">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">Availability</p>
          <h2 className="text-sm font-semibold">Mark availability for allocation</h2>
        </div>
      </div>
      <div className="space-y-3 px-4 py-3">
        <p className="text-sm text-muted-foreground" data-testid="availability-current">
          Current status:{' '}
          <span className="font-semibold text-foreground">
            {shownStatus ? STATUS_LABEL[shownStatus] : 'Not recorded'}
          </span>
          {shownChangedAt ? <> · last change {fmtTime(shownChangedAt)}</> : null}
        </p>

        <form action={action} className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label
              htmlFor="availability-status"
              className="block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
            >
              Availability
            </label>
            <select
              id="availability-status"
              name="status"
              value={selected}
              onChange={(e) => setSelected(e.target.value as AvailabilityStatus)}
              className="h-10 rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="available">Available</option>
              <option value="busy">Busy</option>
              <option value="away">Away</option>
            </select>
          </div>
          <div className="min-w-[220px] flex-1 space-y-1.5">
            <label
              htmlFor="availability-note"
              className="block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
            >
              Note (optional)
            </label>
            <input
              id="availability-note"
              name="note"
              type="text"
              placeholder="Approved hours or absence reason"
              className="h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            Save availability
          </button>
        </form>

        <p role="status" aria-live="polite" className={state.ok ? 'text-sm font-medium text-green-600' : 'text-sm font-medium text-destructive'}>
          {state.message}
        </p>

        <p className="text-xs text-muted-foreground">
          Availability never changes your login role or ownership.
        </p>
      </div>
    </section>
  );
}
