import { expect, test } from '@playwright/test';

test.describe('Relationship Manager (REL) Workflow — Commercial Banking Journey', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test('1. Role Separation: Rohan Sen is Relationship Manager (REL) and separate from Regional Manager (RM)', async ({ page }) => {
    // Log in as Rohan Sen
    await page.goto('/login');
    await page.getByLabel('Work email').fill('rohan@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Must land on Relationship Manager portfolio, NOT Regional Manager (/regional/*) or legacy TL
    await page.waitForURL(/\/rel\/portfolio/);

    // Verify UI branding & institutional details
    await expect(page.getByText('REL-01')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Relationship Manager' })).toBeVisible();
    await expect(page.getByText('Banking scope')).toBeVisible();
    await expect(page.getByText('Commercial Banking Portfolio Command')).toBeVisible();

    // Verify Regional Manager direct-route denial
    await page.goto('/regional/overview');
    await expect(page.getByText('Workspace unavailable')).toBeVisible();

    // Verify legacy /management/* redirects to /rel/portfolio
    await page.goto('/management/team');
    await page.waitForURL(/\/rel\/portfolio/);

    // Now log in as Banking Regional Manager Arjun Mehta
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Work email').fill('arjun@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await page.waitForURL(/\/regional\/overview/);
    await expect(page).toHaveURL(/\/regional\/overview/);
    await expect(page.locator('main')).toBeVisible();

    // Arjun cannot access REL workspace
    await page.goto('/rel/portfolio');
    await expect(page.getByText('Workspace unavailable')).toBeVisible();
  });

  test('2. Complete Banking Journey: Data Entry → Caller Qualification → REL Handoff & Acceptance → Partner Coordination', async ({ page }) => {
    const timestamp = Date.now().toString().slice(-4);
    const companyName = `Nexus Heavy Eng ${timestamp}`;
    const borrowerPhone = `982001${timestamp}`;

    // Step A: Data Entry import with automatic Sales Caller assignment
    await page.goto('/login');
    await page.getByLabel('Work email').fill('deepa@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/data-entry\/intake/);

    // Switch to Bulk Spreadsheet Import Mode
    await page.getByRole('tab', { name: /Bulk Spreadsheet Import/i }).click();
    await page.getByRole('button', { name: 'Commercial Banking', exact: true }).click();
    await page.getByRole('button', { name: /Paste Rows from Excel \/ Sheets/i }).click();

    const pastedRows = [
      'Name\tMobile\tEmail\tWhatsApp\tLocation',
      `${companyName}\t${borrowerPhone}\tfinance@nexus${timestamp}.in\t${borrowerPhone}\tMumbai`,
    ].join('\n');
    await page.getByPlaceholder(/Copy columns from Excel or Google Sheets/i).fill(pastedRows);
    await page.getByRole('button', { name: /Confirm & Start Import/i }).click();
    await expect(page.getByText(/✓ 100% Reconciled/i)).toBeVisible({ timeout: 25000 });

    // Step B: Sales Caller Dev Kapoor views & qualifies the lead
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Work email').fill('dev@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await page.waitForURL(/\/banking\/dashboard/);
    await page.goto('/banking/prospects');
    await expect(page.getByText(companyName)).toBeVisible();

    // Open the prospect detail
    const callerRow = page.locator('tr', { hasText: companyName });
    await expect(callerRow).toBeVisible();
    await callerRow.getByRole('link', { name: /Open/i }).click();
    await page.waitForURL(/\/banking\/prospects\//);

    // Verify phone masking (never raw number)
    await expect(page.getByText(borrowerPhone)).not.toBeVisible();
    await expect(page.getByText(/•••••/).first()).toBeVisible();

    // Switch to Pipeline & outcomes tab
    await page.getByRole('tab', { name: 'Pipeline & outcomes' }).click();

    // Verify qualification section
    await expect(page.getByText('Qualify & Handoff to Relationship Manager (SC-15)')).toBeVisible();
    await page.getByTestId('requested-amount-input').fill('7500000');
    await page.getByTestId('caller-findings-input').fill('Audited 3-year financials, positive operational EBITDA, working capital need ₹75L.');
    await page.getByTestId('qual-evidence-input').fill('ROC filings & 12M GST returns verified with 0 defaults.');

    // Submit Qualify & Handoff
    await page.getByTestId('qualify-handoff-btn').click();
    await expect(page.getByText(/Prospect qualified and handed off to Relationship Manager/)).toBeVisible();

    // Verify Handoff status card is visible to caller
    await expect(page.getByText('Relationship Manager Handoff Status')).toBeVisible();
    await expect(page.getByText('PENDING').first()).toBeVisible();
    await expect(page.getByText('Rohan Sen').first()).toBeVisible();

    // Step C: Relationship Manager Rohan Sen accepts handoff
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Work email').fill('rohan@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await page.waitForURL(/\/rel\/portfolio/);
    await page.goto('/rel/handoffs');

    // See inbound handoff
    await expect(page.getByText(companyName).first()).toBeVisible();
    await expect(page.getByText('₹75.00 Lakhs').first()).toBeVisible();

    // Click Accept Handoff
    await page.getByRole('button', { name: 'Accept Handoff' }).first().click();
    await page.getByRole('button', { name: 'Confirm Acceptance' }).click();
    await expect(page.getByText('Handoff accepted')).toBeVisible();

    // Mandate now appears in active portfolio
    await page.goto('/rel/portfolio');
    await expect(page.getByTestId('rel-portfolio-table')).toContainText(companyName);

    // Step D: Partner Institutions Coordination
    await page.goto('/rel/institutions');
    const selectMandate = page.getByTestId('select-borrower-mandate');
    await expect(selectMandate).toBeVisible();
    const opt = selectMandate.locator('option', { hasText: companyName });
    await expect(opt).toBeAttached({ timeout: 10000 });
    const optVal = await opt.getAttribute('value');
    if (optVal) {
      await selectMandate.selectOption(optVal);
    }
    const logBtn = page.getByTestId('log-coordination-btn');
    await expect(logBtn).toBeEnabled({ timeout: 10000 });
    await logBtn.click();
    await expect(page.getByText(/Proposal logged with HDFC Bank/)).toBeVisible();

    // Step E: Open Prospect File and verify honest credit bureau check
    await page.goto('/rel/portfolio');
    const portRow = page.locator('tr', { hasText: companyName });
    await portRow.getByRole('link', { name: 'Open File' }).click();
    await page.waitForURL(/\/rel\/prospects\//);

    await expect(page.getByText('CREDIT BUREAU VERIFICATION')).toBeVisible();
    await expect(page.getByText(/Live CIBIL integration pending credentials/)).toBeVisible();
    await expect(page.getByText('pending_authorization').first()).toBeVisible();
    await expect(page.getByText('— (Pending live provider)')).toBeVisible();
  });

  test('3. Return to Caller Flow: Relationship Manager returns deficient handoff with mandatory reason', async ({ page }) => {
    const timestamp = Date.now().toString().slice(-4);
    const companyName = `Deficient Co ${timestamp}`;

    // Step A: Data Entry import
    await page.goto('/login');
    await page.getByLabel('Work email').fill('deepa@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/data-entry\/intake/);

    await page.getByRole('tab', { name: /Bulk Spreadsheet Import/i }).click();
    await page.getByRole('button', { name: 'Commercial Banking', exact: true }).click();
    await page.getByRole('button', { name: /Paste Rows from Excel \/ Sheets/i }).click();

    const pastedRows = [
      'Name\tMobile\tEmail\tWhatsApp\tLocation',
      `${companyName}\t983002${timestamp}\tfinance@deficient${timestamp}.in\t983002${timestamp}\tPune`,
    ].join('\n');
    await page.getByPlaceholder(/Copy columns from Excel or Google Sheets/i).fill(pastedRows);
    await page.getByRole('button', { name: /Confirm & Start Import/i }).click();
    await expect(page.getByText(/✓ 100% Reconciled/i)).toBeVisible({ timeout: 25000 });

    // Caller qualifies & hands off
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Work email').fill('dev@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/banking\/dashboard/);
    await page.goto('/banking/prospects');
    const callerRow1 = page.locator('tr', { hasText: companyName });
    await expect(callerRow1).toBeVisible();
    await callerRow1.getByRole('link', { name: /Open/i }).click();
    await page.waitForURL(/\/banking\/prospects\//);
    await page.getByRole('tab', { name: 'Pipeline & outcomes' }).click();
    await page.getByTestId('requested-amount-input').fill('4500000');
    await page.getByTestId('qualify-handoff-btn').click();
    await expect(page.getByText('PENDING').first()).toBeVisible();

    // RM returns to caller with reason
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Work email').fill('rohan@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/rel\/portfolio/);
    await page.goto('/rel/handoffs');
    await page.getByRole('button', { name: 'Return to Caller' }).first().click();
    await page.getByTestId('return-reason-input').fill('Borrower turnover is below banking criteria; missing audited GST return.');
    await page.getByRole('button', { name: 'Confirm Return' }).click();
    await expect(page.getByText('Handoff returned to caller')).toBeVisible();

    // Caller sees return reason clearly
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Work email').fill('dev@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/banking\/dashboard/);
    await page.goto('/banking/prospects');
    const callerRow2 = page.locator('tr', { hasText: companyName });
    await expect(callerRow2).toBeVisible();
    await callerRow2.getByRole('link', { name: /Open/i }).click();
    await page.waitForURL(/\/banking\/prospects\//);
    await page.getByRole('tab', { name: 'Pipeline & outcomes' }).click();
    await expect(page.getByText('RETURNED').first()).toBeVisible();
    await expect(page.getByText('Borrower turnover is below banking criteria; missing audited GST return.')).toBeVisible();
  });
});
