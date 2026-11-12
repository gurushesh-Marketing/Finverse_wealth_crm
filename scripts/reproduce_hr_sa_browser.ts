import { chromium } from '@playwright/test';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1536, height: 800 } });
  const page = await context.newPage();

  const consoleMessages: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on('console', (msg) => {
    consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    pageErrors.push(err.toString());
  });
  page.on('requestfailed', (req) => {
    failedRequests.push(`${req.method()} ${req.url()} - ${req.failure()?.errorText}`);
  });

  console.log('1. Navigating to login...');
  await page.goto('http://localhost:5173/login');
  await page.waitForLoadState('networkidle');

  console.log('2. Logging in as HR (pooja@finverse.demo)...');
  await page.fill('input#email', 'pooja@finverse.demo');
  await page.fill('input#password', 'demo1234');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  console.log('Current URL after HR login:', page.url());

  console.log('3. Navigating to /hr/joiners...');
  await page.goto('http://localhost:5173/hr/joiners');
  await page.waitForTimeout(2000);
  console.log('Current URL at /hr/joiners:', page.url());
  const hrBodyText = await page.innerText('body');
  console.log('HR page title or heading:', await page.title());
  console.log('HR Page visible text snippet:', hrBodyText.slice(0, 500).replace(/\n+/g, ' '));

  console.log('4. Logging out...');
  await context.clearCookies();

  console.log('5. Logging in as Superadmin (alok@finverse.demo)...');
  await page.goto('http://localhost:5173/login');
  await page.fill('input#email', 'alok@finverse.demo');
  await page.fill('input#password', 'demo1234');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  console.log('Current URL after SA login:', page.url());

  console.log('6. Navigating to /superadmin/employees...');
  await page.goto('http://localhost:5173/superadmin/employees');
  await page.waitForTimeout(2000);
  console.log('Current URL at /superadmin/employees:', page.url());
  const saBodyText = await page.innerText('body');
  console.log('SA Page visible text snippet:', saBodyText.slice(0, 500).replace(/\n+/g, ' '));

  console.log('--- Errors & Warnings Summary ---');
  console.log('Page Errors:', pageErrors);
  console.log('Failed Requests:', failedRequests);
  console.log('Console warnings/errors:', consoleMessages.filter((m) => m.startsWith('[error]') || m.startsWith('[warning]')));

  await browser.close();
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
