import { cn } from 'cn';
import type { ReactNode } from 'react';
import { Button } from './button';

export function Splash() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background">
      <div role="status" aria-live="polite" className="text-sm text-muted-foreground">
        Loading your workspace…
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-md bg-muted', className)} />;
}

export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="space-y-2">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-secondary/40 px-6 py-10 text-center">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ onRetry, message }: { onRetry: () => void; message?: string }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-6 text-center"
    >
      <p className="text-sm font-medium text-destructive">
        {message ?? 'Something went wrong. Try again.'}
      </p>
      <div className="mt-3 flex justify-center">
        <Button variant="outline" onClick={onRetry}>
          Retry
        </Button>
      </div>
    </div>
  );
}

export function DeniedPanel({
  title = "You don't have access to this record",
  message = "It is outside your current scope.",
  action,
}: {
  title?: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-border bg-secondary/40 px-6 py-10 text-center"
    >
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function SuccessNote({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-accent">
      {children}
    </div>
  );
}
