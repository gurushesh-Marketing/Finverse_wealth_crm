import { expect, test } from '@playwright/test';

test.describe('Banking Vertical — End-to-End Browser Verification', () => {

  test('1. Banking Sales Caller (Dev Kapoor) — Personal Workspace [Deck P036]', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Work email').fill('dev@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Verify redirect and landing on dashboard
    await page.waitForURL(/\/banking\/dashboard/);

    // Verify visual detailing matching Deck P036 image 2
    await expect(page.getByText('Personal Workspace')).toBeVisible();
    await expect(page.getByText('BANKING', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Your next conversation starts here.' })).toBeVisible();
    await expect(page.getByText('Banking scope')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Actions' })).toBeVisible();

    // Verify Banking pipeline stages within main workspace
    const mainArea = page.getByRole('main');
    await expect(mainArea.getByText('New').first()).toBeVisible();
    await expect(mainArea.getByText('Eligibility')).toBeVisible();
    await expect(mainArea.getByText('Documents')).toBeVisible();
    await expect(mainArea.getByText('Sanction')).toBeVisible();
    await expect(mainArea.getByText('Disbursal')).toBeVisible();

    // Open Actions modal and verify
    await page.getByRole('button', { name: 'Actions' }).click();
    await expect(page.getByText('SC-01 / MY DAY')).toBeVisible();
    await page.getByRole('button', { name: 'Close Guidance' }).click();
  });

  test('2. Banking Team Lead (Rohan Sen) — Team Command [Deck P037]', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Work email').fill('rohan@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Verify redirect to Team Command (/management/team)
    await page.waitForURL(/\/management\/team/);

    // Verify visual detailing matching Deck P037 image 3
    await expect(page.getByText('TEAM COMMAND')).toBeVisible();
    await expect(page.getByText('BANKING', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Keep the team in motion.' })).toBeVisible();
    await expect(page.getByText('Banking scope')).toBeVisible();

    // Verify priority card in spruce
    await expect(page.getByText('Allocation to resolve')).toBeVisible();

    // Verify 4 metric chips
    await expect(page.getByText('Active associates')).toBeVisible();
    await expect(page.getByText('Unassigned', { exact: true })).toBeVisible();
    await expect(page.getByText('SLA breaches')).toBeVisible();
    await expect(page.getByText('Wins / target')).toBeVisible();

    // Verify Team coverage table
    await expect(page.getByRole('heading', { name: 'Team coverage' })).toBeVisible();
  });

  test('3. Banking Regional Manager (Arjun Mehta) — Login, Authenticated Scope & Action [Deck P161]', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Work email').fill('arjun@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Verify landing on regional overview
    await page.waitForURL(/\/regional\/overview/);

    // Verify heading and Commercial Banking scope
    await expect(page.getByRole('heading', { name: 'Investigate regional gaps' })).toBeVisible();
    await expect(page.getByText(/Commercial Banking/).first()).toBeVisible();
    await expect(page.getByText('Ready for review')).toBeVisible();

    // Verify authenticated metric cards
    await expect(page.getByText('Parent NM Target')).toBeVisible();
    await expect(page.getByText('Achieved Wins')).toBeVisible();
    await expect(page.getByText('Regional Backlog')).toBeVisible();

    // Open Regional Intervention drawer
    const interventionBtn = page.getByRole('button', { name: '+ Regional intervention' });
    await expect(interventionBtn).toBeVisible();
    await interventionBtn.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Create Regional Intervention')).toBeVisible();

    // Fill title
    await dialog.locator('input[placeholder*="Rebalance intake"]').fill('Q4 Commercial Working Capital Review');

    // Select manager in drawer
    await dialog.locator('select').first().selectOption({ index: 1 });

    // Set due date
    await dialog.locator('input[type="datetime-local"]').fill('2026-11-01T10:00');

    // Submit intervention
    await dialog.getByRole('button', { name: 'Commit intervention' }).click();

    // Drawer closes on success
    await expect(dialog).not.toBeVisible();
  });

  test('4. Banking National Manager (Suresh Nair) — Login, Authenticated Scope & Action [Deck P181]', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Work email').fill('suresh@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Verify landing on national overview
    await page.waitForURL(/\/national\/overview/);

    // Verify heading and Commercial Banking national scope
    await expect(page.getByRole('heading', { name: 'Inspect national vertical performance' })).toBeVisible();
    await expect(page.getByText(/Commercial Banking/).first()).toBeVisible();

    // Verify authenticated national metrics
    await expect(page.getByText('Vertical Attainment')).toBeVisible();
    await expect(page.getByText('Unallocated Target')).toBeVisible();

    // Open National directive drawer
    const directiveBtn = page.getByRole('button', { name: '+ National directive' });
    await expect(directiveBtn).toBeVisible();
    await directiveBtn.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Issue National Directive to Regional Manager')).toBeVisible();

    await dialog.locator('input[placeholder*="South Region SLA"]').fill('Commercial Loan Turnaround SLA Alignment');

    // Select RM in drawer (2nd select inside drawer, after directive type select)
    await dialog.locator('select').nth(1).selectOption({ index: 1 });

    // Set date
    await dialog.locator('input[type="date"]').fill('2026-11-15');

    // Submit directive
    await dialog.getByRole('button', { name: 'Issue Directive' }).click();

    // Drawer closes on success
    await expect(dialog).not.toBeVisible();
  });

  test('5. CEO Workspace (Rajiv Mehta) — Multi-Vertical Banking Focus [Deck P201..P220]', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Work email').fill('rajiv@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await page.waitForURL(/\/ceo\/overview/);
    await expect(page.getByText('INSPECT COMPANY OPERATING PICTURE')).toBeVisible();
    await expect(page.getByText('Enterprise Revenue')).toBeVisible();

    // Verify Banking vertical represented in enterprise operating table
    await expect(page.getByRole('cell', { name: 'Corporate & Retail Banking' })).toBeVisible();
  });

  test('6. CFO Workspace (Ananya Roy) — Banking Financial Representation [Deck P221..P240]', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Work email').fill('ananya@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await page.waitForURL(/\/cfo\/overview/);
    await expect(page.getByRole('heading', { name: 'Financial Balances & Cash Run-Rate (CFO-01)' })).toBeVisible();
    await expect(page.getByText('Recognised Revenue').first()).toBeVisible();
  });

});
