import { redirect } from 'next/navigation';
import { loginAction } from './actions';
import { getSessionUser } from '@/lib/auth/session';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Sign in — Finverse Wealth CRM',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect('/');
  const { error } = await searchParams;

  return (
    <main className="min-h-dvh grid grid-cols-1 lg:grid-cols-2">
      {/* Brand field (deck reference 001) */}
      <section className="relative hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-foreground/70">
          Finverse Wealth
        </div>
        <div className="max-w-md">
          <h1 className="font-heading text-5xl font-bold tracking-tight leading-[1.05]">
            A CRM that feels like Finverse Wealth.
          </h1>
          <p className="mt-4 text-base text-primary-foreground/80">
            Ten role workspaces. Four verticals. One secure sign-in for sales and revenue.
          </p>
        </div>
        <div className="flex items-center justify-between border-t border-primary-foreground/20 pt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-foreground/60">
          <span>Finverse Wealth / Local demonstration build</span>
          <span>Illustrative records and values</span>
        </div>
      </section>

      {/* Sign-in card (deck reference 001 white card) */}
      <section className="flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm">
          <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
            <img src="/finverse-logo.png" alt="Finverse Wealth" className="h-12 w-auto" />
            <p className="mt-4 text-sm text-muted-foreground">
              Sign in to your authorized workspace.
            </p>

            <form action={loginAction} className="mt-6 space-y-4">
              {error ? (
                <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  Sign-in failed. Check the email and password and try again.
                </p>
              ) : null}
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Work email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="username"
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="name@finverse.demo"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="password" className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="••••••••"
                />
              </div>
              <Button type="submit" className="w-full">
                Sign in
              </Button>
            </form>

            <div className="mt-6 border-t border-border pt-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Demo access</p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                <li><span className="font-mono">ravi@finverse.demo</span> — Banking caller</li>
                <li><span className="font-mono">sana@finverse.demo</span> — Banking caller (other team)</li>
                <li><span className="font-mono">asha@finverse.demo</span> — Wealth caller</li>
                <li className="pt-1">Password <span className="font-mono">demo1234</span> · illustrative fixture data</li>
              </ul>
            </div>
          </div>

          <p className="mt-4 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Business policy still to confirm
          </p>
        </div>
      </section>
    </main>
  );
}
