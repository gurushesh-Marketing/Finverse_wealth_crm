import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { Pool } from 'pg';

const dbUrl = process.env.DATABASE_URL || 'postgresql://finverse:mPXSxTCBd50QMJYgGND2UpHZ98fK13qn@127.0.0.1:5433/finverse_crm';

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

async function openAttendanceModal(page: Page) {
  if (isMobile()) {
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.locator('[data-testid="mobile-attendance-management-trigger"]').click();
  } else {
    await page.locator('[data-testid="attendance-management-trigger"]').click();
  }
  await expect(page.getByText('Work Mode & Attendance Hub')).toBeVisible();
}

test.describe('HRMS Attendance, Work-From-Home, Holiday Calendar & Resource Visibility Journey', () => {
  test.beforeEach(async () => {
    const pool = new Pool({ connectionString: dbUrl });
    try {
      await pool.query(`
        DELETE FROM attendance_progress_logs
        WHERE attendance_record_id IN (
          SELECT id FROM attendance_records
          WHERE employee_id IN ('EMP-001', 'EMP-002') AND work_date >= CURRENT_DATE - INTERVAL '3 days'
        )
      `);
      await pool.query(`
        DELETE FROM attendance_regularization_requests
        WHERE employee_id IN ('EMP-001', 'EMP-002') AND work_date >= CURRENT_DATE - INTERVAL '3 days'
      `);
      await pool.query(`
        DELETE FROM attendance_records
        WHERE employee_id IN ('EMP-001', 'EMP-002') AND work_date >= CURRENT_DATE - INTERVAL '3 days'
      `);

      // 1. Seed approved leave day for EMP-007 (Vikram Malhotra / Banking) covering 2026-10-16
      await pool.query(`
        INSERT INTO employee_leave_requests (id, employee_id, leave_type, start_date, end_date, total_days, reason, status, decided_by_employee_id, decided_at, created_at, updated_at)
        VALUES ('ELR-E2E-TEST', 'EMP-007', 'annual', '2026-10-15', '2026-10-17', 3, 'Annual festival break approved by supervisor', 'approved', 'EMP-006', NOW(), NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET start_date = '2026-10-15', end_date = '2026-10-17', status = 'approved'
      `);

      // 2. Seed a missing-update exception record for EMP-005 (Priya Nair) on 2026-10-16
      await pool.query(`
        INSERT INTO attendance_records (id, employee_id, work_date, work_mode, check_in_at, check_out_at, total_hours, wfh_progress_summary, status, created_at, updated_at)
        VALUES ('ATT-MISSING-01', 'EMP-005', '2026-10-16', 'office', '2026-10-16 09:00:00+00', NULL, NULL, 'Missing end-of-day update / checkout flagged', 'pending_confirmation', NOW(), NOW())
        ON CONFLICT (employee_id, work_date) DO UPDATE SET check_out_at = NULL, status = 'pending_confirmation', wfh_progress_summary = 'Missing end-of-day update / checkout flagged'
      `);

      // 3. Seed confirmed WFH day record for EMP-002 (Ravi Menon / Wealth) on 2026-10-16
      await pool.query(`
        INSERT INTO attendance_records (id, employee_id, work_date, work_mode, check_in_at, check_out_at, total_hours, wfh_progress_summary, status, created_at, updated_at)
        VALUES ('ATT-CONFIRMED-WFH', 'EMP-002', '2026-10-16', 'wfh', '2026-10-16 09:00:00+00', '2026-10-16 18:00:00+00', 9.0, 'Completed Q4 wealth models and client advisory calls', 'confirmed', NOW(), NOW())
        ON CONFLICT (employee_id, work_date) DO UPDATE SET status = 'confirmed', work_mode = 'wfh', total_hours = 9.0
      `);
    } finally {
      await pool.end();
    }
  });

  test('Complete journey: WFH Day -> Progress Update -> Regularization -> Supervisor Decision -> HR Resource Visibility', async ({ page }) => {
    const evidenceDir = path.resolve(process.cwd(), '../../evidence/screenshots/attendance_resource_visibility');
    await fs.promises.mkdir(evidenceDir, { recursive: true });
    const platform = isMobile() ? 'mobile' : 'desktop';
    const tag = `ATT-${Date.now().toString(36)}`;

    // ------------------------------------------------------------------------
    // PHASE 1: Employee Records Start/End of Work & Progress Log (Ravi Menon / WFH)
    // ------------------------------------------------------------------------
    await loginOk(page, 'ravi@finverse.demo');
    await openAttendanceModal(page);

    // Verify modal elements
    await expect(page.locator('[data-testid="workmode-wfh"]')).toBeVisible({ timeout: 10_000 });

    // Select WFH Mode
    await page.locator('[data-testid="workmode-wfh"]').click();

    // Toggle Offline work option
    const offlineChk = page.locator('#chk-offline');
    if (!(await offlineChk.isChecked())) {
      await offlineChk.check();
    }

    // Record Start of Work
    await page.getByRole('button', { name: /Record Start of Work/ }).click();
    await expect(page.getByText('Successfully checked in for WFH mode')).toBeVisible({ timeout: 10_000 });

    // Switch to Progress Updates Tab
    await page.getByRole('button', { name: 'Progress Updates' }).click();
    await page.getByPlaceholder('e.g. HNI Portfolio allocation sheet review').fill(`Q4 wealth portfolio models and stress tests [${tag}]`);
    await page.getByRole('button', { name: 'Add Progress Update' }).click();
    await expect(page.getByText('Shift progress log recorded')).toBeVisible({ timeout: 10_000 });

    // Switch back to Today's Attendance to complete shift Check-Out
    await page.getByRole('button', { name: "Today's Attendance" }).click();
    await expect(page.locator('[data-testid="wfh-checkout-summary"]')).toBeVisible({ timeout: 10_000 });
    await page.locator('[data-testid="wfh-checkout-summary"]').fill(`Completed financial models and 3 client advisory video consultations [${tag}]`);
    await page.locator('[data-testid="checkout-submit-btn"]').click();
    await expect(page.getByText('Successfully checked out')).toBeVisible({ timeout: 10_000 });

    // Screenshot of completed WFH shift
    await page.screenshot({ path: path.join(evidenceDir, `wfh_employee_day_${platform}.png`) });

    // Close Attendance Modal
    await page.getByRole('button', { name: 'Close' }).click();
    await logout(page);

    // ------------------------------------------------------------------------
    // PHASE 2: Employee Submits Regularization for Missed/Inconsistent Entry (Asha Rao)
    // ------------------------------------------------------------------------
    await loginOk(page, 'asha@finverse.demo');
    await openAttendanceModal(page);

    // Switch to Regularization & Exceptions Tab
    await page.getByRole('button', { name: /Regularization & Exceptions/ }).click();
    await expect(page.getByText('Request Attendance Regularization')).toBeVisible();

    await page.getByPlaceholder('Provide specific reason').fill(`Client site visit at Bandra Kurla Complex with lack of network [${tag}]`);
    await page.getByPlaceholder('Summary of tasks completed').fill('Conducted HNI advisory presentation and signed advisory agreements');
    await page.getByRole('button', { name: 'Submit to Supervisor' }).click();

    await expect(page.getByText('Regularization request submitted to supervisor')).toBeVisible({ timeout: 10_000 });

    // Screenshot of regularization submission
    await page.screenshot({ path: path.join(evidenceDir, `regularization_request_${platform}.png`) });

    await page.getByRole('button', { name: 'Close' }).click();
    await logout(page);

    // ------------------------------------------------------------------------
    // PHASE 3: HR Resource Visibility & Organization Scope View (Pooja Nair / HR)
    // ------------------------------------------------------------------------
    await loginOk(page, 'pooja@finverse.demo');
    await page.goto('/hr/availability');

    // Confirm Resource Visibility Tab is active
    await expect(page.locator('[data-testid="tab-resource-visibility"]')).toBeVisible();
    await expect(page.getByText('Organization Resource Visibility, Attendance & Leave Hub')).toBeVisible();

    // Test One-Click Vertical Selector: Scope to Wealth
    const wealthTab = page.locator('[data-testid="vertical-tab-wealth"]');
    await expect(wealthTab).toBeVisible();
    await wealthTab.click();
    await page.waitForTimeout(1000);

    // Verify 7 Classification Metric Cards within Wealth scope
    await expect(page.locator('[data-testid="metric-card-confirmed-present"]')).toBeVisible();
    await expect(page.locator('[data-testid="metric-card-wfh"]')).toBeVisible();
    await expect(page.locator('[data-testid="metric-card-approved-leave"]')).toBeVisible();
    await expect(page.locator('[data-testid="metric-card-holiday"]')).toBeVisible();
    await expect(page.locator('[data-testid="metric-card-weekly-off"]')).toBeVisible();
    await expect(page.locator('[data-testid="metric-card-pending-confirmation"]')).toBeVisible();
    await expect(page.locator('[data-testid="metric-card-recorded-absence"]')).toBeVisible();

    // Verify Location Holiday Policy Notice
    await expect(page.getByText('Holiday applicability is based on configured work location and policy, not assumed from vertical alone')).toBeVisible();

    // Verify both WFH and Approved Leave chips appear in scoped table
    const wfhChip = page.locator('[data-testid="chip-wfh"]').first();
    await wfhChip.scrollIntoViewIfNeeded();
    await expect(wfhChip).toBeVisible({ timeout: 10_000 });

    const leaveChip = page.locator('[data-testid="chip-approved-leave"]').first();
    await leaveChip.scrollIntoViewIfNeeded();
    await expect(leaveChip).toBeVisible({ timeout: 10_000 });

    // Inspect the Approved Leave day record to verify leave dates, window, and approving superior
    const leaveRow = page.locator('tr').filter({ has: page.locator('[data-testid="chip-approved-leave"]') }).first();
    await leaveRow.scrollIntoViewIfNeeded();
    await expect(leaveRow).toBeVisible();
    await leaveRow.getByRole('button', { name: 'Inspect' }).click();
    await expect(page.getByText('Resource Profile •')).toBeVisible();
    await expect(page.getByText('Approved Leave Details')).toBeVisible();
    await expect(page.getByText(/Window: 2026-10-15 to 2026-10-17/)).toBeVisible();
    await page.screenshot({ path: path.join(evidenceDir, `approved_leave_inspection_${platform}.png`) });
    await page.getByRole('button', { name: 'Close' }).click();

    // Click All Verticals to verify multi-vertical organization scope
    const allTab = page.locator('[data-testid="vertical-tab-all"]');
    await allTab.click();
    await page.waitForTimeout(1000);

    // Verify Supervisor Exceptions Review Queue is present
    await expect(page.getByText('Supervisor Review & Exceptions Queue')).toBeVisible();

    // Screenshot of HR Resource Visibility Dashboard
    await page.screenshot({ path: path.join(evidenceDir, `hr_resource_visibility_dashboard_${platform}.png`) });

    // Review an exception if present in queue (missing update or regularization)
    const reviewBtn = page.getByRole('button', { name: /Review & Confirm|Review Regularization/ }).first();
    if (await reviewBtn.isVisible()) {
      await page.screenshot({ path: path.join(evidenceDir, `missing_update_exception_${platform}.png`) });
      await reviewBtn.click();
      await expect(page.getByText(/Review WFH Shift Deliverables|Decide Regularization Request/)).toBeVisible();
      await page.getByPlaceholder('Provide verification notes').fill(`HR verified shift deliverables against team commitments [${tag}]`);
      await page.getByRole('button', { name: 'Submit Decision' }).click();
      await page.waitForTimeout(1000);
    }

    // Inspect a general breakdown record (WFH or Present)
    const inspectBtn = page.getByRole('button', { name: 'Inspect' }).first();
    if (await inspectBtn.isVisible()) {
      await inspectBtn.click();
      await expect(page.getByText('Resource Profile •')).toBeVisible();
      await page.screenshot({ path: path.join(evidenceDir, `resource_profile_inspection_${platform}.png`) });
      await page.getByRole('button', { name: 'Close' }).click();
    }

    await logout(page);
  });
});
