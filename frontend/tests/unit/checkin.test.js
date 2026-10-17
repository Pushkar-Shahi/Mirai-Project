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

describe.each([['coordinator', 'coordinator'], ['advisor', 'advisor'], ['campus-manager', 'campus_admin'], ['super-admin', 'super_admin']])('staff check-in for %s', (portal, role) => {
  beforeEach(() => { sessionStorage.clear(); history.replaceState(null, '', '/'); });

  test('shows the live session, roster and the rotating QR when the library loads', async () => {
    qrLibrary('ok');
    const { view } = await mountTab(portal, 'Check-in', role, 'success', live);
    await settle();
    expect(view.textContent).toContain('Live now');
    expect(view.textContent).toContain('Student One');
    if (role === 'advisor') return; // advisors watch the roster; only check-in runners get the QR
    expect(view.textContent).toContain('ABC123');
    expect(view.querySelector('.qr').dataset.qr).toBe('CLUBCHK:7:ABC123:1');
  });

  test('with no open Club Day it explains what to do, and the history shows an empty state', async () => {
    const { view } = await mountTab(portal, 'Check-in', role, 'empty');
    await settle();
    if (role !== 'advisor') expect(view.textContent).toContain('No Club Day is open'); // advisors cannot open windows
    expect(view.textContent).toContain('No check-in sessions yet');
  });
});

describe('student check-in', () => {
  beforeEach(() => { sessionStorage.clear(); history.replaceState(null, '', '/'); });

  test('type the session ID and code when the camera cannot be used', async () => {
    const posted = [];
    const extra = {
      'POST /checkin/scan': opts => { posted.push(JSON.parse(opts.body)); return {is_late: false}; },
      'GET /checkin/sessions/7': {...session, my_checkin: {checked_in_at: '2026-10-16T10:03:00+00:00', is_late: false}},
    };
    const { view } = await mountTab('student', 'Check-in', 'student', 'success', extra);
    await settle();
    expect(view.textContent).toContain('This browser cannot scan with the camera');
    view.querySelector('[name=sid]').value = '7';
    view.querySelector('[name=token]').value = 'ABC123';
    view.querySelector('form').dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
    await settle();
    expect(posted).toEqual([{session_id: 7, token: 'ABC123'}]);
    expect(view.textContent).toContain('You are checked in');
  });

  test('pasting the full CLUBCHK text fills the session ID', async () => {
    const { view } = await mountTab('student', 'Check-in', 'student');
    const token = view.querySelector('[name=token]');
    token.value = 'CLUBCHK:9:XYZ:1';
    token.dispatchEvent(new Event('input'));
    expect(view.querySelector('[name=sid]').value).toBe('9');
  });

  test('a non-numeric session ID is rejected before any request', async () => {
    const { view, calls } = await mountTab('student', 'Check-in', 'student');
    view.querySelector('[name=sid]').value = 'abc';
    view.querySelector('[name=token]').value = 'X';
    view.querySelector('form').dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
    await settle();
    expect(view.querySelector('.form-error').textContent).toMatch(/numeric session ID/);
    expect(calls.some(c => c.startsWith('POST /checkin/scan'))).toBe(false);
  });

  test('an expired or wrong code shows the server message', async () => {
    const { view } = await mountTab('student', 'Check-in', 'student', 'success', {'POST /checkin/scan': {status: 409, body: {detail: 'This code has expired'}}, 'GET /checkin/sessions/7': {...session}});
    view.querySelector('[name=sid]').value = '7';
    view.querySelector('[name=token]').value = 'OLD';
    view.querySelector('form').dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
    await settle();
    expect(view.querySelector('.form-error').textContent).toBe('This code has expired');
  });
});
