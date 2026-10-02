'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getAccessibleModuleGroups } from '@/lib/modules';
import type { WorkspaceSession } from '@/lib/session';
import { logoutAction } from '@/app/login/actions';
import { Sidebar } from './Sidebar';
import { MobileNav, MobileNavTrigger } from './MobileNav';

interface WorkspaceShellProps {
  children: React.ReactNode;
  session: WorkspaceSession;
  displayName: string;
}

export function WorkspaceShell({ children, session, displayName }: WorkspaceShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [moduleGroups] = useState(() => getAccessibleModuleGroups(session));
  const pathname = usePathname();
  const activeModule = moduleGroups
    .flatMap((g) => g.modules)
    .find((m) => pathname === m.href || pathname.startsWith(m.href + '/'));

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar
        moduleGroups={moduleGroups}
        session={session}
        displayName={displayName}
        onClose={() => setMobileNavOpen(false)}
      />

      <MobileNav
        moduleGroups={moduleGroups}
        session={session}
        isOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />

      <div className="flex-1 flex flex-col lg:pl-64">
        {/* Product-contract ribbon (deck reference 006) */}
        <div className="bg-accent/10 border-b border-border px-4 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent lg:px-6">
          Design preview · Synthetic data · Authorization shown as a product contract
        </div>

        {/* Top bar: breadcrumb + identity (deck reference 006) */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 px-4 border-b border-border bg-background/90 backdrop-blur-sm lg:px-6">
          <MobileNavTrigger onClick={() => setMobileNavOpen(true)} />

          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">Finverse CRM</Link>
            <span aria-hidden="true">/</span>
            <span className="font-medium text-foreground">{activeModule?.label ?? session.role}</span>
          </nav>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <form action={logoutAction}>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                Sign out
              </button>
            </form>
            <div className="h-8 w-8 rounded-full bg-accent/15 flex items-center justify-center">
              <span className="text-sm font-semibold text-accent">{displayName.slice(0, 1)}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
