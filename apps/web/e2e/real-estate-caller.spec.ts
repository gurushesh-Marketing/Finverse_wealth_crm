import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

function isMobile(): boolean {
  return test.info().project.name.startsWith('mobile');
}

async function login(page: Page, email = 'sameer@finverse.demo', password = 'demo1234') {
  await page.goto('/login');
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/real-estate\/dashboard/);
}

const outDir = resolve(process.cwd(), '../../evidence/screenshots/real_estate_caller');
mkdirSync(outDir, { recursive: true });

async function snap(page: Page, name: string) {
  const prefix = isMobile() ? 'mobile' : 'desktop';
  const filePath = resolve(outDir, `${prefix}_${name}.png`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: filePath, fullPage: true });
}

test.describe('Real Estate Frontline Sales Caller (SC-01 through SC-28)', () => {

  test('Demo Access Directory: Frontline Real Estate Caller (Sameer Kulkarni) login flow', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');

    // Verify Demo Access panel exists and displays Real Estate
    await expect(page.getByText('Demo access — synthetic accounts')).toBeVisible();
    const realEstateGroup = page.locator('details', { hasText: 'Real Estate Advisory' });
    await expect(realEstateGroup).toBeVisible();

    // Open Real Estate accordion
    await realEstateGroup.locator('summary').click();
    await expect(realEstateGroup.getByText('Sameer Kulkarni')).toBeVisible();
    await expect(realEstateGroup.getByText('sameer@finverse.demo')).toBeVisible();

    // Click 'Use this account'
    await realEstateGroup.getByRole('button', { name: /Use account Sameer Kulkarni/i }).click();

    // Verify fields populated
    await expect(page.getByLabel('Work email')).toHaveValue('sameer@finverse.demo');
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue('demo1234');

    await snap(page, 'demo_access_real_estate_caller_selected');

    // Submit Sign in
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/real-estate\/dashboard/);

    // Verify landing on Real Estate Personal Workspace
    await expect(page.getByText('Personal Workspace')).toBeVisible();
    await expect(page.getByText('REAL ESTATE ADVISORY', { exact: true })).toBeVisible();
    await expect(page.getByText('Real Estate scope')).toBeVisible();
  });

  test('SC-01: Real Estate My Day dashboard, priority card, 5-stage pipeline & guidance modal [Deck P043/P044, P038]', async ({ page }) => {
    await login(page);
    await page.goto('/real-estate/dashboard');
    await expect(page.getByRole('heading', { name: /Your next conversation starts here/i })).toBeVisible();

    // Verify Scope Badge & Institutional Breadcrumb
    await expect(page.getByText('Personal Workspace')).toBeVisible();
    await expect(page.getByText('REAL ESTATE ADVISORY', { exact: true })).toBeVisible();
    await expect(page.getByText('Real Estate scope')).toBeVisible();

    // Verify Sidebar Navigation has exactly 8 unique Real Estate modules (no duplicates)
    if (!isMobile()) {
      const navLinks = page.locator('aside nav a[href^="/real-estate/"]');
      await expect(navLinks).toHaveCount(8);
      const linkTexts = await navLinks.allTextContents();
      const trimmedTexts = linkTexts.map((t) => t.trim());
      expect(trimmedTexts).toEqual([
        'My day',
        'Property Advisory Inbox',
        'Conversations',
        'Calendar & tasks',
        'Mandate pipeline',
        'Documents',
        'Performance',
        'Reviews & help',
      ]);
      expect(trimmedTexts.filter((t) => t === 'My day').length).toBe(1);
    }

    // Verify 4 Metric Cards (Deck P006 / P007)
    await expect(page.getByText('Due today', { exact: true })).toBeVisible();
    await expect(page.getByText('Overdue', { exact: true })).toBeVisible();
    await expect(page.getByText('Contacted / eligible', { exact: true })).toBeVisible();
    await expect(page.getByText('Wins / target', { exact: true })).toBeVisible();

    // Verify Hero Priority Card
    await expect(page.getByText('Your Priority')).toBeVisible();

    // Verify 7-day sparkline
    await expect(page.locator('svg[aria-label="Verified activity trend, last 7 days"]')).toBeVisible();

    // Verify Real Estate Opportunity Flow (5 stages: New -> Requirement -> Site Visit -> Booking -> Registration)
    const mainArea = page.getByRole('main');
    await expect(mainArea.getByText('Opportunity Flow')).toBeVisible();
    await expect(mainArea.getByText('New').first()).toBeVisible();
    await expect(mainArea.getByText('Requirement', { exact: true })).toBeVisible();
    await expect(mainArea.getByText('Site Visit')).toBeVisible();
    await expect(mainArea.getByText('Booking')).toBeVisible();
    await expect(mainArea.getByText('Registration')).toBeVisible();

    // Verify Availability toggle
    const busyBtn = page.getByRole('button', { name: 'Busy' });
    await busyBtn.click();
    await expect(page.getByText(/Availability set to busy/i)).toBeVisible();
    await page.getByRole('button', { name: 'Available' }).click();

    // Verify SC-01 Guidance Modal
    await page.getByRole('button', { name: 'Actions' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('SC-01 / MY DAY — Start the day and prioritise work')).toBeVisible();
    await snap(page, 'SC-01_guidance_modal');
    await page.getByRole('button', { name: 'Close Guidance' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();

    await snap(page, 'SC-01_my_day_dashboard');
  });

  test('SC-02 & SC-05: Real Estate Lead Inbox filters, saved views, and self-sourced enquiry capture [Deck P045/P046, P051/P052]', async ({ page }) => {
    await login(page);
    await page.goto('/real-estate/prospects');
    await expect(page.getByRole('heading', { name: /Real Estate Advisory Lead Inbox/i })).toBeVisible();

    // Verify 5 filters
    await expect(page.getByLabel('Search')).toBeVisible();
    await expect(page.getByLabel('Stage')).toBeVisible();
    await expect(page.getByLabel('Due')).toBeVisible();
    await expect(page.getByLabel('Source')).toBeVisible();
    await expect(page.getByLabel('Product')).toBeVisible();

    // Verify table columns match Deck P045
    const table = page.getByRole('table');
    await expect(table.getByText('REFERENCE')).toBeVisible();
    await expect(table.getByText('PROSPECT / SEARCH')).toBeVisible();
    await expect(table.getByText('STAGE')).toBeVisible();
    await expect(table.getByText('STATE / DUE')).toBeVisible();
    await expect(table.getByText('NEXT')).toBeVisible();

    // Verify Real Estate products in Product filter dropdown
    const productSelect = page.getByLabel('Product');
    await expect(productSelect.locator('option', { hasText: 'Luxury Residential Mandate' })).toBeAttached();
    await expect(productSelect.locator('option', { hasText: 'Commercial Office Space' })).toBeAttached();
    await expect(productSelect.locator('option', { hasText: 'Plotted Development & Villas' })).toBeAttached();

    // Open SC-02 Guidance
    await page.getByRole('button', { name: 'SC-02 Guidance' }).click();
    await expect(page.getByText('SC-02 / LEAD INBOX — Filter, search and save a lead view')).toBeVisible();
    await snap(page, 'SC-02_guidance_modal');
    await page.getByRole('button', { name: 'Close Guidance' }).click();

    // Capture New Enquiry (SC-05) Dialog
    await page.getByRole('button', { name: '+ New enquiry (SC-05)' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('SC-05 / LEAD INBOX — Create a permitted self-sourced enquiry')).toBeVisible();
    await expect(dialog.getByLabel('Prospect name')).toBeVisible();
    await expect(dialog.getByLabel('Phone (required verified format)')).toBeVisible();
    await expect(dialog.getByLabel(/Product/)).toBeVisible();
    await expect(dialog.locator('#enq-source')).toBeVisible();
    await expect(dialog.getByLabel('Permission evidence (reference and date)')).toBeVisible();
    await expect(dialog.getByLabel('Customer requirement (need)')).toBeVisible();
    await snap(page, 'SC-05_capture_enquiry_dialog');
    await page.getByRole('button', { name: 'Cancel' }).click();

    await snap(page, 'SC-02_real_estate_lead_inbox');
  });

  test('SC-03 & SC-04: Real Estate Prospect record 7-tab hub, context/history cards, and edit drawer [Deck P047..P050]', async ({ page }) => {
    await login(page);
    await page.goto('/real-estate/prospects/FV-4001');
    await expect(page.getByRole('heading', { name: 'Prospect details' })).toBeVisible();

    // Header banner matching Deck P047
    await expect(page.getByText('Assigned Prospect / FV-4001')).toBeVisible();
    await expect(page.getByText(/Real Estate Advisory · assigned permission scope/i)).toBeVisible();
    await expect(page.getByText('Customer Context')).toBeVisible();
    await expect(page.getByText('Opportunity key facts')).toBeVisible();
    await expect(page.getByText('Recent History')).toBeVisible();

    // 7 Tabs
    const tabList = ['Summary', 'Timeline', 'Tasks', 'Conversations', 'Documents', 'Pipeline & outcomes', 'Requests'];
    for (const t of tabList) {
      await expect(page.getByRole('tab', { name: t })).toBeVisible();
    }

    // SC-03 Guidance modal
    await page.getByRole('button', { name: 'SC-03 Guidance' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('SC-03 / LEAD INBOX — Open a prospect and inspect the full record')).toBeVisible();
    await snap(page, 'SC-03_guidance_modal');
    await page.getByRole('button', { name: 'Close Guidance' }).click();

    // SC-04 Edit details drawer
    await page.getByRole('button', { name: '✏️ Edit details (SC-04)' }).click();
    await expect(page.getByText('Correct prospect information')).toBeVisible();
    await expect(page.getByLabel('Display name')).toBeVisible();
    await expect(page.getByLabel('Phone (verified field)')).toBeVisible();
    await expect(page.getByLabel('Preferred language')).toBeVisible();
    await expect(page.getByLabel('Correction reason (required)')).toBeVisible();
    await expect(page.locator('summary', { hasText: 'Audit history' })).toBeVisible();
    await snap(page, 'SC-04_edit_details_drawer');
    await page.getByRole('button', { name: 'Close' }).click();

    await snap(page, 'SC-03_prospect_summary');
  });

  test('SC-06..SC-10: Real Estate voice calls, wrap-up, manual activities, WhatsApp, and inbound handling [Deck P053..P062]', async ({ page }) => {
    await login(page);
    await page.goto('/real-estate/prospects/FV-4001');

    // SC-06 & SC-09 Quick Header Actions
    await page.getByRole('button', { name: 'WhatsApp (SC-09)' }).click();
    await expect(page.getByText('Send approved WhatsApp')).toBeVisible();
    await expect(page.getByLabel('Approved template')).toBeVisible();
    await expect(page.getByText('SIMULATED')).toBeVisible();
    await snap(page, 'SC-09_whatsapp_drawer');
    await page.getByRole('button', { name: 'Close' }).click();

    // Switch to Conversations tab
    await page.getByRole('tab', { name: 'Conversations' }).click();
    await expect(page.getByRole('tabpanel')).toBeVisible();

    // SC-06 Call Simulator
    await expect(page.getByText('Place voice call (SC-06)')).toBeVisible();
    await expect(page.getByText('SIMULATED, no provider integration')).toBeVisible();

    // SC-08 Manual Activity Form
    await expect(page.getByText('Log manual activity (SC-08)')).toBeVisible();
    await expect(page.getByLabel('Activity type')).toBeVisible();
    await expect(page.getByLabel('Occurred at')).toBeVisible();
    await expect(page.getByLabel('Reason for manual entry')).toBeVisible();

    // SC-10 Inbound Form
    await expect(page.getByText('Handle inbound reply / missed call (SC-10)')).toBeVisible();
    await expect(page.getByLabel('Channel')).toBeVisible();
    await expect(page.getByLabel('Customer intent')).toBeVisible();

    await snap(page, 'SC-06_08_10_conversations_tab');

    // Dedicated Conversations Area Page (/real-estate/activities)
    await page.goto('/real-estate/activities');
    await expect(page.getByRole('heading', { name: 'Conversations' })).toBeVisible();
    await expect(page.getByText('Activity feed')).toBeVisible();
    await snap(page, 'SC-06_10_conversations_area_page');
  });

  test('SC-11..SC-14: Real Estate follow-ups, reschedule deferrals, task states, and site visit bookings [Deck P063..P070]', async ({ page }) => {
    await login(page);
    await page.goto('/real-estate/prospects/FV-4001');

    // SC-11 Follow-up drawer on Summary tab
    await page.getByRole('button', { name: 'Schedule follow-up (SC-11)' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByLabel('Action')).toBeVisible();
    await expect(page.getByLabel('Purpose')).toBeVisible();
    await expect(page.getByLabel('Due date')).toBeVisible();
    await expect(page.getByLabel('Due time')).toBeVisible();
    await expect(page.getByLabel('Priority')).toBeVisible();
    await expect(page.getByLabel('Reminder')).toBeVisible();
    await snap(page, 'SC-11_followup_drawer');
    await page.getByRole('button', { name: 'Close' }).click();

    // Switch to Tasks Tab
    await page.getByRole('tab', { name: 'Tasks' }).click();
    await expect(page.getByRole('tabpanel')).toBeVisible();

    // SC-14 Book Meeting / Site Visit Dialog
    await page.getByRole('button', { name: 'Book meeting (SC-14)' }).click();
    await expect(page.getByText('Book meeting or visit (SC-14)')).toBeVisible();
    await expect(page.getByLabel('Meeting type')).toBeVisible();
    await expect(page.getByLabel('Slot')).toBeVisible();
    await expect(page.getByLabel('Location / approved link')).toBeVisible();
    await expect(page.getByLabel('Attendees')).toBeVisible();
    await expect(page.getByLabel('Agenda')).toBeVisible();
    await snap(page, 'SC-14_meeting_dialog');
    await page.getByRole('button', { name: 'Close' }).click();

    await snap(page, 'SC-12_13_14_tasks_tab');

    // Dedicated Calendar & Tasks Area Page (/real-estate/tasks)
    await page.goto('/real-estate/tasks');
    await expect(page.getByRole('heading', { name: 'Calendar & tasks' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Run due reminders' })).toBeVisible();
    await snap(page, 'SC-11_14_tasks_area_page');
  });

  test('SC-15..SC-17, SC-20..SC-22: Real Estate qualification, stage moves, proposals, conversion & loss [Deck P071..P076, P081..P086]', async ({ page }) => {
    await login(page);
    await page.goto('/real-estate/prospects/FV-4001');
    await page.getByRole('tab', { name: 'Pipeline & outcomes' }).click();
    await expect(page.getByRole('tabpanel')).toBeVisible();

    // SC-15 Qualification with Real Estate Product & Mandate default
    await expect(page.getByText('Qualification (SC-15)')).toBeVisible();
    await expect(page.getByLabel('Documented requirement')).toBeVisible();
    await expect(page.getByLabel('Expected facility / investment value')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save qualification' })).toBeVisible();

    // SC-16 Move in pipeline with Real Estate stages (Requirement, Site Visit, Booking)
    await expect(page.getByText(/Move in pipeline \(SC-16\)/i)).toBeVisible();
    await expect(page.getByLabel('Requested stage')).toBeVisible();
    await expect(page.locator('#mv-reason')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm move' })).toBeVisible();

    // SC-17 Proposals with Real Estate allotment template (allotment-v1)
    await expect(page.getByText('Proposal (SC-17)')).toBeVisible();
    await expect(page.getByLabel('Terms')).toBeVisible();
    await expect(page.getByLabel('Validity')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create draft' })).toBeVisible();

    // SC-20 Conversion with Real Estate win milestone
    await expect(page.getByText('Submit conversion (SC-20)')).toBeVisible();
    await expect(page.getByLabel('Win milestone')).toBeVisible();
    await expect(page.getByLabel('Evidence reference')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Submit conversion' })).toBeVisible();

    // SC-21 Mark Lost with Real Estate loss reasons
    await expect(page.getByText('Mark lost (SC-21)')).toBeVisible();
    await expect(page.locator('#l-reason')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm loss' })).toBeVisible();

    // SC-22 Request Reopen
    await expect(page.getByText('Request reopen (SC-22)')).toBeVisible();
    await expect(page.getByLabel('New evidence')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Request reopen' })).toBeVisible();

    await snap(page, 'SC-15_22_pipeline_tab');

    // Dedicated Real Estate Pipeline Area Page (/real-estate/deals)
    await page.goto('/real-estate/deals');
    await expect(page.getByRole('heading', { name: 'Property pipeline' })).toBeVisible();
    await snap(page, 'SC-15_real_estate_deals_area_page');
  });

  test('SC-18 & SC-19: Real Estate document requests and genuine evidence management [Deck P077..P080]', async ({ page }) => {
    await login(page);
    await page.goto('/real-estate/prospects/FV-4001');
    await page.getByRole('tab', { name: 'Documents' }).click();
    await expect(page.getByRole('tabpanel')).toBeVisible();

    // SC-18 Request Documents
    await expect(page.getByText('Request documents (SC-18)')).toBeVisible();
    await expect(page.getByLabel('Checklist')).toBeVisible();
    await expect(page.getByLabel('Requested files (comma separated)')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create request' })).toBeVisible();

    // SC-19 Upload Evidence
    await expect(page.getByText('Upload evidence (SC-19)')).toBeVisible();
    await expect(page.getByLabel('Document type')).toBeVisible();
    await expect(page.getByLabel('Filename')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Upload file' })).toBeVisible();

    await snap(page, 'SC-18_19_documents_tab');

    // Dedicated Documents Area Page (/real-estate/documents)
    await page.goto('/real-estate/documents');
    await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();
    await snap(page, 'SC-18_19_documents_area_page');
  });

  test('SC-23, SC-24, SC-28: Real Estate referrals, opt-out suppression, and metric blocker requests [Deck P087..P090, P097..P098]', async ({ page }) => {
    await login(page);
    await page.goto('/real-estate/prospects/FV-4001');
    await page.getByRole('tab', { name: 'Requests' }).click();
    await expect(page.getByRole('tabpanel')).toBeVisible();

    // SC-23 Cross-vertical referral
    await expect(page.getByText('Request handoff / cross-vertical referral (SC-23)')).toBeVisible();
    await expect(page.getByLabel('Destination')).toBeVisible();
    await expect(page.getByLabel('Customer permission evidence')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Submit handoff' })).toBeVisible();

    // SC-24 Opt-out suppression
    await expect(page.getByText('Opt-out / contact complaint (SC-24)')).toBeVisible();
    await expect(page.getByLabel('Channels (comma separated: voice, whatsapp, sms, email)')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Record opt-out' })).toBeVisible();

    // SC-28 Raise blocker / metric correction
    await expect(page.getByText('Raise blocker / metric correction (SC-28)')).toBeVisible();
    await expect(page.getByLabel('Request type')).toBeVisible();
    await expect(page.getByLabel('Expected correction')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Submit request' })).toBeVisible();

    await snap(page, 'SC-23_24_28_requests_tab');
  });

  test('SC-25, SC-26, SC-27: Real Estate performance formulas, 1:1 reviews, and binary PDF export [Deck P091..P096]', async ({ page }) => {
    await login(page);

    // Dedicated Performance Page (/real-estate/reports)
    await page.goto('/real-estate/reports');
    await expect(page.getByRole('heading', { name: 'Performance' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export PDF' })).toBeVisible();
    await snap(page, 'SC-25_27_performance_page');

    // Dedicated Reviews & Help Page (/real-estate/reviews)
    await page.goto('/real-estate/reviews');
    await expect(page.getByRole('heading', { name: 'Reviews & help' })).toBeVisible();
    await snap(page, 'SC-26_reviews_page');
  });
});
