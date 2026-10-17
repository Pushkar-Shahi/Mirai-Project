/* global describe, it, expect, beforeEach, afterEach, jasmine */
// Real-browser smoke tests of the BUILT sites (served from karma-builds/ by Karma).
// The Karma middleware in karma.conf.js plays the API. Same-origin iframes let the tests
// look inside each site; errors raised while it loads are collected from the first moment.
(function () {
  var BASE = '/base/karma-builds/';
  var NAV = {
    student: ['Home', 'Clubs', 'Days', 'Check-in', 'Submit', 'Certs', 'Events', 'Records', 'Notifications'],
    coordinator: ['Home', 'Members', 'Days', 'Check-in', 'Grading', 'Certs', 'Events', 'Budgets', 'Dashboard', 'Notifications'],
    advisor: ['Home', 'Days', 'Check-in', 'Grading', 'Certs', 'Events', 'Budgets', 'Dashboard', 'Notifications'],
    'campus-manager': ['Dashboard', 'Administration', 'Clubs', 'Members', 'Days', 'Check-in', 'Grading', 'Certs', 'Events', 'Budgets', 'Duty Leave', 'Records', 'Notification log', 'Notifications'],
    'super-admin': ['Dashboard', 'Administration', 'Clubs', 'Members', 'Days', 'Check-in', 'Grading', 'Certs', 'Events', 'Budgets', 'Duty Leave', 'Records', 'Notification log', 'Notifications']
  };
  var ROLE = {student: 'student', coordinator: 'coordinator', advisor: 'advisor', 'campus-manager': 'campus_admin', 'super-admin': 'super_admin'};
  var EMAIL = {student: 's001@demo.edu', coordinator: 'coord@demo.edu', advisor: 'advisor@demo.edu', 'campus-manager': 'admin@demo.edu', 'super-admin': 'super@demo.edu'};
  var PORTALS = Object.keys(NAV);

  var frames = [];
  afterEach(function () { frames.forEach(function (f) { f.remove(); }); frames = []; try { sessionStorage.clear(); localStorage.clear(); } catch (e) { /* ignore */ } });
  beforeEach(function () { try { sessionStorage.clear(); localStorage.clear(); } catch (e) { /* ignore */ } });

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function until(fn, what, ms) {
    var end = Date.now() + (ms || 10000), last;
    while (Date.now() < end) { try { last = fn(); if (last) return last; } catch (e) { /* not yet */ } await sleep(40); }
    throw new Error('Timed out waiting for ' + what);
  }

  // Opens a site in a same-origin iframe and records page errors and console errors.
  function open(site, hash, width) {
    var iframe = document.createElement('iframe');
    iframe.style.cssText = 'width:' + (width || 1200) + 'px;height:800px;border:0';
    document.body.appendChild(iframe);
    frames.push(iframe);
    var errors = [];
    function hook() {
      var w = iframe.contentWindow;
      if (!w || w.__hooked) return;
      w.__hooked = true;
      w.addEventListener('error', function (e) { errors.push('error: ' + e.message); });
      w.addEventListener('unhandledrejection', function (e) { errors.push('rejection: ' + (e.reason && e.reason.message || e.reason)); });
      var orig = w.console.error;
      w.console.error = function () { errors.push('console.error: ' + Array.prototype.join.call(arguments, ' ')); return orig.apply(w.console, arguments); };
    }
    iframe.src = BASE + site + '/index.html' + (hash || '');
    hook();
    iframe.addEventListener('load', hook);
    return {iframe: iframe, errors: errors, win: function () { return iframe.contentWindow; }, doc: function () { return iframe.contentDocument; }};
  }
  function navItems(f) { return Array.prototype.map.call(f.doc().querySelectorAll('#nav [data-page]'), function (b) { return b.dataset.page; }); }
  function failedAssets(f) {
    return f.win().performance.getEntriesByType('resource').filter(function (e) { return e.responseStatus >= 400; }).map(function (e) { return e.responseStatus + ' ' + e.name; });
  }
  async function signedInPortal(portal, width) {
    var f = open(portal, '#handoff=tok-' + ROLE[portal], width);
    await until(function () { return f.doc() && f.doc().querySelector('#nav [data-page]'); }, portal + ' navigation');
    return f;
  }
  async function tabSettled(f, tab) {
    f.doc().querySelector('#nav [data-page="' + tab + '"]').click();
    await until(function () { var b = f.doc().querySelector('#nav [data-page="' + tab + '"]'); return b.getAttribute('aria-current') === 'page'; }, tab + ' selected');
    await until(function () { var v = f.doc().getElementById('view'); return v && !v.querySelector('.skeleton-card') && v.textContent.trim().length > 0; }, tab + ' to finish loading');
  }
  function fill(f, id, pw) {
    var d = f.doc();
    d.querySelector('[name=identifier]').value = id;
    d.querySelector('[name=password]').value = pw || 'password123';
  }
  function submit(f) { f.doc().querySelector('form').dispatchEvent(new Event('submit', {bubbles: true, cancelable: true})); }

  describe('built sites in a real browser', function () {
    PORTALS.forEach(function (portal) {
      describe(portal, function () {
        it('loads with no console errors or missing files and renders exactly its navigation', async function () {
          var f = await signedInPortal(portal);
          expect(navItems(f)).toEqual(NAV[portal]);
          expect(f.doc().querySelector('.sidebar')).not.toBeNull();
          expect(f.doc().getElementById('pageTitle').textContent).toMatch(/Good (morning|afternoon|evening)|\w/);
          expect(failedAssets(f)).toEqual([]);
          expect(f.errors).toEqual([]);
        });

        it('mounts every tab without errors, leaving no loading placeholder or error card', async function () {
          var f = await signedInPortal(portal);
          for (var i = 0; i < NAV[portal].length; i++) {
            var tab = NAV[portal][i];
            await tabSettled(f, tab);
            expect(f.doc().querySelector('#view .error-state')).withContext(portal + '/' + tab + ' error card').toBeNull();
          }
          expect(f.errors).toEqual([]);
        });

        it('keeps the token in this tab\'s session storage only and removes the handoff from the address bar', async function () {
          var f = await signedInPortal(portal);
          expect(f.win().sessionStorage.getItem('mirai:' + portal + ':token')).toBe('tok-' + ROLE[portal]);
          expect(f.win().localStorage.getItem('mirai:' + portal + ':token')).toBeNull();
          expect(f.win().location.hash).not.toContain('handoff');
        });

        it('signs out: clears the token and returns to the shared sign-in screen', async function () {
          var f = await signedInPortal(portal);
          f.doc().querySelector('.signout').click();
          await until(function () { return f.doc().querySelector('.modal'); }, 'confirm dialog');
          f.doc().querySelector('.modal-actions button:last-child').click();
          await until(function () { return f.doc().querySelector('.login-card'); }, 'sign-in screen');
          expect(f.win().sessionStorage.getItem('mirai:' + portal + ':token')).toBeNull();
          expect(f.doc().querySelector('.notice').textContent).toContain('signed out');
        });

        it('has a usable layout on a phone: no sideways scroll on sign-in or after sign-in', async function () {
          var anon = open(portal, '', 375);
          await until(function () { return anon.doc() && anon.doc().querySelector('.login-card'); }, 'sign-in screen');
          expect(anon.doc().documentElement.scrollWidth).not.toBeGreaterThan(anon.doc().documentElement.clientWidth);
          var f = await signedInPortal(portal, 375);
          expect(f.doc().documentElement.scrollWidth).not.toBeGreaterThan(f.doc().documentElement.clientWidth + 1);
        });
      });
    });

    describe('central sign-in', function () {
      PORTALS.forEach(function (portal) {
        it('sends the ' + ROLE[portal] + ' account to the ' + portal + ' portal (role read from the server)', async function () {
          var f = open('login');
          await until(function () { return f.doc() && f.doc().querySelector('[name=identifier]'); }, 'sign-in form');
          expect(f.doc().querySelector('.login-card h2').textContent).toBe('Sign in to Mirai Clubs');
          fill(f, EMAIL[portal]);
          submit(f);
          await until(function () { return f.win().location.pathname.indexOf('/' + portal + '/') !== -1 && f.doc().querySelector('#nav [data-page]'); }, 'the ' + portal + ' portal', 15000);
          expect(navItems(f)).toEqual(NAV[portal]);
          expect(f.win().sessionStorage.getItem('mirai:' + portal + ':token')).toBe('tok-' + ROLE[portal]);
        });
      });

      it('shows the API message for a wrong password and stays on the sign-in page', async function () {
        var f = open('login');
        await until(function () { return f.doc() && f.doc().querySelector('[name=identifier]'); }, 'sign-in form');
        fill(f, 'coord@demo.edu', 'wrong');
        submit(f);
        await until(function () { var e = f.doc().querySelector('.form-error'); return e && !e.hidden && e.textContent; }, 'error text');
        expect(f.doc().querySelector('.form-error').textContent).toBe('Invalid credentials');
        expect(f.win().location.pathname).toContain('/login/');
        expect(f.doc().querySelector('[type=submit]').disabled).toBe(false);
      });

      it('redirects someone who signs in on the wrong portal to their own', async function () {
        var f = open('student');
        await until(function () { return f.doc() && f.doc().querySelector('[name=identifier]'); }, 'student sign-in');
        // The portal is built with a central sign-in site, so a signed-out visitor is sent there.
        await until(function () { return f.win().location.pathname.indexOf('/login/') !== -1 && f.doc().querySelector('[name=identifier]'); }, 'central sign-in', 15000);
        fill(f, EMAIL.coordinator);
        submit(f);
        await until(function () { return f.win().location.pathname.indexOf('/coordinator/') !== -1 && f.doc().querySelector('#nav [data-page]'); }, 'the coordinator portal', 15000);
        expect(navItems(f)).toEqual(NAV.coordinator);
      });

      it('remembers a deep link through the sign-in', async function () {
        var f = open('coordinator', '#/Grading');
        await until(function () { return f.win().location.pathname.indexOf('/login/') !== -1 && f.doc().querySelector('[name=identifier]'); }, 'central sign-in', 15000);
        expect(new URLSearchParams(f.win().location.search).get('next')).toBe('#/Grading');
        fill(f, EMAIL.coordinator);
        submit(f);
        await until(function () { return f.win().location.pathname.indexOf('/coordinator/') !== -1 && f.doc().querySelector('#nav [data-page].on'); }, 'the coordinator portal', 15000);
        expect(f.doc().querySelector('#nav [data-page].on').dataset.page).toBe('Grading');
      });

      it('explains an expired session on the sign-in page', async function () {
        var f = open('coordinator', '');
        f.iframe.src = BASE + 'coordinator/index.html';
        await until(function () { return f.win().location.pathname.indexOf('/login/') !== -1; }, 'central sign-in', 15000);
        var g = open('login', '?reason=expired');
        await until(function () { return g.doc() && g.doc().querySelector('.notice'); }, 'notice');
        expect(g.doc().querySelector('.notice').textContent).toBe('Your session has expired. Please sign in again.');
      });
    });
  });
})();
