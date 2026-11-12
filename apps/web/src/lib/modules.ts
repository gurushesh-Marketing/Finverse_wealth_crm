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
  FilePlus2,
  DollarSign,
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
    key: 'banking.dashboard',
    label: 'My day',
    description: 'Personal pipeline and activity overview',
    icon: LayoutDashboard,
    requiredVerticals: ['banking'],
    requiredActions: ['report.read:personal'],
    href: '/banking/dashboard',
  },
  {
    key: 'banking.prospects',
    label: 'Credit Inbox',
    description: 'Filter, search and save commercial borrower views',
    icon: Inbox,
    requiredVerticals: ['banking'],
    requiredActions: ['prospect.read'],
    href: '/banking/prospects',
  },
  {
    key: 'banking.activities',
    label: 'Conversations',
    description: 'Borrower calls, messages and activities',
    icon: MessageSquare,
    requiredVerticals: ['banking'],
    requiredActions: ['activity.read'],
    href: '/banking/activities',
  },
  {
    key: 'banking.tasks',
    label: 'Calendar & tasks',
    description: 'Schedule credit follow-ups and covenant checks',
    icon: CalendarDays,
    requiredVerticals: ['banking'],
    requiredActions: ['task.manage'],
    href: '/banking/tasks',
  },
  {
    key: 'banking.deals',
    label: 'Facility pipeline',
    description: 'Track commercial lending pipeline',
    icon: Handshake,
    requiredVerticals: ['banking'],
    requiredActions: ['deal.read'],
    href: '/banking/deals',
  },
  {
    key: 'banking.documents',
    label: 'Documents',
    description: 'Request financial statements & sanction evidence',
    icon: FileText,
    requiredVerticals: ['banking'],
    requiredActions: ['document.request'],
    href: '/banking/documents',
  },
  {
    key: 'banking.reports',
    label: 'Performance',
    description: 'Personal commercial lending performance',
    icon: BarChart3,
    requiredVerticals: ['banking'],
    requiredActions: ['report.read:personal'],
    href: '/banking/reports',
  },
  {
    key: 'banking.reviews',
    label: 'Reviews & help',
    description: 'Credit committee reviews and corrections',
    icon: LifeBuoy,
    requiredVerticals: ['banking'],
    requiredActions: ['review.acknowledge'],
    href: '/banking/reviews',
  },
  {
    key: 'markets.dashboard',
    label: 'My day',
    description: 'Trading activity and onboarding overview',
    icon: LayoutDashboard,
    requiredVerticals: ['markets'],
    requiredActions: ['report.read:personal'],
    href: '/markets/dashboard',
  },
  {
    key: 'markets.prospects',
    label: 'Trading Desk Inbox',
    description: 'Filter, search and save trading client views',
    icon: Inbox,
    requiredVerticals: ['markets'],
    requiredActions: ['prospect.read'],
    href: '/markets/prospects',
  },
  {
    key: 'markets.activities',
    label: 'Conversations',
    description: 'Client calls, messages and activities',
    icon: MessageSquare,
    requiredVerticals: ['markets'],
    requiredActions: ['activity.read'],
    href: '/markets/activities',
  },
  {
    key: 'markets.tasks',
    label: 'Calendar & tasks',
    description: 'Schedule KYC follow-ups and trading setup checks',
    icon: CalendarDays,
    requiredVerticals: ['markets'],
    requiredActions: ['task.manage'],
    href: '/markets/tasks',
  },
  {
    key: 'markets.deals',
    label: 'Trading pipeline',
    description: 'Track demat and broking pipeline',
    icon: Handshake,
    requiredVerticals: ['markets'],
    requiredActions: ['deal.read'],
    href: '/markets/deals',
  },
  {
    key: 'markets.documents',
    label: 'Documents',
    description: 'Request SEBI identity, CKYC & depository documents',
    icon: FileText,
    requiredVerticals: ['markets'],
    requiredActions: ['document.request'],
    href: '/markets/documents',
  },
  {
    key: 'markets.reports',
    label: 'Performance',
    description: 'Personal trading and account activation metrics',
    icon: BarChart3,
    requiredVerticals: ['markets'],
    requiredActions: ['report.read:personal'],
    href: '/markets/reports',
  },
  {
    key: 'markets.reviews',
    label: 'Reviews & help',
    description: 'Trading supervisory reviews and coaching',
    icon: LifeBuoy,
    requiredVerticals: ['markets'],
    requiredActions: ['review.acknowledge'],
    href: '/markets/reviews',
  },
  {
    key: 'realestate.dashboard',
    label: 'My day',
    description: 'Property mandate activity and client overview',
    icon: LayoutDashboard,
    requiredVerticals: ['real_estate', 'real-estate'],
    requiredActions: ['report.read:personal'],
    href: '/real-estate/dashboard',
  },
  {
    key: 'realestate.prospects',
    label: 'Property Advisory Inbox',
    description: 'Filter, search and save real estate buyer views',
    icon: Inbox,
    requiredVerticals: ['real_estate', 'real-estate'],
    requiredActions: ['prospect.read'],
    href: '/real-estate/prospects',
  },
  {
    key: 'realestate.activities',
    label: 'Conversations',
    description: 'Client calls, site visits and property discussions',
    icon: MessageSquare,
    requiredVerticals: ['real_estate', 'real-estate'],
    requiredActions: ['activity.read'],
    href: '/real-estate/activities',
  },
  {
    key: 'realestate.tasks',
    label: 'Calendar & tasks',
    description: 'Schedule site visits and document verifications',
    icon: CalendarDays,
    requiredVerticals: ['real_estate', 'real-estate'],
    requiredActions: ['task.manage'],
    href: '/real-estate/tasks',
  },
  {
    key: 'realestate.deals',
    label: 'Mandate pipeline',
    description: 'Track real estate booking and registration pipeline',
    icon: Handshake,
    requiredVerticals: ['real_estate', 'real-estate'],
    requiredActions: ['deal.read'],
    href: '/real-estate/deals',
  },
  {
    key: 'realestate.documents',
    label: 'Documents',
    description: 'Request RERA, title deed & sale agreement documents',
    icon: FileText,
    requiredVerticals: ['real_estate', 'real-estate'],
    requiredActions: ['document.request'],
    href: '/real-estate/documents',
  },
  {
    key: 'realestate.reports',
    label: 'Performance',
    description: 'Personal mandate closing and brokerage metrics',
    icon: BarChart3,
    requiredVerticals: ['real_estate', 'real-estate'],
    requiredActions: ['report.read:personal'],
    href: '/real-estate/reports',
  },
  {
    key: 'realestate.reviews',
    label: 'Reviews & help',
    description: 'Real estate advisory reviews and legal clearance coaching',
    icon: LifeBuoy,
    requiredVerticals: ['real_estate', 'real-estate'],
    requiredActions: ['review.acknowledge'],
    href: '/real-estate/reviews',
  },
  {
    key: 'rel.portfolio',
    label: 'Portfolio',
    description: 'Active qualified prospects, stages & loan facilities',
    icon: LayoutDashboard,
    requiredVerticals: ['wealth', 'banking', 'markets', 'real-estate', 'real_estate'],
    requiredActions: ['deal.read'],
    href: '/rel/portfolio',
  },
  {
    key: 'rel.handoffs',
    label: 'Handoff queue',
    description: 'Inbound qualified prospects from sales callers',
    icon: ArrowLeftRight,
    requiredVerticals: ['wealth', 'banking', 'markets', 'real-estate', 'real_estate'],
    requiredActions: ['handoff.decide', 'deal.read'],
    href: '/rel/handoffs',
  },
  {
    key: 'rel.institutions',
    label: 'Partner institutions',
    description: 'Bank partner proposals, term sheets & sanctions',
    icon: Handshake,
    requiredVerticals: ['wealth', 'banking', 'markets', 'real-estate', 'real_estate'],
    requiredActions: ['partner.coordinate', 'deal.read'],
    href: '/rel/institutions',
  },
  {
    key: 'rel.reports',
    label: 'Review pack',
    description: 'Portfolio review pack & verified outcome summary',
    icon: BarChart3,
    requiredVerticals: ['wealth', 'banking', 'markets', 'real-estate', 'real_estate'],
    requiredActions: ['report.read:personal'],
    href: '/rel/reports',
  },
  {
    key: 'management.overview',
    label: 'Team overview',
    description: 'Team health, KPI drill, corrective tasks',
    icon: Users,
    requiredVerticals: ['wealth', 'banking', 'markets', 'real-estate'],
    requiredActions: ['report.read:team'],
    href: '/management/team',
  },
  {
    key: 'management.allocation',
    label: 'Lead allocation',
    description: 'Unassigned queue and batch distribution',
    icon: ArrowLeftRight,
    requiredVerticals: ['wealth', 'banking', 'markets', 'real-estate'],
    requiredActions: ['task.assign'],
    href: '/management/allocation',
  },
  {
    key: 'management.workload',
    label: 'Team workload',
    description: 'Rebalancing and overdue recovery',
    icon: Gauge,
    requiredVerticals: ['wealth', 'banking', 'markets', 'real-estate'],
    requiredActions: ['task.assign'],
    href: '/management/workload',
  },
  {
    key: 'management.quality',
    label: 'Quality & approvals',
    description: 'Conversions, reopens, quality, corrections',
    icon: ShieldCheck,
    requiredVerticals: ['wealth', 'banking', 'markets', 'real-estate'],
    requiredActions: ['report.read:team'],
    href: '/management/quality',
  },
  {
    key: 'management.targets',
    label: 'Targets & forecast',
    description: 'Target distribution and team forecasts',
    icon: Target,
    requiredVerticals: ['wealth', 'banking', 'markets', 'real-estate'],
    requiredActions: ['report.read:team'],
    href: '/management/targets',
  },
  {
    key: 'management.coaching',
    label: 'Coaching',
    description: 'Associate reviews, one-to-ones, mentoring',
    icon: GraduationCap,
    requiredVerticals: ['wealth', 'banking', 'markets', 'real-estate'],
    requiredActions: ['report.read:team'],
    href: '/management/coaching',
  },
  {
    key: 'management.requests',
    label: 'Requests & help',
    description: 'Staffing requests and escalations',
    icon: Megaphone,
    requiredVerticals: ['wealth', 'banking', 'markets', 'real-estate'],
    requiredActions: ['report.read:team'],
    href: '/management/requests',
  },
  {
    key: 'management.reports',
    label: 'Team reports',
    description: 'Review packs and recurring schedules',
    icon: BarChart3,
    requiredVerticals: ['wealth', 'banking', 'markets', 'real-estate'],
    requiredActions: ['report.read:team'],
    href: '/management/reports',
  },
  {
    key: 'manager.overview',
    label: 'Manager overview',
    description: 'Performance across team leaders and pace',
    icon: LayoutDashboard,
    requiredVerticals: ['wealth', 'banking', 'markets', 'real-estate'],
    requiredActions: ['report.read:manager'],
    href: '/manager/overview',
  },
  {
    key: 'manager.leaders',
    label: 'Team leaders',
    description: 'Operating scorecards, source quality, actions',
    icon: Users,
    requiredVerticals: ['wealth', 'banking', 'markets', 'real-estate'],
    requiredActions: ['report.read:manager'],
    href: '/manager/leaders',
  },
  {
    key: 'manager.capacity',
    label: 'Capacity & transfers',
    description: 'Lead transfers, recovery plan, staff moves',
    icon: ArrowLeftRight,
    requiredVerticals: ['wealth', 'banking', 'markets', 'real-estate'],
    requiredActions: ['lead.transfer:manage'],
    href: '/manager/capacity',
  },
  {
    key: 'manager.targets',
    label: 'Targets',
    description: 'Target distribution to team leads',
    icon: Target,
    requiredVerticals: ['wealth', 'banking', 'markets', 'real-estate'],
    requiredActions: ['target.allocate:manage'],
    href: '/manager/targets',
  },
  {
    key: 'manager.forecasts',
    label: 'Pipeline & forecast',
    description: 'Challenge TL forecasts and submit to RM',
    icon: BarChart3,
    requiredVerticals: ['wealth', 'banking', 'markets', 'real-estate'],
    requiredActions: ['forecast.review:manage'],
    href: '/manager/forecasts',
  },
  {
    key: 'manager.exceptions',
    label: 'Exceptions',
    description: 'SLA breach recovery and commercial exceptions',
    icon: ShieldCheck,
    requiredVerticals: ['wealth', 'banking', 'markets', 'real-estate'],
    requiredActions: ['exception.resolve:manage'],
    href: '/manager/exceptions',
  },
  {
    key: 'manager.reviews',
    label: 'Reviews',
    description: 'Team lead performance reviews',
    icon: GraduationCap,
    requiredVerticals: ['wealth', 'banking', 'markets', 'real-estate'],
    requiredActions: ['review.manage:tl'],
    href: '/manager/reviews',
  },
  {
    key: 'manager.reports',
    label: 'Reports & pack',
    description: 'Manager meeting pack and schedules',
    icon: FileText,
    requiredVerticals: ['wealth', 'banking', 'markets', 'real-estate'],
    requiredActions: ['report.export:manager'],
    href: '/manager/reports',
  },
  {
    key: 'regional.overview',
    label: 'Region overview',
    description: 'Investigate regional gaps and manager contribution',
    icon: LayoutDashboard,
    requiredVerticals: ['wealth', 'banking', 'markets', 'real-estate'],
    requiredActions: ['report.read:regional'],
    href: '/regional/overview',
  },
  {
    key: 'regional.managers',
    label: 'Managers & reviews',
    description: 'Review manager scorecards and performance',
    icon: Users,
    requiredVerticals: ['wealth', 'banking', 'markets', 'real-estate'],
    requiredActions: ['report.read:regional'],
    href: '/regional/managers',
  },
  {
    key: 'regional.territories',
    label: 'Territories',
    description: 'Territory coverage, queue routing and capacity gaps',
    icon: Compass,
    requiredVerticals: ['wealth', 'banking', 'markets', 'real-estate'],
    requiredActions: ['territory.coverage:manage'],
    href: '/regional/territories',
  },
  {
    key: 'regional.targets',
    label: 'Regional targets',
    description: 'Allocate parent regional targets across managers',
    icon: Target,
    requiredVerticals: ['wealth', 'banking', 'markets', 'real-estate'],
    requiredActions: ['target.allocate:regional'],
    href: '/regional/targets',
  },
  {
    key: 'regional.approvals',
    label: 'Capacity & staffing',
    description: 'Cross-manager transfers and staffing approvals',
    icon: ArrowLeftRight,
    requiredVerticals: ['wealth', 'banking', 'markets', 'real-estate'],
    requiredActions: ['transfer.approve:regional'],
    href: '/regional/approvals',
  },
  {
    key: 'regional.forecasts',
    label: 'Forecast & risks',
    description: 'Regional forecast rollup and risk escalation queue',
    icon: BarChart3,
    requiredVerticals: ['wealth', 'banking', 'markets', 'real-estate'],
    requiredActions: ['forecast.submit:regional'],
    href: '/regional/forecasts',
  },
  {
    key: 'regional.reviews',
    label: 'Reviews',
    description: 'Run Manager reviews, coaching commitments and governance · RM-09',
    icon: GraduationCap,
    requiredVerticals: ['wealth', 'banking', 'markets', 'real-estate'],
    requiredActions: ['review.manage:manager'],
    href: '/regional/reviews',
  },
  {
    key: 'regional.reports',
    label: 'Reports & help',
    description: 'Produce regional review pack and export schedules · RM-10',
    icon: FileText,
    requiredVerticals: ['wealth', 'banking', 'markets', 'real-estate'],
    requiredActions: ['report.export:regional'],
    href: '/regional/reports',
  },
  {
    key: 'national.overview',
    label: 'National overview',
    description: 'Investigate vertical performance, CEO targets and critical risks',
    icon: LayoutDashboard,
    requiredVerticals: ['wealth', 'banking', 'markets', 'real-estate'],
    requiredActions: ['report.read:national'],
    href: '/national/overview',
  },
  {
    key: 'national.regions',
    label: 'Regions & scorecards',
    description: 'Compare regional metrics, attainment pace and RM performance',
    icon: Users,
    requiredVerticals: ['wealth', 'banking', 'markets', 'real-estate'],
    requiredActions: ['report.read:national'],
    href: '/national/regions',
  },
  {
    key: 'national.plan',
    label: 'Vertical plan',
    description: 'Allocate CEO vertical targets across regional divisions',
    icon: Target,
    requiredVerticals: ['wealth', 'banking', 'markets', 'real-estate'],
    requiredActions: ['target.allocate:national'],
    href: '/national/plan',
  },
  {
    key: 'national.economics',
    label: 'Economics & capacity',
    description: 'Analyze AUM velocity, blended CAC and unit capacity gaps',
    icon: Gauge,
    requiredVerticals: ['wealth', 'banking', 'markets', 'real-estate'],
    requiredActions: ['economics.read:national'],
    href: '/national/economics',
  },
  {
    key: 'national.rules',
    label: 'Product rules',
    description: 'Propose pipeline SLAs and qualification gate rules',
    icon: ShieldCheck,
    requiredVerticals: ['wealth', 'banking', 'markets', 'real-estate'],
    requiredActions: ['product.rule:propose'],
    href: '/national/rules',
  },
  {
    key: 'national.forecast',
    label: 'National forecast',
    description: 'Consolidated bottom-up forecast with macro adjustments for CEO/CFO',
    icon: BarChart3,
    requiredVerticals: ['wealth', 'banking', 'markets', 'real-estate'],
    requiredActions: ['forecast.submit:national'],
    href: '/national/forecast',
  },
  {
    key: 'national.transfers',
    label: 'Region transfers',
    description: 'Cross-region work rebalancing and prospect transfers',
    icon: ArrowLeftRight,
    requiredVerticals: ['wealth', 'banking', 'markets', 'real-estate'],
    requiredActions: ['transfer.manage:cross_region'],
    href: '/national/transfers',
  },
  {
    key: 'national.referrals',
    label: 'Inbound referrals',
    description: 'Review and accept cross-vertical prospect referrals (Banking/Real Estate)',
    icon: Inbox,
    requiredVerticals: ['wealth', 'banking', 'markets', 'real-estate'],
    requiredActions: ['referral.manage:cross_vertical'],
    href: '/national/referrals',
  },
  {
    key: 'national.escalations',
    label: 'Executive escalations',
    description: 'Dual executive routing for strategic exceptions and pricing policies',
    icon: Megaphone,
    requiredVerticals: ['wealth', 'banking', 'markets', 'real-estate'],
    requiredActions: ['escalation.create:national'],
    href: '/national/escalations',
  },
  {
    key: 'national.reviews',
    label: 'RM reviews',
    description: 'Periodic Regional Manager evaluations and growth commitments',
    icon: GraduationCap,
    requiredVerticals: ['wealth', 'banking', 'markets', 'real-estate'],
    requiredActions: ['review.manage:rm'],
    href: '/national/reviews',
  },
  {
    key: 'national.reports',
    label: 'Executive packs',
    description: 'National executive pack export and automated schedule delivery',
    icon: FileText,
    requiredVerticals: ['wealth', 'banking', 'markets', 'real-estate'],
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
    key: 'superadmin.overview',
    label: 'Access overview',
    description: 'System provisioning metrics and administrative health',
    icon: LayoutDashboard,
    requiredVerticals: [],
    requiredActions: ['superadmin.overview:read'],
    href: '/superadmin/overview',
  },
  {
    key: 'superadmin.employees',
    label: 'Employees & users',
    description: 'Account creation, expiring invitations and verified recovery',
    icon: Users,
    requiredVerticals: [],
    requiredActions: ['user.account:provision'],
    href: '/superadmin/employees',
  },
  {
    key: 'superadmin.scopes',
    label: 'Roles & scopes',
    description: 'Effective permission scopes, additional teams and delegations',
    icon: Compass,
    requiredVerticals: [],
    requiredActions: ['scope.grant:manage'],
    href: '/superadmin/scopes',
  },
  {
    key: 'superadmin.organisation',
    label: 'Organisation',
    description: 'Cycle-free reporting hierarchy and unit structure',
    icon: Target,
    requiredVerticals: [],
    requiredActions: ['organisation.hierarchy:manage'],
    href: '/superadmin/organisation',
  },
  {
    key: 'superadmin.lifecycle',
    label: 'Lifecycle changes',
    description: 'Transfers, promotions, offboarding and holding queues',
    icon: ArrowLeftRight,
    requiredVerticals: [],
    requiredActions: ['lifecycle.transition:activate'],
    href: '/superadmin/lifecycle',
  },
  {
    key: 'superadmin.configuration',
    label: 'Business configuration',
    description: 'Approved, versioned rules for SLAs, routing and stages',
    icon: FileText,
    requiredVerticals: [],
    requiredActions: ['business_config.publish:manage'],
    href: '/superadmin/configuration',
  },
  {
    key: 'superadmin.audit',
    label: 'Audit & incidents',
    description: 'Restricted immutable audit investigation and incident actions',
    icon: ShieldCheck,
    requiredVerticals: [],
    requiredActions: ['audit.investigate:manage'],
    href: '/superadmin/audit',
  },
  {
    key: 'superadmin.health',
    label: 'System health',
    description: 'Safe, bounded background job recovery and worker queues',
    icon: Gauge,
    requiredVerticals: [],
    requiredActions: ['job.recover:manage'],
    href: '/superadmin/health',
  },
  {
    key: 'superadmin.teams',
    label: 'Teams & Frontline',
    description: 'Dynamic team management, Relationship Manager supervision, and Sales Caller staffing',
    icon: Users,
    requiredVerticals: [],
    requiredActions: ['superadmin.overview:read'],
    href: '/superadmin/teams',
  },
  {
    key: 'hr.overview',
    label: 'People overview',
    description: 'Workforce operational picture, start-date risks and episode tracking',
    icon: LayoutDashboard,
    requiredVerticals: [],
    requiredActions: ['hr.overview:read'],
    href: '/hr/overview',
  },
  {
    key: 'hr.joiners',
    label: 'Joiners',
    description: 'Request a new employee account and approved placement (HR-01)',
    icon: Users,
    requiredVerticals: [],
    requiredActions: ['hr.employee:request'],
    href: '/hr/joiners',
  },
  {
    key: 'hr.movers',
    label: 'Movers & promotions',
    description: 'Effective-dated team transfers and promotions with retained history (HR-02, HR-03)',
    icon: ArrowLeftRight,
    requiredVerticals: [],
    requiredActions: ['hr.transfer:request', 'hr.promotion:request'],
    href: '/hr/movers',
  },
  {
    key: 'hr.leavers',
    label: 'Leavers',
    description: 'Coordinate employee exit, handoff checklist and scheduled revocation (HR-04)',
    icon: ShieldCheck,
    requiredVerticals: [],
    requiredActions: ['hr.exit:coordinate'],
    href: '/hr/leavers',
  },
  {
    key: 'hr.availability',
    label: 'Availability',
    description: 'Record leave and allocation availability flags for routing (HR-05)',
    icon: CalendarDays,
    requiredVerticals: [],
    requiredActions: ['hr.availability:manage'],
    href: '/hr/availability',
  },
  {
    key: 'hr.training',
    label: 'Training & reviews',
    description: 'Track probation, regulatory training and review milestones (HR-06)',
    icon: GraduationCap,
    requiredVerticals: [],
    requiredActions: ['hr.training_review:manage'],
    href: '/hr/training',
  },
  {
    key: 'hr.reports',
    label: 'People reports',
    description: 'Prepare and schedule protected people operations pack (HR-07)',
    icon: BarChart3,
    requiredVerticals: [],
    requiredActions: ['hr.report_pack:prepare'],
    href: '/hr/reports',
  },
  {
    key: 'hr.requests',
    label: 'My requests',
    description: 'Track lifecycle requests submitted to Super Admin provisioning queue',
    icon: Inbox,
    requiredVerticals: [],
    requiredActions: ['hr.request:read'],
    href: '/hr/requests',
  },
  {
    key: 'hr.payroll',
    label: 'Payroll preview',
    description: 'Effective-dated compensation records and non-overlapping 28th–27th payroll preview',
    icon: DollarSign,
    requiredVerticals: [],
    requiredActions: ['hr.overview:read'],
    href: '/hr/payroll',
  },
  // Data Entry: manual vertical-scoped record creation and database read-back.
  {
    key: 'dataentry.intake',
    label: 'Enter & verify',
    description: 'Save a prospect manually and verify the persisted record',
    icon: FilePlus2,
    requiredVerticals: [],
    requiredActions: ['intake.record:create'],
    href: '/data-entry/intake',
  },
];

function hasAction(session: WorkspaceSession, actions: string[]): boolean {
  return actions.some(
    (a) => session.allowedActions.includes('*') || session.allowedActions.includes(a)
  );
}

export function canAccessModule(session: WorkspaceSession, module: Module): boolean {
  const norm = (v: string) => (v === 'real-estate' ? 'real_estate' : v);
  const sessionVerts = session.verticalGrants.map(norm);
  const modVerts = module.requiredVerticals.map(norm);
  const hasVertical =
    modVerts.length === 0 ||
    modVerts.some((v) => sessionVerts.includes(v as never));
  return hasVertical && hasAction(session, module.requiredActions);
}

export function getAccessibleModuleGroups(session: WorkspaceSession): ModuleGroup[] {
  const isBanking = session.verticalGrants.includes('banking');
  const isMarkets = session.verticalGrants.includes('markets');
  const isRealEstate = session.verticalGrants.includes('real_estate') || session.verticalGrants.includes('real-estate');
  const groups: ModuleGroup[] = [
    { key: 'data-entry', label: 'Data Entry', modules: ALL_MODULES.filter((m) => m.key.startsWith('dataentry.')) },
    { key: 'hr', label: 'Human Resources', modules: ALL_MODULES.filter((m) => m.key.startsWith('hr.')) },
    { key: 'superadmin', label: 'Super Admin', modules: ALL_MODULES.filter((m) => m.key.startsWith('superadmin.')) },
    { key: 'cfo', label: 'Chief Financial Officer', modules: ALL_MODULES.filter((m) => m.key.startsWith('cfo.')) },
    { key: 'ceo', label: 'Chief Executive Officer', modules: ALL_MODULES.filter((m) => m.key.startsWith('ceo.')) },
    { key: 'national', label: isBanking ? 'Banking National Manager' : isMarkets ? 'Markets National Manager' : isRealEstate ? 'Real Estate National Manager' : 'National Manager', modules: ALL_MODULES.filter((m) => m.key.startsWith('national.')) },
    { key: 'regional', label: isBanking ? 'Banking Regional Manager' : isMarkets ? 'Markets Regional Manager' : isRealEstate ? 'Real Estate Regional Manager' : 'Regional Manager', modules: ALL_MODULES.filter((m) => m.key.startsWith('regional.')) },
    { key: 'manager', label: isBanking ? 'Banking Manager' : isMarkets ? 'Markets Manager' : isRealEstate ? 'Real Estate Manager' : 'Wealth Manager', modules: ALL_MODULES.filter((m) => m.key.startsWith('manager.')) },
    { key: 'rel', label: isBanking ? 'Banking Relationship Manager' : isMarkets ? 'Markets Relationship Manager' : isRealEstate ? 'Real Estate Relationship Manager' : 'Wealth Relationship Manager', modules: ALL_MODULES.filter((m) => m.key.startsWith('rel.')) },
    { key: 'wealth', label: 'Wealth', modules: ALL_MODULES.filter((m) => m.key.startsWith('wealth.')) },
    { key: 'banking', label: 'Commercial Banking', modules: ALL_MODULES.filter((m) => m.key.startsWith('banking.')) },
    { key: 'markets', label: 'Markets & Securities', modules: ALL_MODULES.filter((m) => m.key.startsWith('markets.')) },
    { key: 'real-estate', label: 'Real Estate Advisory', modules: ALL_MODULES.filter((m) => m.key.startsWith('realestate.')) },
  ];
  return groups
    .map((g) => {
      // Role scoping: DE in data-entry; HR in hr; SA in superadmin; CFO in finance; CEO in executive; NM in national; RM in regional; MG in manager; REL in rel; SC in caller operational
      if (session.role === 'DE' && g.key !== 'data-entry') {
        return { ...g, modules: [] };
      }
      if (session.role !== 'DE' && g.key === 'data-entry') {
        return { ...g, modules: [] };
      }
      if (session.role === 'HR' && g.key !== 'hr') {
        return { ...g, modules: [] };
      }
      if (session.role !== 'HR' && g.key === 'hr') {
        return { ...g, modules: [] };
      }
      if (session.role === 'SA' && g.key !== 'superadmin') {
        return { ...g, modules: [] };
      }
      if (session.role !== 'SA' && g.key === 'superadmin') {
        return { ...g, modules: [] };
      }
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
      if ((session.role === 'REL' || session.role === 'TL') && g.key !== 'rel') {
        return { ...g, modules: [] };
      }
      if (session.role !== 'REL' && session.role !== 'TL' && g.key === 'rel') {
        return { ...g, modules: [] };
      }
      if (session.role === 'SC' && (g.key === 'rel' || g.key === 'manager' || g.key === 'regional' || g.key === 'national' || g.key === 'ceo' || g.key === 'cfo' || g.key === 'superadmin' || g.key === 'hr' || g.key === 'data-entry')) {
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
  if (session.role === 'DE') return '/data-entry/intake';
  if (session.role === 'HR') return '/hr/overview';
  if (session.role === 'SA') return '/superadmin/overview';
  if (session.role === 'CFO') return '/cfo/overview';
  if (session.role === 'CEO') return '/ceo/overview';
  if (session.role === 'NM') return '/national/overview';
  if (session.role === 'RM') return '/regional/overview';
  if (session.role === 'MG') return '/manager/overview';
  if (session.role === 'REL' || session.role === 'TL') return '/rel/portfolio';
  if (session.verticalGrants.includes('banking')) return '/banking/dashboard';
  if (session.verticalGrants.includes('markets')) return '/markets/dashboard';
  if (session.verticalGrants.includes('real_estate') || session.verticalGrants.includes('real-estate')) return '/real-estate/dashboard';
  if (session.verticalGrants.includes('wealth')) return '/wealth/dashboard';
  return '/wealth/dashboard';
}
