import { expect, test } from '@playwright/test';

test('expired Super Admin session leaves the approval workspace and requires sign-in', async ({ page }) => {
  await page.goto('/login');
  await page.getByText('Executive & administration', { exact: true }).click();
  await page.getByRole('button', { name: 'Use account Alok Verma, SA' }).click();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/superadmin\/overview/);

  await page.goto('/superadmin/employees');
  await expect(page.getByRole('button', { name: /Pending HR Onboardings/ })).toBeVisible();
  await page.route('**/api/superadmin/onboarding/requests', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({
      error: { code: 'UNAUTHENTICATED', message: 'Sign in to continue.' },
    }) })
  );
  await page.getByRole('button', { name: 'Refresh Queue' }).click();

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText('Your session ended. Sign in again to continue.')).toBeVisible();
});

test('approval form keeps HR placement and explains a rejected username', async ({ page }) => {
  const duplicateKeyErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && message.text().includes('same key')) duplicateKeyErrors.push(message.text());
  });
  await page.goto('/login');
  await page.getByText('Executive & administration', { exact: true }).click();
  await page.getByRole('button', { name: 'Use account Alok Verma, SA' }).click();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/superadmin\/overview/);

  await page.route('**/api/superadmin/onboarding/requests', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [{
      request_id: 'REQ-UI-TEST', employee_id: 'EMP-UI-TEST', employee_name: 'Demo Candidate',
      status: 'submitted', employee_status: 'pending_approval', proposed_role: 'SC',
      proposed_vertical: 'wealth', proposed_team_id: 'TEAM-WEALTH-ALPHA',
      proposed_team_name: 'Wealth Alpha', proposed_superior_id: 'EMP-007',
      proposed_superior_name: 'Neel Verma',
    }] }) })
  );
  await page.route('**/api/superadmin/onboarding/approve', (route) =>
    route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ error: {
      code: 'VALIDATION_FAILED', message: 'Check the highlighted fields.', details: {
        fieldErrors: { username: ['Username cannot contain spaces.'] },
      },
    } }) })
  );
  await page.goto('/superadmin/employees');
  await page.getByRole('button', { name: 'Approve & Activate', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('HR proposed:')).toBeVisible();
  await expect(page.getByRole('dialog').getByLabel('Vertical')).toHaveValue('wealth');
  await expect(page.getByRole('dialog').getByLabel('Assigned Team')).toHaveValue('TEAM-WEALTH-ALPHA');
  const placementResponse = await page.request.get('/api/superadmin/placement-options?vertical=wealth');
  expect(placementResponse.ok()).toBeTruthy();
  const placement = (await placementResponse.json()).data as {
    teams: Array<{ id: string; relationshipManagerId: string | null }>;
  };
  const team = placement.teams.find((item) => item.id === 'TEAM-WEALTH-ALPHA');
  expect(team?.relationshipManagerId).toBeTruthy();
  await expect(page.getByRole('dialog').getByLabel('Reporting Superior')).toHaveValue(team!.relationshipManagerId!);
  await page.getByRole('dialog').getByLabel(/Unique Login Username/).fill('Demo User');
  await page.getByRole('dialog').getByLabel('One-Time Temporary Password').fill('valid-demo-only-123');
  await page.getByRole('button', { name: 'Approve & Activate Account' }).click();
  await expect(page.getByRole('alert').getByText('Username cannot contain spaces.')).toBeVisible();
  await expect(page.getByRole('dialog').getByLabel(/Unique Login Username/)).toHaveValue('Demo User');
  expect(duplicateKeyErrors).toEqual([]);
});

test('HR joiner team and superior selectors match the operational placement API', async ({ page }) => {
  const duplicateKeyErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && message.text().includes('same key')) duplicateKeyErrors.push(message.text());
  });
  await page.goto('/login');
  await page.getByText('Executive & administration', { exact: true }).click();
  await page.getByRole('button', { name: 'Use account Pooja Sharma, HR' }).click();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/hr\//);

  await page.goto('/hr/joiners');
  const response = await page.request.get('/api/hr/placement-options?vertical=wealth');
  expect(response.ok()).toBeTruthy();
  const options = (await response.json()).data as {
    teams: Array<{ id: string; relationshipManagerId: string | null }>;
  };
  const teamSelect = page.getByLabel('Proposed Team Placement');
  await expect(teamSelect.locator('option')).toHaveCount(options.teams.length);
  const uiTeams = await teamSelect.locator('option').evaluateAll((nodes) => nodes.map((node) => (node as HTMLOptionElement).value));
  expect(uiTeams).toEqual(options.teams.map((team) => team.id));
  const selectedTeam = options.teams[0];
  if (selectedTeam?.relationshipManagerId) {
    await expect(page.getByLabel('Proposed Superior / Reporting Manager')).toHaveValue(selectedTeam.relationshipManagerId);
  }
  expect(duplicateKeyErrors).toEqual([]);
});

test('SA Ready and review shows the same teams and supervising RELs as the API in all four verticals', async ({ page }) => {
  await page.goto('/login');
  await page.getByText('Executive & administration', { exact: true }).click();
  await page.getByRole('button', { name: 'Use account Alok Verma, SA' }).click();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/superadmin\/overview/);

  for (const vertical of ['wealth', 'banking', 'markets', 'real_estate']) {
    await page.locator('#sa-work-area-vertical-select').selectOption(vertical);
    const response = await page.request.get(`/api/superadmin/teams?vertical=${vertical}`);
    expect(response.ok()).toBeTruthy();
    const teams = (await response.json()).data as Array<{
      id: string; name: string; relationshipManagerId: string | null; callerCount: number;
      callers: Array<{ employeeId: string; name: string }>;
    }>;
    await expect(page.locator(`#sa-vertical-content-${vertical}`)).toBeVisible();
    await expect(page.locator(`#sa-vertical-content-${vertical} [id^="sa-team-card-"]`)).toHaveCount(teams.length);
    for (const team of teams) {
      const card = page.locator(`[id="sa-team-card-${team.id}"]`);
      await expect(card).toContainText(team.name);
      if (team.relationshipManagerId) await expect(card).toContainText(team.relationshipManagerId);
      await expect(card.locator(`#sa-view-callers-${team.id}`)).toContainText(`Callers (${team.callerCount})`);
      await card.locator(`#sa-view-callers-${team.id}`).click();
      const rows = page.locator('#sa-callers-modal tbody tr');
      await expect(rows).toHaveCount(team.callers.length);
      for (const caller of team.callers) {
        await expect(page.locator('#sa-callers-modal')).toContainText(caller.employeeId);
        await expect(page.locator('#sa-callers-modal')).toContainText(caller.name);
      }
      await page.locator('#sa-callers-modal button').filter({ hasText: 'Close' }).click();
    }
  }
});
