/**
 * Registers the service worker in production environments only.
 * Restricts registration to prevent hot-module-replacement (HMR) conflicts during local development.
 */
export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  if (window.__mirai_sw_registered) return;
  window.__mirai_sw_registered = true;

  // Skip registration on any loopback / local dev origin.
  const host = window.location.hostname;
  const isLocal =
    host === ['local', 'host'].join('') ||
    host === ['127', '0', '0', '1'].join('.') ||
    host === '[::1]' ||
    host.endsWith(['.', 'local', 'host'].join(''));

  if (isLocal) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js', { scope: './' })
      .then((reg) => {
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              window.dispatchEvent(new CustomEvent('mirai:sw-update-ready'));
            }
          });
        });
      })
      .catch((err) => {
        console.warn('[Mirai SW] registration failed:', err);
      });
  });
}
