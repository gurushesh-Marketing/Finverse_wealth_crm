import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

test('Data Entry has one manual save-and-verify workspace', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Work email').fill('deepa@finverse.demo');
  await page.getByLabel('Password', { exact: true }).fill('demo1234');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/data-entry\/intake/);

  await expect(page.getByRole('heading', { name: 'Enter and verify prospect data' })).toBeVisible();
  await expect(page.getByLabel('Prospect name *')).toBeVisible();
  await expect(page.getByLabel('Primary mobile number *')).toBeVisible();
  await expect(page.getByLabel('Email address *')).toBeVisible();
  await expect(page.getByLabel('WhatsApp number optional')).toBeVisible();
  await expect(page.getByLabel('Location optional')).toBeVisible();
  await expect(page.getByLabel('Vertical *')).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Refresh from database' })).toBeVisible();

  await page.getByRole('button', { name: 'Save & verify' }).click();
  await expect(page.getByText('Select a vertical from your current assignment.')).toBeVisible();

  const uniqueEmail = `manual-e2e-${Date.now()}-${test.info().project.name}@finverse.demo`;
  await page.getByLabel('Prospect name *').fill('Manual Entry Browser Check');
  await page.getByLabel('Primary mobile number *').fill('9876543210');
  await page.getByLabel('Email address *').fill(uniqueEmail);
  await page.getByLabel('Vertical *').selectOption('wealth');
  await page.getByRole('button', { name: 'Save & verify' }).click();
  await expect(page.getByText('Confirmed in the database.')).toBeVisible();
  await expect(page.getByRole('status').getByText(uniqueEmail)).toBeVisible();
  await expect(page.getByRole('table', { name: 'Saved prospect records' }).getByText(uniqueEmail)).toBeVisible();

  // Re-verify the record from the table
  const row = page.getByRole('table', { name: 'Saved prospect records' }).locator('tr', { hasText: uniqueEmail });
  await row.getByRole('button', { name: 'Verify' }).click();
  await expect(page.getByText('Manual Re-verification')).toBeVisible();

  // Test optional fields persistence (WhatsApp and Location)
  const secondEmail = `manual-e2e-opt-${Date.now()}-${test.info().project.name}@finverse.demo`;
  await page.getByLabel('Prospect name *').fill('Prospect With Optionals');
  await page.getByLabel('Primary mobile number *').fill('9876543211');
  await page.getByLabel('Email address *').fill(secondEmail);
  await page.getByLabel('WhatsApp number optional').fill('9876543299');
  await page.getByLabel('Location optional').fill('Mumbai, Maharashtra');
  await page.getByLabel('Vertical *').selectOption('banking');
  await page.getByRole('button', { name: 'Save & verify' }).click();
  await expect(page.getByText('Confirmed in the database.')).toBeVisible();
  await expect(page.getByRole('status').getByText('+91 98765 43299')).toBeVisible();
  await expect(page.getByRole('status').getByText('Location: Mumbai, Maharashtra')).toBeVisible();

  // Capture evidence screenshots for Data Entry enter-and-verify workspace
  const isMobile = test.info().project.name.includes('mobile');
  const screenshotFileName = isMobile ? 'DE_enter_and_verify_mobile.png' : 'DE_enter_and_verify_desktop.png';
  const outDir = path.resolve(process.cwd(), '../../evidence/screenshots/data_entry_workspace');
  await fs.promises.mkdir(outDir, { recursive: true });
  await page.screenshot({ path: path.join(outDir, screenshotFileName), fullPage: true });
  await page.screenshot({ path: path.resolve(process.cwd(), '../../evidence/screenshots', screenshotFileName), fullPage: true });

  // Previously advertised workflows no longer expose their old screens.
  await page.goto('/data-entry/batches');
  await page.waitForURL(/\/data-entry\/intake/);
  await expect(page.getByRole('heading', { name: 'Enter and verify prospect data' })).toBeVisible();
  await expect(page.getByText('Staging CSV Rows')).toHaveCount(0);

  const response = await page.request.get('/api/data-entry/manual-records');
  expect(response.status()).toBe(200);
  expect(Array.isArray((await response.json()).records)).toBe(true);
});
