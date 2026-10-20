import { BadRequestException } from '@nestjs/common';
import type { AvailabilityWindowDto } from './availability.dto.js';

export function validateAvailability(windows: AvailabilityWindowDto[]): void {
  const sorted = [...windows].sort(
    (a, b) => a.dayOfWeek - b.dayOfWeek || a.startMinute - b.startMinute,
  );

  for (let index = 0; index < sorted.length; index += 1) {
    const window = sorted[index];

    if (window.startMinute >= window.endMinute) {
      throw new BadRequestException(
        'Working windows must end after they start.',
      );
    }

    const previous = sorted[index - 1];

    if (
      previous &&
      previous.dayOfWeek === window.dayOfWeek &&
      window.startMinute < previous.endMinute
    ) {
      throw new BadRequestException(
        'Working windows on the same day cannot overlap.',
      );
    }

    const breaks = [...window.breaks].sort(
      (a, b) => a.startMinute - b.startMinute,
    );

    for (let breakIndex = 0; breakIndex < breaks.length; breakIndex += 1) {
      const pause = breaks[breakIndex];

      if (
        pause.startMinute >= pause.endMinute ||
        pause.startMinute < window.startMinute ||
        pause.endMinute > window.endMinute
      ) {
        throw new BadRequestException(
          'Each break must be a valid interval inside its working window.',
        );
      }

      const previousBreak = breaks[breakIndex - 1];

      if (previousBreak && pause.startMinute < previousBreak.endMinute) {
        throw new BadRequestException('Breaks cannot overlap.');
      }
    }

    let hasUsableSlot = false;

    for (
      let start = window.startMinute;
      start + window.slotMinutes <= window.endMinute;
      start += window.slotMinutes
    ) {
      const end = start + window.slotMinutes;

      const overlapsBreak = breaks.some(
        (pause) => start < pause.endMinute && end > pause.startMinute,
      );

      if (!overlapsBreak) {
        hasUsableSlot = true;
        break;
      }
    }

    if (!hasUsableSlot) {
      throw new BadRequestException(
        'Each working window must contain at least one complete slot outside breaks.',
      );
    }
  }
}
