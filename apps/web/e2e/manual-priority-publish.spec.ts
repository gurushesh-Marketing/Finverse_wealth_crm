import { expect, test } from '@playwright/test';

test('manual Real Estate priority entry publishes when the form is submitted', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Work email').fill('deepa@finverse.demo');
  await page.getByLabel('Password', { exact: true }).fill('demo1234');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/data-entry\/intake/);

  const record = {
    id: 'MR-UI-PUBLISH-CHECK',
    prospectName: 'Priority Routing UI Check',
    mobileNumber: '+91 98765 43001',
    email: 'priority-routing-ui@example.test',
    vertical: 'real_estate',
    isPriority: true,
    status: 'published',
    savedAt: new Date().toISOString(),
    operatorId: 'EMP-015',
    publishedLeadId: 'FV-UI-PUBLISH-CHECK',
    assignedCallerId: 'EMP-026',
    assignedCallerName: 'Assigned Real Estate Caller',
    assignedTeamId: 'TEAM-REALESTATE-ALPHA',
  };
  let submitted: Record<string, unknown> | null = null;
  await page.route('**/api/data-entry/manual-records', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    submitted = route.request().postDataJSON();
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(record) });
  });
  await page.route('**/api/data-entry/manual-records/MR-UI-PUBLISH-CHECK', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(record) });
  });

  await page.getByLabel('Prospect name *').fill(record.prospectName);
  await page.getByLabel('Primary mobile number *').fill('9876543001');
  await page.getByLabel('Email address *').fill(record.email);
  await page.getByLabel('Vertical *').selectOption('real_estate');
  await page.getByLabel(/priority/i).check();
  await page.getByLabel('Email address *').press('Enter');

  await expect.poll(() => submitted).not.toBeNull();
  expect(submitted).toMatchObject({ vertical: 'real_estate', isPriority: true, publishImmediately: true });
  await expect(page.getByText('Published & Assigned to Sales Caller')).toBeVisible();
});
