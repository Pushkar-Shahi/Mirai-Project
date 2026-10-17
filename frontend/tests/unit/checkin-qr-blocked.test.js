import {jest} from '@jest/globals';
import {flush, installFetch, mountTab, response} from './helpers.js';

const settle = async () => { for (let i = 0; i < 12; i++) await flush(); };
const find = (root, sel, text) => [...root.querySelectorAll(sel)].find(e => e.textContent.trim() === text);

const session = {id: 7, club_id: 1, club_name: 'Robotics', club_day_title: 'Soldering', status: 'live', opens_at: '2026-10-16T10:00:00+00:00', closes_at: '2026-10-16T11:00:00+00:00', late_after: '2026-10-16T10:10:00+00:00', checked_in: 1, eligible_members: 2, late: 0, geo_flagged: 0, corrected: 0, opened_by_name: 'Robotics Coordinator', day_date: '2026-10-16'};
const roster = {session, students: [{student_id: 11, student_name: 'Student One', student_code: 'S001', state: 'checked_in', checked_in_at: '2026-10-16T10:02:00+00:00', is_late: false, geo_flag: false, corrected: false}, {student_id: 12, student_name: 'Student Two', student_code: 'S002', state: 'absent'}]};
const live = {
  'GET /checkin/sessions?status=live&limit=20': {items: [session]},
  'GET /checkin/sessions/7': session,
  'GET /checkin/sessions/7/roster': roster,
  'GET /checkin/sessions/7/qr': {payload: 'CLUBCHK:7:ABC123:1', token: 'ABC123'},
};

// jsdom does not load scripts; make the QR library either load or be blocked.
function qrLibrary(mode) {
  delete window.QRCode;
  const append = document.head.append.bind(document.head);
  document.head.append = el => {
    if (el.tagName === 'SCRIPT' && /qrcode/.test(el.src)) {
      setTimeout(() => {
        if (mode === 'blocked') el.onerror?.();
        else { window.QRCode = function (node, opts) { node.dataset.qr = opts.text; }; el.onload?.(); }
      }, 0);
      return;
    }
    append(el);
  };
}

// Own file: qrcode.js caches its load promise per module registry, so the blocked case needs a fresh one.
beforeEach(() => { sessionStorage.clear(); history.replaceState(null, '', '/'); });

describe.each([['coordinator', 'coordinator'], ['campus-manager', 'campus_admin'], ['super-admin', 'super_admin']])('QR library blocked for %s', (portal, role) => {
  test('the typed code is still shown, the roster loads and polling continues', async () => {
    qrLibrary('blocked');
    const { view, calls } = await mountTab(portal, 'Check-in', role, 'success', live);
    await settle();
    expect(view.querySelector('.qr').textContent).toContain('QR code unavailable');
    expect(view.querySelector('.big').textContent).toBe('ABC123'); // students can still type the code
    expect(view.textContent).toContain('Student One');
    expect(view.textContent).not.toContain('This section could not load');
    expect(calls.filter(c => c.endsWith('/qr')).length).toBeGreaterThanOrEqual(1);
  });
});
