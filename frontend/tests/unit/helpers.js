// Shared test helpers: a fetch stub that replays the recorded API responses
// (tests/unit/fixtures, captured from the demo data by scripts/capture-fixtures.mjs) and
// mounts a portal page the way the router does.
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

export const FRONTEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const fixtures = role => JSON.parse(readFileSync(path.join(FRONTEND, 'tests/unit/fixtures', `${role}.json`), 'utf8'));

export const response = (status, body, type = 'application/json') => ({
  ok: status >= 200 && status < 300,
  status,
  headers: {get: k => (k.toLowerCase() === 'content-type' ? type : null)},
  json: async () => body,
  blob: async () => new Blob([JSON.stringify(body)]),
});

// Arrays become empty, scalars stay: what the same API returns for an account with no data.
export const emptied = v => Array.isArray(v) ? [] : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, emptied(x)])) : v;

const DETAIL = {403: 'Your role cannot perform this action', 404: 'Not found', 500: 'Internal server error', 503: 'The server\'s database is behind this version of the API'};
export const FAILURES = [403, 404, 500, 503];

// mode: 'success' | 'empty' | an HTTP status | 'network'. /auth/me always succeeds.
// Returns {calls, missing}: every request, and the GETs the fixtures had no answer for.
export function installFetch(role, mode = 'success', extra = {}) {
  const data = fixtures(role), calls = [], missing = [];
  globalThis.fetch = async (url, opts = {}) => {
    const u = new URL(url), method = opts.method || 'GET', key = `${method} ${u.pathname}${u.search}`;
    calls.push(key);
    if (mode === 'network') throw new TypeError('Failed to fetch');
    if (extra[key]) { const r = typeof extra[key] === 'function' ? extra[key](opts) : extra[key]; return 'body' in r && typeof r.status === 'number' ? response(r.status, r.body) : response(200, r); }
    if (key === 'GET /auth/me') return response(200, data[key]);
    if (typeof mode === 'number') return response(mode, {detail: DETAIL[mode]});
    if (key in data) return response(200, mode === 'empty' ? emptied(data[key]) : data[key]);
    if (method !== 'GET') return response(200, {});
    missing.push(key);
    return response(404, {detail: 'No recorded response'});
  };
  return {calls, missing};
}

export function stubGlobals() {
  globalThis.URL.createObjectURL = () => 'blob:test';
  globalThis.URL.revokeObjectURL = () => {};
  window.HTMLElement.prototype.scrollIntoView = () => {};
}

// Mounts one tab of one portal, signed in as `role`, and waits for it to settle.
export async function mountTab(portalId, tab, role, mode = 'success', extra) {
  stubGlobals();
  document.body.innerHTML = '<div id="app"><h1 id="pageTitle"></h1><p id="pageSubtitle"></p><nav id="nav"></nav><span id="unreadBadge" hidden></span><div id="view"></div></div>';
  const base = pathToFileURL(path.join(FRONTEND, 'apps', portalId)).href;
  const {portalConfig} = await import(`${base}/portal-config.js`);
  const {pages} = await import(`${base}/pages.js`);
  const {configureRouter, render} = await import(pathToFileURL(path.join(FRONTEND, 'shared/navigation/router.js')).href);
  const {setSession} = await import(pathToFileURL(path.join(FRONTEND, 'shared/core/state.js')).href);
  const api = installFetch(role, mode, extra);
  const me = fixtures(role)['GET /auth/me'];
  setSession('test-token', me);
  configureRouter(portalConfig, pages);
  location.hash = '#/' + encodeURIComponent(tab);
  await render(tab);
  return {view: document.getElementById('view'), ...api, me};
}

export const flush = () => new Promise(r => setTimeout(r, 0));
