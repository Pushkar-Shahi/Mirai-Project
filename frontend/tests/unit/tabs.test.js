// The role x tab matrix: every tab of every portal, mounted as that portal's role, in every
// state the API can put it in. A tab must show data, a proper empty state or a readable
// error, and never throw, hang on its loading placeholder, or call an endpoint the
// recorded role has no answer for.
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {FAILURES, FRONTEND, flush, mountTab} from './helpers.js';

const PORTALS = [
  ['super-admin', 'super_admin'], ['campus-manager', 'campus_admin'], ['advisor', 'advisor'], ['coordinator', 'coordinator'], ['student', 'student'],
];
const tabsOf = async id => (await import(pathToFileURL(path.join(FRONTEND, 'apps', id, 'portal-config.js')).href)).portalConfig.pages;

const settle = async () => { for (let i = 0; i < 5; i++) await flush(); };

for (const [portal, role] of PORTALS) {
  describe(`${portal} (${role})`, () => {
    const tabs = [];
    beforeAll(async () => { tabs.push(...await tabsOf(portal)); });

    const cases = ['success', 'empty', ...FAILURES, 'network'];
    test.each(cases)('every tab with API state %s', async mode => {
      expect(tabs.length).toBeGreaterThan(0);
      const problems = [];
      for (const tab of tabs) {
        const errors = [];
        const onError = e => errors.push(e.message);
        window.addEventListener('error', onError);
        const {view, missing} = await mountTab(portal, tab, role, mode);
        await settle();
        window.removeEventListener('error', onError);
        const where = `${tab}`;
        if (errors.length) problems.push(`${where}: uncaught errors ${errors}`);
        if (view.querySelectorAll('.skeleton-card').length) problems.push(`${where}: still loading`);
        if (!view.textContent.trim().length) problems.push(`${where}: blank page`);
        if (mode === 'success' || mode === 'empty') {
          if (missing.length) problems.push(`${where}: calls with no recorded response ${missing}`);
          if (view.querySelector('.error-state')) problems.push(`${where}: shows an error although the API is healthy: ${view.querySelector('.error-state').textContent}`);
        } else {
          // A failing API shows a readable message in the page, not a blank view.
          const text = view.textContent;
          const readable = view.querySelector('.error-state, .form-error, .notice') || /could not|cannot|permission|wrong|unavailable|behind|not found|failed/i.test(text);
          if (!readable) problems.push(`${where}: no error shown. Page text: ${text.slice(0, 120)}`);
        }
      }
      expect(problems).toEqual([]);
    });
  });
}
