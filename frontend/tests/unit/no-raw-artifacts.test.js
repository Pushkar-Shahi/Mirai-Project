import {h, setChildren} from '../../shared/core/dom.js';
import {transcriptView} from '../../shared/features/records/transcript-view.js';
import {mountTab} from './helpers.js';

describe('No raw artifacts in rendered output (A2 & Quality Bar)', () => {
  test('setChildren flattens arrays and filters nulls without stringifying to [object ...]', () => {
    const parent = document.createElement('div');
    const h4 = h('h4', {}, 'Highlights');
    const ul = h('ul', {}, h('li', {}, 'Item 1'));

    // Test array child with nulls
    setChildren(parent, 'Header text', [h4, ul], null, false, undefined);

    expect(parent.innerHTML).not.toContain('[object');
    expect(parent.innerHTML).not.toContain('null');
    expect(parent.innerHTML).not.toContain('undefined');
    expect(parent.querySelector('h4')?.textContent).toBe('Highlights');
    expect(parent.querySelector('ul')?.textContent).toBe('Item 1');
  });

  test('transcriptView with null or empty memberships produces no bare null', () => {
    const container = document.createElement('div');
    const dataWithoutMemberships = {
      totals: {
        club_days_attended: 2,
        submissions: 1,
        average_score: 4.5,
        max_score: 5,
        graded_club_days: 1,
        presentations: 0,
        events_attended: 0,
        events_registered: 0,
        certificates: 1,
      },
      memberships: null,
      club_days: [],
      events: [],
    };

    setChildren(container, ...transcriptView(dataWithoutMemberships));

    expect(container.textContent).not.toContain('null');
    expect(container.textContent).not.toContain('undefined');
    expect(container.textContent).not.toContain('[object');
  });

  test('Super Admin Dashboard mounts cleanly without [object ...] or bare null', async () => {
    await mountTab('super-admin', 'Dashboard', 'super_admin');
    const view = document.getElementById('view');
    expect(view.innerHTML).not.toContain('[object HTML');
    expect(view.innerHTML).not.toContain('[object Object');
  });
});
