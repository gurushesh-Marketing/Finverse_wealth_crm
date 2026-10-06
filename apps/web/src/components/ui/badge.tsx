import { cn } from 'cn';
import type { ReactNode } from 'react';

const styles: Record<string, string> = {
  open: 'bg-[#DCEEEA] text-[#155451]',
  overdue: 'bg-[#C2413B]/10 text-[#C2413B]',
  today: 'bg-[#DCEEEA] text-[#155451]',
  upcoming: 'bg-[#DCEEEA] text-[#155451]',
  none: 'bg-[#DCEEEA] text-[#6B7280]',
  completed: 'bg-[#DCEEEA] text-[#6B7280]',
  simulated: 'bg-[#DCEEEA] text-[#155451]',
  manual: 'bg-[#DCEEEA] text-[#155451]',
  pending: 'bg-[#DCEEEA] text-[#155451]',
  default: 'bg-[#DCEEEA] text-[#1B1F1E]',
};

export function Badge({
  tone = 'default',
  children,
  className,
}: {
  tone?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        styles[tone] ?? styles.default,
        className
      )}
    >
      {children}
    </span>
  );
}
