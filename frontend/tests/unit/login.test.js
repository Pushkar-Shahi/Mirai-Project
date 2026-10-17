import {jest} from '@jest/globals';
import {FRONTEND, fixtures, flush, response, stubGlobals} from './helpers.js';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const mod = p => import(pathToFileURL(path.join(FRONTEND, p)).href);
const typeInto = (name, value) => { document.querySelector(`[name=${name}]`).value = value; };
const submit = () => document.querySelector('form').dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
const settle = async () => { for (let i = 0; i < 8; i++) await flush(); };

beforeEach(() => { stubGlobals(); document.body.innerHTML = '<div id="app"></div>'; sessionStorage.clear(); history.replaceState(null, '', '/'); });

describe('shared sign-in view', () => {
  test('renders the same screen for any site, with the demo hint and connection settings in development', async () => {
    const {loginView} = await mod('shared/auth/login-view.js');
    loginView({title: 'Anything'}, {onSignIn: async () => {}});
    expect(document.querySelector('.login-card h2').textContent).toBe('Sign in to Mirai Clubs');
    expect(document.querySelector('[name=identifier]')).not.toBeNull();
    expect(document.querySelector('[type=password]')).not.toBeNull();
    expect(document.querySelector('.demo-area')).not.toBeNull(); // development defaults show demo accounts
    expect(document.querySelector('.api-setting summary').textContent).toBe('Connection settings');
    expect(document.querySelector('.login-card').textContent).not.toMatch(/Portal/); // names no portal
  });

  test('is identical whichever portal asks for it', async () => {
    const {loginView} = await mod('shared/auth/login-view.js');
    const texts = [];
    for (const title of ['Student Portal', 'Super Admin Portal', 'Sign in']) {
      loginView({title}, {});
      texts.push(document.getElementById('app').textContent);
    }
    expect(new Set(texts).size).toBe(1);
  });

  test('shows a message such as "session expired"', async () => {
    const {loginView} = await mod('shared/auth/login-view.js');
    loginView({}, {message: 'Your session has expired. Please sign in again.'});
    expect(document.querySelector('.notice').textContent).toContain('session has expired');
  });

  test('fills the demo credentials from a demo button', async () => {
    const {loginView} = await mod('shared/auth/login-view.js');
    loginView({}, {});
    document.querySelector('.demo-buttons button').click();
    expect(document.querySelector('[name=identifier]').value).toBe('s001@demo.edu');
    expect(document.querySelector('[name=password]').value).toBe('password123');
  });

  test('disables the button and says "Signing in…" while pending, then shows the error', async () => {
    const {loginView} = await mod('shared/auth/login-view.js');
    let reject;
    loginView({}, {onSignIn: () => new Promise((_, r) => { reject = r; })});
    typeInto('identifier', ' a@b.c '); typeInto('password', 'pw');
    submit();
    await flush();
    const button = document.querySelector('[type=submit]');
    expect(button.disabled).toBe(true);
    expect(button.textContent).toBe('Signing in…');
    submit(); // a second Enter while pending is ignored
    reject(new Error('Invalid credentials'));
    await settle();
    expect(button.disabled).toBe(false);
    expect(button.textContent).toBe('Continue to workspace');
    expect(document.querySelector('.form-error').textContent).toBe('Invalid credentials');
    expect(document.querySelector('.form-error').hidden).toBe(false);
  });

  test('passes the trimmed identifier and the password to onSignIn', async () => {
    const {loginView} = await mod('shared/auth/login-view.js');
    const onSignIn = jest.fn(async () => {});
    loginView({}, {onSignIn});
    typeInto('identifier', '  me@x.edu '); typeInto('password', 'secret');
    submit(); await settle();
    expect(onSignIn).toHaveBeenCalledWith('me@x.edu', 'secret');
  });
});

describe('central sign-in site', () => {
  async function run(user, {login = {access_token: 'tok-1', user}, me = user, next} = {}) {
    const session = await mod('shared/auth/session.js');
    const to = jest.spyOn(session.redirect, 'to').mockImplementation(() => {});
    const calls = [];
    globalThis.fetch = async (url, opts = {}) => {
      const p = new URL(url).pathname;
      calls.push(`${opts.method || 'GET'} ${p}`);
      if (p === '/config/public') return response(200, {});
      if (p === '/auth/login') return login.error ? response(login.error, {detail: 'Invalid credentials'}) : response(200, login);
      if (p === '/auth/me') return response(200, me);
      return response(404, {});
    };
    if (next) history.replaceState(null, '', '/?next=' + encodeURIComponent(next));
    const {startLogin} = await mod('shared/app/login-runtime.js');
    await startLogin({title: 'Sign in'});
    typeInto('identifier', 'x@demo.edu'); typeInto('password', 'password123');
    submit(); await settle();
    return {to, calls};
  }

  test.each([
    ['student', 'student'], ['coordinator', 'coordinator'], ['advisor', 'advisor'], ['campus_admin', 'campus-manager'], ['super_admin', 'super-admin'],
  ])('a %s account is sent to the %s portal, role taken from /auth/me', async (role, portalId) => {
    const {to, calls} = await run(fixtures(role)['GET /auth/me']);
    expect(calls).toContain('GET /auth/me');
    const dest = new URL(to.mock.calls[0][0]);
    expect(dest.pathname.endsWith(`/${portalId}/`)).toBe(true);
    expect(new URLSearchParams(dest.hash.slice(1)).get('handoff')).toBe('tok-1');
  });

  test('the role comes from the server, not from what login echoed or from browser storage', async () => {
    sessionStorage.setItem('role', 'super_admin'); localStorage.setItem('role', 'super_admin');
    const {to} = await run({id: 1, role: 'student'}, {login: {access_token: 'tok-1', user: {id: 1, role: 'super_admin'}}, me: {id: 1, role: 'student'}});
    expect(new URL(to.mock.calls[0][0]).pathname.endsWith('/student/')).toBe(true);
  });

  test('remembers the page the visitor wanted', async () => {
    const {to} = await run(fixtures('coordinator')['GET /auth/me'], {next: '#/Grading'});
    expect(new URLSearchParams(new URL(to.mock.calls[0][0]).hash.slice(1)).get('next')).toBe('#/Grading');
  });

  test('a wrong password shows the message and goes nowhere', async () => {
    const {to} = await run({}, {login: {error: 401}});
    expect(document.querySelector('.form-error').textContent).toBe('Invalid credentials');
    expect(to).not.toHaveBeenCalled();
  });

  test('an account whose role has no portal is told so', async () => {
    const {to} = await run({id: 9, role: 'martian'});
    expect(document.querySelector('.form-error').textContent).toMatch(/does not have a portal/);
    expect(to).not.toHaveBeenCalled();
  });

  test('the sign-in page explains why the visitor is here', async () => {
    const session = await mod('shared/auth/session.js');
    globalThis.fetch = async () => response(200, {});
    history.replaceState(null, '', '/?reason=expired');
    const {startLogin} = await mod('shared/app/login-runtime.js');
    await startLogin({});
    expect(document.querySelector('.notice').textContent).toBe(session.REASON_MESSAGES.expired);
  });
});
