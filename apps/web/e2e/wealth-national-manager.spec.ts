import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

function isMobile(): boolean {
  return test.info().project.name.startsWith('mobile');
}

async function loginAsWealthNationalManager(page: Page, email = 'vikram@finverse.demo', password = 'demo1234') {
  await page.goto('/login');
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/national\/overview/);
}

const outDir = resolve(process.cwd(), '../../evidence/screenshots/wealth_national_manager');
mkdirSync(outDir, { recursive: true });

async function snap(page: Page, name: string) {
  const prefix = isMobile() ? 'mobile' : 'desktop';
  const filePath = resolve(outDir, `${prefix}_${name}.png`);
  await page.waitForTimeout(400);
  await page.screenshot({ path: filePath, fullPage: true });
}

test.describe('Wealth National Manager Workspace (NM-01 through NM-11)', () => {
  test('Demo Access Directory: Wealth National Manager (Vikram Malhotra) login flow', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');

    // Verify Demo Access panel exists and displays Wealth
    await expect(page.getByText('Demo access — synthetic accounts')).toBeVisible();
    const wealthGroup = page.locator('details', { hasText: 'Wealth' }).first();
    await expect(wealthGroup).toBeVisible();

    // Verify Vikram Malhotra is listed under National Manager
    await expect(wealthGroup.getByText('Vikram Malhotra')).toBeVisible();
    await expect(wealthGroup.getByText('vikram@finverse.demo')).toBeVisible();

    // Click 'Use this account' for Vikram Malhotra
    await wealthGroup.getByRole('button', { name: /Use account Vikram Malhotra/i }).click();

    // Verify fields populated
    await expect(page.getByLabel('Work email')).toHaveValue('vikram@finverse.demo');
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue('demo1234');

    await snap(page, 'demo_access_wealth_nm_selected');

    // Submit Sign in
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/national\/overview/);

    // Verify landing on National Overview dashboard
    await expect(page.getByRole('heading', { name: 'Inspect national vertical performance' })).toBeVisible();
    await expect(page.getByText(/NM-01 \/ VERTICAL OVERVIEW · Wealth · assigned permission scope/i)).toBeVisible();
  });

  test('NM-01: National Overview & Directive Drawer', async ({ page }) => {
    await loginAsWealthNationalManager(page);
    await expect(page.getByRole('heading', { name: 'Inspect national vertical performance' })).toBeVisible();
    await expect(page.getByText('Vertical Attainment').first()).toBeVisible();
    await expect(page.getByText('Unallocated Target').first()).toBeVisible();

    // Capture dashboard
    await snap(page, 'nm01_overview_dashboard');

    // Open National Directive Drawer
    const actionBtn = page.getByRole('button', { name: '+ National directive' });
    await expect(actionBtn).toBeVisible();
    await actionBtn.click();
    await expect(page.getByRole('heading', { name: 'Issue National Directive to Regional Manager' })).toBeVisible();

    // Fill drawer inputs
    await page.getByPlaceholder(/e\.g\. South Region SLA/).fill('Accelerate West territory SLA recovery');
    await page.getByPlaceholder(/State mandatory milestones/).fill('Review 14-day pipeline bottleneck with Kavita Rao.');
    await snap(page, 'nm01_directive_drawer');

    // Close drawer
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('NM-02: Regional Comparisons & RM Scorecards', async ({ page }) => {
    await loginAsWealthNationalManager(page);
    await page.goto('/national/regions');

    await expect(page.getByRole('heading', { name: 'Compare regions and open an RM scorecard' })).toBeVisible();
    await expect(page.getByText(/NM-02 \/ REGIONS · Wealth · assigned permission scope/i)).toBeVisible();
    await expect(page.getByText('Target Wins').first()).toBeVisible();
    await snap(page, 'nm02_regional_comparisons');
  });

  test('NM-03: National Target Allocation & Cascade Plan', async ({ page }) => {
    await loginAsWealthNationalManager(page);
    await page.goto('/national/plan');

    await expect(page.getByRole('heading', { name: 'Allocate the national target to regions' })).toBeVisible();
    await expect(page.getByText(/NM-03 \/ NATIONAL PLAN · Wealth · assigned permission scope/i)).toBeVisible();
    await expect(page.getByText('Approved Target').first()).toBeVisible();
    await expect(page.getByText('Unallocated').first()).toBeVisible();
    await snap(page, 'nm03_national_plan');
  });

  test('NM-04: Review Product and Source Economics', async ({ page }) => {
    await loginAsWealthNationalManager(page);
    await page.goto('/national/economics');

    await expect(page.getByRole('heading', { name: 'Review product and source economics' })).toBeVisible();
    await expect(page.getByText(/NM-04 \/ PRODUCT & SOURCES · Wealth · assigned permission scope/i)).toBeVisible();
    await expect(page.getByText('Blended CAC').first()).toBeVisible();
    await snap(page, 'nm04_economics_capacity');
  });

  test('NM-05: Propose Pipeline or Product Rule Changes', async ({ page }) => {
    await loginAsWealthNationalManager(page);
    await page.goto('/national/rules');

    await expect(page.getByRole('heading', { name: 'Propose pipeline or product rule changes' })).toBeVisible();
    await expect(page.getByText(/NM-05 \/ PRODUCT & SOURCES · Wealth · assigned permission scope/i)).toBeVisible();
    await snap(page, 'nm05_product_rules');

    // Open Propose Rule Change drawer
    await page.getByRole('button', { name: '+ Propose Rule Change' }).click();
    await expect(page.getByRole('heading', { name: 'Propose Pipeline or Product Rule Modification' })).toBeVisible();
    await snap(page, 'nm05_propose_rule_drawer');

    // Close drawer
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('NM-06: Submit National Forecast', async ({ page }) => {
    await loginAsWealthNationalManager(page);
    await page.goto('/national/forecast');

    await expect(page.getByRole('heading', { name: 'Submit the national forecast' })).toBeVisible();
    await expect(page.getByText(/NM-06 \/ PIPELINE & FORECAST · Wealth · assigned permission scope/i)).toBeVisible();
    await expect(page.getByText('Bottom-Up Sum').first()).toBeVisible();
    await snap(page, 'nm06_national_forecast');
  });

  test('NM-07: Approve Cross-Region Work Transfers', async ({ page }) => {
    await loginAsWealthNationalManager(page);
    await page.goto('/national/transfers');

    await expect(page.getByRole('heading', { name: 'Approve a cross-region work transfer' })).toBeVisible();
    await expect(page.getByText(/NM-07 \/ EXCEPTIONS & REFERRALS · Wealth · assigned permission scope/i)).toBeVisible();
    await snap(page, 'nm07_cross_region_transfers');
  });

  test('NM-08: Inbound Cross-Vertical Referrals', async ({ page }) => {
    await loginAsWealthNationalManager(page);
    await page.goto('/national/referrals');

    await expect(page.getByRole('heading', { name: 'Accept or decline a cross-vertical referral' })).toBeVisible();
    await expect(page.getByText(/NM-08 \/ EXCEPTIONS & REFERRALS · Wealth · assigned permission scope/i)).toBeVisible();
    await snap(page, 'nm08_cross_vertical_referrals');
  });

  test('NM-09: Escalate National Strategic / Commercial Issues', async ({ page }) => {
    await loginAsWealthNationalManager(page);
    await page.goto('/national/escalations');

    await expect(page.getByRole('heading', { name: 'Escalate a national commercial or finance issue' })).toBeVisible();
    await expect(page.getByText(/NM-09 \/ EXCEPTIONS & REFERRALS · Wealth · assigned permission scope/i)).toBeVisible();
    await snap(page, 'nm09_executive_escalations');

    // Open Escalation drawer
    await page.getByRole('button', { name: '+ Route Escalation' }).click();
    await expect(page.getByRole('heading', { name: 'Route Strategic Commercial Escalation' })).toBeVisible();
    await snap(page, 'nm09_escalation_drawer');

    // Close drawer
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('NM-10: Run Regional Manager Performance Reviews', async ({ page }) => {
    await loginAsWealthNationalManager(page);
    await page.goto('/national/reviews');

    await expect(page.getByRole('heading', { name: 'Run an RM performance review' })).toBeVisible();
    await expect(page.getByText(/NM-10 \/ REVIEWS · Wealth · assigned permission scope/i)).toBeVisible();
    await snap(page, 'nm10_rm_reviews');
  });

  test('NM-11: Prepare National Executive Meeting Pack & Schedules', async ({ page }) => {
    await loginAsWealthNationalManager(page);
    await page.goto('/national/reports');

    await expect(page.getByRole('heading', { name: 'Prepare the national executive pack' })).toBeVisible();
    await expect(page.getByText(/NM-11 \/ REPORTS & HELP · Wealth · assigned permission scope/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export Executive PDF Pack' })).toBeVisible();
    await snap(page, 'nm11_executive_reports_pack');
  });
});
