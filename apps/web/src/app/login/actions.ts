'use server';

import { redirect } from 'next/navigation';
import { createSession, destroySession, verifyCredentials } from '@/lib/auth/session';

export async function loginAction(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const user = await verifyCredentials(email, password);
  if (!user) {
    redirect('/login?error=1');
  }
  await createSession(user.id);
  redirect('/');
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect('/login');
}
