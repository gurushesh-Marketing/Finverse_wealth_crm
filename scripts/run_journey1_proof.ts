import { chromium } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

async function main() {
  const screenshotDir = path.resolve(process.cwd(), 'evidence/screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1536, height: 800 } });
  const page = await context.newPage();

  page.on('console', (msg) => console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', (err) => console.error(`[Browser PageError]`, err));
  page.on('response', async (res) => {
    if (res.url().includes('/api/')) {
      let body = '';
      try { body = await res.text(); } catch {}
      console.log(`[API Response] ${res.status()} ${res.url()} -> ${body.slice(0, 300)}`);
    }
  });

  console.log('=== JOURNEY 1: HR SUBMISSION -> SA APPROVAL -> EMP-ID LOGIN -> PASSWORD CHANGE ===');

  // 1. HR Login
  console.log('\n[Step 1] Logging in as HR (pooja@finverse.demo)...');
  await page.goto('http://localhost:5173/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input#email', 'pooja@finverse.demo');
  await page.fill('input#password', 'demo1234');
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });
  console.log('HR logged in, current URL:', page.url());

  // 2. Navigate to HR Onboarding (/hr/joiners)
  console.log('\n[Step 2] Navigating to /hr/joiners...');
  await page.goto('http://localhost:5173/hr/joiners');
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('input[placeholder*="Vikram Malhotra"]');

  // Fill in candidate details
  console.log('[Step 3] Filling joiner proposal form...');
  const suffix = Date.now().toString().slice(-4);
  const testCandidateEmail = `candidate.aarav.${suffix}@finverse.demo`;
  const testCandidateMobile = `+91 98${Math.floor(10000000 + Math.random() * 90000000)}`;
  await page.fill('input[placeholder*="Vikram Malhotra"]', 'Aarav Sen');
  await page.fill('input[placeholder*="+91 98765 43210"]', testCandidateMobile);
  await page.fill('input[placeholder*="vikram.malhotra@finverse.demo"]', testCandidateEmail);

  // Proposed Placement
  await page.selectOption('select:has(option[value="SC"])', 'SC');
  await page.selectOption('select:has(option[value="wealth"])', 'wealth');
  await page.selectOption('select:has(option[value="TEAM-WEALTH-ALPHA"])', 'TEAM-WEALTH-ALPHA');
  await page.selectOption('select:has(option[value="EMP-007"])', 'EMP-007');

  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(screenshotDir, 'journey1_01_hr_form_filled.png'), fullPage: false });
  console.log('Saved journey1_01_hr_form_filled.png');

  // Submit proposal
  console.log('[Step 4] Submitting joiner proposal for SA approval...');
  const [submitRes] = await Promise.all([
    page.waitForResponse((res) => res.url().includes('/api/hr/onboarding/submit') && res.status() === 201),
    page.click('button:has-text("Submit for Super Admin Approval")'),
  ]);
  const submitJson = await submitRes.json();
  const generatedEmpId = submitJson.data?.employeeId || submitJson.employeeId || submitJson.data?.employee?.id;
  console.log(`Generated Employee ID from API: ${generatedEmpId}`);

  await page.waitForSelector('text=Employee Record Queued for Super Admin Approval', { timeout: 10000 });
  await page.waitForTimeout(1000);

  await page.screenshot({ path: path.join(screenshotDir, 'journey1_02_hr_submitted_banner.png'), fullPage: false });
  console.log('Saved journey1_02_hr_submitted_banner.png');

  // 3. Clear session and login as Superadmin
  console.log('\n[Step 5] Logging out and logging in as Super Admin (alok@finverse.demo)...');
  await context.clearCookies();
  await page.goto('http://localhost:5173/login');
  await page.fill('input#email', 'alok@finverse.demo');
  await page.fill('input#password', 'demo1234');
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });
  console.log('SA logged in, current URL:', page.url());

  // 4. Navigate to SA Employees Page
  console.log('\n[Step 6] Navigating to /superadmin/employees...');
  await page.goto('http://localhost:5173/superadmin/employees');
  await page.waitForLoadState('networkidle');

  // Click Pending HR Onboardings tab
  console.log('[Step 7] Opening Pending HR Onboardings tab...');
  const pendingTabBtn = page.locator('button:has-text("Pending HR Onboardings")');
  await pendingTabBtn.click();
  await page.waitForTimeout(1500);

  // Capture queue view
  await page.screenshot({ path: path.join(screenshotDir, 'journey1_03_sa_pending_queue.png'), fullPage: false });
  console.log('Saved journey1_03_sa_pending_queue.png');

  // 5. Open Approval Modal for the candidate
  console.log(`[Step 8] Locating row for ${generatedEmpId} and clicking Approve & Activate...`);
  const rowLocator = page.locator(`tr:has-text("${generatedEmpId}")`);
  await rowLocator.waitFor({ state: 'visible', timeout: 10000 });
  const approveBtn = rowLocator.locator('button:has-text("Approve & Activate")');
  await approveBtn.click();

  // Wait for modal
  await page.waitForSelector('text=Approve & Activate Employee');
  await page.waitForTimeout(1000);

  // Verify username input is non-editable and displays generatedEmpId
  const usernameInput = page.locator(`input[value="${generatedEmpId}"][disabled]`);
  const isUsernameDisabled = await usernameInput.isVisible();
  console.log(`Username input disabled and showing ${generatedEmpId}:`, isUsernameDisabled);

  await page.screenshot({ path: path.join(screenshotDir, 'journey1_04_sa_approval_modal.png'), fullPage: false });
  console.log('Saved journey1_04_sa_approval_modal.png');

  // 6. Submit Approval & Activate
  console.log('[Step 9] Clicking Activate & Generate Temporary Password...');
  const [approveRes] = await Promise.all([
    page.waitForResponse((res) => res.url().includes('/api/superadmin/onboarding/approve') && res.status() === 200),
    page.click('button:has-text("Activate & Generate Temporary Password")'),
  ]);
  const approveJson = await approveRes.json();
  const tempPassword = approveJson.data?.temporaryPassword || approveJson.temporaryPassword;
  console.log(`Retrieved One-Time Temporary Password from API: "${tempPassword}"`);

  // Wait for Credentials One-Time Display Modal
  await page.waitForSelector('text=Employee Account Activated', { timeout: 10000 });
  await page.waitForTimeout(1000);

  await page.screenshot({ path: path.join(screenshotDir, 'journey1_05_sa_activated_temp_password.png'), fullPage: false });
  console.log('Saved journey1_05_sa_activated_temp_password.png');

  // Close credential modal
  await page.click('button:has-text("Acknowledge & Close")');
  await page.waitForTimeout(1000);

  // 7. Employee Login with permanent username (EMP-xxx) and temporary password
  console.log(`\n[Step 10] Logging out and logging in as new employee with permanent ID ${generatedEmpId}...`);
  await context.clearCookies();
  await page.goto('http://localhost:5173/login');
  await page.waitForLoadState('networkidle');

  await page.fill('input#email', generatedEmpId);
  await page.fill('input#password', tempPassword);
  await page.screenshot({ path: path.join(screenshotDir, 'journey1_06_employee_login_screen.png'), fullPage: false });
  console.log('Saved journey1_06_employee_login_screen.png');

  await page.click('button[type="submit"]');

  // 8. Verify mandatory first login password change modal appears
  console.log('\n[Step 11] Verifying mandatory first login password modal...');
  await page.waitForSelector('text=Initial Login: Password Change Required', { timeout: 10000 });
  await page.waitForTimeout(1000);

  await page.screenshot({ path: path.join(screenshotDir, 'journey1_07_mandatory_password_change_modal.png'), fullPage: false });
  console.log('Saved journey1_07_mandatory_password_change_modal.png');

  // 9. Change password to permanent password
  console.log('\n[Step 12] Setting permanent password...');
  const permanentPassword = 'PermanentPass#2026';
  await page.fill('input#first-password', permanentPassword);
  await page.fill('input#first-confirm-password', permanentPassword);
  await page.click('button:has-text("Update Password & Enter Workspace")');

  // 10. Verify modal clears and authorized workspace opens
  console.log('\n[Step 13] Verifying modal dismisses and authorized workspace loads...');
  await page.waitForSelector('text=Initial Login: Password Change Required', { state: 'hidden', timeout: 10000 });
  await page.waitForTimeout(2000);

  console.log('Employee workspace loaded! Current URL:', page.url());
  const employeeBodyText = await page.innerText('body');
  console.log('Workspace text snippet:', employeeBodyText.slice(0, 400).replace(/\n+/g, ' '));

  await page.screenshot({ path: path.join(screenshotDir, 'journey1_08_employee_workspace_loaded.png'), fullPage: false });
  console.log('Saved journey1_08_employee_workspace_loaded.png');

  await browser.close();
  console.log('\n=== JOURNEY 1 COMPLETED SUCCESSFULLY WITH ALL EVIDENCE RECORDED! ===');
}

main().catch((err) => {
  console.error('JOURNEY 1 ERROR:', err);
  process.exit(1);
});
