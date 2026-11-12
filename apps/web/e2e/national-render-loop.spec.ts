import { expect, test, type Page } from '@playwright/test';

async function loginAsNationalManager(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Work email').fill('vikram@finverse.demo');
  await page.getByLabel('Password', { exact: true }).fill('demo1234');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/national\/overview/);
  await expect(page.getByRole('heading', { name: 'Inspect national vertical performance' })).toBeVisible();
}

const NATIONAL_ROUTES = [
  { path: '/national/overview', heading: 'Inspect national vertical performance', indicator: 'Vertical Attainment' },
  { path: '/national/regions', heading: 'Compare regions and open an RM scorecard', indicator: 'Target Wins' },
  { path: '/national/plan', heading: 'Allocate the national target to regions', indicator: 'Regional Target Distribution Editor' },
  { path: '/national/economics', heading: 'Review product and source economics', indicator: 'Acquisition Channel Efficiency' },
  { path: '/national/rules', heading: 'Propose pipeline or product rule changes', indicator: 'Submitted Pipeline & Qualification Proposals' },
  { path: '/national/forecast', heading: 'Submit the national forecast', indicator: 'Regional Submissions Rollup' },
  { path: '/national/transfers', heading: 'Approve a cross-region work transfer', indicator: 'Transfer Queue & History' },
  { path: '/national/referrals', heading: 'Accept or decline a cross-vertical referral', indicator: 'Inbound Cross-Vertical Referrals Queue' },
  { path: '/national/escalations', heading: 'Escalate a national commercial or finance issue', indicator: 'Executive Escalation Register' },
  { path: '/national/reviews', heading: 'Run an RM performance review', indicator: 'Completed RM Evaluations Register' },
  { path: '/national/reports', heading: 'Prepare the national executive pack', indicator: 'Executive Pack Preview' },
];

test.describe('National Manager Workspace — Render Loop & Request Stability Regression', () => {
  test('idle overview tab does not repeatedly fetch, drawer typing does not re-fetch, filter/refresh works, and failed refresh does not blank data', async ({ page }) => {
    let overviewRequests = 0;
    page.on('request', (req) => {
      if (req.url().includes('/api/national/overview')) {
        overviewRequests++;
      }
    });

    // 1. Initial Login & Mount
    await loginAsNationalManager(page);
    await expect(page.getByText('Vertical Attainment').first()).toBeVisible();

    // Verify initial load happened
    const initialRequestCount = overviewRequests;
    expect(initialRequestCount).toBeGreaterThanOrEqual(1);

    // 2. Idle Test: wait 2.5 seconds idle — zero additional requests must occur
    await page.waitForTimeout(2500);
    expect(overviewRequests).toBe(initialRequestCount);

    // 3. Drawer & Typing Test: opening drawer and typing into inputs must NOT trigger overview re-fetch
    const actionBtn = page.getByRole('button', { name: '+ National directive' });
    await actionBtn.click();
    await expect(page.getByRole('heading', { name: 'Issue National Directive to Regional Manager' })).toBeVisible();

    const titleInput = page.getByPlaceholder(/e\.g\. South Region SLA/);
    await titleInput.fill('Accelerate West territory SLA recovery');
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
      (res) => res.url().includes('/api/national/overview') && res.status() === 200
    );
    await periodSelect.selectOption('this-week');
    await filterResponsePromise;
    expect(overviewRequests).toBe(countBeforeFilter + 1);

    // 5. Explicit Refresh: register response wait BEFORE triggering click
    const countBeforeRefresh = overviewRequests;
    const refreshBtn = page.getByRole('button', { name: 'Refresh' }).first();
    const refreshResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/national/overview') && res.status() === 200
    );
    await refreshBtn.click();
    await refreshResponsePromise;
    expect(overviewRequests).toBe(countBeforeRefresh + 1);

    // 6. Failed Refresh: simulate 500 error on next refresh — must show error without blanking existing content
    await page.route('**/api/national/overview*', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Simulated network outage for refresh test' } }),
      });
    });

    const errorResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/national/overview') && res.status() === 500
    );
    await refreshBtn.click();
    await errorResponsePromise;

    // Wait for error alert to appear
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('Failed to load overview');

    // Existing data MUST STILL BE VISIBLE (not blanked by skeleton or null state)
    await expect(page.getByText('Vertical Attainment').first()).toBeVisible();

    // Dismiss error alert
    await page.getByRole('button', { name: 'Dismiss' }).click();
    await expect(page.getByRole('alert')).not.toBeVisible();
  });

  test('all 11 national routes mount cleanly without render loops or runtime errors', async ({ page }) => {
    await loginAsNationalManager(page);

    for (const route of NATIONAL_ROUTES) {
      let routeRequests = 0;
      const requestListener = (req: any) => {
        if (req.url().includes('/api/national/')) {
          routeRequests++;
        }
      };
      page.on('request', requestListener);

      await page.goto(route.path);
      await expect(page.getByRole('heading', { name: route.heading })).toBeVisible();
      await expect(page.getByText(route.indicator).first()).toBeVisible();

      // Wait 1.5 seconds idle on each page — ensure no continuous loop
      const countAfterLoad = routeRequests;
      await page.waitForTimeout(1500);
      expect(routeRequests).toBe(countAfterLoad);

      page.off('request', requestListener);
    }
  });
});
