'use client';

import { cn } from '@/lib/utils';
import { TrendingUp, Users, Target, Activity } from 'lucide-react';

interface DashboardData {
  prospectCounts: Record<string, number>;
  dealPipeline: Record<string, { count: number; totalAmount: number }>;
  activityCounts: Record<string, number>;
}

export function WealthDashboardContent({ data }: { data: DashboardData }) {
  const prospectTotal = Object.values(data.prospectCounts).reduce((a, b) => a + b, 0);
  const dealTotal = Object.values(data.dealPipeline).reduce((a, b) => a + b.count, 0);
  const dealAmount = Object.values(data.dealPipeline).reduce((a, b) => a + b.totalAmount, 0);
  const activityTotal = Object.values(data.activityCounts).reduce((a, b) => a + b, 0);

  // Pipeline conversion rate
  const wonDeals = data.dealPipeline['closed-won']?.count || 0;
  const lostDeals = data.dealPipeline['closed-lost']?.count || 0;
  const closedTotal = wonDeals + lostDeals;
  const winRate = closedTotal > 0 ? Math.round((wonDeals / closedTotal) * 100) : 0;

  const statCards = [
    {
      label: 'Total Prospects',
      value: prospectTotal.toLocaleString(),
      icon: Users,
      trend: '+12%',
      trendPositive: true,
      href: '/wealth/prospects',
    },
    {
      label: 'Active Deals',
      value: dealTotal.toLocaleString(),
      valueSecondary: formatCurrency(dealAmount),
      icon: Target,
      trend: `${winRate}% win rate`,
      trendPositive: winRate >= 50,
      href: '/wealth/deals',
    },
    {
      label: 'Activities This Month',
      value: activityTotal.toLocaleString(),
      icon: Activity,
      trend: '+8%',
      trendPositive: true,
      href: '/wealth/activities',
    },
    {
      label: 'Pipeline Value',
      value: formatCurrency(dealAmount),
      icon: TrendingUp,
      trend: 'Weighted: ' + formatCurrency(
        Object.entries(data.dealPipeline).reduce((sum, [stage, d]) => {
          const prob = getStageProbability(stage);
          return sum + (d.totalAmount * prob / 100);
        }, 0)
      ),
      trendPositive: true,
      href: '/wealth/reports',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, i) => (
          <StatCard key={i} {...stat} />
        ))}
      </div>

      {/* Pipeline Funnel & Activity Breakdown */}
      <div className="grid gap-4 lg:grid-cols-2">
        <PipelineFunnel pipeline={data.dealPipeline} />
        <ActivityBreakdown activities={data.activityCounts} />
      </div>

      {/* Prospect Status & Recent Activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ProspectStatusBreakdown counts={data.prospectCounts} />
        <RecentActivityPlaceholder />
      </div>

      {/* Illustrative data notice */}
      <div className="rounded-lg border border-muted bg-muted/30 p-4 text-sm text-muted-foreground">
        <p className="flex items-center gap-2">
          <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <strong>Illustrative data:</strong> Sample prospect names, amounts, and pipeline stages shown here are for demonstration only and do not represent real client data.
        </p>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  valueSecondary,
  icon: Icon,
  trend,
  trendPositive,
  href
}: {
  label: string;
  value: string;
  valueSecondary?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend: string;
  trendPositive: boolean;
  href: string;
}) {
  return (
    <a href={href} className="group block rounded-lg border border-border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-lg">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-heading font-bold text-foreground">{value}</p>
          {valueSecondary && (
            <p className="mt-0.5 text-sm text-muted-foreground">{valueSecondary}</p>
          )}
        </div>
        <div className={cn(
          'h-10 w-10 rounded-lg flex items-center justify-center shrink-0',
          'bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors'
        )}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
      <div className={cn('mt-3 flex items-center gap-1 text-sm', trendPositive ? 'text-green-600' : 'text-red-600')}>
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          {trendPositive ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          )}
        </svg>
        <span>{trend}</span>
      </div>
    </a>
  );
}

function PipelineFunnel({ pipeline }: { pipeline: DashboardData['dealPipeline'] }) {
  const stages = [
    { key: 'prospecting', label: 'Prospecting', color: 'oklch(0.55 0.02 240)' },
    { key: 'qualification', label: 'Qualification', color: 'oklch(0.28 0.12 255)' },
    { key: 'proposal', label: 'Proposal', color: 'oklch(0.72 0.18 85)' },
    { key: 'negotiation', label: 'Negotiation', color: 'oklch(0.65 0.2 320)' },
    { key: 'closed-won', label: 'Closed Won', color: 'oklch(0.45 0.15 160)' },
    { key: 'closed-lost', label: 'Closed Lost', color: 'oklch(0.58 0.22 25)' },
  ];

  const maxCount = Math.max(...stages.map(s => pipeline[s.key]?.count || 0), 1);

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h3 className="text-lg font-heading font-semibold text-foreground mb-4">Deal Pipeline</h3>
      <div className="space-y-3">
        {stages.map(({ key, label, color }) => {
          const stageData = pipeline[key] || { count: 0, totalAmount: 0 };
          const width = (stageData.count / maxCount) * 100;
          return (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">{label}</span>
                <span className="text-muted-foreground">
                  {stageData.count} • {formatCurrency(stageData.totalAmount)}
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${width}%`, backgroundColor: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActivityBreakdown({ activities }: { activities: DashboardData['activityCounts'] }) {
  const activityTypes = [
    { key: 'meeting', label: 'Meetings', icon: 'users', color: 'oklch(0.28 0.12 255)' },
    { key: 'call', label: 'Calls', icon: 'phone', color: 'oklch(0.72 0.18 85)' },
    { key: 'email', label: 'Emails', icon: 'mail', color: 'oklch(0.45 0.15 160)' },
    { key: 'note', label: 'Notes', icon: 'file-text', color: 'oklch(0.55 0.02 240)' },
    { key: 'task', label: 'Tasks', icon: 'check-square', color: 'oklch(0.65 0.2 320)' },
  ];

  const total = Object.values(activities).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h3 className="text-lg font-heading font-semibold text-foreground mb-4">Activity Breakdown</h3>
      <div className="space-y-3">
        {activityTypes.map(({ key, label, icon, color }) => {
          const count = activities[key] || 0;
          const percentage = Math.round((count / total) * 100);
          return (
            <div key={key} className="flex items-center gap-3">
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${color}15`, color }}
              >
                <i className={`h-4 w-4 lucide-${icon}`} aria-hidden="true" data-lucide={icon} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{label}</p>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${percentage}%`, backgroundColor: color }}
                  />
                </div>
              </div>
              <div className="text-right w-20 shrink-0">
                <p className="text-sm font-semibold text-foreground">{count}</p>
                <p className="text-xs text-muted-foreground">{percentage}%</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProspectStatusBreakdown({ counts }: { counts: DashboardData['prospectCounts'] }) {
  const statuses = [
    { key: 'new', label: 'New', color: 'oklch(0.55 0.02 240)' },
    { key: 'contacted', label: 'Contacted', color: 'oklch(0.28 0.12 255)' },
    { key: 'qualified', label: 'Qualified', color: 'oklch(0.72 0.18 85)' },
    { key: 'unqualified', label: 'Unqualified', color: 'oklch(0.58 0.22 25)' },
    { key: 'converted', label: 'Converted', color: 'oklch(0.45 0.15 160)' },
  ];

  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h3 className="text-lg font-heading font-semibold text-foreground mb-4">Prospect Status</h3>
      <div className="space-y-3">
        {statuses.map(({ key, label, color }) => {
          const count = counts[key] || 0;
          const percentage = Math.round((count / total) * 100);
          return (
            <div key={key} className="flex items-center gap-3">
              <div
                className="h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="text-sm text-foreground">{label}</span>
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${percentage}%`, backgroundColor: color }}
                />
              </div>
              <span className="text-sm font-medium text-foreground w-12 text-right">{count}</span>
              <span className="text-xs text-muted-foreground w-16 text-right">({percentage}%)</span>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-sm text-muted-foreground text-center">Total: {total} prospects</p>
    </div>
  );
}

function RecentActivityPlaceholder() {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h3 className="text-lg font-heading font-semibold text-foreground mb-4">Recent Activity</h3>
      <div className="space-y-3">
        {[
          { type: 'meeting', subject: 'Quarterly review - Sharma Family', time: '2 hours ago', outcome: 'Positive' },
          { type: 'email', subject: 'Proposal sent - Patel Retirement', time: '5 hours ago', outcome: 'Sent' },
          { type: 'call', subject: 'Follow-up call - New lead', time: '1 day ago', outcome: 'Scheduled meeting' },
          { type: 'note', subject: 'Portfolio research notes', time: '2 days ago', outcome: 'Completed' },
        ].map((activity, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <i className={`h-4 w-4 lucide-${activity.type} text-primary`} aria-hidden="true" data-lucide={activity.type} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{activity.subject}</p>
              <p className="text-xs text-muted-foreground">{activity.time}</p>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              {activity.outcome}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        <a href="/wealth/activities" className="text-primary hover:underline">View all activities →</a>
      </p>
    </div>
  );
}

function getStageProbability(stage: string): number {
  const probs: Record<string, number> = {
    prospecting: 10,
    qualification: 25,
    proposal: 50,
    negotiation: 75,
    'closed-won': 100,
    'closed-lost': 0,
  };
  return probs[stage] || 0;
}

function formatCurrency(amount: number): string {
  if (amount >= 1_00_00_000) {
    return `₹${(amount / 1_00_00_000).toFixed(1)}Cr`;
  }
  if (amount >= 1_00_000) {
    return `₹${(amount / 1_00_000).toFixed(1)}L`;
  }
  return `₹${amount.toLocaleString()}`;
}