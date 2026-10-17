#!/usr/bin/env node
// Records the real API responses each role's tabs receive, for the Jest and Karma suites.
//
//   1. Start the API with the demo data (./scripts/run_local.sh --demo).
//   2. Build and serve the portals (node frontend/scripts/serve.mjs --all).
//   3. node frontend/scripts/capture-fixtures.mjs [--api http://127.0.0.1:8000]
//
// Writes frontend/tests/unit/fixtures/<role>.json: {"GET /path?query": body}. Arrays are cut
// to five rows. Only demo data (backend/scripts/seed.py) is ever recorded; no tokens.
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {chromium} from '@playwright/test';

const FRONTEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(FRONTEND, 'tests', 'unit', 'fixtures');
const flag = process.argv.indexOf('--api');
const api = ((flag >= 0 && process.argv[flag + 1]) || 'http://127.0.0.1:8000').replace(/\/+$/, '');
const {PORTALS} = await import(pathToFileURL(path.join(FRONTEND, 'shared/config/portals.js')).href);
const ACCOUNTS = {student: 's001@demo.edu', coordinator: 'coord@demo.edu', advisor: 'advisor@demo.edu', campus_admin: 'admin@demo.edu', super_admin: 'super@demo.edu'};
const PORT = Object.fromEntries(PORTALS.map((p, i) => [p.id, 5501 + i]));

const trim = v => Array.isArray(v) ? v.slice(0, 5).map(trim) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, trim(x)])) : v;

await mkdir(OUT, {recursive: true});
const browser = await chromium.launch();
for (const portal of PORTALS) {
  const {pages} = await import(pathToFileURL(path.join(FRONTEND, 'apps', portal.id, 'portal-config.js')).href).then(m => ({pages: m.portalConfig.pages}));
  const ctx = await browser.newContext(), page = await ctx.newPage(), recorded = {};
  page.on('response', async r => {
    const u = new URL(r.url());
    if (!r.url().startsWith(api) || r.request().method() !== 'GET' || !r.ok()) return;
    if ((r.headers()['content-type'] || '').includes('json')) recorded[`GET ${u.pathname}${u.search}`] = trim(await r.json().catch(() => null));
  });
  await page.goto(`http://127.0.0.1:${PORT[portal.id]}/`);
  await page.locator('input[name=identifier]').fill(ACCOUNTS[portal.role]);
  await page.locator('input[name=password]').fill('password123');
  await page.keyboard.press('Enter');
  await page.locator('#nav').waitFor();
  for (const tab of pages) {
    await page.locator(`#nav [data-page="${tab}"]`).click();
    await page.waitForTimeout(1200);
  }
  delete recorded['GET /config/public'];
  // The signed-in profile (never the token): the unit tests build the session from it.
  const login = await (await ctx.request.post(`${api}/auth/login`, {data: {identifier: ACCOUNTS[portal.role], password: 'password123'}})).json();
  recorded['GET /auth/me'] = await (await ctx.request.get(`${api}/auth/me`, {headers: {Authorization: `Bearer ${login.access_token}`}})).json();
  await writeFile(path.join(OUT, `${portal.role}.json`), JSON.stringify(recorded, null, 1) + '\n');
  console.log(portal.role, Object.keys(recorded).length, 'responses');
  await ctx.close();
}
await browser.close();
