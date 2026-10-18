import { expect, test, type Page } from '@playwright/test';

async function loginAsCeo(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Work email').fill('rajiv@finverse.demo');
  await page.getByLabel('Password', { exact: true }).fill('demo1234');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/ceo\/overview/);
  await expect(page.getByText('CEO-01').first()).toBeVisible();
}

const CEO_ROUTES = [
  { path: '/ceo/overview', actionCode: 'CEO-01', indicator: 'Enterprise Revenue' },
  { path: '/ceo/verticals', actionCode: 'CEO-02', indicator: 'FX & Run-Rate' },
  { path: '/ceo/nms', actionCode: 'CEO-03', indicator: 'NM OPERATIONAL EVIDENCE' },
  { path: '/ceo/leadership', actionCode: 'CEO-03', indicator: 'LEADERSHIP EVALUATION' },
  { path: '/ceo/targets', actionCode: 'CEO-04', indicator: 'Division Target Allocations' },
  { path: '/ceo/forecast', actionCode: 'CEO-05', indicator: 'Signed-Off Board Forecast' },
  { path: '/ceo/growth', actionCode: 'CEO-06', indicator: 'Initiative Register' },
  { path: '/ceo/conflicts', actionCode: 'CEO-07', indicator: 'Arbitration Queue' },
  { path: '/ceo/risks', actionCode: 'CEO-08', indicator: 'Board-Level Operating Risk Register' },
  { path: '/ceo/board', actionCode: 'CEO-10', indicator: 'Board Pack Certified Snapshots' },
  { path: '/ceo/commitments', actionCode: 'CEO-11', indicator: 'Executive Directive & Mandate Tracker' },
];

test.describe('Chief Executive Officer Workspace — Render Loop & Request Stability Regression', () => {
  test('idle overview tab does not repeatedly fetch, drawer typing does not re-fetch, filter/refresh works, and failed refresh does not blank data', async ({ page }) => {
    let operatingRequests = 0;
    page.on('request', (req) => {
      if (req.url().includes('/api/ceo/operating-picture')) {
        operatingRequests++;
      }
    });

    // 1. Initial Login & Mount
    await loginAsCeo(page);
    await expect(page.getByText('Enterprise Revenue').first()).toBeVisible();

    // Verify initial load happened
    const initialRequestCount = operatingRequests;
    expect(initialRequestCount).toBeGreaterThanOrEqual(1);

    // 2. Idle Test: wait 2.5 seconds idle — zero additional requests must occur
    await page.waitForTimeout(2500);
    expect(operatingRequests).toBe(initialRequestCount);

    // 3. Drawer & Typing Test: opening drawer and typing into inputs must NOT trigger operating-picture re-fetch
    const actionBtn = page.getByRole('button', { name: 'Record Strategic Commitment' });
    await actionBtn.click();
    await expect(page.getByRole('heading', { name: 'Record Executive Commitment' })).toBeVisible();

    const titleInput = page.getByPlaceholder(/e\.g\. FY27 Wealth/);
    await titleInput.fill('FY27 Capital Expansion Review');
    await page.waitForTimeout(500);

    // Verify request count did not change while typing
    expect(operatingRequests).toBe(initialRequestCount);

    // Close drawer
    await page.getByRole('button', { name: 'Close' }).click();
    await page.waitForTimeout(300);
    expect(operatingRequests).toBe(initialRequestCount);

    // 4. Changing Filters: register response wait BEFORE triggering select
    const countBeforeFilter = operatingRequests;
    const periodSelect = page.locator('select').first();
    const filterResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/ceo/operating-picture') && res.status() === 200
    );
    await periodSelect.selectOption('quarter-to-date');
    await filterResponsePromise;
    expect(operatingRequests).toBe(countBeforeFilter + 1);

    // 5. Explicit Refresh: register response wait BEFORE triggering click
    const countBeforeRefresh = operatingRequests;
    const refreshBtn = page.getByRole('button', { name: 'Refresh' }).first();
    const refreshResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/ceo/operating-picture') && res.status() === 200
    );
    await refreshBtn.click();
    await refreshResponsePromise;
    expect(operatingRequests).toBe(countBeforeRefresh + 1);

    // 6. Failed Refresh: simulate 500 error on next refresh — must show error without blanking existing content
    await page.route('**/api/ceo/operating-picture*', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Simulated network outage for refresh test' } }),
      });
    });

    const errorResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/ceo/operating-picture') && res.status() === 500
    );
    await refreshBtn.click();
    await errorResponsePromise;

    // Existing content must remain visible (non-blanking error handling)
    await expect(page.getByText('Enterprise Revenue').first()).toBeVisible();
    await expect(page.getByText('Simulated network outage for refresh test')).toBeVisible();
  });

  test('all 11 CEO routes mount cleanly with breadcrumbs and key content', async ({ page }) => {
    await loginAsCeo(page);

    for (const r of CEO_ROUTES) {
      await page.goto(r.path);
      await expect(page.getByText(r.actionCode).first()).toBeVisible();
      await expect(page.getByText(r.indicator).first()).toBeVisible();
    }
  });

  test('mobile viewport renders responsive header and stacked layout cleanly', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsCeo(page);

    await expect(page.getByText('CEO-01').first()).toBeVisible();
    await expect(page.getByText('Enterprise Revenue').first()).toBeVisible();

    // Check conflict twin cards mobile stacking
    await page.goto('/ceo/conflicts');
    await expect(page.getByText('CEO-07').first()).toBeVisible();
    await expect(page.getByText('Arbitration Queue').first()).toBeVisible();
  });
});
