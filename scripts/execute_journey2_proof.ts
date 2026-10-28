import { pool } from '../apps/api/src/repo/db';
import * as deRepo from '../apps/api/src/repo/data-entry';
import { loadAuthContextByEmail } from '../apps/api/src/repo/users';
import { chromium } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

interface VerticalTestConfig {
  vertical: 'wealth' | 'banking' | 'markets' | 'real_estate';
  teamId: string;
  sourceId: string;
  product: string;
  inboxRoute: string;
  representativeCallerId: string;
  representativeCallerEmail: string;
  screenshotName: string;
}

const CONFIGS: VerticalTestConfig[] = [
  {
    vertical: 'wealth',
    teamId: 'TEAM-WEALTH-ALPHA',
    sourceId: 'SRC-WEB-01',
    product: 'V1 Wealth Portfolio',
    inboxRoute: '/wealth/prospects',
    representativeCallerId: 'EMP-001',
    representativeCallerEmail: 'asha@finverse.demo',
    screenshotName: 'journey2_wealth_inbox.png',
  },
  {
    vertical: 'banking',
    teamId: 'TEAM-BANKING-ALPHA',
    sourceId: 'SRC-WEB-01',
    product: 'Corporate Term Loan',
    inboxRoute: '/banking/prospects',
    representativeCallerId: 'EMP-004',
    representativeCallerEmail: 'dev@finverse.demo',
    screenshotName: 'journey2_banking_inbox.png',
  },
  {
    vertical: 'markets',
    teamId: 'TEAM-MARKETS-ALPHA',
    sourceId: 'SRC-WEB-01',
    product: 'Equity Delivery & Intraday',
    inboxRoute: '/markets/prospects',
    representativeCallerId: 'EMP-021',
    representativeCallerEmail: 'kabir@finverse.demo',
    screenshotName: 'journey2_markets_inbox.png',
  },
  {
    vertical: 'real_estate',
    teamId: 'TEAM-REALESTATE-ALPHA',
    sourceId: 'SRC-WEB-01',
    product: 'Luxury Residential Mandate',
    inboxRoute: '/real-estate/prospects',
    representativeCallerId: 'EMP-026',
    representativeCallerEmail: 'sameer@finverse.demo',
    screenshotName: 'journey2_realestate_inbox.png',
  },
];

async function main() {
  const screenshotDir = path.resolve(process.cwd(), 'evidence/screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  console.log('=== JOURNEY 2: DATA ENTRY BULK UPLOAD ROUND-ROBIN ALLOCATION (4 VERTICALS x 5 CALLERS) ===');

  // Load Data Entry user scope (Deepa Patel, EMP-015)
  const deAuth = await loadAuthContextByEmail('deepa@finverse.demo');
  if (!deAuth) throw new Error('Data Entry user deepa@finverse.demo not found in DB');
  const deScope = deAuth.scope;

  const resultsSummary: Record<string, any> = {};

  for (const cfg of CONFIGS) {
    console.log(`\n--------------------------------------------------------------------------------`);
    console.log(`TESTING VERTICAL: ${cfg.vertical.toUpperCase()} (Team: ${cfg.teamId})`);
    console.log(`--------------------------------------------------------------------------------`);

    // 1. Verify the 5 eligible callers in this team
    const { rows: eligibleCallers } = await pool.query(
      `SELECT e.id, e.display_name, a.team_id, e.reporting_manager_id, m.display_name as manager_name
         FROM assignments a
         JOIN employees e ON e.id = a.employee_id
         JOIN teams t ON t.id = a.team_id
         LEFT JOIN employees m ON e.reporting_manager_id = m.id
        WHERE a.vertical = $1 AND a.team_id = $2 AND a.role = 'SC' AND e.status = 'active'
        ORDER BY e.id ASC`,
      [cfg.vertical, cfg.teamId]
    );

    console.log(`Found ${eligibleCallers.length} active SC callers in ${cfg.teamId}:`);
    eligibleCallers.forEach((c, idx) => {
      console.log(`  [Caller ${idx + 1}] ${c.id}: ${c.display_name} (Superior: ${c.reporting_manager_id} - ${c.manager_name})`);
    });

    if (eligibleCallers.length !== 5) {
      throw new Error(`Expected exactly 5 callers in ${cfg.teamId}, but found ${eligibleCallers.length}`);
    }

    // Reset round-robin cursor for clean deterministic distribution
    await pool.query(
      `DELETE FROM round_robin_cursors WHERE (vertical = $1 OR vertical = REPLACE($1, '_', '-')) AND team_id = $2`,
      [cfg.vertical, cfg.teamId]
    );

    // 2. Generate a 10-lead CSV file (2 leads per caller)
    const basePhoneNum = 9000000000 + Math.floor(Math.random() * 9000000);
    const csvRows = ['Name,Phone,Email,Product,Consent,Date,Notes,Priority'];
    for (let i = 1; i <= 10; i++) {
      const pName = `Prospect ${cfg.vertical.toUpperCase()} ${i}`;
      const pPhone = `${basePhoneNum + i}`;
      const pEmail = `prospect.${cfg.vertical}.${Date.now().toString().slice(-4)}_${i}@example.com`;
      csvRows.push(
        `"${pName}","${pPhone}","${pEmail}","${cfg.product}","Explicit Inbound Portal Consent Form 2026","2026-10-27","Lead ${i} for round-robin evaluation","false"`
      );
    }
    const csvContent = csvRows.join('\n');

    // 3. DE Upload Batch
    const batchName = `Batch-${cfg.vertical.toUpperCase()}-${Date.now().toString().slice(-4)}`;
    console.log(`\n[DE Upload] Uploading batch "${batchName}" (10 leads) to team ${cfg.teamId}...`);
    const batchSummary = await deRepo.uploadBatch(deScope, {
      batchName,
      sourceId: cfg.sourceId,
      vertical: cfg.vertical,
      targetTeamId: cfg.teamId,
      fileName: `${batchName.toLowerCase()}.csv`,
      csvContent,
    });
    console.log(`  -> Batch uploaded: ID=${batchSummary.id}, Valid Rows=${batchSummary.validRows}, Rejected=${batchSummary.rejectedRows}`);

    // 4. DE Publish Batch
    console.log(`[DE Publish] Publishing batch ${batchSummary.id}...`);
    const publishReceipt = await deRepo.publishBatch(deScope, { batchId: batchSummary.id });
    console.log(`  -> Batch published! Leads created: ${publishReceipt.canonicalLeadIds.length}`);

    // 5. Query leads assigned in DB and group by caller
    const { rows: assignedLeadRows } = await pool.query(
      `SELECT l.id as lead_id, l.display_name, l.phone, l.owner_employee_id, e.display_name as owner_name, l.created_at
         FROM leads l
         JOIN employees e ON e.id = l.owner_employee_id
        WHERE l.intake_batch_id = $1
        ORDER BY l.created_at ASC, l.id ASC`,
      [batchSummary.id]
    );

    const countsByCaller: Record<string, { name: string; count: number; leadIds: string[] }> = {};
    for (const c of eligibleCallers) {
      countsByCaller[c.id] = { name: c.display_name, count: 0, leadIds: [] };
    }

    for (const l of assignedLeadRows) {
      if (countsByCaller[l.owner_employee_id]) {
        countsByCaller[l.owner_employee_id].count++;
        countsByCaller[l.owner_employee_id].leadIds.push(l.lead_id);
      }
    }

    console.log(`\nPer-caller lead distribution in ${cfg.teamId} for batch ${batchSummary.id}:`);
    for (const [callerId, data] of Object.entries(countsByCaller)) {
      console.log(`  ${callerId} (${data.name}): ${data.count} leads -> [${data.leadIds.join(', ')}]`);
    }

    // Validate that each of the 5 callers received exactly 2 leads
    const counts = Object.values(countsByCaller).map((c) => c.count);
    const allGotTwo = counts.every((c) => c === 2);
    if (!allGotTwo) {
      throw new Error(`Round-robin failed in ${cfg.vertical}! Expected [2,2,2,2,2] but got: ${JSON.stringify(counts)}`);
    }
    console.log(`✓ Confirmed perfect round-robin distribution: exactly 2 leads allocated to each of the 5 callers!`);

    resultsSummary[cfg.vertical] = {
      teamId: cfg.teamId,
      batchId: batchSummary.id,
      totalLeads: 10,
      distribution: countsByCaller,
      status: 'VERIFIED_ROUND_ROBIN',
    };
  }

  // 6. Capture browser screenshots for visual proof
  console.log('\n[Browser Verification] Capturing caller inboxes and Data Entry batch queue...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1536, height: 800 } });
  const page = await context.newPage();

  // Login as representative caller for each vertical and capture their inbox
  for (const cfg of CONFIGS) {
    console.log(`Logging into browser as ${cfg.vertical} representative caller: ${cfg.representativeCallerId} (${cfg.representativeCallerEmail})...`);
    await context.clearCookies();
    await page.goto('http://localhost:5173/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input#email', cfg.representativeCallerEmail);
    await page.fill('input#password', 'demo1234');
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    console.log(`Navigating to ${cfg.inboxRoute}...`);
    await page.goto(`http://localhost:5173${cfg.inboxRoute}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const shotPath = path.join(screenshotDir, cfg.screenshotName);
    await page.screenshot({ path: shotPath, fullPage: false });
    console.log(`Saved screenshot: ${cfg.screenshotName}`);
  }

  // Capture Data Entry batch overview
  console.log('Logging in as Data Entry (deepa@finverse.demo)...');
  await context.clearCookies();
  await page.goto('http://localhost:5173/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input#email', 'deepa@finverse.demo');
  await page.fill('input#password', 'demo1234');
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

  await page.goto('http://localhost:5173/data-entry/intake');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(screenshotDir, 'journey2_data_entry_batches.png'), fullPage: false });
  console.log('Saved screenshot: journey2_data_entry_batches.png');

  await browser.close();

  console.log('\n=== JOURNEY 2 COMPLETED SUCCESSFULLY WITH COMPLETE PROOF ===');
  console.log(JSON.stringify(resultsSummary, null, 2));

  await pool.end();
}

main().catch((err) => {
  console.error('JOURNEY 2 ERROR:', err);
  process.exit(1);
});
