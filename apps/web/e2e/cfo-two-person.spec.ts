import { expect, test } from '@playwright/test';

test.describe('CFO Dual-Control Two-Person Workflow Verification [Deck P229..P230, P251..P252]', () => {

  test('Priya Nair (preparer) prepares revenue entry, UI enforces Self-Approval Forbidden, Ananya Roy (CFO approver) approves entry', async ({ page }) => {
    const uniqueCode = `REV-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 100000)}`;

    // 1. Login as Finance Officer / Preparer Priya Nair (EMP-012)
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Work email').fill('priya@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await page.waitForURL(/\/cfo\/overview/);
    await expect(page.getByText('CFO-01').first()).toBeVisible();

    // 2. Navigate to Revenue Recognition & Dual-Control Approvals (/cfo/recognition)
    await page.goto('/cfo/recognition');
    await expect(page.getByRole('heading', { name: /Revenue Recognition & Dual-Control Approvals/i })).toBeVisible();

    // 3. Open Prepare Revenue Entry modal
    await page.getByRole('button', { name: 'Prepare Revenue Entry (CFO-03)' }).click();
    const modal = page.locator('form');
    await expect(modal).toBeVisible();

    // Fill form using exact field labels
    await page.locator('textarea').fill(`E2E Advisory Fee ${uniqueCode}`);
    await page.locator('input[placeholder="e.g. INV-2026-001"]').fill(`INV-${uniqueCode}`);

    // Submit preparation
    await page.getByRole('button', { name: 'Submit for Approval' }).click();

    // Verify preparation confirmation banner
    await expect(page.getByText('Revenue entry prepared and queued for independent approval.')).toBeVisible();

    // 4. Test Segregation of Duties: Priya is shown "Self-Approval Forbidden [Deck P230]"
    const pendingRow = page.locator('tr', { hasText: `INV-${uniqueCode}` }).first();
    await expect(pendingRow).toBeVisible();
    await expect(pendingRow.getByText('Self-Approval Forbidden [Deck P230]')).toBeVisible();
    await expect(pendingRow.getByRole('button', { name: /Approve/ })).toHaveCount(0);

    // 5. Logout Priya
    await page.context().clearCookies();

    // 6. Login as Approver Ananya Roy (CFO, EMP-011)
    await page.goto('/login');
    await page.getByLabel('Work email').fill('ananya@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await page.waitForURL(/\/cfo\/overview/);

    // 7. Navigate to Revenue Recognition
    await page.goto('/cfo/recognition');
    await expect(page.getByRole('heading', { name: /Revenue Recognition & Dual-Control Approvals/i })).toBeVisible();

    // Locate the pending entry prepared by Priya
    const approverRow = page.locator('tr', { hasText: `INV-${uniqueCode}` }).first();
    await expect(approverRow).toBeVisible();
    await expect(approverRow.getByText('Priya Nair')).toBeVisible();

    // 8. Ananya sees the enabled Approve button and approves the entry
    const approveBtn = approverRow.getByRole('button', { name: /Approve Entry/ });
    await expect(approveBtn).toBeVisible();
    await approveBtn.click();

    // Verify success banner
    await expect(page.getByText(/approved and posted to immutable ledger/i)).toBeVisible();

    // Verify the entry has transitioned out of pending approvals queue
    await expect(page.locator('tr', { hasText: `INV-${uniqueCode}` })).toHaveCount(0);

    // Verify posted table displays the approved entry with both preparer and approver identities
    await expect(page.getByText('Prep: Priya Nair').first()).toBeVisible();
    await expect(page.getByText('Appr: Ananya Roy').first()).toBeVisible();
  });
});
