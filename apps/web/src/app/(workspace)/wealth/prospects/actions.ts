'use server';

import { revalidatePath } from 'next/cache';
import { resolveWorkspaceSession } from '@/lib/auth/session';
import { deleteView, saveView } from '@/lib/repository/wealth-inbox';

export async function saveViewAction(formData: FormData): Promise<void> {
  const resolved = await resolveWorkspaceSession();
  if (!resolved) return;
  const name = String(formData.get('name') ?? '').trim();
  const filtersJson = String(formData.get('filtersJson') ?? '{}');
  if (!name) return;
  await saveView(resolved.session, name, filtersJson);
  revalidatePath('/wealth/prospects');
}

export async function deleteViewAction(formData: FormData): Promise<void> {
  const resolved = await resolveWorkspaceSession();
  if (!resolved) return;
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  await deleteView(resolved.session, id);
  revalidatePath('/wealth/prospects');
}
