'use client';

import { useState } from 'react';
import { getAccessibleModuleGroups } from '@/lib/modules';
import { fixtureSession } from '@/lib/session';
import { Sidebar } from './Sidebar';
import { MobileNav, MobileNavTrigger } from './MobileNav';

interface WorkspaceShellProps {
  children: React.ReactNode;
}

export function WorkspaceShell({ children }: WorkspaceShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [moduleGroups] = useState(() => getAccessibleModuleGroups(fixtureSession));

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <Sidebar
        moduleGroups={moduleGroups}
        onClose={() => setMobileNavOpen(false)}
      />

      {/* Mobile nav overlay */}
      <MobileNav
        moduleGroups={moduleGroups}
        isOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 px-4 border-b border-border bg-background/80 backdrop-blur-sm lg:px-6">
          <MobileNavTrigger onClick={() => setMobileNavOpen(true)} />

          <div className="flex-1" />

          {/* Right side - user profile, notifications, etc. */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted">
              <span className="text-xs font-medium text-muted-foreground">
                {fixtureSession.role}
              </span>
              <span className="text-xs text-muted-foreground">
                •
              </span>
              <span className="text-xs text-muted-foreground">
                {fixtureSession.verticalGrants.join(', ')}
              </span>
            </div>
            <button
              type="button"
              className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Notifications"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-medium text-primary">
                {fixtureSession.employeeId.slice(-3)}
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}