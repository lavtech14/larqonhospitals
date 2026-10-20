import { describe, expect, it } from 'vitest';

import { generateDaySlots, type SlotWindow } from './slot.utils.js';

const date = '2026-10-19';
const beforeDate = new Date('2026-10-18T00:00:00.000Z');

function window(changes: Partial<SlotWindow> = {}): SlotWindow {
  return {
    startMinute: 540, // 09:00
    endMinute: 600, // 10:00
    slotMinutes: 20,
    breaks: [],
    ...changes,
  };
}

describe('generateDaySlots', () => {
  it('converts hospital time to UTC', () => {
    const slots = generateDaySlots(date, [window()], beforeDate);

    expect(slots[0]).toEqual({
      startsAt: '2026-10-19T03:30:00.000Z',
      endsAt: '2026-10-19T03:50:00.000Z',
      localStart: '09:00',
      localEnd: '09:20',
      durationMinutes: 20,
    });
  });

  it('removes overlapping slots and allows slots touching break edges', () => {
    const slots = generateDaySlots(
      date,
      [
        window({
          breaks: [{ startMinute: 560, endMinute: 580 }],
        }),
      ],
      beforeDate,
    );

    expect(slots.map((slot) => slot.localStart)).toEqual(['09:00', '09:40']);
  });

  it('removes a slot even when a break overlaps only part of it', () => {
    const slots = generateDaySlots(
      date,
      [
        window({
          breaks: [{ startMinute: 565, endMinute: 575 }],
        }),
      ],
      beforeDate,
    );

    expect(slots.map((slot) => slot.localStart)).toEqual(['09:00', '09:40']);
  });

  it('does not create a partial slot at the end of a window', () => {
    const slots = generateDaySlots(
      date,
      [window({ endMinute: 595 })],
      beforeDate,
    );

    expect(slots.map((slot) => slot.localStart)).toEqual(['09:00', '09:20']);
  });

  it('excludes slots starting now or earlier', () => {
    const slots = generateDaySlots(
      date,
      [window()],
      new Date('2026-10-19T03:50:00.000Z'),
    );

    expect(slots.map((slot) => slot.localStart)).toEqual(['09:40']);
  });

  it('supports a consultation window ending at midnight', () => {
    const slots = generateDaySlots(
      date,
      [
        window({
          startMinute: 1420,
          endMinute: 1440,
        }),
      ],
      beforeDate,
    );

    expect(slots[0].localEnd).toBe('24:00');
    expect(slots[0].endsAt).toBe('2026-10-19T18:30:00.000Z');
  });
});
