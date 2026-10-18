import { expect, test, type Page } from '@playwright/test';

async function loginAsCfo(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Work email').fill('ananya@finverse.demo');
  await page.getByLabel('Password', { exact: true }).fill('demo1234');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/cfo\/overview/);
  await expect(page.getByText('CFO-01').first()).toBeVisible();
}

const CFO_ROUTES = [
  { path: '/cfo/overview', actionCode: 'CFO-01', indicator: 'Financial Balances & Cash Run-Rate' },
  { path: '/cfo/recognition', actionCode: 'CFO-02', indicator: 'Revenue Recognition & Dual-Control Approvals' },
  { path: '/cfo/invoices', actionCode: 'CFO-04', indicator: 'Receivable Invoices & Ageing' },
  { path: '/cfo/payments', actionCode: 'CFO-05', indicator: 'Settled Receipts, Invoice Matching & Refunds' },
  { path: '/cfo/incentives', actionCode: 'CFO-12', indicator: 'Sales Commissions & Incentive Governance' },
  { path: '/cfo/close', actionCode: 'CFO-14', indicator: 'Reporting Period Close & Controlled Reopening' },
  { path: '/cfo/planning', actionCode: 'CFO-16', indicator: 'Budgets & Forecast Finance Concurrence' },
  { path: '/cfo/reports', actionCode: 'CFO-18', indicator: 'Certified Finance Pack & Automated Schedules' },
  { path: '/cfo/policies', actionCode: 'CFO-19', indicator: 'Delegation of Authority & Financial Policies' },
];

test.describe('Chief Financial Officer Workspace — Render Loop & Request Stability Regression', () => {
  test('idle overview tab does not repeatedly fetch, filter/refresh works cleanly without loops', async ({ page }) => {
    let overviewRequests = 0;
    page.on('request', (req) => {
      if (req.url().includes('/api/cfo/overview')) {
        overviewRequests++;
      }
    });

    // 1. Initial Login & Mount
    await loginAsCfo(page);
    await expect(page.getByText('Recognised Revenue').first()).toBeVisible();

    // Verify initial load happened
    const initialRequestCount = overviewRequests;
    expect(initialRequestCount).toBeGreaterThanOrEqual(1);

    // 2. Idle Test: wait 2.5 seconds idle — zero additional requests must occur
    await page.waitForTimeout(2500);
    expect(overviewRequests).toBe(initialRequestCount);

    // 3. Changing Period Filter: triggers exactly 1 fetch
    const countBeforeFilter = overviewRequests;
    const periodSelect = page.locator('select').first();
    const filterResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/cfo/overview') && res.status() === 200
    );
    await periodSelect.selectOption('FY26-Q2');
    await filterResponsePromise;
    expect(overviewRequests).toBe(countBeforeFilter + 1);

    // 4. Explicit Refresh: triggers exactly 1 fetch
    const countBeforeRefresh = overviewRequests;
    const refreshBtn = page.getByRole('button', { name: /Refresh/i }).first();
    const refreshResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/cfo/overview') && res.status() === 200
    );
    await refreshBtn.click();
    await refreshResponsePromise;
    expect(overviewRequests).toBe(countBeforeRefresh + 1);
  });

  test('all 9 CFO workspace routes mount cleanly on desktop and mobile without errors', async ({ page }) => {
    await loginAsCfo(page);

    // Desktop check
    await page.setViewportSize({ width: 1536, height: 800 });
    for (const route of CFO_ROUTES) {
      await page.goto(route.path);
      await expect(page.getByText(route.indicator).first()).toBeVisible({ timeout: 10000 });
    }

    // Mobile check
    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of CFO_ROUTES) {
      await page.goto(route.path);
      await expect(page.getByText(route.indicator).first()).toBeVisible({ timeout: 10000 });
    }
  });
});
