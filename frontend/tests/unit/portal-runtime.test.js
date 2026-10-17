import {jest} from '@jest/globals';
import {FRONTEND, fixtures, flush, response, stubGlobals} from './helpers.js';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const mod = p => import(pathToFileURL(path.join(FRONTEND, p)).href);
const settle = async () => { for (let i = 0; i < 10; i++) await flush(); };
const coordinatorMe = fixtures('coordinator')['GET /auth/me'];

async function boot({token, hash = '', me = coordinatorMe, meStatus = 200, network = false} = {}) {
  stubGlobals();
  document.body.innerHTML = '<div id="app"></div>';
  sessionStorage.clear();
  if (token) sessionStorage.setItem('mirai:coordinator:token', token);
  history.replaceState(null, '', '/' + hash);
  const session = await mod('shared/auth/session.js');
  const to = jest.spyOn(session.redirect, 'to').mockImplementation(() => {});
  const data = fixtures('coordinator');
  globalThis.fetch = async (url, opts = {}) => {
    if (network) throw new TypeError('Failed to fetch');
    const u = new URL(url), key = `${opts.method || 'GET'} ${u.pathname}${u.search}`;
    if (u.pathname === '/auth/me') return meStatus === 200 ? response(200, me) : response(meStatus, {detail: 'Invalid token'});
    if (u.pathname === '/auth/login') return response(200, {access_token: 'fresh', user: me});
    if (key in data) return response(200, data[key]);
    return response(u.pathname === '/config/public' ? 200 : 404, u.pathname === '/config/public' ? {} : {detail: 'none'});
  };
  const {portalConfig} = await mod('apps/coordinator/portal-config.js');
  const {pages} = await mod('apps/coordinator/pages.js');
  const {startPortal} = await mod('shared/app/portal-runtime.js');
  startPortal(portalConfig, pages);
  await settle();
  return {to, session};
}

test('without a token it shows the shared sign-in screen', async () => {
  await boot();
  expect(document.querySelector('.login-card h2').textContent).toBe('Sign in to Mirai Clubs');
  expect(document.getElementById('nav')).toBeNull();
});

test('a stored token for the right role opens the shell and the first page', async () => {
  await boot({token: 't'});
  expect(document.getElementById('nav')).not.toBeNull();
  expect([...document.querySelectorAll('#nav button')].map(b => b.dataset.page)).toEqual(['Home', 'Members', 'Days', 'Check-in', 'Grading', 'Certs', 'Events', 'Budgets', 'Dashboard', 'Notifications']);
});

test('a one-time handoff token is stored, removed from the address bar and opens the wanted page', async () => {
  await boot({hash: '#handoff=h1&next=' + encodeURIComponent('#/Grading')});
  expect(sessionStorage.getItem('mirai:coordinator:token')).toBe('h1');
  expect(location.hash).toBe('#/Grading');
  expect(document.querySelector('#nav button.on').dataset.page).toBe('Grading');
});

test('a handoff to a page this portal does not have falls back to home', async () => {
  await boot({hash: '#handoff=h1&next=' + encodeURIComponent('#/Administration')});
  expect(document.querySelector('#nav button.on').dataset.page).toBe('Home');
});

test('another role gets the wrong-portal screen and no token is kept', async () => {
  await boot({token: 't', me: {...coordinatorMe, role: 'student'}});
  expect(document.querySelector('[role=alert] h2').textContent).toBe('This is the Coordinator Portal');
  expect(sessionStorage.getItem('mirai:coordinator:token')).toBeNull();
  expect(document.getElementById('nav')).toBeNull();
});

test('an expired token (401) returns to sign-in with the session-expired message', async () => {
  await boot({token: 'old', meStatus: 401});
  expect(document.querySelector('.notice').textContent).toBe('Your session has expired. Please sign in again.');
  expect(sessionStorage.getItem('mirai:coordinator:token')).toBeNull();
});

test('an unreachable API shows a readable message but keeps the token for a retry', async () => {
  await boot({token: 'keep', network: true});
  expect(document.querySelector('.notice').textContent).toMatch(/Cannot reach the server/);
  expect(sessionStorage.getItem('mirai:coordinator:token')).toBe('keep');
});

test('signing in from the portal screen remembers the deep link', async () => {
  await boot({hash: '#/Check-in'});
  document.querySelector('[name=identifier]').value = 'coord@demo.edu';
  document.querySelector('[name=password]').value = 'password123';
  document.querySelector('form').dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
  await settle();
  expect(document.querySelector('#nav button.on').dataset.page).toBe('Check-in');
});

test('signing out clears the token, the page and returns to sign-in', async () => {
  await boot({token: 't', hash: '#/Grading'});
  document.querySelector('.signout').click();
  await settle();
  document.querySelector('.modal-actions button:last-child').click(); // confirm
  await settle();
  expect(sessionStorage.getItem('mirai:coordinator:token')).toBeNull();
  expect(document.querySelector('.notice').textContent).toBe('You have been signed out.');
  expect(location.hash).toBe('');
});

test('a 401 in the middle of a session signs out with the expired message and keeps the page', async () => {
  await boot({token: 't', hash: '#/Grading'});
  const {api} = await mod('shared/core/api.js');
  globalThis.fetch = async () => response(401, {detail: 'expired'});
  await expect(api('GET', '/clubs')).rejects.toMatchObject({status: 401});
  await settle();
  expect(document.querySelector('.notice').textContent).toMatch(/expired/);
  expect(location.hash).toBe('#/Grading'); // signing in again returns to it
});

test('a portal with a missing page renderer refuses to start', async () => {
  const {startPortal} = await mod('shared/app/portal-runtime.js');
  expect(() => startPortal({portalId: 'x', pages: ['Home', 'Nope']}, {Home() {}})).toThrow('x: no page for Nope');
});
