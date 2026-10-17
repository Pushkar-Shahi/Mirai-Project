import {flush, mountTab, response} from './helpers.js';

const settle = async () => { for (let i = 0; i < 10; i++) await flush(); };
const find = (root, sel, text) => [...root.querySelectorAll(sel)].find(e => e.textContent.trim() === text);

const items = [
  {id: 1, kind: 'club_day.announced', payload: {club_name: 'Robotics', title: 'Soldering', club_day_id: 5}, send_at: '2026-10-10T08:00:00+00:00', sent_at: '2026-10-10T08:00:01+00:00', read_at: null, cancelled_at: null, deliveries: [{channel: 'email', status: 'sent'}]},
  {id: 2, kind: 'club_day.reminder_48h', payload: {club_name: 'Robotics', title: 'Soldering', club_day_id: 5}, send_at: '2026-10-09T08:00:00+00:00', sent_at: '2026-10-09T08:00:01+00:00', read_at: '2026-10-09T09:00:00+00:00', cancelled_at: null, deliveries: []},
  {id: 3, kind: 'club_day.reminder_7d', payload: {club_name: 'Robotics', title: 'Old date', club_day_id: 4}, send_at: '2026-10-01T08:00:00+00:00', sent_at: null, read_at: null, cancelled_at: '2026-10-02T08:00:00+00:00', deliveries: []},
];

describe.each([
  ['student', 'student', 'student'], ['coordinator', 'coordinator', 'coordinator'], ['advisor', 'advisor', 'advisor'],
  ['campus-manager', 'campus_admin', 'campus manager'], ['super-admin', 'super_admin', 'super admin'],
])('inbox for %s', (portal, role) => {
  test('shows unread count, read state and outdated reminders', async () => {
    const { view } = await mountTab(portal, 'Notifications', role, 'success', {'GET /notifications?limit=100': {unread_count: 2, items}});
    await settle();
    expect(view.textContent).toContain('2 unread');
    const pills = [...view.querySelectorAll('tbody tr')].map(tr => tr.textContent);
    expect(pills).toHaveLength(3);
    expect(pills[0]).toMatch(/unread/i);
    expect(pills[1]).toMatch(/read/i);
    expect(pills[2]).toMatch(/Outdated/);
    expect(find(view, 'button', 'Mark all read')).toBeTruthy();
    expect(find(view, 'button', 'Mark read')).toBeTruthy();
  });

  test('"Mark read" and "Mark all read" call the API and refresh', async () => {
    const calls = [];
    let unread = 2;
    const extra = {
      'GET /notifications?limit=100': () => ({unread_count: unread, items: unread ? items : items.map(i => ({...i, read_at: i.read_at || 'x'}))}),
      'POST /notifications/1/read': () => { calls.push('read-1'); unread = 1; return {}; },
      'POST /notifications/read-all': () => { calls.push('read-all'); unread = 0; return {}; },
    };
    const { view } = await mountTab(portal, 'Notifications', role, 'success', extra);
    await settle();
    find(view, 'button', 'Mark read').click();
    await settle();
    expect(calls).toEqual(['read-1']);
    expect(view.textContent).toContain('1 unread');
    find(view, 'button', 'Mark all read').click();
    await settle();
    expect(calls).toEqual(['read-1', 'read-all']);
    expect(view.textContent).toContain('0 unread');
    expect(find(view, 'button', 'Mark all read')).toBeUndefined();
  });

  test('an empty inbox says so and offers no mark-all button', async () => {
    const { view } = await mountTab(portal, 'Notifications', role, 'success', {'GET /notifications?limit=100': {unread_count: 0, items: []}});
    await settle();
    expect(view.textContent).toContain('Your inbox is empty');
    expect(find(view, 'button', 'Mark all read')).toBeUndefined();
  });

  test('the email preference section renders (WhatsApp is automated)', async () => {
    const { view } = await mountTab(portal, 'Notifications', role);
    await settle();
    expect(view.textContent).toContain('Email me reminders');
    expect(view.textContent).not.toContain('Save WhatsApp settings');
  });

  test('authorities have Received and Sent tabs, students do not (B3)', async () => {
    const extra = {
      'GET /notifications?limit=100': {unread_count: 0, items: []},
      'GET /notifications/sent?limit=50&offset=0': {
        total: 1,
        items: [{
          id: 10,
          kind: 'club_day.announced',
          payload: {title: 'Robotics Day'},
          send_at: '2026-10-17T10:00:00Z',
          sent_at: '2026-10-17T10:00:01Z',
          recipient_name: 'Student One',
          recipient_role: 'student',
          recipient_campus: 'Rathinam',
          deliveries: [{channel: 'whatsapp', status: 'sent'}, {channel: 'email', status: 'sent'}]
        }]
      }
    };
    const { view } = await mountTab(portal, 'Notifications', role, 'success', extra);
    await settle();
    const sentBtn = find(view, 'button', 'Sent');
    const receivedBtn = find(view, 'button', 'Received');
    if (role === 'student') {
      expect(sentBtn).toBeUndefined();
      expect(receivedBtn).toBeUndefined();
    } else {
      expect(sentBtn).toBeDefined();
      expect(receivedBtn).toBeDefined();
      sentBtn.click();
      await settle();
      expect(view.textContent).toContain('Student One');
      expect(view.textContent).toContain('Robotics Day');
    }
  });
});

test('the unread badge counts and caps at 9+', async () => {
  const { updateBadge } = await import('../../shared/features/notifications/badge.js');
  const {setSession} = await import('../../shared/core/state.js');
  setSession('t', {});
  document.body.innerHTML = '<span id="unreadBadge" hidden></span>';
  const badge = document.getElementById('unreadBadge');
  globalThis.fetch = async () => response(200, {unread_count: 3, items: []});
  await updateBadge();
  expect(badge.textContent).toBe('3'); expect(badge.hidden).toBe(false);
  globalThis.fetch = async () => response(200, {unread_count: 25, items: []});
  await updateBadge();
  expect(badge.textContent).toBe('9+');
  globalThis.fetch = async () => response(200, {unread_count: 0, items: []});
  await updateBadge();
  expect(badge.hidden).toBe(true);
  globalThis.fetch = async () => response(500, {});
  await updateBadge();
  expect(badge.hidden).toBe(true);
});

describe.each([['campus-manager', 'campus_admin'], ['super-admin', 'super_admin']])('notification log for %s', (portal, role) => {
  const row = n => ({id: n, kind: 'budget.approved', payload: {title: 'Sensors', club_name: 'Robotics', budget_id: n}, send_at: '2026-10-16T18:09:51+00:00', sent_at: null, read_at: null, cancelled_at: null, recipient_id: 4, recipient_name: `Recipient ${n}`, recipient_role: 'coordinator', recipient_campus: 'Rathinam', deliveries: [{channel: 'email', status: 'failed', error_code: 'smtp_auth_failed', attempts: 2}]});
  const page = (offset, total = 120) => ({total, limit: 50, offset, in_app: {total, delivered: 0, read: 0, cancelled: 1}, deliveries: [{channel: 'email', status: 'failed', n: 1}], items: Array.from({length: Math.min(50, total - offset)}, (_, i) => row(offset + i + 1))});

  test('lists real rows with delivery status, filters and pagination', async () => {
    const requests = [];
    const extra = {};
    for (const o of [0, 50, 100]) extra[`GET /admin/notifications?limit=50&offset=${o}`] = () => { requests.push(o); return page(o); };
    extra['GET /admin/notifications?limit=50&offset=0&channel=email'] = () => { requests.push('email'); return page(0, 3); };
    const { view } = await mountTab(portal, 'Notification log', role, 'success', extra);
    await settle();
    expect(view.querySelectorAll('tbody tr')).toHaveLength(50);
    expect(view.textContent).toContain('Recipient 1');
    expect(view.textContent).toContain('Email: Failed (smtp_auth_failed)');
    expect(view.textContent).toContain('1–50 of 120');
    const next = find(view, 'button', 'Next'), prev = find(view, 'button', 'Previous');
    expect(prev.disabled).toBe(true);
    next.click(); await settle();
    expect(view.textContent).toContain('51–100 of 120');
    find(view, 'button', 'Next').click(); await settle();
    expect(view.textContent).toContain('101–120 of 120');
    expect(find(view, 'button', 'Next').disabled).toBe(true);
    expect(requests).toEqual([0, 50, 100]);
    const channel = view.querySelector('select[aria-label=Channel]');
    channel.value = 'email'; channel.dispatchEvent(new Event('change')); await settle();
    expect(requests.at(-1)).toBe('email');
    expect(view.textContent).toContain('1–3 of 3');
  });

  test('shows a clear message when nothing matches', async () => {
    const { view } = await mountTab(portal, 'Notification log', role, 'success', {'GET /admin/notifications?limit=50&offset=0': {total: 0, limit: 50, offset: 0, in_app: {total: 0, delivered: 0, read: 0, cancelled: 0}, deliveries: [], items: []}});
    await settle();
    expect(view.textContent).toContain('No notifications match these filters');
    expect(view.textContent).toContain('0–0 of 0');
  });
});
