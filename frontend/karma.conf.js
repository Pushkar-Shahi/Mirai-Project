// Karma: the thin real-browser layer. Jest (jsdom) covers logic; this proves what jsdom
// cannot: the BUILT portals load in Chrome with no errors, render their navigation and every
// tab, and the central sign-in redirects. No database or API is needed: a middleware below
// answers /mockapi/* from tests/unit/fixtures (real responses recorded from the demo data).
//
// Run with `npm run test:karma` (scripts/run-karma.mjs builds the sites into karma-builds/
// first). Karma is deprecated upstream; this suite is deliberately small and isolated so
// it can be swapped for Playwright (frontend/e2e already is) without losing coverage.
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const FRONTEND = path.dirname(fileURLToPath(import.meta.url));
const ROLES = ['student', 'coordinator', 'advisor', 'campus_admin', 'super_admin'];
const FIXTURES = Object.fromEntries(ROLES.map(r => [r, JSON.parse(readFileSync(path.join(FRONTEND, 'tests/unit/fixtures', `${r}.json`), 'utf8'))]));

function mockApi() {
  const send = (res, status, body) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };
  return (req, res, next) => {
    const url = new URL(req.url, 'http://localhost');
    // Karma's file server has no directory index; the sites redirect to folders (../login/).
    if (url.pathname.startsWith('/base/karma-builds/') && url.pathname.endsWith('/')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.end(readFileSync(path.join(FRONTEND, url.pathname.slice('/base/'.length), 'index.html')));
    }
    if (!url.pathname.startsWith('/mockapi/')) return next();
    const p = url.pathname.slice('/mockapi'.length);
    const roleOf = () => (/^Bearer tok-(\w+)$/.exec(req.headers.authorization || '') || [])[1];
    if (p === '/config/public') return send(res, 200, {});
    if (p === '/auth/login') {
      let raw = '';
      req.on('data', c => { raw += c; });
      return req.on('end', () => {
        const {identifier, password} = JSON.parse(raw || '{}');
        const role = ROLES.find(r => FIXTURES[r]['GET /auth/me'].email === identifier);
        if (!role || password !== 'password123') return send(res, 401, {detail: 'Invalid credentials'});
        send(res, 200, {access_token: 'tok-' + role, token_type: 'bearer', user: FIXTURES[role]['GET /auth/me']});
      });
    }
    const role = roleOf();
    if (!FIXTURES[role]) return send(res, 401, {detail: 'Invalid token'});
    if (req.method !== 'GET') return send(res, 200, {});
    const body = FIXTURES[role][`GET ${p}${url.search}`];
    return body === undefined ? send(res, 404, {detail: 'No recorded response'}) : send(res, 200, body);
  };
}

export default function (config) {
  config.set({
    basePath: FRONTEND,
    frameworks: ['jasmine'],
    plugins: ['karma-jasmine', 'karma-chrome-launcher', {'middleware:mockapi': ['factory', mockApi]}],
    beforeMiddleware: ['mockapi'],
    files: [
      {pattern: 'karma-builds/**/*', included: false, served: true, watched: false},
      'karma/*.spec.js',
    ],
    browsers: ['ChromeHeadlessCI'],
    customLaunchers: {ChromeHeadlessCI: {base: 'ChromeHeadless', flags: ['--no-sandbox', '--disable-gpu']}},
    reporters: ['progress'],
    singleRun: true,
    autoWatch: false,
    browserNoActivityTimeout: 120000,
    client: {jasmine: {timeoutInterval: 30000}},
  });
}
