import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { ListOwnAppointmentsDto } from './list-own-appointments.dto.js';

import { DatabaseService } from '../database/database.service.js';
import { generateDaySlots } from '../availability/slot.utils.js';
import type { CreateAppointmentDto } from './create-appointment.dto.js';
import { Prisma } from '../generated/prisma/client.js';
import type { ListAppointmentsDto } from './list-appointments.dto.js';
import type { CancelAppointmentDto } from './cancel-appointment.dto.js';

const DAY_MS = 86_400_000;
const INDIA_OFFSET_MS = 330 * 60_000;

const appointmentFields = {
  id: true,
  patientId: true,
  doctorId: true,
  startsAt: true,
  endsAt: true,
  status: true,
  version: true,
  createdAt: true,
  mode: true,
};

@Injectable()
export class AppointmentsService {
  constructor(private readonly database: DatabaseService) {}

  async create(
    dto: CreateAppointmentDto,
    actorStaffId: string,
    idempotencyKey: string,
  ) {
    const patientId = dto.patientId.toLowerCase();
    const doctorId = dto.doctorId.toLowerCase();
    const key = idempotencyKey.toLowerCase();

    const mode = dto.mode ?? 'IN_PERSON';

    const requestData = {
      patientId,
      doctorId,
      date: dto.date,
      startMinute: dto.startMinute,
      expectedAvailabilityVersion: dto.expectedAvailabilityVersion,
    };

    const hash = (value: unknown) =>
      createHash('sha256').update(JSON.stringify(value)).digest('hex');

    const requestHash = hash({
      ...requestData,
      mode,
    });

    // Support retries of bookings created before mode was added.
    const legacyRequestHash = hash(requestData);

    return this.database.$transaction(
      async (tx) => {
        /*
         * Initial single-hospital implementation:
         * serialize bookings with hospital-closure writes.
         *
         * This uses the same key as your ClosureService.
         */
        await tx.$queryRaw`
  SELECT pg_advisory_xact_lock(784211)::text AS "lockResult"
`;

        const previous = await tx.appointmentBookingRequest.findUnique({
          where: {
            actorStaffId_key: {
              actorStaffId,
              key,
            },
          },
          select: {
            requestHash: true,
            appointment: {
              select: appointmentFields,
            },
          },
        });

        if (previous) {
          const matchesCurrent = previous.requestHash === requestHash;

          const matchesLegacy =
            mode === 'IN_PERSON' && previous.requestHash === legacyRequestHash;

          if (!matchesCurrent && !matchesLegacy) {
            throw new ConflictException({
              code: 'IDEMPOTENCY_KEY_REUSED',
              message:
                'This booking key was already used for different booking details.',
            });
          }

          return {
            replayed: true,
            appointment: previous.appointment,
          };
        }

        // Coordinate with weekly schedule and doctor-leave changes.
        await tx.$queryRaw`
          SELECT "id"
          FROM "DoctorProfile"
          WHERE "id" = ${doctorId}::uuid
          FOR UPDATE
        `;

        const now = new Date();
        const date = new Date(`${dto.date}T00:00:00.000Z`);

        if (
          !Number.isFinite(date.getTime()) ||
          date.toISOString().slice(0, 10) !== dto.date
        ) {
          throw new BadRequestException('Invalid calendar date.');
        }

        const today = new Date(now.getTime() + INDIA_OFFSET_MS)
          .toISOString()
          .slice(0, 10);

        const daysAhead =
          (date.getTime() - new Date(`${today}T00:00:00.000Z`).getTime()) /
          DAY_MS;

        if (daysAhead < 0 || daysAhead > 180) {
          throw new BadRequestException(
            'Choose a date from today through 180 days ahead.',
          );
        }

        const doctor = await tx.doctorProfile.findUnique({
          where: { id: doctorId },
          select: {
            isActive: true,
            department: {
              select: { isActive: true },
            },
            availability: {
              select: {
                version: true,
                timeZone: true,
                windows: {
                  where: {
                    dayOfWeek: date.getUTCDay(),
                  },
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
          throw new NotFoundException('Doctor profile not found.');
        }

        const patient = await tx.patient.findUnique({
          where: { id: patientId },
          select: { id: true },
        });

        if (!patient) {
          throw new NotFoundException('Patient not found.');
        }

        if (!doctor.isActive || !doctor.department.isActive) {
          throw new ConflictException('The doctor or department is inactive.');
        }

        const availability = doctor.availability;

        if (!availability) {
          throw new ConflictException(
            'This doctor has no weekly availability.',
          );
        }

        if (availability.version !== dto.expectedAvailabilityVersion) {
          throw new ConflictException({
            code: 'AVAILABILITY_VERSION_CONFLICT',
            message: 'The schedule changed. Refresh the slots before booking.',
          });
        }

        if (availability.timeZone !== 'Asia/Kolkata') {
          throw new BadRequestException(
            'Booking currently supports Asia/Kolkata only.',
          );
        }

        const hospitalClosure = await tx.hospitalDateClosure.findUnique({
          where: { date },
          select: { isClosed: true },
        });

        const doctorClosure = await tx.doctorDateClosure.findUnique({
          where: {
            doctorId_date: { doctorId, date },
          },
          select: { isClosed: true },
        });

        if (hospitalClosure?.isClosed) {
          throw new ConflictException('The hospital is closed on this date.');
        }

        if (doctorClosure?.isClosed) {
          throw new ConflictException('The doctor is on leave on this date.');
        }

        const requestedStart = new Date(
          new Date(`${dto.date}T00:00:00+05:30`).getTime() +
            dto.startMinute * 60_000,
        ).toISOString();

        const selectedSlot = generateDaySlots(
          dto.date,
          availability.windows,
          now,
        ).find((slot) => slot.startsAt === requestedStart);

        if (!selectedSlot) {
          throw new ConflictException({
            code: 'SLOT_UNAVAILABLE',
            message: 'This time is not an available future consultation slot.',
          });
        }

        const startsAt = new Date(selectedSlot.startsAt);
        const endsAt = new Date(selectedSlot.endsAt);

        const overlap = await tx.appointment.findFirst({
          where: {
            status: 'BOOKED',
            startsAt: { lt: endsAt },
            endsAt: { gt: startsAt },
            OR: [{ doctorId }, { patientId }],
          },
          select: { id: true },
        });

        if (overlap) {
          throw new ConflictException({
            code: 'APPOINTMENT_OVERLAP',
            message:
              'The doctor or patient already has a booking during this time.',
          });
        }

        // Catch a slot that elapsed while database checks were running.
        if (startsAt.getTime() <= Date.now()) {
          throw new ConflictException(
            'This slot has already started. Choose another time.',
          );
        }

        const appointment = await tx.appointment.create({
          data: {
            patientId,
            doctorId,
            createdByStaffId: actorStaffId,
            startsAt,
            endsAt,
            mode,
          },
          select: appointmentFields,
        });

        await tx.appointmentBookingRequest.create({
          data: {
            actorStaffId,
            key,
            requestHash,
            appointmentId: appointment.id,
          },
        });

        await tx.auditEvent.create({
          data: {
            actorStaffId,
            action: 'APPOINTMENT_BOOKED',
            resourceType: 'Appointment',
            resourceId: appointment.id,
          },
        });

        return {
          replayed: false,
          appointment,
        };
      },
      {
        isolationLevel: 'ReadCommitted',
        maxWait: 5_000,
        timeout: 15_000,
      },
    );
  }
  async list(query: ListAppointmentsDto) {
    const parseDate = (value: string): Date => {
      const date = new Date(`${value}T00:00:00.000Z`);

      if (
        !Number.isFinite(date.getTime()) ||
        date.toISOString().slice(0, 10) !== value
      ) {
        throw new BadRequestException('Invalid calendar date.');
      }

      return date;
    };

    const fromDate = parseDate(query.from);
    const toDate = parseDate(query.to);

    const dayDifference = (toDate.getTime() - fromDate.getTime()) / DAY_MS;

    if (dayDifference < 0 || dayDifference > 30) {
      throw new BadRequestException(
        'Choose an ordered date range containing no more than 31 dates.',
      );
    }

    const from = new Date(`${query.from}T00:00:00+05:30`);

    const until = new Date(
      new Date(`${query.to}T00:00:00+05:30`).getTime() + DAY_MS,
    );

    const where = {
      startsAt: {
        gte: from,
        lt: until,
      },
      ...(query.doctorId ? { doctorId: query.doctorId } : {}),
      ...(query.patientId ? { patientId: query.patientId } : {}),
      ...(query.status ? { status: query.status } : {}),
    } satisfies Prisma.AppointmentWhereInput;

    const [items, total] = await this.database.$transaction(
      [
        this.database.appointment.findMany({
          where,
          orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
          select: {
            ...appointmentFields,
            cancelledAt: true,
            patient: {
              select: {
                id: true,
                fullName: true,
              },
            },
            doctor: {
              select: {
                id: true,
                displayName: true,
              },
            },
          },
        }),
        this.database.appointment.count({ where }),
      ],
      {
        isolationLevel: 'RepeatableRead',
      },
    );

    return {
      timeZone: 'Asia/Kolkata',
      items,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async cancel(
    appointmentId: string,
    dto: CancelAppointmentDto,
    actorStaffId: string,
  ) {
    return this.database.$transaction(
      async (tx) => {
        // Same coordination lock used by booking and hospital closures.
        await tx.$queryRaw`
  SELECT pg_advisory_xact_lock(784211)::text AS "lockResult"
`;

        const appointment = await tx.appointment.findUnique({
          where: { id: appointmentId },
          select: appointmentFields,
        });

        if (!appointment) {
          throw new NotFoundException('Appointment not found.');
        }

        // Repeating a successful cancellation is safe.
        if (appointment.status === 'CANCELLED') {
          return {
            alreadyCancelled: true,
            appointment,
          };
        }

        // Coordinate with this doctor's schedule and leave changes.
        await tx.$queryRaw`
          SELECT "id"
          FROM "DoctorProfile"
          WHERE "id" = ${appointment.doctorId}::uuid
          FOR UPDATE
        `;

        if (appointment.version !== dto.expectedVersion) {
          throw new ConflictException({
            code: 'APPOINTMENT_VERSION_CONFLICT',
            message: 'This appointment changed. Refresh before cancelling.',
          });
        }

        const now = new Date();

        if (appointment.startsAt.getTime() <= now.getTime()) {
          throw new ConflictException({
            code: 'APPOINTMENT_ALREADY_STARTED',
            message:
              'Only appointments that have not started can be cancelled.',
          });
        }

        const updated = await tx.appointment.updateMany({
          where: {
            id: appointmentId,
            status: 'BOOKED',
            version: dto.expectedVersion,
          },
          data: {
            status: 'CANCELLED',
            cancelledAt: now,
            cancelledByStaffId: actorStaffId,
            version: { increment: 1 },
          },
        });

        if (updated.count !== 1) {
          throw new ConflictException({
            code: 'APPOINTMENT_VERSION_CONFLICT',
            message: 'This appointment changed. Refresh before cancelling.',
          });
        }

        await tx.auditEvent.create({
          data: {
            actorStaffId,
            action: 'APPOINTMENT_CANCELLED',
            resourceType: 'Appointment',
            resourceId: appointmentId,
          },
        });

        const cancelled = await tx.appointment.findUniqueOrThrow({
          where: { id: appointmentId },
          select: appointmentFields,
        });

        return {
          alreadyCancelled: false,
          appointment: cancelled,
        };
      },
      {
        isolationLevel: 'ReadCommitted',
        maxWait: 5_000,
        timeout: 15_000,
      },
    );
  }

  async listOwn(actorStaffId: string, query: ListOwnAppointmentsDto) {
    const parseDate = (value: string): Date => {
      const date = new Date(`${value}T00:00:00.000Z`);

      if (
        !Number.isFinite(date.getTime()) ||
        date.toISOString().slice(0, 10) !== value
      ) {
        throw new BadRequestException('Invalid calendar date.');
      }

      return date;
    };

    const fromDate = parseDate(query.from);
    const toDate = parseDate(query.to);

    const dayDifference = (toDate.getTime() - fromDate.getTime()) / DAY_MS;

    if (dayDifference < 0 || dayDifference > 30) {
      throw new BadRequestException(
        'Choose an ordered date range containing no more than 31 dates.',
      );
    }

    const from = new Date(`${query.from}T00:00:00+05:30`);

    const until = new Date(
      new Date(`${query.to}T00:00:00+05:30`).getTime() + DAY_MS,
    );

    return this.database.$transaction(
      async (tx) => {
        const doctor = await tx.doctorProfile.findUnique({
          where: {
            staffUserId: actorStaffId,
          },
          select: {
            id: true,
            displayName: true,
            isActive: true,
            department: {
              select: {
                isActive: true,
              },
            },
          },
        });

        if (!doctor) {
          throw new ForbiddenException({
            code: 'DOCTOR_PROFILE_NOT_LINKED',
            message:
              'Your staff account is not linked to a doctor profile. Contact your hospital administrator.',
          });
        }

        if (!doctor.isActive || !doctor.department.isActive) {
          throw new ForbiddenException({
            code: 'DOCTOR_PROFILE_INACTIVE',
            message:
              'Your doctor profile or department is inactive. Contact your hospital administrator.',
          });
        }

        const where = {
          doctorId: doctor.id,
          startsAt: {
            gte: from,
            lt: until,
          },
          ...(query.status ? { status: query.status } : {}),
        } satisfies Prisma.AppointmentWhereInput;

        const items = await tx.appointment.findMany({
          where,
          orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
          select: {
            id: true,
            startsAt: true,
            endsAt: true,
            status: true,
            mode: true,
            version: true,
            patient: {
              select: {
                id: true,
                fullName: true,
              },
            },
            doctor: {
              select: {
                id: true,
                displayName: true,
              },
            },
          },
        });

        const total = await tx.appointment.count({ where });

        return {
          doctor: {
            id: doctor.id,
            displayName: doctor.displayName,
          },
          timeZone: 'Asia/Kolkata',
          items,
          total,
          page: query.page,
          limit: query.limit,
          totalPages: Math.ceil(total / query.limit),
        };
      },
      {
        isolationLevel: 'RepeatableRead',
      },
    );
  }
}
