import { expect, test } from '@playwright/test';

test.describe('Real Estate Vertical — End-to-End Browser Verification', () => {

  test('1. Real Estate Sales Caller (Sameer Kulkarni) — Personal Workspace [Deck P038]', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Work email').fill('sameer@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Verify redirect and landing on Real Estate dashboard
    await page.waitForURL(/\/real-estate\/dashboard/);

    // Verify visual detailing matching Deck P038
    await expect(page.getByText('Personal Workspace')).toBeVisible();
    await expect(page.getByText('REAL ESTATE ADVISORY')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Your next conversation starts here.' })).toBeVisible();
    await expect(page.getByText('Real Estate scope')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Actions' })).toBeVisible();

    // Verify Real Estate pipeline stages within main workspace
    const mainArea = page.getByRole('main');
    await expect(mainArea.getByText('New').first()).toBeVisible();
    await expect(mainArea.getByText('Requirement', { exact: true })).toBeVisible();
    await expect(mainArea.getByText('Site Visit', { exact: true })).toBeVisible();
    await expect(mainArea.getByText('Booking', { exact: true })).toBeVisible();
    await expect(mainArea.getByText('Registration', { exact: true })).toBeVisible();

    // Open Actions modal and verify
    await page.getByRole('button', { name: 'Actions' }).click();
    await expect(page.getByText('SC-01 / MY DAY')).toBeVisible();
    await page.getByRole('button', { name: 'Close Guidance' }).click();

    await page.screenshot({ path: `test-results/real-estate-sc-myday-${test.info().project.name}.png` });
  });

  test('2. Real Estate Sales Caller — Lead Inbox & Prospect Inspection [Deck P045, P047]', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Work email').fill('sameer@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/real-estate\/dashboard/);

    // Navigate to Lead Inbox
    await page.goto('/real-estate/prospects');
    await page.waitForURL(/\/real-estate\/prospects/);

    // Verify Real Estate Lead Inbox header
    await expect(page.getByRole('heading', { name: 'Real Estate Advisory Lead Inbox' })).toBeVisible();
    await expect(page.getByText('Real Estate scope')).toBeVisible();

    // Verify demo leads in table
    const table = page.getByRole('table');
    await expect(table.getByText('Ananya Deshmukh')).toBeVisible();
    await expect(table.getByText('Luxury Residential Mandate')).toBeVisible();

    // Open prospect FV-4001
    await table.getByRole('link', { name: 'FV-4001' }).click();
    await page.waitForURL(/\/real-estate\/prospects\/FV-4001/);

    // Verify prospect detail header
    await expect(page.getByRole('heading', { name: 'Prospect details' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Ananya Deshmukh/ })).toBeVisible();
    await expect(page.getByText('Assigned Prospect / FV-4001')).toBeVisible();
    await expect(page.locator('span').filter({ hasText: 'Luxury Residential Mandate' }).first()).toBeVisible();

    await page.screenshot({ path: `test-results/real-estate-sc-prospect-${test.info().project.name}.png` });
  });

  test('3. Real Estate Team Leader (Neha Gupta) — Team Command Workspace [Deck P037]', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Work email').fill('neha.g@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Verify redirect to Team Leader management view
    await page.waitForURL(/\/management\/team/);

    // Verify visual detailing matching Deck P037 (Real Estate Advisory Team Command)
    await expect(page.getByText('TEAM COMMAND')).toBeVisible();
    await expect(page.getByText('REAL ESTATE ADVISORY', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Keep the team in motion.' })).toBeVisible();
    await expect(page.getByText('Real Estate Advisory scope')).toBeVisible();
    await expect(page.getByText('Allocation to resolve')).toBeVisible();
    await expect(page.getByText('Real Estate Advisory outcome trend')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Actions' })).toBeVisible();

    // Verify team coverage table displays Real Estate team
    const main = page.getByRole('main');
    await expect(main.getByRole('cell', { name: 'Alpha' })).toBeVisible();

    await page.screenshot({ path: `test-results/real-estate-tl-teamcommand-${test.info().project.name}.png` });

    // Navigate to Workload Rebalance and verify Sameer Kulkarni is active in team workload
    await page.goto('/management/workload');
    await page.waitForURL(/\/management\/workload/);
    await expect(page.getByRole('cell', { name: 'Sameer Kulkarni' })).toBeVisible();
  });

  test('4. Real Estate Manager (Vikramaditya Singhania) — Supervisory Governance & Team Scorecards [Deck P141]', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Work email').fill('vikramaditya@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Verify landing on manager overview
    await page.waitForURL(/\/manager\/overview/);

    // Verify supervisory overview
    await expect(page.getByRole('heading', { name: 'Investigate performance across team leaders' })).toBeVisible();
    await expect(page.getByText('Real Estate Advisory', { exact: false }).first()).toBeVisible();

    // Verify team leaders & scorecards
    await page.goto('/manager/leaders');
    await page.waitForURL(/\/manager\/leaders/);
    await expect(page.getByRole('heading', { name: 'Team leaders & source quality' })).toBeVisible();
    await expect(page.getByText('TL Scorecards (MG-02)')).toBeVisible();

    await page.screenshot({ path: `test-results/real-estate-mg-overview-${test.info().project.name}.png` });
  });

  test('5. Real Estate Regional Manager (Siddharth Malhotra) — Regional Governance & Interventions [Deck P161]', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Work email').fill('siddharth.m@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Verify landing on regional overview
    await page.waitForURL(/\/regional\/overview/);

    // Verify heading and Real Estate regional scope
    await expect(page.getByRole('heading', { name: 'Investigate regional gaps' })).toBeVisible();
    await expect(page.getByText(/Real Estate Advisory/).first()).toBeVisible();
    await expect(page.getByText('Ready for review')).toBeVisible();

    // Verify authenticated metric cards
    await expect(page.getByText('Parent NM Target')).toBeVisible();
    await expect(page.getByText('Achieved Wins')).toBeVisible();
    await expect(page.getByText('Regional Backlog')).toBeVisible();

    await page.screenshot({ path: `test-results/real-estate-rm-overview-${test.info().project.name}.png` });
  });

  test('6. Real Estate National Manager (Aditya Singhania) — National Performance [Deck P181]', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Work email').fill('aditya@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Verify landing on national overview
    await page.waitForURL(/\/national\/overview/);

    // Verify heading and Real Estate national scope
    await expect(page.getByRole('heading', { name: 'Inspect national vertical performance' })).toBeVisible();
    await expect(page.getByText(/Real Estate Advisory/).first()).toBeVisible();

    // Verify authenticated national metrics
    await expect(page.getByText('Vertical Attainment')).toBeVisible();
    await expect(page.getByText('Unallocated Target')).toBeVisible();

    await page.screenshot({ path: `test-results/real-estate-nm-overview-${test.info().project.name}.png` });
  });

  test('7. Enterprise CEO (Rajiv Mehta) — Multi-Vertical View Includes Real Estate [Deck P201..P220]', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Work email').fill('rajiv@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await page.waitForURL(/\/ceo\/overview/);
    await expect(page.getByText('INSPECT COMPANY OPERATING PICTURE')).toBeVisible();
    await expect(page.getByText('Enterprise Revenue')).toBeVisible();

    // Verify Real Estate vertical represented in enterprise operating table
    await expect(page.getByRole('cell', { name: 'Institutional Real Estate' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Aditya Singhania' })).toBeVisible();

    await page.screenshot({ path: `test-results/real-estate-ceo-view-${test.info().project.name}.png` });
  });

  test('8. Enterprise CFO (Ananya Roy) — Multi-Vertical Financial Balances [Deck P221..P240]', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Work email').fill('ananya@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await page.waitForURL(/\/cfo\/overview/);
    await expect(page.getByRole('heading', { name: 'Financial Balances & Cash Run-Rate (CFO-01)' })).toBeVisible();
    await expect(page.getByText('Recognised Revenue').first()).toBeVisible();

    await page.screenshot({ path: `test-results/real-estate-cfo-view-${test.info().project.name}.png` });
  });

});
