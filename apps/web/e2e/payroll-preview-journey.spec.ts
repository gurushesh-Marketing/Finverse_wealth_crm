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

test.describe('HRMS Slice 4: Non-Overlapping 28th–27th Payroll Preview & Effective-Dated Compensation Journey', () => {
  const evidenceDir = path.resolve(process.cwd(), '../../evidence/screenshots/payroll_preview');

  test.beforeAll(() => {
    if (!fs.existsSync(evidenceDir)) {
      fs.mkdirSync(evidenceDir, { recursive: true });
    }
  });

  test('Check 1: Frontline Team Lead receives access denial and cannot see compensation records', async ({ page }) => {
    // Login as Tara Iyer (TL Wealth - EMP-003)
    await loginOk(page, 'tara@finverse.demo');

    // Attempt direct navigation to HR payroll route
    await page.goto('/hr/payroll');
    await page.waitForTimeout(1000);

    // Frontline TL must be blocked by DeniedPanel
    await expect(page.getByText(/Workspace unavailable|Access Denied/i)).toBeVisible();
    await logout(page);
  });

  test('Check 2: Authorized HR specialist navigates preview, inspects 10 Jan joiner pro-rata, and verifies policy gates', async ({ page }) => {
    const platform = isMobile() ? 'mobile' : 'desktop';

    // Login as Pooja Sharma (HR - EMP-014)
    await loginOk(page, 'pooja@finverse.demo');

    // Navigate to HR Availability page
    await page.goto('/hr/availability');
    await page.waitForTimeout(1000);

    // Switch to Tab 3 "Compensation & Payroll Preview"
    const payrollTab = page.locator('[data-testid="tab-payroll-preview"]');
    await expect(payrollTab).toBeVisible();
    await payrollTab.click();
    await page.waitForTimeout(1000);

    // Verify policy decision banner is visible
    const policyBanner = page.locator('[data-testid="policy-decision-banner"]');
    await expect(policyBanner).toBeVisible();
    await expect(page.getByText('Statutory & Legal Policy Decisions Requiring Executive Confirmation [Deck P320]')).toBeVisible();

    // Verify Summary Metrics
    await expect(page.locator('[data-testid="preview-metric-total-emp"]')).toBeVisible();
    await expect(page.locator('[data-testid="preview-metric-joiners"]')).toBeVisible();
    await expect(page.locator('[data-testid="preview-metric-gross"]')).toBeVisible();
    await expect(page.locator('[data-testid="preview-metric-net"]')).toBeVisible();

    // Verify 10 Jan Mid-Cycle Joiner Callout (18 inclusive calendar days)
    await expect(page.getByText(/Mid-Cycle Joiner Initial Period \(10–27 January 2026: 18 Inclusive Calendar Days\)/)).toBeVisible();

    // Capture main payroll preview dashboard screenshot
    await page.screenshot({ path: path.join(evidenceDir, `payroll_preview_dashboard_${platform}.png`) });

    // Inspect Dev Kapoor's (EMP-004) calculation components
    const inspectDevBtn = page.locator('[data-testid="btn-inspect-EMP-004"]').first();
    await expect(inspectDevBtn).toBeVisible();
    await inspectDevBtn.click();
    await page.waitForTimeout(800);

    // Verify component inspection modal shows 18 calendar days and pro-rata factor
    const compModal = page.locator('[data-testid="component-inspection-modal"]');
    await expect(compModal).toBeVisible();
    await expect(compModal.getByText(/Transparent Calculation Components · Dev Kapoor/)).toBeVisible();
    await expect(compModal.getByText(/Active Days in Cycle:/)).toBeVisible();
    await expect(compModal.getByText(/18d/).first()).toBeVisible();

    // Capture transparent calculation breakdown screenshot
    await page.screenshot({ path: path.join(evidenceDir, `mid_cycle_joiner_inspection_${platform}.png`) });

    // Close inspection modal
    await compModal.getByRole('button', { name: 'Close Inspection' }).click();
    await page.waitForTimeout(500);

    // Verify Finalization Policy Gate dialog
    const attemptFinalizeBtn = page.locator('[data-testid="btn-attempt-finalize"]');
    await attemptFinalizeBtn.click();
    await page.waitForTimeout(800);

    const policyModal = page.locator('[data-testid="policy-gates-modal"]');
    await expect(policyModal).toBeVisible();
    await expect(policyModal.getByText('Payroll Finalization & Payment Export Blocked')).toBeVisible();

    // Capture policy gate rejection screenshot
    await page.screenshot({ path: path.join(evidenceDir, `policy_gates_rejection_${platform}.png`) });

    await policyModal.getByRole('button', { name: 'Acknowledge & Return to Preview' }).click();
    await page.waitForTimeout(500);

    // Open Compensation Plans & Audit Log Modal
    const manageSalaryBtn = page.locator('[data-testid="btn-manage-salary-plans"]');
    await manageSalaryBtn.click();
    await page.waitForTimeout(800);

    const compManageModal = page.locator('[data-testid="comp-management-modal"]');
    await expect(compManageModal).toBeVisible();

    // Switch to Audit Log tab
    await compManageModal.getByRole('button', { name: /Immutable Change Audit Log/ }).click();
    await page.waitForTimeout(500);

    // Capture compensation audit history screenshot
    await page.screenshot({ path: path.join(evidenceDir, `compensation_audit_log_${platform}.png`) });

    await compManageModal.getByRole('button', { name: 'Close' }).click();

    await logout(page);
  });
});
