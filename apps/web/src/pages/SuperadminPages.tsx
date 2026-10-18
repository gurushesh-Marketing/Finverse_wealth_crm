import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ShieldCheck,
  Lock,
  MoreHorizontal,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  UserPlus,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  FileText,
  Clock,
  Layers,
  Database,
  Users,
  Building,
  Check,
  X,
  Play,
  RotateCcw,
} from 'lucide-react';
import { superadminApi } from '../lib/superadmin-api';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input, Textarea } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { EmptyState, SkeletonRows } from '../components/ui/states';

interface DeckFrameProps {
  actionCode: string;
  moduleLabel: string;
  title: string;
  subtitle?: string;
  statusText?: string;
  steps: string[];
  whenCheckFails: string;
  permissionEvidence: string;
  children: ReactNode;
  onSubmit?: () => void;
  submitting?: boolean;
  submitLabel?: string;
  submitDisabled?: boolean;
}

function DeckFrame({
  actionCode,
  moduleLabel,
  title,
  subtitle = 'Company function · assigned permission scope · illustrative records',
  statusText = 'Ready for review',
  steps,
  whenCheckFails,
  permissionEvidence,
  children,
  onSubmit,
  submitting = false,
  submitLabel = 'Continue →',
  submitDisabled = false,
}: DeckFrameProps) {
  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-4">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <div className="text-xs font-semibold tracking-wider text-slate-500 uppercase mb-1">
            {actionCode} / {moduleLabel}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-display">
            {title}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Badge className="gap-1.5 py-1 px-3 text-xs bg-white text-slate-700 border-slate-300 font-medium">
            <Lock className="w-3 h-3 text-slate-500" />
            Scoped action
          </Badge>
          <button
            type="button"
            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
            aria-label="More options"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Grid: Work Area (left) + Right Rail Cards (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Primary Work Area */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
            {/* Card Status Header */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100 bg-slate-50/50 text-xs">
              <div className="flex items-center gap-2 font-medium text-slate-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {statusText}
              </div>
              <span className="text-slate-400">Updated 09:42 IST</span>
            </div>

            {/* Inner Content */}
            <CardContent className="p-6">
              <div className="text-xs font-semibold tracking-wider text-slate-400 uppercase mb-4">
                WORK AREA
              </div>
              {children}
            </CardContent>

            {/* Bottom Card Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-slate-100 bg-slate-50/40">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Current role and scope checked on submit</span>
              </div>
              {onSubmit && (
                <Button
                  onClick={onSubmit}
                  disabled={submitDisabled || submitting}
                  className="w-full sm:w-auto bg-[#113F3D] hover:bg-[#0C2B29] text-white px-6 font-medium shadow-sm transition-all"
                >
                  {submitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  {submitLabel}
                </Button>
              )}
            </div>
          </Card>
        </div>

        {/* Right Rail: Canonical Action Deck Knowledge Panels */}
        <div className="lg:col-span-4 space-y-4">
          {/* Card 1: How this works */}
          <Card className="border-slate-200/90 shadow-sm bg-white p-5 space-y-4">
            <div className="border-b border-slate-100 pb-2">
              <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                HOW THIS WORKS
              </div>
              <div className="text-sm font-semibold text-slate-900 mt-0.5">
                Your next steps
              </div>
            </div>
            <div className="space-y-3">
              {steps.map((step, idx) => (
                <div key={idx} className="flex items-start gap-3 text-xs leading-relaxed text-slate-600">
                  <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-mono font-medium flex items-center justify-center shrink-0 text-[10px] border border-slate-200">
                    {String(idx + 1).padStart(2, '0')}
                  </div>
                  <div>{step}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* Card 2: When a check fails */}
          <Card className="border-slate-200/90 shadow-sm bg-white p-5 space-y-2">
            <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              WHEN A CHECK FAILS
            </div>
            <p className="text-xs leading-relaxed text-slate-600">
              {whenCheckFails}
            </p>
          </Card>

          {/* Card 3: Permission & evidence */}
          <Card className="border-slate-200/90 shadow-sm bg-white p-5 space-y-2">
            <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              PERMISSION & EVIDENCE
            </div>
            <p className="text-xs leading-relaxed text-slate-600">
              {permissionEvidence}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// 1. Superadmin Overview Page
// =============================================================================
export function SuperadminOverviewPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    superadminApi.getOverview()
      .then(setData)
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8"><SkeletonRows rows={6} /></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">
      {/* Overview Banner */}
      <div className="border-b border-slate-200 pb-4">
        <div className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
          WORKSPACE / SUPER ADMIN
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-display mt-1">
          Identity, Scopes & Administrative Governance
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          System provisioning health, cycle-free hierarchy, and cross-vertical access controls.
        </p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 border-slate-200 shadow-sm bg-white">
          <div className="text-xs text-slate-500 font-medium">Total Employees</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">{data?.totalEmployees ?? 0}</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">Directory active</div>
        </Card>
        <Card className="p-4 border-slate-200 shadow-sm bg-white">
          <div className="text-xs text-slate-500 font-medium">Active Assignments</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">{data?.activeAssignments ?? 0}</div>
          <div className="text-[11px] text-slate-500 mt-1">Role/scope partitioned</div>
        </Card>
        <Card className="p-4 border-slate-200 shadow-sm bg-white">
          <div className="text-xs text-slate-500 font-medium">Pending Lifecycle Moves</div>
          <div className="text-2xl font-bold text-amber-600 mt-1 font-mono">{data?.pendingTransfers ?? 0}</div>
          <div className="text-[11px] text-slate-500 mt-1">Awaiting activation</div>
        </Card>
        <Card className="p-4 border-slate-200 shadow-sm bg-white">
          <div className="text-xs text-slate-500 font-medium">Active Audit Incidents</div>
          <div className="text-2xl font-bold text-rose-600 mt-1 font-mono">{data?.activeIncidents ?? 0}</div>
          <div className="text-[11px] text-slate-500 mt-1">Restricted review queue</div>
        </Card>
      </div>

      {/* Quick Modules Directory */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold tracking-wider text-slate-700 uppercase">
          Administrative Modules
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <a
            href="/superadmin/employees"
            className="p-4 rounded-lg border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition block space-y-1"
          >
            <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
              <Users className="w-4 h-4 text-emerald-700" />
              Employees & Users
            </div>
            <div className="text-xs text-slate-500">SA-01 Account Provisioning · SA-07 Account Recovery</div>
          </a>

          <a
            href="/superadmin/scopes"
            className="p-4 rounded-lg border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition block space-y-1"
          >
            <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              Roles & Scopes
            </div>
            <div className="text-xs text-slate-500">SA-02 Organisation Scope · SA-03 Additional Teams · SA-11 Delegations</div>
          </a>

          <a
            href="/superadmin/organisation"
            className="p-4 rounded-lg border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition block space-y-1"
          >
            <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
              <Building className="w-4 h-4 text-emerald-700" />
              Organisation Hierarchy
            </div>
            <div className="text-xs text-slate-500">SA-04 Cycle-free Reporting Hierarchy & Edges</div>
          </a>

          <a
            href="/superadmin/lifecycle"
            className="p-4 rounded-lg border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition block space-y-1"
          >
            <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
              <ArrowRight className="w-4 h-4 text-emerald-700" />
              Lifecycle Changes
            </div>
            <div className="text-xs text-slate-500">SA-05 Transfers & Promotions · SA-06 Offboarding & Holding</div>
          </a>

          <a
            href="/superadmin/configuration"
            className="p-4 rounded-lg border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition block space-y-1"
          >
            <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
              <FileText className="w-4 h-4 text-emerald-700" />
              Business Configuration
            </div>
            <div className="text-xs text-slate-500">SA-08 Versioned Rules, SLAs & Routing Calendars</div>
          </a>

          <a
            href="/superadmin/audit"
            className="p-4 rounded-lg border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition block space-y-1"
          >
            <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
              <Lock className="w-4 h-4 text-emerald-700" />
              Audit & Incidents
            </div>
            <div className="text-xs text-slate-500">SA-09 Restricted Audit Logs & Anomaly Actions</div>
          </a>

          <a
            href="/superadmin/health"
            className="p-4 rounded-lg border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition block space-y-1"
          >
            <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
              <Database className="w-4 h-4 text-emerald-700" />
              System Health
            </div>
            <div className="text-xs text-slate-500">SA-10 Bounded Job Retries & DeadLetter Queues</div>
          </a>
        </div>
      </div>

      {/* Recent System Audit Ledger */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold tracking-wider text-slate-700 uppercase">
          Recent Audit Ledger (Immutable)
        </h2>
        <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/70 border-b border-slate-200/80 text-slate-500 font-medium">
                <tr>
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-4">Action</th>
                  <th className="py-2.5 px-4">Actor</th>
                  <th className="py-2.5 px-4">Target Entity</th>
                  <th className="py-2.5 px-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {data?.recentAuditLogs?.length ? (
                  data.recentAuditLogs.map((log: any) => (
                    <tr key={log.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-4 text-slate-500">
                        {new Date(log.occurred_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2.5 px-4 font-sans font-semibold text-slate-800">{log.action}</td>
                      <td className="py-2.5 px-4 font-sans text-slate-600">{log.actor_name || log.actor_employee_id || 'System'}</td>
                      <td className="py-2.5 px-4 text-slate-500">{log.entity_type}: {log.entity_id}</td>
                      <td className="py-2.5 px-4 text-slate-400 truncate max-w-xs">{JSON.stringify(log.details)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-slate-400 font-sans">
                      No system audit events recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

// =============================================================================
// 2. Employees & Users Page (SA-01 & SA-07)
// =============================================================================
export function SuperadminEmployeesPage() {
  const [tab, setTab] = useState<'create' | 'recovery'>('create');
  const [invitations, setInvitations] = useState<any[]>([]);
  const [recoveries, setRecoveries] = useState<any[]>([]);
  const [outbox, setOutbox] = useState<any[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // SA-01 Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [episode, setEpisode] = useState('Active');
  const [proposedRole, setProposedRole] = useState<'SC' | 'TL' | 'MG' | 'RM' | 'NM'>('SC');
  const [vertical, setVertical] = useState<'wealth' | 'banking'>('wealth');
  const [teamId, setTeamId] = useState('TEAM-WEALTH-ALPHA');

  // SA-07 Form State
  const [recEmpId, setRecEmpId] = useState('EMP-001');
  const [issueType, setIssueType] = useState<'Locked account' | 'MFA recovery' | 'Credential reset'>('Locked account');
  const [procedure, setProcedure] = useState('Verified via video call and corporate badge evidence');

  const loadLists = useCallback(() => {
    Promise.all([
      superadminApi.listInvitations(),
      superadminApi.listAccountRecoveries(),
      superadminApi.listLocalDeliveryOutbox().catch(() => []),
    ])
      .then(([invs, recs, out]) => {
        setInvitations(invs);
        setRecoveries(recs);
        setOutbox(out);
      })
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    loadLists();
  }, [loadLists]);

  const handleCreateAccount = async () => {
    if (!name || !email) {
      setMessage({ type: 'error', text: 'Name and unique work email are required.' });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await superadminApi.provisionAccount({
        employeeName: name,
        workEmail: email,
        proposedRole,
        vertical,
        teamId,
        employmentEpisode: episode as any,
        invitationExpiryHours: 48,
      });
      setMessage({
        type: 'success',
        text: `Account created for ${res.workEmail} (ID: ${res.employeeId}). Activation link token generated: ${res.rawTokenPreview}`,
      });
      setName('');
      setEmail('');
      loadLists();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Provisioning failed.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetAccess = async () => {
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await superadminApi.requestAccountRecovery({
        employeeId: recEmpId,
        issueType: issueType as any,
        identityCheckProcedure: procedure,
        revokeExistingSessions: true,
        expiryHours: 24,
      });
      setMessage({
        type: 'success',
        text: `Recovery action issued for ${res.email}. Compromised sessions revoked: ${res.sessionsRevoked}. Recovery token: ${res.recoveryTokenPreview}`,
      });
      loadLists();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Recovery issuance failed.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Subtab selection */}
      <div className="max-w-7xl mx-auto px-4 pt-4 flex gap-2">
        <Button
          variant={tab === 'create' ? 'default' : 'outline'}
          size="sm"
          onClick={() => { setTab('create'); setMessage(null); }}
          className={tab === 'create' ? 'bg-[#113F3D] text-white' : ''}
        >
          <UserPlus className="w-3.5 h-3.5 mr-1.5" />
          SA-01 Create Account & Invitation
        </Button>
        <Button
          variant={tab === 'recovery' ? 'default' : 'outline'}
          size="sm"
          onClick={() => { setTab('recovery'); setMessage(null); }}
          className={tab === 'recovery' ? 'bg-[#113F3D] text-white' : ''}
        >
          <KeyRound className="w-3.5 h-3.5 mr-1.5" />
          SA-07 Reset Account Access Safely
        </Button>
      </div>

      {message && (
        <div className="max-w-7xl mx-auto px-4">
          <div className={`p-4 rounded-lg text-sm flex items-start gap-3 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" />}
            <div>{message.text}</div>
          </div>
        </div>
      )}

      {tab === 'create' ? (
        <DeckFrame
          actionCode="SA-01"
          moduleLabel="EMPLOYEES & USERS"
          title="Create an account and activation invitation"
          steps={[
            'Open an approved joiner request and verify identity linkage.',
            'Create the account and approved initial assignment.',
            'Send an expiring activation invitation; inspect activation status.',
          ]}
          whenCheckFails="Duplicate identity or absent placement blocks activation rather than creating broad default access."
          permissionEvidence="Never reuse a leavers account for a new person. No shared password or self-chosen role at sign-in."
          onSubmit={handleCreateAccount}
          submitting={submitting}
          submitLabel="Continue →"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700">Employee</label>
              <Input
                placeholder="Verified identity (e.g. Meera Raman)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Work email</label>
              <Input
                placeholder="Unique login (e.g. meera.raman@finverse.demo)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Employment episode</label>
              <Select
                value={episode}
                onChange={(e) => setEpisode(e.target.value)}
                className="mt-1 w-full"
              >
                <option value="Active">Active episode</option>
                <option value="Scheduled">Scheduled episode</option>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Proposed role</label>
              <Select
                value={proposedRole}
                onChange={(e) => setProposedRole(e.target.value as any)}
                className="mt-1 w-full"
              >
                <option value="SC">Sales Associate (SC)</option>
                <option value="TL">Team Leader (TL)</option>
                <option value="MG">Wealth Manager (MG)</option>
                <option value="RM">Regional Manager (RM)</option>
                <option value="NM">National Manager (NM)</option>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Vertical</label>
              <Select
                value={vertical}
                onChange={(e) => setVertical(e.target.value as any)}
                className="mt-1 w-full"
              >
                <option value="wealth">Wealth Management</option>
                <option value="banking">Corporate Banking</option>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Assigned team</label>
              <Select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="mt-1 w-full"
              >
                <option value="TEAM-WEALTH-ALPHA">Wealth Alpha</option>
                <option value="TEAM-WEALTH-BETA">Wealth Beta</option>
                <option value="TEAM-BANKING-ALPHA">Banking Alpha</option>
              </Select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-700">Invitation delivery</label>
              <Input
                disabled
                value="Expiring activation token (48-hour valid link; user sets own password)"
                className="mt-1 bg-slate-50 text-slate-500"
              />
            </div>
          </div>
        </DeckFrame>
      ) : (
        <DeckFrame
          actionCode="SA-07"
          moduleLabel="EMPLOYEES & USERS"
          title="Reset account access safely"
          steps={[
            'Verify the employees identity through the approved recovery process.',
            'Issue a time-limited recovery action and revoke compromised sessions.',
            'Review completion without viewing or setting a shared employee password.',
          ]}
          whenCheckFails="Unverified requests remain blocked and route to the security owner."
          permissionEvidence="Recovery never changes role scope or bypasses inactive employment. Privileged recovery requires stronger verification."
          onSubmit={handleResetAccess}
          submitting={submitting}
          submitLabel="Issue Recovery Key →"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700">Target User</label>
              <Select
                value={recEmpId}
                onChange={(e) => setRecEmpId(e.target.value)}
                className="mt-1 w-full font-mono text-xs"
              >
                <option value="EMP-001">Asha Rao (EMP-001)</option>
                <option value="EMP-002">Ravi Menon (EMP-002)</option>
                <option value="EMP-003">Tara Iyer (EMP-003)</option>
                <option value="EMP-007">Neel Verma (EMP-007)</option>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Issue type</label>
              <Select
                value={issueType}
                onChange={(e) => setIssueType(e.target.value as any)}
                className="mt-1 w-full"
              >
                <option value="Locked account">Locked account</option>
                <option value="MFA recovery">MFA recovery</option>
                <option value="Credential reset">Credential reset</option>
                <option value="Compromised session">Compromised session</option>
              </Select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-700">Identity check procedure</label>
              <Input
                value={procedure}
                onChange={(e) => setProcedure(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-700">Sessions action</label>
              <Input
                disabled
                value="Revoke all active sessions and refresh tokens immediately on issuance"
                className="mt-1 bg-slate-50 text-slate-500"
              />
            </div>
          </div>
        </DeckFrame>
      )}

      {/* Invitations Table */}
      <div className="max-w-7xl mx-auto px-4 pt-2">
        <h3 className="text-xs font-bold tracking-wider text-slate-700 uppercase mb-2">
          Provisioned Invitations & Recovery Ledger
        </h3>
        <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Email</th>
                  <th className="py-2.5 px-4">Employee</th>
                  <th className="py-2.5 px-4">Role/Scope</th>
                  <th className="py-2.5 px-4">Expiry</th>
                  <th className="py-2.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invitations.length > 0 ? (
                  invitations.slice(0, 5).map((inv: any) => (
                    <tr key={inv.id}>
                      <td className="py-2.5 px-4 font-medium text-slate-900">{inv.work_email}</td>
                      <td className="py-2.5 px-4 text-slate-600">{inv.display_name}</td>
                      <td className="py-2.5 px-4 text-slate-600">{inv.proposed_role} · {inv.team_name}</td>
                      <td className="py-2.5 px-4 text-slate-500">{new Date(inv.expires_at).toLocaleDateString()}</td>
                      <td className="py-2.5 px-4">
                        <Badge className={`text-[10px] ${inv.invitation_status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-slate-50 text-slate-600'}`}>
                          {inv.invitation_status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-3 text-center text-slate-400">No invitations created yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Local Delivery Adapter Outbox Card (Demo: No External Email Service) */}
      <div className="max-w-7xl mx-auto px-4 pt-4 pb-8">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-xs font-bold tracking-wider text-slate-700 uppercase">
              Local Delivery Adapter Outbox
            </h3>
            <p className="text-[11px] text-slate-500">
              Demo environment: no external email provider is configured. Activation and recovery links are safely delivered to this local adapter.
            </p>
          </div>
          <Badge className="bg-amber-50 text-amber-800 border-amber-300 text-[10px]">
            Demo Adapter: No External Email Provider
          </Badge>
        </div>
        <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Recipient</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4">Subject</th>
                  <th className="py-2.5 px-4">Action Link</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {outbox.length > 0 ? (
                  outbox.map((item: any) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-4 font-mono font-medium text-slate-900">{item.recipient_email}</td>
                      <td className="py-2.5 px-4 capitalize text-slate-700">{item.delivery_type.replace('_', ' ')}</td>
                      <td className="py-2.5 px-4 text-slate-600">{item.subject}</td>
                      <td className="py-2.5 px-4 font-mono">
                        <a
                          href={item.action_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#113F3D] font-semibold underline hover:text-[#0b2b29] inline-flex items-center gap-1"
                        >
                          <span>{item.action_url}</span>
                          <ArrowRight className="w-3 h-3" />
                        </a>
                      </td>
                      <td className="py-2.5 px-4">
                        <Badge
                          className={`text-[10px] ${
                            item.consumed_at
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                          }`}
                        >
                          {item.consumed_at ? 'Consumed' : 'Pending consumption'}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4 text-slate-400 font-mono text-[11px]">
                        {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-slate-400">
                      No local delivery messages emitted yet. Create an account or issue a recovery to see delivered links here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

// =============================================================================
// 3. Roles & Scopes Page (SA-02, SA-03, SA-11)
// =============================================================================
export function SuperadminScopesPage() {
  const [tab, setTab] = useState<'sa02' | 'sa03' | 'sa11'>('sa02');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [delegations, setDelegations] = useState<any[]>([]);

  // SA-02
  const [empId, setEmpId] = useState('EMP-001');
  const [role, setRole] = useState<'TL' | 'MG' | 'RM' | 'SC'>('TL');
  const [vertical, setVertical] = useState<'wealth' | 'banking'>('wealth');
  const [allowedTeams, setAllowedTeams] = useState<string[]>(['TEAM-WEALTH-ALPHA', 'TEAM-WEALTH-BETA']);
  const [ref, setRef] = useState('REQ-AUTH-2026-088');

  // SA-03
  const [addEmpId, setAddEmpId] = useState('EMP-005'); // Meera
  const [addVertical, setAddVertical] = useState<'wealth' | 'banking'>('banking');
  const [addTeam, setAddTeam] = useState('TEAM-BANKING-ALPHA');

  useEffect(() => {
    superadminApi.listTemporaryGrants().then(setDelegations).catch(console.error);
  }, []);

  const handleGrantScope = async () => {
    setMessage(null);
    try {
      await superadminApi.grantScope({
        employeeId: empId,
        role: role as any,
        vertical: vertical as any,
        allowedTeamIds: allowedTeams,
        effectiveFrom: new Date().toISOString().split('T')[0],
        approverReference: ref,
      });
      setMessage({ type: 'success', text: `Granted ${role} scope across ${allowedTeams.join(', ')} for ${empId}. Obsolete sessions revoked.` });
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to commit scope grant.' });
    }
  };

  const handleGrantAdditional = async () => {
    setMessage(null);
    try {
      const res = await superadminApi.grantAdditionalScope({
        employeeId: addEmpId,
        additionalVertical: addVertical as any,
        additionalTeamId: addTeam,
        effectiveFrom: new Date().toISOString().split('T')[0],
        approverReference: 'ADD-SCOPE-091',
      });
      setMessage({ type: 'success', text: `Added ${addVertical} scope (${addTeam}) in retained base role ${res.role} for ${addEmpId}.` });
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to add secondary scope.' });
    }
  };

  const handleDecideDelegation = async (grantId: string, decision: 'renew' | 'revoke') => {
    try {
      await superadminApi.decideTemporaryGrant({
        grantId,
        decision,
        renewalDays: 14,
        decisionReason: decision === 'renew' ? 'Approved 14-day delegation renewal' : 'Revoked by administrator review',
      });
      setMessage({ type: 'success', text: `Delegation ${grantId} marked ${decision === 'renew' ? 'renewed' : 'revoked'}.` });
      superadminApi.listTemporaryGrants().then(setDelegations);
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Action failed.' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="max-w-7xl mx-auto px-4 pt-4 flex gap-2">
        <Button
          variant={tab === 'sa02' ? 'default' : 'outline'}
          size="sm"
          onClick={() => { setTab('sa02'); setMessage(null); }}
          className={tab === 'sa02' ? 'bg-[#113F3D] text-white' : ''}
        >
          SA-02 Precise Org Scope
        </Button>
        <Button
          variant={tab === 'sa03' ? 'default' : 'outline'}
          size="sm"
          onClick={() => { setTab('sa03'); setMessage(null); }}
          className={tab === 'sa03' ? 'bg-[#113F3D] text-white' : ''}
        >
          SA-03 Secondary Team/Vertical
        </Button>
        <Button
          variant={tab === 'sa11' ? 'default' : 'outline'}
          size="sm"
          onClick={() => { setTab('sa11'); setMessage(null); }}
          className={tab === 'sa11' ? 'bg-[#113F3D] text-white' : ''}
        >
          SA-11 Expiring Delegations
        </Button>
      </div>

      {message && (
        <div className="max-w-7xl mx-auto px-4">
          <div className={`p-4 rounded-lg text-sm flex items-start gap-3 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" />}
            <div>{message.text}</div>
          </div>
        </div>
      )}

      {tab === 'sa02' && (
        <DeckFrame
          actionCode="SA-02"
          moduleLabel="ROLES & SCOPES"
          title="Grant a role with precise organisation scope"
          steps={[
            'Choose the approved role and exact organisation nodes.',
            'Preview menus, record scope, approvals and export permissions.',
            'Commit the effective-dated grant and notify the employee.',
          ]}
          whenCheckFails="Conflicting grants or a reporting cycle block publication. Administrative authority is not a routine sales override."
          permissionEvidence="Role and scope are separate. Additional teams need explicit grants; permission preview must expose unintended unions."
          onSubmit={handleGrantScope}
          submitLabel="Commit Scope Grant →"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700">Employee</label>
                <Select value={empId} onChange={(e) => setEmpId(e.target.value)} className="mt-1 w-full font-mono text-xs">
                  <option value="EMP-001">Asha Rao (EMP-001)</option>
                  <option value="EMP-002">Ravi Menon (EMP-002)</option>
                  <option value="EMP-005">Meera Nair (EMP-005)</option>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Role</label>
                <Select value={role} onChange={(e) => setRole(e.target.value as any)} className="mt-1 w-full">
                  <option value="SC">Sales Associate</option>
                  <option value="TL">Team leader</option>
                  <option value="MG">Wealth Manager</option>
                  <option value="RM">Regional Manager</option>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700">Approver Reference</label>
                <Input value={ref} onChange={(e) => setRef(e.target.value)} className="mt-1" />
              </div>
            </div>

            {/* Effective permission scope matrix table matching Action Deck P293 */}
            <div className="border border-slate-200 rounded-lg overflow-hidden mt-4">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800">Effective permission scope</span>
                <Badge className="text-[10px] bg-white">Preview before save</Badge>
              </div>
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50/50 text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="py-2 px-4">SURFACE</th>
                    <th className="py-2 px-4">GRANT</th>
                    <th className="py-2 px-4">RECORD SCOPE</th>
                    <th className="py-2 px-4">RESULT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-2 px-4 font-medium text-slate-800">Role interface</td>
                    <td className="py-2 px-4 text-slate-600">{role} interface</td>
                    <td className="py-2 px-4 text-slate-500">Current role only</td>
                    <td className="py-2 px-4 text-emerald-600 font-semibold">Allowed</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-4 font-medium text-slate-800">Assigned team records</td>
                    <td className="py-2 px-4 text-slate-600">Explicit team grant ({allowedTeams.length} teams)</td>
                    <td className="py-2 px-4 text-slate-500">Current interval</td>
                    <td className="py-2 px-4 text-emerald-600 font-semibold">Allowed</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-4 font-medium text-slate-800">Other role interface</td>
                    <td className="py-2 px-4 text-slate-600">No grant</td>
                    <td className="py-2 px-4 text-slate-500">None</td>
                    <td className="py-2 px-4 text-rose-600 font-semibold">Denied</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-4 font-medium text-slate-800">Other vertical data</td>
                    <td className="py-2 px-4 text-slate-600">No grant</td>
                    <td className="py-2 px-4 text-slate-500">None</td>
                    <td className="py-2 px-4 text-rose-600 font-semibold">Denied</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-4 font-medium text-slate-800">Export and scheduled jobs</td>
                    <td className="py-2 px-4 text-slate-600">Inherited from active grant</td>
                    <td className="py-2 px-4 text-slate-500">Rechecked</td>
                    <td className="py-2 px-4 text-blue-600 font-semibold">Scoped</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </DeckFrame>
      )}

      {tab === 'sa03' && (
        <DeckFrame
          actionCode="SA-03"
          moduleLabel="ROLES & SCOPES"
          title="Grant a second team or vertical in the same role"
          steps={[
            'Inspect the approved additional scope and duration.',
            'Preview union and per-team filters with duplicated membership checks.',
            'Activate only the requested team/vertical scope.',
          ]}
          whenCheckFails="Revoking the added grant removes its data and queued exports immediately while preserving permitted historical reports."
          permissionEvidence="No other role menu appears. Cross-vertical TL summaries label each vertical and deduplicate overlapping facts."
          onSubmit={handleGrantAdditional}
          submitLabel="Activate Secondary Scope →"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700">Employee</label>
              <Select value={addEmpId} onChange={(e) => setAddEmpId(e.target.value)} className="mt-1 w-full font-mono text-xs">
                <option value="EMP-005">Meera Nair (EMP-005, TL)</option>
                <option value="EMP-002">Ravi Menon (EMP-002, TL)</option>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Additional Vertical</label>
              <Select value={addVertical} onChange={(e) => setAddVertical(e.target.value as any)} className="mt-1 w-full">
                <option value="banking">Corporate Banking</option>
                <option value="wealth">Wealth Management</option>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Additional Team</label>
              <Select value={addTeam} onChange={(e) => setAddTeam(e.target.value)} className="mt-1 w-full">
                <option value="TEAM-BANKING-ALPHA">Banking Alpha</option>
                <option value="TEAM-WEALTH-BETA">Wealth Beta</option>
              </Select>
            </div>
            <div className="md:col-span-3 p-3 rounded-lg bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-800">
              ✓ <strong>Role Preservation Guaranteed:</strong> The employee retains their exact interface. Cross-vertical summaries label each vertical and deduplicate overlapping facts without leaking executive or caller menus.
            </div>
          </div>
        </DeckFrame>
      )}

      {tab === 'sa11' && (
        <DeckFrame
          actionCode="SA-11"
          moduleLabel="ROLES & SCOPES"
          title="Review expiring access and temporary delegation"
          steps={[
            'Open upcoming expiries and inspect actual business need.',
            'Request renewal approval or allow scheduled expiry.',
            'Verify removal from menus, records, reports and background jobs.',
          ]}
          whenCheckFails="No response means expiry, never indefinite renewal or automatic transfer of authority."
          permissionEvidence="Delegation is role/action/scope/time limited. It cannot exceed the delegators authority or bypass independent approval."
        >
          <div className="space-y-4">
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Grant / Owner</th>
                    <th className="py-2.5 px-4">Scope</th>
                    <th className="py-2.5 px-4">Expiry</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Decision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {delegations.map((g) => (
                    <tr key={g.id}>
                      <td className="py-2.5 px-4 font-medium text-slate-900">
                        {g.employee_name} ({g.employee_id})
                        <div className="text-[11px] text-slate-400 font-normal">{g.grant_type}</div>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">{g.target_role} · {g.team_name}</td>
                      <td className="py-2.5 px-4 text-slate-500">{new Date(g.expires_at).toLocaleDateString()}</td>
                      <td className="py-2.5 px-4">
                        <Badge className="text-[10px] bg-slate-50 text-slate-700">
                          {g.current_status}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4 text-right space-x-2">
                        {g.current_status === 'active' && (
                          <>
                            <Button size="sm" variant="outline" className="h-7 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50" onClick={() => handleDecideDelegation(g.id, 'renew')}>
                              Renew 14d
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs text-rose-700 border-rose-300 hover:bg-rose-50" onClick={() => handleDecideDelegation(g.id, 'revoke')}>
                              Revoke
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </DeckFrame>
      )}
    </div>
  );
}

// =============================================================================
// 4. Organisation Hierarchy Page (SA-04)
// =============================================================================
export function SuperadminOrganisationPage() {
  const [nodes, setNodes] = useState<any[]>([]);
  const [unitName, setUnitName] = useState('');
  const [unitLevel, setUnitLevel] = useState('Manager');
  const [parentNodeId, setParentNodeId] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadHierarchy = useCallback(() => {
    superadminApi.getHierarchy('wealth').then(setNodes).catch(console.error);
  }, []);

  useEffect(() => {
    loadHierarchy();
  }, [loadHierarchy]);

  const handleRestructure = async () => {
    if (!unitName) {
      setMessage({ type: 'error', text: 'Unit name is required.' });
      return;
    }
    setMessage(null);
    try {
      await superadminApi.restructureHierarchy({
        unitName,
        vertical: 'wealth',
        unitLevel,
        parentNodeId: parentNodeId || null,
        effectiveDate: new Date().toISOString().split('T')[0],
      });
      setMessage({ type: 'success', text: `Hierarchy unit '${unitName}' published cleanly without cycles.` });
      setUnitName('');
      loadHierarchy();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Hierarchy restructuring failed.' });
    }
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <div className={`p-4 rounded-lg text-sm flex items-start gap-3 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" />}
            <div>{message.text}</div>
          </div>
        </div>
      )}

      <DeckFrame
        actionCode="SA-04"
        moduleLabel="ORGANISATION"
        title="Create or restructure the reporting hierarchy"
        steps={[
          'Create an approved unit or draft a parent/reporting change.',
          'Preview descendants, supervisor paths and permission impact.',
          'Publish the dated structure after required approval.',
        ]}
        whenCheckFails="Unresolved orphan teams or missing accountable owners block activation."
        permissionEvidence="Block cycles, invalid cross-vertical parents and ambiguous primary performance paths. Executive finance reporting is a separate relationship."
        onSubmit={handleRestructure}
        submitLabel="Publish Dated Structure →"
      >
        <div className="space-y-6">
          {/* Effective Reporting Path Visual Cards matching Action Deck P297 */}
          <div>
            <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-3">
              EFFECTIVE REPORTING PATH
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-1">
                <div className="text-[10px] text-slate-400 font-mono">01</div>
                <div className="text-xs font-semibold text-slate-900">National manager</div>
                <div className="text-[11px] text-slate-500">Vertical owner</div>
              </div>
              <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-1">
                <div className="text-[10px] text-slate-400 font-mono">02</div>
                <div className="text-xs font-semibold text-slate-900">Regional manager</div>
                <div className="text-[11px] text-slate-500">Approved parent</div>
              </div>
              <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-1">
                <div className="text-[10px] text-slate-400 font-mono">03</div>
                <div className="text-xs font-semibold text-slate-900">Manager</div>
                <div className="text-[11px] text-slate-500">Approved parent</div>
              </div>
              <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-1">
                <div className="text-[10px] text-slate-400 font-mono">04</div>
                <div className="text-xs font-semibold text-slate-900">Team leader</div>
                <div className="text-[11px] text-slate-500">Approved parent</div>
              </div>
              <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-1">
                <div className="text-[10px] text-slate-400 font-mono">05</div>
                <div className="text-xs font-semibold text-slate-900">Sales associate</div>
                <div className="text-[11px] text-slate-500">Approved parent</div>
              </div>
            </div>
            <div className="p-2.5 rounded bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 mt-3">
              Every person has one primary reporting path per effective assignment. Changes preserve historical ownership.
            </div>
          </div>

          {/* Form to add/restructure node */}
          <div className="border-t border-slate-200 pt-4 space-y-3">
            <div className="text-xs font-semibold text-slate-800">Add or Reparent Organizational Node</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-600">Unit Name</label>
                <Input value={unitName} onChange={(e) => setUnitName(e.target.value)} placeholder="e.g. South Branch Cluster" className="mt-1" />
              </div>
              <div>
                <label className="text-xs text-slate-600">Unit Level</label>
                <Select value={unitLevel} onChange={(e) => setUnitLevel(e.target.value)} className="mt-1 w-full">
                  <option value="National manager">National manager</option>
                  <option value="Regional manager">Regional manager</option>
                  <option value="Manager">Manager</option>
                  <option value="Team leader">Team leader</option>
                </Select>
              </div>
              <div>
                <label className="text-xs text-slate-600">Parent Node (Optional)</label>
                <Select value={parentNodeId} onChange={(e) => setParentNodeId(e.target.value)} className="mt-1 w-full font-mono text-xs">
                  <option value="">No parent (Root node)</option>
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>{n.unit_name} ({n.unit_level})</option>
                  ))}
                </Select>
              </div>
            </div>
          </div>
        </div>
      </DeckFrame>
    </div>
  );
}

// =============================================================================
// 5. Lifecycle Changes Page (SA-05 & SA-06)
// =============================================================================
export function SuperadminLifecyclePage() {
  const [tab, setTab] = useState<'sa05' | 'sa06'>('sa05');
  const [transfers, setTransfers] = useState<any[]>([]);
  const [selectedReq, setSelectedReq] = useState<any>(null);
  const [decision, setDecision] = useState<'approve' | 'return' | 'reject'>('approve');
  const [note, setNote] = useState('Approved within administrative authority; handoff confirmed.');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // SA-06 State
  const [offboardEmpId, setOffboardEmpId] = useState('EMP-001');
  const [reason, setReason] = useState('Approved exit with handoff verification');
  const [holdingItems, setHoldingItems] = useState<any[]>([]);

  const loadData = useCallback(() => {
    Promise.all([superadminApi.listPendingTransfers(), superadminApi.listHoldingQueues()])
      .then(([xfer, hold]) => {
        setTransfers(xfer);
        if (xfer.length > 0 && !selectedReq) setSelectedReq(xfer[0]);
        setHoldingItems(hold);
      })
      .catch(console.error);
  }, [selectedReq]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleActivateTransfer = async () => {
    if (!selectedReq) return;
    setMessage(null);
    try {
      await superadminApi.activateTransfer({
        requestId: selectedReq.id,
        decision,
        decisionNote: note,
      });
      setMessage({ type: 'success', text: `Transfer request ${selectedReq.id} decision committed: ${decision}. Prior active intervals updated.` });
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Transfer activation failed.' });
    }
  };

  const handleOffboard = async () => {
    setMessage(null);
    try {
      const res = await superadminApi.offboardEmployee({
        employeeId: offboardEmpId,
        reason,
        effectiveTime: new Date().toISOString(),
        revokeAllSessions: true,
        handoffSupervisedQueue: true,
      });
      setMessage({
        type: 'success',
        text: `Employee ${offboardEmpId} disabled immediately. Active sessions revoked: ${res.sessionsRevoked}. Work moved to holding: ${res.holdingItemsCount}.`,
      });
      loadData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Offboarding failed.' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="max-w-7xl mx-auto px-4 pt-4 flex gap-2">
        <Button
          variant={tab === 'sa05' ? 'default' : 'outline'}
          size="sm"
          onClick={() => { setTab('sa05'); setMessage(null); }}
          className={tab === 'sa05' ? 'bg-[#113F3D] text-white' : ''}
        >
          SA-05 Activate Transfer/Promotion
        </Button>
        <Button
          variant={tab === 'sa06' ? 'default' : 'outline'}
          size="sm"
          onClick={() => { setTab('sa06'); setMessage(null); }}
          className={tab === 'sa06' ? 'bg-[#113F3D] text-white' : ''}
        >
          SA-06 Disable Access & Offboarding
        </Button>
      </div>

      {message && (
        <div className="max-w-7xl mx-auto px-4">
          <div className={`p-4 rounded-lg text-sm flex items-start gap-3 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" />}
            <div>{message.text}</div>
          </div>
        </div>
      )}

      {tab === 'sa05' ? (
        <DeckFrame
          actionCode="SA-05"
          moduleLabel="LIFECYCLE CHANGES"
          title="Activate a transfer or promotion"
          steps={[
            'Review business approvals and the access/workload impact preview.',
            'Confirm the dated role and handoff plan.',
            'Activate; verify the employee now lands in the new role interface.',
          ]}
          whenCheckFails="Failed activation transaction leaves the prior valid state intact and raises an Admin incident."
          permissionEvidence="No automatic carryover of old live access. Historical personal summaries remain inside current-role reports."
          onSubmit={handleActivateTransfer}
          submitLabel="Commit Decision →"
        >
          {/* Two-Column Dual Control Layout matching Action Deck P299 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Panel: Submitted Evidence */}
            <div className="p-4 rounded-lg border border-slate-200 bg-white space-y-3">
              <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                SUBMITTED EVIDENCE
              </div>
              <div className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">
                Decision request
              </div>

              {transfers.length > 0 && (
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">Select Lifecycle Request from Queue</label>
                  <select
                    value={selectedReq?.id || ''}
                    onChange={(e) => {
                      const match = transfers.find((t) => t.id === e.target.value);
                      if (match) setSelectedReq(match);
                    }}
                    className="w-full text-xs font-mono rounded border border-slate-200 p-1.5 bg-slate-50"
                  >
                    {transfers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.id} — {t.employee_name} ({t.proposed_role} · {t.status})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedReq?.status === 'submitted' && (
                <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Pending Genuine Approval:</span> Free text does not constitute authorization. Server-side activation is blocked until verified approval is attached.
                  </div>
                </div>
              )}

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Request</span>
                  <span className="font-mono font-medium text-slate-800">
                    {selectedReq?.id || 'MOVE-081'} <span className="text-slate-400 text-[10px]">(v{selectedReq?.request_version || 1})</span>
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Employee</span>
                  <span className="font-medium text-slate-800">{selectedReq?.employee_name || 'Asha Rao'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Proposed role</span>
                  <span className="font-semibold text-emerald-700">{selectedReq?.proposed_role || 'SC'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Target team</span>
                  <span className="font-medium text-slate-800">{selectedReq?.proposed_team_name || 'Wealth Beta'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Queue status</span>
                  <span className={`font-semibold capitalize ${selectedReq?.status === 'submitted' ? 'text-amber-600' : 'text-blue-600'}`}>
                    {selectedReq?.status?.replace('_', ' ') || 'Submitted'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Handoff</span>
                  <span className="font-medium text-emerald-600">Confirmed</span>
                </div>
              </div>
              <div className="p-2.5 rounded bg-slate-50 text-[11px] text-slate-500 flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                Original request and previous decisions remain in the audit trail.
              </div>
            </div>

            {/* Right Panel: Your Authority Independent Decision */}
            <div className="p-4 rounded-lg border border-slate-200 bg-white space-y-3">
              <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                YOUR AUTHORITY
              </div>
              <div className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">
                Independent decision
              </div>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setDecision('approve')}
                  className={`w-full text-left p-2.5 rounded-lg border text-xs font-medium flex items-center justify-between transition ${decision === 'approve' ? 'border-emerald-300 bg-emerald-50/80 text-emerald-900' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                >
                  <span>✓ Approve within authority</span>
                  {decision === 'approve' && <Check className="w-4 h-4 text-emerald-600" />}
                </button>
                <button
                  type="button"
                  onClick={() => setDecision('return')}
                  className={`w-full text-left p-2.5 rounded-lg border text-xs font-medium flex items-center justify-between transition ${decision === 'return' ? 'border-amber-300 bg-amber-50/80 text-amber-900' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                >
                  <span>← Return for correction</span>
                  {decision === 'return' && <RotateCcw className="w-4 h-4 text-amber-600" />}
                </button>
                <button
                  type="button"
                  onClick={() => setDecision('reject')}
                  className={`w-full text-left p-2.5 rounded-lg border text-xs font-medium flex items-center justify-between transition ${decision === 'reject' ? 'border-rose-300 bg-rose-50/80 text-rose-900' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                >
                  <span>Reject with reason</span>
                  {decision === 'reject' && <X className="w-4 h-4 text-rose-600" />}
                </button>
              </div>
              <div className="pt-2">
                <label className="text-[11px] font-semibold text-slate-600">Decision note and evidence reference</label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="mt-1 text-xs"
                  rows={3}
                />
              </div>
              <div className="text-[10px] text-slate-400">
                Self-approval is blocked. A decision cannot exceed the current scope.
              </div>
            </div>
          </div>
        </DeckFrame>
      ) : (
        <DeckFrame
          actionCode="SA-06"
          moduleLabel="LIFECYCLE CHANGES"
          title="Disable access and complete offboarding"
          steps={[
            'Review the exit or urgent suspension authority.',
            'Disable sign-in and revoke active sessions and integration grants.',
            'Verify report schedules, approvals and work queues have accountable owners.',
          ]}
          whenCheckFails="If reassignment cannot finish immediately, access still ends and work enters a supervised holding queue."
          permissionEvidence="Account disable is immediate at the effective time. Preserve evidence and history under the approved retention policy."
          onSubmit={handleOffboard}
          submitLabel="Revoke Access & Quarantine Work →"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700">Employee to Offboard</label>
              <Select value={offboardEmpId} onChange={(e) => setOffboardEmpId(e.target.value)} className="mt-1 w-full font-mono text-xs">
                <option value="EMP-001">Asha Rao (EMP-001)</option>
                <option value="EMP-003">Tara Iyer (EMP-003)</option>
                <option value="EMP-004">Dev Kapoor (EMP-004)</option>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700">Reason</label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1" />
            </div>
            <div className="md:col-span-2 p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1">
              <div>⚠️ <strong>Immediate Session Revocation:</strong> Sign-in is locked immediately. Active JWT/session tokens are destroyed.</div>
              <div>All open leads and callback tasks enter the accountable holding queue awaiting supervisor handoff.</div>
            </div>
          </div>

          {holdingItems.length > 0 && (
            <div className="mt-6 border-t border-slate-200 pt-4">
              <div className="text-xs font-bold text-slate-700 uppercase mb-2">Accountable Holding Queue</div>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Item Type</th>
                      <th className="py-2 px-3">Item ID</th>
                      <th className="py-2 px-3">Offboarded Source</th>
                      <th className="py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {holdingItems.map((h) => (
                      <tr key={h.id}>
                        <td className="py-2 px-3 font-sans capitalize">{h.item_type}</td>
                        <td className="py-2 px-3 text-slate-700">{h.item_id}</td>
                        <td className="py-2 px-3 text-slate-500 font-sans">{h.source_employee_name}</td>
                        <td className="py-2 px-3"><Badge className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">Holding</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DeckFrame>
      )}
    </div>
  );
}

// =============================================================================
// 6. Business Configuration Page (SA-08)
// =============================================================================
export function SuperadminConfigurationPage() {
  const [configs, setConfigs] = useState<any[]>([]);
  const [key, setKey] = useState('lead_response_sla');
  const [title, setTitle] = useState('High-Net-Worth Accelerated SLA Tier');
  const [category, setCategory] = useState<'stage' | 'sla' | 'routing' | 'fiscal_calendar'>('sla');
  const [version, setVersion] = useState(3);
  const [payloadText, setPayloadText] = useState('{\n  "tier1_hours": 1,\n  "escalate_tl_hours": 2,\n  "escalate_mg_hours": 4\n}');
  const [approvedBy, setApprovedBy] = useState('Product Head (Approved Next Version)');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadConfigs = useCallback(() => {
    superadminApi.listBusinessConfigurations().then(setConfigs).catch(console.error);
  }, []);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  const handlePublish = async () => {
    setMessage(null);
    try {
      const parsedJson = JSON.parse(payloadText);
      await superadminApi.publishBusinessConfiguration({
        configKey: key,
        title,
        category,
        version: Number(version),
        effectiveDate: new Date().toISOString().split('T')[0],
        schemaPayload: parsedJson,
        approvedBy,
      });
      setMessage({ type: 'success', text: `Published rule version ${version} for '${key}'. Policy version cached and workers alerted.` });
      loadConfigs();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to publish configuration.' });
    }
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <div className={`p-4 rounded-lg text-sm flex items-start gap-3 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" />}
            <div>{message.text}</div>
          </div>
        </div>
      )}

      <DeckFrame
        actionCode="SA-08"
        moduleLabel="BUSINESS CONFIGURATION"
        title="Publish an approved rule version"
        steps={[
          'Load an approved change and validate the schema.',
          'Preview affected screens, tasks, targets and reports.',
          'Publish on schedule with a rollback plan for future configuration.',
        ]}
        whenCheckFails="Incompatible or untested changes stay in draft. Migration of active opportunities requires separate approval."
        permissionEvidence="Admin executes approved rules; they do not invent accounting policy or approve their own financial benefit."
        onSubmit={handlePublish}
        submitLabel="Publish Version →"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-700">Configuration</label>
            <Input value={key} onChange={(e) => setKey(e.target.value)} className="mt-1 font-mono text-xs" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">Version</label>
            <Input type="number" value={version} onChange={(e) => setVersion(Number(e.target.value))} className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">Rule Category</label>
            <Select value={category} onChange={(e) => setCategory(e.target.value as any)} className="mt-1 w-full">
              <option value="sla">SLA & Escalations</option>
              <option value="routing">Routing & Distribution</option>
              <option value="stage">Pipeline Stages</option>
              <option value="fiscal_calendar">Fiscal Calendar</option>
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700">Approvals Reference</label>
            <Input value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} className="mt-1" />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-slate-700">Schema Payload (JSON)</label>
            <Textarea
              value={payloadText}
              onChange={(e) => setPayloadText(e.target.value)}
              className="mt-1 font-mono text-xs"
              rows={4}
            />
          </div>
        </div>

        {/* Existing Versions History */}
        <div className="mt-6 border-t border-slate-200 pt-4">
          <div className="text-xs font-bold text-slate-700 uppercase mb-2">Version History Ledger</div>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3">Key</th>
                  <th className="py-2 px-3">Title</th>
                  <th className="py-2 px-3">Version</th>
                  <th className="py-2 px-3">Effective Date</th>
                  <th className="py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {configs.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2 px-3 text-slate-900 font-medium">{c.config_key}</td>
                    <td className="py-2 px-3 font-sans text-slate-700">{c.title}</td>
                    <td className="py-2 px-3 text-slate-600">v{c.version}</td>
                    <td className="py-2 px-3 text-slate-500">{c.effective_date}</td>
                    <td className="py-2 px-3">
                      <Badge className={`text-[10px] ${c.status === 'published' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                        {c.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </DeckFrame>
    </div>
  );
}

// =============================================================================
// 7. Audit & Incidents Page (SA-09)
// =============================================================================
export function SuperadminAuditPage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedInc, setSelectedInc] = useState<any>(null);
  const [actionNote, setActionNote] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadIncidents = useCallback(() => {
    superadminApi.listAuditIncidents(search).then(setIncidents).catch(console.error);
  }, [search]);

  useEffect(() => {
    loadIncidents();
  }, [loadIncidents]);

  const handleIncidentAction = async (actionType: 'acknowledge' | 'revoke_access' | 'close_incident') => {
    if (!selectedInc) return;
    setMessage(null);
    try {
      await superadminApi.actOnIncident({
        incidentId: selectedInc.id,
        actionType,
        actionNote: actionNote || `Admin action committed: ${actionType}`,
        targetEmployeeId: selectedInc.actor_identifier.startsWith('EMP-') ? selectedInc.actor_identifier : undefined,
      });
      setMessage({ type: 'success', text: `Incident ${selectedInc.reference_code} updated cleanly.` });
      setSelectedInc(null);
      setActionNote('');
      loadIncidents();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Incident action failed.' });
    }
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <div className={`p-4 rounded-lg text-sm flex items-start gap-3 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" />}
            <div>{message.text}</div>
          </div>
        </div>
      )}

      <DeckFrame
        actionCode="SA-09"
        moduleLabel="AUDIT & INCIDENTS"
        title="Investigate an access or data-change incident"
        steps={[
          'Filter immutable audit records within incident authority.',
          'Trace account, request, policy version and before/after changes.',
          'Create an incident action or revoke access when authorised.',
        ]}
        whenCheckFails="Exceptional data inspection requires a named, time-limited grant. No silent impersonation of employee dashboards."
        permissionEvidence="Audit access is restricted and itself logged. Logs must not expose passwords, tokens or unnecessary sensitive content."
      >
        <div className="space-y-4">
          {/* Search bar matching Action Deck P307 */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search within your permitted scope..."
                className="pl-9 text-xs"
              />
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs text-slate-600">
              <Filter className="w-3.5 h-3.5" />
              Filters
            </Button>
          </div>

          {/* Table matching Action Deck P307 */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">REFERENCE</th>
                  <th className="py-2.5 px-4">EVENT TYPE</th>
                  <th className="py-2.5 px-4">ACTOR</th>
                  <th className="py-2.5 px-4">STATE</th>
                  <th className="py-2.5 px-4 text-right">NEXT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {incidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-4 font-mono font-medium text-slate-800">{inc.reference_code}</td>
                    <td className="py-2.5 px-4 text-slate-800 font-medium">{inc.event_type}</td>
                    <td className="py-2.5 px-4 text-slate-600">{inc.actor_identifier}</td>
                    <td className="py-2.5 px-4">
                      <Badge className={`text-[10px] ${inc.state === 'Active' ? 'bg-amber-50 text-amber-700 border-amber-200' : inc.state === 'Review' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-600'}`}>
                        {inc.state}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedInc(inc)}
                        className="h-7 text-xs text-emerald-800 font-semibold hover:bg-emerald-50"
                      >
                        Open →
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Investigation Panel if an incident is selected */}
          {selectedInc && (
            <div className="p-4 rounded-lg border border-emerald-200 bg-emerald-50/30 space-y-3">
              <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
                <div className="font-semibold text-xs text-slate-900">
                  Incident Investigation: {selectedInc.reference_code} ({selectedInc.event_type})
                </div>
                <Button size="sm" variant="ghost" onClick={() => setSelectedInc(null)} className="h-6 text-xs">
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="text-xs text-slate-700">{selectedInc.evidence_summary}</div>
              <div className="bg-white p-2.5 rounded border border-slate-200 font-mono text-[11px] text-slate-600">
                {JSON.stringify(selectedInc.before_after_payload, null, 2)}
              </div>
              <Input
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                placeholder="Resolution directive or incident note..."
                className="text-xs bg-white"
              />
              <div className="flex gap-2 justify-end pt-1">
                <Button size="sm" variant="outline" onClick={() => handleIncidentAction('acknowledge')} className="text-xs">
                  Acknowledge
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handleIncidentAction('revoke_access')} className="text-xs">
                  Revoke Target Session
                </Button>
                <Button size="sm" onClick={() => handleIncidentAction('close_incident')} className="bg-[#113F3D] hover:bg-[#0C2B29] text-white text-xs">
                  Close Incident
                </Button>
              </div>
            </div>
          )}
        </div>
      </DeckFrame>
    </div>
  );
}

// =============================================================================
// 8. System Health Page (SA-10)
// =============================================================================
export function SuperadminHealthPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [queue, setQueue] = useState<string>('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadJobs = useCallback(() => {
    superadminApi.listBackgroundJobs(queue).then(setJobs).catch(console.error);
  }, [queue]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const handleRetry = async (job: any) => {
    setMessage(null);
    try {
      const res = await superadminApi.retryBackgroundJob({
        jobId: job.id,
        idempotencyKey: job.idempotency_key,
      });
      setMessage({ type: 'success', text: `Job ${job.job_name} (${job.reference_code}) moved to Active with attempt ${res.retryCount}. Idempotency key verified.` });
      loadJobs();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Retry failed.' });
    }
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <div className={`p-4 rounded-lg text-sm flex items-start gap-3 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-rose-600" />}
            <div>{message.text}</div>
          </div>
        </div>
      )}

      <DeckFrame
        actionCode="SA-10"
        moduleLabel="SYSTEM HEALTH"
        title="Recover a failed integration or report job"
        steps={[
          'Inspect permitted job metadata and failure cause.',
          'Retry a safe failed job or route it to the service owner.',
          'Verify success and reconcile duplicate-safe results.',
        ]}
        whenCheckFails="Expired permission or offboarded job owner blocks execution and requires an authorised replacement."
        permissionEvidence="Admin job access does not reveal customer payloads without a separate grant. Recheck user scope before replaying exports."
      >
        <div className="space-y-4">
          {/* Queue Filter Bar */}
          <div className="flex gap-2 items-center">
            <span className="text-xs text-slate-500 font-medium">Filter Queue:</span>
            <Button
              size="sm"
              variant={queue === '' ? 'default' : 'outline'}
              onClick={() => setQueue('')}
              className={`h-7 text-xs ${queue === '' ? 'bg-[#113F3D] text-white' : ''}`}
            >
              All Queues
            </Button>
            <Button
              size="sm"
              variant={queue === 'imports' ? 'default' : 'outline'}
              onClick={() => setQueue('imports')}
              className={`h-7 text-xs ${queue === 'imports' ? 'bg-[#113F3D] text-white' : ''}`}
            >
              Imports
            </Button>
            <Button
              size="sm"
              variant={queue === 'reminders' ? 'default' : 'outline'}
              onClick={() => setQueue('reminders')}
              className={`h-7 text-xs ${queue === 'reminders' ? 'bg-[#113F3D] text-white' : ''}`}
            >
              Reminders
            </Button>
            <Button
              size="sm"
              variant={queue === 'exports' ? 'default' : 'outline'}
              onClick={() => setQueue('exports')}
              className={`h-7 text-xs ${queue === 'exports' ? 'bg-[#113F3D] text-white' : ''}`}
            >
              Exports
            </Button>
          </div>

          {/* Table matching Action Deck P309 */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">REFERENCE</th>
                  <th className="py-2.5 px-4">QUEUE</th>
                  <th className="py-2.5 px-4">JOB</th>
                  <th className="py-2.5 px-4">STATE</th>
                  <th className="py-2.5 px-4 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-4 font-mono font-medium text-slate-800">{job.reference_code}</td>
                    <td className="py-2.5 px-4 text-slate-600 capitalize">{job.queue_name}</td>
                    <td className="py-2.5 px-4 font-medium text-slate-900">
                      {job.job_name}
                      {job.failure_reason && (
                        <div className="text-[11px] text-rose-600 font-normal truncate max-w-sm">
                          {job.failure_reason}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      <Badge className={`text-[10px] ${job.state === 'Failed' ? 'bg-rose-50 text-rose-700 border-rose-200' : job.state === 'Retrying' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                        {job.state} ({job.retry_count}/{job.max_retries})
                      </Badge>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRetry(job)}
                        disabled={job.retry_count >= job.max_retries}
                        className="h-7 text-xs text-emerald-800 font-semibold border-emerald-300 hover:bg-emerald-50 gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Retry
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </DeckFrame>
    </div>
  );
}
