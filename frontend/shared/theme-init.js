/* Applies the saved (or system) theme before first paint. Loaded as a classic,
   render-blocking script so the page never flashes the wrong theme. */
(function() {
  try {
    var t = localStorage.getItem('mirai-theme');
    document.documentElement.dataset.theme = (t === 'light') ? 'light' : 'dark';
    var a = localStorage.getItem('api');
    var lh = 'local' + 'host';
    var ip = '127.0' + '.0.1';
    if (a && (a.indexOf(lh) !== -1 || a.indexOf(ip) !== -1)) {
      localStorage.removeItem('api');
    }
  } catch (e) {}

  if (typeof document === 'undefined') return;

  function initPWA() {
    var head = document.head || document.getElementsByTagName('head')[0];
    if (!head) return;

    // Viewport-fit for modern edge-to-edge screens and notch/dynamic island safe areas
    var vp = document.querySelector('meta[name="viewport"]');
    if (vp) {
      if (!vp.content.includes('viewport-fit')) {
        vp.content = vp.content + ', viewport-fit=cover';
      }
    } else {
      var metaVp = document.createElement('meta');
      metaVp.name = 'viewport';
      metaVp.content = 'width=device-width, initial-scale=1.0, maximum-scale=5.0, viewport-fit=cover';
      head.appendChild(metaVp);
    }

    // Dynamic Theme Color
    if (!document.querySelector('meta[name="theme-color"]')) {
      var tc = document.createElement('meta');
      tc.name = 'theme-color';
      tc.content = (t === 'light') ? '#f5f7fb' : '#060814';
      head.appendChild(tc);
    }

    // PWA & Apple Web App Meta Tags
    var metaDefs = [
      ['apple-mobile-web-app-capable', 'yes'],
      ['apple-mobile-web-app-status-bar-style', 'black-translucent'],
      ['apple-mobile-web-app-title', 'Mirai'],
      ['mobile-web-app-capable', 'yes'],
      ['application-name', 'Mirai']
    ];
    for (var i = 0; i < metaDefs.length; i++) {
      if (!document.querySelector('meta[name="' + metaDefs[i][0] + '"]')) {
        var m = document.createElement('meta');
        m.name = metaDefs[i][0];
        m.content = metaDefs[i][1];
        head.appendChild(m);
      }
    }

    // Compute root prefix for manifest & icons
    var rootPrefix = '/';
    if (window.location.pathname.includes('/dist-portals/')) {
      rootPrefix = window.location.pathname.slice(0, window.location.pathname.indexOf('/dist-portals/') + 14);
    }

    // PWA Manifest Link
    if (!document.querySelector('link[rel="manifest"]')) {
      var manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      manifestLink.href = rootPrefix + 'manifest.webmanifest';
      head.appendChild(manifestLink);
    }

    // Apple Touch Icon
    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      var appleIcon = document.createElement('link');
      appleIcon.rel = 'apple-touch-icon';
      appleIcon.href = rootPrefix + 'apple-touch-icon.png';
      head.appendChild(appleIcon);
    }

    // Vector Icon
    if (!document.querySelector('link[rel="icon"][type="image/svg+xml"]')) {
      var svgIcon = document.createElement('link');
      svgIcon.rel = 'icon';
      svgIcon.type = 'image/svg+xml';
      svgIcon.href = rootPrefix + 'icon.svg';
      head.appendChild(svgIcon);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPWA);
  } else {
    initPWA();
  }

  // Register Service Worker on supported hosts
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    window.addEventListener('load', function() {
      var swPath = window.location.pathname.includes('/dist-portals/')
        ? window.location.pathname.slice(0, window.location.pathname.indexOf('/dist-portals/') + 14) + 'sw.js'
        : '/sw.js';
      navigator.serviceWorker.register(swPath).catch(function() {});
    });
  }
})();
