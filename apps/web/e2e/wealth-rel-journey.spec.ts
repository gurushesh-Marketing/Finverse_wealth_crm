import { expect, test, type Page } from '@playwright/test';

async function loginAsAssignedCaller(page: Page, clientName: string): Promise<string> {
  for (const email of ['asha@finverse.demo', 'ravi@finverse.demo', 'karan@finverse.demo']) {
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Work email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/wealth\/dashboard/);
    await page.goto('/wealth/prospects');

    const row = page.locator('tr', { hasText: clientName });
    const found = await row.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
    if (found) {
      return email;
    }
  }
  throw new Error(`Lead ${clientName} not found in any Wealth caller inbox`);
}

test.describe('Relationship Manager (REL) Workflow — Wealth Management Journey', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test('1. Role & Vertical Scope: Tara Iyer is Wealth Relationship Manager, separate from Regional Manager', async ({ page }) => {
    // Log in as Tara Iyer
    await page.goto('/login');
    await page.getByLabel('Work email').fill('tara@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Must land on Relationship Manager portfolio
    await page.waitForURL(/\/rel\/portfolio/);

    // Verify UI branding & institutional details for Wealth
    await expect(page.getByText('REL-01')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Relationship Manager' })).toBeVisible();
    await expect(page.getByText('Wealth scope')).toBeVisible();
    await expect(page.getByText('Wealth Management Portfolio Command')).toBeVisible();
    await expect(page.getByText('RELATIONSHIP MANAGER WEALTH MANDATE PORTFOLIO')).toBeVisible();
    await expect(page.getByText('SEBI Suitability Notice')).toBeVisible();
    await expect(page.getByText('Matrix Verified')).toBeVisible();

    // Verify Guidance Stack Wealth specifics
    await expect(page.getByText('HOW THIS WORKS')).toBeVisible();
    await expect(page.getByText(/SEBI suitability and investible surplus criteria/i)).toBeVisible();
    await expect(page.getByText(/statutory minimums/i)).toBeVisible();

    // Verify Regional Manager direct-route denial
    await page.goto('/regional/overview');
    await expect(page.getByText('Workspace unavailable')).toBeVisible();

    // Verify Wealth Regional Manager Kavita Rao cannot access REL workspace
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Work email').fill('kavita@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await page.waitForURL(/\/regional\/overview/);
    await expect(page).toHaveURL(/\/regional\/overview/);
    await expect(page.locator('main')).toBeVisible();

    await page.goto('/rel/portfolio');
    await expect(page.getByText('Workspace unavailable')).toBeVisible();
  });

  test('2. Complete Wealth Journey: Data Entry → Caller Qualification (₹75L PMS) → REL Acceptance → AMC Coordination → SEBI Suitability File', async ({ page }) => {
    const suffix = Math.floor(100000 + Math.random() * 900000).toString();
    const clientName = `Singhania Wealth Trust ${suffix}`;
    const clientPhone = `982${suffix}1`;

    // Step A: Data Entry import into Wealth vertical
    await page.goto('/login');
    await page.getByLabel('Work email').fill('deepa@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/data-entry\/intake/);

    // Switch to Bulk Spreadsheet Import Mode
    await page.getByRole('tab', { name: /Bulk Spreadsheet Import/i }).click();
    await page.getByRole('button', { name: 'Wealth', exact: true }).click();
    await page.getByRole('button', { name: /Paste Rows from Excel \/ Sheets/i }).click();

    const pastedRows = [
      'Name\tMobile\tEmail\tWhatsApp\tLocation',
      `${clientName}\t${clientPhone}\ttrust@singhania${suffix}.test\t${clientPhone}\tMumbai`,
    ].join('\n');
    await page.getByPlaceholder(/Copy columns from Excel or Google Sheets/i).fill(pastedRows);
    await page.getByRole('button', { name: /Confirm & Start Import/i }).click();
    await expect(page.getByText(/✓ 100% Reconciled/i)).toBeVisible({ timeout: 25000 });

    // Step B: Assigned Frontline Caller qualifies the Wealth prospect
    await loginAsAssignedCaller(page, clientName);

    // Open prospect file
    const callerRow = page.locator('tr', { hasText: clientName });
    await expect(callerRow).toBeVisible();
    await callerRow.getByRole('link', { name: /Open/i }).click();
    await page.waitForURL(/\/wealth\/prospects\//);

    // Verify phone masking (caller protection)
    await expect(page.getByText(clientPhone)).not.toBeVisible();
    await expect(page.getByText(/•••••/).first()).toBeVisible();

    // Switch to Pipeline & outcomes tab
    await page.getByRole('tab', { name: 'Pipeline & outcomes' }).click();

    // Verify Wealth-specific qualification fields (Investible Surplus, Mandate Type, Risk Profile, Horizon)
    await expect(page.getByText('Wealth Management Mandate & Suitability Criteria')).toBeVisible();
    await page.getByTestId('investible-surplus-input').fill('7500000');
    await page.getByTestId('mandate-type-select').selectOption('Portfolio Management Services (PMS)');
    await page.getByTestId('risk-profile-select').selectOption('Growth');
    await page.getByTestId('investment-horizon-select').selectOption('3-5 Years');
    await page.getByTestId('caller-findings-input').fill('HNI family trust; verified liquid investible surplus ₹75 Lakhs from portfolio statement.');
    await page.getByTestId('qual-evidence-input').fill('SEBI suitability questionnaire completed; risk profile matches PMS mandate.');

    // Submit Qualify & Hand Off
    await page.getByTestId('qualify-handoff-btn').click();
    await expect(page.getByText(/Prospect qualified and handed off to Relationship Manager/)).toBeVisible();

    // Verify Handoff status card visible to Caller
    await expect(page.getByText('Relationship Manager Handoff Status')).toBeVisible();
    await expect(page.getByText('PENDING').first()).toBeVisible();
    await expect(page.getByText('Tara Iyer').first()).toBeVisible();
    await expect(page.getByText('₹75.00 Lakhs').first()).toBeVisible();

    // Step C: Relationship Manager Tara Iyer accepts handoff
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Work email').fill('tara@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await page.waitForURL(/\/rel\/portfolio/);
    await page.goto('/rel/handoffs');

    // See inbound Wealth handoff
    await expect(page.getByText(clientName).first()).toBeVisible();
    await expect(page.getByText('₹75.00 Lakhs').first()).toBeVisible();
    await expect(page.getByText('Portfolio Management Services (PMS)').first()).toBeVisible();

    // Accept Handoff
    await page.getByRole('button', { name: 'Accept Handoff' }).first().click();
    await page.getByRole('button', { name: 'Confirm Acceptance' }).click();
    await expect(page.getByText('Handoff accepted')).toBeVisible();

    // Mandate appears in active portfolio
    await page.goto('/rel/portfolio');
    await expect(page.getByTestId('rel-portfolio-table')).toContainText(clientName);
    await expect(page.getByTestId('rel-portfolio-table')).toContainText('₹75.00 Lakhs');

    // Step D: Partner Institutions Coordination (AMCs & Custodians)
    await page.goto('/rel/institutions');
    await expect(page.getByText('Wealth Partner Institutions Coordination')).toBeVisible();

    const selectMandate = page.getByTestId('select-borrower-mandate');
    await expect(selectMandate).toBeVisible();
    const opt = selectMandate.locator('option', { hasText: clientName });
    await expect(opt).toBeAttached({ timeout: 10000 });
    const optVal = await opt.getAttribute('value');
    if (optVal) {
      await selectMandate.selectOption(optVal);
    }

    // Select AMC Partner & submit coordination
    await page.getByTestId('select-partner-institution').selectOption('Kotak Alternate Assets');
    await page.getByTestId('proposed-facility-input').fill('Long-Short Equity AIF Cat III');
    await page.getByTestId('proposed-amount-input').fill('7500000');
    await page.getByTestId('interest-rate-input').fill('1.75% Fixed AMC + 15% carry above 10% hurdle');
    await page.getByTestId('coordination-notes-input').fill('Mandate proposal submitted for AMC onboarding');

    const logBtn = page.getByTestId('log-coordination-btn');
    await expect(logBtn).toBeEnabled({ timeout: 10000 });
    await logBtn.click();
    await expect(page.getByText(/Proposal logged with Kotak Alternate Assets/)).toBeVisible();

    // Step E: Open Prospect File & verify honest SEBI investor suitability matrix
    await page.goto('/rel/portfolio');
    const portRow = page.locator('tr', { hasText: clientName });
    await portRow.getByRole('link', { name: 'Open File' }).click();
    await page.waitForURL(/\/rel\/prospects\//);

    // Verify SEBI Investor Suitability & KYC Verification card (initially unevidenced & pending)
    await expect(page.getByTestId('sebi-suitability-card')).toBeVisible();
    await expect(page.getByText('SEBI INVESTOR SUITABILITY & KYC VERIFICATION (Depository CKYC / KRA)')).toBeVisible();
    await expect(page.getByText('PENDING VERIFICATION')).toBeVisible();
    await expect(page.getByText('Pending CKYC Sync')).toBeVisible();
    await expect(page.getByText('Not applicable for Wealth advisory')).toBeVisible();

    // Record human-reviewed suitability evidence
    await page.getByTestId('record-verification-btn').click();
    await page.getByTestId('evidence-ref-input').fill('SEBI-SUIT-MANDATE-2026-09');
    await page.getByTestId('verify-notes-input').fill('Client submitted verified 3-year ITR, client depository holding sync via CDSL, and executed SEBI suitability matrix.');
    await page.getByTestId('confirm-verify-btn').click();

    // Now verified with provenance
    await expect(page.getByText('SUITABILITY VERIFIED')).toBeVisible();
    await expect(page.getByText('CKYC & KRA Active')).toBeVisible();
    await expect(page.getByText('SEBI-SUIT-MANDATE-2026-09')).toBeVisible();
    await expect(page.getByText('Not applicable for Wealth advisory')).toBeVisible();

    // Verify Banking CIBIL check is NOT visible
    await expect(page.getByText('CREDIT BUREAU VERIFICATION')).not.toBeVisible();

    // Verify Mandate Strategy & Suitability Requirements card
    await expect(page.getByText('Mandate Strategy & Suitability Requirements')).toBeVisible();
    await expect(page.getByText('₹75.00 Lakhs').first()).toBeVisible();
    await expect(page.getByText('Portfolio Management Services (PMS)').first()).toBeVisible();
  });

  test('3. Return to Caller Flow: Relationship Manager returns deficient Wealth handoff with mandatory reason', async ({ page }) => {
    const suffix = Math.floor(100000 + Math.random() * 900000).toString();
    const clientName = `Deficient Mandate ${suffix}`;
    const clientPhone = `982${suffix}2`;

    // Data Entry import
    await page.goto('/login');
    await page.getByLabel('Work email').fill('deepa@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/data-entry\/intake/);

    await page.getByRole('tab', { name: /Bulk Spreadsheet Import/i }).click();
    await page.getByRole('button', { name: 'Wealth', exact: true }).click();
    await page.getByRole('button', { name: /Paste Rows from Excel \/ Sheets/i }).click();

    const pastedRows = [
      'Name\tMobile\tEmail\tWhatsApp\tLocation',
      `${clientName}\t${clientPhone}\tclient@deficient${suffix}.test\t${clientPhone}\tDelhi`,
    ].join('\n');
    await page.getByPlaceholder(/Copy columns from Excel or Google Sheets/i).fill(pastedRows);
    await page.getByRole('button', { name: /Confirm & Start Import/i }).click();
    await expect(page.getByText(/✓ 100% Reconciled/i)).toBeVisible({ timeout: 25000 });

    // Login as assigned caller & qualify with deficient surplus (₹35L, below ₹50L statutory threshold)
    const assignedCaller = await loginAsAssignedCaller(page, clientName);
    const callerRow = page.locator('tr', { hasText: clientName });
    await expect(callerRow).toBeVisible();
    await callerRow.getByRole('link', { name: /Open/i }).click();
    await page.waitForURL(/\/wealth\/prospects\//);

    await page.getByRole('tab', { name: 'Pipeline & outcomes' }).click();
    await page.getByTestId('investible-surplus-input').fill('3500000');
    await page.getByTestId('mandate-type-select').selectOption('Portfolio Management Services (PMS)');
    await page.getByTestId('caller-findings-input').fill('Client surplus is ₹35L; requested PMS mandate review.');
    await page.getByTestId('qual-evidence-input').fill('Tax returns reviewed; liquid surplus under statutory ₹50L.');
    await page.getByTestId('qualify-handoff-btn').click();
    await expect(page.getByText(/Prospect qualified and handed off/)).toBeVisible();

    // Tara Iyer rejects/returns the handoff
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Work email').fill('tara@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await page.waitForURL(/\/rel\/portfolio/);
    await page.goto('/rel/handoffs');
    await expect(page.getByText(clientName).first()).toBeVisible();

    // Return to Caller
    await page.getByRole('button', { name: 'Return to Caller' }).first().click();
    const returnReason = 'Investible surplus is ₹35 Lakhs, which is below the SEBI statutory threshold of ₹50 Lakhs for PMS mandates. Recommend mutual fund advisory instead.';
    await page.getByTestId('return-reason-input').fill(returnReason);
    await page.getByRole('button', { name: 'Confirm Return' }).click();
    await expect(page.getByText(/Handoff returned to caller/)).toBeVisible();

    // Assigned Caller sees RETURNED status and documented reason
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Work email').fill(assignedCaller);
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await page.waitForURL(/\/wealth\/dashboard/);
    await page.goto('/wealth/prospects');
    const returnedRow = page.locator('tr', { hasText: clientName });
    await returnedRow.getByRole('link', { name: /Open/i }).click();
    await page.waitForURL(/\/wealth\/prospects\//);

    await page.getByRole('tab', { name: 'Pipeline & outcomes' }).click();
    await expect(page.getByText('RETURNED', { exact: true })).toBeVisible();
    await expect(page.getByText(returnReason)).toBeVisible();
  });
});
