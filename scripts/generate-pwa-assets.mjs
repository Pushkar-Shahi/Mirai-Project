import {writeFile, mkdir} from 'node:fs/promises';
import {execSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = path.join(ROOT, 'frontend', 'public');

await mkdir(PUBLIC_DIR, {recursive: true});

const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a0d24" />
      <stop offset="50%" stop-color="#060814" />
      <stop offset="100%" stop-color="#03040a" />
    </linearGradient>
    <linearGradient id="cyanPurple" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00f0ff" />
      <stop offset="50%" stop-color="#7000ff" />
      <stop offset="100%" stop-color="#ff007a" />
    </linearGradient>
    <linearGradient id="cyanAccent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#00d2ff" />
      <stop offset="100%" stop-color="#00f0ff" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="12" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
    <radialGradient id="ambient" cx="50%" cy="40%" r="55%">
      <stop offset="0%" stop-color="#7000ff" stop-opacity="0.35" />
      <stop offset="70%" stop-color="#00f0ff" stop-opacity="0.08" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0" />
    </radialGradient>
  </defs>

  <!-- Background Squircle -->
  <rect width="512" height="512" rx="116" fill="url(#bgGrad)" />
  <circle cx="256" cy="220" r="180" fill="url(#ambient)" />
  <rect width="504" height="504" x="4" y="4" rx="112" fill="none" stroke="url(#cyanPurple)" stroke-width="2" stroke-opacity="0.4" />

  <!-- Outer Cyber Tech Ring Elements -->
  <circle cx="256" cy="220" r="150" fill="none" stroke="#00f0ff" stroke-width="1.5" stroke-dasharray="14 18" stroke-opacity="0.25" />
  <circle cx="256" cy="220" r="125" fill="none" stroke="#7000ff" stroke-width="1.5" stroke-dasharray="8 24" stroke-opacity="0.3" />

  <!-- Geometric Mirai "M" Monogram -->
  <g filter="url(#glow)">
    <!-- Left Pillar -->
    <path d="M 120 310 L 120 140 L 165 140 L 165 310 Z" fill="url(#cyanPurple)" />
    <!-- Right Pillar -->
    <path d="M 347 310 L 347 140 L 392 140 L 392 310 Z" fill="url(#cyanPurple)" />
    <!-- Left Diagonal -->
    <path d="M 165 140 L 256 250 L 222 278 L 140 180 Z" fill="url(#cyanAccent)" />
    <!-- Right Diagonal -->
    <path d="M 347 140 L 256 250 L 290 278 L 372 180 Z" fill="url(#cyanAccent)" />
    <!-- Central Apex Core -->
    <polygon points="256,220 280,250 256,280 232,250" fill="#00f0ff" />
    <circle cx="256" cy="250" r="4" fill="#ffffff" />
    <!-- Apex Beacon -->
    <polygon points="256,110 266,125 256,140 246,125" fill="#00f0ff" />
  </g>

  <!-- High-Tech Typography -->
  <text x="256" y="396" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Outfit', 'Inter', sans-serif" font-size="44" font-weight="900" letter-spacing="12" fill="#ffffff">MIRAI</text>
  <text x="256" y="424" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Outfit', 'Inter', sans-serif" font-size="12" font-weight="600" letter-spacing="6" fill="#00f0ff" opacity="0.8">SYSTEMS</text>
</svg>
`;

await writeFile(path.join(PUBLIC_DIR, 'icon.svg'), svgContent, 'utf8');
console.log('Created icon.svg');

// Generate PNGs using sips
try {
  execSync(`sips -s format png -z 512 512 "${path.join(PUBLIC_DIR, 'icon.svg')}" --out "${path.join(PUBLIC_DIR, 'icon-512.png')}"`);
  execSync(`sips -s format png -z 192 192 "${path.join(PUBLIC_DIR, 'icon.svg')}" --out "${path.join(PUBLIC_DIR, 'icon-192.png')}"`);
  execSync(`sips -s format png -z 180 180 "${path.join(PUBLIC_DIR, 'icon.svg')}" --out "${path.join(PUBLIC_DIR, 'apple-touch-icon.png')}"`);
  console.log('Created icon-512.png, icon-192.png, and apple-touch-icon.png via sips');
} catch (e) {
  console.error('sips failed:', e.message);
}

// Write manifest.webmanifest and manifest.json
const manifest = {
  name: "Mirai Club Management Portal",
  short_name: "Mirai",
  description: "Unified cyber-aesthetic portal for club operations, attendance, certificates, duty leaves, and campus administration.",
  start_url: "./",
  scope: "./",
  display: "standalone",
  display_override: ["window-controls-overlay", "standalone", "minimal-ui"],
  background_color: "#060814",
  theme_color: "#060814",
  orientation: "any",
  categories: ["education", "productivity", "management", "utilities"],
  icons: [
    {
      src: "./icon-192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "any maskable"
    },
    {
      src: "./icon-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "any maskable"
    },
    {
      src: "./icon.svg",
      sizes: "any",
      type: "image/svg+xml",
      purpose: "any"
    }
  ],
  shortcuts: [
    {
      name: "Sign In",
      short_name: "Login",
      url: "./login/",
      icons: [{ src: "./icon-192.png", sizes: "192x192" }]
    },
    {
      name: "Student Portal",
      short_name: "Student",
      url: "./student/",
      icons: [{ src: "./icon-192.png", sizes: "192x192" }]
    },
    {
      name: "Campus Manager",
      short_name: "Manager",
      url: "./campus-manager/",
      icons: [{ src: "./icon-192.png", sizes: "192x192" }]
    },
    {
      name: "Super Admin",
      short_name: "Admin",
      url: "./super-admin/",
      icons: [{ src: "./icon-192.png", sizes: "192x192" }]
    }
  ]
};

const manifestJson = JSON.stringify(manifest, null, 2) + '\n';
await writeFile(path.join(PUBLIC_DIR, 'manifest.webmanifest'), manifestJson, 'utf8');
await writeFile(path.join(PUBLIC_DIR, 'manifest.json'), manifestJson, 'utf8');
console.log('Created manifest.webmanifest and manifest.json');

// Write sw.js (Service Worker)
const swContent = `// Mirai PWA Service Worker v1.0.0
const CACHE_NAME = 'mirai-pwa-v1.0.0';
const CORE_ASSETS = [
  './',
  './shared/styles/app.css',
  './shared/theme-init.js',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS).catch((err) => {
        console.warn('Mirai SW pre-cache partial notice:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Never cache mutation requests (POST, PUT, DELETE, PATCH)
  if (req.method !== 'GET') {
    return;
  }

  // Network-only for live API, auth endpoints, and cloud API domains
  if (
    url.pathname.startsWith('/api') ||
    url.hostname.includes('onrender.com') ||
    url.pathname.includes('/auth/') ||
    url.searchParams.has('nocache')
  ) {
    return;
  }

  // HTML page navigation: Network First with cache fallback for offline usage
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          const fallback = (await caches.match('./login/')) || (await caches.match('./'));
          return fallback || new Response(
            '<!doctype html><html><head><meta charset="utf-8"><title>Offline - Mirai</title><style>body{background:#060814;color:#00d2ff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;padding:20px;}</style></head><body><div><h1>Mirai Offline</h1><p>You are currently offline. Please reconnect to access real-time data.</p></div></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        })
    );
    return;
  }

  // Static Assets (CSS, JS, SVG, PNG, fonts): Stale-While-Revalidate
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200 && networkRes.type === 'basic') {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkRes;
        })
        .catch(() => null);

      return cached || fetchPromise;
    })
  );
});
`;

await writeFile(path.join(PUBLIC_DIR, 'sw.js'), swContent, 'utf8');
console.log('Created sw.js');
