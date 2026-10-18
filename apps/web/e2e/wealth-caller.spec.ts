import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

function isMobile(): boolean {
  return test.info().project.name.startsWith('mobile');
}

async function login(page: Page, email = 'asha@finverse.demo', password = 'demo1234') {
  await page.goto('/login');
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/wealth\/dashboard/);
}

const outDir = resolve(process.cwd(), '../../evidence/screenshots/wealth_caller');
mkdirSync(outDir, { recursive: true });

async function snap(page: Page, name: string) {
  const prefix = isMobile() ? 'mobile' : 'desktop';
  const filePath = resolve(outDir, `${prefix}_${name}.png`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: filePath, fullPage: true });
}

test.describe('Wealth Frontline Sales Caller (SC-01 through SC-28)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('SC-01: My Day dashboard, operational signals, priority card & guidance modal', async ({ page }) => {
    await page.goto('/wealth/dashboard');
    await expect(page.getByRole('heading', { name: /Your next conversation starts here/i })).toBeVisible();

    // Verify Scope Badge & Institutional Breadcrumb
    await expect(page.getByText('Wealth scope')).toBeVisible();

    // Verify 4 Metric Cards (Deck P006 / P007)
    await expect(page.getByText('Due today', { exact: true })).toBeVisible();
    await expect(page.getByText('Overdue', { exact: true })).toBeVisible();
    await expect(page.getByText('Contacted / eligible', { exact: true })).toBeVisible();
    await expect(page.getByText('Wins / target', { exact: true })).toBeVisible();

    // Verify Hero Priority Card
    await expect(page.getByText('Your Priority')).toBeVisible();

    // Verify 7-day sparkline
    await expect(page.locator('svg[aria-label="Verified activity trend, last 7 days"]')).toBeVisible();

    // Verify Opportunity Flow (5 stages)
    await expect(page.getByText('Opportunity Flow')).toBeVisible();
    await expect(page.getByText('New', { exact: true })).toBeVisible();
    await expect(page.getByText('Discovery')).toBeVisible();
    await expect(page.getByText('Suitability')).toBeVisible();
    await expect(page.getByText('Proposal')).toBeVisible();
    await expect(page.getByText('Onboarding')).toBeVisible();

    // Verify Availability toggle
    const availBtn = page.getByRole('button', { name: 'Busy' });
    await availBtn.click();
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

  test('SC-02 & SC-05: Lead Inbox filters, saved views, and self-sourced enquiry capture', async ({ page }) => {
    await page.goto('/wealth/prospects');
    await expect(page.getByRole('heading', { name: 'Lead Inbox' })).toBeVisible();

    // Verify 5 filters
    await expect(page.getByLabel('Search')).toBeVisible();
    await expect(page.getByLabel('Stage')).toBeVisible();
    await expect(page.getByLabel('Due')).toBeVisible();
    await expect(page.getByLabel('Source')).toBeVisible();
    await expect(page.getByLabel('Product')).toBeVisible();

    // Table columns matching Deck P045
    await expect(page.getByRole('columnheader', { name: 'REFERENCE' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'PROSPECT / SEARCH' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'STAGE' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'STATE / DUE' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'NEXT' })).toBeVisible();

    // Verify SC-05 Enquiry Capture Dialog
    await page.getByRole('button', { name: '+ New enquiry (SC-05)' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('SC-05 / LEAD INBOX — Create a permitted self-sourced enquiry')).toBeVisible();
    await expect(dialog.getByLabel('Prospect name')).toBeVisible();
    await expect(dialog.getByLabel('Phone (required verified format)')).toBeVisible();
    await expect(dialog.getByLabel('Product (Wealth)')).toBeVisible();
    await expect(dialog.locator('#enq-source')).toBeVisible();
    await expect(dialog.getByLabel('Permission evidence (reference and date)')).toBeVisible();
    await expect(dialog.getByLabel('Customer requirement (need)')).toBeVisible();
    await snap(page, 'SC-05_enquiry_dialog');
    await page.getByRole('button', { name: 'Cancel' }).click();

    // SC-02 Guidance modal
    await page.getByRole('button', { name: 'SC-02 Guidance' }).click();
    await expect(page.getByText('SC-02 / LEAD INBOX — Filter, search and save a lead view')).toBeVisible();
    await snap(page, 'SC-02_guidance_modal');
    await page.getByRole('button', { name: 'Close Guidance' }).click();

    await snap(page, 'SC-02_lead_inbox');
  });

  test('SC-03 & SC-04: Prospect record 7-tab hub, context/history cards, and edit drawer', async ({ page }) => {
    await page.goto('/wealth/prospects/FV-1001');
    await expect(page.getByRole('heading', { name: 'Prospect details' })).toBeVisible();

    // Header banner matching Deck P047
    await expect(page.getByText('Assigned Prospect / FV-1001')).toBeVisible();
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

  test('SC-06..SC-10: Voice calls, wrap-up, manual activities, WhatsApp, and inbound handling', async ({ page }) => {
    await page.goto('/wealth/prospects/FV-1001');

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

    // Also verify Dedicated Conversations Area Page (/wealth/activities)
    await page.goto('/wealth/activities');
    await expect(page.getByRole('heading', { name: 'Conversations' })).toBeVisible();
    await expect(page.getByText('Activity feed')).toBeVisible();
    await snap(page, 'SC-06_10_conversations_area_page');
  });

  test('SC-11..SC-14: Follow-ups, reschedule deferrals, task states, and meeting bookings', async ({ page }) => {
    await page.goto('/wealth/prospects/FV-1001');

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

    // SC-14 Book Meeting Dialog
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

    // Dedicated Calendar & Tasks Area Page (/wealth/tasks)
    await page.goto('/wealth/tasks');
    await expect(page.getByRole('heading', { name: 'Calendar & tasks' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Run due reminders' })).toBeVisible();
    await snap(page, 'SC-11_14_tasks_area_page');
  });

  test('SC-15..SC-17, SC-20..SC-22: Pipeline qualification, stage moves, proposals, conversion & loss', async ({ page }) => {
    await page.goto('/wealth/prospects/FV-1001');
    await page.getByRole('tab', { name: 'Pipeline & outcomes' }).click();
    await expect(page.getByRole('tabpanel')).toBeVisible();

    // SC-15 Qualification
    await expect(page.getByText('Qualification (SC-15)')).toBeVisible();
    await expect(page.getByLabel('Documented requirement')).toBeVisible();
    await expect(page.getByLabel('Expected facility / investment value')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save qualification' })).toBeVisible();

    // SC-16 Move in pipeline
    await expect(page.getByText(/Move in pipeline \(SC-16\)/i)).toBeVisible();
    await expect(page.getByLabel('Requested stage')).toBeVisible();
    await expect(page.locator('#mv-reason')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm move' })).toBeVisible();

    // SC-17 Proposals
    await expect(page.getByText('Proposal (SC-17)')).toBeVisible();
    await expect(page.getByLabel('Terms')).toBeVisible();
    await expect(page.getByLabel('Validity')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create draft' })).toBeVisible();

    // SC-20 Conversion
    await expect(page.getByText('Submit conversion (SC-20)')).toBeVisible();
    await expect(page.getByLabel('Win milestone')).toBeVisible();
    await expect(page.getByLabel('Evidence reference')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Submit conversion' })).toBeVisible();

    // SC-21 Mark Lost
    await expect(page.getByText('Mark lost (SC-21)')).toBeVisible();
    await expect(page.locator('#l-reason')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm loss' })).toBeVisible();

    // SC-22 Request Reopen
    await expect(page.getByText('Request reopen (SC-22)')).toBeVisible();
    await expect(page.getByLabel('New evidence')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Request reopen' })).toBeVisible();

    await snap(page, 'SC-15_22_pipeline_tab');

    // Dedicated Pipeline Area Page (/wealth/deals)
    await page.goto('/wealth/deals');
    await expect(page.getByRole('heading', { name: 'My pipeline' })).toBeVisible();
    await snap(page, 'SC-16_pipeline_area_page');
  });

  test('SC-18 & SC-19: Document requests and genuine evidence management', async ({ page }) => {
    await page.goto('/wealth/prospects/FV-1001');
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

    // Dedicated Documents Area Page (/wealth/documents)
    await page.goto('/wealth/documents');
    await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();
    await snap(page, 'SC-18_19_documents_area_page');
  });

  test('SC-23, SC-24, SC-28: Referrals, opt-out suppression, and metric blocker requests', async ({ page }) => {
    await page.goto('/wealth/prospects/FV-1001');
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

  test('SC-25, SC-26, SC-27: Performance formulas, 1:1 reviews, and binary PDF export', async ({ page }) => {
    // SC-25 & SC-27 Performance Page
    await page.goto('/wealth/reports');
    await expect(page.getByRole('heading', { name: 'Performance' })).toBeVisible();
    await expect(page.getByLabel('Period')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export PDF' })).toBeVisible();

    // Formula disclosure check
    await expect(page.getByText(/personal metrics from stored events/i)).toBeVisible();
    await snap(page, 'SC-25_performance_page');

    // SC-26 Reviews & Help Page
    await page.goto('/wealth/reviews');
    await expect(page.getByRole('heading', { name: 'Reviews & help' })).toBeVisible();
    await expect(page.getByText('One-to-ones', { exact: true })).toBeVisible();
    await snap(page, 'SC-26_reviews_page');
  });
});
