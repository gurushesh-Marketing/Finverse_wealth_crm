import { useState } from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  DEMO_EXECUTIVE_GROUP,
  DEMO_GROUPS,
  DEMO_PASSWORD,
  STATUS_LABEL,
  type DemoAccount,
  type DemoGroup,
} from '../../lib/demo-accounts';

interface Handlers {
  onUse: (email: string, password: string) => void;
  copy: (label: string, value: string) => void;
}

function AccountRow({ a, onUse, copy }: Handlers & { a: DemoAccount }) {
  return (
    <li className="grid gap-2 border-t border-border py-3 first:border-t-0 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0 space-y-0.5 text-sm">
        <p className="font-medium text-foreground">
          {a.role} · {a.name}
        </p>
        <p className="text-xs text-muted-foreground">{a.scope}</p>
        <p className="flex flex-wrap items-center gap-x-2 text-xs">
          <span className="break-all font-mono text-foreground">{a.email}</span>
          <span className="text-muted-foreground">/</span>
          <span className="font-mono text-foreground">{DEMO_PASSWORD}</span>
        </p>
        <Badge tone={a.status === 'implemented' ? 'simulated' : 'pending'}>{STATUS_LABEL[a.status]}</Badge>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" onClick={() => onUse(a.email, DEMO_PASSWORD)} aria-label={`Use account ${a.name}, ${a.role}`}>
          Use this account
        </Button>
        <Button size="sm" variant="outline" onClick={() => copy('Email', a.email)} aria-label={`Copy email for ${a.name}`}>
          Copy email
        </Button>
        <Button size="sm" variant="outline" onClick={() => copy('Password', DEMO_PASSWORD)} aria-label={`Copy password for ${a.name}`}>
          Copy password
        </Button>
      </div>
    </li>
  );
}

function Group({ g, defaultOpen, ...h }: Handlers & { g: DemoGroup; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="rounded-md border border-border px-3">
      <summary className="cursor-pointer py-2 text-sm font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-ring">
        {g.title}
      </summary>
      <div className="pb-2">
        {g.roles.map((r) =>
          r.accounts.length > 0 ? (
            <ul key={r.role}>
              {r.accounts.map((a) => (
                <AccountRow key={a.email} a={a} {...h} />
              ))}
            </ul>
          ) : (
            <p key={r.role} className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-2 text-sm first:border-t-0">
              <span className="text-foreground">{r.role}</span>
              <Badge tone="none">{STATUS_LABEL['not-implemented']}</Badge>
            </p>
          )
        )}
      </div>
    </details>
  );
}

/** TEMPORARY — see docs/process/PRODUCTION_HANDOVER.md. Only populates the normal login form. */
export default function DemoAccessPanel({ onUse }: { onUse: (email: string, password: string) => void }) {
  const [notice, setNotice] = useState('');

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(`${label} copied`);
    } catch {
      setNotice(`Copy blocked by the browser — select the ${label.toLowerCase()} manually`);
    }
  }

  return (
    <Card className="w-full max-w-xl" aria-labelledby="demo-access-title">
      <CardHeader className="py-4">
        <CardTitle id="demo-access-title" className="text-base font-bold">
          Demo access — synthetic accounts
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Temporary, development/demo only. Choosing an account fills the sign-in form; you still sign in normally and the
          server decides access.
        </p>
      </CardHeader>
      <CardContent className="space-y-2 pb-4">
        {DEMO_GROUPS.map((g, i) => (
          <Group key={g.id} g={g} defaultOpen={i === 0} onUse={onUse} copy={copy} />
        ))}
        <Group g={DEMO_EXECUTIVE_GROUP} onUse={onUse} copy={copy} />
        <p role="status" aria-live="polite" className="min-h-4 text-xs text-muted-foreground">
          {notice}
        </p>
      </CardContent>
    </Card>
  );
}
