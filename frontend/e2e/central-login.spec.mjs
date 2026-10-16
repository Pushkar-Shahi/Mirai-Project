// The central sign-in site: one screen for every role, role read from the server,
// redirect to the matching portal, remembered page, session messages.
import {CENTRAL_COORDINATOR_URL, DEMO, DEMO_PASSWORD, LOGIN_URL, PORTAL_IDS, portalUrl} from './env.mjs';
import {apiToken, expect, test} from './fixtures.mjs';

const NAV_FIRST = {'super-admin': 'Dashboard', 'campus-manager': 'Dashboard', advisor: 'Home', coordinator: 'Home', student: 'Home'};
const tokenKey = portal => `mirai:${portal}:token`;

async function fill(page, identifier, password = DEMO_PASSWORD) {
  await page.locator('input[name=identifier]').fill(identifier);
  await page.locator('input[name=password]').fill(password);
}
const submit = page => page.getByRole('button', {name: 'Continue to workspace'});

for (const portal of PORTAL_IDS) {
  test(`login site: ${DEMO[portal]} lands in the ${portal} portal`, async ({page}) => {
    await page.goto(LOGIN_URL);
    await fill(page, DEMO[portal]);
    await page.keyboard.press('Enter'); // Enter submits
    await expect(page).toHaveURL(url => url.href.startsWith(portalUrl(portal)));
    await expect(page.locator('#nav')).toBeVisible();
    await expect(page.locator(`#nav button[data-page="${NAV_FIRST[portal]}"]`)).toHaveAttribute('aria-current', 'page');
    expect(await page.evaluate(k => sessionStorage.getItem(k), tokenKey(portal))).toBeTruthy();
    expect(page.url(), 'the token is removed from the address bar').not.toContain('handoff');
    // The login site itself stores nothing.
    await page.goto(LOGIN_URL);
    expect(await page.evaluate(() => Object.keys(sessionStorage).filter(k => k.startsWith('mirai:')))).toEqual([]);
  });
}

test('login site and portals show the same sign-in screen', async ({page}) => {
  const shot = async url => {
    await page.goto(url);
    await expect(submit(page)).toBeVisible();
    return page.locator('.login-card h2, .login-card p, .story-copy h1, .story-copy p').allInnerTexts();
  };
  const central = await shot(LOGIN_URL);
  for (const portal of PORTAL_IDS) expect(await shot(portalUrl(portal)), portal).toEqual(central);
});

test('wrong password shows the API message and the button works again', async ({page}) => {
  await page.goto(LOGIN_URL);
  await fill(page, DEMO.student, 'not-the-password');
  await submit(page).click();
  await expect(page.locator('.form-error')).toHaveText('Invalid credentials');
  await expect(submit(page)).toBeEnabled();
  await expect(page).toHaveURL(LOGIN_URL);
});

test('the button is disabled and says "Signing in…" while the request is pending', async ({page}) => {
  await page.route('**/auth/login', async route => { await new Promise(r => setTimeout(r, 800)); await route.continue(); });
  await page.goto(LOGIN_URL);
  await fill(page, DEMO.student);
  await submit(page).click();
  const busy = page.getByRole('button', {name: 'Signing in…'});
  await expect(busy).toBeDisabled();
  await expect(page).toHaveURL(url => url.href.startsWith(portalUrl('student')));
});

test('a deep link is remembered through the central sign-in', async ({page}) => {
  await page.goto(CENTRAL_COORDINATOR_URL + '#/Grading');
  await expect(page).toHaveURL(url => url.href.startsWith(LOGIN_URL));
  expect(new URL(page.url()).searchParams.get('next')).toBe('#/Grading');
  await fill(page, DEMO.coordinator);
  await submit(page).click();
  await expect(page).toHaveURL(url => url.href.startsWith(portalUrl('coordinator')));
  await expect(page).toHaveURL(/#\/Grading$/);
  await expect(page.locator('#nav button[data-page="Grading"]')).toHaveAttribute('aria-current', 'page');
});

test('a link that is not a page route is ignored', async ({page}) => {
  await page.goto(LOGIN_URL + '?next=' + encodeURIComponent('//evil.example/x'));
  await fill(page, DEMO.coordinator);
  await submit(page).click();
  await expect(page).toHaveURL(url => url.href.startsWith(portalUrl('coordinator')));
  expect(page.url()).not.toContain('evil');
  await expect(page.locator('#nav button[data-page="Home"]')).toHaveAttribute('aria-current', 'page');
});

test('an expired token sends the portal visitor to the central sign-in with a message', async ({page}) => {
  await page.addInitScript(k => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem(k, 'expired.or.invalid'); sessionStorage.setItem('seeded', '1'); } }, tokenKey('coordinator'));
  await page.goto(CENTRAL_COORDINATOR_URL + '#/Check-in');
  await expect(page).toHaveURL(url => url.href.startsWith(LOGIN_URL));
  await expect(page.locator('.notice', {hasText: 'Your session has expired. Please sign in again.'})).toBeVisible();
  expect(new URL(page.url()).searchParams.get('next')).toBe('#/Check-in');
});

test('signing out returns to the central sign-in and clears the token', async ({page, request}) => {
  const token = await apiToken(request, DEMO.coordinator);
  await page.goto(CENTRAL_COORDINATOR_URL + '#handoff=' + encodeURIComponent(token));
  await expect(page.locator('#nav')).toBeVisible();
  await page.getByRole('button', {name: 'Sign out'}).click();
  await page.locator('.modal').getByRole('button', {name: 'Sign out'}).click(); // confirm dialog
  await expect(page).toHaveURL(url => url.href.startsWith(LOGIN_URL));
  await expect(page.locator('.notice', {hasText: 'You have been signed out.'})).toBeVisible();
  await page.goto(CENTRAL_COORDINATOR_URL);
  await expect(page).toHaveURL(url => url.href.startsWith(LOGIN_URL));
});

test('mobile layout: no horizontal scroll, form usable', async ({page}) => {
  await page.setViewportSize({width: 375, height: 740});
  await page.goto(LOGIN_URL);
  await expect(submit(page)).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await fill(page, DEMO.student);
  await submit(page).click();
  await expect(page.locator('#nav')).toBeVisible();
});

test('login and portal share one stylesheet, fonts and colour tokens', async ({page}) => {
  const tokens = async url => {
    await page.goto(url);
    await expect(submit(page)).toBeVisible();
    return page.evaluate(() => {
      const css = getComputedStyle(document.documentElement), card = getComputedStyle(document.querySelector('.login-card'));
      return {brand: css.getPropertyValue('--brand').trim(), font: getComputedStyle(document.body).fontFamily, radius: card.borderRadius,
        sheets: [...document.styleSheets].map(s => new URL(s.href).pathname.split('/').pop())};
    });
  };
  const login = await tokens(LOGIN_URL), student = await tokens(portalUrl('student'));
  expect(login).toEqual(student);
  expect(login.sheets).toContain('app.css');
});
