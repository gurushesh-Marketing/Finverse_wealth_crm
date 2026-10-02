import { test, expect } from '@playwright/test';

/**
 * Wealth SC-02 (lead inbox: filter/search/save view) and SC-03 (prospect
 * record: full record with five tabs and access exceptions).
 *
 * Frontend + local-database contract tests; fixture/seed isolation only —
 * NOT production authorization. Uses tolerant locators (.first()) because
 * another builder's dashboard wave runs concurrently against the same server.
 */

async function login(page: import('@playwright/test').Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password').fill('demo1234');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/dashboard/, { timeout: 10000 });
}

test.describe('Wealth SC-02 Lead inbox', () => {
  test('lists only the caller scoped wealth leads', async ({ page }) => {
    await login(page, 'asha@finverse.demo');
    await page.goto('/wealth/prospects');

    for (const id of ['FV-1042', 'FV-1043', 'FV-1044', 'FV-1045', 'FV-1047', 'FV-0920']) {
      await expect(page.getByRole('link', { name: id })).toBeVisible();
    }
    // Another caller's lead (FV-1050, Kiran) and another vertical (FV-2001, banking).
    await expect(page.getByRole('link', { name: 'FV-1050' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'FV-2001' })).toHaveCount(0);
    await expect(page.getByText('Prospect F')).toHaveCount(0);
    await expect(page.getByText('Meera Textiles Pvt Ltd')).toHaveCount(0);
  });

  test('search, stage, source, product and due filters actually filter', async ({ page }) => {
    await login(page, 'asha@finverse.demo');
    await page.goto('/wealth/prospects');

    // Search by lead ID
    await page.getByLabel('Search').fill('FV-1042');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await page.waitForURL(/search=FV-1042/, { timeout: 10000 });
    await expect(page.getByRole('link', { name: 'FV-1042' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'FV-1043' })).toHaveCount(0);

    // Stage filter
    await page.goto('/wealth/prospects');
    await page.getByLabel('Stage').selectOption('contacted');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await page.waitForURL(/stage=contacted/, { timeout: 10000 });
    await expect(page.getByRole('link', { name: 'FV-1043' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'FV-1047' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'FV-1042' })).toHaveCount(0);

    // Source filter
    await page.goto('/wealth/prospects');
    await page.getByLabel('Source').selectOption('Website');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await page.waitForURL(/source=Website/, { timeout: 10000 });
    await expect(page.getByRole('link', { name: 'FV-1042' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'FV-1044' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'FV-1043' })).toHaveCount(0); // Referral
    await expect(page.getByRole('link', { name: 'FV-1045' })).toHaveCount(0); // Employee referral

    // Product filter (single seeded product still filters)
    await page.goto('/wealth/prospects');
    await page.getByLabel('Product').selectOption('V1 product');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await page.waitForURL(/product=V1\+product/, { timeout: 10000 });
    await expect(page.getByRole('link', { name: 'FV-1042' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'FV-1050' })).toHaveCount(0);

    // Due filter (overdue → only the lost lead is overdue)
    await page.goto('/wealth/prospects');
    await page.getByLabel('Due').selectOption('overdue');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await page.waitForURL(/due=overdue/, { timeout: 10000 });
    await expect(page.getByRole('link', { name: 'FV-0920' })).toBeVisible();
    // A far-future due lead (+5 days at seed) must be excluded from overdue.
    await expect(page.getByRole('link', { name: 'FV-1047' })).toHaveCount(0);
  });

  test('saved view persists and re-applies its filters', async ({ page }) => {
    const viewName = `Inbox view ${Date.now()}`;
    await login(page, 'asha@finverse.demo');
    await page.goto('/wealth/prospects');

    // Apply a stage filter first so the saved view captures a non-default slice.
    await page.getByLabel('Stage').selectOption('contacted');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await page.waitForURL(/stage=contacted/, { timeout: 10000 });

    await page.getByLabel('View name').fill(viewName);
    await page.getByRole('button', { name: 'Save view' }).click();
    await expect(page.getByText(viewName)).toBeVisible();

    // Persisted across a full reload.
    await page.reload();
    await expect(page.getByText(viewName)).toBeVisible();

    // Reset to the default inbox, then apply the saved view.
    await page.goto('/wealth/prospects');
    await expect(page.getByRole('link', { name: 'FV-1042' })).toBeVisible();
    await page.getByRole('link', { name: `Apply saved view ${viewName}` }).click();
    await page.waitForURL(/stage=contacted/, { timeout: 10000 });
    await expect(page.getByRole('link', { name: 'FV-1043' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'FV-1042' })).toHaveCount(0);
  });

  test('searching another caller lead id returns empty state with no customer data', async ({ page }) => {
    await login(page, 'asha@finverse.demo');
    await page.goto('/wealth/prospects');
    await page.getByLabel('Search').fill('FV-1050');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await page.waitForURL(/search=FV-1050/, { timeout: 10000 });

    await expect(page.getByText('No match.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Clear filters' }).first()).toBeVisible();
    await expect(page.getByText('Prospect F')).toHaveCount(0);
    await expect(page.getByText('FV-1050')).toHaveCount(0);
  });
});

test.describe('Wealth SC-03 prospect record', () => {
  test('opens with five tabs, summary facts and real documents', async ({ page }) => {
    await login(page, 'asha@finverse.demo');
    await page.goto('/wealth/prospects/FV-1042');

    await expect(page.getByRole('heading', { name: 'Prospect B' })).toBeVisible();
    await expect(page.getByText('FV-1042', { exact: true })).toBeVisible();

    // Five real tabs.
    for (const tab of ['Summary', 'Timeline', 'Tasks', 'Documents', 'Outcome']) {
      await expect(page.getByRole('tab', { name: tab })).toBeVisible();
    }

    // Header entry points are real links into the conversations workspace.
    await expect(page.getByRole('link', { name: 'Call' })).toHaveAttribute('href', '/wealth/activities?lead=FV-1042&intent=call');
    await expect(page.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', '/wealth/activities?lead=FV-1042&intent=whatsapp');
    await expect(page.getByRole('link', { name: 'Add activity' })).toHaveAttribute('href', '/wealth/activities?lead=FV-1042&intent=manual');

    // Summary facts (default active tab) — scope to the tab panel so the
    // header's duplicated source/owner strings cannot collide.
    const summary = page.getByRole('tabpanel');
    await expect(summary.getByText('•••• •• 4021')).toBeVisible();
    await expect(summary.getByText('Masked: revealed only during an authorised dial')).toBeVisible();
    await expect(summary.getByText('Website / Campaign C12')).toBeVisible();
    await expect(summary.getByText('Contact permission')).toBeVisible();
    await expect(summary.getByText('Preferred language')).toBeVisible();
    await expect(summary.getByText('Outstanding tasks')).toBeVisible();

    // Documents tab shows the real, scoped rows (DOC-001 clean, DOC-002 quarantined).
    await page.getByRole('tab', { name: 'Documents' }).click();
    const documents = page.getByRole('tabpanel');
    await expect(documents.getByText('DOC-001')).toBeVisible();
    await expect(documents.getByText('DOC-002')).toBeVisible();
    await expect(documents.getByText('Quarantined')).toBeVisible();
    await expect(documents.getByText('identity-proof.pdf')).toBeVisible();
  });

  test('reassigned lead shows access-changed with cleared sensitive fields', async ({ page }) => {
    await login(page, 'asha@finverse.demo');
    await page.goto('/wealth/prospects/FV-1051');

    await expect(page.getByRole('heading', { name: 'Access changed' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Return to inbox' })).toBeVisible();
    // Sensitive fields cleared — no name, phone, email or product values.
    await expect(page.getByText('Prospect G')).toHaveCount(0);
    await expect(page.getByText(/••••/)).toHaveCount(0);
    await expect(page.getByText('V1 product')).toHaveCount(0);
  });

  test('out-of-scope lead shows not-in-workload; cross-vertical shows access denied', async ({ page }) => {
    await login(page, 'asha@finverse.demo');

    // Another caller's wealth lead (Kiran's FV-1050).
    await page.goto('/wealth/prospects/FV-1050');
    await expect(page.getByRole('heading', { name: 'Not in your permitted workload' })).toBeVisible();
    await expect(page.getByText('Prospect F')).toHaveCount(0);
    await expect(page.getByText('FV-1050')).toHaveCount(0);

    // A banking lead cannot be read through the wealth record route.
    await page.goto('/wealth/prospects/FV-2001');
    await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
    await expect(page.getByText('Meera Textiles Pvt Ltd')).toHaveCount(0);
  });

  test('tabs are reachable and activatable via keyboard', async ({ page }) => {
    await login(page, 'asha@finverse.demo');
    await page.goto('/wealth/prospects/FV-1042');
    // Wait for the client tab component to hydrate so its keyboard handlers are attached.
    await expect(page.locator('section[data-hydrated="true"]')).toHaveCount(1);

    const documentsTab = page.getByRole('tab', { name: 'Documents' });
    await documentsTab.focus();
    await expect(documentsTab).toBeFocused();
    await documentsTab.press('Space');
    await expect(page.getByRole('tab', { name: 'Documents' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel').getByText('DOC-001')).toBeVisible();
  });
});
