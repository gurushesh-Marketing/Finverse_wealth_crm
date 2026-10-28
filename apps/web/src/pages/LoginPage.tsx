import { lazy, Suspense, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { useSession } from '../lib/session';
import { api, ApiError } from '../lib/api';
import { landingPath } from '../lib/modules';
import { Button } from '../components/ui/button';
import { FieldError, Input, Label } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { DeniedPanel, Splash } from '../components/ui/states';
import { KeyRound, ArrowLeft, Mail, ExternalLink, ShieldCheck } from 'lucide-react';

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

  // Forgot password flow state
  const [showForgot, setShowForgot] = useState(false);
  const [forgotIdentity, setForgotIdentity] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [devOutboxLinks, setDevOutboxLinks] = useState<any[]>([]);

  if (loading) return <Splash />;
  if (session) return <Navigate to={landingPath(session)} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    setFieldErrors({});
    const errors: Record<string, string[]> = {};
    if (!email.trim()) errors.email = ['Enter your work email or username.'];
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
        setFormError("We couldn't sign you in. Check your email/username and password.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function onForgotSubmit(e: FormEvent) {
    e.preventDefault();
    setForgotSubmitting(true);
    setForgotError(null);
    setForgotMessage(null);
    if (!forgotIdentity.trim()) {
      setForgotError('Enter your work email or username.');
      setForgotSubmitting(false);
      return;
    }

    try {
      const res = await api.forgotPassword(forgotIdentity.trim());
      setForgotMessage(
        res.data?.message ??
          'If an active account matches the details provided, a password reset link has been dispatched to the registered address.'
      );

      // In local dev/demo mode, retrieve the local delivery outbox for immediate manual testing
      if (import.meta.env.DEV || import.meta.env.VITE_DEMO_ACCESS === 'true') {
        try {
          const out = await api.localDelivery(5);
          setDevOutboxLinks(out.data || []);
        } catch {
          // non-fatal
        }
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === 'RATE_LIMITED') {
        setForgotError(err.message);
      } else {
        // Enforce neutral response even on generic failure to prevent enumeration
        setForgotMessage(
          'If an active account matches the details provided, a password reset link has been dispatched to the registered address.'
        );
      }
    } finally {
      setForgotSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-background px-4 py-8 lg:flex-row lg:items-start">
      <Card className="w-full max-w-sm border-slate-200 shadow-md">
        <CardHeader className="flex flex-col items-center gap-3 py-6 text-center">
          <img src="/finverse-logo.png" alt="Finverse" className="h-12 w-auto" />
          <CardTitle className="text-xl font-bold">
            {showForgot ? 'Reset Your Password' : 'Sign in to Finverse'}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {showForgot
              ? 'Enter your work email or username to receive a secure, single-use recovery link.'
              : 'Institutional Wealth, Banking, Markets & Real Estate CRM'}
          </p>
        </CardHeader>
        <CardContent className="py-4">
          {denied ? (
            <DeniedPanel
              title="No active workspace"
              message="Your account has no active workspace. Contact your administrator."
            />
          ) : showForgot ? (
            <div className="space-y-4">
              {forgotMessage ? (
                <div className="space-y-3">
                  <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/40 p-3.5 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
                    <div className="font-semibold flex items-center gap-1.5">
                      <ShieldCheck className="size-4 text-emerald-600 shrink-0" />
                      Request Processed
                    </div>
                    <p>{forgotMessage}</p>
                  </div>

                  {/* Dev-Only Inspection Notice */}
                  {(import.meta.env.DEV || import.meta.env.VITE_DEMO_ACCESS === 'true') && (
                    <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200 space-y-2">
                      <div className="font-bold flex items-center gap-1 text-[11px] uppercase tracking-wider text-amber-800">
                        <Mail className="size-3.5" />
                        Local Delivery Adapter (Demo: No External Email Service)
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        In local evaluation mode, external email sending is not configured. The single-use reset token has been registered in the database audit log.
                      </p>
                      {devOutboxLinks.length > 0 && (
                        <div className="pt-1 border-t border-amber-200 dark:border-amber-800/50 space-y-1.5">
                          <div className="text-[10px] font-semibold uppercase text-amber-800">Recent Reset Links:</div>
                          {devOutboxLinks.slice(0, 2).map((item) => (
                            <div key={item.id} className="flex items-center justify-between gap-2 bg-white/70 dark:bg-slate-900/60 p-1.5 rounded border border-amber-200/80 text-[11px]">
                              <span className="truncate font-mono text-[10px]">{item.recipient_email}</span>
                              <Link
                                to={item.action_url}
                                className="font-semibold text-emerald-700 hover:underline flex items-center gap-1 shrink-0"
                              >
                                Open link <ExternalLink className="size-3" />
                              </Link>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full text-xs"
                    onClick={() => {
                      setShowForgot(false);
                      setForgotMessage(null);
                      setForgotError(null);
                    }}
                  >
                    <ArrowLeft className="size-3.5 mr-1" /> Return to Sign In
                  </Button>
                </div>
              ) : (
                <form onSubmit={onForgotSubmit} noValidate className="space-y-4">
                  <div>
                    <Label htmlFor="forgot-identity">Work email or username</Label>
                    <Input
                      id="forgot-identity"
                      type="text"
                      autoComplete="username"
                      placeholder="e.g. asha.sc@finverse.demo or asha"
                      value={forgotIdentity}
                      onChange={(e) => setForgotIdentity(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  {forgotError && (
                    <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                      {forgotError}
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full bg-[#113F3D] hover:bg-[#0c2e2c] text-white"
                    disabled={forgotSubmitting}
                  >
                    {forgotSubmitting ? 'Sending Request…' : 'Send Password Reset Link'}
                  </Button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgot(false);
                        setForgotError(null);
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 mx-auto"
                    >
                      <ArrowLeft className="size-3" /> Back to sign in
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate className="space-y-4">
              <div>
                <Label htmlFor="email">Work email or username</Label>
                <Input
                  id="email"
                  type="text"
                  autoComplete="username"
                  value={email}
                  aria-invalid={fieldErrors.email ? true : undefined}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. dev.sc@finverse.demo or dev"
                  className="mt-1"
                />
                <FieldError>{fieldErrors.email?.[0]}</FieldError>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgot(true);
                      setForgotIdentity(email.trim());
                      setForgotMessage(null);
                      setForgotError(null);
                    }}
                    className="text-xs text-emerald-800 dark:text-emerald-400 hover:underline font-medium"
                  >
                    Forgot password?
                  </button>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  aria-invalid={fieldErrors.password ? true : undefined}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1"
                />
                <FieldError>{fieldErrors.password?.[0]}</FieldError>
              </div>
              {formError ? (
                <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  {formError}
                </div>
              ) : null}
              <Button type="submit" className="w-full bg-[#113F3D] hover:bg-[#0c2e2c] text-white" disabled={saving} aria-busy={saving}>
                {saving ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
      {DemoAccessPanel && !showForgot ? (
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
