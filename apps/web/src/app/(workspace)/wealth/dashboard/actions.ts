'use server';

import { revalidatePath } from 'next/cache';
import { resolveWorkspaceSession } from '@/lib/auth/session';
import {
  saveAvailability,
  setProviderStatus,
  type AvailabilityStatus,
  type ProviderStatus,
} from '@/lib/repository/wealth-myday';

export interface AvailabilityActionState {
  ok: boolean;
  message: string;
  status: AvailabilityStatus | null;
  changedAt: string | null;
}

export async function saveAvailabilityAction(
  prevState: AvailabilityActionState,
  formData: FormData
): Promise<AvailabilityActionState> {
  const resolved = await resolveWorkspaceSession();
  if (!resolved || !resolved.user.hasActiveAssignment) {
    return { ok: false, message: 'No active assignment — access pending.', status: prevState.status, changedAt: prevState.changedAt };
  }
  const status = String(formData.get('status') ?? '') as AvailabilityStatus;
  const note = String(formData.get('note') ?? '');
  const result = await saveAvailability(resolved.session, { status, note });
  if (!result.ok) {
    return { ok: false, message: result.error, status: prevState.status, changedAt: prevState.changedAt };
  }
  revalidatePath('/wealth/dashboard');
  return { ok: true, message: 'Availability saved.', status: result.status, changedAt: result.effectiveAt };
}

export interface ProviderActionState {
  status: ProviderStatus;
}

export async function setProviderStatusAction(
  prevState: ProviderActionState,
  formData: FormData
): Promise<ProviderActionState> {
  const resolved = await resolveWorkspaceSession();
  const requested = String(formData.get('status') ?? '');
  const next: ProviderStatus = requested === 'delayed' ? 'delayed' : 'connected';
  if (!resolved || !resolved.user.hasActiveAssignment) {
    return { status: prevState.status };
  }
  setProviderStatus(next);
  revalidatePath('/wealth/dashboard');
  return { status: next };
}
