import { test, expect } from '@playwright/test';

/**
 * Banking caller journey — shared login → authorized dashboard → assigned lead
 * queue → prospect detail → validated follow-up save → logout/login persistence.
 * Covers SC-01 (queue priority), SC-02 (search/filter scope), SC-03 (record),
 * SC-11 (follow-up). Frontend + local-database contract tests; fixture/seed
 * isolation only — NOT production authorization.
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

test.describe('Banking caller journey', () => {
  test('queue → detail → save follow-up → persists across logout/login', async ({ page }) => {
    // Shared login lands on the permission-based workspace dashboard
    await login(page, 'ravi@finverse.demo');
    await expect(page).toHaveURL('/banking/dashboard');
    await expect(page.getByRole('heading', { name: 'Your next conversation starts here.' })).toBeVisible();

    // Assigned lead queue: only this caller's leads (SC-01/SC-02 scope)
    await page.getByRole('link', { name: 'Open assigned lead queue' }).click();
    await expect(page).toHaveURL('/banking/clients');
    await expect(page.getByRole('link', { name: 'FV-2001' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'FV-2002' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'FV-2003' })).toBeVisible();
    await expect(page.getByText('Orbit Retail Chains')).toHaveCount(0); // another caller's lead

    // Search filter works (GET form — await its navigation before clicking rows)
    await page.getByLabel('Search').fill('Greenfield');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await page.waitForURL(/search=Greenfield/, { timeout: 10000 });
    await expect(page.getByRole('link', { name: 'FV-2003' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'FV-2001' })).toHaveCount(0);

    // Prospect detail with honest simulated controls (SC-03)
    await page.getByRole('link', { name: 'FV-2003' }).click();
    await expect(page).toHaveURL('/banking/clients/FV-2003');
    await expect(page.getByRole('heading', { name: 'Greenfield Agro Foods' })).toBeVisible();
    await expect(page.getByRole('button', { name: /SIMULATED/ })).toHaveCount(2);

    // Follow-up validation (SC-11): missing purpose blocks the save
    await page.getByLabel('Purpose').fill('');
    await page.getByLabel('Due date and time').fill('2030-01-01T10:00');
    await page.getByRole('button', { name: 'Save follow-up' }).click();
    await expect(page.getByText('Purpose is required.')).toBeVisible();

    // Past due date is rejected
    await page.getByLabel('Purpose').fill('Confirm documents');
    await page.getByLabel('Due date and time').fill('2020-01-01T10:00');
    await page.getByRole('button', { name: 'Save follow-up' }).click();
    await expect(page.getByText('Due date and time must be in the future.')).toBeVisible();

    // Valid save succeeds and appears in Tasks and the timeline. Server
    // actions reset uncontrolled fields after each submit — refill all fields.
    await page.getByLabel('Next action').selectOption('Follow-up call');
    await page.getByLabel('Due date and time').fill('2030-01-02T11:00');
    await page.getByLabel('Purpose').fill('Confirm documents');
    await page.getByRole('button', { name: 'Save follow-up' }).click();
    await expect(page.getByText('Follow-up saved.')).toBeVisible();
    await page.getByRole('tab', { name: 'Timeline' }).click();
    await expect(page.getByText('Follow-up scheduled: Follow-up call').first()).toBeVisible();
    await expect(page.getByText('Confirm documents').first()).toBeVisible();

    // Logout / login — the saved follow-up persists (local database)
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL('/login');
    await login(page, 'ravi@finverse.demo');
    await page.goto('/banking/clients/FV-2003');
    await page.waitForLoadState('networkidle');
    await page.getByRole('tab', { name: 'Timeline' }).click();
    await expect(page.getByText('Follow-up scheduled: Follow-up call').first()).toBeVisible();
    await expect(page.getByText('Confirm documents').first()).toBeVisible();
  });

  test('another caller and another vertical cannot access the record', async ({ page }) => {
    // Same team vertical, different caller (Sana) cannot see Ravi's lead
    await login(page, 'sana@finverse.demo');
    await page.goto('/banking/clients/FV-2003');
    await expect(page.getByRole('heading', { name: 'Not in your permitted workload' })).toBeVisible();
    await expect(page.getByText('Greenfield Agro Foods')).toHaveCount(0);
    // Sana's own queue excludes Ravi's leads
    await page.goto('/banking/clients');
    await expect(page.getByRole('link', { name: 'FV-2004' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'FV-2003' })).toHaveCount(0);

    // Other vertical (Wealth caller) cannot read the banking record
    await page.getByRole('button', { name: 'Sign out' }).click();
    await login(page, 'asha@finverse.demo');
    await page.goto('/banking/clients/FV-2003');
    await expect(page.getByText('Greenfield Agro Foods')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
  });
});
