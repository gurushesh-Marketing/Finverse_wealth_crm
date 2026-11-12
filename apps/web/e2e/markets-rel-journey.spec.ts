import { expect, test, type Page } from '@playwright/test';

async function loginAsAssignedCaller(page: Page, clientName: string): Promise<string> {
  for (const email of ['kabir@finverse.demo', 'sneha@finverse.demo', 'gaurav@finverse.demo']) {
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Work email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/markets\/dashboard/);
    await page.goto('/markets/prospects');

    const row = page.locator('tr', { hasText: clientName });
    const found = await row.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
    if (found) {
      return email;
    }
  }
  throw new Error(`Lead ${clientName} not found in any Markets caller inbox`);
}

test.describe('Relationship Manager (REL) Workflow — Markets & Securities Trading Journey', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test('1. Role & Vertical Scope: Meera Nair is Markets Relationship Manager, separate from Regional Manager', async ({ page }) => {
    // Log in as Meera Nair
    await page.goto('/login');
    await page.getByLabel('Work email').fill('meera@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Must land on Relationship Manager portfolio
    await page.waitForURL(/\/rel\/portfolio/);

    // Verify UI branding & institutional details for Markets
    await expect(page.getByText('REL-01')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Relationship Manager' })).toBeVisible();
    await expect(page.getByText('Markets scope')).toBeVisible();
    await expect(page.getByText('Markets & Securities Portfolio Command')).toBeVisible();
    await expect(page.getByText('RELATIONSHIP MANAGER MARKETS TRADING PORTFOLIO')).toBeVisible();
    await expect(page.getByText('SEBI Risk Disclosure')).toBeVisible();
    await expect(page.getByText('Mandatory Verified')).toBeVisible();

    // Verify Guidance Stack Markets specifics
    await expect(page.getByText('HOW THIS WORKS')).toBeVisible();
    await expect(page.getByText(/SEBI suitability, trading capital, and F&O risk disclosures/i)).toBeVisible();
    await expect(page.getByText(/Clearing Members and Exchange partners/i)).toBeVisible();
    await expect(page.getByText(/income proof \(6M bank statement \/ ITR\) is deficient/i)).toBeVisible();

    // Verify Regional Manager direct-route denial
    await page.goto('/regional/overview');
    await expect(page.getByText('Workspace unavailable')).toBeVisible();

    // Verify Markets Regional Manager Rajesh Bansal cannot access REL workspace
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Work email').fill('rajesh.b@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await page.waitForURL(/\/regional\/overview/);
    await expect(page).toHaveURL(/\/regional\/overview/);
    await expect(page.locator('main')).toBeVisible();

    await page.goto('/rel/portfolio');
    await expect(page.getByText('Workspace unavailable')).toBeVisible();
  });

  test('2. Complete Markets Journey: Data Entry → Caller Qualification (₹25L F&O) → REL Acceptance → Clearing Coordination → SEBI CKYC / Risk Disclosure File', async ({ page }) => {
    const suffix = Math.floor(100000 + Math.random() * 900000).toString();
    const clientName = `Apex Quantitative Capital ${suffix}`;
    const clientPhone = `983${suffix}1`;

    // Step A: Data Entry import into Markets & Securities vertical
    await page.goto('/login');
    await page.getByLabel('Work email').fill('deepa@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/data-entry\/intake/);

    // Switch to Bulk Spreadsheet Import Mode
    await page.getByRole('tab', { name: /Bulk Spreadsheet Import/i }).click();
    await page.getByRole('button', { name: 'Markets & Trading', exact: true }).click();
    await page.getByRole('button', { name: /Paste Rows from Excel \/ Sheets/i }).click();

    const pastedRows = [
      'Name\tMobile\tEmail\tWhatsApp\tLocation',
      `${clientName}\t${clientPhone}\tdesk@apexquant${suffix}.test\t${clientPhone}\tMumbai`,
    ].join('\n');
    await page.getByPlaceholder(/Copy columns from Excel or Google Sheets/i).fill(pastedRows);
    await page.getByRole('button', { name: /Confirm & Start Import/i }).click();
    await expect(page.getByText(/✓ 100% Reconciled/i)).toBeVisible({ timeout: 25000 });

    // Step B: Assigned Frontline Caller qualifies the Markets prospect
    await loginAsAssignedCaller(page, clientName);

    // Open prospect file
    const callerRow = page.locator('tr', { hasText: clientName });
    await expect(callerRow).toBeVisible();
    await callerRow.getByRole('link', { name: /Open/i }).click();
    await page.waitForURL(/\/markets\/prospects\//);

    // Verify phone masking (caller protection)
    await expect(page.getByText(clientPhone)).not.toBeVisible();
    await expect(page.getByText(/•••••/).first()).toBeVisible();

    // Switch to Pipeline & outcomes tab
    await page.getByRole('tab', { name: 'Pipeline & outcomes' }).click();

    // Verify Markets-specific qualification fields (Trading Capital, Segment, Experience, Risk, Depository)
    await expect(page.getByText('Markets & Securities Trading Mandate & Risk Criteria')).toBeVisible();
    await page.getByTestId('trading-capital-input').fill('2500000');
    await page.getByTestId('trading-segment-select').selectOption('F&O Derivatives (Futures & Options)');
    await page.getByTestId('trading-experience-select').selectOption('Active / Professional (3+ Years)');
    await page.getByTestId('markets-risk-select').selectOption('High / Speculative (Active F&O & Leverage)');
    await page.getByTestId('depository-select').selectOption('CDSL (Central Depository Services India)');
    await page.getByTestId('caller-findings-input').fill('Professional options trader; 4 years F&O trading track record; verified ₹25 Lakhs initial margin.');
    await page.getByTestId('qual-evidence-input').fill('6-month bank statement verified for derivatives; SEBI risk disclosure acknowledged.');

    // Submit Qualify & Hand Off
    await page.getByTestId('qualify-handoff-btn').click();
    await expect(page.getByText(/Prospect qualified and handed off to Relationship Manager/)).toBeVisible();

    // Verify Handoff status card visible to Caller
    await expect(page.getByText('Relationship Manager Handoff Status')).toBeVisible();
    await expect(page.getByText('PENDING').first()).toBeVisible();
    await expect(page.getByText('Meera Nair').first()).toBeVisible();
    await expect(page.getByText('₹25.00 Lakhs').first()).toBeVisible();

    // Step C: Relationship Manager Meera Nair accepts handoff
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Work email').fill('meera@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await page.waitForURL(/\/rel\/portfolio/);
    await page.goto('/rel/handoffs');

    // See inbound Markets handoff
    await expect(page.getByText(clientName).first()).toBeVisible();
    await expect(page.getByText('₹25.00 Lakhs').first()).toBeVisible();
    await expect(page.getByText('F&O Derivatives (Futures & Options)').first()).toBeVisible();

    // Accept Handoff
    await page.getByRole('button', { name: 'Accept Handoff' }).first().click();
    await page.getByRole('button', { name: 'Confirm Acceptance' }).click();
    await expect(page.getByText('Handoff accepted')).toBeVisible();

    // Account appears in active portfolio
    await page.goto('/rel/portfolio');
    await expect(page.getByTestId('rel-portfolio-table')).toContainText(clientName);
    await expect(page.getByTestId('rel-portfolio-table')).toContainText('₹25.00 Lakhs');

    // Step D: Partner Institutions Coordination (Clearing Members & Exchanges)
    await page.goto('/rel/institutions');
    await expect(page.getByText('Markets Clearing Members & Exchange Coordination')).toBeVisible();

    const selectMandate = page.getByTestId('select-borrower-mandate');
    await expect(selectMandate).toBeVisible();
    const opt = selectMandate.locator('option', { hasText: clientName });
    await expect(opt).toBeAttached({ timeout: 10000 });
    const optVal = await opt.getAttribute('value');
    if (optVal) {
      await selectMandate.selectOption(optVal);
    }

    // Select Clearing Partner & submit coordination
    await page.getByTestId('select-partner-institution').selectOption('NSE Clearing Limited (NCL)');
    await page.getByTestId('proposed-facility-input').fill('F&O Clearing & Margin Facility');
    await page.getByTestId('proposed-amount-input').fill('2500000');
    await page.getByTestId('interest-rate-input').fill('0.02% per contract + SEBI turnover charges');
    await page.getByTestId('coordination-notes-input').fill('Direct clearing member setup with CDSL margin pledge');

    const logBtn = page.getByTestId('log-coordination-btn');
    await expect(logBtn).toBeEnabled({ timeout: 10000 });
    await logBtn.click();
    await expect(page.getByText(/Proposal logged with NSE Clearing Limited \(NCL\)/)).toBeVisible();

    // Step E: Open Prospect File & verify honest SEBI CKYC & derivative risk disclosure
    await page.goto('/rel/portfolio');
    const portRow = page.locator('tr', { hasText: clientName });
    await portRow.getByRole('link', { name: 'Open File' }).click();
    await page.waitForURL(/\/rel\/prospects\//);

    // Verify SEBI Central KYC & Derivative Risk Disclosure card (initially unevidenced & pending)
    await expect(page.getByTestId('markets-kyc-card')).toBeVisible();
    await expect(page.getByText('SEBI CENTRAL KYC & DERIVATIVE RISK DISCLOSURE (Depository CKYC / KRA)')).toBeVisible();
    await expect(page.getByText('PENDING VERIFICATION')).toBeVisible();
    await expect(page.getByText('Pending CKYC Sync')).toBeVisible();
    await expect(page.getByText('Not applicable for Markets trading', { exact: true })).toBeVisible();

    // Record human-reviewed KYC & risk disclosure evidence
    await page.getByTestId('record-verification-btn').click();
    await page.getByTestId('evidence-ref-input').fill('SEBI-CKYC-DISCLOSURE-2026-99');
    await page.getByTestId('verify-notes-input').fill('Client completed CDSL depository sync and acknowledged derivative risk warning.');
    await page.getByTestId('confirm-verify-btn').click();

    // Now verified with provenance
    await expect(page.getByText('SUITABILITY VERIFIED')).toBeVisible();
    await expect(page.getByText(/Active Verified/)).toBeVisible();
    await expect(page.getByText('SEBI-CKYC-DISCLOSURE-2026-99')).toBeVisible();
    await expect(page.getByText('Not applicable for Markets trading', { exact: true })).toBeVisible();

    // Verify Banking CIBIL check is NOT visible
    await expect(page.getByText('CREDIT BUREAU VERIFICATION')).not.toBeVisible();

    // Verify Trading Segment & Margin Requirements card
    await expect(page.getByText('Trading Segment & Margin Requirements')).toBeVisible();
    await expect(page.getByText('₹25.00 Lakhs').first()).toBeVisible();
    await expect(page.getByText('F&O Derivatives (Futures & Options)').first()).toBeVisible();
  });

  test('3. Return to Caller Flow: Relationship Manager returns deficient Markets handoff with mandatory reason', async ({ page }) => {
    const suffix = Math.floor(100000 + Math.random() * 900000).toString();
    const clientName = `Deficient Derivative Trader ${suffix}`;
    const clientPhone = `983${suffix}2`;

    // Data Entry import
    await page.goto('/login');
    await page.getByLabel('Work email').fill('deepa@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/data-entry\/intake/);

    await page.getByRole('tab', { name: /Bulk Spreadsheet Import/i }).click();
    await page.getByRole('button', { name: 'Markets & Trading', exact: true }).click();
    await page.getByRole('button', { name: /Paste Rows from Excel \/ Sheets/i }).click();

    const pastedRows = [
      'Name\tMobile\tEmail\tWhatsApp\tLocation',
      `${clientName}\t${clientPhone}\ttrader@deficient${suffix}.test\t${clientPhone}\tPune`,
    ].join('\n');
    await page.getByPlaceholder(/Copy columns from Excel or Google Sheets/i).fill(pastedRows);
    await page.getByRole('button', { name: /Confirm & Start Import/i }).click();
    await expect(page.getByText(/✓ 100% Reconciled/i)).toBeVisible({ timeout: 25000 });

    // Login as assigned caller & qualify with deficient income proof
    const assignedCaller = await loginAsAssignedCaller(page, clientName);
    const callerRow = page.locator('tr', { hasText: clientName });
    await expect(callerRow).toBeVisible();
    await callerRow.getByRole('link', { name: /Open/i }).click();
    await page.waitForURL(/\/markets\/prospects\//);

    await page.getByRole('tab', { name: 'Pipeline & outcomes' }).click();
    await page.getByTestId('trading-capital-input').fill('500000');
    await page.getByTestId('trading-segment-select').selectOption('Commodities & Currencies');
    await page.getByTestId('caller-findings-input').fill('Client trading margin is ₹5L; wants commodities activation.');
    await page.getByTestId('qual-evidence-input').fill('Client cannot provide 6M bank statement or ITR income proof.');
    await page.getByTestId('qualify-handoff-btn').click();
    await expect(page.getByText(/Prospect qualified and handed off/)).toBeVisible();

    // Meera Nair rejects/returns the handoff
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Work email').fill('meera@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await page.waitForURL(/\/rel\/portfolio/);
    await page.goto('/rel/handoffs');
    await expect(page.getByText(clientName).first()).toBeVisible();

    // Return to Caller
    await page.getByRole('button', { name: 'Return to Caller' }).first().click();
    const returnReason = 'Client lacks 6 months bank statement or ITR income proof required under SEBI regulations for derivative segment activation. Cannot activate F&O without mandatory income proof.';
    await page.getByTestId('return-reason-input').fill(returnReason);
    await page.getByRole('button', { name: 'Confirm Return' }).click();
    await expect(page.getByText(/Handoff returned to caller/)).toBeVisible();

    // Assigned Caller sees RETURNED status and documented reason
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Work email').fill(assignedCaller);
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await page.waitForURL(/\/markets\/dashboard/);
    await page.goto('/markets/prospects');
    const returnedRow = page.locator('tr', { hasText: clientName });
    await returnedRow.getByRole('link', { name: /Open/i }).click();
    await page.waitForURL(/\/markets\/prospects\//);

    await page.getByRole('tab', { name: 'Pipeline & outcomes' }).click();
    await expect(page.getByText('RETURNED', { exact: true })).toBeVisible();
    await expect(page.getByText(returnReason)).toBeVisible();
  });
});
