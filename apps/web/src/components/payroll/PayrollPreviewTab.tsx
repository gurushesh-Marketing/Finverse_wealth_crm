import { useEffect, useState, useMemo } from 'react';
import {
  DollarSign,
  Calendar,
  ShieldAlert,
  AlertTriangle,
  Lock,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Briefcase,
  Users,
  FileText,
  HelpCircle,
  Plus,
  RefreshCw,
  Eye,
  Info,
  ChevronRight,
  Calculator,
  Building,
} from 'lucide-react';
import { payrollApi } from '../../lib/payroll-api';
import type {
  CompensationPlanRecord,
  CompensationAuditRecord,
  PayrollCycleRecord,
  PayrollPreviewResponse,
  PayrollPreviewItem,
  DivisorFormulaPolicy,
} from '@finverse/contracts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input, Textarea } from '../ui/input';
import { SkeletonRows } from '../ui/states';

interface PayrollPreviewTabProps {
  userRole?: string;
}

export function PayrollPreviewTab({ userRole }: PayrollPreviewTabProps) {
  // Filters & Controls
  const [selectedCycleCode, setSelectedCycleCode] = useState<string>('2026-01-INITIAL');
  const [selectedVertical, setSelectedVertical] = useState<'all' | 'wealth' | 'banking' | 'markets' | 'real_estate'>('all');
  const [selectedDivisorPolicy, setSelectedDivisorPolicy] = useState<DivisorFormulaPolicy>('30_day_fixed');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Data states
  const [cycles, setCycles] = useState<PayrollCycleRecord[]>([]);
  const [previewData, setPreviewData] = useState<PayrollPreviewResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Inspection modal
  const [selectedEmployeeItem, setSelectedEmployeeItem] = useState<PayrollPreviewItem | null>(null);

  // Policy gates dialog
  const [showPolicyGatesDialog, setShowPolicyGatesDialog] = useState<boolean>(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);

  // Compensation Management Modal
  const [showCompModal, setShowCompModal] = useState<boolean>(false);
  const [compPlans, setCompPlans] = useState<CompensationPlanRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<CompensationAuditRecord[]>([]);
  const [compLoading, setCompLoading] = useState<boolean>(false);
  const [compTab, setCompTab] = useState<'plans' | 'new_revision' | 'audit'>('plans');

  // New salary revision form state
  const [newPlanEmployeeId, setNewPlanEmployeeId] = useState<string>('EMP-001');
  const [newPlanEffectiveFrom, setNewPlanEffectiveFrom] = useState<string>('2026-02-01');
  const [newPlanMonthlyCtc, setNewPlanMonthlyCtc] = useState<number>(85000);
  const [newPlanBasic, setNewPlanBasic] = useState<number>(42500);
  const [newPlanHra, setNewPlanHra] = useState<number>(21250);
  const [newPlanSpecial, setNewPlanSpecial] = useState<number>(21250);
  const [newPlanPf, setNewPlanPf] = useState<number>(1800);
  const [newPlanPt, setNewPlanPt] = useState<number>(200);
  const [newPlanTds, setNewPlanTds] = useState<number>(2500);
  const [newPlanReason, setNewPlanReason] = useState<string>('Annual compensation adjustment and grade review');
  const [submittingComp, setSubmittingComp] = useState<boolean>(false);
  const [compSuccessMessage, setCompSuccessMessage] = useState<string | null>(null);

  // Load available cycles
  const loadCycles = async () => {
    try {
      const res = await payrollApi.getPayrollCycles();
      setCycles(res.cycles);
      if (res.cycles.length > 0 && !selectedCycleCode) {
        setSelectedCycleCode(res.cycles[0].cycle_code);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load payroll cycles');
    }
  };

  // Load calculation preview
  const loadPreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await payrollApi.calculatePayrollPreview({
        cycle_code: selectedCycleCode,
        divisor_policy: selectedDivisorPolicy,
        vertical: selectedVertical,
      });
      setPreviewData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to calculate payroll preview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCycles();
  }, []);

  useEffect(() => {
    if (selectedCycleCode) {
      void loadPreview();
    }
  }, [selectedCycleCode, selectedVertical, selectedDivisorPolicy]);

  // Load Compensation Plans & Audit History
  const loadCompData = async () => {
    setCompLoading(true);
    try {
      const [plansRes, logsRes] = await Promise.all([
        payrollApi.getCompensationPlans(),
        payrollApi.getCompensationAuditHistory(),
      ]);
      setCompPlans(plansRes.plans);
      setAuditLogs(logsRes.history);
    } catch (err: any) {
      setError(err.message || 'Failed to load compensation plans');
    } finally {
      setCompLoading(false);
    }
  };

  const handleOpenCompModal = () => {
    setShowCompModal(true);
    void loadCompData();
  };

  const handleMonthlyCtcChange = (ctc: number) => {
    setNewPlanMonthlyCtc(ctc);
    const basic = Math.round(ctc * 0.5);
    const hra = Math.round(ctc * 0.25);
    const special = ctc - basic - hra;
    setNewPlanBasic(basic);
    setNewPlanHra(hra);
    setNewPlanSpecial(special);
  };

  const handleCreateRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingComp(true);
    setCompSuccessMessage(null);
    try {
      await payrollApi.createCompensationPlan({
        employee_id: newPlanEmployeeId,
        effective_from: newPlanEffectiveFrom,
        monthly_ctc: Number(newPlanMonthlyCtc),
        basic_pay: Number(newPlanBasic),
        hra: Number(newPlanHra),
        special_allowance: Number(newPlanSpecial),
        statutory_pf_employee: Number(newPlanPf),
        statutory_pf_employer: Number(newPlanPf),
        professional_tax: Number(newPlanPt),
        tds_estimate: Number(newPlanTds),
        reason: newPlanReason,
      });
      setCompSuccessMessage(`Successfully recorded compensation revision for ${newPlanEmployeeId}`);
      await loadCompData();
      await loadPreview();
      setCompTab('plans');
    } catch (err: any) {
      alert(`Error creating revision: ${err.message}`);
    } finally {
      setSubmittingComp(false);
    }
  };

  const handleAttemptFinalize = async () => {
    setFinalizeError(null);
    try {
      await payrollApi.finalizePayroll({
        cycle_code: selectedCycleCode,
      });
    } catch (err: any) {
      setFinalizeError(
        err.message || 'Payroll finalization blocked pending legal/policy confirmation [Deck P320].'
      );
      setShowPolicyGatesDialog(true);
    }
  };

  // Filter items by search
  const filteredItems = useMemo(() => {
    if (!previewData) return [];
    if (!searchQuery.trim()) return previewData.items;
    const q = searchQuery.toLowerCase();
    return previewData.items.filter(
      (item) =>
        item.employee_name.toLowerCase().includes(q) ||
        item.employee_id.toLowerCase().includes(q) ||
        item.team_name.toLowerCase().includes(q) ||
        item.role.toLowerCase().includes(q)
    );
  }, [previewData, searchQuery]);

  return (
    <div className="space-y-6" data-testid="payroll-preview-tab">
      {/* 1. Header Bar with Policy Scope & Title */}
      <div className="flex flex-col gap-3 rounded-lg border border-[#113F3D]/20 bg-[#113F3D]/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#113F3D] px-2.5 py-0.5 text-xs font-semibold text-white">
              <Calculator className="size-3.5" /> HRMS Slice 4 · Payroll Calculation Preview
            </span>
            <Badge variant="outline" className="text-[11px] font-normal border-amber-600/40 text-amber-900 bg-amber-50">
              <Lock className="size-3 mr-1 text-amber-700" /> Calculation Preview Only · No Salary Disbursement
            </Badge>
          </div>
          <h2 className="mt-1.5 text-lg font-bold text-foreground">
            Non-Overlapping 28th–27th Payroll Calculation Preview & Effective-Dated Compensation
          </h2>
          <p className="text-xs text-muted-foreground">
            Strict salary privacy enforced: Compensation data is accessible only to authorized HR & Finance roles.
            Missing CRM updates or WFH are never silently deducted.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenCompModal}
            data-testid="btn-manage-salary-plans"
            className="text-xs border-[#113F3D]/30 text-[#113F3D] hover:bg-[#113F3D]/10 font-semibold"
          >
            <DollarSign className="size-3.5 mr-1.5" /> Manage Salary Plans & Audit Log
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadPreview}
            disabled={loading}
            className="text-xs"
          >
            <RefreshCw className={`size-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh Preview
          </Button>
        </div>
      </div>

      {/* 2. Unresolved Policy Decisions Banner [Deck P320] */}
      <Card className="border-amber-300 bg-amber-50/60 shadow-sm" data-testid="policy-decision-banner">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <ShieldAlert className="size-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-900">
                  Statutory & Legal Policy Decisions Requiring Executive Confirmation [Deck P320]
                </span>
                <span className="rounded bg-amber-200 px-1.5 py-0.2 text-[10px] font-bold text-amber-900">
                  Gated Engine
                </span>
              </div>
              <p className="text-xs text-amber-950">
                In accordance with Finverse governance invariants and statutory labor compliance, finalization and payment
                export are strictly locked until corporate policies are confirmed by responsible executive authorities:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 text-[11px] text-amber-900">
                <div className="rounded border border-amber-200 bg-amber-100/50 p-2">
                  <div className="font-semibold text-amber-950 flex items-center gap-1">
                    <Info className="size-3 text-amber-700" /> Mid-Cycle Joiner First-Payment Deadline [P320 Cat 4]
                  </div>
                  <div className="text-[10px] mt-0.5 leading-relaxed">
                    Employees joining mid-cycle (e.g. 10 January) earn wages for the initial 18 calendar days (10–27 Jan).
                    <strong> Mandatory Invariant:</strong> Earned wages cannot be held until 28 February.
                  </div>
                </div>

                <div className="rounded border border-amber-200 bg-amber-100/50 p-2">
                  <div className="font-semibold text-amber-950 flex items-center gap-1">
                    <Calculator className="size-3 text-amber-700" /> Pro-Rata Divisor Formula Policy [P320 Cat 2]
                  </div>
                  <div className="text-[10px] mt-0.5 leading-relaxed">
                    Statutory pro-rata formulation: Toggle between <strong>30-day fixed financial divisor</strong>,
                    <strong>scheduled working-days divisor</strong>, and <strong>actual calendar-days divisor</strong> below to preview impact.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-amber-200 pt-2.5 text-xs text-amber-900">
            <span className="font-medium flex items-center gap-1.5">
              <Lock className="size-3.5 text-amber-700" /> Payment Disbursement File Export: <strong className="text-rose-700">Blocked</strong> (Pending Policy Sign-Off)
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAttemptFinalize}
              data-testid="btn-attempt-finalize"
              className="text-xs border-amber-400 bg-amber-100/80 hover:bg-amber-200 text-amber-900 font-medium"
            >
              Verify Finalization Policy Gate
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 3. Filtering & Formula Controls */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 rounded-lg border border-border bg-card p-3 shadow-sm">
        {/* Cycle selector */}
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Payroll Cycle (28th–27th)</label>
          <select
            value={selectedCycleCode}
            onChange={(e) => setSelectedCycleCode(e.target.value)}
            data-testid="select-payroll-cycle"
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs font-medium shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {cycles.map((c) => (
              <option key={c.cycle_code} value={c.cycle_code}>
                {c.cycle_label} ({c.total_calendar_days}d)
              </option>
            ))}
          </select>
        </div>

        {/* Divisor Formula Policy Selector */}
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Divisor Formula [Deck P320]</label>
          <select
            value={selectedDivisorPolicy}
            onChange={(e) => setSelectedDivisorPolicy(e.target.value as DivisorFormulaPolicy)}
            data-testid="select-divisor-policy"
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs font-medium shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="30_day_fixed">30-Day Fixed Divisor (Gross × Days / 30)</option>
            <option value="applicable_working_days">Working Days Divisor (Excludes Offs & Holidays)</option>
            <option value="calendar_days">Calendar Days Divisor (Gross × Days / Total Month Days)</option>
          </select>
        </div>

        {/* Vertical Scope Selector */}
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Vertical Scoping</label>
          <select
            value={selectedVertical}
            onChange={(e) => setSelectedVertical(e.target.value as any)}
            data-testid="select-payroll-vertical"
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs font-medium shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Verticals (Firm-wide)</option>
            <option value="wealth">Wealth Management</option>
            <option value="banking">Commercial Banking</option>
            <option value="markets">Markets & Trading</option>
            <option value="real_estate">Real Estate Advisory</option>
          </select>
        </div>

        {/* Search */}
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Employee Search</label>
          <div className="relative mt-1">
            <Search className="size-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by name, ID or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="payroll-search-input"
              className="h-9 pl-8 text-xs"
            />
          </div>
        </div>
      </div>

      {/* 4. One-Click Vertical Tabs */}
      <div className="flex items-center gap-1.5 border-b pb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-2">Vertical Filter:</span>
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
            data-testid={`payroll-vertical-tab-${v.id}`}
            onClick={() => setSelectedVertical(v.id as any)}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
              selectedVertical === v.id
                ? 'bg-[#113F3D] text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* 5. Summary Metrics Strip */}
      {previewData && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Card className="border shadow-sm p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Employees In Preview</span>
            <div className="text-xl font-bold text-foreground mt-1" data-testid="preview-metric-total-emp">
              {previewData.summary.total_employees}
            </div>
            <span className="text-[10px] text-muted-foreground">Active employment span</span>
          </Card>

          <Card className="border shadow-sm p-3 border-amber-200 bg-amber-50/30">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900">Mid-Cycle Joiners</span>
            <div className="text-xl font-bold text-amber-950 mt-1" data-testid="preview-metric-joiners">
              {previewData.summary.mid_cycle_joiners_count}
            </div>
            <span className="text-[10px] text-amber-800">Pro-rata cycle applied (e.g. 10 Jan)</span>
          </Card>

          <Card className="border shadow-sm p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Gross Payable</span>
            <div className="text-xl font-bold text-foreground mt-1" data-testid="preview-metric-gross">
              ₹{previewData.summary.total_gross_payable.toLocaleString('en-IN')}
            </div>
            <span className="text-[10px] text-muted-foreground">Basic + HRA + Special</span>
          </Card>

          <Card className="border shadow-sm p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Statutory Deductions</span>
            <div className="text-xl font-bold text-rose-700 mt-1" data-testid="preview-metric-deductions">
              ₹{previewData.summary.total_statutory_deductions.toLocaleString('en-IN')}
            </div>
            <span className="text-[10px] text-muted-foreground">PF + PT + TDS Estimate</span>
          </Card>

          <Card className="border shadow-sm p-3 border-emerald-200 bg-emerald-50/40 col-span-2 sm:col-span-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900">Total Net Payable</span>
            <div className="text-xl font-bold text-emerald-800 mt-1" data-testid="preview-metric-net">
              ₹{previewData.summary.total_net_payable.toLocaleString('en-IN')}
            </div>
            <span className="text-[10px] text-emerald-700 font-medium">Disbursement Preview</span>
          </Card>
        </div>
      )}

      {/* 6. Special Callout for 10 January Joiner Initial Period */}
      {(selectedCycleCode === '2026-01-INITIAL' || (previewData?.summary.mid_cycle_joiners_count ?? 0) > 0) && (
        <div className="rounded-lg border border-sky-300 bg-sky-50/70 p-3.5 flex items-start gap-3">
          <Info className="size-5 text-sky-700 shrink-0 mt-0.5" />
          <div className="space-y-0.5 text-xs text-sky-950">
            <div className="font-bold flex items-center gap-1.5">
              <span>Mid-Cycle Joiner Initial Period (10–27 January 2026: 18 Inclusive Calendar Days)</span>
              <Badge variant="outline" className="text-[10px] border-sky-400 text-sky-800 bg-sky-100">
                Deck P320 Special Case
              </Badge>
            </div>
            <p>
              For new employees joining on <strong>10 January</strong> (such as Dev Kapoor EMP-004 in Banking), the initial period
              spans exactly <strong>18 inclusive calendar dates</strong> (10 Jan to 27 Jan).
              Under Finverse invariant policy, earned wages for this period are computed separately and
              <strong> are not automatically deferred to 28 February</strong>.
            </p>
          </div>
        </div>
      )}

      {/* 7. Calculation Breakdown Table */}
      <Card className="border shadow-sm">
        <CardHeader className="border-b px-4 py-3 bg-muted/20 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Calculator className="size-4 text-[#113F3D]" />
              Employee Payroll Calculation Breakdown ({filteredItems.length} records)
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">
              Period: {previewData?.cycle.period_start_date} to {previewData?.cycle.period_end_date} · Divisor Policy: {selectedDivisorPolicy}
            </p>
          </div>
          <Badge className="bg-[#113F3D] text-white text-[11px] font-normal">
            Status: {previewData?.cycle.status.toUpperCase()}
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6">
              <SkeletonRows rows={5} />
            </div>
          ) : error ? (
            <div className="p-6 text-center text-xs text-rose-700">
              <AlertTriangle className="size-6 text-rose-500 mx-auto mb-2" />
              Failed to calculate preview: {error}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No employees matching the selected vertical or search filter in this payroll cycle.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse" data-testid="payroll-breakdown-table">
                <thead>
                  <tr className="border-b bg-muted/30 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    <th className="py-2.5 px-3">Employee & Role</th>
                    <th className="py-2.5 px-2">Joining Date</th>
                    <th className="py-2.5 px-2 text-right">Base CTC</th>
                    <th className="py-2.5 px-2 text-center">Active Days</th>
                    <th className="py-2.5 px-2 text-center">Attended</th>
                    <th className="py-2.5 px-2 text-center">Leave/Hols</th>
                    <th className="py-2.5 px-2 text-center">Covered Days</th>
                    <th className="py-2.5 px-2 text-center">Factor</th>
                    <th className="py-2.5 px-2 text-right">Gross Payable</th>
                    <th className="py-2.5 px-2 text-right">Deductions</th>
                    <th className="py-2.5 px-2 text-right">Net Preview</th>
                    <th className="py-2.5 px-3 text-center">Audit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredItems.map((item) => (
                    <tr
                      key={item.employee_id}
                      className="hover:bg-muted/30 transition-colors"
                      data-testid={`payroll-row-${item.employee_id}`}
                    >
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-foreground">{item.employee_name}</div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <span className="font-mono">{item.employee_id}</span> ·
                          <span className="capitalize">{item.vertical}</span> · {item.role}
                        </div>
                      </td>
                      <td className="py-2.5 px-2">
                        <div className="font-mono text-[11px]">{item.joining_date}</div>
                        {item.is_mid_cycle_joiner && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-400 bg-amber-50 text-amber-800 font-semibold">
                            Mid-Joiner (18d)
                          </Badge>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono font-medium">
                        ₹{item.monthly_ctc.toLocaleString('en-IN')}
                        <div className="text-[9px] text-muted-foreground">Basic: ₹{item.basic_pay_rate.toLocaleString('en-IN')}</div>
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono">
                        {item.active_employment_days_in_cycle}d
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <span className="font-mono text-emerald-700 font-semibold">{item.attended_days}d</span>
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono text-[11px] text-muted-foreground">
                        {item.approved_paid_leave_days + item.holiday_days}d
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono font-bold text-foreground">
                        {item.covered_payable_days}d
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono text-[11px] font-medium text-sky-800">
                        {(item.pro_rata_factor * 100).toFixed(1)}%
                        <div className="text-[9px] text-muted-foreground">/{item.divisor_used}d</div>
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono font-semibold text-foreground">
                        ₹{item.gross_payable.toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-rose-700">
                        -₹{item.statutory_deductions.total_deductions.toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono font-bold text-emerald-800">
                        ₹{item.net_payable_preview.toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedEmployeeItem(item)}
                          data-testid={`btn-inspect-${item.employee_id}`}
                          className="h-7 text-[11px] px-2 text-[#113F3D] hover:bg-[#113F3D]/10 font-medium"
                        >
                          <Eye className="size-3 mr-1" /> Inspect
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 8. Component Inspection Modal */}
      {selectedEmployeeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" data-testid="component-inspection-modal">
          <Card className="w-full max-w-2xl border shadow-xl bg-background max-h-[90vh] overflow-y-auto">
            <CardHeader className="border-b pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  <Calculator className="size-4 text-[#113F3D]" />
                  Transparent Calculation Components · {selectedEmployeeItem.employee_name}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {selectedEmployeeItem.employee_id} · {selectedEmployeeItem.role} ({selectedEmployeeItem.vertical}) · {selectedEmployeeItem.team_name}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedEmployeeItem(null)}>
                Close
              </Button>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              {/* Warnings if joiner */}
              {selectedEmployeeItem.policy_warnings.length > 0 && (
                <div className="rounded border border-amber-200 bg-amber-50 p-3 space-y-1">
                  <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <AlertTriangle className="size-3.5 text-amber-700" /> Statutory Policy Notice [Deck P320]
                  </div>
                  {selectedEmployeeItem.policy_warnings.map((w, idx) => (
                    <div key={idx} className="text-[11px] text-amber-950 leading-relaxed">
                      {w}
                    </div>
                  ))}
                </div>
              )}

              {/* 3-way component grids */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* 1. Base Compensation Rate */}
                <div className="rounded-lg border p-3 bg-muted/10 space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">1. Configured Monthly Rate</div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Basic Pay:</span>
                      <span className="font-mono font-medium">₹{selectedEmployeeItem.basic_pay_rate.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">HRA (50% Basic):</span>
                      <span className="font-mono font-medium">₹{selectedEmployeeItem.hra_rate.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Special Allowance:</span>
                      <span className="font-mono font-medium">₹{selectedEmployeeItem.special_allowance_rate.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between border-t pt-1 font-semibold">
                      <span>Monthly CTC:</span>
                      <span className="font-mono">₹{selectedEmployeeItem.monthly_ctc.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                {/* 2. Calendar & Attendance Inputs */}
                <div className="rounded-lg border p-3 bg-muted/10 space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">2. Calendar & Covered Inputs</div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Active Days in Cycle:</span>
                      <span className="font-mono">{selectedEmployeeItem.active_employment_days_in_cycle}d</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Attended (Office+WFH):</span>
                      <span className="font-mono text-emerald-700 font-semibold">{selectedEmployeeItem.attended_days}d</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Approved Paid Leave:</span>
                      <span className="font-mono">{selectedEmployeeItem.approved_paid_leave_days}d</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Weekly Offs + Hols:</span>
                      <span className="font-mono">{selectedEmployeeItem.weekly_off_days + selectedEmployeeItem.holiday_days}d</span>
                    </div>
                    <div className="flex justify-between border-t pt-1 font-semibold text-emerald-800">
                      <span>Covered Payable:</span>
                      <span className="font-mono">{selectedEmployeeItem.covered_payable_days}d</span>
                    </div>
                  </div>
                </div>

                {/* 3. Pro-Rata Multiplier & Divisor */}
                <div className="rounded-lg border p-3 bg-muted/10 space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">3. Formula Multiplier</div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Policy:</span>
                      <span className="font-mono text-[10px]">{selectedEmployeeItem.selected_divisor_policy}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Divisor Used:</span>
                      <span className="font-mono">{selectedEmployeeItem.divisor_used}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Formula:</span>
                      <span className="font-mono text-[10px]">{selectedEmployeeItem.covered_payable_days}/{selectedEmployeeItem.divisor_used}</span>
                    </div>
                    <div className="flex justify-between border-t pt-1 font-bold text-sky-800">
                      <span>Pro-Rata Factor:</span>
                      <span className="font-mono">{(selectedEmployeeItem.pro_rata_factor * 100).toFixed(2)}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Earned Calculations & Deductions */}
              <div className="rounded-lg border p-3 bg-muted/5 space-y-3">
                <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Gross to Net Calculation Breakdown</span>
                  <span className="text-[11px] text-muted-foreground">Divisor: {selectedEmployeeItem.divisor_used}d</span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1.5 border-r pr-4">
                    <div className="font-semibold text-muted-foreground text-[10px] uppercase">Earned Components</div>
                    <div className="flex justify-between">
                      <span>Earned Basic:</span>
                      <span className="font-mono">₹{selectedEmployeeItem.earned_basic.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Earned HRA:</span>
                      <span className="font-mono">₹{selectedEmployeeItem.earned_hra.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Earned Special Allowance:</span>
                      <span className="font-mono">₹{selectedEmployeeItem.earned_special_allowance.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between border-t pt-1 font-bold text-foreground">
                      <span>Total Gross Payable:</span>
                      <span className="font-mono">₹{selectedEmployeeItem.gross_payable.toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="font-semibold text-muted-foreground text-[10px] uppercase">Statutory Deductions</div>
                    <div className="flex justify-between text-rose-800">
                      <span>PF (Employee 12%):</span>
                      <span className="font-mono">-₹{selectedEmployeeItem.statutory_deductions.pf_employee.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-rose-800">
                      <span>Professional Tax:</span>
                      <span className="font-mono">-₹{selectedEmployeeItem.statutory_deductions.professional_tax.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-rose-800">
                      <span>TDS Withholding Estimate:</span>
                      <span className="font-mono">-₹{selectedEmployeeItem.statutory_deductions.tds_estimate.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between border-t pt-1 font-bold text-rose-800">
                      <span>Total Deductions:</span>
                      <span className="font-mono">-₹{selectedEmployeeItem.statutory_deductions.total_deductions.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded bg-emerald-50 border border-emerald-200 p-2.5 flex items-center justify-between text-emerald-950 font-bold text-sm">
                  <span>Net Payable Preview:</span>
                  <span className="font-mono text-base text-emerald-800">
                    ₹{selectedEmployeeItem.net_payable_preview.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Invariant Explanation Notes */}
              <div className="rounded border bg-muted/20 p-3 space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Compliance & Audit Notes</div>
                <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-muted-foreground">
                  {selectedEmployeeItem.calculation_notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </div>

              <div className="flex justify-end pt-2 border-t">
                <Button size="sm" onClick={() => setSelectedEmployeeItem(null)}>
                  Close Inspection
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 9. Policy Gates & Finalization Dialog */}
      {showPolicyGatesDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" data-testid="policy-gates-modal">
          <Card className="w-full max-w-lg border shadow-xl bg-background">
            <CardHeader className="border-b pb-3">
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <Lock className="size-4 text-rose-600" />
                Payroll Finalization & Payment Export Blocked
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Executive & Statutory Policy Confirmation Required [Deck P320]
              </p>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-xs">
              <div className="rounded border border-rose-200 bg-rose-50 p-3 text-rose-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <ShieldAlert className="size-4 text-rose-600 shrink-0" />
                  Policy Invariant Gate Rejection (HTTP 422)
                </div>
                <p className="leading-relaxed">
                  {finalizeError || 'Payroll finalization is blocked.'}
                </p>
              </div>

              <div className="space-y-2">
                <div className="font-semibold text-foreground text-xs">Unresolved Executive Policy Decisions:</div>
                <ul className="space-y-1.5 text-[11px] text-muted-foreground">
                  <li className="flex items-start gap-1.5">
                    <span className="font-bold text-rose-700">1.</span>
                    <span><strong>First-Payment Deadline for Mid-Cycle Joiners:</strong> Executive confirmation of whether mid-cycle joiners (e.g. 10 Jan) receive earned wages on standard cycle close or an interim run [Deck P320 Cat 4].</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="font-bold text-rose-700">2.</span>
                    <span><strong>Statutory Pro-Rata Formula:</strong> Legal sign-off on 30-day corporate divisor vs scheduled working days formula [Deck P320 Cat 2].</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="font-bold text-rose-700">3.</span>
                    <span><strong>Board Ratification:</strong> Final approval and cryptographic certification by Chief Financial Officer [CFO-12, Deck P248].</span>
                  </li>
                </ul>
              </div>

              <div className="p-2.5 bg-muted/40 rounded border text-[11px] text-muted-foreground leading-relaxed">
                <strong>Governance Rule:</strong> The CRM preview engine does not hard-code legal conclusions or disburse funds until the designated payroll and legal owners confirm these policies.
              </div>

              <div className="flex justify-end pt-2 border-t">
                <Button size="sm" onClick={() => setShowPolicyGatesDialog(false)}>
                  Acknowledge & Return to Preview
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 10. Compensation Management Drawer & Audit Log */}
      {showCompModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" data-testid="comp-management-modal">
          <Card className="w-full max-w-3xl border shadow-xl bg-background max-h-[90vh] flex flex-col">
            <CardHeader className="border-b pb-3 flex flex-row items-center justify-between shrink-0">
              <div>
                <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  <DollarSign className="size-4 text-[#113F3D]" />
                  Effective-Dated Compensation Management & Audit History
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Authorized HR & Executive Finance Access Only · Immutable Audit Trail
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowCompModal(false)}>
                Close
              </Button>
            </CardHeader>

            {/* Tabs inside Comp Modal */}
            <div className="flex items-center gap-2 px-4 border-b bg-muted/20 text-xs shrink-0">
              <button
                type="button"
                onClick={() => setCompTab('plans')}
                className={`py-2.5 px-3 font-semibold border-b-2 transition-colors ${
                  compTab === 'plans' ? 'border-[#113F3D] text-[#113F3D]' : 'border-transparent text-muted-foreground'
                }`}
              >
                Current Plans ({compPlans.length})
              </button>
              <button
                type="button"
                onClick={() => setCompTab('new_revision')}
                className={`py-2.5 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1 ${
                  compTab === 'new_revision' ? 'border-[#113F3D] text-[#113F3D]' : 'border-transparent text-muted-foreground'
                }`}
              >
                <Plus className="size-3.5" /> New Compensation Revision
              </button>
              <button
                type="button"
                onClick={() => setCompTab('audit')}
                className={`py-2.5 px-3 font-semibold border-b-2 transition-colors ${
                  compTab === 'audit' ? 'border-[#113F3D] text-[#113F3D]' : 'border-transparent text-muted-foreground'
                }`}
              >
                Immutable Change Audit Log ({auditLogs.length})
              </button>
            </div>

            <CardContent className="p-4 overflow-y-auto space-y-4 flex-1">
              {compSuccessMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded text-xs flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                  {compSuccessMessage}
                </div>
              )}

              {compTab === 'plans' && (
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground">
                    Effective-dated compensation records currently registered in the database.
                  </div>
                  <div className="overflow-x-auto border rounded-md">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b bg-muted/30 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          <th className="py-2 px-2.5">Employee</th>
                          <th className="py-2 px-2">Effective Period</th>
                          <th className="py-2 px-2 text-right">Monthly CTC</th>
                          <th className="py-2 px-2 text-right">Basic</th>
                          <th className="py-2 px-2 text-right">HRA</th>
                          <th className="py-2 px-2 text-right">Special</th>
                          <th className="py-2 px-2 text-center">Version</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {compPlans.map((p) => (
                          <tr key={p.id} className="hover:bg-muted/20">
                            <td className="py-2 px-2.5">
                              <div className="font-semibold text-foreground">{p.employee_name || p.employee_id}</div>
                              <div className="text-[10px] text-muted-foreground font-mono">{p.employee_id}</div>
                            </td>
                            <td className="py-2 px-2 font-mono text-[11px]">
                              {p.effective_from} → {p.effective_to || 'Ongoing'}
                            </td>
                            <td className="py-2 px-2 text-right font-mono font-semibold">
                              ₹{p.monthly_ctc.toLocaleString('en-IN')}
                            </td>
                            <td className="py-2 px-2 text-right font-mono text-muted-foreground">
                              ₹{p.basic_pay.toLocaleString('en-IN')}
                            </td>
                            <td className="py-2 px-2 text-right font-mono text-muted-foreground">
                              ₹{p.hra.toLocaleString('en-IN')}
                            </td>
                            <td className="py-2 px-2 text-right font-mono text-muted-foreground">
                              ₹{p.special_allowance.toLocaleString('en-IN')}
                            </td>
                            <td className="py-2 px-2 text-center font-mono text-[10px]">
                              v{p.record_version}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {compTab === 'new_revision' && (
                <form onSubmit={handleCreateRevision} className="space-y-4">
                  <div className="p-3 bg-muted/20 rounded border text-xs text-muted-foreground leading-relaxed">
                    Recording a new salary structure will automatically close the previous active plan for this employee
                    as of the prior calendar date and create an immutable audit trail entry with the stated reason.
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="font-medium text-foreground">Employee Target</label>
                      <select
                        value={newPlanEmployeeId}
                        onChange={(e) => setNewPlanEmployeeId(e.target.value)}
                        className="mt-1 h-9 w-full rounded border bg-background px-2 text-xs"
                      >
                        <option value="EMP-001">Asha Rao (EMP-001 - Wealth Senior Caller)</option>
                        <option value="EMP-002">Ravi Menon (EMP-002 - Wealth Team Lead)</option>
                        <option value="EMP-004">Dev Kapoor (EMP-004 - Banking Caller, Joined 10 Jan)</option>
                        <option value="EMP-007">Neel Verma (EMP-007 - Wealth Branch Manager)</option>
                        <option value="EMP-014">Pooja Sharma (EMP-014 - HR Operations)</option>
                      </select>
                    </div>

                    <div>
                      <label className="font-medium text-foreground">Effective From Date</label>
                      <Input
                        type="date"
                        value={newPlanEffectiveFrom}
                        onChange={(e) => setNewPlanEffectiveFrom(e.target.value)}
                        required
                        className="mt-1 h-9 text-xs"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="font-medium text-foreground">Monthly CTC (INR)</label>
                      <Input
                        type="number"
                        value={newPlanMonthlyCtc}
                        onChange={(e) => handleMonthlyCtcChange(Number(e.target.value))}
                        required
                        min={10000}
                        className="mt-1 h-9 text-xs font-mono font-semibold"
                      />
                    </div>

                    <div>
                      <label className="font-medium text-foreground">Basic Pay (50%)</label>
                      <Input
                        type="number"
                        value={newPlanBasic}
                        onChange={(e) => setNewPlanBasic(Number(e.target.value))}
                        required
                        className="mt-1 h-9 text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="font-medium text-foreground">HRA (25%)</label>
                      <Input
                        type="number"
                        value={newPlanHra}
                        onChange={(e) => setNewPlanHra(Number(e.target.value))}
                        required
                        className="mt-1 h-9 text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="font-medium text-foreground">Special Allowance</label>
                      <Input
                        type="number"
                        value={newPlanSpecial}
                        onChange={(e) => setNewPlanSpecial(Number(e.target.value))}
                        required
                        className="mt-1 h-9 text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="font-medium text-foreground">Statutory PF (Employee)</label>
                      <Input
                        type="number"
                        value={newPlanPf}
                        onChange={(e) => setNewPlanPf(Number(e.target.value))}
                        required
                        className="mt-1 h-9 text-xs font-mono"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="font-medium text-foreground">Mandatory Reason for Salary Revision (Audit Log)</label>
                      <Textarea
                        value={newPlanReason}
                        onChange={(e) => setNewPlanReason(e.target.value)}
                        placeholder="Provide executive justification (e.g. Annual grade promotion, market band adjustment)..."
                        required
                        minLength={5}
                        className="mt-1 text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button variant="outline" size="sm" type="button" onClick={() => setCompTab('plans')}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      type="submit"
                      disabled={submittingComp}
                      className="bg-[#113F3D] hover:bg-[#113F3D]/90 text-white font-semibold"
                    >
                      {submittingComp ? 'Recording Revision...' : 'Save & Close Prior Plan'}
                    </Button>
                  </div>
                </form>
              )}

              {compTab === 'audit' && (
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground">
                    Immutable event log of all compensation plan creations and revisions.
                  </div>
                  <div className="space-y-2">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="rounded border p-3 bg-muted/10 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground flex items-center gap-1.5">
                            <span className="rounded bg-sky-100 text-sky-800 px-1.5 py-0.2 text-[10px] uppercase font-bold">
                              {log.action}
                            </span>
                            Target: {log.employee_id}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">{log.created_at}</span>
                        </div>
                        <div className="text-muted-foreground">
                          Reason: <strong className="text-foreground">{log.reason}</strong>
                        </div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                          <span>Changed by: <strong>{log.changed_by_name || log.changed_by_employee_id}</strong></span> ·
                          <span className="font-mono">Log ID: {log.id}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
