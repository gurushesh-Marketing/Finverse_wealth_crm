'use client';

import { useActionState } from 'react';
import { saveFollowUpAction, type FollowUpFormState } from '@/app/(workspace)/banking/clients/[id]/actions';
import { Button } from '@/components/ui/button';

const initialState: FollowUpFormState = {};

const controlClass =
  'h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const labelClass = 'text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground';

function fieldErrorFor(error: string | undefined, field: 'due' | 'purpose'): string | null {
  if (!error) return null;
  if (field === 'purpose' && error.includes('Purpose')) return error;
  if (field === 'due' && error.toLowerCase().includes('due')) return error;
  return null;
}

export function FollowUpForm({ leadId }: { leadId: string }) {
  const [state, formAction, pending] = useActionState(saveFollowUpAction, initialState);
  const dueError = fieldErrorFor(state.error, 'due');
  const purposeError = fieldErrorFor(state.error, 'purpose');
  const generalError = state.error && !dueError && !purposeError ? state.error : null;

  return (
    <form action={formAction} className="space-y-3" aria-label="Schedule follow-up">
      <input type="hidden" name="leadId" value={leadId} />
      {generalError ? (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{generalError}</p>
      ) : null}
      {state.success ? (
        <p role="status" className="rounded-lg bg-accent/10 px-3 py-2 text-sm font-medium text-accent">{state.success}</p>
      ) : null}

      <div className="space-y-1">
        <label htmlFor="fu-action" className={labelClass}>Next action</label>
        <select id="fu-action" name="action" defaultValue="Follow-up call" className={controlClass}>
          <option>Follow-up call</option>
          <option>WhatsApp message</option>
          <option>Await documents</option>
        </select>
      </div>

      <div className="space-y-1">
        <label htmlFor="fu-due" className={labelClass}>Due date and time</label>
        <input
          id="fu-due"
          name="dueAt"
          type="datetime-local"
          aria-invalid={dueError ? true : undefined}
          className={controlClass}
        />
        {dueError ? (
          <p role="alert" className="text-xs font-medium text-destructive">{dueError}</p>
        ) : (
          <p className="text-xs text-muted-foreground">Must be in the future.</p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="fu-purpose" className={labelClass}>Purpose</label>
        <input
          id="fu-purpose"
          name="purpose"
          placeholder="e.g. Confirm documents"
          aria-invalid={purposeError ? true : undefined}
          className={controlClass}
        />
        {purposeError ? <p role="alert" className="text-xs font-medium text-destructive">{purposeError}</p> : null}
      </div>

      <div className="space-y-1">
        <label htmlFor="fu-priority" className={labelClass}>Priority</label>
        <select id="fu-priority" name="priority" defaultValue="normal" className={controlClass}>
          <option value="low">low</option>
          <option value="normal">normal</option>
          <option value="high">high</option>
        </select>
      </div>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Saving…' : 'Save follow-up'}
      </Button>
    </form>
  );
}
