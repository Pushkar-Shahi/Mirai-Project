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
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildPortal} from '../frontend/scripts/build-portal.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.resolve(process.env.OUTPUT_DIR || path.join(ROOT, 'dist-portals'));
const API_URL = process.env.MIRAI_API_BASE_URL;
const PORTALS = ['student', 'campus-manager', 'super-admin', 'advisor', 'coordinator'];

async function main() {
  if (!API_URL || !API_URL.trim()) {
    throw new Error('MIRAI_API_BASE_URL is not set. Set it to the Mirai API (for example https://api.example.edu); there is no default.');
  }
  console.log(`Building the sign-in site and ${PORTALS.length} portals`);
  console.log(`API URL: ${API_URL}`);
  console.log(`Output:  ${OUT_DIR}`);
  await mkdir(OUT_DIR, {recursive: true});

  // Side by side on one origin, so sites find each other with relative paths unless the
  // environment gives real addresses.
  const env = {...process.env, MIRAI_API_BASE_URL: API_URL};
  env.MIRAI_LOGIN_URL ||= '../login/';
  for (const portal of PORTALS) env[`MIRAI_PORTAL_URL_${portal.toUpperCase().replaceAll('-', '_')}`] ||= `../${portal}/`;

  for (const site of ['login', ...PORTALS]) {
    const out = path.join(OUT_DIR, site);
    console.log(`  Building ${site} -> ${path.relative(ROOT, out)}`);
    await buildPortal({portal: site, out, apiBaseUrl: API_URL, demo: undefined}, env);
  }
  await writeFile(path.join(OUT_DIR, 'index.html'),
    '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=login/"><title>Mirai</title><a href="login/">Sign in</a>\n');
  console.log(`Built the sign-in site and ${PORTALS.length} portals into ${OUT_DIR}`);
}

main().catch(err => {
  console.error(`build-all-portals: ${err.message}`);
  process.exit(1);
});
