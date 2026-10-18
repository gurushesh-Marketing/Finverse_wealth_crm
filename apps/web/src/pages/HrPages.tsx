import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Users,
  UserPlus,
  ArrowRight,
  ArrowLeft,
  ArrowLeftRight,
  ShieldCheck,
  CalendarDays,
  GraduationCap,
  BarChart3,
  Inbox,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  Filter,
  FileText,
  Download,
  Lock,
  MoreHorizontal,
  RefreshCw,
  Plus,
  Check,
  X,
} from 'lucide-react';
import { hrApi } from '../lib/hr-api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
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
  submitLabel = 'Continue',
  submitDisabled = false,
}: DeckFrameProps) {
  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Scoped action lock */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
            <a href="/hr/overview" className="hover:text-primary flex items-center gap-1">
              <ArrowLeft className="size-3" /> HR workspace
            </a>
            <span>/</span>
            <span className="uppercase tracking-wider font-semibold text-foreground/80">
              {actionCode} / {moduleLabel}
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="gap-1 border border-muted text-xs py-1 px-2.5 font-normal">
            <Lock className="size-3 text-muted-foreground" /> Scoped action
          </Badge>
          <Button variant="ghost" size="icon" className="size-8">
            <MoreHorizontal className="size-4" />
          </Button>
        </div>
      </div>

      {/* Main Grid: Work Area (2 cols) vs Right Rail (1 col) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Work Area Column */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border shadow-sm">
            {/* Context bar inside card header */}
            <div className="flex items-center justify-between border-b px-6 py-3 bg-muted/20 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="inline-block size-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-medium text-foreground/90">{statusText}</span>
              </div>
              <div className="text-[11px]">Updated 09:42 IST</div>
            </div>

            <CardContent className="p-6">{children}</CardContent>

            {/* Bottom Bar matching Deck */}
            {onSubmit && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t px-6 py-4 bg-muted/10">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="size-4 text-emerald-600" />
                  <span>Current role and scope checked on submit</span>
                </div>
                <Button
                  onClick={onSubmit}
                  disabled={submitDisabled || submitting}
                  className="bg-[#113F3D] hover:bg-[#155451] text-white font-medium text-sm gap-2 shadow-sm"
                >
                  {submitting ? 'Processing...' : submitLabel}
                  {!submitting && <ArrowRight className="size-4" />}
                </Button>
              </div>
            )}
          </Card>
        </div>

        {/* Right Rail (How This Works, When Check Fails, Permission & Evidence) */}
        <div className="space-y-4">
          <Card className="border shadow-sm">
            <CardContent className="p-5 space-y-3">
              <div className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">HOW THIS WORKS</div>
              <div className="text-sm font-semibold text-foreground">Your next steps</div>
              <div className="space-y-3 pt-1">
                {steps.map((st, i) => (
                  <div key={i} className="flex items-start gap-3 text-xs leading-relaxed text-muted-foreground">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-foreground">
                      0{i + 1}
                    </span>
                    <span>{st}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-sm">
            <CardContent className="p-5 space-y-2">
              <div className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">WHEN A CHECK FAILS</div>
              <p className="text-xs leading-relaxed text-muted-foreground">{whenCheckFails}</p>
            </CardContent>
          </Card>

          <Card className="border shadow-sm">
            <CardContent className="p-5 space-y-2">
              <div className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">PERMISSION & EVIDENCE</div>
              <p className="text-xs leading-relaxed text-muted-foreground">{permissionEvidence}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 1. HR Overview Page (/hr/overview)
// ============================================================================
export function HrOverviewPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await hrApi.getOverview();
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to load HR overview.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading) return <div className="space-y-4 p-6"><SkeletonRows rows={4} /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            Workspace / Human Resources
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">People Operations Overview</h1>
          <p className="text-xs text-muted-foreground">
            Workforce lifecycle requests, availability routing flags and training compliance
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} className="gap-2 self-start">
          <RefreshCw className="size-3.5" /> Refresh
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 text-xs rounded border border-red-200">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Active Headcount</div>
            <div className="mt-2 text-2xl font-bold text-foreground">{data?.activeHeadcount ?? 12}</div>
            <div className="mt-1 text-[11px] text-emerald-600 font-medium">All verticals active</div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Pending Joiners</div>
            <div className="mt-2 text-2xl font-bold text-foreground">{data?.pendingJoiners ?? 0}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">HR-01 Requests</div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Pending Movers</div>
            <div className="mt-2 text-2xl font-bold text-foreground">{data?.pendingMovers ?? 0}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">HR-02 / HR-03 Moves</div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Exit Coordinates</div>
            <div className="mt-2 text-2xl font-bold text-foreground">{data?.pendingLeavers ?? 0}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">HR-04 Leavers</div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">On Leave Today</div>
            <div className="mt-2 text-2xl font-bold text-foreground">{data?.currentlyOnLeave ?? 0}</div>
            <div className="mt-1 text-[11px] text-amber-600 font-medium">Routing marked unavailable</div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Milestones Due</div>
            <div className="mt-2 text-2xl font-bold text-foreground">{data?.milestones?.total ?? 4}</div>
            <div className="mt-1 text-[11px] text-blue-600 font-medium">{data?.milestones?.needsReview ?? 1} in review</div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Launch Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <a href="/hr/joiners" className="block group">
          <Card className="border shadow-sm hover:border-primary/50 transition-colors h-full">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="size-10 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                <UserPlus className="size-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground group-hover:text-primary">Request Account (HR-01)</div>
                <div className="text-xs text-muted-foreground">New joiner placement and approvals</div>
              </div>
            </CardContent>
          </Card>
        </a>
        <a href="/hr/movers" className="block group">
          <Card className="border shadow-sm hover:border-primary/50 transition-colors h-full">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="size-10 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                <ArrowLeftRight className="size-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground group-hover:text-primary">Movers & Promos (HR-02/03)</div>
                <div className="text-xs text-muted-foreground">Team transfers & promotion requests</div>
              </div>
            </CardContent>
          </Card>
        </a>
        <a href="/hr/availability" className="block group">
          <Card className="border shadow-sm hover:border-primary/50 transition-colors h-full">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="size-10 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                <CalendarDays className="size-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground group-hover:text-primary">Leave & Availability (HR-05)</div>
                <div className="text-xs text-muted-foreground">Record absence & TL coverage</div>
              </div>
            </CardContent>
          </Card>
        </a>
        <a href="/hr/reports" className="block group">
          <Card className="border shadow-sm hover:border-primary/50 transition-colors h-full">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="size-10 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                <BarChart3 className="size-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground group-hover:text-primary">People Pack (HR-07)</div>
                <div className="text-xs text-muted-foreground">Generate scoped governance PDF</div>
              </div>
            </CardContent>
          </Card>
        </a>
      </div>

      {/* Recent Requests Table */}
      <Card className="border shadow-sm">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <div className="text-sm font-semibold text-foreground">Active Lifecycle Requests</div>
            <div className="text-xs text-muted-foreground">Submitted by HR for Super Admin provisioning and activation</div>
          </div>
          <a href="/hr/requests" className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
            View all requests <ArrowRight className="size-3" />
          </a>
        </div>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground border-b uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-6 py-3">Request ID</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Employee / Name</th>
                  <th className="px-6 py-3">Target Placement</th>
                  <th className="px-6 py-3">Effective Date</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y text-muted-foreground">
                {data?.recentRequests?.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                      No lifecycle requests submitted yet.
                    </td>
                  </tr>
                ) : (
                  data?.recentRequests?.map((r: any) => (
                    <tr key={r.id} className="hover:bg-muted/20">
                      <td className="px-6 py-3.5 font-mono text-foreground font-medium">{r.id}</td>
                      <td className="px-6 py-3.5 capitalize">{r.request_type?.replace('_', ' ')}</td>
                      <td className="px-6 py-3.5 font-medium text-foreground">{r.employee_name}</td>
                      <td className="px-6 py-3.5">{r.target_role} · {r.target_vertical} ({r.team_name || r.target_team_id || '—'})</td>
                      <td className="px-6 py-3.5">{new Date(r.effective_date).toLocaleDateString()} {r.effective_time}</td>
                      <td className="px-6 py-3.5">
                        <Badge
                          className={
                            r.status === 'activated_by_admin'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : r.status === 'approved'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : r.status === 'rejected'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }
                        >
                          {r.status?.replace('_', ' ')}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// 2. HR-01: Request a New Employee Account (/hr/joiners)
// ============================================================================
export function HrJoinersPage() {
  const [employeeName, setEmployeeName] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [employmentType, setEmploymentType] = useState<'permanent' | 'intern' | 'contract'>('permanent');
  const [proposedRole, setProposedRole] = useState('SC');
  const [vertical, setVertical] = useState('wealth');
  const [teamId, setTeamId] = useState('TEAM-WEALTH-ALPHA');
  const [startDate, setStartDate] = useState('2026-10-28');
  const [approvalsSummary, setApprovalsSummary] = useState('Approved by Hiring Authority');
  const [requiredTraining, setRequiredTraining] = useState('Wealth Foundations & Statutory Conduct');

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [requests, setRequests] = useState<any[]>([]);

  const loadRequests = useCallback(async () => {
    try {
      const res = await hrApi.listRequests({ type: 'new_account' });
      setRequests(res);
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setMessage(null);
      const res = await hrApi.requestAccount({
        employeeName,
        workEmail,
        employmentType,
        proposedRole: proposedRole as any,
        vertical: vertical as any,
        teamId,
        startDate,
        approvalsSummary,
        requiredTraining,
      });
      setMessage({ type: 'success', text: `Request ${res.requestId} created. Placement routed to Super Admin provisioning queue.` });
      setEmployeeName('');
      setWorkEmail('');
      void loadRequests();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to submit account request.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DeckFrame
      actionCode="HR-01"
      moduleLabel="JOINERS"
      title="Request a new employee account"
      subtitle="Company function · assigned permission scope · illustrative records"
      steps={[
        'Create the employee lifecycle request with approved placement.',
        'Attach role, supervisor, employment dates and required training.',
        'Submit for approvals and Super Admin provisioning.',
      ]}
      whenCheckFails="Incomplete placement leaves access pending, never a default company-wide dashboard."
      permissionEvidence="HR cannot issue the role grant directly. Resolve duplicate employee identity through an audited process."
      onSubmit={handleSubmit}
      submitting={submitting}
      submitLabel="Continue"
    >
      <div className="space-y-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">CAPTURE</div>
        <div className="text-base font-semibold text-foreground">Request a new employee account</div>

        {message && (
          <div
            className={`p-3 text-xs rounded border ${
              message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2">
          <div>
            <label className="text-xs font-medium text-foreground">Employee</label>
            <Input
              value={employeeName}
              onChange={(e) => setEmployeeName(e.target.value)}
              placeholder="New unique identity"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground">Employment type</label>
            <select
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value as any)}
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="permanent">Permanent</option>
              <option value="intern">Intern</option>
              <option value="contract">Contract</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground">Corporate work email</label>
            <Input
              type="email"
              value={workEmail}
              onChange={(e) => setWorkEmail(e.target.value)}
              placeholder="e.g. employee.name@finverse.demo"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground">Proposed role</label>
            <select
              value={proposedRole}
              onChange={(e) => setProposedRole(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="SC">Sales Caller (SC)</option>
              <option value="TL">Team Leader (TL)</option>
              <option value="MG">Wealth Manager (MG)</option>
              <option value="RM">Regional Manager (RM)</option>
              <option value="NM">National Manager (NM)</option>
              <option value="DE">Data Entry (DE)</option>
              <option value="HR">Human Resources (HR)</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground">Vertical/team</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <select
                value={vertical}
                onChange={(e) => setVertical(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="wealth">Wealth</option>
                <option value="banking">Banking</option>
                <option value="markets">Markets</option>
                <option value="real-estate">Real Estate</option>
              </select>
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="TEAM-WEALTH-ALPHA">Wealth Alpha</option>
                <option value="TEAM-WEALTH-BETA">Wealth Beta</option>
                <option value="TEAM-WEALTH-GAMMA">Wealth Gamma</option>
                <option value="TEAM-BANKING-ALPHA">Banking Alpha</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground">Start date</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-foreground">Approvals</label>
            <Input
              value={approvalsSummary}
              onChange={(e) => setApprovalsSummary(e.target.value)}
              placeholder="Hiring authority approval evidence"
              className="mt-1"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-foreground">Required training</label>
            <Input
              value={requiredTraining}
              onChange={(e) => setRequiredTraining(e.target.value)}
              placeholder="Initial regulatory and product training modules"
              className="mt-1"
            />
          </div>
        </div>

        {/* List of joiner requests */}
        {requests.length > 0 && (
          <div className="mt-6 pt-4 border-t">
            <div className="text-xs font-semibold text-foreground mb-2">Pending & Processed Joiner Requests</div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-muted-foreground text-[10px] uppercase">
                  <tr>
                    <th className="px-3 py-2">ID</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Role / Team</th>
                    <th className="px-3 py-2">Start Date</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-muted-foreground">
                  {requests.map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 py-2 font-mono text-foreground">{r.id}</td>
                      <td className="px-3 py-2 font-medium text-foreground">{r.employee_name}</td>
                      <td className="px-3 py-2">{r.target_role} · {r.target_team_name || r.target_team_id}</td>
                      <td className="px-3 py-2">{new Date(r.effective_date).toLocaleDateString()}</td>
                      <td className="px-3 py-2">
                        <Badge className="text-[10px] capitalize border">
                          {r.status?.replace('_', ' ')}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DeckFrame>
  );
}

// ============================================================================
// 3. HR-02 & HR-03: Movers & Promotions (/hr/movers)
// ============================================================================
export function HrMoversPage() {
  const [tab, setTab] = useState<'transfer' | 'promotion'>('transfer');

  // Transfer State (HR-02)
  const [empTransferId, setEmpTransferId] = useState('EMP-001');
  const [newVertical, setNewVertical] = useState('wealth');
  const [newTeamId, setNewTeamId] = useState('TEAM-WEALTH-BETA');
  const [effectiveDate, setEffectiveDate] = useState('2026-10-15');
  const [effectiveTime, setEffectiveTime] = useState('01 Oct, 09:00');
  const [namedHandoffOwners, setNamedHandoffOwners] = useState('Named lead owners');
  const [transferApprovals, setTransferApprovals] = useState('Approved by Regional Manager (Kavita Rao)');

  // Promotion State (HR-03)
  const [empPromoId, setEmpPromoId] = useState('EMP-001');
  const [newRole, setNewRole] = useState('TL');
  const [promoVertical, setPromoVertical] = useState('wealth');
  const [promoEffectiveDate, setPromoEffectiveDate] = useState('2026-11-01');
  const [reportingScope, setReportingScope] = useState('Approved teams');
  const [oldWorkloadTreatment, setOldWorkloadTreatment] = useState('Reassign or explicit secondary duty');
  const [promoApprovals, setPromoApprovals] = useState('Approved by National Leadership & HR Head');

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleTransferSubmit = async () => {
    try {
      setSubmitting(true);
      setMessage(null);
      const res = await hrApi.requestTransfer({
        employeeId: empTransferId,
        newVertical: newVertical as any,
        newTeamId,
        effectiveDate,
        effectiveTime,
        namedHandoffOwners,
        businessJustification: `Cross-team transfer for ${empTransferId}. Approvals: ${transferApprovals}`,
        approvalsSummary: transferApprovals,
      });
      setMessage({
        type: 'success',
        text: `Transfer request ${res.requestId} created with status '${res.status}'. Requests remain pending until genuine approval is attached; Super Admin activation requires verified authorization.`,
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Transfer request failed.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePromotionSubmit = async () => {
    try {
      setSubmitting(true);
      setMessage(null);
      const res = await hrApi.requestPromotion({
        employeeId: empPromoId,
        newRole: newRole as any,
        newVertical: promoVertical as any,
        newTeamId: 'TEAM-WEALTH-ALPHA',
        effectiveDate: promoEffectiveDate,
        effectiveTime: '01 Nov, 09:00',
        reportingScope,
        oldWorkloadTreatment,
        businessJustification: `Promotion to ${newRole}. Approvals: ${promoApprovals}`,
        approvalsSummary: promoApprovals,
      });
      setMessage({
        type: 'success',
        text: `Promotion request ${res.requestId} created with status '${res.status}'. Requests remain pending until genuine approval is attached; Super Admin activation requires verified authorization.`,
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Promotion request failed.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Tab toggle */}
      <div className="flex border-b">
        <button
          onClick={() => { setTab('transfer'); setMessage(null); }}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
            tab === 'transfer' ? 'border-[#113F3D] text-[#113F3D]' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Team Transfers (HR-02)
        </button>
        <button
          onClick={() => { setTab('promotion'); setMessage(null); }}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
            tab === 'promotion' ? 'border-[#113F3D] text-[#113F3D]' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Promotions & Career History (HR-03)
        </button>
      </div>

      {tab === 'transfer' ? (
        <DeckFrame
          actionCode="HR-02"
          moduleLabel="MOVERS & PROMOTIONS"
          title="Request an effective-dated team transfer"
          steps={[
            'Capture the approved destination and reporting path.',
            'Review lead, task, target and review ownership impact.',
            'Submit the dated move for Super Admin activation.',
          ]}
          whenCheckFails="A pending transfer does not expose the destination interface or move leads early."
          permissionEvidence="Permanent employee identity stays unchanged. Current access ends at the change boundary; past facts are preserved."
          onSubmit={handleTransferSubmit}
          submitting={submitting}
          submitLabel="Continue"
        >
          <div className="space-y-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">CAPTURE</div>
            <div className="text-base font-semibold text-foreground">Request an effective-dated team transfer</div>

            {message && (
              <div
                className={`p-3 text-xs rounded border ${
                  message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
                }`}
              >
                {message.text}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2">
              <div>
                <label className="text-xs font-medium text-foreground">Employee</label>
                <select
                  value={empTransferId}
                  onChange={(e) => setEmpTransferId(e.target.value)}
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="EMP-001">Asha Rao (EMP-001 · Caller)</option>
                  <option value="EMP-002">Ravi Menon (EMP-002 · Caller)</option>
                  <option value="EMP-004">Dev Kapoor (EMP-004 · Banking Caller)</option>
                  <option value="EMP-006">Karan Shah (EMP-006 · Caller)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-foreground">Old assignment</label>
                <Input value="Wealth Alpha" disabled className="mt-1 bg-muted/40" />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground">New assignment</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <select
                    value={newVertical}
                    onChange={(e) => setNewVertical(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="wealth">Wealth</option>
                    <option value="banking">Banking</option>
                  </select>
                  <select
                    value={newTeamId}
                    onChange={(e) => setNewTeamId(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="TEAM-WEALTH-BETA">Wealth Beta</option>
                    <option value="TEAM-WEALTH-GAMMA">Wealth Gamma</option>
                    <option value="TEAM-BANKING-ALPHA">Banking Alpha</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-foreground">Effective time</label>
                <Input
                  value={effectiveTime}
                  onChange={(e) => setEffectiveTime(e.target.value)}
                  placeholder="01 Oct, 09:00"
                  className="mt-1"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-foreground">Handoff</label>
                <Input
                  value={namedHandoffOwners}
                  onChange={(e) => setNamedHandoffOwners(e.target.value)}
                  placeholder="Named lead owners"
                  className="mt-1"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-foreground">Approvals</label>
                <Input
                  value={transferApprovals}
                  onChange={(e) => setTransferApprovals(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        </DeckFrame>
      ) : (
        <DeckFrame
          actionCode="HR-03"
          moduleLabel="MOVERS & PROMOTIONS"
          title="Request a promotion with retained career history"
          steps={[
            'Record promotion approvals and new scope.',
            'Specify treatment of old leads and ongoing reviews.',
            'Submit and verify activation through the lifecycle status.',
          ]}
          whenCheckFails="Dual duties require explicit dated grants; they are never inferred from the promotion."
          permissionEvidence="Old role permissions end by default. Career reports remain available as read-only history within the new interface."
          onSubmit={handlePromotionSubmit}
          submitting={submitting}
          submitLabel="Continue"
        >
          <div className="space-y-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">CAPTURE</div>
            <div className="text-base font-semibold text-foreground">Request a promotion with retained career history</div>

            {message && (
              <div
                className={`p-3 text-xs rounded border ${
                  message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
                }`}
              >
                {message.text}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2">
              <div>
                <label className="text-xs font-medium text-foreground">Employee</label>
                <select
                  value={empPromoId}
                  onChange={(e) => setEmpPromoId(e.target.value)}
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="EMP-001">Asha Rao (EMP-001)</option>
                  <option value="EMP-002">Ravi Menon (EMP-002)</option>
                  <option value="EMP-003">Tara Iyer (EMP-003)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-foreground">New role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="TL">Team leader (TL)</option>
                  <option value="MG">Wealth Manager (MG)</option>
                  <option value="RM">Regional Manager (RM)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-foreground">Effective time</label>
                <Input
                  value={promoEffectiveDate}
                  onChange={(e) => setPromoEffectiveDate(e.target.value)}
                  placeholder="01 Oct"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground">Reporting scope</label>
                <Input
                  value={reportingScope}
                  onChange={(e) => setReportingScope(e.target.value)}
                  placeholder="Approved teams"
                  className="mt-1"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-foreground">Old workload</label>
                <Input
                  value={oldWorkloadTreatment}
                  onChange={(e) => setOldWorkloadTreatment(e.target.value)}
                  placeholder="Reassign or explicit secondary duty"
                  className="mt-1"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-foreground">Approvals</label>
                <Input
                  value={promoApprovals}
                  onChange={(e) => setPromoApprovals(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        </DeckFrame>
      )}
    </div>
  );
}

// ============================================================================
// 4. HR-04: Coordinate an Employee Exit (/hr/leavers)
// ============================================================================
export function HrLeaversPage() {
  const [employeeId, setEmployeeId] = useState('EMP-006');
  const [exitDate, setExitDate] = useState('2026-10-31');
  const [exitTime, setExitTime] = useState('30 Sep, 18:00');
  const [openWorkHandoff, setOpenWorkHandoff] = useState('Handoff checklist');
  const [accessRevocation, setAccessRevocation] = useState<'immediate' | 'scheduled_end_of_day' | 'custom_time'>('scheduled_end_of_day');
  const [replacementPlan, setReplacementPlan] = useState('Separate new identity');
  const [approvalsSummary, setApprovalsSummary] = useState('Authorized Exit (Voluntary Resignation)');

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setMessage(null);
      const res = await hrApi.coordinateExit({
        employeeId,
        exitDate,
        exitTime,
        openWorkHandoff,
        accessRevocationSchedule: accessRevocation,
        replacementPlan,
        approvalsSummary,
      });
      setMessage({
        type: 'success',
        text: `Exit coordination ${res.requestId} submitted. Access revocation scheduled for Super Admin execution.`,
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Exit coordination submission failed.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DeckFrame
      actionCode="HR-04"
      moduleLabel="LEAVERS"
      title="Coordinate an employee exit"
      steps={[
        'Record authorised exit and exact effective time.',
        'Assign handoff owners for leads, tasks, reports and approvals.',
        'Confirm Admin revocation and close the exit checklist.',
      ]}
      whenCheckFails="Urgent suspension routes immediately to Admin; business work goes to an accountable holding queue if no recipient exists."
      permissionEvidence="Replacement must receive a new employee/account identity. Record retention follows the approved policy."
      onSubmit={handleSubmit}
      submitting={submitting}
      submitLabel="Continue"
    >
      <div className="space-y-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">CAPTURE</div>
        <div className="text-base font-semibold text-foreground">Coordinate an employee exit</div>

        {message && (
          <div
            className={`p-3 text-xs rounded border ${
              message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2">
          <div>
            <label className="text-xs font-medium text-foreground">Employee</label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="EMP-006">Karan Shah (EMP-006 · Wealth Gamma)</option>
              <option value="EMP-004">Dev Kapoor (EMP-004 · Banking Alpha)</option>
              <option value="EMP-002">Ravi Menon (EMP-002 · Wealth Beta)</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground">Exit time</label>
            <Input
              value={exitTime}
              onChange={(e) => setExitTime(e.target.value)}
              placeholder="30 Sep, 18:00"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground">Open work</label>
            <Input
              value={openWorkHandoff}
              onChange={(e) => setOpenWorkHandoff(e.target.value)}
              placeholder="Handoff checklist"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground">Access revocation</label>
            <select
              value={accessRevocation}
              onChange={(e) => setAccessRevocation(e.target.value as any)}
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="scheduled_end_of_day">Scheduled (end of day)</option>
              <option value="immediate">Immediate suspension</option>
              <option value="custom_time">Custom time</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-foreground">Replacement</label>
            <Input
              value={replacementPlan}
              onChange={(e) => setReplacementPlan(e.target.value)}
              placeholder="Separate new identity"
              className="mt-1"
            />
          </div>
        </div>
      </div>
    </DeckFrame>
  );
}

// ============================================================================
// 5. HR-05: Record Leave and Allocation Availability (/hr/availability)
// ============================================================================
export function HrAvailabilityPage() {
  const [employeeId, setEmployeeId] = useState('EMP-001');
  const [absenceType, setAbsenceType] = useState('approved_leave');
  const [startEnd, setStartEnd] = useState('28-30 Sep');
  const [startDate, setStartDate] = useState('2026-09-28');
  const [endDate, setEndDate] = useState('2026-09-30');
  const [coverageOwner, setCoverageOwner] = useState('TL');
  const [coverageEmployeeId, setCoverageEmployeeId] = useState('EMP-003');
  const [allocationStatus, setAllocationStatus] = useState<'unavailable' | 'reduced' | 'available'>('unavailable');
  const [leadsConfirmed, setLeadsConfirmed] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [leaves, setLeaves] = useState<any[]>([]);

  const loadLeaves = useCallback(async () => {
    try {
      const res = await hrApi.listLeaves();
      setLeaves(res);
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    void loadLeaves();
  }, [loadLeaves]);

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setMessage(null);
      const res = await hrApi.recordLeave({
        employeeId,
        absenceType: absenceType as any,
        startDate,
        endDate,
        coverageOwnerRole: coverageOwner,
        coverageEmployeeId,
        allocationStatus,
        leadsReassignmentConfirmed: leadsConfirmed,
        notes: `Recorded leave window ${startEnd}`,
      });
      setMessage({ type: 'success', text: `Leave record ${res.leaveId} published. Minimal availability flags updated for routing.` });
      void loadLeaves();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to record leave.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DeckFrame
      actionCode="HR-05"
      moduleLabel="AVAILABILITY"
      title="Record leave and allocation availability"
      steps={[
        'Record approved leave or availability dates.',
        'Notify the supervisor of open work requiring coverage.',
        'Confirm effective availability used by routing.',
      ]}
      whenCheckFails="Leave does not automatically transfer every lead. Supervisor must confirm the required handoff."
      permissionEvidence="HR visibility excludes unnecessary medical/private details from sales supervisors. Leave approval is a named policy."
      onSubmit={handleSubmit}
      submitting={submitting}
      submitLabel="Continue"
    >
      <div className="space-y-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">CAPTURE</div>
        <div className="text-base font-semibold text-foreground">Record leave and allocation availability</div>

        {message && (
          <div
            className={`p-3 text-xs rounded border ${
              message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2">
          <div>
            <label className="text-xs font-medium text-foreground">Employee</label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="EMP-001">Asha Rao (EMP-001)</option>
              <option value="EMP-002">Ravi Menon (EMP-002)</option>
              <option value="EMP-004">Dev Kapoor (EMP-004)</option>
              <option value="EMP-006">Karan Shah (EMP-006)</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground">Absence</label>
            <select
              value={absenceType}
              onChange={(e) => setAbsenceType(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="approved_leave">Approved leave</option>
              <option value="annual_leave">Annual leave</option>
              <option value="sick_leave">Sick leave</option>
              <option value="bereavement">Bereavement</option>
              <option value="unpaid">Unpaid leave</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground">Start/end dates</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground">Coverage owner</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <Input
                value={coverageOwner}
                onChange={(e) => setCoverageOwner(e.target.value)}
                placeholder="TL"
              />
              <select
                value={coverageEmployeeId}
                onChange={(e) => setCoverageEmployeeId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="EMP-003">Tara Iyer (TL)</option>
                <option value="EMP-005">Meera Nair (TL)</option>
                <option value="EMP-007">Neel Verma (MG)</option>
              </select>
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-foreground">Allocation status</label>
            <select
              value={allocationStatus}
              onChange={(e) => setAllocationStatus(e.target.value as any)}
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="unavailable">Unavailable (Skip from new lead distribution)</option>
              <option value="reduced">Reduced allocation (50% capacity weight)</option>
              <option value="available">Normal allocation</option>
            </select>
          </div>
        </div>

        {/* Existing leaves table */}
        {leaves.length > 0 && (
          <div className="mt-6 pt-4 border-t">
            <div className="text-xs font-semibold text-foreground mb-2">Active & Scheduled Leaves</div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-muted-foreground text-[10px] uppercase">
                  <tr>
                    <th className="px-3 py-2">ID</th>
                    <th className="px-3 py-2">Employee</th>
                    <th className="px-3 py-2">Absence</th>
                    <th className="px-3 py-2">Dates</th>
                    <th className="px-3 py-2">Coverage TL</th>
                    <th className="px-3 py-2">Allocation</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-muted-foreground">
                  {leaves.map((l) => (
                    <tr key={l.id}>
                      <td className="px-3 py-2 font-mono text-foreground">{l.id}</td>
                      <td className="px-3 py-2 font-medium text-foreground">{l.employee_name}</td>
                      <td className="px-3 py-2 capitalize">{l.absence_type?.replace('_', ' ')}</td>
                      <td className="px-3 py-2">
                        {new Date(l.start_date).toLocaleDateString()} – {new Date(l.end_date).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2">{l.coverage_name || l.coverage_owner_role}</td>
                      <td className="px-3 py-2">
                        <Badge
                          className={
                            l.allocation_status === 'unavailable'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }
                        >
                          {l.allocation_status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DeckFrame>
  );
}

// ============================================================================
// 6. HR-06: Track Probation, Training & Review Completion (/hr/training)
// ============================================================================
export function HrTrainingPage() {
  const [milestones, setMilestones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedMilestone, setSelectedMilestone] = useState<any | null>(null);
  const [modalStatus, setModalStatus] = useState('completed');
  const [evidenceSummary, setEvidenceSummary] = useState('');
  const [supervisorNotes, setSupervisorNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadMilestones = useCallback(async () => {
    try {
      setLoading(true);
      const res = await hrApi.listMilestones({ search: searchTerm, status: statusFilter });
      setMilestones(res);
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    void loadMilestones();
  }, [loadMilestones]);

  const handleUpdate = async () => {
    if (!selectedMilestone) return;
    try {
      setSaving(true);
      await hrApi.updateMilestone({
        milestoneId: selectedMilestone.id,
        status: modalStatus as any,
        decisionAction: 'none',
        evidenceSummary,
        supervisorNotes,
      });
      setMessage(`Milestone ${selectedMilestone.id} updated to '${modalStatus}'.`);
      setSelectedMilestone(null);
      void loadMilestones();
    } catch (err: any) {
      setMessage(err?.message || 'Failed to update milestone.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DeckFrame
      actionCode="HR-06"
      moduleLabel="TRAINING & REVIEWS"
      title="Track probation, training and review completion"
      steps={[
        'Inspect upcoming milestones and overdue training/reviews.',
        'Assign reminders and request supervisor evidence.',
        'Record completion or route an extension/role decision for approval.',
      ]}
      whenCheckFails="Expired intern grants trigger access review, not automatic permanent-role conversion."
      permissionEvidence="Completion of training alone does not grant broader access. HR sees approved summaries, not unrestricted customer recordings."
      submitLabel="Continue"
      onSubmit={() => {}}
      submitDisabled={true}
    >
      <div className="space-y-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">WORK AREA</div>
        <div className="text-base font-semibold text-foreground">Track probation, training and review completion</div>

        {message && (
          <div className="p-3 text-xs bg-emerald-50 text-emerald-800 rounded border border-emerald-200">
            {message}
          </div>
        )}

        {/* Search & Filter Toolbar matching Deck P287 */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search within your permitted scope"
              className="pl-9 h-9 text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All States</option>
              <option value="active">Active</option>
              <option value="review">Review</option>
              <option value="completed">Completed</option>
              <option value="in_progress">In Progress</option>
            </select>
            <Button variant="outline" size="sm" onClick={loadMilestones} className="gap-1.5 h-9 text-xs">
              <Filter className="size-3.5" /> Filters
            </Button>
          </div>
        </div>

        {/* Table matching Deck P287 exact columns */}
        <div className="border rounded-md overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 text-muted-foreground text-[10px] uppercase border-b">
              <tr>
                <th className="px-4 py-3">REFERENCE</th>
                <th className="px-4 py-3">EMPLOYEE</th>
                <th className="px-4 py-3">MILESTONE</th>
                <th className="px-4 py-3">STATE</th>
                <th className="px-4 py-3 text-right">NEXT</th>
              </tr>
            </thead>
            <tbody className="divide-y text-muted-foreground">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-4"><SkeletonRows rows={3} /></td>
                </tr>
              ) : milestones.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No milestones found matching criteria.
                  </td>
                </tr>
              ) : (
                milestones.map((m) => (
                  <tr key={m.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-mono font-medium text-foreground">{m.id}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{m.employee_name}</td>
                    <td className="px-4 py-3">
                      <div>{m.title}</div>
                      <div className="text-[10px] text-muted-foreground">Due: {new Date(m.due_date).toLocaleDateString()}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        className={
                          m.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : m.status === 'review'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-emerald-50/50 text-emerald-800 border-emerald-300'
                        }
                      >
                        {m.status === 'active' ? 'Active' : m.status === 'review' ? 'Review' : m.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedMilestone(m);
                          setModalStatus(m.status);
                          setEvidenceSummary(m.evidence_summary || '');
                          setSupervisorNotes(m.supervisor_notes || '');
                        }}
                        className="text-primary hover:text-primary font-medium text-xs h-7 px-2 gap-1"
                      >
                        Open <ArrowRight className="size-3" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Update Milestone Dialog */}
        {selectedMilestone && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <Card className="w-full max-w-lg border shadow-xl">
              <div className="flex items-center justify-between border-b px-6 py-4">
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">
                    {selectedMilestone.id} · {selectedMilestone.employee_name}
                  </div>
                  <div className="text-sm font-semibold text-foreground">{selectedMilestone.title}</div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setSelectedMilestone(null)}>
                  <X className="size-4" />
                </Button>
              </div>
              <CardContent className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-medium text-foreground">Milestone Status</label>
                  <select
                    value={modalStatus}
                    onChange={(e) => setModalStatus(e.target.value)}
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="active">Active (In progress)</option>
                    <option value="review">Review (Supervisor evidence attached)</option>
                    <option value="completed">Completed (Confirmed sign-off)</option>
                    <option value="extended">Extended (Approved extension)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground">Evidence Summary</label>
                  <Textarea
                    value={evidenceSummary}
                    onChange={(e) => setEvidenceSummary(e.target.value)}
                    placeholder="Approved summary of training completion, assessment scores or probation review"
                    className="mt-1 text-xs"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground">Supervisor Notes</label>
                  <Input
                    value={supervisorNotes}
                    onChange={(e) => setSupervisorNotes(e.target.value)}
                    placeholder="Supervisor sign-off notes"
                    className="mt-1 text-xs"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => setSelectedMilestone(null)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleUpdate}
                    disabled={saving}
                    className="bg-[#113F3D] hover:bg-[#155451] text-white"
                  >
                    {saving ? 'Saving...' : 'Save Milestone Decision'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DeckFrame>
  );
}

// ============================================================================
// 7. HR-07: Prepare a People Operations Pack (/hr/reports)
// ============================================================================
export function HrReportsPage() {
  const [period, setPeriod] = useState<'2026-Q3' | '2026-09' | '2026-H2' | '2026-Q4' | '2026-08' | '2026-YTD'>('2026-Q3');
  const [scope, setScope] = useState<'all' | 'wealth' | 'banking' | 'markets' | 'real-estate'>('all');
  const [sections, setSections] = useState<string[]>(['joiners', 'movers', 'leavers', 'reviews']);

  const [generating, setGenerating] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  const loadHistory = useCallback(async () => {
    try {
      const res = await hrApi.listReports();
      setHistory(res);
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const toggleSection = (s: string) => {
    setSections((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      setMessage(null);
      setDownloadUrl(null);
      const res = await hrApi.generateReport({
        periodLabel: period,
        workforceScope: scope,
        sections: sections as any,
        sensitiveFieldsRestricted: true,
      });
      setDownloadUrl(res.downloadUrl);
      setMessage(`Protected people operations pack ${res.reportId} generated successfully.`);
      void loadHistory();
    } catch (err: any) {
      setMessage(err?.message || 'Failed to generate report pack.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <DeckFrame
      actionCode="HR-07"
      moduleLabel="PEOPLE REPORTS"
      title="Prepare a people operations pack"
      steps={[
        'Select workforce scope and approved report sections.',
        'Preview minimised employee information and pending actions.',
        'Generate a protected PDF for authorised management.',
      ]}
      whenCheckFails="Sensitive detail is redacted unless recipient has the specific field-level grant."
      permissionEvidence="HR report access does not grant raw sales/customer or finance data."
      onSubmit={handleGenerate}
      submitting={generating}
      submitLabel="Generate scoped PDF"
    >
      <div className="space-y-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">WORK AREA</div>
        <div className="text-base font-semibold text-foreground">Prepare a people operations pack</div>

        {message && (
          <div className="p-3 text-xs bg-emerald-50 text-emerald-800 rounded border border-emerald-200 flex items-center justify-between">
            <span>{message}</span>
            {downloadUrl && (
              <a
                href={downloadUrl}
                download
                className="bg-[#113F3D] text-white px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1 hover:bg-[#155451]"
              >
                <Download className="size-3" /> Download PDF
              </a>
            )}
          </div>
        )}

        {/* Twin Cards matching Deck P289 */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2">
          {/* Card 1: REPORT DEFINITION */}
          <Card className="border bg-background shadow-xs">
            <CardContent className="p-5 space-y-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">REPORT DEFINITION</div>
              <div>
                <label className="text-xs font-medium text-foreground">Period</label>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as any)}
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="2026-Q3">2026-Q3 (Six supported periods)</option>
                  <option value="2026-09">2026-09 (Current Month)</option>
                  <option value="2026-H2">2026-H2 (Half-year cohort)</option>
                  <option value="2026-Q4">2026-Q4 (Forward planned)</option>
                  <option value="2026-08">2026-08 (Prior closed)</option>
                  <option value="2026-YTD">2026-YTD (Year to date)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-foreground">Scope</label>
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value as any)}
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="all">Granted workforce (All Verticals)</option>
                  <option value="wealth">Wealth Management</option>
                  <option value="banking">Commercial Banking</option>
                  <option value="markets">Markets / Trading</option>
                  <option value="real-estate">Real Estate Advisory</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-foreground">Sections</label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {['joiners', 'movers', 'leavers', 'reviews', 'availability'].map((sec) => (
                    <button
                      type="button"
                      key={sec}
                      onClick={() => toggleSection(sec)}
                      className={`px-2.5 py-1 text-xs rounded-full border transition-colors capitalize ${
                        sections.includes(sec)
                          ? 'bg-[#113F3D] text-white border-[#113F3D]'
                          : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted'
                      }`}
                    >
                      {sec}
                    </button>
                  ))}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => {}} className="gap-1.5 text-xs">
                <Filter className="size-3" /> Apply filters
              </Button>
            </CardContent>
          </Card>

          {/* Card 2: SELECTED SCOPE / Performance and exceptions */}
          <Card className="border bg-background shadow-xs">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">SELECTED SCOPE</div>
                  <div className="text-sm font-semibold text-foreground">Performance and exceptions</div>
                </div>
                <div className="text-[10px] text-muted-foreground">As of 09:42 IST</div>
              </div>

              {/* Progress bars matching P289 */}
              <div className="space-y-3 pt-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground font-medium">Completed</span>
                    <span className="font-semibold text-foreground">72</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-[#6FA8A2] rounded-full" style={{ width: '72%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground font-medium">In progress</span>
                    <span className="font-semibold text-foreground">48</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-[#6FA8A2] rounded-full" style={{ width: '48%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground font-medium">Needs review</span>
                    <span className="font-semibold text-foreground">21</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-[#6FA8A2] rounded-full" style={{ width: '21%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground font-medium">Excluded</span>
                    <span className="font-semibold text-foreground">8</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-[#6FA8A2] rounded-full" style={{ width: '8%' }} />
                  </div>
                </div>
              </div>

              <div className="pt-2 text-[11px] text-muted-foreground border-t">
                Totals are versioned for the chosen period. Export keeps the same permission scope.
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Generated Report Archives */}
        {history.length > 0 && (
          <div className="mt-6 pt-4 border-t">
            <div className="text-xs font-semibold text-foreground mb-2">Generated People Packs Archive</div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-muted-foreground text-[10px] uppercase">
                  <tr>
                    <th className="px-3 py-2">ID</th>
                    <th className="px-3 py-2">Period</th>
                    <th className="px-3 py-2">Workforce Scope</th>
                    <th className="px-3 py-2">Sections</th>
                    <th className="px-3 py-2">Generated At</th>
                    <th className="px-3 py-2 text-right">Download</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-muted-foreground">
                  {history.map((h) => (
                    <tr key={h.id}>
                      <td className="px-3 py-2 font-mono text-foreground font-medium">{h.id}</td>
                      <td className="px-3 py-2">{h.period_label}</td>
                      <td className="px-3 py-2 uppercase">{h.workforce_scope}</td>
                      <td className="px-3 py-2">{h.included_sections?.join(', ')}</td>
                      <td className="px-3 py-2">{new Date(h.created_at).toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">
                        <a
                          href={`/api/hr/reports/download/${h.file_path?.split(/[\\/]/).pop()}`}
                          download
                          className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                        >
                          <Download className="size-3" /> PDF
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DeckFrame>
  );
}

// ============================================================================
// 8. HR Requests Tracker (/hr/requests)
// ============================================================================
export function HrRequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Approval modal state
  const [approvingReq, setApprovingReq] = useState<any | null>(null);
  const [approvalType, setApprovalType] = useState<'authorized_leader' | 'verified_external_document'>('authorized_leader');
  const [approverEmployeeId, setApproverEmployeeId] = useState('EMP-008'); // Kavita Rao RM
  const [externalRef, setExternalRef] = useState('BOARD-RESOLUTION-2026-Q3');
  const [verificationNotes, setVerificationNotes] = useState('Verified signed transfer requisition and authorized management sign-off.');
  const [approvalSubmitting, setApprovalSubmitting] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  // Edit request modal state
  const [editingReq, setEditingReq] = useState<any | null>(null);
  const [editRole, setEditRole] = useState('SC');
  const [editVertical, setEditVertical] = useState('wealth');
  const [editTeamId, setEditTeamId] = useState('TEAM-WEALTH-BETA');
  const [editDate, setEditDate] = useState('2026-11-20');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      const res = await hrApi.listRequests({ type: typeFilter, status: statusFilter });
      setRequests(res);
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const handleOpenApprovalModal = (r: any) => {
    setApprovingReq(r);
    setApprovalError(null);
    setApprovalType('authorized_leader');
    setApproverEmployeeId('EMP-008');
    setExternalRef('BOARD-RESOLUTION-2026-Q3');
    setVerificationNotes(`Verified signed authorization for ${r.employee_name} (${r.target_role})`);
  };

  const handleOpenEditModal = (r: any) => {
    setEditingReq(r);
    setEditError(null);
    setEditRole(r.target_role || 'SC');
    setEditVertical(r.target_vertical || 'wealth');
    setEditTeamId(r.target_team_id || 'TEAM-WEALTH-BETA');
    const dStr = r.effective_date ? new Date(r.effective_date).toISOString().split('T')[0] : '2026-11-20';
    setEditDate(dStr);
  };

  const handleSubmitApproval = async () => {
    if (!approvingReq) return;
    try {
      setApprovalSubmitting(true);
      setApprovalError(null);
      await hrApi.attachApproval(approvingReq.id, {
        approvalType,
        approverEmployeeId: approvalType === 'authorized_leader' ? approverEmployeeId : undefined,
        externalReference: approvalType === 'verified_external_document' ? externalRef : undefined,
        verificationNotes,
      });
      setApprovingReq(null);
      void loadRequests();
    } catch (err: any) {
      setApprovalError(err?.message || 'Failed to attach approval.');
    } finally {
      setApprovalSubmitting(false);
    }
  };

  const handleSubmitEdit = async () => {
    if (!editingReq) return;
    try {
      setEditSubmitting(true);
      setEditError(null);
      await hrApi.updateRequest(editingReq.id, {
        targetRole: editRole as any,
        newVertical: editVertical as any,
        newTeamId: editTeamId,
        effectiveDate: editDate,
      });
      setEditingReq(null);
      void loadRequests();
    } catch (err: any) {
      setEditError(err?.message || 'Failed to update request.');
    } finally {
      setEditSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            Workspace / Human Resources
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">Lifecycle Requests Tracker</h1>
          <p className="text-xs text-muted-foreground">
            Monitor employee account requests, transfers, promotions and exits across Super Admin queues
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-sm"
          >
            <option value="">All Types</option>
            <option value="new_account">Joiners (HR-01)</option>
            <option value="team_transfer">Movers (HR-02)</option>
            <option value="promotion">Promotions (HR-03)</option>
            <option value="exit">Leavers (HR-04)</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-sm"
          >
            <option value="">All Statuses</option>
            <option value="submitted">Submitted (Pending Approval)</option>
            <option value="approved">Approved (Ready for Super Admin)</option>
            <option value="activated_by_admin">Activated by Admin</option>
            <option value="returned">Returned</option>
            <option value="rejected">Rejected</option>
          </select>
          <Button variant="outline" size="sm" onClick={loadRequests} className="h-8 gap-1.5 text-xs">
            <RefreshCw className="size-3.5" /> Refresh
          </Button>
        </div>
      </div>

      <Card className="border shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground border-b uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-6 py-3">Request ID</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Employee / Name</th>
                  <th className="px-6 py-3">Target Placement</th>
                  <th className="px-6 py-3">Effective Date</th>
                  <th className="px-6 py-3">Approvals Evidence</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y text-muted-foreground">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="p-4"><SkeletonRows rows={4} /></td>
                  </tr>
                ) : requests.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">
                      No lifecycle requests match selected filters.
                    </td>
                  </tr>
                ) : (
                  requests.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/20">
                      <td className="px-6 py-3.5 font-mono text-foreground font-medium whitespace-nowrap">
                        {r.id} <span className="ml-1 text-[10px] text-muted-foreground font-sans font-normal">(v{r.request_version || 1})</span>
                      </td>
                      <td className="px-6 py-3.5 capitalize font-medium">{r.request_type?.replace('_', ' ')}</td>
                      <td className="px-6 py-3.5 font-medium text-foreground">{r.employee_name}</td>
                      <td className="px-6 py-3.5">{r.target_role} · {r.target_vertical} ({r.target_team_name || r.target_team_id || '—'})</td>
                      <td className="px-6 py-3.5 whitespace-nowrap">{new Date(r.effective_date).toLocaleDateString()} {r.effective_time}</td>
                      <td className="px-6 py-3.5 max-w-xs">
                        {r.approval_id ? (
                          <div className="space-y-0.5">
                            <span className="font-semibold text-emerald-700 flex items-center gap-1">
                              ✓ {r.approval_type === 'authorized_leader' ? `Leader: ${r.approver_name}` : `Doc: ${r.external_reference}`}
                            </span>
                            <div className="text-[11px] text-muted-foreground truncate" title={r.verification_notes}>
                              {r.verification_notes}
                            </div>
                          </div>
                        ) : (
                          <div className="text-muted-foreground italic truncate" title={r.approvals_summary}>
                            {r.approvals_summary || 'No verified approval'}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-3.5 whitespace-nowrap">
                        <Badge
                          className={
                            r.status === 'activated_by_admin'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : r.status === 'approved'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : r.status === 'rejected'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : r.status === 'returned'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }
                        >
                          {r.status === 'submitted' ? 'Submitted (Pending Approval)' : r.status?.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="px-6 py-3.5 text-right whitespace-nowrap">
                        {r.status === 'submitted' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              onClick={() => handleOpenApprovalModal(r)}
                              className="h-7 text-[11px] bg-[#113F3D] hover:bg-[#113F3D]/90 text-white"
                            >
                              Attach Approval
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenEditModal(r)}
                              className="h-7 text-[11px]"
                            >
                              Edit
                            </Button>
                          </div>
                        ) : r.status === 'approved' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenEditModal(r)}
                              className="h-7 text-[11px]"
                              title="Modifying request parameters will invalidate this approval and require re-approval"
                            >
                              Edit Details
                            </Button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Attach Genuine Approval Modal */}
      {approvingReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg border shadow-xl bg-background">
            <CardHeader className="border-b pb-3">
              <CardTitle className="text-base font-semibold text-foreground">
                Attach Verified Lifecycle Approval
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Request {approvingReq.id} (v{approvingReq.request_version || 1}) · {approvingReq.employee_name} ({approvingReq.target_role})
              </p>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {approvalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800">
                  {approvalError}
                </div>
              )}

              <div className="p-3 bg-muted/40 rounded border text-xs space-y-1">
                <div className="font-semibold text-foreground">Target Request Boundary</div>
                <div className="text-muted-foreground">
                  Role: <span className="font-medium text-foreground">{approvingReq.target_role}</span> · Team: <span className="font-medium text-foreground">{approvingReq.target_team_name || approvingReq.target_team_id}</span> · Effective: <span className="font-medium text-foreground">{new Date(approvingReq.effective_date).toLocaleDateString()}</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground">Approval Type</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setApprovalType('authorized_leader')}
                    className={`p-2 text-xs font-medium rounded border text-left transition ${
                      approvalType === 'authorized_leader'
                        ? 'border-[#113F3D] bg-[#113F3D]/10 text-[#113F3D] font-semibold'
                        : 'border-input hover:bg-muted/40'
                    }`}
                  >
                    1. Authorized Leader Sign-off
                  </button>
                  <button
                    type="button"
                    onClick={() => setApprovalType('verified_external_document')}
                    className={`p-2 text-xs font-medium rounded border text-left transition ${
                      approvalType === 'verified_external_document'
                        ? 'border-[#113F3D] bg-[#113F3D]/10 text-[#113F3D] font-semibold'
                        : 'border-input hover:bg-muted/40'
                    }`}
                  >
                    2. Verified External Document / Resolution
                  </button>
                </div>
              </div>

              {approvalType === 'authorized_leader' ? (
                <div>
                  <label className="text-xs font-medium text-foreground">Authorized Approver (Active Leader)</label>
                  <select
                    value={approverEmployeeId}
                    onChange={(e) => setApproverEmployeeId(e.target.value)}
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm"
                  >
                    <option value="EMP-008">EMP-008 — Kavita Rao (Regional Manager South)</option>
                    <option value="EMP-007">EMP-007 — Dev Mehta (Manager)</option>
                    <option value="EMP-009">EMP-009 — National Leadership</option>
                    <option value="EMP-002">EMP-002 — Ravi Menon (Team Leader)</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-medium text-foreground">External Document / Authorization Code</label>
                  <Input
                    value={externalRef}
                    onChange={(e) => setExternalRef(e.target.value)}
                    placeholder="e.g. DOC-EXECUTIVE-BOARD-2026-09"
                    className="mt-1"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-foreground">Auditable Verification Notes</label>
                <Input
                  value={verificationNotes}
                  onChange={(e) => setVerificationNotes(e.target.value)}
                  placeholder="Record who confirmed authorization, evidence archive reference, or sign-off notes"
                  className="mt-1"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setApprovingReq(null)}
                  disabled={approvalSubmitting}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSubmitApproval}
                  disabled={approvalSubmitting}
                  className="text-xs bg-[#113F3D] hover:bg-[#113F3D]/90 text-white"
                >
                  {approvalSubmitting ? 'Attaching...' : 'Record & Verify Approval'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Request Parameters Modal (Demonstrating Approval Invalidation) */}
      {editingReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg border shadow-xl bg-background">
            <CardHeader className="border-b pb-3">
              <CardTitle className="text-base font-semibold text-foreground">
                Edit Request Parameters (Will Invalidate Approval)
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Request {editingReq.id} (Current: v{editingReq.request_version || 1}) · {editingReq.employee_name}
              </p>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {editError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800">
                  {editError}
                </div>
              )}

              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="size-4 text-amber-600 shrink-0" />
                  Approval Invalidation Boundary
                </div>
                <div>
                  Modifying target role, team, or effective date increments the request version to{' '}
                  <span className="font-mono font-bold">v{(editingReq.request_version || 1) + 1}</span> and{' '}
                  <strong>invalidates previous approvals</strong>. Super Admin will not be able to activate this request until a new verified approval is attached.
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-foreground">Destination Role</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm"
                  >
                    <option value="SC">Sales Associate (SC)</option>
                    <option value="TL">Team Leader (TL)</option>
                    <option value="MG">Manager (MG)</option>
                    <option value="RM">Regional Manager (RM)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground">Destination Team</label>
                  <select
                    value={editTeamId}
                    onChange={(e) => setEditTeamId(e.target.value)}
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm"
                  >
                    <option value="TEAM-WEALTH-ALPHA">Wealth Alpha</option>
                    <option value="TEAM-WEALTH-BETA">Wealth Beta</option>
                    <option value="TEAM-WEALTH-GAMMA">Wealth Gamma</option>
                    <option value="TEAM-BANKING-ALPHA">Banking Alpha</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-foreground">Effective Date</label>
                  <Input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingReq(null)}
                  disabled={editSubmitting}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSubmitEdit}
                  disabled={editSubmitting}
                  className="text-xs bg-amber-700 hover:bg-amber-800 text-white"
                >
                  {editSubmitting ? 'Saving...' : 'Update & Invalidate Prior Approval'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
