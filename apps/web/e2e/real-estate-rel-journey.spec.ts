import { expect, test, type Page } from '@playwright/test';

async function loginAsAssignedCaller(page: Page, clientName: string): Promise<string> {
  for (const email of ['sameer@finverse.demo', 'kunal.r@finverse.demo']) {
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Work email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/real-estate\/dashboard/);
    await page.goto('/real-estate/prospects');

    const row = page.locator('tr', { hasText: clientName });
    const found = await row.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
    if (found) {
      return email;
    }
  }
  throw new Error(`Lead ${clientName} not found in any Real Estate caller inbox`);
}

test.describe('Relationship Manager (REL) Workflow — Real Estate Advisory Journey', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test('1. Role & Vertical Scope: Neha Gupta is Real Estate Relationship Manager, separate from Regional Manager', async ({ page }) => {
    // Log in as Neha Gupta
    await page.goto('/login');
    await page.getByLabel('Work email').fill('neha.g@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Must land on Relationship Manager portfolio
    await page.waitForURL(/\/rel\/portfolio/);

    // Verify UI branding & institutional details for Real Estate
    await expect(page.getByText('REL-01')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Relationship Manager' })).toBeVisible();
    await expect(page.getByText('Real Estate scope')).toBeVisible();
    await expect(page.getByText('Real Estate Mandate Portfolio Command')).toBeVisible();
    await expect(page.getByText('RELATIONSHIP MANAGER REAL ESTATE PORTFOLIO')).toBeVisible();
    await expect(page.getByText('RERA & Title Search')).toBeVisible();
    await expect(page.getByText('100% Verified')).toBeVisible();

    // Verify Guidance Stack Real Estate specifics
    await expect(page.getByText('HOW THIS WORKS')).toBeVisible();
    await expect(page.getByText(/buyer budget, property type, location preferences, and funds readiness/i)).toBeVisible();
    await expect(page.getByText(/Tier-1 developer & property fund partners/i)).toBeVisible();
    await expect(page.getByText(/return the lead to the caller with a mandatory documented reason/i)).toBeVisible();

    // Verify Regional Manager direct-route denial
    await page.goto('/regional/overview');
    await expect(page.getByText('Workspace unavailable')).toBeVisible();

    // Verify Real Estate Regional Manager Siddharth Malhotra cannot access REL workspace
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Work email').fill('siddharth.m@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await page.waitForURL(/\/regional\/overview/);
    await expect(page).toHaveURL(/\/regional\/overview/);
    await expect(page.locator('main')).toBeVisible();

    await page.goto('/rel/portfolio');
    await expect(page.getByText('Workspace unavailable')).toBeVisible();
  });

  test('2. Complete Real Estate Journey: Data Entry → Caller Qualification (₹3.5 Cr Luxury Villa) → REL Acceptance → Developer Coordination → RERA & Title Search File', async ({ page }) => {
    const suffix = Math.floor(100000 + Math.random() * 900000).toString();
    const clientName = `Oberoi Crest Residencies ${suffix}`;
    const clientPhone = `982${suffix}1`;

    // Step A: Data Entry import into Real Estate vertical
    await page.goto('/login');
    await page.getByLabel('Work email').fill('deepa@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/data-entry\/intake/);

    // Switch to Bulk Spreadsheet Import Mode
    await page.getByRole('tab', { name: /Bulk Spreadsheet Import/i }).click();
    await page.getByRole('button', { name: 'Real Estate', exact: true }).click();
    await page.getByRole('button', { name: /Paste Rows from Excel \/ Sheets/i }).click();

    const pastedRows = [
      'Name\tMobile\tEmail\tWhatsApp\tLocation',
      `${clientName}\t${clientPhone}\tbuyer@oberoicrest${suffix}.test\t${clientPhone}\tMumbai`,
    ].join('\n');
    await page.getByPlaceholder(/Copy columns from Excel or Google Sheets/i).fill(pastedRows);
    await page.getByRole('button', { name: /Confirm & Start Import/i }).click();
    await expect(page.getByText(/✓ 100% Reconciled/i)).toBeVisible({ timeout: 25000 });

    // Step B: Assigned Frontline Caller qualifies the Real Estate prospect
    const assignedCaller = await loginAsAssignedCaller(page, clientName);
    const assignedRelEmail = assignedCaller === 'sameer@finverse.demo' ? 'neha.g@finverse.demo' : 'pooja.r@finverse.demo';

    // Open prospect file
    const callerRow = page.locator('tr', { hasText: clientName });
    await expect(callerRow).toBeVisible();
    await callerRow.getByRole('link', { name: /Open/i }).click();
    await page.waitForURL(/\/real-estate\/prospects\//);

    // Verify phone masking (caller protection)
    await expect(page.getByText(clientPhone)).not.toBeVisible();
    await expect(page.getByText(/•••••/).first()).toBeVisible();

    // Switch to Pipeline & outcomes tab
    await page.getByRole('tab', { name: 'Pipeline & outcomes' }).click();

    // Verify Real Estate qualification fields (Budget, Property Type, Preferred Location, Site Visit)
    await expect(page.getByText('Real Estate Advisory Mandate & Property Criteria')).toBeVisible();
    await page.getByTestId('property-budget-input').fill('35000000');
    await page.getByTestId('property-type-select').selectOption('Luxury Residential Villa / Apartment');
    await page.getByTestId('preferred-location-input').fill('Worli / Bandra West');
    await page.getByTestId('purchase-timeline-select').selectOption('Immediate (Within 30 Days)');
    await page.getByTestId('purchase-purpose-select').selectOption('End-Use / Self-Occupation');
    await page.getByTestId('site-visit-select').selectOption('Weekend Preferred');
    await page.getByTestId('caller-findings-input').fill('HNI family seeking sea-view 4BHK villa; funds available from equity liquidity; weekend inspection requested.');
    await page.getByTestId('qual-evidence-input').fill('Proof of funds verified via bank statement; RERA approved projects shortlisted.');

    // Submit Qualify & Hand Off
    await page.getByTestId('qualify-handoff-btn').click();
    await expect(page.getByText(/Prospect qualified and handed off/)).toBeVisible();

    // Verify Handoff status card visible to Caller
    await expect(page.getByText('Relationship Manager Handoff Status')).toBeVisible();
    await expect(page.getByText('PENDING').first()).toBeVisible();

    // Step C: Assigned Relationship Manager accepts handoff
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Work email').fill(assignedRelEmail);
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await page.waitForURL(/\/rel\/portfolio/);
    await page.goto('/rel/handoffs');

    // See inbound Real Estate handoff
    await expect(page.getByText(clientName).first()).toBeVisible();
    await expect(page.getByText('₹3.50 Cr').first()).toBeVisible();
    await expect(page.getByText('Luxury Residential Villa / Apartment').first()).toBeVisible();

    // Accept Handoff
    await page.getByRole('button', { name: 'Accept Handoff' }).first().click();
    await page.getByRole('button', { name: 'Confirm Acceptance' }).click();
    await expect(page.getByText('Handoff accepted')).toBeVisible();

    // Account appears in active portfolio
    await page.goto('/rel/portfolio');
    await expect(page.getByTestId('rel-portfolio-table')).toContainText(clientName);
    await expect(page.getByTestId('rel-portfolio-table')).toContainText('₹3.50 Cr');

    // Step D: Developer Institutions Coordination
    await page.goto('/rel/institutions');
    await expect(page.getByText('Real Estate Developers & Institutional Mandate Coordination')).toBeVisible();

    const selectMandate = page.getByTestId('select-borrower-mandate');
    await expect(selectMandate).toBeVisible();
    const opt = selectMandate.locator('option', { hasText: clientName });
    await expect(opt).toBeAttached({ timeout: 10000 });
    const optVal = await opt.getAttribute('value');
    if (optVal) {
      await selectMandate.selectOption(optVal);
    }

    // Select Developer Partner & submit allotment
    await page.getByTestId('select-partner-institution').selectOption('Lodha Luxury Collections');
    await page.getByTestId('proposed-facility-input').fill('Luxury Villa / Penthouse Allotment');
    await page.getByTestId('proposed-amount-input').fill('35000000');
    await page.getByTestId('interest-rate-input').fill('20:80 Construction Linked / Builder Escrow');
    await page.getByTestId('coordination-notes-input').fill('Private site visit scheduled for this weekend; MahaRERA P51800001234 verified.');

    const logBtn = page.getByTestId('log-coordination-btn');
    await expect(logBtn).toBeEnabled({ timeout: 10000 });
    await logBtn.click();
    await expect(page.getByText(/Proposal logged with Lodha Luxury Collections/)).toBeVisible();

    // Step E: Open Prospect File & verify honest RERA compliance & title search check
    await page.goto('/rel/portfolio');
    const portRow = page.locator('tr', { hasText: clientName });
    await portRow.getByRole('link', { name: 'Open File' }).click();
    await page.waitForURL(/\/rel\/prospects\//);

    // Verify RERA Compliance & Title Search Verification card (initially unevidenced & pending)
    await expect(page.getByTestId('real-estate-check-card')).toBeVisible();
    await expect(page.getByText('RERA COMPLIANCE & TITLE SEARCH VERIFICATION')).toBeVisible();
    await expect(page.getByText('PENDING VERIFICATION', { exact: true })).toBeVisible();
    await expect(page.getByText('Pending Legal Title Search')).toBeVisible();
    await expect(page.getByText('Not applicable for Real Estate acquisition', { exact: true })).toBeVisible();

    // Record human-reviewed legal and RERA evidence
    await page.getByTestId('record-verification-btn').click();
    await page.getByTestId('evidence-ref-input').fill('MH-RERA-VERIF-2026-4412');
    await page.getByTestId('rera-number-input').fill('MahaRERA P51800001234');
    await page.getByTestId('verify-notes-input').fill('Clear 30-year title search verified by legal counsel; RERA project registration active.');
    await page.getByTestId('confirm-verify-btn').click();

    // Now verified with provenance
    await expect(page.getByText('RERA & TITLE VERIFIED')).toBeVisible();
    await expect(page.getByText('Clear / 30-Year Search Free of Encumbrance')).toBeVisible();
    await expect(page.getByText('MH-RERA-VERIF-2026-4412')).toBeVisible();
    await expect(page.getByText('Not applicable for Real Estate acquisition', { exact: true })).toBeVisible();

    // Verify Banking CIBIL check is NOT visible
    await expect(page.getByText('CREDIT BUREAU VERIFICATION')).not.toBeVisible();

    // Verify Property Requirements & Site Visit Preference card
    await expect(page.getByText('Property Requirements & Site Visit Preference')).toBeVisible();
    await expect(page.getByText('₹3.50 Cr').first()).toBeVisible();
    await expect(page.getByText('Luxury Residential Villa / Apartment').first()).toBeVisible();
  });

  test('3. Return to Caller Flow: Relationship Manager returns deficient Real Estate handoff with mandatory reason', async ({ page }) => {
    const suffix = Math.floor(100000 + Math.random() * 900000).toString();
    const clientName = `Deficient Real Estate Mandate ${suffix}`;
    const clientPhone = `982${suffix}2`;

    // Data Entry import
    await page.goto('/login');
    await page.getByLabel('Work email').fill('deepa@finverse.demo');
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/data-entry\/intake/);

    await page.getByRole('tab', { name: /Bulk Spreadsheet Import/i }).click();
    await page.getByRole('button', { name: 'Real Estate', exact: true }).click();
    await page.getByRole('button', { name: /Paste Rows from Excel \/ Sheets/i }).click();

    const pastedRows = [
      'Name\tMobile\tEmail\tWhatsApp\tLocation',
      `${clientName}\t${clientPhone}\tinvestor@deficientre${suffix}.test\t${clientPhone}\tNavi Mumbai`,
    ].join('\n');
    await page.getByPlaceholder(/Copy columns from Excel or Google Sheets/i).fill(pastedRows);
    await page.getByRole('button', { name: /Confirm & Start Import/i }).click();
    await expect(page.getByText(/✓ 100% Reconciled/i)).toBeVisible({ timeout: 25000 });

    // Login as assigned caller & qualify
    const assignedCaller = await loginAsAssignedCaller(page, clientName);
    const assignedRelEmail = assignedCaller === 'sameer@finverse.demo' ? 'neha.g@finverse.demo' : 'pooja.r@finverse.demo';

    const callerRow = page.locator('tr', { hasText: clientName });
    await expect(callerRow).toBeVisible();
    await callerRow.getByRole('link', { name: /Open/i }).click();
    await page.waitForURL(/\/real-estate\/prospects\//);

    await page.getByRole('tab', { name: 'Pipeline & outcomes' }).click();
    await expect(page.getByText('Real Estate Advisory Mandate & Property Criteria')).toBeVisible();
    await page.getByTestId('property-budget-input').fill('15000000');
    await page.getByTestId('property-type-select').selectOption('Commercial Office Space');
    await page.getByTestId('preferred-location-input').fill('Navi Mumbai');
    await page.getByTestId('caller-findings-input').fill('Client seeking commercial office unit; requires commercial bank financing.');
    await page.getByTestId('qual-evidence-input').fill('In-principle bank pre-approval not yet secured.');
    await page.getByTestId('qualify-handoff-btn').click();
    await expect(page.getByText(/Prospect qualified and handed off/)).toBeVisible();

    // Verify handoff status card on caller side
    await expect(page.getByText('Relationship Manager Handoff Status')).toBeVisible();
    await expect(page.getByText('PENDING').first()).toBeVisible();

    // RM rejects/returns the handoff
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Work email').fill(assignedRelEmail);
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await page.waitForURL(/\/rel\/portfolio/);
    await page.goto('/rel/handoffs');
    await expect(page.getByText(clientName).first()).toBeVisible();

    // Return to Caller
    await page.getByRole('button', { name: 'Return to Caller' }).first().click();
    const returnReason = 'Client does not have approved commercial bank in-principle sanction and timeline is 6+ months.';
    await page.getByTestId('return-reason-input').fill(returnReason);
    await page.getByRole('button', { name: 'Confirm Return' }).click();
    await expect(page.getByText(/Handoff returned to caller/)).toBeVisible();

    // Assigned Caller sees RETURNED status and documented reason
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Work email').fill(assignedCaller);
    await page.getByLabel('Password', { exact: true }).fill('demo1234');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await page.waitForURL(/\/real-estate\/dashboard/);
    await page.goto('/real-estate/prospects');
    const returnedRow = page.locator('tr', { hasText: clientName });
    await returnedRow.getByRole('link', { name: /Open/i }).click();
    await page.waitForURL(/\/real-estate\/prospects\//);

    await page.getByRole('tab', { name: 'Pipeline & outcomes' }).click();
    await expect(page.getByText('RETURNED', { exact: true })).toBeVisible();
    await expect(page.getByText(returnReason)).toBeVisible();
  });
});
