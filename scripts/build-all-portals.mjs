#!/usr/bin/env node
import {cp, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildPortal} from '../frontend/scripts/build-portal.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.resolve(process.env.OUTPUT_DIR || path.join(ROOT, 'dist-portals'));
const API_URL = process.env.MIRAI_API_BASE_URL || 'https://club-tracker-demo-api.onrender.com';
const PORTALS = ['student', 'campus-manager', 'super-admin', 'advisor', 'coordinator'];

async function main() {
  console.log(`Building all portals for Cloudflare Pages...`);
  console.log(`API URL: ${API_URL}`);
  console.log(`Output:  ${OUT_DIR}`);

  await mkdir(OUT_DIR, {recursive: true});

  for (const portal of PORTALS) {
    const portalOut = path.join(OUT_DIR, portal);
    console.log(`  Building ${portal} -> ${path.relative(ROOT, portalOut)}`);
    await buildPortal({
      portal,
      out: portalOut,
      apiBaseUrl: API_URL,
      demo: false,
    }, {
      MIRAI_API_BASE_URL: API_URL,
      ...process.env,
    });
  }

  console.log(`  Copying central hub and headers...`);
  await cp(path.join(ROOT, 'frontend/hub/index.html'), path.join(OUT_DIR, 'index.html'));
  await cp(path.join(ROOT, 'frontend/hub/_headers'), path.join(OUT_DIR, '_headers'));

  console.log(`Successfully built all 5 portals + hub into ${OUT_DIR}`);
}

main().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
