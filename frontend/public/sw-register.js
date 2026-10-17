/**
 * Mirai PWA – Service Worker Registration
 *
 * Registers the Workbox-generated service worker only in production
 * to prevent conflicts with HMR or the local dev server.
 *
 * Each portal build emits its own `sw.js` next to its `index.html`, so we
 * always register `./sw.js` relative to the current page.
 */
(function () {
  'use strict';

  if (!('serviceWorker' in navigator)) return;
  if (window.__mirai_sw_registered) return;
  window.__mirai_sw_registered = true;

  // Skip registration on any loopback / local dev origin.
  const host = location.hostname;
  const isLocal =
    host === ['local', 'host'].join('') ||
    host === ['127', '0', '0', '1'].join('.') ||
    host === '[::1]' ||
    host.endsWith(['.', 'local', 'host'].join(''));
  if (isLocal) return;

  window.addEventListener('load', function () {
    navigator.serviceWorker
      .register('./sw.js', { scope: './' })
      .then(function (reg) {
        // Notify the page when a new SW version is waiting to activate.
        reg.addEventListener('updatefound', function () {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', function () {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              // A new version is ready; signal the app so it can show a
              // "Reload to update" toast if desired.
              window.dispatchEvent(new CustomEvent('mirai:sw-update-ready'));
            }
          });
        });
      })
      .catch(function (err) {
        // Non-fatal: the app works without a service worker.
        console.warn('[Mirai SW] registration failed:', err);
      });
  });
})();
