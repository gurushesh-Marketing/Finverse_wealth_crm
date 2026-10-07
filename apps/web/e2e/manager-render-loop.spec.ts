import { expect, test, type Page } from '@playwright/test';

async function loginAsManager(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Work email').fill('neel@finverse.demo');
  await page.getByLabel('Password', { exact: true }).fill('demo1234');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/manager\/overview/);
  await expect(page.getByRole('heading', { name: 'Manager overview' })).toBeVisible();
}

const MANAGER_ROUTES = [
  { path: '/manager/overview', heading: 'Manager overview', indicator: 'Team Leader Contribution & Backlog' },
  { path: '/manager/leaders', heading: 'Team leaders & source quality', indicator: 'TL Operating Profile' },
  { path: '/manager/capacity', heading: 'Capacity, transfers & promotions', indicator: 'Request Cross-Team Transfer' },
  { path: '/manager/targets', heading: 'Target distribution to TLs', indicator: 'Parent Target Reconciliation' },
  { path: '/manager/forecasts', heading: 'Pipeline & forecast', indicator: 'Submitted Team Lead Forecasts' },
  { path: '/manager/exceptions', heading: 'Exceptions & escalation resolution', indicator: 'SLA Breaches & Overdue Task Escalations' },
  { path: '/manager/reviews', heading: 'Team lead performance reviews', indicator: 'Conduct Performance Review' },
  { path: '/manager/reports', heading: 'Manager meeting pack & schedules', indicator: 'Pack Preview — Executive Summary' },
];

test.describe('Manager Workspace — Render Loop & Request Stability Regression', () => {
  test('idle overview tab does not repeatedly fetch, drawer typing does not re-fetch, filter/refresh works, and failed refresh does not blank data', async ({ page }) => {
    let overviewRequests = 0;
    page.on('request', (req) => {
      if (req.url().includes('/api/manager/overview')) {
        overviewRequests++;
      }
    });

    // 1. Initial Login & Mount
    await loginAsManager(page);
    await expect(page.getByText('Team Leader Contribution & Backlog')).toBeVisible();

    // Verify initial load happened
    const initialRequestCount = overviewRequests;
    expect(initialRequestCount).toBeGreaterThanOrEqual(1);

    // 2. Idle Test: wait 2.5 seconds idle — zero additional requests must occur
    await page.waitForTimeout(2500);
    expect(overviewRequests).toBe(initialRequestCount);

    // 3. Drawer & Typing Test: opening drawer and typing into inputs must NOT trigger overview re-fetch
    const assignBtn = page.getByRole('button', { name: 'Assign Action' }).first();
    await assignBtn.click();
    await expect(page.getByRole('heading', { name: 'Assign Management Intervention' })).toBeVisible();

    const titleInput = page.getByPlaceholder(/e\.g\. Clear overdue/);
    await titleInput.fill('Urgent backlog resolution directive');
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
      (res) => res.url().includes('/api/manager/overview') && res.status() === 200
    );
    await periodSelect.selectOption('this-week');
    await filterResponsePromise;
    expect(overviewRequests).toBe(countBeforeFilter + 1);

    // 5. Explicit Refresh: register response wait BEFORE triggering click
    const countBeforeRefresh = overviewRequests;
    const refreshBtn = page.getByRole('button', { name: 'Refresh' });
    const refreshResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/manager/overview') && res.status() === 200
    );
    await refreshBtn.click();
    await refreshResponsePromise;
    expect(overviewRequests).toBe(countBeforeRefresh + 1);

    // 6. Failed Refresh: simulate 500 error on next refresh — must show error without blanking existing content
    await page.route('**/api/manager/overview*', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Simulated network outage for refresh test' } }),
      });
    });

    const errorResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/manager/overview') && res.status() === 500
    );
    await refreshBtn.click();
    await errorResponsePromise;

    // Wait for error alert to appear
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('Failed to load overview');

    // Existing data MUST STILL BE VISIBLE (not blanked by skeleton or null state)
    await expect(page.getByText('Team Leader Contribution & Backlog')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Assign Action' }).first()).toBeVisible();
  });

  test('leaders and targets subpages remain idle without repeated requests, refresh works, and input typing does not re-fetch', async ({ page }) => {
    let leadersRequests = 0;
    page.on('request', (req) => {
      if (req.url().includes('/api/manager/scorecard/') || req.url().includes('/api/manager/source-quality')) {
        leadersRequests++;
      }
    });

    await loginAsManager(page);
    await page.goto('/manager/leaders');
    await expect(page.getByText('TL Operating Profile')).toBeVisible();

    const countOnMount = leadersRequests;
    expect(countOnMount).toBeGreaterThanOrEqual(1);

    // Idle for 2.5s: zero repeated fetches
    await page.waitForTimeout(2500);
    expect(leadersRequests).toBe(countOnMount);

    // Explicit Refresh on scorecard: register response wait before triggering click
    const scorecardRefreshPromise = page.waitForResponse(
      (res) => res.url().includes('/api/manager/scorecard/') && res.status() === 200
    );
    await page.getByRole('button', { name: 'Refresh' }).click();
    await scorecardRefreshPromise;
    expect(leadersRequests).toBe(countOnMount + 1);

    // Switch to Source Quality tab
    await page.getByRole('button', { name: 'Source Quality (MG-10)' }).click();
    await expect(page.getByText('Lead Source Quality Cohort')).toBeVisible();

    // Open remediation drawer and type into justification
    const remBtn = page.getByRole('button', { name: 'Remediate' }).first();
    await remBtn.click();
    await expect(page.getByRole('heading', { name: 'Request Source Remediation' })).toBeVisible();

    const justTextarea = page.getByPlaceholder(/Explain defect patterns/);
    await justTextarea.fill('Investigating lead drop-off due to invalid phone numbers');
    await page.waitForTimeout(500);

    // Verify request count did not change while typing
    expect(leadersRequests).toBe(countOnMount + 1);

    // Close drawer
    await page.getByRole('button', { name: 'Close' }).click();

    // Switch to Targets page
    let targetsRequests = 0;
    page.on('request', (req) => {
      if (req.url().includes('/api/manager/targets')) {
        targetsRequests++;
      }
    });

    await page.goto('/manager/targets');
    await expect(page.getByText('Parent Target Reconciliation')).toBeVisible();

    const targetsOnMount = targetsRequests;
    expect(targetsOnMount).toBeGreaterThanOrEqual(1);

    // Idle 2s: zero repeated requests
    await page.waitForTimeout(2000);
    expect(targetsRequests).toBe(targetsOnMount);

    // Typing into allocation input: zero additional network requests
    const firstAllocInput = page.locator('input[type="number"]').first();
    await firstAllocInput.fill('45');
    await page.waitForTimeout(500);
    expect(targetsRequests).toBe(targetsOnMount);
  });

  // Compact Parameterized Idle-Request Stability across all eight Manager routes
  for (const { path, heading, indicator } of MANAGER_ROUTES) {
    test(`route ${path} settles and stops fetching when idle`, async ({ page }) => {
      let managerRequests = 0;
      page.on('request', (req) => {
        if (req.url().includes('/api/manager/')) {
          managerRequests++;
        }
      });

      await loginAsManager(page);
      if (path !== '/manager/overview') {
        await page.goto(path);
      }

      await expect(page.getByRole('heading', { name: heading })).toBeVisible();
      await expect(page.getByText(indicator).first()).toBeVisible();

      // Settle initial load
      await page.waitForLoadState('networkidle');
      const requestsOnSettled = managerRequests;
      expect(requestsOnSettled).toBeGreaterThanOrEqual(1);

      // Verify zero additional requests occur during idle window
      await page.waitForTimeout(1500);
      expect(managerRequests).toBe(requestsOnSettled);
    });
  }
});
