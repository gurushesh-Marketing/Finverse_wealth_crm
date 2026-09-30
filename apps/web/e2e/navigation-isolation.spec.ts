import { test, expect } from '@playwright/test';

test.describe('Wealth SC Navigation Isolation', () => {
  test('Wealth SC sees only Wealth modules in sidebar', async ({ page }) => {
    // Navigate to the workspace root (will redirect to wealth dashboard)
    await page.goto('/(workspace)');

    // Wait for sidebar to load
    const sidebar = page.locator('aside[aria-label="Main navigation"]');
    await expect(sidebar).toBeVisible();

    // Count modules in each group
    const wealthGroup = sidebar.locator('div').filter({ hasText: 'Wealth' });
    const bankingGroup = sidebar.locator('div').filter({ hasText: 'Banking' });
    const marketsGroup = sidebar.locator('div').filter({ hasText: 'Markets' });
    const realEstateGroup = sidebar.locator('div').filter({ hasText: 'Real Estate' });
    const managementGroup = sidebar.locator('div').filter({ hasText: 'Management' });
    const adminGroup = sidebar.locator('div').filter({ hasText: 'Administration' });

    // Expand groups if needed and count modules
    // Wealth group should have 5 modules
    await expect(wealthGroup.locator('ul li')).toHaveCount(5);

    // Other groups should have 0 modules (not visible or not rendered)
    await expect(bankingGroup.locator('ul li')).toHaveCount(0);
    await expect(marketsGroup.locator('ul li')).toHaveCount(0);
    await expect(realEstateGroup.locator('ul li')).toHaveCount(0);
    await expect(managementGroup.locator('ul li')).toHaveCount(0);
    await expect(adminGroup.locator('ul li')).toHaveCount(0);
  });

  test('Direct route /banking/dashboard is denied for Wealth SC', async ({ page }) => {
    // Try to access banking dashboard directly
    await page.goto('/(workspace)/banking/dashboard');

    // Should redirect to unauthorized or wealth dashboard
    await page.waitForURL(url => {
      return url.pathname.includes('/unauthorized') ||
             url.pathname.includes('/wealth/dashboard');
    });

    // Verify we're not on the banking dashboard
    await expect(page).not.toHaveURL('*/banking/dashboard');
  });
});