import { formatClubLabel, formatPersonLabel } from '../../shared/core/format.js';

describe('formatClubLabel and formatPersonLabel (B6 / B7)', () => {
  test('formatClubLabel formats "Club - Campus" by default', () => {
    expect(formatClubLabel({ name: 'chill', campus_name: 'Hitech' })).toBe('chill - Hitech');
    expect(formatClubLabel({ club_name: 'Robotics', campus: 'Rathinam' })).toBe('Robotics - Rathinam');
  });

  test('formatClubLabel suppresses redundant campus when viewing by campus or matching context', () => {
    expect(formatClubLabel({ name: 'chill', campus_name: 'Hitech' }, { byCampus: true })).toBe('chill');
    expect(formatClubLabel({ name: 'chill', campus_name: 'Hitech' }, { campus: 'Hitech' })).toBe('chill');
    expect(formatClubLabel({ name: 'chill', campus_name: 'Hitech' }, { campus: 'Rathinam' })).toBe('chill - Hitech');
  });

  test('formatClubLabel handles edge cases and strings gracefully', () => {
    expect(formatClubLabel(null)).toBe('');
    expect(formatClubLabel('Robotics')).toBe('Robotics');
    expect(formatClubLabel({ name: 'Robotics' })).toBe('Robotics');
  });

  test('formatPersonLabel formats "Person - Campus" by default', () => {
    expect(formatPersonLabel({ name: 'Pikaa', campus: 'Jagannath' })).toBe('Pikaa - Jagannath');
    expect(formatPersonLabel({ student_name: 'Student One', campus_name: 'Rathinam' })).toBe('Student One - Rathinam');
  });

  test('formatPersonLabel suppresses redundant campus when viewing by campus or matching context', () => {
    expect(formatPersonLabel({ name: 'Pikaa', campus: 'Jagannath' }, { byCampus: true })).toBe('Pikaa');
    expect(formatPersonLabel({ name: 'Pikaa', campus: 'Jagannath' }, { campus: 'Jagannath' })).toBe('Pikaa');
    expect(formatPersonLabel({ name: 'Pikaa', campus: 'Jagannath' }, { campus: 'Hitech' })).toBe('Pikaa - Jagannath');
  });

  test('formatPersonLabel handles edge cases and strings gracefully', () => {
    expect(formatPersonLabel(null)).toBe('');
    expect(formatPersonLabel('Pikaa')).toBe('Pikaa');
    expect(formatPersonLabel({ name: 'Pikaa' })).toBe('Pikaa');
  });
});
