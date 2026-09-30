import { Suspense } from 'react';
import { Metadata } from 'next';
import { fixtureRepository } from '@/lib/repository/fixture';
import { fixtureSession } from '@/lib/session';
import { WealthDashboardContent } from './WealthDashboardContent';
import { DashboardSkeleton } from './DashboardSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { AccessDenied } from '@/components/ui/AccessDenied';

export const metadata: Metadata = {
  title: 'Dashboard | Wealth | Finverse CRM',
  description: 'Wealth management dashboard overview',
};

async function getDashboardData() {
  fixtureRepository.setSession(fixtureSession);

  const [prospectCounts, dealPipeline, activityCounts] = await Promise.all([
    fixtureRepository.getProspectCountByStatus('wealth'),
    fixtureRepository.getDealPipelineSummary('wealth'),
    fixtureRepository.getActivityCountByType(fixtureSession.employeeId),
  ]);

  return { prospectCounts, dealPipeline, activityCounts };
}

export default function WealthDashboardPage() {
  const dataPromise = getDashboardData();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-foreground">
            Wealth Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Your personal pipeline and activity overview
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          <span className="font-medium">Role:</span> {fixtureSession.role} •
          <span className="font-medium ml-2">Assignment:</span> {fixtureSession.activeAssignmentId}
        </div>
      </div>

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardData dataPromise={dataPromise} />
      </Suspense>
    </div>
  );
}

async function DashboardData({ dataPromise }: { dataPromise: Promise<{
  prospectCounts: Record<string, number>;
  dealPipeline: Record<string, { count: number; totalAmount: number }>;
  activityCounts: Record<string, number>;
}> }) {
  const data = await dataPromise;

  // Check if user has access to wealth vertical
  const hasWealthAccess = fixtureSession.verticalGrants.includes('wealth');
  if (!hasWealthAccess) {
    return <AccessDenied resource="Wealth Dashboard" />;
  }

  // Check if there's any data
  const totalProspects = Object.values(data.prospectCounts).reduce((a, b) => a + b, 0);
  const totalDeals = Object.values(data.dealPipeline).reduce((a, b) => a + b.count, 0);
  const totalActivities = Object.values(data.activityCounts).reduce((a, b) => a + b, 0);

  if (totalProspects === 0 && totalDeals === 0 && totalActivities === 0) {
    return (
      <EmptyState
        title="No data yet"
        description="Your wealth dashboard will show prospects, deals, and activities once you start adding them."
        actionLabel="Add your first prospect"
        actionHref="/wealth/prospects/new"
      />
    );
  }

  return <WealthDashboardContent data={data} />;
}