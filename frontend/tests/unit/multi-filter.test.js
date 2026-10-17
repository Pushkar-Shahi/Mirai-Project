import { multiFilter } from '../../shared/components/ui.js';

describe('multiFilter component (B5)', () => {
  test('defaults to All and selecting All is exclusive', () => {
    const filter = multiFilter([
      ['', 'All channels'],
      ['in_app', 'In-app'],
      ['email', 'Email'],
      ['whatsapp', 'WhatsApp']
    ]);

    expect(filter.value).toBe('');
    expect(filter.values).toEqual([]);

    const chips = filter.querySelectorAll('.multi-filter-chip');
    const allChip = chips[0];
    const emailChip = chips[2];
    const waChip = chips[3];

    expect(allChip.classList.contains('primary')).toBe(true);
    expect(emailChip.classList.contains('primary')).toBe(false);

    // Clicking Email selects Email and deselects All
    emailChip.click();
    expect(filter.value).toBe('email');
    expect(filter.values).toEqual(['email']);
    expect(allChip.classList.contains('primary')).toBe(false);
    expect(emailChip.classList.contains('primary')).toBe(true);

    // Clicking WhatsApp allows multi-select
    waChip.click();
    expect(filter.values.sort()).toEqual(['email', 'whatsapp']);
    expect(filter.value).toBe('email,whatsapp');
    expect(emailChip.classList.contains('primary')).toBe(true);
    expect(waChip.classList.contains('primary')).toBe(true);

    // Clicking All exclusively selects All and clears Email and WhatsApp
    allChip.click();
    expect(filter.value).toBe('');
    expect(filter.values).toEqual([]);
    expect(allChip.classList.contains('primary')).toBe(true);
    expect(emailChip.classList.contains('primary')).toBe(false);
    expect(waChip.classList.contains('primary')).toBe(false);
  });

  test('deselecting all specific options falls back to All', () => {
    const filter = multiFilter([
      ['student', 'Students'],
      ['coordinator', 'Coordinators'],
      ['advisor', 'Advisors']
    ]);

    // Implicit All added at start
    expect(filter.value).toBe('');
    const chips = filter.querySelectorAll('.multi-filter-chip');
    const allChip = chips[0];
    const studentChip = chips[1];

    expect(allChip.textContent).toBe('All');
    expect(allChip.classList.contains('primary')).toBe(true);

    // Select Student
    studentChip.click();
    expect(filter.value).toBe('student');
    expect(allChip.classList.contains('primary')).toBe(false);

    // Deselect Student -> falls back to All
    studentChip.click();
    expect(filter.value).toBe('');
    expect(allChip.classList.contains('primary')).toBe(true);
  });
});
