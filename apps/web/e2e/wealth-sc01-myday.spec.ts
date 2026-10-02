import { test, expect } from '@playwright/test';

/**
 * SC-01 "Start the day and prioritise work" — Wealth "My day" dashboard.
 * Covers: shared login → root resolution → /wealth/dashboard; overdue-first
 * priority; work-review counts; availability Away→Available persistence;
 * access-pending for a zero-grant user; provider simulator stale-data badge.
 * Frontend + local-database contract tests (fixture/seed scope, NOT production
 * authorization).
 */

async function login(page: import('@playwright/test').Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password').fill('demo1234');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/dashboard/, { timeout: 10000 });
}

test.describe('Wealth SC-01 — My day', () => {
  // Availability and provider status are persisted in the shared local DB;
  // run serially so each test's assertions own the state they mutate.
  test.describe.configure({ mode: 'serial' });

  test('asha lands on /wealth/dashboard; priority and counts render', async ({ page }) => {
    await login(page, 'asha@finverse.demo');
    await expect(page).toHaveURL('/wealth/dashboard');
    await expect(page.getByRole('heading', { name: 'Start the day and prioritise work.' })).toBeVisible();

    // As-of timestamp shown prominently
    await expect(page.getByText(/As of/).first()).toBeVisible();

    // Overdue-first priority row links to a prospect record
    const openWork = page.getByRole('link', { name: /Open work area/ }).first();
    await expect(openWork).toBeVisible();
    await expect(openWork).toHaveAttribute('href', /\/wealth\/prospects\//);

    // Work review rows show real (deterministic) counts
    await expect(page.getByRole('link', { name: /New lead deadlines/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Uncontacted today/ })).toContainText('02');
    await expect(page.getByRole('link', { name: /Replies to review/ })).toContainText('01');

    // Verified activity KPI carries the required label
    await expect(page.getByText('Verified activity and approved outcomes only')).toBeVisible();
  });

  test('availability Away → Available persists across reload with success feedback', async ({ page }) => {
    await login(page, 'asha@finverse.demo');
    await expect(page).toHaveURL('/wealth/dashboard');

    const select = page.locator('#availability-status');

    // Keyboard operability: focus + ArrowDown moves the select
    await select.selectOption('available');
    await select.focus();
    await page.keyboard.press('ArrowDown');
    await expect(select).toHaveValue('busy');

    // Away → save → success feedback → persists across reload
    await select.selectOption('away');
    await page.getByRole('button', { name: 'Save availability' }).click();
    await expect(page.getByText('Availability saved.')).toBeVisible();
    await expect(page.getByTestId('availability-current')).toContainText('Away');

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('availability-current')).toContainText('Away');

    // Available → save → persists across reload
    await page.locator('#availability-status').selectOption('available');
    await page.getByRole('button', { name: 'Save availability' }).click();
    await expect(page.getByText('Availability saved.')).toBeVisible();
    await expect(page.getByTestId('availability-current')).toContainText('Available');

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('availability-current')).toContainText('Available');
  });

  test('trainee lands on the access-pending state with zero workload', async ({ page }) => {
    await login(page, 'trainee@finverse.demo');
    await expect(page).toHaveURL('/wealth/dashboard');

    await expect(page.getByRole('heading', { name: 'Access pending' })).toBeVisible();
    await expect(page.getByText('No active assignment — access pending. Contact your administrator.')).toBeVisible();

    // Zero workload data
    await expect(page.getByRole('link', { name: /Open work area/ })).toHaveCount(0);
    await expect(page.getByText('Verified activity and approved outcomes only')).toHaveCount(0);
    await expect(page.getByText("Today's commitments")).toHaveCount(0);
    await expect(page.getByText('FV-1042')).toHaveCount(0);
  });

  test('provider simulator Delayed shows stale-data badge and keeps counts; Connected clears it', async ({ page }) => {
    await login(page, 'asha@finverse.demo');
    await expect(page).toHaveURL('/wealth/dashboard');

    // Delayed → stale badge appears, verified-activity count is kept (not zeroed)
    await page.getByRole('button', { name: 'Delayed' }).click();
    await expect(page.getByTestId('provider-status')).toHaveText('Delayed');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('stale-data-badge')).toBeVisible();
    await expect(page.getByTestId('verified-activity-count')).toHaveText('1');

    // Connected → badge clears, count still kept
    await page.getByRole('button', { name: 'Connected' }).click();
    await expect(page.getByTestId('provider-status')).toHaveText('Connected');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('stale-data-badge')).toHaveCount(0);
    await expect(page.getByTestId('verified-activity-count')).toHaveText('1');
  });
});
