'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { ModuleGroup } from '@/lib/modules';
import type { WorkspaceSession } from '@/lib/session';

interface SidebarProps {
  moduleGroups: ModuleGroup[];
  session: WorkspaceSession;
  displayName: string;
  onClose?: () => void;
}

export function Sidebar({ moduleGroups, session, displayName, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const currentGroupKey = moduleGroups.find(g =>
    g.modules.some(m => pathname.startsWith(m.href))
  )?.key;

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const isGroupExpanded = (key: string) => {
    if (currentGroupKey === key) return true;
    return expandedGroups.has(key);
  };

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 w-64 bg-sidebar border-r border-sidebar-border',
        'flex flex-col transition-transform duration-200 ease-in-out',
        'lg:translate-x-0'
      )}
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Brand lockup (deck reference 006) */}
      <div className="border-b border-sidebar-border px-4 py-4">
        <img src="/finverse-logo.png" alt="Finverse Wealth" className="h-10 w-auto" />
        <div className="mt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Workspace / {session.role}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-4" aria-label="Modules">
        {moduleGroups.map(group => (
          <div key={group.key} className="space-y-1">
            <button
              type="button"
              className={cn(
                'w-full flex items-center gap-2 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]',
                'text-muted-foreground hover:text-foreground transition-colors',
                'rounded-md'
              )}
              onClick={() => toggleGroup(group.key)}
              aria-expanded={isGroupExpanded(group.key)}
              aria-controls={`nav-${group.key}`}
            >
              <span>{group.label}</span>
              <svg
                className={cn(
                  'ml-auto h-4 w-4 transition-transform',
                  isGroupExpanded(group.key) && 'rotate-180'
                )}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <div
              id={`nav-${group.key}`}
              role="region"
              aria-label={`${group.label} modules`}
              className={cn(
                'overflow-hidden transition-all duration-200 ease-in-out',
                isGroupExpanded(group.key) ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
              )}
            >
              <ul className="space-y-0.5 pl-1" role="list">
                {group.modules.map(module => {
                  const isActive = pathname === module.href || pathname.startsWith(module.href + '/');
                  return (
                    <li key={module.key}>
                      <Link
                        href={module.href}
                        className={cn(
                          'flex items-center gap-2 px-2.5 py-1.5 text-sm rounded-lg transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          isActive
                            ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                            : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
                        )}
                        onClick={onClose}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        <i
                          className={cn(
                            'h-4 w-4 shrink-0',
                            `lucide-${module.icon.toLowerCase()}`
                          )}
                          aria-hidden="true"
                          data-lucide={module.icon}
                        />
                        <span className="truncate">{module.label}</span>
                        {module.badge && (
                          <span className="ml-auto px-1.5 py-0.5 text-xs rounded-full bg-muted text-muted-foreground">
                            {module.badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        ))}

        {moduleGroups.length === 0 && (
          <div className="px-4 py-8 text-center text-muted-foreground text-sm">
            <p>No modules available for your role.</p>
            <p className="mt-1">Contact your administrator.</p>
          </div>
        )}
      </nav>

      {/* Scope + session footer (deck reference 006) */}
      <div className="border-t border-sidebar-border p-4 space-y-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Your scope</p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {session.verticalGrants.join(', ')}
          </p>
          <p className="text-xs text-muted-foreground">Assigned hierarchy only</p>
        </div>
        <div className="flex items-center gap-2.5 rounded-lg border border-sidebar-border bg-card px-2.5 py-2">
          <div className="h-8 w-8 rounded-full bg-accent/15 flex items-center justify-center">
            <span className="text-sm font-semibold text-accent">{displayName.slice(0, 1)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground truncate">
              {session.role} · <span className="font-mono">{session.activeAssignmentId}</span>
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
