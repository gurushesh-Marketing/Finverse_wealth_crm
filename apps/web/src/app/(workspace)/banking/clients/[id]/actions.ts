'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { resolveWorkspaceSession } from '@/lib/auth/session';
import { leadRepository } from '@/lib/repository/db-repository';
import type { FollowUpInput } from '@/lib/repository/types';

export interface FollowUpFormState {
  error?: string;
  success?: string;
}

export async function saveFollowUpAction(
  _prev: FollowUpFormState,
  formData: FormData
): Promise<FollowUpFormState> {
  const resolved = await resolveWorkspaceSession();
  if (!resolved) redirect('/login');

  const leadId = String(formData.get('leadId') ?? '');
  const action = String(formData.get('action') ?? '');
  const dueAt = String(formData.get('dueAt') ?? '');
  const purpose = String(formData.get('purpose') ?? '');
  const priority = String(formData.get('priority') ?? 'normal') as FollowUpInput['priority'];

  if (!dueAt) {
    return { error: 'Choose a due date and time for the follow-up.' };
  }
  const input: FollowUpInput = {
    leadId,
    action,
    dueAt: new Date(dueAt).toISOString(),
    purpose,
    priority: priority === 'low' || priority === 'high' ? priority : 'normal',
  };
  const result = await leadRepository.saveFollowUp(resolved.session, input);
  if (!result.ok) return { error: result.error };

  revalidatePath(`/banking/clients/${leadId}`);
  revalidatePath('/banking/clients');
  revalidatePath('/banking/dashboard');
  return { success: 'Follow-up saved. It appears in Tasks and the lead timeline.' };
}
