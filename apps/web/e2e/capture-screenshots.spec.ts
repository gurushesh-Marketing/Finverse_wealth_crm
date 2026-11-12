import { test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

test('capture full-page visual evidence for RM-01 through RM-10', async ({ page }) => {
  const outDir = resolve(process.cwd(), '../../evidence/screenshots');
  mkdirSync(outDir, { recursive: true });

  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto('/login');
  await page.getByLabel('Work email').fill('kavita@finverse.demo');
  await page.getByLabel('Password', { exact: true }).fill('demo1234');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/regional\/overview/);

  const screens = [
    { name: 'RM-01_regional_overview', url: '/regional/overview' },
    { name: 'RM-02_manager_scorecard', url: '/regional/managers' },
    { name: 'RM-03_territory_coverage', url: '/regional/territories' },
    { name: 'RM-04_regional_targets', url: '/regional/targets' },
    { name: 'RM-05_cross_manager_transfers', url: '/regional/approvals' },
    { name: 'RM-07_regional_forecasts', url: '/regional/forecasts' },
    { name: 'RM-09_manager_reviews', url: '/regional/reviews' },
    { name: 'RM-10_regional_reports', url: '/regional/reports' },
  ];

  for (const s of screens) {
    await page.goto(s.url);
    await page.waitForTimeout(1000);
    const filePath = resolve(outDir, `${s.name}.png`);
    await page.screenshot({ path: filePath, fullPage: true });
    console.log(`[Evidence] Saved ${filePath}`);
  }
});
