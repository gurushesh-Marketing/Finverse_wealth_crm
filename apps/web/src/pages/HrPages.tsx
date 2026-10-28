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
  Shield,
  Briefcase,
  Home,
  MapPin,
  Calendar,
  Sparkles,
  Building2,
  DollarSign,
} from 'lucide-react';
import { hrApi } from '../lib/hr-api';
import { leaveApi } from '../lib/leave-api';
import { attendanceApi } from '../lib/attendance-api';
import { PayrollPreviewTab } from '../components/payroll/PayrollPreviewTab';
import type {
  LeaveRequestRecord,
  ApproverConfigRecord,
  ResourceViewPayload,
  DailyResourceBreakdownItem,
  CalendarHolidayRecord,
  AttendanceRecord,
  AttendanceRegularizationRecord,
} from '@finverse/contracts';
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
// ============================================================================
// 2. HR-01: Onboard New Employee (4-Field Submission & Generated ID) (/hr/joiners)
// ============================================================================
// Teams and Managers for HR Candidate Placement Proposals
// ============================================================================
const HR_TEAMS_BY_VERT: Record<string, { id: string; name: string }[]> = {
  wealth: [
    { id: 'TEAM-WEALTH-ALPHA', name: 'Wealth Alpha' },
    { id: 'TEAM-WEALTH-BETA', name: 'Wealth Beta' },
    { id: 'TEAM-WEALTH-GAMMA', name: 'Wealth Gamma' },
  ],
  banking: [
    { id: 'TEAM-BANKING-ALPHA', name: 'Banking Alpha' },
    { id: 'TEAM-BANKING-BETA', name: 'Banking Beta' },
  ],
  markets: [
    { id: 'TEAM-MARKETS-ALPHA', name: 'Markets Alpha' },
    { id: 'TEAM-MARKETS-BETA', name: 'Markets Beta' },
  ],
  real_estate: [
    { id: 'TEAM-REALESTATE-ALPHA', name: 'Real Estate Alpha (Luxury Residential)' },
    { id: 'TEAM-REALESTATE-BETA', name: 'Real Estate Beta (Commercial Mandates)' },
  ],
};

const HR_MANAGERS_BY_VERT: Record<string, { id: string; name: string; role: string; teamId?: string }[]> = {
  wealth: [
    { id: 'EMP-003', name: 'Tara Iyer (REL · Wealth Alpha/Beta)', role: 'REL', teamId: 'TEAM-WEALTH-ALPHA' },
    { id: 'EMP-007', name: 'Neel Verma (MG · Wealth Manager)', role: 'MG', teamId: 'TEAM-WEALTH-ALPHA' },
    { id: 'EMP-008', name: 'Kavita Rao (RM · Wealth)', role: 'RM' },
  ],
  banking: [
    { id: 'EMP-016', name: 'Rohan Sen (REL · Banking Alpha)', role: 'REL', teamId: 'TEAM-BANKING-ALPHA' },
    { id: 'EMP-017', name: 'Kunal Shah (MG · Branch Manager, Banking Alpha)', role: 'MG', teamId: 'TEAM-BANKING-ALPHA' },
    { id: 'EMP-018', name: 'Priya Sen (REL · Banking Beta)', role: 'REL', teamId: 'TEAM-BANKING-BETA' },
    { id: 'EMP-019', name: 'Arjun Mehta (RM · Banking)', role: 'RM' },
  ],
  markets: [
    { id: 'EMP-005', name: 'Meera Nair (REL · Markets Alpha)', role: 'REL', teamId: 'TEAM-MARKETS-ALPHA' },
    { id: 'EMP-022', name: 'Manish Vyas (MG · Trading Manager, Markets Alpha)', role: 'MG', teamId: 'TEAM-MARKETS-ALPHA' },
    { id: 'EMP-023', name: 'Tarun Sen (REL · Markets Beta)', role: 'REL', teamId: 'TEAM-MARKETS-BETA' },
    { id: 'EMP-024', name: 'Rajesh Bansal (RM · Markets)', role: 'RM' },
  ],
  real_estate: [
    { id: 'EMP-027', name: 'Neha Gupta (REL · Real Estate Alpha)', role: 'REL', teamId: 'TEAM-REALESTATE-ALPHA' },
    { id: 'EMP-028', name: 'Vikramaditya Singhania (MG · Advisory Manager, Real Estate Alpha)', role: 'MG', teamId: 'TEAM-REALESTATE-ALPHA' },
    { id: 'EMP-032', name: 'Pooja Reddy (REL · Real Estate Beta)', role: 'REL', teamId: 'TEAM-REALESTATE-BETA' },
    { id: 'EMP-029', name: 'Siddharth Malhotra (RM · Real Estate)', role: 'RM' },
  ],
};

export function HrJoinersPage() {
  const [fullName, setFullName] = useState('');
  const [primaryMobile, setPrimaryMobile] = useState('');
  const [sameAsMobile, setSameAsMobile] = useState(true);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [email, setEmail] = useState('');

  // Proposed Placement State (HR proposes role, vertical, team, superior)
  const [proposedRole, setProposedRole] = useState<'SC' | 'REL' | 'TL' | 'MG' | 'RM' | 'NM' | 'DE' | 'HR' | 'SA'>('SC');
  const [proposedVertical, setProposedVertical] = useState<'wealth' | 'banking' | 'markets' | 'real_estate'>('wealth');
  const [proposedTeamId, setProposedTeamId] = useState('TEAM-WEALTH-ALPHA');
  const [proposedSuperiorId, setProposedSuperiorId] = useState('EMP-007');

  const [submitting, setSubmitting] = useState(false);
  const [submittedEmployee, setSubmittedEmployee] = useState<{
    employeeId: string;
    requestId: string;
    status: string;
    email: string;
    fullName: string;
    proposedRole: string;
    proposedVertical: string;
    proposedTeamId?: string | null;
    proposedSuperiorId?: string | null;
  } | null>(null);
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

  const handleMobileChange = (val: string) => {
    setPrimaryMobile(val);
    if (sameAsMobile) {
      setWhatsappNumber(val);
    }
  };

  const handleSameAsMobileToggle = (checked: boolean) => {
    setSameAsMobile(checked);
    if (checked) {
      setWhatsappNumber(primaryMobile);
    }
  };

  const handleVerticalChange = (vert: 'wealth' | 'banking' | 'markets' | 'real_estate') => {
    setProposedVertical(vert);
    const teams = HR_TEAMS_BY_VERT[vert] || [];
    setProposedTeamId(teams[0]?.id || '');
    const mgrs = HR_MANAGERS_BY_VERT[vert] || [];
    setProposedSuperiorId(mgrs[0]?.id || '');
  };

  const handleSubmit = async () => {
    if (!fullName.trim() || !primaryMobile.trim() || !email.trim()) {
      setMessage({ type: 'error', text: 'Full name, primary mobile, and corporate email address are required.' });
      return;
    }

    try {
      setSubmitting(true);
      setMessage(null);
      const effectiveWhatsapp = sameAsMobile ? primaryMobile.trim() : (whatsappNumber.trim() || undefined);

      const res = await hrApi.submitOnboarding({
        fullName: fullName.trim(),
        primaryMobile: primaryMobile.trim(),
        whatsappNumber: effectiveWhatsapp,
        email: email.trim(),
        proposedRole,
        proposedVertical,
        proposedTeamId: proposedTeamId || undefined,
        proposedSuperiorId: proposedSuperiorId || undefined,
      });

      setSubmittedEmployee({
        employeeId: res.employeeId,
        requestId: res.requestId,
        status: res.status,
        email: email.trim(),
        fullName: fullName.trim(),
        proposedRole,
        proposedVertical,
        proposedTeamId,
        proposedSuperiorId,
      });

      setMessage({
        type: 'success',
        text: `Employee record created with immutable ID ${res.employeeId}. Proposed placement forwarded to Super Admin pending queue.`,
      });

      setFullName('');
      setPrimaryMobile('');
      setWhatsappNumber('');
      setEmail('');
      setSameAsMobile(true);
      void loadRequests();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to submit onboarding request.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DeckFrame
      actionCode="HR-01"
      moduleLabel="ONBOARDING"
      title="Create Pending Employee Record"
      subtitle="HR Employee Onboarding · Automated Sequence ID · Proposed Placement · Super Admin Gated Activation"
      steps={[
        'HR registers employee candidate identity (Name, Mobile, WhatsApp, Email) and proposes role, vertical, team, and superior.',
        'Server automatically generates a unique, immutable Employee ID (EMP-xxx) and pending approval request record.',
        'Super Admin reviews proposal, makes audited placement adjustments where required, and provisions initial credentials.',
      ]}
      whenCheckFails="Duplicate email address or primary mobile number returns 409 Conflict; missing fields return 422."
      permissionEvidence="HR never types an employee ID, sees passwords, or activates accounts. The permanent login username is the server-generated Employee ID."
      onSubmit={handleSubmit}
      submitting={submitting}
      submitLabel="Submit for Super Admin Approval"
    >
      <div className="space-y-5">
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          EMPLOYEE IDENTITY REGISTRATION & PLACEMENT PROPOSAL
        </div>
        <div className="text-base font-semibold text-foreground">
          Enter Candidate Details & Propose Organizational Placement
        </div>

        {message && (
          <div
            className={`p-3.5 text-xs rounded-md border ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
            }`}
          >
            {message.text}
          </div>
        )}

        {submittedEmployee && (
          <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-3">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold text-sm">
              <CheckCircle2 className="size-5 text-emerald-600" />
              Employee Record Queued for Super Admin Approval
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
              <div>
                <span className="text-muted-foreground">Generated Employee ID:</span>{' '}
                <span className="font-mono font-bold text-foreground text-sm bg-white dark:bg-slate-900 px-2 py-0.5 rounded border">
                  {submittedEmployee.employeeId}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Onboarding Status:</span>{' '}
                <Badge className="bg-amber-100 text-amber-800 border-amber-300">
                  Pending Super Admin Approval
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Full Name:</span>{' '}
                <span className="font-medium text-foreground">{submittedEmployee.fullName}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Work Email:</span>{' '}
                <span className="font-mono text-foreground">{submittedEmployee.email}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Proposed Placement:</span>{' '}
                <span className="font-medium text-foreground">
                  {submittedEmployee.proposedRole} · {submittedEmployee.proposedVertical}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Proposed Team:</span>{' '}
                <span className="font-mono text-xs text-foreground">
                  {submittedEmployee.proposedTeamId || '—'}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground pt-1 border-t border-emerald-200 dark:border-emerald-800/60">
              Notice: The permanent, non-editable login username for this employee will be <strong className="font-mono text-foreground">{submittedEmployee.employeeId}</strong>. Super Admin will review the proposed placement and provision a one-time temporary password.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-1">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-foreground">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Vikram Malhotra"
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-foreground">
              Primary Mobile Number <span className="text-rose-500">*</span>
            </label>
            <Input
              type="tel"
              value={primaryMobile}
              onChange={(e) => handleMobileChange(e.target.value)}
              placeholder="e.g. +91 98765 43210"
              className="mt-1"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground">WhatsApp Number</label>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={sameAsMobile}
                  onChange={(e) => handleSameAsMobileToggle(e.target.checked)}
                  className="rounded border-slate-300 text-primary focus:ring-primary size-3.5"
                />
                Same as primary mobile
              </label>
            </div>
            <Input
              type="tel"
              value={sameAsMobile ? primaryMobile : whatsappNumber}
              disabled={sameAsMobile}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              placeholder="e.g. +91 98765 43210"
              className="mt-1 disabled:opacity-75 disabled:bg-muted/40"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-foreground">
              Corporate Work Email <span className="text-rose-500">*</span>
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. vikram.malhotra@finverse.demo"
              className="mt-1"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Must be a unique address not previously allocated to active or offboarded personnel.
            </p>
          </div>

          {/* Proposed Organizational Placement Section */}
          <div className="sm:col-span-2 pt-3 border-t">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
              PROPOSED PLACEMENT & REPORTING STRUCTURE
            </div>
            <p className="text-xs text-muted-foreground">
              Propose target role, vertical, team, and superior. Super Admin will review and may apply audited adjustments before approving.
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-foreground">
              Proposed Role <span className="text-rose-500">*</span>
            </label>
            <select
              value={proposedRole}
              onChange={(e) => setProposedRole(e.target.value as any)}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="SC">Sales Caller (SC)</option>
              <option value="REL">Relationship Manager (REL)</option>
              <option value="TL">Team Leader (TL)</option>
              <option value="MG">Branch/Wealth Manager (MG)</option>
              <option value="RM">Regional Manager (RM)</option>
              <option value="NM">National Manager (NM)</option>
              <option value="DE">Data Entry (DE)</option>
              <option value="HR">Human Resources (HR)</option>
              <option value="SA">Super Admin (SA)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-foreground">
              Target Vertical <span className="text-rose-500">*</span>
            </label>
            <select
              value={proposedVertical}
              onChange={(e) => handleVerticalChange(e.target.value as any)}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="wealth">Wealth Management</option>
              <option value="banking">Commercial Banking</option>
              <option value="markets">Markets & Securities</option>
              <option value="real_estate">Real Estate Advisory</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-foreground">
              Proposed Team Placement <span className="text-rose-500">*</span>
            </label>
            <select
              value={proposedTeamId}
              onChange={(e) => setProposedTeamId(e.target.value)}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {(HR_TEAMS_BY_VERT[proposedVertical] || []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-foreground">
              Proposed Superior / Reporting Manager
            </label>
            <select
              value={proposedSuperiorId}
              onChange={(e) => setProposedSuperiorId(e.target.value)}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">None / Direct Placement</option>
              {(HR_MANAGERS_BY_VERT[proposedVertical] || []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* List of joiner requests */}
        {requests.length > 0 && (
          <div className="mt-6 pt-4 border-t">
            <div className="text-xs font-semibold text-foreground mb-2">
              Pending & Processed Onboarding Submissions
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-muted-foreground text-[10px] uppercase">
                  <tr>
                    <th className="px-3 py-2">Generated Employee ID</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Contact Details</th>
                    <th className="px-3 py-2">Proposed Placement</th>
                    <th className="px-3 py-2">Submitted</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-muted-foreground">
                  {requests.map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 py-2 font-mono font-bold text-foreground">
                        {r.employee_id || r.id}
                      </td>
                      <td className="px-3 py-2 font-medium text-foreground">{r.employee_name}</td>
                      <td className="px-3 py-2 font-mono text-[11px]">
                        <div>{r.work_email || r.email || r.employee_email}</div>
                        <div className="text-muted-foreground text-[10px]">📱 {r.primary_mobile || '—'}</div>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <span className="font-semibold text-foreground">
                          {r.target_role || r.proposed_role || 'SC'}
                        </span>
                        {' · '}
                        <span className="capitalize">{r.target_vertical || r.proposed_vertical || 'wealth'}</span>
                        <div className="font-mono text-[10px] text-muted-foreground">
                          {r.target_team_name || r.target_team_id || '—'}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {r.created_at ? new Date(r.created_at).toLocaleDateString() : 'Today'}
                      </td>
                      <td className="px-3 py-2">
                        <Badge
                          className={
                            r.status === 'activated_by_admin' || r.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : r.status === 'rejected'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-amber-50 text-amber-800 border-amber-300'
                          }
                        >
                          {r.status === 'submitted' || r.status === 'pending_approval' || r.status === 'pending_admin'
                            ? 'Pending Super Admin Approval'
                            : r.status?.replace('_', ' ')}
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
  const [activeTab, setActiveTab] = useState<'resource_visibility' | 'governance' | 'direct_log' | 'payroll_preview'>('resource_visibility');

  // Resource Visibility & Attendance State (Owner-Added Organization Resource View)
  const [resourcePayload, setResourcePayload] = useState<ResourceViewPayload | null>(null);
  const [resourceLoading, setResourceLoading] = useState(false);
  const [selectedVertical, setSelectedVertical] = useState<'all' | 'wealth' | 'banking' | 'markets' | 'real_estate'>('all');
  const [selectedDate, setSelectedDate] = useState(() => '2026-10-16');
  const [selectedRole, setSelectedRole] = useState('all');
  const [resourceSearch, setResourceSearch] = useState('');
  const [selectedBreakdownItem, setSelectedBreakdownItem] = useState<DailyResourceBreakdownItem | null>(null);

  // Supervisor & HR Exceptions Queue
  const [exceptions, setExceptions] = useState<{
    pendingRecords: AttendanceRecord[];
    pendingRegularizations: AttendanceRegularizationRecord[];
  }>({ pendingRecords: [], pendingRegularizations: [] });
  const [reviewModalItem, setReviewModalItem] = useState<{ type: 'wfh' | 'reg'; item: any } | null>(null);
  const [reviewDecision, setReviewDecision] = useState<'confirmed' | 'rejected' | 'approved'>('confirmed');
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // Direct Log State (HR-05 Deck P285/P286)
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

  // Governance State (Owner-Added Organization Leave Visibility & Approver Rules)
  const [orgRequests, setOrgRequests] = useState<LeaveRequestRecord[]>([]);
  const [loadingOrg, setLoadingOrg] = useState(true);
  const [filterVertical, setFilterVertical] = useState('all');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSearch, setFilterSearch] = useState('');
  const [selectedAuditRequest, setSelectedAuditRequest] = useState<LeaveRequestRecord | null>(null);

  // Approver Configuration State
  const [approverConfigs, setApproverConfigs] = useState<ApproverConfigRecord[]>([]);
  const [configRole, setConfigRole] = useState('CEO');
  const [configApproverId, setConfigApproverId] = useState('EMP-014');
  const [configTitle, setConfigTitle] = useState('Board Delegate / HR Governance');
  const [savingConfig, setSavingConfig] = useState(false);
  const [configMsg, setConfigMsg] = useState<string | null>(null);

  const loadResourceView = useCallback(async () => {
    try {
      setResourceLoading(true);
      const res = await attendanceApi.getResourceView({
        vertical: selectedVertical,
        date: selectedDate,
        role: selectedRole !== 'all' ? selectedRole : undefined,
      });
      setResourcePayload(res);
    } catch {
      // non-fatal
    } finally {
      setResourceLoading(false);
    }
  }, [selectedVertical, selectedDate, selectedRole]);

  const loadExceptions = useCallback(async () => {
    try {
      const res = await attendanceApi.getSupervisorExceptions();
      setExceptions(res);
    } catch {
      // non-fatal
    }
  }, []);

  const loadLeaves = useCallback(async () => {
    try {
      const res = await hrApi.listLeaves();
      setLeaves(res);
    } catch {
      // non-fatal
    }
  }, []);

  const loadOrgRequests = useCallback(async () => {
    try {
      setLoadingOrg(true);
      const res = await leaveApi.getOrganizationRequests({
        vertical: filterVertical !== 'all' ? filterVertical : undefined,
        role: filterRole !== 'all' ? filterRole : undefined,
        status: filterStatus !== 'all' ? filterStatus : undefined,
      });
      setOrgRequests(res);
    } catch {
      // non-fatal
    } finally {
      setLoadingOrg(false);
    }
  }, [filterVertical, filterRole, filterStatus]);

  const loadApproverConfigs = useCallback(async () => {
    try {
      const res = await leaveApi.getApproverConfigs();
      setApproverConfigs(res);
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    void loadResourceView();
    void loadExceptions();
    void loadLeaves();
    void loadOrgRequests();
    void loadApproverConfigs();
  }, [loadResourceView, loadExceptions, loadLeaves, loadOrgRequests, loadApproverConfigs]);

  const handleSubmitReview = async () => {
    if (!reviewModalItem) return;
    try {
      setReviewSubmitting(true);
      if (reviewModalItem.type === 'wfh') {
        await attendanceApi.reviewAttendanceRecord(reviewModalItem.item.id, {
          decision: reviewDecision as 'confirmed' | 'rejected',
          reviewNotes: reviewNotes.trim() || undefined,
        });
      } else {
        await attendanceApi.decideRegularization(reviewModalItem.item.id, {
          decision: (reviewDecision === 'confirmed' ? 'approved' : reviewDecision) as 'approved' | 'rejected',
          decisionNotes: reviewNotes.trim() || 'Reviewed by HR/Supervisor',
        });
      }
      setReviewModalItem(null);
      setReviewNotes('');
      void loadResourceView();
      void loadExceptions();
    } catch (err: any) {
      alert(err?.message || 'Failed to submit review decision.');
    } finally {
      setReviewSubmitting(false);
    }
  };

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
      void loadOrgRequests();
      void loadResourceView();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to record leave.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveApproverConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingConfig(true);
      setConfigMsg(null);
      await leaveApi.configureApprover({
        role: configRole as any,
        approverEmployeeId: configApproverId.trim() || null,
        approverTitle: configTitle.trim(),
        isConfigured: !!configApproverId.trim(),
        notes: `Configured via HR Governance panel`,
      });
      setConfigMsg(`Approver configuration for role ${configRole} updated successfully.`);
      void loadApproverConfigs();
    } catch (err: any) {
      setConfigMsg(`Failed to save configuration: ${err.message}`);
    } finally {
      setSavingConfig(false);
    }
  };

  const filteredBreakdown = (resourcePayload?.breakdown || []).filter((item) => {
    if (!resourceSearch.trim()) return true;
    const term = resourceSearch.toLowerCase();
    return (
      item.employeeName.toLowerCase().includes(term) ||
      item.employeeEmail.toLowerCase().includes(term) ||
      item.employeeRole.toLowerCase().includes(term) ||
      Boolean(item.teamName && item.teamName.toLowerCase().includes(term)) ||
      item.workLocationName.toLowerCase().includes(term)
    );
  });

  const filteredRequests = orgRequests.filter((r) => {
    if (!filterSearch.trim()) return true;
    const term = filterSearch.toLowerCase();
    return (
      r.id.toLowerCase().includes(term) ||
      (r.employeeName && r.employeeName.toLowerCase().includes(term)) ||
      (r.employeeEmail && r.employeeEmail.toLowerCase().includes(term)) ||
      (r.reason && r.reason.toLowerCase().includes(term))
    );
  });

  return (
    <DeckFrame
      actionCode="HR-05"
      moduleLabel="AVAILABILITY & RESOURCE VISIBILITY"
      title="Organization Resource Visibility, Attendance & Leave Hub"
      steps={[
        'Scope organization resources across verticals, teams, and configured locations.',
        'Track daily 7-classification breakdown: present, WFH, leave, holiday, off, pending, and absent.',
        'Review supervisor exceptions and enforce auditable attendance regularizations.',
      ]}
      whenCheckFails="Low CRM activity alone does not mark employees absent. Missing or inconsistent records trigger auditable supervisor review."
      permissionEvidence="HR visibility covers organization-wide resource allocation, statutory holiday calendars, and supervisor approval lineage."
      onSubmit={activeTab === 'direct_log' ? handleSubmit : undefined}
      submitting={submitting}
      submitLabel={activeTab === 'direct_log' ? 'Publish Override' : undefined}
      submitDisabled={activeTab !== 'direct_log'}
    >
      <div className="space-y-5">
        {/* Triple Tab Navigation */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab('resource_visibility')}
            className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'resource_visibility'
                ? 'border-[#113F3D] text-[#113F3D]'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            data-testid="tab-resource-visibility"
          >
            <Users className="size-4" /> Resource Visibility & Attendance ({resourcePayload?.metrics.totalEmployees || 0})
          </button>
          <button
            onClick={() => setActiveTab('governance')}
            className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'governance'
                ? 'border-[#113F3D] text-[#113F3D]'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            data-testid="tab-leave-governance"
          >
            <ShieldCheck className="size-4" /> Organization Leave Governance ({orgRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('direct_log')}
            className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'direct_log'
                ? 'border-[#113F3D] text-[#113F3D]'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            data-testid="tab-direct-log"
          >
            <CalendarDays className="size-4" /> Manual Lead Allocation Override (HR-05)
          </button>
          <button
            onClick={() => setActiveTab('payroll_preview')}
            className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'payroll_preview'
                ? 'border-[#113F3D] text-[#113F3D]'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            data-testid="tab-payroll-preview"
          >
            <DollarSign className="size-4" /> Compensation & Payroll Preview
          </button>
        </div>

        {/* TAB 0: RESOURCE VISIBILITY & ATTENDANCE BREAKDOWN */}
        {activeTab === 'resource_visibility' && (
          <div className="space-y-5">
            {/* 1. One-Click Vertical Selector */}
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Scope View by Vertical</span>
                <div className="flex items-center gap-1.5 mt-1">
                  {[
                    { id: 'all', label: 'All Verticals' },
                    { id: 'wealth', label: 'Wealth' },
                    { id: 'banking', label: 'Banking' },
                    { id: 'markets', label: 'Markets' },
                    { id: 'real_estate', label: 'Real Estate' },
                  ].map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      data-testid={`vertical-tab-${v.id}`}
                      onClick={() => setSelectedVertical(v.id as any)}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                        selectedVertical === v.id
                          ? 'bg-[#113F3D] text-white shadow-sm'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date & Filter Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">Date:</label>
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    data-testid="resource-date-picker"
                    className="h-8 text-xs w-36"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedDate('2026-10-16')}
                    className="h-8 text-[11px] px-2 text-muted-foreground"
                  >
                    Sim Day
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}
                    className="h-8 text-[11px] px-2 text-muted-foreground"
                  >
                    Today
                  </Button>
                </div>

                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="all">All Roles</option>
                  <option value="SC">Sales Associate (SC)</option>
                  <option value="TL">Team Leader (TL)</option>
                  <option value="MG">Manager (MG)</option>
                  <option value="RM">Regional Manager (RM)</option>
                  <option value="NM">National Manager (NM)</option>
                  <option value="CEO">Chief Executive (CEO)</option>
                  <option value="CFO">Chief Financial (CFO)</option>
                  <option value="HR">Human Resources (HR)</option>
                </select>

                <Button variant="outline" size="sm" onClick={loadResourceView} className="h-8 text-xs">
                  <RefreshCw className="size-3.5 mr-1" /> Refresh
                </Button>
              </div>
            </div>

            {/* 2. 7-Classification Summary Metrics */}
            {resourcePayload && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
                  <Card className="p-2.5 bg-emerald-50/60 border-emerald-200/80" data-testid="metric-card-confirmed-present">
                    <div className="text-[10px] uppercase font-bold text-emerald-800">Confirmed Present</div>
                    <div className="text-xl font-extrabold text-emerald-950 mt-0.5">
                      {resourcePayload.metrics.confirmedPresent}
                    </div>
                  </Card>
                  <Card className="p-2.5 bg-blue-50/60 border-blue-200/80" data-testid="metric-card-wfh">
                    <div className="text-[10px] uppercase font-bold text-blue-800">WFH</div>
                    <div className="text-xl font-extrabold text-blue-950 mt-0.5">
                      {resourcePayload.metrics.wfhCount}
                    </div>
                  </Card>
                  <Card className="p-2.5 bg-purple-50/60 border-purple-200/80" data-testid="metric-card-approved-leave">
                    <div className="text-[10px] uppercase font-bold text-purple-800">Approved Leave</div>
                    <div className="text-xl font-extrabold text-purple-950 mt-0.5">
                      {resourcePayload.metrics.approvedLeaveCount}
                    </div>
                  </Card>
                  <Card className="p-2.5 bg-amber-50/60 border-amber-200/80" data-testid="metric-card-holiday">
                    <div className="text-[10px] uppercase font-bold text-amber-800">Holiday</div>
                    <div className="text-xl font-extrabold text-amber-950 mt-0.5">
                      {resourcePayload.metrics.holidayCount}
                    </div>
                  </Card>
                  <Card className="p-2.5 bg-slate-50/80 border-slate-200" data-testid="metric-card-weekly-off">
                    <div className="text-[10px] uppercase font-bold text-slate-700">Weekly Off</div>
                    <div className="text-xl font-extrabold text-slate-900 mt-0.5">
                      {resourcePayload.metrics.weeklyOffCount}
                    </div>
                  </Card>
                  <Card className="p-2.5 bg-orange-50/60 border-orange-200/80" data-testid="metric-card-pending-confirmation">
                    <div className="text-[10px] uppercase font-bold text-orange-800">Pending Review</div>
                    <div className="text-xl font-extrabold text-orange-950 mt-0.5">
                      {resourcePayload.metrics.pendingConfirmationCount}
                    </div>
                  </Card>
                  <Card className="p-2.5 bg-rose-50/60 border-rose-200/80" data-testid="metric-card-recorded-absence">
                    <div className="text-[10px] uppercase font-bold text-rose-800">Recorded Absence</div>
                    <div className="text-xl font-extrabold text-rose-950 mt-0.5">
                      {resourcePayload.metrics.recordedAbsenceCount}
                    </div>
                  </Card>
                </div>

                {/* Statutory working days and policy banner */}
                <div className="flex flex-col sm:flex-row items-center justify-between text-xs px-3 py-2 rounded-lg bg-muted/40 border border-border">
                  <div className="flex items-center gap-2">
                    <Calendar className="size-4 text-[#113F3D]" />
                    <span>
                      <strong>Scheduled Working Days:</strong> {resourcePayload.metrics.scheduledWorkingDays} ·{' '}
                      <strong>Configured Location Holidays:</strong> {resourcePayload.holidaysForMonth.length}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    Holiday applicability is based on configured work location and policy, not assumed from vertical alone.
                  </span>
                </div>
              </div>
            )}

            {/* 3. Search and Table Toolbar */}
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-2 size-3.5 text-muted-foreground" />
                <Input
                  value={resourceSearch}
                  onChange={(e) => setResourceSearch(e.target.value)}
                  placeholder="Search by name, role, team, location..."
                  className="pl-8 h-8 text-xs"
                />
              </div>
              <div className="text-xs text-muted-foreground font-medium">
                Showing {filteredBreakdown.length} of {resourcePayload?.metrics.totalEmployees || 0} employees
              </div>
            </div>

            {/* 4. Daily Resource Breakdown Table */}
            <div className="border rounded-md overflow-x-auto bg-card">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-muted-foreground text-[10px] uppercase border-b">
                  <tr>
                    <th className="px-3 py-2.5">Employee</th>
                    <th className="px-3 py-2.5">Role / Vertical</th>
                    <th className="px-3 py-2.5">Team & Work Location</th>
                    <th className="px-3 py-2.5">Attendance Classification</th>
                    <th className="px-3 py-2.5">Work Mode / Hours</th>
                    <th className="px-3 py-2.5">Nature / Activity</th>
                    <th className="px-3 py-2.5 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-muted-foreground">
                  {resourceLoading ? (
                    <tr>
                      <td colSpan={7} className="p-4"><SkeletonRows rows={5} /></td>
                    </tr>
                  ) : filteredBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                        No employees found matching the selected vertical and search filters.
                      </td>
                    </tr>
                  ) : (
                    filteredBreakdown.map((item) => (
                      <tr key={item.employeeId} className="hover:bg-muted/20">
                        {/* Employee */}
                        <td className="px-3 py-2.5">
                          <div className="font-semibold text-foreground flex items-center gap-1.5">
                            <span className="size-6 rounded-full bg-[#113F3D]/10 text-[#113F3D] font-bold text-[10px] flex items-center justify-center">
                              {item.employeeName.slice(0, 1)}
                            </span>
                            <span>{item.employeeName}</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground pl-7">{item.employeeEmail}</div>
                        </td>

                        {/* Role / Vertical */}
                        <td className="px-3 py-2.5">
                          <Badge variant="outline" className="text-[10px] uppercase font-bold">
                            {item.employeeRole} • {item.vertical}
                          </Badge>
                        </td>

                        {/* Team & Location */}
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-foreground">{item.teamName}</div>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="size-3 text-muted-foreground" />
                            <span>{item.workLocationName}</span>
                          </div>
                        </td>

                        {/* Classification Chip (Distinct 7 Badges) */}
                        <td className="px-3 py-2.5">
                          {item.classification === 'confirmed_present' && (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold text-[11px] gap-1" data-testid="chip-confirmed-present">
                              <CheckCircle2 className="size-3" /> Confirmed Present
                            </Badge>
                          )}
                          {item.classification === 'wfh' && (
                            <Badge className="bg-blue-100 text-blue-800 border-blue-300 font-semibold text-[11px] gap-1" data-testid="chip-wfh">
                              <Home className="size-3" /> WFH
                            </Badge>
                          )}
                          {item.classification === 'approved_leave' && (
                            <div>
                              <Badge className="bg-purple-100 text-purple-800 border-purple-300 font-semibold text-[11px] gap-1" data-testid="chip-approved-leave">
                                <CalendarDays className="size-3" /> Approved Leave
                              </Badge>
                              {item.leaveDetails && (
                                <div className="text-[10px] text-purple-900 mt-0.5">
                                  {item.leaveDetails.leaveType} ({item.leaveDetails.startDate} - {item.leaveDetails.endDate}) · Superior: {item.leaveDetails.approvingSuperiorName || 'Authorized'}
                                </div>
                              )}
                            </div>
                          )}
                          {item.classification === 'holiday' && (
                            <div>
                              <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-semibold text-[11px] gap-1" data-testid="chip-holiday">
                                <Sparkles className="size-3" /> Holiday
                              </Badge>
                              {item.holidayDetails && (
                                <div className="text-[10px] text-amber-900 mt-0.5">
                                  {item.holidayDetails.holidayName} ({item.holidayDetails.holidayType})
                                </div>
                              )}
                            </div>
                          )}
                          {item.classification === 'weekly_off' && (
                            <Badge className="bg-slate-100 text-slate-700 border-slate-300 font-semibold text-[11px] gap-1" data-testid="chip-weekly-off">
                              <Clock className="size-3" /> Weekly Off
                            </Badge>
                          )}
                          {item.classification === 'pending_confirmation' && (
                            <Badge className="bg-orange-100 text-orange-800 border-orange-300 font-semibold text-[11px] gap-1" data-testid="chip-pending-confirmation">
                              <AlertTriangle className="size-3" /> Pending Confirmation
                            </Badge>
                          )}
                          {item.classification === 'recorded_absence' && (
                            <Badge className="bg-rose-100 text-rose-800 border-rose-300 font-semibold text-[11px] gap-1" data-testid="chip-recorded-absence">
                              <X className="size-3" /> Recorded Absence
                            </Badge>
                          )}
                        </td>

                        {/* Mode & Hours */}
                        <td className="px-3 py-2.5">
                          {item.workMode ? (
                            <div>
                              <div className="font-medium text-foreground uppercase text-[11px]">
                                {item.workMode} {item.totalHours !== null ? `(${item.totalHours} hrs)` : ''}
                              </div>
                              {item.checkInAt && (
                                <div className="text-[10px] text-muted-foreground">
                                  In: {new Date(item.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  {item.checkOutAt && ` · Out: ${new Date(item.checkOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">—</span>
                          )}
                        </td>

                        {/* Nature / Activity */}
                        <td className="px-3 py-2.5">
                          <div className="flex flex-col gap-0.5">
                            {item.isOfflineWork ? (
                              <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-900 border-amber-200 w-fit">
                                Offline Work
                              </Badge>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">CRM Direct</span>
                            )}
                            <span className="text-[10px] text-muted-foreground">Activity: {item.crmActivityCount} actions</span>
                          </div>
                        </td>

                        {/* Details Drawer Trigger */}
                        <td className="px-3 py-2.5 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-[#113F3D] hover:bg-[#113F3D]/10"
                            onClick={() => setSelectedBreakdownItem(item)}
                          >
                            Inspect
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* 5. Supervisor Exceptions & Inconsistent Entries Queue */}
            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <AlertTriangle className="size-4 text-amber-600" />
                    Supervisor Review & Exceptions Queue ({exceptions.pendingRecords.length + exceptions.pendingRegularizations.length})
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Review unconfirmed WFH deliverables and auditable attendance regularization requests. Zero self-approval enforced.
                  </p>
                </div>
              </div>

              {exceptions.pendingRecords.length === 0 && exceptions.pendingRegularizations.length === 0 ? (
                <div className="p-4 rounded-md bg-muted/20 text-center text-xs text-muted-foreground">
                  No missing updates or inconsistent attendance records requiring review.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {/* Pending WFH Records */}
                  {exceptions.pendingRecords.map((rec) => (
                    <div key={rec.id} className="p-3 rounded-lg border border-blue-200 bg-blue-50/30 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">{rec.employeeName} ({rec.employeeRole} • {rec.vertical})</span>
                        <Badge className="bg-blue-100 text-blue-800 text-[10px] font-semibold">WFH Deliverables Pending</Badge>
                      </div>
                      <p className="text-muted-foreground text-[11px]">
                        <strong>Date:</strong> {rec.workDate} · In: {new Date(rec.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {rec.totalHours && ` · ${rec.totalHours} hrs`}
                      </p>
                      {rec.wfhProgressSummary && (
                        <p className="text-[11px] text-foreground bg-white/60 p-1.5 rounded border border-blue-100">
                          "{rec.wfhProgressSummary}"
                        </p>
                      )}
                      <div className="flex justify-end pt-1">
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-[#113F3D] hover:bg-[#113F3D]/90 text-white"
                          onClick={() => {
                            setReviewModalItem({ type: 'wfh', item: rec });
                            setReviewDecision('confirmed');
                            setReviewNotes('');
                          }}
                        >
                          Review & Confirm
                        </Button>
                      </div>
                    </div>
                  ))}

                  {/* Pending Regularizations */}
                  {exceptions.pendingRegularizations.map((reg) => (
                    <div key={reg.id} className="p-3 rounded-lg border border-amber-200 bg-amber-50/40 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">{reg.employeeName} ({reg.employeeRole} • {reg.vertical})</span>
                        <Badge className="bg-amber-100 text-amber-800 text-[10px] font-semibold">Regularization Request</Badge>
                      </div>
                      <p className="text-muted-foreground text-[11px]">
                        <strong>Requested:</strong> {reg.workDate} ({reg.requestedWorkMode.toUpperCase()})
                      </p>
                      <p className="text-[11px] text-foreground bg-white/60 p-1.5 rounded border border-amber-100">
                        "{reg.reason}"
                      </p>
                      <div className="flex justify-end pt-1">
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-[#113F3D] hover:bg-[#113F3D]/90 text-white"
                          onClick={() => {
                            setReviewModalItem({ type: 'reg', item: reg });
                            setReviewDecision('approved');
                            setReviewNotes('');
                          }}
                        >
                          Review Regularization
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 6. Configured Location Holiday Calendars Reference */}
            {resourcePayload?.holidaysForMonth && resourcePayload.holidaysForMonth.length > 0 && (
              <div className="rounded-lg border border-border bg-card p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="size-4 text-amber-600" />
                  Configured Statutory & Festival Holidays for Month ({resourcePayload.selectedDate.slice(0, 7)})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  {resourcePayload.holidaysForMonth.map((hol) => (
                    <div key={hol.id} className="p-2.5 rounded-lg border border-amber-200/80 bg-amber-50/30">
                      <div className="font-bold text-amber-950">{hol.holidayName}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">Date: {hol.holidayDate}</div>
                      <div className="text-[10px] text-amber-800 font-medium mt-0.5">
                        Location: {hol.locationName} · {hol.holidayType}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Inspect Item Modal */}
            {selectedBreakdownItem && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
                role="dialog"
                aria-modal="true"
              >
                <div className="w-full max-w-lg rounded-xl border border-border bg-background p-5 shadow-2xl space-y-4">
                  <div className="flex items-center justify-between border-b pb-3">
                    <div>
                      <h4 className="font-semibold text-sm text-foreground">
                        Resource Profile • {selectedBreakdownItem.employeeName}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {selectedBreakdownItem.employeeRole} • {selectedBreakdownItem.teamName} ({selectedBreakdownItem.vertical})
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedBreakdownItem(null)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-3 p-3 bg-muted/20 rounded-lg">
                      <div>
                        <span className="text-muted-foreground block text-[10px] uppercase font-bold">Work Location</span>
                        <span className="font-semibold text-foreground">{selectedBreakdownItem.workLocationName}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px] uppercase font-bold">Date</span>
                        <span className="font-semibold text-foreground">{selectedBreakdownItem.date}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px] uppercase font-bold">Classification</span>
                        <span className="font-semibold text-foreground capitalize">{selectedBreakdownItem.classification.replace('_', ' ')}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px] uppercase font-bold">Work Mode</span>
                        <span className="font-semibold text-foreground uppercase">{selectedBreakdownItem.workMode || 'None recorded'}</span>
                      </div>
                    </div>

                    {selectedBreakdownItem.leaveDetails && (
                      <div className="p-3 rounded-lg border border-purple-200 bg-purple-50/30">
                        <span className="font-bold text-purple-900 block text-[11px]">Approved Leave Details</span>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Window: {selectedBreakdownItem.leaveDetails.startDate} to {selectedBreakdownItem.leaveDetails.endDate}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Approving Superior: {selectedBreakdownItem.leaveDetails.approvingSuperiorName || 'Authorized Supervisor'}
                        </p>
                      </div>
                    )}

                    {selectedBreakdownItem.holidayDetails && (
                      <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/30">
                        <span className="font-bold text-amber-900 block text-[11px]">Applicable Holiday</span>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {selectedBreakdownItem.holidayDetails.holidayName} ({selectedBreakdownItem.holidayDetails.holidayType})
                        </p>
                      </div>
                    )}

                    <div className="p-3 rounded-lg bg-muted/40 text-[11px] text-muted-foreground">
                      <strong>Activity Status:</strong> {selectedBreakdownItem.crmActivityCount} actions recorded in CRM. Offline work: {selectedBreakdownItem.isOfflineWork ? 'Yes (Protected from loss of pay)' : 'No'}.
                    </div>
                  </div>

                  <div className="flex justify-end pt-2 border-t">
                    <Button variant="outline" size="sm" onClick={() => setSelectedBreakdownItem(null)} className="text-xs">
                      Close
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Supervisor Review Modal */}
            {reviewModalItem && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
                role="dialog"
                aria-modal="true"
              >
                <div className="w-full max-w-md rounded-xl border border-border bg-background p-5 shadow-2xl space-y-4">
                  <div className="flex items-center justify-between border-b pb-3">
                    <h4 className="font-semibold text-sm text-foreground">
                      {reviewModalItem.type === 'wfh' ? 'Review WFH Shift Deliverables' : 'Decide Regularization Request'}
                    </h4>
                    <button
                      onClick={() => setReviewModalItem(null)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase font-bold">Employee</span>
                      <span className="font-semibold text-foreground">{reviewModalItem.item.employeeName} ({reviewModalItem.item.workDate})</span>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-foreground">Decision</label>
                      <div className="flex gap-2 mt-1">
                        <button
                          type="button"
                          onClick={() => setReviewDecision('confirmed')}
                          className={`flex-1 py-1.5 rounded border text-xs font-semibold ${
                            reviewDecision === 'confirmed' || reviewDecision === 'approved'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : 'border-border text-muted-foreground'
                          }`}
                        >
                          Confirm / Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => setReviewDecision('rejected')}
                          className={`flex-1 py-1.5 rounded border text-xs font-semibold ${
                            reviewDecision === 'rejected'
                              ? 'bg-rose-50 text-rose-800 border-rose-300'
                              : 'border-border text-muted-foreground'
                          }`}
                        >
                          Reject
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-foreground">Decision Notes & Audit Trace</label>
                      <Textarea
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        placeholder="Provide verification notes (deliverables reviewed, hours accepted)..."
                        className="mt-1 text-xs"
                        rows={3}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button variant="outline" size="sm" onClick={() => setReviewModalItem(null)} className="text-xs">
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSubmitReview}
                      disabled={reviewSubmitting}
                      className="text-xs bg-[#113F3D] hover:bg-[#113F3D]/90 text-white"
                    >
                      {reviewSubmitting ? 'Recording...' : 'Submit Decision'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 1: ORGANIZATION LEAVE GOVERNANCE */}
        {activeTab === 'governance' && (
          <div className="space-y-4">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Card className="p-3 bg-muted/20">
                <div className="text-[10px] uppercase font-semibold text-muted-foreground">Total Requests</div>
                <div className="text-xl font-bold text-foreground mt-0.5">{orgRequests.length}</div>
              </Card>
              <Card className="p-3 bg-amber-50/50 border-amber-200/60">
                <div className="text-[10px] uppercase font-semibold text-amber-800">Pending Review</div>
                <div className="text-xl font-bold text-amber-900 mt-0.5">
                  {orgRequests.filter((r) => r.status === 'submitted').length}
                </div>
              </Card>
              <Card className="p-3 bg-emerald-50/50 border-emerald-200/60">
                <div className="text-[10px] uppercase font-semibold text-emerald-800">Approved Leaves</div>
                <div className="text-xl font-bold text-emerald-900 mt-0.5">
                  {orgRequests.filter((r) => r.status === 'approved').length}
                </div>
              </Card>
              <Card className="p-3 bg-blue-50/50 border-blue-200/60">
                <div className="text-[10px] uppercase font-semibold text-blue-800">Approver Configs</div>
                <div className="text-xl font-bold text-blue-900 mt-0.5">{approverConfigs.length}</div>
              </Card>
            </div>

            {/* Filter Toolbar */}
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  placeholder="Search by employee, email, or reference..."
                  className="pl-9 h-9 text-xs"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={filterVertical}
                  onChange={(e) => setFilterVertical(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="all">All Verticals</option>
                  <option value="wealth">Wealth Management</option>
                  <option value="banking">Commercial Banking</option>
                  <option value="markets">Markets & Securities</option>
                  <option value="real_estate">Real Estate</option>
                </select>

                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="all">All Roles</option>
                  <option value="SC">SC (Sales Caller)</option>
                  <option value="TL">TL (Team Lead)</option>
                  <option value="MG">MG (Manager)</option>
                  <option value="RM">RM (Regional Manager)</option>
                  <option value="NM">NM (National Manager)</option>
                  <option value="CEO">CEO (Chief Executive)</option>
                  <option value="CFO">CFO (Finance)</option>
                  <option value="HR">HR (Human Resources)</option>
                  <option value="SA">SA (Super Admin)</option>
                  <option value="DE">DE (Data Entry)</option>
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="all">All Statuses</option>
                  <option value="submitted">Pending (Submitted)</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="withdrawn">Withdrawn</option>
                </select>

                <Button variant="outline" size="sm" onClick={loadOrgRequests} className="h-9 text-xs">
                  <RefreshCw className="size-3.5 mr-1" /> Refresh
                </Button>
              </div>
            </div>

            {/* Requests Table */}
            <div className="border rounded-md overflow-x-auto bg-card">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-muted-foreground text-[10px] uppercase border-b">
                  <tr>
                    <th className="px-3 py-2.5">Reference</th>
                    <th className="px-3 py-2.5">Employee</th>
                    <th className="px-3 py-2.5">Vertical / Team</th>
                    <th className="px-3 py-2.5">Leave Details</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">Approver</th>
                    <th className="px-3 py-2.5 text-right">Audit</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-muted-foreground">
                  {loadingOrg ? (
                    <tr>
                      <td colSpan={7} className="p-4"><SkeletonRows rows={4} /></td>
                    </tr>
                  ) : filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                        No leave requests found matching selected scope and criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredRequests.map((r) => (
                      <tr key={r.id} className="hover:bg-muted/20">
                        <td className="px-3 py-2.5 font-mono font-medium text-foreground">{r.id}</td>
                        <td className="px-3 py-2.5">
                          <div className="font-semibold text-foreground">{r.employeeName}</div>
                          <div className="text-[10px] text-muted-foreground">{r.employeeEmail}</div>
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {r.employeeRole} • {r.vertical || 'Shared'}
                          </Badge>
                          <div className="text-[10px] text-muted-foreground mt-0.5">{r.teamName || r.teamId || 'Company Wide'}</div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-medium text-foreground capitalize">{r.leaveType} leave ({r.totalDays}d)</div>
                          <div className="text-[10px] text-muted-foreground">
                            {new Date(r.startDate).toLocaleDateString()} – {new Date(r.endDate).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge
                            className={
                              r.status === 'approved'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : r.status === 'rejected'
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : r.status === 'withdrawn'
                                ? 'bg-gray-100 text-gray-700 border-gray-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }
                          >
                            {r.status === 'submitted' ? 'Pending Approval' : r.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="text-foreground">{r.currentApproverName || r.currentApproverId || 'Configured Superior'}</div>
                          {r.decidedByName && (
                            <div className="text-[10px] text-muted-foreground">
                              Decided by {r.decidedByName} ({r.decidedAt ? new Date(r.decidedAt).toLocaleDateString() : ''})
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-[#113F3D] hover:bg-[#113F3D]/10"
                            onClick={() => setSelectedAuditRequest(r)}
                          >
                            <FileText className="size-3.5 mr-1" /> Audit Trail
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Approver Configurations Section */}
            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Shield className="size-4 text-[#113F3D]" />
                    Executive & Governance Role Approver Rules
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Configure designated superiors for roles without vertical line-of-command (CEO, CFO, HR, SA, DE). Self-approval is strictly forbidden.
                  </p>
                </div>
              </div>

              {configMsg && (
                <div className="p-2.5 text-xs rounded bg-blue-50 text-blue-900 border border-blue-200 flex justify-between items-center">
                  <span>{configMsg}</span>
                  <button onClick={() => setConfigMsg(null)} className="text-blue-700 hover:text-blue-900"><X className="size-3.5" /></button>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Active Rules List */}
                <div className="border rounded-md overflow-hidden text-xs">
                  <div className="bg-muted/40 px-3 py-2 font-semibold text-muted-foreground uppercase text-[10px]">
                    Current Role Routes
                  </div>
                  <div className="divide-y max-h-48 overflow-y-auto">
                    {approverConfigs.map((cfg) => (
                      <div key={cfg.id} className="p-2.5 flex items-center justify-between hover:bg-muted/10">
                        <div>
                          <div className="font-semibold text-foreground">
                            Role: {cfg.role || 'Employee Override'} {cfg.vertical ? `(${cfg.vertical})` : ''}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            Superior: {cfg.approverName || cfg.approverEmployeeId || 'Unconfigured'} • {cfg.approverTitle}
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            cfg.isConfigured
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]'
                              : 'bg-amber-50 text-amber-700 border-amber-200 text-[10px]'
                          }
                        >
                          {cfg.isConfigured ? 'Configured' : 'Blocked (Unconfigured)'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Configure Route Form */}
                <form onSubmit={handleSaveApproverConfig} className="space-y-2.5 border rounded-md p-3 bg-muted/10">
                  <div className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
                    Update Designated Superior
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground">Target Role</label>
                      <select
                        value={configRole}
                        onChange={(e) => setConfigRole(e.target.value)}
                        className="mt-1 h-8 w-full rounded border border-input bg-background px-2 text-xs"
                      >
                        <option value="CEO">CEO (Chief Executive)</option>
                        <option value="CFO">CFO (Finance)</option>
                        <option value="HR">HR (Human Resources)</option>
                        <option value="SA">SA (Super Admin)</option>
                        <option value="DE">DE (Data Entry)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground">Approver Employee ID</label>
                      <Input
                        value={configApproverId}
                        onChange={(e) => setConfigApproverId(e.target.value)}
                        placeholder="e.g. EMP-010 or EMP-014"
                        className="mt-1 h-8 text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground">Approver Authority Title</label>
                    <Input
                      value={configTitle}
                      onChange={(e) => setConfigTitle(e.target.value)}
                      placeholder="e.g. Board Compensation Committee"
                      className="mt-1 h-8 text-xs"
                      required
                    />
                  </div>
                  <div className="flex justify-end pt-1">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={savingConfig}
                      className="h-8 text-xs bg-[#113F3D] hover:bg-[#113F3D]/90 text-white"
                    >
                      {savingConfig ? 'Saving...' : 'Update Approver Route'}
                    </Button>
                  </div>
                </form>
              </div>
            </div>

            {/* Audit Trail Modal */}
            {selectedAuditRequest && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
                role="dialog"
                aria-modal="true"
              >
                <div className="w-full max-w-lg rounded-xl border border-border bg-background p-5 shadow-2xl space-y-4">
                  <div className="flex items-center justify-between border-b pb-3">
                    <div>
                      <h4 className="font-semibold text-sm text-foreground">
                        Leave Audit History • {selectedAuditRequest.id}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {selectedAuditRequest.employeeName} ({selectedAuditRequest.employeeRole}) • {selectedAuditRequest.leaveType} leave
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedAuditRequest(null)}
                      className="text-muted-foreground hover:text-foreground p-1"
                      aria-label="Close audit modal"
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="p-2.5 rounded bg-muted/30 border border-border/50">
                      <div><strong>Dates: </strong>{selectedAuditRequest.startDate} to {selectedAuditRequest.endDate} ({selectedAuditRequest.totalDays} calendar days)</div>
                      <div><strong>Reason: </strong>{selectedAuditRequest.reason}</div>
                      {selectedAuditRequest.handoverNotes && <div><strong>Handover: </strong>{selectedAuditRequest.handoverNotes}</div>}
                    </div>

                    <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Immutable Event Timeline
                    </div>
                    <div className="space-y-2 border-l-2 border-primary/30 pl-3">
                      {selectedAuditRequest.actions && selectedAuditRequest.actions.length > 0 ? (
                        selectedAuditRequest.actions.map((act) => (
                          <div key={act.id} className="text-xs">
                            <div className="font-semibold text-foreground capitalize">
                              {act.action} <span className="text-[10px] text-muted-foreground font-normal">({new Date(act.createdAt).toLocaleString()})</span>
                            </div>
                            <div className="text-muted-foreground">Actor: {act.actorName || act.actorEmployeeId} ({act.actorRole})</div>
                            {act.notes && <div className="text-foreground/90 pl-1 mt-0.5">"{act.notes}"</div>}
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-muted-foreground">Initial submission logged.</div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end pt-2 border-t">
                    <Button variant="outline" size="sm" onClick={() => setSelectedAuditRequest(null)}>
                      Close
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MANUAL ALLOCATION OVERRIDE (HR-05) */}
        {activeTab === 'direct_log' && (
          <div className="space-y-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">DIRECT CAPTURE</div>
            <div className="text-base font-semibold text-foreground">Record leave and allocation availability (HR-05)</div>

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
                <label className="text-xs font-medium text-foreground">Absence Category</label>
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
        )}

        {/* TAB 3: COMPENSATION & PAYROLL PREVIEW */}
        {activeTab === 'payroll_preview' && (
          <PayrollPreviewTab userRole="HR" />
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

// ============================================================================
// 9. HR-EXT-04: Non-Overlapping 28th–27th Payroll Preview & Compensation (/hr/payroll)
// ============================================================================
export function HrPayrollPreviewPage() {
  return (
    <DeckFrame
      actionCode="HR-EXT-04"
      moduleLabel="Salary & Payroll Preview"
      title="Non-Overlapping 28th–27th Payroll Calculation Preview & Effective-Dated Compensation"
      subtitle="Strict salary privacy enforced · Calculation preview only · No salary disbursement"
      statusText="Calculation Preview Ready · Finalization Gated [Deck P320]"
      steps={[
        'Configure non-overlapping 28th–27th cycles and evaluate mid-cycle joiner 10 Jan initial period separately.',
        'Calculate transparent inputs: attended days, paid leave, location holidays, weekly offs, and divisor formula.',
        'Review transparent gross-to-net components and policy gate status before designated legal/statutory confirmation.',
      ]}
      whenCheckFails="Payroll finalization or payment export attempts return 422 UNRESOLVED_POLICY_GATES pending legal confirmation."
      permissionEvidence="Compensation records and payroll calculation preview restricted strictly to authorized HR and Executive Finance roles."
    >
      <PayrollPreviewTab userRole="HR" />
    </DeckFrame>
  );
}
