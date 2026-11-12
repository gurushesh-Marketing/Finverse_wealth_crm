import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

function isMobileTest(testInfo: any): boolean {
  return testInfo.project.name.toLowerCase().includes('mobile');
}

async function logout(page: Page, isMobile: boolean) {
  if (isMobile) {
    const menuBtn = page.getByRole('button', { name: 'Open navigation' });
    if (await menuBtn.isVisible()) {
      await menuBtn.click();
    }
  }
  await page.getByRole('button', { name: 'Log out' }).first().click();
  await page.waitForURL(/\/login/);
}

test('Data Entry bulk import journey with caller queue verification', async ({ page }, testInfo) => {
  const isMobile = isMobileTest(testInfo);
  const stamp = Date.now().toString(36);
  const prospect1Name = `Aarav Malhotra ${stamp}`;
  const prospect1Mobile = `98${Date.now().toString().slice(-8)}`;
  const prospect1Email = `aarav.${stamp}@demo.test`;

  const prospect2Name = `Pooja Deshmukh ${stamp}`;
  const prospect2Mobile = `99${Date.now().toString().slice(-8)}`;
  const prospect2Email = `pooja.${stamp}@demo.test`;

  // 1. Data Entry operator signs in
  await page.goto('/login');
  await page.getByLabel('Work email').fill('deepa@finverse.demo');
  await page.getByLabel('Password', { exact: true }).fill('demo1234');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/data-entry\/intake/);

  // 2. Switch to Bulk Spreadsheet Import Mode
  const bulkTab = page.getByRole('tab', { name: /Bulk Spreadsheet Import/i });
  await expect(bulkTab).toBeVisible();
  await bulkTab.click();

  // 3. Verify Bulk Import UI elements and all four destination verticals
  await expect(page.getByText('Bulk Prospect Import & Auto-Routing')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Wealth', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Commercial Banking', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Markets & Trading', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Real Estate', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Download Template/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Paste Rows from Excel \/ Sheets/i })).toBeVisible();

  // Switch to paste mode
  await page.getByRole('button', { name: /Paste Rows from Excel \/ Sheets/i }).click();
  const pasteArea = page.getByPlaceholder(/Copy columns from Excel or Google Sheets/i);
  await expect(pasteArea).toBeVisible();

  // Rectangular paste from Excel/Google Sheets (tab-separated columns)
  const pastedRows = [
    'Name\tMobile\tEmail\tWhatsApp\tLocation',
    `${prospect1Name}\t${prospect1Mobile}\t${prospect1Email}\t${prospect1Mobile}\tMumbai`,
    `${prospect2Name}\t${prospect2Mobile}\t${prospect2Email}\t\tBengaluru`,
  ].join('\n');

  await pasteArea.fill(pastedRows);

  // Verify preview displays parsed prospects ready for validation
  await expect(page.getByText(/prospects ready for validation/i)).toBeVisible();
  await expect(page.getByRole('cell', { name: prospect1Name })).toBeVisible();
  await expect(page.getByRole('cell', { name: prospect2Name })).toBeVisible();

  // 4. Confirm & Start Import
  const confirmBtn = page.getByRole('button', { name: /Confirm & Start Import/i });
  await expect(confirmBtn).toBeEnabled();
  await confirmBtn.click();

  // 5. Verify Import Completion and Reconciliation Cards
  await expect(page.getByText(/✓ 100% Reconciled/i)).toBeVisible({ timeout: 25000 });
  await expect(page.getByText('Assigned Prospects')).toBeVisible();

  // Download Report link should be visible
  await expect(page.getByRole('link', { name: /Download Reconciliation Report/i })).toBeVisible();

  // Capture evidence screenshots
  const screenshotFileName = isMobile ? 'DE_bulk_import_reconciliation_mobile.png' : 'DE_bulk_import_reconciliation_desktop.png';
  const outDir = path.resolve(process.cwd(), '../../evidence/screenshots/bulk_import');
  await fs.promises.mkdir(outDir, { recursive: true });
  await page.screenshot({ path: path.join(outDir, screenshotFileName), fullPage: true });

  // 6. Sign out Data Entry operator
  const prospectRow = page.locator('tr', { hasText: prospect1Name });
  await expect(prospectRow).toBeVisible();
  const callerCellText = await prospectRow.locator('td').nth(4).innerText();
  let callerEmail = 'karan@finverse.demo';
  if (callerCellText.includes('Asha Rao')) {
    callerEmail = 'asha@finverse.demo';
  } else if (callerCellText.includes('Ravi Menon')) {
    callerEmail = 'ravi@finverse.demo';
  }

  await logout(page, isMobile);

  // 7. Sign in as the assigned Sales Caller to verify prospect is in their normal queue
  await page.getByLabel('Work email').fill(callerEmail);
  await page.getByLabel('Password', { exact: true }).fill('demo1234');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/wealth/);

  // Navigate to Prospects / Leads queue
  await page.goto('/wealth/prospects');
  await expect(page.getByRole('table')).toBeVisible({ timeout: 10000 });

  // Search for the newly imported prospect in caller's queue
  await page.getByPlaceholder(/Search within permitted scope/i).fill(prospect1Name);

  // Assigned caller; verify prospect is visible in caller's normal queue
  await expect(page.getByRole('cell', { name: prospect1Name })).toBeVisible({ timeout: 10000 });

  // Evidence screenshot of Sales Caller queue showing newly assigned prospect
  const callerScreenshot = isMobile ? 'SC_queue_bulk_imported_lead_mobile.png' : 'SC_queue_bulk_imported_lead_desktop.png';
  await page.screenshot({ path: path.join(outDir, callerScreenshot), fullPage: true });
});

test('68-row All preview and large-file responsive windowing in Bulk Import', async ({ page }) => {
  // 1. Data Entry operator signs in
  await page.goto('/login');
  await page.getByLabel('Work email').fill('deepa@finverse.demo');
  await page.getByLabel('Password', { exact: true }).fill('demo1234');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/data-entry\/intake/);

  // 2. Switch to Bulk Spreadsheet Import Mode
  const bulkTab = page.getByRole('tab', { name: /Bulk Spreadsheet Import/i });
  await expect(bulkTab).toBeVisible();
  await bulkTab.click();

  // 3. Switch to paste mode
  await page.getByRole('button', { name: /Paste Rows from Excel \/ Sheets/i }).click();
  const pasteArea = page.getByPlaceholder(/Copy columns from Excel or Google Sheets/i);
  await expect(pasteArea).toBeVisible();

  // Generate 68 rows (1 header + 68 data lines)
  const rows68 = ['Name\tMobile\tEmail\tWhatsApp\tLocation'];
  for (let i = 1; i <= 68; i++) {
    rows68.push(`Prospect ${i}\t98000000${String(i).padStart(2, '0')}\tprospect${i}@demo.test\t\tCity ${i}`);
  }
  await pasteArea.fill(rows68.join('\n'));

  // Default view is 15 rows: range should show 1–15 of 68
  await expect(page.getByText('Showing 1–15 of 68 rows').first()).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Prospect 1', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Prospect 15', exact: true })).toBeVisible();

  // Click 50: range should show 1–50 of 68
  await page.getByRole('button', { name: '50', exact: true }).click();
  await expect(page.getByText('Showing 1–50 of 68 rows').first()).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Prospect 50', exact: true })).toBeVisible();

  // Click 100: range should show 1–68 of 68
  await page.getByRole('button', { name: '100', exact: true }).click();
  await expect(page.getByText('Showing 1–68 of 68 rows').first()).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Prospect 68', exact: true })).toBeVisible();

  // Click "All (68)": all 68 rows rendered
  const allBtn = page.getByRole('button', { name: /All \(68\)/i });
  await expect(allBtn).toBeVisible();
  await allBtn.click();
  await expect(page.getByText('Showing all 68 of 68 rows').first()).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Prospect 1', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Prospect 68', exact: true })).toBeVisible();

  // Test large file (1,200 rows) responsive chunking
  const rows1200 = ['Name\tMobile\tEmail\tWhatsApp\tLocation'];
  for (let i = 1; i <= 1200; i++) {
    rows1200.push(`Large Prospect ${i}\t9900000${String(i).padStart(3, '0')}\tlarge${i}@demo.test\t\tMetro`);
  }
  await pasteArea.fill(rows1200.join('\n'));

  // Click All for 1,200 rows: should paginate in responsive chunks of 500 without freezing
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await expect(page.getByText(/Showing 1–500 of 1200 rows \(paged for responsiveness\)/i).first()).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Large Prospect 1', exact: true })).toBeVisible();

  // Click Next to view second page of 500 rows
  await page.getByRole('button', { name: 'Next' }).first().click();
  await expect(page.getByText(/Showing 501–1000 of 1200 rows \(paged for responsiveness\)/i).first()).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Large Prospect 501', exact: true })).toBeVisible();
});

