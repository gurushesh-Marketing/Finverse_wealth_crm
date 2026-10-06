import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, LogOut } from 'lucide-react';
import { cn } from 'cn';
import { useSession } from '../../lib/session';
import { getAccessibleModuleGroups, findModuleByPath } from '../../lib/modules';
import { Button } from '../ui/button';

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { session } = useSession();
  const location = useLocation();
  const groups = getAccessibleModuleGroups(session!);
  return (
    <nav className="flex-1 space-y-4 overflow-y-auto p-3" aria-label="Modules">
      {groups.map((group) => (
        <div key={group.key} className="space-y-1">
          <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {group.label}
          </div>
          <ul className="space-y-0.5" role="list">
            {group.modules.map((module) => {
              const Icon = module.icon;
              const isActive =
                location.pathname === module.href ||
                location.pathname.startsWith(`${module.href}/`);
              return (
                <li key={module.key}>
                  <Link
                    to={module.href}
                    onClick={onNavigate}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isActive
                        ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent/60'
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    <span>{module.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function Sidebar() {
  const { session, logout } = useSession();
  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar lg:flex"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="border-b border-sidebar-border px-4 py-4">
        <img src="/finverse-logo.png" alt="Finverse" className="h-10 w-auto" />
        <div className="mt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Workspace / {session!.role}
        </div>
      </div>
      <NavLinks />
      <div className="border-t border-sidebar-border px-4 py-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Your scope</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Wealth · {session!.role === 'TL' ? 'Team Lead' : 'Sales caller'} · {session!.employeeId}
        </div>
        <div className="mt-2 text-sm font-medium text-foreground">{session!.displayName}</div>
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 w-full justify-start px-0 text-muted-foreground hover:text-destructive"
          onClick={() => void logout()}
        >
          <LogOut className="size-4" aria-hidden="true" /> Log out
        </Button>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const { session, logout } = useSession();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const module = findModuleByPath(session!, location.pathname);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="lg:hidden">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background px-4 py-3">
        <img src="/finverse-logo.png" alt="Finverse" className="h-9 w-auto" />
        <span className="ml-1 text-sm font-semibold text-foreground">
          {module?.label ?? 'Workspace'}
        </span>
        <button
          type="button"
          aria-label="Open navigation"
          aria-expanded={open}
          className="ml-auto rounded-md p-2 text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setOpen(true)}
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
      </header>
      {open ? (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Navigation">
          <div
            className="absolute inset-0 bg-foreground/30"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-sidebar-border bg-sidebar">
            <div className="flex items-center justify-between border-b border-sidebar-border px-4 py-4">
              <img src="/finverse-logo.png" alt="Finverse" className="h-9 w-auto" />
              <button
                type="button"
                aria-label="Close navigation"
                className="rounded-md p-2 focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setOpen(false)}
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <NavLinks onNavigate={() => setOpen(false)} />
            <div className="border-t border-sidebar-border px-4 py-3">
              <div className="text-sm font-medium text-foreground">{session!.displayName}</div>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 w-full justify-start px-0 text-muted-foreground hover:text-destructive"
                onClick={() => void logout()}
              >
                <LogOut className="size-4" aria-hidden="true" /> Log out
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  const location = useLocation();
  const roleLabel = location.pathname.startsWith('/management') ? 'Team leader' : session?.role === 'TL' ? 'Team lead (caller view)' : 'Sales caller';
  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-background">
      <div className="border-b border-border bg-secondary px-4 py-1 text-center text-[11px] font-medium uppercase tracking-widest text-accent">
        Design preview · Synthetic data
      </div>
      <Sidebar />
      <MobileNav />
      <main className="lg:pl-64">
        <div className="mx-auto max-w-[1400px] px-4 py-6 lg:px-8">
          <p className="mb-2 text-xs text-muted-foreground">Finverse CRM / {roleLabel}</p>
          {children}
        </div>
      </main>
    </div>
  );
}
