import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';

const EVIDENCE_DIR = resolve(__dirname, '../evidence/screenshots');
if (!existsSync(EVIDENCE_DIR)) {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1536, height: 800 },
  });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:5173/login...');
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });

  // Login as Ananya Roy (CFO, EMP-011)
  await page.fill('input[type="email"], input#email', 'ananya@finverse.demo');
  await page.fill('input[type="password"], input#password', 'demo1234');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/cfo/**', { timeout: 10000 });
  console.log('Logged in successfully as Ananya Roy (CFO). Current URL:', page.url());

  const actions = [
    {
      id: 'CFO-01',
      name: 'financial_balances_overview',
      url: 'http://localhost:5173/cfo/overview',
    },
    {
      id: 'CFO-02',
      name: 'sales_finance_handoff_twin_cards',
      url: 'http://localhost:5173/cfo/recognition',
    },
    {
      id: 'CFO-03',
      name: 'revenue_recognition_entry',
      url: 'http://localhost:5173/cfo/recognition',
    },
    {
      id: 'CFO-04',
      name: 'receivable_invoices',
      url: 'http://localhost:5173/cfo/invoices',
    },
    {
      id: 'CFO-05',
      name: 'bank_receipts_batch_import',
      url: 'http://localhost:5173/cfo/payments',
    },
    {
      id: 'CFO-06',
      name: 'payment_matching_twin_cards',
      url: 'http://localhost:5173/cfo/payments',
    },
    {
      id: 'CFO-07',
      name: 'unmatched_receipts_suspense',
      url: 'http://localhost:5173/cfo/payments',
    },
    {
      id: 'CFO-08',
      name: 'three_way_reconciliation_bridge',
      url: 'http://localhost:5173/cfo/overview',
    },
    {
      id: 'CFO-09',
      name: 'ar_ageing_and_collections',
      url: 'http://localhost:5173/cfo/invoices',
    },
    {
      id: 'CFO-10',
      name: 'refund_requests_twin_cards',
      url: 'http://localhost:5173/cfo/payments',
    },
    {
      id: 'CFO-11',
      name: 'credit_notes_and_reversing_entries',
      url: 'http://localhost:5173/cfo/recognition',
    },
    {
      id: 'CFO-12',
      name: 'incentive_calculation_pool_clawback',
      url: 'http://localhost:5173/cfo/incentives',
    },
    {
      id: 'CFO-13',
      name: 'incentive_dispute_resolution_twin_cards',
      url: 'http://localhost:5173/cfo/incentives',
    },
    {
      id: 'CFO-14',
      name: 'period_close_certification_checklist',
      url: 'http://localhost:5173/cfo/close',
    },
    {
      id: 'CFO-15',
      name: 'period_reopening_governance',
      url: 'http://localhost:5173/cfo/close',
    },
    {
      id: 'CFO-16',
      name: 'budget_allocation_variance',
      url: 'http://localhost:5173/cfo/planning',
    },
    {
      id: 'CFO-17',
      name: 'forecast_finance_concurrence',
      url: 'http://localhost:5173/cfo/planning',
    },
    {
      id: 'CFO-18',
      name: 'certified_finance_pack_preview_schedule',
      url: 'http://localhost:5173/cfo/reports',
    },
    {
      id: 'CFO-19',
      name: 'doa_matrix_policy_proposals',
      url: 'http://localhost:5173/cfo/policies',
    },
  ];

  for (const act of actions) {
    console.log(`\n--- CAPTURING ${act.id} (${act.name}) ---`);

    // Desktop
    await page.setViewportSize({ width: 1536, height: 800 });
    await page.goto(act.url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const desktopPath = resolve(EVIDENCE_DIR, `${act.id}_desktop.png`);
    await page.screenshot({ path: desktopPath, fullPage: false });
    console.log(`[DESKTOP] Saved: ${desktopPath}`);

    // Mobile
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(act.url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const mobilePath = resolve(EVIDENCE_DIR, `${act.id}_mobile.png`);
    await page.screenshot({ path: mobilePath, fullPage: false });
    console.log(`[MOBILE] Saved: ${mobilePath}`);
  }

  await browser.close();
  console.log('\nAll 19 CFO actions captured successfully in both Desktop and Mobile viewports!');
}

run().catch((err) => {
  console.error('Evidence capture failed:', err);
  process.exit(1);
});
