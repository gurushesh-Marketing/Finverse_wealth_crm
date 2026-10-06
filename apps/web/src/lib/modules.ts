import {
  ArrowLeftRight,
  BarChart3,
  CalendarDays,
  Compass,
  FileText,
  Gauge,
  GraduationCap,
  Handshake,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  MessageSquare,
  ShieldCheck,
  Target,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { WorkspaceSession } from '@finverse/contracts';

export interface Module {
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
  requiredVerticals: string[];
  requiredActions: string[];
  href: string;
}

export interface ModuleGroup {
  key: string;
  label: string;
  modules: Module[];
}

const ALL_MODULES: Module[] = [
  {
    key: 'wealth.dashboard',
    label: 'My day',
    description: 'Personal pipeline and activity overview',
    icon: LayoutDashboard,
    requiredVerticals: ['wealth'],
    requiredActions: ['report.read:personal'],
    href: '/wealth/dashboard',
  },
  {
    key: 'wealth.prospects',
    label: 'Lead Inbox',
    description: 'Filter, search and save wealth lead views',
    icon: Inbox,
    requiredVerticals: ['wealth'],
    requiredActions: ['prospect.read'],
    href: '/wealth/prospects',
  },
  {
    key: 'wealth.activities',
    label: 'Conversations',
    description: 'Calls, messages and manual activities',
    icon: MessageSquare,
    requiredVerticals: ['wealth'],
    requiredActions: ['activity.read'],
    href: '/wealth/activities',
  },
  {
    key: 'wealth.tasks',
    label: 'Calendar & tasks',
    description: 'Schedule and manage follow-ups',
    icon: CalendarDays,
    requiredVerticals: ['wealth'],
    requiredActions: ['task.manage'],
    href: '/wealth/tasks',
  },
  {
    key: 'wealth.deals',
    label: 'My pipeline',
    description: 'Track wealth deal pipeline',
    icon: Handshake,
    requiredVerticals: ['wealth'],
    requiredActions: ['deal.read'],
    href: '/wealth/deals',
  },
  {
    key: 'wealth.documents',
    label: 'Documents',
    description: 'Request and inspect evidence',
    icon: FileText,
    requiredVerticals: ['wealth'],
    requiredActions: ['document.request'],
    href: '/wealth/documents',
  },
  {
    key: 'wealth.reports',
    label: 'Performance',
    description: 'Personal performance reports',
    icon: BarChart3,
    requiredVerticals: ['wealth'],
    requiredActions: ['report.read:personal'],
    href: '/wealth/reports',
  },
  {
    key: 'wealth.reviews',
    label: 'Reviews & help',
    description: 'One-to-ones, blockers and corrections',
    icon: LifeBuoy,
    requiredVerticals: ['wealth'],
    requiredActions: ['review.acknowledge'],
    href: '/wealth/reviews',
  },
  {
    key: 'management.overview',
    label: 'Team overview',
    description: 'Team health, KPI drill, corrective tasks',
    icon: Users,
    requiredVerticals: ['wealth'],
    requiredActions: ['report.read:team'],
    href: '/management/team',
  },
  {
    key: 'management.allocation',
    label: 'Lead allocation',
    description: 'Unassigned queue and batch distribution',
    icon: ArrowLeftRight,
    requiredVerticals: ['wealth'],
    requiredActions: ['task.assign'],
    href: '/management/allocation',
  },
  {
    key: 'management.workload',
    label: 'Team workload',
    description: 'Rebalancing and overdue recovery',
    icon: Gauge,
    requiredVerticals: ['wealth'],
    requiredActions: ['task.assign'],
    href: '/management/workload',
  },
  {
    key: 'management.quality',
    label: 'Quality & approvals',
    description: 'Conversions, reopens, quality, corrections',
    icon: ShieldCheck,
    requiredVerticals: ['wealth'],
    requiredActions: ['report.read:team'],
    href: '/management/quality',
  },
  {
    key: 'management.targets',
    label: 'Targets & forecast',
    description: 'Target distribution and team forecasts',
    icon: Target,
    requiredVerticals: ['wealth'],
    requiredActions: ['report.read:team'],
    href: '/management/targets',
  },
  {
    key: 'management.coaching',
    label: 'Coaching',
    description: 'Associate reviews, one-to-ones, mentoring',
    icon: GraduationCap,
    requiredVerticals: ['wealth'],
    requiredActions: ['report.read:team'],
    href: '/management/coaching',
  },
  {
    key: 'management.requests',
    label: 'Requests & help',
    description: 'Staffing requests and escalations',
    icon: Megaphone,
    requiredVerticals: ['wealth'],
    requiredActions: ['report.read:team'],
    href: '/management/requests',
  },
  {
    key: 'management.reports',
    label: 'Team reports',
    description: 'Review packs and recurring schedules',
    icon: BarChart3,
    requiredVerticals: ['wealth'],
    requiredActions: ['report.read:team'],
    href: '/management/reports',
  },
  {
    key: 'manager.overview',
    label: 'Manager overview',
    description: 'Performance across team leaders and pace',
    icon: LayoutDashboard,
    requiredVerticals: ['wealth'],
    requiredActions: ['report.read:manager'],
    href: '/manager/overview',
  },
  {
    key: 'manager.leaders',
    label: 'Team leaders',
    description: 'Operating scorecards, source quality, actions',
    icon: Users,
    requiredVerticals: ['wealth'],
    requiredActions: ['report.read:manager'],
    href: '/manager/leaders',
  },
  {
    key: 'manager.capacity',
    label: 'Capacity & transfers',
    description: 'Lead transfers, recovery plan, staff moves',
    icon: ArrowLeftRight,
    requiredVerticals: ['wealth'],
    requiredActions: ['lead.transfer:manage'],
    href: '/manager/capacity',
  },
  {
    key: 'manager.targets',
    label: 'Targets',
    description: 'Target distribution to team leads',
    icon: Target,
    requiredVerticals: ['wealth'],
    requiredActions: ['target.allocate:manage'],
    href: '/manager/targets',
  },
  {
    key: 'manager.forecasts',
    label: 'Pipeline & forecast',
    description: 'Challenge TL forecasts and submit to RM',
    icon: BarChart3,
    requiredVerticals: ['wealth'],
    requiredActions: ['forecast.review:manage'],
    href: '/manager/forecasts',
  },
  {
    key: 'manager.exceptions',
    label: 'Exceptions',
    description: 'SLA breach recovery and commercial exceptions',
    icon: ShieldCheck,
    requiredVerticals: ['wealth'],
    requiredActions: ['exception.resolve:manage'],
    href: '/manager/exceptions',
  },
  {
    key: 'manager.reviews',
    label: 'Reviews',
    description: 'Team lead performance reviews',
    icon: GraduationCap,
    requiredVerticals: ['wealth'],
    requiredActions: ['review.manage:tl'],
    href: '/manager/reviews',
  },
  {
    key: 'manager.reports',
    label: 'Reports & pack',
    description: 'Manager meeting pack and schedules',
    icon: FileText,
    requiredVerticals: ['wealth'],
    requiredActions: ['report.export:manager'],
    href: '/manager/reports',
  },
  {
    key: 'regional.overview',
    label: 'Region overview',
    description: 'Investigate regional gaps and manager contribution',
    icon: LayoutDashboard,
    requiredVerticals: ['wealth'],
    requiredActions: ['report.read:regional'],
    href: '/regional/overview',
  },
  {
    key: 'regional.managers',
    label: 'Managers & reviews',
    description: 'Review manager scorecards and performance',
    icon: Users,
    requiredVerticals: ['wealth'],
    requiredActions: ['report.read:regional'],
    href: '/regional/managers',
  },
  {
    key: 'regional.territories',
    label: 'Territories',
    description: 'Territory coverage, queue routing and capacity gaps',
    icon: Compass,
    requiredVerticals: ['wealth'],
    requiredActions: ['territory.coverage:manage'],
    href: '/regional/territories',
  },
  {
    key: 'regional.targets',
    label: 'Regional targets',
    description: 'Allocate parent regional targets across managers',
    icon: Target,
    requiredVerticals: ['wealth'],
    requiredActions: ['target.allocate:regional'],
    href: '/regional/targets',
  },
  {
    key: 'regional.approvals',
    label: 'Capacity & staffing',
    description: 'Cross-manager transfers and staffing approvals',
    icon: ArrowLeftRight,
    requiredVerticals: ['wealth'],
    requiredActions: ['transfer.approve:regional'],
    href: '/regional/approvals',
  },
  {
    key: 'regional.forecasts',
    label: 'Forecast & risks',
    description: 'Regional forecast rollup and risk escalation queue',
    icon: BarChart3,
    requiredVerticals: ['wealth'],
    requiredActions: ['forecast.submit:regional'],
    href: '/regional/forecasts',
  },
  {
    key: 'regional.reports',
    label: 'Reports & pack',
    description: 'Produce regional review pack and export schedules',
    icon: FileText,
    requiredVerticals: ['wealth'],
    requiredActions: ['report.export:regional'],
    href: '/regional/reports',
  },
  {
    key: 'national.overview',
    label: 'National overview',
    description: 'Investigate vertical performance, CEO targets and critical risks',
    icon: LayoutDashboard,
    requiredVerticals: ['wealth'],
    requiredActions: ['report.read:national'],
    href: '/national/overview',
  },
  {
    key: 'national.regions',
    label: 'Regions & scorecards',
    description: 'Compare regional metrics, attainment pace and RM performance',
    icon: Users,
    requiredVerticals: ['wealth'],
    requiredActions: ['report.read:national'],
    href: '/national/regions',
  },
  {
    key: 'national.plan',
    label: 'Vertical plan',
    description: 'Allocate CEO vertical targets across regional divisions',
    icon: Target,
    requiredVerticals: ['wealth'],
    requiredActions: ['target.allocate:national'],
    href: '/national/plan',
  },
  {
    key: 'national.economics',
    label: 'Economics & capacity',
    description: 'Analyze AUM velocity, blended CAC and unit capacity gaps',
    icon: Gauge,
    requiredVerticals: ['wealth'],
    requiredActions: ['economics.read:national'],
    href: '/national/economics',
  },
  {
    key: 'national.rules',
    label: 'Product rules',
    description: 'Propose pipeline SLAs and qualification gate rules',
    icon: ShieldCheck,
    requiredVerticals: ['wealth'],
    requiredActions: ['product.rule:propose'],
    href: '/national/rules',
  },
  {
    key: 'national.forecast',
    label: 'National forecast',
    description: 'Consolidated bottom-up forecast with macro adjustments for CEO/CFO',
    icon: BarChart3,
    requiredVerticals: ['wealth'],
    requiredActions: ['forecast.submit:national'],
    href: '/national/forecast',
  },
  {
    key: 'national.transfers',
    label: 'Region transfers',
    description: 'Cross-region work rebalancing and prospect transfers',
    icon: ArrowLeftRight,
    requiredVerticals: ['wealth'],
    requiredActions: ['transfer.manage:cross_region'],
    href: '/national/transfers',
  },
  {
    key: 'national.referrals',
    label: 'Inbound referrals',
    description: 'Review and accept cross-vertical prospect referrals (Banking/Real Estate)',
    icon: Inbox,
    requiredVerticals: ['wealth'],
    requiredActions: ['referral.manage:cross_vertical'],
    href: '/national/referrals',
  },
  {
    key: 'national.escalations',
    label: 'Executive escalations',
    description: 'Dual executive routing for strategic exceptions and pricing policies',
    icon: Megaphone,
    requiredVerticals: ['wealth'],
    requiredActions: ['escalation.create:national'],
    href: '/national/escalations',
  },
  {
    key: 'national.reviews',
    label: 'RM reviews',
    description: 'Periodic Regional Manager evaluations and growth commitments',
    icon: GraduationCap,
    requiredVerticals: ['wealth'],
    requiredActions: ['review.manage:rm'],
    href: '/national/reviews',
  },
  {
    key: 'national.reports',
    label: 'Executive packs',
    description: 'National executive pack export and automated schedule delivery',
    icon: FileText,
    requiredVerticals: ['wealth'],
    requiredActions: ['report.export:national'],
    href: '/national/reports',
  },
  {
    key: 'ceo.overview',
    label: 'Operating picture',
    description: 'Firm-wide cross-vertical revenue, win pace, and finance status',
    icon: LayoutDashboard,
    requiredVerticals: [],
    requiredActions: ['report.read:executive'],
    href: '/ceo/overview',
  },
  {
    key: 'ceo.verticals',
    label: 'Vertical comparisons',
    description: 'Compare Wealth, Banking, Markets, and Real Estate run-rates and margins',
    icon: Users,
    requiredVerticals: [],
    requiredActions: ['report.read:executive'],
    href: '/ceo/verticals',
  },
  {
    key: 'ceo.nms',
    label: 'National leadership',
    description: 'Inspect National Manager contributions and conduct leadership reviews',
    icon: GraduationCap,
    requiredVerticals: [],
    requiredActions: ['nm.review:executive'],
    href: '/ceo/nms',
  },
  {
    key: 'ceo.targets',
    label: 'Company targets',
    description: 'Approve enterprise and vertical targets with strategic buffer reconciliation',
    icon: Target,
    requiredVerticals: [],
    requiredActions: ['target.approve:company'],
    href: '/ceo/targets',
  },
  {
    key: 'ceo.forecast',
    label: 'Company forecast',
    description: 'Sign off consolidated company revenue forecast for board presentation',
    icon: BarChart3,
    requiredVerticals: [],
    requiredActions: ['forecast.signoff:company'],
    href: '/ceo/forecast',
  },
  {
    key: 'ceo.growth',
    label: 'Growth initiatives',
    description: 'Approve capital allocation and capacity expansions across verticals',
    icon: Compass,
    requiredVerticals: [],
    requiredActions: ['growth.initiative:manage'],
    href: '/ceo/growth',
  },
  {
    key: 'ceo.conflicts',
    label: 'Cross-vertical conflicts',
    description: 'Arbitrate priority conflicts and fee splitting between divisions',
    icon: ArrowLeftRight,
    requiredVerticals: [],
    requiredActions: ['conflict.arbitrate:cross_vertical'],
    href: '/ceo/conflicts',
  },
  {
    key: 'ceo.risks',
    label: 'Operating risks',
    description: 'Review critical complaints, regulatory audits, and operating exposures',
    icon: ShieldCheck,
    requiredVerticals: [],
    requiredActions: ['operating.risk:manage'],
    href: '/ceo/risks',
  },
  {
    key: 'ceo.board',
    label: 'Board packs',
    description: 'Produce high-fidelity board packs with binary PDF exports and schedules',
    icon: FileText,
    requiredVerticals: [],
    requiredActions: ['board.pack:manage'],
    href: '/ceo/board',
  },
  {
    key: 'ceo.commitments',
    label: 'Executive commitments',
    description: 'Track and follow through on executive directives and board actions',
    icon: Inbox,
    requiredVerticals: [],
    requiredActions: ['commitment.manage:executive'],
    href: '/ceo/commitments',
  },
  {
    key: 'cfo.overview',
    label: 'Finance overview',
    description: 'Revenue, cash run-rate, receivables and sales reconciliation',
    icon: LayoutDashboard,
    requiredVerticals: [],
    requiredActions: ['finance.overview:read'],
    href: '/cfo/overview',
  },
  {
    key: 'cfo.recognition',
    label: 'Revenue recognition',
    description: 'Sales-to-finance handoffs, revenue entries and credit notes',
    icon: ShieldCheck,
    requiredVerticals: [],
    requiredActions: ['revenue.recognition:manage'],
    href: '/cfo/recognition',
  },
  {
    key: 'cfo.invoices',
    label: 'Invoices & AR',
    description: 'Receivable invoices, ageing buckets and collection assignments',
    icon: FileText,
    requiredVerticals: [],
    requiredActions: ['invoice.manage:receivable'],
    href: '/cfo/invoices',
  },
  {
    key: 'cfo.payments',
    label: 'Receipts & matching',
    description: 'Bank receipt settlement, invoice matching and refund approvals',
    icon: ArrowLeftRight,
    requiredVerticals: [],
    requiredActions: ['receipt.match:manage'],
    href: '/cfo/payments',
  },
  {
    key: 'cfo.incentives',
    label: 'Incentives & disputes',
    description: 'Sales commission calculations, clawback reserves and dispute resolution',
    icon: Target,
    requiredVerticals: [],
    requiredActions: ['incentive.review:manage'],
    href: '/cfo/incentives',
  },
  {
    key: 'cfo.planning',
    label: 'Budgets & forecast',
    description: 'Vertical budget lines, variance tracking and forecast concurrence',
    icon: BarChart3,
    requiredVerticals: [],
    requiredActions: ['budget.review:manage'],
    href: '/cfo/planning',
  },
  {
    key: 'cfo.close',
    label: 'Period close',
    description: 'Pre-close checklists, certification lock and reopening requests',
    icon: ShieldCheck,
    requiredVerticals: [],
    requiredActions: ['period.close:manage'],
    href: '/cfo/close',
  },
  {
    key: 'cfo.reports',
    label: 'Certified packs',
    description: 'Binary PDF finance pack generation and distribution schedules',
    icon: FileText,
    requiredVerticals: [],
    requiredActions: ['finance.pack:export'],
    href: '/cfo/reports',
  },
  {
    key: 'cfo.policies',
    label: 'DoA & policies',
    description: 'Delegation of authority matrix and financial policy proposals',
    icon: Compass,
    requiredVerticals: [],
    requiredActions: ['policy.propose:finance'],
    href: '/cfo/policies',
  },
  {
    key: 'banking.dashboard',
    label: 'Banking Dashboard',
    description: 'Banking portfolio overview',
    icon: LayoutDashboard,
    requiredVerticals: ['banking'],
    requiredActions: ['report.read:personal'],
    href: '/banking/dashboard',
  },
  {
    key: 'banking.clients',
    label: 'Clients',
    description: 'Banking client relationships',
    icon: Inbox,
    requiredVerticals: ['banking'],
    requiredActions: ['prospect.read'],
    href: '/banking/clients',
  },
  {
    key: 'banking.facilities',
    label: 'Facilities',
    description: 'Credit facilities and loans',
    icon: Handshake,
    requiredVerticals: ['banking'],
    requiredActions: ['deal.read'],
    href: '/banking/facilities',
  },
];

function hasAction(session: WorkspaceSession, actions: string[]): boolean {
  return actions.some(
    (a) => session.allowedActions.includes('*') || session.allowedActions.includes(a)
  );
}

export function canAccessModule(session: WorkspaceSession, module: Module): boolean {
  const hasVertical =
    module.requiredVerticals.length === 0 ||
    module.requiredVerticals.some((v) => session.verticalGrants.includes(v as never));
  return hasVertical && hasAction(session, module.requiredActions);
}

export function getAccessibleModuleGroups(session: WorkspaceSession): ModuleGroup[] {
  const groups: ModuleGroup[] = [
    { key: 'cfo', label: 'Chief Financial Officer', modules: ALL_MODULES.filter((m) => m.key.startsWith('cfo.')) },
    { key: 'ceo', label: 'Chief Executive Officer', modules: ALL_MODULES.filter((m) => m.key.startsWith('ceo.')) },
    { key: 'national', label: 'National Manager', modules: ALL_MODULES.filter((m) => m.key.startsWith('national.')) },
    { key: 'regional', label: 'Regional Manager', modules: ALL_MODULES.filter((m) => m.key.startsWith('regional.')) },
    { key: 'manager', label: 'Wealth Manager', modules: ALL_MODULES.filter((m) => m.key.startsWith('manager.')) },
    { key: 'management', label: 'Team lead', modules: ALL_MODULES.filter((m) => m.key.startsWith('management.')) },
    { key: 'wealth', label: 'Wealth', modules: ALL_MODULES.filter((m) => m.key.startsWith('wealth.')) },
    { key: 'banking', label: 'Banking', modules: ALL_MODULES.filter((m) => m.key.startsWith('banking.')) },
  ];
  return groups
    .map((g) => {
      // Role scoping: CFO in finance workspace; CEO in executive workspace; NM in national; RM in regional; MG in manager; TL in management; SC in caller operational
      if (session.role === 'CFO' && g.key !== 'cfo') {
        return { ...g, modules: [] };
      }
      if (session.role !== 'CFO' && g.key === 'cfo') {
        return { ...g, modules: [] };
      }
      if (session.role === 'CEO' && g.key !== 'ceo') {
        return { ...g, modules: [] };
      }
      if (session.role !== 'CEO' && g.key === 'ceo') {
        return { ...g, modules: [] };
      }
      if (session.role === 'NM' && g.key !== 'national') {
        return { ...g, modules: [] };
      }
      if (session.role !== 'NM' && g.key === 'national') {
        return { ...g, modules: [] };
      }
      if (session.role === 'RM' && g.key !== 'regional') {
        return { ...g, modules: [] };
      }
      if (session.role !== 'RM' && g.key === 'regional') {
        return { ...g, modules: [] };
      }
      if (session.role === 'MG' && g.key !== 'manager') {
        return { ...g, modules: [] };
      }
      if (session.role === 'TL' && g.key !== 'management') {
        return { ...g, modules: [] };
      }
      if (session.role === 'SC' && (g.key === 'management' || g.key === 'manager' || g.key === 'regional' || g.key === 'national' || g.key === 'ceo' || g.key === 'cfo')) {
        return { ...g, modules: [] };
      }
      return { ...g, modules: g.modules.filter((m) => canAccessModule(session, m)) };
    })
    .filter((g) => g.modules.length > 0);
}

export function findModuleByPath(
  session: WorkspaceSession,
  pathname: string
): Module | undefined {
  return ALL_MODULES.filter((m) => canAccessModule(session, m)).find(
    (m) => pathname === m.href || pathname.startsWith(`${m.href}/`)
  );
}

export function landingPath(session: WorkspaceSession): string {
  if (session.role === 'CFO') return '/cfo/overview';
  if (session.role === 'CEO') return '/ceo/overview';
  if (session.role === 'NM') return '/national/overview';
  if (session.role === 'RM') return '/regional/overview';
  if (session.role === 'MG') return '/manager/overview';
  if (session.role === 'TL') return '/management/team';
  if (session.verticalGrants.includes('wealth')) return '/wealth/dashboard';
  if (session.verticalGrants.includes('banking')) return '/banking/dashboard';
  return '/wealth/dashboard';
}
