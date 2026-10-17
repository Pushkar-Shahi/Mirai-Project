#!/usr/bin/env node
/**
 * scripts/pwa/generate-sw.mjs
 *
 * Uses workbox-build's generateSW to emit a production service worker into
 * an already-built portal output directory.
 *
 *   node scripts/pwa/generate-sw.mjs <portalOutDir>
 *
 * Caching strategy:
 *   - Static HTML, CSS, JS assets  → precached (cache-first on subsequent loads)
 *   - API routes (/api/** or full URL matching apiOrigin) → NetworkFirst, 10 s timeout
 *   - Images / fonts / media       → CacheFirst, 30-day max-age, 60 entries
 */
import {generateSW} from 'workbox-build';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {existsSync} from 'node:fs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const portalOutDir = process.argv[2];
if (!portalOutDir) {
  console.error('Usage: node scripts/pwa/generate-sw.mjs <portalOutDir>');
  process.exit(1);
}

const absOut = path.resolve(portalOutDir);
if (!existsSync(absOut)) {
  console.error(`generate-sw: output directory not found: ${absOut}`);
  process.exit(1);
}

// The API origin is passed via env so the NetworkFirst rule can match it.
// Falls back to matching any https:// request that looks like an API call.
const apiOrigin = (process.env.MIRAI_API_BASE_URL || '').replace(/\/+$/, '');

const {count, filePaths, warnings, size} = await generateSW({
  globDirectory: absOut,
  globPatterns: [
    '**/*.{html,js,css,json,webmanifest,svg,png}',
  ],
  // Exclude the SW itself and source maps.
  globIgnores: ['sw.js', 'workbox-*.js', '**/*.map'],

  swDest: path.join(absOut, 'sw.js'),

  // Keep the SW file unversioned so the browser can always fetch it fresh.
  // The precache manifest inside it is content-hashed per asset.
  skipWaiting: true,
  clientsClaim: true,

  runtimeCaching: [
    // --- API: NetworkFirst with a 10-second timeout ---
    ...(apiOrigin
      ? [{
          urlPattern: new RegExp(`^${apiOrigin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
          handler: 'NetworkFirst',
          options: {
            cacheName: 'mirai-api-cache',
            networkTimeoutSeconds: 10,
            expiration: {maxEntries: 50, maxAgeSeconds: 60},
            cacheableResponse: {statuses: [0, 200]},
          },
        }]
      : []
    ),
    {
      // Fallback/standard: treat any /api/ path as network-first
      urlPattern: /\/api\//,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'mirai-api-cache',
        networkTimeoutSeconds: 10,
        expiration: {maxEntries: 50, maxAgeSeconds: 60},
        cacheableResponse: {statuses: [0, 200]},
      },
    },
    // --- Static media: CacheFirst, 30 days ---
    {
      urlPattern: /\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf|otf)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'mirai-media-cache',
        expiration: {maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60},
        cacheableResponse: {statuses: [0, 200]},
      },
    },
  ],

  // Inline the Workbox runtime so the portal has zero extra network requests.
  inlineWorkboxRuntime: true,

  // Content-hash the precache manifest; avoid caching the SW URL itself.
  cleanupOutdatedCaches: true,
  sourcemap: false,
});

if (warnings.length) warnings.forEach(w => console.warn('[generate-sw]', w));
console.log(
  `[generate-sw] ${path.relative(ROOT, absOut)}: ${count} assets precached (${(size / 1024).toFixed(1)} kB) → sw.js`
);
