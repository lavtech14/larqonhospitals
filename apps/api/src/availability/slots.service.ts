import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';
import { generateDaySlots, type SlotCandidate } from './slot.utils.js';

const DAY_MS = 86_400_000;
const INDIA_OFFSET_MS = 330 * 60_000;
const MAX_ADVANCE_DAYS = 180;

type SlotReason =
  | 'OPEN'
  | 'DOCTOR_INACTIVE'
  | 'DEPARTMENT_INACTIVE'
  | 'HOSPITAL_CLOSED'
  | 'DOCTOR_UNAVAILABLE'
  | 'NO_WEEKLY_SCHEDULE'
  | 'NON_WORKING_DAY'
  | 'NO_FUTURE_SLOTS'
  | 'ALL_SLOTS_BOOKED';

@Injectable()
export class SlotsService {
  constructor(private readonly database: DatabaseService) {}

  async list(doctorId: string, date: string) {
    const now = new Date();

    const calendarDate = new Date(`${date}T00:00:00.000Z`);

    if (
      !Number.isFinite(calendarDate.getTime()) ||
      calendarDate.toISOString().slice(0, 10) !== date
    ) {
      throw new BadRequestException('Invalid calendar date');
    }

    // Compare calendar dates in the hospital's timezone.
    const today = new Date(now.getTime() + INDIA_OFFSET_MS)
      .toISOString()
      .slice(0, 10);

    const todayDate = new Date(`${today}T00:00:00.000Z`);

    const daysAhead = (calendarDate.getTime() - todayDate.getTime()) / DAY_MS;

    if (daysAhead < 0 || daysAhead > MAX_ADVANCE_DAYS) {
      throw new BadRequestException(
        `Choose a date from today through ${MAX_ADVANCE_DAYS} days ahead`,
      );
    }

    const dayOfWeek = calendarDate.getUTCDay();

    // Read the schedule and closures from a consistent database snapshot.
    const snapshot = await this.database.$transaction(
      async (tx) => {
        const doctor = await tx.doctorProfile.findUnique({
          where: { id: doctorId },
          select: {
            id: true,
            displayName: true,
            isActive: true,
            department: {
              select: {
                isActive: true,
              },
            },
            availability: {
              select: {
                version: true,
                timeZone: true,
                windows: {
                  where: { dayOfWeek },
                  orderBy: { startMinute: 'asc' },
                  select: {
                    startMinute: true,
                    endMinute: true,
                    slotMinutes: true,
                    breaks: {
                      select: {
                        startMinute: true,
                        endMinute: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });

        if (!doctor) {
          throw new NotFoundException('Doctor not found');
        }

        const hospitalClosure = await tx.hospitalDateClosure.findUnique({
          where: { date: calendarDate },
          select: { isClosed: true },
        });

        const doctorClosure = await tx.doctorDateClosure.findUnique({
          where: {
            doctorId_date: {
              doctorId,
              date: calendarDate,
            },
          },
          select: { isClosed: true },
        });

        const dayStart = new Date(`${date}T00:00:00+05:30`);
        const dayEnd = new Date(dayStart.getTime() + DAY_MS);

        const bookings = await tx.appointment.findMany({
          where: {
            doctorId,
            status: 'BOOKED',
            startsAt: { lt: dayEnd },
            endsAt: { gt: dayStart },
          },
          select: {
            startsAt: true,
            endsAt: true,
          },
        });

        return {
          doctor,
          hospitalClosure,
          doctorClosure,
          bookings,
        };
      },
      {
        isolationLevel: 'RepeatableRead',
      },
    );

    const { doctor, hospitalClosure, doctorClosure, bookings } = snapshot;

    const respond = (reason: SlotReason, slots: SlotCandidate[] = []) => ({
      doctor: {
        id: doctor.id,
        displayName: doctor.displayName,
      },
      date,
      timeZone: 'Asia/Kolkata',
      availabilityVersion: doctor.availability?.version ?? 0,
      computedAt: now.toISOString(),
      reservationChecked: true,
      reason,
      slots,
    });

    if (!doctor.isActive) {
      return respond('DOCTOR_INACTIVE');
    }

    if (!doctor.department.isActive) {
      return respond('DEPARTMENT_INACTIVE');
    }

    if (hospitalClosure?.isClosed) {
      return respond('HOSPITAL_CLOSED');
    }

    if (doctorClosure?.isClosed) {
      return respond('DOCTOR_UNAVAILABLE');
    }

    const availability = doctor.availability;

    if (!availability) {
      return respond('NO_WEEKLY_SCHEDULE');
    }

    if (availability.timeZone !== 'Asia/Kolkata') {
      throw new BadRequestException(
        'Slot generation currently supports Asia/Kolkata only',
      );
    }

    if (availability.windows.length === 0) {
      return respond('NON_WORKING_DAY');
    }

    const futureSlots = generateDaySlots(date, availability.windows, now);

    const slots = futureSlots.filter((slot) => {
      const startsAt = new Date(slot.startsAt).getTime();
      const endsAt = new Date(slot.endsAt).getTime();

      return !bookings.some(
        (booking) =>
          startsAt < booking.endsAt.getTime() &&
          endsAt > booking.startsAt.getTime(),
      );
    });

    if (slots.length > 0) {
      return respond('OPEN', slots);
    }

    return respond(
      futureSlots.length > 0 ? 'ALL_SLOTS_BOOKED' : 'NO_FUTURE_SLOTS',
    );
  }
}
