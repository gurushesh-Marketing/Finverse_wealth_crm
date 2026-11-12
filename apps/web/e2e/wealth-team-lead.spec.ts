import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

function isMobile(): boolean {
  return test.info().project.name.startsWith('mobile');
}

async function loginAsTl(page: Page, email = 'tara@finverse.demo', password = 'demo1234') {
  await page.goto('/login');
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/management\/team/);
}

const outDir = resolve(process.cwd(), '../../evidence/screenshots/wealth_team_lead');
mkdirSync(outDir, { recursive: true });

async function snap(page: Page, name: string) {
  const prefix = isMobile() ? 'mobile' : 'desktop';
  const filePath = resolve(outDir, `${prefix}_${name}.png`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: filePath, fullPage: true });
}

test.describe('Wealth Team Lead Workspace (TL-01 through TL-18)', () => {

  test('Demo Access Directory: Team Lead (Tara Iyer) login flow', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');

    // Verify Demo Access panel exists and displays Wealth
    await expect(page.getByText('Demo access — synthetic accounts')).toBeVisible();
    const wealthGroup = page.locator('details', { hasText: 'Wealth' }).first();
    await expect(wealthGroup).toBeVisible();

    // Verify Tara Iyer is listed under Team Lead
    await expect(wealthGroup.getByText('Tara Iyer')).toBeVisible();
    await expect(wealthGroup.getByText('tara@finverse.demo')).toBeVisible();

    // Click 'Use this account' for Tara Iyer
    await wealthGroup.getByRole('button', { name: /Use account Tara Iyer/i }).click();

    // Verify fields populated
    await expect(page.getByLabel('Work email')).toHaveValue('tara@finverse.demo');
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue('demo1234');

    await snap(page, 'demo_access_wealth_tl_selected');

    // Submit Sign in
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/management\/team/);

    // Verify landing on Team Command dashboard
    await expect(page.getByText('TEAM COMMAND')).toBeVisible();
    await expect(page.getByText('WEALTH', { exact: true })).toBeVisible();
    await expect(page.getByText('Wealth scope')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Keep the team in motion/i })).toBeVisible();
  });

  test('TL-01: Team command dashboard, priority card, 4 metric chips, operating signals & 3-card guidance rail [Deck P037/P099]', async ({ page }) => {
    await loginAsTl(page);
    await page.goto('/management/team');
    await expect(page.getByRole('heading', { name: /Keep the team in motion/i })).toBeVisible();

    // Verify Scope Badge & Institutional Breadcrumb
    await expect(page.getByText('TEAM COMMAND')).toBeVisible();
    await expect(page.getByText('WEALTH', { exact: true })).toBeVisible();
    await expect(page.getByText('Wealth scope')).toBeVisible();

    // Verify Sidebar Navigation has exactly 8 unique Team Lead modules (no duplicates)
    if (!isMobile()) {
      const navLinks = page.locator('aside nav a[href^="/management/"]');
      await expect(navLinks).toHaveCount(8);
      const linkTexts = await navLinks.allTextContents();
      const trimmedTexts = linkTexts.map((t) => t.trim());
      expect(trimmedTexts).toEqual([
        'Team overview',
        'Lead allocation',
        'Team workload',
        'Quality & approvals',
        'Targets & forecast',
        'Coaching',
        'Requests & help',
        'Team reports',
      ]);
      expect(trimmedTexts.filter((t) => t === 'Team overview').length).toBe(1);
    }

    // Verify 4 Metric Chips (Deck P037 / P099)
    await expect(page.getByText('Active associates')).toBeVisible();
    await expect(page.getByText('Unassigned', { exact: true })).toBeVisible();
    await expect(page.getByText('SLA breaches')).toBeVisible();
    await expect(page.getByText('Wins / target')).toBeVisible();

    // Verify Tall Emerald Card
    await expect(page.getByText('Your Priority')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Allocation to resolve' })).toBeVisible();

    // Verify Operating Signal
    await expect(page.getByText('Operating Signal')).toBeVisible();
    await expect(page.getByText('Wealth outcome trend')).toBeVisible();

    // Open Actions Drawer
    await page.getByRole('button', { name: 'Actions' }).click();
    await expect(page.getByText('Team Leader Actions')).toBeVisible();
    await snap(page, 'TL-01_actions_drawer');
    await page.getByRole('button', { name: 'Close' }).click();

    await snap(page, 'TL-01_team_command_dashboard');
  });

  test('TL-01: Metric drill-down view with formula and opportunity breakdown [Deck P099/P100]', async ({ page }) => {
    await loginAsTl(page);
    await page.goto('/management/team');

    // Click Metric Drill-down toggle
    await page.getByRole('button', { name: /Metric Drill-down/i }).click();

    // Verify Drill-down view is rendered
    await expect(page.getByText(/Work Area \/ Inspect team health/i)).toBeVisible();
    await expect(page.getByText('In this view')).toBeVisible();

    // Verify 3-Card Guidance Rail (Deck P099)
    await expect(page.getByText('How This Works')).toBeVisible();
    await expect(page.getByText('When a Check Fails')).toBeVisible();
    await expect(page.getByText('Permission & Evidence')).toBeVisible();

    // Click an operational KPI card to open drill breakdown
    const overdueKpiBtn = page.locator('button', { hasText: 'Overdue tasks' }).first();
    if (await overdueKpiBtn.isVisible()) {
      await overdueKpiBtn.click();
      await expect(page.getByText(/Drill:.*breakdown/i)).toBeVisible();
    }

    await snap(page, 'TL-01_metric_drilldown_view');
  });

  test('TL-02 & TL-03: Lead allocation, unassigned queue, single assign drawer & weighted round-robin batch preview [Deck P101..P104]', async ({ page }) => {
    await loginAsTl(page);
    await page.goto('/management/allocation');
    await expect(page.getByRole('heading', { name: 'Lead allocation' })).toBeVisible();

    // Verify Unassigned Queue Card
    await expect(page.getByText('Unassigned queue (V1 new leads)')).toBeVisible();

    // Verify Batch Distribution Card (TL-03)
    await expect(page.getByText('Batch distribution (weighted round-robin) · TL-03')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Preview batch' })).toBeVisible();

    // Verify Eligible Associates Card
    await expect(page.getByRole('heading', { name: 'Eligible associates' })).toBeVisible();

    // If an assign button exists on unassigned queue, click it to open single allocation drawer (TL-02)
    const assignBtn = page.getByRole('button', { name: 'Assign →' }).first();
    if (await assignBtn.isVisible()) {
      await assignBtn.click();
      await expect(page.getByText(/Allocate.*\(TL-02\)/i)).toBeVisible();
      await expect(page.getByLabel('Recipient')).toBeVisible();
      await expect(page.getByLabel('Allocation reason')).toBeVisible();
      await snap(page, 'TL-02_single_allocate_drawer');
      await page.getByRole('button', { name: 'Close' }).click();
    }

    await snap(page, 'TL-02_03_lead_allocation_page');
  });

  test('TL-04 & TL-05: Team workload rebalance, overdue queue, breach tracking & recovery actions [Deck P105..P108]', async ({ page }) => {
    await loginAsTl(page);
    await page.goto('/management/workload');
    await expect(page.getByRole('heading', { name: 'Team workload' })).toBeVisible();

    // Verify Overdue Queue Card (TL-05)
    await expect(page.getByText('Overdue queue (severity-sorted)')).toBeVisible();

    // Verify Workload Comparison Table
    await expect(page.getByText('Workload comparison')).toBeVisible();

    // Verify Quick Rebalance & Transfer Card (TL-04)
    await expect(page.getByText('Quick rebalance & transfer · TL-04')).toBeVisible();

    // If overdue task recovery button exists, inspect Recovery drawer
    const recoveryBtn = page.getByRole('button', { name: 'Coach / reassign / escalate' }).first();
    if (await recoveryBtn.isVisible()) {
      await recoveryBtn.click();
      await expect(page.getByText(/Recovery action.*\(TL-05\)/i)).toBeVisible();
      await expect(page.getByLabel('Action', { exact: true })).toBeVisible();
      await expect(page.getByRole('dialog').getByLabel('Reason')).toBeVisible();
      await snap(page, 'TL-05_overdue_recovery_drawer');
      await page.getByRole('button', { name: 'Close' }).click();
    }

    // Inspect Rebalance drawer from workload table
    const rebalBtn = page.getByRole('button', { name: 'Rebalance →' }).first();
    if (await rebalBtn.isVisible()) {
      await rebalBtn.click();
      await expect(page.getByText(/Rebalance from.*\(TL-04\)/i)).toBeVisible();
      await snap(page, 'TL-04_rebalance_drawer');
      await page.getByRole('button', { name: 'Close' }).click();
    }

    await snap(page, 'TL-04_05_team_workload_page');
  });

  test('TL-06: Dedicated TL prospect drill-down view (/management/prospects/:id) [M1 review fix, Deck P109/P110]', async ({ page }) => {
    await loginAsTl(page);
    await page.goto('/management/prospects/FV-1001');

    // Verify Breadcrumb back to Management
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Management' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Workload' })).toBeVisible();

    // Verify TL Prospect Management Subtitle & Context
    await expect(page.getByText(/TL Prospect Management View/i)).toBeVisible();
    await expect(page.getByText('V1 Wealth Portfolio', { exact: true })).toBeVisible();

    // Verify Assign corrective task drawer button
    const taskBtn = page.getByRole('button', { name: 'Assign corrective task' }).first();
    await expect(taskBtn).toBeVisible();
    await taskBtn.click();
    await expect(page.getByText(/Assign corrective task for FV-1001/i)).toBeVisible();
    await snap(page, 'TL-06_corrective_task_drawer');
    await page.getByRole('button', { name: 'Close' }).click();

    // Verify Tabs
    await expect(page.getByRole('button', { name: 'summary' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'timeline' })).toBeVisible();
    await expect(page.getByRole('button', { name: /documents/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /requests/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /audit/i })).toBeVisible();

    await snap(page, 'TL-06_prospect_management_view');
  });

  test('TL-07, TL-08, TL-09, TL-18: Quality & approvals, conversion decisions, reopen review, call coaching & activity corrections [Deck P111..P116, P133/P134]', async ({ page }) => {
    await loginAsTl(page);
    await page.goto('/management/quality');
    await expect(page.getByRole('heading', { name: 'Quality & approvals' })).toBeVisible();

    // Verify Conversion & Reopen Decisions Card (TL-07, TL-08)
    await expect(page.getByRole('heading', { name: 'Pending decisions' })).toBeVisible();

    // Verify Activity Corrections Queue Card (TL-18)
    await expect(page.getByRole('heading', { name: 'Activity corrections' })).toBeVisible();

    // Verify Call Quality & Coaching Card (TL-09)
    await expect(page.getByRole('heading', { name: 'Call quality samples' })).toBeVisible();

    // If decision drawer trigger exists, inspect DecisionForm
    const decideBtn = page.getByRole('button', { name: 'Review & decide →' }).first();
    if (await decideBtn.isVisible()) {
      await decideBtn.click();
      await expect(page.getByText(/Review & decide \(TL-07\/08\)/i)).toBeVisible();
      await expect(page.getByLabel('Decision')).toBeVisible();
      await expect(page.getByLabel('Verified evidence reference')).toBeVisible();
      await expect(page.getByLabel('Decision rationale')).toBeVisible();
      await snap(page, 'TL-07_08_outcome_decision_drawer');
      await page.getByRole('button', { name: 'Close' }).click();
    }

    // If correction decision drawer trigger exists, inspect CorrectionDecisionForm
    const decideCorrBtn = page.getByRole('button', { name: 'Review correction →' }).first();
    if (await decideCorrBtn.isVisible()) {
      await decideCorrBtn.click();
      await expect(page.getByText(/Review correction \(TL-18\)/i)).toBeVisible();
      await expect(page.getByLabel('Decision')).toBeVisible();
      await expect(page.getByLabel('Decision rationale')).toBeVisible();
      await snap(page, 'TL-18_correction_decision_drawer');
      await page.getByRole('button', { name: 'Close' }).click();
    }

    await snap(page, 'TL-07_08_09_18_quality_approvals_page');
  });

  test('TL-10 & TL-11: Team targets distribution, unallocated remainder, and team forecast submission [Deck P117..P120]', async ({ page }) => {
    await loginAsTl(page);
    await page.goto('/management/targets');
    await expect(page.getByRole('heading', { name: 'Targets & forecast' })).toBeVisible();

    // Verify Team Targets Card (TL-10)
    await expect(page.getByText('Team targets')).toBeVisible();
    await expect(page.getByLabel('Team', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Period', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Parent target')).toBeVisible();
    await expect(page.getByLabel('Basis')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create target' })).toBeVisible();

    // If draft allocations drawer exists, inspect TargetAllocForm
    const allocBtn = page.getByRole('button', { name: 'Draft allocations' }).first();
    if (await allocBtn.isVisible()) {
      await allocBtn.click();
      await expect(page.getByText(/Allocate target.*\(TL-10\)/i)).toBeVisible();
      await snap(page, 'TL-10_target_alloc_drawer');
      await page.getByRole('button', { name: 'Close' }).click();
    }

    // Verify Team Forecast Card (TL-11)
    await expect(page.getByText('Team forecast')).toBeVisible();
    await expect(page.getByLabel('Category')).toBeVisible();
    await expect(page.getByLabel('Expected revenue')).toBeVisible();
    await expect(page.getByLabel('Opportunity IDs')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Submit forecast' })).toBeVisible();

    await snap(page, 'TL-10_11_targets_forecast_page');
  });

  test('TL-12 & TL-13: Associate 1:1 reviews, commitment tracking, and intern mentoring workload cap [Deck P121..P124]', async ({ page }) => {
    await loginAsTl(page);
    await page.goto('/management/coaching');
    await expect(page.getByRole('heading', { name: 'Coaching' })).toBeVisible();

    // Verify 1:1 Schedule Card
    await expect(page.getByText('Schedule a one-to-one · TL-12')).toBeVisible();
    await expect(page.getByLabel('Employee')).toBeVisible();
    await expect(page.getByLabel('Agenda')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Schedule + request reflection' })).toBeVisible();

    // Verify One-to-Ones Card
    await expect(page.getByRole('heading', { name: 'One-to-ones', exact: true })).toBeVisible();

    // If Run review drawer exists, inspect OneToOneForm
    const runReviewBtn = page.getByRole('button', { name: 'Run review' }).first();
    if (await runReviewBtn.isVisible()) {
      await runReviewBtn.click();
      await expect(page.getByText(/Run one-to-one \(TL-12\)/i)).toBeVisible();
      await snap(page, 'TL-12_one_to_one_drawer');
      await page.getByRole('button', { name: 'Close' }).click();
    }

    // Verify Intern Mentoring Card (TL-13)
    await expect(page.getByText('Intern mentoring · TL-13')).toBeVisible();
    await expect(page.getByLabel('Intern')).toBeVisible();
    await expect(page.getByLabel('Mentor')).toBeVisible();
    await expect(page.getByLabel('Work cap')).toBeVisible();
    await expect(page.getByLabel('Allowed products')).toBeVisible();
    await expect(page.getByLabel('Review date')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Assign mentor' })).toBeVisible();

    await snap(page, 'TL-12_13_coaching_page');
  });

  test('TL-14..TL-17: Staffing & escalation requests, team review pack PDF export, and recurring report schedules [Deck P125..P132]', async ({ page }) => {
    await loginAsTl(page);

    // Dedicated Requests & Help Page (/management/requests)
    await page.goto('/management/requests');
    await expect(page.getByRole('heading', { name: 'Requests & help' })).toBeVisible();
    await expect(page.getByText('New request / escalation')).toBeVisible();
    await expect(page.getByLabel('Category / Request type')).toBeVisible();
    await expect(page.getByLabel('Severity')).toBeVisible();
    await expect(page.getByLabel('Request summary')).toBeVisible();
    await expect(page.getByLabel('Business reason', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Submit request' })).toBeVisible();
    await expect(page.getByText('Request tracker')).toBeVisible();
    await snap(page, 'TL-14_15_requests_page');

    // Dedicated Team Reports Page (/management/reports)
    await page.goto('/management/reports');
    await expect(page.getByRole('heading', { name: 'Team reports' })).toBeVisible();
    await expect(page.getByText('Team review pack (PDF export · TL-16)')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Generate + download PDF' })).toBeVisible();
    await expect(page.getByText('Recurring report schedules (TL-17)')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save schedule' })).toBeVisible();
    await snap(page, 'TL-16_17_reports_page');
  });
});
