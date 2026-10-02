'use client';

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import type { ModuleGroup } from '@/lib/modules';
import type { WorkspaceSession } from '@/lib/session';
import { X, Menu, ChevronDown, ChevronUp } from 'lucide-react';

interface MobileNavProps {
  moduleGroups: ModuleGroup[];
  session: WorkspaceSession;
  isOpen: boolean;
  onClose: () => void;
}

const emptySubscribe = () => () => {};

export function MobileNav({ moduleGroups, session, isOpen, onClose }: MobileNavProps) {
  const pathname = usePathname();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Hydration-safe "is mounted" flag: the server snapshot is false and the
  // client snapshot is true, so the first client render matches SSR and the
  // portal mounts afterwards (no typeof-document branch, no mismatch).
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

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

  const navContent = (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over panel */}
      <div className={cn(
        'fixed inset-y-0 left-0 z-50 w-72 bg-background border-r border-border',
        'flex flex-col transition-transform duration-200 ease-in-out',
        isOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Header */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-border">
          <div className="flex items-center gap-3">
            <img src="/finverse-logo.png" alt="Finverse Wealth" className="h-9 w-auto" />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-4" aria-label="Modules">
          {moduleGroups.map(group => (
            <div key={group.key} className="space-y-1">
              <button
                type="button"
                className={cn(
                  'w-full flex items-center justify-between px-2 py-1.5 text-xs font-medium uppercase tracking-wider',
                  'text-muted-foreground hover:text-foreground transition-colors',
                  'rounded-md'
                )}
                onClick={() => toggleGroup(group.key)}
                aria-expanded={isGroupExpanded(group.key)}
                aria-controls={`mobile-nav-${group.key}`}
              >
                <span>{group.label}</span>
                {isGroupExpanded(group.key) ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                )}
              </button>

              <div
                id={`mobile-nav-${group.key}`}
                role="region"
                aria-label={`${group.label} modules`}
                className={cn(
                  'overflow-hidden transition-all duration-200 ease-in-out',
                  isGroupExpanded(group.key) ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                )}
              >
                <ul className="space-y-0.5 pl-2" role="list">
                  {group.modules.map(module => {
                    const isActive = pathname === module.href || pathname.startsWith(module.href + '/');
                    return (
                      <li key={module.key}>
                        <Link
                          href={module.href}
                          className={cn(
                            'flex items-center gap-2 px-2.5 py-2 text-sm rounded-lg transition-colors',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            isActive
                              ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                              : 'text-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
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

        {/* Session info footer */}
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="h-8 w-8 rounded-full bg-accent/15 flex items-center justify-center">
              <span className="text-sm font-semibold text-accent">
                {session.employeeId.slice(-3)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {session.role} • {session.verticalGrants.join(', ')}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {session.activeAssignmentId}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(navContent, document.body);
}

/**
 * Mobile nav trigger button for the top bar.
 */
export function MobileNavTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="lg:hidden p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      aria-label="Open navigation menu"
      aria-expanded="false"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}
