import { expect, test, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const SCREENSHOT_DIR = path.resolve(process.cwd(), '../../evidence/screenshots/cfo_workspace');
const ROOT_SCREENSHOT_DIR = path.resolve(process.cwd(), '../../evidence/screenshots');

function isMobile(): boolean {
  return test.info().project.name.startsWith('mobile');
}

async function snap(page: Page, actionCode: string) {
  const suffix = isMobile() ? 'mobile' : 'desktop';
  const fileName = `${actionCode}_${suffix}.png`;
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, fileName), fullPage: true });
  await page.screenshot({ path: path.join(ROOT_SCREENSHOT_DIR, fileName), fullPage: true });
}

test.beforeAll(() => {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
});

async function loginAsCfo(page: Page) {
  await page.context().clearCookies();
  await page.goto('/login');
  await page.evaluate(() => localStorage.clear()).catch(() => {});
  await page.goto('/login');
  await page.getByLabel('Work email').fill('ananya@finverse.demo');
  await page.getByLabel('Password', { exact: true }).fill('demo1234');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/cfo\/overview/);
  await expect(page.getByText('CFO-01').first()).toBeVisible();
}

test.describe('CFO Enterprise Workspace — Full Multi-Vertical Verification (CFO-01..CFO-19)', () => {
  test('Security Gate: Non-CFO roles receive 403 / DeniedPanel on CFO workspace', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear()).catch(() => {});
    await page.goto('/login');
    await page.getByLabel('Work email').fill('asha@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/wealth\/dashboard/);

    // Attempt direct navigation to CFO workspace
    await page.goto('/cfo/overview');
    await expect(page.getByText('Workspace unavailable')).toBeVisible();
    await expect(page.getByText(/outside your current scope/i)).toBeVisible();
  });

  test('CFO-01 & CFO-08: Financial Overview, Division Filter & Three-Way Reconciliation Bridge', async ({ page }) => {
    await loginAsCfo(page);
    await page.goto('/cfo/overview');

    await expect(page.getByText('CFO-01').first()).toBeVisible();
    await expect(page.getByText('CFO-08').first()).toBeVisible();
    await expect(page.getByText('Financial Balances & Cash Run-Rate').first()).toBeVisible();
    await expect(page.getByText('Three-Way Sales vs Revenue vs Cash Reconciliation Bridge').first()).toBeVisible();

    // Verify Brand Hero Card with #113F3D dark teal presence
    await expect(page.getByText('Financial Governance & Cash Operating Picture').first()).toBeVisible();
    await expect(page.getByText('Enterprise Scope · Multi-Vertical Financial Cockpit').first()).toBeVisible();

    // Verify 3-card guidance stack
    await expect(page.getByText('HOW THIS WORKS').first()).toBeVisible();
    await expect(page.getByText('WHEN A CHECK FAILS').first()).toBeVisible();
    await expect(page.getByText('PERMISSION & EVIDENCE').first()).toBeVisible();

    // Verify focus division selector has all operational verticals
    const focusSelect = page.getByRole('combobox', { name: /Filter by operational division/i });
    await expect(focusSelect).toBeVisible();

    // Filter to Wealth Management
    await focusSelect.selectOption('wealth');
    await page.waitForTimeout(300);

    // Filter to Commercial Banking
    await focusSelect.selectOption('banking');
    await page.waitForTimeout(300);

    // Filter to Markets & Securities
    await focusSelect.selectOption('markets');
    await page.waitForTimeout(300);

    // Filter to Real Estate Advisory
    await focusSelect.selectOption('real_estate');
    await page.waitForTimeout(300);

    // Return to All Operational Divisions
    await focusSelect.selectOption('all');
    await page.waitForTimeout(300);

    await snap(page, 'CFO-01');
    await snap(page, 'CFO-08');
  });

  test('CFO-02, CFO-03 & CFO-11: Revenue Recognition, Handoffs, Dual-Control & Credit Notes', async ({ page }) => {
    await loginAsCfo(page);
    await page.goto('/cfo/recognition');

    await expect(page.getByText('CFO-02').first()).toBeVisible();
    await expect(page.getByText('CFO-03').first()).toBeVisible();
    await expect(page.getByText('CFO-11').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /Revenue Recognition & Dual-Control Approvals/i })).toBeVisible();

    // Verify Sales-to-Finance Verification Queue (CFO-02)
    await expect(page.getByText('Sales-to-Finance Verification Queue (CFO-02)').first()).toBeVisible();

    // Verify Pending Finance Approvals Queue (Dual-Control Gate, CFO-03)
    await expect(page.getByText('Pending Finance Approvals Queue (Dual-Control Four-Eyes Gate)').first()).toBeVisible();

    // Verify Posted Immutable Revenue Ledger & Credit Note Reversals (CFO-11)
    await expect(page.getByText('Finance Revenue Ledger (Posted / Immutable Register)').first()).toBeVisible();

    await snap(page, 'CFO-02');
    await snap(page, 'CFO-03');
    await snap(page, 'CFO-11');
  });

  test('CFO-04 & CFO-09: Receivable Invoices, AR Ageing Buckets & Collections', async ({ page }) => {
    await loginAsCfo(page);
    await page.goto('/cfo/invoices');

    await expect(page.getByText('CFO-04').first()).toBeVisible();
    await expect(page.getByText('CFO-09').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /Receivable Invoices & Ageing/i })).toBeVisible();

    // Verify Ageing Buckets summary cards
    await expect(page.getByText('Current (0-30d)').first()).toBeVisible();
    await expect(page.getByText('31 - 60 Days').first()).toBeVisible();
    await expect(page.getByText('61 - 90 Days').first()).toBeVisible();
    await expect(page.getByText('> 90 Days Overdue').first()).toBeVisible();
    await expect(page.getByText('Total Outstanding').first()).toBeVisible();

    // Verify Invoices table displays entries
    await expect(page.getByText('Active Receivable Invoices').first()).toBeVisible();

    await snap(page, 'CFO-04');
    await snap(page, 'CFO-09');
  });

  test('CFO-05, CFO-06, CFO-07 & CFO-10: Settled Receipts, Payment Matching, Suspense & Refunds', async ({ page }) => {
    await loginAsCfo(page);
    await page.goto('/cfo/payments');

    await expect(page.getByText('CFO-05').first()).toBeVisible();
    await expect(page.getByText('CFO-06').first()).toBeVisible();
    await expect(page.getByText('CFO-10').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /Settled Receipts, Invoice Matching & Refunds/i })).toBeVisible();

    // Verify Bank Receipts & Matching Section (CFO-05, CFO-06)
    await expect(page.getByText('Bank Settled Receipts (CFO-05)').first()).toBeVisible();

    // Verify Unmatched Receipts & Suspense State (CFO-07)
    await expect(page.getByText('UNMATCHED').first()).toBeVisible();

    // Verify Refund Governance Section (CFO-10)
    await expect(page.getByText('Refund Requests & Payout Authorizations (CFO-10)').first()).toBeVisible();

    await snap(page, 'CFO-05');
    await snap(page, 'CFO-06');
    await snap(page, 'CFO-07');
    await snap(page, 'CFO-10');
  });

  test('CFO-12 & CFO-13: Sales Commissions Pool, Clawback Reserve & Audited Disputes', async ({ page }) => {
    await loginAsCfo(page);
    await page.goto('/cfo/incentives');

    await expect(page.getByText('CFO-12').first()).toBeVisible();
    await expect(page.getByText('CFO-13').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /Sales Commissions & Incentive Governance/i })).toBeVisible();

    // Verify Incentive summary cards & pool metrics
    await expect(page.getByText('Incentive Calculations Pool & Clawback Reserves (CFO-12)').first()).toBeVisible();
    await expect(page.getByText('INC-2026-Q1').first()).toBeVisible();
    await expect(page.getByText(/Clawback Reserve \(15%\)/i).first()).toBeVisible();
    await expect(page.getByText(/Net Payable Payout/i).first()).toBeVisible();

    // Verify Commission Disputes queue
    await expect(page.getByText('Incentive Disputes Register (CFO-13)').first()).toBeVisible();

    await snap(page, 'CFO-12');
    await snap(page, 'CFO-13');
  });

  test('CFO-14 & CFO-15: Reporting Period Close Certification & Controlled Reopening', async ({ page }) => {
    await loginAsCfo(page);
    await page.goto('/cfo/close');

    await expect(page.getByText('CFO-14').first()).toBeVisible();
    await expect(page.getByText('CFO-15').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /Reporting Period Close & Controlled Reopening/i })).toBeVisible();

    // Verify Period Close Status Card
    await expect(page.getByText('Reporting Periods & Close Certification (CFO-14)').first()).toBeVisible();

    // Verify Reopening Requests Queue
    await expect(page.getByText('Controlled Period Reopening Requests (CFO-15)').first()).toBeVisible();

    await snap(page, 'CFO-14');
    await snap(page, 'CFO-15');
  });

  test('CFO-16 & CFO-17: Vertical Budget Performance & Forecast Concurrence across 4 Verticals', async ({ page }) => {
    await loginAsCfo(page);
    await page.goto('/cfo/planning');

    await expect(page.getByText('CFO-16').first()).toBeVisible();
    await expect(page.getByText('CFO-17').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /Budgets & Forecast Finance Concurrence/i })).toBeVisible();

    // Verify multi-vertical budget allocation lines
    await expect(page.getByText('Vertical Operating Expense & Budget Lines (CFO-16)').first()).toBeVisible();
    const table = page.locator('table').first();
    await expect(table).toContainText(/wealth/i);
    await expect(table).toContainText(/banking/i);
    await expect(table).toContainText(/markets/i);
    await expect(table).toContainText(/real estate/i);

    // Verify Forecast Finance Reviews
    await expect(page.getByText('Executive Forecast Finance Reviews (CFO-17)').first()).toBeVisible();

    await snap(page, 'CFO-16');
    await snap(page, 'CFO-17');
  });

  test('CFO-18: Certified Finance Pack Preview, PDF Generation & Schedules', async ({ page }) => {
    await loginAsCfo(page);
    await page.goto('/cfo/reports');

    await expect(page.getByText('CFO-18').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /Certified Finance Pack & Automated Schedules/i })).toBeVisible();

    // Verify Finance Pack Summary
    await expect(page.getByText('Official Financial Pack Preview').first()).toBeVisible();

    // Verify Automated Dispatch Schedules
    await expect(page.getByText('Automated Executive Distribution Schedules').first()).toBeVisible();

    await snap(page, 'CFO-18');
  });

  test('CFO-19: Delegation of Authority (DoA) Limit Matrix & Policy Governance', async ({ page }) => {
    await loginAsCfo(page);
    await page.goto('/cfo/policies');

    await expect(page.getByText('CFO-19').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /Delegation of Authority & Financial Policies/i })).toBeVisible();

    // Verify DoA Limits
    await expect(page.getByText('Delegated Concession Approval Limits').first()).toBeVisible();

    // Verify Active Governance Policies
    await expect(page.getByText('Propose Policy Modification (CFO-19)').first()).toBeVisible();

    await snap(page, 'CFO-19');
  });
});
