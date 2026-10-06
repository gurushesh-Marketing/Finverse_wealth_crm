import { lazy, Suspense, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useSession } from '../lib/session';
import { api, ApiError } from '../lib/api';
import { landingPath } from '../lib/modules';
import { Button } from '../components/ui/button';
import { FieldError, Input, Label } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { DeniedPanel, Splash } from '../components/ui/states';

// TEMPORARY demo directory: dev or explicit demo builds only (production handover: remove).
// The false branch is dead-code-eliminated, so production assets exclude the credential list.
const DemoAccessPanel =
  import.meta.env.DEV || import.meta.env.VITE_DEMO_ACCESS === 'true'
    ? lazy(() => import('../components/auth/DemoAccessPanel'))
    : null;

export function LoginPage() {
  const { session, loading, login } = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [saving, setSaving] = useState(false);

  if (loading) return <Splash />;
  if (session) return <Navigate to={landingPath(session)} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    setFieldErrors({});
    const errors: Record<string, string[]> = {};
    if (!email.trim()) errors.email = ['Enter your work email.'];
    if (!password) errors.password = ['Enter your password.'];
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setSaving(false);
      return;
    }
    try {
      await login(email.trim(), password);
      const me = await api.me();
      navigate(landingPath(me.session), { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'FORBIDDEN') setDenied(true);
        else if (err.code === 'VALIDATION_FAILED') setFieldErrors(err.fieldErrors ?? {});
        else setFormError(err.message);
      } else {
        setFormError("We couldn't sign you in. Check your email and password.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-background px-4 py-8 lg:flex-row lg:items-start">
      <Card className="w-full max-w-sm">
        <CardHeader className="flex flex-col items-center gap-3 py-6">
          <img src="/finverse-logo.png" alt="Finverse" className="h-12 w-auto" />
          <CardTitle className="text-xl font-bold">Sign in to Finverse</CardTitle>
        </CardHeader>
        <CardContent className="py-6">
          {denied ? (
            <DeniedPanel
              title="No active workspace"
              message="Your account has no active workspace. Contact your administrator."
            />
          ) : (
            <form onSubmit={onSubmit} noValidate className="space-y-4">
              <div>
                <Label htmlFor="email">Work email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  aria-invalid={fieldErrors.email ? true : undefined}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <FieldError>{fieldErrors.email?.[0]}</FieldError>
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  aria-invalid={fieldErrors.password ? true : undefined}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <FieldError>{fieldErrors.password?.[0]}</FieldError>
              </div>
              {formError ? (
                <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {formError}
                </div>
              ) : null}
              <Button type="submit" className="w-full" disabled={saving} aria-busy={saving}>
                {saving ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
      {DemoAccessPanel ? (
        <Suspense fallback={null}>
          <DemoAccessPanel
            onUse={(e, p) => {
              setEmail(e);
              setPassword(p);
              setFieldErrors({});
              setFormError(null);
            }}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
