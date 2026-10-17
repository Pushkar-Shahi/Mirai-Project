// The unbuilt source as scripts/run_local.sh serves it: development config, demo logins,
// the API override and relative links between portals.
import {API, DEV_URL} from './env.mjs';
import {expect, test} from './fixtures.mjs';

test.beforeEach(async ({page}) => {
  // The development config expects the API on port 8000; point it at the API under test
  // the way a developer would, with Connection settings.
  await page.addInitScript(api => localStorage.setItem('api', api), API);
});

test('the launcher links all five portals', async ({page}) => {
  await page.goto(DEV_URL);
  await expect(page.locator('.portal-index .list-item a')).toHaveText(['Super Admin Portal', 'Campus Manager Portal', 'Advisor Portal', 'Coordinator Portal', 'Student Portal']);
});

test('a portal runs from source with demo logins and connection settings', async ({page}) => {
  await page.goto(DEV_URL + 'apps/coordinator/');
  await expect(page.locator('.api-setting')).toBeVisible();
  await expect(page.locator('.demo-area button')).toHaveText(['Student', 'Student, another campus', 'Coordinator', 'Advisor', 'Campus manager', 'Super admin']);
  await page.getByRole('button', {name: 'Coordinator', exact: true}).click();
  await page.getByRole('button', {name: 'Continue to workspace'}).click();
  await expect(page.locator('#nav button[data-page="Members"]')).toBeVisible();
  await expect(page.locator('#view .skeleton-card')).toHaveCount(0);
});

test('the launcher\'s sign-in page signs a campus manager into the campus manager site', async ({page}) => {
  await page.goto(DEV_URL);
  await page.getByRole('link', {name: 'Open the sign-in page'}).click();
  await page.locator('input[name=identifier]').fill('admin@demo.edu');
  await page.locator('input[name=password]').fill('password123');
  await page.getByRole('button', {name: 'Continue to workspace'}).click();
  await expect(page).toHaveURL(url => url.pathname === '/apps/campus-manager/');
  await expect(page.locator('#nav')).toBeVisible();
});

test('another role\'s account opens that role\'s portal next door', async ({page}) => {
  await page.goto(DEV_URL + 'apps/student/');
  await page.locator('input[name=identifier]').fill('advisor@demo.edu');
  await page.locator('input[name=password]').fill('password123');
  await page.getByRole('button', {name: 'Continue to workspace'}).click();
  await expect(page).toHaveURL(url => url.pathname === '/apps/advisor/');
  await expect(page.locator('#nav')).toBeVisible();
});
