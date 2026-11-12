import { useState, type FormEvent } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { Button } from '../components/ui/button';
import { FieldError, Input, Label } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

export function ActivateAccountPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tokenFromUrl = searchParams.get('token') ?? '';

  const [token, setToken] = useState(tokenFromUrl);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    const errors: Record<string, string[]> = {};
    if (!token.trim()) errors.token = ['Activation token is required.'];
    if (!password || password.length < 8) errors.password = ['Password must be at least 8 characters.'];
    if (password !== confirmPassword) errors.confirmPassword = ['Passwords do not match.'];

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setSubmitting(false);
      return;
    }

    try {
      await api.activate(token.trim(), password);
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'VALIDATION_FAILED' && err.fieldErrors) {
          setFieldErrors(err.fieldErrors);
        } else {
          setFormError(err.message);
        }
      } else {
        setFormError('Failed to activate account. The invitation may be expired or already used.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-background px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-col items-center text-center gap-2 py-6">
          <img src="/finverse-logo.png" alt="Finverse" className="h-12 w-auto" />
          <CardTitle className="text-xl font-bold">Activate Your Account</CardTitle>
          <p className="text-sm text-muted-foreground">
            Complete your invitation by setting your secure account credentials.
          </p>
        </CardHeader>
        <CardContent className="py-6">
          {success ? (
            <div className="space-y-4 text-center">
              <div className="rounded-md bg-emerald-500/10 p-4 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                <p className="font-semibold text-base">Account Activated Successfully</p>
                <p className="text-sm mt-1">
                  Your credentials have been securely provisioned. You can now sign in to your authorized workspace.
                </p>
              </div>
              <Button
                type="button"
                className="w-full"
                onClick={() => navigate('/login', { replace: true })}
              >
                Continue to Sign In
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate className="space-y-4">
              <div>
                <Label htmlFor="token">Activation Token</Label>
                <Input
                  id="token"
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste your activation token"
                  aria-invalid={fieldErrors.token ? true : undefined}
                />
                <FieldError>{fieldErrors.token?.[0]}</FieldError>
              </div>
              <div>
                <Label htmlFor="password">Set Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  aria-invalid={fieldErrors.password ? true : undefined}
                />
                <FieldError>{fieldErrors.password?.[0]}</FieldError>
              </div>
              <div>
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  aria-invalid={fieldErrors.confirmPassword ? true : undefined}
                />
                <FieldError>{fieldErrors.confirmPassword?.[0]}</FieldError>
              </div>

              {formError ? (
                <div
                  role="alert"
                  className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive font-medium"
                >
                  {formError}
                </div>
              ) : null}

              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? 'Activating Account…' : 'Activate Account & Set Password'}
              </Button>

              <div className="text-center pt-2">
                <Link to="/login" className="text-xs text-muted-foreground hover:underline">
                  Return to Sign In
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
