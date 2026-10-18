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

  // Login as Rajiv Mehta (CEO, EMP-010)
  await page.fill('input[type="email"], input#email', 'rajiv@finverse.demo');
  await page.fill('input[type="password"], input#password', 'demo1234');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/ceo/**', { timeout: 10000 });
  console.log('Logged in successfully as Rajiv Mehta (CEO). Current URL:', page.url());

  const actions = [
    {
      id: 'CEO-01',
      name: 'operating_picture',
      url: 'http://localhost:5173/ceo/overview',
    },
    {
      id: 'CEO-02',
      name: 'verticals_comparison',
      url: 'http://localhost:5173/ceo/verticals',
    },
    {
      id: 'CEO-03',
      name: 'nm_contribution',
      url: 'http://localhost:5173/ceo/nms',
    },
    {
      id: 'CEO-04',
      name: 'targets_approval',
      url: 'http://localhost:5173/ceo/targets',
    },
    {
      id: 'CEO-05',
      name: 'consolidated_forecast',
      url: 'http://localhost:5173/ceo/forecast',
    },
    {
      id: 'CEO-06',
      name: 'growth_initiatives',
      url: 'http://localhost:5173/ceo/growth',
    },
    {
      id: 'CEO-07',
      name: 'priority_conflicts_twin_cards',
      url: 'http://localhost:5173/ceo/conflicts',
    },
    {
      id: 'CEO-08',
      name: 'critical_operating_risks',
      url: 'http://localhost:5173/ceo/risks',
    },
    {
      id: 'CEO-09',
      name: 'leadership_reviews_twin_cards',
      url: 'http://localhost:5173/ceo/leadership',
    },
    {
      id: 'CEO-10',
      name: 'board_meeting_pack',
      url: 'http://localhost:5173/ceo/board',
    },
    {
      id: 'CEO-11',
      name: 'executive_commitments',
      url: 'http://localhost:5173/ceo/commitments',
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
  console.log('\nAll 11 CEO actions captured successfully in both Desktop and Mobile viewports!');
}

run().catch((err) => {
  console.error('Evidence capture failed:', err);
  process.exit(1);
});
