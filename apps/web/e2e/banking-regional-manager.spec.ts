import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

function isMobile(): boolean {
  return test.info().project.name.startsWith('mobile');
}

async function loginAsBankingRegionalManager(page: Page, email = 'arjun@finverse.demo', password = 'demo1234') {
  await page.goto('/login');
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/regional\/overview/);
}

const outDir = resolve(process.cwd(), '../../evidence/screenshots/banking_regional_manager');
mkdirSync(outDir, { recursive: true });

async function snap(page: Page, name: string) {
  const prefix = isMobile() ? 'mobile' : 'desktop';
  const filePath = resolve(outDir, `${prefix}_${name}.png`);
  await page.waitForTimeout(400);
  await page.screenshot({ path: filePath, fullPage: true });
}

test.describe('Commercial Banking Regional Manager Workspace (RM-01 through RM-10)', () => {
  test('Demo Access Directory: Banking Regional Manager (Arjun Mehta) login flow', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');

    // Verify Demo Access panel exists and displays Banking
    await expect(page.getByText('Demo access — synthetic accounts')).toBeVisible();
    const bankingGroup = page.locator('details', { hasText: 'Banking' }).first();
    await expect(bankingGroup).toBeVisible();
    await bankingGroup.locator('summary').click();

    // Verify Arjun Mehta is listed under Regional Manager
    await expect(bankingGroup.getByText('Arjun Mehta')).toBeVisible();
    await expect(bankingGroup.getByText('arjun@finverse.demo')).toBeVisible();

    // Click 'Use this account' for Arjun Mehta
    await bankingGroup.getByRole('button', { name: /Use account Arjun Mehta/i }).click();

    // Verify fields populated
    await expect(page.getByLabel('Work email')).toHaveValue('arjun@finverse.demo');
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue('demo1234');

    await snap(page, 'demo_access_banking_rm_selected');

    // Submit Sign in
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/regional\/overview/);

    // Verify landing on Regional Overview dashboard
    await expect(page.getByRole('heading', { name: 'Investigate regional gaps' })).toBeVisible();
    await expect(page.getByText(/RM-01 \/ REGION OVERVIEW · Commercial Banking · assigned permission scope/i)).toBeVisible();
  });

  test('RM-01: Regional Overview & Intervention', async ({ page }) => {
    await loginAsBankingRegionalManager(page);
    await expect(page.getByRole('heading', { name: 'Investigate regional gaps' })).toBeVisible();
    await expect(page.getByText('Parent NM Target').first()).toBeVisible();
    await expect(page.getByText(/Commercial Banking/i).first()).toBeVisible();

    // Capture dashboard
    await snap(page, 'rm01_overview_dashboard');

    // Open Regional Intervention Drawer
    const actionBtn = page.getByRole('button', { name: '+ Regional intervention' });
    await expect(actionBtn).toBeVisible();
    await actionBtn.click();
    await expect(page.getByRole('heading', { name: 'Create Regional Intervention' })).toBeVisible();

    // Fill drawer inputs
    await page.getByPlaceholder(/e\.g\. Rebalance intake/).fill('Q4 Commercial Credit Memo Acceleration');
    await page.getByPlaceholder(/Document agreed recovery actions/).fill('Review overdue loan committee submissions with Branch Manager Kunal Shah.');
    await snap(page, 'rm01_intervention_drawer');

    // Close drawer
    await page.getByRole('button', { name: 'Close' }).click();
  });

  test('RM-02: Review a Manager Scorecard', async ({ page }) => {
    await loginAsBankingRegionalManager(page);
    await page.goto('/regional/managers');

    await expect(page.getByRole('heading', { name: 'Review a Manager scorecard' })).toBeVisible();
    await expect(page.getByText(/RM-02 \/ MANAGERS · Commercial Banking/i)).toBeVisible();
    await expect(page.getByText('Target Wins').first()).toBeVisible();
    await snap(page, 'rm02_manager_scorecard');
  });

  test('RM-03: Plan Territory Coverage', async ({ page }) => {
    await loginAsBankingRegionalManager(page);
    await page.goto('/regional/territories');

    await expect(page.getByRole('heading', { name: 'Plan territory coverage' })).toBeVisible();
    await expect(page.getByText(/RM-03 \/ TERRITORIES · Commercial Banking/i)).toBeVisible();
    await expect(page.getByText('WORK TO ASSIGN').first()).toBeVisible();
    await snap(page, 'rm03_territory_coverage');
  });

  test('RM-04: Allocate Regional Targets to Managers', async ({ page }) => {
    await loginAsBankingRegionalManager(page);
    await page.goto('/regional/targets');

    await expect(page.getByRole('heading', { name: 'Allocate regional targets to Managers' })).toBeVisible();
    await expect(page.getByText(/RM-04 \/ REGIONAL TARGETS · Commercial Banking/i)).toBeVisible();
    await expect(page.getByText('Approved NM Target').first()).toBeVisible();
    await snap(page, 'rm04_regional_targets');
  });

  test('RM-05 & RM-06: Cross-Manager Transfers & Staffing Approvals', async ({ page }) => {
    await loginAsBankingRegionalManager(page);
    await page.goto('/regional/approvals');

    // RM-05: Cross-Manager Transfers
    await expect(page.getByRole('heading', { name: 'Approve a cross-Manager transfer' })).toBeVisible();
    await expect(page.getByText(/RM-05 \/ CAPACITY & APPROVALS · Commercial Banking/i)).toBeVisible();
    await expect(page.getByText('Cross-Manager Transfers (RM-05)')).toBeVisible();
    await snap(page, 'rm05_cross_manager_transfers');

    // RM-06: Staffing Requisitions
    await page.getByRole('button', { name: 'Staffing Requisitions (RM-06)' }).click();
    await expect(page.getByRole('heading', { name: 'Approve a regional staffing plan' })).toBeVisible();
    await expect(page.getByText(/RM-06 \/ CAPACITY & APPROVALS · Commercial Banking/i)).toBeVisible();
    await snap(page, 'rm06_staffing_plans');
  });

  test('RM-07 & RM-08: Regional Forecast & Escalation Resolution', async ({ page }) => {
    await loginAsBankingRegionalManager(page);
    await page.goto('/regional/forecasts');

    // RM-07: Regional Forecast
    await expect(page.getByRole('heading', { name: 'Submit the regional forecast' })).toBeVisible();
    await expect(page.getByText(/RM-07 \/ FORECAST & RISKS · Commercial Banking/i)).toBeVisible();
    await expect(page.getByText('Regional Forecast (RM-07)')).toBeVisible();
    await snap(page, 'rm07_regional_forecast');

    // RM-08: Escalations & Risk Queue
    await page.getByRole('button', { name: /Escalations/i }).click();
    await expect(page.getByRole('heading', { name: 'Resolve a regional escalation' })).toBeVisible();
    await expect(page.getByText(/RM-08 \/ FORECAST & RISKS · Commercial Banking/i)).toBeVisible();
    await snap(page, 'rm08_escalations_resolution');
  });

  test('RM-09: Run a Manager Review', async ({ page }) => {
    await loginAsBankingRegionalManager(page);
    await page.goto('/regional/reviews');

    await expect(page.getByRole('heading', { name: 'Run a Manager review' })).toBeVisible();
    await expect(page.getByText(/RM-09 \/ REVIEWS · Commercial Banking/i)).toBeVisible();
    await expect(page.getByText('PERFORMANCE EVIDENCE').first()).toBeVisible();
    await snap(page, 'rm09_manager_review');
  });

  test('RM-10: Produce the Regional Review Pack & Schedules', async ({ page }) => {
    await loginAsBankingRegionalManager(page);
    await page.goto('/regional/reports');

    await expect(page.getByRole('heading', { name: 'Produce the regional review pack' })).toBeVisible();
    await expect(page.getByText(/RM-10 \/ REPORTS & HELP · Commercial Banking/i)).toBeVisible();
    await expect(page.getByText(/Download Protected PDF Pack/i)).toBeVisible();
    await snap(page, 'rm10_regional_reports_pack');
  });
});
