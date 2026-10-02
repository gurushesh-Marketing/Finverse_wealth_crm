import { getDefaultModule } from '@/lib/modules';
import { resolveWorkspaceSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';

const VERTICAL_HOME: Record<string, string> = {
  banking: '/banking/dashboard',
  markets: '/markets/dashboard',
  'real-estate': '/real-estate/dashboard',
  wealth: '/wealth/dashboard',
};

export default async function WorkspaceRoot() {
  const resolved = await resolveWorkspaceSession();
  if (!resolved) redirect('/login');
  const defaultModule = getDefaultModule(resolved.session);
  if (defaultModule) redirect(defaultModule.href);
  redirect(VERTICAL_HOME[resolved.user.vertical] ?? '/wealth/dashboard');
}
