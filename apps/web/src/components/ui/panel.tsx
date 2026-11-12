import { useEffect, type ReactNode } from 'react';
import { cn } from 'cn';
import { X } from 'lucide-react';
import { Button } from './button';

export function Panel({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-foreground/30" onClick={onClose} aria-hidden="true" />
      <div
        className={cn(
          'absolute inset-y-0 right-0 flex w-full max-w-[28rem] flex-col bg-background shadow-xl',
          'max-sm:inset-x-0 max-sm:top-auto max-sm:bottom-0 max-sm:max-w-none max-sm:rounded-t-2xl max-sm:max-h-[85dvh]'
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-md p-2 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer ? <div className="border-t border-border px-4 py-3">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-foreground/30" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-md rounded-t-2xl bg-background p-4 shadow-xl sm:rounded-lg">
        <h2 className="mb-3 text-base font-semibold text-foreground">{title}</h2>
        {children}
        {footer ? <div className="mt-4 flex justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}

export function FormRow({
  label,
  htmlFor,
  children,
  error,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
  error?: string;
}) {
  return (
    <div className="mb-3">
      <label htmlFor={htmlFor} className="mb-1 block text-[13px] font-medium text-foreground">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="mt-1 text-[13px] text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function ActionBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>;
}

export function SimulatedChip() {
  return (
    <span className="inline-flex items-center rounded-full bg-[#DCEEEA] px-2 py-0.5 text-xs italic text-[#6B7280]">
      SIMULATED — no provider integration
    </span>
  );
}

export function LiveStatus({ children }: { children: ReactNode }) {
  return (
    <div aria-live="polite" role="status" className="text-sm text-foreground">
      {children}
    </div>
  );
}

export function BusyButton({
  busy,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { busy?: boolean }) {
  return (
    <Button {...props} disabled={busy || props.disabled} aria-busy={busy}>
      {busy ? 'Saving…' : children}
    </Button>
  );
}
