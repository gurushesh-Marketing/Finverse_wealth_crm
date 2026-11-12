import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

function isMobile(): boolean {
  return test.info().project.name.startsWith('mobile');
}

async function loginAsMarketsManager(page: Page, email = 'manish@finverse.demo', password = 'demo1234') {
  await page.goto('/login');
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/manager\/overview/);
}

const outDir = resolve(process.cwd(), '../../evidence/screenshots/markets_manager');
mkdirSync(outDir, { recursive: true });

async function snap(page: Page, name: string) {
  const prefix = isMobile() ? 'mobile' : 'desktop';
  const filePath = resolve(outDir, `${prefix}_${name}.png`);
  await page.waitForTimeout(400);
  await page.screenshot({ path: filePath, fullPage: true });
}

test.describe('Markets Manager Workspace (MG-01 through MG-13)', () => {
  test('Demo Access Directory: Markets Manager (Manish Vyas) login flow', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');

    // Verify Demo Access panel exists and displays Markets / Trading
    await expect(page.getByText('Demo access — synthetic accounts')).toBeVisible();
    const marketsGroup = page.locator('details', { hasText: 'Markets / Trading' }).first();
    // Expand Markets accordion
    await marketsGroup.locator('summary').click();

    // Verify Manish Vyas is listed under Manager
    await expect(marketsGroup.getByText('Manish Vyas')).toBeVisible();
    await expect(marketsGroup.getByText('manish@finverse.demo')).toBeVisible();

    // Click 'Use this account' for Manish Vyas
    await marketsGroup.getByRole('button', { name: /Use account Manish Vyas/i }).click();

    // Verify fields populated
    await expect(page.getByLabel('Work email')).toHaveValue('manish@finverse.demo');
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue('demo1234');

    await snap(page, 'demo_access_markets_manager_selected');

    // Submit Sign in
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/manager\/overview/);

    // Verify landing on Manager Overview dashboard
    await expect(page.getByText('MG-01 / MANAGER OVERVIEW')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Investigate performance across team leaders' })).toBeVisible();
    await expect(page.getByText(/Markets & Securities · assigned permission scope/i)).toBeVisible();
  });

  test('MG-01: Manager Overview & TL Performance Interventions', async ({ page }) => {
    await loginAsMarketsManager(page);
    await expect(page.getByText('Team Leader Contribution & Backlog')).toBeVisible();
    await expect(page.getByText('In this view')).toBeVisible();

    // Capture dashboard
    await snap(page, 'mg01_overview_dashboard');

    // Open Assign Management Intervention Drawer
    const assignBtn = page.getByRole('button', { name: 'Assign Action' }).first();
    await expect(assignBtn).toBeVisible();
    await assignBtn.click();
    await expect(page.getByRole('heading', { name: 'Assign Management Intervention' })).toBeVisible();

    // Fill drawer inputs
    await page.getByPlaceholder(/e\.g\. Clear overdue/).fill('Audit KYC turnaround on active Demat backlog');
    await page.getByPlaceholder(/Actionable steps, expectations/).fill('Review 14-day dormant trading accounts across Markets Alpha & Beta.');
    await snap(page, 'mg01_intervention_drawer');

    // Close drawer
    await page.getByRole('button', { name: 'Close' }).click();
  });

  test('MG-02 & MG-10: Team Leaders Scorecard & Source Quality Remediation', async ({ page }) => {
    await loginAsMarketsManager(page);
    await page.goto('/manager/leaders');

    // MG-02 Scorecard tab
    await expect(page.getByRole('heading', { name: 'Team leaders & source quality' })).toBeVisible();
    await expect(page.getByText('TL Operating Profile')).toBeVisible();
    await snap(page, 'mg02_tl_operating_scorecard');

    // MG-10 Source Quality tab
    await page.getByRole('button', { name: 'Source Quality (MG-10)' }).click();
    await expect(page.getByText('Lead Source Quality Cohort')).toBeVisible();
    await snap(page, 'mg10_source_quality_cohort');

    // Open Remediation drawer
    const remBtn = page.getByRole('button', { name: 'Remediate' }).first();
    await expect(remBtn).toBeVisible();
    await remBtn.click();
    await expect(page.getByRole('heading', { name: 'Request Source Remediation' })).toBeVisible();
    await page.getByPlaceholder(/Explain defect patterns/).fill('Automate Aadhaar OTP verification to prevent KYC verification drop-offs.');
    await snap(page, 'mg10_remediation_drawer');
    await page.getByRole('button', { name: 'Close' }).click();
  });

  test('MG-03, MG-04 & MG-12: Capacity, Transfers & Lifecycle Promotions', async ({ page }) => {
    await loginAsMarketsManager(page);
    await page.goto('/manager/capacity');

    // MG-03 Transfers tab
    await expect(page.getByRole('heading', { name: 'Capacity, transfers & promotions' })).toBeVisible();
    await expect(page.getByText('Request Cross-Team Transfer')).toBeVisible();
    await snap(page, 'mg03_cross_team_transfers');

    // MG-04 Recovery Plan tab
    await page.getByRole('button', { name: 'Capacity Plan (MG-04)' }).click();
    await expect(page.getByText('Model Operational Recovery Plan')).toBeVisible();
    await page.getByPlaceholder(/Milestones, rebalancing instructions/).fill('F&O derivatives surge requiring caller reallocation between Markets Alpha and Beta.');
    await snap(page, 'mg04_capacity_recovery_plan');

    // MG-12 Lifecycle Promotions tab
    await page.getByRole('button', { name: 'Employee Lifecycle (MG-12)' }).click();
    await expect(page.getByText('Request Transfer / Promotion')).toBeVisible();
    await page.getByPlaceholder(/Performance record, readiness/).fill('Outstanding performance in equity onboarding and margin clearance.');
    await page.getByPlaceholder(/Specify lead reassignment plan/).fill('Transfer Demat accounts smoothly within Markets Beta over 10 business days.');
    await snap(page, 'mg12_lifecycle_promotions');
  });

  test('MG-05: Target Distribution to Team Leaders', async ({ page }) => {
    await loginAsMarketsManager(page);
    await page.goto('/manager/targets');

    await expect(page.getByRole('heading', { name: 'Target distribution to TLs' })).toBeVisible();
    await expect(page.getByText('Parent Target Reconciliation')).toBeVisible();
    await expect(page.getByText('Team Leader Allocations')).toBeVisible();
    await snap(page, 'mg05_target_distribution');
  });

  test('MG-06 & MG-07: Pipeline & Forecast Submissions', async ({ page }) => {
    await loginAsMarketsManager(page);
    await page.goto('/manager/forecasts');

    // MG-06 TL Forecast Review
    await expect(page.getByRole('heading', { name: 'Pipeline & forecast' })).toBeVisible();
    await expect(page.getByText('Submitted Team Lead Forecasts')).toBeVisible();
    await snap(page, 'mg06_tl_forecast_review');

    // MG-07 Submit to RM tab
    await page.getByRole('button', { name: 'Consolidated Submission (MG-07)' }).click();
    await expect(page.getByText('Consolidation Summary')).toBeVisible();
    await snap(page, 'mg07_manager_consolidated_forecast');
  });

  test('MG-08 & MG-09: SLA Escalations & Delegated Commercial Exceptions', async ({ page }) => {
    await loginAsMarketsManager(page);
    await page.goto('/manager/exceptions');

    // MG-08 SLA Breaches
    await expect(page.getByRole('heading', { name: 'Exceptions & escalation resolution' })).toBeVisible();
    await expect(page.getByText('SLA Breaches & Overdue Task Escalations')).toBeVisible();
    await snap(page, 'mg08_sla_breaches_resolution');

    // MG-09 Commercial Exceptions tab
    await page.getByRole('button', { name: 'Commercial Exceptions (MG-09)' }).click();
    await expect(page.getByRole('heading', { name: /Delegated Commercial Exceptions/i })).toBeVisible();
    await snap(page, 'mg09_commercial_exceptions');
  });

  test('MG-11: Team Lead Performance Reviews', async ({ page }) => {
    await loginAsMarketsManager(page);
    await page.goto('/manager/reviews');

    await expect(page.getByRole('heading', { name: 'Team lead performance reviews' })).toBeVisible();
    await expect(page.getByText('Conduct Performance Review')).toBeVisible();
    await expect(page.getByText('Review History & Commitments')).toBeVisible();
    await snap(page, 'mg11_tl_performance_reviews');
  });

  test('MG-13: Manager Meeting Pack & Scheduled Reports', async ({ page }) => {
    await loginAsMarketsManager(page);
    await page.goto('/manager/reports');

    await expect(page.getByRole('heading', { name: 'Manager meeting pack & schedules' })).toBeVisible();
    await expect(page.getByText(/Pack Preview/i)).toBeVisible();
    await expect(page.getByText('Recurring Report Schedules')).toBeVisible();
    await expect(page.getByRole('button', { name: /Export Meeting Pack/i })).toBeVisible();
    await snap(page, 'mg13_meeting_pack_reports');
  });
});
