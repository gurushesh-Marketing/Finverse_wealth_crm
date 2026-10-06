import { expect, test, type Page } from '@playwright/test';

async function loginOk(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Work email').fill('asha@finverse.demo');
  await page.getByLabel('Password', { exact: true }).fill('demo1234');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/wealth\/dashboard/);
  await expect(page.getByRole('heading', { name: 'My day' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

test('brand fonts are actually loaded (Manrope, Inter, JetBrains Mono)', async ({ page }) => {
  await loginOk(page);
  await expect
    .poll(() => page.evaluate(() => document.fonts.check('700 16px Manrope')))
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => document.fonts.check('400 16px Inter')))
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => document.fonts.check('400 16px "JetBrains Mono"')))
    .toBe(true);
});

test('computed brand colours are exact', async ({ page }) => {
  await loginOk(page);
  const colors = await page.evaluate(() => {
    const body = getComputedStyle(document.body);
    const h1 = document.querySelector('h1');
    return {
      bodyColor: body.color,
      bodyBg: body.backgroundColor,
      bodyFont: body.fontFamily,
      h1Color: h1 ? getComputedStyle(h1).color : null,
      h1Font: h1 ? getComputedStyle(h1).fontFamily : null,
    };
  });
  expect(colors.bodyColor).toBe('rgb(27, 31, 30)');
  expect(colors.bodyBg).toBe('rgb(255, 255, 255)');
  expect(colors.bodyFont).toContain('Inter');
  expect(colors.h1Color).toBe('rgb(27, 31, 30)');
  expect(colors.h1Font).toContain('Manrope');
});

test('logo artwork renders from approved asset', async ({ page }) => {
  await loginOk(page);
  const logo = page.locator('img[alt="Finverse"]:visible').first();
  await expect(logo).toBeVisible();
  const natural = await logo.evaluate((el: HTMLImageElement) => ({
    w: el.naturalWidth,
    h: el.naturalHeight,
    src: el.getAttribute('src'),
  }));
  expect(natural.src).toContain('finverse-logo.png');
  expect(natural.w).toBeGreaterThan(0);
  expect(natural.h).toBeGreaterThan(0);
});
