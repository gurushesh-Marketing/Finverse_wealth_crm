'use client';

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stat cards skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="rounded-lg border border-border bg-card p-5 animate-pulse">
            <div className="flex items-start justify-between">
              <div>
                <div className="h-4 w-24 bg-muted rounded" />
                <div className="mt-3 h-8 w-32 bg-muted rounded" />
                <div className="mt-2 h-4 w-20 bg-muted rounded" />
              </div>
              <div className="h-10 w-10 rounded-lg bg-muted" />
            </div>
            <div className="mt-3 h-4 w-20 bg-muted rounded" />
          </div>
        ))}
      </div>

      {/* Pipeline & Activity skeleton */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5 animate-pulse">
          <div className="h-5 w-32 bg-muted rounded mb-4" />
          <div className="space-y-3">
            {[0, 1, 2, 3, 4, 5].map(i => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between">
                  <div className="h-4 w-24 bg-muted rounded" />
                  <div className="h-4 w-20 bg-muted rounded" />
                </div>
                <div className="h-2 bg-muted rounded-full" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-5 animate-pulse">
          <div className="h-5 w-32 bg-muted rounded mb-4" />
          <div className="space-y-3">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-muted" />
                <div className="flex-1">
                  <div className="h-4 w-24 bg-muted rounded" />
                  <div className="mt-1 h-1.5 bg-muted rounded-full" />
                </div>
                <div className="h-4 w-12 bg-muted rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Prospect status & Recent activity skeleton */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5 animate-pulse">
          <div className="h-5 w-32 bg-muted rounded mb-4" />
          <div className="space-y-3">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-3 w-3 rounded-full bg-muted" />
                <div className="h-4 w-20 bg-muted rounded" />
                <div className="flex-1 h-1.5 bg-muted rounded-full" />
                <div className="h-4 w-12 bg-muted rounded" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-5 animate-pulse">
          <div className="h-5 w-32 bg-muted rounded mb-4" />
          <div className="space-y-3">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="h-8 w-8 rounded-lg bg-muted" />
                <div className="flex-1">
                  <div className="h-4 w-40 bg-muted rounded" />
                  <div className="mt-1 h-3 w-20 bg-muted rounded" />
                </div>
                <div className="h-5 w-20 bg-muted rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}