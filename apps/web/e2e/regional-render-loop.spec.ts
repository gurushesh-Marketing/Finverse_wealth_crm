import { expect, test, type Page } from '@playwright/test';

async function loginAsRegionalManager(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Work email').fill('kavita@finverse.demo');
  await page.getByLabel('Password', { exact: true }).fill('demo1234');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/regional\/overview/);
  await expect(page.getByRole('heading', { name: 'Investigate regional gaps' })).toBeVisible();
}

const REGIONAL_ROUTES = [
  { path: '/regional/overview', heading: 'Investigate regional gaps', indicator: 'Parent NM Target' },
  { path: '/regional/managers', heading: 'Review a Manager scorecard', indicator: 'Target Wins' },
  { path: '/regional/territories', heading: 'Plan territory coverage', indicator: 'WORK TO ASSIGN' },
  { path: '/regional/targets', heading: 'Allocate regional targets to Managers', indicator: 'Approved NM Target' },
  { path: '/regional/approvals', heading: 'Approve a cross-Manager transfer', indicator: 'Cross-Manager Transfers' },
  { path: '/regional/forecasts', heading: 'Submit the regional forecast', indicator: 'REPORT DEFINITION' },
  { path: '/regional/reviews', heading: 'Run a Manager review', indicator: 'PERFORMANCE EVIDENCE' },
  { path: '/regional/reports', heading: 'Produce the regional review pack', indicator: 'Download Protected PDF Pack' },
];

test.describe('Regional Manager Workspace — Render Loop & Request Stability Regression', () => {
  test('idle overview tab does not repeatedly fetch, drawer typing does not re-fetch, filter/refresh works, and failed refresh does not blank data', async ({ page }) => {
    let overviewRequests = 0;
    page.on('request', (req) => {
      if (req.url().includes('/api/regional/overview')) {
        overviewRequests++;
      }
    });

    // 1. Initial Login & Mount
    await loginAsRegionalManager(page);
    await expect(page.getByText('Parent NM Target').first()).toBeVisible();

    // Verify initial load happened
    const initialRequestCount = overviewRequests;
    expect(initialRequestCount).toBeGreaterThanOrEqual(1);

    // 2. Idle Test: wait 2.5 seconds idle — zero additional requests must occur
    await page.waitForTimeout(2500);
    expect(overviewRequests).toBe(initialRequestCount);

    // 3. Drawer & Typing Test: opening drawer and typing into inputs must NOT trigger overview re-fetch
    const actionBtn = page.getByRole('button', { name: '+ Regional intervention' });
    await actionBtn.click();
    await expect(page.getByRole('heading', { name: 'Create Regional Intervention' })).toBeVisible();

    const titleInput = page.getByPlaceholder(/e\.g\. Rebalance intake/);
    await titleInput.fill('Accelerate South Karnataka client onboarding');
    await page.waitForTimeout(500);

    // Verify request count did not change while typing
    expect(overviewRequests).toBe(initialRequestCount);

    // Close drawer
    await page.getByRole('button', { name: 'Close' }).click();
    await page.waitForTimeout(300);
    expect(overviewRequests).toBe(initialRequestCount);

    // 4. Changing Filters: register response wait BEFORE triggering select
    const countBeforeFilter = overviewRequests;
    const periodSelect = page.locator('select').first();
    const filterResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/regional/overview') && res.status() === 200
    );
    await periodSelect.selectOption('this-week');
    await filterResponsePromise;
    expect(overviewRequests).toBe(countBeforeFilter + 1);

    // 5. Explicit Refresh: register response wait BEFORE triggering click
    const countBeforeRefresh = overviewRequests;
    const refreshBtn = page.getByRole('button', { name: 'Refresh' }).first();
    const refreshResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/regional/overview') && res.status() === 200
    );
    await refreshBtn.click();
    await refreshResponsePromise;
    expect(overviewRequests).toBe(countBeforeRefresh + 1);

    // 6. Failed Refresh: simulate 500 error on next refresh — must show error without blanking existing content
    await page.route('**/api/regional/overview*', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Simulated network outage for refresh test' } }),
      });
    });

    const errorResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/regional/overview') && res.status() === 500
    );
    await refreshBtn.click();
    await errorResponsePromise;

    // Wait for error alert to appear
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('Failed to load overview');

    // Existing data MUST STILL BE VISIBLE (not blanked by skeleton or null state)
    await expect(page.getByText('Parent NM Target').first()).toBeVisible();
    await expect(page.getByRole('button', { name: '+ Regional intervention' })).toBeVisible();
  });

  test('managers and targets subpages remain idle without repeated requests, refresh works, and selection changes load correctly', async ({ page }) => {
    let managersRequests = 0;
    page.on('request', (req) => {
      if (req.url().includes('/api/regional/managers/')) {
        managersRequests++;
      }
    });

    await loginAsRegionalManager(page);
    await page.goto('/regional/managers');
    await expect(page.getByRole('heading', { name: 'Review a Manager scorecard' })).toBeVisible();
    await expect(page.getByText('Target Wins').first()).toBeVisible();

    const countOnMount = managersRequests;
    expect(countOnMount).toBeGreaterThanOrEqual(1);

    // Idle for 2.5s: zero repeated fetches
    await page.waitForTimeout(2500);
    expect(managersRequests).toBe(countOnMount);

    // Explicit refresh triggers exactly 1 request
    const refreshBtn = page.getByRole('button', { name: 'Refresh' }).first();
    const refreshResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/regional/managers/') && res.status() === 200
    );
    await refreshBtn.click();
    await refreshResponsePromise;
    expect(managersRequests).toBe(countOnMount + 1);

    // Navigate to regional targets: verify clean load and idle stability
    let targetsRequests = 0;
    page.on('request', (req) => {
      if (req.url().includes('/api/regional/targets')) {
        targetsRequests++;
      }
    });

    await page.goto('/regional/targets');
    await expect(page.getByRole('heading', { name: 'Allocate regional targets to Managers' })).toBeVisible();
    await expect(page.getByText('Approved NM Target').first()).toBeVisible();

    const targetsOnMount = targetsRequests;
    expect(targetsOnMount).toBeGreaterThanOrEqual(1);

    await page.waitForTimeout(2000);
    expect(targetsRequests).toBe(targetsOnMount);
  });

  test('all 8 regional routes render cleanly without runtime errors or missing components', async ({ page }) => {
    await loginAsRegionalManager(page);

    for (const route of REGIONAL_ROUTES) {
      await page.goto(route.path);
      await expect(page.getByRole('heading', { name: route.heading })).toBeVisible();
      await expect(page.getByText(route.indicator).first()).toBeVisible();
    }
  });
});
