import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { BrowserRouter } from 'react-router-dom';
import { SessionProvider, useSession } from './lib/session';
import { landingPath } from './lib/modules';
import { WorkspaceShell } from './components/shell/WorkspaceShell';
import { LoginPage } from './pages/LoginPage';
import { MyDayPage } from './pages/MyDayPage';
import { LeadInboxPage } from './pages/LeadInboxPage';
import { ProspectPage } from './pages/ProspectPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import {
  ConversationsAreaPage, DocumentsAreaPage, PerformancePage, PipelineAreaPage, ReviewsPage, TasksAreaPage,
} from './pages/AreaPages';
import {
  TlAllocationPage, TlCoachingPage, TlOverviewPage, TlProspectDrillDownPage, TlQualityPage, TlReportsPage, TlRequestsPage, TlTargetsPage, TlWorkloadPage,
} from './pages/TlPages';
import {
  RelPortfolioPage,
  RelHandoffsPage,
  RelInstitutionsPage,
  RelProspectDetailPage,
  RelReportsPage,
} from './pages/RelPages';
import {
  ManagerCapacityPage,
  ManagerExceptionsPage,
  ManagerForecastsPage,
  ManagerLeadersPage,
  ManagerOverviewPage,
  ManagerReportsPage,
  ManagerReviewsPage,
  ManagerTargetsPage,
} from './pages/ManagerPages';
import {
  RegionalApprovalsPage,
  RegionalForecastsPage,
  RegionalManagersPage,
  RegionalOverviewPage,
  RegionalReportsPage,
  RegionalReviewsPage,
  RegionalTargetsPage,
  RegionalTerritoriesPage,
} from './pages/RegionalManagerPages';
import {
  NationalEconomicsPage,
  NationalEscalationsPage,
  NationalForecastPage,
  NationalOverviewPage,
  NationalPlanPage,
  NationalProductRulesPage,
  NationalReferralsPage,
  NationalRegionsPage,
  NationalReportsPage,
  NationalReviewsPage,
  NationalTransfersPage,
} from './pages/NationalManagerPages';
import {
  CeoBoardPackPage,
  CeoCommitmentsPage,
  CeoConflictsPage,
  CeoForecastPage,
  CeoGrowthPage,
  CeoNmReviewPage,
  CeoOperatingPage,
  CeoRisksPage,
  CeoTargetsPage,
  CeoVerticalsPage,
} from './pages/CeoPages';
import {
  CfoOverviewPage,
  CfoRecognitionPage,
  CfoInvoicesPage,
  CfoPaymentsPage,
  CfoIncentivesPage,
  CfoPlanningPage,
  CfoClosePage,
  CfoReportsPage,
  CfoPoliciesPage,
} from './pages/CfoPages';
import {
  SuperadminOverviewPage,
  SuperadminEmployeesPage,
  SuperadminScopesPage,
  SuperadminOrganisationPage,
  SuperadminLifecyclePage,
  SuperadminConfigurationPage,
  SuperadminAuditPage,
  SuperadminHealthPage,
  SuperadminTeamsPage,
} from './pages/SuperadminPages';
import {
  HrOverviewPage,
  HrJoinersPage,
  HrMoversPage,
  HrLeaversPage,
  HrAvailabilityPage,
  HrTrainingPage,
  HrReportsPage,
  HrRequestsPage,
  HrPayrollPreviewPage,
} from './pages/HrPages';
import { ManualDataEntryPage } from './pages/ManualDataEntryPage';
import { ActivateAccountPage } from './pages/ActivateAccountPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { FirstLoginPasswordModal } from './components/auth/FirstLoginPasswordModal';
import { DeniedPanel, Splash } from './components/ui/states';

function ProtectedLayout() {
  const { session, loading } = useSession();
  const location = useLocation();
  if (loading) return <Splash />;
  if (!session) return <Navigate to="/login" replace />;

  let routeAllowed = false;
  if (location.pathname === '/') {
    routeAllowed = true;
  } else if (session.role === 'DE') {
    // DE stays strictly within the data-entry workspace (/data-entry/*)
    routeAllowed = location.pathname.startsWith('/data-entry');
  } else if (session.role === 'HR') {
    // HR stays strictly within the human resources workspace (/hr/*)
    routeAllowed = location.pathname.startsWith('/hr');
  } else if (session.role === 'SA') {
    // SA stays strictly within the administrative workspace (/superadmin/*)
    routeAllowed = location.pathname.startsWith('/superadmin');
  } else if (session.role === 'CFO') {
    // CFO stays strictly within the finance workspace (/cfo/*)
    routeAllowed = location.pathname.startsWith('/cfo');
  } else if (session.role === 'CEO') {
    // CEO stays strictly within the executive workspace (/ceo/*)
    routeAllowed = location.pathname.startsWith('/ceo');
  } else if (session.role === 'NM') {
    // NM stays strictly within the national workspace (/national/*)
    routeAllowed = location.pathname.startsWith('/national');
  } else if (session.role === 'RM') {
    // RM stays strictly within the regional workspace (/regional/*)
    routeAllowed = location.pathname.startsWith('/regional');
  } else if (session.role === 'MG') {
    // MG stays strictly within the manager workspace (/manager/*)
    routeAllowed = location.pathname.startsWith('/manager');
  } else if (session.role === 'REL' || session.role === 'TL') {
    // REL (and migrated TL) stay within the relationship manager workspace (/rel/*)
    // /management/* is permitted so the redirect to /rel/portfolio fires cleanly
    routeAllowed = location.pathname.startsWith('/rel') || location.pathname.startsWith('/management');
  } else if (session.role === 'SC') {
    // SC stays within granted vertical workspaces and is blocked from management/manager/regional/national/ceo/cfo/superadmin/hr/data-entry/rel workspaces
    routeAllowed =
      !location.pathname.startsWith('/superadmin') &&
      !location.pathname.startsWith('/hr') &&
      !location.pathname.startsWith('/data-entry') &&
      !location.pathname.startsWith('/rel') &&
      !location.pathname.startsWith('/management') &&
      !location.pathname.startsWith('/manager') &&
      !location.pathname.startsWith('/regional') &&
      !location.pathname.startsWith('/national') &&
      !location.pathname.startsWith('/ceo') &&
      !location.pathname.startsWith('/cfo') &&
      session.verticalGrants.some((v) => {
        const pathPrefix = v === 'real_estate' ? '/real-estate' : `/${v}`;
        return location.pathname.startsWith(pathPrefix) || location.pathname.startsWith(`/${v}`);
      });
  } else {
    routeAllowed =
      !location.pathname.startsWith('/rel') &&
      session.verticalGrants.some((v) => {
        const pathPrefix = v === 'real_estate' ? '/real-estate' : `/${v}`;
        return location.pathname.startsWith(pathPrefix) || location.pathname.startsWith(`/${v}`);
      });
  }

  return (
    <>
      <WorkspaceShell>
        {routeAllowed ? (
          <Outlet />
        ) : (
          <DeniedPanel
            title="Workspace unavailable"
            message="You don't have access to this workspace. It is outside your current scope."
          />
        )}
      </WorkspaceShell>
      <FirstLoginPasswordModal />
    </>
  );
}

function Landing() {
  const { session } = useSession();
  return <Navigate to={landingPath(session!)} replace />;
}

function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <DeniedPanel title="Page not found" message="This page does not exist in the CRM." />
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/activate" element={<ActivateAccountPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<Landing />} />
            <Route path="/wealth/dashboard" element={<MyDayPage />} />
            <Route path="/wealth/prospects" element={<LeadInboxPage />} />
            <Route path="/wealth/prospects/:id" element={<ProspectPage />} />
            <Route path="/wealth/activities" element={<ConversationsAreaPage />} />
            <Route path="/wealth/tasks" element={<TasksAreaPage />} />
            <Route path="/wealth/deals" element={<PipelineAreaPage />} />
            <Route path="/wealth/documents" element={<DocumentsAreaPage />} />
            <Route path="/wealth/reports" element={<PerformancePage />} />
            <Route path="/wealth/reviews" element={<ReviewsPage />} />

            {/* Relationship Manager Workspace (REL-01..REL-05) */}
            <Route path="/rel/portfolio" element={<RelPortfolioPage />} />
            <Route path="/rel/handoffs" element={<RelHandoffsPage />} />
            <Route path="/rel/institutions" element={<RelInstitutionsPage />} />
            <Route path="/rel/prospects/:id" element={<RelProspectDetailPage />} />
            <Route path="/rel/reports" element={<RelReportsPage />} />
            {/* Deprecated TL management paths redirect safely to Relationship Manager portfolio */}
            <Route path="/management/*" element={<Navigate to="/rel/portfolio" replace />} />

            {/* Wealth Manager Workspace (MG-01..MG-13) */}
            <Route path="/manager/overview" element={<ManagerOverviewPage />} />
            <Route path="/manager/leaders" element={<ManagerLeadersPage />} />
            <Route path="/manager/capacity" element={<ManagerCapacityPage />} />
            <Route path="/manager/targets" element={<ManagerTargetsPage />} />
            <Route path="/manager/forecasts" element={<ManagerForecastsPage />} />
            <Route path="/manager/exceptions" element={<ManagerExceptionsPage />} />
            <Route path="/manager/reviews" element={<ManagerReviewsPage />} />
            <Route path="/manager/reports" element={<ManagerReportsPage />} />

            {/* Wealth Regional Manager Workspace (RM-01..RM-10) */}
            <Route path="/regional/overview" element={<RegionalOverviewPage />} />
            <Route path="/regional/managers" element={<RegionalManagersPage />} />
            <Route path="/regional/territories" element={<RegionalTerritoriesPage />} />
            <Route path="/regional/targets" element={<RegionalTargetsPage />} />
            <Route path="/regional/approvals" element={<RegionalApprovalsPage />} />
            <Route path="/regional/forecasts" element={<RegionalForecastsPage />} />
            <Route path="/regional/reviews" element={<RegionalReviewsPage />} />
            <Route path="/regional/reports" element={<RegionalReportsPage />} />

            {/* Wealth National Manager Workspace (NM-01..NM-11) */}
            <Route path="/national/overview" element={<NationalOverviewPage />} />
            <Route path="/national/regions" element={<NationalRegionsPage />} />
            <Route path="/national/plan" element={<NationalPlanPage />} />
            <Route path="/national/economics" element={<NationalEconomicsPage />} />
            <Route path="/national/rules" element={<NationalProductRulesPage />} />
            <Route path="/national/forecast" element={<NationalForecastPage />} />
            <Route path="/national/transfers" element={<NationalTransfersPage />} />
            <Route path="/national/referrals" element={<NationalReferralsPage />} />
            <Route path="/national/escalations" element={<NationalEscalationsPage />} />
            <Route path="/national/reviews" element={<NationalReviewsPage />} />
            <Route path="/national/reports" element={<NationalReportsPage />} />

            {/* Chief Executive Officer Workspace (CEO-01..CEO-11) */}
            <Route path="/ceo/overview" element={<CeoOperatingPage />} />
            <Route path="/ceo/verticals" element={<CeoVerticalsPage />} />
            <Route path="/ceo/nms" element={<CeoNmReviewPage />} />
            <Route path="/ceo/leadership" element={<CeoNmReviewPage />} />
            <Route path="/ceo/targets" element={<CeoTargetsPage />} />
            <Route path="/ceo/forecast" element={<CeoForecastPage />} />
            <Route path="/ceo/growth" element={<CeoGrowthPage />} />
            <Route path="/ceo/conflicts" element={<CeoConflictsPage />} />
            <Route path="/ceo/risks" element={<CeoRisksPage />} />
            <Route path="/ceo/board" element={<CeoBoardPackPage />} />
            <Route path="/ceo/commitments" element={<CeoCommitmentsPage />} />

            {/* Chief Financial Officer Workspace (CFO-01..CFO-19) */}
            <Route path="/cfo/overview" element={<CfoOverviewPage />} />
            <Route path="/cfo/recognition" element={<CfoRecognitionPage />} />
            <Route path="/cfo/invoices" element={<CfoInvoicesPage />} />
            <Route path="/cfo/payments" element={<CfoPaymentsPage />} />
            <Route path="/cfo/incentives" element={<CfoIncentivesPage />} />
            <Route path="/cfo/planning" element={<CfoPlanningPage />} />
            <Route path="/cfo/close" element={<CfoClosePage />} />
            <Route path="/cfo/reports" element={<CfoReportsPage />} />
            <Route path="/cfo/policies" element={<CfoPoliciesPage />} />

            {/* Super Admin Workspace (SA-01..SA-11) */}
            <Route path="/superadmin/overview" element={<SuperadminOverviewPage />} />
            <Route path="/superadmin/employees" element={<SuperadminEmployeesPage />} />
            <Route path="/superadmin/scopes" element={<SuperadminScopesPage />} />
            <Route path="/superadmin/organisation" element={<SuperadminOrganisationPage />} />
            <Route path="/superadmin/lifecycle" element={<SuperadminLifecyclePage />} />
            <Route path="/superadmin/configuration" element={<SuperadminConfigurationPage />} />
            <Route path="/superadmin/audit" element={<SuperadminAuditPage />} />
            <Route path="/superadmin/health" element={<SuperadminHealthPage />} />
            <Route path="/superadmin/teams" element={<SuperadminTeamsPage />} />

            {/* Human Resources Workspace (HR-01..HR-07) */}
            <Route path="/hr/overview" element={<HrOverviewPage />} />
            <Route path="/hr/joiners" element={<HrJoinersPage />} />
            <Route path="/hr/movers" element={<HrMoversPage />} />
            <Route path="/hr/leavers" element={<HrLeaversPage />} />
            <Route path="/hr/availability" element={<HrAvailabilityPage />} />
            <Route path="/hr/training" element={<HrTrainingPage />} />
            <Route path="/hr/reports" element={<HrReportsPage />} />
            <Route path="/hr/requests" element={<HrRequestsPage />} />
            <Route path="/hr/payroll" element={<HrPayrollPreviewPage />} />

            {/* Data Entry: manual save and database read-back only. */}
            <Route path="/data-entry/intake" element={<ManualDataEntryPage />} />
            <Route path="/data-entry/*" element={<Navigate to="/data-entry/intake" replace />} />

            {/* Commercial Banking Frontline Workspace (Deck P005, P036) */}
            <Route path="/banking/dashboard" element={<MyDayPage />} />
            <Route path="/banking/prospects" element={<LeadInboxPage />} />
            <Route path="/banking/prospects/:id" element={<ProspectPage />} />
            <Route path="/banking/activities" element={<ConversationsAreaPage />} />
            <Route path="/banking/tasks" element={<TasksAreaPage />} />
            <Route path="/banking/deals" element={<PipelineAreaPage />} />
            <Route path="/banking/documents" element={<DocumentsAreaPage />} />
            <Route path="/banking/reports" element={<PerformancePage />} />
            <Route path="/banking/reviews" element={<ReviewsPage />} />

            {/* Markets & Securities Frontline Workspace (Deck P005, P038) */}
            <Route path="/markets/dashboard" element={<MyDayPage />} />
            <Route path="/markets/prospects" element={<LeadInboxPage />} />
            <Route path="/markets/prospects/:id" element={<ProspectPage />} />
            <Route path="/markets/activities" element={<ConversationsAreaPage />} />
            <Route path="/markets/tasks" element={<TasksAreaPage />} />
            <Route path="/markets/deals" element={<PipelineAreaPage />} />
            <Route path="/markets/documents" element={<DocumentsAreaPage />} />
            <Route path="/markets/reports" element={<PerformancePage />} />
            <Route path="/markets/reviews" element={<ReviewsPage />} />

            {/* Real Estate Advisory Frontline Workspace (Deck P005) */}
            <Route path="/real-estate/dashboard" element={<MyDayPage />} />
            <Route path="/real-estate/prospects" element={<LeadInboxPage />} />
            <Route path="/real-estate/prospects/:id" element={<ProspectPage />} />
            <Route path="/real-estate/activities" element={<ConversationsAreaPage />} />
            <Route path="/real-estate/tasks" element={<TasksAreaPage />} />
            <Route path="/real-estate/deals" element={<PipelineAreaPage />} />
            <Route path="/real-estate/documents" element={<DocumentsAreaPage />} />
            <Route path="/real-estate/reports" element={<PerformancePage />} />
            <Route path="/real-estate/reviews" element={<ReviewsPage />} />

            <Route path="/wealth/*" element={<PlaceholderPage />} />
            <Route path="/banking/*" element={<PlaceholderPage />} />
            <Route path="/markets/*" element={<PlaceholderPage />} />
            <Route path="/real-estate/*" element={<PlaceholderPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </SessionProvider>
    </BrowserRouter>
  );
}
