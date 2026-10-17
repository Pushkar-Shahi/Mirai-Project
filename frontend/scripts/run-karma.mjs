#!/usr/bin/env node
// Builds the sign-in site and the five portals against a mock API address, then runs Karma
// once in headless Chrome. Uses CHROME_BIN if set, otherwise the Chromium that Playwright
// installed (npx playwright install chromium).
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const FRONTEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(FRONTEND, 'karma-builds');
const {buildPortal} = await import(pathToFileURL(path.join(FRONTEND, 'scripts/build-portal.mjs')).href);
const {PORTALS} = await import(pathToFileURL(path.join(FRONTEND, 'shared/config/portals.js')).href);

const port = process.env.KARMA_PORT || '9876';
const api = `http://localhost:${port}/mockapi`;
const env = {...process.env, MIRAI_API_BASE_URL: api, MIRAI_LOGIN_URL: '../login/'};
for (const p of PORTALS) env[`MIRAI_PORTAL_URL_${p.id.toUpperCase().replaceAll('-', '_')}`] = `../${p.id}/`;

await rm(OUT, {recursive: true, force: true});
for (const site of ['login', ...PORTALS.map(p => p.id)]) await buildPortal({portal: site, out: path.join(OUT, site)}, env);
console.log(`Built the sign-in site and ${PORTALS.length} portals into karma-builds/ (mock API ${api})`);

if (!process.env.CHROME_BIN) {
  const {chromium} = await import('@playwright/test');
  const exe = chromium.executablePath();
  if (!existsSync(exe)) { console.error('No Chrome found. Set CHROME_BIN or run: npx playwright install chromium'); process.exit(2); }
  process.env.CHROME_BIN = exe;
}
const r = spawnSync(process.execPath, [path.join(FRONTEND, 'node_modules/karma/bin/karma'), 'start', path.join(FRONTEND, 'karma.conf.js'), '--port', port], {stdio: 'inherit', env: process.env, cwd: FRONTEND});
process.exit(r.status ?? 1);
