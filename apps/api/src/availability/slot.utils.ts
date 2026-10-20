export interface SlotWindow {
  startMinute: number;
  endMinute: number;
  slotMinutes: number;
  breaks: {
    startMinute: number;
    endMinute: number;
  }[];
}

export interface SlotCandidate {
  startsAt: string;
  endsAt: string;
  localStart: string;
  localEnd: string;
  durationMinutes: number;
}

const MINUTE_MS = 60_000;

function minuteLabel(minute: number): string {
  const hours = Math.floor(minute / 60);
  const minutes = minute % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Current hospital configuration: Asia/Kolkata.
 * This helper intentionally uses India's fixed UTC+05:30 offset.
 */
export function generateDaySlots(
  date: string,
  windows: readonly SlotWindow[],
  now: Date,
): SlotCandidate[] {
  const midnight = new Date(`${date}T00:00:00+05:30`).getTime();
  const slots: SlotCandidate[] = [];

  for (const window of windows) {
    // Defensive guard against invalid stored schedules.
    if (
      !Number.isInteger(window.startMinute) ||
      !Number.isInteger(window.endMinute) ||
      !Number.isInteger(window.slotMinutes) ||
      window.startMinute < 0 ||
      window.endMinute > 1440 ||
      window.startMinute >= window.endMinute ||
      window.slotMinutes < 5 ||
      window.slotMinutes > 120
    ) {
      throw new Error('Invalid stored availability window');
    }

    for (
      let start = window.startMinute;
      start + window.slotMinutes <= window.endMinute;
      start += window.slotMinutes
    ) {
      const end = start + window.slotMinutes;

      const overlapsBreak = window.breaks.some(
        (pause) => start < pause.endMinute && end > pause.startMinute,
      );

      if (overlapsBreak) {
        continue;
      }

      const startsAt = new Date(midnight + start * MINUTE_MS);
      const endsAt = new Date(midnight + end * MINUTE_MS);

      if (startsAt.getTime() <= now.getTime()) {
        continue;
      }

      slots.push({
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        localStart: minuteLabel(start),
        localEnd: minuteLabel(end),
        durationMinutes: window.slotMinutes,
      });
    }
  }

  return slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}
