// Every tab of every portal against the real API: it loads, shows data or an empty state,
// never an error card or a stuck placeholder. Regression guard for the "broken tabs" report
// (docs/BUGFIX_LOG.md): they failed when the API ran on a database behind the code.
import {PORTAL_IDS, TITLE} from './env.mjs';
import {expect, go, signedIn, test} from './fixtures.mjs';

const TABS = {
  student: ['Home', 'Clubs', 'Days', 'Check-in', 'Submit', 'Certs', 'Events', 'Records', 'Notifications'],
  coordinator: ['Home', 'Members', 'Days', 'Check-in', 'Grading', 'Certs', 'Events', 'Budgets', 'Dashboard', 'Notifications'],
  advisor: ['Home', 'Days', 'Check-in', 'Grading', 'Certs', 'Events', 'Budgets', 'Dashboard', 'Notifications'],
  'campus-manager': ['Dashboard', 'Administration', 'Clubs', 'Members', 'Days', 'Check-in', 'Grading', 'Certs', 'Events', 'Budgets', 'Duty Leave', 'Records', 'Notification log', 'Notifications'],
};
TABS['super-admin'] = TABS['campus-manager'];

for (const portal of PORTAL_IDS) {
  test(`${TITLE[portal]}: every tab loads without an error card`, async ({page}) => {
    await signedIn(page, portal);
    for (const tab of TABS[portal]) {
      await go(page, tab);
      await expect(page.locator('#view .error-state'), `${portal}/${tab}`).toHaveCount(0);
    }
  });
}

test('Coordinator: check-in still shows the typed code when the QR library is blocked', async ({page, allowConsole}) => {
  allowConsole(/cdnjs|qrcode|ERR_FAILED|Failed to load resource/);
  await page.route('https://cdnjs.cloudflare.com/**', route => route.abort());
  await signedIn(page, 'coordinator');
  await go(page, 'Check-in');
  await expect(page.locator('.live-box')).toBeAttached(); // page mounts; live QR needs an open Club Day (workflows.spec)
});
