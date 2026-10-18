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

  // Login as Vikram Malhotra (National Manager, EMP-009)
  await page.fill('input[type="email"], input#email', 'vikram@finverse.demo');
  await page.fill('input[type="password"], input#password', 'demo1234');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/national/**', { timeout: 10000 });
  console.log('Logged in successfully as Vikram Malhotra (NM). Current URL:', page.url());

  const actions = [
    {
      id: 'NM-01',
      name: 'overview',
      url: 'http://localhost:5173/national/overview',
      heading: 'Inspect national vertical performance',
    },
    {
      id: 'NM-02',
      name: 'regions_scorecard',
      url: 'http://localhost:5173/national/regions',
      heading: 'Compare regions and open an RM scorecard',
    },
    {
      id: 'NM-03',
      name: 'plan',
      url: 'http://localhost:5173/national/plan',
      heading: 'Allocate the national target to regions',
    },
    {
      id: 'NM-04',
      name: 'economics',
      url: 'http://localhost:5173/national/economics',
      heading: 'Review product and source economics',
    },
    {
      id: 'NM-05',
      name: 'rules',
      url: 'http://localhost:5173/national/rules',
      heading: 'Propose pipeline or product rule changes',
    },
    {
      id: 'NM-06',
      name: 'forecast',
      url: 'http://localhost:5173/national/forecast',
      heading: 'Submit the national forecast',
    },
    {
      id: 'NM-07',
      name: 'transfers_twin_cards',
      url: 'http://localhost:5173/national/transfers',
      heading: 'Approve a cross-region work transfer',
    },
    {
      id: 'NM-08',
      name: 'referrals_twin_cards',
      url: 'http://localhost:5173/national/referrals',
      heading: 'Accept or decline a cross-vertical referral',
    },
    {
      id: 'NM-09',
      name: 'escalations',
      url: 'http://localhost:5173/national/escalations',
      heading: 'Escalate a national commercial or finance issue',
    },
    {
      id: 'NM-10',
      name: 'reviews_twin_cards',
      url: 'http://localhost:5173/national/reviews',
      heading: 'Run an RM performance review',
    },
    {
      id: 'NM-11',
      name: 'reports',
      url: 'http://localhost:5173/national/reports',
      heading: 'Prepare the national executive pack',
    },
  ];

  for (const act of actions) {
    console.log(`\n--- CAPTURING ${act.id} (${act.name}) ---`);
    await page.setViewportSize({ width: 1536, height: 800 });
    await page.goto(act.url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const bodyText = await page.textContent('body');
    const hasHeading = bodyText?.includes(act.heading);
    console.log(`${act.id} Heading verified:`, hasHeading);

    const deskPath = resolve(EVIDENCE_DIR, `${act.id}_${act.name}_desktop.png`);
    await page.screenshot({ path: deskPath, fullPage: true });
    console.log(`Saved ${act.id} desktop screenshot:`, deskPath);

    // Mobile Viewport
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    const mobPath = resolve(EVIDENCE_DIR, `${act.id}_${act.name}_mobile.png`);
    await page.screenshot({ path: mobPath, fullPage: true });
    console.log(`Saved ${act.id} mobile screenshot:`, mobPath);
  }

  await browser.close();
  console.log('\nAll National Manager visual evidence captured cleanly across NM-01..NM-11!');
}

run().catch((err) => {
  console.error('Evidence capture failed:', err);
  process.exit(1);
});
