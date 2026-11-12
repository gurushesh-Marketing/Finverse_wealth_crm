import { useState, type FormEvent } from 'react';
import { useSession } from '../../lib/session';
import { api, ApiError } from '../../lib/api';
import { Button } from '../ui/button';
import { FieldError, Input, Label } from '../ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Lock, ShieldAlert, LogOut } from 'lucide-react';

export function FirstLoginPasswordModal() {
  const { session, reload, logout } = useSession();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!session?.mustChangePassword) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    const errors: Record<string, string[]> = {};
    if (!password || password.length < 8) {
      errors.password = ['Password must be at least 8 characters.'];
    }
    if (password !== confirmPassword) {
      errors.confirmPassword = ['Passwords do not match.'];
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setSubmitting(false);
      return;
    }

    try {
      await api.changePassword(password);
      await reload();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'VALIDATION_FAILED' && err.fieldErrors) {
          setFieldErrors(err.fieldErrors);
        } else {
          setFormError(err.message);
        }
      } else {
        setFormError('Failed to change password. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
      <Card className="w-full max-w-md shadow-2xl border-slate-200 bg-white dark:bg-slate-900">
        <CardHeader className="flex flex-col items-center text-center gap-2 pt-6 pb-2">
          <div className="size-12 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mb-1">
            <Lock className="size-6" />
          </div>
          <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Initial Login: Password Change Required
          </CardTitle>
          <p className="text-xs text-muted-foreground max-w-sm">
            For security, newly activated accounts must replace their one-time temporary password before accessing Finverse CRM.
          </p>
        </CardHeader>

        <CardContent className="pt-2 pb-6 space-y-4">
          <div className="rounded-md bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2">
            <ShieldAlert className="size-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              Signed in as <span className="font-semibold text-slate-900 dark:text-white">{session.displayName}</span> ({session.role} · {session.verticalGrants.join(', ') || 'Finverse'}). Choose a strong password with at least 8 characters.
            </div>
          </div>

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <div>
              <Label htmlFor="first-password">New Permanent Password</Label>
              <Input
                id="first-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                aria-invalid={fieldErrors.password ? true : undefined}
                className="mt-1"
              />
              <FieldError>{fieldErrors.password?.[0]}</FieldError>
            </div>

            <div>
              <Label htmlFor="first-confirm-password">Confirm Permanent Password</Label>
              <Input
                id="first-confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                aria-invalid={fieldErrors.confirmPassword ? true : undefined}
                className="mt-1"
              />
              <FieldError>{fieldErrors.confirmPassword?.[0]}</FieldError>
            </div>

            {formError && (
              <div
                role="alert"
                className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive font-medium"
              >
                {formError}
              </div>
            )}

            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#113F3D] hover:bg-[#0c2e2c] text-white"
            >
              {submitting ? 'Updating Password…' : 'Update Password & Enter Workspace'}
            </Button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => logout()}
                className="text-xs text-muted-foreground hover:text-slate-900 flex items-center justify-center gap-1 mx-auto"
              >
                <LogOut className="size-3" /> Sign out instead
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
