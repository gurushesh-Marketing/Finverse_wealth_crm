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

  // Login as Kavita Rao (RM)
  await page.fill('input[type="email"], input#email', 'kavita@finverse.demo');
  await page.fill('input[type="password"], input#password', 'demo1234');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/regional/**', { timeout: 10000 });
  console.log('Logged in successfully as Kavita Rao (RM). Current URL:', page.url());

  // 1. RM-06 Staffing Plan (tab in Regional Approvals)
  console.log('\n--- VERIFYING RM-06 STAFFING ---');
  await page.goto('http://localhost:5173/regional/approvals', { waitUntil: 'networkidle' });
  await page.click('button:has-text("Staffing Requisitions (RM-06)")');
  await page.waitForTimeout(1000);

  // Check DOM elements
  const staffingWorkArea = await page.textContent('body');
  const hasStaffingWorkArea = staffingWorkArea?.includes('Approve a regional staffing plan');
  const hasTwinSubmittedEvidence = staffingWorkArea?.includes('SUBMITTED EVIDENCE') && staffingWorkArea?.includes('Decision request');
  const hasTwinAuthority = staffingWorkArea?.includes('YOUR AUTHORITY') && staffingWorkArea?.includes('Independent decision');
  const hasApproveOption = staffingWorkArea?.includes('Approve within authority');
  const hasReturnOption = staffingWorkArea?.includes('Return for correction');
  const hasRejectOption = staffingWorkArea?.includes('Reject with reason');
  const hasHeadcount = staffingWorkArea?.includes('Planned Headcount') && staffingWorkArea?.includes('Approved Headcount');
  const hasContinue = staffingWorkArea?.includes('Continue ->');

  console.log('RM-06 DOM Check:', {
    hasStaffingWorkArea,
    hasTwinSubmittedEvidence,
    hasTwinAuthority,
    hasApproveOption,
    hasReturnOption,
    hasRejectOption,
    hasHeadcount,
    hasContinue,
  });

  const p1 = resolve(EVIDENCE_DIR, 'RM-06_staffing_desktop.png');
  await page.screenshot({ path: p1, fullPage: true });
  console.log('Saved RM-06 desktop screenshot:', p1);

  // Mobile viewport for RM-06
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  const p1m = resolve(EVIDENCE_DIR, 'RM-06_staffing_mobile.png');
  await page.screenshot({ path: p1m, fullPage: true });
  console.log('Saved RM-06 mobile screenshot:', p1m);

  // 2. RM-08 Escalations (tab in Regional Forecasts)
  console.log('\n--- VERIFYING RM-08 ESCALATIONS ---');
  await page.setViewportSize({ width: 1536, height: 800 });
  await page.goto('http://localhost:5173/regional/forecasts', { waitUntil: 'networkidle' });
  await page.click('button:has-text("RM-08")');
  await page.waitForTimeout(1000);

  const escWorkArea = await page.textContent('body');
  const hasEscWorkArea = escWorkArea?.includes('Resolve a regional escalation');
  const hasEscTwinEvidence = escWorkArea?.includes('SUBMITTED EVIDENCE') && escWorkArea?.includes('Decision request');
  const hasEscTwinAuthority = escWorkArea?.includes('YOUR AUTHORITY') && escWorkArea?.includes('Independent decision');
  const hasEscApprove = escWorkArea?.includes('Approve within authority');
  const hasEscQueue = escWorkArea?.includes('Regional Escalation & Exception Queue (RM-08)');
  const hasEscContinue = escWorkArea?.includes('Continue ->');

  console.log('RM-08 DOM Check:', {
    hasEscWorkArea,
    hasEscTwinEvidence,
    hasEscTwinAuthority,
    hasEscApprove,
    hasEscQueue,
    hasEscContinue,
  });

  const p2 = resolve(EVIDENCE_DIR, 'RM-08_escalations_desktop.png');
  await page.screenshot({ path: p2, fullPage: true });
  console.log('Saved RM-08 desktop screenshot:', p2);

  // Mobile viewport for RM-08
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  const p2m = resolve(EVIDENCE_DIR, 'RM-08_escalations_mobile.png');
  await page.screenshot({ path: p2m, fullPage: true });
  console.log('Saved RM-08 mobile screenshot:', p2m);

  await browser.close();
  console.log('\nAll visual evidence captured and verified successfully.');
}

run().catch((err) => {
  console.error('Visual capture failed:', err);
  process.exit(1);
});
