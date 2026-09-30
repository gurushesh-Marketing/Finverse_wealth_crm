import { getDefaultModule } from '@/lib/modules';
import { fixtureSession } from '@/lib/session';
import { redirect } from 'next/navigation';

export default function WorkspaceRoot() {
  const defaultModule = getDefaultModule(fixtureSession);

  if (defaultModule) {
    redirect(defaultModule.href);
  }

  // Fallback if no modules accessible
  redirect('/unauthorized');
}