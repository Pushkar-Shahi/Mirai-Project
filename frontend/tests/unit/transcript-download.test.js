import { jest } from '@jest/globals';
import { transcriptLookupPage } from '../../shared/features/records/transcript-lookup.js';
import { downloadTranscriptCsv, downloadTranscriptPdf } from '../../shared/features/records/transcript-export.js';

describe('Transcript lookup and download (B2)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  test('download buttons are initially disabled', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    await transcriptLookupPage(container);

    const pdfBtn = container.querySelector('#dl-transcript-pdf');
    const csvBtn = container.querySelector('#dl-transcript-csv');

    expect(pdfBtn).not.toBeNull();
    expect(csvBtn).not.toBeNull();
    expect(pdfBtn.disabled).toBe(true);
    expect(csvBtn.disabled).toBe(true);
  });

  test('download functions generate valid CSV and PDF blobs without error', () => {
    const sampleTranscript = {
      student: { name: 'Student One', student_code: 'S001', campus: 'Rathinam' },
      totals: {
        club_days_attended: 4,
        submissions: 3,
        average_score: 8.5,
        max_score: 10,
        presentations: 1,
        events_attended: 2,
        events_registered: 2,
        certificates: 1
      },
      club_days: [
        {
          title: 'Robotics Intro',
          club_name: 'Robotics',
          day_date: '2026-10-10',
          attendance_count: 1,
          grading_status: 'graded',
          score: 9.0,
          presentation_title: 'Bot Demo',
          certificate_status: 'ready'
        }
      ],
      events: [
        {
          name: 'TechFest',
          host_campus: 'Rathinam',
          starts_at: '2026-10-15',
          checked_in_at: '2026-10-15T09:00:00Z',
          team_name: 'CyberBots',
          rank: '1st',
          certificate_status: 'ready'
        }
      ]
    };

    // Mock createObjectURL
    window.URL.createObjectURL = jest.fn(() => 'blob:mock');
    window.URL.revokeObjectURL = jest.fn();

    expect(() => downloadTranscriptCsv(sampleTranscript)).not.toThrow();
    expect(() => downloadTranscriptPdf(sampleTranscript)).not.toThrow();
    expect(window.URL.createObjectURL).toHaveBeenCalledTimes(2);
  });
});
