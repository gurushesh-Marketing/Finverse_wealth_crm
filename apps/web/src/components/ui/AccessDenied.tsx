import { cn } from '@/lib/utils';
import { ShieldAlert } from 'lucide-react';

interface AccessDeniedProps {
  resource: string;
  className?: string;
}

export function AccessDenied({ resource, className }: AccessDeniedProps) {
  return (
    <div className={cn('rounded-lg border border-destructive/20 bg-destructive/5 p-8 text-center', className)}>
      <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
        <ShieldAlert className="h-6 w-6 text-destructive" aria-hidden="true" />
      </div>
      <h3 className="text-lg font-heading font-semibold text-destructive mb-2">
        Access Denied
      </h3>
      <p className="text-muted-foreground mb-4">
        You do not have permission to view <strong>{resource}</strong>.
      </p>
      <p className="text-sm text-muted-foreground">
        Your current role ({resource.includes('Wealth') ? 'SC' : 'your role'}) and vertical grants
        do not include access to this module. Contact your administrator if you believe this is an error.
      </p>
    </div>
  );
}