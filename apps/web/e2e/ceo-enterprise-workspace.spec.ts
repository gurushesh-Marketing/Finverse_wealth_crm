import { expect, test, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const SCREENSHOT_DIR = path.resolve(process.cwd(), '../../evidence/screenshots/ceo_workspace');
const ROOT_SCREENSHOT_DIR = path.resolve(process.cwd(), '../../evidence/screenshots');

function isMobile(): boolean {
  return test.info().project.name.startsWith('mobile');
}

async function snap(page: Page, actionCode: string) {
  const suffix = isMobile() ? 'mobile' : 'desktop';
  const fileName = `${actionCode}_${suffix}.png`;
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, fileName), fullPage: true });
  await page.screenshot({ path: path.join(ROOT_SCREENSHOT_DIR, fileName), fullPage: true });
}

test.beforeAll(() => {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
});

async function loginAsCeo(page: Page) {
  await page.goto('/ceo/overview');
  const alreadyOnOverview = await page.getByText('CEO-01').first().isVisible({ timeout: 1500 }).catch(() => false);
  if (alreadyOnOverview) return;

  await page.goto('/login');
  await page.waitForTimeout(300);
  if (page.url().includes('/login')) {
    await page.getByLabel('Work email').fill('rajiv@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/ceo\/overview/);
  }
  await expect(page.getByText('CEO-01').first()).toBeVisible();
}

test.describe('CEO Workspace — Full Enterprise Multi-Vertical Verification (CEO-01..CEO-11)', () => {
  test('Security: Non-CEO users are blocked from accessing CEO routes', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/login');
    await page.getByLabel('Work email').fill('asha@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/wealth\/dashboard/);

    // Attempt direct navigation to CEO workspace
    await page.goto('/ceo/overview');
    await expect(page.getByText('Workspace unavailable')).toBeVisible();
    await expect(page.getByText(/outside your current scope/i)).toBeVisible();
  });

  test('CEO-01: Company Operating Picture across 4 Verticals', async ({ page }) => {
    await loginAsCeo(page);
    await page.goto('/ceo/overview');

    await expect(page.getByText('CEO-01').first()).toBeVisible();
    await expect(page.getByText('Enterprise Revenue').first()).toBeVisible();
    await expect(page.getByText('Division Attainment & Leadership Performance').first()).toBeVisible();

    // Verify all 4 vertical divisions are visible in the table
    const table = page.locator('table');
    await expect(table).toContainText('Wealth Management');
    await expect(table).toContainText('Commercial Banking');
    await expect(table).toContainText('Markets & Trading');
    await expect(table).toContainText('Real Estate Advisory');

    // Verify National Leaders are rendered
    await expect(table).toContainText('Vikram Malhotra');
    await expect(table).toContainText('Suresh Nair');
    await expect(table).toContainText('Sanjay Singhania');
    await expect(table).toContainText('Aditya Singhania');

    await snap(page, 'CEO-01');
  });

  test('CEO-02: Compare Verticals Fairly across 4 Divisions', async ({ page }) => {
    await loginAsCeo(page);
    await page.goto('/ceo/verticals');
    await expect(page.getByText('CEO-02').first()).toBeVisible();
    await expect(page.getByText('COMPARE VERTICALS FAIRLY').first()).toBeVisible();

    // Check all 4 vertical cards by their exact names
    await expect(page.getByText('Wealth Management').first()).toBeVisible();
    await expect(page.getByText('Corporate & Retail Banking').first()).toBeVisible();
    await expect(page.getByText('Markets & Trading').first()).toBeVisible();
    await expect(page.getByText('Real Estate Advisory').first()).toBeVisible();

    await snap(page, 'CEO-02');
  });

  test('CEO-03 & CEO-09: NM Leadership Review & 4-NM Directory Toggle', async ({ page }) => {
    await loginAsCeo(page);
    await page.goto('/ceo/nms');
    await expect(page.getByText('CEO-03 / CEO-09').first()).toBeVisible();

    // Verify NM Directory Selector has all 4 NMs
    await expect(page.getByRole('button', { name: /Vikram Malhotra/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Suresh Nair/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Sanjay Singhania/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Aditya Singhania/ })).toBeVisible();

    // Switch to Real Estate NM Aditya Singhania
    await page.getByRole('button', { name: /Aditya Singhania/ }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText('Real Estate Advisory').first()).toBeVisible();

    // Switch to Commercial Banking NM Suresh Nair
    await page.getByRole('button', { name: /Suresh Nair/ }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText('Commercial Banking').first()).toBeVisible();

    await snap(page, 'CEO-03');
    await snap(page, 'CEO-09');
  });

  test('CEO-04: Approve Targets and 4-Vertical Cascade', async ({ page }) => {
    await loginAsCeo(page);
    await page.goto('/ceo/targets');
    await expect(page.getByText('CEO-04').first()).toBeVisible();
    await expect(page.getByText('APPROVE COMPANY & VERTICAL TARGETS').first()).toBeVisible();

    // Check that all 4 divisions exist in the allocation table
    const table = page.locator('table');
    await expect(table).toContainText(/wealth/i);
    await expect(table).toContainText(/banking/i);
    await expect(table).toContainText(/markets/i);
    await expect(table).toContainText(/real_estate|real-estate/i);

    // Verify active leaders
    await expect(table).toContainText('Vikram Malhotra');
    await expect(table).toContainText('Suresh Nair');
    await expect(table).toContainText('Sanjay Singhania');
    await expect(table).toContainText('Aditya Singhania');

    await snap(page, 'CEO-04');
  });

  test('CEO-05: Consolidated Forecast with Bottom-Up Submissions', async ({ page }) => {
    await loginAsCeo(page);
    await page.goto('/ceo/forecast');
    await expect(page.getByText('CEO-05').first()).toBeVisible();
    await expect(page.getByText('Division Bottom-Up Submissions').first()).toBeVisible();

    // Verify all 4 vertical submissions are listed in the table
    const table = page.locator('table');
    await expect(table).toContainText(/wealth/i);
    await expect(table).toContainText(/banking/i);
    await expect(table).toContainText(/markets/i);
    await expect(table).toContainText(/real estate/i);

    await snap(page, 'CEO-05');
  });

  test('CEO-06: Growth Initiatives Register', async ({ page }) => {
    await loginAsCeo(page);
    await page.goto('/ceo/growth');
    await expect(page.getByText('CEO-06').first()).toBeVisible();
    await expect(page.getByText('Initiative Register & Capital Commitments').first()).toBeVisible();

    await snap(page, 'CEO-06');
  });

  test('CEO-07: Cross-Vertical Priority Conflicts', async ({ page }) => {
    await loginAsCeo(page);
    await page.goto('/ceo/conflicts');
    await expect(page.getByText('CEO-07').first()).toBeVisible();
    await expect(page.getByText('RESOLVE CROSS-VERTICAL PRIORITY CONFLICT').first()).toBeVisible();

    await snap(page, 'CEO-07');
  });

  test('CEO-08: Operating Risks Register', async ({ page }) => {
    await loginAsCeo(page);
    await page.goto('/ceo/risks');
    await expect(page.getByText('CEO-08').first()).toBeVisible();
    await expect(page.getByText('Board-Level Operating Risk Register').first()).toBeVisible();

    await snap(page, 'CEO-08');
  });

  test('CEO-10: Board Meeting Pack & Schedules', async ({ page }) => {
    await loginAsCeo(page);
    await page.goto('/ceo/board');
    await expect(page.getByText('CEO-10').first()).toBeVisible();
    await expect(page.getByText('Board Pack Certified Snapshots').first()).toBeVisible();

    await snap(page, 'CEO-10');
  });

  test('CEO-11: Executive Commitments Tracker', async ({ page }) => {
    await loginAsCeo(page);
    await page.goto('/ceo/commitments');
    await expect(page.getByText('CEO-11').first()).toBeVisible();
    await expect(page.getByText('Executive Directive & Mandate Tracker').first()).toBeVisible();

    await snap(page, 'CEO-11');
  });
});
