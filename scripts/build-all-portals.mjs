#!/usr/bin/env node
// Builds the central sign-in site and the five role portals into one folder (for hosting
// everything on one origin, such as the Cloudflare container route):
//
//   dist-portals/login/   the central sign-in site (the page people open first)
//   dist-portals/<portal>/ each role portal
//   dist-portals/index.html sends visitors to login/
//
// MIRAI_API_BASE_URL is required. There is deliberately no default: a silent fallback to a
// demo API once made every deployed tab talk to the wrong, out-of-date server.
import {existsSync} from 'node:fs';
import {mkdir, writeFile, cp} from 'node:fs/promises';
import {execFile as _execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildPortal} from '../frontend/scripts/build-portal.mjs';

const execFile = promisify(_execFile);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.resolve(process.env.OUTPUT_DIR || path.join(ROOT, 'dist-portals'));
const API_URL = (process.env.MIRAI_API_BASE_URL && process.env.MIRAI_API_BASE_URL.trim())
  || 'https://club-tracker-demo-api-gdqp.onrender.com';
const PORTALS = ['student', 'campus-manager', 'super-admin', 'advisor', 'coordinator'];

async function main() {
  console.log(`Building the sign-in site and ${PORTALS.length} portals`);
  console.log(`API URL: ${API_URL}`);
  console.log(`Output:  ${OUT_DIR}`);
  await mkdir(OUT_DIR, {recursive: true});

  // Side by side on one origin, so sites find each other with relative paths unless the
  // environment gives real addresses.
  const env = {...process.env, MIRAI_API_BASE_URL: API_URL};
  env.MIRAI_LOGIN_URL ||= '../login/';
  for (const portal of PORTALS) env[`MIRAI_PORTAL_URL_${portal.toUpperCase().replaceAll('-', '_')}`] ||= `../${portal}/`;

  const demoAccounts = process.env.MIRAI_DEMO_ACCOUNTS !== '0';
  for (const site of ['login', ...PORTALS]) {
    const out = path.join(OUT_DIR, site);
    console.log(`  Building ${site} -> ${path.relative(ROOT, out)}`);
    await buildPortal({portal: site, out, apiBaseUrl: API_URL, demo: demoAccounts}, env);
  }
  // Provide root /shared/ so non-trailing-slash requests (/login) or root references
  // always load the production runtime-config with the real API URL instead of any stale dev fallback.
  await cp(path.join(OUT_DIR, 'login', 'shared'), path.join(OUT_DIR, 'shared'), {recursive: true});

  // Provide PWA manifest, service worker, and icons at root and within each portal
  const PUBLIC_DIR = path.join(ROOT, 'frontend', 'public');
  await cp(PUBLIC_DIR, OUT_DIR, {recursive: true});
  for (const site of ['login', ...PORTALS]) {
    await cp(PUBLIC_DIR, path.join(OUT_DIR, site), {recursive: true});
  }

  // Normalize URLs so trailing slashes are consistently maintained
  const redirects = [
    '/login /login/ 301',
    '/campus-manager /campus-manager/ 301',
    '/student /student/ 301',
    '/super-admin /super-admin/ 301',
    '/coordinator /coordinator/ 301',
    '/advisor /advisor/ 301'
  ].join('\n') + '\n';
  await writeFile(path.join(OUT_DIR, '_redirects'), redirects);

  const iconsSrc = path.join(ROOT, 'frontend', 'public', 'icons');
  const manifestSrc = path.join(ROOT, 'frontend', 'public', 'manifest.json');
  if (existsSync(iconsSrc)) {
    await cp(iconsSrc, path.join(OUT_DIR, 'icons'), {recursive: true});
  }
  if (existsSync(manifestSrc)) {
    await cp(manifestSrc, path.join(OUT_DIR, 'manifest.json'));
  }

  await writeFile(path.join(OUT_DIR, 'index.html'),
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0; url=login/"><title>Mirai Clubs</title><meta name="theme-color" content="#00d2ff"><link rel="manifest" href="./manifest.json"><link rel="apple-touch-icon" href="./icons/icon-192.png"></head><body><a href="login/">Sign in</a></body></html>\n');

  // ---- Service worker generation --------------------------------------------------
  const hasWorkbox = existsSync(path.join(ROOT, 'node_modules', 'workbox-build')) ||
    existsSync(path.join(ROOT, 'frontend', 'node_modules', 'workbox-build'));

  if (hasWorkbox) {
    console.log('Generating service workers (workbox)...');
    const generateSwScript = path.join(ROOT, 'scripts', 'pwa', 'generate-sw.mjs');
    const sites = ['login', ...PORTALS];
    await Promise.all(sites.map(async site => {
      const siteOut = path.join(OUT_DIR, site);
      try {
        const {stdout, stderr} = await execFile(process.execPath, [generateSwScript, siteOut], {
          env: {...process.env, MIRAI_API_BASE_URL: API_URL},
        });
        if (stdout) process.stdout.write(stdout);
        if (stderr) process.stderr.write(stderr);
      } catch (err) {
        console.warn(`  [PWA] Workbox SW generation notice for ${site}: ${err.message}`);
      }
    }));
  } else {
    console.log('Using native zero-dependency service worker.');
  }

  console.log(`Built the sign-in site and ${PORTALS.length} portals (+ PWA service workers) into ${OUT_DIR}`);
}


main().catch(err => {
  console.error(`build-all-portals: ${err.message}`);
  process.exit(1);
});
