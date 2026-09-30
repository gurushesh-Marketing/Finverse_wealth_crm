'use client';

import { AlertCircle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md space-y-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4">
          <AlertCircle className="h-5 w-5" aria-hidden="true" />
        </div>
        <h1 className="text-3xl font-heading font-semibold text-foreground">
          Something went wrong.
        </h1>
        <p className="text-muted-foreground">
          We&apos;re sorry, but an unexpected error occurred. Please try again later.
        </p>
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 rounded-lg border border-muted bg-muted/50 p-4 text-left text-sm">
            <h2 className="font-medium text-foreground mb-2">Technical details:</h2>
            <p className="font-mono text-xs">{error.message}</p>
            {error.digest && (
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                Digest: {error.digest}
              </p>
            )}
          </div>
        )}
        <button
          onClick={reset}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
        >
          <svg className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-11.18 0m0 0A8.003 8.003 0 004.582 16m0 0A8.003 8.003 0 0112.582 8m0 0H7m11 11v5" />
          </svg>
          Try again
        </button>
      </div>
    </div>
  );
}