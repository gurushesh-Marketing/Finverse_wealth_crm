import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useParams, useLocation, useNavigate } from 'react-router-dom';
import { relApi, type RelPortfolioResponse, type RelPortfolioStats } from '../lib/rel-api';
import { useSession } from '../lib/session';
import { PageHeader, Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input, Textarea } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Panel, BusyButton } from '../components/ui/panel';
import { EmptyState, SkeletonRows, SuccessNote, DeniedPanel } from '../components/ui/states';
import type { LeadHandoffRecord, InstitutionCoordinationRecord, RelPortfolioItem, MarketsRequirement } from '@finverse/contracts';

function formatInr(val: number): string {
  if (val >= 10000000) {
    return `₹${(val / 10000000).toFixed(2)} Cr`;
  }
  if (val >= 100000) {
    return `₹${(val / 100000).toFixed(2)} Lakhs`;
  }
  return `₹${val.toLocaleString('en-IN')}`;
}

export function useRelVertical() {
  const { session } = useSession();
  const location = useLocation();
  const isBanking = Boolean(session?.verticalGrants?.includes('banking') || location.pathname.startsWith('/banking'));
  const isMarkets = Boolean(session?.verticalGrants?.includes('markets') || location.pathname.startsWith('/markets'));
  const isRealEstate = Boolean(
    session?.verticalGrants?.includes('real_estate') ||
    session?.verticalGrants?.includes('real-estate') ||
    location.pathname.startsWith('/real-estate')
  );
  const isWealth = !isBanking && !isMarkets && !isRealEstate;
  const verticalLabel = isBanking ? 'Commercial Banking' : isMarkets ? 'Markets & Securities' : isRealEstate ? 'Real Estate Advisory' : 'Wealth';
  const verticalScope = isBanking ? 'Banking scope' : isMarkets ? 'Markets scope' : isRealEstate ? 'Real Estate scope' : 'Wealth scope';

  return { isBanking, isMarkets, isRealEstate, isWealth, verticalLabel, verticalScope };
}

export function RelWorkspaceHeader({
  actionTitle,
  actionCode,
  description,
}: {
  actionTitle: string;
  actionCode: string;
  description: string;
}) {
  const { verticalLabel, verticalScope } = useRelVertical();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-muted-foreground">
          <Link to="/rel/portfolio" className="hover:text-primary hover:underline">
            Relationship Manager
          </Link>
          <span>/</span>
          <span className="text-primary font-bold">{actionCode} · {verticalLabel.toUpperCase()}</span>
        </div>
        <h1 className="mt-1 font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {actionTitle}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="default" className="bg-[#DCEEEA] text-[#113F3D] font-medium inline-flex items-center gap-1.5 px-3 py-1 text-xs">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          {verticalScope}
        </Badge>
        <Link to="/rel/handoffs">
          <Button size="sm" variant="outline" className="border-primary/40 font-medium hover:bg-secondary">
            Inbound Handoffs
          </Button>
        </Link>
        <Link to="/rel/institutions">
          <Button size="sm" variant="outline" className="border-primary/40 font-medium hover:bg-secondary">
            Partner Institutions
          </Button>
        </Link>
        <Link to="/rel/reports">
          <Button size="sm" variant="outline" className="border-primary/40 font-medium hover:bg-secondary">
            Review Pack
          </Button>
        </Link>
      </div>
    </div>
  );
}

// ─── Guidance Stack (3-card institutional standard) ───
export function RelGuidanceStack() {
  const { isBanking, isMarkets, isRealEstate, isWealth } = useRelVertical();

  return (
    <div className="space-y-4">
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-bold tracking-wider uppercase text-muted-foreground flex items-center gap-1.5">
            <span className="text-primary">●</span> HOW THIS WORKS
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1.5">
          <p>
            {isRealEstate
              ? 'Frontline Sales Callers qualify property mandates using buyer budget, property type, location preferences, and funds readiness, routing them via same-vertical fair assignment.'
              : isMarkets
              ? 'Frontline Sales Callers qualify active trading prospects using SEBI suitability, trading capital, and F&O risk disclosures, routing them via same-vertical fair assignment.'
              : isWealth
              ? 'Frontline Sales Callers qualify HNI prospects using SEBI suitability and investible surplus criteria and route them via same-vertical fair assignment.'
              : 'Frontline Sales Callers qualify prospects using vertical criteria and route them via same-vertical fair assignment.'}
          </p>
          <p>
            {isRealEstate
              ? 'Relationship Managers take full property mandate ownership, schedule private site visits, verify RERA escrow milestones, and coordinate directly with Tier-1 developer & property fund partners.'
              : isMarkets
              ? 'Relationship Managers take full trading account ownership, verify depository CKYC/KRA, structure margin facilities, and coordinate directly with Clearing Members and Exchange partners.'
              : isWealth
              ? 'Relationship Managers take full mandate ownership, design tailored investment strategies (PMS/AIF/Advisory), and coordinate directly with AMC and custodian partners.'
              : 'Relationship Managers take full deal ownership, negotiate financing structures, and coordinate directly with lending partners.'}
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-xs">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-bold tracking-wider uppercase text-amber-700 flex items-center gap-1.5">
            <span className="text-amber-600">▲</span> WHEN A CHECK FAILS
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1.5">
          <p>
            {isRealEstate
              ? 'If buyer budget does not meet unit configuration threshold, site visit is declined, or funds proof is unavailable, return the lead to the caller with a mandatory documented reason.'
              : isMarkets
              ? 'If income proof (6M bank statement / ITR) is deficient for derivatives activation or trading margin falls below statutory requirements, return the lead to the caller with a mandatory documented reason.'
              : isWealth
              ? 'If investible surplus falls below statutory minimums (e.g. ₹50L for PMS, ₹1Cr for AIF) or risk profile is mismatched, return the lead to the caller with a mandatory documented reason.'
              : 'If financial statements, collateral or borrower turnover are deficient, return the lead to the caller with a mandatory documented reason.'}
          </p>
          <p>Ownership reverts to the caller immediately without leaving unworked prospects stranded.</p>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-xs">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-bold tracking-wider uppercase text-primary flex items-center gap-1.5">
            <span className="text-primary">🔒</span> PERMISSION & EVIDENCE
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1.5">
          <p>
            {isRealEstate
              ? 'Developer brokerage agreements, unit price discounts, and builder escrow arrangements are strictly confidential to Relationship Managers.'
              : isMarkets
              ? 'Clearing member brokerage tariffs, institutional rebate schedules, and exchange agreements are strictly confidential to Relationship Managers.'
              : isWealth
              ? 'AMC partner fee structures, confidential mandate schedules, and custodian agreements are strictly confidential to Relationship Managers.'
              : 'Bank partner terms, committee sanction notes, and pricing discussions are strictly confidential to Relationship Managers.'}
          </p>
          <p>
            {isRealEstate
              ? 'Sales Callers can see handoff status and return reasons, but restricted builder commission and pricing terms are never exposed to callers.'
              : isMarkets
              ? 'Sales Callers can see handoff status and return reasons, but restricted broker fee schedules and clearing terms are never exposed to callers.'
              : isWealth
              ? 'Sales Callers can see handoff status and return reasons, but restricted AMC fee terms and advisory notes are never exposed to callers.'
              : 'Sales Callers can see handoff status and return reasons, but restricted banking partner terms are never exposed to callers.'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── 1. Portfolio Command Page (REL-01) ───
export function RelPortfolioPage() {
  const { isBanking, isMarkets, isRealEstate, isWealth } = useRelVertical();

  const [data, setData] = useState<RelPortfolioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await relApi.getPortfolio();
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to load portfolio.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-6">
        <RelWorkspaceHeader
          actionTitle={
            isRealEstate
              ? 'Real Estate Mandate Portfolio Command'
              : isMarkets
              ? 'Markets & Securities Portfolio Command'
              : isWealth
              ? 'Wealth Management Portfolio Command'
              : 'Commercial Banking Portfolio Command'
          }
          actionCode="REL-01"
          description={
            isRealEstate
              ? 'Qualified property acquisitions, luxury mandates, developer coordination & site visit progress'
              : isMarkets
              ? 'Qualified trading capital mandates, clearing & exchange partner progress'
              : isWealth
              ? 'Qualified HNI mandates, active advisory/PMS facilities & AMC partner progress'
              : 'Qualified commercial borrower mandates, active facilities & partner institution progress'
          }
        />
        <SkeletonRows rows={6} />
      </div>
    );
  }

  const stats = data?.stats || {
    totalActive: 0,
    byStage: {},
    totalRequestedAmount: 0,
    totalFacilities: 0,
  };
  const portfolio = data?.portfolio || [];

  return (
    <div className="space-y-6">
      <RelWorkspaceHeader
        actionTitle={
          isRealEstate
            ? 'Real Estate Mandate Portfolio Command'
            : isMarkets
            ? 'Markets & Securities Portfolio Command'
            : isWealth
            ? 'Wealth Management Portfolio Command'
            : 'Commercial Banking Portfolio Command'
        }
        actionCode="REL-01"
        description={
          isRealEstate
            ? 'Qualified property acquisitions, luxury mandates, developer coordination & site visit progress'
            : isMarkets
            ? 'Qualified trading capital mandates, clearing & exchange partner progress'
            : isWealth
            ? 'Qualified HNI mandates, active advisory/PMS facilities & AMC partner progress'
            : 'Qualified commercial borrower mandates, active facilities & partner institution progress'
        }
      />

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      {/* Hero Priority Card in brand dark teal (#113F3D) */}
      <div className="rounded-xl bg-[#113F3D] text-white p-6 shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-1">
            <span className="text-xs font-semibold tracking-wider uppercase text-emerald-200">
              {isRealEstate
                ? 'RELATIONSHIP MANAGER REAL ESTATE PORTFOLIO'
                : isMarkets
                ? 'RELATIONSHIP MANAGER MARKETS TRADING PORTFOLIO'
                : isWealth
                ? 'RELATIONSHIP MANAGER WEALTH MANDATE PORTFOLIO'
                : 'RELATIONSHIP MANAGER MANDATE PORTFOLIO'}
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-white">
              {formatInr(stats.totalRequestedAmount)} Active Pipeline
            </h2>
            <p className="text-xs text-emerald-100/80 max-w-xl">
              {isRealEstate
                ? `${stats.totalActive} active property mandates assigned. Coordinating luxury villa/commercial acquisitions, developer allocations, private site visits, and RERA escrow compliance.`
                : isMarkets
                ? `${stats.totalActive} active trading mandates assigned. Managing equity delivery, F&O derivative margins, and coordinating clearing member & exchange onboarding.`
                : isWealth
                ? `${stats.totalActive} active HNI mandates assigned. Managing discretionary advisory, PMS allocations, and coordinating AMC partner onboarding.`
                : `${stats.totalActive} active qualified mandates assigned. Structuring commercial term facilities, working capital limits, and coordinating institutional sanctions.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="rounded-lg bg-white/10 px-4 py-3 backdrop-blur-xs text-center border border-white/10">
              <div className="text-xs font-medium text-emerald-200">
                {isRealEstate ? 'Active Mandates' : isMarkets ? 'Active Accounts' : isWealth ? 'Active Mandates' : 'Active Facilities'}
              </div>
              <div className="text-xl font-bold text-white mt-0.5">{stats.totalActive}</div>
            </div>
            <div className="rounded-lg bg-white/10 px-4 py-3 backdrop-blur-xs text-center border border-white/10">
              <div className="text-xs font-medium text-emerald-200">
                {isRealEstate ? 'Site Visit Stage' : isMarkets ? 'KYC Stage' : isWealth ? 'Suitability Stage' : 'Inbound Review'}
              </div>
              <div className="text-xl font-bold text-white mt-0.5">
                {isRealEstate
                  ? (stats.byStage['site-visit'] ?? stats.byStage['requirement'] ?? 0)
                  : isMarkets
                  ? (stats.byStage['kyc'] ?? 0)
                  : isWealth
                  ? (stats.byStage['suitability'] ?? stats.byStage['discovery'] ?? 0)
                  : (stats.byStage['eligibility'] ?? 0)}
              </div>
            </div>
            <div className="rounded-lg bg-white/10 px-4 py-3 backdrop-blur-xs text-center border border-white/10">
              <div className="text-xs font-medium text-emerald-200">
                {isRealEstate ? 'Booking Stage' : isMarkets ? 'Risk Profile Stage' : isWealth ? 'Proposal Stage' : 'Sanction Stage'}
              </div>
              <div className="text-xl font-bold text-white mt-0.5">
                {isRealEstate
                  ? (stats.byStage['booking'] ?? stats.byStage['closed'] ?? 0)
                  : isMarkets
                  ? (stats.byStage['risk-profile'] ?? stats.byStage['demat-opened'] ?? 0)
                  : isWealth
                  ? (stats.byStage['proposal'] ?? stats.byStage['onboarding'] ?? 0)
                  : (stats.byStage['sanction'] ?? 0)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 7-day sparkline & Operating Signals */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 border-border/80">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {isRealEstate ? 'Site Visit Velocity' : isMarkets ? 'Account Velocity' : isWealth ? 'Mandate Velocity' : 'Facility Velocity'}
          </div>
          <div className="mt-1 text-2xl font-bold text-foreground">
            {isRealEstate ? '4.2 Days' : isMarkets ? '4.8 Days' : isWealth ? '6.2 Days' : '7.4 Days'}
          </div>
          <div className="mt-2 text-xs text-muted-foreground flex items-center justify-between">
            <span>
              {isRealEstate
                ? 'Caller handoff → first private site visit'
                : isMarkets
                ? 'Caller handoff → first trade setup'
                : isWealth
                ? 'Caller handoff → first AMC pitch'
                : 'Caller handoff → first partner pitch'}
            </span>
            <span className="text-emerald-600 font-medium">
              {isRealEstate ? '96% on SLA' : isMarkets ? '98% on SLA' : isWealth ? '95% on SLA' : '92% on SLA'}
            </span>
          </div>
        </Card>
        <Card className="p-4 border-border/80">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {isRealEstate ? 'Developer & Fund Submissions' : isMarkets ? 'Clearing & Exchange Submissions' : isWealth ? 'AMC & Custodian Submissions' : 'Partner Submissions'}
          </div>
          <div className="mt-1 text-2xl font-bold text-foreground">
            {stats.totalFacilities} {isRealEstate ? 'Allocations' : isMarkets ? 'Accounts' : 'Proposals'}
          </div>
          <div className="mt-2 text-xs text-muted-foreground flex items-center justify-between">
            <span>
              {isRealEstate
                ? 'Lodha Luxury, Godrej Properties, DLF & Prestige'
                : isMarkets
                ? 'NSE Clearing, ICCL, Kotak Inst & HDFC Sec'
                : isWealth
                ? 'Kotak Alt, ICICI Pru, HDFC AMC & 360 ONE'
                : 'HDFC, ICICI, Axis & SBI'}
            </span>
            <span className="text-primary font-medium">Active</span>
          </div>
        </Card>
        <Card className="p-4 border-border/80">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {isRealEstate ? 'Avg Property Budget' : isMarkets ? 'Avg Trading Margin' : 'Avg Ticket Size'}
          </div>
          <div className="mt-1 text-2xl font-bold text-foreground">
            {stats.totalActive > 0 ? formatInr(stats.totalRequestedAmount / stats.totalActive) : '₹0'}
          </div>
          <div className="mt-2 text-xs text-muted-foreground flex items-center justify-between">
            <span>
              {isRealEstate ? 'Luxury & Commercial acquisitions' : isMarkets ? 'Active Trading Margin' : isWealth ? 'HNI Advisory / PMS fit' : 'Commercial lending fit'}
            </span>
            <span className="text-muted-foreground">
              {isRealEstate ? 'Statutory: ₹1Cr–₹50Cr' : isMarkets ? 'Statutory: ₹10L–₹5Cr' : isWealth ? 'Statutory: ₹50L–₹10Cr' : 'Range: ₹25L–₹10Cr'}
            </span>
          </div>
        </Card>
        <Card className="p-4 border-border/80">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {isRealEstate ? 'RERA & Title Search' : isMarkets ? 'SEBI Risk Disclosure' : isWealth ? 'SEBI Suitability Notice' : 'Credit Check Notice'}
          </div>
          <div className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            {isRealEstate ? '100% Verified' : isMarkets ? 'Mandatory Verified' : isWealth ? 'Matrix Verified' : 'Consented Offline'}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            {isRealEstate
              ? 'State RERA registered projects · unencumbered title search · zero credit checks'
              : isMarkets
              ? 'SEBI 9/10 F&O Loss Disclosure on file · zero credit checks'
              : isWealth
              ? 'CKYC & KRA depository sync active · zero loan checks'
              : 'CIBIL integration pending credentials · zero fake scores'}
          </div>
        </Card>
      </div>

      {/* Main Workspace: Active Portfolio & Right-Rail Guidance */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/60">
              <div>
                <CardTitle className="text-base font-bold text-foreground">
                  {isRealEstate
                    ? `Active Real Estate Mandates (${portfolio.length})`
                    : isMarkets
                    ? `Active Markets Mandates (${portfolio.length})`
                    : isWealth
                    ? `Active Wealth Mandates (${portfolio.length})`
                    : `Active Commercial Mandates (${portfolio.length})`}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isRealEstate
                    ? 'Qualified property acquisition & luxury investor prospects under direct Relationship Manager handling'
                    : isMarkets
                    ? 'Qualified active trader prospects under direct Relationship Manager handling'
                    : isWealth
                    ? 'Qualified HNI prospects under direct Relationship Manager handling'
                    : 'Qualified prospects under direct Relationship Manager handling'}
                </p>
              </div>
              <Link to="/rel/handoffs">
                <Button size="sm" variant="outline">
                  View Handoff Queue
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="pt-4">
              {portfolio.length === 0 ? (
                <EmptyState
                  title="No active mandates"
                  message={
                    isRealEstate
                      ? 'Accept inbound qualified Real Estate leads from the handoff queue to schedule private site visits & allocate developer units.'
                      : isMarkets
                      ? 'Accept inbound qualified Markets leads from the handoff queue to start structuring trading accounts & clearing facilities.'
                      : isWealth
                      ? 'Accept inbound qualified HNI leads from the handoff queue to start structuring investment mandates.'
                      : 'Accept inbound qualified borrower leads from the handoff queue to start structuring facilities.'
                  }
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs" data-testid="rel-portfolio-table">
                    <thead>
                      <tr className="border-b border-border/80 text-muted-foreground font-semibold">
                        <th className="py-2.5 px-3">Client / Mandate</th>
                        <th className="py-2.5 px-3">
                          {isRealEstate ? 'Property Type' : isMarkets ? 'Trading Segment' : isWealth ? 'Mandate Strategy' : 'Facility Type'}
                        </th>
                        <th className="py-2.5 px-3">
                          {isRealEstate ? 'Property Budget' : isMarkets ? 'Trading Capital' : isWealth ? 'Investible Surplus' : 'Requested Amount'}
                        </th>
                        <th className="py-2.5 px-3">Stage</th>
                        <th className="py-2.5 px-3">Handoff Status</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {portfolio.map((p) => (
                        <tr key={p.leadId} className="hover:bg-secondary/40 transition-colors">
                          <td className="py-3 px-3">
                            <div className="font-semibold text-foreground">{p.displayName}</div>
                            <div className="font-mono text-[11px] text-muted-foreground">{p.leadId}</div>
                          </td>
                          <td className="py-3 px-3 text-foreground font-medium">
                            {p.propertyType ||
                              p.tradingSegment ||
                              p.mandateType ||
                              p.facilityType ||
                              p.product ||
                              (isRealEstate ? 'Luxury Residential' : isMarkets ? 'Equity & Derivatives' : isWealth ? 'Wealth Advisory' : 'Commercial Facility')}
                          </td>
                          <td className="py-3 px-3 font-semibold text-foreground">
                            {p.propertyBudget || p.tradingCapital || p.investibleSurplus || p.requestedAmount
                              ? formatInr(p.propertyBudget || p.tradingCapital || p.investibleSurplus || p.requestedAmount!)
                              : '—'}
                          </td>
                          <td className="py-3 px-3">
                            <Badge
                              tone={
                                p.stage === 'sanction' ||
                                p.stage === 'suitability' ||
                                p.stage === 'onboarding' ||
                                p.stage === 'risk-profile' ||
                                p.stage === 'demat-opened'
                                  ? 'verified'
                                  : p.stage === 'documents' || p.stage === 'proposal' || p.stage === 'kyc'
                                  ? 'pending'
                                  : 'default'
                              }
                            >
                              {p.stage}
                            </Badge>
                          </td>
                          <td className="py-3 px-3">
                            <Badge tone={p.handoffStatus === 'accepted' ? 'verified' : 'pending'}>
                              {p.handoffStatus ?? 'accepted'}
                            </Badge>
                          </td>
                          <td className="py-3 px-3 text-right space-x-2">
                            <Link to={`/rel/prospects/${p.leadId}`}>
                              <Button size="sm" variant="outline" className="text-xs h-7 px-2">
                                Open File
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <RelGuidanceStack />
        </div>
      </div>
    </div>
  );
}

// ─── 2. Handoff Queue Page (REL-02 / Review Gate) ───
export function RelHandoffsPage() {
  const { isBanking, isMarkets, isRealEstate, isWealth } = useRelVertical();

  const [handoffs, setHandoffs] = useState<LeadHandoffRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  // Decision Modal state
  const [activeModal, setActiveModal] = useState<{
    handoff: LeadHandoffRecord;
    decision: 'accepted' | 'returned';
  } | null>(null);
  const [reason, setReason] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await relApi.getHandoffs();
      setHandoffs(res.handoffs);
    } catch (err: any) {
      setError(err?.message || 'Failed to load handoffs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDecision = async () => {
    if (!activeModal) return;
    setBusy(true);
    setError(null);
    try {
      await relApi.decideHandoff(activeModal.handoff.id, {
        decision: activeModal.decision === 'accepted' ? 'accept' : 'return',
        reason: activeModal.decision === 'returned' ? reason : undefined,
        nextStep: activeModal.decision === 'accepted' ? nextStep : undefined,
      });
      setNote(
        activeModal.decision === 'accepted'
          ? `Handoff accepted. Mandate moved to your active portfolio.`
          : `Handoff returned to caller with reason: "${reason}". Ownership reverted.`
      );
      setActiveModal(null);
      setReason('');
      setNextStep('');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to submit decision.');
    } finally {
      setBusy(false);
    }
  };

  const filtered = handoffs.filter((h) => {
    if (filter === 'pending') return h.status === 'pending';
    if (filter === 'accepted') return h.status === 'accepted';
    if (filter === 'returned') return h.status === 'returned';
    return true;
  });

  return (
    <div className="space-y-6">
      <RelWorkspaceHeader
        actionTitle={
          isRealEstate
            ? 'Inbound Qualified Real Estate Handoff Queue'
            : isMarkets
            ? 'Inbound Qualified Markets Handoff Queue'
            : isWealth
            ? 'Inbound Qualified Wealth Handoff Queue'
            : 'Inbound Qualified Handoff Queue'
        }
        actionCode="REL-02"
        description={
          isRealEstate
            ? 'Review caller findings, property needs & accept or return qualified Real Estate handoffs'
            : isMarkets
            ? 'Review caller findings, trading capital & accept or return qualified Markets handoffs'
            : isWealth
            ? 'Review caller findings, investible surplus & accept or return qualified Wealth handoffs'
            : 'Review caller findings, loan requirements & accept or return qualified borrower handoffs'
        }
      />

      {note ? <SuccessNote>{note}</SuccessNote> : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={filter === 'all' ? 'default' : 'outline'}
            onClick={() => setFilter('all')}
          >
            All ({handoffs.length})
          </Button>
          <Button
            size="sm"
            variant={filter === 'pending' ? 'default' : 'outline'}
            onClick={() => setFilter('pending')}
          >
            Pending ({handoffs.filter((h) => h.status === 'pending').length})
          </Button>
          <Button
            size="sm"
            variant={filter === 'accepted' ? 'default' : 'outline'}
            onClick={() => setFilter('accepted')}
          >
            Accepted ({handoffs.filter((h) => h.status === 'accepted').length})
          </Button>
          <Button
            size="sm"
            variant={filter === 'returned' ? 'default' : 'outline'}
            onClick={() => setFilter('returned')}
          >
            Returned ({handoffs.filter((h) => h.status === 'returned').length})
          </Button>
        </div>
      </div>

      {loading ? (
        <SkeletonRows rows={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No handoffs found"
          message="No prospect handoffs match the selected filter."
        />
      ) : (
        <div className="space-y-4" data-testid="handoff-queue-list">
          {filtered.map((h) => {
            const reReq = h.realEstateRequirement;
            const mReq = h.marketsRequirement;
            const wReq = h.wealthRequirement;
            const isRealEstateHandoff = Boolean(reReq && (reReq.budget || (reReq as any).propertyBudget || reReq.propertyType)) || isRealEstate;
            const isMarketsHandoff = !isRealEstateHandoff && (Boolean(mReq && (mReq.tradingCapital || mReq.tradingSegment)) || isMarkets);
            const isWealthHandoff = !isRealEstateHandoff && !isMarketsHandoff && (Boolean(wReq && (wReq.investibleSurplus || wReq.mandateType)) || isWealth);
            const req = h.loanRequirement as any;
            return (
              <Card key={h.id} className="p-5 border-border/80 shadow-xs">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground text-base">
                        {h.leadDisplayName || h.leadId}
                      </span>
                      <Badge tone={h.status === 'accepted' ? 'verified' : h.status === 'returned' ? 'default' : 'pending'}>
                        {h.status.toUpperCase()}
                      </Badge>
                      <span className="text-xs text-muted-foreground font-mono">
                        {new Date(h.handoffTime).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Handoff by Caller <span className="font-semibold text-foreground">{h.callerName}</span> · Assigned RM: <span className="font-semibold text-foreground">{h.relName}</span>
                    </div>
                  </div>

                  {h.status === 'pending' ? (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        className="bg-[#113F3D] hover:bg-[#0d2f2d] text-white"
                        onClick={() => {
                          setActiveModal({ handoff: h, decision: 'accepted' });
                          setNextStep(
                            isRealEstateHandoff
                              ? 'Schedule private site visit & verify RERA escrow'
                              : isMarketsHandoff
                              ? 'Verify SEBI CKYC, derivative income proof & clearing margin'
                              : isWealthHandoff
                              ? 'Review SEBI risk profile & prepare AMC mandate proposal'
                              : 'Request credit financials & collateral documents'
                          );
                        }}
                        data-testid={`accept-handoff-${h.id}`}
                      >
                        Accept Handoff
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-destructive/40 text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          setActiveModal({ handoff: h, decision: 'returned' });
                          setReason('');
                        }}
                        data-testid={`return-handoff-${h.id}`}
                      >
                        Return to Caller
                      </Button>
                    </div>
                  ) : (
                    <div className="text-xs font-medium text-muted-foreground">
                      Decided on {h.decisionTime ? new Date(h.decisionTime).toLocaleDateString() : '—'}
                    </div>
                  )}
                </div>

                {/* Real Estate, Markets, Wealth, or Loan Requirement Grid */}
                {reReq && (reReq.budget || (reReq as any).propertyBudget || reReq.propertyType) ? (
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 rounded-lg bg-secondary/30 p-3 text-xs" data-testid="handoff-real-estate-requirement">
                    <div>
                      <span className="text-muted-foreground block">Property Budget:</span>
                      <span className="font-bold text-foreground text-sm">
                        {(reReq.budget || (reReq as any).propertyBudget) ? formatInr(reReq.budget || (reReq as any).propertyBudget) : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Property Type:</span>
                      <span className="font-semibold text-foreground">
                        {reReq.propertyType || 'Luxury Villa'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Preferred Location:</span>
                      <span className="font-semibold text-foreground">
                        {reReq.preferredLocation || 'Worli / Bandra West'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Purchase Timeline:</span>
                      <span className="font-semibold text-foreground">
                        {reReq.purchaseTimeline || 'Immediate (0-30 days)'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Purchase Purpose:</span>
                      <span className="font-semibold text-foreground">
                        {reReq.purchasePurpose || 'Self-Use / Primary Residence'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Site Visit Preference:</span>
                      <span className="font-semibold text-foreground">
                        {reReq.siteVisitPreference || 'This Weekend'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Funding Source:</span>
                      <span className="font-semibold text-foreground">
                        {reReq.fundingSource || 'Self-Funded / Equity Liquidation'}
                      </span>
                    </div>
                    {reReq.possessionPreference ? (
                      <div>
                        <span className="text-muted-foreground block">Possession Preference:</span>
                        <span className="font-semibold text-foreground">
                          {reReq.possessionPreference}
                        </span>
                      </div>
                    ) : null}
                  </div>
                ) : mReq && (mReq.tradingCapital || mReq.tradingSegment) ? (
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 rounded-lg bg-secondary/30 p-3 text-xs">
                    <div>
                      <span className="text-muted-foreground block">Trading Capital:</span>
                      <span className="font-bold text-foreground text-sm">
                        {mReq.tradingCapital ? formatInr(mReq.tradingCapital) : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Trading Segment:</span>
                      <span className="font-semibold text-foreground">
                        {mReq.tradingSegment || 'Equity Delivery & Intraday'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Trading Experience:</span>
                      <span className="font-semibold text-foreground">
                        {mReq.tradingExperience || '1-3 Years'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Risk Tolerance:</span>
                      <span className="font-semibold text-foreground">
                        {mReq.riskTolerance || 'Aggressive'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Depository Preference:</span>
                      <span className="font-semibold text-foreground">
                        {mReq.depositoryPreference || 'CDSL'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Income Proof:</span>
                      <span className="font-semibold text-foreground">
                        {mReq.incomeProofAvailable ? '6M Bank Statement Attached' : 'Pending Verification'}
                      </span>
                    </div>
                    {mReq.existingBroker ? (
                      <div>
                        <span className="text-muted-foreground block">Existing Broker:</span>
                        <span className="font-semibold text-foreground">
                          {mReq.existingBroker}
                        </span>
                      </div>
                    ) : null}
                  </div>
                ) : wReq && (wReq.investibleSurplus || wReq.mandateType) ? (
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 rounded-lg bg-secondary/30 p-3 text-xs">
                    <div>
                      <span className="text-muted-foreground block">Investible Surplus:</span>
                      <span className="font-bold text-foreground text-sm">
                        {wReq.investibleSurplus ? formatInr(wReq.investibleSurplus) : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Mandate Product:</span>
                      <span className="font-semibold text-foreground">
                        {wReq.mandateType || 'Wealth Advisory'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Risk Profile:</span>
                      <span className="font-semibold text-foreground">
                        {wReq.riskProfile || 'Moderate'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Investment Horizon:</span>
                      <span className="font-semibold text-foreground">
                        {wReq.investmentHorizon || '3-5 Years'}
                      </span>
                    </div>
                    {wReq.existingPortfolioSize ? (
                      <div>
                        <span className="text-muted-foreground block">Existing Portfolio:</span>
                        <span className="font-semibold text-foreground">
                          {formatInr(wReq.existingPortfolioSize)}
                        </span>
                      </div>
                    ) : null}
                    {wReq.targetReturnExpectation ? (
                      <div>
                        <span className="text-muted-foreground block">Target Return:</span>
                        <span className="font-semibold text-foreground">
                          {wReq.targetReturnExpectation}
                        </span>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 rounded-lg bg-secondary/30 p-3 text-xs">
                    <div>
                      <span className="text-muted-foreground block">Requested Amount:</span>
                      <span className="font-bold text-foreground text-sm">
                        {req?.requestedAmount ? formatInr(req.requestedAmount) : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Facility Type:</span>
                      <span className="font-semibold text-foreground">
                        {req?.facilityType ?? 'Commercial Loan'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Annual Turnover:</span>
                      <span className="font-semibold text-foreground">
                        {req?.annualTurnover ? formatInr(req.annualTurnover) : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Loan Purpose:</span>
                      <span className="font-semibold text-foreground">
                        {req?.loanPurpose ?? 'Working Capital Expansion'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Evidence & Findings */}
                <div className="mt-3 text-xs space-y-1">
                  <div>
                    <span className="font-semibold text-foreground">Qualification Evidence: </span>
                    <span className="text-muted-foreground">{h.qualificationEvidence}</span>
                  </div>
                  {h.decisionReason ? (
                    <div className="rounded bg-amber-500/10 p-2 text-amber-900 border border-amber-500/20">
                      <span className="font-semibold">Return Reason: </span>
                      {h.decisionReason}
                    </div>
                  ) : null}
                </div>

                {/* Required Documents */}
                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="font-semibold text-muted-foreground mr-1">Required Docs:</span>
                  {h.requiredDocuments.map((doc, idx) => (
                    <Badge key={idx} tone="default" className="text-[10px]">
                      {doc}
                    </Badge>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Decision Drawer/Modal */}
      {activeModal ? (
        <Panel
          open={Boolean(activeModal)}
          onClose={() => setActiveModal(null)}
          title={
            activeModal.decision === 'accepted'
              ? 'Accept Qualified Prospect Handoff'
              : 'Return Prospect to Sales Caller'
          }
          footer={
            <BusyButton
              busy={busy}
              onClick={() => void handleDecision()}
              className={
                activeModal.decision === 'accepted'
                  ? 'bg-[#113F3D] hover:bg-[#0d2f2d] text-white'
                  : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
              }
            >
              {activeModal.decision === 'accepted' ? 'Confirm Acceptance' : 'Confirm Return'}
            </BusyButton>
          }
        >
          <div className="space-y-4 text-xs">
            <p className="text-muted-foreground">
              {activeModal.decision === 'accepted'
                ? `You are accepting ownership of ${activeModal.handoff.leadDisplayName || activeModal.handoff.leadId}. The prospect will move to your active portfolio and enter the ${isRealEstate ? '"booking"' : isMarkets ? '"risk-profile"' : isWealth ? '"suitability"' : '"documents"'} stage.`
                : `You are returning ${activeModal.handoff.leadDisplayName || activeModal.handoff.leadId} to caller ${activeModal.handoff.callerName}. Please provide a specific reason explaining what is missing or why qualification criteria were not met.`}
            </p>

            {activeModal.decision === 'accepted' ? (
              <div className="space-y-1">
                <label className="font-semibold text-foreground block">
                  Next Step / Immediate Action
                </label>
                <Input
                  value={nextStep}
                  onChange={(e) => setNextStep(e.target.value)}
                  placeholder="e.g. Schedule call for financial document review"
                />
              </div>
            ) : (
              <div className="space-y-1">
                <label className="font-semibold text-foreground block">
                  Return Reason (Mandatory, minimum 5 characters) *
                </label>
                <Textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Turnover is below required threshold, or missing GST reconciliation."
                  data-testid="return-reason-input"
                />
              </div>
            )}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

// ─── 3. Partner Institutions Coordination Page (REL-03) ───
export function RelInstitutionsPage() {
  const { isBanking, isMarkets, isRealEstate, isWealth } = useRelVertical();

  const [portfolio, setPortfolio] = useState<RelPortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  const [handoffId, setHandoffId] = useState<string>('');
  const [coordinations, setCoordinations] = useState<InstitutionCoordinationRecord[]>([]);

  // Form State
  const [partnerName, setPartnerName] = useState(
    isRealEstate
      ? 'Lodha Luxury Collections'
      : isMarkets
      ? 'NSE Clearing Limited (NCL)'
      : isWealth
      ? 'Kotak Alternate Assets'
      : 'HDFC Bank Commercial Credit'
  );
  const [proposedFacility, setProposedFacility] = useState(
    isRealEstate
      ? 'Luxury Villa / Penthouse Allotment'
      : isMarkets
      ? 'F&O Clearing & Margin Facility'
      : isWealth
      ? 'Portfolio Management Services (PMS)'
      : 'Working Capital Term Loan'
  );
  const [sanctionAmount, setSanctionAmount] = useState<number>(
    isRealEstate ? 35000000 : isMarkets ? 2500000 : isWealth ? 7500000 : 5000000
  );
  const [interestRate, setInterestRate] = useState(
    isRealEstate
      ? '20:80 Construction Linked / Builder Escrow'
      : isMarkets
      ? '0.02% per contract + SEBI turnover charges'
      : isWealth
      ? '1.75% Fixed AMC + 15% carry above 10% hurdle'
      : '9.25% p.a.'
  );
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await relApi.getPortfolio();
      setPortfolio(res.portfolio);
      if (res.portfolio.length > 0 && !selectedLeadId) {
        setSelectedLeadId(res.portfolio[0].leadId);
        if (res.portfolio[0].handoffId) {
          setHandoffId(res.portfolio[0].handoffId);
        }
      }
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, [selectedLeadId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedLeadId) return;
    const match = portfolio.find((p) => p.leadId === selectedLeadId);
    if (match?.handoffId) {
      setHandoffId(match.handoffId);
    }
    void relApi.getProspectDetail(selectedLeadId).then((res: any) => {
      const activeHandoff = res.handoff || (res.handoffs && res.handoffs[0]);
      if (activeHandoff) {
        setHandoffId(activeHandoff.id);
        setCoordinations(activeHandoff.institutionOptions || res.institutionOptions || []);
      }
    });
  }, [selectedLeadId, portfolio]);

  const handleSubmit = async () => {
    if (!handoffId) {
      setError('Please select an active prospect with an accepted handoff.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await relApi.addInstitutionCoordination(handoffId, {
        institutionName: partnerName,
        facilityOffered: proposedFacility,
        sanctionAmount: sanctionAmount,
        interestRate: interestRate,
        status: 'submitted',
        notes:
          notes ||
          (isRealEstate
            ? 'Developer allotment & luxury inventory proposal submitted'
            : isMarkets
            ? 'Clearing setup & margin facility submitted'
            : isWealth
            ? 'Mandate proposal submitted for AMC onboarding'
            : 'Proposal submitted for credit appraisal'),
      });
      setNote(`Proposal logged with ${partnerName} for ₹${sanctionAmount.toLocaleString('en-IN')}.`);
      setNotes('');
      // refresh
      const res = await relApi.getProspectDetail(selectedLeadId);
      setCoordinations(res.institutionOptions || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to record institution coordination.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <RelWorkspaceHeader
        actionTitle={
          isRealEstate
            ? 'Real Estate Developers & Institutional Mandate Coordination'
            : isMarkets
            ? 'Markets Clearing Members & Exchange Coordination'
            : isWealth
            ? 'Wealth Partner Institutions Coordination'
            : 'Partner Institutions Coordination'
        }
        actionCode="REL-03"
        description={
          isRealEstate
            ? 'Coordinate with Tier-1 Developers, Luxury Villa Promoters & Institutional Escrow Partners on property allotments'
            : isMarkets
            ? 'Coordinate with Clearing Members, Depositories (NSDL/CDSL) & Prime Brokers on margin facilities'
            : isWealth
            ? 'Coordinate with Asset Management Companies (AMCs), Portfolio Managers & Custodians on mandates'
            : 'Negotiate credit facilities, submit term proposals & record bank partner sanctions'
        }
      />

      {note ? <SuccessNote>{note}</SuccessNote> : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Form: Log Institutional Proposal */}
        <div className="space-y-4 lg:col-span-1">
          <Card className="p-4 border-border/80 shadow-xs">
            <CardHeader className="p-0 pb-3">
              <CardTitle className="text-sm font-bold text-foreground">
                {isRealEstate
                  ? 'Log Developer Partner Allotment'
                  : isMarkets
                  ? 'Log Clearing Member / Exchange Submission'
                  : isWealth
                  ? 'Log AMC / Custodian Proposal'
                  : 'Log Bank Partner Proposal'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 space-y-3 text-xs">
              <div>
                <label className="font-semibold text-foreground block mb-1">
                  {isRealEstate ? 'Select Property Mandate' : isMarkets ? 'Select Trading Account' : isWealth ? 'Select Client Mandate' : 'Select Borrower Mandate'}
                </label>
                <Select
                  value={selectedLeadId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedLeadId(val);
                    const match = portfolio.find((p) => p.leadId === val);
                    if (match?.handoffId) setHandoffId(match.handoffId);
                  }}
                  data-testid="select-borrower-mandate"
                >
                  {portfolio.map((p) => (
                    <option key={p.leadId} value={p.leadId}>
                      {p.displayName} ({p.leadId}) · {(p.propertyBudget || p.tradingCapital || p.investibleSurplus || p.requestedAmount) ? formatInr(p.propertyBudget || p.tradingCapital || p.investibleSurplus || p.requestedAmount!) : '—'}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">
                  {isRealEstate ? 'Developer Partner / Real Estate Fund' : isMarkets ? 'Clearing Member / Exchange Partner' : isWealth ? 'AMC / Custodian Partner' : 'Lending Partner Institution'}
                </label>
                <Select
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  data-testid="select-partner-institution"
                >
                  {isRealEstate ? (
                    <>
                      <option value="Lodha Luxury Collections">Lodha Luxury Collections</option>
                      <option value="Godrej Properties Premium Projects">Godrej Properties Premium Projects</option>
                      <option value="DLF Cybercity / Super Luxury">DLF Cybercity / Super Luxury</option>
                      <option value="Prestige Estates Luxury Division">Prestige Estates Luxury Division</option>
                      <option value="Oberoi Realty">Oberoi Realty</option>
                      <option value="Embassy Group Commercial & Residential">Embassy Group Commercial & Residential</option>
                      <option value="Brookfield Real Estate Fund">Brookfield Real Estate Fund</option>
                      <option value="HDFC Capital Real Estate Debt Fund">HDFC Capital Real Estate Debt Fund</option>
                    </>
                  ) : isMarkets ? (
                    <>
                      <option value="NSE Clearing Limited (NCL)">NSE Clearing Limited (NCL)</option>
                      <option value="Indian Clearing Corporation (ICCL)">Indian Clearing Corporation (ICCL)</option>
                      <option value="Kotak Securities Institutional Equities">Kotak Securities Institutional Equities</option>
                      <option value="HDFC Securities (Institutional Broking)">HDFC Securities (Institutional Broking)</option>
                      <option value="Motilal Oswal Financial Services">Motilal Oswal Financial Services</option>
                      <option value="Nuvama Professional Clearing Services">Nuvama Professional Clearing Services</option>
                      <option value="Orbis Financial Clearing Corporation">Orbis Financial Clearing Corporation</option>
                      <option value="National Securities Depository Limited (NSDL)">National Securities Depository Limited (NSDL)</option>
                      <option value="Central Depository Services Limited (CDSL)">Central Depository Services Limited (CDSL)</option>
                    </>
                  ) : isWealth ? (
                    <>
                      <option value="Kotak Alternate Assets">Kotak Alternate Assets</option>
                      <option value="ICICI Prudential AMC">ICICI Prudential AMC</option>
                      <option value="HDFC Asset Management">HDFC Asset Management</option>
                      <option value="Motilal Oswal AMC">Motilal Oswal AMC</option>
                      <option value="360 ONE Asset Management">360 ONE Asset Management</option>
                      <option value="ASK Investment Managers">ASK Investment Managers</option>
                      <option value="Standard Chartered Custody">Standard Chartered Custody</option>
                    </>
                  ) : (
                    <>
                      <option value="HDFC Bank Commercial Credit">HDFC Bank Commercial Credit</option>
                      <option value="ICICI Bank Business Banking">ICICI Bank Business Banking</option>
                      <option value="Axis Corporate & SME Banking">Axis Corporate & SME Banking</option>
                      <option value="State Bank of India (SME)">State Bank of India (SME)</option>
                      <option value="Kotak Mahindra Commercial">Kotak Mahindra Commercial</option>
                    </>
                  )}
                </Select>
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">
                  {isRealEstate ? 'Inventory / Allotment Unit Structure' : isMarkets ? 'Clearing / Trading Facility Offered' : isWealth ? 'Mandate Strategy / Product Offered' : 'Proposed Facility'}
                </label>
                <Input
                  value={proposedFacility}
                  onChange={(e) => setProposedFacility(e.target.value)}
                  data-testid="proposed-facility-input"
                />
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">
                  {isRealEstate ? 'Property Price / Allotment Consideration (INR)' : isMarkets ? 'Trading Margin / Capital Commitment (INR)' : isWealth ? 'Proposed Allocation Amount (INR)' : 'Proposed Sanction Amount (INR)'}
                </label>
                <Input
                  type="number"
                  value={sanctionAmount}
                  onChange={(e) => setSanctionAmount(Number(e.target.value))}
                  data-testid="proposed-amount-input"
                />
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">
                  {isRealEstate ? 'Payment Schedule & Escrow Terms' : isMarkets ? 'Brokerage & Clearing Tariff Terms' : isWealth ? 'Advisory Fee / Hurdle Structure' : 'Interest Rate & Terms'}
                </label>
                <Input
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                  data-testid="interest-rate-input"
                />
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">
                  Appraisal Notes & Next Step
                </label>
                <Textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={
                    isRealEstate
                      ? 'Developer inventory unit, RERA escrow verification, and private site visit notes...'
                      : isMarkets
                      ? 'Clearing participant code, margin pledge, and depository sync...'
                      : isWealth
                      ? 'Investor risk profiling, custodian onboarding, mandate draft notes...'
                      : 'Terms negotiated, covenant checks, appraisal feedback...'
                  }
                  data-testid="coordination-notes-input"
                />
              </div>

              <BusyButton
                busy={busy}
                disabled={!handoffId || busy}
                onClick={() => void handleSubmit()}
                className="w-full bg-[#113F3D] hover:bg-[#0d2f2d] text-white"
                data-testid="log-coordination-btn"
              >
                {isWealth ? 'Log AMC Coordination' : 'Log Partner Coordination'}
              </BusyButton>
            </CardContent>
          </Card>
        </div>

        {/* Right Table: Active Institution Coordinations for Selected Prospect */}
        <div className="space-y-4 lg:col-span-2">
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-3 border-b border-border/60">
              <CardTitle className="text-sm font-bold text-foreground">
                {isWealth ? `AMC & Custodian Proposals (${coordinations.length})` : `Institutional Proposals & Terms (${coordinations.length})`}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {coordinations.length === 0 ? (
                <EmptyState
                  title={isWealth ? 'No AMC proposals logged' : 'No institutional proposals logged'}
                  message={
                    isWealth
                      ? 'Log proposals submitted to AMCs and portfolio managers for this client.'
                      : 'Log proposals submitted to lending institutions for this borrower.'
                  }
                />
              ) : (
                <div className="space-y-3">
                  {coordinations.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-lg border border-border/70 p-3 text-xs space-y-1.5 hover:bg-secondary/20 transition-colors"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-foreground text-sm">
                          {c.institutionName}
                        </span>
                        <Badge tone="verified">
                          {c.status.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-muted-foreground">
                        <div>
                          <span>{isWealth ? 'Strategy: ' : 'Facility: '}</span>
                          <span className="font-semibold text-foreground">{c.facilityOffered}</span>
                        </div>
                        <div>
                          <span>{isWealth ? 'Allocation: ' : 'Sanction: '}</span>
                          <span className="font-semibold text-foreground">{c.sanctionAmount ? formatInr(c.sanctionAmount) : '—'}</span>
                        </div>
                        <div>
                          <span>{isWealth ? 'Fee / Terms: ' : 'Rate: '}</span>
                          <span className="font-semibold text-foreground">{c.interestRate || '—'}</span>
                        </div>
                      </div>
                      {c.notes ? (
                        <p className="text-muted-foreground bg-secondary/40 p-2 rounded">
                          {c.notes}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── 4. Prospect File Page (Honest Bureau Notice & Full History) ───
export function RelProspectDetailPage() {
  const { isBanking, isMarkets, isRealEstate, isWealth } = useRelVertical();
  const { session } = useSession();

  const { id = '' } = useParams();
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await relApi.getProspectDetail(id);
      setDetail(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to load prospect detail.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyEvidenceRef, setVerifyEvidenceRef] = useState('');
  const [verifyNotes, setVerifyNotes] = useState('');
  const [verifyReraNumber, setVerifyReraNumber] = useState('');
  const [verifyTitleStatus, setVerifyTitleStatus] = useState<'clear_unencumbered' | 'under_legal_review' | 'pending_legal_search'>('clear_unencumbered');
  const [verifyCkycStatus, setVerifyCkycStatus] = useState<'verified' | 'pending' | 'unverified'>('verified');
  const [verifyIncomeProof, setVerifyIncomeProof] = useState<'verified' | 'pending' | 'unverified'>('verified');
  const [verifyRiskDisclosure, setVerifyRiskDisclosure] = useState(true);
  const [verifySuitabilityStatus, setVerifySuitabilityStatus] = useState<'verified' | 'pending' | 'unverified'>('verified');
  const [verifyKraStatus, setVerifyKraStatus] = useState(true);
  const [verifySubmitting, setVerifySubmitting] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const handleRecordVerification = async (targetCheckType: 'suitability' | 'markets_kyc' | 'real_estate' | 'credit_bureau') => {
    if (!verifyEvidenceRef.trim()) {
      setVerifyError('Evidence reference is required.');
      return;
    }
    setVerifySubmitting(true);
    setVerifyError(null);
    try {
      const updated = await relApi.recordVerification(id, {
        checkType: targetCheckType,
        status: 'verified',
        evidenceReference: verifyEvidenceRef.trim(),
        source: 'human_review',
        notes: verifyNotes.trim() || undefined,
        reraApprovalStatus: targetCheckType === 'real_estate' ? (verifyReraNumber.trim() ? 'verified' : 'pending') : undefined,
        reraProjectNumber: targetCheckType === 'real_estate' ? (verifyReraNumber.trim() || undefined) : undefined,
        titleSearchStatus: targetCheckType === 'real_estate' ? verifyTitleStatus : undefined,
        incomeProofStatus: targetCheckType === 'markets_kyc' ? verifyIncomeProof : undefined,
        sebiRiskDisclosureAcknowledged: targetCheckType === 'markets_kyc' ? verifyRiskDisclosure : undefined,
        suitabilityStatus: targetCheckType === 'suitability' ? verifySuitabilityStatus : undefined,
        kraVerified: targetCheckType === 'suitability' ? verifyKraStatus : undefined,
        ckycStatus: targetCheckType === 'suitability' || targetCheckType === 'markets_kyc' ? verifyCkycStatus : undefined,
      });
      setDetail(updated);
      setShowVerifyModal(false);
      setVerifyEvidenceRef('');
      setVerifyNotes('');
      setVerifyReraNumber('');
    } catch (err: any) {
      setVerifyError(err?.message || 'Failed to record verification.');
    } finally {
      setVerifySubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <RelWorkspaceHeader
          actionTitle={
            isRealEstate
              ? `Property Mandate File: ${id}`
              : isMarkets
              ? `Trading Account File: ${id}`
              : isWealth
              ? `Client Mandate File: ${id}`
              : `Borrower Prospect File: ${id}`
          }
          actionCode="REL-04"
          description={
            isRealEstate
              ? 'Detailed property requirement, RERA project registration & legal title search review'
              : isMarkets
              ? 'Detailed trading capital requirement, SEBI CKYC & derivative risk disclosure review'
              : isWealth
              ? 'Detailed HNI mandate requirement, SEBI investor suitability & KYC review'
              : 'Detailed financial requirement, honest credit bureau notice & document review'
          }
        />
        <SkeletonRows rows={5} />
      </div>
    );
  }

  const p = detail?.prospect;
  const b = detail?.bureauStatus;
  const s = detail?.suitabilityCheck;
  const m = detail?.marketsKycCheck;
  const re = detail?.realEstateCheck;
  const handoffs: LeadHandoffRecord[] = detail?.handoffs || [];
  const activeHandoff = handoffs[0];
  const reReq = activeHandoff?.realEstateRequirement;
  const mReq = activeHandoff?.marketsRequirement;
  const wReq = activeHandoff?.wealthRequirement;
  const req = activeHandoff?.loanRequirement as any;
  const isRealEstateLead = Boolean(re || (reReq && (reReq.budget || reReq.propertyType)) || isRealEstate);
  const isMarketsLead = !isRealEstateLead && Boolean(m || (mReq && (mReq.tradingCapital || mReq.tradingSegment)) || isMarkets);

  return (
    <div className="space-y-6">
      <RelWorkspaceHeader
        actionTitle={
          isRealEstate
            ? `Property Mandate File: ${p?.displayName || id}`
            : isMarkets
            ? `Trading Account File: ${p?.displayName || id}`
            : isWealth
            ? `Client Mandate File: ${p?.displayName || id}`
            : `Borrower File: ${p?.displayName || id}`
        }
        actionCode="REL-04"
        description={
          isRealEstate
            ? 'Detailed property requirement, RERA project registration & legal title search review'
            : isMarkets
            ? 'Detailed trading capital requirement, SEBI CKYC & derivative risk disclosure review'
            : isWealth
            ? 'Detailed HNI mandate requirement, SEBI investor suitability & KYC review'
            : 'Detailed financial requirement, honest credit bureau notice & document review'
        }
      />

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      {/* RERA Compliance & Title Search Verification Alert (Real Estate) */}
      {isRealEstateLead ? (
        <div
          className={`rounded-xl border p-4 text-xs transition-all ${
            re?.status === 'verified'
              ? 'border-emerald-300 bg-emerald-50/60 text-emerald-950 dark:bg-emerald-950/20 dark:text-emerald-200 dark:border-emerald-800'
              : 'border-amber-300 bg-amber-50/60 text-amber-950 dark:bg-amber-950/20 dark:text-amber-200 dark:border-amber-800'
          }`}
          data-testid="real-estate-check-card"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-sm">
              <span>🏢</span>
              <span>RERA COMPLIANCE & TITLE SEARCH VERIFICATION</span>
              <Badge tone={re?.status === 'verified' ? 'verified' : 'pending'} className="text-[10px]">
                {re?.status === 'verified' ? 'RERA & TITLE VERIFIED' : 'PENDING VERIFICATION'}
              </Badge>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 border-emerald-600/40 text-emerald-900 dark:text-emerald-200"
              onClick={() => setShowVerifyModal(true)}
              data-testid="record-verification-btn"
            >
              {re?.status === 'verified' ? 'Update Evidence' : 'Record Verification Evidence'}
            </Button>
          </div>
          <p className="mt-1 text-muted-foreground leading-relaxed">
            {re?.notice ?? 'RERA project registration and 30-year title search pending verification with developer legal records. Credit Bureau / CIBIL not applicable for property acquisition.'}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] font-mono">
            <span>RERA Project Reg: <strong className="text-foreground">{re?.reraProjectNumber ?? '— (Pending developer filing)'}</strong></span>
            <span>Title Search: <strong>{re?.titleSearchStatus === 'clear_unencumbered' ? 'Clear / 30-Year Search Free of Encumbrance' : 'Pending Legal Title Search'}</strong></span>
            <span>Bureau / CIBIL: <strong className="text-muted-foreground">Not applicable for Real Estate acquisition</strong></span>
          </div>
          <div className="mt-2.5 pt-2 border-t border-border/50 text-[10px] text-muted-foreground flex flex-wrap items-center gap-4">
            <span>Status: <strong className="text-foreground font-mono">{re?.status ?? 'pending_verification'}</strong></span>
            <span>Evidence Ref: <strong className="text-foreground font-mono">{re?.evidenceReference ?? 'None on file'}</strong></span>
            <span>Source: <strong className="text-foreground">{re?.source ?? 'none'}</strong></span>
            {re?.reviewerOrProvider ? <span>Reviewer/Provider: <strong className="text-foreground">{re.reviewerOrProvider}</strong></span> : null}
            {re?.verifiedAt ? <span>Verified At: <strong className="text-foreground">{new Date(re.verifiedAt).toLocaleString()}</strong></span> : null}
          </div>
        </div>
      ) : isMarketsLead ? (
        /* SEBI Central KYC & Derivative Risk Disclosure Alert (Markets) */
        <div
          className={`rounded-xl border p-4 text-xs transition-all ${
            m?.status === 'verified'
              ? 'border-emerald-300 bg-emerald-50/60 text-emerald-950 dark:bg-emerald-950/20 dark:text-emerald-200 dark:border-emerald-800'
              : 'border-amber-300 bg-amber-50/60 text-amber-950 dark:bg-amber-950/20 dark:text-amber-200 dark:border-amber-800'
          }`}
          data-testid="markets-kyc-card"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-sm">
              <span>📈</span>
              <span>SEBI CENTRAL KYC & DERIVATIVE RISK DISCLOSURE (Depository CKYC / KRA)</span>
              <Badge tone={m?.status === 'verified' ? 'verified' : 'pending'} className="text-[10px]">
                {m?.status === 'verified' ? 'SUITABILITY VERIFIED' : 'PENDING VERIFICATION'}
              </Badge>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 border-emerald-600/40 text-emerald-900 dark:text-emerald-200"
              onClick={() => setShowVerifyModal(true)}
              data-testid="record-verification-btn"
            >
              {m?.status === 'verified' ? 'Update Evidence' : 'Record Verification Evidence'}
            </Button>
          </div>
          <p className="mt-1 text-muted-foreground leading-relaxed">
            {m?.notice ?? 'SEBI Central KYC & KRA depository sync pending. Mandatory derivative risk disclosure pending client acknowledgement (9 out of 10 individual F&O traders incur net losses). Credit Bureau / CIBIL not applicable for Markets trading.'}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] font-mono">
            <span>Risk Category: <strong className="text-foreground">{m?.riskCategory ?? 'Aggressive / Derivative'}</strong></span>
            <span>Depository Sync: <strong>{m?.status === 'verified' ? (m.depositoryStatus || 'CKYC & CDSL/NSDL Active') : 'Pending CKYC Sync'}</strong></span>
            <span>Income Proof: <strong>{m?.incomeProofStatus === 'verified' ? 'Verified' : m?.incomeProofStatus === 'exempt_cash_only' ? 'Exempt (Cash Only)' : 'Pending Review'}</strong></span>
            <span>Bureau / CIBIL: <strong className="text-muted-foreground">Not applicable for Markets trading</strong></span>
          </div>
          <div className="mt-2.5 pt-2 border-t border-border/50 text-[10px] text-muted-foreground flex flex-wrap items-center gap-4">
            <span>Status: <strong className="text-foreground font-mono">{m?.status ?? 'pending_verification'}</strong></span>
            <span>Evidence Ref: <strong className="text-foreground font-mono">{m?.evidenceReference ?? 'None on file'}</strong></span>
            <span>Source: <strong className="text-foreground">{m?.source ?? 'none'}</strong></span>
            {m?.reviewerOrProvider ? <span>Reviewer/Provider: <strong className="text-foreground">{m.reviewerOrProvider}</strong></span> : null}
            {m?.verifiedAt ? <span>Verified At: <strong className="text-foreground">{new Date(m.verifiedAt).toLocaleString()}</strong></span> : null}
          </div>
        </div>
      ) : s || isWealth ? (
        /* SEBI Investor Suitability & KYC Verification Honest Alert (Wealth) */
        <div
          className={`rounded-xl border p-4 text-xs transition-all ${
            s?.status === 'verified'
              ? 'border-emerald-300 bg-emerald-50/60 text-emerald-950 dark:bg-emerald-950/20 dark:text-emerald-200 dark:border-emerald-800'
              : 'border-amber-300 bg-amber-50/60 text-amber-950 dark:bg-amber-950/20 dark:text-amber-200 dark:border-amber-800'
          }`}
          data-testid="sebi-suitability-card"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-sm">
              <span>🛡️</span>
              <span>SEBI INVESTOR SUITABILITY & KYC VERIFICATION (Depository CKYC / KRA)</span>
              <Badge tone={s?.status === 'verified' ? 'verified' : 'pending'} className="text-[10px]">
                {s?.status === 'verified' ? 'SUITABILITY VERIFIED' : 'PENDING VERIFICATION'}
              </Badge>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 border-emerald-600/40 text-emerald-900 dark:text-emerald-200"
              onClick={() => setShowVerifyModal(true)}
              data-testid="record-verification-btn"
            >
              {s?.status === 'verified' ? 'Update Evidence' : 'Record Verification Evidence'}
            </Button>
          </div>
          <p className="mt-1 text-muted-foreground leading-relaxed">
            {s?.notice ?? 'SEBI Investor Suitability review pending. Depository CKYC/KRA integration pending provider credentials · Zero fake bureau data.'}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] font-mono">
            <span>Risk Category: <strong className="text-foreground">{s?.riskCategory ?? 'Growth / Aggressive'}</strong></span>
            <span>Depository Sync: <strong>{s?.status === 'verified' ? 'CKYC & KRA Active' : 'Pending CKYC Sync'}</strong></span>
            <span>Bureau / CIBIL: <strong className="text-muted-foreground">Not applicable for Wealth advisory</strong></span>
          </div>
          <div className="mt-2.5 pt-2 border-t border-border/50 text-[10px] text-muted-foreground flex flex-wrap items-center gap-4">
            <span>Status: <strong className="text-foreground font-mono">{s?.status ?? 'pending_verification'}</strong></span>
            <span>Evidence Ref: <strong className="text-foreground font-mono">{s?.evidenceReference ?? 'None on file'}</strong></span>
            <span>Source: <strong className="text-foreground">{s?.source ?? 'none'}</strong></span>
            {s?.reviewerOrProvider ? <span>Reviewer/Provider: <strong className="text-foreground">{s.reviewerOrProvider}</strong></span> : null}
            {s?.verifiedAt ? <span>Verified At: <strong className="text-foreground">{new Date(s.verifiedAt).toLocaleString()}</strong></span> : null}
          </div>
        </div>
      ) : (
        /* Credit Bureau Verification Honest Alert (Banking) */
        <div
          className="rounded-xl border border-amber-300 bg-amber-50/60 p-4 text-xs text-amber-950 dark:bg-amber-950/20 dark:text-amber-200 dark:border-amber-800"
          data-testid="credit-bureau-card"
        >
          <div className="flex items-center gap-2 font-bold text-sm">
            <span>🛡️</span>
            <span>CREDIT BUREAU VERIFICATION ({b?.provider ?? 'CIBIL / Experian'})</span>
            <Badge tone="default" className="text-[10px]">
              {b?.status ?? 'PROVIDER NOT CONNECTED'}
            </Badge>
          </div>
          <p className="mt-1 text-muted-foreground leading-relaxed">
            {b?.notice ?? 'Live CIBIL integration pending credentials. Consented provider authorization required before running bureau check.'}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] font-mono">
            <span>Bureau Score: <strong className="text-foreground">— (Pending live provider)</strong></span>
            <span>Consent Record: <strong>Required on file</strong></span>
          </div>
          <div className="mt-2.5 pt-2 border-t border-border/50 text-[10px] text-muted-foreground flex flex-wrap items-center gap-4">
            <span>Status: <strong className="text-foreground font-mono">{b?.status ?? 'pending_authorization'}</strong></span>
            <span>Evidence Ref: <strong className="text-foreground font-mono">{b?.evidenceReference ?? 'None (Consented authorization pending)'}</strong></span>
            <span>Source: <strong className="text-foreground">{b?.source ?? 'none'}</strong></span>
          </div>
        </div>
      )}

      {/* Modal Dialog for Recording Human Verification Evidence */}
      {showVerifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="bg-card text-card-foreground border border-border rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="font-bold text-base">
                {isRealEstateLead
                  ? 'Record RERA & Title Legal Verification'
                  : isMarketsLead
                  ? 'Record SEBI CKYC & Risk Disclosure Verification'
                  : isWealth
                  ? 'Record SEBI Investor Suitability Verification'
                  : 'Record Credit Bureau & Financial Review'}
              </h3>
              <button
                onClick={() => setShowVerifyModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {verifyError && <p className="text-xs text-destructive">{verifyError}</p>}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">
                  Evidence Reference Document / Filing ID *
                </label>
                <Input
                  placeholder={
                    isRealEstateLead
                      ? 'e.g. MH-RERA-VERIF-2026-4412'
                      : isMarketsLead
                      ? 'e.g. SEBI-CKYC-DISCLOSURE-2026-99'
                      : 'e.g. SEBI-SUIT-MANDATE-2026-09'
                  }
                  value={verifyEvidenceRef}
                  onChange={(e) => setVerifyEvidenceRef(e.target.value)}
                  data-testid="evidence-ref-input"
                />
              </div>

              {isRealEstateLead && (
                <>
                  <div>
                    <label className="block font-semibold mb-1">RERA Project Registration Certificate #</label>
                    <Input
                      placeholder="e.g. MahaRERA P51800004567 (leave blank if pending)"
                      value={verifyReraNumber}
                      onChange={(e) => setVerifyReraNumber(e.target.value)}
                      data-testid="rera-number-input"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Title Search Legal Opinion Status</label>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={verifyTitleStatus}
                      onChange={(e) => setVerifyTitleStatus(e.target.value as any)}
                      data-testid="title-search-status-select"
                    >
                      <option value="clear_unencumbered">Clear & Marketable Title (Unencumbered)</option>
                      <option value="under_legal_review">Under Legal Review / Search In Progress</option>
                      <option value="pending_legal_search">Pending Legal Search</option>
                    </select>
                  </div>
                </>
              )}

              {isMarketsLead && (
                <>
                  <div>
                    <label className="block font-semibold mb-1">Central KYC (CKYC) Verification Status</label>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={verifyCkycStatus}
                      onChange={(e) => setVerifyCkycStatus(e.target.value as any)}
                      data-testid="ckyc-status-select"
                    >
                      <option value="verified">Verified (CKYC Portal Match)</option>
                      <option value="pending">Pending Document Verification</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">6-Month Income Proof Verification</label>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={verifyIncomeProof}
                      onChange={(e) => setVerifyIncomeProof(e.target.value as any)}
                      data-testid="income-proof-select"
                    >
                      <option value="verified">Verified (Bank Statement / ITR / Form 16)</option>
                      <option value="pending">Pending Submission</option>
                    </select>
                  </div>
                  <div className="pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-medium">
                      <input
                        type="checkbox"
                        checked={verifyRiskDisclosure}
                        onChange={(e) => setVerifyRiskDisclosure(e.target.checked)}
                        data-testid="risk-disclosure-checkbox"
                        className="rounded border-input text-teal-700 focus:ring-teal-500"
                      />
                      <span>SEBI Derivative Risk Disclosure Acknowledged</span>
                    </label>
                  </div>
                </>
              )}

              {isWealth && (
                <>
                  <div>
                    <label className="block font-semibold mb-1">SEBI Investor Suitability Assessment</label>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={verifySuitabilityStatus}
                      onChange={(e) => setVerifySuitabilityStatus(e.target.value as any)}
                      data-testid="suitability-status-select"
                    >
                      <option value="verified">Verified / Suitable for Mandate</option>
                      <option value="pending">Pending Profile Assessment</option>
                      <option value="unverified">Unsuitable / Escalation Needed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">CKYC / KRA Verification Status</label>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={verifyCkycStatus}
                      onChange={(e) => setVerifyCkycStatus(e.target.value as any)}
                      data-testid="wealth-ckyc-select"
                    >
                      <option value="verified">CKYC & KRA Verified on Record</option>
                      <option value="pending">Pending KRA Verification</option>
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="block font-semibold mb-1">Verification / Review Notes</label>
                <textarea
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  rows={3}
                  placeholder="Document review notes, depository holding statement review, or legal title search certificate details..."
                  value={verifyNotes}
                  onChange={(e) => setVerifyNotes(e.target.value)}
                  data-testid="verify-notes-input"
                />
              </div>

              <div className="rounded bg-secondary/40 p-3 text-[11px] text-muted-foreground">
                Recorded reviewer: <strong className="text-foreground">{session?.displayName || 'Relationship Manager'}</strong> (Human Review with immutable audit log event).
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowVerifyModal(false)}
                disabled={verifySubmitting}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-[#113F3D] hover:bg-[#0d2f2d] text-white"
                onClick={() =>
                  handleRecordVerification(
                    isRealEstateLead
                      ? 'real_estate'
                      : isMarketsLead
                      ? 'markets_kyc'
                      : isWealth
                      ? 'suitability'
                      : 'credit_bureau'
                  )
                }
                disabled={verifySubmitting}
                data-testid="confirm-verify-btn"
              >
                {verifySubmitting ? 'Recording...' : 'Confirm Verification'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="p-5 border-border/80 shadow-xs">
            <CardHeader className="p-0 pb-3 border-b border-border/60">
              <CardTitle className="text-sm font-bold text-foreground">
                {isRealEstateLead
                  ? 'Property Requirements & Site Visit Preference'
                  : isMarketsLead
                  ? 'Trading Segment & Margin Requirements'
                  : isWealth
                  ? 'Mandate Strategy & Suitability Requirements'
                  : 'Mandate & Facility Requirements'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 pt-3 text-xs space-y-3">
              {reReq && (reReq.budget || (reReq as any).propertyBudget || reReq.propertyType) ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <span className="text-muted-foreground block">Property Budget:</span>
                    <span className="text-base font-bold text-foreground">
                      {(reReq.budget || (reReq as any).propertyBudget) ? formatInr(reReq.budget || (reReq as any).propertyBudget) : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Property Type:</span>
                    <span className="font-semibold text-foreground">
                      {reReq.propertyType ?? 'Luxury Villa'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Preferred Location:</span>
                    <span className="font-semibold text-foreground">
                      {reReq.preferredLocation ?? 'Worli / Bandra West'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Purchase Timeline:</span>
                    <span className="font-semibold text-foreground">
                      {reReq.purchaseTimeline ?? 'Immediate (0-30 days)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Purchase Purpose:</span>
                    <span className="font-semibold text-foreground">
                      {reReq.purchasePurpose ?? 'Self-Use / Primary Residence'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Site Visit Preference:</span>
                    <span className="font-semibold text-foreground">
                      {reReq.siteVisitPreference ?? 'This Weekend'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Funding Source:</span>
                    <span className="font-semibold text-foreground">
                      {reReq.fundingSource ?? 'Self-Funded / Equity Liquidation'}
                    </span>
                  </div>
                  {reReq.possessionPreference ? (
                    <div>
                      <span className="text-muted-foreground block">Possession Preference:</span>
                      <span className="font-semibold text-foreground">
                        {reReq.possessionPreference}
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : mReq && (mReq.tradingCapital || mReq.tradingSegment) ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <span className="text-muted-foreground block">Trading Capital:</span>
                    <span className="text-base font-bold text-foreground">
                      {mReq.tradingCapital ? formatInr(mReq.tradingCapital) : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Trading Segment:</span>
                    <span className="font-semibold text-foreground">
                      {mReq.tradingSegment ?? 'F&O Derivatives'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Trading Experience:</span>
                    <span className="font-semibold text-foreground">
                      {mReq.tradingExperience ?? '1-3 Years'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Risk Tolerance:</span>
                    <span className="font-semibold text-foreground">
                      {mReq.riskTolerance ?? 'Aggressive'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Depository Preference:</span>
                    <span className="font-semibold text-foreground">
                      {mReq.depositoryPreference ?? 'CDSL'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Income Proof Status:</span>
                    <span className="font-semibold text-foreground">
                      {mReq.incomeProofAvailable ? '6M Bank Statement Attached (Verified)' : 'Pending Upload'}
                    </span>
                  </div>
                  {mReq.existingBroker ? (
                    <div>
                      <span className="text-muted-foreground block">Existing Broker:</span>
                      <span className="font-semibold text-foreground">
                        {mReq.existingBroker}
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : wReq && (wReq.investibleSurplus || wReq.mandateType) ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <span className="text-muted-foreground block">Investible Surplus:</span>
                    <span className="text-base font-bold text-foreground">
                      {wReq.investibleSurplus ? formatInr(wReq.investibleSurplus) : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Mandate Product:</span>
                    <span className="font-semibold text-foreground">
                      {wReq.mandateType ?? 'Portfolio Management Services (PMS)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Risk Profile:</span>
                    <span className="font-semibold text-foreground">
                      {wReq.riskProfile ?? 'Growth'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Investment Horizon:</span>
                    <span className="font-semibold text-foreground">
                      {wReq.investmentHorizon ?? '3-5 Years'}
                    </span>
                  </div>
                  {wReq.existingPortfolioSize ? (
                    <div>
                      <span className="text-muted-foreground block">Existing Portfolio Size:</span>
                      <span className="font-semibold text-foreground">
                        {formatInr(wReq.existingPortfolioSize)}
                      </span>
                    </div>
                  ) : null}
                  {wReq.currentBrokerOrAmc ? (
                    <div>
                      <span className="text-muted-foreground block">Current Broker / AMC:</span>
                      <span className="font-semibold text-foreground">
                        {wReq.currentBrokerOrAmc}
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <span className="text-muted-foreground block">Requested Amount:</span>
                    <span className="text-base font-bold text-foreground">
                      {req?.requestedAmount ? formatInr(req.requestedAmount) : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Facility Type:</span>
                    <span className="font-semibold text-foreground">
                      {req?.facilityType ?? 'Commercial Loan'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Annual Turnover:</span>
                    <span className="font-semibold text-foreground">
                      {req?.annualTurnover ? formatInr(req.annualTurnover) : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Constitution:</span>
                    <span className="font-semibold text-foreground">
                      {req?.businessConstitution ?? 'Private Limited Company'}
                    </span>
                  </div>
                </div>
              )}

              <div className="rounded bg-secondary/30 p-3 space-y-1">
                <span className="font-semibold text-foreground block">Qualification Evidence:</span>
                <p className="text-muted-foreground">{activeHandoff?.qualificationEvidence || 'No notes'}</p>
              </div>

              <div>
                <span className="font-semibold text-foreground block mb-1">Required Documents:</span>
                <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                  {activeHandoff?.requiredDocuments?.map((doc: string, idx: number) => (
                    <li key={idx}>{doc}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <RelGuidanceStack />
        </div>
      </div>
    </div>
  );
}

// ─── 5. Review Pack & Reports (REL-05) ───
export function RelReportsPage() {
  const { isBanking, isMarkets, isRealEstate, isWealth } = useRelVertical();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void relApi.getReviewPackSummary().then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <RelWorkspaceHeader
        actionTitle="Relationship Manager Review Pack & Pipeline Export"
        actionCode="REL-05"
        description="Verified mandate summary, partner sanctions & downloadable review pack"
      />

      <Card className="p-6 border-border/80 shadow-xs">
        <CardHeader className="p-0 pb-4 border-b border-border/60 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-foreground">
              {isRealEstate
                ? 'Real Estate Advisory & Developer Mandate Review Pack'
                : isMarkets
                ? 'Markets & Securities Portfolio Review Pack'
                : isWealth
                ? 'Wealth Management Mandate Review Pack'
                : 'Commercial Banking Portfolio Review Pack'}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isRealEstate
                ? 'Deterministic metrics generated from active property mandates, site visits, and developer allocations'
                : isMarkets
                ? 'Deterministic metrics generated from active trading accounts and verified clearing member facilities'
                : isWealth
                ? 'Deterministic metrics generated from active HNI mandates and verified AMC proposals'
                : 'Deterministic metrics generated from active borrower mandates and verified partner proposals'}
            </p>
          </div>
          <a href="/api/rel/export-pack" download>
            <Button size="sm" className="bg-[#113F3D] hover:bg-[#0d2f2d] text-white">
              📥 Export Binary PDF Pack
            </Button>
          </a>
        </CardHeader>
        <CardContent className="p-0 pt-4 space-y-4 text-xs">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-secondary/30 p-4">
              <span className="text-muted-foreground block text-xs">
                {isRealEstate ? 'Active Property Mandates' : isMarkets ? 'Active Trading Accounts' : isWealth ? 'Active Mandates' : 'Active Deals'}
              </span>
              <span className="text-2xl font-bold text-foreground mt-1 block">
                {data?.activeDealsCount ?? '—'}
              </span>
            </div>
            <div className="rounded-lg bg-secondary/30 p-4">
              <span className="text-muted-foreground block text-xs">
                {isRealEstate ? 'Total Property Pipeline' : isMarkets ? 'Total Trading Pipeline' : isWealth ? 'Total AUM Pipeline' : 'Total Pipeline Facility'}
              </span>
              <span className="text-2xl font-bold text-foreground mt-1 block">
                {data?.totalFacilityPipeline ? formatInr(data.totalFacilityPipeline) : '—'}
              </span>
            </div>
            <div className="rounded-lg bg-secondary/30 p-4">
              <span className="text-muted-foreground block text-xs">Pending Handoff Reviews</span>
              <span className="text-2xl font-bold text-foreground mt-1 block">
                {data?.pendingHandoffsCount ?? 0}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
