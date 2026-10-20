import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { Prisma } from '../generated/prisma/client.js';
import type { SaveAvailabilityDto } from './availability.dto.js';
import { validateAvailability } from './validate-availability.js';

const availabilityFields = {
  doctorId: true,
  timeZone: true,
  version: true,
  windows: {
    orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }],
    select: {
      dayOfWeek: true,
      startMinute: true,
      endMinute: true,
      slotMinutes: true,
      breaks: {
        orderBy: { startMinute: 'asc' },
        select: {
          startMinute: true,
          endMinute: true,
        },
      },
    },
  },
} satisfies Prisma.DoctorAvailabilitySelect;

@Injectable()
export class AvailabilityService {
  constructor(private readonly database: DatabaseService) {}

  async get(doctorId: string) {
    const doctor = await this.database.doctorProfile.findUnique({
      where: { id: doctorId },
      select: {
        id: true,
        availability: {
          select: availabilityFields,
        },
      },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor profile not found.');
    }

    return {
      availability: doctor.availability ?? {
        doctorId,
        timeZone: 'Asia/Kolkata',
        version: 0,
        windows: [],
      },
    };
  }

  async save(doctorId: string, dto: SaveAvailabilityDto, actorStaffId: string) {
    validateAvailability(dto.windows);

    return this.database.$transaction(async (tx) => {
      // Serialize schedule writes, including the first-ever save.
      await tx.$queryRaw`
        SELECT "id"
        FROM "DoctorProfile"
        WHERE "id" = ${doctorId}::uuid
        FOR UPDATE
      `;

      const doctor = await tx.doctorProfile.findUnique({
        where: { id: doctorId },
        select: { id: true },
      });

      if (!doctor) {
        throw new NotFoundException('Doctor profile not found.');
      }

      const existing = await tx.doctorAvailability.findUnique({
        where: { doctorId },
        select: { version: true },
      });

      if ((existing?.version ?? 0) !== dto.expectedVersion) {
        throw new ConflictException({
          code: 'AVAILABILITY_VERSION_CONFLICT',
          message:
            'Availability changed. Reload and review your changes before saving.',
        });
      }

      const futureBooking = await tx.appointment.findFirst({
        where: {
          doctorId,
          status: 'BOOKED',
          endsAt: { gt: new Date() },
        },
        select: { id: true },
      });

      if (futureBooking) {
        throw new ConflictException({
          code: 'SCHEDULE_HAS_BOOKINGS',
          message:
            'This doctor has ongoing or future bookings. Resolve those bookings before changing weekly availability.',
        });
      }

      const windows = dto.windows.map((window) => ({
        dayOfWeek: window.dayOfWeek,
        startMinute: window.startMinute,
        endMinute: window.endMinute,
        slotMinutes: window.slotMinutes,
        breaks: {
          create: window.breaks.map((pause) => ({
            startMinute: pause.startMinute,
            endMinute: pause.endMinute,
          })),
        },
      }));

      const availability = existing
        ? await tx.doctorAvailability.update({
            where: { doctorId },
            data: {
              version: { increment: 1 },
              windows: {
                deleteMany: {},
                create: windows,
              },
            },
            select: availabilityFields,
          })
        : await tx.doctorAvailability.create({
            data: {
              doctorId,
              timeZone: 'Asia/Kolkata',
              windows: { create: windows },
            },
            select: availabilityFields,
          });

      await tx.auditEvent.create({
        data: {
          actorStaffId,
          action: 'DOCTOR_AVAILABILITY_SAVED',
          resourceType: 'DoctorAvailability',
          resourceId: doctorId,
        },
      });

      return { availability };
    });
  }
}
