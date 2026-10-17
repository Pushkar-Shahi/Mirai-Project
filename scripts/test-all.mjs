#!/usr/bin/env node
// Runs every suite in order and stops at the first failure:
//   backend pytest -> node --test -> Jest (with coverage) -> Karma -> Playwright (with --e2e)
//
//   npm run test:all                run the first four
//   npm run test:all -- --e2e       also run Playwright (needs the API: MIRAI_E2E_API)
// Python: $PYTHON (default python3). pytest needs DATABASE_URL and JWT_SECRET for the
// database-backed tests; those tests skip themselves without a reachable PostgreSQL.
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FE = path.join(ROOT, 'frontend');
const py = process.env.PYTHON || 'python3';
const steps = [
  ['backend pytest', py, ['-m', 'pytest', 'backend/tests/unit', '-q'], ROOT],
  ['node --test', 'npm', ['test'], FE],
  ['Jest + coverage', 'npm', ['run', 'test:coverage'], FE],
  ['Karma (real browser)', 'npm', ['run', 'test:karma'], FE],
];
if (process.argv.includes('--e2e')) steps.push(['Playwright e2e', 'npm', ['run', 'test:e2e'], FE]);

for (const [name, cmd, args, cwd] of steps) {
  console.log(`\n=== ${name} ===`);
  const r = spawnSync(cmd, args, {cwd, stdio: 'inherit', env: process.env});
  if (r.status !== 0) { console.error(`\n${name} failed`); process.exit(r.status || 1); }
}
console.log('\nAll suites passed');
