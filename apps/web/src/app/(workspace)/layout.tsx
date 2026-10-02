import { redirect } from 'next/navigation';
import { WorkspaceShell } from '@/components/shell/WorkspaceShell';
import { resolveWorkspaceSession } from '@/lib/auth/session';

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const resolved = await resolveWorkspaceSession();
  if (!resolved) redirect('/login');
  return (
    <WorkspaceShell session={resolved.session} displayName={resolved.user.displayName}>
      {children}
    </WorkspaceShell>
  );
}
