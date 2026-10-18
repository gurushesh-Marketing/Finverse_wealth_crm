import { expect, test } from '@playwright/test';

test.describe('Markets & Securities Vertical — End-to-End Browser Verification', () => {

  test('1. Markets Sales Caller (Kabir Joshi) — Personal Workspace [Deck P038]', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Work email').fill('kabir@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Verify redirect and landing on Markets dashboard
    await page.waitForURL(/\/markets\/dashboard/);

    // Verify visual detailing matching Deck P038
    await expect(page.getByText('Personal Workspace')).toBeVisible();
    await expect(page.getByText('MARKETS & SECURITIES')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Your next conversation starts here.' })).toBeVisible();
    await expect(page.getByText('Markets scope')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Actions' })).toBeVisible();

    // Verify Markets pipeline stages within main workspace
    const mainArea = page.getByRole('main');
    await expect(mainArea.getByText('New').first()).toBeVisible();
    await expect(mainArea.getByText('KYC', { exact: true })).toBeVisible();
    await expect(mainArea.getByText('Risk Profile')).toBeVisible();
    await expect(mainArea.getByText('Demat Opened')).toBeVisible();
    await expect(mainArea.getByText('Funded & Active')).toBeVisible();

    // Open Actions modal and verify
    await page.getByRole('button', { name: 'Actions' }).click();
    await expect(page.getByText('SC-01 / MY DAY')).toBeVisible();
    await page.getByRole('button', { name: 'Close Guidance' }).click();

    await page.screenshot({ path: `test-results/markets-sc-myday-${test.info().project.name}.png` });
  });

  test('2. Markets Sales Caller — Lead Inbox & Prospect Record Inspection [Deck P045, P047]', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Work email').fill('kabir@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/markets\/dashboard/);

    // Navigate to Lead Inbox
    await page.goto('/markets/prospects');
    await page.waitForURL(/\/markets\/prospects/);

    // Verify Markets Lead Inbox header
    await expect(page.getByRole('heading', { name: 'Markets & Trading Lead Inbox' })).toBeVisible();
    await expect(page.getByText('Markets scope')).toBeVisible();

    // Verify demo leads in table
    const table = page.getByRole('table');
    await expect(table.getByText('Rohan Verma')).toBeVisible();
    await expect(table.getByText('Equity Delivery & Intraday')).toBeVisible();

    // Open prospect FV-3001
    await table.getByRole('link', { name: 'FV-3001' }).click();
    await page.waitForURL(/\/markets\/prospects\/FV-3001/);

    // Verify prospect detail header
    await expect(page.getByRole('heading', { name: 'Prospect details' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Rohan Verma/ })).toBeVisible();
    await expect(page.getByText('Assigned Prospect / FV-3001')).toBeVisible();
    await expect(page.locator('span').filter({ hasText: 'Equity Delivery & Intraday' }).first()).toBeVisible();
    await expect(page.locator('span').filter({ hasText: 'Trading App Direct' }).first()).toBeVisible();

    await page.screenshot({ path: `test-results/markets-sc-prospect-${test.info().project.name}.png` });
  });

  test('3. Markets Team Leader (Meera Nair) — Team Command Workspace [Deck P037]', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Work email').fill('meera@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Verify redirect to Team Leader management view
    await page.waitForURL(/\/management\/team/);

    // Verify visual detailing matching Deck P037 (Markets / Trading Team Command)
    await expect(page.getByText('TEAM COMMAND')).toBeVisible();
    await expect(page.getByText('MARKETS / TRADING', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Keep the team in motion.' })).toBeVisible();
    await expect(page.getByText('Markets / Trading scope')).toBeVisible();
    await expect(page.getByText('Allocation to resolve')).toBeVisible();
    await expect(page.getByText('Markets / Trading outcome trend')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Actions' })).toBeVisible();

    // Verify team coverage table displays Markets team
    const main = page.getByRole('main');
    await expect(main.getByText('Alpha (Markets / Trading)')).toBeVisible();

    await page.screenshot({ path: `test-results/markets-tl-teamcommand-${test.info().project.name}.png` });

    // Navigate to Workload Rebalance and verify Kabir Joshi is active in team workload
    await page.goto('/management/workload');
    await page.waitForURL(/\/management\/workload/);
    await expect(page.getByRole('heading', { name: 'Team workload' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Kabir Joshi' })).toBeVisible();

    await page.screenshot({ path: `test-results/markets-tl-workload-${test.info().project.name}.png` });
  });

  test('4. Markets Manager (Manish Vyas) — Supervisory Governance & Team Scorecards [Deck P141]', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Work email').fill('manish@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Verify landing on manager overview
    await page.waitForURL(/\/manager\/overview/);

    // Verify supervisory overview
    await expect(page.getByRole('heading', { name: 'Investigate performance across team leaders' })).toBeVisible();
    await expect(page.getByText('Markets & Securities', { exact: false }).first()).toBeVisible();

    // Verify team leaders & scorecards
    await page.goto('/manager/leaders');
    await page.waitForURL(/\/manager\/leaders/);
    await expect(page.getByRole('heading', { name: 'Team leaders & source quality' })).toBeVisible();
    await expect(page.getByText('TL Scorecards (MG-02)')).toBeVisible();

    await page.screenshot({ path: `test-results/markets-mg-overview-${test.info().project.name}.png` });
  });

  test('5. Markets Regional Manager (Rajesh Bansal) — Regional Governance & Interventions [Deck P161]', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Work email').fill('rajesh.b@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Verify landing on regional overview
    await page.waitForURL(/\/regional\/overview/);

    // Verify heading and Markets regional scope
    await expect(page.getByRole('heading', { name: 'Investigate regional gaps' })).toBeVisible();
    await expect(page.getByText(/Markets & Securities/).first()).toBeVisible();
    await expect(page.getByText('Ready for review')).toBeVisible();

    // Verify authenticated metric cards
    await expect(page.getByText('Parent NM Target')).toBeVisible();
    await expect(page.getByText('Achieved Wins')).toBeVisible();
    await expect(page.getByText('Regional Backlog')).toBeVisible();

    await page.screenshot({ path: `test-results/markets-rm-overview-${test.info().project.name}.png` });
  });

  test('6. Markets National Manager (Sanjay Singhania) — National Performance [Deck P181]', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Work email').fill('sanjay@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Verify landing on national overview
    await page.waitForURL(/\/national\/overview/);

    // Verify heading and Markets national scope
    await expect(page.getByRole('heading', { name: 'Inspect national vertical performance' })).toBeVisible();
    await expect(page.getByText(/Markets & Securities/).first()).toBeVisible();

    // Verify authenticated national metrics
    await expect(page.getByText('Vertical Attainment')).toBeVisible();
    await expect(page.getByText('Unallocated Target')).toBeVisible();

    await page.screenshot({ path: `test-results/markets-nm-overview-${test.info().project.name}.png` });
  });

  test('7. CEO Workspace (Rajiv Mehta) — Multi-Vertical Markets Focus [Deck P201..P220]', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Work email').fill('rajiv@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await page.waitForURL(/\/ceo\/overview/);
    await expect(page.getByText('INSPECT COMPANY OPERATING PICTURE')).toBeVisible();
    await expect(page.getByText('Enterprise Revenue')).toBeVisible();

    // Verify Markets vertical represented in enterprise operating table
    await expect(page.getByRole('cell', { name: 'Markets & Trading' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Sanjay Singhania' })).toBeVisible();

    await page.screenshot({ path: `test-results/markets-ceo-focus-${test.info().project.name}.png` });
  });

  test('8. CFO Workspace (Ananya Roy) — Multi-Vertical Financial Balances [Deck P221..P240]', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Work email').fill('ananya@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await page.waitForURL(/\/cfo\/overview/);
    await expect(page.getByRole('heading', { name: 'Financial Balances & Cash Run-Rate (CFO-01)' })).toBeVisible();
    await expect(page.getByText('Recognised Revenue').first()).toBeVisible();

    await page.screenshot({ path: `test-results/markets-cfo-balances-${test.info().project.name}.png` });
  });

});
