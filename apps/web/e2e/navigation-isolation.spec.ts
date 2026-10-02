import { test, expect } from '@playwright/test';

/**
 * Wealth SC navigation isolation — shared login → permission-based landing →
 * sidebar shows only granted modules. Frontend/fixture contract test; the
 * fixture and seed enforce scope in this phase, NOT production authorization.
 */

async function login(page: import('@playwright/test').Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password').fill('demo1234');
  await page.getByRole('button', { name: 'Sign in' }).click();
  // Server action redirect can land after click returns — wait for the
  // permission-based landing before the test navigates anywhere.
  await page.waitForURL(/dashboard/, { timeout: 10000 });
}

test.describe('Wealth SC Navigation Isolation', () => {
  test('Wealth SC sees only Wealth modules in sidebar', async ({ page }) => {
    // Shared login; workspace root resolves the default module from the
    // server session and lands the Wealth SC on their dashboard.
    await login(page, 'asha@finverse.demo');
    await expect(page).toHaveURL('/wealth/dashboard');

    const sidebar = page.locator('aside[aria-label="Main navigation"]');
    await expect(sidebar).toBeVisible();

    // Exactly one Wealth group toggle, with its module region
    await expect(sidebar.locator('button[aria-controls="nav-wealth"]')).toHaveCount(1);

    // Exactly the eight Wealth modules, matched by user-facing name and href.
    // Exact role names scoped to the sidebar cannot collide with the session
    // footer text ("SC • wealth", "ASG-WEALTH-001").
    const wealthLinks = [
      { name: 'My day', href: '/wealth/dashboard' },
      { name: 'Lead Inbox', href: '/wealth/prospects' },
      { name: 'Conversations', href: '/wealth/activities' },
      { name: 'Calendar & tasks', href: '/wealth/tasks' },
      { name: 'My pipeline', href: '/wealth/deals' },
      { name: 'Documents', href: '/wealth/documents' },
      { name: 'Performance', href: '/wealth/reports' },
      { name: 'Reviews & help', href: '/wealth/reviews' },
    ] as const;
    for (const { name, href } of wealthLinks) {
      const link = sidebar.getByRole('link', { name, exact: true });
      await expect(link).toHaveCount(1);
      await expect(link).toHaveAttribute('href', href);
    }
    // No other links anywhere in the sidebar
    await expect(sidebar.getByRole('link')).toHaveCount(8);

    // Non-granted groups are not rendered at all (getAccessibleModuleGroups
    // drops groups with zero accessible modules) — assert the group controls
    // are absent, not "0 modules".
    for (const key of [
      'nav-banking',
      'nav-markets',
      'nav-real-estate',
      'nav-management',
      'nav-admin',
    ]) {
      await expect(sidebar.locator(`button[aria-controls="${key}"]`)).toHaveCount(0);
    }
  });

  test('Direct route /banking/dashboard is denied for Wealth SC', async ({ page }) => {
    // The Banking route now exists inside the shared application, so isolation
    // is enforced by server-side scope, not route absence: the Wealth SC must
    // receive an access-denied state with NO banking data and NO redirect to
    // another caller's content. (Production server-side authorization remains
    // a separate deliverable; this asserts the fixture/seed contract.)
    await login(page, 'asha@finverse.demo');
    const response = await page.goto('/banking/dashboard');

    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL('/banking/dashboard');
    await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
    await expect(page.getByText('Meera Textiles Pvt Ltd')).toHaveCount(0);
  });
});
