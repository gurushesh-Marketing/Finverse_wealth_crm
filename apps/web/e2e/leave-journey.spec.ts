import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

function isMobile(): boolean {
  return test.info().project.name.includes('mobile');
}

async function loginOk(page: Page, email: string, password = 'demo1234') {
  await page.goto('/login');
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  // Wait for session to settle
  await page.waitForURL(/\/(wealth|banking|markets|real-estate|management|manager|regional|national|ceo|cfo|superadmin|hr|data-entry)/);
}

async function logout(page: Page) {
  if (isMobile()) {
    const menuBtn = page.getByRole('button', { name: 'Open navigation' });
    if (await menuBtn.isVisible()) {
      await menuBtn.click();
    }
  }
  await page.getByRole('button', { name: 'Log out' }).first().click();
  await page.waitForURL(/\/login/);
}

async function openLeaveModal(page: Page) {
  if (isMobile()) {
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByRole('button', { name: 'Time Off & Leave' }).click();
  } else {
    await page.getByRole('button', { name: 'Time Off & Leave' }).click();
  }
  await expect(page.getByText('Leave Request & Approval Engine')).toBeVisible();
}

test.describe('Leave Request, Superior Decision & HR Visibility Journey', () => {
  test('Complete multi-role leave workflow: Employee Apply -> Superior Approve -> HR Audit', async ({ page }) => {
    const evidenceDir = path.resolve(process.cwd(), '../../evidence/screenshots/leave_management');
    await fs.promises.mkdir(evidenceDir, { recursive: true });
    const platform = isMobile() ? 'mobile' : 'desktop';

    const uniqueTag = `E2E-Trip-${Date.now().toString(36)}`;
    const reasonText = `Annual festival leave celebration [${uniqueTag}]`;
    const approvalNote = `Approved for team celebrations. Handover confirmed. [${uniqueTag}]`;

    // -------------------------------------------------------------
    // PHASE 1: Asha Rao (Sales Caller) Submits Leave Request
    // -------------------------------------------------------------
    await loginOk(page, 'asha@finverse.demo');
    await openLeaveModal(page);

    // Verify modal information
    await expect(page.getByText('Requests automatically route upward')).toBeVisible();

    // Fill Leave Application
    await page.locator('[data-testid="leave-start-date"]').fill('2026-11-15');
    await page.locator('[data-testid="leave-end-date"]').fill('2026-11-17');
    await page.locator('[data-testid="leave-reason"]').fill(reasonText);
    await page.locator('[data-testid="leave-handover"]').fill('Handover in-flight wealth leads to Ravi Menon.');

    // Duration calculation verification
    await expect(page.getByText('3 inclusive calendar day(s)')).toBeVisible();

    // Submit Request
    await page.locator('[data-testid="leave-submit-btn"]').click();

    // Verify registration feedback
    await expect(page.getByText('Request Registered')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Routed to .* for formal sign-off/)).toBeVisible();

    // Take screenshot of submitted employee state
    await page.screenshot({ path: path.join(evidenceDir, `leave_employee_request_${platform}.png`) });

    // Switch to "My Requests" tab if not switched automatically
    const myRequestsTab = page.getByRole('button', { name: /My Requests/ });
    await myRequestsTab.click();

    // Verify pending request in list with withdraw capability
    await expect(page.getByText(reasonText)).toBeVisible();
    await expect(page.getByText('Pending Approval').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Withdraw' }).first()).toBeVisible();

    // Close modal and logout
    await page.getByRole('button', { name: 'Close modal' }).click();
    await logout(page);

    // -------------------------------------------------------------
    // PHASE 2: Tara Iyer (Team Lead) Approves Asha's Leave Request
    // -------------------------------------------------------------
    await loginOk(page, 'tara@finverse.demo');
    await openLeaveModal(page);

    // Switch to "Approvals Queue" tab
    const approvalsTab = page.getByRole('button', { name: /Approvals Queue/ });
    await approvalsTab.click();

    // Verify Asha's request appears in Tara's supervisory span
    await expect(page.getByText(reasonText)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Asha Rao').first()).toBeVisible();

    // Take screenshot of supervisor's approvals queue
    await page.screenshot({ path: path.join(evidenceDir, `leave_superior_queue_${platform}.png`) });

    // Target the specific card for this request to prevent multi-worker collisions
    const requestCard = page.locator('div.rounded-lg', { hasText: reasonText });
    await requestCard.getByRole('button', { name: 'Approve...' }).click();
    const notesInput = requestCard.locator('input[placeholder*="Decision explanation"]');
    await notesInput.fill(approvalNote);
    await requestCard.getByRole('button', { name: 'Approve Request' }).click();

    // Verify confirmation
    await expect(page.getByText('Leave request approved and synchronized')).toBeVisible({ timeout: 10_000 });

    // Close modal and logout
    await page.getByRole('button', { name: 'Close modal' }).click();
    await logout(page);

    // -------------------------------------------------------------
    // PHASE 3: Pooja Sharma (HR) Enterprise Visibility & Audit Trail
    // -------------------------------------------------------------
    await loginOk(page, 'pooja@finverse.demo');

    // Navigate to HR Availability & Leave Governance Page
    await page.goto('/hr/availability');
    await expect(page.getByRole('heading', { name: 'Record leave and allocation availability' })).toBeVisible();

    // Verify Organization Leave Governance is visible
    await expect(page.getByText(/Organization Leave Governance/)).toBeVisible();
    await expect(page.getByText('Executive & Governance Role Approver Rules')).toBeVisible();

    // Filter by employee Asha
    const employeeSearchInput = page.locator('input[placeholder*="Search by employee"]');
    await employeeSearchInput.fill('Asha Rao');

    // Verify the approved leave row appears
    const table = page.locator('table').first();
    await expect(table.getByText('Asha Rao').first()).toBeVisible();
    await expect(table.getByText('Approved').first()).toBeVisible();

    // Inspect Audit History Trail modal for the filtered record
    await table.locator('tbody tr').first().getByRole('button', { name: 'Audit Trail' }).click();
    const auditModal = page.locator('div[role="dialog"]');
    await expect(auditModal.getByText(/Leave Audit History/)).toBeVisible();

    // Verify chronological audit actions exist inside modal
    await expect(auditModal.getByText(/submitted/i).first()).toBeVisible();
    await expect(auditModal.getByText(/Actor: Asha Rao/)).toBeVisible();
    await expect(auditModal.getByText(/approved/i).first()).toBeVisible();
    await expect(auditModal.getByText(/Actor: Tara Iyer/)).toBeVisible();
    await expect(auditModal.getByText(approvalNote)).toBeVisible();

    // Take screenshot of HR audit view
    await page.screenshot({ path: path.join(evidenceDir, `leave_hr_audit_${platform}.png`) });

    // Close audit modal
    await auditModal.getByRole('button', { name: 'Close audit modal' }).click();

    // Verify Executive Approver Configuration Cards
    await expect(page.getByText('Role: CEO')).toBeVisible();
    await expect(page.getByText('Blocked (Unconfigured)')).toBeVisible();

    await logout(page);
  });
});
