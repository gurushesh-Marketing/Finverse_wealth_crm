import { expect, test, type Page } from '@playwright/test';

function uniq(): string {
  return `${Date.now().toString(36)}-${test.info().workerIndex}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function isMobile(): boolean {
  return test.info().project.name.startsWith('mobile');
}

async function login(page: Page, email: string, password = 'demo1234') {
  await page.goto('/login');
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

async function loginOk(page: Page, email: string) {
  await login(page, email);
  await page.waitForURL(/\/(wealth|banking)\/dashboard/);
}

async function logout(page: Page) {
  if (isMobile()) {
    await page.getByRole('button', { name: 'Open navigation' }).click();
  }
  await page.getByRole('button', { name: 'Log out' }).first().click();
  await page.waitForURL(/\/login/);
}

test('1 successful login lands on authorized workspace', async ({ page }) => {
  await loginOk(page, 'asha@finverse.demo');
  await expect(page.getByRole('heading', { name: /Your next conversation starts here/i })).toBeVisible();
  if (!isMobile()) {
    await expect(page.getByText('Personal Workspace')).toBeVisible();
  }
});

test('2 failed login shows error; logout ends session', async ({ page }) => {
  await login(page, 'asha@finverse.demo', 'wrong-password');
  await expect(page.getByRole('alert')).toContainText("We couldn't sign you in");
  await loginOk(page, 'asha@finverse.demo');
  await logout(page);
  await page.goto('/wealth/dashboard');
  await expect(page).toHaveURL(/\/login/);
});

test('3 assigned leads visible in inbox with filters and empty state', async ({ page }) => {
  await loginOk(page, 'asha@finverse.demo');
  await page.goto('/wealth/prospects');
  await expect(page.getByRole('heading', { name: 'Lead Inbox' })).toBeVisible();
  await expect(page.getByText('FV-1001')).toBeVisible();
  await expect(page.getByText('FV-1003')).toBeVisible();
  await expect(page.getByText('FV-1004')).toHaveCount(0);
  await page.getByLabel('Search').fill('FV-1002');
  await expect(page.getByText('FV-1002')).toBeVisible();
  await expect(page.getByText('FV-1001')).toHaveCount(0);
  await page.getByLabel('Search').fill('zzz-no-match');
  await expect(page.getByText('No leads match')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.getByText('FV-1001')).toBeVisible();
});

test('4 cross-caller and cross-vertical denial', async ({ page }) => {
  await loginOk(page, 'ravi@finverse.demo');
  await page.goto('/wealth/prospects/FV-1001');
  await expect(page.getByRole('alert')).toContainText('outside your current scope');
  await logout(page);
  await loginOk(page, 'dev@finverse.demo');
  await page.goto('/wealth/prospects/FV-1001');
  await expect(page.getByRole('alert')).toContainText('outside your current scope');
  await page.goto('/wealth/dashboard');
  await expect(page.getByRole('alert')).toContainText('Workspace unavailable');
});

test('5 invalid follow-up saves are rejected inline', async ({ page }) => {
  await loginOk(page, 'asha@finverse.demo');
  await page.goto('/wealth/prospects/FV-1003');
  await page.getByRole('button', { name: 'Schedule follow-up (SC-11)' }).click();
  await expect(page.getByRole('button', { name: 'Save follow-up' })).toBeVisible();
  await page.getByRole('button', { name: 'Save follow-up' }).click();
  await expect(page.getByRole('alert').first()).toContainText('Purpose must be at least 3 characters');
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  await page.getByLabel('Purpose').fill('Past due attempt');
  await page.getByLabel('Due date').fill(yesterday);
  await page.getByLabel('Due time').fill('10:00');
  await page.getByRole('button', { name: 'Save follow-up' }).click();
  await expect(page.getByRole('alert').first()).toContainText('Due time must be in the future');
});

test('6 valid follow-up save updates task and timeline', async ({ page }) => {
  const purpose = `E2E follow-up ${uniq()}`;
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  await loginOk(page, 'asha@finverse.demo');
  await page.goto('/wealth/prospects/FV-1003');
  await page.getByRole('button', { name: 'Schedule follow-up (SC-11)' }).click();
  await expect(page.getByRole('button', { name: 'Save follow-up' })).toBeVisible();
  await page.getByLabel('Purpose').fill(purpose);
  await page.getByLabel('Due date').fill(tomorrow);
  await page.getByLabel('Due time').fill('11:00');
  await page.getByLabel('Priority').selectOption('high');
  await page.getByRole('button', { name: 'Save follow-up' }).click();
  await expect(page.getByText('Follow-up saved')).toBeVisible();
  await expect(page.getByRole('tabpanel')).toContainText(purpose);
  await page.getByRole('tab', { name: 'Timeline' }).click();
  await expect(page.getByRole('tabpanel')).toContainText('Follow Up Scheduled');
  await expect(page.getByRole('tabpanel')).toContainText(purpose);

  await page.getByRole('tab', { name: 'Summary' }).click();
  await page.getByRole('button', { name: 'Schedule follow-up (SC-11)' }).click();
  await page.getByLabel('Purpose').fill(purpose);
  await page.getByLabel('Due date').fill(tomorrow);
  await page.getByLabel('Due time').fill('11:30');
  await page.getByRole('button', { name: 'Save follow-up' }).click();
  await expect(page.getByRole('alert')).toContainText('already exists');
});

test('7 records persist across logout/login and reload', async ({ page }) => {
  const purpose = `E2E persist ${uniq()}`;
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  await loginOk(page, 'asha@finverse.demo');
  await page.goto('/wealth/prospects/FV-1003');
  await page.getByRole('button', { name: 'Schedule follow-up (SC-11)' }).click();
  await expect(page.getByRole('button', { name: 'Save follow-up' })).toBeVisible();
  await page.getByLabel('Purpose').fill(purpose);
  await page.getByLabel('Due date').fill(tomorrow);
  await page.getByLabel('Due time').fill('12:00');
  await page.getByRole('button', { name: 'Save follow-up' }).click();
  await expect(page.getByText('Follow-up saved')).toBeVisible();
  await logout(page);
  await loginOk(page, 'asha@finverse.demo');
  await page.goto('/wealth/prospects/FV-1003');
  await page.getByRole('tab', { name: 'Tasks' }).click();
  await expect(page.getByRole('tabpanel')).toContainText(purpose);
  await page.reload();
  await page.getByRole('tab', { name: 'Tasks' }).click();
  await expect(page.getByRole('tabpanel')).toContainText(purpose);
});

test('8 direct route refresh works on SPA deep links', async ({ page }) => {
  await loginOk(page, 'asha@finverse.demo');
  await page.goto('/wealth/prospects/FV-1001');
  await expect(page.getByRole('heading', { name: 'Prospect A' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Prospect A' })).toBeVisible({ timeout: 10_000 });
});

test('9 keyboard can complete login and reach journey', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Work email').focus();
  await page.keyboard.type('asha@finverse.demo');
  await page.keyboard.press('Tab');
  await page.keyboard.type('demo1234');
  await page.keyboard.press('Enter');
  await page.waitForURL(/\/wealth\/dashboard/);
});

test('10 mobile layout has no horizontal overflow', async ({ page }) => {
  await loginOk(page, 'asha@finverse.demo');
  await page.goto('/wealth/prospects/FV-1003');
  await page.getByRole('button', { name: 'Schedule follow-up (SC-11)' }).click();
  await expect(page.getByRole('button', { name: 'Save follow-up' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(overflow).toBe(false);
  if (isMobile()) {
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
});
