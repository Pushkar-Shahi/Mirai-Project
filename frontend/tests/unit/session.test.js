import {jest} from '@jest/globals';
import {response} from './helpers.js';

const session = () => import('../../shared/auth/session.js');
const portal = {portalId: 'coordinator', expectedRole: 'coordinator', title: 'Coordinator Portal'};

beforeEach(() => { sessionStorage.clear(); history.replaceState(null, '', '/'); });

test('safeNext accepts page routes only', async () => {
  const {safeNext} = await session();
  for (const ok of ['#/Grading', '#/Check-in', '#/Notification%20log', '#/Check-in?session=3']) expect(safeNext(ok)).toBe(ok);
  for (const bad of ['//evil.example', 'https://evil.example', 'javascript:alert(1)', '#/<script>', '#//evil.example', '', null, undefined, 5, '#/' + 'a'.repeat(80)]) expect(safeNext(bad)).toBeNull();
});

test('signIn stores the token only when the role matches the portal', async () => {
  const {signIn, storedToken} = await session();
  globalThis.fetch = async () => response(200, {access_token: 'tok', user: {id: 1, role: 'coordinator'}});
  expect(await signIn(portal, 'c@x', 'pw')).toEqual({ok: true, user: {id: 1, role: 'coordinator'}});
  expect(storedToken(portal)).toBe('tok');
});

test('signIn does not keep a token for another role', async () => {
  const {signIn, storedToken} = await session();
  globalThis.fetch = async () => response(200, {access_token: 'tok', user: {id: 2, role: 'student'}});
  const r = await signIn(portal, 's@x', 'pw');
  expect(r).toEqual({ok: false, user: {id: 2, role: 'student'}, access_token: 'tok'});
  expect(storedToken(portal)).toBeNull();
});

test('signIn with a wrong password throws the API message', async () => {
  const {signIn} = await session();
  globalThis.fetch = async () => response(401, {detail: 'Invalid credentials'});
  await expect(signIn(portal, 'c@x', 'bad')).rejects.toThrow('Invalid credentials');
});

test('fetchSessionUser asks the server (GET /auth/me) with the token', async () => {
  const {fetchSessionUser} = await session();
  let auth;
  globalThis.fetch = async (u, o) => { auth = o.headers.Authorization; return response(200, {id: 1, role: 'advisor'}); };
  expect(await fetchSessionUser('tok')).toEqual({id: 1, role: 'advisor'});
  expect(auth).toBe('Bearer tok');
});

test('goToRolePortal opens the role portal with a one-time handoff and a safe next page', async () => {
  const mod = await session();
  const to = jest.spyOn(mod.redirect, 'to').mockImplementation(() => {});
  expect(mod.goToRolePortal({role: 'student'}, 'tok', {next: '#/Notifications'})).toBe(true);
  const dest = new URL(to.mock.calls[0][0]);
  expect(dest.pathname.endsWith('/student/')).toBe(true);
  const q = new URLSearchParams(dest.hash.slice(1));
  expect(q.get('handoff')).toBe('tok');
  expect(q.get('next')).toBe('#/Notifications');
  expect(dest.search).toBe(''); // the token is never in the query string the server sees
  to.mockClear();
  mod.goToRolePortal({role: 'student'}, 'tok', {next: '//evil.example'});
  expect(new URLSearchParams(new URL(to.mock.calls[0][0]).hash.slice(1)).has('next')).toBe(false);
});

test('goToRolePortal returns false without a token or an unknown role', async () => {
  const mod = await session();
  const to = jest.spyOn(mod.redirect, 'to').mockImplementation(() => {});
  expect(mod.goToRolePortal({role: 'student'}, '')).toBe(false);
  expect(mod.goToRolePortal({role: 'martian'}, 'tok')).toBe(false);
  expect(to).not.toHaveBeenCalled();
});

test('takeHandoff reads the token and next page, then clears the address bar', async () => {
  const {takeHandoff} = await session();
  history.replaceState(null, '', '/#handoff=abc&next=' + encodeURIComponent('#/Grading'));
  expect(takeHandoff()).toEqual({token: 'abc', next: '#/Grading'});
  expect(location.hash).toBe('');
  expect(takeHandoff()).toEqual({token: null, next: null});
  history.replaceState(null, '', '/#handoff=abc&next=' + encodeURIComponent('//evil'));
  expect(takeHandoff()).toEqual({token: 'abc', next: null});
});

test('takeHandoffToken is the token-only form', async () => {
  const {takeHandoffToken} = await session();
  history.replaceState(null, '', '/#handoff=zzz');
  expect(takeHandoffToken()).toBe('zzz');
});

test('goToLogin does nothing without a configured login site', async () => {
  const mod = await session();
  const to = jest.spyOn(mod.redirect, 'to').mockImplementation(() => {});
  expect(mod.goToLogin({reason: 'expired'})).toBe(false);
  expect(to).not.toHaveBeenCalled();
});

test('goToLogin sends the reason and the wanted page to the login site', async () => {
  const mod = await session();
  const to = jest.spyOn(mod.redirect, 'to').mockImplementation(() => {});
  expect(mod.goToLogin({reason: 'expired', next: '#/Check-in', url: 'https://login.example/'})).toBe(true);
  const dest = new URL(to.mock.calls[0][0]);
  expect(dest.origin).toBe('https://login.example');
  expect(dest.searchParams.get('reason')).toBe('expired');
  expect(dest.searchParams.get('next')).toBe('#/Check-in');
  to.mockClear();
  mod.goToLogin({reason: 'signed_out', next: 'https://evil.example', url: 'https://login.example/'});
  expect(new URL(to.mock.calls[0][0]).searchParams.has('next')).toBe(false);
});

test('roleMatches and clearSession', async () => {
  const mod = await session();
  expect(mod.roleMatches(portal, {role: 'coordinator'})).toBe(true);
  expect(mod.roleMatches(portal, {role: 'advisor'})).toBe(false);
  expect(mod.roleMatches(portal, null)).toBe(false);
  mod.storeToken(portal, 't');
  mod.clearSession(portal);
  expect(mod.storedToken(portal)).toBeNull();
  expect(mod.REASON_MESSAGES.expired).toMatch(/expired/);
});
